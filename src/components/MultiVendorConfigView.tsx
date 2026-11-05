// OmniNet Multi-Vendor Configuration Hub & Visual Workbench
import React, { useEffect, useMemo, useState } from 'react';
import {
  Cable,
  Check,
  CheckCircle2,
  Copy,
  FileDiff,
  GitCommit,
  Layers,
  Link2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Sliders,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  ConfigTemplateType,
  DeviceInterface,
  DeviceRole,
  DeviceStatus,
  DeviceVlan,
  NetworkDevice,
  UnifiedConfigPayload,
  VisualFirewallRule,
  VisualRouteEntry,
} from '../types/network';
import {
  compileVendorCli,
  compileVisualDeviceConfig,
  computeConfigDiff,
  runSimulatedDeviceCliCommand,
} from '../utils/vendorConfigCompiler';

import { AppLanguage } from '../utils/i18n';

interface MultiVendorConfigViewProps {
  devices: NetworkDevice[];
  lang?: AppLanguage;
  preselectedDeviceId: string | null;
  preselectedTemplate: ConfigTemplateType | null;
  onApplyVisualDeviceUpdate: (
    deviceId: string,
    updater: (dev: NetworkDevice) => NetworkDevice,
    generatedCli: string,
    summary: string
  ) => void;
  onPushConfigToDevices: (
    deviceIds: string[],
    compiledByDeviceId: Record<string, string>,
    summary: string
  ) => void;
  onRollbackDeviceConfig: (deviceId: string, targetContent: string, label: string) => void;
  onPromoteGoldenBaseline: (deviceId: string) => void;
  onOpenDatasheetSync?: () => void;
}

