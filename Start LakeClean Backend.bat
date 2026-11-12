@echo off
setlocal
cd /d "%~dp0"
title LakeClean Dashboard and Detection
if not exist ".venv\Scripts\python.exe" (
  echo Python environment not found. Set up .venv and install requirements first.
  pause
  exit /b 1
)
echo Starting LakeClean dashboard and YOLO backend. First launch may take a while.
echo Browser opens automatically when the service is ready.
echo Keep this window open while using LakeClean. Close it to stop.
".venv\Scripts\python.exe" -u launch_lakeclean.py
if errorlevel 1 pause
endlocal
