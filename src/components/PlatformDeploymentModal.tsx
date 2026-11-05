import React, { useState } from 'react';
import {
  Box,
  Check,
  Copy,
  Download,
  Monitor,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import { OMNINET_SVG_SOURCE, OmniNetLogo } from './OmniNetLogo';

interface PlatformDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOCKERFILE_CONTENT = `# ==============================================================================
# OmniNet Enterprise NCM — Official Production Dockerfile
# Multi-Vendor Network Configuration, Topology & Autonomous AI RCA Platform
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Install network diagnostic tools (iputils, bind-tools, openssh-client, curl)
RUN apk add --no-cache iputils bind-tools openssh-client curl

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]`;

const DOCKER_COMPOSE_CONTENT = `version: "3.9"

services:
  omninet-enterprise:
    container_name: omninet-ncm-core
    build:
      context: .
      dockerfile: Dockerfile
    image: omninet/enterprise-ncm:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}
    cap_add:
      - NET_RAW
      - NET_ADMIN
    volumes:
      - omninet_backups:/app/backups
    networks:
      - omninet_mgmt_net

volumes:
  omninet_backups:
    driver: local

networks:
  omninet_mgmt_net:
    driver: bridge`;

const WINDOWS_BAT_CONTENT = `@echo off
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
pause`;

const WINDOWS_PS1_CONTENT = `# ==============================================================================
# OmniNet Enterprise NCM — Windows Desktop (.exe) & Windows Service Builder
# ==============================================================================

$ErrorActionPreference = "Stop"
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  OmniNet Windows Edition — Packaging & Windows Service Setup" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Open Windows Firewall Port 3000 (Inbound Web UI) & Allow Outbound SSH/SNMP Probing
Write-Host "[1/4] Configuring Windows Defender Firewall for OmniNet..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "OmniNet Enterprise Web Console (TCP 3000)" \`
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
$Shortcut.TargetPath = Join-Path (Get-Location) "deploy\\windows\\Start-OmniNet-Windows.bat"
$Shortcut.WorkingDirectory = (Get-Location).Path
$Shortcut.Description = "OmniNet Enterprise NCM - Multi-Vendor Network & AI RCA Console"
$Shortcut.Save()

Write-Host "[4/4] Completed! Shortcut created at: $ShortcutPath" -ForegroundColor Green
Write-Host "To package as a standalone .exe installer with Electron:" -ForegroundColor Cyan
Write-Host "  npx nativefier --name 'OmniNet' --width 1480 --height 920 http://localhost:3000" -ForegroundColor White`;

const WINDOWS_UPDATE_BAT_CONTENT = `@echo off
title OmniNet Enterprise NCM - Auto-Update & Zero-Downtime Rebuild
color 0A
echo ============================================================================
echo   OmniNet Enterprise NCM - Cong cu Cap Nhat Phien Ban Moi (Windows)
echo ============================================================================
echo [1/4] Dang keo ban cap nhat code moi nhat tu Repository...
git pull origin main
echo [2/4] Dang cap nhat thu vien (neu co thay doi)...
call npm install
echo [3/4] Dang bien dich lai giao dien Production...
call npm run build
echo [4/4] Hoan tat cap nhat! Khoi dong lai OmniNet...
call deploy\\windows\\Start-OmniNet-Windows.bat`;

export const PlatformDeploymentModal: React.FC<PlatformDeploymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeEdition, setActiveEdition] = useState<'windows' | 'docker' | 'logo' | 'update'>(
    'windows'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OmniNetLogo size={38} variant="icon" />
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                OmniNet — Bộ Cài Đặt Windows, Docker & Nhận Diện Thương Hiệu
              </h2>
              <p className="text-xs text-slate-400">
                2 phiên bản đóng gói sẵn sàng triển khai thực tế: Windows Desktop/Server (.bat/.ps1/.exe) & Docker Container
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edition Switcher Tabs */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveEdition('windows')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeEdition === 'windows'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>1. Phiên bản Windows (Desktop & Windows Server)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEdition('docker')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeEdition === 'docker'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>2. Phiên bản Docker & Docker Compose</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEdition('logo')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeEdition === 'logo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>3. Thiết kế Logo OmniNet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEdition('update')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeEdition === 'update'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>4. Cơ chế Update & Sao lưu Dữ liệu</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Port mặc định: 3000 · Multi-Vendor NCM v3.5
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {activeEdition === 'windows' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-sky-400">
                    <Monitor className="w-4 h-4" />
                    <span>Chế độ Native App Window</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Khởi chạy cửa sổ ứng dụng độc lập trên Windows 10/11 & Windows Server 2019/2022 không thanh địa chỉ trình duyệt.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Tự động cấu hình Firewall</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Script PowerShell mở sẵn cổng TCP 3000 và cấp quyền quét mạng nội bộ (Live TCP/DNS/SNMP/SSH Probe).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Server className="w-4 h-4" />
                    <span>Đóng gói .EXE / Windows Service</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Tạo Shortcut trực tiếp ngoài Desktop hoặc đóng gói thành file `.exe` độc lập chỉ với 1 dòng lệnh.
                  </p>
                </div>
              </div>

              {/* File 1: Start-OmniNet-Windows.bat */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <span className="text-xs font-mono font-bold">
                      deploy/windows/Start-OmniNet-Windows.bat
                    </span>
                    <span className="text-xs text-slate-500">
                      (Nhấp đúp để chạy ngay trên Windows)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('win-bat', WINDOWS_BAT_CONTENT)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {copiedId === 'win-bat' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile('Start-OmniNet-Windows.bat', WINDOWS_BAT_CONTENT)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file .BAT</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 bg-slate-950 text-sky-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {WINDOWS_BAT_CONTENT}
                </pre>
              </div>

              {/* File 2: Build-OmniNet-Windows-Installer.ps1 */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-mono font-bold">
                      deploy/windows/Build-OmniNet-Windows-Installer.ps1
                    </span>
                    <span className="text-xs text-slate-500">
                      (Tạo Shortcut Desktop, mở Firewall & đóng gói .EXE)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('win-ps1', WINDOWS_PS1_CONTENT)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {copiedId === 'win-ps1' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile(
                          'Build-OmniNet-Windows-Installer.ps1',
                          WINDOWS_PS1_CONTENT
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file .PS1</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {WINDOWS_PS1_CONTENT}
                </pre>
              </div>
            </div>
          )}

          {activeEdition === 'docker' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Lệnh khởi chạy nhanh bằng Docker Compose
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Đã cấu hình sẵn quyền <code className="font-mono text-sky-500">NET_RAW</code> và{' '}
                    <code className="font-mono text-sky-500">NET_ADMIN</code> để container quét được thiết bị thật trong mạng LAN/Campus.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-800">
                    docker compose up -d --build
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy('docker-cmd', 'docker compose up -d --build')}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    {copiedId === 'docker-cmd' ? 'Đã chép!' : 'Copy lệnh'}
                  </button>
                </div>
              </div>

              {/* docker-compose.yml */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <span className="text-xs font-mono font-bold">docker-compose.yml</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('docker-compose', DOCKER_COMPOSE_CONTENT)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      {copiedId === 'docker-compose' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile('docker-compose.yml', DOCKER_COMPOSE_CONTENT)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải docker-compose.yml</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 bg-slate-950 text-sky-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {DOCKER_COMPOSE_CONTENT}
                </pre>
              </div>

              {/* Dockerfile */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-mono font-bold">Dockerfile</span>
                    <span className="text-xs text-slate-500">
                      (Multi-stage Node 22 Alpine + Network Probe Tools)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('dockerfile', DOCKERFILE_CONTENT)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      {copiedId === 'dockerfile' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile('Dockerfile', DOCKERFILE_CONTENT)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải Dockerfile</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {DOCKERFILE_CONTENT}
                </pre>
              </div>
            </div>
          )}

          {activeEdition === 'logo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Dark Chassis Showcase */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <OmniNetLogo size={76} variant="icon" />
                  <div>
                    <div className="text-base font-bold text-white tracking-tight">
                      Omni<span className="text-sky-400">Net</span> App Icon
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Hexagonal Multi-Vendor Mesh · Core & Edge Interconnect
                    </p>
                  </div>
                </div>

                {/* Windows Desktop Badge */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="flex items-center gap-3">
                    <OmniNetLogo size={56} variant="icon" />
                    <div className="text-left">
                      <div className="text-base font-bold text-white">
                        Omni<span className="text-sky-400">Net</span>
                      </div>
                      <div className="text-xs font-mono text-sky-300">
                        Windows Desktop & Server
                      </div>
                      <div className="text-[11px] text-slate-400">x64 Native Edition</div>
                    </div>
                  </div>
                </div>

                {/* Docker Container Badge */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="flex items-center gap-3">
                    <OmniNetLogo size={56} variant="icon" />
                    <div className="text-left">
                      <div className="text-base font-bold text-white">
                        omninet<span className="text-emerald-400">/ncm-core</span>
                      </div>
                      <div className="text-xs font-mono text-emerald-300">
                        Docker Official Image
                      </div>
                      <div className="text-[11px] text-slate-400">Alpine Linux · Port 3000</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">Ý nghĩa thiết kế Logo OmniNet</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Khối lục giác (Hexagonal Mesh) tượng trưng cho 6 lớp kiến trúc mạng đa hãng (Core, Distribution, Access, Firewall, Wireless, Cloud), kết nối hội tụ về nhân điều phối AI trung tâm (Autonomous Core) với dải màu Xanh Sky-Blue (Hạ tầng mạng) & Xanh Emerald (Trạng thái Online/An toàn).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile('omninet-logo.svg', OMNINET_SVG_SOURCE, 'image/svg+xml')
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải file Logo gốc (omninet-logo.svg)</span>
                </button>
              </div>
            </div>
          )}

          {activeEdition === 'update' && (
            <div className="space-y-6">
              {backupNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  {backupNotice}
                </div>
              )}

              {/* Backup & Restore Snapshot Box */}
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <h3 className="text-sm font-bold">
                    Sao lưu & Khôi phục Toàn bộ Dữ liệu Hệ thống (Zero-Data-Loss)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Trước khi nâng cấp phiên bản mới hoặc chuyển từ bản Windows sang Docker, bạn có thể xuất toàn bộ danh sách thiết bị, cấu hình Golden Baseline và cơ sở dữ liệu Datasheet CLI ra file <code className="font-mono text-sky-500">.json</code> và nạp lại bất cứ lúc nào.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const snapshot = {
                        exportedAt: new Date().toISOString(),
                        version: 'OmniNet-v3.5',
                        devices: JSON.parse(
                          localStorage.getItem('omninet_enterprise_devices_v3') || '[]'
                        ),
                        datasheets: JSON.parse(
                          localStorage.getItem('omninet_vendor_datasheets_v1') || '[]'
                        ),
                        aiAccounts: JSON.parse(
                          localStorage.getItem('omninet_ai_accounts_v2') || '{}'
                        ),
                      };
                      handleDownloadFile(
                        `omninet-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        JSON.stringify(snapshot, null, 2),
                        'application/json'
                      );
                      setBackupNotice('Đã tải xuống file sao lưu toàn bộ cấu hình & thiết bị OmniNet!');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất Bản Sao Lưu (.JSON)</span>
                  </button>

                  <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Khôi Phục Từ File (.JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          try {
                            const parsed = JSON.parse(String(reader.result || '{}'));
                            if (Array.isArray(parsed.devices) && parsed.devices.length > 0) {
                              localStorage.setItem(
                                'omninet_enterprise_devices_v3',
                                JSON.stringify(parsed.devices)
                              );
                            }
                            if (Array.isArray(parsed.datasheets) && parsed.datasheets.length > 0) {
                              localStorage.setItem(
                                'omninet_vendor_datasheets_v1',
                                JSON.stringify(parsed.datasheets)
                              );
                            }
                            setBackupNotice(
                              'Đã khôi phục dữ liệu thành công! Hãy tải lại trang (F5) để áp dụng.'
                            );
                          } catch {
                            setBackupNotice('File JSON không hợp lệ.');
                          }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Windows Update Script */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-mono font-bold">
                      Update-OmniNet-Windows.bat (Cập nhật 1 chạm trên Windows)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile('Update-OmniNet-Windows.bat', WINDOWS_UPDATE_BAT_CONTENT)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Update-OmniNet-Windows.bat</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {WINDOWS_UPDATE_BAT_CONTENT}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
