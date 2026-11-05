import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Globe,
  KeyRound,
  Layers,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Terminal,
  UserCheck,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AiProviderAccount,
  AiProviderId,
  AiReasoningMode,
  CopilotMessage,
  DeviceRole,
  DeviceStatus,
  NetworkAlert,
  NetworkDevice,
  RcaAnalysisReport,
  VendorName,
} from '../types/network';
import { auditDeviceCompliance } from '../utils/vendorConfigCompiler';

interface LiveProbeResult {
  target: string;
  ip: string;
  hostname: string;
  reachable: boolean;
  avgLatencyMs: number;
  openPorts: number[];
  portChecks: { port: number; service: string; open: boolean; latencyMs: number | null }[];
  banner: string | null;
  inferred: {
    vendor: string;
    role: string;
    model: string;
    osVersion: string;
  };
  probedAt: string;
}

import { AppLanguage } from '../utils/i18n';

interface AiDiagnosticsRcaViewProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  lang?: AppLanguage;
  initialDeviceId?: string | null;
  onSelectDeviceDrawer: (device: NetworkDevice) => void;
  onOpenInConfigHub: (deviceId: string) => void;
  onApplyRemediation: (
    deviceId: string,
    remediationCli: string,
    options: { recoverNode: boolean; syncBaseline: boolean }
  ) => void;
  onAddDiscoveredDevice: (device: NetworkDevice) => void;
}

const STORAGE_KEY_AI_PROVIDERS = 'omninet_ai_providers_v1';