export const MultiVendorConfigView: React.FC<MultiVendorConfigViewProps> = ({
  devices,
  lang = 'vi',
  preselectedDeviceId,
  preselectedTemplate,
  onApplyVisualDeviceUpdate,
  onPushConfigToDevices,
  onRollbackDeviceConfig,
  onPromoteGoldenBaseline,
  onOpenDatasheetSync,
}) => {
  const isVi = lang === 'vi';
  const [activeTab, setActiveTab] = useState<'visual' | 'batch' | 'diff'>(() =>
    preselectedTemplate ? 'batch' : 'visual'
  );

  // ============================================================================
  // MODE 1: VISUAL HOOK & CONFIGURE WORKBENCH (Switch / Router / Firewall GUI)
  // ============================================================================
  const configurableDevices = useMemo(
    () => devices.filter((d) => d.role !== DeviceRole.Server).concat(devices.filter((d) => d.role === DeviceRole.Server)),
    [devices]
  );

  const [hookedDeviceId, setHookedDeviceId] = useState<string>(
    () => preselectedDeviceId || configurableDevices[0]?.id || ''
  );
  const hookedDevice = useMemo(
    () =>
      configurableDevices.find((d) => d.id === hookedDeviceId) ||
      configurableDevices[0] ||
      null,
    [configurableDevices, hookedDeviceId]
  );

  const [mgmtTransport, setMgmtTransport] = useState<
    'NETCONF' | 'RESTCONF' | 'Vendor-API' | 'SSHv2'
  >('NETCONF');
  const [isSessionSyncing, setIsSessionSyncing] = useState(false);
  const [sessionHandshakeMsg, setSessionHandshakeMsg] = useState<string | null>(null);

  const [visualSubTab, setVisualSubTab] = useState<'ports' | 'vlans' | 'firewall' | 'routing'>(
    'ports'
  );
  const [rightPaneMode, setRightPaneMode] = useState<'cli' | 'console'>('cli');

  // Visual Port Editor State
  const [selectedPortName, setSelectedPortName] = useState<string>('');
  const selectedPortObj: DeviceInterface | null = useMemo(() => {
    if (!hookedDevice) return null;
    return (
      hookedDevice.interfaces.find((i) => i.name === selectedPortName) ||
      hookedDevice.interfaces[0] ||
      null
    );
  }, [hookedDevice, selectedPortName]);

  const [portAdminUp, setPortAdminUp] = useState<boolean>(true);
  const [portMode, setPortMode] = useState<'access' | 'trunk' | 'routed'>('access');
  const [portVlan, setPortVlan] = useState<string>('VLAN 10');
  const [portIp, setPortIp] = useState<string>('');
  const [portDesc, setPortDesc] = useState<string>('');

  useEffect(() => {
    if (!selectedPortObj) return;
    setPortAdminUp((selectedPortObj.adminStatus ?? 'up') === 'up');
    setPortMode(
      selectedPortObj.mode ||
        (selectedPortObj.vlan.toLowerCase().includes('trunk')
          ? 'trunk'
          : selectedPortObj.ipAddress
          ? 'routed'
          : 'access')
    );
    setPortVlan(selectedPortObj.vlan);
    setPortIp(selectedPortObj.ipAddress || '');
    setPortDesc(selectedPortObj.description || '');
  }, [selectedPortObj]);

  // Visual VLAN Builder State
  const [newVlanId, setNewVlanId] = useState<number>(120);
  const [newVlanName, setNewVlanName] = useState<string>('CORP_APP_NET');
  const [newVlanSvi, setNewVlanSvi] = useState<string>('10.10.120.1/24');

  // Visual Firewall Policy Builder State
  const [fwName, setFwName] = useState<string>('Allow-Branch-HTTPS');
  const [fwSrcZone, setFwSrcZone] = useState<string>('Trust');
  const [fwSrcCidr, setFwSrcCidr] = useState<string>('10.20.0.0/16');
  const [fwDstZone, setFwDstZone] = useState<string>('WAN');
  const [fwDstCidr, setFwDstCidr] = useState<string>('0.0.0.0/0');
  const [fwProtocol, setFwProtocol] = useState<'TCP' | 'UDP' | 'ICMP' | 'ANY'>('TCP');
  const [fwPort, setFwPort] = useState<string>('443');
  const [fwAction, setFwAction] = useState<'accept' | 'deny'>('accept');
  const [fwNat, setFwNat] = useState<boolean>(true);
  const [fwLog, setFwLog] = useState<boolean>(true);

  // Visual Route Builder State
  const [rtPrefix, setRtPrefix] = useState<string>('10.50.0.0/16');
  const [rtNextHop, setRtNextHop] = useState<string>('10.10.0.1');
  const [rtIface, setRtIface] = useState<string>('');
  const [rtProto, setRtProto] = useState<'Static' | 'BGP' | 'OSPF'>('Static');
  const [rtMetric, setRtMetric] = useState<number>(10);

  // Interactive SSH/API Console State
  const [consoleInput, setConsoleInput] = useState<string>('show interfaces');
  const [consoleHistory, setConsoleHistory] = useState<
    { cmd: string; output: string; ts: string }[]
  >([]);

  useEffect(() => {
    if (hookedDevice) {
      setMgmtTransport(hookedDevice.mgmtProtocol || 'NETCONF');
      setRtIface(hookedDevice.interfaces[0]?.name || 'eth0');
      setConsoleHistory([
        {
          cmd: 'session connect',
          output: `Authenticated to ${hookedDevice.hostname} (${hookedDevice.ip}) via ${hookedDevice.mgmtProtocol || 'NETCONF'} — ${hookedDevice.vendor} ${hookedDevice.osVersion} ready.`,
          ts: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        },
      ]);
    }
  }, [hookedDevice?.id]);

  // Live preview of native vendor CLI for current visual form
  const liveVisualCliPreview = useMemo(() => {
    if (!hookedDevice) return '';
    if (visualSubTab === 'ports' && selectedPortObj) {
      return compileVisualDeviceConfig(hookedDevice, {
        editedInterface: {
          ...selectedPortObj,
          adminStatus: portAdminUp ? 'up' : 'down',
          mode: portMode,
          vlan: portVlan,
          ipAddress: portIp || undefined,
          description: portDesc,
        },
      });
    }
    if (visualSubTab === 'vlans') {
      return compileVisualDeviceConfig(hookedDevice, {
        addedVlan: {
          id: newVlanId,
          name: newVlanName || `VLAN_${newVlanId}`,
          sviIp: newVlanSvi || undefined,
          status: 'active',
        },
      });
    }
    if (visualSubTab === 'firewall') {
      return compileVisualDeviceConfig(hookedDevice, {
        addedRule: {
          id: 'preview',
          name: fwName || 'Policy-1',
          srcZone: fwSrcZone,
          srcCidr: fwSrcCidr,
          dstZone: fwDstZone,
          dstCidr: fwDstCidr,
          protocol: fwProtocol,
          port: fwPort,
          action: fwAction,
          nat: fwNat,
          log: fwLog,
          enabled: true,
        },
      });
    }
    return compileVisualDeviceConfig(hookedDevice, {
      addedRoute: {
        id: 'preview',
        prefix: rtPrefix,
        nextHop: rtNextHop,
        interfaceName: rtIface || hookedDevice.interfaces[0]?.name || 'eth0',
        protocol: rtProto,
        metric: rtMetric,
      },
    });
  }, [
    hookedDevice,
    visualSubTab,
    selectedPortObj,
    portAdminUp,
    portMode,
    portVlan,
    portIp,
    portDesc,
    newVlanId,
    newVlanName,
    newVlanSvi,
    fwName,
    fwSrcZone,
    fwSrcCidr,
    fwDstZone,
    fwDstCidr,
    fwProtocol,
    fwPort,
    fwAction,
    fwNat,
    fwLog,
    rtPrefix,
    rtNextHop,
    rtIface,
    rtProto,
    rtMetric,
  ]);

  const handleResyncHookSession = () => {
    if (!hookedDevice) return;
    setIsSessionSyncing(true);
    setSessionHandshakeMsg(null);
    setTimeout(() => {
      setIsSessionSyncing(false);
      setSessionHandshakeMsg(
        `Synced ${hookedDevice.interfaces.length} interfaces, ${(hookedDevice.vlans || []).length} VLANs, and ${(hookedDevice.firewallRules || []).length} security rules over ${mgmtTransport} (${hookedDevice.latencyMs || 1.8} ms).`
      );
    }, 450);
  };

  const commitVisualPortUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookedDevice || !selectedPortObj) return;
    const cli = liveVisualCliPreview;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        interfaces: dev.interfaces.map((ifc) =>
          ifc.name === selectedPortObj.name
            ? {
                ...ifc,
                adminStatus: portAdminUp ? ('up' as const) : ('down' as const),
                status: portAdminUp ? ('up' as const) : ('down' as const),
                mode: portMode,
                vlan: portVlan,
                ipAddress: portIp || undefined,
                description: portDesc,
                rxMbps: portAdminUp ? Math.max(ifc.rxMbps, 42.5) : 0,
                txMbps: portAdminUp ? Math.max(ifc.txMbps, 34.2) : 0,
              }
            : ifc
        ),
      }),
      cli,
      `Visual GUI: Updated port ${selectedPortObj.name} (${portAdminUp ? 'UP' : 'SHUT'}, ${portVlan})`
    );
  };

  const commitVisualVlanCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookedDevice || !newVlanName.trim()) return;
    const vlanEntry: DeviceVlan = {
      id: newVlanId,
      name: newVlanName.trim(),
      sviIp: newVlanSvi.trim() || undefined,
      status: 'active',
    };
    const cli = liveVisualCliPreview;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        vlans: [...(dev.vlans || []).filter((v) => v.id !== vlanEntry.id), vlanEntry].sort(
          (a, b) => a.id - b.id
        ),
      }),
      cli,
      `Visual GUI: Provisioned VLAN ${vlanEntry.id} (${vlanEntry.name})`
    );
  };

  const handleDeleteVlan = (vlanId: number) => {
    if (!hookedDevice) return;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        vlans: (dev.vlans || []).filter((v) => v.id !== vlanId),
      }),
      `! Removed VLAN ${vlanId}`,
      `Visual GUI: Removed VLAN ${vlanId}`
    );
  };

  const commitVisualFirewallRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookedDevice || !fwName.trim()) return;
    const newRule: VisualFirewallRule = {
      id: `fwr-${Date.now()}`,
      name: fwName.trim(),
      srcZone: fwSrcZone,
      srcCidr: fwSrcCidr,
      dstZone: fwDstZone,
      dstCidr: fwDstCidr,
      protocol: fwProtocol,
      port: fwPort,
      action: fwAction,
      nat: fwNat,
      log: fwLog,
      enabled: true,
    };
    const cli = liveVisualCliPreview;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        firewallRules: [...(dev.firewallRules || []), newRule],
      }),
      cli,
      `Visual GUI: Added firewall policy ${newRule.name} (${newRule.action.toUpperCase()})`
    );
  };

  const toggleExistingFirewallRule = (ruleId: string) => {
    if (!hookedDevice) return;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        firewallRules: (dev.firewallRules || []).map((r) =>
          r.id === ruleId ? { ...r, enabled: !r.enabled } : r
        ),
      }),
      `# Toggled policy state ${ruleId}`,
      `Visual GUI: Toggled firewall policy state`
    );
  };

  const commitVisualRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookedDevice || !rtPrefix.trim() || !rtNextHop.trim()) return;
    const newRoute: VisualRouteEntry = {
      id: `rt-${Date.now()}`,
      prefix: rtPrefix.trim(),
      nextHop: rtNextHop.trim(),
      interfaceName: rtIface || hookedDevice.interfaces[0]?.name || 'eth0',
      protocol: rtProto,
      metric: rtMetric,
    };
    const cli = liveVisualCliPreview;
    onApplyVisualDeviceUpdate(
      hookedDevice.id,
      (dev) => ({
        ...dev,
        routes: [...(dev.routes || []), newRoute],
      }),
      cli,
      `Visual GUI: Added ${newRoute.protocol} route ${newRoute.prefix} -> ${newRoute.nextHop}`
    );
  };

  const runConsoleCmd = (cmdStr?: string) => {
    if (!hookedDevice) return;
    const text = (cmdStr ?? consoleInput).trim();
    if (!text) return;
    const out = runSimulatedDeviceCliCommand(hookedDevice, text);
    setConsoleHistory((prev) => [
      ...prev,
      {
        cmd: text,
        output: out,
        ts: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      },
    ]);
    if (!cmdStr) setConsoleInput('');
  };

  // ============================================================================
  // MODE 2 & 3: BATCH MULTI-VENDOR PUSH & CONFIG DIFF / ROLLBACK
  // ============================================================================
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(() =>
    preselectedDeviceId ? [preselectedDeviceId] : ['dev-fw-01', 'dev-rtr-01', 'dev-rtr-03', 'dev-sw-01']
  );
  const [previewDeviceId, setPreviewDeviceId] = useState<string>(
    preselectedDeviceId || 'dev-fw-01'
  );
  const [copiedCli, setCopiedCli] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);

  const [diffDeviceId, setDiffDeviceId] = useState<string>(preselectedDeviceId || 'dev-rtr-03');
  const [compareMode, setCompareMode] = useState<'baseline' | 'history'>('baseline');
  const [selectedHistoryRevId, setSelectedHistoryRevId] = useState<string>('');

  const [payload, setPayload] = useState<UnifiedConfigPayload>({
    templateType: preselectedTemplate || 'vlan',
    vlanId: 140,
    vlanName: 'CORP_PROD_APP',
    sviCidr: '10.10.140.1/24',
    trunkPorts: 'TenGigabitEthernet0/1-2',
    ntpPrimary: '10.10.0.10',
    ntpSecondary: '10.20.0.10',
    syslogServer: '10.10.0.50',
    snmpLocation: 'Enterprise-DC-Core',
    disableTelnet: true,
    aclName: 'BLOCK_LEGACY_SMB',
    aclSourceCidr: '0.0.0.0/0',
    aclDestCidr: '10.10.0.0/16',
    aclPort: 445,
    aclProtocol: 'tcp',
    aclAction: 'deny',
    bgpLocalAsn: 65001,
    bgpNeighborIp: '172.16.40.2',
    bgpRemoteAsn: 65040,
    bgpAdvertisedPrefix: '10.10.140.0/24',
    customCli: 'show version\nshow interfaces status',
  });

  useEffect(() => {
    if (preselectedDeviceId) {
      setHookedDeviceId(preselectedDeviceId);
      setSelectedDeviceIds((prev) =>
        prev.includes(preselectedDeviceId) ? prev : [preselectedDeviceId, ...prev]
      );
      setPreviewDeviceId(preselectedDeviceId);
      setDiffDeviceId(preselectedDeviceId);
    }
    if (preselectedTemplate) {
      setPayload((p) => ({ ...p, templateType: preselectedTemplate }));
      setActiveTab('batch');
    } else if (preselectedDeviceId) {
      setActiveTab('visual');
    }
  }, [preselectedDeviceId, preselectedTemplate]);

  const toggleTargetDevice = (id: string) => {
    setSelectedDeviceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length > 0 && !next.includes(previewDeviceId)) {
        setPreviewDeviceId(next[0]);
      }
      return next;
    });
    setDryRunResult(null);
  };

  const selectedDevices = useMemo(
    () => devices.filter((d) => selectedDeviceIds.includes(d.id)),
    [devices, selectedDeviceIds]
  );

  const activePreviewDevice = useMemo(
    () =>
      selectedDevices.find((d) => d.id === previewDeviceId) ||
      selectedDevices[0] ||
      devices[0],
    [selectedDevices, previewDeviceId, devices]
  );

  const compiledPreviewCli = useMemo(() => {
    if (!activePreviewDevice) return '';
    return compileVendorCli(
      activePreviewDevice.vendor,
      activePreviewDevice.hostname,
      payload
    );
  }, [activePreviewDevice, payload]);

  const handleCopyCli = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
  };

  const handleDryRun = () => {
    const offlineTargets = selectedDevices.filter((d) => d.status === DeviceStatus.Offline);
    const vendorCount = new Set(selectedDevices.map((d) => d.vendor)).size;
    if (offlineTargets.length > 0) {
      setDryRunResult(
        `Pre-check notice: ${selectedDevices.length - offlineTargets.length}/${selectedDevices.length} nodes reachable across ${vendorCount} vendor dialects (${offlineTargets.map((d) => d.hostname.split('.')[0]).join(', ')} currently offline — config will stage for reconnect).`
      );
    } else {
      setDryRunResult(
        `Syntax & NETCONF/SSHv2 pre-check passed across ${selectedDevices.length} devices (${vendorCount} distinct vendor OS syntaxes validated).`
      );
    }
  };

  const handleDeployBatch = () => {
    if (selectedDevices.length === 0) return;
    const compiledMap: Record<string, string> = {};
    selectedDevices.forEach((dev) => {
      compiledMap[dev.id] = compileVendorCli(dev.vendor, dev.hostname, payload);
    });

    const summaryMap: Record<ConfigTemplateType, string> = {
      vlan: `Provisioned VLAN ${payload.vlanId} (${payload.vlanName}) & SVI ${payload.sviCidr}`,
      baseline: `Applied NTP (${payload.ntpPrimary}), Syslog (${payload.syslogServer}) & SSHv2 hardening`,
      acl: `Deployed security policy ${payload.aclName} (${payload.aclAction.toUpperCase()} ${payload.aclProtocol}/${payload.aclPort})`,
      bgp: `Configured eBGP ASN ${payload.bgpLocalAsn} -> Peer ${payload.bgpNeighborIp}`,
      custom: `Executed custom multi-vendor CLI batch`,
    };

    onPushConfigToDevices(
      selectedDevices.map((d) => d.id),
      compiledMap,
      summaryMap[payload.templateType]
    );
    setDryRunResult(
      `Committed successfully to ${selectedDevices.length} devices. Configuration revisions archived.`
    );
  };

  const diffDevice = useMemo(
    () => devices.find((d) => d.id === diffDeviceId) || devices[0],
    [devices, diffDeviceId]
  );

  const referenceConfigText = useMemo(() => {
    if (!diffDevice) return '';
    if (compareMode === 'baseline') return diffDevice.goldenBaselineConfig;
    const rev =
      diffDevice.configHistory.find((r) => r.id === selectedHistoryRevId) ||
      diffDevice.configHistory[diffDevice.configHistory.length - 1];
    return rev ? rev.content : diffDevice.goldenBaselineConfig;
  }, [diffDevice, compareMode, selectedHistoryRevId]);

  const diffLines = useMemo(() => {
    if (!diffDevice) return [];
    return computeConfigDiff(referenceConfigText, diffDevice.runningConfig);
  }, [diffDevice, referenceConfigText]);

  const hasDrift = useMemo(
    () => diffLines.some((l) => l.type !== 'unchanged'),
    [diffLines]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {isVi ? 'Cấu hình Đa hãng & Biên dịch CLI' : 'Multi-Vendor Configuration & CLI'}
        </h1>

        {/* 3-Way Mode Switcher + Datasheet Sync */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenDatasheetSync && (
            <button
              type="button"
              onClick={onOpenDatasheetSync}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isVi ? 'Cập nhật Hãng & CLI' : 'Sync Vendor CLI DB'}</span>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isVi ? 'Cấu hình Trực quan' : 'Visual GUI'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'batch'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{isVi ? 'Đẩy Lệnh Hàng loạt' : 'Batch CLI Push'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'diff'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span>{isVi ? 'So sánh & Rollback' : 'Diff & Rollback'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VISUAL HOOK & CONFIGURE GUI (Switch / Router / Firewall)       */}
      {/* ===================================================================== */}
      {activeTab === 'visual' && hookedDevice && (
        <div className="space-y-6">
          {/* Device Connection / Hook Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Hooked Target Appliance (Switch / Router / Firewall)
                  </label>
                  <select
                    value={hookedDevice.id}
                    onChange={(e) => {
                      setHookedDeviceId(e.target.value);
                      setSelectedPortName('');
                      setSessionHandshakeMsg(null);
                    }}
                    className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[310px]"
                  >
                    {configurableDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.role}] {d.hostname} · {d.vendor} ({d.ip})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Control Plane Driver
                  </label>
                  <select
                    value={mgmtTransport}
                    onChange={(e) =>
                      setMgmtTransport(
                        e.target.value as 'NETCONF' | 'RESTCONF' | 'Vendor-API' | 'SSHv2'
                      )
                    }
                    className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="NETCONF">NETCONF / YANG (TCP 830)</option>
                    <option value="RESTCONF">RESTCONF HTTPS (TCP 443)</option>
                    <option value="Vendor-API">Vendor Native API (FortiOS / PAN-OS)</option>
                    <option value="SSHv2">SSHv2 Expect Session (TCP 22)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-xs hidden sm:block">
                  <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>
                      {hookedDevice.status === DeviceStatus.Offline
                        ? 'Staged Offline Mode'
                        : `Connected (${hookedDevice.vendor})`}
                    </span>
                  </div>
                  <div className="font-mono text-slate-500">
                    {hookedDevice.model} · {hookedDevice.osVersion}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResyncHookSession}
                  disabled={isSessionSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSessionSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>{isSessionSyncing ? 'Syncing YANG/MIB...' : 'Sync Device State'}</span>
                </button>
              </div>
            </div>

            {sessionHandshakeMsg && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{sessionHandshakeMsg}</span>
              </div>
            )}
          </div>

          {/* Main Split: Left = Visual GUI Controls, Right = Native Vendor CLI & Live Terminal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT PANE: Visual GUI Configurator */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {/* Visual Module Sub-Tabs */}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5 bg-slate-50/70 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setVisualSubTab('ports')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    visualSubTab === 'ports'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Cable className="w-3.5 h-3.5" />
                  <span>Ports & Interfaces ({hookedDevice.interfaces.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualSubTab('vlans')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    visualSubTab === 'vlans'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>VLANs & SVIs ({(hookedDevice.vlans || []).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualSubTab('firewall')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    visualSubTab === 'firewall'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Firewall & ACL ({(hookedDevice.firewallRules || []).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualSubTab('routing')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    visualSubTab === 'routing'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Routing Table ({(hookedDevice.routes || []).length})</span>
                </button>
              </div>

              {/* SUB-TAB 1: VISUAL PORT & INTERFACE CONFIGURATOR */}
              {visualSubTab === 'ports' && (
                <div className="p-5 space-y-5 text-xs">
                  <div>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Click a Physical Port to Configure Visually:
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-3 rounded-xl bg-slate-900 border border-slate-700">
                      {hookedDevice.interfaces.map((ifc, idx) => {
                        const isShut = (ifc.adminStatus ?? 'up') === 'down';
                        const isUp =
                          hookedDevice.status !== DeviceStatus.Offline &&
                          !isShut &&
                          ifc.status === 'up';
                        const isSel = selectedPortObj?.name === ifc.name;

                        return (
                          <button
                            key={ifc.name}
                            type="button"
                            onClick={() => setSelectedPortName(ifc.name)}
                            className={`p-2 rounded-lg border font-mono text-left transition-all ${
                              isSel
                                ? 'bg-slate-800 border-blue-400 ring-2 ring-blue-500/40'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>P{String(idx + 1).padStart(2, '0')}</span>
                              <span
                                className={`w-2 h-2 rounded-xs ${
                                  isUp
                                    ? 'bg-emerald-400'
                                    : isShut
                                    ? 'bg-amber-500'
                                    : 'bg-slate-700'
                                }`}
                              />
                            </div>
                            <div className="text-[10px] text-slate-200 truncate">{ifc.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedPortObj && (
                    <form
                      onSubmit={commitVisualPortUpdate}
                      className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100">
                          Editing Interface: {selectedPortObj.name}
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setPortAdminUp(true)}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              portAdminUp
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Admin UP (no shut)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPortAdminUp(false)}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              !portAdminUp
                                ? 'bg-rose-600 text-white'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Admin SHUTDOWN
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Port Operating Mode
                          </label>
                          <select
                            value={portMode}
                            onChange={(e) =>
                              setPortMode(e.target.value as 'access' | 'trunk' | 'routed')
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          >
                            <option value="access">Layer-2 Access Port</option>
                            <option value="trunk">802.1Q VLAN Trunk</option>
                            <option value="routed">Layer-3 Routed Port</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {portMode === 'trunk'
                              ? 'Allowed VLAN IDs (e.g. Trunk 10,20,100)'
                              : 'Assigned VLAN / Zone'}
                          </label>
                          <input
                            type="text"
                            value={portVlan}
                            onChange={(e) => setPortVlan(e.target.value)}
                            className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Layer-3 IPv4 CIDR (Optional)
                          </label>
                          <input
                            type="text"
                            value={portIp}
                            onChange={(e) => setPortIp(e.target.value)}
                            placeholder="e.g. 10.10.20.1/24"
                            className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Port Alias / Description
                          </label>
                          <input
                            type="text"
                            value={portDesc}
                            onChange={(e) => setPortDesc(e.target.value)}
                            placeholder="e.g. Uplink-Core-Switch"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Apply Port Config to {hookedDevice.vendor}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: VISUAL VLAN & SVI MANAGER */}
              {visualSubTab === 'vlans' && (
                <div className="p-5 space-y-5 text-xs">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                    {(hookedDevice.vlans || []).length === 0 ? (
                      <div className="py-4 text-slate-500">
                        No VLANs currently defined on this device. Add one below.
                      </div>
                    ) : (
                      (hookedDevice.vlans || []).map((v) => (
                        <div
                          key={v.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="font-mono">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              VLAN {v.id}
                            </span>
                            <span className="mx-2 text-slate-400">·</span>
                            <span className="text-slate-700 dark:text-slate-300">{v.name}</span>
                            {v.sviIp && (
                              <>
                                <span className="mx-2 text-slate-400">·</span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  SVI {v.sviIp}
                                </span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteVlan(v.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete VLAN"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={commitVisualVlanCreate} className="space-y-3.5">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Create New 802.1Q VLAN & SVI Gateway
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          VLAN ID
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          required
                          value={newVlanId}
                          onChange={(e) => setNewVlanId(Number(e.target.value) || 100)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          VLAN Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newVlanName}
                          onChange={(e) => setNewVlanName(e.target.value)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          SVI Gateway CIDR
                        </label>
                        <input
                          type="text"
                          value={newVlanSvi}
                          onChange={(e) => setNewVlanSvi(e.target.value)}
                          placeholder="Optional L3 IP/24"
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Commit VLAN to {hookedDevice.vendor}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SUB-TAB 3: VISUAL FIREWALL & SECURITY POLICY BUILDER */}
              {visualSubTab === 'firewall' && (
                <div className="p-5 space-y-5 text-xs">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                    {(hookedDevice.firewallRules || []).length === 0 ? (
                      <div className="py-4 text-slate-500">
                        No visual security policies configured on this appliance yet.
                      </div>
                    ) : (
                      (hookedDevice.firewallRules || []).map((rule) => (
                        <div
                          key={rule.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className={rule.enabled ? '' : 'opacity-50 line-through'}>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {rule.name} ·{' '}
                              <span
                                className={
                                  rule.action === 'accept'
                                    ? 'text-emerald-600 dark:text-emerald-400 font-mono uppercase'
                                    : 'text-rose-600 dark:text-rose-400 font-mono uppercase'
                                }
                              >
                                {rule.action}
                              </span>
                            </div>
                            <div className="font-mono text-slate-500">
                              {rule.srcZone} ({rule.srcCidr}) → {rule.dstZone} ({rule.dstCidr}) ·{' '}
                              {rule.protocol}/{rule.port}
                              {rule.nat ? ' · SNAT' : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExistingFirewallRule(rule.id)}
                            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={commitVisualFirewallRule} className="space-y-3.5">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Add Visual Firewall / ACL Policy Rule
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Policy Rule Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fwName}
                          onChange={(e) => setFwName(e.target.value)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Action & Protocol/Port
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={fwAction}
                            onChange={(e) => setFwAction(e.target.value as 'accept' | 'deny')}
                            className="w-1/3 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          >
                            <option value="accept">ACCEPT</option>
                            <option value="deny">DENY</option>
                          </select>
                          <select
                            value={fwProtocol}
                            onChange={(e) =>
                              setFwProtocol(
                                e.target.value as 'TCP' | 'UDP' | 'ICMP' | 'ANY'
                              )
                            }
                            className="w-1/3 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          >
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                            <option value="ICMP">ICMP</option>
                            <option value="ANY">ANY</option>
                          </select>
                          <input
                            type="text"
                            value={fwPort}
                            onChange={(e) => setFwPort(e.target.value)}
                            className="w-1/3 px-2 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Source Zone & CIDR
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={fwSrcZone}
                            onChange={(e) => setFwSrcZone(e.target.value)}
                            className="w-2/5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                          <input
                            type="text"
                            value={fwSrcCidr}
                            onChange={(e) => setFwSrcCidr(e.target.value)}
                            className="w-3/5 px-2.5 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Destination Zone & CIDR
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={fwDstZone}
                            onChange={(e) => setFwDstZone(e.target.value)}
                            className="w-2/5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                          <input
                            type="text"
                            value={fwDstCidr}
                            onChange={(e) => setFwDstCidr(e.target.value)}
                            className="w-3/5 px-2.5 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fwNat}
                            onChange={(e) => setFwNat(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>Enable Source NAT</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fwLog}
                            onChange={(e) => setFwLog(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>Log Traffic to SIEM</span>
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Commit Policy to {hookedDevice.vendor}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SUB-TAB 4: VISUAL ROUTING TABLE CONFIGURATOR */}
              {visualSubTab === 'routing' && (
                <div className="p-5 space-y-5 text-xs">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                    {(hookedDevice.routes || []).length === 0 ? (
                      <div className="py-4 text-slate-500">
                        Only connected interface subnets present. Add a static/dynamic route below.
                      </div>
                    ) : (
                      (hookedDevice.routes || []).map((r) => (
                        <div
                          key={r.id}
                          className="py-2.5 flex items-center justify-between font-mono"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {r.prefix}
                            </span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-blue-600 dark:text-blue-400">{r.nextHop}</span>
                            <span className="mx-2 text-slate-400">·</span>
                            <span className="text-slate-500">
                              {r.protocol} (AD {r.metric}) via {r.interfaceName}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={commitVisualRoute} className="space-y-3.5">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Add IPv4 Route Entry
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Destination Prefix CIDR
                        </label>
                        <input
                          type="text"
                          required
                          value={rtPrefix}
                          onChange={(e) => setRtPrefix(e.target.value)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Next-Hop Gateway IP
                        </label>
                        <input
                          type="text"
                          required
                          value={rtNextHop}
                          onChange={(e) => setRtNextHop(e.target.value)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Egress Interface
                        </label>
                        <select
                          value={rtIface}
                          onChange={(e) => setRtIface(e.target.value)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {hookedDevice.interfaces.map((i) => (
                            <option key={i.name} value={i.name}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Administrative Distance
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={rtMetric}
                          onChange={(e) => setRtMetric(Number(e.target.value) || 10)}
                          className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Commit Route to {hookedDevice.vendor}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* RIGHT PANE: Auto-Compiled Native Vendor CLI + Live Interactive Device Console */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRightPaneMode('cli')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                      rightPaneMode === 'cli'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Auto-Generated {hookedDevice.vendor} CLI
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPaneMode('console')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                      rightPaneMode === 'console'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Live Device Terminal
                  </button>
                </div>

                {rightPaneMode === 'cli' && (
                  <button
                    type="button"
                    onClick={() => handleCopyCli(liveVisualCliPreview)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    {copiedCli ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {rightPaneMode === 'cli' ? (
                <div className="p-5 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed min-h-[360px] flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 pb-2.5 mb-3 border-b border-slate-800">
                      Translating GUI controls → Native {hookedDevice.vendor} ({hookedDevice.osVersion})
                    </div>
                    <pre className="whitespace-pre-wrap text-emerald-300">
                      {liveVisualCliPreview}
                    </pre>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-400">
                    Tip: Switch to "Live Device Terminal" above to verify interfaces, VLANs, and routes directly on {hookedDevice.hostname.split('.')[0]}.
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 text-slate-100 font-mono text-xs flex flex-col h-[390px]">
                  {/* Quick Diagnostic Commands */}
                  <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center gap-1.5">
                    {['show interfaces', 'show vlan', 'show route', 'show version', 'ping 10.10.0.1'].map(
                      (qCmd) => (
                        <button
                          key={qCmd}
                          type="button"
                          onClick={() => runConsoleCmd(qCmd)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-blue-300"
                        >
                          {qCmd}
                        </button>
                      )
                    )}
                  </div>

                  {/* Output Scrollback */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                    {consoleHistory.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-blue-400">
                          {hookedDevice.hostname.split('.')[0]}# {item.cmd}
                        </div>
                        <pre className="text-slate-300 whitespace-pre-wrap text-[11px]">
                          {item.output}
                        </pre>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Prompt */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      runConsoleCmd();
                    }}
                    className="p-2.5 border-t border-slate-800 flex items-center gap-2"
                  >
                    <span className="text-emerald-400 shrink-0">
                      {hookedDevice.hostname.split('.')[0]}#
                    </span>
                    <input
                      type="text"
                      value={consoleInput}
                      onChange={(e) => setConsoleInput(e.target.value)}
                      placeholder="Type command (e.g. show interfaces, help)..."
                      className="flex-1 bg-transparent text-slate-100 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MULTI-VENDOR BATCH POLICY COMPILER                             */}
      {/* ===================================================================== */}
      {activeTab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  1. Select Multi-Vendor Target Devices ({selectedDeviceIds.length} selected)
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedDeviceIds(devices.map((d) => d.id))}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDeviceIds([])}
                    className="text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {devices.map((dev) => {
                  const checked = selectedDeviceIds.includes(dev.id);
                  return (
                    <label
                      key={dev.id}
                      className="py-2 px-2 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTargetDevice(dev.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                          {dev.hostname}
                        </span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                        {dev.vendor} · {dev.ip}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
                2. Unified Configuration Template
              </h2>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
                {(
                  [
                    { id: 'vlan', label: 'VLAN & Trunk' },
                    { id: 'baseline', label: 'Hardening & NTP/Syslog' },
                    { id: 'acl', label: 'Security ACL / Firewall' },
                    { id: 'bgp', label: 'eBGP Peering' },
                    { id: 'custom', label: 'Custom CLI' },
                  ] as const
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setPayload((p) => ({ ...p, templateType: tpl.id }));
                      setDryRunResult(null);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      payload.templateType === tpl.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {payload.templateType === 'vlan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      VLAN ID
                    </label>
                    <input
                      type="number"
                      value={payload.vlanId}
                      onChange={(e) =>
                        setPayload((p) => ({ ...p, vlanId: Number(e.target.value) || 100 }))
                      }
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      VLAN Name
                    </label>
                    <input
                      type="text"
                      value={payload.vlanName}
                      onChange={(e) => setPayload((p) => ({ ...p, vlanName: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SVI Gateway CIDR
                    </label>
                    <input
                      type="text"
                      value={payload.sviCidr}
                      onChange={(e) => setPayload((p) => ({ ...p, sviCidr: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Trunk Uplinks
                    </label>
                    <input
                      type="text"
                      value={payload.trunkPorts}
                      onChange={(e) => setPayload((p) => ({ ...p, trunkPorts: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {payload.templateType === 'baseline' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Primary NTP Server
                    </label>
                    <input
                      type="text"
                      value={payload.ntpPrimary}
                      onChange={(e) => setPayload((p) => ({ ...p, ntpPrimary: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Remote Syslog Collector
                    </label>
                    <input
                      type="text"
                      value={payload.syslogServer}
                      onChange={(e) => setPayload((p) => ({ ...p, syslogServer: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SNMPv3 Location
                    </label>
                    <input
                      type="text"
                      value={payload.snmpLocation}
                      onChange={(e) => setPayload((p) => ({ ...p, snmpLocation: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={payload.disableTelnet}
                        onChange={(e) =>
                          setPayload((p) => ({ ...p, disableTelnet: e.target.checked }))
                        }
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Disable Telnet & Enforce SSHv2</span>
                    </label>
                  </div>
                </div>
              )}

              {payload.templateType === 'acl' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Policy Name
                    </label>
                    <input
                      type="text"
                      value={payload.aclName}
                      onChange={(e) => setPayload((p) => ({ ...p, aclName: e.target.value }))}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={payload.aclPort}
                      onChange={(e) =>
                        setPayload((p) => ({ ...p, aclPort: Number(e.target.value) || 443 }))
                      }
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {payload.templateType === 'bgp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Local ASN
                    </label>
                    <input
                      type="number"
                      value={payload.bgpLocalAsn}
                      onChange={(e) =>
                        setPayload((p) => ({ ...p, bgpLocalAsn: Number(e.target.value) || 65001 }))
                      }
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Neighbor Peer IPv4
                    </label>
                    <input
                      type="text"
                      value={payload.bgpNeighborIp}
                      onChange={(e) =>
                        setPayload((p) => ({ ...p, bgpNeighborIp: e.target.value }))
                      }
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {payload.templateType === 'custom' && (
                <textarea
                  rows={4}
                  value={payload.customCli}
                  onChange={(e) => setPayload((p) => ({ ...p, customCli: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={selectedDevices.length === 0}
                onClick={handleDryRun}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Dry-Run Validation</span>
              </button>

              <button
                type="button"
                disabled={selectedDevices.length === 0}
                onClick={handleDeployBatch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Push Config to {selectedDevices.length} Nodes</span>
              </button>
            </div>

            {dryRunResult && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{dryRunResult}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Generated Multi-Vendor CLI Preview
              </h2>
              <button
                type="button"
                onClick={() => handleCopyCli(compiledPreviewCli)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
            {selectedDevices.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
                {selectedDevices.map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setPreviewDeviceId(dev.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md whitespace-nowrap shrink-0 ${
                      activePreviewDevice?.id === dev.id
                        ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {dev.hostname.split('.')[0]} ({dev.vendor})
                  </button>
                ))}
              </div>
            )}
            <div className="p-5 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed min-h-[340px]">
              <pre className="whitespace-pre-wrap">{compiledPreviewCli}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CONFIG BACKUP, DRIFT DIFF & 1-CLICK ROLLBACK                   */}
      {/* ===================================================================== */}
      {activeTab === 'diff' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={diffDevice?.id || ''}
                onChange={(e) => {
                  setDiffDeviceId(e.target.value);
                  setSelectedHistoryRevId('');
                }}
                className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {devices.map((d) => {
                  const drifted = d.runningConfig.trim() !== d.goldenBaselineConfig.trim();
                  return (
                    <option key={d.id} value={d.id}>
                      {d.hostname} ({d.vendor}){drifted ? ' — Drift Detected' : ' — Synced'}
                    </option>
                  );
                })}
              </select>

              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as 'baseline' | 'history')}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="baseline">Compare vs Golden Baseline</option>
                <option value="history">Compare vs Archived Revision</option>
              </select>

              {compareMode === 'history' && diffDevice && (
                <select
                  value={selectedHistoryRevId}
                  onChange={(e) => setSelectedHistoryRevId(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {diffDevice.configHistory.map((rev) => (
                    <option key={rev.id} value={rev.id}>
                      {rev.versionLabel} · {rev.timestamp}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {diffDevice && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!hasDrift}
                  onClick={() => onPromoteGoldenBaseline(diffDevice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Accept Running as Golden</span>
                </button>
                <button
                  type="button"
                  disabled={!hasDrift}
                  onClick={() =>
                    onRollbackDeviceConfig(
                      diffDevice.id,
                      referenceConfigText,
                      compareMode === 'baseline' ? 'Golden Baseline' : 'Archived Snapshot'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rollback to Reference</span>
                </button>
              </div>
            )}
          </div>

          {diffDevice && (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="lg:col-span-8 p-5">
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs overflow-x-auto space-y-0.5">
                  {diffLines.map((line, index) => (
                    <div
                      key={index}
                      className={`px-2 py-0.5 rounded-xs flex items-start gap-3 ${
                        line.type === 'added'
                          ? 'bg-emerald-950/80 text-emerald-300'
                          : line.type === 'removed'
                          ? 'bg-rose-950/80 text-rose-300'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="w-4 select-none opacity-70 shrink-0">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Configuration Revisions ({diffDevice.configHistory.length})</span>
                </h3>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {diffDevice.configHistory.map((rev) => (
                    <div key={rev.id} className="py-3 first:pt-1 text-xs space-y-1">
                      <div className="flex items-center justify-between font-medium">
                        <span>{rev.versionLabel}</span>
                        <span className="font-mono text-slate-500">{rev.timestamp}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{rev.summary}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400 font-mono">by {rev.author}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onRollbackDeviceConfig(diffDevice.id, rev.content, rev.versionLabel)
                          }
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
