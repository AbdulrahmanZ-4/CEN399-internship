"""
Flask API that exposes the RAG document chatbot to the company website.

The website's Node/Express server (server.js) proxies browser requests at
`/api/chat` and `/api/chatbot/*` to this service, so the front-end always talks
to the same HTTPS origin and there are no CORS or mixed-content problems.

Endpoints:
    GET  /health            -> service + model status
    GET  /documents         -> list stored documents and chunk count
    POST /chat              -> answer a question.
                               { question, top_k?, file_hashes?, history?, stream? }
                               stream=true -> newline-delimited JSON (NDJSON):
                                 {"type":"token","text":...} … {"type":"done","sources":[…]}
                               otherwise -> { answer, sources }
    POST /ingest            -> multipart file upload (Personal Bot)
    POST /forget            -> { file_hashes } delete personal uploads

On startup it warms up the model and periodically cleans up old personal
uploads. Served with waitress (a production WSGI server) when available.

Run:  python api.py         (listens on 127.0.0.1:8000 by default)
"""

import os
import json
import time
import logging
import threading

from flask import Flask, request, jsonify, Response, stream_with_context

import rag_core

app = Flask(__name__)

HOST = os.environ.get("CHATBOT_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHATBOT_PORT", "8000"))

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

# Reject uploads (and any request body) larger than this. Also enforced in Node.
MAX_UPLOAD_MB = int(os.environ.get("CHATBOT_MAX_UPLOAD_MB", "15"))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# How long a visitor's personal uploads live before automatic cleanup.
PERSONAL_TTL_SECONDS = int(os.environ.get("CHATBOT_PERSONAL_TTL_SECONDS", str(24 * 3600)))

# --- Logging ------------------------------------------------------------------
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "chatbot.log"), encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("scope-chatbot")

# A separate, easy-to-mine log of the questions people ask (helps improve docs).
question_logger = logging.getLogger("scope-questions")
question_logger.propagate = False
_qh = logging.FileHandler(os.path.join(LOG_DIR, "questions.log"), encoding="utf-8")
_qh.setFormatter(logging.Formatter("%(asctime)s\t%(message)s"))
question_logger.addHandler(_qh)
question_logger.setLevel(logging.INFO)


def log_question(mode, question):
    try:
        question_logger.info(f"{mode}\t{question}")
    except Exception:
        pass


# 👍/👎 feedback on answers, logged for later review.
feedback_logger = logging.getLogger("scope-feedback")
feedback_logger.propagate = False
_fh = logging.FileHandler(os.path.join(LOG_DIR, "feedback.log"), encoding="utf-8")
_fh.setFormatter(logging.Formatter("%(asctime)s\t%(message)s"))
feedback_logger.addHandler(_fh)
feedback_logger.setLevel(logging.INFO)

# Low-confidence questions -> topics the documents don't cover well ("add docs").
unanswered_logger = logging.getLogger("scope-unanswered")
unanswered_logger.propagate = False
_uh = logging.FileHandler(os.path.join(LOG_DIR, "unanswered.log"), encoding="utf-8")
_uh.setFormatter(logging.Formatter("%(asctime)s\t%(message)s"))
unanswered_logger.addHandler(_uh)
unanswered_logger.setLevel(logging.INFO)


# --- Helpers ------------------------------------------------------------------
def clamp_top_k(value):
    try:
        return max(3, min(10, int(value)))
    except (TypeError, ValueError):
        return 5


def sanitize_history(raw):
    """Keep only well-formed {role, text} turns, capped for safety."""
    if not isinstance(raw, list):
        return None
    cleaned = []
    for turn in raw[-8:]:
        if not isinstance(turn, dict):
            continue
        role = "user" if turn.get("role") == "user" else "assistant"
        text = str(turn.get("text") or "").strip()[:2000]
        if text:
            cleaned.append({"role": role, "text": text})
    return cleaned or None


# --- Endpoints ----------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "model": rag_core.OLLAMA_MODEL,
        "stored_chunks": rag_core.count_chunks(),
    })


@app.get("/documents")
def documents():
    docs_map = rag_core.list_documents()
    return jsonify({
        "documents": [
            {"file_hash": h, "source": name} for h, name in docs_map.items()
        ],
        "stored_chunks": rag_core.count_chunks(),
    })


