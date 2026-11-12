@echo off
setlocal
cd /d "%~dp0"
title LakeClean Public Demo Backend Tunnel
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared is not installed or is not on PATH.
  echo Install Cloudflare Tunnel's cloudflared client, then double-click this file again.
  echo Do not upload credentials or tunnel files to GitHub.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo Python environment not found. Set up .venv and install requirements first.
  pause
  exit /b 1
)
echo Starting the local YOLO backend in a second window...
start "LakeClean Backend" "%~dp0Start LakeClean Backend.bat"
echo.
echo Starting the temporary HTTPS tunnel for GitHub Pages.
echo Copy the https://*.trycloudflare.com URL printed below.
echo In the dashboard, open Inference backend connection and save that URL.
echo Keep both windows open during the demo. Close this window to stop the tunnel.
echo.
cloudflared tunnel --url http://127.0.0.1:8001
endlocal
