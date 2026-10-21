@echo off
chcp 65001 >nul
powershell -STA -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-post.ps1"
echo.
pause