@app.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"error": "Please provide a question."}), 400

    if rag_core.count_chunks() == 0:
        return jsonify({
            "error": (
                "No company documents have been indexed yet. "
                "Run 'python ingest_docs.py' first."
            )
        }), 409

    top_k = clamp_top_k(data.get("top_k"))
    file_hashes = data.get("file_hashes") or None
    history = sanitize_history(data.get("history"))

    # Multi-document summarize / compare -> pull in more context.
    import re as _re
    if _re.search(r"summar|compare|overview|كل الملفات|لخّص|لخص|قارن|نظرة عامة", question, _re.I):
        top_k = max(top_k, 8)

    # Personal Bot passes file_hashes (search only those uploads). Otherwise this
    # is the Company bot, which must NOT see visitors' personal uploads.
    scope = None if file_hashes else "company"
    mode = "personal" if file_hashes else "company"
    log_question(mode, question)

    # Query rewriting + hybrid retrieval + confidence (see rag_core.prepare_answer).
    prep = rag_core.prepare_answer(
        question, top_k=top_k, file_hashes=file_hashes, scope=scope, history=history
    )
    prompt = prep["prompt"]
    sources = prep["sources"]
    confidence = prep["confidence"]

    # Log low-confidence company questions so admins know what to add documents for.
    if confidence == "low" and mode == "company":
        try:
            unanswered_logger.info(question.replace("\t", " ").replace("\n", " "))
        except Exception:
            pass

    if data.get("stream"):
        def generate():
            try:
                for piece in rag_core.stream_ollama(prompt):
                    yield json.dumps({"type": "token", "text": piece}) + "\n"
                yield json.dumps({"type": "done", "sources": sources,
                                  "confidence": confidence}) + "\n"
            except Exception as error:  # pragma: no cover
                log.exception("streaming failed")
                yield json.dumps({"type": "error", "error": str(error)}) + "\n"

        return Response(
            stream_with_context(generate()),
            mimetype="application/x-ndjson",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    answer = rag_core.ask_ollama(prompt)
    return jsonify({"answer": answer, "sources": sources, "confidence": confidence})


@app.post("/page")
def page():
    """Answer a question about the content of the web page the visitor is on."""
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    page_text = (data.get("page_text") or "")[:8000]
    if not question:
        return jsonify({"error": "Please provide a question."}), 400
    history = sanitize_history(data.get("history"))
    log_question("page", question)

    def generate():
        try:
            for piece in rag_core.stream_page(question, page_text, history):
                yield json.dumps({"type": "token", "text": piece}) + "\n"
            yield json.dumps({"type": "done", "sources": [], "confidence": None}) + "\n"
        except Exception as error:  # pragma: no cover
            log.exception("page answer failed")
            yield json.dumps({"type": "error", "error": str(error)}) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/followups")
def followups():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    answer = (data.get("answer") or "").strip()
    if not question or not answer:
        return jsonify({"followups": []})
    try:
        return jsonify({"followups": rag_core.suggest_followups(question, answer)})
    except Exception:
        log.exception("followups failed")
        return jsonify({"followups": []})


@app.post("/vision")
def vision():
    """Answer a question about attached image(s) using the vision model."""
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    images = data.get("images") or []

    if not question:
        return jsonify({"error": "Please provide a question."}), 400
    if not images:
        return jsonify({"error": "Please attach an image first."}), 400

    history = sanitize_history(data.get("history"))
    log_question("vision", question)

    def generate():
        try:
            for piece in rag_core.stream_vision(question, images, history):
                yield json.dumps({"type": "token", "text": piece}) + "\n"
            yield json.dumps({"type": "done", "sources": [], "confidence": None}) + "\n"
        except Exception as error:  # pragma: no cover
            log.exception("vision failed")
            yield json.dumps({"type": "error", "error": str(error)}) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/ingest")
def ingest():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded (form field 'file')."}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400

    ext = os.path.splitext(uploaded.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type '{ext}'. Allowed: pdf, docx, txt, md."
        }), 400

    # Files uploaded through the API belong to the Personal Bot by default, so
    # they are tagged "personal" and stay out of the Company bot's answers.
    scope = (request.form.get("scope") or "personal").strip().lower()
    if scope not in ("personal", "company"):
        scope = "personal"
    session_id = (request.form.get("session_id") or "").strip()[:64]

    file_bytes = uploaded.read()
    try:
        chunks_added, file_hash = rag_core.ingest_file(
            file_bytes, uploaded.filename, scope=scope, session_id=session_id
        )
    except Exception as error:
        log.exception("ingest failed")
        return jsonify({"error": f"Failed to ingest: {error}"}), 500

    log.info("ingested %s (%s chunks, scope=%s)", uploaded.filename, chunks_added, scope)
    return jsonify({
        "source": uploaded.filename,
        "file_hash": file_hash,
        "chunks_added": chunks_added,
    })


@app.post("/feedback")
def feedback():
    data = request.get_json(silent=True) or {}
    vote = data.get("vote")
    if vote not in ("up", "down"):
        return jsonify({"error": "Invalid vote."}), 400
    question = (data.get("question") or "").replace("\t", " ").replace("\n", " ")[:500]
    answer = (data.get("answer") or "").replace("\t", " ").replace("\n", " ")[:500]
    feedback_logger.info(f"{vote}\t{question}\t{answer}")
    return jsonify({"ok": True})


