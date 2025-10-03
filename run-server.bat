@echo off
REM Run the PowerShell server script with an execution policy bypass for this invocation
REM This avoids changing system-wide execution policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
