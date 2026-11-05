# ==============================================================================
# OmniNet Enterprise NCM — Windows Desktop (.exe) & Windows Service Builder
# ==============================================================================

$ErrorActionPreference = "Stop"
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  OmniNet Windows Edition — Packaging & Windows Service Setup" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Open Windows Firewall Port 3000 (Inbound Web UI) & Allow Outbound SSH/SNMP Probing
Write-Host "[1/4] Configuring Windows Defender Firewall for OmniNet..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "OmniNet Enterprise Web Console (TCP 3000)" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null

# 2. Install & Build Production Bundle
Write-Host "[2/4] Building OmniNet Production Assets..." -ForegroundColor Yellow
npm install
npm run build

# 3. Create Windows Desktop Shortcut with Native App Mode
Write-Host "[3/4] Creating OmniNet Desktop Application Shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "OmniNet Enterprise.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path (Get-Location) "deploy\windows\Start-OmniNet-Windows.bat"
$Shortcut.WorkingDirectory = (Get-Location).Path
$Shortcut.Description = "OmniNet Enterprise NCM - Multi-Vendor Network & AI RCA Console"
$Shortcut.Save()

Write-Host "[4/4] Completed! Shortcut created at: $ShortcutPath" -ForegroundColor Green
Write-Host "To package as a standalone .exe installer with Electron:" -ForegroundColor Cyan
Write-Host "  npx nativefier --name 'OmniNet' --width 1480 --height 920 http://localhost:3000" -ForegroundColor White
