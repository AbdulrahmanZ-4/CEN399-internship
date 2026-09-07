import os
import json
import tempfile
import pandas as pd
import streamlit as st

from extractor import extract_pdf_information, FIELD_ORDER


st.set_page_config(
    page_title="Smart PDF Drawing Information Extractor",
    page_icon="📄",
    layout="wide"
)

st.title("📄 Smart PDF Drawing Information Extractor")
st.write(
    "Upload architectural PDF drawings and extract title block information such as "
    "project name, drawing number, revision, date, scale, and sheet number."
)

st.sidebar.header("Settings")

default_tesseract_path = r"C:\Users\HP\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

tesseract_path = st.sidebar.text_input(
    "Tesseract Path",
    value=default_tesseract_path
)

use_ocr = st.sidebar.checkbox(
    "Use OCR for scanned drawings",
    value=True
)

dpi = st.sidebar.slider(
    "PDF render quality / DPI",
    min_value=120,
    max_value=350,
    value=220,
    step=10
)

max_pages = st.sidebar.number_input(
    "Max pages to process per PDF",
    min_value=1,
    max_value=100,
    value=5
)

ocr_language = st.sidebar.text_input(
    "OCR language",
    value="eng",
    help="Use eng for English. If Arabic OCR is installed, try eng+ara."
)

uploaded_files = st.file_uploader(
    "Upload PDF drawing(s)",
    type=["pdf"],
    accept_multiple_files=True
)

if uploaded_files:
    st.success(f"{len(uploaded_files)} PDF file(s) uploaded.")

    if st.button("Extract Information"):
        all_rows = []
        raw_text_storage = {}

        progress_bar = st.progress(0)
        total_files = len(uploaded_files)

        for file_index, uploaded_file in enumerate(uploaded_files):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file.write(uploaded_file.read())
                temp_pdf_path = temp_file.name

            try:
                results = extract_pdf_information(
                    pdf_path=temp_pdf_path,
                    tesseract_path=tesseract_path,
                    max_pages=max_pages,
                    use_ocr=use_ocr,
                    dpi=dpi,
                    lang=ocr_language
                )

                for page_result in results:
                    row = {
                        "file_name": uploaded_file.name,
                        "page_number": page_result["page_number"],
                        "confidence_percent": page_result["confidence_percent"],
                    }

                    for field in FIELD_ORDER:
                        row[field] = page_result["fields"].get(field, "")

                    all_rows.append(row)

                    key = f"{uploaded_file.name} - Page {page_result['page_number']}"
                    raw_text_storage[key] = page_result["combined_text"]

            except Exception as e:
                st.error(f"Error processing {uploaded_file.name}: {e}")

            finally:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)

            progress_bar.progress((file_index + 1) / total_files)

        if all_rows:
            df = pd.DataFrame(all_rows)

            st.subheader("Extracted Drawing Information")
            st.dataframe(df, use_container_width=True)

            csv_data = df.to_csv(index=False).encode("utf-8-sig")

            st.download_button(
                label="Download Results as CSV",
                data=csv_data,
                file_name="drawing_information_results.csv",
                mime="text/csv"
            )

            json_data = json.dumps(all_rows, indent=4, ensure_ascii=False)

            st.download_button(
                label="Download Results as JSON",
                data=json_data,
                file_name="drawing_information_results.json",
                mime="application/json"
            )

            st.subheader("View Raw Extracted Text")

            selected_page = st.selectbox(
                "Select file/page",
                list(raw_text_storage.keys())
            )

            st.text_area(
                "Raw text used for extraction",
                value=raw_text_storage[selected_page],
                height=350
            )

        else:
            st.warning("No information was extracted.")
else:
    st.info("Upload one or more PDF drawings to start.")