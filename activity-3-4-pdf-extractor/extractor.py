import os
import re
import io
import fitz  # PyMuPDF
import cv2
import numpy as np
import pytesseract
from PIL import Image


FIELD_ORDER = [
    "project_name",
    "drawing_title",
    "drawing_number",
    "revision",
    "date",
    "scale",
    "sheet_number",
    "discipline",
    "designed_by",
    "checked_by",
]


def configure_tesseract(tesseract_path=None):
    """
    Configure Tesseract path for Windows.
    """
    if tesseract_path and os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path


def clean_text(text):
    """
    Clean OCR/PDF extracted text.
    """
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


def clean_value(value):
    """
    Clean extracted field value.
    """
    if not value:
        return ""

    value = value.strip()
    value = value.strip(":|-_ ")
    value = re.sub(r"\s+", " ", value)

    unwanted_words = [
        "drawing no",
        "drawing number",
        "dwg no",
        "project name",
        "drawing title",
        "revision",
        "rev",
        "scale",
        "date",
        "sheet",
        "checked by",
        "designed by",
    ]

    lower_value = value.lower()
    for word in unwanted_words:
        if lower_value == word:
            return ""

    return value.strip()


def get_lines(text):
    """
    Convert large text into clean lines.
    """
    lines = []
    for line in text.splitlines():
        line = clean_value(line)
        if len(line) > 1:
            lines.append(line)
    return lines


def find_by_patterns(text, patterns):
    """
    Search field value using regex patterns.
    """
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            if "value" in match.groupdict():
                value = match.group("value")
            else:
                value = match.group(1)

            value = clean_value(value)

            if value:
                return value

    return ""


def find_near_label(lines, labels):
    """
    Search for labels like 'Project Name' and take text after it
    or from the next line.
    """
    for i, line in enumerate(lines):
        lower_line = line.lower()

        for label in labels:
            if label in lower_line:
                # Case 1: label and value are on the same line
                parts = re.split(r":|-", line, maxsplit=1)
                if len(parts) > 1:
                    value = clean_value(parts[1])
                    if value:
                        return value

                # Case 2: value is on next line
                if i + 1 < len(lines):
                    value = clean_value(lines[i + 1])
                    if value:
                        return value

    return ""


def extract_fields_from_text(text):
    """
    Extract important architectural drawing metadata.
    """
    text = clean_text(text)
    lines = get_lines(text)

    result = {field: "" for field in FIELD_ORDER}

    result["project_name"] = find_by_patterns(text, [
        r"(?:project\s*name|project)\s*[:\-]\s*(?P<value>[^\n]+)",
    ])

    result["drawing_title"] = find_by_patterns(text, [
        r"(?:drawing\s*title|sheet\s*title|title)\s*[:\-]\s*(?P<value>[^\n]+)",
    ])

    result["drawing_number"] = find_by_patterns(text, [
        r"(?:drawing\s*(?:no|number)|dwg\.?\s*no\.?|drg\.?\s*no\.?)\s*[:\-]?\s*(?P<value>[A-Z0-9_\-\/\.]+)",
    ])

    result["revision"] = find_by_patterns(text, [
        r"(?:revision|rev\.?)\s*[:\-]?\s*(?P<value>[A-Z0-9]+)",
    ])

    result["date"] = find_by_patterns(text, [
        r"(?:date)\s*[:\-]?\s*(?P<value>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})",
        r"(?:date)\s*[:\-]?\s*(?P<value>\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})",
        r"\b(?P<value>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b",
        r"\b(?P<value>\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b",
    ])

    result["scale"] = find_by_patterns(text, [
        r"(?:scale)\s*[:\-]?\s*(?P<value>1\s*:\s*\d+)",
        r"\b(?P<value>1\s*:\s*\d+)\b",
        r"(?:scale)\s*[:\-]?\s*(?P<value>NTS)",
    ])

    result["sheet_number"] = find_by_patterns(text, [
        r"(?:sheet\s*(?:no|number))\s*[:\-]?\s*(?P<value>[A-Z0-9_\-\/\.]+)",
        r"(?:sheet)\s*[:\-]?\s*(?P<value>[A-Z0-9_\-\/\.]+)",
    ])

    result["discipline"] = find_by_patterns(text, [
        r"(?:discipline)\s*[:\-]\s*(?P<value>[^\n]+)",
    ])

    result["designed_by"] = find_by_patterns(text, [
        r"(?:designed\s*by|design\s*by)\s*[:\-]\s*(?P<value>[^\n]+)",
    ])

    result["checked_by"] = find_by_patterns(text, [
        r"(?:checked\s*by|check\s*by)\s*[:\-]\s*(?P<value>[^\n]+)",
    ])

    # Fallback search using nearby labels
    if not result["project_name"]:
        result["project_name"] = find_near_label(lines, ["project name", "project"])

    if not result["drawing_title"]:
        result["drawing_title"] = find_near_label(lines, ["drawing title", "sheet title", "title"])

    if not result["drawing_number"]:
        result["drawing_number"] = find_near_label(lines, ["drawing no", "drawing number", "dwg no", "drg no"])

    if not result["revision"]:
        result["revision"] = find_near_label(lines, ["revision", "rev"])

    if not result["scale"]:
        result["scale"] = find_near_label(lines, ["scale"])

    if not result["date"]:
        result["date"] = find_near_label(lines, ["date"])

    if not result["sheet_number"]:
        result["sheet_number"] = find_near_label(lines, ["sheet no", "sheet number", "sheet"])

    if not result["discipline"]:
        result["discipline"] = find_near_label(lines, ["discipline"])

    if not result["designed_by"]:
        result["designed_by"] = find_near_label(lines, ["designed by", "design by"])

    if not result["checked_by"]:
        result["checked_by"] = find_near_label(lines, ["checked by", "check by"])

    return result


