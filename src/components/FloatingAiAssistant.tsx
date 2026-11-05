import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  KeyRound,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Terminal,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AiProviderId,
  DeviceStatus,
  NetworkAlert,
  NetworkDevice,
} from '../types/network';
import { diagnoseDeviceConnection } from '../utils/connectionDiagnostics';
import { AppLanguage } from '../utils/i18n';

interface AiProviderConfig {
  id: AiProviderId;
  name: string;
  shortLabel: string;
  vendorLabel: string;
  models: string[];
  selectedModel: string;
  loggedIn: boolean;
  accountEmail: string;
  workspaceName: string;
  authType: string;
}

interface FloatingAiAssistantProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  activeTabLabel: string;
  lang?: AppLanguage;
  externalPromptRequest: {
    id: string;
    prompt: string;
    deviceId?: string;
  } | null;
  onClearExternalPrompt: () => void;
  onAutoFixDeviceConnection: (deviceId: string, remediationCli: string) => void;
  onInspectDevice: (device: NetworkDevice) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  providerLabel: string;
  modelName: string;
  content: string;
  targetDeviceId?: string;
  targetHostname?: string;
  remediationCli?: string;
  fixed?: boolean;
}

const STORAGE_KEY_AI_PROVIDERS = 'omninet_ai_providers_v2';

const DEFAULT_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortLabel: 'Gemini',
    vendorLabel: 'Google AI',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'],
    selectedModel: 'gemini-3.8-flash',
    loggedIn: true,
    accountEmail: 'netops-lead@enterprise.vn',
    workspaceName: 'Enterprise NetOps Cloud',
    authType: 'Google Workspace SSO',
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    shortLabel: 'ChatGPT',
    vendorLabel: 'OpenAI',
    models: ['gpt-4o', 'o3-mini-high', 'gpt-4.5-preview'],
    selectedModel: 'gpt-4o',
    loggedIn: true,
    accountEmail: 'noc-architect@enterprise.vn',
    workspaceName: 'OpenAI Enterprise',
    authType: 'OpenAI Team SSO',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortLabel: 'Claude',
    vendorLabel: 'Anthropic',
    models: ['claude-3.7-sonnet', 'claude-3.5-sonnet', 'claude-3.5-haiku'],
    selectedModel: 'claude-3.7-sonnet',
    loggedIn: false,
    accountEmail: 'secops@enterprise.vn',
    workspaceName: 'Anthropic Console',
    authType: 'Anthropic WorkOS SSO',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek R1',
    shortLabel: 'DeepSeek',
    vendorLabel: 'DeepSeek',
    models: ['deepseek-r1-671b', 'deepseek-v3'],
    selectedModel: 'deepseek-r1-671b',
    loggedIn: false,
    accountEmail: 'infra-ai@enterprise.vn',
    workspaceName: 'DeepSeek Private Cluster',
    authType: 'Enterprise Token SSO',
  },
];

