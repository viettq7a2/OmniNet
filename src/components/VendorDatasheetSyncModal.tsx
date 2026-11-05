import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  DeviceRole,
  DeviceStatus,
  NetworkDevice,
  VendorDatasheetProfile,
  VendorName,
} from '../types/network';
import { AppLanguage } from '../utils/i18n';

interface VendorDatasheetSyncModalProps {
  isOpen: boolean;
  onClose?: () => void;
  lang?: AppLanguage;
  syncedProfiles: VendorDatasheetProfile[];
  onSaveProfile: (profile: VendorDatasheetProfile) => void;
  onAddDeviceFromProfile: (newDevice: NetworkDevice) => void;
}

const QUICK_VENDOR_PRESETS = [
  {
    label: 'Ubiquiti UniFi Switch Pro Max',
    vendor: 'Ubiquiti UniFi',
    model: 'USW-Pro-Max-48-PoE',
    osVersion: 'UniFi OS 4.0.6 / Network 8.5.6',
    hostname: 'usw-promax-fl2.corp.local',
    ip: '10.20.10.45',
  },
  {
    label: 'Aruba CX 6300M (AOS-CX 10.13)',
    vendor: 'Aruba',
    model: 'Aruba CX 6300M 48SR5 (JL659A)',
    osVersion: 'AOS-CX 10.13.1010',
    hostname: 'sw-aruba-cx6300.corp.local',
    ip: '10.20.10.46',
  },
  {
    label: 'HPE FlexFabric 5945 (Comware v7)',
    vendor: 'HPE Comware',
    model: 'HPE FlexFabric 5945 48SFP28 (JQ074A)',
    osVersion: 'Comware Software, Version 7.1.070',
    hostname: 'sw-hpe-5945-tor2.corp.local',
    ip: '10.10.0.18',
  },
  {
    label: 'HP ProCurve 2920-48G (PVOS 16.11)',
    vendor: 'HP ProCurve',
    model: 'HP ProCurve 2920-48G-PoE+ (J9729A)',
    osVersion: 'ProCurve OS WB.16.11.0014',
    hostname: 'sw-hp-procurve-2920.corp.local',
    ip: '10.20.10.48',
  },
  {
    label: 'Cisco Catalyst 9500 (IOS-XE 17.12)',
    vendor: 'Cisco IOS-XE',
    model: 'Catalyst C9500-48Y4C',
    osVersion: 'IOS-XE 17.12.3',
    hostname: 'sw-core-c9500.corp.local',
    ip: '10.10.0.19',
  },
];

