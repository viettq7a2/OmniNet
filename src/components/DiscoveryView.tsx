import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Play,
  Plus,
  Radar,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  DeviceRole,
  DeviceStatus,
  DiscoveryCandidate,
  DiscoverySchedule,
  NetworkDevice,
  VendorName,
} from '../types/network';
import { SUBNET_DISCOVERY_CATALOG } from '../data/initialNetworkData';

interface DiscoveryViewProps {
  devices: NetworkDevice[];
  schedules: DiscoverySchedule[];
  onToggleSchedule: (id: string) => void;
  onImportDiscoveredDevices: (newDevices: NetworkDevice[]) => void;
}

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

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  devices,
  schedules,
  onToggleSchedule,
  onImportDiscoveredDevices,
}) => {
  const [cidrInput, setCidrInput] = useState('172.16.40.0/24');
  const [targetSite, setTargetSite] = useState('HN-DC1 Core');
  const [protocols, setProtocols] = useState({
    snmpv3: true,
    lldpCdp: true,
    sshBanner: true,
    netconf: true,
  });
  const [isScanningSubnet, setIsScanningSubnet] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);

  // Live Backend TCP / DNS Probe State
  const [liveHostInput, setLiveHostInput] = useState('1.1.1.1');
  const [livePortsInput, setLivePortsInput] = useState('22, 53, 80, 443');
  const [isProbingHost, setIsProbingHost] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [liveProbeResult, setLiveProbeResult] = useState<LiveProbeResult | null>(null);

  const runSubnetDiscovery = (overrideCidr?: string, overrideSite?: string) => {
    const activeCidr = (overrideCidr ?? cidrInput).trim();
    const activeSite = overrideSite ?? targetSite;
    if (!activeCidr) return;

    setCidrInput(activeCidr);
    setIsScanningSubnet(true);
    setScanProgress(15);
    setScanStage(`Sending ICMP & ARP sweep across ${activeCidr}...`);

    setTimeout(() => {
      setScanProgress(52);
      setScanStage('Querying SNMPv3 sysObjectID & LLDP/CDP neighbor tables...');
    }, 350);

    setTimeout(() => {
      setScanProgress(85);
      setScanStage('Fingerprinting vendor OS banners (SSHv2 / NETCONF / HTTPS)...');
    }, 750);

    setTimeout(() => {
      const existingIps = new Set(devices.map((d) => d.ip));
      const catalogItems = SUBNET_DISCOVERY_CATALOG[activeCidr];

      let discoveredList: DiscoveryCandidate[] = [];
      if (catalogItems) {
        discoveredList = catalogItems.map((item) => ({
          ...item,
          selected: !existingIps.has(item.ip),
          alreadyManaged: existingIps.has(item.ip),
        }));
      } else {
        // Synthesize realistic enterprise discovery results for any custom CIDR
        const basePrefix = activeCidr.split('/')[0].split('.').slice(0, 3).join('.') || '10.50.10';
        const generated: Omit<DiscoveryCandidate, 'selected' | 'alreadyManaged'>[] = [
          {
            id: `cand-${Date.now()}-1`,
            hostname: `rtr-${basePrefix.replace(/\./g, '-')}-gw.corp.local`,
            ip: `${basePrefix}.1`,
            mac: '00:50:56:E1:44:01',
            vendor: 'Cisco IOS-XE',
            model: 'Catalyst 8300-1N1S',
            osVersion: 'IOS-XE 17.9.4a',
            role: DeviceRole.Router,
            site: activeSite,
            openPorts: [22, 161, 179],
            latencyMs: 2.4,
            discoveryMethod: 'SNMPv3 + LLDP',
          },
          {
            id: `cand-${Date.now()}-2`,
            hostname: `sw-${basePrefix.replace(/\./g, '-')}-acc01.corp.local`,
            ip: `${basePrefix}.10`,
            mac: '2C:6B:F5:B2:19:10',
            vendor: 'Juniper',
            model: 'EX4400-48P',
            osVersion: 'Junos 23.2R1',
            role: DeviceRole.Switch,
            site: activeSite,
            openPorts: [22, 830],
            latencyMs: 3.1,
            discoveryMethod: 'NETCONF',
          },
          {
            id: `cand-${Date.now()}-3`,
            hostname: `srv-${basePrefix.replace(/\./g, '-')}-app01.corp.local`,
            ip: `${basePrefix}.50`,
            mac: '3C:EC:EF:71:22:50',
            vendor: 'Linux / Server',
            model: 'HPE ProLiant DL360 Gen11',
            osVersion: 'Ubuntu 24.04 LTS',
            role: DeviceRole.Server,
            site: activeSite,
            openPorts: [22, 443, 9100],
            latencyMs: 1.6,
            discoveryMethod: 'SNMPv3 + LLDP',
          },
        ];
        discoveredList = generated.map((item) => ({
          ...item,
          selected: !existingIps.has(item.ip),
          alreadyManaged: existingIps.has(item.ip),
        }));
      }

      setCandidates(discoveredList);
      setScanProgress(100);
      setScanStage(`Discovery complete — ${discoveredList.length} network nodes identified.`);
      setIsScanningSubnet(false);
    }, 1150);
  };

  const toggleCandidateSelection = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id && !c.alreadyManaged ? { ...c, selected: !c.selected } : c))
    );
  };

  const onboardSelectedCandidates = () => {
    const chosen = candidates.filter((c) => c.selected && !c.alreadyManaged);
    if (chosen.length === 0) return;

    const newNodes: NetworkDevice[] = chosen.map((c, idx) => {
      const tier =
        c.role === DeviceRole.Firewall
          ? 0
          : c.role === DeviceRole.Router
          ? 1
          : c.role === DeviceRole.Switch || c.role === DeviceRole.Wireless
          ? 2
          : 3;

      const defaultConfig = `# ${c.vendor} (${c.osVersion}) — ${c.hostname}\n# Onboarded via ${c.discoveryMethod}\nhostname ${c.hostname.split('.')[0]}\nntp server 10.10.0.10 prefer\nlogging host 10.10.0.50\nssh version 2`;

      return {
        id: `dev-disc-${Date.now()}-${idx}`,
        hostname: c.hostname,
        ip: c.ip,
        mac: c.mac,
        vendor: c.vendor,
        model: c.model,
        osVersion: c.osVersion,
        role: c.role,
        status: DeviceStatus.Online,
        site: c.site,
        rack: 'Rack D02 · Auto-Discovered',
        serialNumber: `SN${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        assetTag: `AST-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
        department: 'Network Infrastructure',
        purchaseDate: '2025-01-15',
        warrantyExpiry: '2030-01-15',
        uptimeSeconds: 864000,
        cpuLoad: 18 + (idx * 7) % 35,
        memoryUsage: 38 + (idx * 9) % 30,
        tempCelsius: 37 + (idx % 6),
        inboundMbps: Number((185 + idx * 94.5).toFixed(1)),
        outboundMbps: Number((142 + idx * 78.2).toFixed(1)),
        latencyMs: c.latencyMs,
        packetLossPct: 0,
        openPorts: c.openPorts,
        discoveryMethod: c.discoveryMethod,
        lastSeen: 'Just now',
        topologyTier: tier,
        interfaces: [
          {
            name: c.role === DeviceRole.Server ? 'eno1 (25GbE)' : 'TenGig0/1 (Core-Uplink)',
            status: 'up',
            speedMbps: 10000,
            vlan: 'Trunk 10,40,100',
            rxMbps: Number((185 + idx * 94.5).toFixed(1)),
            txMbps: Number((142 + idx * 78.2).toFixed(1)),
            connectedToId: 'dev-sw-01',
            connectedToHostname: 'sw-core-nx01.corp.local',
            connectedPort: `Eth1/${20 + idx}`,
            protocol: 'LLDP',
          },
        ],
        runningConfig: defaultConfig,
        goldenBaselineConfig: defaultConfig,
        configHistory: [
          {
            id: `rev-init-${Date.now()}-${idx}`,
            versionLabel: 'v1 (Discovered Snapshot)',
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            author: 'discovery-engine',
            summary: `Automated ${c.discoveryMethod} configuration pull`,
            content: defaultConfig,
          },
        ],
      };
    });

    onImportDiscoveredDevices(newNodes);
    setCandidates((prev) =>
      prev.map((c) => (c.selected ? { ...c, selected: false, alreadyManaged: true } : c))
    );
  };

  const handleLiveHostProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveHostInput.trim()) return;

    setIsProbingHost(true);
    setProbeError(null);
    setLiveProbeResult(null);

    const parsedPorts = livePortsInput
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535);

    try {
      const response = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: liveHostInput.trim(),
          ports: parsedPorts.length > 0 ? parsedPorts : [22, 53, 80, 443],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setProbeError(data.error || 'TCP probe failed');
      } else {
        setLiveProbeResult(data);
      }
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : 'Unable to reach backend probe API');
    } finally {
      setIsProbingHost(false);
    }
  };

  const onboardLiveProbedHost = () => {
    if (!liveProbeResult) return;

    const vendorMap: Record<string, VendorName> = {
      Fortinet: 'Fortinet',
      'Palo Alto': 'Palo Alto',
      Cisco: 'Cisco IOS-XE',
      Juniper: 'Juniper',
      MikroTik: 'MikroTik',
    };
    const mappedVendor: VendorName = vendorMap[liveProbeResult.inferred.vendor] || 'Linux / Server';
    const mappedRole: DeviceRole =
      liveProbeResult.inferred.role === 'Firewall'
        ? DeviceRole.Firewall
        : liveProbeResult.inferred.role === 'Router'
        ? DeviceRole.Router
        : DeviceRole.Server;

    const baselineCfg = `# Live Probed Endpoint — ${liveProbeResult.hostname} (${liveProbeResult.ip})\n# Open TCP Ports: ${liveProbeResult.openPorts.join(', ') || 'None'}\n# Banner: ${liveProbeResult.banner || 'N/A'}\nntp server time.cloudflare.com\nsyslog remote enabled`;

    const newDevice: NetworkDevice = {
      id: `dev-live-${Date.now()}`,
      hostname: liveProbeResult.hostname,
      ip: liveProbeResult.ip,
      mac: '02:42:AC:11:00:99',
      vendor: mappedVendor,
      model: liveProbeResult.inferred.model,
      osVersion: liveProbeResult.inferred.osVersion,
      role: mappedRole,
      status: liveProbeResult.reachable ? DeviceStatus.Online : DeviceStatus.Offline,
      site: 'External / WAN Edge',
      rack: 'WAN / Cloud Endpoint',
      serialNumber: `LIVE-${liveProbeResult.ip.replace(/\./g, '')}`,
      assetTag: `AST-WAN-${Math.floor(1000 + Math.random() * 9000)}`,
      department: 'External Connectivity',
      purchaseDate: new Date().toISOString().slice(0, 10),
      warrantyExpiry: '2029-12-31',
      uptimeSeconds: liveProbeResult.reachable ? 3600000 : 0,
      cpuLoad: liveProbeResult.reachable ? 21 : 0,
      memoryUsage: liveProbeResult.reachable ? 44 : 0,
      tempCelsius: liveProbeResult.reachable ? 36 : 0,
      inboundMbps: liveProbeResult.reachable ? 215.4 : 0,
      outboundMbps: liveProbeResult.reachable ? 188.9 : 0,
      latencyMs: liveProbeResult.avgLatencyMs || 12.0,
      packetLossPct: liveProbeResult.reachable ? 0 : 100,
      openPorts: liveProbeResult.openPorts,
      discoveryMethod: 'Live TCP Probe',
      lastSeen: 'Just now',
      isLiveProbed: true,
      topologyTier: mappedRole === DeviceRole.Firewall ? 0 : 1,
      interfaces: [
        {
          name: 'eth0 (WAN-Public)',
          status: liveProbeResult.reachable ? 'up' : 'down',
          speedMbps: 10000,
          vlan: 'WAN',
          rxMbps: liveProbeResult.reachable ? 215.4 : 0,
          txMbps: liveProbeResult.reachable ? 188.9 : 0,
          connectedToId: 'dev-fw-01',
          connectedToHostname: 'fw-edge-01.corp.local',
          connectedPort: 'port1',
          protocol: 'STATIC',
        },
      ],
      runningConfig: baselineCfg,
      goldenBaselineConfig: baselineCfg,
      configHistory: [
        {
          id: `rev-live-${Date.now()}`,
          versionLabel: 'v1 (Live TCP Probe)',
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          author: 'tcp-prober',
          summary: `Live TCP socket & DNS discovery of ${liveProbeResult.target}`,
          content: baselineCfg,
        },
      ],
    };

    onImportDiscoveredDevices([newDevice]);
  };

  const selectedCount = candidates.filter((c) => c.selected && !c.alreadyManaged).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Automated Network Discovery & Fingerprinting
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Sweep enterprise subnets via SNMPv3, LLDP/CDP, SSH & NETCONF, or execute real TCP/DNS socket probes against live hosts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Enterprise Subnet CIDR Scanner */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Enterprise Subnet & LLDP/SNMP Scanner
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Discover unmanaged routers, switches, firewalls, and servers across VLAN subnets
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Quick Presets:</span>
              <button
                type="button"
                onClick={() => runSubnetDiscovery('172.16.40.0/24', 'HN-DC1 Core')}
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
              >
                172.16.40.0/24
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => runSubnetDiscovery('10.20.20.0/24', 'SGN-Campus HQ')}
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
              >
                10.20.20.0/24
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Subnet CIDR Range
              </label>
              <input
                type="text"
                value={cidrInput}
                onChange={(e) => setCidrInput(e.target.value)}
                placeholder="e.g. 172.16.40.0/24"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assign Site / Data Center
              </label>
              <select
                value={targetSite}
                onChange={(e) => setTargetSite(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="HN-DC1 Core">HN-DC1 Core</option>
                <option value="SGN-Campus HQ">SGN-Campus HQ</option>
                <option value="DN-Branch Edge">DN-Branch Edge</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protocols.snmpv3}
                  onChange={(e) => setProtocols((p) => ({ ...p, snmpv3: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>SNMPv3 AuthPriv</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protocols.lldpCdp}
                  onChange={(e) => setProtocols((p) => ({ ...p, lldpCdp: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>LLDP / CDP Neighbors</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protocols.netconf}
                  onChange={(e) => setProtocols((p) => ({ ...p, netconf: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>NETCONF / SSHv2</span>
              </label>
            </div>

            <button
              type="button"
              disabled={isScanningSubnet}
              onClick={() => runSubnetDiscovery()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isScanningSubnet ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Subnet...</span>
                </>
              ) : (
                <>
                  <Radar className="w-3.5 h-3.5" />
                  <span>Start Subnet Scan</span>
                </>
              )}
            </button>
          </div>

          {scanStage && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{scanStage}</span>
                <span className="font-mono text-slate-500 tabular-nums">{scanProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Discovered Subnet Nodes ({candidates.length})
                </h3>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={onboardSelectedCandidates}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard Selected ({selectedCount})</span>
                </button>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    onClick={() => toggleCandidateSelection(cand.id)}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={cand.selected}
                        disabled={cand.alreadyManaged}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                          {cand.hostname}{' '}
                          <span className="text-slate-500 font-normal">({cand.ip})</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 truncate">
                          {cand.vendor} · {cand.model} · {cand.role} · Ports{' '}
                          {cand.openPorts.join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {cand.alreadyManaged ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Managed</span>
                        </span>
                      ) : (
                        <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {cand.latencyMs} ms · {cand.discoveryMethod}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Real Backend TCP Socket & DNS Probe */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Live TCP Socket & DNS Host Probe
              </h2>
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Executes real server-side DNS lookup, TCP handshake latency timing, and HTTP header inspection
            </p>
          </div>

          <form onSubmit={handleLiveHostProbe} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hostname or IPv4 Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={liveHostInput}
                  onChange={(e) => setLiveHostInput(e.target.value)}
                  placeholder="e.g. 1.1.1.1, 8.8.8.8, cloudflare.com"
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="submit"
                  disabled={isProbingHost}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isProbingHost ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Probing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Probe Host</span>
                    </>
                  )}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                <span>Try:</span>
                {['1.1.1.1', '8.8.8.8', 'cloudflare.com', 'google.com'].map((sample, i) => (
                  <React.Fragment key={sample}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <button
                      type="button"
                      onClick={() => setLiveHostInput(sample)}
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {sample}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                TCP Ports to Scan
              </label>
              <input
                type="text"
                value={livePortsInput}
                onChange={(e) => setLivePortsInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </form>

          {probeError && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Kết nối tới Host thất bại: {probeError}</span>
              </div>
              <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="font-semibold text-rose-800 dark:text-rose-300">
                  Lý do tại sao không kết nối được & Gợi ý cách Fix:
                </div>
                <p>
                  • <strong>Nguyên nhân:</strong> Không thể phân giải tên miền DNS (NXDOMAIN) hoặc gói tin TCP SYN bị chặn bởi tường lửa biên / sai địa chỉ IPv4 đích.
                </p>
                <p>
                  • <strong>Cách khắc phục:</strong> Kiểm tra lại bản ghi DNS A/PTR trên máy chủ DNS nội bộ, xác minh định tuyến Default Gateway / BGP và mở ACL cho phép thăm dò từ dải IP của OmniNet Server.
                </p>
              </div>
            </div>
          )}

          {liveProbeResult && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {liveProbeResult.hostname}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    IP {liveProbeResult.ip} · Avg RTT {liveProbeResult.avgLatencyMs} ms
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    liveProbeResult.reachable
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {liveProbeResult.reachable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Reachable</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Filtered / Down</span>
                    </>
                  )}
                </span>
              </div>

              {liveProbeResult.banner && (
                <div className="text-slate-600 dark:text-slate-300 font-mono">
                  Banner: {liveProbeResult.banner}
                </div>
              )}

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {liveProbeResult.portChecks.map((pc) => (
                  <div key={pc.port} className="py-1.5 flex items-center justify-between font-mono tabular-nums">
                    <span className="text-slate-700 dark:text-slate-300">
                      Port {pc.port} ({pc.service})
                    </span>
                    <span
                      className={
                        pc.open
                          ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-slate-400 dark:text-slate-500'
                      }
                    >
                      {pc.open ? `OPEN (${pc.latencyMs} ms)` : 'CLOSED / TIMEOUT'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Connection Failure / Closed Management Port Advisor */}
              {(!liveProbeResult.reachable ||
                liveProbeResult.portChecks.some((p) => !p.open)) && (
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-amber-800 dark:text-amber-300">
                    {!liveProbeResult.reachable
                      ? 'Tại sao kết nối thất bại tới toàn bộ các cổng (100% Timeout):'
                      : 'Chẩn đoán các cổng quản trị đóng (CLOSED / TIMEOUT):'}
                  </div>
                  <p>
                    {!liveProbeResult.reachable
                      ? `Host ${liveProbeResult.ip} không phản hồi bất kỳ gói TCP SYN nào trong 1500ms. Nguyên nhân: Thiết bị đích đang tắt nguồn (Offline), mất đường truyền Uplink L1/L2, hoặc Firewall ACL đang chặn (DROP) toàn bộ kết nối từ bên ngoài.`
                      : `Các cổng đóng (${liveProbeResult.portChecks
                          .filter((p) => !p.open)
                          .map((p) => `${p.port}/${p.service}`)
                          .join(', ')}) từ chối kết nối do dịch vụ tương ứng chưa bật hoặc bị giới hạn bởi Management ACL / Control-Plane Policing.`}
                  </p>
                  <p className="text-[11px] font-mono text-amber-900 dark:text-amber-200">
                    • Cách Fix gợi ý: Kiểm tra ACL/Firewall rule cho phép TCP 22 (SSHv2) & 443 (HTTPS), bật 'ip ssh version 2' / 'systemctl start sshd' trên thiết bị đích.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={onboardLiveProbedHost}
                disabled={devices.some((d) => d.ip === liveProbeResult.ip)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {devices.some((d) => d.ip === liveProbeResult.ip)
                    ? 'Already in Discovered Inventory'
                    : 'Add Probed Node to Monitored Inventory'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Discovery Jobs & Vault Credentials */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Scheduled Discovery Profiles & Credential Bindings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated recurring sweeps keeping CMDB asset inventory and topology links up to date
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Vault Profiles: SNMPv3-SHA256-AES · SSH-Ed25519-NetOps · NETCONF-TLS</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                <th className="py-2.5 px-4">Profile Name</th>
                <th className="py-2.5 px-4">Target CIDR · Site</th>
                <th className="py-2.5 px-4">Discovery Protocols</th>
                <th className="py-2.5 px-4">Cadence · Last Sweep</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {schedules.map((sch) => (
                <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {sch.name}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {sch.cidr} · <span className="font-sans text-slate-500">{sch.site}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{sch.protocols}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {sch.cadence} · {sch.lastRun}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => runSubnetDiscovery(sch.cidr, sch.site)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Run Now
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSchedule(sch.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          sch.enabled
                            ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}
                      >
                        {sch.enabled ? 'Enabled' : 'Paused'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
