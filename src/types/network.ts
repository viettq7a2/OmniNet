export enum DeviceStatus {
  Online = 'online',
  Warning = 'warning',
  Offline = 'offline',
}

export enum DeviceRole {
  Router = 'Router',
  Switch = 'Switch',
  Firewall = 'Firewall',
  Server = 'Server',
  Wireless = 'Wireless',
}

export type VendorName =
  | 'Cisco IOS-XE'
  | 'Cisco NX-OS'
  | 'Fortinet'
  | 'Palo Alto'
  | 'Juniper'
  | 'MikroTik'
  | 'Aruba'
  | 'Linux / Server';

export interface DeviceInterface {
  name: string;
  status: 'up' | 'down';
  adminStatus?: 'up' | 'down';
  portType?: 'RJ45-1G' | 'SFP+-10G' | 'SFP28-25G' | 'QSFP-40G';
  mode?: 'access' | 'trunk' | 'routed';
  speedMbps: number;
  vlan: string;
  ipAddress?: string;
  poeWatts?: number;
  description?: string;
  rxMbps: number;
  txMbps: number;
  connectedToId?: string;
  connectedToHostname?: string;
  connectedPort?: string;
  protocol: 'LLDP' | 'CDP' | 'LACP' | 'STATIC';
}

export interface ServerService {
  id: string;
  name: string;
  processName: string;
  port: number;
  protocol: 'TCP' | 'UDP' | 'HTTPS' | 'gRPC';
  status: 'running' | 'degraded' | 'stopped';
  cpuPct: number;
  memoryMb: number;
  responseTimeMs: number;
  uptime: string;
  autoRestart: boolean;
}

export interface DeviceVlan {
  id: number;
  name: string;
  sviIp?: string;
  status: 'active' | 'suspended';
}

export interface VisualFirewallRule {
  id: string;
  name: string;
  srcZone: string;
  srcCidr: string;
  dstZone: string;
  dstCidr: string;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'ANY';
  port: string;
  action: 'accept' | 'deny';
  nat: boolean;
  log: boolean;
  enabled: boolean;
}

export interface VisualRouteEntry {
  id: string;
  prefix: string;
  nextHop: string;
  interfaceName: string;
  protocol: 'Static' | 'BGP' | 'OSPF';
  metric: number;
}

export interface ConfigRevision {
  id: string;
  versionLabel: string;
  timestamp: string;
  author: string;
  summary: string;
  content: string;
}

export interface ComplianceFinding {
  id: string;
  ruleCode: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  remediationTemplate: ConfigTemplateType;
  description: string;
}

export interface NetworkDevice {
  id: string;
  hostname: string;
  ip: string;
  mac: string;
  vendor: VendorName;
  model: string;
  osVersion: string;
  role: DeviceRole;
  status: DeviceStatus;
  site: string;
  rack: string;
  serialNumber: string;
  assetTag: string;
  department: string;
  purchaseDate: string;
  warrantyExpiry: string;
  uptimeSeconds: number;
  cpuLoad: number;
  memoryUsage: number;
  tempCelsius: number;
  inboundMbps: number;
  outboundMbps: number;
  latencyMs: number;
  packetLossPct: number;
  openPorts: number[];
  discoveryMethod:
    | 'SNMPv3 + LLDP'
    | 'SSH + CDP'
    | 'NETCONF'
    | 'Live TCP Probe'
    | 'Manual CMDB'
    | 'Topology Studio';
  lastSeen: string;
  isLiveProbed?: boolean;
  interfaces: DeviceInterface[];
  services?: ServerService[];
  vlans?: DeviceVlan[];
  firewallRules?: VisualFirewallRule[];
  routes?: VisualRouteEntry[];
  canvasPos?: { x: number; y: number };
  mgmtProtocol?: 'SSHv2' | 'NETCONF' | 'RESTCONF' | 'Vendor-API';
  runningConfig: string;
  goldenBaselineConfig: string;
  configHistory: ConfigRevision[];
  topologyTier: 0 | 1 | 2 | 3;
}

