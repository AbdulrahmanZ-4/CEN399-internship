# =============================================================================
# Task 9 - one-command launcher (Scope website + AI document chatbot).
#
# Run from this folder:   .\start.ps1
# (or just double-click start.bat)
#
# It will, on first run: create the Python venv, install Python + Node deps,
# and index the company documents. On every run it starts BOTH services:
#   - the Python chatbot API  (http://127.0.0.1:8000)
#   - the Node website        (https://localhost:3000)
# Press Ctrl+C (or close the window) to stop both.
# =============================================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$chatbot = Join-Path $root "chatbot"
$venvPython = Join-Path $chatbot "venv\Scripts\python.exe"
$seedMarker = Join-Path $chatbot "chroma_db\.seeded"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }

# --- 1. Python virtual environment + dependencies (first run only) -----------
if (-not (Test-Path $venvPython)) {
    Write-Step "Creating Python virtual environment (first run)..."
    python -m venv (Join-Path $chatbot "venv")

    Write-Step "Installing Python dependencies (this can take a few minutes)..."
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r (Join-Path $chatbot "requirements.txt")
}

# --- 2. Node dependencies (first run only) -----------------------------------
if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Step "Installing Node dependencies (first run)..."
    npm install
}

# --- 3. Index the company documents into the vector DB (first run only) ------
if (-not (Test-Path $seedMarker)) {
    Write-Step "Indexing company documents (first run)..."
    Push-Location $chatbot
    try {
        & $venvPython ingest_docs.py
        New-Item -ItemType File -Path $seedMarker -Force | Out-Null
    } finally {
        Pop-Location
    }
}

# --- 4. Friendly heads-up if Ollama does not look available ------------------
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "`n  NOTE: 'ollama' was not found on PATH. The chat answers need Ollama" -ForegroundColor Yellow
    Write-Host "        running with the model pulled:  ollama pull llama3.1:8b`n" -ForegroundColor Yellow
}

# --- 5. Start the Python chatbot API in the background -----------------------
Write-Step "Starting AI chatbot service (http://127.0.0.1:8000)..."
$api = Start-Process -FilePath $venvPython -ArgumentList "api.py" `
    -WorkingDirectory $chatbot -PassThru -NoNewWindow

# --- 6. Start the Node website in the foreground -----------------------------
# When Node exits (Ctrl+C or window close), stop the Python API too.
try {
    Write-Step "Starting website -> https://localhost:3000  (Ctrl+C to stop)"
    node server.js
} finally {
    Write-Step "Stopping AI chatbot service..."
    if ($api -and -not $api.HasExited) {
        Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    }
}
