// OmniNet Interactive Topology Studio & Monitoring View
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  LayoutGrid,
  MousePointer,
  Plus,
  Power,
  ShieldAlert,
  Sliders,
  Trash2,
  Wrench,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ConfigTemplateType,
  DeviceRole,
  DeviceStatus,
  NetworkAlert,
  NetworkDevice,
  VendorName,
} from '../types/network';
import { auditDeviceCompliance } from '../utils/vendorConfigCompiler';

interface MonitoringTopologyViewProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  isDark: boolean;
  onSelectDevice: (device: NetworkDevice) => void;
  onToggleDeviceStatus: (deviceId: string) => void;
  onMoveNodePosition: (deviceId: string, x: number, y: number) => void;
  onAutoLayoutTopology: () => void;
  onAddTopologyNode: (params: {
    hostname: string;
    ip: string;
    vendor: VendorName;
    role: DeviceRole;
    model: string;
    site: string;
    portCount: number;
    x: number;
    y: number;
  }) => void;
  onCreateTopologyLink: (params: {
    sourceId: string;
    sourcePort: string;
    targetId: string;
    targetPort: string;
    speedMbps: number;
    protocol: 'LLDP' | 'CDP' | 'LACP' | 'STATIC';
  }) => void;
  onRemoveTopologyLink: (sourceId: string, targetId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onRemediateCompliance: (deviceId: string, template: ConfigTemplateType) => void;
  onOpenVisualConfig: (deviceId: string) => void;
  onOpenPortMonitor: () => void;
}

type CanvasTool = 'select' | 'add-node' | 'draw-link' | 'unlink';

const VENDORS: VendorName[] = [
  'Ubiquiti UniFi',
  'Aruba',
  'HPE Comware',
  'HP ProCurve',
  'Cisco IOS-XE',
  'Cisco NX-OS',
  'Fortinet',
  'Palo Alto',
  'Juniper',
  'MikroTik',
  'Linux / Server',
];

