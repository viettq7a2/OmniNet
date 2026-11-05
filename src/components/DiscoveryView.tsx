import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Play,
  Plus,
  Radar,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Wrench,
} from 'lucide-react';
import {
  DeviceRole,
  DeviceStatus,
  DiscoverySchedule,
  NetworkDevice,
  VendorName,
} from '../types/network';
import { AppLanguage } from '../utils/i18n';

interface DiscoveredCandidate {
  ip: string;
  hostname: string;
  vendor: VendorName;
  model: string;
  osVersion: string;
  role: DeviceRole;
  openPorts: number[];
  latencyMs: number;
  discoveryProtocol: 'SNMPv3 + LLDP' | 'SSH + CDP' | 'NETCONF' | 'Live TCP Probe';
  alreadyManaged: boolean;
}

interface LiveProbePortCheck {
  port: number;
  service: string;
  open: boolean;
  latencyMs: number;
}

interface LiveProbeResult {
  target: string;
  ip: string | null;
  reverseHostnames: string[];
  reachable: boolean;
  avgLatencyMs: number;
  banner?: string;
  portChecks: LiveProbePortCheck[];
}

interface DiscoveryViewProps {
  devices: NetworkDevice[];
  schedules: DiscoverySchedule[];
  lang?: AppLanguage;
  onToggleSchedule: (scheduleId: string) => void;
  onImportDiscoveredDevices: (newDevices: NetworkDevice[]) => void;
}

const SUBNET_PRESETS = ['172.16.40.0/24', '10.30.0.0/24', '192.168.100.0/24'];

type OnboardingVendorKey =
  | 'cisco-ios'
  | 'aruba-aoscx'
  | 'hpe-comware'
  | 'hp-procurve'
  | 'ubiquiti-unifi'
  | 'fortinet'
  | 'mikrotik'
  | 'linux';

