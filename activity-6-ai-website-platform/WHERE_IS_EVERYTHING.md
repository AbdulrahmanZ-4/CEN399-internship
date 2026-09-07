# Where Is Everything — Feature & File Locator

A practical index of **everything in this project**: for each feature it tells you
**how to reach it** (as a user), **which file(s)** implement it, and **what it's
for**. Companion to:
- [`README.md`](README.md) — how to install & run.
- [`WHAT_WAS_BUILT.md`](WHAT_WAS_BUILT.md) — deep explanation of how each part works.

> Base URL when running: **https://localhost:3000**

---

## 1. Pages (what the visitor sees)

| Page | URL | What it's for | File |
|------|-----|---------------|------|
| Home | `/` or `/index.html` | Landing page, services overview, **testimonials**, CTAs | `index.html` |
| About | `/about.html` | Company info | `about.html` |
| Services | `/services.html` | Service list | `services.html` |
| Projects | `/projects.html` | Project gallery (click an image → **lightbox**) | `projects.html` |
| **Plan Project** | `/planner.html` | Interactive floor-plan editor | `planner.html` |
| **Get a Quote** | `/quote.html` | Cost/timeline estimator + **book a consultation** | `quote.html` |
| Contact | `/contact.html` | Contact form (emails the company) | `contact.html` |
| **Admin** (hidden) | `/admin.html` | Staff dashboard — bookings + manage docs + analytics (needs `ADMIN_USER` / `ADMIN_PASS`) | `admin.html` |

The **AI chat widget** (floating 💬 button) appears on every page — it is injected
by `js/chatbot.js`.

---

## 2. The AI Chatbot (💬 widget)

**How to reach it:** click **"Ask our AI"** at the bottom-right of any page.
**All widget code:** [`js/chatbot.js`](js/chatbot.js) · **styles:** appended in `css/style.css` · **AI logic:** `chatbot/rag_core.py` + `chatbot/api.py`.

| Feature | Where in the UI | What it's for |
|---------|-----------------|---------------|
| Company Docs mode | "Company Docs" tab | Answers from the company's indexed documents |
| Personal Bot mode | "Personal Bot" tab | Upload your own files and ask only about them |
| Image Q&A (vision) | Personal Bot → attach an image | Answers about a drawing/photo using the `llava` model |
| "Ask about this page" | 📄 button in the input row | Answers using the **current page's text** |
| Read aloud (offline) | 🔊 on each answer | Speaks the answer using your device's local voices |
| Streaming answers | (automatic) | Words appear as they're generated |
| Markdown + tables | (automatic) | Bullets, bold, and tables render properly |
| Source snippets | Under an answer, click a source | Shows the exact text + similarity % it used |
| Confidence note | ⚠ under weak answers | Warns when the topic isn't well covered |
| Suggested follow-ups | Chips under an answer | One-click next questions |
| Regenerate | ↻ on an answer | Re-ask the same question |
| Copy answer | ⧉ on an answer | Copy to clipboard |
| 👍/👎 feedback | On each answer | Logged for admins to review |
| Download chat | ⭳ in the header | Saves the transcript as a `.txt` |
| Search depth | Dropdown at the bottom | Quick/Balanced/Thorough/Maximum (how many passages) |
| Persist across pages | (automatic) | Conversation survives navigating between pages |
| Lead capture | "Talk to our team" card | Appears on low confidence / buying intent → emails the company |
| Bilingual | Site's عربي/English toggle | Whole widget follows the site language |

---

## 3. Plan Your Project (floor-plan editor)

**How to reach it:** nav → **Plan Project** (`/planner.html`).
**Editor code:** [`js/planner.js`](js/planner.js) · **page:** `planner.html` · **styles:** `css/style.css` · **PDF export:** `server.js` (`/api/plan/pdf`, `/api/plan/email`).

