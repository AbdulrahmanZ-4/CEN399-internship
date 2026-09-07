import os
import re
import csv
import shutil
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
import pytesseract


# ==========================================
# TESSERACT PATH
# ==========================================
# Change this path if your Tesseract is installed somewhere else.
# If Tesseract already works without this line, you can comment it.
pytesseract.pytesseract.tesseract_cmd = r"C:\Users\HP\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"


# ==========================================
# FOLDERS
# ==========================================
BASE_DIR = Path(__file__).parent
INPUT_FOLDER = BASE_DIR / "input_drawings"
OUTPUT_FOLDER = BASE_DIR / "organized_drawings"
REPORT_FILE = BASE_DIR / "organization_report.csv"


SUPPORTED_FILES = [".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"]


# ==========================================
# KEYWORDS FOR CLASSIFICATION
# ==========================================
DISCIPLINE_KEYWORDS = {
    "Architecture": [
        "architecture", "architectural", "floor plan", "elevation",
        "section", "site plan", "layout", "door schedule", "window schedule"
    ],
    "Structural": [
        "structural", "foundation", "beam", "column", "slab",
        "rebar", "reinforcement", "concrete", "footing"
    ],
    "Electrical": [
        "electrical", "lighting", "power layout", "socket",
        "db schedule", "panel", "cable", "switch"
    ],
    "Mechanical": [
        "mechanical", "hvac", "duct", "air conditioning",
        "ac layout", "ventilation", "diffuser"
    ],
    "Plumbing": [
        "plumbing", "drainage", "water supply", "sanitary",
        "toilet", "sewer", "pipe", "manhole"
    ],
}


DRAWING_TYPE_KEYWORDS = {
    "Floor Plan": [
        ("floor plan", 5),
        ("ground floor", 5),
        ("first floor", 5),
        ("second floor", 5),
        ("typical floor", 5),
        ("layout plan", 4),
        ("plan", 1),
    ],
    "Elevation": [
        ("elevation", 5),
        ("front elevation", 5),
        ("rear elevation", 5),
        ("side elevation", 5),
        ("north elevation", 5),
        ("south elevation", 5),
        ("east elevation", 5),
        ("west elevation", 5),
    ],
    "Section": [
        ("section", 5),
        ("cross section", 5),
        ("section a-a", 5),
        ("section b-b", 5),
        ("longitudinal section", 5),
    ],
    "Site Plan": [
        ("site plan", 5),
        ("location plan", 5),
        ("plot plan", 5),
        ("master plan", 4),
        ("key plan", 4),
    ],
    "Detail": [
        ("detail", 5),
        ("typical detail", 5),
        ("construction detail", 5),
    ],
    "Schedule": [
        ("schedule", 5),
        ("door schedule", 5),
        ("window schedule", 5),
        ("finishing schedule", 5),
        ("room schedule", 5),
    ],
    "General Notes": [
        ("general notes", 5),
        ("legend", 4),
        ("abbreviations", 4),
        ("symbols", 3),
    ],
}


# ==========================================
# TEXT EXTRACTION
# ==========================================
def extract_text_from_pdf(pdf_path):
    """
    Extract text from PDF.
    First tries normal PDF text.
    If text is weak, it uses OCR on first page.
    """
    text = ""

    try:
        doc = fitz.open(pdf_path)

        # Try normal text extraction from first 2 pages
        for page_index in range(min(2, len(doc))):
            page = doc[page_index]
            text += page.get_text() + "\n"

        # If PDF has little/no selectable text, use OCR
        if len(text.strip()) < 50 and len(doc) > 0:
            page = doc[0]
            pix = page.get_pixmap(dpi=200)
            temp_image_path = pdf_path.with_suffix(".temp_ocr.png")
            pix.save(temp_image_path)

            image = Image.open(temp_image_path)
            text = pytesseract.image_to_string(image)

            if temp_image_path.exists():
                temp_image_path.unlink()

        doc.close()

    except Exception as e:
        print(f"Could not read PDF: {pdf_path.name} | Error: {e}")

    return text


def extract_text_from_image(image_path):
    """
    Extract text from image using OCR.
    """
    text = ""

    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)

    except Exception as e:
        print(f"Could not OCR image: {image_path.name} | Error: {e}")

    return text


def extract_file_text(file_path):
    """
    Get text from PDF or image.
    Also includes file name because many drawings have useful names.
    """
    file_name_text = file_path.stem.replace("_", " ").replace("-", " ")

    if file_path.suffix.lower() == ".pdf":
        extracted_text = extract_text_from_pdf(file_path)
    else:
        extracted_text = extract_text_from_image(file_path)

    final_text = file_name_text + "\n" + extracted_text
    return final_text


# ==========================================
# CLASSIFICATION
# ==========================================
def classify_discipline(text):
    """
    Classify drawing discipline:
    Architecture, Structural, Electrical, Mechanical, Plumbing, or Unknown.
    """
    text = text.lower()
    scores = {}

    for discipline, keywords in DISCIPLINE_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in text:
                score += 1
        scores[discipline] = score

    best_discipline = max(scores, key=scores.get)

    if scores[best_discipline] == 0:
        return "Unknown"

    return best_discipline


