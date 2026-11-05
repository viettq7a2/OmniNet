import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  KeyRound,
  LogIn,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AiProviderAccount,
  AiProviderId,
  AiReasoningMode,
  CopilotMessage,
  DeviceStatus,
  NetworkAlert,
  NetworkDevice,
} from '../types/network';
import { diagnoseDeviceConnection } from '../utils/connectionDiagnostics';

interface FloatingAiAssistantProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  activeTabLabel: string;
  externalPromptRequest: {
    id: string;
    prompt: string;
    deviceId?: string;
  } | null;
  onClearExternalPrompt: () => void;
  onAutoFixDeviceConnection: (deviceId: string, remediationCli: string) => void;
  onInspectDevice: (device: NetworkDevice) => void;
}

const STORAGE_KEY_AI_PROVIDERS = 'omninet_ai_providers_v1';

const DEFAULT_AI_PROVIDERS: AiProviderAccount[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    vendorLabel: 'Google DeepMind',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'],
    selectedModel: 'gemini-3.8-flash',
    loggedIn: true,
    accountEmail: 'viettq14407@gmail.com',
    workspaceName: 'Google Workspace NOC',
    authType: 'Google Workspace SSO',
    connectedAt: 'Active Session',
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    vendorLabel: 'OpenAI',
    models: ['gpt-4o', 'o3-mini-high', 'gpt-4.5-preview'],
    selectedModel: 'gpt-4o',
    loggedIn: false,
    accountEmail: 'netops@omninet.corp',
    workspaceName: 'ChatGPT Enterprise',
    authType: 'OpenAI OAuth SSO',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    vendorLabel: 'Anthropic',
    models: ['claude-3.7-sonnet', 'claude-3.5-sonnet', 'claude-3.5-haiku'],
    selectedModel: 'claude-3.7-sonnet',
    loggedIn: false,
    accountEmail: 'architect@omninet.corp',
    workspaceName: 'Claude Enterprise',
    authType: 'Anthropic Console SSO',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek NetOps',
    vendorLabel: 'DeepSeek / On-Prem',
    models: ['deepseek-r1-netops', 'deepseek-v3-noc', 'llama-3.3-70b-netops'],
    selectedModel: 'deepseek-r1-netops',
    loggedIn: false,
    accountEmail: 'secops@omninet.corp',
    workspaceName: 'On-Premises NOC Gateway',
    authType: 'Enterprise Gateway SSO',
  },
];

