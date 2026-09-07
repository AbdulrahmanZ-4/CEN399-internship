# Activity 1 — OCR Title-Block Reader

Reads the identifying fields out of an architectural drawing's title block.

## How it works

The title block sits in the right-hand strip of the sheet, so the tool crops the
rightmost ~32% rather than reading the whole drawing, which would return mostly
dimension text. That crop is then:

1. upscaled 2.5x, because Tesseract expects text at roughly scanned-page size;
2. converted to greyscale and binarised with Otsu's method;
3. opened morphologically with a 40x1 element, which removes the ruled table
   lines that otherwise merge into the characters;
4. passed to Tesseract.

## Result

All twelve identifying fields were located and ten were returned correctly.
The two remaining fields carried single-character errors — a digit in a date, and
an `S` read as `$`. Both were located, so a light visual check before entry into a
drawing register remains sensible.

## Running it

```bash
pip install opencv-python pytesseract pillow
python ocr_title_block.py
```

Tesseract itself must be installed separately and on the PATH.

Sample drawings are not included: their title blocks carry client and consultant
names.
