@echo off
title DOMUS Launcher
echo ==============================================
echo    INICIANDO SERVIDORES DOMUS SMART HOME
echo ==============================================
echo.
echo [1/2] Iniciando Backend FastAPI na porta 8000...
start "DOMUS Backend" cmd /k "python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000"

echo [2/2] Iniciando Frontend Vite na porta 5173...
cd frontend
start "DOMUS Frontend" cmd /k "npm run dev"

echo.
echo ==============================================
echo Servidores iniciados!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo ==============================================
