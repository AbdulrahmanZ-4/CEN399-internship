import pandas as pd
from extractor import extract_pdf_information, FIELD_ORDER


PDF_PATH = r"input_pdfs\good_sample_drawing.pdf"

TESSERACT_PATH = r"C:\Users\HP\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

results = extract_pdf_information(
    pdf_path=PDF_PATH,
    tesseract_path=TESSERACT_PATH,
    max_pages=3,
    use_ocr=True,
    dpi=220,
    lang="eng"
)

rows = []

for page_result in results:
    row = {
        "page_number": page_result["page_number"],
        "confidence_percent": page_result["confidence_percent"],
    }

    for field in FIELD_ORDER:
        row[field] = page_result["fields"].get(field, "")

    rows.append(row)

df = pd.DataFrame(rows)

print(df)

df.to_csv("outputs/extracted_drawing_information.csv", index=False, encoding="utf-8-sig")

print("\nSaved results to outputs/extracted_drawing_information.csv")