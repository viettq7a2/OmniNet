# NetVista Enterprise — Nâng cấp AI Chẩn Đoán Sự Cố (RCA) & Hệ Thống Giám Sát Hybrid

Bản kế hoạch này nâng cấp nền tảng **NetVista Enterprise NCM & Monitoring** hiện tại với trung tâm **AI Chẩn Đoán Sự Cố & Phân Tích Nguyên Nhân Gốc (AI NOC Diagnostics & Root-Cause Analysis)** chạy phía máy chủ, đồng thời kết nối liền mạch giữa môi trường mô phỏng đa nhà mạng (Multi-Vendor Lab) và bộ công cụ quét/thăm dò kết nối thực tế (Live TCP/DNS/HTTP Probe).

## User Review & Critical Decisions

> [!IMPORTANT]
> Dưới đây là các định hướng sản phẩm đã được xác nhận và các quyết định kỹ thuật trọng tâm trước khi triển khai mã nguồn:

- **Định hướng tính năng ưu tiên (Đã xác nhận)**: Tập trung phát triển module **AI Chẩn đoán sự cố mạng & Phân tích nguyên nhân gốc (Root-Cause Analysis)**, tự động tương quan cảnh báo SNMP/Syslog, trạng thái cổng vật lý, dịch vụ máy chủ, độ lệch cấu hình (Config Drift) và đề xuất lệnh khắc phục chuẩn theo từng hãng thiết bị.
- **Chế độ dữ liệu & vận hành (Đã xác nhận)**: **Mô hình Hybrid** kết hợp chặt chẽ giữa Lab mô phỏng đa nhà mạng (Cisco IOS-XE/NX-OS, Fortinet, Palo Alto, Juniper, MikroTik, Aruba, Linux Server) và công cụ quét kết nối mạng thực tế (Real TCP Socket, DNS A/PTR Lookup, HTTP Banner Inspection) ngay từ backend.
- **Xử lý AI phía Server (Recommended Default)**: Toàn bộ yêu cầu phân tích sự cố và sinh kịch bản CLI khắc phục sử dụng mô hình `gemini-3.8-flash` thông qua API backend bảo mật, đảm bảo tốc độ phản hồi nhanh, trả về cấu trúc dữ liệu JSON định sẵn (Structured Output) và có cơ chế dự phòng chẩn đoán tất định (Deterministic Heuristic Fallback) nếu môi trường chưa cấu hình khóa API.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Khởi chạy toàn diện hệ thống NetVista Enterprise hiện có (Summary Dashboard, Interactive Topology Studio, Ports & Server Services, Visual Multi-Vendor Config, Network Discovery, CMDB Asset Inventory) và sửa các lỗi ký tự phân cách bị lỗi mã hóa trong bản gốc.
  - Bổ sung trung tâm **AI Diagnostics & RCA Center** cho phép kỹ sư NOC phân tích toàn bộ sự cố đang mở, tìm nguyên nhân gốc rễ xuyên tầng (Cross-Layer: Vật lý L1 -> Liên kết VLAN L2 -> Định tuyến BGP/OSPF L3 -> Dịch vụ ứng dụng L7), kiểm tra độ trễ thực tế tới mục tiêu mạng và tự động áp dụng bản vá CLI đa nhà mạng chỉ với 1 cú nhấp chuột.
