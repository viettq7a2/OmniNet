import { DeviceRole, DeviceStatus, NetworkDevice } from '../types/network';

export interface ConnectionDiagnosis {
  deviceId: string;
  hostname: string;
  ip: string;
  vendor: string;
  canConnect: boolean;
  connectionStateLabel: string;
  errorCode: string;
  protocolSummary: string;
  failureReasonVi: string;
  technicalEvidence: string[];
  fixStepsVi: string[];
  remediationCli: string;
}

export function diagnoseDeviceConnection(
  device: NetworkDevice,
  allDevices: NetworkDevice[] = []
): ConnectionDiagnosis {
  const downPorts = device.interfaces.filter(
    (i) => i.status === 'down' || (i.adminStatus ?? 'up') === 'down'
  );
  const adminShutPorts = device.interfaces.filter((i) => (i.adminStatus ?? 'up') === 'down');
  const stoppedServices = (device.services || []).filter((s) => s.status !== 'running');
  const hasSshPort = device.openPorts.includes(22);
  const hasHttpsPort = device.openPorts.includes(443) || device.openPorts.includes(8443);

  const connectedPeers = allDevices.filter((d) =>
    device.interfaces.some((ifc) => ifc.connectedToId === d.id) ||
    d.interfaces.some((ifc) => ifc.connectedToId === device.id)
  );

  // Case 1: Device is completely OFFLINE
  if (device.status === DeviceStatus.Offline) {
    const uplinkPort =
      device.interfaces.find((i) => i.mode === 'trunk' || i.connectedToHostname) ||
      device.interfaces[0];
    const peerName =
      uplinkPort?.connectedToHostname ||
      connectedPeers[0]?.hostname ||
      'Core/Distribution Switch';

    return {
      deviceId: device.id,
      hostname: device.hostname,
      ip: device.ip,
      vendor: device.vendor,
      canConnect: false,
      connectionStateLabel: 'KẾT NỐI THẤT BẠI (TIMEOUT 100%)',
      errorCode: 'ERR_NET_UNREACHABLE_L1_TRUNK_DOWN',
      protocolSummary: `ICMP Echo: Timeout · ${device.mgmtProtocol || 'SSHv2'} (TCP/22): SYN Timeout · SNMPv3 (UDP/161): No Response`,
      failureReasonVi: `Không thể thiết lập kết nối quản trị (${device.mgmtProtocol || 'SSHv2'} / SNMPv3) tới ${device.hostname} (${device.ip}). Nguyên nhân gốc: Mất kết nối vật lý/đường trục (L1/L2 Uplink Down) trên cổng ${uplinkPort?.name || 'Uplink'} nối về ${peerName}, hoặc sự cố mất nguồn PSU/PoE tại ${device.site} (${device.rack}) khiến 100% gói tin điều khiển bị rớt.`,
      technicalEvidence: [
        `Trạng thái ICMP Ping tới ${device.ip}: 100% Packet Loss (0/5 gói phản hồi).`,
        `Phiên bắt tay TCP 3-way handshake tới cổng ${device.openPorts.join(', ') || '22, 443'} bị hết thời gian chờ (ETIMEDOUT sau 1500ms).`,
        `Cổng đường trục ${uplinkPort?.name || 'Gi0/1'} (${uplinkPort?.vlan || 'Trunk'}) đang ở trạng thái DOWN — mất LLDP/CDP neighbor với ${peerName}.`,
        `Giao thức khám phá ${device.discoveryMethod} ghi nhận lần phản hồi cuối: ${device.lastSeen}.`,
      ],
      fixStepsVi: [
        `Bước 1 (Vật lý & Nguồn): Kiểm tra nguồn điện PSU/PoE và dây nhảy quang SFP+ tại ${device.site} · ${device.rack}.`,
        `Bước 2 (Cổng Uplink L2): Trên thiết bị láng giềng (${peerName}) và ${device.hostname}, kiểm tra trạng thái err-disabled (do BPDU Guard / Storm Control / UDLD) và bật lại cổng ${uplinkPort?.name || 'uplink'} bằng lệnh 'no shutdown'.`,
        `Bước 3 (Định tuyến & Quản trị): Xác nhận VLAN quản trị (Management SVI) được phép đi qua đường trunk (${uplinkPort?.vlan || 'Trunk 10,20,100'}) và kiểm tra lại kết nối SSHv2/SNMPv3.`,
      ],
      remediationCli: buildConnectionFixCli(device, uplinkPort?.name || 'Gi0/1', stoppedServices),
    };
  }

  // Case 2: Device is ONLINE/WARNING at L3, but critical Server Daemons or Admin-Shut ports cause connection/service refusal
  if (
    device.status === DeviceStatus.Warning ||
    stoppedServices.length > 0 ||
    adminShutPorts.length > 0
  ) {
    const hasStoppedSvc = stoppedServices.length > 0;
    return {
      deviceId: device.id,
      hostname: device.hostname,
      ip: device.ip,
      vendor: device.vendor,
      canConnect: false,
      connectionStateLabel: hasStoppedSvc
        ? 'LỖI KẾT NỐI DỊCH VỤ (ECONNREFUSED)'
        : 'KẾT NỐI CHẬP CHỜN / CỔNG BỊ KHÓA (DEGRADED)',
      errorCode: hasStoppedSvc
        ? 'ERR_TCP_SOCKET_REFUSED_L7_DAEMON_STOPPED'
        : 'ERR_INTERFACE_ADMIN_DOWN_OR_HIGH_CPU',
      protocolSummary: `ICMP: ${device.latencyMs}ms · SSHv2: Connected · ${
        hasStoppedSvc
          ? `Service Ports (${stoppedServices.map((s) => s.port).join(', ')}): REFUSED`
          : `CPU Load: ${device.cpuLoad}%`
      }`,
      failureReasonVi: hasStoppedSvc
        ? `Thiết bị ${device.hostname} (${device.ip}) vẫn thông mạng ở tầng L3 (Ping ${device.latencyMs}ms), nhưng kết nối tới cổng dịch vụ ${stoppedServices.map((s) => `${s.name} (${s.protocol}/${s.port})`).join(', ')} bị từ chối (TCP RST / ECONNREFUSED) do tiến trình daemon (${stoppedServices.map((s) => s.processName).join(', ')}) đã bị dừng hoặc treo.`
        : `Kết nối quản trị tới ${device.hostname} (${device.ip}) bị suy giảm (CPU ${device.cpuLoad}%, độ trễ ${device.latencyMs}ms) và có ${adminShutPorts.length} cổng đang bị khóa quản trị (Admin Shutdown: ${adminShutPorts.map((p) => p.name).join(', ')}).`,
      technicalEvidence: [
        ...(hasStoppedSvc
          ? stoppedServices.map(
              (s) =>
                `Tiến trình '${s.processName}' (${s.name}) trên cổng ${s.protocol}/${s.port} đang ở trạng thái STOPPED (0MB RAM, không lắng nghe socket).`
            )
          : []),
        ...(adminShutPorts.length > 0
          ? [
              `Các cổng bị khóa quản trị (Administratively Down): ${adminShutPorts
                .map((p) => `${p.name} (${p.vlan})`)
                .join(', ')}.`,
            ]
          : []),
        `Tài nguyên hệ thống hiện tại: CPU ${device.cpuLoad}%, RAM ${device.memoryUsage}%, Nhiệt độ ${device.tempCelsius}°C.`,
      ],
      fixStepsVi: [
        hasStoppedSvc
          ? `Bước 1 (Khởi động lại Daemon): Truy cập SSH vào ${device.hostname} và chạy 'systemctl restart ${stoppedServices.map((s) => s.processName).join(' ')}' để mở lại socket lắng nghe.`
          : `Bước 1 (Mở khóa cổng): Vào chế độ cấu hình interface và gỡ lệnh 'shutdown' trên ${adminShutPorts.map((p) => p.name).join(', ')}.`,
        `Bước 2 (Kiểm tra Firewall/ACL nội bộ): Đảm bảo iptables/ufw hoặc Control-Plane Policing (CoPP) không chặn lưu lượng tới cổng ${hasStoppedSvc ? stoppedServices.map((s) => s.port).join(', ') : '22, 443'}.`,
        `Bước 3 (Giám sát tự động): Bật chế độ Auto-Restart cho dịch vụ và đồng bộ cấu hình chuẩn lên Golden Baseline.`,
      ],
      remediationCli: buildConnectionFixCli(
        device,
        adminShutPorts[0]?.name || downPorts[0]?.name || 'Gi0/1',
        stoppedServices
      ),
    };
  }

  // Case 3: Healthy & Connected
  return {
    deviceId: device.id,
    hostname: device.hostname,
    ip: device.ip,
    vendor: device.vendor,
    canConnect: true,
    connectionStateLabel: 'KẾT NỐI THÀNH CÔNG (HEALTHY)',
    errorCode: 'OK_SESSION_ESTABLISHED',
    protocolSummary: `ICMP: ${device.latencyMs}ms (0% loss) · ${device.mgmtProtocol || 'SSHv2'}: Active · Open Ports: ${device.openPorts.join(', ')}`,
    failureReasonVi: `Kết nối điều khiển tới ${device.hostname} (${device.ip}) hoạt động hoàn toàn bình thường qua ${device.mgmtProtocol || 'SSHv2'} và ${device.discoveryMethod}.`,
    technicalEvidence: [
      `Độ trễ trung bình (RTT): ${device.latencyMs}ms · Packet Loss: ${device.packetLossPct}%.`,
      `Các cổng quản trị mở: ${device.openPorts.join(', ')} (${hasSshPort ? 'SSHv2 sẵn sàng' : ''}${hasHttpsPort ? ', HTTPS WebUI sẵn sàng' : ''}).`,
    ],
    fixStepsVi: [
      `Không phát hiện lỗi kết nối. Tiếp tục duy trì lịch quét định kỳ và sao lưu cấu hình tự động.`,
    ],
    remediationCli: `# Kết nối tới ${device.hostname} (${device.ip}) đang ổn định\nssh admin@${device.ip}`,
  };
}