def classify_drawing_type(text):
    """
    Classify drawing type:
    Floor Plan, Elevation, Section, Site Plan, etc.
    """
    text = text.lower()
    scores = {}

    for drawing_type, keywords in DRAWING_TYPE_KEYWORDS.items():
        score = 0
        for keyword, weight in keywords:
            if keyword in text:
                score += weight
        scores[drawing_type] = score

    best_type = max(scores, key=scores.get)

    if scores[best_type] == 0:
        return "Unknown"

    return best_type


# ==========================================
# METADATA EXTRACTION
# ==========================================
def extract_sheet_number(text):
    """
    Try to find sheet/drawing number.
    Examples:
    A-101, A101, S-201, E-301, M-401
    """
    patterns = [
        r"\b(?:drawing no|dwg no|sheet no|drawing number|sheet number)\s*[:\-]?\s*([A-Z]{1,3}[- ]?\d{2,4}[A-Z]?)\b",
        r"\b([A-Z]{1,3}[- ]?\d{2,4}[A-Z]?)\b",
    ]

    text_upper = text.upper()

    for pattern in patterns:
        match = re.search(pattern, text_upper)
        if match:
            return match.group(1).replace(" ", "")

    return "NoSheetNo"


def extract_revision(text):
    """
    Try to find revision number/letter.
    Examples:
    Rev 0, Revision A, REV: B
    """
    patterns = [
        r"\bREV(?:ISION)?\s*[:\-]?\s*([A-Z0-9]+)\b",
        r"\bREV\.\s*([A-Z0-9]+)\b",
    ]

    text_upper = text.upper()

    for pattern in patterns:
        match = re.search(pattern, text_upper)
        if match:
            return match.group(1)

    return "NoRev"


def extract_date(text):
    """
    Try to find date.
    Examples:
    12/05/2025, 12-05-2025
    """
    patterns = [
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
        r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)

    return "NoDate"


# ==========================================
# FILE HELPERS
# ==========================================
def clean_name(name):
    """
    Remove characters that are not allowed in Windows file/folder names.
    """
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = re.sub(r"\s+", "_", name)
    return name.strip("_")


def unique_destination_path(destination_path):
    """
    Avoid overwriting files with the same name.
    """
    if not destination_path.exists():
        return destination_path

    folder = destination_path.parent
    stem = destination_path.stem
    suffix = destination_path.suffix

    counter = 1
    while True:
        new_path = folder / f"{stem}_{counter}{suffix}"
        if not new_path.exists():
            return new_path
        counter += 1


# ==========================================
# MAIN ORGANIZER
# ==========================================
def organize_drawings():
    if not INPUT_FOLDER.exists():
        INPUT_FOLDER.mkdir()
        print("input_drawings folder was created.")
        print("Put your drawings inside it, then run the program again.")
        return

    OUTPUT_FOLDER.mkdir(exist_ok=True)

    files = [
        file for file in INPUT_FOLDER.iterdir()
        if file.is_file() and file.suffix.lower() in SUPPORTED_FILES
    ]

    if not files:
        print("No drawing files found in input_drawings.")
        return

    report_rows = []

    print(f"Found {len(files)} drawing file(s).")
    print("Starting organization...\n")

    for file_path in files:
        print(f"Processing: {file_path.name}")

        text = extract_file_text(file_path)

        discipline = classify_discipline(text)
        drawing_type = classify_drawing_type(text)
        sheet_number = extract_sheet_number(text)
        revision = extract_revision(text)
        drawing_date = extract_date(text)

        discipline_folder = clean_name(discipline)
        type_folder = clean_name(drawing_type)

        destination_folder = OUTPUT_FOLDER / discipline_folder / type_folder
        destination_folder.mkdir(parents=True, exist_ok=True)

        new_file_name = f"{discipline}_{drawing_type}_{sheet_number}_{revision}_{file_path.name}"
        new_file_name = clean_name(new_file_name)

        destination_path = destination_folder / new_file_name
        destination_path = unique_destination_path(destination_path)

        shutil.copy2(file_path, destination_path)

        report_rows.append({
            "Original File": file_path.name,
            "Discipline": discipline,
            "Drawing Type": drawing_type,
            "Sheet Number": sheet_number,
            "Revision": revision,
            "Date": drawing_date,
            "New Location": str(destination_path.relative_to(BASE_DIR)),
        })

    # Save report
    with open(REPORT_FILE, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "Original File",
            "Discipline",
            "Drawing Type",
            "Sheet Number",
            "Revision",
            "Date",
            "New Location"
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(report_rows)

    print("\nDone.")
    print(f"Organized files saved in: {OUTPUT_FOLDER}")
    print(f"Report saved as: {REPORT_FILE}")


if __name__ == "__main__":
    organize_drawings()