export const VendorDatasheetSyncModal: React.FC<VendorDatasheetSyncModalProps> = ({
  isOpen,
  lang = 'vi',
  syncedProfiles,
  onSaveProfile,
  onAddDeviceFromProfile,
}) => {
  const isVi = lang === 'vi';
  const [vendorInput, setVendorInput] = useState('Ubiquiti UniFi');
  const [modelInput, setModelInput] = useState('USW-Pro-Max-48-PoE');
  const [osVersionInput, setOsVersionInput] = useState('UniFi OS 4.0.6 / Network 8.5.6');
  const [newHostname, setNewHostname] = useState('usw-promax-fl2.corp.local');
  const [newMgmtIp, setNewMgmtIp] = useState('10.20.10.45');
  const [newSite, setNewSite] = useState('SGN-Campus HQ');

  const [isSyncing, setIsSyncing] = useState(false);
  const [activeProfile, setActiveProfile] = useState<VendorDatasheetProfile | null>(
    syncedProfiles[0] || null
  );
  const [activeCliTab, setActiveCliTab] = useState<'vlan' | 'baseline' | 'acl'>('vlan');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncDatasheet = async (
    overrideVendor?: string,
    overrideModel?: string,
    overrideOs?: string
  ) => {
    const v = overrideVendor ?? vendorInput;
    const m = overrideModel ?? modelInput;
    const os = overrideOs ?? osVersionInput;

    setIsSyncing(true);
    setAddedToast(null);
    try {
      const response = await fetch('/api/vendor/datasheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: v,
          model: m,
          osVersion: os,
        }),
      });
      const data: VendorDatasheetProfile = await response.json();
      setActiveProfile(data);
      onSaveProfile(data);
    } catch {
      // Fallback handled on server
    } finally {
      setIsSyncing(false);
    }
  };

  const mapToSupportedVendor = (raw: string): VendorName => {
    const lower = raw.toLowerCase();
    if (lower.includes('unifi') || lower.includes('ubiquiti')) return 'Ubiquiti UniFi';
    if (lower.includes('procurve') || (lower.includes('hp ') && !lower.includes('comware')))
      return 'HP ProCurve';
    if (lower.includes('comware') || lower.includes('hpe')) return 'HPE Comware';
    if (lower.includes('aruba')) return 'Aruba';
    if (lower.includes('nx-os') || lower.includes('nexus')) return 'Cisco NX-OS';
    if (lower.includes('cisco') || lower.includes('ios')) return 'Cisco IOS-XE';
    if (lower.includes('forti')) return 'Fortinet';
    if (lower.includes('palo')) return 'Palo Alto';
    if (lower.includes('juniper') || lower.includes('junos')) return 'Juniper';
    if (lower.includes('mikrotik')) return 'MikroTik';
    return 'Aruba';
  };

  const handleProvisionDeviceToInventory = () => {
    if (!activeProfile) return;
    const mappedVendor = mapToSupportedVendor(activeProfile.vendor);
    const hostnameClean =
      newHostname.trim() ||
      `${activeProfile.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.floor(10 + Math.random() * 89)}.corp.local`;
    const ipClean = newMgmtIp.trim() || `10.20.10.${Math.floor(40 + Math.random() * 150)}`;

    const createdDevice: NetworkDevice = {
      id: `dev-sync-${Date.now()}`,
      hostname: hostnameClean,
      ip: ipClean,
      mac: `F4:92:BF:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:10`,
      vendor: mappedVendor,
      model: activeProfile.model,
      osVersion: activeProfile.osVersion,
      role: DeviceRole.Switch,
      status: DeviceStatus.Online,
      site: newSite,
      rack: 'Rack B03 · RU 24',
      serialNumber: `SN${Math.floor(10000000 + Math.random() * 89999999)}`,
      assetTag: `AST-SYNC-${Math.floor(100 + Math.random() * 899)}`,
      department: 'Campus & DC Operations',
      purchaseDate: '2025-01-15',
      warrantyExpiry: '2030-01-15',
      uptimeSeconds: 864000,
      cpuLoad: 19,
      memoryUsage: 42,
      tempCelsius: 38,
      inboundMbps: 320.5,
      outboundMbps: 295.0,
      latencyMs: 2.1,
      packetLossPct: 0,
      openPorts: [22, 443, 161],
      discoveryMethod: 'SNMPv3 + LLDP',
      mgmtProtocol: (activeProfile.mgmtProtocols?.[0] as any) || 'SSHv2',
      lastSeen: 'Just now',
      topologyTier: 2,
      canvasPos: { x: 450, y: 345 },
      interfaces: [
        {
          name:
            mappedVendor === 'Ubiquiti UniFi'
              ? '0/1'
              : mappedVendor === 'HPE Comware'
              ? 'Twenty-FiveGigE1/0/1'
              : mappedVendor === 'HP ProCurve'
              ? '1'
              : '1/1/1',
          description: 'Access-VLAN20-Port',
          status: 'up',
          adminStatus: 'up',
          portType: 'RJ45-1G',
          mode: 'access',
          speedMbps: 1000,
          vlan: 'VLAN 20',
          rxMbps: 84.2,
          txMbps: 72.1,
          protocol: 'LLDP',
        },
        {
          name:
            mappedVendor === 'Ubiquiti UniFi'
              ? '0/49'
              : mappedVendor === 'HPE Comware'
              ? 'Twenty-FiveGigE1/0/49'
              : mappedVendor === 'HP ProCurve'
              ? '49'
              : '1/1/49',
          description: 'Core-Uplink-Trunk',
          status: 'up',
          adminStatus: 'up',
          portType: 'SFP+-10G',
          mode: 'trunk',
          speedMbps: 10000,
          vlan: 'Trunk 10,20,30',
          rxMbps: 236.3,
          txMbps: 222.9,
          connectedToId: 'dev-sw-02',
          connectedToHostname: 'sw-dist-hq01.corp.local',
          connectedPort: '1/1/49',
          protocol: 'LLDP',
        },
      ],
      vlans: [
        { id: 10, name: 'MGMT_VLAN', sviIp: `${ipClean}/24`, status: 'active' },
        { id: 20, name: 'CORP_DATA', sviIp: '10.20.20.1/24', status: 'active' },
      ],
      runningConfig: `${activeProfile.sampleBaselineCli}\n\n${activeProfile.sampleVlanCli}`,
      goldenBaselineConfig: `${activeProfile.sampleBaselineCli}\n\n${activeProfile.sampleVlanCli}`,
      configHistory: [
        {
          id: `rev-${Date.now()}`,
          versionLabel: 'v1 (Datasheet Synced)',
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          author: 'datasheet-live-sync',
          summary: `Synced ${activeProfile.vendor} ${activeProfile.model} (${activeProfile.osVersion}) CLI template`,
          content: `${activeProfile.sampleBaselineCli}\n\n${activeProfile.sampleVlanCli}`,
        },
      ],
    };

    onAddDeviceFromProfile(createdDevice);
    setAddedToast(
      isVi
        ? `Đã cập nhật CSDL & thêm thiết bị ${hostnameClean} (${activeProfile.vendor} · ${activeProfile.osVersion}) vào danh sách quản lý!`
        : `Updated database & onboarded ${hostnameClean} (${activeProfile.vendor} · ${activeProfile.osVersion}) to inventory!`
    );
  };

  return (
    <div className="space-y-4">
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col">
        {/* Clean Inline Header (No X close button, no verbose subtitle) */}
        <div className="px-5 py-3.5 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-white">
                {isVi
                  ? 'CSDL Hãng Thiết Bị, Datasheet & Tập Lệnh CLI theo OS'
                  : 'Vendor Hardware Datasheet & OS-Version CLI Database'}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {isVi ? 'Đồng bộ Trực tuyến' : 'Live Datasheet Sync'}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 bg-slate-950 text-slate-100">
          {/* Quick Presets */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isVi ? 'Chọn nhanh dòng thiết bị phổ biến:' : 'Quick Vendor & Model Presets:'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_VENDOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setVendorInput(preset.vendor);
                    setModelInput(preset.model);
                    setOsVersionInput(preset.osVersion);
                    setNewHostname(preset.hostname);
                    setNewMgmtIp(preset.ip);
                    handleSyncDatasheet(preset.vendor, preset.model, preset.osVersion);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-cyan-500/50 transition-all flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                {isVi ? 'Tên Hãng (Vendor)' : 'Vendor Name'}
              </label>
              <input
                type="text"
                value={vendorInput}
                onChange={(e) => setVendorInput(e.target.value)}
                placeholder="Ubiquiti UniFi, Aruba, HPE Comware..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                {isVi ? 'Mã Thiết bị (Model)' : 'Hardware Model'}
              </label>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="USW-Pro-48-PoE, J9729A, FlexFabric 5945..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                {isVi ? 'Phiên bản OS / Firmware' : 'OS / Firmware Version'}
              </label>
              <input
                type="text"
                value={osVersionInput}
                onChange={(e) => setOsVersionInput(e.target.value)}
                placeholder="UniFi OS 4.0.6, WB.16.11, Comware v7.1..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => handleSyncDatasheet()}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors h-[34px]"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isVi ? 'Đang đồng bộ...' : 'Syncing...'}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{isVi ? 'Đồng bộ Datasheet' : 'Sync Datasheet'}</span>
                </>
              )}
            </button>
          </div>

          {addedToast && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{addedToast}</span>
            </div>
          )}

          {/* Active Datasheet & OS-Version CLI Profile */}
          {activeProfile && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Specs, OS Differences & Forum Citations */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {activeProfile.vendor}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {activeProfile.syncedAt}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{activeProfile.model}</h3>
                    <p className="text-xs font-mono text-cyan-400 mt-0.5">
                      {activeProfile.osFamily} · {activeProfile.osVersion}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isVi ? 'Băng thông' : 'Capacity'}
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {activeProfile.switchingCapacityGbps}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isVi ? 'Chuyển mạch' : 'Forwarding'}
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {activeProfile.forwardingRateMpps}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isVi ? 'Công suất PoE' : 'PoE Budget'}
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">
                        {activeProfile.poeBudgetWatts}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeProfile.cliDialectSummary}
                  </p>
                </div>

                {/* Version-specific CLI differences */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>
                      {isVi
                        ? 'Khác biệt lệnh CLI giữa các phiên bản OS'
                        : 'OS Version CLI Dialect Differences'}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {activeProfile.versionCliDifferences.map((diff, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-300 leading-relaxed flex items-start gap-2"
                      >
                        <span className="text-amber-400 font-mono font-bold mt-0.5">•</span>
                        <span>{diff}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Datasheet & Forum Sources */}
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>
                      {isVi ? 'Nguồn Datasheet & Tài liệu Hãng' : 'Official Datasheet & Vendor Docs'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeProfile.datasheetSources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        <span className="truncate pr-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {src.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: OS-Version-Specific CLI Preview & Provision to Inventory */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        {isVi
                          ? `Mẫu lệnh CLI chuẩn (${activeProfile.osVersion})`
                          : `Standard CLI Templates (${activeProfile.osVersion})`}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setActiveCliTab('vlan')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                          activeCliTab === 'vlan'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        VLAN & Trunk
                      </button>
                      <button
                        onClick={() => setActiveCliTab('baseline')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                          activeCliTab === 'baseline'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Hardening
                      </button>
                      <button
                        onClick={() => setActiveCliTab('acl')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                          activeCliTab === 'acl'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Security ACL
                      </button>
                    </div>
                  </div>

                  <pre className="mt-3 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto flex-1 leading-relaxed">
                    {activeCliTab === 'vlan'
                      ? activeProfile.sampleVlanCli
                      : activeCliTab === 'baseline'
                      ? activeProfile.sampleBaselineCli
                      : activeProfile.sampleAclCli}
                  </pre>
                </div>

                {/* Add to Managed Inventory Box */}
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>
                        {isVi
                          ? `Khởi tạo thiết bị ${activeProfile.vendor} vào CMDB`
                          : `Provision ${activeProfile.vendor} Node to CMDB`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300">
                      {activeProfile.osVersion}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Hostname
                      </label>
                      <input
                        type="text"
                        value={newHostname}
                        onChange={(e) => setNewHostname(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Management IP
                      </label>
                      <input
                        type="text"
                        value={newMgmtIp}
                        onChange={(e) => setNewMgmtIp(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Site / Data Center
                      </label>
                      <select
                        value={newSite}
                        onChange={(e) => setNewSite(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        <option value="SGN-Campus HQ">SGN-Campus HQ</option>
                        <option value="HN-DC1 Core">HN-DC1 Core</option>
                        <option value="DN-Branch Edge">DN-Branch Edge</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleProvisionDeviceToInventory}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {isVi
                          ? 'Thêm Thiết bị & Lưu Tập lệnh vào CSDL'
                          : 'Add Node & Save CLI Profile'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
