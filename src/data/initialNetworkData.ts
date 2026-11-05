// OmniNet Enterprise Initial Network Topology & Seed Data
import {
  DeviceInterface,
  DeviceRole,
  DeviceStatus,
  DiscoveryCandidate,
  DiscoverySchedule,
  NetworkAlert,
  NetworkDevice,
  TrafficTelemetryPoint,
} from '../types/network';

function generateAccessPorts(
  prefix: string,
  startIdx: number,
  count: number,
  activeMask: number[],
  vlanLabel: string,
  speedMbps = 1000,
  portType: DeviceInterface['portType'] = 'RJ45-1G',
  withPoe = false
): DeviceInterface[] {
  const ports: DeviceInterface[] = [];
  for (let i = 0; i < count; i++) {
    const portNum = startIdx + i;
    const isUp = activeMask.includes(portNum);
    ports.push({
      name: `${prefix}${portNum}`,
      status: isUp ? 'up' : 'down',
      adminStatus: 'up',
      portType,
      mode: vlanLabel.toLowerCase().includes('trunk') ? 'trunk' : 'access',
      speedMbps,
      vlan: vlanLabel,
      poeWatts: withPoe && isUp ? Number((6.4 + (portNum % 5) * 2.3).toFixed(1)) : 0,
      description: isUp ? `Endpoint-Port-${portNum}` : 'Unused-Access-Port',
      rxMbps: isUp ? Number((12.4 + ((portNum * 7) % 48)).toFixed(1)) : 0,
      txMbps: isUp ? Number((9.8 + ((portNum * 5) % 36)).toFixed(1)) : 0,
      protocol: 'STATIC',
    });
  }
  return ports;
}

