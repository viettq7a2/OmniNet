import React, { useState } from 'react';
import {
  Bot,
  Download,
  HelpCircle,
  Lock,
  Monitor,
  Network,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { OmniNetLogo } from './OmniNetLogo';
import { AppLanguage } from '../utils/i18n';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose?: () => void;
  lang?: AppLanguage;
}

type GuideSectionId =
  | 'legacy-devices'
  | 'quickstart'
  | 'discovery-topology'
  | 'config-datasheet'
  | 'ai-rca'
  | 'deploy-update';

export const OMNINET_MANUAL_MARKDOWN = `# SỔ TAY HƯỚNG DẪN SỬ DỤNG HỆ THỐNG OMNINET ENTERPRISE NCM
Phiên bản: v3.5 (Windows Desktop/Server & Docker Container Edition)

## 1. XỬ LÝ THIẾT BỊ ĐỜI CŨ (LEGACY FALLBACK)
- Không có SNMPv3: Bật SNMPv2c Read-Only kèm ACL khóa IP máy chủ OmniNet.
- Không có SSHv2: Hỗ trợ Telnet khóa ACL hoặc Legacy SSHv1 KEX (+diffie-hellman-group1-sha1).
- Không có LLDP: Kết hợp CDP + bảng MAC/ARP từ Core Switch hoặc vẽ liên kết thủ công trên Topology.
- Thiết bị chỉ có Web HTTP: Giám sát bằng Live TCP Socket & HTTP Banner Probe.
`;

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, lang = 'vi' }) => {
  const isVi = lang === 'vi';
  const [activeSection, setActiveSection] = useState<GuideSectionId>('legacy-devices');

  if (!isOpen) return null;

  const handleDownloadManual = () => {
    const blob = new Blob([OMNINET_MANUAL_MARKDOWN], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isVi ? 'So-Tay-Huong-Dan-OmniNet.md' : 'OmniNet-Operator-Manual.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sections: {
    id: GuideSectionId;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'legacy-devices',
      title: isVi ? '1. Xử lý Thiết bị Cũ (Legacy)' : '1. Legacy Device Fallback',
      icon: ShieldAlert,
    },
    {
      id: 'quickstart',
      title: isVi ? '2. Bảo mật 2FA & AI Zero-Key' : '2. 2FA & Zero-Key AI SSO',
      icon: Lock,
    },
    {
      id: 'discovery-topology',
      title: isVi ? '3. Quét Mạng & Vẽ Topology' : '3. Discovery & Topology Studio',
      icon: Network,
    },
    {
      id: 'config-datasheet',
      title: isVi ? '4. Cấu hình Đa hãng & Datasheet' : '4. Multi-Vendor Config & Datasheet',
      icon: Sliders,
    },
    {
      id: 'ai-rca',
      title: isVi ? '5. Chẩn đoán AI RCA & Auto-Fix' : '5. AI RCA & Auto-Remediation',
      icon: Bot,
    },
    {
      id: 'deploy-update',
      title: isVi ? '6. Chạy Windows / Docker & Update' : '6. Windows / Docker & Updates',
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Clean Inline Header (No X close button, no verbose subtitle) */}
        <div className="px-5 py-3.5 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OmniNetLogo size={34} variant="icon" />
            <h1 className="text-base font-bold tracking-tight text-white">
              {isVi
                ? 'Sổ Tay Hướng Dẫn Vận Hành & Giải Pháp Thiết Bị Đời Cũ'
                : 'Operator Guide & Legacy Device Integration'}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleDownloadManual}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isVi ? 'Tải Sổ Tay (.MD)' : 'Download Manual (.MD)'}</span>
          </button>
        </div>

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Left Chapter Navigation */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
            <div className="text-[11px] font-mono uppercase text-slate-400 px-2 pb-1">
              {isVi ? 'Mục lục hướng dẫn' : 'Documentation Chapters'}
            </div>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}

            <div className="mt-4 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-1">
              <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>{isVi ? 'Mẹo vận hành nhanh' : 'Quick Operator Tip'}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {isVi
                  ? 'Bấm nút tròn Trợ lý AI ở góc dưới bên phải để tra cứu lệnh CLI hoặc tự động sửa lỗi kết nối.'
                  : 'Click the circular AI Copilot button at the bottom-right from any tab for instant CLI help or automated fixes.'}
              </p>
            </div>
          </div>

          {/* Right Chapter Content */}
          <div className="lg:col-span-8 p-6 space-y-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs leading-relaxed">
            {activeSection === 'legacy-devices' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isVi
                    ? '1. Giải pháp kết nối Thiết bị mạng đời cũ (Legacy Fallback 4 cấp độ)'
                    : '1. Connecting Legacy Network Devices (4-Tier Fallback Architecture)'}
                </h3>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-blue-600 dark:text-sky-400 text-sm">
                      {isVi
                        ? 'Trường hợp 1: Chỉ có SNMPv1 / SNMPv2c (Không có SNMPv3)'
                        : 'Case 1: SNMPv1 / SNMPv2c Only (No SNMPv3 Support)'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Bật SNMPv2c Read-Only (RO) kèm Access-List (ACL) chỉ cho phép duy nhất IP máy chủ OmniNet truy cập.'
                        : 'Enable SNMPv2c Read-Only (RO) restricted by an Access-List (ACL) permitting only the OmniNet server IP.'}
                    </p>
                    <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`access-list 10 permit 10.10.0.50
snmp-server community OMNINET_RO_2026 RO 10`}
                    </pre>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {isVi
                        ? 'Trường hợp 2: Chỉ có Telnet hoặc SSHv1 KEX cũ (Không có SSHv2)'
                        : 'Case 2: Telnet or Legacy SSHv1 KEX Only (No SSHv2)'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Khóa chặt cổng Telnet bằng ACL chỉ nhận IP máy chủ OmniNet, hoặc dùng Legacy KEX Bridge (+diffie-hellman-group1-sha1) để sao lưu cấu hình.'
                        : 'Lock VTY Telnet lines with an IP ACL to the OmniNet server, or use the built-in Legacy SSH KEX Bridge (+diffie-hellman-group1-sha1).'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {isVi
                        ? 'Trường hợp 3: Không có LLDP (Chỉ có CDP hoặc Switch Unmanaged)'
                        : 'Case 3: No LLDP Support (CDP Only or Unmanaged Switches)'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'OmniNet đối chiếu bảng MAC (show mac address-table) và bảng ARP (show ip arp) từ Core Switch thượng nguồn, hoặc cho phép nối dây trực tiếp trong Topology Studio.'
                        : 'OmniNet correlates upstream Core Switch MAC tables (show mac address-table) with ARP tables (show ip arp), or lets you link nodes directly in Topology Studio.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                      {isVi
                        ? 'Trường hợp 4: Thiết bị chỉ có giao diện Web (Smart-Managed) / Camera IP / Server'
                        : 'Case 4: Web-Only Smart Switches, IP Cameras & Appliances'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Sử dụng Live TCP Socket & HTTP Banner Probe (kiểm tra cổng 80, 443, 22, 554, 9100...) để giám sát trạng thái Online/Offline và độ trễ (ms).'
                        : 'Use Live TCP Socket & HTTP Banner Probing (ports 80, 443, 22, 554, 9100...) to monitor real-time availability and RTT latency.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'quickstart' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  {isVi
                    ? '2. Bảo mật 2 Bước (2FA) & Trợ lý AI Zero-API-Key'
                    : '2. Two-Factor Authentication (2FA) & Zero-API-Key AI'}
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      {isVi
                        ? 'Bước 1: Xác thực Google Authenticator (TOTP)'
                        : 'Step 1: Google Authenticator (RFC 6238 TOTP)'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Quét mã QR bằng ứng dụng Google Authenticator trên điện thoại và nhập mã 6 số đổi mới mỗi 30 giây (hoặc bấm nút Điền nhanh mã OTP khi thử nghiệm).'
                        : 'Scan the QR code with Google Authenticator and enter the 6-digit TOTP code (or click Auto-Fill OTP during lab testing).'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      {isVi
                        ? 'Bước 2: Kết nối SSO Tài khoản AI (Không cần API Key)'
                        : 'Step 2: Zero-API-Key Multi-AI SSO Relay'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Chọn Google Gemini, OpenAI ChatGPT, Anthropic Claude hoặc DeepSeek qua cổng SSO mà không cần nhập API Key thủ công.'
                        : 'Connect Google Gemini, OpenAI ChatGPT, Anthropic Claude, or DeepSeek via OAuth SSO without managing manual API keys.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'discovery-topology' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  {isVi
                    ? '3. Quét Mạng (Discovery) & Sơ đồ Topology Tương tác'
                    : '3. Network Discovery & Interactive Topology Studio'}
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      {isVi ? 'A. Quét Subnet CIDR & Live Probe' : 'A. Subnet CIDR & Live Host Probe'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Quét tự động toàn dải mạng hoặc kiểm tra cổng TCP thực tế, đồng thời sinh sẵn đoạn lệnh CLI chuẩn để dán vào Switch/Router/Firewall.'
                        : 'Scan entire CIDR subnets or probe live TCP sockets/DNS, with ready-to-paste onboarding CLI scripts for 8 vendor families.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      {isVi
                        ? 'B. Kéo-thả mượt trên Topology, Gộp cổng LAG & Ghi chú (Add Note)'
                        : 'B. Smooth Canvas Dragging, LAG Bundles & Sticky Notes'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Nhấp chuột phải vào bất kỳ Node, đường cáp hoặc nền bản đồ để Thêm Ghi chú (Add Note), Gộp 2x/4x dây LACP (LAG Bundle), và xem tia sáng lưu lượng chạy mượt theo thời gian thực.'
                        : 'Right-click any node, cable, or canvas background to Add Note, configure 2x/4x LACP Port-Channel bundles, and inspect animated real-time optical traffic pulses.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'config-datasheet' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  {isVi
                    ? '4. Cấu hình Đa hãng & Đồng bộ Datasheet CLI theo OS'
                    : '4. Multi-Vendor Config Hub & OS Datasheet Sync'}
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      {isVi
                        ? 'Biên dịch CLI Đa hãng & Kiểm tra Lệch Chuẩn (Golden Baseline)'
                        : 'Multi-Vendor CLI Transpiler & Golden Baseline Drift'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {isVi
                        ? 'Cấu hình VLAN, ACL, BGP/OSPF bằng giao diện trực quan hoặc đẩy cấu hình đồng loạt cho 10 hãng; khôi phục cấu hình chuẩn chỉ với 1 chạm.'
                        : 'Configure VLANs, ACLs, and routing visually or push batch CLI across 10 vendor OS dialects with 1-click Golden Baseline rollback.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ai-rca' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  {isVi
                    ? '5. Chẩn đoán Nguyên nhân Gốc bằng AI (AI RCA)'
                    : '5. Autonomous AI Root-Cause Analysis (RCA)'}
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-600 dark:text-slate-300">
                    {isVi
                      ? 'Phân tích sự cố từ tầng Vật lý (L1) đến Ứng dụng (L7), khoanh vùng phạm vi ảnh hưởng (Blast Radius) và tự động đẩy kịch bản CLI khắc phục.'
                      : 'Correlates telemetry from Physical (L1) to Application (L7), maps topology blast radius, and executes automated CLI remediation.'}
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'deploy-update' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  {isVi
                    ? '6. Triển khai Thực tế trên Windows / Docker & Sao lưu'
                    : '6. Windows / Docker Production Deployment & Backup'}
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-600 dark:text-slate-300">
                    {isVi
                      ? 'Mở menu "Bộ cài Windows & Docker" ở thanh bên trái để tải script chạy trực tiếp trên Windows (.bat/.ps1), Docker Compose, và xuất file sao lưu toàn hệ thống (.JSON).'
                      : 'Open "Windows & Docker Setup" in the left sidebar to download native Windows launchers (.bat/.ps1), Docker Compose files, and full JSON snapshots.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
