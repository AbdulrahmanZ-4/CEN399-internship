# Activity 5 — Automated Drawing File Organiser

Sorts a mixed folder of drawings into discipline and type folders, renames each file
to a consistent pattern, and writes an audit row for every file it touches.

## How it works

Each drawing is read using the dual-path approach of Activity 3 — embedded PDF text
where it exists, OCR where it does not. The extracted text is then scored against a
keyword set for each drawing type, and the highest-scoring type wins.

Files are **copied, never moved or modified.** A misclassification is therefore
always recoverable, and the audit log records every decision, including the poor
ones, so a human can review them.

## Result

Fifteen of seventeen mixed drawings were filed correctly — 88.2%, against an
acceptance criterion of 90%. **This test fails.**

Both failures are informative. One file contained no readable text at all, so there
was nothing to score. The other matched the keyword "elevation" more strongly than
its true type. Adding more keywords would fix neither: one had no text to match, and
the other matched the wrong word confidently.

The correct fix is to combine this tool with the Activity 2 classifier, so that a
drawing with no usable text is classified by what it looks like instead.

## Running it

```bash
pip install pymupdf pytesseract pillow
python drawing_organizer.py
```
