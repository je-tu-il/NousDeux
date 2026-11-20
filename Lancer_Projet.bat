@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "APP_TITLE=NousDeux"
title %APP_TITLE%

echo ========================================================
echo   %APP_TITLE%
echo ========================================================
echo.
REM --- 1. VERIFICATION DES PREREQUIS ---
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js introuvable.
    start https://nodejs.org/
    pause
    exit /b 1
)
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python introuvable.
    start ms-windows-store://search/?query=Python
    pause
    exit /b 1
)

if exist "%~dp0venv\Scripts\python.exe" (
    set "PY_BIN=%~dp0venv\Scripts\python.exe"
) else (
    echo [*] Creation de l'environnement virtuel venv...
    python -m venv venv
    set "PY_BIN=%~dp0venv\Scripts\python.exe"
    if exist "%~dp0requirements.txt" (
        "%PY_BIN%" -m pip install -q --disable-pip-version-check --no-warn-script-location -r "%~dp0requirements.txt"
    )
)

if not exist "%~dp0node_modules" (
    echo [*] Installation automatique des modules npm...
    call npm install --no-fund --no-audit --silent
)

echo [*] Lancement du backend Python (fix_encoding.py)...
start "Backend NousDeux" "%PY_BIN%" "%~dp0fix_encoding.py"
echo [*] Lancement du frontend Web...
call npm start
if errorlevel 1 (
    echo.
    echo [!] Une erreur est survenue (Code: %errorlevel%).
    pause
    exit /b %errorlevel%
)
exit /b 0
