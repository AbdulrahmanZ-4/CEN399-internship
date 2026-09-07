# Activities 3 and 4 — PDF Drawing Extractor and Browser Application

Extracts ten identifying fields from every page of a drawing PDF and writes them
to a spreadsheet.

## How it works

The extractor takes two paths. If the PDF carries an embedded text layer it is read
directly, which is both faster and more accurate. If it does not, the page is
rendered and OCR runs over four overlapping regions of the sheet, so a field sitting
on a region boundary is not lost.

Extracted values are matched with regular expressions anchored to the field labels,
then written to CSV or JSON.

`app.py` is the same engine behind a Streamlit interface, so staff who do not write
code can run it. `extractor.py` holds the engine, which is what made the interface
a thin layer rather than a rewrite.

## Result

Both test pages returned all ten fields, so coverage was complete. Nineteen of the
twenty field instances were correct. The one failure is a loose regular expression
that matched body text instead of the drawing title — the pattern needs anchoring to
the title-block region.

## Running it

```bash
pip install -r requirements.txt
streamlit run app.py           # browser interface
python -m pytest test_extractor.py
```
