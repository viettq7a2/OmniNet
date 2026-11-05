// OmniNet Interactive Topology Studio & Monitoring View
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  FileText,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MousePointer,
  Move,
  Plus,
  Power,
  RotateCcw,
  ShieldAlert,
  Sliders,
  StickyNote,
  Terminal,
  Trash2,
  Wrench,
  X,
  XCircle,
  Zap,
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
import { AppLanguage } from '../utils/i18n';

interface MonitoringTopologyViewProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  isDark: boolean;
  lang?: AppLanguage;
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

type NoteColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

interface TopologyCanvasNote {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
  color: NoteColor;
}

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

const CANVAS_WIDTH = 1860;
const CANVAS_HEIGHT = 960;

const DEFAULT_LAG_BUNDLES: Record<string, 1 | 2 | 4> = {
  'dev-fw-02--dev-sw-01': 4,
  'dev-sw-01--dev-sw-hpe-01': 4,
  'dev-rtr-01--dev-sw-01': 2,
  'dev-fw-01--dev-rtr-01': 2,
  'dev-sw-02--dev-sw-unifi-01': 2,
  'dev-rtr-02--dev-sw-02': 2,
  'dev-srv-01--dev-sw-01': 2,
};

const INITIAL_CANVAS_NOTES: TopologyCanvasNote[] = [
  {
    id: 'note-dc-core',
    x: 660,
    y: 88,
    title: 'HN-DC1 Core Fabric',
    body: 'LACP 4x25G Active · VLAN 10, 100, 105',
    color: 'emerald',
  },
  {
    id: 'note-wan-mpls',
    x: 545,
    y: 245,
    title: 'BGP MPLS Backbone',
    body: 'AS65001 ↔ AS65002 · BFD Enabled',
    color: 'blue',
  },
];

type ContextMenuState =
  | {
      type: 'node';
      clientX: number;
      clientY: number;
      device: NetworkDevice;
    }
  | {
      type: 'link';
      clientX: number;
      clientY: number;
      linkKey: string;
      sourceDevice: NetworkDevice;
      targetDevice: NetworkDevice;
      sourcePort: string;
      targetPort: string;
      bandwidthMbps: number;
      currentMembers: 1 | 2 | 4;
    }
  | {
      type: 'note';
      clientX: number;
      clientY: number;
      note: TopologyCanvasNote;
    }
  | {
      type: 'canvas';
      clientX: number;
      clientY: number;
      svgX: number;
      svgY: number;
    };

