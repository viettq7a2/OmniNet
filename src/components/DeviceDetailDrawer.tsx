import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Power,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Terminal,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { DeviceRole, DeviceStatus, NetworkDevice } from '../types/network';
import { diagnoseDeviceConnection } from '../utils/connectionDiagnostics';

interface DeviceDetailDrawerProps {
  device: NetworkDevice | null;
  allDevices?: NetworkDevice[];
  onClose: () => void;
  onToggleStatus: (deviceId: string) => void;
  onOpenInConfigHub: (deviceId: string) => void;
  onOpenInAiRca?: (deviceId: string) => void;
  onAutoFixConnection?: (deviceId: string, remediationCli: string) => void;
  onAskFloatingAi?: (prompt: string, deviceId: string) => void;
}

export const DeviceDetailDrawer: React.FC<DeviceDetailDrawerProps> = ({
  device,
  allDevices = [],
  onClose,
  onToggleStatus,
  onOpenInConfigHub,
  onOpenInAiRca,
  onAutoFixConnection,
  onAskFloatingAi,
}) => {
  const [isTestingConn, setIsTestingConn] = useState<boolean>(false);
  const [showConnDiag, setShowConnDiag] = useState<boolean>(false);

  useEffect(() => {
    if (device) {
      // Automatically show connection diagnostic panel if device is offline or has stopped services
      const hasStoppedSvc = (device.services || []).some((s) => s.status !== 'running');
      const hasAdminDown = device.interfaces.some((i) => (i.adminStatus ?? 'up') === 'down');
      setShowConnDiag(
        device.status !== DeviceStatus.Online || hasStoppedSvc || hasAdminDown
      );
    }
  }, [device]);

  if (!device) return null;

  const connDiag = diagnoseDeviceConnection(device, allDevices);

  const upPortCount = device.interfaces.filter(
    (i) =>
      device.status !== DeviceStatus.Offline &&
      i.status === 'up' &&
      (i.adminStatus ?? 'up') === 'up'
  ).length;

  const handleRunConnectionTest = () => {
    setIsTestingConn(true);
    setShowConnDiag(true);
    setTimeout(() => {
      setIsTestingConn(false);
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto flex flex-col justify-between">
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* Header */}
          <div className="p-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {device.status === DeviceStatus.Online && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                {device.status === DeviceStatus.Warning && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                {device.status === DeviceStatus.Offline && (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                <h2 className="text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                  {device.hostname}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {device.vendor} · {device.model} · {device.osVersion} · {device.role}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunConnectionTest}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin' : ''}`} />
                <span>Kiểm tra Kết nối</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connection Failure Analysis & Fix Advisor Section */}
          {(showConnDiag || !connDiag.canConnect) && (
            <div
              className={`p-5 space-y-3.5 text-xs ${
                connDiag.canConnect
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'bg-rose-50/60 dark:bg-rose-950/25'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {connDiag.canConnect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span
                      className={
                        connDiag.canConnect
                          ? 'text-emerald-800 dark:text-emerald-300'
                          : 'text-rose-800 dark:text-rose-300'
                      }
                    >
                      {connDiag.connectionStateLabel}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    Mã trạng thái: {connDiag.errorCode} · {connDiag.protocolSummary}
                  </div>
                </div>
              </div>

              {/* Why Connection Failed */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>
                    {connDiag.canConnect
                      ? 'Trạng thái Phiên Kết nối'
                      : 'Lý do Tại sao Kết nối Không Thành công'}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {connDiag.failureReasonVi}
                </p>
                <ul className="space-y-1 pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  {connDiag.technicalEvidence.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>

              {/* How to Fix It */}
              {!connDiag.canConnect && (
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Gợi ý Cách Fix Lỗi Kết nối (Step-by-Step)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    {connDiag.fixStepsVi.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-1">
                    <div className="text-[11px] font-mono text-slate-500 mb-1 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      <span>Kịch bản CLI Khắc phục ({device.vendor}):</span>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      {connDiag.remediationCli}
                    </pre>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onAutoFixConnection && (
                      <button
                        type="button"
                        onClick={() => onAutoFixConnection(device.id, connDiag.remediationCli)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Tự động Fix & Kết nối lại Ngay</span>
                      </button>
                    )}

                    {onAskFloatingAi && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskFloatingAi(
                            `Thiết bị ${device.hostname} (${device.ip}) đang bị lỗi kết nối (${connDiag.errorCode}). Hãy phân tích sâu nguyên nhân và hướng dẫn tôi cách khắc phục chi tiết trên ${device.vendor}.`,
                            device.id
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/40 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-medium transition-colors"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Chat với Trợ lý AI về lỗi này</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Health & Resource Telemetry */}
          <div className="p-5 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400">CPU Utilization</div>
              <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {device.status === DeviceStatus.Offline ? '—' : `${device.cpuLoad}%`}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Memory Usage</div>
              <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {device.status === DeviceStatus.Offline ? '—' : `${device.memoryUsage}%`}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Thermal / RTT</div>
              <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {device.status === DeviceStatus.Offline
                  ? 'Unreachable'
                  : `${device.tempCelsius}°C · ${device.latencyMs.toFixed(1)}ms`}
              </div>
            </div>
          </div>

          {/* Server Monitored Services (if Server) */}
          {device.role === DeviceRole.Server && device.services && (
            <div className="p-5 space-y-2.5 text-xs">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Monitored Server Services ({device.services.length})
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {device.services.map((svc) => {
                  const isRunning =
                    device.status !== DeviceStatus.Offline && svc.status === 'running';
                  return (
                    <div
                      key={svc.id}
                      className="py-2 flex items-center justify-between gap-2 font-mono"
                    >
                      <div>
                        <div className="font-sans font-medium text-slate-900 dark:text-slate-100">
                          {svc.name}
                        </div>
                        <div className="text-slate-500">
                          {svc.processName} · {svc.protocol}/{svc.port}
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div
                          className={
                            isRunning
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {isRunning ? 'RUNNING' : 'STOPPED (CONN REFUSED)'}
                        </div>
                        <div className="text-slate-500">
                          {isRunning ? `${svc.cpuPct}% CPU · ${svc.responseTimeMs}ms` : 'Closed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Physical & Trunk Interfaces */}
          <div className="p-5 space-y-2.5 text-xs">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Network Ports ({upPortCount}/{device.interfaces.length} UP)
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto">
              {device.interfaces.map((ifc) => {
                const isUp =
                  device.status !== DeviceStatus.Offline &&
                  ifc.status === 'up' &&
                  (ifc.adminStatus ?? 'up') === 'up';
                return (
                  <div key={ifc.name} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {ifc.name} · <span className="text-slate-500">{ifc.vlan}</span>
                      </div>
                      {ifc.connectedToHostname && (
                        <div className="text-slate-500 dark:text-slate-400 font-mono">
                          {ifc.protocol} → {ifc.connectedToHostname} ({ifc.connectedPort})
                        </div>
                      )}
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div
                        className={
                          isUp
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-rose-600 dark:text-rose-400 font-medium'
                        }
                      >
                        {isUp ? `UP (${ifc.speedMbps / 1000}G)` : 'DOWN'}
                      </div>
                      <div className="text-slate-500">
                        Rx {isUp ? ifc.rxMbps : 0} / Tx {isUp ? ifc.txMbps : 0} Mbps
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CMDB Asset Metadata */}
          <div className="p-5 space-y-2.5 text-xs">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Hardware & CMDB Lifecycle Record
            </h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div className="text-slate-500">Management IP / MAC</div>
              <div className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {device.ip} · {device.mac}
              </div>
              <div className="text-slate-500">Asset Tag / Serial</div>
              <div className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {device.assetTag} · {device.serialNumber}
              </div>
              <div className="text-slate-500">Site & Rack Location</div>
              <div className="text-slate-900 dark:text-slate-100">
                {device.site} · {device.rack}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onToggleStatus(device.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {device.status === DeviceStatus.Offline
                ? 'Bring Node Online'
                : 'Simulate Node Offline'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {onOpenInAiRca && (
              <button
                type="button"
                onClick={() => {
                  onOpenInAiRca(device.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI RCA Diagnose</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onOpenInConfigHub(device.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Hook & Configure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
