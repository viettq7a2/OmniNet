import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Pause,
  Play,
  Power,
  Radar,
  Search,
  SlidersHorizontal,
  Terminal,
  XCircle,
} from 'lucide-react';
import {
  DeviceRole,
  DeviceStatus,
  NetworkDevice,
  TrafficTelemetryPoint,
} from '../types/network';
import { auditDeviceCompliance } from '../utils/vendorConfigCompiler';

interface SummaryDashboardProps {
  devices: NetworkDevice[];
  trafficSeries: TrafficTelemetryPoint[];
  isStreaming: boolean;
  onToggleStream: () => void;
  isDark: boolean;
  onSelectDevice: (device: NetworkDevice) => void;
  onToggleDeviceStatus: (deviceId: string) => void;
  onNavigateToDiscovery: () => void;
  onOpenConfigForDevice: (deviceId: string) => void;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
  unit?: string;
}

const CustomChartTooltip: React.FC<CustomChartTooltipProps> = ({
  active,
  payload,
  label,
  unit = 'Mbps',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs">
      {label && (
        <div className="font-mono font-medium text-slate-600 dark:text-slate-300 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800 tabular-nums">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || '#2563eb' }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  devices,
  trafficSeries,
  isStreaming,
  onToggleStream,
  isDark,
  onSelectDevice,
  onToggleDeviceStatus,
  onNavigateToDiscovery,
  onOpenConfigForDevice,
}) => {
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [nodeSearch, setNodeSearch] = useState<string>('');
  const [windowPoints, setWindowPoints] = useState<12 | 24>(24);

  const sites = useMemo(() => {
    return Array.from(new Set(devices.map((d) => d.site)));
  }, [devices]);

  const scopedDevices = useMemo(() => {
    if (selectedSite === 'ALL') return devices;
    return devices.filter((d) => d.site === selectedSite);
  }, [devices, selectedSite]);

  const counts = useMemo(() => {
    const online = scopedDevices.filter((d) => d.status === DeviceStatus.Online).length;
    const warning = scopedDevices.filter((d) => d.status === DeviceStatus.Warning).length;
    const offline = scopedDevices.filter((d) => d.status === DeviceStatus.Offline).length;
    const total = scopedDevices.length;
    const availabilityPct = total > 0 ? (((online + warning) / total) * 100).toFixed(1) : '0.0';

    const totalInbound = scopedDevices
      .filter((d) => d.status !== DeviceStatus.Offline)
      .reduce((acc, d) => acc + d.inboundMbps, 0);
    const totalOutbound = scopedDevices
      .filter((d) => d.status !== DeviceStatus.Offline)
      .reduce((acc, d) => acc + d.outboundMbps, 0);

    const activeDevices = scopedDevices.filter((d) => d.status !== DeviceStatus.Offline);
    const avgLatency =
      activeDevices.length > 0
        ? activeDevices.reduce((acc, d) => acc + d.latencyMs, 0) / activeDevices.length
        : 0;

    let complianceIssuesCount = 0;
    let driftNodesCount = 0;
    scopedDevices.forEach((d) => {
      complianceIssuesCount += auditDeviceCompliance(d).length;
      if (d.runningConfig.trim() !== d.goldenBaselineConfig.trim()) {
        driftNodesCount += 1;
      }
    });

    return {
      online,
      warning,
      offline,
      total,
      availabilityPct,
      totalInbound,
      totalOutbound,
      combinedGbps: ((totalInbound + totalOutbound) / 1000).toFixed(2),
      avgLatency: avgLatency.toFixed(1),
      complianceIssuesCount,
      driftNodesCount,
    };
  }, [scopedDevices]);

  // Scale traffic series proportionally if filtered to a specific site
  const siteRatio = useMemo(() => {
    if (selectedSite === 'ALL') return 1;
    const allIn = devices
      .filter((d) => d.status !== DeviceStatus.Offline)
      .reduce((s, d) => s + d.inboundMbps, 0);
    if (allIn <= 0) return 0;
    return counts.totalInbound / allIn;
  }, [devices, selectedSite, counts.totalInbound]);

  const visibleTrafficData = useMemo(() => {
    const sliced = trafficSeries.slice(-windowPoints);
    if (selectedSite === 'ALL') return sliced;
    return sliced.map((pt) => ({
      ...pt,
      inboundMbps: Number((pt.inboundMbps * siteRatio).toFixed(1)),
      outboundMbps: Number((pt.outboundMbps * siteRatio).toFixed(1)),
      inspectedMbps: Number((pt.inspectedMbps * siteRatio).toFixed(1)),
    }));
  }, [trafficSeries, windowPoints, selectedSite, siteRatio]);

  const statusPieData = useMemo(
    () => [
      {
        name: 'Online',
        status: DeviceStatus.Online,
        value: counts.online,
        color: '#16A34A',
      },
      {
        name: 'Warning',
        status: DeviceStatus.Warning,
        value: counts.warning,
        color: '#D97706',
      },
      {
        name: 'Offline',
        status: DeviceStatus.Offline,
        value: counts.offline,
        color: '#DC2626',
      },
    ],
    [counts.online, counts.warning, counts.offline]
  );

  const perNodeThroughputData = useMemo(() => {
    return [...scopedDevices]
      .sort((a, b) => b.inboundMbps + b.outboundMbps - (a.inboundMbps + a.outboundMbps))
      .slice(0, 8)
      .map((d) => ({
        shortName: d.hostname.split('.')[0],
        hostname: d.hostname,
        inbound: Number(d.inboundMbps.toFixed(1)),
        outbound: Number(d.outboundMbps.toFixed(1)),
        status: d.status,
      }));
  }, [scopedDevices]);

  const filteredTableNodes = useMemo(() => {
    return scopedDevices.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (!nodeSearch.trim()) return true;
      const q = nodeSearch.toLowerCase();
      return (
        d.hostname.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.vendor.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.role.toLowerCase().includes(q)
      );
    });
  }, [scopedDevices, statusFilter, nodeSearch]);

  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      {/* Scope & Live Telemetry Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Network Summary & Real-Time Telemetry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live bandwidth utilization and availability state across {counts.total} discovered enterprise nodes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site Segmented Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedSite('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedSite === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All Sites
            </button>
            {sites.map((site) => (
              <button
                key={site}
                type="button"
                onClick={() => setSelectedSite(site)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedSite === site
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {site}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleStream}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Pause Live Feed (2s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Resume Live Feed</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Column KPI Summary Strip (Single-Elevation Bordered Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Discovered Nodes Availability
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.availabilityPct}%
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {counts.online + counts.warning} / {counts.total} reachable
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {counts.online} Online
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {counts.warning} Warning
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-700 dark:text-rose-400 font-medium">
              {counts.offline} Offline
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Aggregate Real-Time Throughput
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.combinedGbps} Gbps
            </span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              {(counts.totalInbound + counts.totalOutbound).toFixed(0)} Mbps
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Rx {counts.totalInbound.toFixed(0)} Mbps</span>
            <span aria-hidden="true">·</span>
            <span>Tx {counts.totalOutbound.toFixed(0)} Mbps</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Mean Network RTT Latency
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.avgLatency} ms
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              ICMP / SNMPv3
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Multi-vendor polling</span>
            <span aria-hidden="true">·</span>
            <span>2s telemetry interval</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Config Drift & CIS Compliance
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.driftNodesCount === 0 ? '100% Synced' : `${counts.driftNodesCount} Drift`}
            </span>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {counts.complianceIssuesCount} findings
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>{ new Set(scopedDevices.map((d) => d.vendor)).size } Vendors</span>
            <span aria-hidden="true">·</span>
            <span>Running vs Baseline</span>
          </div>
        </div>
      </div>

      {/* Primary Recharts Visualization Row: Real-Time Network Traffic (AreaChart) + Node Status (PieChart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Real-Time Network Traffic AreaChart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Real-Time Network Traffic Throughput
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Inbound Rx</span>
                <span aria-hidden="true">·</span>
                <span>Outbound Tx</span>
                <span aria-hidden="true">·</span>
                <span>Firewall Inspected Stream (Mbps)</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                  <span>Inbound Rx</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block" />
                  <span>Outbound Tx</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                  <span>FW Inspected</span>
                </span>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                <button
                  type="button"
                  onClick={() => setWindowPoints(12)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                    windowPoints === 12
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  24s
                </button>
                <button
                  type="button"
                  onClick={() => setWindowPoints(24)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                    windowPoints === 24
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  48s
                </button>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart
                data={visibleTrafficData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip content={<CustomChartTooltip unit="Mbps" />} />
                <Area
                  type="monotone"
                  dataKey="inboundMbps"
                  name="Inbound Rx"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradInbound)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="outboundMbps"
                  name="Outbound Tx"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradOutbound)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="inspectedMbps"
                  name="FW Inspected"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Discovered Node Status Breakdown (PieChart Donut) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Discovered Node Status
              </h2>
              <button
                type="button"
                onClick={onNavigateToDiscovery}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Scan Subnet</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any segment below to filter node matrix
            </p>
          </div>

          <div className="relative h-52 w-full my-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  onClick={(_, index) => {
                    const clicked = statusPieData[index];
                    if (clicked) {
                      setStatusFilter((prev) =>
                        prev === clicked.status ? 'ALL' : clicked.status
                      );
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  {statusPieData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomChartTooltip unit="nodes" />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Metric Label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display tabular-nums">
                {counts.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Total Nodes
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === DeviceStatus.Online ? 'ALL' : DeviceStatus.Online
                )
              }
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                statusFilter === DeviceStatus.Online
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Online (Nominal)</span>
              </span>
              <span className="font-mono tabular-nums">
                {counts.online} ({counts.total ? Math.round((counts.online / counts.total) * 100) : 0}%)
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === DeviceStatus.Warning ? 'ALL' : DeviceStatus.Warning
                )
              }
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                statusFilter === DeviceStatus.Warning
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Warning / Degraded</span>
              </span>
              <span className="font-mono tabular-nums">
                {counts.warning} ({counts.total ? Math.round((counts.warning / counts.total) * 100) : 0}%)
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === DeviceStatus.Offline ? 'ALL' : DeviceStatus.Offline
                )
              }
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                statusFilter === DeviceStatus.Offline
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Offline / Unreachable</span>
              </span>
              <span className="font-mono tabular-nums">
                {counts.offline} ({counts.total ? Math.round((counts.offline / counts.total) * 100) : 0}%)
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Recharts Row: Per-Node Throughput BarChart + Role & Vendor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Throughput by Discovered Node (Top Active & Offline)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time Inbound Rx vs Outbound Tx bandwidth per node in Mbps
              </p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={perNodeThroughputData}
                margin={{ top: 6, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<CustomChartTooltip unit="Mbps" />} />
                <Bar dataKey="inbound" name="Inbound Rx" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="outbound" name="Outbound Tx" fill="#14b8a6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Hardware Roles & Multi-Vendor Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Breakdown of discovered routers, switches, firewalls, wireless, and servers
            </p>
          </div>

          <div className="my-4 divide-y divide-slate-200 dark:divide-slate-800">
            {Object.values(DeviceRole).map((role) => {
              const roleNodes = scopedDevices.filter((d) => d.role === role);
              const onlineRoleNodes = roleNodes.filter((d) => d.status === DeviceStatus.Online).length;
              const offlineRoleNodes = roleNodes.filter((d) => d.status === DeviceStatus.Offline).length;
              const pct = counts.total > 0 ? Math.round((roleNodes.length / counts.total) * 100) : 0;

              return (
                <div key={role} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{role}s</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {roleNodes.length} total · {onlineRoleNodes} up
                      {offlineRoleNodes > 0 ? ` · ${offlineRoleNodes} down` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-transform duration-200 origin-left"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Vendors</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[260px]">
              Cisco · Fortinet · Palo Alto · Juniper · MikroTik · Aruba · Linux
            </span>
          </div>
        </div>
      </div>

      {/* All Discovered Nodes Live Status Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Discovered Nodes Live Status Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect telemetry, open multi-vendor CLI studio, or simulate node failover/recovery to observe live chart response
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['ALL', DeviceStatus.Online, DeviceStatus.Warning, DeviceStatus.Offline] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 ${
                      statusFilter === st
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? `All (${scopedDevices.length})` : st}
                  </button>
                )
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="Search hostname, IP, vendor..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-56"
              />
            </div>
          </div>
        </div>

        {filteredTableNodes.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <Radar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No discovered nodes match the current filter
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Clear your status or search filter, or run a subnet scan to discover new devices.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setNodeSearch('');
              }}
              className="mt-4 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-2.5 px-4">Node Hostname & Hardware</th>
                  <th className="py-2.5 px-4">Vendor · Role</th>
                  <th className="py-2.5 px-4">Mgmt IP · Site</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Rx / Tx (Mbps)</th>
                  <th className="py-2.5 px-4 text-right">CPU · RTT</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredTableNodes.map((node) => (
                  <tr
                    key={node.id}
                    onClick={() => onSelectDevice(node)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100 font-mono">
                        {node.hostname}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {node.model} · {node.osVersion}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span>{node.vendor}</span>
                      <span className="mx-1.5 text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{node.role}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                        {node.ip}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{node.site}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {node.status === DeviceStatus.Online && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Online</span>
                        </span>
                      )}
                      {node.status === DeviceStatus.Warning && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Warning (Degraded)</span>
                          </span>
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Bấm để xem lý do & cách fix
                          </div>
                        </div>
                      )}
                      {node.status === DeviceStatus.Offline && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Offline (Connect Failed)</span>
                          </span>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            Mất uplink L1/L2 · Bấm xem cách fix
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {node.status === DeviceStatus.Offline ? (
                        <span className="text-slate-400 dark:text-slate-500">0.0 / 0.0</span>
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200">
                          {node.inboundMbps.toFixed(1)} / {node.outboundMbps.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {node.status === DeviceStatus.Offline ? (
                        <span className="text-rose-600 dark:text-rose-400">Timeout</span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">
                          {node.cpuLoad}% · {node.latencyMs.toFixed(1)}ms
                        </span>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {node.status !== DeviceStatus.Online && (
                          <button
                            type="button"
                            onClick={() => onSelectDevice(node)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Lý do Lỗi & Fix</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleDeviceStatus(node.id)}
                          title={
                            node.status === DeviceStatus.Offline
                              ? 'Bring node online'
                              : 'Simulate node offline'
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                            node.status === DeviceStatus.Offline
                              ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{node.status === DeviceStatus.Offline ? 'Recover' : 'Failover'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenConfigForDevice(node.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Terminal className="w-3 h-3" />
                          <span>CLI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectDevice(node)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