- **Target Audience / Persona**: Kỹ sư vận hành mạng (NOC Engineers), Kiến trúc sư hạ tầng đa nhà mạng (Network Architects), và Quản trị viên hệ thống (SRE / SecOps).
- **Key Value**: Rút ngắn thời gian xác định nguyên nhân sự cố (MTTD) và thời gian khắc phục (MTTR) nhờ kết hợp dữ liệu telemetry thời gian thực, kiểm toán cấu hình CIS và chẩn đoán tự động bằng AI.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Luồng Chẩn đoán Sự cố Tức thì (1-Click Incident RCA)**: Từ bảng cảnh báo ở *Topology Studio*, *Summary Dashboard*, hoặc tab mới *AI Diagnostics & RCA*, người dùng chọn một sự cố (ví dụ: nhánh MikroTik bị nghẽn CPU & lệch cấu hình Telnet/SNMP, hoặc Switch tầng 3 mất kết nối uplink) -> Hệ thống thu thập toàn bộ trạng thái thiết bị, cổng kết nối lân cận (LLDP/CDP), lịch sử running-config vs. golden-baseline -> AI phân tích nguyên nhân gốc rễ, đánh giá mức độ ảnh hưởng (Blast Radius) và tạo sẵn khối lệnh CLI đúng cú pháp hãng để người dùng bấm **"Apply Remediation to Device"** hoặc **"Recover Node & Services"**.
  2. **Luồng Tương quan Lab Mô phỏng & Quét Thực tế (Hybrid Live Probe + AI)**: Người dùng thực hiện quét một máy chủ/IP thực tế (như `1.1.1.1`, `8.8.8.8`, `cloudflare.com`, hoặc gateway nội bộ) -> Hệ thống đo độ trễ TCP, kiểm tra cổng mở, phân giải ngược DNS và đọc HTTP Banner -> Cho phép chạy chẩn đoán AI trực tiếp trên kết quả quét thực tế hoặc đưa node thực tế đó vào sơ đồ Topology để giám sát song song với các node mô phỏng.
  3. **Luồng Trợ lý NOC Tương tác (Interactive NOC Diagnostic Copilot)**: Người dùng đặt câu hỏi bằng ngôn ngữ tự nhiên (Tiếng Việt hoặc Tiếng Anh) về toàn bộ trạng thái mạng hiện tại (ví dụ: *"Tại sao cụm Kubernetes worker03 bị ngừng hoạt động?"* hoặc *"Tạo chính sách chặn cổng SMB 445 cho cả Fortinet và Palo Alto"*) -> Nhận câu trả lời kèm trích dẫn thiết bị thực tế trong danh mục quản lý.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Giao diện điều hành mạng chuyên nghiệp (Enterprise NOC Console), chuẩn mật độ cao, rõ ràng, không dùng hiệu ứng trang trí thừa.
  - *Color Palette & Mood*: Hỗ trợ chuyển đổi mượt mà **Light / Dark Mode**; nền Slate trung tính (`#F8FAFC` / `#020617`), bề mặt khung (`#FFFFFF` / `#0F172A`), đường viền mảnh `1px` (`border-slate-200` / `dark:border-slate-800`), điểm nhấn hành động chính màu xanh dương (`#2563EB`) và màu ngữ nghĩa trạng thái chuẩn (Xanh lá `#16A34A` Online, Vàng hổ phách `#D97706` Warning, Đỏ `#DC2626` Critical/Offline).
  - *Typography & Hierarchy*: Tiêu đề sử dụng `Plus Jakarta Sans`, nội dung dùng `Public Sans` dễ đọc ở kích thước `12px–14px`, và toàn bộ chỉ số băng thông, độ trễ, địa chỉ IP, cổng, cấu hình CLI sử dụng `JetBrains Mono` kèm `tabular-nums`.
  - *Component Styling & Layout*: Bố cục thanh bên cố định kết hợp khung nhìn rộng `1440px`, sử dụng đường phân cách mảnh và khoảng trắng hợp lý thay vì lồng nhiều lớp thẻ.
- **Interactive Feedback & Motion**: Phản hồi trạng thái tức thì khi đóng/mở cổng, khởi động lại dịch vụ, chạy kiểm tra kết nối TCP thực tế hoặc áp dụng bản vá cấu hình từ đề xuất của AI kèm thông báo toast rõ ràng.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Kiến trúc Chẩn đoán AI kết hợp Heuristic Fallback**
  - *Chosen Approach*: Xây dựng endpoint máy chủ sử dụng `@google/genai` (`gemini-3.8-flash`) với `responseSchema` chặt chẽ để phân tích bối cảnh thiết bị, đồng thời tích hợp bộ máy phân tích quy tắc mạng (Deterministic Network Rule Engine) làm lớp dự phòng.
  - *Why*: Đảm bảo tính năng phân tích nguyên nhân gốc rễ (RCA) luôn trả về kết quả chi tiết, chính xác về mặt kỹ thuật mạng (L1/L2/L3/Config Drift/CIS Compliance) ngay cả khi kết nối mạng ra ngoài bị giới hạn.
  - *Alternatives Considered*: Chỉ gọi LLM thuần túy từ client (bị loại bỏ vì vi phạm nguyên tắc bảo mật API key và thiếu tính ổn định).
