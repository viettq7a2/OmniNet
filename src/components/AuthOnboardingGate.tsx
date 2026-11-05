import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  AiAccountProfile,
  AiProviderId,
  OmniNetAuthSession,
} from '../types/network';
import { OmniNetLogo } from './OmniNetLogo';
import { AppLanguage } from '../utils/i18n';

interface AuthOnboardingGateProps {
  isOpen: boolean;
  lang?: AppLanguage;
  onCompleteAuth: (session: OmniNetAuthSession) => void;
  aiAccounts: Record<AiProviderId, AiAccountProfile>;
  activeAiProvider: AiProviderId;
  onSelectAiProvider: (provider: AiProviderId) => void;
  onUpdateAiAccount: (provider: AiProviderId, patch: Partial<AiAccountProfile>) => void;
  onCloseIfAlreadyAuthenticated?: () => void;
  isAlreadyAuthenticated?: boolean;
}

const PROVIDER_CARDS: {
  id: AiProviderId;
  name: string;
  vendor: string;
  ssoLabelVi: string;
  ssoLabelEn: string;
  badgeColor: string;
  models: string[];
}[] = [
  {
    id: 'gemini',
    name: 'Google Gemini NetOps',
    vendor: 'Google Cloud Vertex / AI Studio',
    ssoLabelVi: 'Kết nối Google Workspace SSO',
    ssoLabelEn: 'Connect Google Workspace SSO',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    models: ['gemini-3.8-flash', 'gemini-2.5-pro-netops'],
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT Plus / Enterprise',
    vendor: 'OpenAI Cloud Relay',
    ssoLabelVi: 'Kết nối ChatGPT OAuth SSO',
    ssoLabelEn: 'Connect ChatGPT OAuth SSO',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    models: ['gpt-4o', 'o3-mini-netops'],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude 3.7 Sonnet',
    vendor: 'Anthropic Console SSO',
    ssoLabelVi: 'Kết nối Claude Pro/Team SSO',
    ssoLabelEn: 'Connect Claude Pro/Team SSO',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    models: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1 NetOps Engine',
    vendor: 'DeepSeek Reasoning Relay',
    ssoLabelVi: 'Kết nối DeepSeek Cloud SSO',
    ssoLabelEn: 'Connect DeepSeek Cloud SSO',
    badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    models: ['deepseek-r1-netops', 'deepseek-v3'],
  },
];

