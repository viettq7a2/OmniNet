@echo off
title OmniNet Enterprise NCM - Single EXE Installer Builder
color 0B
echo ============================================================================
echo   OmniNet Enterprise NCM - Windows Single-File Setup (.EXE) Generator
echo   Target Output: dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe
echo ============================================================================
echo.

cd /d "%~dp0\..\.."

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Installing project dependencies...
call npm install

echo [2/4] Compiling frontend & backend assets...
call npm run build

if not exist "dist-installer" mkdir "dist-installer"

echo [3/4] Searching for Inno Setup Compiler (ISCC.exe)...

set "ISCC_PATH="
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"

if defined ISCC_PATH (
    echo [FOUND] Inno Setup compiler detected at: "%ISCC_PATH%"
    echo Compiling single-file installer: dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe ...
    "%ISCC_PATH%" "deploy\windows\OmniNet-Enterprise-Setup.iss"
    if %errorlevel% equ 0 (
        echo.
        echo ============================================================================
        echo [SUCCESS] File cai dat duy nhat da duoc tao thanh cong tai:
        echo   %CD%\dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe
        echo ============================================================================
        explorer "%CD%\dist-installer"
        pause
        exit /b 0
    )
)

echo [INFO] Inno Setup is not installed yet on this system.
echo Dang cai dat Inno Setup tu dong qua Windows Package Manager (winget)...
winget install --id JRSoftware.InnoSetup -e --silent --accept-source-agreements --accept-package-agreements >nul 2>nul

if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "deploy\windows\OmniNet-Enterprise-Setup.iss"
    echo [SUCCESS] Tao bo cai dat Setup.exe thanh cong!
    explorer "%CD%\dist-installer"
    pause
    exit /b 0
)

echo.
echo ============================================================================
echo   CAC PHUONG AN DONG GOI 1 FILE .EXE DUY NHAT:
echo ============================================================================
echo   Phuong an 1 (Khuyen nghi):
echo     1. Cai dat Inno Setup mien phi tu: https://jrsoftware.org/isdl.php
echo     2. Nhap dup file "deploy\windows\OmniNet-Enterprise-Setup.iss" va bam Run (F9).
echo     3. Thu muc "dist-installer" se xuat hien file "OmniNet-Enterprise-Setup-v3.5.0.exe".
echo.
echo   Phuong an 2 (Dong goi Native App truc tiep bang 1 lenh qua CMD):
echo     npx nativefier --name "OmniNet-Enterprise" --width 1500 --height 950 http://localhost:3000
echo ============================================================================
pause
