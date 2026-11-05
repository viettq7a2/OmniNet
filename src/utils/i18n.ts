export type AppLanguage = 'vi' | 'en';

export type RbacRole = 'admin' | 'noc-l1';

export const TRANSLATIONS = {
  vi: {
    nav: {
      dashboard: 'Tổng quan Hạ tầng',
      aiRca: 'Chẩn đoán AI & RCA',
      topology: 'Sơ đồ Topology & LAG',
      portsServices: 'Cổng & Dịch vụ Server',
      config: 'Cấu hình Đa hãng',
      discovery: 'Quét Mạng & Onboarding',
      inventory: 'Kho Thiết bị (CMDB)',
      operations: 'Vận hành · IPAM · Backup',
    },
    header: {
      enterpriseNoc: 'Trung tâm Điều hành Mạng',
      datasheetBtn: 'Datasheet & CLI',
      guideBtn: 'Hướng dẫn',
      deployBtn: 'Windows & Docker',
      authBtn: '2FA & AI SSO',
      roleAdmin: 'Quyền: Kỹ sư Trưởng (Admin)',
      roleNocL1: 'Quyền: Trực ca NOC L1 (Chỉ xem)',
      rbacBlockedToast:
        'Tài khoản NOC L1 (Chỉ xem) không được phép đẩy lệnh cấu hình hoặc xóa thiết bị. Hãy chuyển sang quyền Admin trên thanh công cụ.',
    },
    sidebar: {
      systemTools: 'Công cụ Hệ thống',
      managedNodes: 'Thiết bị quản lý',
      openAlerts: 'Cảnh báo mở',
      resetLab: 'Khôi phục dữ liệu mẫu',
    },
  },
  en: {
    nav: {
      dashboard: 'Summary Dashboard',
      aiRca: 'AI Diagnostics & RCA',
      topology: 'Topology & LAG Studio',
      portsServices: 'Ports & Server Services',
      config: 'Multi-Vendor Config',
      discovery: 'Network Discovery',
      inventory: 'IT Asset Inventory',
      operations: 'Operations · IPAM · Backup',
    },
    header: {
      enterpriseNoc: 'Enterprise NOC',
      datasheetBtn: 'Datasheet & CLI',
      guideBtn: 'User Guide',
      deployBtn: 'Windows & Docker',
      authBtn: '2FA & AI SSO',
      roleAdmin: 'Role: Principal Admin',
      roleNocL1: 'Role: NOC L1 (Read-Only)',
      rbacBlockedToast:
        'NOC L1 (Read-Only) role cannot push CLI configurations or delete devices. Switch to Admin role in the top bar.',
    },
    sidebar: {
      systemTools: 'System Utilities',
      managedNodes: 'Managed Nodes',
      openAlerts: 'Open Alerts',
      resetLab: 'Reset Lab Inventory',
    },
  },
} as const;
