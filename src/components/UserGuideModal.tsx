import React, { useState } from 'react';
import {
  BookOpen,
  Bot,
  Cable,
  CheckCircle2,
  Cpu,
  Download,
  HelpCircle,
  Layers,
  Lock,
  Monitor,
  Network,
  Radar,
  ShieldAlert,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import { OmniNetLogo } from './OmniNetLogo';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideSectionId =
  | 'quickstart'
  | 'legacy-devices'
  | 'discovery-topology'
  | 'config-datasheet'
  | 'ai-rca'
  | 'deploy-update';

export const OMNINET_MANUAL_MARKDOWN = `# SỔ TAY HƯỚNG DẪN SỬ DỤNG HỆ THỐNG OMNINET ENTERPRISE NCM
Phiên bản: v3.5 (Windows Desktop/Server & Docker Container Edition)

---

## CHƯƠNG 1: ĐĂNG NHẬP BẢO MẬT 2 BƯỚC (2FA) & KẾT NỐI TRỢ LÝ AI (ZERO-API-KEY)
1. Nhấn nút **"<user> · 2FA & AI SSO"** trên thanh công cụ trên cùng (hoặc menu bên trái).
2. **Bước 1 (Tài khoản OmniNet + Google Authenticator):**
   - Quét mã QR hoặc nhập khóa Secret TOTP vào ứng dụng Google Authenticator trên điện thoại.
   - Nhập mã 6 chữ số (hoặc bấm nút "Điền nhanh mã TOTP hiện tại" khi chạy thử nghiệm) -> Bấm Xác thực.
3. **Bước 2 (Tài khoản AI Kỹ sư Mạng - Không cần API Key):**
   - Chọn mô hình AI mong muốn: **Google Gemini**, **OpenAI ChatGPT**, **Anthropic Claude**, hoặc **DeepSeek**.
   - Hệ thống hoạt động ở chế độ **Zero-API-Key Cloud Relay**, kỹ sư không cần tự tạo hay nhập khóa API Key thủ công.

---

## CHƯƠNG 2: KẾT NỐI THIẾT BỊ MẠNG (HIỆN ĐẠI & THIẾT BỊ ĐỜI CŨ / LEGACY)

### 2.1. Với thiết bị đời mới (Cisco IOS-XE/NX-OS, Aruba AOS-CX, HPE Comware v7, UniFi, FortiGate):
- Mở 4 giao thức chuẩn: **SNMPv3** (UDP 161), **LLDP/CDP** (Layer 2), **SSHv2** (TCP 22), và **Syslog** (UDP 514).
- Vào tab **Network Discovery** -> Kéo xuống mục **"Hướng dẫn & Sinh Lệnh Cấu Hình Trên Thiết Bị Thật"** để copy lệnh mẫu theo từng hãng.

### 2.2. Giải pháp cho THIẾT BỊ ĐỜI CŨ (Legacy) không có đủ giao thức:
1. **Không có SNMPv3 (Chỉ có SNMPv1 / SNMPv2c):**
   - Bật SNMPv2c Read-Only (\`snmp-server community <ten-chuoi> RO\`) kèm ACL chỉ cho phép IP máy chủ OmniNet truy cập.
2. **Không có SSHv2 (Chỉ có Telnet, SSHv1 cũ, hoặc chỉ có giao diện Web HTTP):**
   - Với Switch cũ chỉ có Telnet (như Cisco 2950/2960 K8 non-crypto, HP ProCurve cũ): Bật Telnet giới hạn chặt bằng ACL chỉ nhận kết nối từ IP của OmniNet (\`transport input telnet\` + \`access-class\`).
   - Với SSHv1 / thuật toán khóa cũ (\`diffie-hellman-group1-sha1\`): OmniNet hỗ trợ Legacy KEX Bridge để đọc cấu hình.
   - Với thiết bị chỉ có Web (Smart-Managed Switch như HP 1810/1910, TP-Link/D-Link cũ): Dùng công cụ **Live TCP/HTTP Probe** để giám sát trạng thái Sống/Chết (Up/Down), độ trễ (Latency) và cổng Web (80/443).
3. **Không có LLDP (Hoặc Switch Unmanaged không quản lý được):**
   - OmniNet kết hợp **CDP** (nếu là Cisco) + đọc **Bảng MAC Address (\`show mac address-table\`) và bảng ARP (\`show ip arp\`)** từ Core Switch thượng nguồn để suy luận thiết bị đang cắm ở cổng nào.
   - Ngoài ra, bạn có thể vào tab **Topology Studio** -> dùng tính năng **"Tạo Liên Kết (Link Nodes)"** để vẽ nối dây thủ công vào sơ đồ.

---

## CHƯƠNG 3: QUY TRÌNH SỬ DỤNG 7 MODULE CHÍNH TRONG OMNINET
1. **Summary Dashboard:** Xem tổng quan lưu lượng băng thông thực tế (Inbound/Outbound), số thiết bị Online/Warning/Offline.
2. **AI Diagnostics & RCA:** Chọn thiết bị đang lỗi -> bấm **"Run Deep Root-Cause Analysis"** để AI chỉ rõ nguyên nhân gốc từ tầng Vật lý (L1) đến Ứng dụng (L7) và tự động đẩy lệnh khắc phục.
3. **Topology Studio:** Kéo thả vị trí thiết bị, thêm thiết bị mới, nối dây Uplink giữa các cổng, xem cảnh báo trực quan trên sơ đồ.
4. **Ports & Server Services:** Bật/tắt cổng vật lý (Admin Up/Down), đổi VLAN từng cổng, và khởi động lại dịch vụ Server (Nginx, Docker, PostgreSQL, SSHD...).
5. **Multi-Vendor Config Hub:** Cấu hình trực quan VLAN, Firewall ACL, Định tuyến hoặc biên dịch lệnh CLI đồng loạt cho 10 hãng khác nhau; kiểm tra lệch cấu hình (Config Drift) và Rollback về chuẩn Golden Baseline.
6. **Network Discovery:** Quét dải mạng Subnet CIDR tự động hoặc quét IP/Domain thực tế (Live TCP/DNS Probe).
7. **IT Asset Inventory & Cập nhật Datasheet CLI:** Quản lý Serial, hạn bảo hành, Rack/Site. Nếu thiếu hãng/mã thiết bị nào, bấm **"Cập nhật Hãng & Datasheet CLI"** để tải thông số và lệnh CLI chuẩn theo đúng phiên bản OS/Firmware về Database.

---

## CHƯƠNG 4: TRIỂN KHAI & CẬP NHẬT TRÊN WINDOWS VÀ DOCKER
- Bấm nút **"Windows & Docker"** trên thanh công cụ trên cùng:
  - **Tab 1 (Windows):** Tải \`Start-OmniNet-Windows.bat\` để chạy ngay cửa sổ ứng dụng độc lập trên Windows.
  - **Tab 2 (Docker):** Tải \`Dockerfile\` và \`docker-compose.yml\`, chạy lệnh \`docker compose up -d --build\`.
  - **Tab 4 (Update & Backup):** Xuất toàn bộ dữ liệu ra file \`.JSON\` trước khi nâng cấp phiên bản mới để đảm bảo an toàn dữ liệu 100%.
`;

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<GuideSectionId>('legacy-devices');

  if (!isOpen) return null;

  const handleDownloadManual = () => {
    const blob = new Blob([OMNINET_MANUAL_MARKDOWN], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'So-Tay-Huong-Dan-Su-Dung-OmniNet.md';
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
    { id: 'legacy-devices', title: '1. Xử lý Thiết bị Cũ (Legacy)', icon: ShieldAlert },
    { id: 'quickstart', title: '2. Đăng nhập 2FA & AI Zero-Key', icon: Lock },
    { id: 'discovery-topology', title: '3. Quét Mạng & Vẽ Topology', icon: Network },
    { id: 'config-datasheet', title: '4. Cấu hình Đa hãng & Datasheet', icon: Sliders },
    { id: 'ai-rca', title: '5. Chẩn đoán AI RCA & Auto-Fix', icon: Bot },
    { id: 'deploy-update', title: '6. Chạy Windows / Docker & Update', icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OmniNetLogo size={38} variant="icon" />
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Sổ Tay Hướng Dẫn Sử Dụng OmniNet & Giải Pháp Thiết Bị Đời Cũ</span>
              </h2>
              <p className="text-xs text-slate-400">
                Hướng dẫn từng bước vận hành thực tế, kết nối thiết bị đời cũ (thiếu SNMPv3/SSH/LLDP) và xử lý sự cố
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadManual}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Sổ Tay Hướng Dẫn (.MD)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px] max-h-[76vh]">
          {/* Left Chapter Navigation */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 space-y-1.5 overflow-y-auto">
            <div className="text-[11px] font-mono uppercase text-slate-400 px-2 pb-1">
              Mục lục hướng dẫn
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

            <div className="mt-4 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-1.5">
              <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Mẹo nhanh khi vận hành</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Ở bất kỳ màn hình nào, bạn đều có thể bấm vào **nút tròn Trợ lý AI** ở góc dưới bên phải để hỏi cú pháp lệnh hoặc nhờ AI phân tích lỗi kết nối.
              </p>
            </div>
          </div>

          {/* Right Chapter Content */}
          <div className="lg:col-span-8 p-6 overflow-y-auto space-y-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs leading-relaxed">
            {activeSection === 'legacy-devices' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    1. Khi thiết bị mạng đời cũ KHÔNG có đủ các giao thức mới thì xử lý thế nào?
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Trong thực tế doanh nghiệp, rất nhiều tủ Rack vẫn đang chạy các dòng Switch/Router đời cũ (như <strong>Cisco 2950/2960/3560 đời cũ</strong>, <strong>HP ProCurve 1810/2510</strong>, <strong>Switch Smart-Managed / Unmanaged</strong>). OmniNet hỗ trợ cơ chế <strong>Tương thích lùi 4 cấp độ (Legacy Fallback)</strong>:
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Case 1 */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-blue-600 dark:text-sky-400 text-sm">
                      Trường hợp 1: Thiết bị cũ KHÔNG có SNMPv3 (Chỉ có SNMPv1 hoặc SNMPv2c)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • <strong>Cách xử lý:</strong> Bạn chỉ cần bật <strong>SNMPv2c Read-Only (RO)</strong> trên thiết bị cũ. Để đảm bảo an toàn không bị lộ thông tin, hãy gắn kèm 1 <strong>Access-List (ACL)</strong> chỉ cho phép duy nhất địa chỉ IP của máy chủ OmniNet được phép đọc SNMP.
                    </p>
                    <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`! Ví dụ trên Switch Cisco / HP ProCurve đời cũ chỉ có SNMPv2c:
access-list 10 permit 10.10.0.50
snmp-server community OMNINET_RO_2026 RO 10`}
                    </pre>
                  </div>

                  {/* Case 2 */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                      Trường hợp 2: Thiết bị KHÔNG có SSHv2 (Chỉ có Telnet hoặc SSHv1 thuật toán cũ)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Nhiều Switch chạy bản ROM `non-crypto` (như Cisco 2960 LAN Lite cũ) chỉ có <strong>Telnet (cổng TCP 23)</strong>, hoặc dùng thuật toán trao đổi khóa cũ (`diffie-hellman-group1-sha1`).
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      • <strong>Cách xử lý:</strong> Bật Telnet nhưng khóa chặt bằng ACL chỉ nhận IP của máy chủ OmniNet. Nếu thiết bị dùng SSHv1/KEX cũ, máy chủ OmniNet sẽ tự động bật cờ `-o KexAlgorithms=+diffie-hellman-group1-sha1` để vẫn lấy được file cấu hình bình thường.
                    </p>
                  </div>

                  {/* Case 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      Trường hợp 3: Thiết bị KHÔNG có LLDP (Chỉ có CDP hoặc không có giao thức láng giềng)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • <strong>Cách xử lý tự động:</strong> Nếu là thiết bị Cisco cũ, OmniNet dùng <strong>CDP (`cdp run`)</strong>. Nếu thiết bị không có cả LLDP lẫn CDP, OmniNet sẽ đọc <strong>Bảng địa chỉ MAC (`show mac address-table`)</strong> trên Switch Core/Distribution kết hợp với <strong>Bảng ARP (`show ip arp`)</strong> của Router/Firewall để biết IP và MAC của thiết bị cũ đó đang nằm ở cổng số mấy.
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      • <strong>Cách xử lý trực quan:</strong> Vào tab <strong>Topology Studio</strong> $\rightarrow$ bấm nút <strong>"Link Nodes"</strong> để nối dây cố định (`STATIC Link`) giữa thiết bị cũ và Switch chính trên bản đồ.
                    </p>
                  </div>

                  {/* Case 4 */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                      Trường hợp 4: Thiết bị chỉ có giao diện Web (Smart-Managed) hoặc Máy chấm công, Camera IP, Máy in
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Với các thiết bị không có dòng lệnh CLI và không có SNMP (ví dụ Switch Web-Managed HP 1810, Camera NVR, Máy chủ nội bộ đóng SNMP):
                      OmniNet sử dụng chế độ <strong>Live TCP Socket & HTTP Banner Probe</strong> (kiểm tra cổng `80, 443, 22, 554, 9100...` mỗi chu kỳ) để giám sát chính xác trạng thái <strong>Online / Offline</strong> và <strong>Độ trễ phản hồi (Latency ms)</strong> mà không cần cài đặt gì trên thiết bị.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'quickstart' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  2. Hướng dẫn Đăng nhập Bảo mật 2 Bước (2FA) & Trợ lý AI Zero-API-Key
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      Bước 1: Xác thực Tài khoản Ứng dụng bằng Google Authenticator
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      1. Bấm vào nút <strong>"admin.netops · 2FA & AI SSO"</strong> trên góc phải thanh công cụ.
                      <br />
                      2. Mở ứng dụng <strong>Google Authenticator</strong> trên điện thoại, quét mã QR hiển thị trên màn hình (hoặc nhập mã Secret Base32).
                      <br />
                      3. Nhập 6 chữ số TOTP đổi mới mỗi 30 giây (khi đang demo/test nhanh, bạn có thể bấm nút <em>"Điền nhanh mã TOTP hiện tại"</em>).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      Bước 2: Chọn và Đăng nhập Tài khoản AI (Không cần API Key)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      1. Sau khi qua Bước 1, hệ thống chuyển sang Bước 2.
                      <br />
                      2. Chọn nhà cung cấp AI bạn muốn dùng làm trợ lý kỹ sư: <strong>Google Gemini</strong>, <strong>OpenAI ChatGPT</strong>, <strong>Anthropic Claude</strong> hoặc <strong>DeepSeek</strong>.
                      <br />
                      3. Nhờ kiến trúc <strong>Zero-API-Key Cloud Relay</strong>, bạn chỉ cần bấm kết nối SSO 1 chạm và nhấn <strong>"Hoàn tất & Vào hệ thống OmniNet"</strong> mà không cần điền API Key.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'discovery-topology' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  3. Hướng dẫn Quét Mạng (Discovery), Thêm Thiết bị & Vẽ Sơ đồ Topology
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      A. Quét tự động theo dải mạng (Subnet CIDR) hoặc Quét IP thật (Live Probe)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Vào menu <strong>Network Discovery</strong>.
                      <br />• <strong>Ô bên trái (Subnet Scanner):</strong> Nhập dải mạng (ví dụ `172.16.40.0/24` hoặc `10.30.0.0/24`) rồi bấm <strong>Scan Subnet</strong>. Chọn các thiết bị tìm thấy và bấm <strong>Onboard Selected Nodes</strong> để đưa vào danh sách quản lý.
                      <br />• <strong>Ô bên phải (Live TCP & DNS Prober):</strong> Nhập bất kỳ IP hoặc tên miền thực tế nào cùng danh sách cổng (`22, 80, 443...`) và bấm <strong>Probe Host</strong>. Nếu cổng nào bị đóng, hệ thống sẽ giải thích rõ lý do và gợi ý lệnh mở cổng.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      B. Vẽ Sơ đồ Mạng (Topology Studio) & Quản lý Cổng / Dịch vụ
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Vào menu <strong>Topology Studio</strong>: Bạn có thể giữ chuột kéo-thả các thiết bị đến vị trí mong muốn, bấm <strong>"+ Add Node"</strong> để thêm thiết bị mới ngay trên bản đồ, hoặc bấm <strong>"Link Nodes"</strong> để nối dây giữa 2 thiết bị.
                      <br />• Vào menu <strong>Ports & Server Services</strong>: Cho phép bật/tắt (`Admin Up/Down`) từng cổng Switch, đổi VLAN, hoặc bấm `Restart / Start / Stop` các dịch vụ chạy trên máy chủ Linux (`nginx`, `postgresql`, `docker`...).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'config-datasheet' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  4. Cấu hình Đa hãng (Multi-Vendor Config) & Cập nhật Datasheet CLI theo Phiên bản OS
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      A. Thêm Hãng / Mã Thiết bị thiếu & Đồng bộ CLI theo Phiên bản OS
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Bấm nút <strong>"Cập nhật Hãng & Datasheet CLI"</strong> trên thanh công cụ trên cùng.
                      <br />• Nhập tên hãng (ví dụ: <em>Ubiquiti UniFi, Aruba, HPE Comware, HP ProCurve, Cisco...</em>), mã Model và phiên bản OS/Firmware rồi bấm <strong>"Cập nhật Database về"</strong>.
                      <br />• Hệ thống sẽ tải về bảng phân tích sự khác nhau về câu lệnh giữa các đời OS (ví dụ <em>Aruba AOS-CX vs HP ProCurve PVOS</em>, <em>Comware v7 vs v5</em>) và cho phép thêm thiết bị đó vào kho quản lý chỉ với 1 cú nhấp chuột.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      B. Đẩy Cấu hình Đồng loạt & Kiểm tra Lệch Chuẩn (Golden Baseline)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Vào menu <strong>Multi-Vendor Config Hub</strong>: Bạn có thể cấu hình VLAN, Firewall Rule, Định tuyến bằng biểu mẫu trực quan (Visual GUI) mà không cần nhớ lệnh, hoặc chọn mẫu cấu hình để hệ thống tự dịch ra đúng ngôn ngữ CLI của từng hãng và đẩy xuống nhiều thiết bị cùng lúc.
                      <br />• Nếu thiết bị nào bị sửa cấu hình thủ công lệch với bản chuẩn, bạn chỉ cần bấm <strong>"Rollback to Golden Baseline"</strong> để khôi phục ngay.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ai-rca' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  5. Chẩn đoán Nguyên nhân Gốc bằng AI (AI RCA) & Nút Chatbox Trợ lý AI Nổi
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      A. Khi thiết bị mất kết nối hoặc báo lỗi (Offline / Warning)
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Bấm vào bất kỳ thiết bị nào đang báo đỏ/vàng để mở ngăn thông tin bên phải: Hệ thống sẽ hiển thị khung <strong>"Chẩn đoán Kết nối Thất bại"</strong> nêu rõ <strong>Lý do tại sao không kết nối được</strong>, <strong>Các bước xử lý</strong> và nút <strong>"Tự động Fix & Kết nối lại"</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      B. Sử dụng Nút Tròn Trợ lý Kỹ sư AI ở góc dưới bên phải
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Dù bạn đang ở bất kỳ tab nào, nút tròn nhỏ ở góc dưới bên phải luôn đi theo bạn.
                      <br />• Bấm vào nút tròn để mở khung Chat, chuyển đổi linh hoạt giữa <strong>Gemini, ChatGPT, Claude, DeepSeek</strong> và bấm các nút gợi ý nhanh để sửa lỗi kết nối thiết bị ngay trong khung chat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'deploy-update' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">
                  6. Đóng gói Chạy Thực tế trên Windows / Docker & Cập nhật Phiên bản
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      A. Chạy trên Windows 10/11 hoặc Windows Server
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Bấm nút <strong>"Windows & Docker"</strong> trên thanh công cụ $\rightarrow$ tải file `Start-OmniNet-Windows.bat` và `Build-OmniNet-Windows-Installer.ps1`.
                      <br />• Nhấp đúp vào `Start-OmniNet-Windows.bat`, ứng dụng sẽ tự động chạy máy chủ cổng `3000` và mở cửa sổ <strong>OmniNet Native Desktop</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-sm mb-1">
                      B. Chạy trên Docker & Sao lưu trước khi Update
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      • Với Docker: Chạy lệnh `docker compose up -d --build` tại thư mục chứa `Dockerfile` và `docker-compose.yml`.
                      <br />• Trước khi cập nhật bản mới: Vào mục <strong>"Windows & Docker"</strong> $\rightarrow$ chọn <strong>Tab 4 (Cơ chế Update & Sao lưu Dữ liệu)</strong> $\rightarrow$ bấm <strong>"Xuất Bản Sao Lưu (.JSON)"</strong> để lưu toàn bộ cấu hình và thiết bị an toàn tuyệt đối.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
