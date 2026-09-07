# Task 9 — Full Project Documentation

**Scope Consulting Engineers — AI-Powered Company Website**

This document is the complete reference for Task 9. It is written so that a
reader with no prior context can (a) **understand** the project, (b) **explain
it** to instructors in a presentation, and (c) **use it to write a report**.

It explains not just *what* was built but *why* each decision was made and *how*
each piece works internally, including the background concepts (RAG, embeddings,
vector databases, streaming, planar graphs, etc.) in plain language.

- For **setup / how to run**, see [`README.md`](README.md).
- This file is the **explanation + report source**.

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [Background & motivation](#2-background--motivation)
3. [Concept glossary — the technologies, explained simply](#3-concept-glossary)
4. [System architecture](#4-system-architecture)
5. [Technology stack](#5-technology-stack)
6. [How a request flows through the system](#6-how-a-request-flows-through-the-system)
7. [Feature deep dives](#7-feature-deep-dives)
   - 7.1 Website + chatbot integration
   - 7.2 One-command launcher
   - 7.3 Personal Bot & the isolation fix
   - 7.4 Search-depth control
   - 7.5 Streaming answers
   - 7.6 Markdown, memory, warm-up
   - 7.7 Trust & polish (sources, starters, clear)
   - 7.8 Production hardening
   - 7.9 Plan Your Project (floor-plan editor)
   - 7.10 The walls-to-rooms algorithm
   - 7.11 Smarter answers (rewrite, hybrid, confidence)
   - 7.12 Persistence + controls
   - 7.13 Vision Q&A
   - 7.14 Lead capture
   - 7.15 Admin dashboard
   - 7.16 Dockerization
8. [Design decisions & trade-offs](#8-design-decisions--trade-offs)
9. [Security & privacy](#9-security--privacy)
10. [Testing & verification methodology](#10-testing--verification-methodology)
11. [Known limitations & future work](#11-known-limitations--future-work)
12. [Presentation guide (how to demo & explain)](#12-presentation-guide)
13. [File-by-file map](#13-file-by-file-map)

---

## 1. Executive summary

Task 9 combines two earlier projects — a **Python document chatbot** (Task 3) and
a **company website** (Task 6) — into a single, polished product: the **Scope
Consulting Engineers website with a built-in AI assistant**, plus several new
capabilities added on top.

**In one sentence:** it is a bilingual (English/Arabic) company website whose
visitors can *chat with an AI about the company's documents*, *upload their own
files or drawings and ask about them*, *design a floor plan and export it to
PDF*, and whose staff can *manage the knowledge base and see analytics* — all
running locally with no paid cloud AI service.

**Headline capabilities:**

| Capability | What the user can do |
|-----------|----------------------|
| AI Company assistant | Ask questions answered from company documents, with sources |
| Personal Bot | Upload personal files and ask about only those |
| Vision Q&A | Attach a drawing/photo and ask about it (image understanding) |
| Plan Your Project | Draw a home layout, see live measurements/areas, export PDF, email it |
| Smart retrieval | Query rewriting, hybrid keyword+semantic search, confidence signal |
| Lead capture | "Talk to our team" appears when relevant and emails the company |
| Admin dashboard | Add/remove documents and view usage analytics — no code needed |
| One-command deploy | `docker compose up` runs the entire stack |

**Why it matters (the pitch):** most "AI chatbots" on websites send data to an
external company and cost money per question. This one runs **entirely on local
infrastructure** (a local LLM via Ollama), keeps company documents private, and
grounds every answer in real documents instead of making things up.

---

## 2. Background & motivation

### 2.1 The two starting projects

- **Task 3 — Document Chatbot.** A Python **Streamlit** application. A user
  uploaded company documents (PDF/Word/text), and could ask questions; the app
  used **RAG** (explained below) to find relevant passages and a local LLM to
  write an answer grounded in them. It even handled **scanned** PDFs using OCR.
  *Weakness:* it was a standalone data-science tool, not something a company
  would put on its public website.

- **Task 6 — Company Website.** A professional multi-page marketing site
  (Home, About, Services, Projects, Contact), served by a **Node.js/Express**
  server over HTTPS, with a working **contact form** that emailed submissions.
  *Weakness:* it was "brochure-ware" — informative but not interactive or
  intelligent.

### 2.2 The problem Task 9 solves

Each project was half of a good idea. Task 6 was where customers actually go
(the website), but it couldn't answer questions. Task 3 could answer questions,
but nobody would find or use a separate Streamlit tool. **Task 9 merges them**:
the intelligence of Task 3, delivered inside the shop-window of Task 6 — and
then extended into a genuinely useful product for an engineering consultancy.

### 2.3 Design goals

1. **One product, one origin.** The visitor should experience a single website,
   not two apps bolted together.
2. **Private & local.** No customer data or documents leave the company's
   machine; the AI runs locally.
3. **Grounded answers.** The bot must answer *from documents*, cite sources, and
   admit when it doesn't know — never hallucinate company facts.
4. **Usable by non-technical people.** Visitors and staff should not need a
   command line or any jargon.
5. **Bilingual.** English and Arabic throughout (the company is in the UAE).

---

## 3. Concept glossary

These are the ideas you'll want to be able to explain in a presentation. Each
has a plain-language explanation and, where useful, an analogy.

### 3.1 LLM (Large Language Model)
A very large neural network trained to predict text. Given some text, it
produces a natural continuation. ChatGPT is an LLM. Here we use **local** LLMs
so nothing is sent to the cloud.
- **Analogy:** an extremely well-read assistant who can write fluently but only
  "remembers" what it read during training — it doesn't know *your* company's
  documents unless you show them.

### 3.2 Ollama
A free program that runs LLMs **on your own computer**. You "pull" (download) a
model once, then any program can ask it questions over a local web address
(`http://localhost:11434`). We use two models:
- **`llama3.1:8b`** — an 8-billion-parameter text model, good in Arabic + English.
- **`llava:latest`** — a *vision* model that can look at **images**.

### 3.3 RAG (Retrieval-Augmented Generation)
The core technique. Instead of trusting the LLM's memory, we:
1. **Retrieve** the most relevant passages from the company's documents, then
2. **Augment** the question with those passages, then
3. Let the LLM **generate** an answer *using only that provided context*.
- **Why:** it makes answers accurate, up-to-date, and **grounded** — the bot
  answers from real documents and can cite them, instead of inventing facts.
- **Analogy:** an open-book exam. The model doesn't have to memorise the company
  handbook; we hand it the exact pages it needs and say "answer from these."

### 3.4 Embeddings & the embedding model
An **embedding** turns a piece of text into a list of numbers (a *vector*, e.g.
384 numbers) that captures its *meaning*. Texts with similar meaning get similar
vectors — even in different languages or wording.
- We use **`paraphrase-multilingual-MiniLM-L12-v2`**, chosen because it handles
  **Arabic and English together**.
- **Analogy:** a GPS coordinate for meaning. "How many bedrooms?" and "number of
  sleeping rooms" land near each other on the map, so we can find one using the
  other.

### 3.5 Vector database (ChromaDB) & cosine similarity
A database built to store embeddings and instantly find the *nearest* ones to a
query embedding. We use **ChromaDB** (stored on disk in `chroma_db/`).
- **Cosine similarity** measures the angle between two vectors — smaller angle =
  more similar meaning. Chroma returns a *distance*; we convert it to a 0–100%
  similarity for display.
- **Analogy:** a librarian who, instead of matching keywords, understands what
  you *mean* and hands you the closest passages.

### 3.6 Chunking
Documents are split into overlapping **chunks** (~180 words, 40-word overlap)
before embedding. Retrieval then returns the most relevant *chunks*, not whole
files.
- **Why chunk:** a whole document is too big and too broad to embed well;
  chunks let us find the exact relevant paragraph.
- **Why overlap:** so a sentence split across a chunk boundary still appears
  whole in at least one chunk.

### 3.7 OCR (Optical Character Recognition)
Reading text out of an **image**. Scanned drawings are images with no selectable
text. We detect pages with almost no extractable text and run **EasyOCR**
(Arabic + English) to read them.
- **Analogy:** teaching the computer to "read" a photo of a page the way a
  person would.

### 3.8 BM25 (keyword search) & hybrid retrieval
**BM25** is a classic keyword-ranking algorithm (like a search engine): it
favours documents that contain the query's exact words, weighted by how rare and
frequent they are. **Hybrid retrieval** runs *both* semantic (embedding) search
**and** BM25, then merges the two rankings.
- **Why both:** embeddings are great at *meaning* but can miss exact terms
  (a project code, "850", a name); BM25 nails exact terms but misses paraphrases.
  Together they cover each other's blind spots.

### 3.9 RRF (Reciprocal Rank Fusion)
A simple, robust way to merge two ranked lists. Each item gets a score of
`1 / (k + rank)` from each list (k=60), and items are re-sorted by the summed
score. An item ranked highly by *either* method rises to the top.
- **Analogy:** two expert judges rank the candidates; RRF fairly combines their
  ballots without needing their scores to be on the same scale.

### 3.10 Query rewriting
For a follow-up like "why does that matter?", the words alone are useless for
search. We ask the LLM to rewrite it into a **standalone** query using the recent
conversation ("Why is exceeding the 850 m² built-up area a problem?") *before*
searching.

### 3.11 Streaming (NDJSON)
Instead of waiting for the whole answer, the server sends it **word by word** as
it's generated. We send **NDJSON** (newline-delimited JSON): one small JSON
object per line (`{"type":"token","text":"Hello"}`), ending with a
`{"type":"done", ...}` line. The browser reads the stream and appends each token.
- **Why:** it *feels* far faster and shows the bot is "thinking," even though
  total time is the same.

### 3.12 Confidence guard
We look at the best similarity score of the retrieved chunks. If even the best
match is weak, we label the answer **low confidence** and warn the user, because
the topic probably isn't in the documents.

### 3.13 Vector of meaning vs. pixels — the vision model
The text pipeline can't "see" a drawing. The **vision model (llava)** takes the
actual **image pixels** plus a question and answers about what it sees. This is a
separate path from RAG.

### 3.14 Planar graph & face-finding (the floor-plan brain)
When you draw walls, they form a **graph**: corners are *nodes*, wall segments
are *edges*. A closed loop of walls encloses a region — mathematically a **face**
of the graph. **Face-finding** is the algorithm that detects these enclosed
regions automatically, so any closed set of walls becomes a room, and a wall
drawn across a room splits it into two.
- **Analogy:** if you draw fences in a field, the algorithm figures out which
  paddocks you've fenced off — and if you add a fence across a paddock, it now
  sees two paddocks.

### 3.15 Proxy, CORS, and "same origin"
Browsers block a page from calling a *different* server (different host/port) for
security — this is **CORS**. To avoid it, the browser only talks to **one**
address (the Node server), which quietly **proxies** (forwards) AI requests to
the Python service behind the scenes. To the browser it's all "same origin."

### 3.16 WSGI server (Waitress)
Flask's built-in server is for development only. **Waitress** is a
production-grade **WSGI** server (the standard interface between Python web apps
and the outside world) — it handles multiple simultaneous requests robustly.

### 3.17 Docker & Docker Compose
**Docker** packages an app plus everything it needs into a portable **image** so
it runs identically anywhere. **Docker Compose** describes several such
containers and how they connect, so one command starts the whole system.
- **Analogy:** shipping containers — the app is packed with all its dependencies,
  and Compose is the manifest that says which containers ship together and how
  they're wired.

---

## 4. System architecture

The system has **three running processes** plus the browser:

```
┌───────────────┐   HTTPS      ┌──────────────────────────┐   HTTP (localhost)   ┌───────────────────────┐
│    Browser    │ ───────────▶ │   Node / Express         │ ───────────────────▶ │  Python API           │
│  (the visitor)│ ◀─────────── │   server.js  :3000       │ ◀─────────────────── │  api.py (Waitress)    │
│  pages +      │   HTML/JSON  │  • serves the website    │   JSON / NDJSON      │  :8000                │
│  chat widget  │   /stream    │  • email (contact/plan)  │                      │  • RAG core           │
│  + planner    │              │  • proxies all /api/*    │                      │  • ChromaDB           │
└───────────────┘              └──────────────────────────┘                      └───────────┬───────────┘
                                                                                              │ HTTP
                                                                                              ▼
                                                                                  ┌───────────────────────┐
                                                                                  │  Ollama  :11434       │
                                                                                  │  • llama3.1:8b (text) │
                                                                                  │  • llava (vision)     │
                                                                                  └───────────────────────┘
```

**Why three processes?** Each does what it's best at:
- **Node** is excellent at serving web pages, streaming, and email.
- **Python** has the mature AI/ML ecosystem (embeddings, ChromaDB, OCR).
- **Ollama** is the dedicated LLM runtime.

**The golden rule:** the **browser only ever talks to Node**. Node is the single
front door. It forwards AI calls to Python internally. This is what makes it feel
like one website and avoids all cross-origin security issues (see §3.15).

### 4.1 What lives where

| Layer | Process | Key files | Responsibility |
|-------|---------|-----------|----------------|
| Front-end | Browser | `*.html`, `js/chatbot.js`, `js/planner.js`, `js/admin.js`, `css/style.css` | Pages, chat widget, floor-plan editor, admin UI |
| Web server + proxy | Node | `server.js` | Serve site, email, proxy every `/api/*` to Python, rate-limit, admin auth, PDF generation |
| AI service | Python | `chatbot/api.py`, `chatbot/rag_core.py` | RAG, vision, ingestion, analytics, logging |
| Vector DB | (in Python) | `chatbot/chroma_db/` | Stores document embeddings on disk |
| LLM runtime | Ollama | (external) | Runs the text + vision models |

---

## 5. Technology stack

| Area | Technology | Why it was chosen |
|------|-----------|-------------------|
| Web server | **Node.js + Express** | Inherited from Task 6; great at static serving, streaming, email |
| HTTPS | **selfsigned** (auto cert) | Site works over `https://localhost` with zero setup |
| Email | **Nodemailer** (Gmail SMTP) | Inherited; reused for contact form, plan email, lead capture |
| PDF | **pdfkit + svg-to-pdfkit** | Renders the planner's SVG drawings into a real multi-page PDF |
| AI service | **Python + Flask**, served by **Waitress** | Python has the ML ecosystem; Waitress is production-grade |
| LLM runtime | **Ollama** (`llama3.1:8b`, `llava`) | Local, free, private; multilingual; supports vision |
| Embeddings | **sentence-transformers** (multilingual MiniLM) | Arabic + English semantic search |
| Vector DB | **ChromaDB** | Simple, file-based, persistent vector store |
| Keyword search | **rank-bm25** | Classic keyword ranking for hybrid retrieval |
| PDF/Doc reading | **pypdf, python-docx, PyMuPDF** | Extract text from PDFs and Word files |
| OCR | **EasyOCR** | Reads scanned/image PDFs in Arabic + English |
| Floor-plan editor | **Vanilla JS + SVG** | No dependencies; SVG is vector, crisp, easy to export |
| Deployment | **Docker + Docker Compose** | One-command, reproducible deployment |

**Design principle — minimal front-end dependencies:** the widget, planner, and
admin UI are written in plain JavaScript with no frameworks or libraries. This
keeps the site fast, secure (no supply-chain risk), and easy to understand.

---

## 6. How a request flows through the system

Concrete walkthroughs of the main journeys. These are ideal for a presentation
because they show the whole system cooperating.

### 6.1 Asking the Company bot a question (streaming)

1. The visitor types a question and hits Send. `js/chatbot.js` POSTs
   `{question, top_k, history, stream:true}` to **`/api/chat`**.
2. `server.js` **rate-limits** (max 20/min per IP) and **proxies** the request
   to the Python service, then **pipes** the streaming reply straight back.
3. `api.py` `/chat` runs `rag_core.prepare_answer`:
   - **Query rewriting** (if it's a follow-up) → a standalone search query.
   - **Hybrid retrieval:** embed the query and search ChromaDB (semantic) **and**
     run BM25 (keyword), then **fuse** with RRF → the best few chunks.
   - **Build the prompt:** system instructions + recent history + the retrieved
     chunks + the question.
   - **Confidence:** from the best similarity score.
4. The prompt goes to **Ollama** with `stream:true`. Ollama returns tokens; the
   Python generator yields them as NDJSON lines.
5. Node pipes each line to the browser; the widget appends each token live,
   renders markdown, then shows the **sources** (with similarity %) and a
   **low-confidence** note if applicable.

### 6.2 Uploading a personal document

1. In Personal Bot, the file is POSTed to **`/api/chatbot/ingest`** (multipart).
2. Node streams it (with a 15 MB size guard) to Python `/ingest`.
3. `rag_core.ingest_file` hashes it, saves it, reads text (OCR if scanned),
   chunks it, embeds the chunks, and stores them in ChromaDB **tagged
   `scope:personal`** with the browser's session id and a timestamp.
4. Future questions in Personal mode are restricted to that file's chunks.

### 6.3 Asking about an image (vision)

1. The visitor attaches an image; the widget **downscales** it (max 1024 px) to a
   compact base64 string.
2. The question + image go to **`/api/chatbot/vision`** → Python `/vision`.
3. `rag_core.stream_vision` sends the image + prompt to **llava** via Ollama and
   streams the description back — no RAG, no embeddings; the model reads pixels.

### 6.4 Exporting a floor plan to PDF

1. `js/planner.js` turns each floor into a clean **SVG** string and POSTs
   `{project, floors:[{name, svg, areaLabel}]}` to **`/api/plan/pdf`**.
2. `server.js` builds a **multi-page PDF** (one page per floor) with a title
   block, using pdfkit + svg-to-pdfkit, and returns it for download.
3. "Send to Scope" hits **`/api/plan/email`**, which builds the same PDF and
   emails it to the company as an attachment via Nodemailer.

### 6.5 An admin managing documents

1. Staff open `admin.html`, enter the **admin key** → stored for the session,
   sent as `X-Admin-User` / `X-Admin-Pass` headers.
2. `server.js` `adminGuard` checks the key before proxying to Python `/admin/*`.
3. The dashboard shows documents + analytics (`/admin/overview`), and can
   **upload** (`/admin/ingest`, tagged `scope:company`) or **delete**
   (`/admin/delete`) documents live.

---

## 7. Feature deep dives

Each subsection follows the same structure: **What** it does, **Why** it exists,
**How** it works internally, the **files** involved, and **how it was verified**.

### 7.1 Website + chatbot integration

**What.** The company website gained a floating AI chat widget on every page.

**Why.** To deliver Task 3's intelligence inside Task 6's website as one product.

**How.**
- The RAG logic from Task 3's Streamlit app was **extracted** into a reusable,
  UI-independent module, `chatbot/rag_core.py`. This was the key refactor: the
  logic (read → chunk → embed → search → prompt → answer) no longer depends on
  Streamlit and can be called by any program.
- A thin **Flask API** (`chatbot/api.py`) exposes that logic over HTTP.
- `server.js` gained a **proxy**: the browser calls `/api/chat` on the Node
  server, which forwards to the Python service and returns the reply. The browser
  never contacts Python directly (§3.15).
- `js/chatbot.js` is **self-injecting**: a single `<script>` tag on each page
  builds the entire widget (launcher button + chat panel) in code and appends it
  to the page. This meant adding the assistant to all five pages required only
  one line per page.
- The widget is **bilingual** by reading the same `localStorage` language value
  the rest of the site uses, and re-rendering when the language button is clicked.

**Files.** `chatbot/rag_core.py`, `chatbot/api.py`, `server.js`, `js/chatbot.js`,
`css/style.css`.

**Verified.** A real question returned a correct, sourced answer end-to-end in
both English and Arabic.

---

### 7.2 One-command launcher

**What.** `start.ps1` / `start.bat` — start everything with one action.

**Why.** Running two services + doing first-time setup is too much to ask of a
non-developer. One command removes that friction.

**How.** The PowerShell script, on first run, creates the Python virtual
environment, installs Python and Node dependencies, and indexes the documents;
on every run it launches the Python API and the Node server together, and stops
both when you press Ctrl+C. `start.bat` simply runs the `.ps1` with the execution
policy bypassed so it can be double-clicked.

**Files.** `start.ps1`, `start.bat`.

---

### 7.3 Personal Bot & the isolation fix

**What.** A second mode where a visitor uploads **their own** files and the bot
answers **only** from those.

**Why.** Visitors often want to ask about *their* document (a brief, a spec), not
the company's. It also showcases the RAG pipeline on arbitrary input.

**How.**
- The widget has two tabs: **Company Docs** and **Personal Bot**. Personal mode
  reveals an upload control.
- Uploaded files are ingested into the **same** ChromaDB collection but **tagged**
  with metadata `scope:"personal"`, a browser `session_id`, and an upload time.
- Personal questions are restricted to the **file hashes** the visitor uploaded
  this session.

**The bug that was found and fixed (important for the report).**
Because every document lived in one shared vector store, the first version had a
**data-leak**: a visitor's personal upload could surface in the **Company** bot's
answers *for everyone*. This was caught during testing (a made-up "secret budget"
in a personal file appeared in a company answer).
**Fix:** every chunk carries a `scope` tag. Company mode filters to
`scope:company`; Personal mode filters to the session's file hashes. Isolation
was then verified in **both** directions (company can't see personal; personal
can't see company). This is a good example of *testing revealing a real design
flaw that was then corrected*.

**Files.** `js/chatbot.js`, `server.js` (upload proxy), `chatbot/rag_core.py`
(`scope` tagging + filtering), `chatbot/api.py`.

---

### 7.4 Search-depth control

**What.** A dropdown letting the user choose how thoroughly to search:
**Quick / Balanced / Thorough / Maximum**.

**Why.** More retrieved passages = more thorough but slower answers. Power users
wanted control — but the underlying parameter is called "chunks / top-k," which
means nothing to a normal person, so it was renamed to **"Search depth"** with
friendly labels.

**How.** The labels map to the API's `top_k` value (3 / 5 / 8 / 10). The label is
what the user sees; the number is sent to the API. The value is clamped to 3–10
server-side for safety.

**Files.** `js/chatbot.js`, `chatbot/api.py` (`clamp_top_k`).

---

### 7.5 Streaming answers

**What.** Answers appear **word-by-word** as they are generated, instead of all
at once after a long pause.

**Why.** On a local CPU an answer can take 20–40 seconds. Waiting in silence
feels broken; streaming feels responsive and alive.

**How (the full chain).**
1. `rag_core.stream_ollama` calls Ollama with `stream:true` and **yields** each
   text piece as it arrives.
2. `api.py` `/chat` wraps those pieces as **NDJSON** lines
   (`{"type":"token","text":"…"}`) and finishes with
   `{"type":"done","sources":[…],"confidence":"…"}`. Flask returns this as a
   streaming response.
3. `server.js` `proxyJson` **pipes** the upstream stream straight to the browser
   (it does not buffer), so tokens flow through immediately.
4. `js/chatbot.js` reads the response with a `ReadableStream` reader, splits on
   newlines, parses each JSON line, and appends each token to the answer bubble,
   re-rendering markdown as it grows.

**Files.** `chatbot/rag_core.py`, `chatbot/api.py`, `server.js`, `js/chatbot.js`.

**Verified.** A live request produced ~75 streamed token events followed by a
`done` event carrying the sources and confidence.

---

### 7.6 Markdown, memory, and warm-up

**Markdown rendering.** The model writes bullet lists and bold text; the widget
converts this to formatted HTML. Crucially, the text is **HTML-escaped first**,
then a small, safe converter applies bold, italic, inline code and bullets.
Escaping first prevents any HTML/script injection from model output.

**Follow-up memory.** The widget keeps the recent turns and sends them as
`history`. The prompt includes a "Conversation so far" block, so a question like
"why does that matter?" is understood in context.

**Model warm-up.** The very first question is slow because Ollama must load the
model into memory. A background thread sends a tiny throwaway request on startup
so the model is already warm when the first real question arrives.

**Files.** `js/chatbot.js` (markdown, history), `chatbot/rag_core.py`
(`build_prompt` history block, `warm_up`), `chatbot/api.py` (warm-up thread).

---

### 7.7 Trust & polish

**Clickable source snippets.** Every answer lists the documents it used, each
with a **similarity percentage** (how well it matched). Clicking a source expands
the **exact text** that was retrieved, so the user can verify the answer. This
builds trust — essential for an engineering firm where accuracy matters.

**Suggested starter questions.** When a conversation is empty, clickable example
questions appear (different for Company vs Personal mode, bilingual), lowering the
friction of the first interaction.

**Clear-chat button.** Resets the conversation; in Personal mode it also tells
the server to forget the uploaded files.

**Files.** `js/chatbot.js`, `css/style.css`, `chatbot/rag_core.py`
(`sources_from_chunks` returns snippet + similarity).

---

### 7.8 Production hardening

Four changes to make the system robust rather than a demo:

1. **Personal-upload lifecycle.** Personal uploads are tagged with a session id
   and timestamp, and a background thread **auto-deletes** them after 24 hours so
   visitors' files don't accumulate forever. A `/forget` endpoint also lets the
   widget delete them immediately on "clear chat."
2. **Upload size limit + rate limiting.** `server.js` rejects uploads over 15 MB
   and limits how often the chat/upload endpoints can be called per IP
   (a simple in-memory fixed-window limiter) — basic abuse protection.
3. **Real server.** The Python service runs under **Waitress** (a production WSGI
   server) instead of Flask's development server.
4. **Logging.** All activity is logged; questions go to `questions.log` and
   thumbs-up/down to `feedback.log` — these later power the admin analytics.

**Files.** `chatbot/rag_core.py` (`cleanup_expired_personal`, `forget_files`),
`chatbot/api.py` (threads, logging, waitress), `server.js` (limits).

---

### 7.9 Plan Your Project (floor-plan editor)

**What.** A whole new page where a visitor **draws a home layout**, sees live
measurements and areas, adds multiple floors, and **exports a PDF** or **emails**
it to the company.

**Why.** For an architecture/engineering firm this is a perfect lead magnet: a
prospective client can sketch what they want, see it measured, and send it in —
turning a casual visitor into a qualified enquiry with a concrete brief.

**How.**
- The editor is drawn with **SVG** (Scalable Vector Graphics), chosen because it
  is vector (crisp at any zoom), easy to label with text and measurements, and
  trivial to export.
- A fixed **scale** (40 pixels = 1 metre) and a **grid** (0.5 m) let every
  drawn length be reported in real metres. Corners **snap** to the grid and to
  existing corners/walls so the drawing stays tidy and rooms share walls cleanly.
- Tools: **Wall** (draw), **Select** (name/type a room, or select+delete a wall),
  **Door**, **Window**. Doors are drawn as a swing arc; windows as a glazing line.
- **Measurements checkbox** toggles: each wall's length, each room's area (via the
  *shoelace formula* on its polygon), and a running **total area** and per-floor
  **bounding dimensions**.
- **Multiple floors**: tabs to add/rename/delete/switch; the PDF gets one page
  per floor.
- **Export.** Each floor is serialised to a clean, self-contained SVG string and
  POSTed to `server.js`. Node renders a **multi-page PDF** with a title block
  (project name, client, floor area, date) using **pdfkit** + **svg-to-pdfkit**.
  "Send to Scope" builds the same PDF and emails it via the existing Nodemailer
  pipeline.

**CAD-style editing tools (added later).** Beyond basic drawing, the editor gained:
- **Straight-line (ortho) snapping** — while drawing, the wall angle snaps to
  0/45/90°, so lines are perfectly straight and dividing walls have clean angles.
- **Move walls & corners** — with the Select tool you can **drag** a wall to
  reposition it, or drag a **corner** (shared endpoints move together, so
  connected walls stay attached).
- **Smart select of open wall pieces** — the Select tool is context-aware: if you
  click a wall that borders a room it selects the whole wall (to move it), but if
  you click a *leftover open piece* (a stub or an overshoot that doesn't enclose
  anything) it selects **only that piece**, so pressing Delete trims exactly that
  bit without disturbing the rest of the wall. (Internally: the clicked wall is
  split at its intersections into pieces, and the piece's midpoint is tested
  against the detected room boundaries to decide "open" vs "enclosing.")
- **Furniture names are bilingual** — the item picker and the selected-item panel
  show English or Arabic names to match the site language.
- **Draggable measurement labels** — wall-length and room name/area labels can be
  dragged out of the way when a wall or item covers them. Each label's offset is
  stored per floor (keyed by geometry) and is honoured in the exported PDF too.
- **Copy / paste & duplicate floor** — copy a selected room (its walls + the
  items inside it) or a single item and paste it offset; or duplicate an entire
  floor as a new tab.
- **Doors with flippable swing** — click a door (or use its panel) to flip which
  way it opens; windows are drawn as glazing lines.
- **Fixtures** — placeable, movable, rotatable items: **stairs, lift, gate** and
  **furniture** (bed, sofa, table, chair, sink, toilet, car, plant, kitchen
  counter, wardrobe), each drawn as a recognisable SVG symbol. This lets a
  visitor lay out a realistic home, not just bare rooms.

**Files.** `planner.html`, `js/planner.js`, `css/style.css` (planner styles),
`server.js` (`/api/plan/pdf`, `/api/plan/email`, `renderPlanPdf`).

**Verified.** The PDF endpoint produced valid multi-page PDFs from drawings
containing every element type (rooms, walls, doors with swing arcs, windows,
rotated furniture/fixtures, measurement text).

---

### 7.10 The walls-to-rooms algorithm (the clever bit)

**What.** You draw **only walls**. When walls enclose an area, it **automatically
becomes a room**; drawing a wall across a room **splits** it into two rooms. The
first version had separate "Room" and "Rectangle" tools — these were removed in
favour of this smarter, more natural model (per the project requirement).

**Why it's non-trivial.** "Which regions have the walls enclosed?" is a real
computational-geometry problem. The program must understand that a set of line
segments forms closed loops, and identify each enclosed region — including new
regions created when a dividing wall is added.

**How it works (step by step).** This is a **planar graph face-finding**
algorithm (see §3.14):

1. **Split at intersections.** Every wall segment is compared with every other;
   wherever two cross (or one ends on another), a split point is inserted. This
   turns overlapping walls into a clean set of non-crossing edges.
2. **Build a graph.** Endpoints become **nodes** (deduplicated by rounding
   coordinates), segments become **edges**. Each node knows its neighbours.
3. **Walk the faces.** Starting from each directed edge, the algorithm repeatedly
   turns "as clockwise as possible" at each node. This traces the boundary of one
   enclosed face. Doing this for every directed edge yields every face of the
   graph.
4. **Keep the rooms, drop the outside.** Each face's **signed area** (shoelace
   formula) is computed. Interior rooms come out **positive**; the outer,
   unbounded boundary comes out **negative** and is discarded, as are tiny
   degenerate faces (e.g. from a dangling wall stub).
5. Each surviving face is a **room** — its area is computed, and it can be named
   and typed via the Select tool. Names/types are remembered by the room's
   centroid so they persist as you edit.

**Why this was unit-tested first.** Because the algorithm is subtle, it was
validated on known shapes **before** wiring it into the UI:

| Test input | Expected rooms | Result |
|-----------|----------------|--------|
| One square | 1 | ✅ 1 |
| Square + a middle dividing wall | 2 | ✅ 2 |
| Square split by a cross (+) | 4 | ✅ 4 |
| Two separate squares | 2 | ✅ 2 |
| Square + a dangling wall stub | 1 (no false room) | ✅ 1 |

Then the **full pipeline** (draw walls → detect rooms → export SVG → PDF) was
confirmed: 5 walls forming a split building produced 2 rooms of 37.5 m² each and
a valid PDF.

**Files.** `js/planner.js` (`computeRooms`).

---

### 7.11 Smarter answers (retrieval quality)

Three upgrades that make answers noticeably better, all in the shared
`prepare_answer` pipeline in `rag_core.py`:

**1. Query rewriting.** For follow-up questions, the raw words are useless for
search. The LLM first rewrites the question into a **standalone search query**
using the recent conversation. Demonstrated live: *"Why is that a problem?"* →
*"What are the implications of exceeding the 850 square metre built-up area in a
villa?"*. First questions (no history) skip this step, so there is no wasted time.

**2. Hybrid retrieval (semantic + keyword).** The system runs **both** vector
(meaning-based) search **and** BM25 (keyword) search, then merges the two rankings
with **Reciprocal Rank Fusion**. This fixes the classic RAG failure where the
answer is in the documents but pure semantic search misses an exact term
(a number like "850", a name, a project code). Demonstrated: the exact-number
query surfaced the correct passage.

**3. Low-confidence guard.** The best similarity score is turned into a
confidence level (high / medium / low). On **low**, the widget shows a warning
that the topic may not be covered — so the bot is honest about its limits rather
than confidently wrong. Demonstrated: an unrelated question ("capital of France")
returned confidence **low** and "I could not find this."

**Files.** `chatbot/rag_core.py` (`rewrite_query`, `retrieve` hybrid+RRF,
`confidence_from_chunks`, `prepare_answer`), `chatbot/api.py`, `js/chatbot.js`
(low-confidence note). Added dependency: `rank-bm25`.

---

### 7.12 Persistence + controls

**Persist across page navigation.** The website has many pages; previously,
clicking to another page **wiped the conversation**. Now the transcript, history,
mode and uploads are saved to the browser's `sessionStorage` and **replayed** on
each page load, so the conversation follows the visitor around the site.

**Stop generation.** While the bot is streaming, the Send button becomes a red
**Stop**; clicking it aborts the request (via an `AbortController`) and keeps
whatever was written so far.

**Copy answer.** A copy button on every answer copies its text to the clipboard.

**Feedback (👍/👎).** Buttons on every answer post to `/api/chatbot/feedback`,
which logs the vote to `feedback.log`. These votes feed the admin analytics and
show which answers are helping.

**Files.** `js/chatbot.js` (session persistence, stop, copy, feedback),
`chatbot/api.py` (`/feedback` + logger), `server.js` (feedback proxy).

---

### 7.13 Vision Q&A on drawings

**What.** In Personal Bot, the visitor can attach an **image** (a floor plan
photo, a sketch) and ask about it — answered by a **vision model** that actually
"sees" the picture.

**Why.** An engineering firm's documents are often **drawings**, not text. OCR
reads text off a page, but a vision model can reason about the drawing itself
("how many rooms are on this floor?"). It also showcases multimodal AI.

**How.**
- The widget **downscales** the chosen image (max 1024 px, JPEG) in the browser
  to keep the upload small and fast, and encodes it as base64.
- The question + image go to `/api/chatbot/vision` → Python `/vision` →
  `rag_core.stream_vision`, which calls **Ollama's multimodal API** with the
  **llava** model, passing the image bytes alongside the prompt.
- Routing rule: if an image is attached, the question uses the **vision** path;
  otherwise documents use the normal **RAG** path.

**Files.** `chatbot/rag_core.py` (`stream_vision`, `build_vision_prompt`),
`chatbot/api.py` (`/vision`), `server.js` (vision proxy), `js/chatbot.js`
(image handling, downscale, routing).

**Verified.** A real villa photo returned an accurate description streamed from
llava through the full proxy chain.

---

### 7.14 Lead capture / human handoff

**What.** When the bot can't help (**low confidence**) or the visitor shows
**buying intent** (words like quote, price, consultation, budget — in English or
Arabic), a **"Talk to our team"** card appears. It opens a short form (name,
email, message prefilled with the question) that emails the company.

**Why.** This turns the chatbot from a novelty into a **business tool**: it
captures qualified leads at the exact moment of interest, instead of letting a
frustrated or interested visitor leave.

**How.** The card appears at most once per conversation and only in Company mode.
The form reuses the **existing** `/api/contact` email pipeline (the same one the
contact page uses), so no new email plumbing was needed.

**Files.** `js/chatbot.js` (intent detection, handoff card + form), reuses
`server.js` `/api/contact`.

---

### 7.15 Admin dashboard + analytics

**What.** A protected page for staff to **manage the knowledge base** (add/remove
company documents) and **see analytics** (most-asked questions, 👍/👎 counts) —
with no command line.

**Why.** Non-technical staff need to keep the bot's knowledge current and see
what customers are asking. Previously, adding a document required running a Python
script; now it's a button.

**How.**
- The page is gated by a **username + password** (`ADMIN_USER` / `ADMIN_PASS`,
  which have no defaults and must be set in `.env`), entered once and sent as
  `X-Admin-User` / `X-Admin-Pass` headers. `server.js`'s `adminGuard` verifies them before proxying to
  the Python admin endpoints; if no key is configured, the admin area is disabled.
- **Documents:** `/admin/overview` lists each document with its chunk count and
  scope; `/admin/ingest` uploads a new **company** document; `/admin/delete`
  removes one.
- **Analytics:** the server reads `questions.log` and `feedback.log` to compute
  the most-asked questions and thumbs up/down totals.

**Files.** `admin.html`, `js/admin.js`, `css/style.css` (admin styles),
`server.js` (`adminGuard`, `/api/admin/*`), `chatbot/api.py` (`/admin/*`),
`chatbot/rag_core.py` (`document_stats`).

**Verified.** Wrong/missing key → 401; correct key → dashboard; uploading a doc
indexed it as company scope; deleting it removed it.

---

### 7.16 Dockerization

**What.** The entire stack (Ollama + Python chatbot + Node website) runs with one
command, on any machine with Docker.

**Why.** Reproducible, portable deployment. "Works on my machine" becomes "works
everywhere," and setup drops from many steps to one.

**How.** `docker-compose.yml` defines three services wired together by name:
- **ollama** — the LLM runtime, with a volume so downloaded models persist.
- **chatbot** — built from `Dockerfile.chatbot` (Python + the OCR/PDF system
  libraries); its entrypoint seeds the documents on first run, then serves.
- **web** — built from `Dockerfile.web` (Node); talks to `chatbot` by service
  name and publishes ports 3000/3001.

Named volumes persist the vector DB and the model cache. One command builds and
starts everything; two `ollama pull` commands fetch the models.

**Files.** `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.chatbot`,
`chatbot/docker-entrypoint.sh`, `.dockerignore`, `.gitattributes`.

**Verified.** `docker compose config` validates all three services. (A live image
build requires the Docker daemon to be running.)

---

## 8. Design decisions & trade-offs

Good report material: these show *engineering judgement*, not just coding.

| Decision | Alternative | Why we chose this |
|----------|-------------|-------------------|
| **Local LLM (Ollama)** | Cloud API (OpenAI, etc.) | Privacy (documents never leave the machine), zero per-question cost, works offline. Trade-off: slower on CPU and needs a capable machine. |
| **Node proxies to Python** (one origin) | Browser calls Python directly | Avoids CORS/mixed-content; single front door; keeps the Python service off the public internet. Trade-off: an extra hop. |
| **Two languages (Node + Python)** | Rewrite everything in one | Each keeps what it's best at (Node: web/email/streaming; Python: ML). Reuses both source projects. Trade-off: two runtimes to manage — solved by Docker. |
| **Shared vector DB with a `scope` tag** | Separate DBs per user | Simple and efficient; one store, filtered by metadata. The isolation bug taught us to filter strictly. |
| **Hybrid retrieval (RRF)** | Semantic-only, or add a heavy re-ranker model | RRF gives most of the benefit with almost no cost and no extra model download; robust for Arabic + English. |
| **Vanilla JS front-end** | React/Vue + build tooling | No dependencies, no build step, tiny and fast, no supply-chain risk; easy for a reviewer to read. Trade-off: more manual DOM code. |
| **SVG for the planner** | HTML canvas | SVG is vector (crisp, exportable), and text labels/measurements are first-class. Canvas would need manual redraw and rasterises. |
| **Server-side PDF (pdfkit)** | Client-side PDF library | Keeps the front-end dependency-free and produces a clean, consistent PDF; naturally reuses the email pipeline. |
| **Streaming via NDJSON** | Server-Sent Events / WebSockets | NDJSON over a normal HTTP response is the simplest thing that works through the existing proxy; no new protocol. |
| **sessionStorage for chat** | localStorage / server-side sessions | Survives navigation but clears when the tab closes — the right lifetime for a visitor chat, and no server state needed. |

---

## 9. Security & privacy

- **Data stays local.** Documents, embeddings, and the LLM all run on the
  company's own machine. Nothing is sent to a third-party AI service.
- **Single front door.** The Python AI service binds to `localhost` and is only
  reachable through the Node proxy, not directly from the internet.
- **Personal-upload isolation.** Visitors' uploads are scoped and never appear in
  the shared company bot; they auto-expire after 24 hours.
- **Admin protection.** The admin dashboard requires a secret key; it is disabled
  entirely if no key is configured (so there is no default-password hole).
- **Injection-safe rendering.** All model output shown as HTML is escaped first,
  so a document can't smuggle a script into the page.
- **Abuse limits.** Upload size caps and per-IP rate limits on the chat/upload
  endpoints.
- **Spam protection.** The contact form uses a hidden "honeypot" field and
  server-side validation.
- **HTTPS.** The site runs over TLS (a self-signed certificate locally; a real
  certificate in production).

---

## 10. Testing & verification methodology

The project was verified continuously, favouring **driving real data through the
running system** over only checking that code compiles.

- **Unit test for the hard algorithm.** The floor-plan room-detection was tested
  on five known shapes (§7.10) *before* being used, catching sign/edge-case bugs
  cheaply.
- **End-to-end feature checks.** Streaming, hybrid retrieval, query rewriting,
  the confidence guard, vision (on a real image), feedback logging, admin
  upload/delete, and PDF export were each exercised with live requests and their
  outputs inspected.
- **Isolation testing.** The Personal/Company separation was tested in both
  directions — which is how the original leak was found and then confirmed fixed.
- **Regression awareness.** After each change the services were restarted and a
  quick health check + a representative request confirmed nothing broke.
- **What can't be tested headlessly.** Pure in-browser interactions (mouse
  drawing in the planner, `sessionStorage` persistence across navigation, the
  lead-form UI) are validated by code review and are best confirmed with a quick
  click-through in a browser.

---

## 11. Known limitations & future work

**Current limitations**
- **Email features** (contact form, plan email, lead capture) require Gmail
  credentials in `.env`; without them the endpoints respond with a clear
  "not configured" message.
- **Admin dashboard** uses `ADMIN_USER` / `ADMIN_PASS`. There are no defaults: the server exits at start-up if either is missing.
- **Performance** depends on the machine: on CPU, answers take tens of seconds; a
  GPU makes it much faster.
- **OCR / vision quality** depends on image clarity; very low-resolution scans
  read less reliably.
- **BM25 index** is rebuilt per query; fine for a company-sized document set, but
  a very large corpus would want a persistent keyword index.

**Natural next steps**
- Voice input/output (speak a question, hear the answer).
- A re-ranking model for even better retrieval on large corpora.
- Links from a source snippet to open the exact PDF page.
- Export the chat transcript to PDF.
- Multi-user admin accounts and an audit log.
- A GPU deployment profile in Docker for fast responses.

---

## 12. Presentation guide

A suggested way to present and demo the project.

### 12.1 Suggested slide outline (10–12 slides)
1. **Title** — Scope AI Website (Task 9).
2. **The problem** — a website that can't answer questions + a chatbot nobody
   visits (the two source projects).
3. **The idea** — merge them: an intelligent company website that runs locally.
4. **Architecture** — the three-process diagram (§4); stress the "one front door."
5. **What is RAG?** — the open-book-exam analogy (§3.3).
6. **Live demo 1** — ask the Company bot a question; show streaming + sources.
7. **Personal Bot + Vision** — upload a file / a drawing and ask about it.
8. **Plan Your Project** — draw a room, split it, show measurements, export PDF.
9. **Smart retrieval** — query rewriting + hybrid search + confidence (why answers
   are good and honest).
10. **Admin + analytics** — manage docs, see top questions.
11. **Engineering** — the room-detection algorithm + the isolation-bug story
    (shows real problem-solving).
12. **Privacy & deployment** — local AI, one-command Docker; future work.

### 12.2 Live demo script (5 minutes)
1. Open the site, click **"Ask our AI"**, ask *"What are the design requirements
   for the villa?"* — point out words appearing live and the **sources** with %.
2. Ask a follow-up *"Why does that matter?"* — mention **query rewriting** makes
   this work.
3. Switch to **Personal Bot**, drag in a PDF, ask about it — mention isolation.
4. Attach an **image** and ask "what do you see?" — that's the **vision** model.
5. Go to **Plan Project**: draw a box (a room appears), draw a wall across it
   (it splits into two), tick **measurements**, **Download PDF**.
6. Open **/admin.html**, sign in, show the documents list and **top questions**.

### 12.3 Answers to likely questions from instructors
- *"Does it use ChatGPT?"* No — a **local** model via Ollama; nothing leaves the
  machine, and there's no per-question cost.
- *"How does it avoid making things up?"* RAG: it only answers from retrieved
  document passages, cites them, and flags low confidence.
- *"How does the floor plan know where the rooms are?"* A planar-graph
  face-finding algorithm detects enclosed regions from the walls (§7.10).
- *"Is it secure?"* The AI service isn't exposed to the internet, uploads are
  isolated and expire, admin is key-protected, and model output is escaped.
- *"Could a real company use it?"* Yes — it's containerised for one-command
  deployment; it needs a decent machine (ideally a GPU) and email credentials.

---

## 13. File-by-file map

| File | What it does |
|------|--------------|
| `index.html`, `about.html`, `services.html`, `projects.html`, `contact.html` | The website pages (each loads the chat widget) |
| `planner.html` | The "Plan Your Project" floor-plan editor page |
| `admin.html` | The protected admin dashboard page |
| `css/style.css` | All styles — site + chat widget + planner + admin (added in labelled sections) |
| `js/script.js` | Original site JS (navigation, language toggle, contact form) |
| `js/chatbot.js` | The AI chat widget (modes, streaming, markdown, sources, depth, persistence, stop/copy/feedback, vision, lead capture) |
| `js/planner.js` | The floor-plan editor (walls→rooms detection, measurements, floors, export) |
| `js/admin.js` | The admin dashboard front-end |
| `server.js` | Node server: serves the site, sends email, **proxies all `/api/*`** to Python, rate-limits, guards admin, builds plan PDFs |
| `chatbot/rag_core.py` | The RAG core: ingest + OCR, chunking, embeddings, **hybrid retrieval**, **query rewrite**, **confidence**, streaming, **vision**, cleanup |
| `chatbot/api.py` | The Python API: chat, vision, ingest, forget, feedback, admin, logging, warm-up, served by Waitress |
| `chatbot/ingest_docs.py` | Indexes everything in `company_docs/` into the vector DB |
| `chatbot/requirements.txt` | Python dependencies |
| `chatbot/company_docs/` | The seed company documents |
| `chatbot/chroma_db/` | The on-disk vector database (created on first run) |
| `chatbot/logs/` | `chatbot.log`, `questions.log`, `feedback.log` (power the analytics) |
| `start.ps1`, `start.bat` | One-command local launcher |
| `Dockerfile.web`, `Dockerfile.chatbot` | Container images for the web and chatbot services |
| `docker-compose.yml` | Defines and wires the three services |
| `chatbot/docker-entrypoint.sh` | Seeds documents then starts the API (in Docker) |
| `.dockerignore`, `.gitattributes` | Build hygiene (exclude heavy files; keep LF line endings) |
| `.env.example` | Template for configuration (email, admin key, ports) |
| `README.md` | Setup / how to run |
| `WHAT_WAS_BUILT.md` | **This document** — full explanation for understanding, presenting, and reporting |

---

*End of document. For setup and run instructions, see [`README.md`](README.md).*
