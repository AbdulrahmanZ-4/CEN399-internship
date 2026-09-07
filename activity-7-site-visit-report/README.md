# Activity 7 — Site-Visit Report Generator

Turns a filled-in form into a formatted Microsoft Word site-visit report, so an
engineer does not retype the same layout after every visit.

## How it works

A Tkinter form collects the project details, observations per section, and site
photographs. `python-docx` then assembles a document with an information table,
bulleted observations under each heading, captioned photographs, and the preparation
details.

The output is an ordinary `.docx` file, so it can still be edited afterwards.

## Running it

```bash
pip install python-docx pillow
python site_visit_report.py
```

Generated reports and site photographs are not committed.
