@echo off
title Meridian OmniQueue - Enterprise Ticket Orchestrator
color 0A
echo =====================================================================
echo   Meridian OmniQueue: AI-Triage & Multi-Tier DSA Orchestration Engine
echo =====================================================================
echo.
echo [1/2] Checking Python environment...
python --version
if errorlevel 1 (
    echo Error: Python is not found in PATH! Please install Python.
    pause
    exit /b
)

echo [2/2] Launching server on http://127.0.0.1:8000...
echo Opening browser...
start http://127.0.0.1:8000
python app.py
pause
