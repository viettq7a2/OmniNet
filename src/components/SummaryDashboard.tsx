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
  ChevronDown,
  Pause,
  Play,
  Power,
  Radar,
  Search,
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
import { AppLanguage } from '../utils/i18n';

interface SummaryDashboardProps {
  devices: NetworkDevice[];
  trafficSeries: TrafficTelemetryPoint[];
  isStreaming: boolean;
  onToggleStream: () => void;
  isDark: boolean;
  lang?: AppLanguage;
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
  lang = 'vi',
  onSelectDevice,
  onToggleDeviceStatus,
  onNavigateToDiscovery,
  onOpenConfigForDevice,
}) => {
  const isVi = lang === 'vi';
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [nodeSearch, setNodeSearch] = useState<string>('');
  const [windowPoints, setWindowPoints] = useState<12 | 24>(24);
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);

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
    <div className="space-y-6" onClick={() => setOpenActionRowId(null)}>
      {/* Scope & Live Telemetry Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {isVi ? 'Tổng quan Hạ tầng & Lưu lượng' : 'Network Summary & Live Telemetry'}
        </h1>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Compact Site Select Dropdown */}
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">
              {isVi ? 'Khu vực: Tất cả Chi nhánh (All Sites)' : 'Scope: All Sites'}
            </option>
            {sites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleStream}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{isVi ? 'Tạm dừng Luồng (2s)' : 'Pause Live Feed (2s)'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{isVi ? 'Tiếp tục Luồng Live' : 'Resume Live Feed'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Tỷ lệ Thiết bị Sẵn sàng (SLA)' : 'Discovered Nodes Availability'}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.availabilityPct}%
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {counts.online + counts.warning} / {counts.total}{' '}
              {isVi ? 'kết nối' : 'reachable'}
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
            {isVi ? 'Tổng Băng thông Toàn mạng' : 'Aggregate Real-Time Throughput'}
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
            {isVi ? 'Độ trễ Trung bình (RTT Latency)' : 'Mean Network RTT Latency'}
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
            <span>{isVi ? 'Đa hãng' : 'Multi-vendor'}</span>
            <span aria-hidden="true">·</span>
            <span>{isVi ? 'Chu kỳ quét 2s' : '2s interval'}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Độ lệch Cấu hình & Chuẩn CIS' : 'Config Drift & CIS Compliance'}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {counts.driftNodesCount === 0
                ? isVi
                  ? '100% Chuẩn'
                  : '100% Synced'
                : `${counts.driftNodesCount} Drift`}
            </span>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {counts.complianceIssuesCount} {isVi ? 'cảnh báo CIS' : 'findings'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>
              {new Set(scopedDevices.map((d) => d.vendor)).size}{' '}
              {isVi ? 'Hãng thiết bị' : 'Vendors'}
            </span>
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
                {isVi
                  ? 'Biểu đồ Lưu lượng Mạng Thời gian thực (Mbps)'
                  : 'Real-Time Network Traffic Throughput'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Inbound Rx</span>
                <span aria-hidden="true">·</span>
                <span>Outbound Tx</span>
                <span aria-hidden="true">·</span>
                <span>Firewall Inspected (Mbps)</span>
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
                {isVi ? 'Trạng thái Thiết bị' : 'Discovered Node Status'}
              </h2>
              <button
                type="button"
                onClick={onNavigateToDiscovery}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>{isVi ? 'Quét mạng' : 'Scan Subnet'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isVi
                ? 'Nhấp vào từng phần biểu đồ để lọc danh sách bên dưới'
                : 'Click any segment below to filter node matrix'}
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
                {isVi
                  ? 'Băng thông theo từng Thiết bị (Top Node)'
                  : 'Throughput by Discovered Node (Top Active & Offline)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isVi
                  ? 'So sánh lưu lượng vào (Rx) và ra (Tx) theo thời gian thực (Mbps)'
                  : 'Real-time Inbound Rx vs Outbound Tx bandwidth per node in Mbps'}
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
              {isVi
                ? 'Phân bổ Vai trò Phần cứng & Đa hãng'
                : 'Hardware Roles & Multi-Vendor Distribution'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isVi
                ? 'Tỷ lệ Router, Switch, Firewall, Wireless và Server trong hệ thống'
                : 'Breakdown of discovered routers, switches, firewalls, wireless, and servers'}
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
              {isVi
                ? 'Danh sách Trạng thái Thiết bị Thời gian thực'
                : 'Discovered Nodes Live Status Matrix'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isVi
                ? 'Nhấp vào thiết bị để xem chi tiết phần cứng hoặc mở menu Tác vụ (▾) ở cột bên phải'
                : 'Click any row to inspect hardware telemetry or use the compact Actions (▾) menu'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Compact Status Select Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DeviceStatus)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">
                {isVi ? `Tất cả trạng thái (${scopedDevices.length})` : `All Statuses (${scopedDevices.length})`}
              </option>
              <option value={DeviceStatus.Online}>Online</option>
              <option value={DeviceStatus.Warning}>Warning</option>
              <option value={DeviceStatus.Offline}>Offline</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder={
                  isVi ? 'Tìm hostname, IP, hãng...' : 'Search hostname, IP, vendor...'
                }
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-56"
              />
            </div>
          </div>
        </div>

        {filteredTableNodes.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <Radar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {isVi
                ? 'Không tìm thấy thiết bị phù hợp với bộ lọc'
                : 'No discovered nodes match the current filter'}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setNodeSearch('');
              }}
              className="mt-4 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isVi ? 'Xóa bộ lọc' : 'Reset Filters'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-2.5 px-4">
                    {isVi ? 'Hostname & Phần cứng' : 'Node Hostname & Hardware'}
                  </th>
                  <th className="py-2.5 px-4">{isVi ? 'Hãng · Vai trò' : 'Vendor · Role'}</th>
                  <th className="py-2.5 px-4">{isVi ? 'IP Quản trị · Khu vực' : 'Mgmt IP · Site'}</th>
                  <th className="py-2.5 px-4">{isVi ? 'Trạng thái' : 'Status'}</th>
                  <th className="py-2.5 px-4 text-right">Rx / Tx (Mbps)</th>
                  <th className="py-2.5 px-4 text-right">CPU · RTT</th>
                  <th className="py-2.5 px-4 text-right">{isVi ? 'Tác vụ' : 'Actions'}</th>
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
                            <span>Warning</span>
                          </span>
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                            {isVi ? 'Bấm xem nguyên nhân & cách xử lý' : 'Click to inspect & remediate'}
                          </div>
                        </div>
                      )}
                      {node.status === DeviceStatus.Offline && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Offline</span>
                          </span>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            {isVi ? 'Mất kết nối L1/L2 · Bấm xem cách xử lý' : 'Uplink down · Click for RCA fix'}
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
                      className="py-3 px-4 text-right whitespace-nowrap relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-block relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenActionRowId((prev) => (prev === node.id ? null : node.id))
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span>{isVi ? 'Tác vụ' : 'Actions'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {openActionRowId === node.id && (
                          <div className="absolute right-0 mt-1 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-30 text-left text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionRowId(null);
                                onSelectDevice(node);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Activity className="w-3.5 h-3.5 text-blue-500" />
                              <span>
                                {isVi ? 'Xem chi tiết & Chẩn đoán' : 'Inspect & RCA Details'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionRowId(null);
                                onOpenConfigForDevice(node.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                              <span>
                                {isVi ? 'Cấu hình CLI & Trực quan' : 'Open CLI & Visual Config'}
                              </span>
                            </button>

                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionRowId(null);
                                onToggleDeviceStatus(node.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Power
                                className={`w-3.5 h-3.5 ${
                                  node.status === DeviceStatus.Offline
                                    ? 'text-emerald-500'
                                    : 'text-rose-500'
                                }`}
                              />
                              <span>
                                {node.status === DeviceStatus.Offline
                                  ? isVi
                                    ? 'Khôi phục thiết bị (Online)'
                                    : 'Recover Node Online'
                                  : isVi
                                  ? 'Giả lập mất kết nối (Offline)'
                                  : 'Simulate Failover (Offline)'}
                              </span>
                            </button>
                          </div>
                        )}
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
