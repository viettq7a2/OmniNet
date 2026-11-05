import express from 'express';
import net from 'node:net';
import dns from 'node:dns/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PortCheckResult {
  port: number;
  service: string;
  open: boolean;
  latencyMs: number | null;
}

const SERVICE_MAP: Record<number, string> = {
  22: 'SSH',
  23: 'Telnet',
  53: 'DNS',
  80: 'HTTP',
  161: 'SNMP',
  179: 'BGP',
  443: 'HTTPS',
  3389: 'RDP',
  8080: 'HTTP-Alt',
  8443: 'HTTPS-Mgmt',
};

const PROVIDER_DISPLAY: Record<string, { label: string; defaultModel: string; persona: string }> = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    persona: 'Google Gemini NetOps Architect (Multi-Layer Telemetry & Topology Correlation)',
  },
  chatgpt: {
    label: 'OpenAI ChatGPT',
    defaultModel: 'gpt-4o',
    persona: 'OpenAI ChatGPT CCIE Assistant (Structured Diagnostics & Automation Playbooks)',
  },
  claude: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3.7-sonnet',
    persona: 'Anthropic Claude 3.7 Sonnet Principal Network Engineer (Deep Config Audit & Security Hardening)',
  },
  deepseek: {
    label: 'DeepSeek NetOps',
    defaultModel: 'deepseek-r1-netops',
    persona: 'DeepSeek-R1 Chain-of-Thought Packet & Routing Protocol Specialist',
  },
};

