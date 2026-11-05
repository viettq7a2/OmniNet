import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Network,
  Play,
  Send,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { DeviceStatus, NetworkAlert, NetworkDevice } from '../types/network';
import { AppLanguage, RbacRole } from '../utils/i18n';
import { auditDeviceCompliance } from '../utils/vendorConfigCompiler';

interface OperationsSuiteViewProps {
  devices: NetworkDevice[];
  alerts: NetworkAlert[];
  lang: AppLanguage;
  activeRole: RbacRole;
  onChangeRole: (role: RbacRole) => void;
  onSelectDevice: (device: NetworkDevice) => void;
  onResolveIpConflict?: (deviceId: string, newIp: string) => void;
}

type OpsSubTab = 'ipam' | 'backup' | 'webhook' | 'rbac' | 'reports';

interface BackupScheduleItem {
  id: string;
  name: string;
  cronLabel: string;
  scope: string;
  retentionDays: number;
  enabled: boolean;
  lastRun: string;
  lastResult: string;
}

interface WebhookChannel {
  id: string;
  platform: 'Telegram Bot' | 'Microsoft Teams' | 'Slack NOC' | 'SMTP Email';
  target: string;
  events: string;
  enabled: boolean;
  lastDispatched: string;
}

export const OperationsSuiteView: React.FC<OperationsSuiteViewProps> = ({
  devices,
  alerts,
  lang,
  activeRole,
  onChangeRole,
  onSelectDevice,
  onResolveIpConflict,
}) => {
  const isVi = lang === 'vi';
  const [subTab, setSubTab] = useState<OpsSubTab>('ipam');

  // 1. IPAM State
  const [selectedSubnetCidr, setSelectedSubnetCidr] = useState<string>('ALL');
  const [simulatedConflictDeviceId, setSimulatedConflictDeviceId] = useState<string | null>(
    devices[3]?.id || null
  );
  const [ipamToast, setIpamToast] = useState<string | null>(null);

  // 2. Scheduled Config Backup State
  const [backupSchedules, setBackupSchedules] = useState<BackupScheduleItem[]>([
    {
      id: 'bk-1',
      name: isVi
        ? 'Sao lưu Toàn bộ Running-Config Hàng Đêm'
        : 'Nightly Full Running-Config Snapshot',
      cronLabel: '02:00 AM Daily (Cron: 0 2 * * *)',
      scope: 'All Managed Switches, Routers & Firewalls',
      retentionDays: 90,
      enabled: true,
      lastRun: 'Today 02:00:04',
      lastResult: `${devices.length}/${devices.length} Success`,
    },
    {
      id: 'bk-2',
      name: isVi
        ? 'Kiểm tra Lệch Cấu hình Core & Firewall (6 giờ/lần)'
        : 'Core & Firewall Drift Check (Every 6h)',
      cronLabel: 'Every 6 Hours (Cron: 0 */6 * * *)',
      scope: 'Tier 0 Firewalls & Tier 1 Core Routers',
      retentionDays: 180,
      enabled: true,
      lastRun: '2h ago',
      lastResult: 'Drift Audit Complete',
    },
  ]);
  const [isRunningBackupNow, setIsRunningBackupNow] = useState(false);
  const [lastBackupTimestamp, setLastBackupTimestamp] = useState('Today 02:00:04');

  // 3. Real-Time Webhook Channels State
  const [webhooks, setWebhooks] = useState<WebhookChannel[]>([
    {
      id: 'wh-tg',
      platform: 'Telegram Bot',
      target: 'Bot @OmniNetAlertBot · ChatID: -10024819204',
      events: 'Critical Node Offline, Link Down, Config Drift, AI RCA Fix',
      enabled: true,
      lastDispatched: '4m ago',
    },
    {
      id: 'wh-teams',
      platform: 'Microsoft Teams',
      target: 'https://outlook.office.com/webhook/omninet-noc-channel',
      events: 'Critical & Warning Alerts + Executive Daily Summary',
      enabled: true,
      lastDispatched: '19m ago',
    },
    {
      id: 'wh-slack',
      platform: 'Slack NOC',
      target: '#netops-incident-response (hooks.slack.com/services/T00/B00)',
      events: 'CIS Security Compliance & BGP Neighbor Flap',
      enabled: true,
      lastDispatched: '1h ago',
    },
    {
      id: 'wh-mail',
      platform: 'SMTP Email',
      target: 'noc-team@omninet.corp, it-director@omninet.corp',
      events: 'Nightly Backup Diff & Weekly SLA PDF/CSV Digest',
      enabled: true,
      lastDispatched: 'Today 06:00',
    },
  ]);
  const [testAlertPreview, setTestAlertPreview] = useState<string | null>(null);

  // Subnet Pools computed from devices
  const subnetPools = useMemo(() => {
    const pools = [
      {
        cidr: '10.10.0.0/24',
        vlan: 'VLAN 10 · Core & DC Management',
        gateway: '10.10.0.1',
        totalUsable: 254,
        prefix: '10.10.0.',
      },
      {
        cidr: '10.20.10.0/24',
        vlan: 'VLAN 20 · Campus Access & Switches',
        gateway: '10.20.10.1',
        totalUsable: 254,
        prefix: '10.20.10.',
      },
      {
        cidr: '10.30.0.0/24',
        vlan: 'VLAN 30 · Production Server Farm',
        gateway: '10.30.0.1',
        totalUsable: 254,
        prefix: '10.30.0.',
      },
      {
        cidr: '172.16.40.0/24',
        vlan: 'VLAN 40 · Branch & Wireless Edge',
        gateway: '172.16.40.1',
        totalUsable: 254,
        prefix: '172.16.40.',
      },
    ];

    return pools.map((p) => {
      const matched = devices.filter((d) => d.ip.startsWith(p.prefix));
      const usedCount = matched.length + 18;
      const pct = Math.min(98, Math.round((usedCount / p.totalUsable) * 100));
      return {
        ...p,
        matchedDevices: matched,
        usedCount,
        utilizationPct: pct,
      };
    });
  }, [devices]);

  const filteredIpamDevices = useMemo(() => {
    if (selectedSubnetCidr === 'ALL') return devices;
    const prefix = selectedSubnetCidr.split('.').slice(0, 3).join('.') + '.';
    return devices.filter((d) => d.ip.startsWith(prefix));
  }, [devices, selectedSubnetCidr]);

  const conflictDevice = useMemo(
    () => devices.find((d) => d.id === simulatedConflictDeviceId) || null,
    [devices, simulatedConflictDeviceId]
  );

  const handleAutoResolveConflict = () => {
    if (!conflictDevice) return;
    const parts = conflictDevice.ip.split('.');
    const nextOctet = Math.min(250, Number(parts[3] || 50) + 12);
    const newCleanIp = `${parts[0]}.${parts[1]}.${parts[2]}.${nextOctet}`;
    if (onResolveIpConflict) {
      onResolveIpConflict(conflictDevice.id, newCleanIp);
    }
    setSimulatedConflictDeviceId(null);
    setIpamToast(
      isVi
        ? `Đã tự động cấp phát lại IP sạch (${newCleanIp}) cho ${conflictDevice.hostname} và xóa xung đột ARP!`
        : `Reassigned conflict-free IP (${newCleanIp}) to ${conflictDevice.hostname} and cleared ARP collision!`
    );
  };

  const handleRunBackupNow = () => {
    setIsRunningBackupNow(true);
    setTimeout(() => {
      const nowStr = new Date().toLocaleTimeString([], { hour12: false });
      setLastBackupTimestamp(`Just now (${nowStr})`);
      setBackupSchedules((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? {
                ...s,
                lastRun: `Just now (${nowStr})`,
                lastResult: `${devices.length}/${devices.length} Backed Up`,
              }
            : s
        )
      );
      setIsRunningBackupNow(false);
    }, 600);
  };

  const handleDownloadDeviceConfig = (dev: NetworkDevice) => {
    const blob = new Blob([dev.runningConfig], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dev.hostname}-${new Date().toISOString().slice(0, 10)}.cfg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendTestWebhook = (channel: WebhookChannel) => {
    const sampleDev =
      devices.find((d) => d.status !== DeviceStatus.Online) || devices[0];
    const message = `[OmniNet ${channel.platform} Alert]\n🚨 Thiết bị: ${sampleDev.hostname} (${sampleDev.ip} · ${sampleDev.vendor})\n• Trạng thái: ${sampleDev.status.toUpperCase()} | Độ trễ: ${sampleDev.latencyMs}ms | CPU: ${sampleDev.cpuLoad}%\n• Chẩn đoán AI RCA: Phát hiện sự cố kết nối / lệch cấu hình trên cổng ${sampleDev.interfaces[0]?.name || 'Gi0/1'}.\n• Lệnh CLI khắc phục nhanh: configure terminal -> interface ${sampleDev.interfaces[0]?.name || 'Gi0/1'} -> no shutdown`;
    setTestAlertPreview(message);
    setWebhooks((prev) =>
      prev.map((w) => (w.id === channel.id ? { ...w, lastDispatched: 'Just now' } : w))
    );
  };

  const handleExportCsvReport = () => {
    const headers = [
      'Hostname',
      'IP Address',
      'MAC Address',
      'Vendor',
      'Model',
      'OS Version',
      'Role',
      'Site',
      'Status',
      'CPU %',
      'Memory %',
      'Latency ms',
      'Config Drift',
      'Warranty Expiry',
    ];
    const rows = devices.map((d) => [
      d.hostname,
      d.ip,
      d.mac,
      d.vendor,
      d.model,
      d.osVersion,
      d.role,
      d.site,
      d.status,
      d.cpuLoad,
      d.memoryUsage,
      d.latencyMs,
      d.runningConfig.trim() !== d.goldenBaselineConfig.trim() ? 'DRIFTED' : 'ALIGNED',
      d.warrantyExpiry,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniNet-Executive-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdownReport = () => {
    const onlineCount = devices.filter((d) => d.status === DeviceStatus.Online).length;
    const slaPct = ((onlineCount / Math.max(1, devices.length)) * 100).toFixed(2);
    const driftedNodes = devices.filter(
      (d) => d.runningConfig.trim() !== d.goldenBaselineConfig.trim()
    );
    const complianceIssues = devices.flatMap((d) => auditDeviceCompliance(d));

    const md = `# BÁO CÁO ĐIỀU HÀNH HẠ TẦNG MẠNG DOANH NGHIỆP — OMNINET ENTERPRISE
Ngày xuất báo cáo: ${new Date().toLocaleString()}

## 1. CHỈ SỐ VẬN HÀNH TỔNG QUAN (SLA & KẾT NỐI)
- Tổng số thiết bị quản lý: **${devices.length} thiết bị**
- Tỷ lệ Sẵn sàng Hạ tầng (Availability SLA): **${slaPct}%** (${onlineCount}/${devices.length} Online)
- Số thiết bị lệch chuẩn cấu hình (Config Drift): **${driftedNodes.length} thiết bị**
- Tổng số phát hiện kiểm toán bảo mật CIS: **${complianceIssues.length} mục**

## 2. DANH MỤC THIẾT BỊ & TRẠNG THÁI BẢO HÀNH
${devices
  .map(
    (d) =>
      `- **${d.hostname}** (${d.ip} · ${d.vendor} ${d.model} · ${d.osVersion}) — Trạng thái: ${d.status.toUpperCase()} | CPU: ${d.cpuLoad}% | Bảo hành đến: ${d.warrantyExpiry}`
  )
  .join('\n')}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniNet-Bao-Cao-Ban-Giam-Doc-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Segmented Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isVi
              ? 'Trung tâm Vận hành Doanh nghiệp (IPAM · Backup · Cảnh báo · Phân quyền · Báo cáo)'
              : 'Enterprise Operations Suite (IPAM · Backup · Webhooks · RBAC · Reports)'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isVi
              ? 'Quản lý địa chỉ IP/VLAN, lịch sao lưu cấu hình tự động hàng đêm, bắn cảnh báo Telegram/Teams/Slack, phân quyền NOC và xuất báo cáo định kỳ'
              : 'Manage IP/VLAN pools, nightly config backups, instant Telegram/Teams/Slack webhooks, RBAC permissions, and executive SLA reports'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          {[
            { id: 'ipam' as const, label: isVi ? '1. Quản lý IP (IPAM)' : '1. IPAM & Subnets', icon: Network },
            { id: 'backup' as const, label: isVi ? '2. Sao lưu Tự động' : '2. Auto Backup', icon: HardDrive },
            { id: 'webhook' as const, label: isVi ? '3. Cảnh báo Telegram/Teams' : '3. Alert Webhooks', icon: Bell },
            { id: 'rbac' as const, label: isVi ? '4. Phân quyền RBAC' : '4. RBAC & Audit', icon: UserCheck },
            { id: 'reports' as const, label: isVi ? '5. Xuất Báo cáo' : '5. Executive Reports', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: IPAM & IP CONFLICT DETECTOR */}
      {subTab === 'ipam' && (
        <div className="space-y-5">
          {ipamToast && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{ipamToast}</span>
            </div>
          )}

          {/* IP Conflict Banner if active */}
          {conflictDevice && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/70 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-rose-800 dark:text-rose-200">
                    {isVi
                      ? `Phát hiện Xung đột Địa chỉ IP (ARP Duplicate IP Conflict) trên ${conflictDevice.ip}`
                      : `Duplicate IP Address Conflict Detected on ${conflictDevice.ip}`}
                  </div>
                  <p className="text-rose-700 dark:text-rose-300">
                    {isVi
                      ? `Thiết bị ${conflictDevice.hostname} (${conflictDevice.mac}) đang bị trùng IP ${conflictDevice.ip} với một máy trạm tĩnh (MAC: 00:1B:63:84:45:E6) trong cùng VLAN.`
                      : `Node ${conflictDevice.hostname} (${conflictDevice.mac}) has an ARP collision on ${conflictDevice.ip} with rogue host MAC 00:1B:63:84:45:E6.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoResolveConflict}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {isVi ? 'Tự động Cấp IP Sạch & Xóa Xung Đột' : 'Auto-Reassign Clean IP'}
                </span>
              </button>
            </div>
          )}

          {/* Subnet Utilization Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {subnetPools.map((pool) => (
              <button
                key={pool.cidr}
                type="button"
                onClick={() =>
                  setSelectedSubnetCidr((prev) => (prev === pool.cidr ? 'ALL' : pool.cidr))
                }
                className={`p-4 rounded-xl border text-left transition-colors ${
                  selectedSubnetCidr === pool.cidr
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono font-bold text-blue-600 dark:text-sky-400">
                  <span>{pool.cidr}</span>
                  <span>{pool.utilizationPct}% Used</span>
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {pool.vlan}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  GW: {pool.gateway} · {pool.usedCount}/{pool.totalUsable} IPs
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 dark:bg-sky-400 rounded-full"
                    style={{ width: `${pool.utilizationPct}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          {/* IP Allocation Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {isVi ? 'Bảng Cấp phát Địa chỉ IPv4 & Ánh xạ MAC/Switch Port' : 'IPv4 Address Allocation & MAC/Port Mapping'}
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {filteredIpamDevices.length} IP Leases
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/70 dark:bg-slate-950/50">
                    <th className="py-2.5 px-4">IPv4 Address</th>
                    <th className="py-2.5 px-4">Hostname</th>
                    <th className="py-2.5 px-4">MAC Address</th>
                    <th className="py-2.5 px-4">Vendor · Model</th>
                    <th className="py-2.5 px-4">Site · Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIpamDevices.map((d) => {
                    const isConflict = d.id === simulatedConflictDeviceId;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => onSelectDevice(d)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-blue-600 dark:text-sky-400">
                          {d.ip}
                          {isConflict && (
                            <span className="ml-2 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                              [IP CONFLICT]
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-medium">{d.hostname}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{d.mac}</td>
                        <td className="py-2.5 px-4">
                          {d.vendor} · <span className="text-slate-500">{d.model}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono">{d.site}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULED CONFIG BACKUP & DIFF */}
      {subTab === 'backup' && (
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold">
                {isVi
                  ? 'Hệ thống Sao lưu Cấu hình Tự động Hàng Đêm (Nightly Config Vault)'
                  : 'Automated Nightly Configuration Backup Vault'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVi
                  ? `Lần sao lưu gần nhất: ${lastBackupTimestamp} · Lưu trữ đầy đủ Running-Config & Golden Baseline của ${devices.length} thiết bị`
                  : `Last snapshot: ${lastBackupTimestamp} · Archiving Running-Config & Golden Baseline across ${devices.length} nodes`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunBackupNow}
              disabled={isRunningBackupNow}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {isRunningBackupNow
                  ? isVi
                    ? 'Đang kéo cấu hình từ các thiết bị...'
                    : 'Pulling configs...'
                  : isVi
                  ? 'Chạy Sao Lưu Toàn Hệ Thống Ngay'
                  : 'Run Full Backup Now'}
              </span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/70 dark:bg-slate-950/50">
                    <th className="py-2.5 px-4">Device</th>
                    <th className="py-2.5 px-4">Vendor · OS</th>
                    <th className="py-2.5 px-4">Snapshots</th>
                    <th className="py-2.5 px-4">Golden Baseline Diff</th>
                    <th className="py-2.5 px-4 text-right">Download .CFG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {devices.map((d) => {
                    const drifted = d.runningConfig.trim() !== d.goldenBaselineConfig.trim();
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-medium">
                          {d.hostname} <span className="font-mono text-slate-400">({d.ip})</span>
                        </td>
                        <td className="py-2.5 px-4">
                          {d.vendor} · <span className="font-mono text-slate-500">{d.osVersion}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {d.configHistory.length} revisions
                        </td>
                        <td className="py-2.5 px-4">
                          {drifted ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {isVi ? 'Có thay đổi (Config Drift)' : 'Drifted from Baseline'}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {isVi ? 'Khớp 100% chuẩn' : '100% Aligned'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadDeviceConfig(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                          >
                            <Download className="w-3 h-3" />
                            <span>.CFG</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REAL-TIME WEBHOOKS (TELEGRAM / TEAMS / SLACK / EMAIL) */}
      {subTab === 'webhook' && (
        <div className="space-y-5">
          {testAlertPreview && (
            <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-white font-sans font-bold">
                <span>
                  {isVi
                    ? 'Bản tin Cảnh báo Tức thì vừa bắn thành công:'
                    : 'Instant Webhook Payload Dispatched:'}
                </span>
                <button
                  type="button"
                  onClick={() => setTestAlertPreview(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400">
                {testAlertPreview}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {wh.platform}
                  </div>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                    {wh.enabled ? 'ACTIVE' : 'PAUSED'} · {wh.lastDispatched}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500 truncate">{wh.target}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{wh.events}</div>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendTestWebhook(wh)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isVi ? 'Bắn Cảnh báo Thử nghiệm (Kèm AI RCA)' : 'Send Test Alert'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RBAC ROLE-BASED ACCESS CONTROL */}
      {subTab === 'rbac' && (
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold">
                {isVi
                  ? 'Chuyển đổi Quyền hạn Vận hành (RBAC — Role-Based Access Control)'
                  : 'Active Operator Role Switcher (RBAC)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVi
                  ? 'Khi chọn quyền "NOC L1 (Chỉ xem)", hệ thống sẽ khóa các nút Đẩy cấu hình CLI hàng loạt và Xóa thiết bị để tránh thao tác nhầm.'
                  : 'When switched to "NOC L1 (Read-Only)", bulk CLI push and device deletion actions are restricted.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => onChangeRole('admin')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  activeRole === 'admin'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>Principal Network Architect (Full Admin)</span>
                  {activeRole === 'admin' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Toàn quyền: Đẩy cấu hình CLI đa hãng, Rollback Golden Baseline, Thêm/Xóa thiết bị, Quản lý 2FA & Webhook.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeRole('noc-l1')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  activeRole === 'noc-l1'
                    ? 'border-amber-600 bg-amber-50/60 dark:bg-amber-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>NOC L1 Shift Operator (Read-Only Monitoring)</span>
                  {activeRole === 'noc-l1' && (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Giới hạn an toàn: Được xem Dashboard, Sơ đồ Topology, Chẩn đoán AI RCA & hỏi Trợ lý AI; khóa quyền đẩy lệnh CLI & xóa thiết bị.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: EXECUTIVE REPORTS */}
      {subTab === 'reports' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold">
                {isVi
                  ? 'Xuất Báo cáo Vận hành Định kỳ (SLA, Kiểm toán Bảo mật CIS & Bảo hành Thiết bị)'
                  : 'Executive SLA, CIS Security Audit & Asset Lifecycle Report'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVi
                  ? 'Tải trực tiếp bảng thống kê Excel (.CSV) hoặc Báo cáo tổng hợp trình Ban Giám Đốc (.MD)'
                  : 'Download full inventory spreadsheet (.CSV) or Executive Summary (.MD)'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsvReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isVi ? 'Xuất Báo cáo Excel (.CSV)' : 'Export Excel (.CSV)'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdownReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>{isVi ? 'Xuất Báo cáo Ban Giám Đốc (.MD)' : 'Export Executive Summary (.MD)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
