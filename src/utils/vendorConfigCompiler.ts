import {
  ComplianceFinding,
  DeviceInterface,
  DeviceVlan,
  NetworkDevice,
  UnifiedConfigPayload,
  VendorName,
  VisualFirewallRule,
  VisualRouteEntry,
} from '../types/network';

function cidrToMask(cidr: string): { ip: string; mask: string; prefix: string } {
  const [ipPart = '10.20.120.1', prefixPart = '24'] = cidr.split('/');
  const prefixNum = Math.min(32, Math.max(8, Number(prefixPart) || 24));
  const maskBits = prefixNum === 0 ? 0 : (~0 << (32 - prefixNum)) >>> 0;
  const mask = [
    (maskBits >>> 24) & 255,
    (maskBits >>> 16) & 255,
    (maskBits >>> 8) & 255,
    maskBits & 255,
  ].join('.');
  return { ip: ipPart, mask, prefix: String(prefixNum) };
}

/**
 * Compiles visual GUI changes for a single hooked device (Interfaces, VLANs, Firewall Rules, Routes)
 * into authentic vendor-specific CLI commands!
 */
export function compileVisualDeviceConfig(
  device: NetworkDevice,
  options: {
    editedInterface?: DeviceInterface | null;
    addedVlan?: DeviceVlan | null;
    addedRule?: VisualFirewallRule | null;
    addedRoute?: VisualRouteEntry | null;
  }
): string {
  const blocks: string[] = [];
  const { vendor, hostname } = device;

  // 1. Visual Interface / Port Configuration
  if (options.editedInterface) {
    const ifc = options.editedInterface;
    const isAdminUp = (ifc.adminStatus ?? 'up') === 'up';
    const vlanNum = ifc.vlan.replace(/[^0-9,]/g, '') || '1';
    const { ip, mask, prefix } = cidrToMask(ifc.ipAddress || '10.10.99.1/24');

    switch (vendor) {
      case 'Cisco IOS-XE':
      case 'Cisco NX-OS':
        blocks.push(
          [
            `! ${vendor} Visual Port Config — ${ifc.name}`,
            `configure terminal`,
            `interface ${ifc.name}`,
            ifc.description ? ` description ${ifc.description}` : null,
            ifc.mode === 'routed' && ifc.ipAddress
              ? vendor === 'Cisco NX-OS'
                ? ` no switchport\n ip address ${ip}/${prefix}`
                : ` no switchport\n ip address ${ip} ${mask}`
              : ifc.mode === 'trunk'
              ? ` switchport mode trunk\n switchport trunk allowed vlan ${vlanNum}`
              : ` switchport mode access\n switchport access vlan ${vlanNum}`,
            isAdminUp ? ` no shutdown` : ` shutdown`,
            `end`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'Fortinet':
        blocks.push(
          [
            `# FortiOS Interface Update — ${ifc.name}`,
            `config system interface`,
            `    edit "${ifc.name}"`,
            ifc.description ? `        set alias "${ifc.description}"` : null,
            ifc.ipAddress ? `        set ip ${ip} ${mask}` : null,
            `        set status ${isAdminUp ? 'up' : 'down'}`,
            `    next`,
            `end`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'Palo Alto':
        blocks.push(
          [
            `# PAN-OS Interface Commit — ${ifc.name}`,
            `configure`,
            ifc.description
              ? `set network interface ethernet ${ifc.name} comment "${ifc.description}"`
              : null,
            ifc.ipAddress
              ? `set network interface ethernet ${ifc.name} layer3 ip ${ip}/${prefix}`
              : null,
            `set network interface ethernet ${ifc.name} link-state ${isAdminUp ? 'auto' : 'down'}`,
            `commit`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'Juniper':
        blocks.push(
          [
            `# Junos Interface Update — ${ifc.name}`,
            `configure`,
            ifc.description ? `set interfaces ${ifc.name} description "${ifc.description}"` : null,
            ifc.mode === 'trunk'
              ? `set interfaces ${ifc.name} unit 0 family ethernet-switching interface-mode trunk vlan members [${vlanNum}]`
              : ifc.ipAddress
              ? `set interfaces ${ifc.name} unit 0 family inet address ${ip}/${prefix}`
              : `set interfaces ${ifc.name} unit 0 family ethernet-switching vlan members ${vlanNum}`,
            isAdminUp ? `delete interfaces ${ifc.name} disable` : `set interfaces ${ifc.name} disable`,
            `commit`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'MikroTik':
        blocks.push(
          [
            `# RouterOS Interface Update — ${ifc.name}`,
            `/interface set [ find default-name=${ifc.name} ] disabled=${isAdminUp ? 'no' : 'yes'} comment="${ifc.description || ''}"`,
            ifc.ipAddress
              ? `/ip address add address=${ip}/${prefix} interface=${ifc.name}`
              : null,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'Aruba':
        blocks.push(
          [
            `! Aruba AOS-CX Port Config — ${ifc.name}`,
            `configure terminal`,
            `interface ${ifc.name}`,
            ifc.description ? `    description ${ifc.description}` : null,
            ifc.mode === 'trunk'
              ? `    vlan trunk allowed ${vlanNum}`
              : `    vlan access ${vlanNum}`,
            isAdminUp ? `    no shutdown` : `    shutdown`,
            `end`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      default:
        blocks.push(
          `# Linux iproute2 — ${ifc.name}\nsudo ip link set dev ${ifc.name} ${isAdminUp ? 'up' : 'down'}`
        );
    }
  }

  // 2. Visual VLAN Addition
  if (options.addedVlan) {
    const v = options.addedVlan;
    const { ip, mask, prefix } = cidrToMask(v.sviIp || `10.10.${v.id}.1/24`);
    switch (vendor) {
      case 'Cisco IOS-XE':
        blocks.push(
          `configure terminal\nvlan ${v.id}\n name ${v.name}\n${
            v.sviIp ? `interface Vlan${v.id}\n ip address ${ip} ${mask}\n no shutdown\n` : ''
          }end\nwrite memory`
        );
        break;
      case 'Cisco NX-OS':
        blocks.push(
          `configure terminal\nvlan ${v.id}\n  name ${v.name}\n${
            v.sviIp ? `interface Vlan${v.id}\n  ip address ${ip}/${prefix}\n  no shutdown\n` : ''
          }copy running-config startup-config`
        );
        break;
      case 'Fortinet':
        blocks.push(
          `config system interface\n    edit "${v.name}_v${v.id}"\n        set vdom "root"\n        set interface "port2"\n        set vlanid ${v.id}\n        set ip ${ip} ${mask}\n    next\nend`
        );
        break;
      case 'Palo Alto':
        blocks.push(
          `configure\nset network interface ethernet ethernet1/1 layer3 units ethernet1/1.${v.id} tag ${v.id} ip ${ip}/${prefix}\ncommit`
        );
        break;
      case 'Juniper':
        blocks.push(
          `configure\nset vlans ${v.name} vlan-id ${v.id}\n${
            v.sviIp ? `set interfaces irb unit ${v.id} family inet address ${ip}/${prefix}\n` : ''
          }commit`
        );
        break;
      case 'MikroTik':
        blocks.push(
          `/interface vlan add name=${v.name} vlan-id=${v.id} interface=ether1\n${
            v.sviIp ? `/ip address add address=${ip}/${prefix} interface=${v.name}` : ''
          }`
        );
        break;
      default:
        blocks.push(`vlan ${v.id}\n    name ${v.name}\nwrite memory`);
    }
  }

  // 3. Visual Firewall / Security Rule Addition
  if (options.addedRule) {
    const r = options.addedRule;
    switch (vendor) {
      case 'Fortinet':
        blocks.push(
          [
            `config firewall policy`,
            `    edit 0`,
            `        set name "${r.name}"`,
            `        set srcintf "${r.srcZone}"`,
            `        set dstintf "${r.dstZone}"`,
            `        set srcaddr "${r.srcCidr}"`,
            `        set dstaddr "${r.dstCidr}"`,
            `        set action ${r.action === 'accept' ? 'accept' : 'deny'}`,
            `        set service "${r.protocol}_${r.port}"`,
            r.nat ? `        set nat enable` : `        set nat disable`,
            r.log ? `        set logtraffic all` : `        set logtraffic disable`,
            `    next`,
            `end`,
          ].join('\n')
        );
        break;
      case 'Palo Alto':
        blocks.push(
          `configure\nset rulebase security rules ${r.name} from ${r.srcZone} to ${r.dstZone} source ${r.srcCidr} destination ${r.dstCidr} service ${r.protocol}-${r.port} action ${r.action === 'accept' ? 'allow' : 'deny'} log-end ${r.log ? 'yes' : 'no'}\ncommit`
        );
        break;
      case 'MikroTik':
        blocks.push(
          `/ip firewall filter add chain=forward src-address=${r.srcCidr} dst-address=${r.dstCidr} protocol=${r.protocol.toLowerCase()} dst-port=${r.port} action=${r.action === 'accept' ? 'accept' : 'drop'} log=${r.log ? 'yes' : 'no'} comment="${r.name}"`
        );
        break;
      default:
        blocks.push(
          `configure terminal\nip access-list extended ${r.name}\n ${r.action === 'accept' ? 'permit' : 'deny'} ${r.protocol.toLowerCase()} ${r.srcCidr} ${r.dstCidr} eq ${r.port}${r.log ? ' log' : ''}\nend`
        );
    }
  }

  // 4. Visual Static / BGP Route Addition
  if (options.addedRoute) {
    const rt = options.addedRoute;
    const { ip, mask } = cidrToMask(rt.prefix);
    switch (vendor) {
      case 'Cisco IOS-XE':
        blocks.push(`configure terminal\nip route ${ip} ${mask} ${rt.nextHop} ${rt.metric}\nend\nwrite memory`);
        break;
      case 'Cisco NX-OS':
        blocks.push(`configure terminal\nip route ${rt.prefix} ${rt.nextHop} ${rt.metric}\ncopy running-config startup-config`);
        break;
      case 'Fortinet':
        blocks.push(
          `config router static\n    edit 0\n        set dst ${ip} ${mask}\n        set gateway ${rt.nextHop}\n        set device "${rt.interfaceName}"\n        set distance ${rt.metric}\n    next\nend`
        );
        break;
      case 'Palo Alto':
        blocks.push(
          `configure\nset network virtual-router default routing-table ip static-route Rt-${ip} destination ${rt.prefix} nexthop ip-address ${rt.nextHop} metric ${rt.metric}\ncommit`
        );
        break;
      case 'Juniper':
        blocks.push(`configure\nset routing-options static route ${rt.prefix} next-hop ${rt.nextHop} preference ${rt.metric}\ncommit`);
        break;
      case 'MikroTik':
        blocks.push(`/ip route add dst-address=${rt.prefix} gateway=${rt.nextHop} distance=${rt.metric}`);
        break;
      default:
        blocks.push(`ip route ${rt.prefix} ${rt.nextHop}`);
    }
  }

  if (blocks.length === 0) {
    return `# Connected to ${hostname} (${vendor} · ${device.osVersion})\n# Use the visual controls on the left to modify Ports, VLANs, Firewall Policies, or Routes.\n# Native ${vendor} CLI commands will appear here automatically prior to commit.`;
  }

  return blocks.join('\n\n');
}

/**
 * Simulates interactive vendor CLI commands inside the Hooked Device SSH/NETCONF Console
 */
export function runSimulatedDeviceCliCommand(device: NetworkDevice, rawCmd: string): string {
  const cmd = rawCmd.trim().toLowerCase();
  if (!cmd) return '';

  if (cmd === 'help' || cmd === '?') {
    return [
      `Available diagnostic commands on ${device.hostname} (${device.vendor}):`,
      `  show interfaces       — Display physical & logical port status`,
      `  show vlan             — Display configured VLAN table`,
      `  show route            — Display active routing table`,
      `  show version          — Display hardware chassis, serial & OS version`,
      `  show running-config   — Output active configuration`,
      `  ping <ip>             — Send 4 ICMP echo probes from device`,
    ].join('\n');
  }

  if (cmd.includes('int') || cmd.includes('port')) {
    const header = `Interface          Status   Admin  Speed     VLAN/Mode         Rx Mbps   Tx Mbps`;
    const sep = `-----------------  -------  -----  --------  ----------------  --------  --------`;
    const rows = device.interfaces.map(
      (i) =>
        `${i.name.padEnd(17)}  ${i.status.toUpperCase().padEnd(7)}  ${(i.adminStatus ?? 'up').toUpperCase().padEnd(5)}  ${`${i.speedMbps / 1000}G`.padEnd(8)}  ${i.vlan.slice(0, 16).padEnd(16)}  ${i.rxMbps.toFixed(1).padStart(8)}  ${i.txMbps.toFixed(1).padStart(8)}`
    );
    return [header, sep, ...rows].join('\n');
  }

  if (cmd.includes('vlan')) {
    const vlans = device.vlans || [];
    if (vlans.length === 0) return `No 802.1Q VLANs configured on ${device.hostname}.`;
    return [
      `VLAN ID  Name                  SVI Gateway        Status`,
      `-------  --------------------  -----------------  --------`,
      ...vlans.map(
        (v) =>
          `${String(v.id).padEnd(7)}  ${v.name.padEnd(20)}  ${(v.sviIp || 'L2-Only').padEnd(17)}  ${v.status}`
      ),
    ].join('\n');
  }

  if (cmd.includes('route')) {
    const routes = device.routes || [];
    return [
      `Routing Table for ${device.hostname} (${device.ip}):`,
      `C    ${device.ip}/24 is directly connected, mgmt0`,
      ...routes.map(
        (r) =>
          `${r.protocol[0]}    ${r.prefix.padEnd(18)} via ${r.nextHop.padEnd(15)} [${r.metric}/0] dev ${r.interfaceName}`
      ),
    ].join('\n');
  }

  if (cmd.includes('ver') || cmd.includes('status')) {
    return [
      `${device.vendor} — ${device.model}`,
      `Hostname: ${device.hostname} | Mgmt IP: ${device.ip}`,
      `OS Software: ${device.osVersion} | Serial: ${device.serialNumber}`,
      `CPU Load: ${device.cpuLoad}% | Memory: ${device.memoryUsage}% | Temp: ${device.tempCelsius}°C`,
    ].join('\n');
  }

  if (cmd.startsWith('ping ')) {
    const target = rawCmd.trim().slice(5).trim() || '10.10.0.1';
    return [
      `Sending 4, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
      `!!!!`,
      `Success rate is 100 percent (4/4), round-trip min/avg/max = 1.2 / 1.8 / 2.4 ms`,
    ].join('\n');
  }

  if (cmd.includes('run')) {
    return device.runningConfig;
  }

  return `${device.hostname}# Executed "${rawCmd.trim()}" — OK (0 warnings)`;
}

export function compileVendorCli(
  vendor: VendorName,
  hostname: string,
  payload: UnifiedConfigPayload
): string {
  const { ip: sviIp, mask: sviMask, prefix: sviPrefix } = cidrToMask(payload.sviCidr);

  if (payload.templateType === 'custom') {
    return `! Target Host: ${hostname} (${vendor})\n${payload.customCli.trim()}`;
  }

  switch (vendor) {
    case 'Cisco IOS-XE': {
      if (payload.templateType === 'vlan') {
        return [
          `! Cisco IOS-XE VLAN & SVI Provisioning — ${hostname}`,
          `configure terminal`,
          `vlan ${payload.vlanId}`,
          ` name ${payload.vlanName}`,
          ` exit`,
          `interface Vlan${payload.vlanId}`,
          ` description Managed-${payload.vlanName}`,
          ` ip address ${sviIp} ${sviMask}`,
          ` no shutdown`,
          ` exit`,
          `interface range ${payload.trunkPorts}`,
          ` switchport mode trunk`,
          ` switchport trunk allowed vlan add ${payload.vlanId}`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `! Cisco IOS-XE System Hardening & Telemetry Baseline — ${hostname}`,
          `configure terminal`,
          `service timestamps log datetime msec`,
          `service password-encryption`,
          `ntp server ${payload.ntpPrimary} prefer`,
          `ntp server ${payload.ntpSecondary}`,
          `logging host ${payload.syslogServer} transport udp port 514`,
          `logging trap informational`,
          `snmp-server location ${payload.snmpLocation}`,
          `snmp-server group NETVISTA-V3 v3 priv`,
          `ip ssh version 2`,
          `line vty 0 15`,
          payload.disableTelnet ? ` transport input ssh` : ` transport input telnet ssh`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `! Cisco IOS-XE Extended Security ACL — ${hostname}`,
          `configure terminal`,
          `ip access-list extended ${payload.aclName}`,
          ` ${payload.aclAction} ${payload.aclProtocol} ${payload.aclSourceCidr} ${payload.aclDestCidr} eq ${payload.aclPort} log`,
          ` permit ip any any`,
          ` exit`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      return [
        `! Cisco IOS-XE BGP Peering — ${hostname}`,
        `configure terminal`,
        `router bgp ${payload.bgpLocalAsn}`,
        ` bgp log-neighbor-changes`,
        ` neighbor ${payload.bgpNeighborIp} remote-as ${payload.bgpRemoteAsn}`,
        ` address-family ipv4 unicast`,
        `  network ${cidrToMask(payload.bgpAdvertisedPrefix).ip} mask ${cidrToMask(payload.bgpAdvertisedPrefix).mask}`,
        `  neighbor ${payload.bgpNeighborIp} activate`,
        ` exit-address-family`,
        `end`,
        `write memory`,
      ].join('\n');
    }

    case 'Cisco NX-OS': {
      if (payload.templateType === 'vlan') {
        return [
          `! Cisco NX-OS Data Center Fabric VLAN — ${hostname}`,
          `configure terminal`,
          `feature interface-vlan`,
          `vlan ${payload.vlanId}`,
          `  name ${payload.vlanName}`,
          `interface Vlan${payload.vlanId}`,
          `  description Fabric-${payload.vlanName}`,
          `  ip address ${sviIp}/${sviPrefix}`,
          `  no shutdown`,
          `interface ${payload.trunkPorts}`,
          `  switchport mode trunk`,
          `  switchport trunk allowed vlan add ${payload.vlanId}`,
          `copy running-config startup-config`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `! Cisco NX-OS System Hardening Baseline — ${hostname}`,
          `configure terminal`,
          `ntp server ${payload.ntpPrimary} prefer use-vrf management`,
          `ntp server ${payload.ntpSecondary} use-vrf management`,
          `logging server ${payload.syslogServer} 6 use-vrf management`,
          `snmp-server location ${payload.snmpLocation}`,
          payload.disableTelnet ? `no feature telnet` : `feature telnet`,
          `feature ssh`,
          `copy running-config startup-config`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `! Cisco NX-OS IPv4 ACL — ${hostname}`,
          `configure terminal`,
          `ip access-list ${payload.aclName}`,
          `  10 ${payload.aclAction} ${payload.aclProtocol} ${payload.aclSourceCidr} ${payload.aclDestCidr} eq ${payload.aclPort}`,
          `  20 permit ip any any`,
          `copy running-config startup-config`,
        ].join('\n');
      }
      return [
        `! Cisco NX-OS BGP Peering — ${hostname}`,
        `configure terminal`,
        `feature bgp`,
        `router bgp ${payload.bgpLocalAsn}`,
        `  address-family ipv4 unicast`,
        `    network ${payload.bgpAdvertisedPrefix}`,
        `  neighbor ${payload.bgpNeighborIp}`,
        `    remote-as ${payload.bgpRemoteAsn}`,
        `    address-family ipv4 unicast`,
        `copy running-config startup-config`,
      ].join('\n');
    }

    case 'Fortinet': {
      if (payload.templateType === 'vlan') {
        return [
          `# Fortinet FortiOS VLAN Subinterface — ${hostname}`,
          `config system interface`,
          `    edit "${payload.vlanName}_v${payload.vlanId}"`,
          `        set vdom "root"`,
          `        set ip ${sviIp} ${sviMask}`,
          `        set allowaccess ping https ssh`,
          `        set interface "port1"`,
          `        set vlanid ${payload.vlanId}`,
          `    next`,
          `end`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `# Fortinet FortiOS Security & Log Baseline — ${hostname}`,
          `config system ntp`,
          `    set ntpsync enable`,
          `    set type custom`,
          `    config ntpserver`,
          `        edit 1`,
          `            set server "${payload.ntpPrimary}"`,
          `        next`,
          `        edit 2`,
          `            set server "${payload.ntpSecondary}"`,
          `        next`,
          `    end`,
          `end`,
          `config log syslogd setting`,
          `    set status enable`,
          `    set server "${payload.syslogServer}"`,
          `end`,
          `config system snmp sysinfo`,
          `    set status enable`,
          `    set location "${payload.snmpLocation}"`,
          `end`,
          payload.disableTelnet ? `# Admin access restricted to HTTPS/SSH only (Telnet disabled)` : `# Telnet allowed`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `# Fortinet FortiOS Firewall Policy — ${hostname}`,
          `config firewall policy`,
          `    edit 0`,
          `        set name "${payload.aclName}"`,
          `        set srcintf "any"`,
          `        set dstintf "any"`,
          `        set srcaddr "${payload.aclSourceCidr}"`,
          `        set dstaddr "${payload.aclDestCidr}"`,
          `        set action ${payload.aclAction === 'permit' ? 'accept' : 'deny'}`,
          `        set schedule "always"`,
          `        set service "${payload.aclProtocol.toUpperCase()}_${payload.aclPort}"`,
          `        set logtraffic all`,
          `    next`,
          `end`,
        ].join('\n');
      }
      return [
        `# Fortinet FortiOS BGP Configuration — ${hostname}`,
        `config router bgp`,
        `    set as ${payload.bgpLocalAsn}`,
        `    config neighbor`,
        `        edit "${payload.bgpNeighborIp}"`,
        `            set remote-as ${payload.bgpRemoteAsn}`,
        `        next`,
        `    end`,
        `    config network`,
        `        edit 1`,
        `            set prefix ${payload.bgpAdvertisedPrefix}`,
        `        next`,
        `    end`,
        `end`,
      ].join('\n');
    }

    case 'Palo Alto': {
      if (payload.templateType === 'vlan') {
        return [
          `# Palo Alto PAN-OS Layer 3 Subinterface — ${hostname}`,
          `configure`,
          `set network interface ethernet ethernet1/1 layer3 units ethernet1/1.${payload.vlanId} tag ${payload.vlanId} ip ${sviIp}/${sviPrefix}`,
          `set zone ${payload.vlanName} network layer3 ethernet1/1.${payload.vlanId}`,
          `commit`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `# Palo Alto PAN-OS Management & Telemetry Baseline — ${hostname}`,
          `configure`,
          `set deviceconfig system ntp-servers primary-ntp-server ntp-server-address ${payload.ntpPrimary}`,
          `set deviceconfig system ntp-servers secondary-ntp-server ntp-server-address ${payload.ntpSecondary}`,
          `set shared log-settings syslog NetVista-SIEM server ${payload.syslogServer} transport UDP port 514`,
          `set deviceconfig system snmp-setting access-setting version v3`,
          `set deviceconfig system location "${payload.snmpLocation}"`,
          payload.disableTelnet
            ? `set deviceconfig system service disable-telnet yes`
            : `set deviceconfig system service disable-telnet no`,
          `commit`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `# Palo Alto PAN-OS Security Rulebase — ${hostname}`,
          `configure`,
          `set rulebase security rules ${payload.aclName} from any to any source ${payload.aclSourceCidr} destination ${payload.aclDestCidr} application any service service-${payload.aclProtocol}-${payload.aclPort} action ${payload.aclAction === 'permit' ? 'allow' : 'deny'} log-end yes`,
          `commit`,
        ].join('\n');
      }
      return [
        `# Palo Alto PAN-OS Virtual Router BGP — ${hostname}`,
        `configure`,
        `set network virtual-router default protocol bgp enable yes local-as ${payload.bgpLocalAsn}`,
        `set network virtual-router default protocol bgp peer-group EBGP peer Peer-1 peer-address ip ${payload.bgpNeighborIp}`,
        `set network virtual-router default protocol bgp peer-group EBGP peer Peer-1 peer-as ${payload.bgpRemoteAsn}`,
        `set network virtual-router default protocol bgp redist-rules ${payload.bgpAdvertisedPrefix} enable yes`,
        `commit`,
      ].join('\n');
    }

    case 'Juniper': {
      if (payload.templateType === 'vlan') {
        return [
          `# Juniper Junos VLAN & IRB Configuration — ${hostname}`,
          `configure`,
          `set vlans ${payload.vlanName} vlan-id ${payload.vlanId}`,
          `set interfaces irb unit ${payload.vlanId} family inet address ${sviIp}/${sviPrefix}`,
          `set vlans ${payload.vlanName} l3-interface irb.${payload.vlanId}`,
          `set interfaces xe-0/0/0 unit 0 family ethernet-switching interface-mode trunk vlan members ${payload.vlanName}`,
          `commit and-quit`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `# Juniper Junos System Hardening Baseline — ${hostname}`,
          `configure`,
          `set system ntp server ${payload.ntpPrimary} prefer`,
          `set system ntp server ${payload.ntpSecondary}`,
          `set system syslog host ${payload.syslogServer} any info`,
          `set snmp location "${payload.snmpLocation}"`,
          `set system services ssh protocol-version v2`,
          payload.disableTelnet ? `delete system services telnet` : `set system services telnet`,
          `commit and-quit`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `# Juniper Junos Stateless Firewall Filter — ${hostname}`,
          `configure`,
          `set firewall family inet filter ${payload.aclName} term T1 from source-address ${payload.aclSourceCidr}`,
          `set firewall family inet filter ${payload.aclName} term T1 from destination-address ${payload.aclDestCidr}`,
          `set firewall family inet filter ${payload.aclName} term T1 from protocol ${payload.aclProtocol} destination-port ${payload.aclPort}`,
          `set firewall family inet filter ${payload.aclName} term T1 then ${payload.aclAction === 'permit' ? 'accept' : 'discard'} syslog`,
          `set firewall family inet filter ${payload.aclName} term DEFAULT then accept`,
          `commit and-quit`,
        ].join('\n');
      }
      return [
        `# Juniper Junos BGP Group — ${hostname}`,
        `configure`,
        `set routing-options autonomous-system ${payload.bgpLocalAsn}`,
        `set protocols bgp group EXTERNAL type external peer-as ${payload.bgpRemoteAsn}`,
        `set protocols bgp group EXTERNAL neighbor ${payload.bgpNeighborIp}`,
        `commit and-quit`,
      ].join('\n');
    }

    case 'MikroTik': {
      if (payload.templateType === 'vlan') {
        return [
          `# MikroTik RouterOS v7 VLAN & IP Provisioning — ${hostname}`,
          `/interface vlan add interface=sfp-sfpplus1 name=${payload.vlanName}-vlan${payload.vlanId} vlan-id=${payload.vlanId}`,
          `/ip address add address=${sviIp}/${sviPrefix} interface=${payload.vlanName}-vlan${payload.vlanId} comment="Managed ${payload.vlanName}"`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `# MikroTik RouterOS v7 Hardening & Telemetry — ${hostname}`,
          `/system ntp client set enabled=yes servers=${payload.ntpPrimary},${payload.ntpSecondary}`,
          `/system logging action add name=netvista target=remote remote=${payload.syslogServer}`,
          `/system logging add topics=info,warning,critical action=netvista`,
          `/snmp set enabled=yes location="${payload.snmpLocation}"`,
          payload.disableTelnet
            ? `/ip service set telnet disabled=yes; /ip service set ssh disabled=no`
            : `/ip service set telnet disabled=no`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `# MikroTik RouterOS v7 Firewall Filter — ${hostname}`,
          `/ip firewall filter add chain=forward src-address=${payload.aclSourceCidr} dst-address=${payload.aclDestCidr} protocol=${payload.aclProtocol} dst-port=${payload.aclPort} action=${payload.aclAction === 'permit' ? 'accept' : 'drop'} log=yes comment="${payload.aclName}"`,
        ].join('\n');
      }
      return [
        `# MikroTik RouterOS v7 BGP Connection — ${hostname}`,
        `/routing bgp connection add name=peer-${payload.bgpRemoteAsn} local.role=ebgp as=${payload.bgpLocalAsn} remote.address=${payload.bgpNeighborIp}/32 remote.as=${payload.bgpRemoteAsn} output.network=${payload.bgpAdvertisedPrefix}`,
      ].join('\n');
    }

    case 'Aruba': {
      if (payload.templateType === 'vlan') {
        return [
          `! Aruba AOS-CX Campus VLAN — ${hostname}`,
          `configure terminal`,
          `vlan ${payload.vlanId}`,
          `    name ${payload.vlanName}`,
          `interface vlan ${payload.vlanId}`,
          `    ip address ${sviIp}/${sviPrefix}`,
          `    no shutdown`,
          `interface 1/1/49-1/1/50`,
          `    vlan trunk allowed ${payload.vlanId}`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `! Aruba AOS-CX Baseline Hardening — ${hostname}`,
          `configure terminal`,
          `ntp server ${payload.ntpPrimary} prefer`,
          `ntp server ${payload.ntpSecondary}`,
          `ntp enable`,
          `logging ${payload.syslogServer} severity info`,
          `snmp-server system-location "${payload.snmpLocation}"`,
          `ssh server vrf default`,
          payload.disableTelnet ? `no telnet server` : `telnet server`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `! Aruba AOS-CX Access-List — ${hostname}`,
          `configure terminal`,
          `access-list ip ${payload.aclName}`,
          `    10 ${payload.aclAction} ${payload.aclProtocol} ${payload.aclSourceCidr} ${payload.aclDestCidr} eq ${payload.aclPort} log`,
          `    20 permit any any any`,
          `end`,
          `write memory`,
        ].join('\n');
      }
      return [
        `! Aruba AOS-CX BGP Peering — ${hostname}`,
        `configure terminal`,
        `router bgp ${payload.bgpLocalAsn}`,
        `    neighbor ${payload.bgpNeighborIp} remote-as ${payload.bgpRemoteAsn}`,
        `    address-family ipv4 unicast`,
        `        neighbor ${payload.bgpNeighborIp} activate`,
        `        network ${payload.bgpAdvertisedPrefix}`,
        `end`,
        `write memory`,
      ].join('\n');
    }

    case 'Linux / Server':
    default: {
      if (payload.templateType === 'vlan') {
        return [
          `# Linux Netplan 802.1Q VLAN Interface — ${hostname}`,
          `network:`,
          `  version: 2`,
          `  vlans:`,
          `    vlan${payload.vlanId}:`,
          `      id: ${payload.vlanId}`,
          `      link: eno1`,
          `      addresses: [${sviIp}/${sviPrefix}]`,
        ].join('\n');
      }
      if (payload.templateType === 'baseline') {
        return [
          `# Linux Server Chrony NTP, Rsyslog & SSHD Hardening — ${hostname}`,
          `echo "server ${payload.ntpPrimary} iburst prefer" | sudo tee -a /etc/chrony/chrony.conf`,
          `echo "*.* @${payload.syslogServer}:514" | sudo tee /etc/rsyslog.d/50-netvista.conf`,
          payload.disableTelnet ? `sudo systemctl disable --now telnet.socket 2>/dev/null || true` : `# Telnet unchanged`,
          `sudo systemctl restart chrony rsyslog sshd`,
        ].join('\n');
      }
      if (payload.templateType === 'acl') {
        return [
          `# Linux UFW / Netfilter Rule — ${hostname}`,
          `sudo ufw ${payload.aclAction === 'permit' ? 'allow' : 'deny'} proto ${payload.aclProtocol} from ${payload.aclSourceCidr} to ${payload.aclDestCidr} port ${payload.aclPort} comment "${payload.aclName}"`,
          `sudo ufw reload`,
        ].join('\n');
      }
      return [
        `# FRRouting (FRR) BGP Daemon Config — ${hostname}`,
        `sudo vtysh -c "configure terminal" -c "router bgp ${payload.bgpLocalAsn}" -c "neighbor ${payload.bgpNeighborIp} remote-as ${payload.bgpRemoteAsn}" -c "end" -c "write memory"`,
      ].join('\n');
    }
  }
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  lineNumberOld: number | null;
  lineNumberNew: number | null;
  text: string;
}

export function computeConfigDiff(oldConfig: string, newConfig: string): DiffLine[] {
  const oldLines = oldConfig.split('\n');
  const newLines = newConfig.split('\n');
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oLine = i < oldLines.length ? oldLines[i] : undefined;
    const nLine = j < newLines.length ? newLines[j] : undefined;

    if (oLine !== undefined && nLine !== undefined && oLine === nLine) {
      result.push({
        type: 'unchanged',
        lineNumberOld: i + 1,
        lineNumberNew: j + 1,
        text: oLine,
      });
      i++;
      j++;
    } else if (oLine !== undefined && !newSet.has(oLine)) {
      result.push({
        type: 'removed',
        lineNumberOld: i + 1,
        lineNumberNew: null,
        text: oLine,
      });
      i++;
    } else if (nLine !== undefined && !oldSet.has(nLine)) {
      result.push({
        type: 'added',
        lineNumberOld: null,
        lineNumberNew: j + 1,
        text: nLine,
      });
      j++;
    } else if (oLine !== undefined) {
      result.push({
        type: 'removed',
        lineNumberOld: i + 1,
        lineNumberNew: null,
        text: oLine,
      });
      i++;
    } else if (nLine !== undefined) {
      result.push({
        type: 'added',
        lineNumberOld: null,
        lineNumberNew: j + 1,
        text: nLine,
      });
      j++;
    }
  }

  return result;
}

export function auditDeviceCompliance(device: NetworkDevice): ComplianceFinding[] {
  const cfg = device.runningConfig.toLowerCase();
  const findings: ComplianceFinding[] = [];

  const telnetEnabled =
    cfg.includes('transport input telnet') ||
    cfg.includes('service set telnet disabled=no') ||
    cfg.includes('disable-telnet no') ||
    (cfg.includes('feature telnet') && !cfg.includes('no feature telnet'));

  if (telnetEnabled) {
    findings.push({
      id: `${device.id}-cis-01`,
      ruleCode: 'CIS-NET-1.1',
      title: 'Unencrypted Telnet management protocol enabled',
      severity: 'critical',
      remediationTemplate: 'baseline',
      description: 'Cleartext management traffic exposes credentials on transit VLANs. Enforce SSHv2 only.',
    });
  }

  if (!cfg.includes('ntp')) {
    findings.push({
      id: `${device.id}-cis-02`,
      ruleCode: 'CIS-NET-2.4',
      title: 'Authoritative NTP time synchronization missing',
      severity: 'warning',
      remediationTemplate: 'baseline',
      description: 'Accurate clock synchronization is required for syslog correlation and TLS certificate validation.',
    });
  }

  if (!cfg.includes('syslog') && !cfg.includes('logging')) {
    findings.push({
      id: `${device.id}-cis-03`,
      ruleCode: 'CIS-NET-3.2',
      title: 'Centralized remote Syslog target not configured',
      severity: 'warning',
      remediationTemplate: 'baseline',
      description: 'Device events are only stored in volatile local buffer and will be lost on reboot.',
    });
  }

  if (cfg.includes('community public') || cfg.includes('community private')) {
    findings.push({
      id: `${device.id}-cis-04`,
      ruleCode: 'CIS-NET-4.1',
      title: 'Default SNMPv2c community string detected',
      severity: 'critical',
      remediationTemplate: 'baseline',
      description: 'Replace default public/private SNMPv2c strings with authenticated SNMPv3 AuthPriv groups.',
    });
  }

  return findings;
}
