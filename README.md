# OmniNet Enterprise NCM & Autonomous AI RCA Platform (v3.5)

**OmniNet** là nền tảng Quản trị Cấu hình Mạng Đa hãng (Multi-Vendor NCM), Bản đồ Topology Tương tác (LACP/LAG Studio), Kiểm toán Tuân thủ CIS và Chẩn đoán Sự cố Tự động bằng AI (Autonomous AI Root-Cause Analysis).

**OmniNet** is an Enterprise Multi-Vendor Network Configuration Management (NCM), Interactive LACP/LAG Topology Studio, CIS Compliance Auditing, and Autonomous AI Root-Cause Analysis (RCA) platform.

---

## 1. Triển khai & Tải về từ GitHub (GitHub Deployment & Releases)

Khi kho mã nguồn (Repository) này được đồng bộ lên **GitHub**, hệ thống đã tích hợp sẵn **GitHub Actions (`.github/workflows/release.yml`)** để tự động đóng gói 2 phiên bản tải về trong mục **Actions / Releases**:
- `OmniNet-Windows-Portable.zip`: Bản chạy ngay trên **Windows 10/11 & Windows Server 2019/2022**.
- `OmniNet-Docker-Stack.zip`: Bản chạy container trên **Docker / Linux Server**.

---

## 2. Khởi chạy nhanh (Quick Start)

### Cách A: Chạy bằng Docker Compose (Khuyên dùng cho Server NOC)
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd omninet-enterprise-ncm
docker compose up -d --build
```
- Truy cập giao diện Web Console tại: `http://localhost:3000`
- Đã cấu hình sẵn `NET_RAW` & `NET_ADMIN` để quét ICMP/SNMP/SSH nội bộ.

### Cách B: Chạy trực tiếp trên Windows (.BAT / Native App Window)
1. Cài đặt [Node.js LTS (v20/v22)](https://nodejs.org/).
2. Clone hoặc tải ZIP từ GitHub về máy:
   ```cmd
   git clone <YOUR_GITHUB_REPO_URL>
   cd omninet-enterprise-ncm
   deploy\windows\Start-OmniNet-Windows.bat
   ```
3. Để tạo Shortcut ngoài Desktop và tự động mở Windows Firewall cổng `3000`, chạy bằng PowerShell (Admin):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deploy\windows\Build-OmniNet-Windows-Installer.ps1
   ```
4. Khi có bản cập nhật mới trên GitHub, chỉ cần nhấp đúp:
   ```cmd
   deploy\windows\Update-OmniNet-Windows.bat
   ```

---

## 3. Tính năng cốt lõi (Core Capabilities)

- **Multi-Vendor CLI Compiler**: Biên dịch tự động lệnh cấu hình chuẩn cho *Cisco IOS-XE, Cisco NX-OS, Fortinet FortiOS, Palo Alto PAN-OS, Juniper Junos, MikroTik RouterOS, Aruba AOS-CX, HPE Comware, HP ProCurve, Ubiquiti UniFi, Linux Server*.
- **Interactive Topology & LAG Studio**: Sơ đồ mạng không giới hạn, hỗ trợ bó cáp đa đường (2x/4x LACP/LAG), hiệu ứng luồng dữ liệu mượt mà, menu chuột phải thêm Node/Note/LAG và mô phỏng đứt cáp.
- **Autonomous AI Copilot & Quick RCA**: Tích hợp đa tài khoản AI (Google Gemini, OpenAI ChatGPT, Anthropic Claude, DeepSeek R1) qua chế độ SSO không cần lộ API Key, tự động chẩn đoán nguyên nhân mất kết nối và sinh lệnh CLI khắc phục.
- **Enterprise NOC Operations Suite**: Quản lý IPAM & phát hiện trùng IP (ARP Conflict), Sao lưu cấu hình tự động hàng đêm, Cảnh báo qua Telegram/Teams/Slack Webhook, Phân quyền RBAC và Xuất báo cáo CSV/Markdown.
- **Song ngữ Hoàn chỉnh (100% Bilingual VI / EN)**: Chuyển đổi tức thì giữa Tiếng Việt và Tiếng Anh trên toàn bộ các phân hệ.
