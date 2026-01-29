const API_URL = import.meta.env.VITE_API_URL || "";

async function post(action: string, data: any = {}) {
  try {
    // [修正] 加入時間戳記 (t=...) 以防止 Google 伺服器回傳快取的舊資料
    // 這會強制瀏覽器每次都發送新的請求
    const separator = API_URL.includes('?') ? '&' : '?';
    const noCacheUrl = `${API_URL}${separator}t=${new Date().getTime()}`;

    const response = await fetch(noCacheUrl, {
      method: "POST",
      // [修正] 使用 no-cache 模式確保更強制的更新
      cache: "no-store", 
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
  autoLogin: (uid: string, deviceId: string) => post("autoLogin", { uid, deviceId }),
  getLocations: () => post("getLocations"),
  clockIn: (data: any) => post("clockIn", data),
  getHistory: (uid: string, loginTime?: number) => post("getHistory", { uid, loginTime }),
  checkStatus: (uid: string, loginTime?: number, name?: string) => post("checkStatus", { uid, loginTime, name }),
  adminGetData: (dataType: 'staff' | 'line' | 'location' | 'record' | 'log' | 'all' | 'shift', adminName?: string, uid?: string) => post("adminGetData", { dataType, adminName, uid }),
  
  adminUpdateLocation: (data: any) => post("adminUpdateLocation", data),
  adminUpdateStaff: (data: any) => post("adminUpdateStaff", data), 

  adminUpdateShift: (data: any) => post("adminUpdateShift", data),

  adminGetDailyRecords: (date: string) => post("adminGetDailyRecords", { date }),
  // [修改] 改傳 targetUid
  adminGetStaffHistory: (targetUid: string) => post("adminGetStaffHistory", { targetUid }),

  adminUpdateSupervisor: (data: any) => post("adminUpdateSupervisor", data),

  adminUnlockStaff: (targetUid: string, adminName: string) => post("adminUnlockStaff", { targetUid, adminName }),

  adminDownloadExcel: (adminName: string, sheetName?: string) => post("adminDownloadExcel", { adminName, sheetName }),

  adminGetSheetList: () => post("adminGetSheetList"),
};