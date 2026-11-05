import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Cpu,
  Play,
  Plus,
  Power,
  RefreshCw,
  Server,
  Sliders,
  Square,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  DeviceInterface,
  DeviceRole,
  DeviceStatus,
  NetworkDevice,
  ServerService,
} from '../types/network';

interface PortsAndServicesViewProps {
  devices: NetworkDevice[];
  onTogglePortAdminStatus: (deviceId: string, portName: string) => void;
  onUpdatePortVlanOrDesc: (
    deviceId: string,
    portName: string,
    vlan: string,
    description: string
  ) => void;
  onServiceAction: (
    deviceId: string,
    serviceId: string,
    action: 'start' | 'stop' | 'restart'
  ) => void;
  onAddServerService: (deviceId: string, service: ServerService) => void;
  onOpenVisualConfig: (deviceId: string) => void;
}

export const PortsAndServicesView: React.FC<PortsAndServicesViewProps> = ({
  devices,
  onTogglePortAdminStatus,
  onUpdatePortVlanOrDesc,
  onServiceAction,
  onAddServerService,
  onOpenVisualConfig,
}) => {
  const [sectionTab, setSectionTab] = useState<'ports' | 'services'>('ports');

  const networkAppliances = useMemo(
    () => devices.filter((d) => d.role !== DeviceRole.Server),
    [devices]
  );
  const serverNodes = useMemo(
    () => devices.filter((d) => d.role === DeviceRole.Server),
    [devices]
  );

  const [selectedNetDeviceId, setSelectedNetDeviceId] = useState<string>(
    () => networkAppliances[0]?.id || ''
  );
  const selectedNetDevice = useMemo(
    () =>
      networkAppliances.find((d) => d.id === selectedNetDeviceId) ||
      networkAppliances[0] ||
      null,
    [networkAppliances, selectedNetDeviceId]
  );

  const [selectedPortName, setSelectedPortName] = useState<string>('');
  const activePort: DeviceInterface | null = useMemo(() => {
    if (!selectedNetDevice) return null;
    return (
      selectedNetDevice.interfaces.find((i) => i.name === selectedPortName) ||
      selectedNetDevice.interfaces[0] ||
      null
    );
  }, [selectedNetDevice, selectedPortName]);

  const [editVlan, setEditVlan] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleSelectPort = (port: DeviceInterface) => {
    setSelectedPortName(port.name);
    setEditVlan(port.vlan);
    setEditDesc(port.description || '');
  };

  // Server Services state
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('ALL');
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [svcTargetServerId, setSvcTargetServerId] = useState<string>(
    () => serverNodes[0]?.id || ''
  );
  const [svcName, setSvcName] = useState('Apache Kafka Broker');
  const [svcProcess, setSvcProcess] = useState('kafka-server');
  const [svcPort, setSvcPort] = useState(9092);
  const [svcProtocol, setSvcProtocol] = useState<'TCP' | 'UDP' | 'HTTPS' | 'gRPC'>('TCP');

  // Aggregate port metrics across all switches/routers/firewalls
  const portTotals = useMemo(() => {
    let total = 0;
    let up = 0;
    let adminDown = 0;
    let poeWatts = 0;
    networkAppliances.forEach((dev) => {
      dev.interfaces.forEach((ifc) => {
        total += 1;
        const isOperUp = dev.status !== DeviceStatus.Offline && ifc.status === 'up' && (ifc.adminStatus ?? 'up') === 'up';
        if (isOperUp) up += 1;
        if ((ifc.adminStatus ?? 'up') === 'down') adminDown += 1;
        if (isOperUp && ifc.poeWatts) poeWatts += ifc.poeWatts;
      });
    });
    return {
      total,
      up,
      down: total - up,
      adminDown,
      poeWatts: poeWatts.toFixed(1),
    };
  }, [networkAppliances]);

  // Aggregate server services metrics
  const allServerServices = useMemo(() => {
    const targetServers =
      selectedServerFilter === 'ALL'
        ? serverNodes
        : serverNodes.filter((s) => s.id === selectedServerFilter);

    return targetServers.flatMap((srv) =>
      (srv.services || []).map((svc) => ({
        server: srv,
        service: svc,
        effectiveStatus:
          srv.status === DeviceStatus.Offline ? ('stopped' as const) : svc.status,
      }))
    );
  }, [serverNodes, selectedServerFilter]);

  const serviceTotals = useMemo(() => {
    const running = allServerServices.filter((x) => x.effectiveStatus === 'running').length;
    const degraded = allServerServices.filter((x) => x.effectiveStatus === 'degraded').length;
    const stopped = allServerServices.filter((x) => x.effectiveStatus === 'stopped').length;
    return { total: allServerServices.length, running, degraded, stopped };
  }, [allServerServices]);

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = svcTargetServerId || serverNodes[0]?.id;
    if (!targetId || !svcName.trim()) return;

    const newService: ServerService = {
      id: `svc-custom-${Date.now()}`,
      name: svcName.trim(),
      processName: svcProcess.trim() || 'daemon',
      port: svcPort || 8080,
      protocol: svcProtocol,
      status: 'running',
      cpuPct: 3.4,
      memoryMb: 512,
      responseTimeMs: 3,
      uptime: '0d 01h',
      autoRestart: true,
    };

    onAddServerService(targetId, newService);
    setIsAddServiceModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Port Up/Down Telemetry & Server Services Monitor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time physical RJ45/SFP+ switch & router port states alongside application daemons on enterprise servers
          </p>
        </div>

        {/* Section Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSectionTab('ports')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              sectionTab === 'ports'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>Switch / Router / Firewall Ports ({portTotals.up}/{portTotals.total} UP)</span>
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('services')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              sectionTab === 'services'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Server Services ({serviceTotals.running}/{serviceTotals.total} Running)</span>
          </button>
        </div>
      </div>

      {sectionTab === 'ports' ? (
        <div className="space-y-6">
          {/* Fleet Port Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Active Link-Up Ports</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {portTotals.up}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  of {portTotals.total} total ports
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Link-Down / Unplugged</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-rose-600 dark:text-rose-400 tabular-nums">
                  {portTotals.down}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {portTotals.adminDown} admin-shut
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">PoE+ Power Draw</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-slate-900 dark:text-slate-100 tabular-nums">
                  {portTotals.poeWatts} W
                </span>
                <span className="text-xs font-mono text-slate-500">IEEE 802.3at</span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Monitored Appliances</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-slate-900 dark:text-slate-100 tabular-nums">
                  {networkAppliances.length}
                </span>
                <span className="text-xs font-mono text-slate-500">SNMP IF-MIB</span>
              </div>
            </div>
          </div>

          {/* Appliance Selector + Hardware Port Faceplate */}
          {selectedNetDevice && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Select Switch / Router / Firewall Chassis
                    </label>
                    <select
                      value={selectedNetDevice.id}
                      onChange={(e) => {
                        setSelectedNetDeviceId(e.target.value);
                        setSelectedPortName('');
                      }}
                      className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[300px]"
                    >
                      {networkAppliances.map((dev) => {
                        const upCnt = dev.interfaces.filter(
                          (i) =>
                            dev.status !== DeviceStatus.Offline &&
                            i.status === 'up' &&
                            (i.adminStatus ?? 'up') === 'up'
                        ).length;
                        return (
                          <option key={dev.id} value={dev.id}>
                            {dev.hostname} · {dev.vendor} ({upCnt}/{dev.interfaces.length} UP)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 pt-4">
                    <span>{selectedNetDevice.model}</span>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono">{selectedNetDevice.ip}</span>
                    <span className="mx-1.5">·</span>
                    <span>{selectedNetDevice.site}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenVisualConfig(selectedNetDevice.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Hook & Configure Visual GUI</span>
                </button>
              </div>

              {/* Realistic Dark Metallic Hardware Rackmount Faceplate */}
              <div className="p-5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-slate-100 shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tracking-wider text-slate-200">
                        {selectedNetDevice.vendor.toUpperCase()} — {selectedNetDevice.model}
                      </span>
                      <span className="text-slate-400">
                        SYS: {selectedNetDevice.status === DeviceStatus.Offline ? 'OFFLINE' : 'OK'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                        <span>LINK UP</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                        <span>ADMIN SHUT</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-slate-700 border border-slate-500 inline-block" />
                        <span>NO CARRIER / DOWN</span>
                      </span>
                    </div>
                  </div>

                  {/* Physical Port Jacks Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2.5">
                    {selectedNetDevice.interfaces.map((port, idx) => {
                      const isAdminShut = (port.adminStatus ?? 'up') === 'down';
                      const isOperUp =
                        selectedNetDevice.status !== DeviceStatus.Offline &&
                        !isAdminShut &&
                        port.status === 'up';
                      const isSelected = activePort?.name === port.name;
                      const isFiber =
                        port.portType?.includes('SFP') ||
                        port.portType?.includes('QSFP') ||
                        port.speedMbps >= 10000;

                      return (
                        <button
                          key={port.name}
                          type="button"
                          onClick={() => handleSelectPort(port)}
                          className={`group relative p-2 rounded-lg border text-left font-mono transition-all ${
                            isSelected
                              ? 'bg-slate-800 border-blue-400 ring-2 ring-blue-500/40'
                              : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1.5 tabular-nums">
                            <span className="text-slate-400 font-semibold">
                              P{String(idx + 1).padStart(2, '0')}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-xs ${
                                isOperUp
                                  ? 'bg-emerald-400'
                                  : isAdminShut
                                  ? 'bg-amber-500'
                                  : 'bg-slate-700'
                              }`}
                            />
                          </div>

                          {/* RJ45 vs SFP Cage Silhouette */}
                          <div
                            className={`h-6 w-full rounded-xs border flex items-center justify-center text-[9px] font-semibold ${
                              isOperUp
                                ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                                : isAdminShut
                                ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                                : 'border-slate-700 bg-slate-900 text-slate-500'
                            }`}
                          >
                            {isFiber ? `${port.speedMbps / 1000}G SFP` : '1G RJ45'}
                          </div>

                          <div className="mt-1.5 text-[10px] truncate text-slate-300">
                            {port.name}
                          </div>
                          <div className="text-[9px] text-slate-500 tabular-nums truncate">
                            {isOperUp
                              ? `${(port.rxMbps + port.txMbps).toFixed(0)} Mbps`
                              : isAdminShut
                              ? 'SHUTDOWN'
                              : 'DOWN'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Selected Port Interactive Inspector & Control Bar */}
              {activePort && (
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Interface {activePort.name}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          {activePort.portType || `${activePort.speedMbps / 1000}Gbps`}
                        </span>
                        <span className="text-slate-400">·</span>
                        {(activePort.adminStatus ?? 'up') === 'down' ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Administratively Shut Down
                          </span>
                        ) : activePort.status === 'up' &&
                          selectedNetDevice.status !== DeviceStatus.Offline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Link UP ({activePort.rxMbps} Rx / {activePort.txMbps} Tx Mbps)
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            Link DOWN (No Carrier)
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        VLAN/Mode: {activePort.vlan}
                        {activePort.connectedToHostname
                          ? ` · Neighbor: ${activePort.connectedToHostname} (${activePort.connectedPort}) via ${activePort.protocol}`
                          : ' · Edge / Access Port'}
                        {activePort.poeWatts ? ` · PoE Draw: ${activePort.poeWatts}W` : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editVlan || activePort.vlan}
                        onChange={(e) => setEditVlan(e.target.value)}
                        placeholder="VLAN (e.g. VLAN 20)"
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-36"
                      />
                      <input
                        type="text"
                        value={editDesc || activePort.description || ''}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Port description"
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-44"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePortVlanOrDesc(
                            selectedNetDevice.id,
                            activePort.name,
                            editVlan || activePort.vlan,
                            editDesc || activePort.description || ''
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        Save Port Label/VLAN
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onTogglePortAdminStatus(selectedNetDevice.id, activePort.name)
                        }
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          (activePort.adminStatus ?? 'up') === 'down'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {(activePort.adminStatus ?? 'up') === 'down'
                            ? 'Enable Port (no shutdown)'
                            : 'Shut Down Port'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Port Telemetry Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                      <th className="py-2.5 px-4">Port Name</th>
                      <th className="py-2.5 px-4">Link State</th>
                      <th className="py-2.5 px-4">Media · Speed</th>
                      <th className="py-2.5 px-4">VLAN / Mode</th>
                      <th className="py-2.5 px-4">Connected LLDP/CDP Peer</th>
                      <th className="py-2.5 px-4 text-right">Rx / Tx (Mbps)</th>
                      <th className="py-2.5 px-4 text-right">Port Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {selectedNetDevice.interfaces.map((ifc) => {
                      const isAdminShut = (ifc.adminStatus ?? 'up') === 'down';
                      const isUp =
                        selectedNetDevice.status !== DeviceStatus.Offline &&
                        !isAdminShut &&
                        ifc.status === 'up';

                      return (
                        <tr
                          key={ifc.name}
                          onClick={() => handleSelectPort(ifc)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                            <div>{ifc.name}</div>
                            {ifc.description && (
                              <div className="text-[11px] font-sans text-slate-500">
                                {ifc.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {isUp ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>UP</span>
                              </span>
                            ) : isAdminShut ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>ADMIN SHUT</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>DOWN</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {ifc.portType || 'Ethernet'} · {ifc.speedMbps / 1000}G
                            {ifc.poeWatts ? ` · ${ifc.poeWatts}W PoE` : ''}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {ifc.vlan}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {ifc.connectedToHostname
                              ? `${ifc.connectedToHostname} (${ifc.connectedPort})`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {isUp
                              ? `${ifc.rxMbps.toFixed(1)} / ${ifc.txMbps.toFixed(1)}`
                              : '0.0 / 0.0'}
                          </td>
                          <td
                            className="py-2.5 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onTogglePortAdminStatus(selectedNetDevice.id, ifc.name)
                              }
                              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                            >
                              {isAdminShut ? 'Bring Up' : 'Shut Down'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Section 2: Enterprise Server Services & Daemon Monitoring */
        <div className="space-y-6">
          {/* Server Service Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Running Services</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {serviceTotals.running}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  Healthy TCP/Systemd
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Degraded Daemons</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-amber-600 dark:text-amber-400 tabular-nums">
                  {serviceTotals.degraded}
                </span>
                <span className="text-xs font-mono text-slate-500">High latency</span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Stopped / Failed</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-rose-600 dark:text-rose-400 tabular-nums">
                  {serviceTotals.stopped}
                </span>
                <span className="text-xs font-mono text-slate-500">Port closed</span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Monitored Servers</div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-display text-slate-900 dark:text-slate-100 tabular-nums">
                  {serverNodes.length}
                </span>
                <span className="text-xs font-mono text-slate-500">Linux · ESXi</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedServerFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      selectedServerFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    All Servers ({serverNodes.length})
                  </button>
                  {serverNodes.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedServerFilter(srv.id)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                        selectedServerFilter === srv.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {srv.hostname.split('.')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSvcTargetServerId(
                    selectedServerFilter !== 'ALL'
                      ? selectedServerFilter
                      : serverNodes[0]?.id || ''
                  );
                  setIsAddServiceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Monitored Service</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                    <th className="py-2.5 px-4">Service & Daemon Process</th>
                    <th className="py-2.5 px-4">Server Host · IP</th>
                    <th className="py-2.5 px-4">Port · Protocol</th>
                    <th className="py-2.5 px-4">Service Health</th>
                    <th className="py-2.5 px-4 text-right">CPU · Memory</th>
                    <th className="py-2.5 px-4 text-right">Response · Uptime</th>
                    <th className="py-2.5 px-4 text-right">Daemon Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {allServerServices.map(({ server, service, effectiveStatus }) => (
                    <tr
                      key={`${server.id}-${service.id}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {service.name}
                        </div>
                        <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          pid/{service.processName}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {server.hostname}
                        </div>
                        <div className="text-slate-500">{server.ip}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {service.protocol}/{service.port}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {effectiveStatus === 'running' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Running</span>
                          </span>
                        )}
                        {effectiveStatus === 'degraded' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Degraded</span>
                          </span>
                        )}
                        {effectiveStatus === 'stopped' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Stopped</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        {effectiveStatus === 'stopped' ? (
                          <span className="text-slate-400">0.0% · 0 MB</span>
                        ) : (
                          <span className="text-slate-800 dark:text-slate-200">
                            {service.cpuPct.toFixed(1)}% · {service.memoryMb.toLocaleString()} MB
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        {effectiveStatus === 'stopped' ? (
                          <span className="text-rose-600 dark:text-rose-400">Closed</span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">
                            {service.responseTimeMs} ms · {service.uptime}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {effectiveStatus === 'stopped' ? (
                            <button
                              type="button"
                              disabled={server.status === DeviceStatus.Offline}
                              onClick={() => onServiceAction(server.id, service.id, 'start')}
                              title={
                                server.status === DeviceStatus.Offline
                                  ? 'Bring server host online first'
                                  : 'Start service'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium"
                            >
                              <Play className="w-3 h-3" />
                              <span>Start</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onServiceAction(server.id, service.id, 'stop')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
                            >
                              <Square className="w-3 h-3" />
                              <span>Stop</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={server.status === DeviceStatus.Offline}
                            onClick={() => onServiceAction(server.id, service.id, 'restart')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 font-medium"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restart</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Monitored Service Modal */}
      {isAddServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Add Server Service Health Monitor
              </h2>
              <button
                type="button"
                onClick={() => setIsAddServiceModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Server Host
                </label>
                <select
                  value={svcTargetServerId}
                  onChange={(e) => setSvcTargetServerId(e.target.value)}
                  className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {serverNodes.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.hostname} ({srv.ip})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Service Display Name
                </label>
                <input
                  type="text"
                  required
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  placeholder="e.g. NGINX Reverse Proxy, MySQL 8.0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Process Name
                  </label>
                  <input
                    type="text"
                    value={svcProcess}
                    onChange={(e) => setSvcProcess(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Protocol
                  </label>
                  <select
                    value={svcProtocol}
                    onChange={(e) =>
                      setSvcProtocol(e.target.value as 'TCP' | 'UDP' | 'HTTPS' | 'gRPC')
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="TCP">TCP</option>
                    <option value="HTTPS">HTTPS</option>
                    <option value="UDP">UDP</option>
                    <option value="gRPC">gRPC</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={svcPort}
                    onChange={(e) => setSvcPort(Number(e.target.value) || 8080)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddServiceModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Start Monitoring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
