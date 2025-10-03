@echo off
REM Try Python3 first
python -m http.server 8000 2>nul
if %errorlevel% neq 0 (
  echo Python not found. Try running start-server.ps1 in PowerShell (requires PS5+).
)