export const AuthOnboardingGate: React.FC<AuthOnboardingGateProps> = ({
  isOpen,
  lang = 'vi',
  onCompleteAuth,
  aiAccounts,
  activeAiProvider,
  onSelectAiProvider,
  onUpdateAiAccount,
}) => {
  const isVi = lang === 'vi';
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('admin.netops@omninet.corp');
  const [password, setPassword] = useState('••••••••••••••');
  const [role, setRole] = useState('Principal Network & Security Architect');
  const [totpSecret] = useState('JBSWY3DPEHPK3PXP-OMNINET');
  const [totpCode, setTotpCode] = useState('');
  const [generatedLiveOtp, setGeneratedLiveOtp] = useState('482910');
  const [secondsLeft, setSecondsLeft] = useState(24);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaVerified, setMfaVerified] = useState(true);

  useEffect(() => {
    const computeWindowOtp = () => {
      const epochWindow = Math.floor(Date.now() / 30000);
      const code = String(100000 + ((epochWindow * 7919) % 900000));
      setGeneratedLiveOtp(code);
      setSecondsLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    };
    computeWindowOtp();
    const timer = setInterval(computeWindowOtp, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const handleVerifyStep1Mfa = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = totpCode.replace(/\s+/g, '');
    if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setMfaError(
        isVi
          ? 'Vui lòng nhập mã 6 chữ số từ Google Authenticator (hoặc nhấn Điền nhanh OTP).'
          : 'Please enter the 6-digit code from Google Authenticator (or click Auto-Fill OTP).'
      );
      return;
    }
    setMfaError(null);
    setMfaVerified(true);
    setStep(2);
  };

  const handleSsoSignInProvider = (providerId: AiProviderId) => {
    const current = aiAccounts[providerId];
    onUpdateAiAccount(providerId, {
      connected: true,
      authMethod: 'OAuth-SSO',
      tier: 'Zero-Key Cloud Relay (SSO)',
      lastSync: isVi ? 'Vừa đồng bộ SSO' : 'Synced just now',
      email: current?.email || username,
    });
    onSelectAiProvider(providerId);
  };

  const handleEnterApplication = () => {
    onCompleteAuth({
      isAuthenticated: true,
      username,
      role,
      mfaVerified: true,
      mfaMethod: 'Google Authenticator (TOTP)',
      lastLoginAt: new Date().toLocaleTimeString([], { hour12: false }),
      zeroApiKeyMode: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Clean Top Banner (No X button, no verbose subtitle) */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OmniNetLogo size={34} variant="icon" />
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                {isVi
                  ? 'Bảo Mật 2 Lớp (2FA) & Kết Nối AI SSO (Zero-API-Key)'
                  : 'Two-Factor Authentication (2FA) & Zero-API-Key AI SSO'}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                RFC 6238 TOTP
              </span>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
                step === 1
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isVi ? 'Bước 1: Tài khoản + 2FA' : 'Step 1: Account + 2FA'}</span>
            </button>
            <span className="text-slate-600">→</span>
            <button
              type="button"
              onClick={() => mfaVerified && setStep(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
                step === 2
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isVi ? 'Bước 2: Tài khoản AI (SSO)' : 'Step 2: AI Accounts (SSO)'}</span>
            </button>
          </div>
        </div>

        {/* Step 1: App Account Login + Google Authenticator TOTP MFA */}
        {step === 1 && (
          <form onSubmit={handleVerifyStep1Mfa} className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Credentials */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>
                  {isVi ? '1. Tài khoản Quản trị OmniNet' : '1. OmniNet Administrator Account'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  {isVi ? 'Tài khoản Kỹ sư (NOC / NetOps ID)' : 'Engineer ID (NOC / NetOps)'}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  {isVi
                    ? 'Mật khẩu Quản trị (TACACS+ / RADIUS / Local)'
                    : 'Admin Password (TACACS+ / RADIUS / Local)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  {isVi ? 'Vai trò & Quyền hạn (RBAC)' : 'RBAC Privilege Role'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Principal Network & Security Architect">
                    Principal Network & Security Architect (Full Read/Write CLI)
                  </option>
                  <option value="Senior NOC Operations Engineer">
                    Senior NOC Operations Engineer (L1-L3 Remediation)
                  </option>
                  <option value="SecOps Compliance Auditor">
                    SecOps Compliance Auditor (Read-Only + CIS Audit)
                  </option>
                </select>
              </div>
            </div>

            {/* Right: Google Authenticator TOTP */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Google Authenticator (TOTP)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {isVi ? `Làm mới sau ${secondsLeft}s` : `Refreshes in ${secondsLeft}s`}
                  </span>
                </div>

                {/* Simulated QR & Secret Box */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-white p-2 flex flex-col items-center justify-center shrink-0 text-slate-950">
                    <QrCode className="w-14 h-14 text-slate-900" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold text-white">
                      {isVi
                        ? 'Quét QR bằng Google Authenticator'
                        : 'Scan QR with Google Authenticator'}
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 truncate">
                      {totpSecret}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">
                        {isVi ? 'Mã TOTP hiện tại:' : 'Current Live TOTP:'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 font-mono text-xs font-bold text-emerald-300 tracking-widest">
                        {generatedLiveOtp}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono uppercase text-slate-400">
                      {isVi ? 'Mã 6 số Google Authenticator' : '6-Digit Authenticator Code'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTotpCode(generatedLiveOtp);
                        setMfaError(null);
                      }}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      <span>
                        {isVi
                          ? `Điền nhanh mã OTP (${generatedLiveOtp})`
                          : `Auto-Fill OTP (${generatedLiveOtp})`}
                      </span>
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder={isVi ? 'Nhập 6 chữ số (VD: 482910)' : 'Enter 6-digit code'}
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-center text-base font-mono tracking-[0.4em] text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  {mfaError && <p className="text-xs text-rose-400 mt-1.5">{mfaError}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTotpCode(generatedLiveOtp);
                    setMfaVerified(true);
                    setStep(2);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {isVi ? 'Xác thực nhanh & Sang Bước 2 →' : 'Quick Verify & Next Step →'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Xác nhận MFA & Tiếp tục' : 'Verify MFA & Continue'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 2: Multi-AI Assistant Account Login (Zero-API-Key Mode — Concise header) */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>
                  {isVi
                    ? '2. Tài khoản Trợ lý AI Kỹ sư Mạng (Zero-API-Key SSO)'
                    : '2. AI Network Engineer Accounts (Zero-API-Key SSO)'}
                </span>
              </h2>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Zero-API-Key Cloud Relay: ACTIVE</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {PROVIDER_CARDS.map((card) => {
                const acc = aiAccounts[card.id];
                const isSelected = activeAiProvider === card.id;
                const isConnected = acc?.connected;

                return (
                  <div
                    key={card.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/5'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${card.badgeColor}`}
                        >
                          {card.vendor}
                        </span>
                        {isConnected ? (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isVi ? 'Đã kết nối SSO' : 'SSO Connected'}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500">
                            {isVi ? 'Chưa kết nối' : 'Not Connected'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white">{card.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {isVi ? 'Tài khoản:' : 'Account:'}{' '}
                        <span className="text-slate-200">{acc?.email || username}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">Model:</span>
                        <select
                          value={acc?.selectedModel || card.models[0]}
                          onChange={(e) =>
                            onUpdateAiAccount(card.id, { selectedModel: e.target.value })
                          }
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300"
                        >
                          {card.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleSsoSignInProvider(card.id)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          isConnected
                            ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {isConnected
                            ? isVi
                              ? 'Đặt làm AI Mặc định'
                              : 'Set as Default AI'
                            : isVi
                            ? card.ssoLabelVi
                            : card.ssoLabelEn}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">
                  {isVi
                    ? 'Trạng thái xác thực: Đã kích hoạt MFA & Zero-Key AI'
                    : 'Security Status: MFA & Zero-Key AI Relay Active'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isVi ? 'AI đang chọn:' : 'Active AI:'}{' '}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {aiAccounts[activeAiProvider]?.providerLabel} (
                    {aiAccounts[activeAiProvider]?.selectedModel})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnterApplication}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isVi ? 'Lưu Phiên Bảo Mật' : 'Save Security Session'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