- **Decision 2: Làm sạch hiển thị ký tự & Đồng bộ trạng thái xuyên suốt (Unified State)**
  - *Chosen Approach*: Khắc phục triệt để các ký tự phân cách bị mất mã hóa trong kho dữ liệu gốc (như dấu chấm giữa `·`, mũi tên `→`, độ `°C`) và kết nối trực tiếp hành động khắc phục của AI vào cùng kho trạng thái `devices`, `alerts`, `trafficSeries`.
  - *Why*: Khi người dùng nhấn khắc phục sự cố từ màn hình AI, cấu hình thiết bị (`runningConfig`), lịch sử phiên bản (`configHistory`), trạng thái cổng/dịch vụ và biểu đồ Recharts đều cập nhật đồng bộ ngay lập tức.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        NetVista Enterprise Application State                     │
│        (Managed Devices, Topology Links, Alerts, Telemetry, Config History)      │
└───────┬─────────────────┬──────────────────┬──────────────────┬──────────────────┘
        │                 │                  │                  │
        ▼                 ▼                  ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌────────────────┐ ┌───────────────────────────┐
│   Summary &   │ │   Topology    │ │ Visual Config  │ │  AI Diagnostics & RCA Hub │
│ Ports/Service │ │    Studio     │ │  & Discovery   │ │ (Root-Cause, Blast Radius,│
│   Monitors    │ │  (Interactive │ │  (Multi-Vendor │ │  1-Click CLI Remediation, │
│  (Recharts &  │ │  Canvas & CIS │ │  GUI, Diff &   │ │  Hybrid Live Host Audit)  │
│  Faceplates)  │ │   Auditing)   │ │  Live Probes)  │ └─────────────┬─────────────┘
└───────────────┘ └───────────────┘ └────────┬───────┘               │
                                             │                       │
                                             ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           Express Backend Server (/api/*)                        │
│  • POST /api/probe          : Real DNS A/PTR Lookup, TCP Socket RTT, HTTP Banner │
│  • POST /api/ai/rca         : Structured Gemini RCA & Multi-Vendor CLI Generator │
│  • POST /api/ai/copilot     : Interactive NOC Troubleshooting Assistant          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `RcaAnalysisReport`: Chứa thông tin chẩn đoán có cấu trúc gồm `incidentTitle`, `severity`, `rootCauseLayer` (`Physical L1` | `DataLink L2` | `Network L3` | `Transport/Service L4-L7` | `Security & Config Drift`), `executiveSummary`, `evidenceChain` (danh sách bằng chứng kỹ thuật thu thập từ thiết bị & láng giềng LLDP), `blastRadius` (các nút/dịch vụ bị ảnh hưởng), `recommendedActions` (các bước xử lý), và `remediationCli` (mã lệnh CLI chuẩn theo vendor của thiết bị để áp dụng tự động).
- **Interactive Component & State Mapping**:
  - **Nút "Analyze Root Cause" trên từng cảnh báo hoặc thiết bị**: Gửi snapshot thiết bị đang chọn, danh sách láng giềng kết nối trực tiếp, cảnh báo liên quan và kết quả kiểm toán CIS lên `/api/ai/rca`.
  - **Nút "Apply AI Remediation CLI"**: Tự động hợp nhất khối lệnh khắc phục vào `runningConfig` của thiết bị, tạo bản ghi `configHistory` mới với nhãn `(AI RCA Remediation)`, đồng thời tự động khôi phục trạng thái cổng/dịch vụ hoặc đồng bộ Golden Baseline và đánh dấu cảnh báo đã xử lý.
  - **Tích hợp Live Probe + AI Audit**: Cho phép quét bất kỳ IP/Domain thực tế nào qua `/api/probe` rồi chuyển thẳng kết quả sang bộ phân tích AI để đánh giá bề mặt cổng mở (Open Ports Exposure), độ trễ mạng và gợi ý cấu hình tường lửa bảo vệ.
