@echo off
rem Installs the golf practice app (Python, ffmpeg, the app, and a desktop shortcut).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