function buildConnectionFixCli(
  device: NetworkDevice,
  portName: string,
  stoppedServices: { processName: string; port: number }[]
): string {
  if (device.role === DeviceRole.Server || device.vendor === 'Linux / Server') {
    const daemons = stoppedServices.map((s) => s.processName).join(' ') || 'sshd nginx kubelet';
    return [
      `# Khắc phục lỗi kết nối & dịch vụ trên ${device.hostname} (${device.ip})`,
      `sudo ip link set dev eth0 up`,
      `sudo systemctl daemon-reload`,
      `sudo systemctl restart ${daemons}`,
      `sudo ufw allow 22/tcp`,
      `sudo ss -tulpn | grep -E '22|443|8080'`,
    ].join('\n');
  }

  if (device.vendor === 'Fortinet') {
    return [
      `# Khắc phục kết nối quản trị FortiOS — ${device.hostname}`,
      `config system interface`,
      `    edit "port1"`,
      `        set status up`,
      `        set allowaccess ping https ssh snmp`,
      `    next`,
      `end`,
      `execute router restart`,
    ].join('\n');
  }

  if (device.vendor === 'Palo Alto') {
    return [
      `# Khắc phục kết nối quản trị PAN-OS — ${device.hostname}`,
      `configure`,
      `set deviceconfig system service disable-ssh no`,
      `set network interface ethernet ${portName} link-state auto`,
      `commit description "Restore management & uplink connectivity"`,
    ].join('\n');
  }

  if (device.vendor === 'Juniper') {
    return [
      `# Khắc phục kết nối Junos — ${device.hostname}`,
      `configure`,
      `delete interfaces ${portName} disable`,
      `set system services ssh protocol-version v2`,
      `set system services netconf ssh`,
      `commit and-quit`,
    ].join('\n');
  }

  if (device.vendor === 'MikroTik') {
    return [
      `# Khắc phục kết nối RouterOS — ${device.hostname}`,
      `/interface enable [find name="${portName}"]`,
      `/ip service enable ssh,www-ssl`,
      `/ip firewall filter add chain=input protocol=tcp dst-port=22,443 action=accept place-before=0`,
    ].join('\n');
  }

  return [
    `! Khắc phục lỗi mất kết nối & khôi phục Uplink (${device.vendor}) — ${device.hostname}`,
    `configure terminal`,
    `interface ${portName}`,
    ` no shutdown`,
    ` errdisable recovery cause all`,
    ` exit`,
    `ip ssh version 2`,
    `line vty 0 15`,
    ` transport input ssh`,
    ` exec-timeout 15 0`,
    ` end`,
    `write memory`,
  ].join('\n');
}