export const INITIAL_DEVICES: NetworkDevice[] = [
  {
    id: 'dev-fw-01',
    hostname: 'fw-edge-01.corp.local',
    ip: '10.10.0.1',
    mac: '00:09:0F:AA:10:01',
    vendor: 'Fortinet',
    model: 'FortiGate 600F',
    osVersion: 'FortiOS 7.4.3',
    role: DeviceRole.Firewall,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A01 · RU 40-41',
    serialNumber: 'FG600FTK23009412',
    assetTag: 'AST-NET-00101',
    department: 'SecOps & Perimeter',
    purchaseDate: '2024-03-14',
    warrantyExpiry: '2029-03-14',
    uptimeSeconds: 14862400,
    cpuLoad: 28,
    memoryUsage: 46,
    tempCelsius: 39,
    inboundMbps: 842.5,
    outboundMbps: 618.2,
    latencyMs: 2.1,
    packetLossPct: 0.0,
    openPorts: [22, 443, 179],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'Vendor-API',
    lastSeen: 'Just now',
    topologyTier: 0,
    canvasPos: { x: 420, y: 90 },
    interfaces: [
      { name: 'port1', description: 'WAN-ISP1-Primary', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '203.113.10.2/30', speedMbps: 10000, vlan: 'WAN', rxMbps: 512.4, txMbps: 390.1, protocol: 'STATIC' },
      { name: 'port2 (LAG-1/2)', description: 'Core-Router-LACP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', ipAddress: '10.10.0.1/30', speedMbps: 10000, vlan: 'Trunk 10,20,100', rxMbps: 330.1, txMbps: 228.1, connectedToId: 'dev-rtr-01', connectedToHostname: 'rtr-wan-01.corp.local', connectedPort: 'TenGig0/0/1', protocol: 'LACP' },
      { name: 'port3', description: 'WAN-ISP2-Backup', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '14.231.8.2/30', speedMbps: 10000, vlan: 'WAN2', rxMbps: 44.2, txMbps: 31.0, protocol: 'STATIC' },
      { name: 'port4', description: 'HA-Heartbeat-Sync', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'HA-Sync', rxMbps: 18.5, txMbps: 18.4, protocol: 'STATIC' },
      { name: 'port5', description: 'DMZ-Segment', status: 'down', adminStatus: 'down', portType: 'RJ45-1G', mode: 'access', speedMbps: 1000, vlan: 'VLAN 40', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'port6', description: 'Mgmt-OutOfBand', status: 'up', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', ipAddress: '10.10.254.1/24', speedMbps: 1000, vlan: 'VLAN 254', rxMbps: 4.2, txMbps: 3.1, protocol: 'STATIC' },
      { name: 'port7', description: 'Spare-RJ45', status: 'down', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', speedMbps: 1000, vlan: 'VLAN 1', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'port8', description: 'Spare-RJ45', status: 'down', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', speedMbps: 1000, vlan: 'VLAN 1', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    vlans: [
      { id: 10, name: 'CORE_MGMT', sviIp: '10.10.10.1/24', status: 'active' },
      { id: 40, name: 'PERIMETER_DMZ', sviIp: '172.16.40.1/24', status: 'active' },
    ],
    firewallRules: [
      { id: 'fwr-1', name: 'Allow-Corp-HTTPS-DNS', srcZone: 'Trust', srcCidr: '10.0.0.0/8', dstZone: 'WAN', dstCidr: '0.0.0.0/0', protocol: 'TCP', port: '443,53', action: 'accept', nat: true, log: true, enabled: true },
      { id: 'fwr-2', name: 'Block-External-SMB-RDP', srcZone: 'WAN', srcCidr: '0.0.0.0/0', dstZone: 'Trust', dstCidr: '10.0.0.0/8', protocol: 'TCP', port: '445,3389', action: 'deny', nat: false, log: true, enabled: true },
    ],
    routes: [
      { id: 'rt-1', prefix: '0.0.0.0/0', nextHop: '203.113.10.1', interfaceName: 'port1', protocol: 'Static', metric: 5 },
      { id: 'rt-2', prefix: '10.20.0.0/16', nextHop: '10.10.0.3', interfaceName: 'port2', protocol: 'BGP', metric: 20 },
    ],
    runningConfig: `# Fortinet FortiOS 7.4.3 — fw-edge-01.corp.local
config system global
    set hostname "fw-edge-01"
    set admin-sport 443
end
config system ntp
    set ntpsync enable
    config ntpserver
        edit 1
            set server "10.10.0.10"
        next
    end
end
config log syslogd setting
    set status enable
    set server "10.10.0.50"
end
config firewall policy
    edit 10
        set name "Allow-Corp-HTTPS-DNS"
        set srcintf "port2"
        set dstintf "port1"
        set action accept
        set service "HTTPS" "DNS"
        set nat enable
    next
end`,
    goldenBaselineConfig: `# Fortinet FortiOS 7.4.3 — fw-edge-01.corp.local
config system global
    set hostname "fw-edge-01"
    set admin-sport 443
end
config system ntp
    set ntpsync enable
    config ntpserver
        edit 1
            set server "10.10.0.10"
        next
    end
end
config log syslogd setting
    set status enable
    set server "10.10.0.50"
end
config firewall policy
    edit 10
        set name "Allow-Corp-HTTPS-DNS"
        set srcintf "port2"
        set dstintf "port1"
        set action accept
        set service "HTTPS" "DNS"
        set nat enable
    next
end`,
    configHistory: [
      {
        id: 'rev-fw01-1',
        versionLabel: 'v4 (Running)',
        timestamp: '2026-10-28 14:20',
        author: 'secops-admin',
        summary: 'Initial FortiOS 7.4 perimeter policy & SIEM syslog',
        content: `# Fortinet FortiOS 7.4.3 — fw-edge-01.corp.local\nconfig system global\n    set hostname "fw-edge-01"\n    set admin-sport 443\nend\nconfig system ntp\n    set ntpsync enable\n    config ntpserver\n        edit 1\n            set server "10.10.0.10"\n        next\n    end\nend\nconfig log syslogd setting\n    set status enable\n    set server "10.10.0.50"\nend\nconfig firewall policy\n    edit 10\n        set name "Allow-Corp-HTTPS-DNS"\n        set srcintf "port2"\n        set dstintf "port1"\n        set action accept\n        set service "HTTPS" "DNS"\n        set nat enable\n    next\nend`,
      },
    ],
  },
  {
    id: 'dev-fw-02',
    hostname: 'fw-dc-core-01.corp.local',
    ip: '10.10.0.2',
    mac: '00:1B:17:8C:22:02',
    vendor: 'Palo Alto',
    model: 'PA-3420',
    osVersion: 'PAN-OS 11.1.2',
    role: DeviceRole.Firewall,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A02 · RU 38-39',
    serialNumber: '021201088431',
    assetTag: 'AST-NET-00102',
    department: 'SecOps & ZeroTrust',
    purchaseDate: '2024-06-01',
    warrantyExpiry: '2029-06-01',
    uptimeSeconds: 11240000,
    cpuLoad: 34,
    memoryUsage: 52,
    tempCelsius: 41,
    inboundMbps: 965.0,
    outboundMbps: 880.4,
    latencyMs: 1.4,
    packetLossPct: 0.0,
    openPorts: [22, 443],
    discoveryMethod: 'NETCONF',
    mgmtProtocol: 'Vendor-API',
    lastSeen: 'Just now',
    topologyTier: 0,
    canvasPos: { x: 960, y: 90 },
    interfaces: [
      { name: 'ae1 (LAG-4x)', description: 'Core-Nexus-LACP-4x25G', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'Trunk 10,100,105', rxMbps: 540.2, txMbps: 492.0, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Po10 (4x25G)', protocol: 'LACP' },
      { name: 'ethernet1/2', description: 'DMZ-Segment', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'access', ipAddress: '172.16.40.1/24', speedMbps: 10000, vlan: 'VLAN 40', rxMbps: 424.8, txMbps: 388.4, protocol: 'LLDP' },
      { name: 'ethernet1/3', description: 'DB-Enclave-Inspect', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'routed', ipAddress: '10.10.105.1/24', speedMbps: 25000, vlan: 'VLAN 105', rxMbps: 290.1, txMbps: 265.0, protocol: 'STATIC' },
      { name: 'ethernet1/4', description: 'HA2-DataLink', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'HA', rxMbps: 22.0, txMbps: 21.8, protocol: 'STATIC' },
      { name: 'ethernet1/5', description: 'Reserved-Zone', status: 'down', adminStatus: 'down', portType: 'SFP+-10G', mode: 'access', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'ethernet1/6', description: 'Reserved-Zone', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'access', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    vlans: [
      { id: 100, name: 'DC_COMPUTE_TRUST', sviIp: '10.10.100.1/24', status: 'active' },
      { id: 105, name: 'DC_PROD_DATABASE', sviIp: '10.10.105.1/24', status: 'active' },
    ],
    firewallRules: [
      { id: 'pa-r1', name: 'EastWest-App-To-DB', srcZone: 'Compute', srcCidr: '10.10.100.0/24', dstZone: 'Database', dstCidr: '10.10.105.0/24', protocol: 'TCP', port: '5432', action: 'accept', nat: false, log: true, enabled: true },
      { id: 'pa-r2', name: 'Deny-DB-Direct-Internet', srcZone: 'Database', srcCidr: '10.10.105.0/24', dstZone: 'Untrust', dstCidr: '0.0.0.0/0', protocol: 'ANY', port: 'any', action: 'deny', nat: false, log: true, enabled: true },
    ],
    routes: [
      { id: 'pa-rt1', prefix: '0.0.0.0/0', nextHop: '10.10.0.1', interfaceName: 'ethernet1/1', protocol: 'OSPF', metric: 10 },
    ],
    runningConfig: `# Palo Alto PAN-OS 11.1.2 — fw-dc-core-01.corp.local
set deviceconfig system hostname fw-dc-core-01
set deviceconfig system ntp-servers primary-ntp-server ntp-server-address 10.10.0.10
set shared log-settings syslog NetVista-SIEM server 10.10.0.50 transport UDP port 514
set deviceconfig system service disable-telnet yes
set rulebase security rules EastWest-Microseg from Trust to DMZ action allow log-end yes`,
    goldenBaselineConfig: `# Palo Alto PAN-OS 11.1.2 — fw-dc-core-01.corp.local
set deviceconfig system hostname fw-dc-core-01
set deviceconfig system ntp-servers primary-ntp-server ntp-server-address 10.10.0.10
set shared log-settings syslog NetVista-SIEM server 10.10.0.50 transport UDP port 514
set deviceconfig system service disable-telnet yes
set rulebase security rules EastWest-Microseg from Trust to DMZ action allow log-end yes`,
    configHistory: [
      {
        id: 'rev-fw02-1',
        versionLabel: 'v2 (Running)',
        timestamp: '2026-10-30 09:15',
        author: 'zt-architect',
        summary: 'Zero-trust East-West microsegmentation policy',
        content: `# Palo Alto PAN-OS 11.1.2 — fw-dc-core-01.corp.local\nset deviceconfig system hostname fw-dc-core-01\nset deviceconfig system ntp-servers primary-ntp-server ntp-server-address 10.10.0.10\nset shared log-settings syslog NetVista-SIEM server 10.10.0.50 transport UDP port 514\nset deviceconfig system service disable-telnet yes\nset rulebase security rules EastWest-Microseg from Trust to DMZ action allow log-end yes`,
      },
    ],
  },
  {
    id: 'dev-rtr-01',
    hostname: 'rtr-wan-01.corp.local',
    ip: '10.10.0.3',
    mac: '00:50:56:C0:10:03',
    vendor: 'Cisco IOS-XE',
    model: 'Catalyst 8500-12X4QC',
    osVersion: 'IOS-XE 17.9.4a',
    role: DeviceRole.Router,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A01 · RU 36-37',
    serialNumber: 'FDO2719M1AB',
    assetTag: 'AST-NET-00103',
    department: 'Core Backbone',
    purchaseDate: '2023-11-20',
    warrantyExpiry: '2028-11-20',
    uptimeSeconds: 19450000,
    cpuLoad: 22,
    memoryUsage: 41,
    tempCelsius: 38,
    inboundMbps: 720.8,
    outboundMbps: 695.3,
    latencyMs: 1.8,
    packetLossPct: 0.0,
    openPorts: [22, 161, 179],
    discoveryMethod: 'SSH + CDP',
    mgmtProtocol: 'NETCONF',
    lastSeen: 'Just now',
    topologyTier: 1,
    canvasPos: { x: 340, y: 250 },
    interfaces: [
      { name: 'TenGig0/0/1', description: 'North-FortiGate-LAG', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '10.10.0.2/30', speedMbps: 10000, vlan: 'Routed', rxMbps: 390.4, txMbps: 365.1, connectedToId: 'dev-fw-01', connectedToHostname: 'fw-edge-01.corp.local', connectedPort: 'port2 (LAG-1/2)', protocol: 'LACP' },
      { name: 'Po1 (2x10G)', description: 'South-NexusCore-LAG', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '10.10.0.6/30', speedMbps: 10000, vlan: 'Routed', rxMbps: 330.4, txMbps: 330.2, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Po1 (2x25G)', protocol: 'LACP' },
      { name: 'TenGig0/0/3', description: 'MPLS-To-SGN-HQ', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '172.31.1.1/30', speedMbps: 10000, vlan: 'MPLS-WAN', rxMbps: 310.0, txMbps: 290.4, connectedToId: 'dev-rtr-02', connectedToHostname: 'rtr-pe-02.corp.local', connectedPort: 'xe-0/0/0', protocol: 'LLDP' },
      { name: 'TenGig0/0/4', description: 'IPSec-To-DN-Branch', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '172.31.2.1/30', speedMbps: 10000, vlan: 'DMVPN', rxMbps: 198.2, txMbps: 164.0, connectedToId: 'dev-rtr-03', connectedToHostname: 'rtr-edge-dn01.corp.local', connectedPort: 'sfp-sfpplus1', protocol: 'LLDP' },
      { name: 'TenGig0/0/5', description: 'Spare-WAN-Circuit', status: 'down', adminStatus: 'down', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'TenGig0/0/6', description: 'Spare-Fiber', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    routes: [
      { id: 'c85-r1', prefix: '0.0.0.0/0', nextHop: '10.10.0.1', interfaceName: 'TenGig0/0/1', protocol: 'BGP', metric: 20 },
      { id: 'c85-r2', prefix: '10.20.0.0/16', nextHop: '172.31.1.2', interfaceName: 'TenGig0/0/3', protocol: 'BGP', metric: 20 },
      { id: 'c85-r3', prefix: '192.168.88.0/24', nextHop: '172.31.2.2', interfaceName: 'TenGig0/0/4', protocol: 'OSPF', metric: 110 },
    ],
    runningConfig: `! Cisco IOS-XE 17.9.4a — rtr-wan-01.corp.local
hostname rtr-wan-01
service password-encryption
ntp server 10.10.0.10 prefer
logging host 10.10.0.50
ip ssh version 2
router bgp 65001
 neighbor 172.31.1.2 remote-as 65002
line vty 0 15
 transport input ssh
end`,
    goldenBaselineConfig: `! Cisco IOS-XE 17.9.4a — rtr-wan-01.corp.local
hostname rtr-wan-01
service password-encryption
ntp server 10.10.0.10 prefer
logging host 10.10.0.50
ip ssh version 2
router bgp 65001
 neighbor 172.31.1.2 remote-as 65002
line vty 0 15
 transport input ssh
end`,
    configHistory: [
      {
        id: 'rev-rtr01-1',
        versionLabel: 'v5 (Running)',
        timestamp: '2026-10-25 18:05',
        author: 'neteng-lead',
        summary: 'BGP ASN 65001 core peering configuration',
        content: `! Cisco IOS-XE 17.9.4a — rtr-wan-01.corp.local\nhostname rtr-wan-01\nservice password-encryption\nntp server 10.10.0.10 prefer\nlogging host 10.10.0.50\nip ssh version 2\nrouter bgp 65001\n neighbor 172.31.1.2 remote-as 65002\nline vty 0 15\n transport input ssh\nend`,
      },
    ],
  },
  {
    id: 'dev-rtr-02',
    hostname: 'rtr-pe-02.corp.local',
    ip: '10.20.10.1',
    mac: '2C:6B:F5:44:10:01',
    vendor: 'Juniper',
    model: 'MX204 Universal Routing',
    osVersion: 'Junos 23.2R1',
    role: DeviceRole.Router,
    status: DeviceStatus.Online,
    site: 'SGN-Campus HQ',
    rack: 'Rack B01 · RU 42',
    serialNumber: 'JN1289440AFB',
    assetTag: 'AST-NET-00201',
    department: 'WAN Transport',
    purchaseDate: '2024-01-10',
    warrantyExpiry: '2029-01-10',
    uptimeSeconds: 16210000,
    cpuLoad: 19,
    memoryUsage: 38,
    tempCelsius: 37,
    inboundMbps: 534.2,
    outboundMbps: 498.6,
    latencyMs: 6.4,
    packetLossPct: 0.0,
    openPorts: [22, 179, 830],
    discoveryMethod: 'NETCONF',
    mgmtProtocol: 'NETCONF',
    lastSeen: 'Just now',
    topologyTier: 1,
    canvasPos: { x: 760, y: 250 },
    interfaces: [
      { name: 'xe-0/0/0', description: 'MPLS-Core-HN', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '172.31.1.2/30', speedMbps: 10000, vlan: 'Routed', rxMbps: 310.0, txMbps: 290.4, connectedToId: 'dev-rtr-01', connectedToHostname: 'rtr-wan-01.corp.local', connectedPort: 'TenGig0/0/3', protocol: 'LLDP' },
      { name: 'ae0 (LAG-2x)', description: 'HQ-Dist-Aruba-LACP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 10,20,30', rxMbps: 224.2, txMbps: 208.2, connectedToId: 'dev-sw-02', connectedToHostname: 'sw-dist-hq01.corp.local', connectedPort: 'lag1 (2x10G)', protocol: 'LACP' },
      { name: 'xe-0/0/2', description: 'SGN-DIA-ISP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '118.69.40.2/30', speedMbps: 10000, vlan: 'WAN-DIA', rxMbps: 95.0, txMbps: 84.1, protocol: 'STATIC' },
      { name: 'xe-0/0/3', description: 'Spare-10G', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    routes: [
      { id: 'jn-r1', prefix: '10.10.0.0/16', nextHop: '172.31.1.1', interfaceName: 'xe-0/0/0', protocol: 'BGP', metric: 20 },
    ],
    runningConfig: `# Juniper Junos 23.2R1 — rtr-pe-02.corp.local
set system host-name rtr-pe-02
set system ntp server 10.10.0.10 prefer
set system syslog host 10.10.0.50 any info
set system services ssh protocol-version v2
set routing-options autonomous-system 65002`,
    goldenBaselineConfig: `# Juniper Junos 23.2R1 — rtr-pe-02.corp.local
set system host-name rtr-pe-02
set system ntp server 10.10.0.10 prefer
set system syslog host 10.10.0.50 any info
set system services ssh protocol-version v2
set routing-options autonomous-system 65002`,
    configHistory: [
      {
        id: 'rev-rtr02-1',
        versionLabel: 'v3 (Running)',
        timestamp: '2026-10-19 11:40',
        author: 'wan-ops',
        summary: 'MPLS PE baseline & NETCONF candidate commit',
        content: `# Juniper Junos 23.2R1 — rtr-pe-02.corp.local\nset system host-name rtr-pe-02\nset system ntp server 10.10.0.10 prefer\nset system syslog host 10.10.0.50 any info\nset system services ssh protocol-version v2\nset routing-options autonomous-system 65002`,
      },
    ],
  },
  {
    id: 'dev-rtr-03',
    hostname: 'rtr-edge-dn01.corp.local',
    ip: '192.168.88.1',
    mac: '48:A9:8A:91:88:01',
    vendor: 'MikroTik',
    model: 'CCR2116-12G-4S+',
    osVersion: 'RouterOS 7.14.2',
    role: DeviceRole.Router,
    status: DeviceStatus.Warning,
    site: 'DN-Branch Edge',
    rack: 'Rack C01 · RU 20',
    serialNumber: 'HE3088C1049B',
    assetTag: 'AST-NET-00301',
    department: 'Branch Operations',
    purchaseDate: '2023-08-12',
    warrantyExpiry: '2027-08-12',
    uptimeSeconds: 4128000,
    cpuLoad: 84,
    memoryUsage: 78,
    tempCelsius: 56,
    inboundMbps: 286.4,
    outboundMbps: 241.0,
    latencyMs: 28.5,
    packetLossPct: 1.2,
    openPorts: [22, 23, 8291],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: '4s ago',
    topologyTier: 1,
    canvasPos: { x: 1180, y: 250 },
    interfaces: [
      { name: 'sfp-sfpplus1', description: 'IPSec-HQ-Tunnel', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', ipAddress: '172.31.2.2/30', speedMbps: 10000, vlan: 'Routed', rxMbps: 198.2, txMbps: 164.0, connectedToId: 'dev-rtr-01', connectedToHostname: 'rtr-wan-01.corp.local', connectedPort: 'TenGig0/0/4', protocol: 'LLDP' },
      { name: 'ether1', description: 'Branch-Staff-LAN', status: 'up', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', ipAddress: '192.168.88.1/24', speedMbps: 1000, vlan: 'VLAN 88', rxMbps: 88.2, txMbps: 77.0, protocol: 'LLDP' },
      { name: 'ether2', description: 'Branch-Voice-VLAN', status: 'up', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', speedMbps: 1000, vlan: 'VLAN 89', rxMbps: 21.4, txMbps: 19.8, protocol: 'STATIC' },
      { name: 'ether3', description: 'Branch-Printer', status: 'down', adminStatus: 'up', portType: 'RJ45-1G', mode: 'access', speedMbps: 1000, vlan: 'VLAN 88', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'ether4', description: 'LTE-Failover-Modem', status: 'down', adminStatus: 'down', portType: 'RJ45-1G', mode: 'routed', speedMbps: 1000, vlan: 'WAN-LTE', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    vlans: [
      { id: 88, name: 'BRANCH_DATA', sviIp: '192.168.88.1/24', status: 'active' },
      { id: 89, name: 'BRANCH_VOICE', sviIp: '192.168.89.1/24', status: 'active' },
    ],
    firewallRules: [
      { id: 'mk-f1', name: 'Allow-Branch-To-HQ', srcZone: 'LAN', srcCidr: '192.168.88.0/24', dstZone: 'HQ-VPN', dstCidr: '10.10.0.0/16', protocol: 'ANY', port: 'any', action: 'accept', nat: false, log: false, enabled: true },
    ],
    runningConfig: `# MikroTik RouterOS 7.14.2 — rtr-edge-dn01.corp.local
/system identity set name=rtr-edge-dn01
/ip service set telnet disabled=no
/ip service set ssh disabled=no
/snmp community set [ find default=yes ] name=public
/ip address add address=192.168.88.1/24 interface=ether1`,
    goldenBaselineConfig: `# MikroTik RouterOS 7.14.2 — rtr-edge-dn01.corp.local
/system identity set name=rtr-edge-dn01
/system ntp client set enabled=yes servers=10.10.0.10
/ip service set telnet disabled=yes
/ip service set ssh disabled=no
/ip address add address=192.168.88.1/24 interface=ether1`,
    configHistory: [
      {
        id: 'rev-rtr03-1',
        versionLabel: 'v2 (Running - Drift Detected)',
        timestamp: '2026-11-02 21:10',
        author: 'field-tech',
        summary: 'Temporary field debug enabled Telnet and removed NTP',
        content: `# MikroTik RouterOS 7.14.2 — rtr-edge-dn01.corp.local\n/system identity set name=rtr-edge-dn01\n/ip service set telnet disabled=no\n/ip service set ssh disabled=no\n/snmp community set [ find default=yes ] name=public\n/ip address add address=192.168.88.1/24 interface=ether1`,
      },
      {
        id: 'rev-rtr03-0',
        versionLabel: 'v1 (Golden Baseline)',
        timestamp: '2026-09-15 10:00',
        author: 'neteng-lead',
        summary: 'Hardened Branch RouterOS v7 initial deployment',
        content: `# MikroTik RouterOS 7.14.2 — rtr-edge-dn01.corp.local\n/system identity set name=rtr-edge-dn01\n/system ntp client set enabled=yes servers=10.10.0.10\n/ip service set telnet disabled=yes\n/ip service set ssh disabled=no\n/ip address add address=192.168.88.1/24 interface=ether1`,
      },
    ],
  },
  {
    id: 'dev-sw-01',
    hostname: 'sw-core-nx01.corp.local',
    ip: '10.10.0.11',
    mac: '00:2A:6A:B1:00:11',
    vendor: 'Cisco NX-OS',
    model: 'Nexus 93180YC-FX3',
    osVersion: 'NX-OS 10.3(3)F',
    role: DeviceRole.Switch,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A03 · RU 42',
    serialNumber: 'FDO2641099Q',
    assetTag: 'AST-NET-00105',
    department: 'Data Center Fabric',
    purchaseDate: '2024-02-18',
    warrantyExpiry: '2029-02-18',
    uptimeSeconds: 18500000,
    cpuLoad: 31,
    memoryUsage: 48,
    tempCelsius: 40,
    inboundMbps: 1420.6,
    outboundMbps: 1385.2,
    latencyMs: 0.8,
    packetLossPct: 0.0,
    openPorts: [22, 161],
    discoveryMethod: 'SSH + CDP',
    mgmtProtocol: 'NETCONF',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 330, y: 440 },
    interfaces: [
      { name: 'Po10 (4x25G)', description: 'PA-3420-Firewall-LAG', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'Trunk 10,40,100', rxMbps: 520.4, txMbps: 505.0, connectedToId: 'dev-fw-02', connectedToHostname: 'fw-dc-core-01.corp.local', connectedPort: 'ae1 (LAG-4x)', protocol: 'LACP' },
      { name: 'Po1 (2x25G)', description: 'WAN-Router-C8500-LAG', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'routed', speedMbps: 25000, vlan: 'Routed', rxMbps: 330.4, txMbps: 330.2, connectedToId: 'dev-rtr-01', connectedToHostname: 'rtr-wan-01.corp.local', connectedPort: 'Po1 (2x10G)', protocol: 'LACP' },
      ...generateAccessPorts('Eth1/', 3, 7, [3, 4, 5, 7, 8], 'VLAN 100', 25000, 'SFP28-25G', false),
      { name: 'Po20 (2x25G)', description: 'ESXi-Hypervisor-LACP', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'Trunk 100-110', rxMbps: 540.1, txMbps: 512.2, connectedToId: 'dev-srv-01', connectedToHostname: 'esxi-hv-01.corp.local', connectedPort: 'bond0 (2x25G)', protocol: 'LACP' },
      { name: 'Eth1/11', description: 'PostgreSQL-Prod01', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', speedMbps: 25000, vlan: 'VLAN 105', rxMbps: 360.1, txMbps: 368.0, connectedToId: 'dev-srv-02', connectedToHostname: 'srv-db-prod01.corp.local', connectedPort: 'eno1', protocol: 'LLDP' },
      ...generateAccessPorts('Eth1/', 12, 6, [12, 14, 15], 'VLAN 100', 25000, 'SFP28-25G', false),
      { name: 'Eth1/18', description: 'K8s-Worker-03', status: 'down', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', speedMbps: 25000, vlan: 'VLAN 100', rxMbps: 0, txMbps: 0, connectedToId: 'dev-srv-03', connectedToHostname: 'srv-k8s-worker03.corp.local', connectedPort: 'ens1f0', protocol: 'LLDP' },
      ...generateAccessPorts('Eth1/', 19, 6, [19, 20, 22], 'Trunk 100,110', 40000, 'QSFP-40G', false),
    ],
    vlans: [
      { id: 10, name: 'MGMT_OOB', sviIp: '10.10.10.2/24', status: 'active' },
      { id: 100, name: 'PROD_K8S_NODES', sviIp: '10.10.100.2/24', status: 'active' },
      { id: 105, name: 'PROD_RDS_CLUSTER', sviIp: '10.10.105.2/24', status: 'active' },
      { id: 110, name: 'VMOTION_STORAGE', sviIp: '10.10.110.2/24', status: 'active' },
    ],
    runningConfig: `! Cisco NX-OS 10.3(3)F — sw-core-nx01.corp.local
hostname sw-core-nx01
no feature telnet
feature ssh
feature interface-vlan
ntp server 10.10.0.10 prefer use-vrf management
logging server 10.10.0.50 6 use-vrf management
vlan 10,100,105,110`,
    goldenBaselineConfig: `! Cisco NX-OS 10.3(3)F — sw-core-nx01.corp.local
hostname sw-core-nx01
no feature telnet
feature ssh
feature interface-vlan
ntp server 10.10.0.10 prefer use-vrf management
logging server 10.10.0.50 6 use-vrf management
vlan 10,100,105,110`,
    configHistory: [
      {
        id: 'rev-sw01-1',
        versionLabel: 'v6 (Running)',
        timestamp: '2026-10-12 16:30',
        author: 'dc-fabric-admin',
        summary: 'VXLAN leaf-spine VLANs 100-110 provisioned',
        content: `! Cisco NX-OS 10.3(3)F — sw-core-nx01.corp.local\nhostname sw-core-nx01\nno feature telnet\nfeature ssh\nfeature interface-vlan\nntp server 10.10.0.10 prefer use-vrf management\nlogging server 10.10.0.50 6 use-vrf management\nvlan 10,100,105,110`,
      },
    ],
  },
  {
    id: 'dev-sw-02',
    hostname: 'sw-dist-hq01.corp.local',
    ip: '10.20.10.11',
    mac: '88:3A:30:C2:10:11',
    vendor: 'Aruba',
    model: 'Aruba CX 6300M 48SR5',
    osVersion: 'AOS-CX 10.12.1010',
    role: DeviceRole.Switch,
    status: DeviceStatus.Online,
    site: 'SGN-Campus HQ',
    rack: 'Rack B02 · RU 40',
    serialNumber: 'SG38K9102M',
    assetTag: 'AST-NET-00202',
    department: 'Campus LAN',
    purchaseDate: '2024-04-05',
    warrantyExpiry: '2029-04-05',
    uptimeSeconds: 9840000,
    cpuLoad: 25,
    memoryUsage: 43,
    tempCelsius: 36,
    inboundMbps: 468.0,
    outboundMbps: 412.5,
    latencyMs: 3.1,
    packetLossPct: 0.0,
    openPorts: [22, 443],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'RESTCONF',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 750, y: 440 },
    interfaces: [
      ...generateAccessPorts('1/1/', 1, 11, [1, 2, 3, 5, 6, 8, 9, 10], 'VLAN 20', 1000, 'RJ45-1G', true),
      { name: '1/1/12', description: 'WLC-C9800-Trunk', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20,30', rxMbps: 342.1, txMbps: 298.7, connectedToId: 'dev-wlc-01', connectedToHostname: 'wlc-campus-01.corp.local', connectedPort: 'TenGig0/0/0', protocol: 'LLDP' },
      ...generateAccessPorts('1/1/', 13, 10, [13, 14, 16, 17, 19, 21], 'VLAN 30', 1000, 'RJ45-1G', true),
      { name: 'lag1 (2x10G)', description: 'Uplink-Juniper-MX204-LACP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 10,20,30', rxMbps: 280.5, txMbps: 248.0, connectedToId: 'dev-rtr-02', connectedToHostname: 'rtr-pe-02.corp.local', connectedPort: 'ae0 (LAG-2x)', protocol: 'LACP' },
      { name: '1/1/50', description: 'Downlink-Floor3-Sw', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20,30', rxMbps: 0, txMbps: 0, connectedToId: 'dev-sw-03', connectedToHostname: 'sw-acc-fl3-02.corp.local', connectedPort: 'TenGig1/1/1', protocol: 'LLDP' },
    ],
    vlans: [
      { id: 10, name: 'CAMPUS_MGMT', sviIp: '10.20.10.11/24', status: 'active' },
      { id: 20, name: 'CORP_WIFI_STAFF', sviIp: '10.20.20.1/24', status: 'active' },
      { id: 30, name: 'CORP_VOICE_IOT', sviIp: '10.20.30.1/24', status: 'active' },
    ],
    runningConfig: `! Aruba AOS-CX 10.12 — sw-dist-hq01.corp.local
hostname sw-dist-hq01
ntp server 10.10.0.10 prefer
logging 10.10.0.50 severity info
no telnet server
ssh server vrf default
vlan 10,20,30`,
    goldenBaselineConfig: `! Aruba AOS-CX 10.12 — sw-dist-hq01.corp.local
hostname sw-dist-hq01
ntp server 10.10.0.10 prefer
logging 10.10.0.50 severity info
no telnet server
ssh server vrf default
vlan 10,20,30`,
    configHistory: [
      {
        id: 'rev-sw02-1',
        versionLabel: 'v2 (Running)',
        timestamp: '2026-10-08 13:12',
        author: 'campus-admin',
        summary: 'Campus distribution PoE & VSX trunk setup',
        content: `! Aruba AOS-CX 10.12 — sw-dist-hq01.corp.local\nhostname sw-dist-hq01\nntp server 10.10.0.10 prefer\nlogging 10.10.0.50 severity info\nno telnet server\nssh server vrf default\nvlan 10,20,30`,
      },
    ],
  },
  {
    id: 'dev-sw-03',
    hostname: 'sw-acc-fl3-02.corp.local',
    ip: '10.20.10.32',
    mac: '00:B8:B3:71:10:32',
    vendor: 'Cisco IOS-XE',
    model: 'Catalyst 9300-48P',
    osVersion: 'IOS-XE 17.6.5',
    role: DeviceRole.Switch,
    status: DeviceStatus.Offline,
    site: 'SGN-Campus HQ',
    rack: 'IDF Floor 3 · RU 12',
    serialNumber: 'FCW2518L09P',
    assetTag: 'AST-NET-00208',
    department: 'Campus LAN',
    purchaseDate: '2022-07-19',
    warrantyExpiry: '2027-07-19',
    uptimeSeconds: 0,
    cpuLoad: 0,
    memoryUsage: 0,
    tempCelsius: 0,
    inboundMbps: 0,
    outboundMbps: 0,
    latencyMs: 0,
    packetLossPct: 100,
    openPorts: [22, 23],
    discoveryMethod: 'SSH + CDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: '14m ago',
    topologyTier: 2,
    canvasPos: { x: 960, y: 440 },
    interfaces: [
      ...generateAccessPorts('Gi1/0/', 1, 11, [], 'VLAN 20', 1000, 'RJ45-1G', true),
      { name: 'TenGig1/1/1', description: 'Uplink-Aruba-Dist', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20,30', rxMbps: 0, txMbps: 0, connectedToId: 'dev-sw-02', connectedToHostname: 'sw-dist-hq01.corp.local', connectedPort: '1/1/50', protocol: 'CDP' },
    ],
    vlans: [
      { id: 20, name: 'FLOOR3_WORKSTATIONS', status: 'active' },
      { id: 30, name: 'FLOOR3_IP_PHONES', status: 'active' },
    ],
    runningConfig: `! Cisco IOS-XE 17.6.5 — sw-acc-fl3-02.corp.local
hostname sw-acc-fl3-02
snmp-server community public RO
line vty 0 15
 transport input telnet ssh
end`,
    goldenBaselineConfig: `! Cisco IOS-XE 17.6.5 — sw-acc-fl3-02.corp.local
hostname sw-acc-fl3-02
ntp server 10.10.0.10 prefer
logging host 10.10.0.50
line vty 0 15
 transport input ssh
end`,
    configHistory: [
      {
        id: 'rev-sw03-1',
        versionLabel: 'v1 (Last Cached)',
        timestamp: '2026-08-14 08:45',
        author: 'campus-admin',
        summary: 'Floor 3 PoE access switch onboarding',
        content: `! Cisco IOS-XE 17.6.5 — sw-acc-fl3-02.corp.local\nhostname sw-acc-fl3-02\nsnmp-server community public RO\nline vty 0 15\n transport input telnet ssh\nend`,
      },
    ],
  },
  {
    id: 'dev-wlc-01',
    hostname: 'wlc-campus-01.corp.local',
    ip: '10.20.10.15',
    mac: '70:69:5A:3E:10:15',
    vendor: 'Cisco IOS-XE',
    model: 'Catalyst 9800-40 Wireless',
    osVersion: 'IOS-XE 17.9.4',
    role: DeviceRole.Wireless,
    status: DeviceStatus.Online,
    site: 'SGN-Campus HQ',
    rack: 'Rack B02 · RU 36',
    serialNumber: 'FGL2612L4RT',
    assetTag: 'AST-NET-00205',
    department: 'Enterprise Mobility',
    purchaseDate: '2023-09-30',
    warrantyExpiry: '2028-09-30',
    uptimeSeconds: 12100000,
    cpuLoad: 29,
    memoryUsage: 54,
    tempCelsius: 39,
    inboundMbps: 342.1,
    outboundMbps: 298.7,
    latencyMs: 3.5,
    packetLossPct: 0.0,
    openPorts: [22, 443, 5246],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'RESTCONF',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 1170, y: 440 },
    interfaces: [
      { name: 'TenGig0/0/0', description: 'CAPWAP-Trunk-Aruba', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20,30', rxMbps: 342.1, txMbps: 298.7, connectedToId: 'dev-sw-02', connectedToHostname: 'sw-dist-hq01.corp.local', connectedPort: '1/1/12', protocol: 'LLDP' },
      { name: 'TenGig0/0/1', description: 'HA-SSO-Redundancy', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'routed', speedMbps: 10000, vlan: 'HA', rxMbps: 24.0, txMbps: 23.8, protocol: 'STATIC' },
      { name: 'TenGig0/0/2', description: 'Spare-SFP+', status: 'down', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
      { name: 'TenGig0/0/3', description: 'Spare-SFP+', status: 'down', adminStatus: 'down', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Unassigned', rxMbps: 0, txMbps: 0, protocol: 'STATIC' },
    ],
    vlans: [
      { id: 20, name: 'WLAN_CORP_WPA3', sviIp: '10.20.20.15/24', status: 'active' },
    ],
    runningConfig: `! Cisco C9800 Wireless Controller — wlc-campus-01.corp.local
hostname wlc-campus-01
ntp server 10.10.0.10 prefer
logging host 10.10.0.50
ip ssh version 2
wireless management interface Vlan20
line vty 0 15
 transport input ssh
end`,
    goldenBaselineConfig: `! Cisco C9800 Wireless Controller — wlc-campus-01.corp.local
hostname wlc-campus-01
ntp server 10.10.0.10 prefer
logging host 10.10.0.50
ip ssh version 2
wireless management interface Vlan20
line vty 0 15
 transport input ssh
end`,
    configHistory: [
      {
        id: 'rev-wlc01-1',
        versionLabel: 'v3 (Running)',
        timestamp: '2026-10-20 15:00',
        author: 'wlan-eng',
        summary: 'WPA3-Enterprise Corp-WiFi6E profile active',
        content: `! Cisco C9800 Wireless Controller — wlc-campus-01.corp.local\nhostname wlc-campus-01\nntp server 10.10.0.10 prefer\nlogging host 10.10.0.50\nip ssh version 2\nwireless management interface Vlan20\nline vty 0 15\n transport input ssh\nend`,
      },
    ],
  },
  {
    id: 'dev-srv-01',
    hostname: 'esxi-hv-01.corp.local',
    ip: '10.10.100.21',
    mac: 'D4:F5:EF:12:00:21',
    vendor: 'Linux / Server',
    model: 'Dell PowerEdge R760 (ESXi 8.0)',
    osVersion: 'VMware ESXi 8.0 U2',
    role: DeviceRole.Server,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A05 · RU 10-11',
    serialNumber: 'J92K8X3',
    assetTag: 'AST-SRV-00401',
    department: 'Cloud Infrastructure',
    purchaseDate: '2024-05-12',
    warrantyExpiry: '2029-05-12',
    uptimeSeconds: 13890000,
    cpuLoad: 62,
    memoryUsage: 71,
    tempCelsius: 44,
    inboundMbps: 540.1,
    outboundMbps: 512.2,
    latencyMs: 0.9,
    packetLossPct: 0.0,
    openPorts: [22, 443, 902],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: 'Just now',
    topologyTier: 3,
    canvasPos: { x: 260, y: 635 },
    interfaces: [
      { name: 'bond0 (2x25G)', description: '25GbE-LACP-Fabric', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'Trunk 100-110', rxMbps: 540.1, txMbps: 512.2, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Po20 (2x25G)', protocol: 'LACP' },
      { name: 'vmnic1', description: '25GbE-vMotion', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'VLAN 110', rxMbps: 180.4, txMbps: 175.0, protocol: 'LACP' },
    ],
    services: [
      { id: 'svc-esx-1', name: 'VMware Host Agent (hostd)', processName: 'hostd', port: 443, protocol: 'HTTPS', status: 'running', cpuPct: 6.4, memoryMb: 840, responseTimeMs: 4, uptime: '160d 18h', autoRestart: true },
      { id: 'svc-esx-2', name: 'vCenter Agent (vpxa)', processName: 'vpxa', port: 902, protocol: 'TCP', status: 'running', cpuPct: 2.8, memoryMb: 410, responseTimeMs: 3, uptime: '160d 18h', autoRestart: true },
      { id: 'svc-esx-3', name: 'NVMe-oF Storage Multipath', processName: 'vmkiscsid', port: 3260, protocol: 'TCP', status: 'running', cpuPct: 8.2, memoryMb: 620, responseTimeMs: 1, uptime: '160d 18h', autoRestart: true },
      { id: 'svc-esx-4', name: 'NTP Time Sync Daemon', processName: 'ntpd', port: 123, protocol: 'UDP', status: 'running', cpuPct: 0.2, memoryMb: 38, responseTimeMs: 2, uptime: '160d 18h', autoRestart: true },
    ],
    runningConfig: `# Hypervisor Network & NTP Config — esxi-hv-01.corp.local
ntp server 10.10.0.10
syslog global logHost udp://10.10.0.50:514
vswitch0 uplink vmnic0 mtu 9000`,
    goldenBaselineConfig: `# Hypervisor Network & NTP Config — esxi-hv-01.corp.local
ntp server 10.10.0.10
syslog global logHost udp://10.10.0.50:514
vswitch0 uplink vmnic0 mtu 9000`,
    configHistory: [
      {
        id: 'rev-srv01-1',
        versionLabel: 'v2 (Running)',
        timestamp: '2026-10-05 19:20',
        author: 'virt-ops',
        summary: 'Jumbo frames MTU 9000 & vMotion VLAN 102',
        content: `# Hypervisor Network & NTP Config — esxi-hv-01.corp.local\nntp server 10.10.0.10\nsyslog global logHost udp://10.10.0.50:514\nvswitch0 uplink vmnic0 mtu 9000`,
      },
    ],
  },
  {
    id: 'dev-srv-02',
    hostname: 'srv-db-prod01.corp.local',
    ip: '10.10.105.10',
    mac: '3C:EC:EF:90:05:10',
    vendor: 'Linux / Server',
    model: 'HPE ProLiant DL380 Gen11',
    osVersion: 'Ubuntu 24.04.1 LTS',
    role: DeviceRole.Server,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A05 · RU 14-15',
    serialNumber: 'SGH4190X8A',
    assetTag: 'AST-SRV-00402',
    department: 'Core Database Platform',
    purchaseDate: '2024-05-12',
    warrantyExpiry: '2029-05-12',
    uptimeSeconds: 10420000,
    cpuLoad: 54,
    memoryUsage: 68,
    tempCelsius: 42,
    inboundMbps: 360.1,
    outboundMbps: 368.0,
    latencyMs: 0.7,
    packetLossPct: 0.0,
    openPorts: [22, 5432, 6379, 9100],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: 'Just now',
    topologyTier: 3,
    canvasPos: { x: 640, y: 635 },
    interfaces: [
      { name: 'eno1', description: '25GbE-DB-Primary', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', ipAddress: '10.10.105.10/24', speedMbps: 25000, vlan: 'VLAN 105', rxMbps: 360.1, txMbps: 368.0, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Eth1/11', protocol: 'LLDP' },
      { name: 'eno2', description: '25GbE-Replication', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', speedMbps: 25000, vlan: 'VLAN 106', rxMbps: 142.0, txMbps: 148.4, protocol: 'STATIC' },
    ],
    services: [
      { id: 'svc-db-1', name: 'PostgreSQL 16 HA Cluster', processName: 'postgres', port: 5432, protocol: 'TCP', status: 'running', cpuPct: 38.5, memoryMb: 24576, responseTimeMs: 2, uptime: '120d 14h', autoRestart: true },
      { id: 'svc-db-2', name: 'PgBouncer Connection Pool', processName: 'pgbouncer', port: 6432, protocol: 'TCP', status: 'running', cpuPct: 4.1, memoryMb: 512, responseTimeMs: 1, uptime: '120d 14h', autoRestart: true },
      { id: 'svc-db-3', name: 'Redis Cache Sentinel', processName: 'redis-server', port: 6379, protocol: 'TCP', status: 'running', cpuPct: 6.8, memoryMb: 4096, responseTimeMs: 1, uptime: '94d 06h', autoRestart: true },
      { id: 'svc-db-4', name: 'Prometheus Node Exporter', processName: 'node_exporter', port: 9100, protocol: 'HTTPS', status: 'running', cpuPct: 0.9, memoryMb: 64, responseTimeMs: 5, uptime: '120d 14h', autoRestart: true },
      { id: 'svc-db-5', name: 'OpenSSH Server', processName: 'sshd', port: 22, protocol: 'TCP', status: 'running', cpuPct: 0.3, memoryMb: 48, responseTimeMs: 3, uptime: '120d 14h', autoRestart: true },
    ],
    runningConfig: `# Linux Netplan & Hardening — srv-db-prod01.corp.local
# ntp: chrony server 10.10.0.10 iburst
# syslog: *.* @10.10.0.50:514
network:
  version: 2
  ethernets:
    eno1:
      addresses: [10.10.105.10/24]`,
    goldenBaselineConfig: `# Linux Netplan & Hardening — srv-db-prod01.corp.local
# ntp: chrony server 10.10.0.10 iburst
# syslog: *.* @10.10.0.50:514
network:
  version: 2
  ethernets:
    eno1:
      addresses: [10.10.105.10/24]`,
    configHistory: [
      {
        id: 'rev-srv02-1',
        versionLabel: 'v1 (Running)',
        timestamp: '2026-09-29 12:00',
        author: 'sre-db',
        summary: 'PostgreSQL HA primary node network interface',
        content: `# Linux Netplan & Hardening — srv-db-prod01.corp.local\n# ntp: chrony server 10.10.0.10 iburst\n# syslog: *.* @10.10.0.50:514\nnetwork:\n  version: 2\n  ethernets:\n    eno1:\n      addresses: [10.10.105.10/24]`,
      },
    ],
  },
  {
    id: 'dev-srv-03',
    hostname: 'srv-k8s-worker03.corp.local',
    ip: '10.10.100.43',
    mac: 'B4:96:91:AA:00:43',
    vendor: 'Linux / Server',
    model: 'Dell PowerEdge R650',
    osVersion: 'RHEL 9.4',
    role: DeviceRole.Server,
    status: DeviceStatus.Offline,
    site: 'HN-DC1 Core',
    rack: 'Rack A06 · RU 08',
    serialNumber: '8M1P4Z3',
    assetTag: 'AST-SRV-00419',
    department: 'Platform Engineering',
    purchaseDate: '2023-03-01',
    warrantyExpiry: '2028-03-01',
    uptimeSeconds: 0,
    cpuLoad: 0,
    memoryUsage: 0,
    tempCelsius: 0,
    inboundMbps: 0,
    outboundMbps: 0,
    latencyMs: 0,
    packetLossPct: 100,
    openPorts: [22, 443, 6443, 10250],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: '26m ago',
    topologyTier: 3,
    canvasPos: { x: 1040, y: 635 },
    interfaces: [
      { name: 'ens1f0', description: 'K8s-NodeNet', status: 'down', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', ipAddress: '10.10.100.43/24', speedMbps: 25000, vlan: 'VLAN 100', rxMbps: 0, txMbps: 0, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Eth1/18', protocol: 'LLDP' },
    ],
    services: [
      { id: 'svc-k8s-1', name: 'Kubernetes Kubelet', processName: 'kubelet', port: 10250, protocol: 'HTTPS', status: 'stopped', cpuPct: 0, memoryMb: 0, responseTimeMs: 0, uptime: 'Down', autoRestart: true },
      { id: 'svc-k8s-2', name: 'Containerd Runtime', processName: 'containerd', port: 10010, protocol: 'gRPC', status: 'stopped', cpuPct: 0, memoryMb: 0, responseTimeMs: 0, uptime: 'Down', autoRestart: true },
      { id: 'svc-k8s-3', name: 'NGINX Ingress Controller', processName: 'nginx', port: 443, protocol: 'HTTPS', status: 'stopped', cpuPct: 0, memoryMb: 0, responseTimeMs: 0, uptime: 'Down', autoRestart: true },
      { id: 'svc-k8s-4', name: 'OpenSSH Daemon', processName: 'sshd', port: 22, protocol: 'TCP', status: 'stopped', cpuPct: 0, memoryMb: 0, responseTimeMs: 0, uptime: 'Down', autoRestart: true },
    ],
    runningConfig: `# RHEL 9.4 NetworkManager — srv-k8s-worker03.corp.local
# ntp: chrony server 10.10.0.10
# syslog: rsyslog @10.10.0.50:514
IPV4_ADDRESS=10.10.100.43/24`,
    goldenBaselineConfig: `# RHEL 9.4 NetworkManager — srv-k8s-worker03.corp.local
# ntp: chrony server 10.10.0.10
# syslog: rsyslog @10.10.0.50:514
IPV4_ADDRESS=10.10.100.43/24`,
    configHistory: [
      {
        id: 'rev-srv03-1',
        versionLabel: 'v1 (Last Cached)',
        timestamp: '2026-09-01 09:30',
        author: 'k8s-platform',
        summary: 'Production worker node onboarding',
        content: `# RHEL 9.4 NetworkManager — srv-k8s-worker03.corp.local\n# ntp: chrony server 10.10.0.10\n# syslog: rsyslog @10.10.0.50:514\nIPV4_ADDRESS=10.10.100.43/24`,
      },
    ],
  },
  {
    id: 'dev-sw-unifi-01',
    hostname: 'usw-pro-48-poe.corp.local',
    ip: '10.20.10.24',
    mac: 'F4:92:BF:88:10:24',
    vendor: 'Ubiquiti UniFi',
    model: 'UniFi Switch Pro Max 48 PoE',
    osVersion: 'UniFi OS 4.0.6 / Net 8.5',
    role: DeviceRole.Switch,
    status: DeviceStatus.Online,
    site: 'SGN-Campus HQ',
    rack: 'IDF Floor 1 · RU 22',
    serialNumber: 'UBNT2408991A',
    assetTag: 'AST-NET-00224',
    department: 'Campus WiFi & Access',
    purchaseDate: '2024-07-10',
    warrantyExpiry: '2027-07-10',
    uptimeSeconds: 7420000,
    cpuLoad: 21,
    memoryUsage: 49,
    tempCelsius: 43,
    inboundMbps: 412.8,
    outboundMbps: 389.4,
    latencyMs: 2.3,
    packetLossPct: 0.0,
    openPorts: [22, 443, 8080, 8443],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'Vendor-API',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 120, y: 440 },
    interfaces: [
      ...generateAccessPorts('0/', 1, 12, [1, 2, 3, 4, 6, 7, 9, 10, 11], 'VLAN 20', 2500, 'RJ45-1G', true),
      { name: 'LAG-2x (0/49-50)', description: 'Uplink-Aruba-6300M-LACP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 10,20,30', rxMbps: 412.8, txMbps: 389.4, connectedToId: 'dev-sw-02', connectedToHostname: 'sw-dist-hq01.corp.local', connectedPort: 'lag2 (2x10G)', protocol: 'LACP' },
      { name: '0/50', description: 'Downlink-U6-Enterprise-AP', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 20,30', rxMbps: 185.0, txMbps: 162.1, protocol: 'LLDP' },
    ],
    vlans: [
      { id: 10, name: 'UNIFI_MGMT', sviIp: '10.20.10.24/24', status: 'active' },
      { id: 20, name: 'CORP_WIFI_6E', sviIp: '10.20.20.254/24', status: 'active' },
      { id: 30, name: 'IOT_CAMERA_NET', sviIp: '10.20.30.254/24', status: 'active' },
    ],
    runningConfig: `# Ubiquiti UniFi OS 4.0.6 / Fastpath CLI — usw-pro-48-poe.corp.local
# Controller Inform: http://10.10.0.50:8080/inform (Connected)
cli
enable
configure
hostname "usw-pro-48-poe"
sntp server "10.10.0.10"
logging host "10.10.0.50"
vlan database
 vlan 10,20,30
 exit
interface 0/49
 description "Uplink-Aruba-6300M"
 vlan participation include 10,20,30
 vlan tagging 10,20,30
 exit
write memory`,
    goldenBaselineConfig: `# Ubiquiti UniFi OS 4.0.6 / Fastpath CLI — usw-pro-48-poe.corp.local
# Controller Inform: http://10.10.0.50:8080/inform (Connected)
cli
enable
configure
hostname "usw-pro-48-poe"
sntp server "10.10.0.10"
logging host "10.10.0.50"
vlan database
 vlan 10,20,30
 exit
interface 0/49
 description "Uplink-Aruba-6300M"
 vlan participation include 10,20,30
 vlan tagging 10,20,30
 exit
write memory`,
    configHistory: [
      {
        id: 'rev-unifi01-1',
        versionLabel: 'v3 (Running)',
        timestamp: '2026-10-31 11:00',
        author: 'campus-admin',
        summary: 'UniFi Network 8.5 L3 Etherlighting & PoE++ profile',
        content: `# Ubiquiti UniFi OS 4.0.6 / Fastpath CLI — usw-pro-48-poe.corp.local\ncli\nenable\nconfigure\nhostname "usw-pro-48-poe"\nsntp server "10.10.0.10"\nlogging host "10.10.0.50"\nvlan database\n vlan 10,20,30\n exit\nwrite memory`,
      },
    ],
  },
  {
    id: 'dev-sw-hpe-01',
    hostname: 'sw-hpe-5945-dc.corp.local',
    ip: '10.10.0.14',
    mac: '38:EA:A7:91:00:14',
    vendor: 'HPE Comware',
    model: 'HPE FlexFabric 5945 48SFP28',
    osVersion: 'Comware v7.1.070',
    role: DeviceRole.Switch,
    status: DeviceStatus.Online,
    site: 'HN-DC1 Core',
    rack: 'Rack A04 · RU 40',
    serialNumber: 'CN39K2108B',
    assetTag: 'AST-NET-00114',
    department: 'Data Center Fabric',
    purchaseDate: '2024-03-22',
    warrantyExpiry: '2029-03-22',
    uptimeSeconds: 15120000,
    cpuLoad: 24,
    memoryUsage: 44,
    tempCelsius: 39,
    inboundMbps: 1120.4,
    outboundMbps: 1085.0,
    latencyMs: 0.9,
    packetLossPct: 0.0,
    openPorts: [22, 161, 830],
    discoveryMethod: 'NETCONF',
    mgmtProtocol: 'NETCONF',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 540, y: 440 },
    interfaces: [
      { name: 'BAGG1 (4x25G)', description: 'Uplink-Nexus-Core-LACP', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'trunk', speedMbps: 25000, vlan: 'Trunk 10,100,105', rxMbps: 620.4, txMbps: 590.1, connectedToId: 'dev-sw-01', connectedToHostname: 'sw-core-nx01.corp.local', connectedPort: 'Po30 (4x25G)', protocol: 'LACP' },
      { name: 'Twenty-FiveGigE1/0/2', description: 'HPE-DL380-Storage', status: 'up', adminStatus: 'up', portType: 'SFP28-25G', mode: 'access', speedMbps: 25000, vlan: 'VLAN 105', rxMbps: 500.0, txMbps: 494.9, connectedToId: 'dev-srv-02', connectedToHostname: 'srv-db-prod01.corp.local', connectedPort: 'eno2', protocol: 'LLDP' },
      ...generateAccessPorts('Twenty-FiveGigE1/0/', 3, 6, [3, 4, 5, 6], 'VLAN 100', 25000, 'SFP28-25G', false),
    ],
    vlans: [
      { id: 10, name: 'DC_MGMT', sviIp: '10.10.10.14/24', status: 'active' },
      { id: 100, name: 'DC_COMPUTE', sviIp: '10.10.100.14/24', status: 'active' },
      { id: 105, name: 'DC_SAN_NVME', sviIp: '10.10.105.14/24', status: 'active' },
    ],
    runningConfig: `# HPE Comware Software, Version 7.1.070 — sw-hpe-5945-dc.corp.local
system-view
 sysname sw-hpe-5945-dc
 undo telnet server enable
 ssh server enable
 netconf ssh server enable
 ntp-service enable
 ntp-service unicast-server 10.10.0.10 priority
 info-center loghost 10.10.0.50
 vlan 10
  name DC_MGMT
 vlan 100
  name DC_COMPUTE
 interface Twenty-FiveGigE1/0/1
  description Uplink-Nexus-Core
  port link-type trunk
  port trunk permit vlan 10 100 105
  undo shutdown
return`,
    goldenBaselineConfig: `# HPE Comware Software, Version 7.1.070 — sw-hpe-5945-dc.corp.local
system-view
 sysname sw-hpe-5945-dc
 undo telnet server enable
 ssh server enable
 netconf ssh server enable
 ntp-service enable
 ntp-service unicast-server 10.10.0.10 priority
 info-center loghost 10.10.0.50
 vlan 10
  name DC_MGMT
 vlan 100
  name DC_COMPUTE
 interface Twenty-FiveGigE1/0/1
  description Uplink-Nexus-Core
  port link-type trunk
  port trunk permit vlan 10 100 105
  undo shutdown
return`,
    configHistory: [
      {
        id: 'rev-hpe01-1',
        versionLabel: 'v2 (Running)',
        timestamp: '2026-10-27 16:40',
        author: 'dc-fabric-admin',
        summary: 'HPE Comware v7 IRF & RoCEv2 lossless storage fabric',
        content: `# HPE Comware Software, Version 7.1.070 — sw-hpe-5945-dc.corp.local\nsystem-view\n sysname sw-hpe-5945-dc\n undo telnet server enable\n ssh server enable\n ntp-service enable\n ntp-service unicast-server 10.10.0.10 priority\n info-center loghost 10.10.0.50\nreturn`,
      },
    ],
  },
  {
    id: 'dev-sw-procurve-01',
    hostname: 'sw-hp-2920-fl2.corp.local',
    ip: '10.20.10.28',
    mac: 'A0:D3:C1:44:10:28',
    vendor: 'HP ProCurve',
    model: 'HP ProCurve 2920-48G-PoE+ (J9729A)',
    osVersion: 'ProCurve OS WB.16.11.0008',
    role: DeviceRole.Switch,
    status: DeviceStatus.Online,
    site: 'DN-Branch Edge',
    rack: 'Rack C01 · RU 18',
    serialNumber: 'SG54P0912K',
    assetTag: 'AST-NET-00312',
    department: 'Branch Operations',
    purchaseDate: '2021-11-15',
    warrantyExpiry: '2028-11-15',
    uptimeSeconds: 22150000,
    cpuLoad: 18,
    memoryUsage: 39,
    tempCelsius: 35,
    inboundMbps: 164.2,
    outboundMbps: 148.6,
    latencyMs: 4.6,
    packetLossPct: 0.0,
    openPorts: [22, 80, 443],
    discoveryMethod: 'SNMPv3 + LLDP',
    mgmtProtocol: 'SSHv2',
    lastSeen: 'Just now',
    topologyTier: 2,
    canvasPos: { x: 1370, y: 440 },
    interfaces: [
      ...generateAccessPorts('', 1, 10, [1, 2, 3, 5, 7, 8], 'VLAN 88', 1000, 'RJ45-1G', true),
      { name: '49', description: 'Uplink-MikroTik-CCR', status: 'up', adminStatus: 'up', portType: 'SFP+-10G', mode: 'trunk', speedMbps: 10000, vlan: 'Trunk 88,89', rxMbps: 164.2, txMbps: 148.6, connectedToId: 'dev-rtr-03', connectedToHostname: 'rtr-edge-dn01.corp.local', connectedPort: 'ether1', protocol: 'LLDP' },
    ],
    vlans: [
      { id: 88, name: 'BRANCH_STAFF', sviIp: '192.168.88.2/24', status: 'active' },
      { id: 89, name: 'BRANCH_VOICE_POE', sviIp: '192.168.89.2/24', status: 'active' },
    ],
    runningConfig: `; HP ProCurve J9729A Configuration Editor; Created on release #WB.16.11.0008
hostname "sw-hp-2920-fl2"
no telnet-server
ip ssh version 2
timesync sntp
sntp unicast
sntp server priority 1 10.10.0.10
logging 10.10.0.50
vlan 88
   name "BRANCH_STAFF"
   untagged 1-24
   tagged 49-50
   ip address 192.168.88.2 255.255.255.0
   exit
vlan 89
   name "BRANCH_VOICE_POE"
   tagged 1-24,49-50
   voice
   exit`,
    goldenBaselineConfig: `; HP ProCurve J9729A Configuration Editor; Created on release #WB.16.11.0008
hostname "sw-hp-2920-fl2"
no telnet-server
ip ssh version 2
timesync sntp
sntp unicast
sntp server priority 1 10.10.0.10
logging 10.10.0.50
vlan 88
   name "BRANCH_STAFF"
   untagged 1-24
   tagged 49-50
   ip address 192.168.88.2 255.255.255.0
   exit
vlan 89
   name "BRANCH_VOICE_POE"
   tagged 1-24,49-50
   voice
   exit`,
    configHistory: [
      {
        id: 'rev-hp01-1',
        versionLabel: 'v4 (Running)',
        timestamp: '2026-10-18 10:15',
        author: 'branch-ops',
        summary: 'ProCurve WB.16.11 tagged/untagged Voice VLAN & PoE+ setup',
        content: `; HP ProCurve J9729A Configuration Editor; Created on release #WB.16.11.0008\nhostname "sw-hp-2920-fl2"\nno telnet-server\nip ssh version 2\ntimesync sntp\nsntp unicast\nsntp server priority 1 10.10.0.10\nlogging 10.10.0.50\nvlan 88\n   name "BRANCH_STAFF"\n   untagged 1-24\n   tagged 49-50\n   exit`,
      },
    ],
  },
];

export const SUBNET_DISCOVERY_CATALOG: Record<string, Omit<DiscoveryCandidate, 'selected' | 'alreadyManaged'>[]> = {
  '172.16.40.0/24': [
    {
      id: 'cand-dmz-01',
      hostname: 'fw-dmz-waf01.corp.local',
      ip: '172.16.40.2',
      mac: '00:09:0F:BB:40:02',
      vendor: 'Fortinet',
      model: 'FortiGate 200F',
      osVersion: 'FortiOS 7.4.3',
      role: DeviceRole.Firewall,
      site: 'HN-DC1 Core',
      openPorts: [22, 443, 8443],
      latencyMs: 1.9,
      discoveryMethod: 'SNMPv3 + LLDP',
    },
    {
      id: 'cand-dmz-02',
      hostname: 'sw-hpe-dmz01.corp.local',
      ip: '172.16.40.11',
      mac: '38:EA:A7:CC:40:11',
      vendor: 'HPE Comware',
      model: 'HPE FlexFabric 5710 48XGT',
      osVersion: 'Comware v7.1.070',
      role: DeviceRole.Switch,
      site: 'HN-DC1 Core',
      openPorts: [22, 161, 830],
      latencyMs: 1.1,
      discoveryMethod: 'NETCONF',
    },
    {
      id: 'cand-dmz-03',
      hostname: 'srv-ingress-gw01.corp.local',
      ip: '172.16.40.25',
      mac: '3C:EC:EF:DD:40:25',
      vendor: 'Linux / Server',
      model: 'Dell PowerEdge R660 (NGINX LB)',
      osVersion: 'Ubuntu 24.04 LTS',
      role: DeviceRole.Server,
      site: 'HN-DC1 Core',
      openPorts: [22, 80, 443],
      latencyMs: 1.3,
      discoveryMethod: 'SNMPv3 + LLDP',
    },
  ],
  '10.20.20.0/24': [
    {
      id: 'cand-hq-01',
      hostname: 'sw-acc-fl4-01.corp.local',
      ip: '10.20.20.12',
      mac: '88:3A:30:E4:20:12',
      vendor: 'Aruba',
      model: 'Aruba CX 6200F 48G',
      osVersion: 'AOS-CX 10.13.1010',
      role: DeviceRole.Switch,
      site: 'SGN-Campus HQ',
      openPorts: [22, 443],
      latencyMs: 4.2,
      discoveryMethod: 'SNMPv3 + LLDP',
    },
    {
      id: 'cand-hq-02',
      hostname: 'usw-ent-24-poe.corp.local',
      ip: '10.20.20.18',
      mac: 'F4:92:BF:E4:20:18',
      vendor: 'Ubiquiti UniFi',
      model: 'UniFi Switch Enterprise 24 PoE',
      osVersion: 'UniFi OS 4.0.6 / Net 8.5',
      role: DeviceRole.Switch,
      site: 'SGN-Campus HQ',
      openPorts: [22, 443, 8080],
      latencyMs: 2.7,
      discoveryMethod: 'SNMPv3 + LLDP',
    },
    {
      id: 'cand-hq-03',
      hostname: 'sw-hp-2530-fl1.corp.local',
      ip: '10.20.20.29',
      mac: 'A0:D3:C1:E4:20:29',
      vendor: 'HP ProCurve',
      model: 'HP 2530-48G-PoE+ (J9772A)',
      osVersion: 'ProCurve OS YA.16.11.0009',
      role: DeviceRole.Switch,
      site: 'SGN-Campus HQ',
      openPorts: [22, 80, 443],
      latencyMs: 3.9,
      discoveryMethod: 'SNMPv3 + LLDP',
    },
  ],
};

export const INITIAL_ALERTS: NetworkAlert[] = [
  {
    id: 'alt-1',
    deviceId: 'dev-sw-03',
    hostname: 'sw-acc-fl3-02.corp.local',
    ip: '10.20.10.32',
    vendor: 'Cisco IOS-XE',
    severity: 'critical',
    category: 'Availability',
    message: 'ICMP & SNMP poll timeout for 14m — TenGig1/1/1 uplink reported Link-Down on sw-dist-hq01.',
    timestamp: '14m ago',
    acknowledged: false,
  },
  {
    id: 'alt-2',
    deviceId: 'dev-srv-03',
    hostname: 'srv-k8s-worker03.corp.local',
    ip: '10.10.100.43',
    vendor: 'Linux / Server',
    severity: 'critical',
    category: 'Service',
    message: 'Host unreachable on VLAN 100 — kubelet, containerd, and nginx services stopped.',
    timestamp: '26m ago',
    acknowledged: false,
  },
  {
    id: 'alt-3',
    deviceId: 'dev-rtr-03',
    hostname: 'rtr-edge-dn01.corp.local',
    ip: '192.168.88.1',
    vendor: 'MikroTik',
    severity: 'warning',
    category: 'Performance',
    message: 'CPU load sustained at 84% with IPSec tunnel jitter (28.5 ms RTT, 1.2% loss).',
    timestamp: '4m ago',
    acknowledged: false,
  },
  {
    id: 'alt-4',
    deviceId: 'dev-rtr-03',
    hostname: 'rtr-edge-dn01.corp.local',
    ip: '192.168.88.1',
    vendor: 'MikroTik',
    severity: 'warning',
    category: 'Security',
    message: 'Configuration drift vs Golden Baseline: Telnet TCP/23 enabled & default SNMP public community active.',
    timestamp: '18m ago',
    acknowledged: false,
  },
];

export const INITIAL_SCHEDULES: DiscoverySchedule[] = [
  {
    id: 'sch-1',
    name: 'HN-DC1 Fabric & Compute Sweep',
    cidr: '10.10.0.0/16',
    site: 'HN-DC1 Core',
    protocols: 'SNMPv3 · LLDP · SSH',
    cadence: 'Every 15 mins',
    lastRun: '6m ago',
    enabled: true,
  },
  {
    id: 'sch-2',
    name: 'HN-DC1 Perimeter DMZ Discovery',
    cidr: '172.16.40.0/24',
    site: 'HN-DC1 Core',
    protocols: 'SNMPv3 · NETCONF · TCP',
    cadence: 'Hourly',
    lastRun: '48m ago',
    enabled: true,
  },
  {
    id: 'sch-3',
    name: 'SGN-Campus Access VLANs',
    cidr: '10.20.20.0/24',
    site: 'SGN-Campus HQ',
    protocols: 'SNMPv3 · CDP · LLDP',
    cadence: 'Every 30 mins',
    lastRun: '22m ago',
    enabled: true,
  },
];

export function buildInitialTrafficSeries(devices: NetworkDevice[]): TrafficTelemetryPoint[] {
  const now = Date.now();
  const onlineNodes = devices.filter((d) => d.status === DeviceStatus.Online).length;
  const warningNodes = devices.filter((d) => d.status === DeviceStatus.Warning).length;
  const offlineNodes = devices.filter((d) => d.status === DeviceStatus.Offline).length;

  const baseInbound = devices
    .filter((d) => d.status !== DeviceStatus.Offline)
    .reduce((sum, d) => sum + d.inboundMbps, 0);
  const baseOutbound = devices
    .filter((d) => d.status !== DeviceStatus.Offline)
    .reduce((sum, d) => sum + d.outboundMbps, 0);
  const baseFirewall = devices
    .filter((d) => d.status !== DeviceStatus.Offline && d.role === DeviceRole.Firewall)
    .reduce((sum, d) => sum + d.inboundMbps, 0);

  const points: TrafficTelemetryPoint[] = [];
  for (let i = 23; i >= 0; i--) {
    const ts = now - i * 2000;
    const d = new Date(ts);
    const wave = Math.sin(i * 0.45) * 0.08 + Math.cos(i * 0.25) * 0.04;
    const inbound = Number((baseInbound * (1 + wave)).toFixed(1));
    const outbound = Number((baseOutbound * (1 + wave * 0.85)).toFixed(1));
    const inspected = Number((baseFirewall * (1 + wave * 0.9)).toFixed(1));

    const timeStr = d.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    points.push({
      time: timeStr,
      timestamp: ts,
      inboundMbps: inbound,
      outboundMbps: outbound,
      inspectedMbps: inspected,
      totalMbps: Number((inbound + outbound).toFixed(1)),
      onlineNodes,
      warningNodes,
      offlineNodes,
      avgLatencyMs: Number((4.8 + Math.sin(i * 0.5) * 0.6).toFixed(1)),
    });
  }
  return points;
}
