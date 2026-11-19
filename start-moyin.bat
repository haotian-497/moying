@echo off
title Moyin
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-moyin.ps1"
if errorlevel 1 pause