def render_page_to_image(page, dpi=220):
    """
    Convert PDF page to OpenCV image.
    """
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)

    image_bytes = pix.tobytes("png")
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    image = np.array(pil_image)
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    return image


def preprocess_for_ocr(image):
    """
    Improve image before OCR.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Increase contrast
    gray = cv2.convertScaleAbs(gray, alpha=1.4, beta=0)

    # Remove small noise
    gray = cv2.fastNlMeansDenoising(gray, h=15)

    # Threshold
    processed = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11
    )

    return processed


def crop_title_block_regions(image):
    """
    Crop common title block regions.
    Many architectural drawings place title block on the right side or bottom-right.
    """
    h, w = image.shape[:2]

    regions = {}

    # Bottom-right title block
    regions["bottom_right_title_block"] = image[int(h * 0.50):h, int(w * 0.45):w]

    # Full right side
    regions["right_side"] = image[:, int(w * 0.60):w]

    # Bottom strip
    regions["bottom_strip"] = image[int(h * 0.65):h, :]

    # Top strip, useful for project names in some drawings
    regions["top_strip"] = image[:int(h * 0.25), :]

    return regions


def ocr_image(image, lang="eng"):
    """
    Run OCR on one image region.
    """
    processed = preprocess_for_ocr(image)

    config = "--oem 3 --psm 6"

    try:
        text = pytesseract.image_to_string(processed, lang=lang, config=config)
        return clean_text(text)
    except Exception as e:
        return f"OCR_ERROR: {str(e)}"


def extract_page_information(page, page_number, use_ocr=True, dpi=220, lang="eng"):
    """
    Extract information from one PDF page.
    """
    # 1. Try direct PDF text extraction
    direct_text = page.get_text("text")
    direct_text = clean_text(direct_text)

    ocr_text = ""
    region_texts = {}

    # 2. OCR cropped title block areas
    if use_ocr:
        image = render_page_to_image(page, dpi=dpi)
        regions = crop_title_block_regions(image)

        for region_name, region_image in regions.items():
            text = ocr_image(region_image, lang=lang)
            region_texts[region_name] = text

        ocr_text = "\n".join(region_texts.values())

    # 3. Combine all text
    combined_text = direct_text + "\n" + ocr_text
    combined_text = clean_text(combined_text)

    # 4. Extract structured fields
    fields = extract_fields_from_text(combined_text)

    # 5. Simple confidence score
    filled_count = sum(1 for value in fields.values() if value)
    confidence = round((filled_count / len(FIELD_ORDER)) * 100, 1)

    return {
        "page_number": page_number,
        "fields": fields,
        "confidence_percent": confidence,
        "direct_text": direct_text,
        "ocr_text": ocr_text,
        "combined_text": combined_text,
        "region_texts": region_texts,
    }


def extract_pdf_information(
    pdf_path,
    tesseract_path=None,
    max_pages=None,
    use_ocr=True,
    dpi=220,
    lang="eng"
):
    """
    Extract information from all pages of a PDF.
    """
    configure_tesseract(tesseract_path)

    results = []

    doc = fitz.open(pdf_path)

    total_pages = len(doc)

    if max_pages is None or max_pages <= 0:
        pages_to_process = total_pages
    else:
        pages_to_process = min(max_pages, total_pages)

    for page_index in range(pages_to_process):
        page = doc[page_index]

        page_result = extract_page_information(
            page=page,
            page_number=page_index + 1,
            use_ocr=use_ocr,
            dpi=dpi,
            lang=lang
        )

        results.append(page_result)

    doc.close()

    return results