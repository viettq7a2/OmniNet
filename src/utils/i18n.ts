export type AppLanguage = 'vi' | 'en';

export type RbacRole = 'admin' | 'noc-l1';

export const TRANSLATIONS = {
  vi: {
    categories: {
      monitoring: 'Giám sát & Bản đồ',
      operations: 'Cấu hình & Vận hành',
      intelligence: 'Chẩn đoán AI & Tài sản',
    },
    nav: {
      dashboard: 'Tổng quan Hạ tầng',
      topology: 'Sơ đồ Topology & LAG',
      portsServices: 'Cổng & Dịch vụ Server',
      config: 'Cấu hình Đa hãng',
      operations: 'Vận hành · IPAM · Backup',
      discovery: 'Quét Mạng & Onboarding',
      aiRca: 'Chẩn đoán AI & RCA',
      inventory: 'Kho Thiết bị (CMDB)',
    },
    header: {
      enterpriseNoc: 'Trung tâm Điều hành Mạng',
      quickToolsBtn: 'Công cụ & Hệ thống',
      datasheetBtn: 'CSDL Hãng & Datasheet CLI',
      guideBtn: 'Sổ tay Hướng dẫn & Thiết bị cũ',
      deployBtn: 'Bộ cài Windows & Docker',
      authBtn: 'Tài khoản 2FA & AI SSO',
      roleAdmin: 'Quyền: Kỹ sư Trưởng (Admin)',
      roleNocL1: 'Quyền: Trực ca NOC L1 (Chỉ xem)',
      switchRoleHint: 'Chuyển đổi quyền thao tác (RBAC)',
      rbacBlockedToast:
        'Tài khoản NOC L1 (Chỉ xem) không được phép đẩy lệnh cấu hình hoặc xóa thiết bị. Hãy chuyển sang quyền Admin trên thanh công cụ.',
    },
    sidebar: {
      systemTools: 'Tiện ích & Cài đặt',
      managedNodes: 'Thiết bị quản lý',
      openAlerts: 'Cảnh báo mở',
      resetLab: 'Khôi phục dữ liệu mẫu',
      collapseMenu: 'Thu gọn menu',
      expandMenu: 'Mở rộng menu',
    },
  },
  en: {
    categories: {
      monitoring: 'Monitoring & Map',
      operations: 'Config & Operations',
      intelligence: 'AI & Asset CMDB',
    },
    nav: {
      dashboard: 'Summary Dashboard',
      topology: 'Topology & LAG Studio',
      portsServices: 'Ports & Server Services',
      config: 'Multi-Vendor Config',
      operations: 'Operations · IPAM · Backup',
      discovery: 'Network Discovery',
      aiRca: 'AI Diagnostics & RCA',
      inventory: 'IT Asset Inventory',
    },
    header: {
      enterpriseNoc: 'Enterprise NOC',
      quickToolsBtn: 'System & Tools',
      datasheetBtn: 'Vendor Datasheet & CLI DB',
      guideBtn: 'User Guide & Legacy Support',
      deployBtn: 'Windows & Docker Setup',
      authBtn: '2FA & AI SSO Account',
      roleAdmin: 'Role: Principal Admin',
      roleNocL1: 'Role: NOC L1 (Read-Only)',
      switchRoleHint: 'Switch RBAC Permission Role',
      rbacBlockedToast:
        'NOC L1 (Read-Only) role cannot push CLI configurations or delete devices. Switch to Admin role in the top bar.',
    },
    sidebar: {
      systemTools: 'Utilities & Setup',
      managedNodes: 'Managed Nodes',
      openAlerts: 'Open Alerts',
      resetLab: 'Reset Lab Inventory',
      collapseMenu: 'Collapse sidebar',
      expandMenu: 'Expand sidebar',
    },
  },
} as const;
