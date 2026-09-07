import cv2
import pytesseract
import numpy as np
from pathlib import Path

# Tesseract path for your laptop
pytesseract.pytesseract.tesseract_cmd = r"C:\Users\HP\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"


def read_image_safely(image_path):
    """
    Reads image safely even if the file path has spaces.
    """
    image_bytes = np.fromfile(image_path, dtype=np.uint8)
    image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
    return image


def run_ocr(image_path):
    image = read_image_safely(image_path)

    if image is None:
        print("Error: Could not read the image. Check the file path or image format.")
        return

    height, width, _ = image.shape

    # Crop only the right-side title block
    # Increase number = narrower crop, less floor plan text
    # Decrease number = wider crop, more right-side text
    crop_start = 0.68

    right_side = image[0:height, int(width * crop_start):width]

    # Resize cropped area to improve OCR
    right_side = cv2.resize(
        right_side,
        None,
        fx=2.5,
        fy=2.5,
        interpolation=cv2.INTER_CUBIC
    )

    # Convert to grayscale
    gray = cv2.cvtColor(right_side, cv2.COLOR_BGR2GRAY)

    # Reduce noise slightly
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # Convert to black and white
    processed = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )[1]

    # -----------------------------
    # Remove table/grid lines
    # -----------------------------

    inverted = 255 - processed

    # Detect horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    horizontal_lines = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        horizontal_kernel,
        iterations=1
    )

    # Detect vertical lines
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    vertical_lines = cv2.morphologyEx(
        inverted,
        cv2.MORPH_OPEN,
        vertical_kernel,
        iterations=1
    )

    # Combine table lines
    table_lines = cv2.add(horizontal_lines, vertical_lines)

    # Remove table lines
    cleaned = cv2.subtract(inverted, table_lines)

    # Convert back to black text on white background
    cleaned = 255 - cleaned

    # OCR configuration
    config = "--oem 3 --psm 6"

    text = pytesseract.image_to_string(cleaned, config=config)

    # Save output files
    image_name = Path(image_path).stem

    text_file = f"{image_name}_right_side_text.txt"
    crop_file = f"{image_name}_right_side_crop.png"
    processed_file = f"{image_name}_right_side_processed.png"
    cleaned_file = f"{image_name}_right_side_cleaned.png"

    with open(text_file, "w", encoding="utf-8") as file:
        file.write(text)

    cv2.imwrite(crop_file, right_side)
    cv2.imwrite(processed_file, processed)
    cv2.imwrite(cleaned_file, cleaned)

    print("Extracted Text:")
    print(text)

    print("\nFiles saved:")
    print(text_file)
    print(crop_file)
    print(processed_file)
    print(cleaned_file)


# -----------------------------
# Main program
# -----------------------------

image_path = "drawing1.png"

run_ocr(image_path)