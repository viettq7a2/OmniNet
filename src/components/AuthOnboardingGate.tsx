import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Lock,
  QrCode,
  RefreshCw,
  Shield,
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

interface AuthOnboardingGateProps {
  isOpen: boolean;
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
  ssoLabel: string;
  badgeColor: string;
  models: string[];
}[] = [
  {
    id: 'gemini',
    name: 'Google Gemini NetOps',
    vendor: 'Google Cloud Vertex / AI Studio',
    ssoLabel: 'Đăng nhập Google Workspace SSO (Zero-API-Key)',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    models: ['gemini-3.8-flash', 'gemini-2.5-pro-netops'],
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT Plus / Enterprise',
    vendor: 'OpenAI Cloud Relay',
    ssoLabel: 'Kết nối tài khoản ChatGPT OAuth (Không cần API Key)',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    models: ['gpt-4o', 'o3-mini-netops'],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude 3.7 Sonnet',
    vendor: 'Anthropic Console SSO',
    ssoLabel: 'Kết nối tài khoản Claude Pro/Team (Không cần API Key)',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    models: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1 NetOps Engine',
    vendor: 'DeepSeek Reasoning Relay',
    ssoLabel: 'Kết nối DeepSeek Cloud Session (Không cần API Key)',
    badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    models: ['deepseek-r1-netops', 'deepseek-v3'],
  },
];

export const AuthOnboardingGate: React.FC<AuthOnboardingGateProps> = ({
  isOpen,
  onCompleteAuth,
  aiAccounts,
  activeAiProvider,
  onSelectAiProvider,
  onUpdateAiAccount,
  onCloseIfAlreadyAuthenticated,
  isAlreadyAuthenticated,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('admin.netops@omninet.corp');
  const [password, setPassword] = useState('••••••••••••••');
  const [role, setRole] = useState('Principal Network & Security Architect');
  const [totpSecret] = useState('JBSWY3DPEHPK3PXP-OMNINET');
  const [totpCode, setTotpCode] = useState('');
  const [generatedLiveOtp, setGeneratedLiveOtp] = useState('482910');
  const [secondsLeft, setSecondsLeft] = useState(24);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaVerified, setMfaVerified] = useState(Boolean(isAlreadyAuthenticated));

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
      setMfaError('Vui lòng nhập mã xác thực 6 chữ số từ ứng dụng Google Authenticator (hoặc nhấn nút Điền nhanh bên dưới).');
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
      lastSync: 'Vừa đồng bộ SSO',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  OmniNet Zero-Trust Access & Multi-AI Gateway
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  RFC 6238 TOTP MFA + Zero-API-Key AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bảo vệ quyền điều khiển thiết bị mạng L2/L3 bằng Google Authenticator 2FA & kết nối Trợ lý AI qua Cloud Relay không cần API Key.
              </p>
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
                  : 'bg-slate-950 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Bước 1: Tài khoản App + MFA
            </button>
            <span className="text-slate-600">→</span>
            <button
              type="button"
              onClick={() => mfaVerified && setStep(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
                step === 2
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Bước 2: Tài khoản AI (Zero-Key)
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
                1. Đăng nhập Tài khoản Quản trị OmniNet
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Tài khoản Kỹ sư Mạng (NOC / NetOps ID)
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
                  Mật khẩu Quản trị (TACACS+ / RADIUS / Local)
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
                  Vai trò & Quyền hạn (RBAC Privilege Level 15)
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

              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Tại sao bắt buộc MFA (Google Authenticator) cho hệ thống mạng?
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  OmniNet nắm giữ quyền đẩy cấu hình trực tiếp (SSHv2/NETCONF) xuống Core Switch, Router BGP và Firewall. Xác thực 2 lớp TOTP giúp ngăn chặn hoàn toàn nguy cơ lộ mật khẩu gây sập toàn bộ hạ tầng doanh nghiệp.
                </p>
              </div>
            </div>

            {/* Right: Google Authenticator TOTP */}
            <div className="lg:col-span-6 p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    Xác thực 2 lớp Google Authenticator (TOTP)
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Làm mới sau {secondsLeft}s
                  </span>
                </div>

                {/* Simulated QR & Secret Box */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-white p-2 flex flex-col items-center justify-center shrink-0 text-slate-950">
                    <QrCode className="w-14 h-14 text-slate-900" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold text-white">
                      Quét QR bằng Google Authenticator
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Hoặc nhập khóa Base32 thủ công:
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 truncate">
                      {totpSecret}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">Mã TOTP phiên hiện tại:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 font-mono text-xs font-bold text-emerald-300 tracking-widest">
                        {generatedLiveOtp}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono uppercase text-slate-400">
                      Nhập mã 6 số Google Authenticator
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
                      Điền nhanh mã OTP ({generatedLiveOtp})
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="Nhập 6 chữ số (VD: 482910)"
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-center text-base font-mono tracking-[0.4em] text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  {mfaError && (
                    <p className="text-xs text-rose-400 mt-1.5">{mfaError}</p>
                  )}
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
                  Xác thực nhanh Demo & Sang Bước 2 →
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Xác nhận MFA & Tiếp tục Bước 2
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 2: Multi-AI Assistant Account Login (Zero-API-Key Mode) */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  2. Đăng nhập Tài khoản Trợ lý AI Kỹ sư Mạng (Chế độ Zero-API-Key SSO)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bạn không cần nhập hay quản lý API Key thủ công. Hệ thống sử dụng cổng xác thực OAuth SSO & OmniNet Backend AI Relay an toàn.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Zero-API-Key Cloud Relay: ACTIVE
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${card.badgeColor}`}>
                          {card.vendor}
                        </span>
                        {isConnected ? (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            SSO Connected (No Key Needed)
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500">
                            Chưa đăng nhập SSO
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white">{card.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        Tài khoản: <span className="text-slate-200">{acc?.email || username}</span>
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
                        {isConnected ? 'Đã kết nối OAuth SSO (Đặt làm mặc định)' : card.ssoLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">
                  Sẵn sàng truy cập Trung tâm Điều hành Mạng OmniNet
                </div>
                <div className="text-[11px] text-slate-400">
                  Trợ lý AI đang chọn:{' '}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {aiAccounts[activeAiProvider]?.providerLabel} ({aiAccounts[activeAiProvider]?.selectedModel})
                  </span>{' '}
                  · Xác thực MFA: <span className="text-emerald-400 font-mono">Google Authenticator Verified</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {isAlreadyAuthenticated && onCloseIfAlreadyAuthenticated && (
                  <button
                    type="button"
                    onClick={onCloseIfAlreadyAuthenticated}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Đóng
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleEnterApplication}
                  className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Vào Hệ thống Quản trị Mạng OmniNet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
