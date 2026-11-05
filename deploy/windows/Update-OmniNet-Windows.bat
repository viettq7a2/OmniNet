@echo off
title OmniNet Enterprise NCM - GitHub Auto-Updater (Windows)
color 0A
echo ============================================================================
echo   OmniNet Enterprise NCM - One-Click GitHub Updater (Windows)
echo ============================================================================
echo.
echo [1/4] Pulling latest release from GitHub repository...
git pull origin main
echo.
echo [2/4] Updating Node.js dependencies...
call npm install
echo.
echo [3/4] Rebuilding production bundle...
call npm run build
echo.
echo [4/4] Update complete! Launching OmniNet on Port 3000...
call deploy\windows\Start-OmniNet-Windows.bat
