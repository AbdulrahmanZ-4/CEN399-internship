#!/bin/sh
# Seed the vector DB from company_docs/ on first run (idempotent thereafter),
# then start the API. chroma_db is a named volume, so the marker persists.
set -e
cd /app/chatbot

if [ ! -f chroma_db/.seeded ]; then
  echo "First run: indexing company documents..."
  python ingest_docs.py || echo "(seed step failed; continuing — you can run it later)"
  mkdir -p chroma_db && touch chroma_db/.seeded
fi

exec python api.py