export const MonitoringTopologyView: React.FC<MonitoringTopologyViewProps> = ({
  devices,
  alerts,
  isDark,
  lang = 'vi',
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
  const isVi = lang === 'vi';
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [tool, setTool] = useState<CanvasTool>('select');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [canvasSizeMode, setCanvasSizeMode] = useState<'normal' | 'large' | 'fullscreen'>('large');
  const [animateFlow, setAnimateFlow] = useState<boolean>(true);
  const [highlightLagOnly, setHighlightLagOnly] = useState<boolean>(false);
  const [showTierGuides, setShowTierGuides] = useState<boolean>(false);
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'UNACK'>('UNACK');
  const [showBottomPanels, setShowBottomPanels] = useState<boolean>(false);

  // Compact dropdown menus in toolbar
  const [openAddMenu, setOpenAddMenu] = useState<boolean>(false);
  const [openViewMenu, setOpenViewMenu] = useState<boolean>(false);

  // Interactive LAG overrides
  const [lagOverrides, setLagOverrides] = useState<Record<string, 1 | 2 | 4>>(() => {
    try {
      const saved = localStorage.getItem('omninet_lag_overrides_v1');
      if (saved) return { ...DEFAULT_LAG_BUNDLES, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_LAG_BUNDLES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('omninet_lag_overrides_v1', JSON.stringify(lagOverrides));
    } catch {
      // ignore
    }
  }, [lagOverrides]);

  // Canvas Notes (EVE-NG style text/sticky annotations on the diagram)
  const [canvasNotes, setCanvasNotes] = useState<TopologyCanvasNote[]>(() => {
    try {
      const saved = localStorage.getItem('omninet_canvas_notes_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_CANVAS_NOTES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('omninet_canvas_notes_v1', JSON.stringify(canvasNotes));
    } catch {
      // ignore
    }
  }, [canvasNotes]);

  // Per-Node Attached Notes (sticky tags under a specific device node)
  const [nodeNotes, setNodeNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('omninet_node_notes_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      'dev-sw-01': 'Core Spine · vPC Primary',
      'dev-rtr-03': 'Check IPSec Jitter',
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('omninet_node_notes_v1', JSON.stringify(nodeNotes));
    } catch {
      // ignore
    }
  }, [nodeNotes]);

  // Add/Edit Note Modal State
  const [noteModal, setNoteModal] = useState<{
    mode: 'canvas-add' | 'canvas-edit' | 'node-note';
    svgX: number;
    svgY: number;
    noteId?: string;
    deviceId?: string;
    deviceHostname?: string;
    title: string;
    body: string;
    color: NoteColor;
  } | null>(null);

  // Draggable optional tier labels
  const [tierLabels, setTierLabels] = useState([
    { id: 'tier-0', x: 36, y: 80, text: 'Perimeter Firewalls' },
    { id: 'tier-1', x: 36, y: 290, text: 'Core & WAN Routers' },
    { id: 'tier-2', x: 36, y: 540, text: 'Switches & Wireless' },
    { id: 'tier-3', x: 36, y: 790, text: 'Enterprise Servers' },
  ]);

  // 60FPS Zero-Lag Local Drag Engine (avoids parent re-renders & localStorage writes during move)
  const dragSessionRef = useRef<{
    kind: 'node' | 'note' | 'label' | 'pan';
    id?: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    rectWidth: number;
    rectHeight: number;
    moved: boolean;
  } | null>(null);

  const [liveNodeDrag, setLiveNodeDrag] = useState<{ id: string; x: number; y: number } | null>(
    null
  );
  const [liveNoteDrag, setLiveNoteDrag] = useState<{ id: string; x: number; y: number } | null>(
    null
  );
  const [isPanning, setIsPanning] = useState(false);
  const suppressClickRef = useRef(false);

  // Right-Click Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Selected node on canvas
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(devices[0]?.id || null);

  // Draw-link state
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [pendingLinkPair, setPendingLinkPair] = useState<{
    source: NetworkDevice;
    target: NetworkDevice;
  } | null>(null);
  const [linkSrcPort, setLinkSrcPort] = useState('Po10');
  const [linkDstPort, setLinkDstPort] = useState('Po10');
  const [linkSpeedMbps, setLinkSpeedMbps] = useState(25000);
  const [linkProtocol, setLinkProtocol] = useState<'LLDP' | 'CDP' | 'LACP' | 'STATIC'>('LACP');
  const [linkBundleCount, setLinkBundleCount] = useState<1 | 2 | 4>(2);

  // Add-node modal state
  const [newNodeModalCoords, setNewNodeModalCoords] = useState<{ x: number; y: number } | null>(
    null
  );
  const [newHostname, setNewHostname] = useState('sw-campus-acc05.corp.local');
  const [newIp, setNewIp] = useState('10.20.30.25');
  const [newVendor, setNewVendor] = useState<VendorName>('Ubiquiti UniFi');
  const [newRole, setNewRole] = useState<DeviceRole>(DeviceRole.Switch);
  const [newModel, setNewModel] = useState('UniFi Pro Max 24 PoE');
  const [newSite, setNewSite] = useState('SGN-Campus HQ');
  const [newPortCount, setNewPortCount] = useState(12);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setOpenAddMenu(false);
        setOpenViewMenu(false);
        if (canvasSizeMode === 'fullscreen') {
          setCanvasSizeMode('large');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canvasSizeMode]);

  // Compute spacious non-overlapping coordinates across 1860 x 960 + apply 60FPS liveNodeDrag override
  const basePositionedNodes = useMemo(() => {
    const tiers: Record<number, NetworkDevice[]> = { 0: [], 1: [], 2: [], 3: [] };
    devices.forEach((d) => {
      tiers[d.topologyTier] = tiers[d.topologyTier] || [];
      tiers[d.topologyTier].push(d);
    });

    const tierY: Record<number, number> = { 0: 120, 1: 340, 2: 590, 3: 825 };

    const tier2List = tiers[2] || [];
    const hasLegacyCrampedOverlap =
      tier2List.length >= 4 &&
      tier2List.some((d) => d.canvasPos?.y === 345 && (d.canvasPos?.x ?? 0) <= 520);

    const coords: Record<string, { x: number; y: number; device: NetworkDevice }> = {};
    [0, 1, 2, 3].forEach((tier) => {
      const list = tiers[tier] || [];
      const count = list.length;
      list.forEach((dev, idx) => {
        const marginX = count >= 6 ? 160 : 240;
        const usableWidth = CANVAS_WIDTH - marginX * 2;
        const fallbackX =
          count === 1
            ? Math.round(CANVAS_WIDTH / 2)
            : Math.round(marginX + (usableWidth / (count - 1)) * idx);
        const fallbackY = tierY[tier];

        const useFallback = !dev.canvasPos || hasLegacyCrampedOverlap;
        coords[dev.id] = {
          x: useFallback ? fallbackX : dev.canvasPos!.x,
          y: useFallback ? fallbackY : dev.canvasPos!.y,
          device: dev,
        };
      });
    });

    return coords;
  }, [devices]);

  const positionedNodes = useMemo(() => {
    if (!liveNodeDrag) return basePositionedNodes;
    const target = basePositionedNodes[liveNodeDrag.id];
    if (!target) return basePositionedNodes;
    return {
      ...basePositionedNodes,
      [liveNodeDrag.id]: {
        ...target,
        x: liveNodeDrag.x,
        y: liveNodeDrag.y,
      },
    };
  }, [basePositionedNodes, liveNodeDrag]);

  const topologyLinks = useMemo(() => {
    const linkMap = new Map<
      string,
      {
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
        memberCount: 1 | 2 | 4;
        isLag: boolean;
      }
    >();

    devices.forEach((dev) => {
      dev.interfaces.forEach((iface) => {
        if (!iface.connectedToId) return;
        const target = positionedNodes[iface.connectedToId];
        const source = positionedNodes[dev.id];
        if (!source || !target) return;

        const sortedIds = [dev.id, iface.connectedToId].sort();
        const pairKey = sortedIds.join('--');

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

        const portLooksLag =
          iface.protocol === 'LACP' ||
          /po\d|bond|lag|bagg|ae\d|port-channel|2x|4x/i.test(iface.name);

        const existing = linkMap.get(pairKey);
        if (!existing) {
          const samePeerIfaces = dev.interfaces.filter(
            (i) => i.connectedToId === iface.connectedToId
          );
          const countFromIfaces = samePeerIfaces.length;

          const overrideCount = lagOverrides[pairKey];
          const inferredCount: 1 | 2 | 4 = overrideCount
            ? overrideCount
            : countFromIfaces >= 4 || /4x/i.test(iface.name)
            ? 4
            : countFromIfaces >= 2 || portLooksLag
            ? 2
            : 1;

          const rawBw = samePeerIfaces.reduce(
            (sum, item) => sum + (isUp ? Number((item.rxMbps + item.txMbps).toFixed(0)) : 0),
            0
          );
          const totalBw =
            isUp && inferredCount > 1 && countFromIfaces === 1
              ? Math.round(rawBw * (inferredCount === 4 ? 1.8 : 1.35))
              : rawBw;

          linkMap.set(pairKey, {
            key: pairKey,
            sourceId: dev.id,
            targetId: iface.connectedToId,
            sourcePort: iface.name,
            targetPort: iface.connectedPort || peerPort?.name || 'eth0',
            from: source,
            to: target,
            bandwidthMbps: totalBw,
            protocol: inferredCount >= 2 ? 'LACP' : iface.protocol,
            isUp,
            memberCount: inferredCount,
            isLag: inferredCount >= 2,
          });
        }
      });
    });

    return Array.from(linkMap.values());
  }, [devices, positionedNodes, lagOverrides]);

  const lagBundleTotal = useMemo(
    () => topologyLinks.filter((l) => l.isLag).length,
    [topologyLinks]
  );

  const viewW = CANVAS_WIDTH / zoom;
  const viewH = CANVAS_HEIGHT / zoom;
  const viewX = (CANVAS_WIDTH - viewW) / 2 - pan.x;
  const viewY = (CANVAS_HEIGHT - viewH) / 2 - pan.y;

  const clientToSvgCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: Math.round(CANVAS_WIDTH / 2), y: Math.round(CANVAS_HEIGHT / 2) };
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / Math.max(1, rect.width)) * viewW + viewX;
    const relY = ((clientY - rect.top) / Math.max(1, rect.height)) * viewH + viewY;
    return {
      x: Math.max(-1800, Math.min(CANVAS_WIDTH + 1800, Math.round(relX))),
      y: Math.max(-1200, Math.min(CANVAS_HEIGHT + 1200, Math.round(relY))),
    };
  };

  const beginDragSession = (
    e: React.PointerEvent,
    kind: 'node' | 'note' | 'label' | 'pan',
    originX: number,
    originY: number,
    id?: string
  ) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragSessionRef.current = {
      kind,
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX,
      originY,
      rectWidth: Math.max(1, rect.width),
      rectHeight: Math.max(1, rect.height),
      moved: false,
    };
    if (kind === 'pan') {
      setIsPanning(true);
    }
  };

  const handleSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.ctrlKey || e.metaKey || canvasSizeMode === 'fullscreen') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom((z) => Math.max(0.4, Math.min(2.4, Number((z + delta).toFixed(2)))));
    }
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    setContextMenu(null);
    setOpenAddMenu(false);
    setOpenViewMenu(false);

    if (
      tool === 'select' &&
      (e.target === svgRef.current || (e.target as Element).tagName === 'rect')
    ) {
      beginDragSession(e, 'pan', pan.x, pan.y);
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    const rawClientDx = e.clientX - session.startClientX;
    const rawClientDy = e.clientY - session.startClientY;
    if (!session.moved && Math.hypot(rawClientDx, rawClientDy) > 3) {
      session.moved = true;
    }

    const svgDx = (rawClientDx / session.rectWidth) * viewW;
    const svgDy = (rawClientDy / session.rectHeight) * viewH;

    if (session.kind === 'node' && session.id) {
      const nextX = Math.max(-1800, Math.min(CANVAS_WIDTH + 1800, Math.round(session.originX + svgDx)));
      const nextY = Math.max(-1200, Math.min(CANVAS_HEIGHT + 1200, Math.round(session.originY + svgDy)));
      setLiveNodeDrag({ id: session.id, x: nextX, y: nextY });
      return;
    }

    if (session.kind === 'note' && session.id) {
      const nextX = Math.max(-1800, Math.min(CANVAS_WIDTH + 1800, Math.round(session.originX + svgDx)));
      const nextY = Math.max(-1200, Math.min(CANVAS_HEIGHT + 1200, Math.round(session.originY + svgDy)));
      setLiveNoteDrag({ id: session.id, x: nextX, y: nextY });
      return;
    }

    if (session.kind === 'label' && session.id) {
      const nextX = Math.round(session.originX + svgDx);
      const nextY = Math.round(session.originY + svgDy);
      setTierLabels((prev) =>
        prev.map((lbl) => (lbl.id === session.id ? { ...lbl, x: nextX, y: nextY } : lbl))
      );
      return;
    }

    if (session.kind === 'pan') {
      setPan({
        x: Math.max(-2200, Math.min(2200, Math.round(session.originX + svgDx))),
        y: Math.max(-1500, Math.min(1500, Math.round(session.originY + svgDy))),
      });
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const session = dragSessionRef.current;
    if (!session) return;

    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (session.moved) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 60);
    }

    if (session.kind === 'node' && session.id && liveNodeDrag) {
      onMoveNodePosition(session.id, liveNodeDrag.x, liveNodeDrag.y);
    } else if (session.kind === 'note' && session.id && liveNoteDrag) {
      const finalX = liveNoteDrag.x;
      const finalY = liveNoteDrag.y;
      setCanvasNotes((prev) =>
        prev.map((n) => (n.id === session.id ? { ...n, x: finalX, y: finalY } : n))
      );
    }

    dragSessionRef.current = null;
    setLiveNodeDrag(null);
    setLiveNoteDrag(null);
    setIsPanning(false);
  };

  const handleSvgBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'add-node') {
      const pt = clientToSvgCoords(e.clientX, e.clientY);
      setNewNodeModalCoords(pt);
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    setContextMenu({
      type: 'canvas',
      clientX: e.clientX,
      clientY: e.clientY,
      svgX: pt.x,
      svgY: pt.y,
    });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, dev: NetworkDevice) => {
    e.preventDefault();
    e.stopPropagation();
    setFocusedNodeId(dev.id);
    setContextMenu({
      type: 'node',
      clientX: e.clientX,
      clientY: e.clientY,
      device: dev,
    });
  };

  const handleNoteContextMenu = (e: React.MouseEvent, note: TopologyCanvasNote) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      type: 'note',
      clientX: e.clientX,
      clientY: e.clientY,
      note,
    });
  };

  const handleLinkContextMenu = (
    e: React.MouseEvent,
    lnk: (typeof topologyLinks)[number]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      type: 'link',
      clientX: e.clientX,
      clientY: e.clientY,
      linkKey: lnk.key,
      sourceDevice: lnk.from.device,
      targetDevice: lnk.to.device,
      sourcePort: lnk.sourcePort,
      targetPort: lnk.targetPort,
      bandwidthMbps: lnk.bandwidthMbps,
      currentMembers: lnk.memberCount,
    });
  };

  const handleNodeClick = (e: React.MouseEvent, dev: NetworkDevice) => {
    e.stopPropagation();
    setContextMenu(null);
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
          setLinkSrcPort(srcDev.role === DeviceRole.Server ? `bond0` : `Po${nextIdx}`);
          setLinkDstPort(dev.role === DeviceRole.Server ? `bond0` : `Po${dstIdx}`);
          setPendingLinkPair({ source: srcDev, target: dev });
        }
        setLinkSourceId(null);
      }
      return;
    }

    if (!suppressClickRef.current) {
      setFocusedNodeId(dev.id);
    }
  };

  const handleSetLinkLagMode = (pairKey: string, count: 1 | 2 | 4) => {
    setLagOverrides((prev) => ({
      ...prev,
      [pairKey]: count,
    }));
    setContextMenu(null);
  };

  const handleSaveNoteModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteModal) return;

    if (noteModal.mode === 'node-note' && noteModal.deviceId) {
      const trimmed = noteModal.body.trim();
      setNodeNotes((prev) => {
        const next = { ...prev };
        if (!trimmed) {
          delete next[noteModal.deviceId!];
        } else {
          next[noteModal.deviceId!] = trimmed;
        }
        return next;
      });
      setNoteModal(null);
      return;
    }

    if (noteModal.mode === 'canvas-edit' && noteModal.noteId) {
      setCanvasNotes((prev) =>
        prev.map((n) =>
          n.id === noteModal.noteId
            ? {
                ...n,
                title: noteModal.title.trim() || 'Note',
                body: noteModal.body.trim(),
                color: noteModal.color,
              }
            : n
        )
      );
      setNoteModal(null);
      return;
    }

    const created: TopologyCanvasNote = {
      id: `note-${Date.now()}`,
      x: noteModal.svgX,
      y: noteModal.svgY,
      title: noteModal.title.trim() || (isVi ? 'Ghi chú Hạ tầng' : 'Network Note'),
      body: noteModal.body.trim() || 'VLAN / Circuit / Info',
      color: noteModal.color,
    };
    setCanvasNotes((prev) => [...prev, created]);
    setNoteModal(null);
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
    const baseSrc = linkSrcPort.trim() || 'Gi0/1';
    const baseDst = linkDstPort.trim() || 'Gi0/1';
    const sortedPairKey = [pendingLinkPair.source.id, pendingLinkPair.target.id].sort().join('--');

    setLagOverrides((prev) => ({
      ...prev,
      [sortedPairKey]: linkBundleCount,
    }));

    if (linkBundleCount === 1) {
      onCreateTopologyLink({
        sourceId: pendingLinkPair.source.id,
        sourcePort: baseSrc,
        targetId: pendingLinkPair.target.id,
        targetPort: baseDst,
        speedMbps: linkSpeedMbps,
        protocol: linkProtocol,
      });
    } else {
      for (let i = 1; i <= linkBundleCount; i++) {
        onCreateTopologyLink({
          sourceId: pendingLinkPair.source.id,
          sourcePort: `${baseSrc} (LAG-${i}/${linkBundleCount})`,
          targetId: pendingLinkPair.target.id,
          targetPort: `${baseDst} (LAG-${i}/${linkBundleCount})`,
          speedMbps: linkSpeedMbps,
          protocol: 'LACP',
        });
      }
    }
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

  const canvasHeightClass =
    canvasSizeMode === 'fullscreen'
      ? 'h-[calc(100vh-115px)]'
      : canvasSizeMode === 'large'
      ? 'h-[calc(100vh-195px)] min-h-[700px]'
      : 'h-[580px]';

  const getNoteColors = (color: NoteColor) => {
    switch (color) {
      case 'emerald':
        return {
          bg: isDark ? '#064e3b' : '#ecfdf5',
          border: '#10b981',
          title: isDark ? '#6ee7b7' : '#047857',
          body: isDark ? '#d1fae5' : '#065f46',
        };
      case 'amber':
        return {
          bg: isDark ? '#451a03' : '#fffbeb',
          border: '#f59e0b',
          title: isDark ? '#fcd34d' : '#b45309',
          body: isDark ? '#fef3c7' : '#92400e',
        };
      case 'rose':
        return {
          bg: isDark ? '#4c0519' : '#fff1f2',
          border: '#f43f5e',
          title: isDark ? '#fda4af' : '#be123c',
          body: isDark ? '#ffe4e6' : '#9f1239',
        };
      case 'slate':
        return {
          bg: isDark ? '#1e293b' : '#f8fafc',
          border: isDark ? '#475569' : '#94a3b8',
          title: isDark ? '#f1f5f9' : '#1e293b',
          body: isDark ? '#cbd5e1' : '#475569',
        };
      default:
        return {
          bg: isDark ? '#0c4a6e' : '#f0f9ff',
          border: '#0ea5e9',
          title: isDark ? '#7dd3fc' : '#0369a1',
          body: isDark ? '#e0f2fe' : '#075985',
        };
    }
  };

  return (
    <div className="space-y-3">
      {/* Ultra-Clean Header & Consolidated Dropdown Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isVi ? 'Bản đồ Topology & Bó cáp LAG' : 'Network Topology & LAG Map'}
          </h1>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            {lagBundleTotal} LAG / LACP
          </span>
        </div>

        {/* Streamlined Toolbar with Dropdown Menus */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Select & Drag */}
          <button
            type="button"
            onClick={() => {
              setTool('select');
              setLinkSourceId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              tool === 'select'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>{isVi ? 'Chọn & Kéo' : 'Select & Pan'}</span>
          </button>

          {/* Consolidated "+ Add / Connect ▾" Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenAddMenu((v) => !v);
                setOpenViewMenu(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span>{isVi ? 'Thêm & Nối dây' : 'Add & Connect'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openAddMenu && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOpenAddMenu(false);
                    setNoteModal({
                      mode: 'canvas-add',
                      svgX: 740,
                      svgY: 320,
                      title: isVi ? 'Ghi chú Mạng / VLAN' : 'Network / VLAN Note',
                      body: isVi
                        ? 'Trunk 10,20,100 · LACP Active'
                        : 'Trunk 10,20,100 · LACP Active',
                      color: 'blue',
                    });
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                >
                  <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-medium">
                      {isVi ? '+ Thêm Ghi chú (Add Note)' : '+ Add Canvas Note'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isVi ? 'Dán nhãn văn bản / VLAN lên sơ đồ' : 'Pin draggable text note on map'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenAddMenu(false);
                    setTool('add-node');
                    setNewNodeModalCoords({ x: 740, y: 370 });
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <div>
                    <div className="font-medium">
                      {isVi ? '+ Thêm Thiết bị (Add Node)' : '+ Add Device Node'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Router, Switch, Firewall, Server
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenAddMenu(false);
                    setTool('draw-link');
                    setLinkSourceId(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                >
                  <Cable className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-medium">
                      {isVi ? 'Nối dây cáp / Gộp LAG (1x, 2x, 4x)' : 'Draw Cable / LAG Bundle'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isVi ? 'Chọn thiết bị nguồn rồi chọn đích' : 'Click source then destination'}
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenAddMenu(false);
                    setTool('unlink');
                    setLinkSourceId(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isVi ? 'Chế độ Cắt dây mạng' : 'Cut Cable Mode'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Consolidated "Hiển thị & Bố cục ▾" (View & Layout ▾) Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenViewMenu((v) => !v);
                setOpenAddMenu(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isVi ? 'Hiển thị & Bố cục' : 'Display & Layout'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openViewMenu && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => setHighlightLagOnly((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      {isVi
                        ? `Làm nổi bật bó cáp LAG (${lagBundleTotal})`
                        : `Highlight LAG Bundles (${lagBundleTotal})`}
                    </span>
                  </span>
                  {highlightLagOnly && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAnimateFlow((f) => !f)}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-sky-500" />
                    <span>
                      {isVi ? 'Hiệu ứng Đường sáng 60FPS' : '60FPS Luminous Traffic Flow'}
                    </span>
                  </span>
                  {animateFlow && <Check className="w-3.5 h-3.5 text-sky-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTierGuides((s) => !s)}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {isVi ? 'Nhãn phân tầng (Kéo di chuyển)' : 'Draggable Tier Labels'}
                    </span>
                  </span>
                  {showTierGuides && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenViewMenu(false);
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    onAutoLayoutTopology();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isVi ? 'Tự động dàn đều các Node' : 'Auto-Align All Nodes'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Mode Instruction Banner */}
      {tool !== 'select' && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <span>
            {tool === 'draw-link' &&
              (linkSourceId
                ? isVi
                  ? `Đã chọn thiết bị nguồn (${devices.find((d) => d.id === linkSourceId)?.hostname}) — hãy nhấp vào thiết bị đích để nối cáp hoặc gộp LAG.`
                  : `Source selected (${devices.find((d) => d.id === linkSourceId)?.hostname}) — click destination node to connect cable or LAG.`
                : isVi
                ? 'Chế độ Nối dây / LAG: Nhấp vào thiết bị nguồn, sau đó nhấp vào thiết bị đích.'
                : 'Draw Cable Mode: Click the source device, then click the destination device.')}
            {tool === 'add-node' &&
              (isVi
                ? 'Chế độ Thêm Node: Nhấp vào bất kỳ vị trí nào trên sơ đồ để đặt thiết bị mới.'
                : 'Add Node Mode: Click anywhere on the map to place a new device.')}
            {tool === 'unlink' &&
              (isVi
                ? 'Chế độ Cắt dây: Nhấp vào nhãn băng thông trên dây cáp bất kỳ để xóa kết nối.'
                : 'Cut Cable Mode: Click any link badge to disconnect that cable.')}
          </span>
          <button
            type="button"
            onClick={() => {
              setTool('select');
              setLinkSourceId(null);
            }}
            className="font-medium underline ml-4 shrink-0"
          >
            {isVi ? 'Thoát chế độ' : 'Exit Mode'}
          </button>
        </div>
      )}

      {/* Interactive Topology Canvas Container */}
      <div
        className={
          canvasSizeMode === 'fullscreen'
            ? 'fixed inset-3 z-50 bg-white dark:bg-slate-950 border-2 border-blue-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden relative'
        }
      >
        {/* Top Status & Zoom/Size Control Bar */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/60 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center gap-3.5 text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Online</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span>Warning</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Offline</span>
            </span>
            <span className="flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-700 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-4 h-2 rounded-full border-2 border-emerald-400 bg-emerald-500/20 inline-block" />
              <span>{isVi ? 'Bó cáp LAG (2x / 4x LACP)' : 'LAG Bundle (2x / 4x LACP)'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <StickyNote className="w-3.5 h-3.5" />
              <span>
                {canvasNotes.length} {isVi ? 'Ghi chú' : 'Notes'}
              </span>
            </span>
          </div>

          {/* Right Zoom Slider & Canvas Size Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))))}
                className="p-0.5 text-slate-600 dark:text-slate-300 hover:text-blue-500"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0.55}
                max={2.0}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-20 accent-blue-600 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                className="p-0.5 text-slate-600 dark:text-slate-300 hover:text-blue-500"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200 w-10 text-right tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                100%
              </button>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setCanvasSizeMode('normal')}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  canvasSizeMode === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isVi ? 'Vừa' : 'Compact'}
              </button>
              <button
                type="button"
                onClick={() => setCanvasSizeMode('large')}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  canvasSizeMode === 'large'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isVi ? 'Rộng' : 'Large'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCanvasSizeMode((m) => (m === 'fullscreen' ? 'large' : 'fullscreen'))
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold ${
                  canvasSizeMode === 'fullscreen'
                    ? 'bg-emerald-600 text-white'
                    : 'text-blue-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {canvasSizeMode === 'fullscreen' ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>{isVi ? 'Thu nhỏ (ESC)' : 'Exit (ESC)'}</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span>{isVi ? 'Toàn màn hình' : 'Fullscreen'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main SVG Interactive Topology Workspace */}
        <div className="w-full flex-1 bg-slate-50/70 dark:bg-[#070d19] relative overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
            onWheel={handleSvgWheel}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerLeave={handleSvgPointerUp}
            onClick={handleSvgBackgroundClick}
            onContextMenu={handleCanvasContextMenu}
            className={`w-full ${canvasHeightClass} select-none ${
              tool === 'add-node'
                ? 'cursor-crosshair'
                : isPanning
                ? 'cursor-grabbing'
                : 'cursor-grab'
            }`}
          >
            <defs>
              <pattern
                id="topoGrid"
                width="36"
                height="36"
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

            <rect
              x={-3500}
              y={-2500}
              width={CANVAS_WIDTH + 7000}
              height={CANVAS_HEIGHT + 5000}
              fill="url(#topoGrid)"
            />

            {/* Optional Draggable Tier Guides */}
            {showTierGuides &&
              tierLabels.map((t) => (
                <g
                  key={t.id}
                  transform={`translate(${t.x}, ${t.y})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    beginDragSession(e, 'label', t.x, t.y, t.id);
                  }}
                  className="cursor-move"
                >
                  <rect
                    x={-6}
                    y={-14}
                    width={145}
                    height={22}
                    rx={4}
                    fill={isDark ? '#0f172a' : '#f1f5f9'}
                    stroke={isDark ? '#334155' : '#cbd5e1'}
                    strokeDasharray="3 2"
                  />
                  <text
                    x={4}
                    y={0}
                    fill={isDark ? '#94a3b8' : '#475569'}
                    fontSize={10.5}
                    fontWeight={600}
                    fontFamily="Public Sans, sans-serif"
                  >
                    ✥ {t.text}
                  </text>
                </g>
              ))}

            {/* Topology Cable Links (Single Links & Multi-Cable LAG/LACP Bundles + Silky-Smooth 60FPS CSS Light Stream) */}
            {topologyLinks.map((lnk) => {
              const dx = lnk.to.x - lnk.from.x;
              const dy = lnk.to.y - lnk.from.y;
              const len = Math.max(1, Math.hypot(dx, dy));
              const nx = -dy / len;
              const ny = dx / len;

              const midX = (lnk.from.x + lnk.to.x) / 2;
              const midY = (lnk.from.y + lnk.to.y) / 2;

              const strandOffsets =
                lnk.memberCount === 4
                  ? [-10.5, -3.5, 3.5, 10.5]
                  : lnk.memberCount === 2
                  ? [-5.5, 5.5]
                  : [0];

              const dimmedByFilter = highlightLagOnly && !lnk.isLag;

              const baseStroke = lnk.isUp
                ? lnk.isLag
                  ? isDark
                    ? '#059669'
                    : '#10b981'
                  : isDark
                  ? '#1d4ed8'
                  : '#3b82f6'
                : '#dc2626';

              const haloColor = lnk.isLag ? '#10b981' : '#0ea5e9';
              const coreLightColor = lnk.isLag ? '#a7f3d0' : '#bae6fd';

              const badgeText =
                tool === 'unlink'
                  ? isVi
                    ? '✂ CẮT DÂY'
                    : '✂ CUT CABLE'
                  : lnk.isUp
                  ? lnk.isLag
                    ? `LAG ${strandOffsets.length}x (LACP) · ${lnk.bandwidthMbps}M`
                    : `${lnk.bandwidthMbps} Mbps`
                  : 'LINK DOWN';
              const badgeWidth = lnk.isLag ? 148 : 88;
              const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

              return (
                <g
                  key={lnk.key}
                  opacity={dimmedByFilter ? 0.18 : 1}
                  onContextMenu={(e) => handleLinkContextMenu(e, lnk)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'unlink') {
                      onRemoveTopologyLink(lnk.sourceId, lnk.targetId);
                    } else {
                      handleLinkContextMenu(e, lnk);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {/* Wide hit target */}
                  <line
                    x1={lnk.from.x}
                    y1={lnk.from.y}
                    x2={lnk.to.x}
                    y2={lnk.to.y}
                    stroke="transparent"
                    strokeWidth={24}
                  />

                  {/* Render each physical cable strand */}
                  {strandOffsets.map((offset, sIdx) => {
                    const x1 = lnk.from.x + nx * offset;
                    const y1 = lnk.from.y + ny * offset;
                    const x2 = lnk.to.x + nx * offset;
                    const y2 = lnk.to.y + ny * offset;
                    const delayClass = `topo-strand-delay-${sIdx % 4}`;
                    const streamClass = lnk.isLag
                      ? `topo-light-stream-lag ${delayClass}`
                      : `topo-light-stream ${delayClass}`;

                    return (
                      <g key={`${lnk.key}-strand-${sIdx}`}>
                        {/* Structural Cable Line */}
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={baseStroke}
                          strokeWidth={lnk.isLag ? 2.2 : 1.9}
                          strokeDasharray={lnk.isUp ? undefined : '6 4'}
                          opacity={lnk.isUp ? 0.65 : 0.9}
                        />

                        {/* 60FPS GPU-Composited Dual-Layer Luminous Stream (Zero Stutter, Zero Filter Lag) */}
                        {lnk.isUp && animateFlow && (
                          <>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={haloColor}
                              strokeWidth={6}
                              strokeLinecap="round"
                              opacity={0.28}
                              className={streamClass}
                            />
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={coreLightColor}
                              strokeWidth={2.4}
                              strokeLinecap="round"
                              opacity={0.95}
                              className={streamClass}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Dual LACP / LAG Ring Collars */}
                  {lnk.isLag && (
                    <>
                      <ellipse
                        cx={midX - (dx / len) * (badgeWidth / 2 + 14)}
                        cy={midY - (dy / len) * (badgeWidth / 2 + 14)}
                        rx={6}
                        ry={lnk.memberCount === 4 ? 15 : 11}
                        transform={`rotate(${angleDeg} ${
                          midX - (dx / len) * (badgeWidth / 2 + 14)
                        } ${midY - (dy / len) * (badgeWidth / 2 + 14)})`}
                        fill={isDark ? '#064e3b' : '#d1fae5'}
                        fillOpacity={0.55}
                        stroke={lnk.isUp ? '#10b981' : '#dc2626'}
                        strokeWidth={2}
                      />
                      <ellipse
                        cx={midX + (dx / len) * (badgeWidth / 2 + 14)}
                        cy={midY + (dy / len) * (badgeWidth / 2 + 14)}
                        rx={6}
                        ry={lnk.memberCount === 4 ? 15 : 11}
                        transform={`rotate(${angleDeg} ${
                          midX + (dx / len) * (badgeWidth / 2 + 14)
                        } ${midY + (dy / len) * (badgeWidth / 2 + 14)})`}
                        fill={isDark ? '#064e3b' : '#d1fae5'}
                        fillOpacity={0.55}
                        stroke={lnk.isUp ? '#10b981' : '#dc2626'}
                        strokeWidth={2}
                      />
                    </>
                  )}

                  {/* Link Telemetry & LAG Badge */}
                  <rect
                    x={midX - badgeWidth / 2}
                    y={midY - 11}
                    width={badgeWidth}
                    height={22}
                    rx={5}
                    fill={
                      tool === 'unlink'
                        ? '#dc2626'
                        : lnk.isLag
                        ? isDark
                          ? '#064e3b'
                          : '#ecfdf5'
                        : isDark
                        ? '#0f172a'
                        : '#ffffff'
                    }
                    stroke={
                      tool === 'unlink'
                        ? '#dc2626'
                        : lnk.isUp
                        ? lnk.isLag
                          ? '#10b981'
                          : isDark
                          ? '#334155'
                          : '#cbd5e1'
                        : '#dc2626'
                    }
                    strokeWidth={lnk.isLag ? 1.5 : 1}
                  />
                  <text
                    x={midX}
                    y={midY + 3.5}
                    textAnchor="middle"
                    fill={
                      tool === 'unlink'
                        ? '#ffffff'
                        : lnk.isUp
                        ? lnk.isLag
                          ? isDark
                            ? '#6ee7b7'
                            : '#047857'
                          : isDark
                          ? '#e2e8f0'
                          : '#1e293b'
                        : '#dc2626'
                    }
                    fontSize={9.5}
                    fontWeight={lnk.isLag ? 700 : 500}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {badgeText}
                  </text>
                </g>
              );
            })}

            {/* Draggable Canvas Notes / Annotations (60FPS Delta Drag) */}
            {canvasNotes.map((note) => {
              const effX =
                liveNoteDrag && liveNoteDrag.id === note.id ? liveNoteDrag.x : note.x;
              const effY =
                liveNoteDrag && liveNoteDrag.id === note.id ? liveNoteDrag.y : note.y;
              const c = getNoteColors(note.color);
              const noteWidth = Math.max(
                176,
                Math.min(280, Math.max(note.title.length * 7.5, note.body.length * 6.2) + 26)
              );
              return (
                <g
                  key={note.id}
                  transform={`translate(${effX - noteWidth / 2}, ${effY - 24})`}
                  onPointerDown={(e) => {
                    if (e.button === 2) return;
                    e.stopPropagation();
                    setContextMenu(null);
                    beginDragSession(e, 'note', effX, effY, note.id);
                  }}
                  onContextMenu={(e) => handleNoteContextMenu(e, note)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <rect
                    width={noteWidth}
                    height={46}
                    rx={7}
                    fill={c.bg}
                    stroke={c.border}
                    strokeWidth={1.4}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={10}
                    y={17}
                    fill={c.title}
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="Public Sans, sans-serif"
                  >
                    📌 {note.title.slice(0, 32)}
                  </text>
                  <text
                    x={10}
                    y={33}
                    fill={c.body}
                    fontSize={9.2}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {note.body.slice(0, 38)}
                  </text>
                </g>
              );
            })}

            {/* Draggable Real-Time Device Nodes (60FPS Delta Drag) */}
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

              const attachedNote = nodeNotes[device.id];

              return (
                <g
                  key={device.id}
                  transform={`translate(${x - 84}, ${y - 31})`}
                  onPointerDown={(e) => {
                    if (e.button === 2) return;
                    if (tool === 'select') {
                      e.stopPropagation();
                      setContextMenu(null);
                      setFocusedNodeId(device.id);
                      beginDragSession(e, 'node', x, y, device.id);
                    }
                  }}
                  onClick={(e) => handleNodeClick(e, device)}
                  onContextMenu={(e) => handleNodeContextMenu(e, device)}
                  className={
                    tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  }
                >
                  {(isFocused || isLinkSource) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={176}
                      height={70}
                      rx={11}
                      fill="none"
                      stroke={isLinkSource ? '#10b981' : '#3b82f6'}
                      strokeWidth={1.8}
                      strokeDasharray={isLinkSource ? '4 2' : undefined}
                    />
                  )}
                  <rect
                    width={168}
                    height={62}
                    rx={8}
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke={strokeColor}
                    strokeWidth={2}
                  />
                  <circle cx={13} cy={16} r={4} fill={strokeColor} />
                  <text
                    x={23}
                    y={19.5}
                    fill={isDark ? '#f8fafc' : '#0f172a'}
                    fontSize={11}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {device.hostname.split('.')[0].slice(0, 16)}
                  </text>
                  <text
                    x={154}
                    y={18}
                    fill={isDark ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    ⋮
                  </text>
                  <text
                    x={11}
                    y={35.5}
                    fill={isDark ? '#94a3b8' : '#64748b'}
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {device.ip} · {device.vendor.split(' ')[0]}
                  </text>
                  <text
                    x={11}
                    y={50.5}
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

                  {/* Per-Node Sticky Note Badge */}
                  {attachedNote && (
                    <g transform="translate(4, 66)">
                      <rect
                        width={160}
                        height={19}
                        rx={4}
                        fill={isDark ? '#1e293b' : '#fef3c7'}
                        stroke={isDark ? '#f59e0b' : '#fbbf24'}
                        strokeWidth={1}
                      />
                      <text
                        x={8}
                        y={13}
                        fill={isDark ? '#fde68a' : '#92400e'}
                        fontSize={8.8}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        📝 {attachedNote.slice(0, 22)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              left: Math.min(window.innerWidth - 300, Math.max(12, contextMenu.clientX)),
              top: Math.min(window.innerHeight - 380, Math.max(12, contextMenu.clientY)),
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed w-72 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl overflow-hidden text-xs"
          >
            {contextMenu.type === 'node' && (
              <>
                <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          contextMenu.device.status === DeviceStatus.Online
                            ? 'bg-emerald-500'
                            : contextMenu.device.status === DeviceStatus.Warning
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span>{contextMenu.device.hostname.split('.')[0]}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {contextMenu.device.ip} · {contextMenu.device.vendor}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenVisualConfig(contextMenu.device.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-600/20 hover:text-sky-300 text-left transition-colors"
                  >
                    <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-medium">
                        {isVi ? 'Console & Cấu hình Trực quan' : 'Console & Visual Config'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        VLAN, Firewall, Routing & CLI {contextMenu.device.vendor}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNoteModal({
                        mode: 'node-note',
                        svgX: 0,
                        svgY: 0,
                        deviceId: contextMenu.device.id,
                        deviceHostname: contextMenu.device.hostname.split('.')[0],
                        title: contextMenu.device.hostname.split('.')[0],
                        body: nodeNotes[contextMenu.device.id] || '',
                        color: 'amber',
                      });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-500/20 text-left transition-colors"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-medium text-amber-300">
                        {isVi
                          ? 'Thêm / Sửa Ghi chú Node (Add Note)'
                          : 'Add / Edit Node Note'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isVi
                          ? 'Gắn nhãn ghi chú bên dưới thiết bị này'
                          : 'Attach sticky note under this device'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenPortMonitor();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-medium">
                        {isVi ? 'Giám sát Cổng & Dịch vụ' : 'Monitor Ports & Services'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isVi ? 'Bật/tắt port PoE, xem lưu lượng' : 'Toggle PoE ports & live traffic'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTool('draw-link');
                      setLinkSourceId(contextMenu.device.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                  >
                    <Cable className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-medium">
                        {isVi ? 'Nối dây cáp / Gộp LAG từ Node này' : 'Connect Cable / LAG from Here'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isVi ? 'Đấu cáp đơn hoặc LACP 2x / 4x' : 'Single link or LACP 2x / 4x'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectDevice(contextMenu.device);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-medium">
                        {isVi ? 'Chi tiết Phần cứng & Config' : 'Hardware & Config Inspector'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isVi ? 'Đối chiếu Golden Baseline' : 'Compare Golden Baseline'}
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      onToggleDeviceStatus(contextMenu.device.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-500/20 text-left transition-colors"
                  >
                    <Power
                      className={`w-3.5 h-3.5 shrink-0 ${
                        contextMenu.device.status === DeviceStatus.Offline
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    />
                    <span className="font-medium">
                      {contextMenu.device.status === DeviceStatus.Offline
                        ? isVi
                          ? 'Khởi động lại Node (Start Node)'
                          : 'Start / Recover Node Online'
                        : isVi
                        ? 'Tắt nguồn / Giả lập Offline (Stop Node)'
                        : 'Stop Node / Simulate Offline'}
                    </span>
                  </button>
                </div>
              </>
            )}

            {contextMenu.type === 'link' && (
              <>
                <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-emerald-400">
                      {contextMenu.sourceDevice.hostname.split('.')[0]} ↔{' '}
                      {contextMenu.targetDevice.hostname.split('.')[0]}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {contextMenu.sourcePort} ↔ {contextMenu.targetPort} ({contextMenu.bandwidthMbps}{' '}
                      Mbps)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {isVi
                      ? 'Chuyển đổi Gộp dây LAG / LACP (Port-Channel)'
                      : 'Configure LAG / LACP Bundle Mode'}
                  </div>
                  {([1, 2, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSetLinkLagMode(contextMenu.linkKey, cnt)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                        contextMenu.currentMembers === cnt
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                          : 'hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span>
                        {cnt === 1 &&
                          (isVi ? '1x — Dây cáp đơn (Single Link)' : '1x — Single Physical Cable')}
                        {cnt === 2 &&
                          (isVi
                            ? '2x — Gộp 2 dây song song (LAG 2x LACP)'
                            : '2x — Dual-Strand LAG (LACP 2x)')}
                        {cnt === 4 &&
                          (isVi
                            ? '4x — Gộp 4 dây song song (LAG 4x Trunk)'
                            : '4x — Quad-Strand LAG (LACP 4x)')}
                      </span>
                      {contextMenu.currentMembers === cnt && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      onRemoveTopologyLink(
                        contextMenu.sourceDevice.id,
                        contextMenu.targetDevice.id
                      );
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/20 text-left font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isVi ? 'Cắt / Xóa đường dây cáp này' : 'Delete / Cut This Cable'}
                    </span>
                  </button>
                </div>
              </>
            )}

            {contextMenu.type === 'note' && (
              <>
                <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-amber-400 truncate">
                    📌 {contextMenu.note.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteModal({
                        mode: 'canvas-edit',
                        svgX: contextMenu.note.x,
                        svgY: contextMenu.note.y,
                        noteId: contextMenu.note.id,
                        title: contextMenu.note.title,
                        body: contextMenu.note.body,
                        color: contextMenu.note.color,
                      });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-left"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isVi ? 'Chỉnh sửa nội dung & màu sắc' : 'Edit Note Text & Color'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCanvasNotes((prev) =>
                        prev.filter((item) => item.id !== contextMenu.note.id)
                      );
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Xóa ghi chú này' : 'Delete Note'}</span>
                  </button>
                </div>
              </>
            )}

            {contextMenu.type === 'canvas' && (
              <>
                <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    {isVi ? 'Bản đồ Topology' : 'Topology Canvas'} ({contextMenu.svgX},{' '}
                    {contextMenu.svgY})
                  </span>
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteModal({
                        mode: 'canvas-add',
                        svgX: contextMenu.svgX,
                        svgY: contextMenu.svgY,
                        title: isVi ? 'Ghi chú Mạng / VLAN' : 'Network / VLAN Note',
                        body: 'VLAN 100 · LACP Trunk 2x25G',
                        color: 'amber',
                      });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-500/20 text-amber-300 font-medium text-left"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    <span>
                      {isVi
                        ? '+ Thêm Ghi chú tại đây (Add Note)'
                        : '+ Add Canvas Note Here'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewNodeModalCoords({ x: contextMenu.svgX, y: contextMenu.svgY });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-600/20 text-sky-300 font-medium text-left"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {isVi
                        ? '+ Thêm Thiết bị mới (Add Node)'
                        : '+ Add Device Node Here'}
                    </span>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      onAutoLayoutTopology();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isVi ? 'Tự động dàn đều các Node' : 'Auto-Align All Nodes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isVi ? 'Đặt lại Khung nhìn 100%' : 'Reset Zoom & Pan (100%)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCanvasSizeMode((m) => (m === 'fullscreen' ? 'large' : 'fullscreen'));
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-left"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {isVi ? 'Bật / Tắt Toàn màn hình' : 'Toggle Fullscreen Mode'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Accordion Drawer for SNMP Traps & CIS Security Audit */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBottomPanels((v) => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isVi
                ? 'Cảnh báo SNMP Thời gian thực & Kiểm toán Bảo mật CIS'
                : 'Active SNMP Traps & Multi-Vendor CIS Security Audit'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {alerts.filter((a) => !a.acknowledged).length}{' '}
              {isVi ? 'Cảnh báo mở' : 'Open Alerts'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {complianceList.length} {isVi ? 'Vi phạm CIS' : 'CIS Findings'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{showBottomPanels ? (isVi ? 'Thu gọn' : 'Collapse') : isVi ? 'Mở rộng' : 'Expand'}</span>
            {showBottomPanels ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showBottomPanels && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {isVi ? 'Danh sách Cảnh báo SNMP & Sự cố' : 'Active SNMP Traps & Incidents'}
                </h3>

                <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAlertFilter('UNACK')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md ${
                      alertFilter === 'UNACK'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {isVi ? 'Chưa xử lý' : 'Open'} ({alerts.filter((a) => !a.acknowledged).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertFilter('ALL')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md ${
                      alertFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {isVi ? 'Tất cả' : 'All'} ({alerts.length})
                  </button>
                </div>
              </div>

              {visibleAlerts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                  <p>{isVi ? 'Không có cảnh báo mở' : 'All active alerts acknowledged'}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {visibleAlerts.map((alt) => {
                    const targetDev = devices.find((d) => d.id === alt.deviceId);
                    return (
                      <div key={alt.id} className="p-3.5 text-xs space-y-1.5">
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
                          </span>
                          <span className="font-mono text-slate-400">{alt.timestamp}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{alt.message}</p>
                        <div className="pt-1 flex items-center justify-between">
                          <span className="font-mono text-slate-400">
                            {alt.ip} · {alt.vendor}
                          </span>
                          <div className="flex items-center gap-2">
                            {targetDev && targetDev.status === DeviceStatus.Offline && (
                              <button
                                type="button"
                                onClick={() => onToggleDeviceStatus(targetDev.id)}
                                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                              >
                                <Power className="w-3 h-3" />
                                <span>{isVi ? 'Khôi phục' : 'Recover'}</span>
                              </button>
                            )}
                            {!alt.acknowledged && (
                              <button
                                type="button"
                                onClick={() => onAcknowledgeAlert(alt.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                <Check className="w-3 h-3" />
                                <span>{isVi ? 'Đã xem' : 'Ack'}</span>
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

            <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {isVi ? 'Kiểm toán Cấu hình Bảo mật CIS' : 'CIS Security & Hardening Audit'}
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  {complianceList.length} {isVi ? 'phát hiện' : 'findings'}
                </span>
              </div>

              {complianceList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                  <p>{isVi ? 'Đạt chuẩn 100% CIS Benchmark' : '100% CIS Benchmark Compliant'}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {complianceList.map(({ device, finding }) => (
                    <div key={`${device.id}-${finding.id}`} className="p-3.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                          <ShieldAlert
                            className={`w-3.5 h-3.5 ${
                              finding.severity === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          />
                          <span>{finding.title}</span>
                        </span>
                        <span className="font-mono text-slate-400">{device.vendor}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{finding.description}</p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="font-mono text-slate-500">
                          {device.hostname} ({device.ip})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRemediateCompliance(device.id, finding.remediationTemplate)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>{isVi ? 'Tạo lệnh Vá lỗi' : 'Generate Fix CLI'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Note Modal (EVE-NG Canvas Note or Node Sticky Note) */}
      {noteModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {noteModal.mode === 'node-note'
                    ? isVi
                      ? `Ghi chú trên Node: ${noteModal.deviceHostname}`
                      : `Node Sticky Note: ${noteModal.deviceHostname}`
                    : noteModal.mode === 'canvas-edit'
                    ? isVi
                      ? 'Chỉnh sửa Ghi chú Sơ đồ'
                      : 'Edit Canvas Note'
                    : isVi
                    ? 'Thêm Ghi chú mới lên Sơ đồ (Add Note)'
                    : 'Add New Canvas Note'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNoteModal} className="p-5 space-y-3.5 text-xs">
              {noteModal.mode !== 'node-note' && (
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Tiêu đề Ghi chú (VD: Cụm VLAN / Đường truyền ISP)' : 'Note Title'}
                  </label>
                  <input
                    type="text"
                    required
                    value={noteModal.title}
                    onChange={(e) => setNoteModal({ ...noteModal, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-500 mb-1">
                  {isVi
                    ? 'Nội dung ghi chú (Để trống nếu muốn xóa ghi chú trên Node)'
                    : 'Note Content (Leave blank to clear node note)'}
                </label>
                <input
                  type="text"
                  value={noteModal.body}
                  onChange={(e) => setNoteModal({ ...noteModal, body: e.target.value })}
                  placeholder={
                    isVi
                      ? 'VD: VLAN 100 · LACP 2x25G · Đang bảo trì'
                      : 'e.g. VLAN 100 · LACP 2x25G · Maintenance'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              {noteModal.mode !== 'node-note' && (
                <div>
                  <label className="block text-slate-500 mb-1.5">
                    {isVi ? 'Màu sắc nhãn ghi chú' : 'Note Color Theme'}
                  </label>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        { id: 'blue', label: isVi ? 'Xanh dương' : 'Blue', cls: 'bg-sky-500' },
                        { id: 'emerald', label: isVi ? 'Xanh lá' : 'Green', cls: 'bg-emerald-500' },
                        { id: 'amber', label: isVi ? 'Vàng cam' : 'Amber', cls: 'bg-amber-500' },
                        { id: 'rose', label: isVi ? 'Đỏ hồng' : 'Rose', cls: 'bg-rose-500' },
                        { id: 'slate', label: isVi ? 'Xám' : 'Slate', cls: 'bg-slate-500' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNoteModal({ ...noteModal, color: c.id })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                          noteModal.color === c.id
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-sky-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${c.cls}`} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isVi ? 'Lưu Ghi chú' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Topology Node Modal */}
      {newNodeModalCoords && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          onClick={() => setNewNodeModalCoords(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Thêm Thiết bị vào Sơ đồ Topology' : 'Add Device Node to Topology'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ({newNodeModalCoords.x}, {newNodeModalCoords.y})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewNodeModalCoords(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewNode} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Hostname</label>
                  <input
                    type="text"
                    required
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">IPv4 Management</label>
                  <input
                    type="text"
                    required
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Vendor OS</label>
                  <select
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value as VendorName)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {VENDORS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Vai trò (Role)' : 'Device Role'}
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as DeviceRole)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {Object.values(DeviceRole).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Hardware Model</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Số lượng cổng' : 'Port Count'}
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={48}
                    value={newPortCount}
                    onChange={(e) => setNewPortCount(Number(e.target.value) || 8)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewNodeModalCoords(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isVi ? 'Đặt Node lên Sơ đồ' : 'Place Node on Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Physical Port Cable / LAG Modal */}
      {pendingLinkPair && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          onClick={() => setPendingLinkPair(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isVi
                    ? 'Kết nối Cáp mạng / Gộp dây LAG (LACP)'
                    : 'Connect Cable / LAG Port-Channel'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {pendingLinkPair.source.hostname.split('.')[0]} ↔{' '}
                  {pendingLinkPair.target.hostname.split('.')[0]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingLinkPair(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewLink} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Cổng Nguồn' : 'Source Port'} (
                    {pendingLinkPair.source.hostname.split('.')[0]})
                  </label>
                  <input
                    type="text"
                    required
                    value={linkSrcPort}
                    onChange={(e) => setLinkSrcPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Cổng Đích' : 'Target Port'} (
                    {pendingLinkPair.target.hostname.split('.')[0]})
                  </label>
                  <input
                    type="text"
                    required
                    value={linkDstPort}
                    onChange={(e) => setLinkDstPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Tốc độ mỗi dây' : 'Link Speed'}
                  </label>
                  <select
                    value={linkSpeedMbps}
                    onChange={(e) => setLinkSpeedMbps(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  >
                    <option value={1000}>1 Gbps</option>
                    <option value={10000}>10 Gbps</option>
                    <option value={25000}>25 Gbps</option>
                    <option value={40000}>40 Gbps</option>
                    <option value={100000}>100 Gbps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Số dây gộp (LAG)' : 'LAG Members'}
                  </label>
                  <select
                    value={linkBundleCount}
                    onChange={(e) => {
                      const cnt = Number(e.target.value) as 1 | 2 | 4;
                      setLinkBundleCount(cnt);
                      if (cnt >= 2) setLinkProtocol('LACP');
                    }}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  >
                    <option value={1}>{isVi ? '1x (Dây đơn)' : '1x (Single)'}</option>
                    <option value={2}>2x LAG (LACP)</option>
                    <option value={4}>4x LAG (LACP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isVi ? 'Giao thức' : 'Protocol'}
                  </label>
                  <select
                    value={linkProtocol}
                    onChange={(e) =>
                      setLinkProtocol(e.target.value as 'LLDP' | 'CDP' | 'LACP' | 'STATIC')
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  >
                    <option value="LACP">LACP</option>
                    <option value="LLDP">LLDP</option>
                    <option value="CDP">CDP</option>
                    <option value="STATIC">STATIC</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingLinkPair(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isVi ? 'Đấu nối Cáp / LAG' : 'Connect Cable / LAG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
