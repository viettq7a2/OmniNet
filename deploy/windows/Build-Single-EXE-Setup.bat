@echo off
setlocal enabledelayedexpansion
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
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo [WARNING] Retrying npm install with --force...
    call npm install --force
)

echo [2/4] Compiling frontend and backend production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Please check TypeScript and Vite output above.
    pause
    exit /b 1
)

if not exist "dist-installer" mkdir "dist-installer"

echo [3/4] Searching for Inno Setup Compiler (ISCC.exe)...

set "ISCC_PATH="
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"

if defined ISCC_PATH goto run_iscc

where iscc >nul 2>nul
if %errorlevel% equ 0 (
    set "ISCC_PATH=iscc"
    goto run_iscc
)

echo [INFO] Inno Setup is not detected in standard paths. Installing via winget...
winget install --id JRSoftware.InnoSetup -e --silent --accept-source-agreements --accept-package-agreements >nul 2>nul

if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
    goto run_iscc
)
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    goto run_iscc
)

echo [ERROR] Could not find ISCC.exe. Please install Inno Setup from https://jrsoftware.org/isdl.php
pause
exit /b 1

:run_iscc
echo [FOUND] Inno Setup compiler detected at: "!ISCC_PATH!"
echo [4/4] Compiling single-file installer: dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe ...
"!ISCC_PATH!" "deploy\windows\OmniNet-Enterprise-Setup.iss"

if exist "dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe" (
    echo.
    echo ============================================================================
    echo [SUCCESS] File cai dat duy nhat da duoc tao thanh cong tai:
    echo   %CD%\dist-installer\OmniNet-Enterprise-Setup-v3.5.0.exe
    echo ============================================================================
    explorer "%CD%\dist-installer"
    pause
    exit /b 0
) else (
    echo [ERROR] Inno Setup compilation failed.
    pause
    exit /b 1
)
