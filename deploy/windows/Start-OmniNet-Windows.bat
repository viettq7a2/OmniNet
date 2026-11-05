@echo off
title OmniNet Enterprise NCM - Windows Desktop & Server Edition
color 0B
echo ============================================================================
echo   OmniNet Enterprise NCM - Autonomous NetOps & Multi-Vendor CLI Platform
echo   Phien ban: Windows Desktop / Windows Server Edition (Port 3000)
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Chua cai dat Node.js Runtime tren Windows.
    echo Vui long tai Node.js LTS (v20/v22) tai https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/3] Dang cai dat cac thu vien phu thuoc cho OmniNet...
    call npm install
)

if not exist "dist" (
    echo [2/3] Dang dong goi giao dien Production OmniNet...
    call npm run build
)

echo [3/3] Dang khoi dong OmniNet Backend Server & Zero-API-Key AI Relay (Port 3000)...
start "OmniNet Core Engine" cmd /c "npx tsx server.ts"

timeout /t 3 /nobreak >nul

echo Dang mo cua so ung dung OmniNet Native Desktop App...
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --app=http://localhost:3000 --window-size=1480,920
) else (
    start http://localhost:3000
)

echo.
echo [OK] OmniNet dang chay tai http://localhost:3000
pause