export const FloatingAiAssistant: React.FC<FloatingAiAssistantProps> = ({
  devices,
  alerts,
  activeTabLabel,
  lang = 'vi',
  externalPromptRequest,
  onClearExternalPrompt,
  onAutoFixDeviceConnection,
  onInspectDevice,
}) => {
  const isVi = lang === 'vi';
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  const [providers, setProviders] = useState<AiProviderConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AI_PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return DEFAULT_PROVIDERS.map((def) => {
            const match = parsed.find((p: Partial<AiProviderConfig>) => p?.id === def.id);
            if (!match) return def;
            return {
              ...def,
              ...match,
              name: match.name || def.name,
              shortLabel: match.shortLabel || def.shortLabel,
              vendorLabel: match.vendorLabel || def.vendorLabel,
              models:
                Array.isArray(match.models) && match.models.length > 0
                  ? match.models
                  : def.models,
              selectedModel: match.selectedModel || def.selectedModel,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROVIDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AI_PROVIDERS, JSON.stringify(providers));
    } catch {
      // ignore
    }
  }, [providers]);

  const [activeProviderId, setActiveProviderId] = useState<AiProviderId>('gemini');
  const activeProvider = useMemo(() => {
    const found = providers.find((p) => p.id === activeProviderId) || providers[0] || DEFAULT_PROVIDERS[0];
    const def = DEFAULT_PROVIDERS.find((d) => d.id === found.id) || DEFAULT_PROVIDERS[0];
    return {
      ...def,
      ...found,
      name: found.name || def.name,
      shortLabel: found.shortLabel || def.shortLabel,
    };
  }, [providers, activeProviderId]);

  // Account login form states
  const [loginTargetId, setLoginTargetId] = useState<AiProviderId>('gemini');
  const [emailInput, setEmailInput] = useState('netops-lead@enterprise.vn');
  const [workspaceInput, setWorkspaceInput] = useState('Enterprise NOC');

  const faultyDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.status === DeviceStatus.Offline ||
          d.status === DeviceStatus.Warning ||
          (d.services || []).some((s) => s.status !== 'running')
      ),
    [devices]
  );

  const getWelcomeText = (vi: boolean) =>
    vi
      ? 'Xin chào! Chọn nhanh thiết bị lỗi bên trên hoặc nhập câu hỏi kỹ thuật (CLI, BGP, OSPF, VLAN, ACL).'
      : 'Ready! Click a faulty node above for instant RCA & CLI fix, or ask any network engineering question.';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      role: 'assistant',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      providerLabel: 'Google Gemini',
      modelName: 'gemini-3.8-flash',
      content: getWelcomeText(lang === 'vi'),
    },
  ]);

  // Keep welcome message language synced when user switches VI / EN
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'welcome-msg' ? { ...m, content: getWelcomeText(isVi) } : m
      )
    );
  }, [isVi]);

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleDiagnoseDeviceInChat = async (device: NetworkDevice, customQuestion?: string) => {
    const diag = diagnoseDeviceConnection(device, devices);
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      timestamp: nowTime,
      providerLabel: activeProvider.name,
      modelName: activeProvider.selectedModel,
      content:
        customQuestion ||
        (isVi
          ? `Chẩn đoán nhanh & tạo CLI fix cho ${device.hostname} (${device.ip})`
          : `Diagnose & generate remediation CLI for ${device.hostname} (${device.ip})`),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          selectedDevice: device,
          fleetCount: devices.length,
          openAlertCount: alerts.filter((a) => !a.acknowledged).length,
          providerName: activeProvider.name,
          modelName: activeProvider.selectedModel,
          reasoningMode: 'deep-rca',
        }),
      });
      await response.json();
    } catch {
      // deterministic local synthesis below
    }

    const formattedReply = isVi
      ? [
          `[${diag.errorCode}] ${device.hostname} (${device.ip} · ${device.vendor})`,
          `• Nguyên nhân: ${diag.failureReasonVi}`,
          `• Giao thức: ${diag.protocolSummary}`,
          `• Xử lý nhanh: ${diag.fixStepsVi.slice(0, 2).join(' → ')}`,
        ].join('\n')
      : [
          `[${diag.errorCode}] ${device.hostname} (${device.ip} · ${device.vendor})`,
          `• Root Cause: ${
            device.status === DeviceStatus.Offline
              ? `Unreachable via ${device.mgmtProtocol || 'SSHv2'} (${device.packetLossPct}% packet loss / interface down).`
              : `Performance degradation or stopped service daemon detected (${device.cpuLoad}% CPU).`
          }`,
          `• Protocol: ${diag.protocolSummary}`,
          `• Action: Push automated CLI remediation below to restore connectivity.`,
        ].join('\n');

    const aiReply: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      providerLabel: activeProvider.name,
      modelName: activeProvider.selectedModel,
      content: formattedReply,
      targetDeviceId: device.id,
      targetHostname: device.hostname,
      remediationCli: diag.remediationCli,
      fixed: false,
    };

    setMessages((prev) => [...prev, aiReply]);
    setIsSending(false);
  };

  // Listen for external prompt requests from DeviceDetailDrawer or other views
  useEffect(() => {
    if (!externalPromptRequest) return;
    setIsOpen(true);
    const targetDev = externalPromptRequest.deviceId
      ? devices.find((d) => d.id === externalPromptRequest.deviceId)
      : undefined;

    if (targetDev) {
      handleDiagnoseDeviceInChat(targetDev, externalPromptRequest.prompt);
    } else {
      handleSendTextPrompt(externalPromptRequest.prompt);
    }
    onClearExternalPrompt();
  }, [externalPromptRequest]);

  const handleSendTextPrompt = async (overrideText?: string) => {
    const promptText = (overrideText ?? inputValue).trim();
    if (!promptText) return;

    const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      timestamp: nowTime,
      providerLabel: activeProvider.name,
      modelName: activeProvider.selectedModel,
      content: promptText,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInputValue('');
    setIsSending(true);

    const lower = promptText.toLowerCase();
    const matchedDev =
      devices.find(
        (d) =>
          lower.includes(d.hostname.toLowerCase()) ||
          lower.includes(d.hostname.split('.')[0].toLowerCase()) ||
          lower.includes(d.ip)
      ) ||
      (lower.includes('offline') ||
      lower.includes('không kết nối') ||
      lower.includes('lỗi') ||
      lower.includes('down') ||
      lower.includes('fix')
        ? faultyDevices[0]
        : undefined);

    if (matchedDev) {
      await handleDiagnoseDeviceInChat(matchedDev, promptText);
      return;
    }

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          selectedDevice: faultyDevices[0] || devices[0],
          fleetCount: devices.length,
          openAlertCount: alerts.filter((a) => !a.acknowledged).length,
          providerName: activeProvider.name,
          modelName: activeProvider.selectedModel,
          reasoningMode: 'deep-rca',
        }),
      });
      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `a-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        providerLabel: activeProvider.name,
        modelName: activeProvider.selectedModel,
        content:
          data.reply ||
          (isVi
            ? `Đã phân tích xong trên ${devices.length} thiết bị.`
            : `Completed analysis across ${devices.length} managed nodes.`),
        remediationCli: data.suggestedCli,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackDev = faultyDevices[0] || devices[0];
      const diag = diagnoseDeviceConnection(fallbackDev, devices);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          providerLabel: activeProvider.name,
          modelName: activeProvider.selectedModel,
          content: isVi
            ? `[${fallbackDev.hostname}] ${diag.failureReasonVi}`
            : `[${fallbackDev.hostname}] ${fallbackDev.vendor} (${fallbackDev.ip}) requires ${diag.protocolSummary} remediation.`,
          targetDeviceId: fallbackDev.id,
          targetHostname: fallbackDev.hostname,
          remediationCli: diag.remediationCli,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectProvider = (id: AiProviderId) => {
    const target = providers.find((p) => p.id === id);
    if (!target) return;
    if (!target.loggedIn) {
      setLoginTargetId(id);
      setEmailInput(target.accountEmail);
      setWorkspaceInput(target.workspaceName);
      setShowAccountPanel(true);
      return;
    }
    setActiveProviderId(id);
  };

  const handleSaveProviderLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setProviders((prev) =>
      prev.map((p) =>
        p.id === loginTargetId
          ? {
              ...p,
              loggedIn: true,
              accountEmail: emailInput.trim() || p.accountEmail,
              workspaceName: workspaceInput.trim() || p.workspaceName,
            }
          : p
      )
    );
    setActiveProviderId(loginTargetId);
    setShowAccountPanel(false);
  };

  const handleLogoutProvider = (id: AiProviderId) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, loggedIn: false } : p))
    );
    if (activeProviderId === id) {
      const fallback = providers.find((p) => p.id !== id && p.loggedIn) || providers[0];
      setActiveProviderId(fallback.id);
    }
  };

  return (
    <>
      {/* Compact Circular Floating Trigger Button (Bottom-Right) */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-label="AI Network Engineer Assistant"
          title={
            isVi
              ? `Trợ lý AI (${activeProvider.shortLabel}) · ${faultyDevices.length} cảnh báo`
              : `AI Assistant (${activeProvider.shortLabel}) · ${faultyDevices.length} alerts`
          }
          className="group relative w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 hover:from-sky-400 hover:to-indigo-600 text-white shadow-xl shadow-blue-950/50 border border-sky-300/40 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {isOpen ? (
            <X className="w-5 h-5 transition-transform duration-200" />
          ) : (
            <Bot className="w-5 h-5 transition-transform duration-200 group-hover:rotate-6" />
          )}

          {!isOpen && faultyDevices.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm">
              {faultyDevices.length}
            </span>
          )}

          {!isOpen && faultyDevices.length === 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-950" />
          )}
        </button>
      </div>

      {/* Floating Chatbox Window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 right-5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${
            isExpanded
              ? 'w-[92vw] sm:w-[600px] h-[76vh]'
              : 'w-[92vw] sm:w-[400px] h-[510px]'
          }`}
        >
          {/* Compact Top Header */}
          <div className="px-3.5 py-2.5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">
                    {isVi ? 'Trợ lý AI' : 'AI Copilot'} · {activeProvider.shortLabel}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {activeTabLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLoginTargetId(activeProvider.id);
                  setEmailInput(activeProvider.accountEmail);
                  setWorkspaceInput(activeProvider.workspaceName);
                  setShowAccountPanel((s) => !s);
                }}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 flex items-center gap-1 transition-colors"
                title={isVi ? 'Quản lý tài khoản SSO AI' : 'Manage AI SSO Account'}
              >
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>SSO</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((e) => !e)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                title={isExpanded ? (isVi ? 'Thu nhỏ' : 'Compact') : isVi ? 'Mở rộng' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                title={isVi ? 'Đóng' : 'Close'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Clean 1-Row Provider + Model Dropdown Bar (Zero Horizontal Scrollbar) */}
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
            <select
              value={activeProvider.id}
              onChange={(e) => handleSelectProvider(e.target.value as AiProviderId)}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortLabel || p.name} {p.loggedIn ? '●' : isVi ? '(Đăng nhập)' : '(Sign in)'}
                </option>
              ))}
            </select>

            <select
              value={activeProvider.selectedModel}
              onChange={(e) => {
                const nextModel = e.target.value;
                setProviders((prev) =>
                  prev.map((p) =>
                    p.id === activeProvider.id ? { ...p, selectedModel: nextModel } : p
                  )
                );
              }}
              className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 focus:outline-none focus:border-blue-500"
            >
              {activeProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Multi-AI Account Login Drawer (When Toggled) */}
          {showAccountPanel && (
            <form
              onSubmit={handleSaveProviderLogin}
              className="p-3 bg-blue-50/90 dark:bg-slate-950 border-b border-blue-200 dark:border-slate-800 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {isVi ? 'Kết nối SSO:' : 'SSO Sign-In:'}{' '}
                    {providers.find((p) => p.id === loginTargetId)?.name || 'Google Gemini'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAccountPanel(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setLoginTargetId(p.id);
                      setEmailInput(p.accountEmail);
                      setWorkspaceInput(p.workspaceName);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-between gap-1 transition-colors ${
                      loginTargetId === p.id
                        ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <span className="truncate">{p.shortLabel || p.name}</span>
                    {p.loggedIn && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email SSO"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                />
                <input
                  type="text"
                  required
                  value={workspaceInput}
                  onChange={(e) => setWorkspaceInput(e.target.value)}
                  placeholder="Workspace"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-[11px]"
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                {providers.find((p) => p.id === loginTargetId)?.loggedIn ? (
                  <button
                    type="button"
                    onClick={() => handleLogoutProvider(loginTargetId)}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>{isVi ? 'Đăng xuất' : 'Sign out'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    {isVi ? 'Chưa kết nối' : 'Disconnected'}
                  </span>
                )}

                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                >
                  <LogIn className="w-3 h-3" />
                  <span>{isVi ? 'Lưu & Kích hoạt' : 'Save & Activate'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Clean Grid Faulty Nodes Quick-RCA Bar (No Horizontal Scrollbar) */}
          {faultyDevices.length > 0 && (
            <div className="px-3 py-2 bg-rose-50/70 dark:bg-rose-950/25 border-b border-rose-200/70 dark:border-rose-900/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>
                    {isVi
                      ? `Chẩn đoán nhanh (${faultyDevices.length} thiết bị lỗi)`
                      : `Quick RCA (${faultyDevices.length} faulty nodes)`}
                  </span>
                </span>
                <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                  {isVi ? 'Nhấn để tạo CLI sửa lỗi' : 'Click for instant CLI fix'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {faultyDevices.slice(0, 6).map((dev) => {
                  const isOffline = dev.status === DeviceStatus.Offline;
                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => handleDiagnoseDeviceInChat(dev)}
                      className="group/chip flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-[11px] font-mono bg-white dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-800/70 text-slate-800 dark:text-slate-200 hover:border-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-2xs min-w-0"
                      title={
                        isVi
                          ? `Chẩn đoán & sửa lỗi ${dev.hostname} (${dev.ip})`
                          : `Diagnose & fix ${dev.hostname} (${dev.ip})`
                      }
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isOffline
                              ? 'bg-rose-500 group-hover/chip:bg-white'
                              : 'bg-amber-500 group-hover/chip:bg-white'
                          }`}
                        />
                        <span className="truncate">{dev.hostname.split('.')[0]}</span>
                      </span>
                      <Wrench className="w-2.5 h-2.5 shrink-0 opacity-60 group-hover/chip:opacity-100" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Message Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50 dark:bg-slate-950">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl text-xs space-y-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white ml-8'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-2 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono opacity-75">
                  <span>
                    {msg.role === 'user'
                      ? isVi
                        ? 'Kỹ sư NOC'
                        : 'NOC Engineer'
                      : `${msg.providerLabel} · ${msg.modelName}`}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                {msg.remediationCli && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-blue-500" />
                        <span>CLI ({msg.targetHostname || 'Multi-Vendor'})</span>
                      </span>
                    </div>
                    <pre className="p-2 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      {msg.remediationCli}
                    </pre>

                    {msg.targetDeviceId && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {msg.fixed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {isVi
                                ? `Đã khôi phục ${msg.targetHostname} ONLINE`
                                : `Restored ${msg.targetHostname} ONLINE`}
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!msg.targetDeviceId || !msg.remediationCli) return;
                              onAutoFixDeviceConnection(msg.targetDeviceId, msg.remediationCli);
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.id === msg.id ? { ...m, fixed: true } : m
                                )
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors"
                          >
                            <Zap className="w-3 h-3" />
                            <span>
                              {isVi ? 'Đẩy CLI & Khôi phục ngay' : 'Push CLI & Recover Now'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const dev = devices.find((d) => d.id === msg.targetDeviceId);
                            if (dev) onInspectDevice(dev);
                          }}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]"
                        >
                          {isVi ? 'Chi tiết' : 'Inspect'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>
                  {isVi
                    ? `${activeProvider.shortLabel} đang phân tích...`
                    : `${activeProvider.shortLabel} is analyzing...`}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendTextPrompt();
            }}
            className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isVi
                  ? `Hỏi ${activeProvider.shortLabel} (${activeProvider.selectedModel})...`
                  : `Ask ${activeProvider.shortLabel} (${activeProvider.selectedModel})...`
              }
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
