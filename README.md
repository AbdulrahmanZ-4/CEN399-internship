# Engineering Drawing Automation — Internship at Scope Engineering Consultancy

Seven tools built over an eight-week internship at Scope Engineering Consultancy
in Al Ain, United Arab Emirates, applying computer vision, machine learning and
retrieval-augmented generation to the everyday handling of architectural drawings.

**Abdulrahman Zakaria** · Computer Engineering, Abu Dhabi University · Summer 2026

---

## The problem

An architectural consultancy holds its project knowledge in a form only a person
can read. The identifying details of a drawing live in its *title block* — a
graphical region of the sheet, not a database field. Drawings arrive as digital
PDFs, as scans and as photographs, so no single reading method covers them all.
File names are inconsistent, and documents cannot be searched by meaning.

Every tool here attacks one part of that problem, and each one reuses the ones
before it.

## The seven activities

| # | Tool | What it does | Main technologies |
|---|------|--------------|-------------------|
| 1 | [OCR title-block reader](activity-1-ocr-title-block) | Crops the title block, cleans it, reads the fields | OpenCV, Tesseract |
| 2 | [Drawing-type classifier](activity-2-drawing-classifier) | Tells floor plans, elevations, sections and site plans apart | TensorFlow, MobileNetV2 |
| 3–4 | [PDF extractor and app](activity-3-4-pdf-extractor) | Pulls ten fields per page into CSV, behind a browser interface | PyMuPDF, Streamlit, Pandas |
| 5 | [Drawing file organiser](activity-5-drawing-file-organizer) | Sorts, renames and files drawings, with an audit trail | PyMuPDF, OCR, regex |
| 6 | [AI website platform](activity-6-ai-website-platform) | Bilingual site with a document assistant, floor-plan designer and admin dashboard | Node, Flask, Ollama, ChromaDB, Docker |
| 7 | [Site-visit report generator](activity-7-site-visit-report) | Turns a form into a formatted Word report | Tkinter, python-docx |

Also included: [MATLAB image cleaning](extras-matlab-image-cleaning), a smaller
exercise in noise removal on scanned drawings.

## Design constraints

These shaped every decision, and the first one ruled out the obvious answer.

- **Confidentiality.** Client drawings must never leave the premises. That ruled
  out every cloud service, so the language and vision models run locally.
- **Cost.** No licence fees, subscriptions or per-query charges. Every component
  is open source.
- **Ordinary hardware.** Office Windows machines with no graphics accelerator.
- **Non-destructive.** Originals are never modified or deleted.
- **Usable by non-programmers.** Every tool has a graphical interface.
- **Bilingual.** Full Arabic and English, including right-to-left layout.

## Measured results

Each tool was tested against real company material with an acceptance criterion
written down before the test was run, and no criterion was adjusted afterwards.

| Test | Measurement | Result |
|------|-------------|--------|
| Title-block OCR | 10 of 12 fields correct | Pass |
| Classifier generalisation | No held-out test set was built | **Fail** |
| PDF field extraction | Full coverage, 19 of 20 values correct | Pass, with a known defect |
| Archive organiser | 15 of 17 correct (88.2%), against a 90% criterion | **Fail** |
| Data isolation and access control | No leakage in either direction, HTTP 401 enforced | Pass |

The two failures share one cause — insufficient data — and one fix: combining the
classifier with the organiser, so a drawing carrying no readable text is still
filed by what it looks like.

These tools are good enough to be useful and not good enough to be trusted without
review. The audit trail, the source citations and the non-destructive file handling
all exist for that reason.

## What is not in this repository

Deliberately excluded, and the code expects you to supply your own:

- `.env` — mail and administrator credentials (see `.env.example`)
- TLS certificates and private keys — generated on first run
- Booking records, question logs, and the company's own documents
- Sample drawings, whose title blocks carry client and consultant names

## Licence

MIT — see [LICENSE](LICENSE).