export const MonitoringTopologyView: React.FC<MonitoringTopologyViewProps> = ({
  devices,
  alerts,
  isDark,
  onSelectDevice,
  onToggleDeviceStatus,
  onMoveNodePosition,
  onAutoLayoutTopology,
  onAddTopologyNode,
  onCreateTopologyLink,
  onRemoveTopologyLink,
  onAcknowledgeAlert,
  onRemediateCompliance,
  onOpenVisualConfig,
  onOpenPortMonitor,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [zoom, setZoom] = useState<number>(1);
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'UNACK'>('UNACK');

  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragMoved, setDragMoved] = useState(false);

  // Selected node on canvas for quick live bar
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(devices[0]?.id || null);
  const focusedNode = useMemo(
    () => devices.find((d) => d.id === focusedNodeId) || null,
    [devices, focusedNodeId]
  );

  // Draw-link state
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [pendingLinkPair, setPendingLinkPair] = useState<{
    source: NetworkDevice;
    target: NetworkDevice;
  } | null>(null);
  const [linkSrcPort, setLinkSrcPort] = useState('TenGig0/10');
  const [linkDstPort, setLinkDstPort] = useState('TenGig0/10');
  const [linkSpeedMbps, setLinkSpeedMbps] = useState(10000);
  const [linkProtocol, setLinkProtocol] = useState<'LLDP' | 'CDP' | 'LACP' | 'STATIC'>('LLDP');

  // Add-node modal state (triggered by clicking canvas in add-node mode or clicking + Add Node)
  const [newNodeModalCoords, setNewNodeModalCoords] = useState<{ x: number; y: number } | null>(
    null
  );
  const [newHostname, setNewHostname] = useState('sw-campus-acc05.corp.local');
  const [newIp, setNewIp] = useState('10.20.30.25');
  const [newVendor, setNewVendor] = useState<VendorName>('Cisco IOS-XE');
  const [newRole, setNewRole] = useState<DeviceRole>(DeviceRole.Switch);
  const [newModel, setNewModel] = useState('Catalyst 9300-24P');
  const [newSite, setNewSite] = useState('SGN-Campus HQ');
  const [newPortCount, setNewPortCount] = useState(12);

  // Compute coordinates (using saved canvasPos or automatic tier fallback)
  const positionedNodes = useMemo(() => {
    const tiers: Record<number, NetworkDevice[]> = { 0: [], 1: [], 2: [], 3: [] };
    devices.forEach((d) => {
      tiers[d.topologyTier] = tiers[d.topologyTier] || [];
      tiers[d.topologyTier].push(d);
    });

    const width = 1040;
    const tierY: Record<number, number> = { 0: 76, 1: 205, 2: 345, 3: 475 };

    const coords: Record<string, { x: number; y: number; device: NetworkDevice }> = {};
    [0, 1, 2, 3].forEach((tier) => {
      const list = tiers[tier] || [];
      const count = list.length;
      list.forEach((dev, idx) => {
        const fallbackX = Math.round((width / (count + 1)) * (idx + 1));
        const fallbackY = tierY[tier];
        coords[dev.id] = {
          x: dev.canvasPos?.x ?? fallbackX,
          y: dev.canvasPos?.y ?? fallbackY,
          device: dev,
        };
      });
    });

    return coords;
  }, [devices]);

  const topologyLinks = useMemo(() => {
    const pairs = new Set<string>();
    const links: {
      key: string;
      sourceId: string;
      targetId: string;
      sourcePort: string;
      targetPort: string;
      from: { x: number; y: number; device: NetworkDevice };
      to: { x: number; y: number; device: NetworkDevice };
      bandwidthMbps: number;
      protocol: string;
      isUp: boolean;
    }[] = [];

    devices.forEach((dev) => {
      dev.interfaces.forEach((iface) => {
        if (!iface.connectedToId) return;
        const target = positionedNodes[iface.connectedToId];
        const source = positionedNodes[dev.id];
        if (!source || !target) return;

        const pairKey = [dev.id, iface.connectedToId].sort().join('--');
        if (pairs.has(pairKey)) return;
        pairs.add(pairKey);

        // Also check peer port adminStatus if present
        const peerPort = target.device.interfaces.find((p) => p.connectedToId === dev.id);
        const peerUp = peerPort
          ? peerPort.status === 'up' && (peerPort.adminStatus ?? 'up') === 'up'
          : true;

        const isUp =
          source.device.status !== DeviceStatus.Offline &&
          target.device.status !== DeviceStatus.Offline &&
          iface.status === 'up' &&
          (iface.adminStatus ?? 'up') === 'up' &&
          peerUp;

        links.push({
          key: pairKey,
          sourceId: dev.id,
          targetId: iface.connectedToId,
          sourcePort: iface.name,
          targetPort: iface.connectedPort || peerPort?.name || 'eth0',
          from: source,
          to: target,
          bandwidthMbps: isUp ? Number((iface.rxMbps + iface.txMbps).toFixed(0)) : 0,
          protocol: iface.protocol,
          isUp,
        });
      });
    });

    return links;
  }, [devices, positionedNodes]);

  const clientToSvgCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 520, y: 260 };
    const rect = svg.getBoundingClientRect();
    const viewW = 1040 / zoom;
    const viewH = 550 / zoom;
    const offsetX = (1040 - viewW) / 2;
    const offsetY = (550 - viewH) / 2;
    const relX = ((clientX - rect.left) / rect.width) * viewW + offsetX;
    const relY = ((clientY - rect.top) / rect.height) * viewH + offsetY;
    return {
      x: Math.max(85, Math.min(955, Math.round(relX))),
      y: Math.max(40, Math.min(510, Math.round(relY))),
    };
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId || tool !== 'select') return;
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    setDragMoved(true);
    onMoveNodePosition(draggingId, pt.x, pt.y);
  };

  const handleSvgPointerUp = () => {
    setDraggingId(null);
  };

  const handleSvgBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'add-node' && e.target === svgRef.current) {
      const pt = clientToSvgCoords(e.clientX, e.clientY);
      setNewNodeModalCoords(pt);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, dev: NetworkDevice) => {
    e.stopPropagation();
    setFocusedNodeId(dev.id);

    if (tool === 'draw-link') {
      if (!linkSourceId) {
        setLinkSourceId(dev.id);
      } else if (linkSourceId === dev.id) {
        setLinkSourceId(null);
      } else {
        const srcDev = devices.find((d) => d.id === linkSourceId);
        if (srcDev) {
          const nextIdx = srcDev.interfaces.length + 1;
          const dstIdx = dev.interfaces.length + 1;
          setLinkSrcPort(
            srcDev.role === DeviceRole.Server ? `eth${nextIdx}` : `TenGig0/${nextIdx}`
          );
          setLinkDstPort(
            dev.role === DeviceRole.Server ? `eth${dstIdx}` : `TenGig0/${dstIdx}`
          );
          setPendingLinkPair({ source: srcDev, target: dev });
        }
        setLinkSourceId(null);
      }
      return;
    }

    if (!dragMoved) {
      setFocusedNodeId(dev.id);
    }
    setDragMoved(false);
  };

  const submitNewNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeModalCoords || !newHostname.trim() || !newIp.trim()) return;
    onAddTopologyNode({
      hostname: newHostname.trim(),
      ip: newIp.trim(),
      vendor: newVendor,
      role: newRole,
      model: newModel.trim() || `${newVendor} ${newRole}`,
      site: newSite,
      portCount: newPortCount,
      x: newNodeModalCoords.x,
      y: newNodeModalCoords.y,
    });
    setNewNodeModalCoords(null);
    setTool('select');
  };

  const submitNewLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLinkPair) return;
    onCreateTopologyLink({
      sourceId: pendingLinkPair.source.id,
      sourcePort: linkSrcPort.trim() || 'Gi0/1',
      targetId: pendingLinkPair.target.id,
      targetPort: linkDstPort.trim() || 'Gi0/1',
      speedMbps: linkSpeedMbps,
      protocol: linkProtocol,
    });
    setPendingLinkPair(null);
    setTool('select');
  };

  const complianceList = useMemo(() => {
    return devices.flatMap((dev) =>
      auditDeviceCompliance(dev).map((finding) => ({
        device: dev,
        finding,
      }))
    );
  }, [devices]);

  const visibleAlerts = useMemo(() => {
    if (alertFilter === 'ALL') return alerts;
    return alerts.filter((a) => !a.acknowledged);
  }, [alerts, alertFilter]);

  const viewW = 1040 / zoom;
  const viewH = 550 / zoom;
  const viewX = (1040 - viewW) / 2;
  const viewY = (550 - viewH) / 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Interactive Topology Studio & Real-Time Live Map
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Drag nodes freely, draw new routers/switches/firewalls/servers, connect port cables, and monitor real-time traffic, port states, and server services
          </p>
        </div>

        {/* Drawing & Layout Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTool('select');
                setLinkSourceId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tool === 'select'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select & Drag</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('add-node');
                setLinkSourceId(null);
                setNewNodeModalCoords({ x: 520, y: 270 });
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tool === 'add-node'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Node</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('draw-link');
                setLinkSourceId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tool === 'draw-link'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Cable className="w-3.5 h-3.5" />
              <span>Draw Cable</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('unlink');
                setLinkSourceId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tool === 'unlink'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cut Cable</span>
            </button>
          </div>

          {/* Zoom & Auto-Layout */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                onAutoLayoutTopology();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Auto-Align Tiers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Mode Instruction Banner */}
      {tool !== 'select' && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <span>
            {tool === 'draw-link' &&
              (linkSourceId
                ? `Source node selected (${devices.find((d) => d.id === linkSourceId)?.hostname}) — now click a destination node on the diagram to connect a port cable.`
                : 'Draw Cable Mode: Click the first device (Source), then click the second device (Destination) to wire physical ports together.')}
            {tool === 'add-node' &&
              'Add Node Mode: Click anywhere on the topology grid to place a new Router, Switch, Firewall, or Server at that position.'}
            {tool === 'unlink' &&
              'Cut Cable Mode: Click any link badge (Mbps / LINK DOWN) between two devices to disconnect that cable.'}
          </span>
          <button
            type="button"
            onClick={() => {
              setTool('select');
              setLinkSourceId(null);
            }}
            className="font-medium underline ml-4 shrink-0"
          >
            Exit Mode
          </button>
        </div>
      )}

      {/* Interactive Topology Canvas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              <span>Online / Link Up</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              <span>Warning / Degraded</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
              <span>Offline / Port Down</span>
            </span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {devices.length} Nodes · {topologyLinks.length} Physical/Logical Links · Zoom{' '}
            {Math.round(zoom * 100)}%
          </div>
        </div>

        <div className="w-full overflow-x-auto bg-slate-50/70 dark:bg-slate-950/70">
          <svg
            ref={svgRef}
            viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerLeave={handleSvgPointerUp}
            onClick={handleSvgBackgroundClick}
            className={`w-full min-w-[860px] h-[510px] select-none ${
              tool === 'add-node' ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <defs>
              <pattern
                id="topoGrid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="2"
                  cy="2"
                  r="1"
                  fill={isDark ? '#1e293b' : '#cbd5e1'}
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width="1040" height="550" fill="url(#topoGrid)" />

            {/* Subtle Tier Guides */}
            {[
              { y: 76, label: 'Perimeter Firewalls' },
              { y: 205, label: 'Core & WAN Routers' },
              { y: 345, label: 'Switches & Wireless' },
              { y: 475, label: 'Enterprise Servers' },
            ].map((t) => (
              <text
                key={t.label}
                x={18}
                y={t.y - 36}
                fill={isDark ? '#475569' : '#94a3b8'}
                fontSize={10}
                fontFamily="Public Sans, sans-serif"
              >
                {t.label}
              </text>
            ))}

            {/* Topology Cable Links */}
            {topologyLinks.map((lnk) => {
              const midX = (lnk.from.x + lnk.to.x) / 2;
              const midY = (lnk.from.y + lnk.to.y) / 2;
              return (
                <g
                  key={lnk.key}
                  onClick={(e) => {
                    if (tool === 'unlink') {
                      e.stopPropagation();
                      onRemoveTopologyLink(lnk.sourceId, lnk.targetId);
                    }
                  }}
                  className={tool === 'unlink' ? 'cursor-pointer' : ''}
                >
                  <line
                    x1={lnk.from.x}
                    y1={lnk.from.y}
                    x2={lnk.to.x}
                    y2={lnk.to.y}
                    stroke={lnk.isUp ? (isDark ? '#3b82f6' : '#2563eb') : '#dc2626'}
                    strokeWidth={lnk.isUp ? 2.2 : 1.8}
                    strokeDasharray={lnk.isUp ? undefined : '6 4'}
                    opacity={lnk.isUp ? 0.8 : 0.9}
                  />
                  <rect
                    x={midX - 42}
                    y={midY - 10}
                    width={84}
                    height={20}
                    rx={4}
                    fill={
                      tool === 'unlink'
                        ? '#dc2626'
                        : isDark
                        ? '#0f172a'
                        : '#ffffff'
                    }
                    stroke={
                      tool === 'unlink'
                        ? '#dc2626'
                        : lnk.isUp
                        ? isDark
                          ? '#334155'
                          : '#cbd5e1'
                        : '#dc2626'
                    }
                    strokeWidth={1}
                  />
                  <text
                    x={midX}
                    y={midY + 3.5}
                    textAnchor="middle"
                    fill={
                      tool === 'unlink'
                        ? '#ffffff'
                        : lnk.isUp
                        ? isDark
                          ? '#e2e8f0'
                          : '#1e293b'
                        : '#dc2626'
                    }
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {tool === 'unlink'
                      ? 'CUT CABLE'
                      : lnk.isUp
                      ? `${lnk.bandwidthMbps} Mbps`
                      : 'LINK DOWN'}
                  </text>
                </g>
              );
            })}

            {/* Draggable Real-Time Device Nodes */}
            {Object.values(positionedNodes).map(({ x, y, device }) => {
              const strokeColor =
                device.status === DeviceStatus.Online
                  ? '#16a34a'
                  : device.status === DeviceStatus.Warning
                  ? '#d97706'
                  : '#dc2626';

              const isFocused = focusedNodeId === device.id;
              const isLinkSource = linkSourceId === device.id;

              const upPorts = device.interfaces.filter(
                (i) =>
                  device.status !== DeviceStatus.Offline &&
                  i.status === 'up' &&
                  (i.adminStatus ?? 'up') === 'up'
              ).length;
              const runningSvcs = (device.services || []).filter(
                (s) => device.status !== DeviceStatus.Offline && s.status === 'running'
              ).length;

              const subMetric =
                device.role === DeviceRole.Server && device.services
                  ? `Svc ${runningSvcs}/${device.services.length} UP`
                  : `Ports ${upPorts}/${device.interfaces.length} UP`;

              return (
                <g
                  key={device.id}
                  transform={`translate(${x - 82}, ${y - 30})`}
                  onPointerDown={(e) => {
                    if (tool === 'select') {
                      e.stopPropagation();
                      setDragMoved(false);
                      setDraggingId(device.id);
                      setFocusedNodeId(device.id);
                    }
                  }}
                  onClick={(e) => handleNodeClick(e, device)}
                  className={tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                >
                  {(isFocused || isLinkSource) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={172}
                      height={68}
                      rx={11}
                      fill="none"
                      stroke={isLinkSource ? '#2563eb' : '#3b82f6'}
                      strokeWidth={1.5}
                      strokeDasharray={isLinkSource ? '4 2' : undefined}
                    />
                  )}
                  <rect
                    width={164}
                    height={60}
                    rx={8}
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke={strokeColor}
                    strokeWidth={1.8}
                  />
                  {/* Status Indicator + Hostname */}
                  <circle cx={13} cy={15} r={4} fill={strokeColor} />
                  <text
                    x={23}
                    y={18.5}
                    fill={isDark ? '#f8fafc' : '#0f172a'}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {device.hostname.split('.')[0].slice(0, 16)}
                  </text>
                  {/* Vendor & IP */}
                  <text
                    x={11}
                    y={34}
                    fill={isDark ? '#94a3b8' : '#64748b'}
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {device.ip} · {device.vendor.split(' ')[0]}
                  </text>
                  {/* Real-time Ports/Services + CPU/Traffic */}
                  <text
                    x={11}
                    y={49}
                    fill={
                      device.status === DeviceStatus.Offline
                        ? '#dc2626'
                        : isDark
                        ? '#cbd5e1'
                        : '#334155'
                    }
                    fontSize={9.2}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {device.status === DeviceStatus.Offline
                      ? `OFFLINE · ${subMetric}`
                      : `${subMetric} · CPU ${device.cpuLoad}%`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Focused Node Real-Time Quick Action Strip */}
        {focusedNode && (
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {focusedNode.hostname}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {focusedNode.ip}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {focusedNode.vendor} ({focusedNode.model})
                </span>
              </div>
              <div className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                Rx {focusedNode.inboundMbps.toFixed(1)} Mbps · Tx{' '}
                {focusedNode.outboundMbps.toFixed(1)} Mbps · CPU {focusedNode.cpuLoad}% · RAM{' '}
                {focusedNode.memoryUsage}% · RTT {focusedNode.latencyMs.toFixed(1)} ms
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleDeviceStatus(focusedNode.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {focusedNode.status === DeviceStatus.Offline ? 'Recover Online' : 'Simulate Offline'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenPortMonitor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                <Cable className="w-3.5 h-3.5" />
                <span>
                  {focusedNode.role === DeviceRole.Server
                    ? 'Monitor Server Services'
                    : 'Monitor Ports Up/Down'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDevice(focusedNode)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                Full Details
              </button>

              <button
                type="button"
                onClick={() => onOpenVisualConfig(focusedNode.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Hook & Visual Configure</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Split: Active Monitoring Alerts + Automated CIS Security Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Active SNMP Traps, Port Events & Service Incidents
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time link up/down traps, daemon failures, and threshold alerts
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setAlertFilter('UNACK')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  alertFilter === 'UNACK'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Open ({alerts.filter((a) => !a.acknowledged).length})
              </button>
              <button
                type="button"
                onClick={() => setAlertFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  alertFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                All ({alerts.length})
              </button>
            </div>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-slate-800 dark:text-slate-200">
                All active network alerts acknowledged
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {visibleAlerts.map((alt) => {
                const targetDev = devices.find((d) => d.id === alt.deviceId);
                return (
                  <div key={alt.id} className="p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {alt.severity === 'critical' ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="font-mono text-slate-900 dark:text-slate-100">
                          {alt.hostname}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{alt.category}</span>
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">{alt.timestamp}</span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {alt.message}
                    </p>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="font-mono text-slate-400">
                        {alt.ip} · {alt.vendor}
                      </span>
                      <div className="flex items-center gap-2">
                        {targetDev && targetDev.status === DeviceStatus.Offline && (
                          <button
                            type="button"
                            onClick={() => onToggleDeviceStatus(targetDev.id)}
                            className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                          >
                            <Power className="w-3 h-3" />
                            <span>Recover Node</span>
                          </button>
                        )}
                        {!alt.acknowledged && (
                          <button
                            type="button"
                            onClick={() => onAcknowledgeAlert(alt.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Check className="w-3 h-3" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Automated CIS Multi-Vendor Configuration Compliance */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Multi-Vendor CIS Security & Hardening Audit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live inspection of running-configs for Telnet, default SNMP strings, missing NTP, and Syslog
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {complianceList.length} open findings
            </span>
          </div>

          {complianceList.length === 0 ? (
            <div className="p-8 text-center text-xs">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-slate-900 dark:text-slate-100">
                100% CIS Baseline Compliant Across All Vendors
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {complianceList.map(({ device, finding }) => (
                <div key={finding.id} className="p-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                      <ShieldAlert
                        className={`w-3.5 h-3.5 shrink-0 ${
                          finding.severity === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      />
                      <span>{finding.title}</span>
                    </span>
                    <span className="font-mono text-slate-500">{finding.ruleCode}</span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400">{finding.description}</p>

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-500">
                      {device.hostname} ({device.vendor})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onRemediateCompliance(device.id, finding.remediationTemplate)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Fix in Config Hub</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Topology Node Modal */}
      {newNodeModalCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Place New Monitored Node on Topology
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNewNodeModalCoords(null);
                  setTool('select');
                }}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewNode} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Device Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const role = e.target.value as DeviceRole;
                      setNewRole(role);
                      if (role === DeviceRole.Server) {
                        setNewVendor('Linux / Server');
                        setNewModel('Ubuntu 24.04 LTS App Host');
                        setNewHostname('srv-app-node04.corp.local');
                        setNewPortCount(2);
                      } else if (role === DeviceRole.Firewall) {
                        setNewVendor('Fortinet');
                        setNewModel('FortiGate 400F');
                        setNewHostname('fw-branch-02.corp.local');
                        setNewPortCount(8);
                      } else if (role === DeviceRole.Router) {
                        setNewVendor('Cisco IOS-XE');
                        setNewModel('Catalyst 8300');
                        setNewHostname('rtr-wan-04.corp.local');
                        setNewPortCount(6);
                      } else {
                        setNewVendor('Cisco IOS-XE');
                        setNewModel('Catalyst 9300-24P');
                        setNewHostname('sw-campus-acc05.corp.local');
                        setNewPortCount(12);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {Object.values(DeviceRole).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hardware Vendor
                  </label>
                  <select
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value as VendorName)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {VENDORS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hostname
                  </label>
                  <input
                    type="text"
                    required
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Management IPv4
                  </label>
                  <input
                    type="text"
                    required
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hardware Model
                  </label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Physical Port Count
                  </label>
                  <select
                    value={newPortCount}
                    onChange={(e) => setNewPortCount(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={2}>2 Ports (Dual NIC)</option>
                    <option value={6}>6 Ports (Router/Appliance)</option>
                    <option value={8}>8 Ports (Firewall/Compact)</option>
                    <option value={12}>12 Ports (Switch)</option>
                    <option value={24}>24 Ports (Rack Switch)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="font-mono text-slate-400">
                  Canvas Pos: ({newNodeModalCoords.x}, {newNodeModalCoords.y})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewNodeModalCoords(null);
                      setTool('select');
                    }}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Create & Monitor Live
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Physical Link / Cable Modal */}
      {pendingLinkPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Connect Network Port Cable
              </h2>
              <button
                type="button"
                onClick={() => setPendingLinkPair(null)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewLink} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {pendingLinkPair.source.hostname.split('.')[0]} Port
                  </label>
                  <input
                    type="text"
                    required
                    value={linkSrcPort}
                    onChange={(e) => setLinkSrcPort(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {pendingLinkPair.target.hostname.split('.')[0]} Port
                  </label>
                  <input
                    type="text"
                    required
                    value={linkDstPort}
                    onChange={(e) => setLinkDstPort(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Link Speed
                  </label>
                  <select
                    value={linkSpeedMbps}
                    onChange={(e) => setLinkSpeedMbps(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={1000}>1 Gbps Copper</option>
                    <option value={10000}>10 Gbps SFP+ Fiber</option>
                    <option value={25000}>25 Gbps SFP28</option>
                    <option value={40000}>40 Gbps QSFP+</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Link Protocol
                  </label>
                  <select
                    value={linkProtocol}
                    onChange={(e) =>
                      setLinkProtocol(e.target.value as 'LLDP' | 'CDP' | 'LACP' | 'STATIC')
                    }
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="LLDP">LLDP</option>
                    <option value="CDP">Cisco CDP</option>
                    <option value="LACP">802.3ad LACP</option>
                    <option value="STATIC">Static Patch</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingLinkPair(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Connect Ports
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
