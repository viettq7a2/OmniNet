import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  DeviceRole,
  DeviceStatus,
  NetworkDevice,
  VendorName,
} from '../types/network';

interface AssetInventoryViewProps {
  devices: NetworkDevice[];
  onSelectDevice: (device: NetworkDevice) => void;
  onAddDevice: (device: NetworkDevice) => void;
  onUpdateDevice: (device: NetworkDevice) => void;
  onDeleteDevice: (deviceId: string) => void;
}

const VENDORS: VendorName[] = [
  'Cisco IOS-XE',
  'Cisco NX-OS',
  'Fortinet',
  'Palo Alto',
  'Juniper',
  'MikroTik',
  'Aruba',
  'Linux / Server',
];

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Down (0d 0h)';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export const AssetInventoryView: React.FC<AssetInventoryViewProps> = ({
  devices,
  onSelectDevice,
  onAddDevice,
  onUpdateDevice,
  onDeleteDevice,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | DeviceRole>('ALL');
  const [vendorFilter, setVendorFilter] = useState<'ALL' | VendorName>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal state for Add / Edit Asset
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);

  const [formHostname, setFormHostname] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formMac, setFormMac] = useState('00:50:56:AA:11:22');
  const [formVendor, setFormVendor] = useState<VendorName>('Cisco IOS-XE');
  const [formModel, setFormModel] = useState('');
  const [formOsVersion, setFormOsVersion] = useState('');
  const [formRole, setFormRole] = useState<DeviceRole>(DeviceRole.Switch);
  const [formSite, setFormSite] = useState('HN-DC1 Core');
  const [formRack, setFormRack] = useState('Rack A04 · RU 20');
  const [formSerial, setFormSerial] = useState('');
  const [formAssetTag, setFormAssetTag] = useState('');
  const [formDepartment, setFormDepartment] = useState('Network Infrastructure');
  const [formWarranty, setFormWarranty] = useState('2029-12-31');

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormHostname('sw-branch-04.corp.local');
    setFormIp('10.30.10.12');
    setFormMac('00:50:56:BC:30:12');
    setFormVendor('Cisco IOS-XE');
    setFormModel('Catalyst 9300-24T');
    setFormOsVersion('IOS-XE 17.9.4a');
    setFormRole(DeviceRole.Switch);
    setFormSite('DN-Branch Edge');
    setFormRack('Rack C02 · RU 14');
    setFormSerial(`FDO${Math.floor(100000 + Math.random() * 900000)}X`);
    setFormAssetTag(`AST-NET-00${Math.floor(500 + Math.random() * 499)}`);
    setFormDepartment('Campus LAN');
    setFormWarranty('2029-06-30');
    setIsModalOpen(true);
  };

  const openEditModal = (device: NetworkDevice) => {
    setEditingDevice(device);
    setFormHostname(device.hostname);
    setFormIp(device.ip);
    setFormMac(device.mac);
    setFormVendor(device.vendor);
    setFormModel(device.model);
    setFormOsVersion(device.osVersion);
    setFormRole(device.role);
    setFormSite(device.site);
    setFormRack(device.rack);
    setFormSerial(device.serialNumber);
    setFormAssetTag(device.assetTag);
    setFormDepartment(device.department);
    setFormWarranty(device.warrantyExpiry);
    setIsModalOpen(true);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHostname.trim() || !formIp.trim()) return;

    if (editingDevice) {
      onUpdateDevice({
        ...editingDevice,
        hostname: formHostname.trim(),
        ip: formIp.trim(),
        mac: formMac.trim(),
        vendor: formVendor,
        model: formModel.trim(),
        osVersion: formOsVersion.trim(),
        role: formRole,
        site: formSite,
        rack: formRack.trim(),
        serialNumber: formSerial.trim(),
        assetTag: formAssetTag.trim(),
        department: formDepartment.trim(),
        warrantyExpiry: formWarranty,
      });
    } else {
      const tier =
        formRole === DeviceRole.Firewall
          ? 0
          : formRole === DeviceRole.Router
          ? 1
          : formRole === DeviceRole.Switch || formRole === DeviceRole.Wireless
          ? 2
          : 3;

      const defaultCfg = `# ${formVendor} (${formOsVersion}) — ${formHostname}\nhostname ${formHostname.split('.')[0]}\nntp server 10.10.0.10 prefer\nlogging host 10.10.0.50\nssh version 2`;

      const created: NetworkDevice = {
        id: `dev-manual-${Date.now()}`,
        hostname: formHostname.trim(),
        ip: formIp.trim(),
        mac: formMac.trim(),
        vendor: formVendor,
        model: formModel.trim() || `${formVendor} Appliance`,
        osVersion: formOsVersion.trim() || 'v1.0',
        role: formRole,
        status: DeviceStatus.Online,
        site: formSite,
        rack: formRack.trim(),
        serialNumber: formSerial.trim() || 'SN-MANUAL',
        assetTag: formAssetTag.trim() || 'AST-MANUAL',
        department: formDepartment.trim() || 'IT Operations',
        purchaseDate: new Date().toISOString().slice(0, 10),
        warrantyExpiry: formWarranty,
        uptimeSeconds: 86400,
        cpuLoad: 19,
        memoryUsage: 36,
        tempCelsius: 37,
        inboundMbps: 164.0,
        outboundMbps: 128.5,
        latencyMs: 2.3,
        packetLossPct: 0,
        openPorts: [22, 443],
        discoveryMethod: 'Manual CMDB',
        lastSeen: 'Just now',
        topologyTier: tier,
        interfaces: [
          {
            name: 'Gi0/1 (Core-Uplink)',
            status: 'up',
            speedMbps: 10000,
            vlan: 'Trunk 10,20',
            rxMbps: 164.0,
            txMbps: 128.5,
            connectedToId: 'dev-sw-01',
            connectedToHostname: 'sw-core-nx01.corp.local',
            connectedPort: 'Eth1/24',
            protocol: 'LLDP',
          },
        ],
        runningConfig: defaultCfg,
        goldenBaselineConfig: defaultCfg,
        configHistory: [
          {
            id: `rev-man-${Date.now()}`,
            versionLabel: 'v1 (Initial Onboarding)',
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            author: 'it-asset-mgr',
            summary: 'Manual CMDB registration & baseline config',
            content: defaultCfg,
          },
        ],
      };
      onAddDevice(created);
    }

    setIsModalOpen(false);
  };

  const filteredAssets = useMemo(() => {
    return devices.filter((d) => {
      if (roleFilter !== 'ALL' && d.role !== roleFilter) return false;
      if (vendorFilter !== 'ALL' && d.vendor !== vendorFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.hostname.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.serialNumber.toLowerCase().includes(q) ||
        d.assetTag.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.department.toLowerCase().includes(q)
      );
    });
  }, [devices, roleFilter, vendorFilter, search]);

  const exportInventoryCsv = () => {
    const headers = [
      'AssetTag',
      'Hostname',
      'IP',
      'MAC',
      'Vendor',
      'Model',
      'OSVersion',
      'Role',
      'Status',
      'Site',
      'Rack',
      'SerialNumber',
      'Department',
      'WarrantyExpiry',
    ];
    const rows = filteredAssets.map((d) =>
      [
        d.assetTag,
        d.hostname,
        d.ip,
        d.mac,
        d.vendor,
        d.model,
        d.osVersion,
        d.role,
        d.status,
        d.site,
        d.rack,
        d.serialNumber,
        d.department,
        d.warrantyExpiry,
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netvista-cmdb-assets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Enterprise IT Asset Inventory (CMDB)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Lifecycle tracking, serial numbers, rack locations, firmware versions, and warranty coverage for all network hardware
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportInventoryCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['ALL', ...Object.values(DeviceRole)] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    roleFilter === r
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r}
                </button>
              ))}
            </div>

            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value as 'ALL' | VendorName)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Vendors</option>
              {VENDORS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter asset tag, serial, host, IP..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                <th className="py-2.5 px-4">Asset Tag · Serial</th>
                <th className="py-2.5 px-4">Hostname · Network</th>
                <th className="py-2.5 px-4">Vendor · Hardware Model</th>
                <th className="py-2.5 px-4">Site · Rack Position</th>
                <th className="py-2.5 px-4">Owner · Warranty</th>
                <th className="py-2.5 px-4">State · Uptime</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => onSelectDevice(asset)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {asset.assetTag}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">{asset.serialNumber}</div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {asset.hostname}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {asset.ip} · {asset.mac}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {asset.vendor} · {asset.role}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {asset.model} · {asset.osVersion}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-slate-800 dark:text-slate-200">{asset.site}</div>
                    <div className="text-slate-500 dark:text-slate-400">{asset.rack}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-slate-800 dark:text-slate-200">{asset.department}</div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Exp {asset.warrantyExpiry}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {asset.status === DeviceStatus.Online && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {asset.status === DeviceStatus.Warning && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                      {asset.status === DeviceStatus.Offline && (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                        {asset.status}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      {formatUptime(asset.uptimeSeconds)}
                    </div>
                  </td>
                  <td
                    className="py-3 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {confirmDeleteId === asset.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteDevice(asset.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(asset)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(asset.id)}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900 transition-colors"
                          title="Remove asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingDevice ? `Edit Asset — ${editingDevice.assetTag}` : 'Register Network Hardware Asset'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hostname (FQDN)
                  </label>
                  <input
                    type="text"
                    required
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
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
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hardware Vendor
                  </label>
                  <select
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value as VendorName)}
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
                    Device Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as DeviceRole)}
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
                    Hardware Model
                  </label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    OS / Firmware Version
                  </label>
                  <input
                    type="text"
                    value={formOsVersion}
                    onChange={(e) => setFormOsVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Asset Tag
                  </label>
                  <input
                    type="text"
                    value={formAssetTag}
                    onChange={(e) => setFormAssetTag(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data Center / Site
                  </label>
                  <select
                    value={formSite}
                    onChange={(e) => setFormSite(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="HN-DC1 Core">HN-DC1 Core</option>
                    <option value="SGN-Campus HQ">SGN-Campus HQ</option>
                    <option value="DN-Branch Edge">DN-Branch Edge</option>
                    <option value="External / WAN Edge">External / WAN Edge</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rack & RU Location
                  </label>
                  <input
                    type="text"
                    value={formRack}
                    onChange={(e) => setFormRack(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department Owner
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Warranty Expiration
                  </label>
                  <input
                    type="date"
                    value={formWarranty}
                    onChange={(e) => setFormWarranty(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {editingDevice ? 'Save Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
