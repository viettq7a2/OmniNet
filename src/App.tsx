import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cable,
  CheckCircle2,
  Database,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Radar,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  ConfigTemplateType,
  DeviceInterface,
  DeviceRole,
  DeviceStatus,
  DiscoverySchedule,
  NetworkAlert,
  NetworkDevice,
  ServerService,
  TrafficTelemetryPoint,
  VendorName,
} from './types/network';
import {
  buildInitialTrafficSeries,
  INITIAL_ALERTS,
  INITIAL_DEVICES,
  INITIAL_SCHEDULES,
} from './data/initialNetworkData';
import { SummaryDashboard } from './components/SummaryDashboard';
import { DiscoveryView } from './components/DiscoveryView';
import { AssetInventoryView } from './components/AssetInventoryView';
import { MultiVendorConfigView } from './components/MultiVendorConfigView';
import { MonitoringTopologyView } from './components/MonitoringTopologyView';
import { PortsAndServicesView } from './components/PortsAndServicesView';
import { AiDiagnosticsRcaView } from './components/AiDiagnosticsRcaView';
import { DeviceDetailDrawer } from './components/DeviceDetailDrawer';
import { FloatingAiAssistant } from './components/FloatingAiAssistant';

type NavTab =
  | 'dashboard'
  | 'ai-rca'
  | 'topology'
  | 'ports-services'
  | 'config'
  | 'discovery'
  | 'inventory';