@app.post("/forget")
def forget():
    data = request.get_json(silent=True) or {}
    file_hashes = data.get("file_hashes") or []
    removed = rag_core.forget_files(file_hashes)
    return jsonify({"removed_chunks": removed})


# --- Admin dashboard ----------------------------------------------------------
# These are gated by the Node layer (X-Admin-Key) and the service binds to
# localhost only, so they are not exposed to the public internet.
def _read_top_questions(limit=15):
    path = os.path.join(LOG_DIR, "questions.log")
    counts, total = {}, 0
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 3 and parts[-1].strip():
                    q = parts[-1].strip()
                    counts[q] = counts.get(q, 0) + 1
                    total += 1
    except FileNotFoundError:
        pass
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return total, [{"question": q, "count": c} for q, c in top]


def _read_feedback(recent_limit=20):
    path = os.path.join(LOG_DIR, "feedback.log")
    up = down = 0
    recent_down = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                # timestamp \t vote \t question \t answer
                if len(parts) >= 2:
                    vote = parts[1].strip()
                    if vote == "up":
                        up += 1
                    elif vote == "down":
                        down += 1
                        recent_down.append({
                            "question": parts[2] if len(parts) > 2 else "",
                            "answer": parts[3] if len(parts) > 3 else "",
                        })
    except FileNotFoundError:
        pass
    return {"up": up, "down": down, "recent_down": recent_down[-recent_limit:][::-1]}


def _read_unanswered(limit=15):
    """Aggregate low-confidence questions -> what to add documents for."""
    path = os.path.join(LOG_DIR, "unanswered.log")
    counts = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                q = (parts[-1] if parts else "").strip()
                if q:
                    counts[q] = counts.get(q, 0) + 1
    except FileNotFoundError:
        pass
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"question": q, "count": c} for q, c in top]


@app.get("/admin/overview")
def admin_overview():
    total_q, top_q = _read_top_questions()
    return jsonify({
        "documents": rag_core.document_stats(),
        "chunks": rag_core.count_chunks(),
        "questions_total": total_q,
        "top_questions": top_q,
        "feedback": _read_feedback(),
        "unanswered": _read_unanswered(),
        "model": rag_core.OLLAMA_MODEL,
        "vision_model": rag_core.VISION_MODEL,
    })


@app.post("/admin/ingest")
def admin_ingest():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded (form field 'file')."}), 400
    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400
    ext = os.path.splitext(uploaded.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type '{ext}'."}), 400

    file_bytes = uploaded.read()
    try:
        chunks_added, file_hash = rag_core.ingest_file(
            file_bytes, uploaded.filename, scope="company"
        )
    except Exception as error:
        log.exception("admin ingest failed")
        return jsonify({"error": f"Failed to ingest: {error}"}), 500

    log.info("admin ingested company doc %s (%s chunks)", uploaded.filename, chunks_added)
    return jsonify({"source": uploaded.filename, "file_hash": file_hash, "chunks_added": chunks_added})


@app.post("/admin/delete")
def admin_delete():
    data = request.get_json(silent=True) or {}
    file_hash = data.get("file_hash")
    if not file_hash:
        return jsonify({"error": "file_hash required."}), 400
    removed = rag_core.forget_files([file_hash])
    log.info("admin deleted doc %s (%s chunks)", file_hash, removed)
    return jsonify({"removed_chunks": removed})


@app.errorhandler(413)
def too_large(_error):
    return jsonify({
        "error": f"That file is too large. The limit is {MAX_UPLOAD_MB} MB."
    }), 413


# --- Background workers --------------------------------------------------------
def _warm_up_worker():
    log.info("Warming up model %s ...", rag_core.OLLAMA_MODEL)
    rag_core.warm_up()
    log.info("Model warm-up done.")


def _cleanup_worker():
    while True:
        try:
            removed = rag_core.cleanup_expired_personal(PERSONAL_TTL_SECONDS)
            if removed:
                log.info("Cleaned up %s expired personal chunk(s).", removed)
        except Exception:
            log.exception("cleanup failed")
        time.sleep(3600)  # run hourly


def start_background_workers():
    threading.Thread(target=_warm_up_worker, daemon=True).start()
    threading.Thread(target=_cleanup_worker, daemon=True).start()


if __name__ == "__main__":
    log.info("Scope chatbot API on http://%s:%s", HOST, PORT)
    log.info("Stored document chunks: %s", rag_core.count_chunks())
    log.info("Ollama model: %s", rag_core.OLLAMA_MODEL)

    start_background_workers()

    try:
        from waitress import serve
        log.info("Serving with waitress (production WSGI server).")
        serve(app, host=HOST, port=PORT, threads=8)
    except ImportError:
        log.warning("waitress not installed; falling back to Flask dev server.")
        app.run(host=HOST, port=PORT, threaded=True)