| Feature | Where in the UI | What it's for |
|---------|-----------------|---------------|
| Draw walls → rooms | **Wall** tool | Closed walls auto-become rooms; interior walls split them |
| Straight-line snapping | "Straight lines" checkbox | Keeps wall angles perfect (0/45/90°) |
| Select / move | **Select** tool | Drag walls/corners; click a room to name/type it |
| Delete open wall bits | Select an open piece → Delete | Trims leftover/dangling wall pieces only |
| Doors / Windows | **Door** / **Window** tools | Place on a wall; click a door to flip its swing |
| Add items (fixtures) | **Add item** tool + dropdown | Stairs, lift, gate + furniture (bed, sofa, table…) |
| Snap furniture to walls | (automatic when near) | Aligns items against a nearby wall |
| Measurements | "Measurements" checkbox | Wall lengths, room areas, totals (labels are **draggable**) |
| Set real scale | **Set scale** button | Click two points + type real distance → accurate metres |
| Metric ⇄ imperial | "Feet" checkbox | Switch m/m² ↔ ft/ft² |
| North arrow | "North" checkbox | Adds a north arrow (also in exports) |
| Room schedule | Right panel + PDF left column | Live table of rooms + areas |
| Multiple floors | Floor tabs (+ / rename / delete / ⧉ duplicate) | One PDF page per floor |
| Templates | "Start from…" dropdown | Studio / apartment / villa / office starters |
| 3D preview | **3D view** button | Simple isometric 3D of the walls |
| Undo / Redo | buttons (Ctrl+Z / Ctrl+Y) | Step back/forward |
| Copy / Paste | buttons (Ctrl+C / Ctrl+V) | Duplicate a room or item |
| Autosave / New plan | "Saved ✓" + "New plan" | Plan survives refresh (browser storage) |
| Export PDF / PNG | buttons in right panel | Download the plan |
| Email to Scope | "Send to Scope" | Emails the PDF to the company |
| Touch support | (automatic) | Draw on tablets/phones |

---

## 4. Website & business tools

| Feature | Where | File(s) | What it's for |
|---------|-------|---------|---------------|
| Quote calculator | `/quote.html` | `quote.html`, `js/quote.js` | Instant cost + timeline estimate |
| Book a consultation | `/quote.html` (form) | `js/quote.js` → `server.js` `/api/availability`, `/api/book` | Pick a date → choose a free 30-min slot within the opening hours. Taken slots show as *booked* and are disabled; the server re-validates so a slot can't be double-booked. Saved to `data/bookings.json` + emailed |
| Opening hours | Sat–Thu 09:00–14:00, 17:00–21:30 · Friday closed | `BUSINESS_HOURS` in `server.js` | Single source of truth for which slots exist |
| Contact form | `/contact.html` | `js/script.js` → `server.js` `/api/contact` | Emails the company |
| Testimonials | Home page section | `index.html` | Social proof |
| Gallery lightbox | Projects page (click image) | `js/script.js` | Full-screen image viewer |
| PWA (installable + offline) | (automatic) | `manifest.webmanifest`, `sw.js`, `js/script.js` | Works offline; installable app |
| SEO | (for crawlers) | `sitemap.xml`, `robots.txt`, page `<meta>` | Search-engine basics |

---

## 5. Admin dashboard

**How to reach it:** go to `/admin.html` and sign in with the `ADMIN_USER` and `ADMIN_PASS` you set in `.env`. There are no built-in defaults, and the server will not start until both are set.
**Front-end:** [`js/admin.js`](js/admin.js) · **page:** `admin.html` · **API:** guarded in `server.js` → `chatbot/api.py` (`/admin/*`).

| Feature | What it's for |
|---------|---------------|
| Consultation bookings | Every booked appointment with the client's name, email, phone, service, estimate and message. **Cancel** frees the slot for someone else |
| Company documents | Add / delete the docs the Company bot answers from (no CLI) |
| Analytics tiles | Total questions, 👍/👎 counts, model |
| Most-asked questions | What visitors ask most |
| "Add documents for these" | Low-confidence questions → topics to add docs for |
| 👎 Feedback to review | The answers people marked unhelpful |
| Export CSV | Download all analytics as a spreadsheet |