const INITIAL_AI_PROVIDERS: AiProviderAccount[] = [
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
    workspaceName: 'ChatGPT Team / Enterprise',
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
    workspaceName: 'Claude Enterprise Console',
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

const COPILOT_PRESETS_VI = [
  'Phân tích nguyên nhân gốc sự cố mất kết nối trên các nút mạng',
  'Kiểm tra lệch cấu hình (Config Drift) & chuẩn bảo mật CIS',
  'Sinh kịch bản CLI khắc phục lỗi cổng trunk cho Cisco & Fortinet',
];

const COPILOT_PRESETS_EN = [
  'Analyze root cause of offline nodes and stopped services',
  'Audit configuration drift & CIS security compliance across routers',
  'Generate trunk remediation & CIS hardening CLI for Cisco & Fortinet',
];

export const AiDiagnosticsRcaView: React.FC<AiDiagnosticsRcaViewProps> = ({
  devices,
  alerts,
  lang = 'vi',
  initialDeviceId,
  onSelectDeviceDrawer,
  onOpenInConfigHub,
  onApplyRemediation,
  onAddDiscoveredDevice,
}) => {
  const isVi = lang === 'vi';
  const defaultDevice =
    devices.find((d) => d.id === initialDeviceId) ||
    devices.find((d) => d.status === DeviceStatus.Offline) ||
    devices.find((d) => d.status === DeviceStatus.Warning) ||
    devices[0];

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(defaultDevice?.id || '');
  const [customSymptom, setCustomSymptom] = useState<string>('');
  const [includeLiveProbe, setIncludeLiveProbe] = useState<boolean>(true);
  const [liveProbeTarget, setLiveProbeTarget] = useState<string>('1.1.1.1');
  const [liveProbeData, setLiveProbeData] = useState<LiveProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [rcaReport, setRcaReport] = useState<RcaAnalysisReport | null>(null);
  const [remediationFeedback, setRemediationFeedback] = useState<string | null>(null);

  // Multi-AI Provider Accounts & Active Provider State
  const [aiProviders, setAiProviders] = useState<AiProviderAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AI_PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return INITIAL_AI_PROVIDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AI_PROVIDERS, JSON.stringify(aiProviders));
    } catch {
      // Ignore storage errors
    }
  }, [aiProviders]);

  const [activeProviderId, setActiveProviderId] = useState<AiProviderId>('gemini');
  const [reasoningMode, setReasoningMode] = useState<AiReasoningMode>('deep-rca');

  // AI Sign-In / Account Switcher Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [loginTargetId, setLoginTargetId] = useState<AiProviderId>('chatgpt');
  const [loginEmailInput, setLoginEmailInput] = useState<string>('viettq14407@gmail.com');
  const [loginWorkspaceInput, setLoginWorkspaceInput] = useState<string>('OmniNet NOC Team');
  const [loginModelSelect, setLoginModelSelect] = useState<string>('gpt-4o');
  const [isAuthenticatingSso, setIsAuthenticatingSso] = useState<boolean>(false);

  const activeProvider =
    aiProviders.find((p) => p.id === activeProviderId) || aiProviders[0];

  const [copilotInput, setCopilotInput] = useState<string>('');
  const [isCopilotBusy, setIsCopilotBusy] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      providerId: 'gemini',
      providerLabel: 'Google Gemini',
      modelName: 'gemini-3.8-flash',
      content:
        'Xin chào Kỹ sư NOC. Tôi là Trợ lý Kỹ sư AI của OmniNet. Bạn có thể chuyển đổi hoặc đăng nhập nhiều nền tảng AI khác nhau (Google Gemini, OpenAI ChatGPT, Anthropic Claude, DeepSeek NetOps) ngay trên thanh công cụ để phân tích nguyên nhân gốc (RCA) và sinh lệnh CLI đa nhà mạng.',
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    },
  ]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  useEffect(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      setSelectedDeviceId(initialDeviceId);
    }
  }, [initialDeviceId, devices]);

  useEffect(() => {
    if (selectedDevice && !rcaReport && !isAnalyzing) {
      handleRunRca(selectedDevice.id, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.id]);

  const openProviderLoginModal = (providerId: AiProviderId) => {
    const target = aiProviders.find((p) => p.id === providerId) || aiProviders[0];
    setLoginTargetId(target.id);
    setLoginEmailInput(target.accountEmail || 'viettq14407@gmail.com');
    setLoginWorkspaceInput(target.workspaceName);
    setLoginModelSelect(target.selectedModel);
    setAuthModalOpen(true);
  };

  const handleSelectOrLoginProvider = (providerId: AiProviderId) => {
    const target = aiProviders.find((p) => p.id === providerId);
    if (!target) return;
    if (!target.loggedIn) {
      openProviderLoginModal(providerId);
      return;
    }
    setActiveProviderId(providerId);
  };

  const handleConfirmProviderSsoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticatingSso(true);
    setTimeout(() => {
      const nowTime = new Date().toLocaleTimeString([], { hour12: false });
      setAiProviders((prev) =>
        prev.map((p) =>
          p.id === loginTargetId
            ? {
                ...p,
                loggedIn: true,
                accountEmail: loginEmailInput.trim() || p.accountEmail,
                workspaceName: loginWorkspaceInput.trim() || p.workspaceName,
                selectedModel: loginModelSelect || p.selectedModel,
                connectedAt: `Connected at ${nowTime}`,
              }
            : p
        )
      );
      setActiveProviderId(loginTargetId);
      setIsAuthenticatingSso(false);
      setAuthModalOpen(false);

      const connectedProvider = aiProviders.find((p) => p.id === loginTargetId);
      if (connectedProvider) {
        setRemediationFeedback(
          `Đã đăng nhập và kích hoạt ${connectedProvider.name} (${loginModelSelect}) với tài khoản ${loginEmailInput.trim() || connectedProvider.accountEmail}.`
        );
      }
    }, 450);
  };

  const handleDisconnectProvider = (providerId: AiProviderId) => {
    setAiProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, loggedIn: false, connectedAt: undefined } : p))
    );
    if (activeProviderId === providerId) {
      const fallback = aiProviders.find((p) => p.id !== providerId && p.loggedIn);
      if (fallback) {
        setActiveProviderId(fallback.id);
      }
    }
  };

  const handleChangeActiveModel = (modelName: string) => {
    setAiProviders((prev) =>
      prev.map((p) => (p.id === activeProviderId ? { ...p, selectedModel: modelName } : p))
    );
  };

  const runLiveSocketProbe = async (targetHost: string): Promise<LiveProbeResult | null> => {
    const clean = targetHost.trim();
    if (!clean) return null;
    setIsProbing(true);
    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: clean, ports: [22, 53, 80, 443, 179, 8443] }),
      });
      if (!res.ok) return null;
      const data: LiveProbeResult = await res.json();
      setLiveProbeData(data);
      return data;
    } catch {
      return null;
    } finally {
      setIsProbing(false);
    }
  };

  const handleRunRca = async (
    targetId?: string,
    runProbeFirst = includeLiveProbe,
    overrideProvider?: AiProviderAccount
  ) => {
    const dev = devices.find((d) => d.id === (targetId || selectedDeviceId)) || selectedDevice;
    if (!dev) return;

    const providerToUse = overrideProvider || activeProvider;

    setIsAnalyzing(true);
    setRemediationFeedback(null);

    try {
      let probeSnapshot = liveProbeData;
      if (runProbeFirst && liveProbeTarget.trim()) {
        probeSnapshot = await runLiveSocketProbe(liveProbeTarget);
      }

      const peerIds = new Set(
        dev.interfaces
          .map((i) => i.connectedToId)
          .filter((id): id is string => Boolean(id))
      );
      const peerDevices = devices.filter(
        (d) =>
          peerIds.has(d.id) ||
          d.interfaces.some((ifc) => ifc.connectedToId === dev.id)
      );

      const deviceAlerts = alerts.filter((a) => a.deviceId === dev.id && !a.acknowledged);
      const complianceFindings = auditDeviceCompliance(dev);

      const response = await fetch('/api/ai/rca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: dev,
          peerDevices,
          deviceAlerts,
          complianceFindings,
          liveProbeData: probeSnapshot,
          customSymptom,
          providerId: providerToUse.id,
          modelName: providerToUse.selectedModel,
          reasoningMode,
          accountEmail: providerToUse.accountEmail,
        }),
      });

      const report: RcaAnalysisReport = await response.json();
      setRcaReport(report);
    } catch {
      // Handled gracefully
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTriggerRemediation = (recoverNode: boolean, syncBaseline: boolean) => {
    if (!selectedDevice || !rcaReport) return;
    onApplyRemediation(selectedDevice.id, rcaReport.remediationCli, {
      recoverNode,
      syncBaseline,
    });
    setRemediationFeedback(
      recoverNode && syncBaseline
        ? `Đã khôi phục trạng thái trực tuyến, bật lại cổng/dịch vụ và đồng bộ Golden Baseline cho ${selectedDevice.hostname}.`
        : recoverNode
        ? `Đã kích hoạt khôi phục nút, bật lại các cổng uplink và khởi động lại dịch vụ trên ${selectedDevice.hostname}.`
        : `Đã đẩy bản vá CLI và đồng bộ Golden Baseline cho ${selectedDevice.hostname}.`
    );
  };

  const handleSendCopilot = async (promptText?: string) => {
    const query = (promptText ?? copilotInput).trim();
    if (!query || isCopilotBusy) return;

    if (!activeProvider.loggedIn) {
      openProviderLoginModal(activeProvider.id);
      return;
    }

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    if (!promptText) setCopilotInput('');
    setIsCopilotBusy(true);

    try {
      const compactContext = {
        devices: devices.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          ip: d.ip,
          vendor: d.vendor,
          role: d.role,
          site: d.site,
          status: d.status,
          cpuLoad: d.cpuLoad,
          memoryUsage: d.memoryUsage,
          latencyMs: d.latencyMs,
          packetLossPct: d.packetLossPct,
          drifted: d.runningConfig.trim() !== d.goldenBaselineConfig.trim(),
          downPorts: d.interfaces.filter((i) => i.status === 'down').map((i) => i.name),
          stoppedServices: (d.services || []).filter((s) => s.status !== 'running').map((s) => s.name),
        })),
        activeAlerts: alerts.filter((a) => !a.acknowledged),
        latestLiveProbe: liveProbeData
          ? {
              target: liveProbeData.target,
              ip: liveProbeData.ip,
              reachable: liveProbeData.reachable,
              avgLatencyMs: liveProbeData.avgLatencyMs,
              openPorts: liveProbeData.openPorts,
            }
          : null,
      };

      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          networkContext: compactContext,
          providerId: activeProvider.id,
          modelName: activeProvider.selectedModel,
          reasoningMode,
          accountEmail: activeProvider.accountEmail,
        }),
      });
      const data = await res.json();

      const assistantMsg: CopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        providerId: activeProvider.id,
        providerLabel: activeProvider.name,
        modelName: activeProvider.selectedModel,
        content: data.reply || 'Đã hoàn tất phân tích trạng thái mạng.',
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        suggestedCli: data.suggestedCli || undefined,
        targetDeviceId: data.targetDeviceId || undefined,
      };
      setCopilotMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          providerId: activeProvider.id,
          providerLabel: activeProvider.name,
          modelName: activeProvider.selectedModel,
          content: 'Không thể kết nối tới dịch vụ AI Copilot. Vui lòng thử lại.',
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        },
      ]);
    } finally {
      setIsCopilotBusy(false);
    }
  };

  const handleOnboardProbedHost = () => {
    if (!liveProbeData || !liveProbeData.ip) return;
    const hostname =
      liveProbeData.hostname ||
      liveProbeData.target.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();

    const vendorMap: Record<string, VendorName> = {
      'Cisco IOS-XE': 'Cisco IOS-XE',
      'Cisco NX-OS': 'Cisco NX-OS',
      Fortinet: 'Fortinet',
      'Palo Alto': 'Palo Alto',
      Juniper: 'Juniper',
      MikroTik: 'MikroTik',
      Aruba: 'Aruba',
    };
    const vendor: VendorName = vendorMap[liveProbeData.inferred.vendor] || 'Linux / Server';

    const role =
      liveProbeData.inferred.role === 'Router'
        ? DeviceRole.Router
        : liveProbeData.inferred.role === 'Firewall'
        ? DeviceRole.Firewall
        : DeviceRole.Server;

    const defaultConfig = `# ${vendor} — ${hostname} (${liveProbeData.ip})\nhostname ${hostname}\n! Onboarded via OmniNet Live TCP/DNS Probe`;

    const newDevice: NetworkDevice = {
      id: `dev-probe-${Date.now()}`,
      hostname,
      ip: liveProbeData.ip,
      mac: '00:1B:63:9A:44:E1',
      vendor,
      model: liveProbeData.inferred.model || 'Cloud Edge Node',
      osVersion: liveProbeData.inferred.osVersion || 'Linux 6.8 / TLS 1.3',
      serialNumber: `PRB${Math.floor(100000 + Math.random() * 900000)}`,
      assetTag: `AST-PRB-${Math.floor(100 + Math.random() * 899)}`,
      role,
      status: liveProbeData.reachable ? DeviceStatus.Online : DeviceStatus.Warning,
      site: 'HN-DC1 Core',
      rack: 'WAN-Edge-Rack',
      department: 'Hybrid WAN Operations',
      purchaseDate: new Date().toISOString().slice(0, 10),
      warrantyExpiry: '2029-12-31',
      uptimeSeconds: 86400 * 14,
      cpuLoad: 22,
      memoryUsage: 41,
      tempCelsius: 38,
      inboundMbps: 185.4,
      outboundMbps: 142.8,
      latencyMs: liveProbeData.avgLatencyMs || 12.5,
      packetLossPct: liveProbeData.reachable ? 0 : 100,
      openPorts: liveProbeData.openPorts,
      discoveryMethod: 'Live TCP Probe',
      mgmtProtocol: 'SSHv2',
      lastSeen: 'Just now (Live Probe)',
      isLiveProbed: true,
      runningConfig: defaultConfig,
      goldenBaselineConfig: defaultConfig,
      configHistory: [
        {
          id: `rev-probe-${Date.now()}`,
          versionLabel: 'v1 (Live Probe Onboard)',
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          author: 'ai-rca-probe',
          summary: `Onboarded from live TCP/DNS probe of ${liveProbeData.target}`,
          content: defaultConfig,
        },
      ],
      topologyTier: 0,
      interfaces: [
        {
          name: 'eth0',
          description: `WAN-Probed-${liveProbeData.target}`,
          status: liveProbeData.reachable ? 'up' : 'down',
          adminStatus: 'up',
          portType: 'SFP+-10G',
          mode: 'routed',
          speedMbps: 10000,
          rxMbps: 185.4,
          txMbps: 142.8,
          vlan: 'WAN',
          ipAddress: `${liveProbeData.ip}/32`,
          connectedToId: 'dev-fw-01',
          connectedToHostname: 'fw-edge-01.corp.local',
          connectedPort: 'port1',
          protocol: 'STATIC',
        },
      ],
      services: liveProbeData.portChecks
        .filter((p) => p.open)
        .map((p, idx) => ({
          id: `svc-prb-${idx}-${Date.now()}`,
          name: `${p.service} Service`,
          processName: p.service.toLowerCase(),
          port: p.port,
          protocol: 'TCP',
          status: 'running',
          autoRestart: true,
          cpuPct: 1.8,
          memoryMb: 128,
          responseTimeMs: p.latencyMs || 10,
          uptime: '14d 04h',
        })),
    };

    onAddDiscoveredDevice(newDevice);
    setSelectedDeviceId(newDevice.id);
    setRemediationFeedback(
      `Đã nạp nút mạng thực tế ${hostname} (${liveProbeData.ip}) vào kho tài sản CMDB & sơ đồ mạng.`
    );
  };

  const sortedDevices = [...devices].sort((a, b) => {
    const score = (d: NetworkDevice) => {
      let s = 0;
      if (d.status === DeviceStatus.Offline) s += 100;
      if (d.status === DeviceStatus.Warning) s += 50;
      if (d.runningConfig.trim() !== d.goldenBaselineConfig.trim()) s += 25;
      return s;
    };
    return score(b) - score(a);
  });

  const loginModalTarget =
    aiProviders.find((p) => p.id === loginTargetId) || aiProviders[0];

  return (
    <div className="space-y-4">
      {/* Multi-AI Provider Sign-In & Model Switcher Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isVi
                ? 'Chẩn đoán AI & Phân tích Nguyên nhân Gốc (RCA)'
                : 'AI Diagnostics & Root Cause Analysis (RCA)'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeProvider.name}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {activeProvider.selectedModel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => openProviderLoginModal(activeProvider.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {isVi
                  ? `Tài khoản AI (${aiProviders.filter((p) => p.loggedIn).length}/4)`
                  : `AI Accounts (${aiProviders.filter((p) => p.loggedIn).length}/4)`}
              </span>
            </button>
          </div>
        </div>

        {/* 4-Provider Interactive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
          {aiProviders.map((prov) => {
            const isActive = prov.id === activeProviderId;
            return (
              <div
                key={prov.id}
                onClick={() => handleSelectOrLoginProvider(prov.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          prov.loggedIn ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {prov.name}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {prov.selectedModel}
                    </div>
                  </div>

                  {prov.loggedIn ? (
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                      {isActive ? (isVi ? 'Đang chọn' : 'Active') : isVi ? 'Đã kết nối' : 'Connected'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProviderLoginModal(prov.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>{isVi ? 'Đăng nhập' : 'Sign In'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800/70">
                  <span className="truncate font-mono">
                    {prov.loggedIn ? prov.accountEmail : prov.authType}
                  </span>
                  {prov.loggedIn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProviderLoginModal(prov.id);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
                    >
                      {isVi ? 'Đổi model' : 'Model'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 12-Column Diagnostic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Incident & Node Selector + Hybrid Probe Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isVi ? '1. Chọn Thiết bị Cần Chẩn đoán' : '1. Select Target Node'}</span>
              </h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {devices.length} nodes
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-72 overflow-y-auto">
              {sortedDevices.map((dev) => {
                const isSelected = dev.id === selectedDevice?.id;
                const hasDrift =
                  dev.runningConfig.trim() !== dev.goldenBaselineConfig.trim();
                const stoppedSvc = (dev.services || []).filter(
                  (s) => s.status !== 'running'
                ).length;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeviceId(dev.id);
                      handleRunRca(dev.id, false);
                    }}
                    className={`w-full text-left p-3 transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            dev.status === DeviceStatus.Online
                              ? 'bg-emerald-500'
                              : dev.status === DeviceStatus.Warning
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {dev.hostname}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {dev.ip} · {dev.vendor}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {dev.status === DeviceStatus.Offline && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {isVi ? 'Mất kết nối (Offline)' : 'Offline (Unreachable)'}
                          </span>
                        )}
                        {dev.status === DeviceStatus.Warning && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {isVi ? 'Cảnh báo hiệu năng' : 'Degraded Performance'}
                          </span>
                        )}
                        {dev.status === DeviceStatus.Online && !hasDrift && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {isVi ? 'Hoạt động ổn định' : 'Healthy / Online'}
                          </span>
                        )}
                        {hasDrift && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {dev.status !== DeviceStatus.Online ? ' · ' : ''}
                            {isVi ? 'Lệch cấu hình (Drift)' : 'Config Drift'}
                          </span>
                        )}
                        {stoppedSvc > 0 && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {' '}· {stoppedSvc} {isVi ? 'dịch vụ dừng' : 'stopped daemon'}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                      {dev.status === DeviceStatus.Offline ? '—' : `${dev.latencyMs.toFixed(1)}ms`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isVi ? 'Triệu chứng bổ sung (Tùy chọn)' : 'Additional Symptoms (Optional)'}
              </label>
              <input
                type="text"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                placeholder={
                  isVi
                    ? 'VD: Rớt gói BGP, nghẽn VLAN 30...'
                    : 'e.g. BGP flap, VLAN 30 packet drops...'
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Hybrid Live Probe Option */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {isVi ? 'Kết hợp Quét Socket TCP/DNS Thực tế' : 'Include Live TCP/DNS Socket Probe'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={includeLiveProbe}
                  onChange={(e) => setIncludeLiveProbe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              {includeLiveProbe && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={liveProbeTarget}
                      onChange={(e) => setLiveProbeTarget(e.target.value)}
                      placeholder="1.1.1.1 / cloudflare.com"
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={isProbing}
                      onClick={() => runLiveSocketProbe(liveProbeTarget)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {isProbing ? (isVi ? 'Đang quét...' : 'Probing...') : 'Probe'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                    {['1.1.1.1', '8.8.8.8', 'cloudflare.com', 'google.com'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setLiveProbeTarget(preset);
                          runLiveSocketProbe(preset);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => handleRunRca(selectedDevice?.id, includeLiveProbe)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {isVi
                      ? `Đang phân tích bằng ${activeProvider.name}...`
                      : `Analyzing with ${activeProvider.name}...`}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isVi
                      ? `Chạy RCA với ${activeProvider.name} (${activeProvider.selectedModel})`
                      : `Run RCA with ${activeProvider.name} (${activeProvider.selectedModel})`}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Live Socket Probe Result Summary Card */}
          {liveProbeData && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isVi ? 'Kết quả Live Probe' : 'Live Socket Probe Result'}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {liveProbeData.avgLatencyMs}ms RTT
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isVi ? 'Host / IP:' : 'Resolved Host / IP:'}</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">
                    {liveProbeData.target} ({liveProbeData.ip})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isVi ? 'Trạng thái:' : 'Reachability:'}</span>
                  <span
                    className={
                      liveProbeData.reachable
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    {liveProbeData.reachable ? 'REACHABLE (ONLINE)' : 'UNREACHABLE'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 font-medium">
                  {isVi ? 'Cổng TCP:' : 'TCP Port Status:'}
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] tabular-nums">
                  {liveProbeData.portChecks.map((p) => (
                    <div
                      key={p.port}
                      className={`px-2 py-1 rounded border ${
                        p.open
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {p.port}/{p.service} {p.open ? `${p.latencyMs}ms` : 'Closed'}
                    </div>
                  ))}
                </div>
              </div>

              {liveProbeData.reachable && liveProbeData.ip && (
                <button
                  type="button"
                  onClick={handleOnboardProbedHost}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-blue-600/30 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isVi ? 'Nạp Host này vào CMDB & Topology' : 'Import Host to CMDB & Topology'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column (8 cols): Structured RCA Report Canvas + Interactive NOC Copilot */}
        <div className="lg:col-span-8 space-y-6">
          {remediationFeedback && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium">{remediationFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setRemediationFeedback(null)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
              >
                {isVi ? 'Đóng' : 'Dismiss'}
              </button>
            </div>
          )}

          {/* Interactive NOC AI Copilot Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isVi
                      ? `Trợ lý Kỹ sư NOC AI Copilot (${activeProvider.name})`
                      : `NOC AI Engineer Copilot (${activeProvider.name})`}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {activeProvider.accountEmail} · {activeProvider.workspaceName}
                  </p>
                </div>
              </div>

              {/* Active Provider & Model Quick Selectors */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={activeProviderId}
                  onChange={(e) => handleSelectOrLoginProvider(e.target.value as AiProviderId)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  {aiProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.loggedIn ? '✓' : isVi ? '(Đăng nhập)' : '(Sign in)'}
                    </option>
                  ))}
                </select>

                <select
                  value={activeProvider.selectedModel}
                  onChange={(e) => handleChangeActiveModel(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400"
                >
                  {activeProvider.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={reasoningMode}
                  onChange={(e) => setReasoningMode(e.target.value as AiReasoningMode)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <option value="deep-rca">
                    {isVi ? 'Chế độ: Phân tích Sâu (Deep RCA)' : 'Mode: Deep RCA'}
                  </option>
                  <option value="strict-cli">
                    {isVi ? 'Chế độ: Lệnh CLI Đa hãng' : 'Mode: Multi-Vendor CLI'}
                  </option>
                  <option value="fast-noc">
                    {isVi ? 'Chế độ: Phản hồi Nhanh (Fast NOC)' : 'Mode: Fast NOC Triage'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(isVi ? COPILOT_PRESETS_VI : COPILOT_PRESETS_EN).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendCopilot(preset)}
                  className="text-left px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-xs space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white ml-8'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] opacity-75 font-mono">
                    <span>
                      {msg.role === 'user'
                        ? isVi
                          ? `Kỹ sư NOC (${activeProvider.accountEmail})`
                          : `NOC Engineer (${activeProvider.accountEmail})`
                        : `${msg.providerLabel || 'OmniNet AI'} · ${msg.modelName || 'gemini-3.8-flash'}`}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                  {msg.suggestedCli && (
                    <pre className="p-2.5 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      {msg.suggestedCli}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCopilot();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder={
                  isVi
                    ? `Hỏi ${activeProvider.name} (${activeProvider.selectedModel}) về sự cố mạng, tạo ACL/VLAN/BGP...`
                    : `Ask ${activeProvider.name} (${activeProvider.selectedModel}) about network faults, ACLs, VLANs, BGP...`
                }
                className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={isCopilotBusy || !copilotInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isCopilotBusy ? (isVi ? 'Đang xử lý...' : 'Thinking...') : isVi ? 'Gửi' : 'Send'}</span>
              </button>
            </form>
          </div>

          {/* Structured RCA Report Card */}
          {rcaReport && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
              <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span
                      className={`font-semibold uppercase ${
                        rcaReport.severity === 'critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : rcaReport.severity === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      [{rcaReport.severity.toUpperCase()}]
                    </span>
                    <span className="text-slate-900 dark:text-slate-100 font-semibold">
                      {rcaReport.hostname} ({rcaReport.ip})
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      Layer: {rcaReport.rootCauseLayer}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {isVi ? 'Độ tin cậy:' : 'Confidence:'} {rcaReport.confidencePct}%
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {rcaReport.incidentTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    AI Engine: {rcaReport.engine} · Vendor: {rcaReport.vendor} · {rcaReport.generatedAt}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => selectedDevice && onSelectDeviceDrawer(selectedDevice)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {isVi ? 'Chi tiết Phần cứng' : 'Hardware Inspector'}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedDevice && onOpenInConfigHub(selectedDevice.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Mở Config Hub' : 'Config Hub'}</span>
                  </button>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{isVi ? 'Tóm tắt Chẩn đoán' : 'Executive Summary'}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {rcaReport.executiveSummary}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>{isVi ? 'Nguyên nhân Gốc Kỹ thuật' : 'Technical Root Cause'}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {rcaReport.technicalRootCause}
                  </p>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {isVi ? 'Chuỗi Bằng chứng Đa tầng' : 'Cross-Layer Evidence'}
                  </h4>
                  <ul className="space-y-2">
                    {rcaReport.evidenceChain.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          0{index + 1}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {isVi ? 'Phạm vi Ảnh hưởng (Blast Radius)' : 'Topology Blast Radius'}
                  </h4>
                  <ul className="space-y-2">
                    {rcaReport.blastRadius.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-slate-600 dark:text-slate-300"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{isVi ? 'Các Bước Khắc phục' : 'Recommended Remediation Steps'}</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {rcaReport.recommendedSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold mb-1">
                          {isVi ? `Bước ${idx + 1}` : `Step ${idx + 1}`}
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>
                        {isVi
                          ? `Kịch bản CLI Khắc phục Tự động (${rcaReport.vendor})`
                          : `Automated Remediation CLI (${rcaReport.vendor})`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerRemediation(true, true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          {isVi
                            ? 'Thực thi Khắc phục & Đồng bộ Baseline'
                            : 'Execute Remediation & Sync Baseline'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerRemediation(false, true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          {isVi ? 'Chỉ đẩy CLI & Lưu Baseline' : 'Push CLI & Save Baseline'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                    {rcaReport.remediationCli}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-AI Provider SSO Sign-In & Session Manager Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isVi
                      ? 'Đăng nhập & Chuyển đổi Nền tảng AI (SSO)'
                      : 'Multi-AI Provider SSO Session'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmProviderSsoLogin} className="p-5 space-y-4 text-xs">
              {/* Provider Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {aiProviders.map((p) => {
                  const isSelected = p.id === loginTargetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setLoginTargetId(p.id);
                        setLoginEmailInput(p.accountEmail);
                        setLoginWorkspaceInput(p.workspaceName);
                        setLoginModelSelect(p.selectedModel);
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{p.name.replace('Google ', '').replace('OpenAI ', '').replace('Anthropic ', '')}</span>
                        {p.loggedIn && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono opacity-75 truncate mt-0.5">
                        {p.vendorLabel}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {loginModalTarget.name} ({loginModalTarget.authType})
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      loginModalTarget.loggedIn
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {loginModalTarget.loggedIn
                      ? isVi
                        ? '● Đã kết nối'
                        : '● Connected'
                      : isVi
                      ? '○ Chưa đăng nhập'
                      : '○ Disconnected'}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 dark:text-slate-400 font-medium">
                    {isVi ? 'Email Tài khoản SSO' : 'Engineer SSO Email'}
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmailInput}
                    onChange={(e) => setLoginEmailInput(e.target.value)}
                    placeholder="engineer@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-600 dark:text-slate-400 font-medium">
                      {isVi ? 'Workspace / Tổ chức' : 'Workspace / Org'}
                    </label>
                    <input
                      type="text"
                      required
                      value={loginWorkspaceInput}
                      onChange={(e) => setLoginWorkspaceInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-600 dark:text-slate-400 font-medium">
                      {isVi ? 'Mô hình AI Mặc định' : 'Default AI Model'}
                    </label>
                    <select
                      value={loginModelSelect}
                      onChange={(e) => setLoginModelSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-600"
                    >
                      {loginModalTarget.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {loginModalTarget.loggedIn ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnectProvider(loginModalTarget.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>
                      {isVi
                        ? `Đăng xuất ${loginModalTarget.name}`
                        : `Sign out ${loginModalTarget.name}`}
                    </span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticatingSso}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>
                      {isAuthenticatingSso
                        ? isVi
                          ? 'Đang xác thực...'
                          : 'Authenticating...'
                        : loginModalTarget.loggedIn
                        ? isVi
                          ? `Lưu & Dùng ${loginModalTarget.name}`
                          : `Save & Use ${loginModalTarget.name}`
                        : isVi
                        ? `Đăng nhập ${loginModalTarget.name}`
                        : `Sign in ${loginModalTarget.name}`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