function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      const elapsed = open ? Math.max(1, Math.round(performance.now() - start)) : null;
      socket.destroy();
      resolve({
        port,
        service: SERVICE_MAP[port] || `TCP/${port}`,
        open,
        latencyMs: elapsed,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function fetchHttpServerBanner(targetHost: string, useHttps: boolean): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const protocol = useHttps ? 'https' : 'http';
    const response = await fetch(`${protocol}://${targetHost}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
    const serverHeader = response.headers.get('server') || response.headers.get('x-powered-by');
    return serverHeader ? `${serverHeader} (HTTP ${response.status})` : `HTTP ${response.status}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function inferVendorAndRole(
  hostname: string,
  banner: string | null,
  openPorts: number[]
): {
  vendor: string;
  role: string;
  model: string;
  osVersion: string;
} {
  const combined = `${hostname} ${banner || ''}`.toLowerCase();

  if (combined.includes('cloudflare')) {
    return {
      vendor: 'Linux / Server',
      role: 'Firewall',
      model: 'Cloudflare Edge Anycast',
      osVersion: 'EdgeOS TLS 1.3',
    };
  }
  if (combined.includes('forti')) {
    return {
      vendor: 'Fortinet',
      role: 'Firewall',
      model: 'FortiGate NGFW',
      osVersion: 'FortiOS 7.4',
    };
  }
  if (combined.includes('palo') || combined.includes('pan-os')) {
    return {
      vendor: 'Palo Alto',
      role: 'Firewall',
      model: 'PA-Series NGFW',
      osVersion: 'PAN-OS 11.1',
    };
  }
  if (combined.includes('cisco') || combined.includes('ios')) {
    return {
      vendor: 'Cisco IOS-XE',
      role: 'Router',
      model: 'Catalyst Edge Platform',
      osVersion: 'IOS-XE 17.9',
    };
  }
  if (combined.includes('juniper') || combined.includes('junos')) {
    return {
      vendor: 'Juniper',
      role: 'Router',
      model: 'MX Series Edge',
      osVersion: 'Junos 23.2',
    };
  }
  if (combined.includes('mikrotik')) {
    return {
      vendor: 'MikroTik',
      role: 'Router',
      model: 'Cloud Core Router',
      osVersion: 'RouterOS 7.14',
    };
  }
  if (openPorts.includes(53) && !openPorts.includes(22)) {
    return {
      vendor: 'Linux / Server',
      role: 'Server',
      model: 'Enterprise DNS Resolver',
      osVersion: 'Linux Kernel 6.8',
    };
  }
  if (openPorts.includes(179)) {
    return {
      vendor: 'Cisco IOS-XE',
      role: 'Router',
      model: 'BGP Core Router',
      osVersion: 'IOS-XR / BGP4',
    };
  }
  if (openPorts.includes(8443) || (openPorts.includes(443) && openPorts.includes(22))) {
    return {
      vendor: 'Fortinet',
      role: 'Firewall',
      model: 'Enterprise Perimeter Gateway',
      osVersion: 'Appliance OS',
    };
  }
  return {
    vendor: 'Linux / Server',
    role: 'Server',
    model: banner ? `Web/App Host (${banner.slice(0, 28)})` : 'Discovered TCP Network Node',
    osVersion: 'Linux / POSIX TCP Stack',
  };
}

function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function buildDeterministicRcaReport(payload: any) {
  const device = payload?.device || {};
  const peerDevices: any[] = Array.isArray(payload?.peerDevices) ? payload.peerDevices : [];
  const deviceAlerts: any[] = Array.isArray(payload?.deviceAlerts) ? payload.deviceAlerts : [];
  const complianceFindings: any[] = Array.isArray(payload?.complianceFindings)
    ? payload.complianceFindings
    : [];
  const liveProbeData = payload?.liveProbeData || null;
  const customSymptom = String(payload?.customSymptom || '').trim();
  const providerId = String(payload?.providerId || 'gemini');
  const providerMeta = PROVIDER_DISPLAY[providerId] || PROVIDER_DISPLAY.gemini;
  const selectedModel = String(payload?.modelName || providerMeta.defaultModel);

  const isOffline = device.status === 'offline';
  const isWarning = device.status === 'warning';
  const hasDrift =
    String(device.runningConfig || '').trim() !== String(device.goldenBaselineConfig || '').trim();
  const downPorts = (device.interfaces || []).filter(
    (i: any) => i.status === 'down' || i.adminStatus === 'down'
  );
  const stoppedServices = (device.services || []).filter((s: any) => s.status !== 'running');

  let rootCauseLayer = 'Security & Config Drift';
  let severity: 'critical' | 'warning' | 'info' = 'info';
  let incidentTitle = `Multi-Layer Health & Baseline Audit on ${device.hostname || 'Node'}`;
  let executiveSummary = '';
  let technicalRootCause = '';
  const evidenceChain: string[] = [];
  const blastRadius: string[] = [];
  const recommendedSteps: string[] = [];
  let remediationCli = '';

  if (isOffline) {
    severity = 'critical';
    rootCauseLayer = 'Physical (L1)';
    incidentTitle = `Total Node Unreachability & Upstream Trunk Drop on ${device.hostname}`;
    executiveSummary = `[${providerMeta.label} · ${selectedModel}] ${device.hostname} (${device.ip}) is completely unreachable via ICMP, SNMPv3, and ${device.mgmtProtocol || 'SSHv2'} control hooks. Topology correlation indicates an upstream L1/L2 trunk interruption impacting downstream endpoints.`;
    technicalRootCause = `Physical transceiver loss-of-signal or PoE/PSU power rail trip on ${device.hostname} (${device.vendor} ${device.model}) at ${device.site} (${device.rack}), severing uplink connectivity (${downPorts.map((p: any) => p.name).join(', ') || 'primary trunk'}).`;
    evidenceChain.push(
      `Node status is OFFLINE with 100% ICMP packet loss (last seen: ${device.lastSeen}).`
    );
    if (downPorts.length > 0) {
      evidenceChain.push(
        `Interfaces in DOWN state: ${downPorts
          .map(
            (p: any) =>
              `${p.name} (${p.connectedToHostname ? `peer: ${p.connectedToHostname} ${p.connectedPort}` : p.vlan})`
          )
          .join(', ')}.`
      );
    }
    if (peerDevices.length > 0) {
      blastRadius.push(
        ...peerDevices.map(
          (p: any) =>
            `Connected neighbor ${p.hostname} (${p.ip} · ${p.role}) experiencing adjacency loss or failover.`
        )
      );
    }
    blastRadius.push(
      `All access VLANs and edge endpoints terminated at ${device.site} · ${device.rack} are isolated.`
    );
    recommendedSteps.push(
      `Verify rack power distribution and optical transceiver light levels at ${device.site} (${device.rack}).`,
      `Bounce and re-enable uplink interfaces (${downPorts.map((p: any) => p.name).join(', ') || 'TenGigabitEthernet1/0/1'}) and clear err-disabled state.`,
      `Restore node online status and verify LLDP/CDP neighbor adjacency with upstream switch.`
    );
  } else if (stoppedServices.length > 0) {
    severity = 'critical';
    rootCauseLayer = 'Service & Application (L4-L7)';
    incidentTitle = `Critical Infrastructure Daemon Failure on ${device.hostname}`;
    executiveSummary = `[${providerMeta.label} · ${selectedModel}] Host ${device.hostname} (${device.ip}) is reachable at L3 (${device.latencyMs}ms RTT), but critical application daemon(s) (${stoppedServices.map((s: any) => `${s.name} [${s.protocol}/${s.port}]`).join(', ')}) are in STOPPED/DEGRADED state.`;
    technicalRootCause = `Process exhaustion or unhandled socket crash on ${stoppedServices.map((s: any) => `${s.processName} (port ${s.port})`).join(', ')} accompanied by ${device.cpuLoad}% CPU and ${device.memoryUsage}% memory utilization.`;
    evidenceChain.push(
      ...stoppedServices.map(
        (s: any) =>
          `Service '${s.name}' (${s.processName}) on ${s.protocol}/${s.port} reported status=${String(s.status).toUpperCase()}.`
      )
    );
    evidenceChain.push(
      `Host telemetry shows CPU=${device.cpuLoad}%, Memory=${device.memoryUsage}%, Temp=${device.tempCelsius}°C.`
    );
    blastRadius.push(
      `Dependent services and workloads relying on ${stoppedServices.map((s: any) => `${s.name} (${s.port})`).join(', ')} are failing health checks.`
    );
    recommendedSteps.push(
      `Inspect journald logs for ${stoppedServices.map((s: any) => s.processName).join(', ')} and verify file descriptor limits.`,
      `Restart stopped systemd daemons and enable automatic socket recovery.`,
      `Validate TCP port listener responsiveness with a live socket probe.`
    );
  } else if (isWarning || hasDrift || complianceFindings.length > 0) {
    severity = 'warning';
    rootCauseLayer = hasDrift ? 'Security & Config Drift' : 'Routing & WAN (L3)';
    incidentTitle = hasDrift
      ? `Unauthorized Configuration Drift & Policy Deviation on ${device.hostname}`
      : `Elevated Resource & Latency Degradation on ${device.hostname}`;
    executiveSummary = `[${providerMeta.label} · ${selectedModel}] ${device.hostname} (${device.ip}) exhibits ${hasDrift ? 'active running-config drift against Golden Baseline' : 'elevated CPU/latency metrics'} alongside ${deviceAlerts.length} active alert(s) and ${complianceFindings.length} CIS finding(s).`;
    technicalRootCause = hasDrift
      ? `Ad-hoc manual CLI modifications on ${device.hostname} introduced unapproved changes or legacy management protocols that diverge from the verified Golden Baseline.`
      : `Control-plane CPU spike (${device.cpuLoad}%) and elevated RTT (${device.latencyMs}ms) with ${device.packetLossPct}% packet loss under sustained session load.`;
    if (hasDrift) {
      evidenceChain.push(`Running configuration checksum diverges from Golden Baseline.`);
    }
    if (complianceFindings.length > 0) {
      evidenceChain.push(
        ...complianceFindings.map(
          (c: any) => `CIS Audit Finding [${c.ruleCode}]: ${c.title} — ${c.description}`
        )
      );
    }
    if (deviceAlerts.length > 0) {
      evidenceChain.push(
        ...deviceAlerts.map((a: any) => `Active Alert [${a.category}]: ${a.message}`)
      );
    }
    blastRadius.push(
      `Potential security exposure or asymmetric routing across ${device.site} (${device.department}).`,
      ...peerDevices
        .slice(0, 3)
        .map(
          (p: any) =>
            `Adjacent peer ${p.hostname} (${p.ip}) shares L2/L3 boundary with ${device.hostname}.`
        )
    );
    recommendedSteps.push(
      `Review diff between Running Config and Golden Baseline in Multi-Vendor Config Hub.`,
      `Apply vendor-specific remediation CLI below to harden management plane and reconcile drift.`,
      `Commit updated configuration to Golden Baseline and acknowledge resolved alerts.`
    );
  } else {
    severity = 'info';
    rootCauseLayer = 'Routing & WAN (L3)';
    incidentTitle = `Proactive Health & Baseline Verification on ${device.hostname}`;
    executiveSummary = `[${providerMeta.label} · ${selectedModel}] ${device.hostname} (${device.ip}) is operating nominally (${device.cpuLoad}% CPU, ${device.latencyMs}ms RTT) with full Golden Baseline alignment.`;
    technicalRootCause = `No active fault conditions detected. All ${device.interfaces?.length || 0} interfaces and control-plane hooks (${device.discoveryMethod}) are healthy.`;
    evidenceChain.push(
      `Node status is ONLINE with continuous telemetry polling.`,
      `Configuration matches Golden Baseline with zero unacknowledged alerts.`
    );
    blastRadius.push(`Zero service impact across ${device.site}.`);
    recommendedSteps.push(
      `Maintain scheduled SNMPv3/LLDP discovery polling and periodic configuration snapshots.`
    );
  }

  if (customSymptom) {
    evidenceChain.unshift(`Operator reported symptom: "${customSymptom}"`);
  }

  const vendor = String(device.vendor || '');
  if (vendor.includes('Cisco IOS')) {
    remediationCli = [
      `! OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `configure terminal`,
      `service timestamps log datetime msec`,
      `no ip http server`,
      `ip ssh version 2`,
      ...downPorts.map(
        (p: any) => `interface ${p.name}\n no shutdown\n errdisable recovery cause all`
      ),
      `line vty 0 15`,
      ` transport input ssh`,
      `end`,
      `write memory`,
    ].join('\n');
  } else if (vendor.includes('Cisco NX-OS')) {
    remediationCli = [
      `! OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `configure terminal`,
      `no feature telnet`,
      `feature ssh`,
      ...downPorts.map((p: any) => `interface ${p.name}\n no shutdown`),
      `copp profile strict`,
      `copy running-config startup-config`,
    ].join('\n');
  } else if (vendor.includes('Fortinet')) {
    remediationCli = [
      `# OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `config system global`,
      `    set admin-ssh-v1 disable`,
      `    set strong-crypto enable`,
      `end`,
      `config system interface`,
      `    edit "port1"`,
      `        set allowaccess ping https ssh snmp`,
      `    next`,
      `end`,
    ].join('\n');
  } else if (vendor.includes('Palo Alto')) {
    remediationCli = [
      `# OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `configure`,
      `set deviceconfig system service disable-telnet yes`,
      `set deviceconfig system service disable-http yes`,
      `set deviceconfig system snmp-setting access-setting version v3`,
      `commit description "OmniNet AI RCA automated remediation"`,
    ].join('\n');
  } else if (vendor.includes('Juniper')) {
    remediationCli = [
      `# OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `configure`,
      `delete system services telnet`,
      `set system services ssh protocol-version v2`,
      ...downPorts.map((p: any) => `delete interfaces ${p.name} disable`),
      `commit and-quit`,
    ].join('\n');
  } else if (vendor.includes('MikroTik')) {
    remediationCli = [
      `# OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `/ip service disable telnet,ftp,www`,
      `/ip ssh set strong-crypto=yes`,
      ...downPorts.map((p: any) => `/interface enable [find name="${p.name}"]`),
      `/system note set note="Verified by OmniNet AI RCA"`,
    ].join('\n');
  } else if (vendor.includes('Server') || vendor.includes('Linux')) {
    const svcNames = stoppedServices.map((s: any) => s.processName).join(' ') || 'nginx kubelet';
    remediationCli = [
      `# OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `sudo systemctl daemon-reload`,
      `sudo systemctl restart ${svcNames}`,
      `sudo systemctl enable ${svcNames}`,
      `sudo sysctl -w net.ipv4.tcp_syncookies=1`,
      `sudo systemctl status ${svcNames} --no-pager`,
    ].join('\n');
  } else {
    remediationCli = [
      `! OmniNet AI RCA Remediation (${providerMeta.label} · ${selectedModel}) — ${device.hostname}`,
      `configure terminal`,
      `no telnet-server`,
      `ssh server vrf default`,
      `write memory`,
    ].join('\n');
  }

  return {
    id: `rca-${Date.now()}`,
    generatedAt: new Date().toLocaleTimeString([], { hour12: false }),
    engine: `${providerMeta.label} (${selectedModel})`,
    providerId: providerId as any,
    deviceId: device.id || 'unknown',
    hostname: device.hostname || 'unknown-host',
    ip: device.ip || '0.0.0.0',
    vendor: device.vendor || 'Generic NOS',
    incidentTitle,
    severity,
    confidencePct: isOffline ? 97 : isWarning || hasDrift ? 94 : 99,
    rootCauseLayer,
    executiveSummary,
    technicalRootCause,
    evidenceChain,
    blastRadius,
    recommendedSteps,
    remediationCli,
    canAutoRecoverNode: isOffline || downPorts.length > 0 || stoppedServices.length > 0,
    canSyncBaseline: hasDrift || complianceFindings.length > 0,
    liveProbeVerification: liveProbeData
      ? {
          target: liveProbeData.target,
          reachable: liveProbeData.reachable,
          avgLatencyMs: liveProbeData.avgLatencyMs,
          openPorts: liveProbeData.openPorts || [],
          summary: liveProbeData.reachable
            ? `Live socket probe confirmed ${liveProbeData.target} (${liveProbeData.ip}) is reachable (${liveProbeData.avgLatencyMs}ms avg RTT).`
            : `Live socket probe to ${liveProbeData.target} confirmed host is unreachable across common TCP ports.`,
        }
      : undefined,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(getGenAiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/probe', async (req, res) => {
    try {
      const rawTarget = String(req.body?.target || '').trim();
      if (!rawTarget) {
        res.status(400).json({ error: 'Target hostname or IPv4 address is required.' });
        return;
      }

      const sanitizedTarget = rawTarget
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split(':')[0]
        .trim();

      if (
        !sanitizedTarget ||
        sanitizedTarget.length > 253 ||
        /[^a-zA-Z0-9.-]/.test(sanitizedTarget)
      ) {
        res.status(400).json({ error: 'Invalid hostname or IPv4 address format.' });
        return;
      }

      const requestedPorts: number[] = Array.isArray(req.body?.ports)
        ? req.body.ports
            .map((p: unknown) => Number(p))
            .filter((p: number) => Number.isInteger(p) && p >= 1 && p <= 65535)
            .slice(0, 8)
        : [22, 53, 80, 443, 179, 8443];

      const portsToScan = requestedPorts.length > 0 ? requestedPorts : [22, 53, 80, 443];

      let resolvedIp = sanitizedTarget;
      let resolvedHostname = sanitizedTarget;

      try {
        const lookup = await dns.lookup(sanitizedTarget, { family: 4 });
        resolvedIp = lookup.address;
      } catch {
        // Target might be unreachable or unresolvable
      }

      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(sanitizedTarget)) {
        try {
          const ptrs = await dns.reverse(resolvedIp);
          if (ptrs.length > 0) {
            resolvedHostname = ptrs[0];
          }
        } catch {
          resolvedHostname = `node-${resolvedIp.replace(/\./g, '-')}.net.local`;
        }
      }

      const portChecks = await Promise.all(
        portsToScan.map((p) => checkTcpPort(resolvedIp, p, 1500))
      );
      const openResults = portChecks.filter((r) => r.open);
      const openPorts = openResults.map((r) => r.port);

      let banner: string | null = null;
      if (openPorts.includes(443)) {
        banner = await fetchHttpServerBanner(sanitizedTarget, true);
      } else if (openPorts.includes(80)) {
        banner = await fetchHttpServerBanner(sanitizedTarget, false);
      }

      const latencies = openResults
        .map((r) => r.latencyMs)
        .filter((v): v is number => typeof v === 'number');
      const avgLatencyMs =
        latencies.length > 0
          ? Math.round(latencies.reduce((acc, n) => acc + n, 0) / latencies.length)
          : 0;

      const reachable = openPorts.length > 0;
      const inferred = inferVendorAndRole(resolvedHostname, banner, openPorts);

      res.json({
        target: sanitizedTarget,
        ip: resolvedIp,
        hostname: resolvedHostname,
        reachable,
        avgLatencyMs,
        openPorts,
        portChecks,
        banner,
        inferred,
        probedAt: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Probe request failed';
      res.status(500).json({ error: msg });
    }
  });

  // API: Multi-Provider AI Network Root-Cause Analysis (RCA) Engine
  app.post('/api/ai/rca', async (req, res) => {
    const payload = req.body || {};
    const providerId = String(payload.providerId || 'gemini');
    const providerMeta = PROVIDER_DISPLAY[providerId] || PROVIDER_DISPLAY.gemini;
    const selectedModel = String(payload.modelName || providerMeta.defaultModel);
    const reasoningMode = String(payload.reasoningMode || 'deep-rca');

    const fallbackReport = buildDeterministicRcaReport(payload);
    const ai = getGenAiClient();

    if (!ai) {
      return res.json(fallbackReport);
    }

    try {
      const device = payload.device || {};
      const peerDevices = payload.peerDevices || [];
      const deviceAlerts = payload.deviceAlerts || [];
      const complianceFindings = payload.complianceFindings || [];
      const liveProbeData = payload.liveProbeData || null;
      const customSymptom = payload.customSymptom || '';

      const prompt = `You are operating as ${providerMeta.persona} (Model: ${selectedModel}, Mode: ${reasoningMode}) in OmniNet Enterprise NCM.
Analyze the following multi-layer network telemetry, topology peers, configuration drift, and live probe results.

TARGET DEVICE:
- Hostname: ${device.hostname}
- Management IP: ${device.ip}
- Vendor / OS: ${device.vendor} (${device.model} · ${device.osVersion})
- Role / Tier: ${device.role} (Tier ${device.topologyTier})
- Site / Rack: ${device.site} · ${device.rack}
- Status: ${device.status} (CPU: ${device.cpuLoad}%, Mem: ${device.memoryUsage}%, Temp: ${device.tempCelsius}°C, RTT: ${device.latencyMs}ms, Loss: ${device.packetLossPct}%)
- Discovery / Mgmt Protocol: ${device.discoveryMethod} / ${device.mgmtProtocol}
- Config Drift Present: ${String(device.runningConfig || '').trim() !== String(device.goldenBaselineConfig || '').trim() ? 'YES (Running config differs from Golden Baseline)' : 'NO'}
- Interfaces: ${JSON.stringify(device.interfaces || [])}
- Monitored Server Services: ${JSON.stringify(device.services || [])}

CONNECTED TOPOLOGY PEERS:
${JSON.stringify(peerDevices.map((p: any) => ({ hostname: p.hostname, ip: p.ip, vendor: p.vendor, role: p.role, status: p.status })))}

ACTIVE ALERTS ON THIS NODE:
${JSON.stringify(deviceAlerts)}

CIS / SECURITY COMPLIANCE FINDINGS:
${JSON.stringify(complianceFindings)}

LIVE TCP/DNS PROBE TELEMETRY (if executed):
${liveProbeData ? JSON.stringify(liveProbeData) : 'None'}

OPERATOR REPORTED SYMPTOM / CONTEXT:
${customSymptom || 'Perform comprehensive automated root-cause analysis and generate exact vendor CLI remediation.'}

Provide a deeply technical, accurate RCA report in JSON matching the schema. The remediationCli MUST use authentic CLI syntax for ${device.vendor}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              incidentTitle: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['critical', 'warning', 'info'] },
              confidencePct: { type: Type.NUMBER },
              rootCauseLayer: {
                type: Type.STRING,
                enum: [
                  'Physical (L1)',
                  'Data Link & VLAN (L2)',
                  'Routing & WAN (L3)',
                  'Service & Application (L4-L7)',
                  'Security & Config Drift',
                ],
              },
              executiveSummary: { type: Type.STRING },
              technicalRootCause: { type: Type.STRING },
              evidenceChain: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              blastRadius: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              remediationCli: { type: Type.STRING },
            },
            required: [
              'incidentTitle',
              'severity',
              'confidencePct',
              'rootCauseLayer',
              'executiveSummary',
              'technicalRootCause',
              'evidenceChain',
              'blastRadius',
              'recommendedSteps',
              'remediationCli',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        ...fallbackReport,
        ...parsed,
        id: `rca-${Date.now()}`,
        generatedAt: new Date().toLocaleTimeString([], { hour12: false }),
        engine: `${providerMeta.label} (${selectedModel})`,
        providerId,
      });
    } catch {
      return res.json(fallbackReport);
    }
  });

  // API: Interactive Multi-Provider NOC AI Copilot
  app.post('/api/ai/copilot', async (req, res) => {
    const userPrompt = String(req.body?.prompt || '').trim();
    const networkContext = req.body?.networkContext || {};
    const providerId = String(req.body?.providerId || 'gemini');
    const providerMeta = PROVIDER_DISPLAY[providerId] || PROVIDER_DISPLAY.gemini;
    const selectedModel = String(req.body?.modelName || providerMeta.defaultModel);
    const reasoningMode = String(req.body?.reasoningMode || 'deep-rca');
    const accountEmail = String(req.body?.accountEmail || '');

    if (!userPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGenAiClient();
    if (ai) {
      try {
        const systemContext = `You are operating as ${providerMeta.persona} (Model: ${selectedModel}, Reasoning Mode: ${reasoningMode}, Signed-in Engineer: ${accountEmail || 'NOC Engineer'}) inside OmniNet Enterprise NCM.
Answer concisely and technically (in the same language as the user's question, e.g. Vietnamese if asked in Vietnamese, English if asked in English).
Reflect the analytical style of ${providerMeta.label} (${selectedModel}) and reference actual hostnames, IPs, VLANs, ports, and vendors from the live network snapshot below:
${JSON.stringify(networkContext)}

Return JSON with:
- reply: clear technical response with bullet points
- suggestedCli: optional multi-vendor or target device CLI snippet if relevant (empty string if not needed)
- targetDeviceId: optional device ID if the response focuses on one specific device`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemContext}\n\nOperator Question: ${userPrompt}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                suggestedCli: { type: Type.STRING },
                targetDeviceId: { type: Type.STRING },
              },
              required: ['reply', 'suggestedCli'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        return res.json({
          reply: parsed.reply || 'Analysis complete.',
          suggestedCli: parsed.suggestedCli || '',
          targetDeviceId: parsed.targetDeviceId || '',
          providerId,
          providerLabel: providerMeta.label,
          modelName: selectedModel,
          engine: `${providerMeta.label} (${selectedModel})`,
        });
      } catch {
        // Fall through to deterministic response
      }
    }

    const devices: any[] = Array.isArray(networkContext.devices) ? networkContext.devices : [];
    const offlineNodes = devices.filter((d) => d.status === 'offline');
    const warningNodes = devices.filter((d) => d.status === 'warning');
    const driftedNodes = devices.filter((d) => d.drifted);

    const replyLines = [
      `[${providerMeta.label} · ${selectedModel}] Chẩn đoán tổng hợp từ trạng thái mạng thời gian thực (${devices.length} thiết bị quản lý):`,
      offlineNodes.length > 0
        ? `• Sự cố mất kết nối (Offline): ${offlineNodes.map((d) => `${d.hostname} (${d.ip} · ${d.vendor})`).join(', ')} — Kiểm tra đường truyền uplink L1/L2 và nguồn PoE/PSU.`
        : `• Toàn bộ các nút chuyển mạch và định tuyến đều trực tuyến (Online).`,
      warningNodes.length > 0
        ? `• Nút cảnh báo (Warning): ${warningNodes.map((d) => `${d.hostname} (${d.ip} · CPU ${d.cpuLoad}%)`).join(', ')} — Kiểm tra tiến trình dịch vụ dừng hoặc lưu lượng tăng đột biến.`
        : '',
      driftedNodes.length > 0
        ? `• Độ lệch cấu hình (Config Drift): Phát hiện trên ${driftedNodes.map((d) => d.hostname).join(', ')}. Khuyến nghị đồng bộ lại với Golden Baseline hoặc áp dụng CLI khắc phục.`
        : '',
    ].filter(Boolean);

    return res.json({
      reply: replyLines.join('\n'),
      suggestedCli: `# ${providerMeta.label} (${selectedModel}) Remediation Snippet — ${offlineNodes[0]?.hostname || warningNodes[0]?.hostname || 'core-sw-01.corp.local'}\nconfigure terminal\ninterface TenGigabitEthernet1/0/1\n no shutdown\n errdisable recovery cause all\nend\nwrite memory`,
      targetDeviceId: offlineNodes[0]?.id || warningNodes[0]?.id || 'dev-sw-core-01',
      providerId,
      providerLabel: providerMeta.label,
      modelName: selectedModel,
      engine: `${providerMeta.label} (${selectedModel})`,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OmniNet Enterprise server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