---

## 6. The AI engine (RAG) — how answers are produced

**Files:** [`chatbot/rag_core.py`](chatbot/rag_core.py) (the logic) and [`chatbot/api.py`](chatbot/api.py) (the web API, served by Waitress).

| Piece | In `rag_core.py` | What it does |
|-------|------------------|--------------|
| Read documents (+OCR) | `read_pdf/read_docx/read_txt`, `ingest_file` | Extract text; OCR scanned PDFs (Arabic+English) |
| Chunking | `chunk_text` | Split docs into overlapping passages |
| Embeddings + vector DB | `get_embedding_model`, `get_collection` | Store/search passages by meaning (ChromaDB) |
| Query rewriting | `rewrite_query` | Turns follow-ups into standalone search queries |
| Hybrid retrieval | `retrieve`, `_vector_rank`, `_keyword_rank` | Vector + BM25 keyword search, fused (RRF) |
| Re-ranking | `_rerank` | Re-orders results by semantic similarity |
| Confidence | `confidence_from_chunks` | Estimates how sure the answer is |
| Prompt + guardrails | `build_prompt`, `build_page_prompt` | Builds the LLM prompt; treats docs as untrusted |
| Answer (stream) | `stream_ollama`, `ask_ollama` | Calls the local LLM (Ollama) |
| Vision | `stream_vision`, `build_vision_prompt` | Image Q&A via `llava` |
| Follow-ups | `suggest_followups` | Generates next-question suggestions |
| Scope isolation | `build_where`, `scope` tag | Keeps personal uploads out of company answers |
| Cleanup | `cleanup_expired_personal`, `forget_files` | Auto-deletes old personal uploads |

Seed the knowledge base from `chatbot/company_docs/` with `chatbot/ingest_docs.py`.

---

## 7. API endpoints (browser → Node → Python)

The browser only calls the **Node** routes; Node proxies AI ones to **Python**.

| Node route (`server.js`) | Python (`chatbot/api.py`) | Purpose |
|--------------------------|---------------------------|---------|
| `POST /api/chat` | `/chat` | Company/Personal question (streaming) |
| `POST /api/chatbot/page` | `/page` | Ask about the current page |
| `POST /api/chatbot/followups` | `/followups` | Suggested follow-up questions |
| `POST /api/chatbot/vision` | `/vision` | Image Q&A |
| `POST /api/chatbot/ingest` | `/ingest` | Upload a personal document |
| `POST /api/chatbot/forget` | `/forget` | Delete personal uploads |
| `POST /api/chatbot/feedback` | `/feedback` | 👍/👎 on an answer |
| `GET /api/chatbot/documents` | `/documents` | List indexed documents |
| `GET /api/chatbot/health` | `/health` | Service status |
| `GET /api/admin/overview` | `/admin/overview` | Docs + analytics (admin) |
| `POST /api/admin/ingest` | `/admin/ingest` | Add a company document (admin) |
| `POST /api/admin/delete` | `/admin/delete` | Remove a document (admin) |
| `POST /api/contact` | *(Node only)* | Contact-form email |
| `GET /api/availability?date=` | *(Node only)* | The 30-min slots that date offers + which are still free |
| `POST /api/book` | *(Node only)* | Reserve a slot (re-validated), store it, email the company |
| `GET /api/admin/bookings` | *(Node only)* | All bookings with client details (admin) |
| `POST /api/admin/bookings/cancel` | *(Node only)* | Cancel a booking and free its slot (admin) |
| `POST /api/plan/pdf` | *(Node only)* | Build the floor-plan PDF |
| `POST /api/plan/email` | *(Node only)* | Email the floor-plan PDF |
| `GET /api/health` | *(Node only)* | Node/email status |

---

## 8. Every file, explained

