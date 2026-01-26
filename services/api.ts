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

  requestReset: (name: string) => post("requestReset", { name }),
  checkResetCode: (name: string, code: string) => post("checkResetCode", { name, code }),
  verifyReset: (name: string, code: string, newPassword: string) => post("verifyReset", { name, code, newPassword }),

  getLocations: () => post("getLocations"),
  
  clockIn: (data: any) => post("clockIn", data),
  // [修改] 改傳 uid
  getHistory: (uid: string, loginTime?: number) => post("getHistory", { uid, loginTime }),

  // [修改] 改傳 uid
  checkStatus: (uid: string, loginTime?: number) => post("checkStatus", { uid, loginTime }),
  
  adminGetData: (dataType: 'staff' | 'line' | 'location' | 'record' | 'log' | 'all' | 'shift', adminName?: string) => post("adminGetData", { dataType, adminName }),
  
  adminUpdateLocation: (data: any) => post("adminUpdateLocation", data),
  adminUpdateStaff: (data: any) => post("adminUpdateStaff", data), 

  adminUpdateShift: (data: any) => post("adminUpdateShift", data),

  adminGetDailyRecords: (date: string) => post("adminGetDailyRecords", { date }),
  adminGetStaffHistory: (targetName: string) => post("adminGetStaffHistory", { targetName }),

  adminUpdateSupervisor: (data: any) => post("adminUpdateSupervisor", data),

  adminUnlockStaff: (targetUid: string, adminName: string) => post("adminUnlockStaff", { targetUid, adminName }),

  adminDownloadExcel: (adminName: string, sheetName?: string) => post("adminDownloadExcel", { adminName, sheetName }),

  adminGetSheetList: () => post("adminGetSheetList"),
};