const STORAGE_KEY_DEVICES = 'netvista_enterprise_devices_v2';
const STORAGE_KEY_THEME = 'netvista_enterprise_theme_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      return saved ? saved === 'dark' : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  const [devices, setDevices] = useState<NetworkDevice[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEVICES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial enterprise seed
    }
    return INITIAL_DEVICES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
    } catch {
      // Ignore storage quota errors
    }
  }, [devices]);

  const [alerts, setAlerts] = useState<NetworkAlert[]>(INITIAL_ALERTS);
  const [schedules, setSchedules] = useState<DiscoverySchedule[]>(INITIAL_SCHEDULES);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [trafficSeries, setTrafficSeries] = useState<TrafficTelemetryPoint[]>(() =>
    buildInitialTrafficSeries(devices)
  );

  const [inspectedDeviceId, setInspectedDeviceId] = useState<string | null>(null);
  const [configTargetDeviceId, setConfigTargetDeviceId] = useState<string | null>(null);
  const [configTargetTemplate, setConfigTargetTemplate] = useState<ConfigTemplateType | null>(null);
  const [aiRcaTargetDeviceId, setAiRcaTargetDeviceId] = useState<string | null>(null);
  const [floatingAiPrompt, setFloatingAiPrompt] = useState<{
    id: string;
    prompt: string;
    deviceId?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const appendImmediateTelemetrySnapshot = useCallback((nextDevices: NetworkDevice[]) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const onlineNodes = nextDevices.filter((d) => d.status === DeviceStatus.Online).length;
    const warningNodes = nextDevices.filter((d) => d.status === DeviceStatus.Warning).length;
    const offlineNodes = nextDevices.filter((d) => d.status === DeviceStatus.Offline).length;

    const active = nextDevices.filter((d) => d.status !== DeviceStatus.Offline);
    const inbound = Number(active.reduce((s, d) => s + d.inboundMbps, 0).toFixed(1));
    const outbound = Number(active.reduce((s, d) => s + d.outboundMbps, 0).toFixed(1));
    const inspected = Number(
      active
        .filter((d) => d.role === DeviceRole.Firewall)
        .reduce((s, d) => s + d.inboundMbps, 0)
        .toFixed(1)
    );
    const avgLatency =
      active.length > 0
        ? Number((active.reduce((s, d) => s + d.latencyMs, 0) / active.length).toFixed(1))
        : 0;

    setTrafficSeries((prev) => [
      ...prev.slice(-29),
      {
        time: timeStr,
        timestamp: now.getTime(),
        inboundMbps: inbound,
        outboundMbps: outbound,
        inspectedMbps: inspected,
        totalMbps: Number((inbound + outbound).toFixed(1)),
        onlineNodes,
        warningNodes,
        offlineNodes,
        avgLatencyMs: avgLatency,
      },
    ]);
  }, []);

  // Real-time 2s network traffic, port counters & server service telemetry stream
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      setDevices((prevDevices) => {
        const updated = prevDevices.map((d) => {
          if (d.status === DeviceStatus.Offline) return d;
          const deltaRx = (Math.random() - 0.48) * 26;
          const deltaTx = (Math.random() - 0.48) * 22;
          const nextIn = Number(Math.max(18, d.inboundMbps + deltaRx).toFixed(1));
          const nextOut = Number(Math.max(14, d.outboundMbps + deltaTx).toFixed(1));
          const cpuShift = Math.round((Math.random() - 0.5) * 4);
          const nextCpu = Math.min(96, Math.max(8, d.cpuLoad + cpuShift));
          const nextLatency = Number(
            Math.max(0.5, d.latencyMs + (Math.random() - 0.5) * 0.4).toFixed(1)
          );

          return {
            ...d,
            inboundMbps: nextIn,
            outboundMbps: nextOut,
            cpuLoad: nextCpu,
            latencyMs: nextLatency,
            uptimeSeconds: d.uptimeSeconds + 2,
            interfaces: d.interfaces.map((ifc) => {
              if (ifc.status !== 'up' || (ifc.adminStatus ?? 'up') === 'down') return ifc;
              return {
                ...ifc,
                rxMbps: Number(Math.max(2, ifc.rxMbps + (Math.random() - 0.48) * 6).toFixed(1)),
                txMbps: Number(Math.max(2, ifc.txMbps + (Math.random() - 0.48) * 5).toFixed(1)),
              };
            }),
            services: d.services?.map((svc) => {
              if (svc.status !== 'running') return svc;
              return {
                ...svc,
                cpuPct: Number(
                  Math.max(0.2, svc.cpuPct + (Math.random() - 0.5) * 1.2).toFixed(1)
                ),
                responseTimeMs: Math.max(
                  1,
                  Math.round(svc.responseTimeMs + (Math.random() - 0.5) * 2)
                ),
              };
            }),
          };
        });

        appendImmediateTelemetrySnapshot(updated);
        return updated;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [isStreaming, appendImmediateTelemetrySnapshot]);

  const inspectedDevice = useMemo(
    () => devices.find((d) => d.id === inspectedDeviceId) || null,
    [devices, inspectedDeviceId]
  );

  // Toggle Node Online / Offline
  const handleToggleDeviceStatus = useCallback(
    (deviceId: string) => {
      setDevices((prev) => {
        const next = prev.map((d) => {
          if (d.id !== deviceId) return d;
          const goingOnline = d.status === DeviceStatus.Offline;
          const nextStatus = goingOnline ? DeviceStatus.Online : DeviceStatus.Offline;
          const restoredRx = goingOnline ? 245.6 : 0;
          const restoredTx = goingOnline ? 198.2 : 0;

          showToast(
            goingOnline
              ? `${d.hostname} recovered ONLINE — ports & services active.`
              : `${d.hostname} transitioned OFFLINE — alert raised.`
          );

          if (!goingOnline) {
            setAlerts((prevAlerts) => [
              {
                id: `alt-${Date.now()}`,
                deviceId: d.id,
                hostname: d.hostname,
                ip: d.ip,
                vendor: d.vendor,
                severity: 'critical',
                category: 'Availability',
                message: `Node ${d.hostname} (${d.ip}) went unreachable — ICMP/SNMP poll timeout.`,
                timestamp: 'Just now',
                acknowledged: false,
              },
              ...prevAlerts,
            ]);
          }

          return {
            ...d,
            status: nextStatus,
            inboundMbps: restoredRx,
            outboundMbps: restoredTx,
            cpuLoad: goingOnline ? 24 : 0,
            memoryUsage: goingOnline ? 45 : 0,
            tempCelsius: goingOnline ? 38 : 0,
            latencyMs: goingOnline ? 2.4 : 0,
            packetLossPct: goingOnline ? 0 : 100,
            lastSeen: goingOnline ? 'Just now' : 'Offline now',
            interfaces: d.interfaces.map((ifc) => ({
              ...ifc,
              status:
                goingOnline && (ifc.adminStatus ?? 'up') === 'up'
                  ? ('up' as const)
                  : ('down' as const),
              rxMbps: goingOnline && (ifc.adminStatus ?? 'up') === 'up' ? 68.4 : 0,
              txMbps: goingOnline && (ifc.adminStatus ?? 'up') === 'up' ? 54.1 : 0,
            })),
            services: d.services?.map((svc) => ({
              ...svc,
              status: goingOnline ? ('running' as const) : ('stopped' as const),
              cpuPct: goingOnline ? 4.2 : 0,
              memoryMb: goingOnline ? Math.max(svc.memoryMb, 256) : 0,
              responseTimeMs: goingOnline ? 3 : 0,
              uptime: goingOnline ? '0d 00h' : 'Down',
            })),
          };
        });

        appendImmediateTelemetrySnapshot(next);
        return next;
      });
    },
    [appendImmediateTelemetrySnapshot, showToast]
  );

  // Topology Studio Handlers: Move Node, Auto-Layout, Add Node, Connect/Disconnect Ports
  const handleMoveNodePosition = useCallback((deviceId: string, x: number, y: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, canvasPos: { x, y } } : d))
    );
  }, []);

  const handleAutoLayoutTopology = useCallback(() => {
    setDevices((prev) => prev.map((d) => ({ ...d, canvasPos: undefined })));
    showToast('Aligned topology nodes into 4 enterprise hierarchy tiers.');
  }, [showToast]);

  const handleAddTopologyNode = useCallback(
    (params: {
      hostname: string;
      ip: string;
      vendor: VendorName;
      role: DeviceRole;
      model: string;
      site: string;
      portCount: number;
      x: number;
      y: number;
    }) => {
      const tier =
        params.role === DeviceRole.Firewall
          ? 0
          : params.role === DeviceRole.Router
          ? 1
          : params.role === DeviceRole.Switch || params.role === DeviceRole.Wireless
          ? 2
          : 3;

      const generatedPorts: DeviceInterface[] = Array.from(
        { length: params.portCount },
        (_, i) => ({
          name:
            params.role === DeviceRole.Server
              ? `eth${i}`
              : params.vendor === 'Fortinet'
              ? `port${i + 1}`
              : params.vendor === 'Palo Alto'
              ? `ethernet1/${i + 1}`
              : `Gi0/${i + 1}`,
          status: i < 2 ? ('up' as const) : ('down' as const),
          adminStatus: 'up' as const,
          portType: i === 0 ? 'SFP+-10G' : 'RJ45-1G',
          mode: i === 0 ? 'trunk' : 'access',
          speedMbps: i === 0 ? 10000 : 1000,
          vlan: i === 0 ? 'Trunk 10,20' : 'VLAN 20',
          rxMbps: i < 2 ? 48.2 : 0,
          txMbps: i < 2 ? 36.4 : 0,
          protocol: 'LLDP',
        })
      );

      const defaultServices: ServerService[] | undefined =
        params.role === DeviceRole.Server
          ? [
              {
                id: `svc-${Date.now()}-1`,
                name: 'NGINX Application Gateway',
                processName: 'nginx',
                port: 443,
                protocol: 'HTTPS',
                status: 'running',
                cpuPct: 4.5,
                memoryMb: 512,
                responseTimeMs: 3,
                uptime: '0d 01h',
                autoRestart: true,
              },
              {
                id: `svc-${Date.now()}-2`,
                name: 'OpenSSH Daemon',
                processName: 'sshd',
                port: 22,
                protocol: 'TCP',
                status: 'running',
                cpuPct: 0.4,
                memoryMb: 48,
                responseTimeMs: 2,
                uptime: '0d 01h',
                autoRestart: true,
              },
            ]
          : undefined;

      const defaultCfg = `! ${params.vendor} — ${params.hostname} (${params.ip})\nhostname ${params.hostname}\n! Provisioned via Interactive Topology Studio`;

      const created: NetworkDevice = {
        id: `dev-topo-${Date.now()}`,
        hostname: params.hostname,
        ip: params.ip,
        mac: '00:50:56:DF:21:90',
        vendor: params.vendor,
        model: params.model,
        osVersion: 'Enterprise OS',
        role: params.role,
        status: DeviceStatus.Online,
        site: params.site,
        rack: 'Topology Studio Rack',
        serialNumber: `SN${Math.floor(100000 + Math.random() * 900000)}`,
        assetTag: `AST-TOPO-${Math.floor(100 + Math.random() * 899)}`,
        department: 'Network Engineering',
        purchaseDate: new Date().toISOString().slice(0, 10),
        warrantyExpiry: '2030-12-31',
        uptimeSeconds: 3600,
        cpuLoad: 18,
        memoryUsage: 39,
        tempCelsius: 36,
        inboundMbps: 145.0,
        outboundMbps: 118.4,
        latencyMs: 1.9,
        packetLossPct: 0,
        openPorts: [22, 443],
        discoveryMethod: 'Topology Studio',
        mgmtProtocol: 'NETCONF',
        lastSeen: 'Just now',
        topologyTier: tier,
        canvasPos: { x: params.x, y: params.y },
        interfaces: generatedPorts,
        services: defaultServices,
        vlans: [{ id: 10, name: 'MGMT_VLAN', sviIp: `${params.ip}/24`, status: 'active' }],
        firewallRules: [],
        routes: [],
        runningConfig: defaultCfg,
        goldenBaselineConfig: defaultCfg,
        configHistory: [
          {
            id: `rev-topo-${Date.now()}`,
            versionLabel: 'v1 (Created on Topology)',
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            author: 'net-architect',
            summary: 'Provisioned directly from Interactive Topology Studio',
            content: defaultCfg,
          },
        ],
      };

      setDevices((prev) => {
        const next = [...prev, created];
        appendImmediateTelemetrySnapshot(next);
        return next;
      });
      showToast(`Added ${created.hostname} to live topology — use Draw Cable to link ports.`);
    },
    [appendImmediateTelemetrySnapshot, showToast]
  );

  const handleCreateTopologyLink = useCallback(
    (params: {
      sourceId: string;
      sourcePort: string;
      targetId: string;
      targetPort: string;
      speedMbps: number;
      protocol: 'LLDP' | 'CDP' | 'LACP' | 'STATIC';
    }) => {
      setDevices((prev) => {
        const srcDev = prev.find((d) => d.id === params.sourceId);
        const dstDev = prev.find((d) => d.id === params.targetId);
        if (!srcDev || !dstDev) return prev;

        return prev.map((dev) => {
          if (dev.id === params.sourceId) {
            const exists = dev.interfaces.some((i) => i.name === params.sourcePort);
            const newIfc: DeviceInterface = {
              name: params.sourcePort,
              description: `Link-to-${dstDev.hostname.split('.')[0]}`,
              status: 'up',
              adminStatus: 'up',
              portType: params.speedMbps >= 10000 ? 'SFP+-10G' : 'RJ45-1G',
              mode: 'trunk',
              speedMbps: params.speedMbps,
              vlan: 'Trunk 10,20,100',
              rxMbps: 184.5,
              txMbps: 162.0,
              connectedToId: dstDev.id,
              connectedToHostname: dstDev.hostname,
              connectedPort: params.targetPort,
              protocol: params.protocol,
            };
            return {
              ...dev,
              interfaces: exists
                ? dev.interfaces.map((i) => (i.name === params.sourcePort ? newIfc : i))
                : [...dev.interfaces, newIfc],
            };
          }
          if (dev.id === params.targetId) {
            const exists = dev.interfaces.some((i) => i.name === params.targetPort);
            const newIfc: DeviceInterface = {
              name: params.targetPort,
              description: `Link-to-${srcDev.hostname.split('.')[0]}`,
              status: 'up',
              adminStatus: 'up',
              portType: params.speedMbps >= 10000 ? 'SFP+-10G' : 'RJ45-1G',
              mode: 'trunk',
              speedMbps: params.speedMbps,
              vlan: 'Trunk 10,20,100',
              rxMbps: 162.0,
              txMbps: 184.5,
              connectedToId: srcDev.id,
              connectedToHostname: srcDev.hostname,
              connectedPort: params.sourcePort,
              protocol: params.protocol,
            };
            return {
              ...dev,
              interfaces: exists
                ? dev.interfaces.map((i) => (i.name === params.targetPort ? newIfc : i))
                : [...dev.interfaces, newIfc],
            };
          }
          return dev;
        });
      });
      showToast(`Connected port ${params.sourcePort} ↔ ${params.targetPort} (${params.protocol}).`);
    },
    [showToast]
  );

  const handleRemoveTopologyLink = useCallback(
    (sourceId: string, targetId: string) => {
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id !== sourceId && dev.id !== targetId) return dev;
          const peerId = dev.id === sourceId ? targetId : sourceId;
          return {
            ...dev,
            interfaces: dev.interfaces.map((ifc) =>
              ifc.connectedToId === peerId
                ? {
                    ...ifc,
                    status: 'down' as const,
                    rxMbps: 0,
                    txMbps: 0,
                    connectedToId: undefined,
                    connectedToHostname: undefined,
                    connectedPort: undefined,
                  }
                : ifc
            ),
          };
        })
      );
      showToast('Disconnected cable link between nodes.');
    },
    [showToast]
  );

  // Port Faceplate Up / Shutdown Toggle
  const handleTogglePortAdminStatus = useCallback(
    (deviceId: string, portName: string) => {
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id !== deviceId) return dev;
          const targetPort = dev.interfaces.find((i) => i.name === portName);
          if (!targetPort) return dev;
          const currentlyShut = (targetPort.adminStatus ?? 'up') === 'down';
          const nextAdmin = currentlyShut ? ('up' as const) : ('down' as const);

          showToast(
            `${dev.hostname}: Port ${portName} ${
              currentlyShut ? 'enabled (Link UP)' : 'administratively shut down'
            }.`
          );

          if (!currentlyShut) {
            setAlerts((prevA) => [
              {
                id: `alt-port-${Date.now()}`,
                deviceId: dev.id,
                hostname: dev.hostname,
                ip: dev.ip,
                vendor: dev.vendor,
                severity: 'warning',
                category: 'Availability',
                message: `SNMP IF-MIB Trap: Interface ${portName} changed state to Administratively Down.`,
                timestamp: 'Just now',
                acknowledged: false,
              },
              ...prevA,
            ]);
          }

          return {
            ...dev,
            interfaces: dev.interfaces.map((ifc) =>
              ifc.name === portName
                ? {
                    ...ifc,
                    adminStatus: nextAdmin,
                    status: nextAdmin,
                    rxMbps: currentlyShut ? 64.2 : 0,
                    txMbps: currentlyShut ? 49.8 : 0,
                  }
                : ifc
            ),
          };
        })
      );
    },
    [showToast]
  );

  const handleUpdatePortVlanOrDesc = useCallback(
    (deviceId: string, portName: string, vlan: string, description: string) => {
      setDevices((prev) =>
        prev.map((dev) =>
          dev.id === deviceId
            ? {
                ...dev,
                interfaces: dev.interfaces.map((ifc) =>
                  ifc.name === portName ? { ...ifc, vlan, description } : ifc
                ),
              }
            : dev
        )
      );
      showToast(`Updated port ${portName} VLAN & description.`);
    },
    [showToast]
  );

  // Server Service Control (Start / Stop / Restart / Add)
  const handleServiceAction = useCallback(
    (deviceId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => {
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id !== deviceId || !dev.services) return dev;
          const nextServices: ServerService[] = dev.services.map((svc) => {
            if (svc.id !== serviceId) return svc;
            const running = action === 'start' || action === 'restart';
            showToast(
              `${dev.hostname}: Service "${svc.name}" ${
                action === 'restart' ? 'restarted' : running ? 'started' : 'stopped'
              }.`
            );

            if (!running) {
              setAlerts((prevA) => [
                {
                  id: `alt-svc-${Date.now()}`,
                  deviceId: dev.id,
                  hostname: dev.hostname,
                  ip: dev.ip,
                  vendor: dev.vendor,
                  severity: 'warning',
                  category: 'Service',
                  message: `Service daemon ${svc.name} (${svc.protocol}/${svc.port}) stopped on ${dev.hostname}.`,
                  timestamp: 'Just now',
                  acknowledged: false,
                },
                ...prevA,
              ]);
            }

            return {
              ...svc,
              status: running ? ('running' as const) : ('stopped' as const),
              cpuPct: running ? Math.max(svc.cpuPct, 2.4) : 0,
              memoryMb: running ? Math.max(svc.memoryMb, 256) : 0,
              responseTimeMs: running ? 2 : 0,
              uptime: action === 'restart' || action === 'start' ? '0d 00h' : 'Stopped',
            };
          });

          const anyStopped = nextServices.some((s) => s.status === 'stopped');
          const nextNodeStatus =
            dev.status === DeviceStatus.Offline
              ? DeviceStatus.Offline
              : anyStopped
              ? DeviceStatus.Warning
              : DeviceStatus.Online;

          return {
            ...dev,
            status: nextNodeStatus,
            services: nextServices,
          };
        })
      );
    },
    [showToast]
  );

  const handleAddServerService = useCallback(
    (deviceId: string, service: ServerService) => {
      setDevices((prev) =>
        prev.map((dev) =>
          dev.id === deviceId
            ? { ...dev, services: [...(dev.services || []), service] }
            : dev
        )
      );
      showToast(`Added service health check: ${service.name} (${service.protocol}/${service.port}).`);
    },
    [showToast]
  );

  // Visual Single-Device GUI Commit Handler
  const handleApplyVisualDeviceUpdate = useCallback(
    (
      deviceId: string,
      updater: (dev: NetworkDevice) => NetworkDevice,
      generatedCli: string,
      summary: string
    ) => {
      const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id !== deviceId) return dev;
          const updatedDev = updater(dev);
          const mergedCfg = `${updatedDev.runningConfig.trim()}\n\n${generatedCli.trim()}`;
          const nextRevNum = updatedDev.configHistory.length + 1;
          return {
            ...updatedDev,
            runningConfig: mergedCfg,
            configHistory: [
              {
                id: `rev-vis-${Date.now()}`,
                versionLabel: `v${nextRevNum} (Visual GUI)`,
                timestamp: nowStamp,
                author: 'visual-workbench',
                summary,
                content: mergedCfg,
              },
              ...updatedDev.configHistory,
            ],
          };
        })
      );
      showToast(summary);
    },
    [showToast]
  );

  // AI RCA 1-Click Automated Remediation Handler
  const handleApplyAiRemediation = useCallback(
    (
      deviceId: string,
      remediationCli: string,
      options: { recoverNode: boolean; syncBaseline: boolean }
    ) => {
      const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setDevices((prev) => {
        const next = prev.map((dev) => {
          if (dev.id !== deviceId) return dev;
          const mergedCfg = `${dev.runningConfig.trim()}\n\n${remediationCli.trim()}`;
          const nextRevNum = dev.configHistory.length + 1;

          const recoveredInterfaces = options.recoverNode
            ? dev.interfaces.map((ifc) => ({
                ...ifc,
                status: 'up' as const,
                adminStatus: 'up' as const,
                rxMbps: ifc.rxMbps > 0 ? ifc.rxMbps : 84.5,
                txMbps: ifc.txMbps > 0 ? ifc.txMbps : 62.1,
              }))
            : dev.interfaces;

          const recoveredServices =
            options.recoverNode && dev.services
              ? dev.services.map((svc) => ({
                  ...svc,
                  status: 'running' as const,
                  cpuPct: svc.cpuPct > 0 ? svc.cpuPct : 3.2,
                  memoryMb: svc.memoryMb > 0 ? svc.memoryMb : 256,
                  responseTimeMs: svc.responseTimeMs > 0 ? svc.responseTimeMs : 4,
                  uptime: svc.status !== 'running' ? '0d 00h' : svc.uptime,
                }))
              : dev.services;

          return {
            ...dev,
            status: options.recoverNode ? DeviceStatus.Online : dev.status,
            inboundMbps: options.recoverNode ? Math.max(dev.inboundMbps, 210.4) : dev.inboundMbps,
            outboundMbps: options.recoverNode ? Math.max(dev.outboundMbps, 165.2) : dev.outboundMbps,
            cpuLoad: options.recoverNode ? Math.min(dev.cpuLoad || 26, 38) : dev.cpuLoad,
            memoryUsage: options.recoverNode ? Math.min(dev.memoryUsage || 44, 52) : dev.memoryUsage,
            tempCelsius: options.recoverNode ? Math.max(36, dev.tempCelsius || 38) : dev.tempCelsius,
            latencyMs: options.recoverNode ? 2.1 : dev.latencyMs,
            packetLossPct: options.recoverNode ? 0 : dev.packetLossPct,
            lastSeen: 'Just now (AI RCA Verified)',
            runningConfig: mergedCfg,
            goldenBaselineConfig: options.syncBaseline ? mergedCfg : dev.goldenBaselineConfig,
            configHistory: [
              {
                id: `rev-ai-${Date.now()}`,
                versionLabel: `v${nextRevNum} (AI RCA Patch)`,
                timestamp: nowStamp,
                author: 'ai-rca-engine',
                summary: 'Applied AI RCA automated remediation CLI & baseline sync',
                content: mergedCfg,
              },
              ...dev.configHistory,
            ],
            interfaces: recoveredInterfaces,
            services: recoveredServices,
          };
        });

        appendImmediateTelemetrySnapshot(next);
        return next;
      });

      setAlerts((prev) =>
        prev.map((a) => (a.deviceId === deviceId ? { ...a, acknowledged: true } : a))
      );
      showToast('Executed AI RCA remediation & updated Golden Baseline.');
    },
    [appendImmediateTelemetrySnapshot, showToast]
  );

  const handleImportDiscoveredDevices = useCallback(
    (newNodes: NetworkDevice[]) => {
      setDevices((prev) => {
        const next = [...newNodes, ...prev];
        appendImmediateTelemetrySnapshot(next);
        return next;
      });
      showToast(
        `Onboarded ${newNodes.length} discovered node${newNodes.length > 1 ? 's' : ''} into managed inventory.`
      );
    },
    [appendImmediateTelemetrySnapshot, showToast]
  );

  const handleAddManualDevice = useCallback(
    (device: NetworkDevice) => {
      setDevices((prev) => {
        const next = [device, ...prev];
        appendImmediateTelemetrySnapshot(next);
        return next;
      });
      showToast(`Registered asset ${device.hostname} (${device.assetTag}).`);
    },
    [appendImmediateTelemetrySnapshot, showToast]
  );

  const handleUpdateDevice = useCallback(
    (updated: NetworkDevice) => {
      setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      showToast(`Updated CMDB record for ${updated.hostname}.`);
    },
    [showToast]
  );

  const handleDeleteDevice = useCallback(
    (deviceId: string) => {
      setDevices((prev) => {
        const target = prev.find((d) => d.id === deviceId);
        const next = prev.filter((d) => d.id !== deviceId);
        appendImmediateTelemetrySnapshot(next);
        if (target) showToast(`Removed ${target.hostname} from inventory.`);
        return next;
      });
      if (inspectedDeviceId === deviceId) setInspectedDeviceId(null);
    },
    [appendImmediateTelemetrySnapshot, inspectedDeviceId, showToast]
  );

  const handlePushConfigToDevices = useCallback(
    (deviceIds: string[], compiledByDeviceId: Record<string, string>, summary: string) => {
      const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setDevices((prev) =>
        prev.map((dev) => {
          if (!deviceIds.includes(dev.id)) return dev;
          const cliBlock = compiledByDeviceId[dev.id] || '';
          const mergedConfig = `${dev.runningConfig.trim()}\n\n${cliBlock.trim()}`;
          const nextRevNum = dev.configHistory.length + 1;
          return {
            ...dev,
            runningConfig: mergedConfig,
            configHistory: [
              {
                id: `rev-${dev.id}-${Date.now()}`,
                versionLabel: `v${nextRevNum} (Batch Hub)`,
                timestamp: nowStamp,
                author: 'netops-admin',
                summary,
                content: mergedConfig,
              },
              ...dev.configHistory,
            ],
          };
        })
      );
      showToast(`Deployed multi-vendor configuration to ${deviceIds.length} device(s).`);
    },
    [showToast]
  );

  const handleRollbackDeviceConfig = useCallback(
    (deviceId: string, targetContent: string, label: string) => {
      const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setDevices((prev) =>
        prev.map((dev) => {
          if (dev.id !== deviceId) return dev;
          const nextRevNum = dev.configHistory.length + 1;
          return {
            ...dev,
            runningConfig: targetContent,
            configHistory: [
              {
                id: `rev-rb-${Date.now()}`,
                versionLabel: `v${nextRevNum} (Rollback → ${label})`,
                timestamp: nowStamp,
                author: 'netops-admin',
                summary: `Restored configuration from ${label}`,
                content: targetContent,
              },
              ...dev.configHistory,
            ],
          };
        })
      );
      showToast(`Rolled back configuration to ${label}.`);
    },
    [showToast]
  );

  const handlePromoteGoldenBaseline = useCallback(
    (deviceId: string) => {
      setDevices((prev) =>
        prev.map((dev) =>
          dev.id === deviceId ? { ...dev, goldenBaselineConfig: dev.runningConfig } : dev
        )
      );
      showToast('Promoted current running-config to Golden Baseline.');
    },
    [showToast]
  );

  const handleResetDemoData = () => {
    setDevices(INITIAL_DEVICES);
    setAlerts(INITIAL_ALERTS);
    setSchedules(INITIAL_SCHEDULES);
    setTrafficSeries(buildInitialTrafficSeries(INITIAL_DEVICES));
    showToast('Restored default enterprise lab inventory & topology.');
  };

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
    { id: 'ai-rca', label: 'AI Diagnostics & RCA', icon: Sparkles },
    { id: 'topology', label: 'Topology Studio', icon: Network },
    { id: 'ports-services', label: 'Ports & Server Services', icon: Cable },
    { id: 'config', label: 'Multi-Vendor Config Hub', icon: Sliders },
    { id: 'discovery', label: 'Network Discovery', icon: Radar },
    { id: 'inventory', label: 'IT Asset Inventory', icon: Database },
  ];

  const activeBreadcrumb = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-mono font-bold text-xs">
                ON
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  OmniNet
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  NCM · AI RCA
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Summary */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Managed Nodes</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {devices.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Open Alerts</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {alerts.filter((a) => !a.acknowledged).length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDemoData}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Lab Inventory</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-14 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="whitespace-nowrap">Enterprise NOC</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {activeBreadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ai-rca')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ai-rca'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI RCA Diagnostics</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>Dark Theme</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('topology')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Topology Studio</span>
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <SummaryDashboard
              devices={devices}
              trafficSeries={trafficSeries}
              isStreaming={isStreaming}
              onToggleStream={() => setIsStreaming((s) => !s)}
              isDark={isDark}
              onSelectDevice={(dev) => setInspectedDeviceId(dev.id)}
              onToggleDeviceStatus={handleToggleDeviceStatus}
              onNavigateToDiscovery={() => setActiveTab('discovery')}
              onOpenConfigForDevice={(deviceId) => {
                setConfigTargetDeviceId(deviceId);
                setConfigTargetTemplate(null);
                setActiveTab('config');
              }}
            />
          )}

          {activeTab === 'ai-rca' && (
            <AiDiagnosticsRcaView
              devices={devices}
              alerts={alerts}
              initialDeviceId={aiRcaTargetDeviceId}
              onSelectDeviceDrawer={(dev) => setInspectedDeviceId(dev.id)}
              onOpenInConfigHub={(deviceId) => {
                setConfigTargetDeviceId(deviceId);
                setConfigTargetTemplate(null);
                setActiveTab('config');
              }}
              onApplyRemediation={handleApplyAiRemediation}
              onAddDiscoveredDevice={handleAddManualDevice}
            />
          )}

          {activeTab === 'topology' && (
            <MonitoringTopologyView
              devices={devices}
              alerts={alerts}
              isDark={isDark}
              onSelectDevice={(dev) => setInspectedDeviceId(dev.id)}
              onToggleDeviceStatus={handleToggleDeviceStatus}
              onMoveNodePosition={handleMoveNodePosition}
              onAutoLayoutTopology={handleAutoLayoutTopology}
              onAddTopologyNode={handleAddTopologyNode}
              onCreateTopologyLink={handleCreateTopologyLink}
              onRemoveTopologyLink={handleRemoveTopologyLink}
              onAcknowledgeAlert={(alertId) =>
                setAlerts((prev) =>
                  prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
                )
              }
              onRemediateCompliance={(deviceId, tpl) => {
                setConfigTargetDeviceId(deviceId);
                setConfigTargetTemplate(tpl);
                setActiveTab('config');
              }}
              onOpenVisualConfig={(deviceId) => {
                setConfigTargetDeviceId(deviceId);
                setConfigTargetTemplate(null);
                setActiveTab('config');
              }}
              onOpenPortMonitor={() => setActiveTab('ports-services')}
            />
          )}

          {activeTab === 'ports-services' && (
            <PortsAndServicesView
              devices={devices}
              onTogglePortAdminStatus={handleTogglePortAdminStatus}
              onUpdatePortVlanOrDesc={handleUpdatePortVlanOrDesc}
              onServiceAction={handleServiceAction}
              onAddServerService={handleAddServerService}
              onOpenVisualConfig={(deviceId) => {
                setConfigTargetDeviceId(deviceId);
                setConfigTargetTemplate(null);
                setActiveTab('config');
              }}
            />
          )}

          {activeTab === 'config' && (
            <MultiVendorConfigView
              devices={devices}
              preselectedDeviceId={configTargetDeviceId}
              preselectedTemplate={configTargetTemplate}
              onApplyVisualDeviceUpdate={handleApplyVisualDeviceUpdate}
              onPushConfigToDevices={handlePushConfigToDevices}
              onRollbackDeviceConfig={handleRollbackDeviceConfig}
              onPromoteGoldenBaseline={handlePromoteGoldenBaseline}
            />
          )}

          {activeTab === 'discovery' && (
            <DiscoveryView
              devices={devices}
              schedules={schedules}
              onToggleSchedule={(id) =>
                setSchedules((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
                )
              }
              onImportDiscoveredDevices={handleImportDiscoveredDevices}
            />
          )}

          {activeTab === 'inventory' && (
            <AssetInventoryView
              devices={devices}
              onSelectDevice={(dev) => setInspectedDeviceId(dev.id)}
              onAddDevice={handleAddManualDevice}
              onUpdateDevice={handleUpdateDevice}
              onDeleteDevice={handleDeleteDevice}
            />
          )}
        </main>
      </div>

      {/* Device Inspector Slide-over */}
      <DeviceDetailDrawer
        device={inspectedDevice}
        allDevices={devices}
        onClose={() => setInspectedDeviceId(null)}
        onToggleStatus={handleToggleDeviceStatus}
        onOpenInConfigHub={(deviceId) => {
          setConfigTargetDeviceId(deviceId);
          setConfigTargetTemplate(null);
          setActiveTab('config');
        }}
        onOpenInAiRca={(deviceId) => {
          setAiRcaTargetDeviceId(deviceId);
          setActiveTab('ai-rca');
        }}
        onAutoFixConnection={(deviceId, remediationCli) =>
          handleApplyAiRemediation(deviceId, remediationCli, {
            recoverNode: true,
            syncBaseline: true,
          })
        }
        onAskFloatingAi={(prompt, deviceId) => {
          setInspectedDeviceId(null);
          setFloatingAiPrompt({ id: `req-${Date.now()}`, prompt, deviceId });
        }}
      />

      {/* Global Floating AI Engineer Chatbox (Visible Across All Tabs) */}
      <FloatingAiAssistant
        devices={devices}
        alerts={alerts}
        activeTabLabel={activeBreadcrumb}
        externalPromptRequest={floatingAiPrompt}
        onClearExternalPrompt={() => setFloatingAiPrompt(null)}
        onAutoFixDeviceConnection={(deviceId, remediationCli) =>
          handleApplyAiRemediation(deviceId, remediationCli, {
            recoverNode: true,
            syncBaseline: true,
          })
        }
        onInspectDevice={(dev) => setInspectedDeviceId(dev.id)}
      />

      {/* Non-Intrusive Action Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 right-5 z-50 bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