**Root**
| File | What it is |
|------|-----------|
| `server.js` | Node web server: serves the site, sends email, **proxies all `/api/*`**, builds plan PDFs, rate-limits, guards admin |
| `package.json` / `package-lock.json` | Node dependencies (express, nodemailer, pdfkit, svg-to-pdfkit, selfsigned, dotenv) |
| `index/about/services/projects/contact.html` | The core website pages |
| `planner.html` | Floor-plan editor page |
| `quote.html` | Quote calculator + booking page |
| `admin.html` | Protected admin dashboard page |
| `sw.js` | Service worker — offline caching (network-first) |
| `manifest.webmanifest` | PWA manifest (installable app) |
| `sitemap.xml` / `robots.txt` | SEO basics |
| `start.ps1` / `start.bat` | One-command local launcher (sets up + runs everything) |
| `Dockerfile.web` / `Dockerfile.chatbot` / `docker-compose.yml` | Containerised deployment |
| `.env.example` | Template for configuration (copy to `.env`) |
| `README.md` / `WHAT_WAS_BUILT.md` / `WHERE_IS_EVERYTHING.md` | Docs (run / explanation / this locator) |

**`js/`**
| File | What it is |
|------|-----------|
| `script.js` | Site nav, language toggle, contact form, **PWA registration**, **gallery lightbox** |
| `chatbot.js` | The whole AI chat widget |
| `planner.js` | The whole floor-plan editor |
| `quote.js` | The quote calculator + booking form |
| `admin.js` | The admin dashboard |

**`css/`** — `style.css` holds all styles (site + widget + planner + admin + quote, added in labelled sections).

**`chatbot/`** (Python AI service)
| File | What it is |
|------|-----------|
| `api.py` | Flask/Waitress web API (chat, vision, ingest, admin, logging) |
| `rag_core.py` | The RAG engine (see §6) |
| `ingest_docs.py` | Indexes `company_docs/` into the vector DB |
| `requirements.txt` | Python dependencies |
| `company_docs/` | The source company documents |
| `chroma_db/` | The on-disk vector database (created on first run) |
| `logs/` | `chatbot.log`, `questions.log`, `feedback.log`, `unanswered.log` (power the admin analytics) |
| `docker-entrypoint.sh` | In Docker: seeds docs, then starts the API |
| `venv/` | Python virtual environment (created by the launcher) |

**Other dirs** — `images/` (logos/photos), `certs/` (auto-generated HTTPS cert), `data/` (`bookings.json` — the consultation appointments), `node_modules/` (installed Node packages).

---

## 9. Configuration (`.env`)

Copy `.env.example` → `.env` and fill what you need (everything works without it, but email/admin stay off):

| Variable | Enables |
|----------|---------|
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CONTACT_TO` | Contact form, booking/quote, plan email, lead capture |
| `ADMIN_USER` / `ADMIN_PASS` | Admin login. Required — no defaults |
| `OLLAMA_MODEL`, `CHATBOT_VISION_MODEL`, `OLLAMA_URL` | Which local models the chatbot uses |
| `HTTPS_PORT`, `HTTP_PORT`, `CHATBOT_HOST`, `CHATBOT_PORT` | Ports / service wiring |

---

## 10. "How do I…?" quick index

- **Run it** → `README.md` (Docker or `start.ps1`).
- **Add a company document** → Admin dashboard (`/admin.html`) → "Add a document", or drop a file in `chatbot/company_docs/` and run `chatbot/ingest_docs.py`.
- **See what customers ask / didn't get answered** → Admin → "Most-asked" + "Add documents for these".
- **Change the AI models** → `.env` (`OLLAMA_MODEL`, `CHATBOT_VISION_MODEL`).
- **Turn on emails** → put Gmail creds in `.env` (see §9).
- **Draw & export a plan** → `/planner.html` → draw → Download PDF/PNG.
- **Get a price estimate** → `/quote.html`.
- **Change site text/styles** → the `.html` pages / `css/style.css`.
