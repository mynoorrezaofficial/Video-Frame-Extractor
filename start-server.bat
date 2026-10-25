@echo off
start "Backend" cmd /k "cd /d "%~dp0backend" & node server.js"
timeout /t 2 >nul
start "Frontend" cmd /k "cd /d "%~dp0frontend" & npm run dev"