export const FloatingAiAssistant: React.FC<FloatingAiAssistantProps> = ({
  devices,
  alerts,
  activeTabLabel,
  externalPromptRequest,
  onClearExternalPrompt,
  onAutoFixDeviceConnection,
  onInspectDevice,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAuthPanel, setShowAuthPanel] = useState<boolean>(false);

  const [aiProviders, setAiProviders] = useState<AiProviderAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AI_PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_AI_PROVIDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AI_PROVIDERS, JSON.stringify(aiProviders));
    } catch {
      // Ignore storage error
    }
  }, [aiProviders]);

  const [activeProviderId, setActiveProviderId] = useState<AiProviderId>('gemini');
  const [reasoningMode, setReasoningMode] = useState<AiReasoningMode>('deep-rca');

  const [loginTargetId, setLoginTargetId] = useState<AiProviderId>('chatgpt');
  const [loginEmail, setLoginEmail] = useState<string>('viettq14407@gmail.com');
  const [loginWorkspace, setLoginWorkspace] = useState<string>('OmniNet NOC');
  const [loginModel, setLoginModel] = useState<string>('gpt-4o');

  const activeProvider =
    aiProviders.find((p) => p.id === activeProviderId) || aiProviders[0];
  const loginTarget =
    aiProviders.find((p) => p.id === loginTargetId) || aiProviders[0];

  const [input, setInput] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'float-welcome',
      role: 'assistant',
      providerId: 'gemini',
      providerLabel: 'Google Gemini',
      modelName: 'gemini-3.8-flash',
      content:
        'Xin chào! Tôi là Trợ lý Kỹ sư AI của OmniNet luôn đồng hành ở mọi tab. Bạn có thể hỏi tôi lý do tại sao không kết nối được tới bất kỳ thiết bị nào, yêu cầu hướng dẫn fix lỗi, hoặc chuyển đổi giữa Gemini, ChatGPT, Claude và DeepSeek ngay tại đây.',
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Listen for external requests (e.g., "Ask AI Why Connection Failed" from Drawer/Dashboard/Discovery)
  useEffect(() => {
    if (externalPromptRequest) {
      setIsOpen(true);
      setShowAuthPanel(false);
      handleSendMessage(externalPromptRequest.prompt, externalPromptRequest.deviceId);
      onClearExternalPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPromptRequest]);

  const unreachableDevices = devices.filter(
    (d) =>
      d.status === DeviceStatus.Offline ||
      d.status === DeviceStatus.Warning ||
      (d.services || []).some((s) => s.status !== 'running')
  );

  const handleSelectProvider = (providerId: AiProviderId) => {
    const target = aiProviders.find((p) => p.id === providerId);
    if (!target) return;
    if (!target.loggedIn) {
      setLoginTargetId(target.id);
      setLoginEmail(target.accountEmail);
      setLoginWorkspace(target.workspaceName);
      setLoginModel(target.selectedModel);
      setShowAuthPanel(true);
      return;
    }
    setActiveProviderId(providerId);
  };

  const handleConfirmLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const nowStr = new Date().toLocaleTimeString([], { hour12: false });
    setAiProviders((prev) =>
      prev.map((p) =>
        p.id === loginTargetId
          ? {
              ...p,
              loggedIn: true,
              accountEmail: loginEmail.trim() || p.accountEmail,
              workspaceName: loginWorkspace.trim() || p.workspaceName,
              selectedModel: loginModel || p.selectedModel,
              connectedAt: nowStr,
            }
          : p
      )
    );
    setActiveProviderId(loginTargetId);
    setShowAuthPanel(false);
  };

  const handleLogoutProvider = (providerId: AiProviderId) => {
    setAiProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, loggedIn: false } : p))
    );
    if (activeProviderId === providerId) {
      const nextActive = aiProviders.find((p) => p.id !== providerId && p.loggedIn);
      if (nextActive) setActiveProviderId(nextActive.id);
    }
  };

  const handleQuickConnectionDiagnose = (dev: NetworkDevice) => {
    const diag = diagnoseDeviceConnection(dev, devices);
    const userMsg: CopilotMessage = {
      id: `u-diag-${Date.now()}`,
      role: 'user',
      content: `Kiểm tra nguyên nhân không kết nối được tới ${dev.hostname} (${dev.ip}) và hướng dẫn cách fix.`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    };

    const assistantReply = [
      `[${activeProvider.name} · ${activeProvider.selectedModel}] Phân tích lỗi kết nối tới ${dev.hostname} (${dev.ip} · ${dev.vendor}):`,
      `• Trạng thái: ${diag.connectionStateLabel} (${diag.errorCode})`,
      `• Tại sao kết nối thất bại: ${diag.failureReasonVi}`,
      `• Bằng chứng kỹ thuật:\n  - ${diag.technicalEvidence.join('\n  - ')}`,
      `• Hướng dẫn cách Fix:\n  - ${diag.fixStepsVi.join('\n  - ')}`,
    ].join('\n\n');

    const aiMsg: CopilotMessage = {
      id: `ai-diag-${Date.now()}`,
      role: 'assistant',
      providerId: activeProvider.id,
      providerLabel: activeProvider.name,
      modelName: activeProvider.selectedModel,
      content: assistantReply,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      suggestedCli: diag.remediationCli,
      targetDeviceId: dev.id,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
  };

  const handleSendMessage = async (customQuery?: string, focusDeviceId?: string) => {
    const query = (customQuery ?? input).trim();
    if (!query || isBusy) return;

    if (!activeProvider.loggedIn) {
      setLoginTargetId(activeProvider.id);
      setShowAuthPanel(true);
      return;
    }

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setInput('');
    setIsBusy(true);

    try {
      const connectionFailures = unreachableDevices.map((d) => {
        const diag = diagnoseDeviceConnection(d, devices);
        return {
          deviceId: d.id,
          hostname: d.hostname,
          ip: d.ip,
          vendor: d.vendor,
          status: d.status,
          errorCode: diag.errorCode,
          whyFailed: diag.failureReasonVi,
          howToFix: diag.fixStepsVi,
          remediationCli: diag.remediationCli,
        };
      });

      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          providerId: activeProvider.id,
          modelName: activeProvider.selectedModel,
          reasoningMode,
          accountEmail: activeProvider.accountEmail,
          networkContext: {
            currentTab: activeTabLabel,
            focusDeviceId,
            connectionFailures,
            devices: devices.map((d) => ({
              id: d.id,
              hostname: d.hostname,
              ip: d.ip,
              vendor: d.vendor,
              role: d.role,
              status: d.status,
              cpuLoad: d.cpuLoad,
              latencyMs: d.latencyMs,
              drifted: d.runningConfig.trim() !== d.goldenBaselineConfig.trim(),
            })),
            activeAlerts: alerts.filter((a) => !a.acknowledged),
          },
        }),
      });

      const data = await res.json();
      const targetDevId =
        focusDeviceId ||
        data.targetDeviceId ||
        unreachableDevices[0]?.id;

      const aiMsg: CopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        providerId: activeProvider.id,
        providerLabel: activeProvider.name,
        modelName: activeProvider.selectedModel,
        content: data.reply || 'Đã hoàn tất phân tích.',
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        suggestedCli: data.suggestedCli || undefined,
        targetDeviceId: targetDevId,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          providerId: activeProvider.id,
          providerLabel: activeProvider.name,
          modelName: activeProvider.selectedModel,
          content: 'Không thể kết nối tới dịch vụ AI Copilot. Vui lòng thử lại.',
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Chat Box Window */}
      {isOpen && (
        <div
          className={`mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${
            isExpanded
              ? 'w-[92vw] sm:w-[640px] h-[78vh] max-h-[720px]'
              : 'w-[92vw] sm:w-[430px] h-[560px] max-h-[80vh]'
          }`}
        >
          {/* Chatbox Top Header */}
          <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">
                    Trợ lý Kỹ sư AI · {activeProvider.name}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {activeProvider.selectedModel} · Tab: {activeTabLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowAuthPanel((s) => !s)}
                title="Đăng nhập / Đổi AI (Gemini, ChatGPT, Claude, DeepSeek)"
                className={`px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                  showAuthPanel
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <KeyRound className="w-3 h-3" />
                <span>Đổi AI</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded((e) => !e)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
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
                title="Thu nhỏ xuống góc"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick AI Provider Switcher Bar */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1 overflow-x-auto">
              {aiProviders.map((prov) => {
                const isActive = prov.id === activeProviderId;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleSelectProvider(prov.id)}
                    className={`px-2 py-1 rounded-md font-medium whitespace-nowrap inline-flex items-center gap-1 transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        prov.loggedIn ? 'bg-emerald-400' : 'bg-slate-400'
                      }`}
                    />
                    <span>
                      {prov.name
                        .replace('Google ', '')
                        .replace('OpenAI ', '')
                        .replace('Anthropic ', '')
                        .replace(' NetOps', '')}
                    </span>
                  </button>
                );
              })}
            </div>

            <select
              value={activeProvider.selectedModel}
              onChange={(e) => {
                const nextModel = e.target.value;
                setAiProviders((prev) =>
                  prev.map((p) =>
                    p.id === activeProviderId ? { ...p, selectedModel: nextModel } : p
                  )
                );
              }}
              className="px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-blue-600 dark:text-blue-400 max-w-[130px]"
            >
              {activeProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Inline AI SSO Login / Account Switcher Drawer (when toggled) */}
          {showAuthPanel ? (
            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                  Đăng nhập Tài khoản AI (Gemini · ChatGPT · Claude · DeepSeek)
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAuthPanel(false)}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Quay lại Chat
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {aiProviders.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setLoginTargetId(p.id);
                      setLoginEmail(p.accountEmail);
                      setLoginWorkspace(p.workspaceName);
                      setLoginModel(p.selectedModel);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      p.id === loginTargetId
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                      <span>{p.name}</span>
                      {p.loggedIn && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {p.loggedIn ? p.accountEmail : 'Chưa đăng nhập'}
                    </div>
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleConfirmLogin}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Cấu hình Phiên {loginTarget.name} ({loginTarget.authType})
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 dark:text-slate-400">
                    Email Tài khoản Kỹ sư
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 dark:text-slate-400">
                    Workspace / Tổ chức
                  </label>
                  <input
                    type="text"
                    required
                    value={loginWorkspace}
                    onChange={(e) => setLoginWorkspace(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 dark:text-slate-400">
                    Phiên bản Model
                  </label>
                  <select
                    value={loginModel}
                    onChange={(e) => setLoginModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  >
                    {loginTarget.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {loginTarget.loggedIn ? (
                    <button
                      type="button"
                      onClick={() => handleLogoutProvider(loginTarget.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>
                      {loginTarget.loggedIn
                        ? `Lưu & Dùng ${loginTarget.name}`
                        : `Đăng nhập ${loginTarget.name}`}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Quick Unreachable Device Connection Troubleshooter Strip */}
              {unreachableDevices.length > 0 && (
                <div className="px-3 py-2 bg-rose-50/90 dark:bg-rose-950/30 border-b border-rose-200/80 dark:border-rose-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Phát hiện {unreachableDevices.length} thiết bị lỗi kết nối / dịch vụ dừng:
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unreachableDevices.map((dev) => (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => handleQuickConnectionDiagnose(dev)}
                        className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-[11px] font-mono text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors inline-flex items-center gap-1"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Tại sao {dev.hostname.split('.')[0]} lỗi kết nối & cách fix?</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Messages Scroll Container */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/70 dark:bg-slate-950/60">
                {messages.map((msg) => {
                  const targetDev = msg.targetDeviceId
                    ? devices.find((d) => d.id === msg.targetDeviceId)
                    : undefined;

                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-xs space-y-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white ml-8'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-4 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
                        <span>
                          {msg.role === 'user'
                            ? `Kỹ sư (${activeProvider.accountEmail})`
                            : `${msg.providerLabel || activeProvider.name} · ${
                                msg.modelName || activeProvider.selectedModel
                              }`}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                      {msg.suggestedCli && (
                        <div className="space-y-2 pt-1">
                          <pre className="p-2.5 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                            {msg.suggestedCli}
                          </pre>

                          {targetDev && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onAutoFixDeviceConnection(targetDev.id, msg.suggestedCli!);
                                  setMessages((prev) => [
                                    ...prev,
                                    {
                                      id: `fixed-${Date.now()}`,
                                      role: 'assistant',
                                      providerId: activeProvider.id,
                                      providerLabel: activeProvider.name,
                                      modelName: activeProvider.selectedModel,
                                      content: `Đã tự động chạy kịch bản khắc phục CLI, mở lại cổng uplink/dịch vụ và khôi phục kết nối thành công tới ${targetDev.hostname} (${targetDev.ip})!`,
                                      timestamp: new Date().toLocaleTimeString([], {
                                        hour12: false,
                                      }),
                                    },
                                  ]);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors"
                              >
                                <Zap className="w-3 h-3" />
                                <span>
                                  Tự động Fix & Kết nối lại {targetDev.hostname.split('.')[0]}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onInspectDevice(targetDev)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]"
                              >
                                Xem thiết bị
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Chat với ${activeProvider.name} (${activeProvider.selectedModel})...`}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={isBusy || !input.trim()}
                  className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Always-Visible Floating Chat Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg border border-blue-500 transition-transform active:scale-95"
      >
        <div className="relative flex items-center justify-center">
          {isOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          {!isOpen && unreachableDevices.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-blue-600" />
          )}
        </div>
        <div className="text-left leading-tight">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <span>Trợ lý AI ({activeProvider.name.replace('Google ', '').replace('OpenAI ', '').replace('Anthropic ', '')})</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </div>
          <div className="text-[10px] font-mono text-blue-100">
            {unreachableDevices.length > 0
              ? `${unreachableDevices.length} lỗi kết nối cần fix`
              : activeProvider.selectedModel}
          </div>
        </div>
      </button>
    </div>
  );
};
