# Task 9 — Scope Consulting Engineers: Website + AI Document Chatbot

This task **combines Task 6 (company website)** and **Task 3 (RAG document
chatbot)** into one product: the Scope Consulting Engineers website now has a
built-in AI assistant that answers questions from the company's documents.

> 📖 **Other docs:**
> - [`WHERE_IS_EVERYTHING.md`](WHERE_IS_EVERYTHING.md) — a **locator**: where each
>   feature is, how to reach it, and what it's for (start here to find things).
> - [`WHAT_WAS_BUILT.md`](WHAT_WAS_BUILT.md) — a **step-by-step explanation** of how
>   everything works.
> - This README — **setup / how to run**.

- **Front-end:** the existing static website (HTML/CSS/JS) + a floating chat
  widget on every page (`js/chatbot.js`, bilingual English/Arabic). The widget
  has **two modes**:
  - **Company Docs** — answers from the company's indexed documents (default).
  - **Personal Bot** — the visitor uploads their own files (PDF/DOCX/TXT/MD) and
    the bot answers **only** from those uploaded files. Personal uploads are
    kept out of the Company bot's answers (they are tagged `scope: personal`).
    They can also **attach an image / drawing** and ask about it — the question
    is answered by a **vision model** (`llava`) instead of text search.
- **Web server:** Node/Express over HTTPS (`server.js`) — serves the site,
  handles the contact form, and **proxies** `/api/chat` to the chatbot service.
- **Chatbot service:** a Python Flask API (`chatbot/api.py`) wrapping the RAG
  core (`chatbot/rag_core.py`): ChromaDB vector search + a local Ollama LLM,
  with OCR support for scanned PDFs (Arabic + English).
- **Plan Your Project** (`planner.html` + `js/planner.js`): an interactive
  SVG floor-plan editor. Visitors draw **walls** by clicking corner to corner;
  whenever walls enclose an area it is **automatically detected as a room**
  (planar face-finding), and drawing walls inside a room **splits it** into
  smaller rooms (kitchen, bathroom, …) that can be named and typed. It also has
  CAD-style editing: **straight-line (ortho) snapping** for perfect angles,
  **moving walls/corners** by dragging, **smart select** (clicking a leftover
  open wall piece selects just that piece so Delete trims it), **copy/paste**
  rooms & items and **duplicate a floor**, **doors with flippable swing** +
  windows, and
  **fixtures** — stairs, lift, gate, and furniture (bed, sofa, table, chair,
  sink, toilet, car, plant, counter, wardrobe) that can be placed, moved and
  rotated (furniture **snaps to a nearby wall**). Live measurements (wall lengths,
  room dimensions, areas, totals) with **draggable labels**, a **Set-scale** tool
  (click two points + type the real distance → accurate metres), a live **room
  schedule** table, multiple floors, **undo/redo**, and **autosave** (your plan
  survives a refresh, with a **New plan** reset). It also has **starter templates**
  (studio / apartment / villa / office), a **metric ⇄ imperial** toggle, a **north
  arrow**, a simple **3D isometric preview**, and **touch support** for tablets.
  Finally **download a PDF or PNG** (the PDF includes the room-schedule table on the
  left), or **email the plan to the company**. The PDF is rendered server-side (`/api/plan/pdf`,
  `/api/plan/email` in `server.js`, using `pdfkit` + `svg-to-pdfkit`) and the
  email reuses the same Nodemailer pipeline as the contact form.
- **Admin dashboard** (`admin.html` + `js/admin.js`): a protected page (gated by
  a username/password, which you set in `.env`) to see every
  **consultation booking** with the client's details (and cancel one, which frees
  the slot again), **add / remove company documents** without the CLI and view
  **analytics** — most-asked questions, 👍/👎 **feedback review** (see the answers
  people marked unhelpful), an **"add documents for these"** report (low-confidence
  questions), and **CSV export**. Admin API routes (`/api/admin/*`) are guarded in
  `server.js`.
- **Get a Quote** (`quote.html` + `js/quote.js`): an instant **cost + timeline
  estimator** that also **books a consultation in a real appointment slot**.
  Visitors pick a date and then choose from the **30-minute slots the office is
  actually open** (Sat–Thu 09:00–14:00 and 17:00–21:30; Friday closed). Slots
  already taken by someone else are shown as *booked* and cannot be selected, and
  the server re-checks the hours and the collision before confirming, so the same
  slot can never be double-booked. Confirmed bookings are stored in
  `data/bookings.json`, emailed to the company via `/api/book`, and listed on the
  admin dashboard. Plus a **testimonials** section, a **project-gallery lightbox**,
  **PWA** support (installable + offline via `sw.js` / `manifest.webmanifest`),
  and SEO basics (`sitemap.xml`, `robots.txt`).

```
Browser ──HTTPS──> Node/Express (server.js) ──HTTP proxy──> Flask API (chatbot/api.py)
  chat widget          /api/chat                 /chat        ChromaDB + Ollama
```

Because the browser only ever talks to the one HTTPS origin, there is no CORS or
mixed-content problem — the Node server forwards chat requests to Python
internally.

---

## Project layout