const ONBOARDING_VENDOR_LABELS: Record<OnboardingVendorKey, string> = {
  'cisco-ios': 'Cisco IOS-XE / Catalyst / Nexus',
  'aruba-aoscx': 'Aruba AOS-CX (6200 / 6300 / 8325)',
  'hpe-comware': 'HPE FlexFabric / Comware v7',
  'hp-procurve': 'HP ProCurve / ArubaOS-Switch (PVOS)',
  'ubiquiti-unifi': 'Ubiquiti UniFi Switch / Gateway',
  fortinet: 'Fortinet FortiGate (FortiOS)',
  mikrotik: 'MikroTik RouterOS v7',
  linux: 'Linux Server (Ubuntu / RHEL)',
};

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  devices,
  schedules,
  lang = 'vi',
  onToggleSchedule,
  onImportDiscoveredDevices,
}) => {
  const isVi = lang === 'vi';
  const [cidrInput, setCidrInput] = useState('172.16.40.0/24');
  const [siteInput, setSiteInput] = useState('SGN-Campus HQ');
  const [snmpCommunity, setSnmpCommunity] = useState('OMNINET-SNMPv3-SHA256');
  const [isScanningSubnet, setIsScanningSubnet] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [candidates, setCandidates] = useState<DiscoveredCandidate[]>([]);
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());

  // Real Backend Socket & DNS Probe State
  const [probeTarget, setProbeTarget] = useState('1.1.1.1');
  const [probePortsInput, setProbePortsInput] = useState('22, 80, 443, 8080');
  const [isProbingHost, setIsProbingHost] = useState(false);
  const [probeResult, setProbeResult] = useState<LiveProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Device Onboarding CLI Generator State
  const [onboardVendor, setOnboardVendor] = useState<OnboardingVendorKey>('cisco-ios');
  const [omninetServerIp, setOmninetServerIp] = useState('10.10.0.50');
  const [snmpV3User, setSnmpV3User] = useState('omninet-poll');
  const [snmpV3AuthPass, setSnmpV3AuthPass] = useState('OmniAuth#2026!');
  const [copiedOnboardCli, setCopiedOnboardCli] = useState(false);
  const [legacyMode, setLegacyMode] = useState<'modern' | 'legacy'>('modern');
  const [legacyCommunity, setLegacyCommunity] = useState('OMNINET_RO_2026');

  const generateOnboardingCli = (): string => {
    if (legacyMode === 'legacy') {
      return `! ============================================================================
! LEGACY FALLBACK CONFIG (SNMPv2c RO + ACL Locked Telnet/SSHv1 + CDP/ARP)
! OmniNet Server IP: ${omninetServerIp}
! ============================================================================

! --- 1. CISCO IOS / HP PROCURVE LEGACY (SNMPv2c + ACL + Telnet/SSHv1) ---
access-list 99 remark ALLOW_ONLY_OMNINET_SERVER
access-list 99 permit ${omninetServerIp} 0.0.0.0
access-list 99 deny any log

snmp-server community ${legacyCommunity} RO 99
snmp-server location Enterprise-Legacy-Rack
snmp-server enable traps snmp linkdown linkup
snmp-server host ${omninetServerIp} version 2c ${legacyCommunity}

cdp run
logging host ${omninetServerIp}

line vty 0 4
 access-class 99 in
 privilege level 15
 transport input ssh telnet
exit
write memory`;
    }

    switch (onboardVendor) {
      case 'cisco-ios':
        return `! === CISCO IOS-XE / CATALYST — OMNINET ONBOARDING ===
lldp run
cdp run
snmp-server group OMNINET-GRP v3 priv
snmp-server user ${snmpV3User} OMNINET-GRP v3 auth sha ${snmpV3AuthPass} priv aes 128 ${snmpV3AuthPass}
snmp-server host ${omninetServerIp} version 3 priv ${snmpV3User}
ip ssh version 2
netconf-yang
logging host ${omninetServerIp} transport udp port 514
end
write memory`;

      case 'aruba-aoscx':
        return `! === ARUBA AOS-CX — OMNINET ONBOARDING ===
configure terminal
lldp enable
snmpv3 security-level auth-privacy
snmpv3 user ${snmpV3User} auth sha auth-pass plaintext ${snmpV3AuthPass} priv aes priv-pass plaintext ${snmpV3AuthPass}
ssh server vrf default
https-server vrf default
https-server rest-access-mode read-write
logging ${omninetServerIp} severity info
end
write memory`;

      case 'hpe-comware':
        return `# === HPE FLEXFABRIC COMWARE V7 — OMNINET ONBOARDING ===
system-view
lldp global enable
snmp-agent
snmp-agent sys-info version v3
snmp-agent group v3 OMNINET-GRP privacy
snmp-agent usm-user v3 ${snmpV3User} OMNINET-GRP simple authentication-mode sha ${snmpV3AuthPass} privacy-mode aes128 ${snmpV3AuthPass}
ssh server enable
netconf soap https enable
info-center loghost ${omninetServerIp}
save force`;

      case 'hp-procurve':
        return `; === HP PROCURVE / ARUBAOS-SWITCH (PVOS) — OMNINET ONBOARDING ===
configure
lldp run
snmpv3 enable
snmpv3 user "${snmpV3User}" auth sha "${snmpV3AuthPass}" priv aes "${snmpV3AuthPass}"
snmpv3 group managerpriv user "${snmpV3User}" sec-model ver3
ip ssh
ip ssh version 2
logging ${omninetServerIp}
write memory`;

      case 'ubiquiti-unifi':
        return `# === UBIQUITI UNIFI SWITCH / GATEWAY — OMNINET ONBOARDING ===
mca-cli-op set-inform http://${omninetServerIp}:8080/inform
cli
enable
configure
snmp-server sysname "UniFi-Enterprise-Switch"
lldp med all
exit
write memory`;

      case 'fortinet':
        return `# === FORTINET FORTIGATE (FORTIOS) — OMNINET ONBOARDING ===
config system interface
    edit "port1"
        set allowaccess ping https ssh snmp
    next
end
config system snmp user
    edit "${snmpV3User}"
        set notify-hosts ${omninetServerIp}
        set security-level auth-priv
        set auth-proto sha256
        set auth-pwd "${snmpV3AuthPass}"
        set priv-proto aes128
        set priv-pwd "${snmpV3AuthPass}"
    next
end
config log syslogd setting
    set status enable
    set server "${omninetServerIp}"
end`;

      case 'mikrotik':
        return `# === MIKROTIK ROUTEROS V7 — OMNINET ONBOARDING ===
/ip neighbor discovery-settings set discover-interface-list=all protocol=cdp,lldp,mndp
/snmp community add name=${snmpV3User} addresses=${omninetServerIp}/32 security=private \\
    authentication-protocol=SHA1 encryption-protocol=AES \\
    authentication-password="${snmpV3AuthPass}" encryption-password="${snmpV3AuthPass}"
/snmp set enabled=yes trap-version=3
/ip service set ssh disabled=no address=${omninetServerIp}/32
/ip service set www-ssl disabled=no`;

      case 'linux':
        return `# === LINUX SERVER (UBUNTU / RHEL) — OMNINET ONBOARDING ===
sudo apt-get update && sudo apt-get install -y snmpd lldpd openssh-server
sudo net-snmp-create-v3-user -ro -A "${snmpV3AuthPass}" -X "${snmpV3AuthPass}" -a SHA -x AES ${snmpV3User}
sudo systemctl enable --now snmpd lldpd ssh
echo "*.* @${omninetServerIp}:514" | sudo tee /etc/rsyslog.d/90-omninet.conf
sudo systemctl restart rsyslog`;
    }
  };

  const handleScanSubnet = () => {
    setIsScanningSubnet(true);
    setScanProgress(15);

    const basePrefix =
      cidrInput.split('/')[0].split('.').slice(0, 3).join('.') || '172.16.40';

    const timer1 = setTimeout(() => setScanProgress(55), 220);
    const timer2 = setTimeout(() => setScanProgress(88), 450);
    const timer3 = setTimeout(() => {
      const discovered: DiscoveredCandidate[] = [
        {
          ip: `${basePrefix}.1`,
          hostname: `gw-${basePrefix.replace(/\./g, '-')}.corp.local`,
          vendor: 'Fortinet',
          model: 'FortiGate 200F',
          osVersion: 'FortiOS 7.4.3',
          role: DeviceRole.Firewall,
          openPorts: [22, 443, 161, 514],
          latencyMs: 1.8,
          discoveryProtocol: 'SNMPv3 + LLDP',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.1`),
        },
        {
          ip: `${basePrefix}.10`,
          hostname: `sw-dist-${basePrefix.split('.')[2]}.corp.local`,
          vendor: 'Cisco IOS-XE',
          model: 'Catalyst C9300-48P',
          osVersion: 'IOS-XE 17.9.4a',
          role: DeviceRole.Switch,
          openPorts: [22, 161, 443, 830],
          latencyMs: 2.3,
          discoveryProtocol: 'SSH + CDP',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.10`),
        },
        {
          ip: `${basePrefix}.15`,
          hostname: `rtr-branch-${basePrefix.split('.')[2]}.corp.local`,
          vendor: 'Juniper',
          model: 'MX204 Universal Router',
          osVersion: 'Junos 22.4R2',
          role: DeviceRole.Router,
          openPorts: [22, 161, 179, 830],
          latencyMs: 3.1,
          discoveryProtocol: 'NETCONF',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.15`),
        },
        {
          ip: `${basePrefix}.24`,
          hostname: `usw-pro-${basePrefix.split('.')[2]}.corp.local`,
          vendor: 'Ubiquiti UniFi',
          model: 'UniFi Switch Pro 48 PoE',
          osVersion: 'UniFi OS 4.0.6',
          role: DeviceRole.Switch,
          openPorts: [22, 161, 443, 8080],
          latencyMs: 2.6,
          discoveryProtocol: 'SNMPv3 + LLDP',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.24`),
        },
        {
          ip: `${basePrefix}.28`,
          hostname: `sw-hp-procurve-${basePrefix.split('.')[2]}.corp.local`,
          vendor: 'HP ProCurve',
          model: 'HP ProCurve 2920-48G (J9728A)',
          osVersion: 'PVOS WB.16.10',
          role: DeviceRole.Switch,
          openPorts: [22, 161, 443],
          latencyMs: 2.9,
          discoveryProtocol: 'SNMPv3 + LLDP',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.28`),
        },
        {
          ip: `${basePrefix}.50`,
          hostname: `srv-app-${basePrefix.split('.')[2]}.corp.local`,
          vendor: 'Linux / Server',
          model: 'Dell PowerEdge R650',
          osVersion: 'Ubuntu 22.04 LTS',
          role: DeviceRole.Server,
          openPorts: [22, 80, 443, 9100],
          latencyMs: 1.4,
          discoveryProtocol: 'Live TCP Probe',
          alreadyManaged: devices.some((d) => d.ip === `${basePrefix}.50`),
        },
      ];
      setCandidates(discovered);
      setSelectedIps(
        new Set(discovered.filter((c) => !c.alreadyManaged).map((c) => c.ip))
      );
      setScanProgress(100);
      setIsScanningSubnet(false);
    }, 680);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  const toggleCandidate = (ip: string) => {
    setSelectedIps((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });
  };

  const handleImportSelectedCandidates = () => {
    const chosen = candidates.filter((c) => selectedIps.has(c.ip) && !c.alreadyManaged);
    if (chosen.length === 0) return;

    const nowDate = new Date().toISOString().slice(0, 10);
    const newDevices: NetworkDevice[] = chosen.map((c, idx) => {
      const baseCfg = `! ${c.vendor} — ${c.hostname} (${c.ip})\nhostname ${c.hostname}\nsnmp-server community ${snmpCommunity} RO\nlldp run\n! Discovered via ${c.discoveryProtocol}`;
      return {
        id: `dev-disc-${Date.now()}-${idx}`,
        hostname: c.hostname,
        ip: c.ip,
        mac: `00:50:56:B${idx}:4C:${10 + idx}`,
        vendor: c.vendor as VendorName,
        model: c.model,
        osVersion: c.osVersion,
        role: c.role,
        status: DeviceStatus.Online,
        site: siteInput,
        rack: `Rack B-0${idx + 1}`,
        serialNumber: `SN${Math.floor(10000000 + Math.random() * 89999999)}`,
        assetTag: `AST-2025-${Math.floor(200 + Math.random() * 700)}`,
        department: 'Discovered Infrastructure',
        purchaseDate: nowDate,
        warrantyExpiry: '2029-12-31',
        uptimeSeconds: 86400 * (idx + 3),
        cpuLoad: 22 + idx * 5,
        memoryUsage: 38 + idx * 6,
        tempCelsius: 37 + idx,
        inboundMbps: 185.4 + idx * 45,
        outboundMbps: 142.1 + idx * 35,
        latencyMs: c.latencyMs,
        packetLossPct: 0,
        openPorts: c.openPorts,
        discoveryMethod: c.discoveryProtocol,
        mgmtProtocol: c.openPorts.includes(830) ? 'NETCONF' : 'SSHv2',
        lastSeen: 'Just now',
        topologyTier:
          c.role === DeviceRole.Firewall
            ? 0
            : c.role === DeviceRole.Router
            ? 1
            : c.role === DeviceRole.Switch
            ? 2
            : 3,
        interfaces: [
          {
            name: 'Gi1/0/1',
            status: 'up',
            speedMbps: 10000,
            vlan: 'Trunk 1,10,20',
            rxMbps: 160.2,
            txMbps: 128.5,
            connectedToId: 'dev-sw-01',
            connectedToHostname: 'sw-core-nx01.corp.local',
            protocol: 'LLDP',
          },
        ],
        runningConfig: baseCfg,
        goldenBaselineConfig: baseCfg,
        configHistory: [
          {
            id: `rev-init-${Date.now()}-${idx}`,
            versionLabel: 'v1 (Initial Discovery)',
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            author: 'autodiscovery-engine',
            summary: `Imported from ${cidrInput} subnet scan`,
            content: baseCfg,
          },
        ],
      };
    });

    onImportDiscoveredDevices(newDevices);
    setCandidates((prev) =>
      prev.map((c) => (selectedIps.has(c.ip) ? { ...c, alreadyManaged: true } : c))
    );
    setSelectedIps(new Set());
  };

  // Real Backend Socket & DNS Probe Handler
  const handleRunLiveHostProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeTarget.trim()) return;
    setIsProbingHost(true);
    setProbeError(null);

    const parsedPorts = probePortsInput
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535);

    try {
      const response = await fetch('/api/network/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: probeTarget.trim(),
          ports: parsedPorts.length > 0 ? parsedPorts : [22, 80, 443, 8080],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setProbeError(data.error || (isVi ? 'Không thể kết nối tới mục tiêu.' : 'Unable to probe target.'));
      } else {
        setProbeResult(data);
      }
    } catch {
      setProbeError(isVi ? 'Lỗi kết nối dịch vụ mạng.' : 'Network service error while probing target.');
    } finally {
      setIsProbingHost(false);
    }
  };

  const handleImportLiveProbedHost = () => {
    if (!probeResult || !probeResult.ip) return;
    const openPorts = probeResult.portChecks.filter((p) => p.open).map((p) => p.port);
    const hostname =
      probeResult.reverseHostnames[0] ||
      (probeResult.target !== probeResult.ip
        ? probeResult.target
        : `host-${probeResult.ip.replace(/\./g, '-')}.net`);
    const cfg = `! Live Probed Host — ${hostname} (${probeResult.ip})\n! Open TCP Ports: ${
      openPorts.join(', ') || 'None'
    }\n! HTTP Banner: ${probeResult.banner || 'N/A'}\nhostname ${hostname}\nip address ${
      probeResult.ip
    }`;

    const newDevice: NetworkDevice = {
      id: `dev-live-${Date.now()}`,
      hostname,
      ip: probeResult.ip,
      mac: '00:1A:2B:3C:4D:5E',
      vendor: 'Linux / Server',
      model: probeResult.banner ? `Server (${probeResult.banner})` : 'Probed Network Host',
      osVersion: 'Live TCP/IP Stack',
      role: DeviceRole.Server,
      status: probeResult.reachable ? DeviceStatus.Online : DeviceStatus.Offline,
      site: siteInput,
      rack: 'External / Probed',
      serialNumber: `LIVE-${Date.now().toString().slice(-6)}`,
      assetTag: `AST-LIVE-${Date.now().toString().slice(-4)}`,
      department: 'Live Probed Infrastructure',
      purchaseDate: new Date().toISOString().slice(0, 10),
      warrantyExpiry: '2028-12-31',
      uptimeSeconds: 86400,
      cpuLoad: 18,
      memoryUsage: 34,
      tempCelsius: 36,
      inboundMbps: 95.4,
      outboundMbps: 82.1,
      latencyMs: probeResult.avgLatencyMs || 12,
      packetLossPct: probeResult.reachable ? 0 : 100,
      openPorts,
      discoveryMethod: 'Live TCP Probe',
      mgmtProtocol: openPorts.includes(22) ? 'SSHv2' : 'RESTCONF',
      lastSeen: 'Just now',
      topologyTier: 3,
      interfaces: [
        {
          name: 'eth0',
          status: probeResult.reachable ? 'up' : 'down',
          speedMbps: 1000,
          vlan: 'External / Routed',
          rxMbps: 95.4,
          txMbps: 82.1,
          connectedToId: 'dev-fw-01',
          connectedToHostname: 'fw-edge-01.corp.local',
          protocol: 'LLDP',
        },
      ],
      runningConfig: cfg,
      goldenBaselineConfig: cfg,
      configHistory: [
        {
          id: `rev-live-${Date.now()}`,
          versionLabel: 'v1 (Live Probe)',
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          author: 'socket-prober',
          summary: `Imported from live socket probe of ${probeResult.target}`,
          content: cfg,
        },
      ],
    };

    onImportDiscoveredDevices([newDevice]);
  };

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {isVi ? 'Quét Mạng & Khám Phá Tự Động (Discovery)' : 'Network Discovery & Auto-Onboarding'}
        </h1>
      </div>

      {/* Top 2-Column Discovery Engines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Card: Subnet CIDR Auto-Discovery */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Radar className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isVi
                    ? 'Quét Dải Mạng Subnet CIDR (SNMPv3 / LLDP / CDP)'
                    : 'Subnet CIDR Scanner (SNMPv3 / LLDP / CDP)'}
                </h2>
              </div>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                UDP 161 · TCP 22/830
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'Dải mạng Subnet CIDR' : 'Target Subnet CIDR'}
                </label>
                <input
                  type="text"
                  value={cidrInput}
                  onChange={(e) => setCidrInput(e.target.value)}
                  placeholder="172.16.40.0/24"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {SUBNET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCidrInput(preset)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'Khu vực / Data Center' : 'Site / Data Center'}
                </label>
                <select
                  value={siteInput}
                  onChange={(e) => setSiteInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                >
                  <option value="SGN-Campus HQ">SGN-Campus HQ</option>
                  <option value="HN-DC1 Core">HN-DC1 Core</option>
                  <option value="DN-Branch Edge">DN-Branch Edge</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isVi ? 'Hồ sơ xác thực SNMPv3 / Community' : 'SNMPv3 Profile / Community'}
              </label>
              <input
                type="text"
                value={snmpCommunity}
                onChange={(e) => setSnmpCommunity(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            {isScanningSubnet ? (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-blue-600">
                  {scanProgress}%
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {candidates.length > 0
                  ? isVi
                    ? `Tìm thấy ${candidates.length} thiết bị trong dải ${cidrInput}`
                    : `${candidates.length} hosts discovered in ${cidrInput}`
                  : isVi
                  ? 'Sẵn sàng quét phát hiện thiết bị'
                  : 'Ready to scan subnet'}
              </span>
            )}

            <button
              type="button"
              disabled={isScanningSubnet}
              onClick={handleScanSubnet}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningSubnet ? 'animate-spin' : ''}`} />
              <span>
                {isScanningSubnet
                  ? isVi
                    ? 'Đang quét...'
                    : 'Scanning...'
                  : isVi
                  ? 'Bắt đầu Quét Subnet'
                  : 'Start Subnet Scan'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Card: Real Live TCP Socket & DNS Prober */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <form onSubmit={handleRunLiveHostProbe} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Globe className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isVi
                    ? 'Quét Socket TCP & Phân giải DNS Thực tế (Live Probe)'
                    : 'Live TCP Socket & DNS Host Probe'}
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                Real Socket IO
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'Địa chỉ IPv4 hoặc Tên miền' : 'Target IPv4 or Hostname'}
                </label>
                <input
                  type="text"
                  value={probeTarget}
                  onChange={(e) => setProbeTarget(e.target.value)}
                  placeholder="1.1.1.1 / cloudflare.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {['1.1.1.1', '8.8.8.8', 'google.com', 'localhost'].map((host) => (
                    <button
                      key={host}
                      type="button"
                      onClick={() => setProbeTarget(host)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                    >
                      {host}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'Danh sách Cổng TCP cần kiểm tra' : 'TCP Ports to Probe'}
                </label>
                <input
                  type="text"
                  value={probePortsInput}
                  onChange={(e) => setProbePortsInput(e.target.value)}
                  placeholder="22, 80, 443, 8080"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {probeError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    {isVi
                      ? `Không kết nối được tới "${probeTarget}": ${probeError}`
                      : `Failed to reach "${probeTarget}": ${probeError}`}
                  </span>
                </div>
                <div className="text-[11px]">
                  {isVi
                    ? 'Kiểm tra tuyến định tuyến (ICMP/ARP) và ACL mở cổng TCP 22 / UDP 161.'
                    : 'Verify routing reachability (ICMP/ARP) and management ACLs for TCP 22 / UDP 161.'}
                </div>
              </div>
            )}

            {probeResult && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {probeResult.target} → {probeResult.ip || 'Unresolved'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-semibold ${
                        probeResult.reachable
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {probeResult.reachable
                        ? `REACHABLE (${probeResult.avgLatencyMs}ms)`
                        : 'UNREACHABLE'}
                    </span>
                    {probeResult.ip && (
                      <button
                        type="button"
                        onClick={handleImportLiveProbedHost}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isVi ? 'Thêm vào CMDB' : 'Import Host'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {probeResult.portChecks.map((pc) => (
                    <span
                      key={pc.port}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                        pc.open
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {pc.port}/{pc.service} {pc.open ? `OPEN (${pc.latencyMs}ms)` : 'CLOSED'}
                    </span>
                  ))}
                </div>

                {probeResult.portChecks.some((p) => !p.open) && (
                  <div className="p-2 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {isVi
                        ? `Cổng đóng (${probeResult.portChecks
                            .filter((p) => !p.open)
                            .map((p) => `${p.port}/${p.service}`)
                            .join(', ')}): Mở dịch vụ hoặc ACL quản trị ở mục sinh lệnh CLI bên dưới.`
                        : `Closed ports (${probeResult.portChecks
                            .filter((p) => !p.open)
                            .map((p) => `${p.port}/${p.service}`)
                            .join(', ')}): Use the Onboarding CLI Generator below to open management ports.`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isProbingHost}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {isProbingHost
                    ? isVi
                      ? 'Đang kiểm tra...'
                      : 'Probing...'
                    : isVi
                    ? 'Chạy Live Probe'
                    : 'Run Live Probe'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Discovered Candidates Staging Table */}
      {candidates.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isVi
                  ? `Danh sách Thiết bị Phát hiện trong ${cidrInput}`
                  : `Discovered Nodes in ${cidrInput}`}
              </h2>
            </div>

            <button
              type="button"
              disabled={selectedIps.size === 0}
              onClick={handleImportSelectedCandidates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isVi
                  ? `Nạp Thiết bị đã chọn (${selectedIps.size})`
                  : `Onboard Selected (${selectedIps.size})`}
              </span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-2.5 px-4">
                    {isVi ? 'Chọn' : 'Select'}
                  </th>
                  <th className="py-2.5 px-4">
                    {isVi ? 'IP & Hostname' : 'IP & Hostname'}
                  </th>
                  <th className="py-2.5 px-4">
                    {isVi ? 'Hãng & Dòng máy' : 'Vendor & Model'}
                  </th>
                  <th className="py-2.5 px-4">
                    {isVi ? 'Cổng mở' : 'Open Ports'}
                  </th>
                  <th className="py-2.5 px-4">
                    {isVi ? 'Giao thức' : 'Discovery Method'}
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    {isVi ? 'Trạng thái' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-xs">
                {candidates.map((cand) => (
                  <tr
                    key={cand.ip}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        disabled={cand.alreadyManaged}
                        checked={selectedIps.has(cand.ip)}
                        onChange={() => toggleCandidate(cand.ip)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {cand.ip}
                      </div>
                      <div className="font-mono text-slate-500">{cand.hostname}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {cand.vendor} · {cand.model}
                      </div>
                      <div className="text-slate-500 font-mono">{cand.osVersion}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {cand.openPorts.join(', ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                      {cand.discoveryProtocol}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {cand.alreadyManaged ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Đã quản lý' : 'Managed'}</span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {isVi ? 'Phát hiện mới' : 'New Candidate'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled Discovery Jobs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isVi ? 'Lịch Quét Mạng Định Kỳ' : 'Scheduled Discovery Jobs'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {schedules.filter((s) => s.enabled).length} / {schedules.length}{' '}
            {isVi ? 'đang bật' : 'active'}
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
          {schedules.map((job) => (
            <div
              key={job.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {job.name}
                </div>
                <div className="font-mono text-slate-500">
                  {job.cidr} · <span className="text-slate-400">{job.site}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="text-slate-500 font-mono">{job.protocols}</div>
                <div className="text-slate-500 tabular-nums">
                  {job.cadence} ·{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {job.lastRun}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSchedule(job.id)}
                  className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
                    job.enabled
                      ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {job.enabled
                    ? isVi
                      ? 'Đang bật'
                      : 'Enabled'
                    : isVi
                    ? 'Tạm dừng'
                    : 'Paused'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real Device Onboarding Configuration CLI Generator (100% Bilingual VI / EN & Concise) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Terminal className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isVi
                ? 'Sinh Lệnh Cấu Hình Kết Nối Thiết Bị Thật (Onboarding CLI)'
                : 'Device Onboarding CLI Generator'}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>SNMPv3 · LLDP · SSHv2 · Syslog</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 5 Cols: Parameters */}
          <div className="lg:col-span-5 space-y-3.5 text-xs">
            {/* Mode Switcher: Modern vs Legacy */}
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setLegacyMode('modern')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  legacyMode === 'modern'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isVi ? 'Thiết bị Đời mới (SNMPv3/SSHv2)' : 'Modern OS (SNMPv3/SSHv2)'}
              </button>
              <button
                type="button"
                onClick={() => setLegacyMode('legacy')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  legacyMode === 'legacy'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isVi ? 'Thiết bị Đời cũ (SNMPv2c/Telnet)' : 'Legacy OS (SNMPv2c/Telnet)'}
              </button>
            </div>

            {legacyMode === 'modern' ? (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? '1. Chọn Hãng Thiết bị' : '1. Select Target Vendor OS'}
                </label>
                <select
                  value={onboardVendor}
                  onChange={(e) => setOnboardVendor(e.target.value as OnboardingVendorKey)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-600"
                >
                  {(Object.keys(ONBOARDING_VENDOR_LABELS) as OnboardingVendorKey[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {ONBOARDING_VENDOR_LABELS[k]}
                      </option>
                    )
                  )}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-amber-700 dark:text-amber-300 mb-1">
                  {isVi ? 'SNMPv2c Read-Only Community' : 'SNMPv2c Read-Only Community'}
                </label>
                <input
                  type="text"
                  value={legacyCommunity}
                  onChange={(e) => setLegacyCommunity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'IP Máy chủ OmniNet' : 'OmniNet Server IP'}
                </label>
                <input
                  type="text"
                  value={omninetServerIp}
                  onChange={(e) => setOmninetServerIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isVi ? 'Tài khoản SNMPv3' : 'SNMPv3 Username'}
                </label>
                <input
                  type="text"
                  value={snmpV3User}
                  onChange={(e) => setSnmpV3User(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isVi ? 'Khóa SNMPv3 (SHA / AES-128)' : 'SNMPv3 Passphrase (SHA / AES-128)'}
              </label>
              <input
                type="text"
                value={snmpV3AuthPass}
                onChange={(e) => setSnmpV3AuthPass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {isVi ? 'Cổng giao thức kết nối:' : 'Required Management Ports:'}
              </div>
              <div>• SNMPv3 (UDP 161) · LLDP/CDP (L2) · SSHv2/NETCONF (TCP 22/830) · Syslog (UDP 514)</div>
            </div>
          </div>

          {/* Right 7 Cols: Ready-to-Paste CLI Script */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-sky-400 font-semibold">
                  {ONBOARDING_VENDOR_LABELS[onboardVendor]}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateOnboardingCli());
                    setCopiedOnboardCli(true);
                    setTimeout(() => setCopiedOnboardCli(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  {copiedOnboardCli ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đã chép CLI!' : 'Copied CLI!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Sao chép CLI' : 'Copy CLI'}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                {generateOnboardingCli()}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