export interface TrafficTelemetryPoint {
  time: string;
  timestamp: number;
  inboundMbps: number;
  outboundMbps: number;
  inspectedMbps: number;
  totalMbps: number;
  onlineNodes: number;
  warningNodes: number;
  offlineNodes: number;
  avgLatencyMs: number;
}

export interface DiscoveryCandidate {
  id: string;
  hostname: string;
  ip: string;
  mac: string;
  vendor: VendorName;
  model: string;
  osVersion: string;
  role: DeviceRole;
  site: string;
  openPorts: number[];
  latencyMs: number;
  discoveryMethod: 'SNMPv3 + LLDP' | 'SSH + CDP' | 'NETCONF' | 'Live TCP Probe';
  selected: boolean;
  alreadyManaged: boolean;
}

export interface NetworkAlert {
  id: string;
  deviceId: string;
  hostname: string;
  ip: string;
  vendor: VendorName;
  severity: 'critical' | 'warning' | 'info';
  category: 'Availability' | 'Performance' | 'Configuration' | 'Security' | 'Service';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export type ConfigTemplateType = 'vlan' | 'baseline' | 'acl' | 'bgp' | 'custom';

export interface UnifiedConfigPayload {
  templateType: ConfigTemplateType;
  vlanId: number;
  vlanName: string;
  sviCidr: string;
  trunkPorts: string;
  ntpPrimary: string;
  ntpSecondary: string;
  syslogServer: string;
  snmpLocation: string;
  disableTelnet: boolean;
  aclName: string;
  aclSourceCidr: string;
  aclDestCidr: string;
  aclPort: number;
  aclProtocol: 'tcp' | 'udp' | 'icmp';
  aclAction: 'permit' | 'deny';
  bgpLocalAsn: number;
  bgpNeighborIp: string;
  bgpRemoteAsn: number;
  bgpAdvertisedPrefix: string;
  customCli: string;
}

export interface DiscoverySchedule {
  id: string;
  name: string;
  cidr: string;
  site: string;
  protocols: string;
  cadence: string;
  lastRun: string;
  enabled: boolean;
}

export type AiProviderId = 'gemini' | 'chatgpt' | 'claude' | 'deepseek';

export type AiReasoningMode = 'fast-noc' | 'deep-rca' | 'strict-cli';

export interface AiProviderAccount {
  id: AiProviderId;
  name: string;
  vendorLabel: string;
  models: string[];
  selectedModel: string;
  loggedIn: boolean;
  accountEmail: string;
  workspaceName: string;
  authType: 'Google Workspace SSO' | 'OpenAI OAuth SSO' | 'Anthropic Console SSO' | 'Enterprise Gateway SSO';
  connectedAt?: string;
}

export type RcaRootCauseLayer =
  | 'Physical (L1)'
  | 'Data Link & VLAN (L2)'
  | 'Routing & WAN (L3)'
  | 'Service & Application (L4-L7)'
  | 'Security & Config Drift';

export interface RcaAnalysisReport {
  id: string;
  generatedAt: string;
  engine: string;
  providerId?: AiProviderId;
  deviceId: string;
  hostname: string;
  ip: string;
  vendor: string;
  incidentTitle: string;
  severity: 'critical' | 'warning' | 'info';
  confidencePct: number;
  rootCauseLayer: RcaRootCauseLayer;
  executiveSummary: string;
  technicalRootCause: string;
  evidenceChain: string[];
  blastRadius: string[];
  recommendedSteps: string[];
  remediationCli: string;
  canAutoRecoverNode: boolean;
  canSyncBaseline: boolean;
  liveProbeVerification?: {
    target: string;
    reachable: boolean;
    avgLatencyMs: number;
    openPorts: number[];
    summary: string;
  };
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  providerId?: AiProviderId;
  providerLabel?: string;
  modelName?: string;
  suggestedCli?: string;
  targetDeviceId?: string;
}