```
scope_ai_website/
├── server.js            Node/Express HTTPS server (site + contact + chat proxy)
├── package.json         Node dependencies
├── .env.example         Copy to .env and fill in
├── index.html …         Website pages (all include js/chatbot.js)
├── css/style.css        Site styles + chatbot widget styles (appended at end)
├── js/
│   ├── script.js        Existing site JS (nav, language toggle, contact form)
│   └── chatbot.js       Self-injecting AI chat widget
└── chatbot/             Python RAG service
    ├── api.py           Flask API: /chat, /documents, /ingest, /health
    ├── rag_core.py      RAG logic (ingest, embed, search, ask Ollama)
    ├── ingest_docs.py   One-off: index everything in company_docs/
    ├── requirements.txt Python dependencies
    └── company_docs/    Source documents (seed data)
```

---

## Run with Docker (one command)

The whole stack — Ollama + the Python chatbot + the Node site — is containerised.

```bash
# optional: create a .env with ADMIN_USER / ADMIN_PASS / GMAIL_* next to docker-compose.yml
docker compose up -d --build

# pull the models into the Ollama container (one time)
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull llava:latest
```

Open **https://localhost:3000**. The chatbot auto-indexes `company_docs/` on first
run. Data persists in named volumes (`ollama_models`, `chroma_data`, `hf_cache`).

| File | Role |
|------|------|
| `docker-compose.yml` | ollama + chatbot + web services, volumes, wiring |
| `Dockerfile.web` | Node site & proxy |
| `Dockerfile.chatbot` | Python RAG API (+ `docker-entrypoint.sh` seeds then serves) |

To run **without** Docker, use the two-process setup below.

---

## Prerequisites (non-Docker)

- **Node.js** 18+
- **Python** 3.10+
- **[Ollama](https://ollama.com)** running locally with the model pulled:
  ```bash
  ollama pull llama3.1:8b
  ```

---

## Quick start (one command)

From the `scope_ai_website` folder, just run:

```powershell
.\start.ps1
```

…or **double-click `start.bat`**. On the first run it creates the Python
virtual environment, installs the Python + Node dependencies, and indexes the
company documents; then it starts **both** services together:

- the Python chatbot API — `http://127.0.0.1:8000`
- the website — **https://localhost:3000**

Press **Ctrl+C** (or close the window) to stop both. Then open
https://localhost:3000 and click **"Ask our AI"**.

> Answers still need **Ollama** running with the model pulled
> (`ollama pull llama3.1:8b`); everything else is handled for you.

---

## Manual setup & run (two terminals)

If you prefer to run the two processes yourself:

### 1. Start the chatbot service (Python)

```bash
cd chatbot
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt

# Index the company documents into the vector DB (run once, or after adding docs)
python ingest_docs.py

# Start the API (listens on 127.0.0.1:8000)
python api.py
```

> The first run downloads the embedding model (and OCR models if a scanned PDF
> is processed), so it takes a little longer.

### 2. Start the website (Node)

In a second terminal:

```bash
npm install
cp .env.example .env       # then fill in Gmail values for the contact form
npm start
```

Open **https://localhost:3000** (accept the self-signed certificate warning).
Click the **"Ask our AI"** button at the bottom-right of any page and ask, e.g.:

- *"What are the design requirements for the Al Yasmeen villa?"*
- *"ما هي متطلبات التصميم؟"* (answers in Arabic)

---

## How the pieces connect

| Piece | File | Responsibility |
|-------|------|----------------|
| Chat widget | `js/chatbot.js` | Launcher + panel, Company/Personal tabs, file upload, **image Q&A (vision)**, **read-aloud (offline TTS)**, **"Ask about this page"**, streaming answers, markdown **+ tables**, source snippets, confidence note, **suggested follow-ups**, **regenerate**, **download chat**, search depth, **persists across page navigation**, **Stop / Copy / 👍👎 feedback**, **lead capture**, bilingual. |
| Chat proxy | `server.js` | Forwards `/api/chat`, `/api/chatbot/ingest` (file upload), `/api/chatbot/documents`, `/api/chatbot/health` to the Python service. |
| API | `chatbot/api.py` | HTTP endpoints over the RAG core. |
| RAG core | `chatbot/rag_core.py` | File parsing/OCR, chunking, embeddings, **query rewriting**, **hybrid retrieval** (vector + BM25, RRF-fused) with **semantic re-ranking**, a **confidence** estimate, **prompt-injection guardrails**, and Ollama answering. |

### Adding more documents
Drop `.pdf`, `.docx`, `.txt`, or `.md` files into `chatbot/company_docs/` and
re-run `python ingest_docs.py`. (You can also POST a file to the API's
`/ingest` endpoint.)

---

## Configuration (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HTTPS_PORT` | `3000` | Website HTTPS port |
| `HTTP_PORT` | `3001` | Redirects to HTTPS |
| `CHATBOT_HOST` | `127.0.0.1` | Where the Python API listens |
| `CHATBOT_PORT` | `8000` | Where the Python API listens |
| `ADMIN_USER` / `ADMIN_PASS` | _(none — required)_ | Admin dashboard login (`/admin.html`). The server exits at start-up if unset |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `CONTACT_TO` | — | Contact-form email (Task 6) |

The chatbot's Ollama models/URL can be overridden with `OLLAMA_MODEL`,
`CHATBOT_VISION_MODEL` (default `llava:latest`), and `OLLAMA_URL` environment
variables (see `chatbot/rag_core.py`).

---

## Notes
- If the chat widget says *"The AI assistant is offline"*, the Python service
  (`chatbot/api.py`) or Ollama isn't running.
- The vector database is stored in `chatbot/chroma_db/` (created on first
  ingest).
- This replaces the standalone Streamlit UI from Task 3 — the same RAG logic now
  lives behind the website instead.
