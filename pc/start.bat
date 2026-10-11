@echo off
rem Starts the golf practice app. Keep this window open while using the app.
rem launcher.py installs packages, runs server.py, and restarts it after an in-app update.
cd /d "%~dp0"
set "PY=python"
py -3.12 --version >nul 2>nul
if not errorlevel 1 set "PY=py -3.12"
%PY% --version
%PY% launcher.py
pause
