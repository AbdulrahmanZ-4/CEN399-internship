"""
Seed the vector database from every document in company_docs/.

Run once before starting the API (or any time you add new documents):

    python ingest_docs.py

Files whose names start with a 32-char md5 hash + '_' are skipped, because those
are copies the app itself saved on a previous ingest (they duplicate the
original). Supported types: .pdf .docx .txt .md
"""

import re
from pathlib import Path

import rag_core

SUPPORTED = {".pdf", ".docx", ".txt", ".md"}
# Files the app previously saved look like "<32 hex chars>_<original name>".
ALREADY_SAVED = re.compile(r"^[0-9a-f]{32}_")


def main():
    docs_dir = Path(rag_core.UPLOAD_DIR)
    files = sorted(
        p for p in docs_dir.iterdir()
        if p.is_file()
        and p.suffix.lower() in SUPPORTED
        and not ALREADY_SAVED.match(p.name)
    )

    if not files:
        print(f"No documents found in {docs_dir}")
        return

    total = 0
    for path in files:
        try:
            chunks, _ = rag_core.ingest_path(str(path))
            total += chunks
            print(f"  {path.name}: {chunks} chunks")
        except Exception as error:
            print(f"  {path.name}: FAILED ({error})")

    print(f"\nDone. {total} chunks now stored (total in DB: {rag_core.count_chunks()}).")


if __name__ == "__main__":
    main()
