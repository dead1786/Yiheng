const API_URL = import.meta.env.VITE_API_URL || "";

async function post(action: string, data: any = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...data }),
    });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "連線失敗，請檢查網路" };
  }
}

export const api = {
  login: (name: string, password: string, deviceId: string) => post("login", { name, password, deviceId }),
  
  changePassword: (name: string, newPassword: string) => post("changePassword", { name, newPassword }), 
  
  updatePassword: (name: string, oldPassword: string, newPassword: string) => post("updatePassword", { name, oldPassword, newPassword }),

  // [新增] 忘記密碼 API
  requestReset: (name: string) => post("requestReset", { name }),
  checkResetCode: (name: string, code: string) => post("checkResetCode", { name, code }),
  verifyReset: (name: string, code: string, newPassword: string) => post("verifyReset", { name, code, newPassword }),

  getLocations: () => post("getLocations"),
  
  clockIn: (data: any) => post("clockIn", data),
  getHistory: (name: string, loginTime?: number) => post("getHistory", { name, loginTime }),

  checkStatus: (name: string, loginTime?: number) => post("checkStatus", { name, loginTime }),
  
  adminGetData: (dataType: 'staff' | 'line' | 'location' | 'record' | 'log' | 'all' | 'shift', adminName?: string) => post("adminGetData", { dataType, adminName }),
  
  adminUpdateLocation: (data: any) => post("adminUpdateLocation", data),
  adminUpdateStaff: (data: any) => post("adminUpdateStaff", data), 
  
  // [新增] 班別設定
  adminUpdateShift: (data: any) => post("adminUpdateShift", data),

  // [新增] 查詢功能
  adminGetDailyRecords: (date: string) => post("adminGetDailyRecords", { date }),
  adminGetStaffHistory: (targetName: string) => post("adminGetStaffHistory", { targetName }),
  
  adminUnlockStaff: (targetName: string, adminName: string) => post("adminUnlockStaff", { targetName, adminName }),

  adminDownloadExcel: (adminName: string, sheetName?: string) => post("adminDownloadExcel", { adminName, sheetName }),

  adminGetSheetList: () => post("adminGetSheetList"),
};