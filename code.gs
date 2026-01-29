const LINE_CHANNEL_ACCESS_TOKEN = "AJPH2+shMd1gD3/Ws+iIMYWNSKs83DcfuoD55E4B2bfUnwTEbaqLgPX/5zDWLfqwnrS8VcR3llEjSE+Lk5euHTjSMhGuXhF1/18kRPttgoT2lFFd5zPpp3o0W1788wzlOMtg06echgvm/T/kWdgoxgdB04t89/1O/w1cDnyilFU=";

// 工作表名稱定義
const SHEET_STAFF = "員工管理";
const SHEET_ADMINS = "管理員名單";
const SHEET_SUPERVISORS = "主管名單";
const SHEET_LOCATIONS = "打卡地點設置";
const SHEET_RECORDS = "打卡紀錄";
const SHEET_LINE_IDS = "LINE_ID_收集區";
const SHEET_CURRENT_MONTH = "打卡紀錄整理"; 
const SHEET_ADMIN_LOGS = "管理員操作紀錄";
const SHEET_SHIFTS = "班別設定";

// ==========================================
// 1. 路由處理區 (Router)
// ==========================================

function doGet(e) {
  return ContentService.createTextOutput("✅ 系統 v10.3 API (Background Check) 運作中");
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  }

  let postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    return responseJSON({ success: false, message: "JSON 格式錯誤" });
  }

  if (postData.events) {
    handleLineEvents(postData.events);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  }

  const action = postData.action;
  if (action === "login") return responseJSON(handleLogin(postData.name, postData.password, postData.deviceId));
  if (action === "changePassword") return responseJSON(handleChangePassword(postData.name, postData.newPassword));
  if (action === "updatePassword") return responseJSON(handleUpdatePassword(postData));
  // [新增] 忘記密碼相關路由
  if (action === "requestReset") return responseJSON(handleRequestReset(postData.name));
  // [新增] 單獨檢查驗證碼路由
  if (action === "checkResetCode") return responseJSON(handleCheckResetCode(postData.name, postData.code));
  if (action === "verifyReset") return responseJSON(handleVerifyReset(postData.name, postData.code, postData.newPassword));
  
  if (action === "clockIn") return responseJSON(handleClockIn(postData));
  if (action === "getHistory") return responseJSON(handleGetHistory(postData.uid, postData.loginTime));
  // [修改] 傳入 name
  if (action === "checkStatus") return responseJSON(handleCheckStatus(postData.uid, postData.loginTime, postData.name));
  if (action === "getLocations") return responseJSON(getLocations());
  
  // --- 管理員後台功能 ---
  if (action === "adminGetData") return responseJSON(handleAdminGetData(postData));
  if (action === "adminUpdateLocation") return responseJSON(handleAdminUpdateLocation(postData));
  if (action === "adminUpdateStaff") return responseJSON(handleAdminUpdateStaff(postData));
  if (action === "adminUpdateSupervisor") return responseJSON(handleAdminUpdateSupervisor(postData)); 
  if (action === "adminUnlockStaff") return responseJSON(handleAdminUnlockStaff(postData));
  if (action === "adminGetDailyRecords") return responseJSON(handleAdminGetDailyRecords(postData.date));
  // [修正] 改傳 targetUid 給函式
  if (action === "adminGetStaffHistory") return responseJSON(handleAdminGetStaffHistory(postData.targetUid));
  if (action === "adminUpdateShift") return responseJSON(handleAdminUpdateShift(postData));
  if (action === "adminGetSheetList") return responseJSON(handleAdminGetSheetList());
  if (action === "adminDownloadExcel") return responseJSON(handleAdminDownloadExcel(postData));
  return responseJSON({ success: false, message: "未知請求" });
}

function updateLastActive(name) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(data[i][0] === name) {
        sheet.getRange(i+1, 10).setValue(new Date());
        return;
      }
    }
  } catch(e) {}
}

// ==========================================
// 2. 核心邏輯區 (Logic)
// ==========================================

// [修改] 強化版狀態檢查 (支援管理員 E 欄踢出 + 無視員工名單限制)
function handleCheckStatus(uid, loginTime, name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userProfile = null;
  let isAdminForceLogout = false;
  
  // 1. 檢查是否為管理員 (並檢查是否被 E 欄踢出)
  const adminSheet = ss.getSheetByName(SHEET_ADMINS);
  let adminInfo = null;
  
  if (adminSheet && name) {
      const aData = adminSheet.getDataRange().getValues();
      for (let j = 1; j < aData.length; j++) {
          if (String(aData[j][0]).trim() === name) {
               // 檢查 E 欄 (Index 4) 是否為 TRUE -> 強制踢出
               if (aData[j][4] === true || aData[j][4] === "TRUE") {
                   isAdminForceLogout = true;
               }
               
               // 建立基礎管理員 Profile
               const ar = aData[j][3];
               const adminRegions = ar ? String(ar).split(',').map(s=>s.trim()).filter(s=>s!=="") : [];
               
               adminInfo = {
                   isAdmin: true,
                   adminRegions: adminRegions
               };
               break;
          }
      }
  }

  if (isAdminForceLogout) {
      return { success: false, status: 'force_logout', message: "管理員權限已被撤銷或強制登出。" };
  }

  // 2. 檢查員工表 (如果有的話)
  // 先檢查 Session (針對有 UID 的員工)
  if (uid && !checkSessionValid(uid, loginTime)) {
     return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號。" };
  }

  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  const data = staffSheet.getDataRange().getValues();
  
  // 搜尋員工資料
  for (let i = 1; i < data.length; i++) {
    // 比對 UID (優先) 或 名字 (若無 UID)
    const rowUid = String(data[i][14]);
    const rowName = String(data[i][0]);
    
    if ((uid && rowUid === String(uid)) || (!uid && name && rowName === name)) {
      const row = data[i];
      const needReset = (row[3] === true || row[3] === "TRUE");
      
      if (needReset) return { success: true, status: 'need_reset' };

      const allowRemoteStaff = (row[4] === true || row[4] === "TRUE");
      const staffRegion = row[13] || ""; 
      
      // 讀取班別
      let shiftInfo = null;
      const shiftName = row[11];
      if (shiftName) {
         const shiftSheet = ss.getSheetByName(SHEET_SHIFTS);
         if (shiftSheet) {
            const shifts = shiftSheet.getDataRange().getDisplayValues();
            for (let k = 1; k < shifts.length; k++) {
                if (shifts[k][0] === shiftName) {
                    shiftInfo = { name: shifts[k][0], start: shifts[k][1], end: shifts[k][2] };
                    break;
                }
            }
         }
      }
      
      // 檢查主管身分
      let isSupervisor = false;
      let supRegions = [];
      const supSheet = ss.getSheetByName(SHEET_SUPERVISORS);
      if (supSheet) {
         const sData = supSheet.getDataRange().getValues();
         for (let k = 1; k < sData.length; k++) {
             const sUid = sData[k][4];
             const sName = String(sData[k][0]).trim();
             if ((sUid && uid && String(sUid) === String(uid)) || (!sUid && sName === rowName)) {
                 isSupervisor = true;
                 const sr = sData[k][3];
                 if (sr) supRegions = String(sr).split(',').map(s=>s.trim()).filter(s=>s!=="");
                 break;
             }
         }
      }
      
      // 合併權限 (管理員權限可能來自上面的 check)
      const finalIsAdmin = adminInfo ? true : false;
      const finalAllowRemote = allowRemoteStaff || finalIsAdmin || isSupervisor;
      
      const adminRegions = adminInfo ? adminInfo.adminRegions : [];
      const allRegions = [...new Set([...(staffRegion ? staffRegion.split(',').map(s=>s.trim()) : []), ...adminRegions, ...supRegions])].filter(s=>s!=="");

      userProfile = {
         name: rowName,
         uid: rowUid || uid, // 確保有 UID
         needReset: false,
         allowRemote: finalAllowRemote,
         isAdmin: finalIsAdmin,
         isSupervisor: isSupervisor,
         shift: shiftInfo,
         regions: allRegions
      };
      break;
    }
  }

  // [重點] 如果 userProfile 還是空的，但他是管理員 (adminInfo 存在)，則手動建立一個純管理員 Profile
  if (!userProfile && adminInfo) {
      userProfile = {
          name: name,
          uid: "", // 純管理員無 UID
          needReset: false,
          allowRemote: true,
          isAdmin: true,
          isSupervisor: false,
          shift: null,
          regions: adminInfo.adminRegions
      };
  }

  if (userProfile) {
      return { success: true, status: 'ok', updatedUser: userProfile };
  }
  
  // 找不到人
  return { success: false, status: 'force_logout', message: "帳號資料異常或已刪除。" };
}

// [修改後] 2. checkSessionValid: 加強檢查，若無時間則視為失效
function checkSessionValid(uid, clientLoginTime) {
  // [安全性修正] 如果沒有提供登入時間，視為非法請求，直接踢出
  if (!clientLoginTime) return false;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const data = sheet.getDataRange().getValues();
  
  // [修改] 改為比對 UID (第 15 欄, Index 14)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][14]) === String(uid)) {
      // 讀取第 13 欄 (Index 12) - 強制登出時間
      const forceLogoutVal = data[i][12];
      if (forceLogoutVal) {
        const kickTime = new Date(forceLogoutVal).getTime();
        if (kickTime > clientLoginTime) {
          return false;
        }
      }
      return true;
    }
  }
  return true;
}

function handleAdminGetSheetList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();
  const systemSheets = [SHEET_STAFF, SHEET_ADMINS, SHEET_LOCATIONS, SHEET_RECORDS, SHEET_LINE_IDS, SHEET_ADMIN_LOGS, SHEET_SHIFTS, "line bot設定", "北區維運班表", "國定假日", "待處理","當日出勤","當月統計","主管名單"];
  let list = [];
  list.push({ name: SHEET_CURRENT_MONTH, label: `${SHEET_CURRENT_MONTH} (當前)` });
  allSheets.forEach(sheet => {
    const name = sheet.getName();
    if (!systemSheets.includes(name) && name !== SHEET_CURRENT_MONTH) {
      list.push({ name: name, label: name });
    }
  });
  return { success: true, list: list };
}

function handleAdminDownloadExcel(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = data.sheetName || SHEET_CURRENT_MONTH;
  const srcSheet = ss.getSheetByName(targetSheetName);
  if (!srcSheet) return { success: false, message: `找不到「${targetSheetName}」工作表` };
  const tempFileName = `匯出暫存_${targetSheetName}_(可刪除)`;
  try {
    const oldFiles = DriveApp.getFilesByName(tempFileName);
    while (oldFiles.hasNext()) { oldFiles.next().setTrashed(true); }
  } catch(e) {}

  try {
    const lastRow = srcSheet.getLastRow();
    // [修改] 延伸欄位範圍，確保抓取到 AO 後面的 AR 格式 (getLastColumn + 3)
    const lastCol = Math.max(srcSheet.getLastColumn() + 3, 34);
    const stagingSheet = ss.insertSheet("Export_Staging_" + new Date().getTime());
    for (let c = 1; c <= lastCol; c++) { try { stagingSheet.setColumnWidth(c, srcSheet.getColumnWidth(c)); } catch(e) {} }

    let targetRow = 1;
    let hasData = false;
    let r = 1;
    const BLOCK_STEP = 33;

    while (r <= lastRow) {
      const cellMain = srcSheet.getRange(r, 5).getValue();
      const hasMainData = String(cellMain).trim() !== "";
      let isExtended = false;
      if (r + 33 <= lastRow) {
         const cellExt = srcSheet.getRange(r + 33, 5).getValue();
         if (String(cellExt).trim() !== "") { isExtended = true; }
      }

      if (hasMainData) {
        hasData = true;
        let height = 32;
        let nextStep = BLOCK_STEP;
        if (isExtended) { height = 65; nextStep = BLOCK_STEP * 2; }
        if (r + height - 1 > lastRow) { height = lastRow - r + 1; }
        const srcRange = srcSheet.getRange(r, 1, height, lastCol);
        const destRange = stagingSheet.getRange(targetRow, 1, height, lastCol);
        srcRange.copyTo(destRange);
        const plainValues = srcRange.getValues(); 
        destRange.setValues(plainValues);
        targetRow += height;
        r += nextStep;
      } else { r += BLOCK_STEP; }
    }

    if (!hasData) {
      ss.deleteSheet(stagingSheet);
      return { success: false, message: "沒有找到任何資料" };
    }
    SpreadsheetApp.flush();
    const newSS = SpreadsheetApp.create(tempFileName);
    const exportedSheet = stagingSheet.copyTo(newSS);
    exportedSheet.setName(targetSheetName); 
    newSS.deleteSheet(newSS.getSheets()[0]); 
    ss.deleteSheet(stagingSheet);
    try {
      const file = DriveApp.getFileById(newSS.getId());
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {}
    const downloadUrl = "https://docs.google.com/spreadsheets/d/" + newSS.getId() + "/export?format=xlsx";
    logAdminAction(data.adminName || "未知", "匯出Excel", `匯出表單：${targetSheetName}`);
    return { success: true, url: downloadUrl };
  } catch (e) {
    return { success: false, message: "匯出失敗: " + e.toString() };
  }
}

function handleLogin(name, password, deviceId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  const adminSheet = ss.getSheetByName(SHEET_ADMINS);
  if (!staffSheet) return { success: false, message: "系統尚未初始化" };
  
  const cleanName = name.trim();
  const cleanPwd = password.trim();
  const hashedPwd = hashData(cleanPwd); // 計算輸入密碼的雜湊值
  const now = new Date().getTime();

  // [修改] 移除舊的預先檢查，主管身分將在後面透過 UID 嚴格判定
  let isSupervisor = false;
  const supSheet = ss.getSheetByName(SHEET_SUPERVISORS);

  let isAdmin = false;
  let adminPwdCorrect = false;
  let allowedRegions = []; // [新增] 儲存分區權限

  if (adminSheet) {
    const adminData = adminSheet.getDataRange().getValues();
    for (let j = 1; j < adminData.length; j++) {
      if (String(adminData[j][0]).trim() === cleanName) {
        const storedAdminPwd = String(adminData[j][1]).trim();
        // 檢查明碼 (舊版) 或 雜湊碼 (新版)
        if (storedAdminPwd === cleanPwd || storedAdminPwd === hashedPwd) {
           isAdmin = true;
           adminPwdCorrect = true;
           if (storedAdminPwd === cleanPwd) adminSheet.getRange(j+1, 2).setValue(hashedPwd);
           
           // [新增] 讀取 D 欄 (Index 3) 分區設定
           const regionRaw = adminData[j][3]; 
           if (regionRaw) {
             allowedRegions = String(regionRaw).split(',').map(s => s.trim()).filter(s => s !== "");
           }
        }
        break;
      }
    }
  }
  

  let isStaff = false;
  let staffRowIndex = -1;
  let staffData = staffSheet.getDataRange().getValues();
  let matchedUserUID = null; // [新增]

  // [修改] 遍歷所有員工，尋找「(姓名 或 UID) + 密碼」都吻合的那一位
  for (let i = 1; i < staffData.length; i++) {
    const rowName = String(staffData[i][0]).trim();
    const rowUid = String(staffData[i][14] || "").trim(); // UID 在 O 欄 (Index 14)
    
    // 判定輸入的是 UID 還是 姓名
    const isUidMatch = (rowUid === cleanName);
    const isNameMatch = (rowName === cleanName);

    if (isNameMatch || isUidMatch) {
       // 帳號對了，檢查密碼 (支援明碼或Hash)
       const rowPwd = String(staffData[i][1]).trim();
       if (rowPwd === cleanPwd || rowPwd === hashedPwd) {
          
          // [新增] 首次登入強制檢查：若需重設密碼，輸入值必須是 UID
          const needResetStatus = (String(staffData[i][3]).toUpperCase() === "TRUE");
          if (needResetStatus && !isUidMatch) {
              return { success: false, message: "⚠️ 首次登入請輸入您的「UID」而非姓名。" };
          }

          isStaff = true;
          staffRowIndex = i;
          // [新增] 取得或產生 UID
          matchedUserUID = getOrGenUID(staffSheet, i, staffData[i][14]);
          break; // 找到正確的那位了
       }
    }
  }

  // [新增] 如果沒找到正確密碼，但有找到名字或UID (為了錯誤提示與記錄失敗次數)
  if (!isStaff) {
     for (let i = 1; i < staffData.length; i++) {
        const rowName = String(staffData[i][0]).trim();
        const rowUid = String(staffData[i][14] || "").trim();
        // [修正] 支援用 UID 找到該員工來記過
        if (rowName === cleanName || rowUid === cleanName) {
           staffRowIndex = i;
           break;
        }
     }
  }

  if (isAdmin && !isStaff) {
    return { success: true, name: cleanName, needReset: false, allowRemote: true, isAdmin: true };
  }

  if (isStaff) {
    const row = staffData[staffRowIndex];
    const targetRow = staffRowIndex + 1;
    const lockedUntil = row[7] ? new Date(row[7]).getTime() : 0;
    if (lockedUntil > now) {
      const waitHours = Math.ceil((lockedUntil - now) / (1000 * 60 * 60));
      return { success: false, message: `⛔ 帳號已被鎖定！\n請等待 ${waitHours} 小時或聯繫管理員解鎖。` };
    }

    const storedStaffPwd = String(row[1]).trim();
    let staffPwdCorrect = false;
    
    // 雙重驗證機制 (相容舊明碼與新加密碼)
    if (storedStaffPwd === cleanPwd) {
       staffPwdCorrect = true;
       staffSheet.getRange(targetRow, 2).setValue(hashedPwd); // 自動升級加密
    } else if (storedStaffPwd === hashedPwd) {
       staffPwdCorrect = true;
    }

    if (adminPwdCorrect || staffPwdCorrect) {
       // [新增] 嚴格判定主管身分：使用 UID 比對
       if (!isAdmin && supSheet && matchedUserUID) {
           const supData = supSheet.getDataRange().getValues();
           for (let k = 1; k < supData.length; k++) {
               const sUid = String(supData[k][4] || "").trim(); // UID 在 E 欄 (Index 4)
               if (sUid === matchedUserUID) {
                   isSupervisor = true;
                   // 讀取 D 欄 (Index 3) 分區
                   const regionRaw = supData[k][3];
                   if (regionRaw) {
                       allowedRegions = String(regionRaw).split(',').map(s => s.trim()).filter(s => s !== "");
                   }
                   break;
               }
           }
       }

       // [修改] 2. 豁免權邏輯：如果不是管理員 且 不是主管，才檢查裝置ID
       if (!isAdmin && !isSupervisor) {
          const storedDeviceId = row[10];
          if (deviceId) {
            if (storedDeviceId && String(storedDeviceId).trim() !== "") {
              if (String(storedDeviceId).trim() !== deviceId) {
                return { success: false, message: "⛔ 此帳號已綁定其他裝置！\n請使用原手機登入，或聯繫管理員「解綁」。" };
              }
            } else {
              staffSheet.getRange(targetRow, 11).setValue(deviceId);
            }
          }
       }
       
       // 重置錯誤次數 (Col 6~9)
       staffSheet.getRange(targetRow, 6, 1, 4).setValues([[0, "", "", 24]]);
       // [新增] 更新最後上線時間 (Col 10, Index 9)
       staffSheet.getRange(targetRow, 10).setValue(new Date());

       const status = row[3]; 
       const allowRemote = (row[4] === true || row[4] === "TRUE");
       
       let shiftInfo = null;
       const shiftName = row[11];
       // 班別名稱在第 12 欄
       if (shiftName) {
         const shiftSheet = ss.getSheetByName(SHEET_SHIFTS);
         if (shiftSheet) {
            // 使用 getDisplayValues 確保讀到的是 HH:mm 字串
            const shifts = shiftSheet.getDataRange().getDisplayValues();
            for (let k = 1; k < shifts.length; k++) {
                if (shifts[k][0] === shiftName) {
                    shiftInfo = { name: shifts[k][0], start: shifts[k][1], end: shifts[k][2] };
                    break;
                }
            }
         }
       }

       // [修正] 必須回傳資料庫裡的「真實姓名」(staffData[staffRowIndex][0])，而不是使用者輸入的 cleanName (可能是 UID)
       return { 
         success: true, 
         name: String(staffData[staffRowIndex][0]).trim(),
         uid: matchedUserUID, // [新增] 回傳 UID
         loginTime: new Date().getTime(), // [新增] 強制使用伺服器時間作為登入時間
         needReset: (status === true || status === "TRUE"),
         // ... (略)
         isSupervisor: isSupervisor, 
         shift: shiftInfo,
         region: row[13] || "", // [新增] 回傳個人分區 (N欄) 供前端顯示
         regions: allowedRegions // 分區權限列表
       };

    } else {
       let failCount = Number(row[5]) || 0;
       let lastFail = row[6] ? new Date(row[6]).getTime() : 0;
       let lockDuration = Number(row[8]) || 24;

       if (now - lastFail <= 600000) { failCount++;
       } else { failCount = 1; }

       let newLockedUntil = "";
       let errorMsg = "帳號或密碼錯誤";
       
       if (failCount >= 5) {
         const lockTime = now + (lockDuration * 60 * 60 * 1000);
         newLockedUntil = new Date(lockTime);
         errorMsg = `⛔ 錯誤次數過多！\n帳號已鎖定 ${lockDuration} 小時。`;
         lockDuration = lockDuration * 2;
       } else {
         errorMsg = `密碼錯誤！(10分鐘內累積 ${failCount}/5 次)`;
       }

       staffSheet.getRange(targetRow, 6, 1, 4).setValues([[failCount, new Date(), newLockedUntil, lockDuration]]);
       return { success: false, message: errorMsg };
    }
  }
  return { success: false, message: "帳號或密碼錯誤" };
}

function handleClockIn(data) {
  // [修改] 無論 data.loginTime 是否存在，都要執行 checkSessionValid (若不存在會被上面的邏輯擋下)
  if (!checkSessionValid(data.uid, data.loginTime)) {
    return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號，請重新登入。" };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  // [修改] 改傳 uid 給 checkTooFrequent
  if (!data.force && checkTooFrequent(data.uid, sheet)) {
    return { success: false, status: 'warning_duplicate', message: "⚠️ 系統偵測您 1 小時內已經打過卡。\n\n您確定要重複打卡嗎？" };
  }
  updateLastActive(data.name);
  let allowRemote = false;
  let userRegion = ""; // [新增] 暫存分區
  const staffData = staffSheet.getDataRange().getValues();
  for(let i=1; i<staffData.length; i++) {
    // 這裡建議加上 UID 比對更保險，但維持現狀先用 name
    if(staffData[i][0] === data.name) {
      const flag = staffData[i][4];
      allowRemote = (flag === true || flag === "TRUE" || flag === "true");
      userRegion = staffData[i][13] || ""; // [新增] 讀取 N 欄 (Index 13)
      break;
    }
  }
  if (data.isAdmin) allowRemote = true; 

  let target = null;
  const locs = locSheet.getDataRange().getValues();
  for(let i=1; i<locs.length; i++) {
    if(locs[i][0] === data.station) {
      // [修改] 讀取 IP 設定
      target = { lat: locs[i][1], lng: locs[i][2], r: locs[i][3], ip: String(locs[i][4] || "") };
      break;
    }
  }
  let res = "成功";
  let distInfo = "";
  let note = data.note || "";

 // [修改] IP 檢查邏輯
  let isIpValid = false;
  if (target && target.ip && data.ip && target.ip.includes(data.ip)) {
      isIpValid = true;
  }

  if (target) {
    const dist = getDist(data.lat, data.lng, target.lat, target.lng);
    distInfo = Math.round(dist) + "m";
    
    // [新增] 判斷 GPS 是否合格
    const isGpsValid = dist <= target.r;

    let typeLabel = ""; // 打卡方式標籤

    // 邏輯判定順序：
    // 1. IP 和 GPS 都合格 -> 雙重
    // 2. 只有 IP 合格 -> IP打卡
    // 3. 只有 GPS 合格 -> GPS打卡
    // 4. 都不合格但有遠端權限 -> 遠端打卡
    // 5. 失敗

    if (isIpValid && isGpsValid) {
        res = "成功";
        typeLabel = "雙重驗證(IP+GPS)";
    } else if (isIpValid) {
        res = "成功";
        typeLabel = "IP打卡";
    } else if (isGpsValid) {
        res = "成功";
        typeLabel = "GPS打卡";
    } else if (allowRemote) {
        res = "成功";
        typeLabel = `遠端打卡(${distInfo})`;
    } else {
        res = `失敗 (距離 ${distInfo})`;
    }

    // 將標籤寫入備註 (Column I)
    if (typeLabel) {
        note = note ? `[${typeLabel}] ${note}` : typeLabel;
    }

  } else { res = "地點異常"; }
  const now = new Date();
  // [修改] 將 UID 寫入 Q 欄，分區寫入 R 欄
  sheet.appendRow([
    now, 
    formatDate(now,"yyyy/MM/dd"), 
    formatDate(now,"HH:mm:ss"), 
    data.name, 
    data.type, 
    data.station, 
    res, 
    `${data.lat},${data.lng}`, 
    note,
    "", "", "", "", "", "", "", // J~P (7個空位)
    data.uid || "",             // Q (UID)
    userRegion                  // R (分區) [新增]
 ]);
  SpreadsheetApp.flush(); 
  return res.includes("失敗") ? { success: false, message: res } : { success: true, message: "打卡成功" };
}

// [修改] 員工查詢歷史紀錄 (改為讀取矩陣式報表)
function handleGetHistory(uid, loginTime) {
  // [修改] 檢查 Session 改用 UID
  if (loginTime && !checkSessionValid(uid, loginTime)) {
     return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號，請重新登入。" };
  }

  // [新增] 用 UID 反查姓名 (因為矩陣表還是認名字)
  const name = getNameByUid(uid);
  if (!name) return { success: false, message: "找不到使用者資料" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName("打卡紀錄整理");
  
  // 1. 從「打卡紀錄整理」讀取年份與月份 (A1, A2)
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  
  if (mainSheet) {
     const yVal = mainSheet.getRange("A1").getValue();
     const mVal = mainSheet.getRange("A2").getValue();
     if (yVal && mVal) {
        currentYear = parseInt(yVal);
        currentMonth = parseInt(mVal);
     }
  }

  // 2. 推算上個月
  let lastYear = currentYear;
  let lastMonth = currentMonth - 1;
  if (lastMonth < 1) {
     lastMonth = 12;
     lastYear -= 1;
  }
  // 上月工作表名稱規則：不補0 (例如 "2025/12" 或 "2025/1")
  const lastMonthSheetName = `${lastYear}/${lastMonth}`;
  
  const cleanName = String(name).trim();
  // [修改] 改傳 UID
  const lastRawRec = getLastRawClockIn(uid);
  
  return { 
    success: true, 
    data: { 
      // 當月：讀取 "打卡紀錄整理" (傳入 UID)
      current: fetchUserData(ss, "打卡紀錄整理", cleanName, uid), 
      // 上月：讀取 "YYYY/M"
      last: fetchUserData(ss, lastMonthSheetName, cleanName, uid), 
      lastMonthName: lastMonthSheetName, 
      lastRawRec: lastRawRec 
    } 
  };
}

function getNameByUid(uid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][14]) === String(uid)) {
      return data[i][0]; // 回傳姓名
    }
  }
  return null;
}

function getLastRawClockIn(uid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const startRow = Math.max(2, lastRow - 100);
  // [修改] 擴大範圍到 17 (Q欄)
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 17).getDisplayValues();
  
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    // [修改] 比對 Q 欄 (Index 16)
    if (String(row[16]) === String(uid) && row[6].includes("成功")) { 
        return `${row[1]} ${row[2]} (${row[4]})`;
    }
  }
  return null;
}

// [新增] 輔助：解析分區字串 (支援全形/半形逗號、去除空白)
function parseRegions(regionStr) {
  if (!regionStr) return [];
  return String(regionStr).split(/[,，]/).map(s => s.trim()).filter(s => s !== "");
}

// [新增] 輔助：權限交集比對 (主管權限 vs 目標分區)
function checkRegionPermission(allowedRegions, targetRegionStr) {
  if (allowedRegions.length === 0) return false; // 主管未設定分區，預設不給看
  if (allowedRegions.includes("全區")) return true;
  
  const targetRegions = parseRegions(targetRegionStr);
  if (targetRegions.length === 0) return false; // 目標無分區，嚴格模式下不給看
  
  // 只要兩邊有任何一個分區重疊，就允許
  return allowedRegions.some(ar => targetRegions.includes(ar));
}

function handleAdminGetData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = ss.getSheetByName(SHEET_ADMINS);
  const supSheet = ss.getSheetByName(SHEET_SUPERVISORS);

  // 1. 強制身分驗證
  let isAdmin = false;
  let isSupervisor = false;
  let allowedRegions = [];

  // (1) 檢查管理員
  if (adminSheet) {
    const admins = adminSheet.getDataRange().getValues();
    for (let i = 1; i < admins.length; i++) {
      if (admins[i][0] === data.name) { 
         isAdmin = true;
         break;
      }
    }
  }

  // (2) 若非管理員，檢查主管 (嚴格 UID 比對)
  if (!isAdmin && supSheet) {
      const supData = supSheet.getDataRange().getValues();
      for (let k = 1; k < supData.length; k++) {
          const sName = String(supData[k][0]).trim();
          const sUid = String(supData[k][4] || "").trim(); // E欄 UID
          
          // 優先比對 UID，若無則比對 Name
          const isMatch = (data.uid && data.uid === sUid) || (sName === data.name);
          
          if (isMatch) {
              isSupervisor = true;
              // 解析 D 欄 (Index 3) 分區權限
              allowedRegions = parseRegions(supData[k][3]);
              break;
          }
      }
  }

  // 若兩者皆非，拒絕存取
  if (!isAdmin && !isSupervisor) {
      return { success: false, message: "無權限" };
  }

  // 內部讀取函式
  const fetchInternal = (type) => {
     return getSheetDataInternal(ss, type, allowedRegions, isAdmin);
  };

  if (data.dataType === 'all') {
    return {
      success: true,
      allData: {
        staff: fetchInternal('staff'),
        line: fetchInternal('line'),
        location: fetchInternal('location'),
        record: fetchInternal('record'),
        log: fetchInternal('log'),
        shift: fetchInternal('shift'),
        supervisor: fetchInternal('supervisor')
      }
    };
  }

  return fetchInternal(data.dataType);
}

function getSheetDataInternal(ss, dataType, allowedRegions, isAdmin) {
  let sheetName = "";
  if (dataType === 'staff') sheetName = SHEET_STAFF;
  else if (dataType === 'line') sheetName = SHEET_LINE_IDS;
  else if (dataType === 'location') sheetName = SHEET_LOCATIONS;
  else if (dataType === 'record') sheetName = SHEET_RECORDS;
  else if (dataType === 'log') sheetName = SHEET_ADMIN_LOGS;
  else if (dataType === 'shift') sheetName = SHEET_SHIFTS;
  else if (dataType === 'supervisor') sheetName = SHEET_SUPERVISORS;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "找不到工作表" };
  
  const allData = sheet.getDataRange().getDisplayValues();
  if (allData.length === 0) return { success: true, headers: [], list: [] };

  let headers = allData[0];
  let list = [];

  // 準備員工分區對照表 (Map: UID/Name -> Region)
  // 僅在非管理員且撈取 Record/Log 時需要
  let staffRegionMap = {};
  if (!isAdmin && allowedRegions.length > 0 && (dataType === 'record' || dataType === 'log')) {
      const staffSheet = ss.getSheetByName(SHEET_STAFF);
      if(staffSheet) {
          const sData = staffSheet.getDataRange().getDisplayValues();
          for(let i=1; i<sData.length; i++) {
              const rName = sData[i][0];
              const rUid = sData[i][14]; // O欄 UID
              const region = sData[i][13] || ""; // N欄 分區
              staffRegionMap[rName] = region; 
              if (rUid) staffRegionMap[rUid] = region; 
          }
      }
  }

  // 檢查是否可見的封裝函式
  const isAllowed = (targetRegion) => {
      if (isAdmin) return true;
      return checkRegionPermission(allowedRegions, targetRegion);
  };

  if (dataType === 'staff') {
     headers = ["姓名", "密碼", "LINE_ID", "需重設", "遠端", "帳號狀態", "裝置綁定", "班別", "分區", "UID"];
     const now = new Date().getTime();
     const rawList = allData.slice(1);
     
     list = rawList.filter(row => {
         // [過濾] 員工名單：檢查 N 欄 (Index 13)
         return isAllowed(row[13]); 
     }).map(row => {
         // Mapping 輸出
         const lockedTime = row[7] ? new Date(row[7]).getTime() : 0;
         const isLocked = lockedTime > now;
         const deviceId = row[10];
         const isBound = (deviceId && deviceId.length > 5);
         const shift = row[11] || "";
         const region = row[13] || "";
         const uid = row[14] || "";
         return [ row[0], "******", row[2], row[3], row[4], isLocked ? "🔒已鎖定" : "正常", isBound ? "📱已綁定" : "未綁定", shift, region, uid ];
     });
  }
  else if (dataType === 'record' || dataType === 'log') {
     const rawData = allData.slice(1);
     let targetData = rawData;

     if (!isAdmin && allowedRegions.length > 0) {
         targetData = targetData.filter(row => {
             // 1. [Record] 優先檢查 R 欄 (Index 17)
             if (dataType === 'record' && row[17]) {
                 return isAllowed(row[17]);
             }
             // 2. [Fallback] 反查 Map (用 UID 或 Name)
             let key = (dataType === 'record') ? (row[16] || row[3]) : row[1];
             if (!staffRegionMap[key]) return false; // 找不到人就不給看
             return isAllowed(staffRegionMap[key]);
         });
     }
     list = targetData.slice(-100).reverse(); // 取最後100筆
  }
  else {
     // 其他資料表直接給
     list = allData.slice(1);
  }

  return { success: true, headers: headers, list: list };
}


function handleAdminUpdateShift(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SHIFTS);
  if (data.op === 'add') {
    sheet.appendRow([data.name, data.start, data.end]);
    logAdminAction(data.adminName, "新增班別", `新增 ${data.name} (${data.start}-${data.end})`);
    return { success: true };
  }
  if (data.op === 'delete') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) {
       if(rows[i][0] === data.targetName) {
         sheet.deleteRow(i+1);
         logAdminAction(data.adminName, "刪除班別", `刪除 ${data.targetName}`);
         return { success: true };
       }
    }
    return { success: false, message: "找不到該班別" };
  }
  return { success: false, message: "未知操作" };
}

function handleAdminUpdateStaff(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const op = data.op;
  const adminName = data.adminName || "未知管理員";
  
  if (op === 'add') {
    // 產生 UID
    const newUID = 'u_' + Math.random().toString(36).substr(2, 8);
    // [修改] 寫入包含 Region (第 14 欄/Index 13) 與 UID (第 15 欄/Index 14)
    // 欄位順序: Name, Pwd, Line, Reset, Remote, Fail, LastFail, LockUntil, LockMult, LastActive, DeviceId, Shift, ForceLogout, Region, UID
    sheet.appendRow([ 
        data.newData.name, 
        hashData(data.newData.password), 
        data.newData.lineId || "", 
        "TRUE", 
        data.newData.allowRemote === "TRUE" ? "TRUE" : "FALSE", 
        0, "", "", 24, "", "", 
        data.newData.shift || "", 
        "", 
        data.newData.region || "", // Region
        newUID 
    ]);

    // [新增] 自動發送 UID 給新員工
    if (data.newData.lineId) {
       pushLine(data.newData.lineId, `👋 歡迎加入！\n\n您的員工 UID 為：${newUID}\n預設密碼：${data.newData.password}\n\n⚠️ 首次登入請務必使用「UID」+「密碼」登入系統。`);
    }

    logAdminAction(adminName, "新增員工", `新增了 ${data.newData.name} (UID:${newUID})`);
    return { success: true };
  }

  if (op === 'edit') {
    const rows = sheet.getDataRange().getValues();
    let targetIndex = findStaffIndexByUID(rows, data.targetUid);
    // 相容性搜尋 (若無 UID 則用舊名找)
    if (targetIndex === -1 && data.oldName) {
       for(let i=1; i<rows.length; i++) {
          if(rows[i][0] === data.oldName) { targetIndex = i;
          break; }
       }
    }

    if (targetIndex !== -1) {
        const i = targetIndex;
        const oldRow = rows[i];
        const oldData = { 
            name: String(oldRow[0]), 
            pwd: String(oldRow[1]), 
            line: String(oldRow[2]), 
            reset: String(oldRow[3]).toUpperCase(), 
            remote: String(oldRow[4]).toUpperCase(), 
            shift: String(oldRow[11]||""),
            region: String(oldRow[13]||"") // 讀取舊分區
        };
        
        let finalPwd = oldData.pwd;
        let isPwdChanged = false;
        if (data.newData.password !== "******") {
           finalPwd = hashData(data.newData.password);
           isPwdChanged = true;
        }

        const newData = { 
            name: String(data.newData.name), 
            pwd: finalPwd, 
            line: String(data.newData.lineId), 
            reset: String(data.newData.needReset).toUpperCase(), 
            remote: String(data.newData.allowRemote).toUpperCase(), 
            shift: String(data.newData.shift || ""),
            region: String(data.newData.region || "") // 新分區
        };
        
        let changes = [];
        if (oldData.name !== newData.name) changes.push(`姓名: ${oldData.name} -> ${newData.name}`);
        if (isPwdChanged) changes.push(`密碼已變更`);
        if (oldData.line !== newData.line) changes.push(`LineID: ${oldData.line} -> ${newData.line}`);
        if (oldData.shift !== newData.shift) changes.push(`班別: ${oldData.shift} -> ${newData.shift}`);
        if (oldData.region !== newData.region) changes.push(`分區: ${oldData.region} -> ${newData.region}`);
        
        // 更新 Col 1~5 (A~E)
        sheet.getRange(i+1, 1, 1, 5).setValues([[ newData.name, newData.pwd, newData.line, newData.reset, newData.remote ]]);
        // 重置鎖定 (Col 6~9)
        sheet.getRange(i+1, 6, 1, 4).setValues([[0, "", "", 24]]);
        // 更新班別 (Col 12/L)
        sheet.getRange(i+1, 12).setValue(newData.shift);
        // [修改] 更新分區 (Col 14/N)
        sheet.getRange(i+1, 14).setValue(newData.region);

        const logDetail = changes.length > 0 ? `修改 ${data.oldName}：${changes.join('、')}` : `修改 ${data.oldName} (無變更)`;
        logAdminAction(adminName, "編輯員工", logDetail);
        return { success: true };
    }
    return { success: false, message: "找不到該員工" };
  }

  // [修正] 確保這段邏輯在函式大括號內部
  if (['kick', 'unbind', 'delete'].includes(op)) {
    const rows = sheet.getDataRange().getValues();
    let targetIndex = findStaffIndexByUID(rows, data.targetUid);
    
    // Fallback search
    if (targetIndex === -1 && data.targetName) {
       for(let i=1; i<rows.length; i++) {
          if(rows[i][0] === data.targetName) { targetIndex = i; break; }
       }
    }

    if (targetIndex === -1) return { success: false, message: "找不到該員工" };

    const i = targetIndex;
    const targetRealName = rows[i][0];

    if (op === 'kick') {
        sheet.getRange(i+1, 13).setValue(new Date());
        logAdminAction(adminName, "強制登出", `將 ${targetRealName} 強制登出`);
        return { success: true };
    }

    if (op === 'unbind') {
        sheet.getRange(i+1, 11).setValue("");
        logAdminAction(adminName, "解除綁定", `解除了 ${targetRealName} 的裝置綁定`);
        return { success: true };
    }

    if (op === 'delete') {
        sheet.deleteRow(i+1);
        logAdminAction(adminName, "刪除員工", `刪除了 ${targetRealName}`); 
        return { success: true };
    }
  }
  
  return { success: false, message: "未知操作" };
}


function handleAdminUnlockStaff(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const rows = sheet.getDataRange().getValues();
  
  let targetIndex = findStaffIndexByUID(rows, data.targetUid);
  if (targetIndex === -1 && data.targetName) { // Fallback
     for(let i=1; i<rows.length; i++) { if(rows[i][0] === data.targetName) { targetIndex = i; break; } }
  }

  if (targetIndex !== -1) {
      const i = targetIndex;
      sheet.getRange(i+1, 6, 1, 4).setValues([[0, "", "", 24]]);
      logAdminAction(data.adminName, "解除鎖定", `解鎖了 ${rows[i][0]} 的帳號`); 
      return { success: true };
  }
  return { success: false, message: "找不到員工" };
}

function handleUpdatePassword(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let updated = false;
  
  // 1. 更新員工清單 (SHEET_STAFF)
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  if (staffSheet) {
    const rows = staffSheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { 
      if(rows[i][0] === data.name) { 
          const stored = String(rows[i][1]).trim();
          const oldInput = data.oldPassword.trim();
          // 驗證舊密碼 (支援明碼或 Hash)
          if (stored === oldInput || stored === hashData(oldInput)) { 
             staffSheet.getRange(i+1, 2).setValue(hashData(data.newPassword.trim())); // 加密存入
             updated = true;
          }
      } 
    }
  }

  // 2. 更新管理員清單 (SHEET_ADMINS) - [重點] 這段完整展開
  const adminSheet = ss.getSheetByName(SHEET_ADMINS);
  if (adminSheet) {
     const rows = adminSheet.getDataRange().getValues();
     for(let i=1; i<rows.length; i++) {
        if(rows[i][0] === data.name) {
             const stored = String(rows[i][1]).trim();
             const oldInput = data.oldPassword.trim();
             // 驗證舊密碼 (支援明碼或 Hash)
             if (stored === oldInput || stored === hashData(oldInput)) {
                 adminSheet.getRange(i+1, 2).setValue(hashData(data.newPassword.trim())); // 加密存入
                 updated = true;
             }
        }
     }
  }

  if (updated) {
     logAdminAction(data.name, "修改密碼", "使用者自行修改密碼 (同步)");
     return { success: true };
  } else {
     return { success: false, message: "舊密碼錯誤或找不到帳號" };
  }
}

function handleChangePassword(name, newPwd) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let updated = false;
    const hashed = hashData(newPwd);
    // [修改] 加密

    const cleanName = String(name).trim();

    const staffSheet = ss.getSheetByName(SHEET_STAFF);
    if(staffSheet) {
      const data = staffSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) { 
          const rowName = String(data[i][0]).trim();
          const rowUid = String(data[i][14] || "").trim(); // UID 在 O 欄

          // [修正] 同時比對 姓名 或 UID
          if (rowName === cleanName || (rowUid && rowUid === cleanName)) { 
              staffSheet.getRange(i + 1, 2).setValue(hashed);
              // 存 Hash
              staffSheet.getRange(i + 1, 4).setValue("FALSE");
              updated = true;
              break; // 找到人就停止，避免同名誤改 (雖然有鎖定第一位，但加 break 較安全)
          } 
      }
    }
    
    const adminSheet = ss.getSheetByName(SHEET_ADMINS);
    if(adminSheet) {
      const data = adminSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) { 
          if (data[i][0] === name) { 
              adminSheet.getRange(i + 1, 2).setValue(hashed); // 存 Hash
              updated = true;
          } 
      }
    }

    if(updated) return { success: true };
    return { success: false, message: "找不到該帳號" };
}

function handleAdminUpdateSupervisor(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SUPERVISORS);
  if (!sheet) {
      sheet = ss.insertSheet(SHEET_SUPERVISORS);
      sheet.appendRow(["姓名", "部門", "職稱", "分區", "UID"]); // [修改] 標題補上 UID
  }
  
  const rows = sheet.getDataRange().getValues();
  const targetName = String(data.name).trim();
  const targetUid = data.uid ? String(data.uid) : ""; // [新增] 接收 UID
  const adminName = data.adminName || "管理員";
  
  // 1. 先尋找是否已在名單中 (優先找 UID，其次找 Name)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowUid = rows[i][4] ? String(rows[i][4]) : ""; // Index 4 = Column E
    const rowName = String(rows[i][0]).trim();
    
    // 如果 UID 吻合，或是 UID 為空但名字吻合 (兼容舊資料)
    if ((targetUid && rowUid === targetUid) || (!rowUid && rowName === targetName)) {
      rowIndex = i + 1;
      break;
    }
  }

  // 2. 判斷操作：移除主管 vs 設定主管
  if (data.isSupervisor === false) {
    // 移除
    if (rowIndex !== -1) {
      sheet.deleteRow(rowIndex);
      logAdminAction(adminName, "移除主管", `移除 ${targetName} 的主管權限`);
    }
    return { success: true };
  } else {
    // 設定 (新增或更新)
    const dept = data.dept || "";
    const title = data.title || "";
    const region = data.region || ""; // [新增] 讀取分區
    
    if (rowIndex !== -1) {
      // 更新 (部門(B), 職稱(C), 分區(D))
      // sheet.getRange(row, col) -> Update B, C, D (Col 2, 3, 4)
      sheet.getRange(rowIndex, 2, 1, 3).setValues([[dept, title, region]]);
      
      // 補寫 UID 到第 5 欄 (如果有的話)
      if (targetUid) {
         sheet.getRange(rowIndex, 5).setValue(targetUid);
      }
      
      logAdminAction(adminName, "更新主管", `更新 ${targetName} 資料：${dept} / ${title} / 分區:${region}`);
    } else {
      // 新增 (A:Name, B:Dept, C:Title, D:Region, E:UID)
      sheet.appendRow([targetName, dept, title, region, targetUid]);
      logAdminAction(adminName, "新增主管", `將 ${targetName} 設為主管：${dept} / ${title} / 分區:${region}`);
    }
    return { success: true };
  }
}

function handleAdminUpdateLocation(data) { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
    const rows = sheet.getDataRange().getValues();

    if (data.op === 'add') { 
        // 檢查重複
        for(let i=1; i<rows.length; i++) {
            if(rows[i][0] === data.name) return { success: false, message: "地點名稱已存在" };
        }
        sheet.appendRow([data.name, data.lat, data.lng, data.radius, data.ip || ""]);
        logAdminAction(data.adminName, "新增地點", `新增 ${data.name} (IP:${data.ip || "無"})`); 
        return { success: true };
    } 
    
    if (data.op === 'edit') {
        for(let i=1; i<rows.length; i++) {
            if(rows[i][0] === data.oldName) {
                // 如果改了名字，要檢查新名字是否重複
                if (data.name !== data.oldName) {
                     for(let j=1; j<rows.length; j++) {
                        if(rows[j][0] === data.name) return { success: false, message: "新地點名稱已存在" };
                     }
                }
                // 更新資料 (Col 1~5)
                sheet.getRange(i+1, 1, 1, 5).setValues([[data.name, data.lat, data.lng, data.radius, data.ip || ""]]);
                logAdminAction(data.adminName, "編輯地點", `修改 ${data.oldName} -> ${data.name}`);
                return { success: true };
            }
        }
        return { success: false, message: "找不到該地點，可能已被刪除" };
    }

    // 順手補上刪除功能 (雖然您沒特別提，但管理通常需要)
    if (data.op === 'delete') {
         for(let i=1; i<rows.length; i++) {
            if(rows[i][0] === data.targetName) {
                sheet.deleteRow(i+1);
                logAdminAction(data.adminName, "刪除地點", `刪除 ${data.targetName}`);
                return { success: true };
            }
         }
         return { success: false, message: "找不到該地點" };
    }

    return { success: false, message: "未知操作" };
}

function logAdminAction(admin, action, details) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    let logSheet = ss.getSheetByName(SHEET_ADMIN_LOGS);
    if (!logSheet) { 
        logSheet = ss.insertSheet(SHEET_ADMIN_LOGS);
        logSheet.appendRow(["時間", "管理員", "動作", "詳細內容"]);
    } 
    logSheet.appendRow([new Date(), admin, action, details]);
}

function checkTooFrequent(uid, recordSheet) { 
    const lastRow = recordSheet.getLastRow();
    if (lastRow < 2) return false;
    const startRow = Math.max(2, lastRow - 20);
    // [修改] 範圍擴大到 Q 欄 (17欄)，以讀取 UID
    const data = recordSheet.getRange(startRow, 1, lastRow - startRow + 1, 17).getValues();
    const now = new Date().getTime();
    for (let i = data.length - 1; i >= 0; i--) { 
        // [修改] 比對 Q 欄 (Index 16) 的 UID
        if (String(data[i][16]) === String(uid)) { 
            const lastTime = new Date(data[i][0]).getTime();
            if ((now - lastTime) / 1000 / 60 < 60) return true; 
            return false;
        } 
    } 
    return false;
}

// [重寫] 讀取矩陣式工作表資料 (新增 uid 參數)
function fetchUserData(ss, sheetName, targetName, uid) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const cleanTarget = String(targetName).trim();
  let result = null;

  // [新增] 針對「打卡紀錄整理」且有 UID 時，優先搜尋 "姓名+UID"
  if (sheetName === "打卡紀錄整理" && uid) {
     const comboName = cleanTarget + uid;
     const comboFinder = sheet.getRange("E:AR").createTextFinder(comboName).matchEntireCell(true);
     result = comboFinder.findNext();
  }

  // Fallback: 如果沒傳 UID 或找不到，使用原本的姓名搜尋
  if (!result) {
     let finder = sheet.getRange("E:AR").createTextFinder(cleanTarget).matchEntireCell(true);
     result = finder.findNext();
     
     // 二次 Fallback: 模糊搜尋
     if (!result && sheetName === "打卡紀錄整理") {
        finder = sheet.getRange("E:AR").createTextFinder(cleanTarget).matchEntireCell(false);
        result = finder.findNext();
     }
  }
  
  if (!result) return []; // 找不到該員工

  const startRow = result.getRow();
  const startCol = result.getColumn(); // 員工名字所在的欄位 (例如 AG=33)

  // 2. 讀取數據區塊 (假設每人最多 31 天)
  // 日期在 C (Col 3), 星期在 D (Col 4)
  // 員工數據在 startCol ~ startCol+3 (上班, 下班, 異常, 備註)
  // 資料從名字的下一行開始 (startRow + 1)
  const MAX_DAYS = 31;
  const dataStartRow = startRow + 1;
  
  // 讀取日期區塊 (C:D)
  const dateRange = sheet.getRange(dataStartRow, 3, MAX_DAYS, 2).getDisplayValues();
  
  // 讀取員工數據區塊
  const userDataRange = sheet.getRange(dataStartRow, startCol, MAX_DAYS, 4).getDisplayValues();
  
  const list = [];
  
  for (let i = 0; i < MAX_DAYS; i++) {
    const dateStr = dateRange[i][0]; // 日期
    const dayStr = dateRange[i][1];  // 星期
    
    // 如果沒有日期，視為無效或月份結束
    if (!dateStr) continue;

    const clockIn = userDataRange[i][0];   // 上班
    const clockOut = userDataRange[i][1];  // 下班
    const abnormal = userDataRange[i][2];  // 異常
    const note = userDataRange[i][3];      // 備註

    // 只回傳有日期的列
    list.push({
      date: dateStr,
      day: dayStr,
      in: clockIn,
      out: clockOut,
      status: abnormal,
      note: note
    });
  }

  // [修改] 用戶與管理員查看「個人」紀錄時，改為日期正序 (1號->31號)
  // 移除 .reverse()，直接回傳 list (假設工作表是依照日期排列的)
  return list;
}

function getLocations() { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
    if (!sheet) return { success: true, list: [] };
    const data = sheet.getDataRange().getValues(); 
    const list = [];
    for (let i = 1; i < data.length; i++) { 
        // [修改] 增加讀取 ip (第 5 欄, index 4)
        if (data[i][0]) list.push({ 
            name: data[i][0], 
            lat: data[i][1], 
            lng: data[i][2], 
            radius: data[i][3],
            ip: data[i][4] || "" 
        });
    } 
    return { success: true, list: list };
}

function setupSystem() { 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if(!ss.getSheetByName(SHEET_STAFF)) ss.insertSheet(SHEET_STAFF).appendRow(["姓名", "密碼", "LINE_ID", "需重設密碼", "允許遠端", "失敗次數", "最後失敗", "鎖定直到", "鎖定倍率", "最後上線時間", "裝置ID", "班別", "強制登出時間"]); 
    if(!ss.getSheetByName(SHEET_ADMINS)) ss.insertSheet(SHEET_ADMINS).appendRow(["姓名", "密碼", "備註"]);
    if(!ss.getSheetByName(SHEET_SUPERVISORS)) ss.insertSheet(SHEET_SUPERVISORS).appendRow(["姓名", "部門", "職稱"]); 
    if(!ss.getSheetByName(SHEET_LOCATIONS)) ss.insertSheet(SHEET_LOCATIONS).appendRow(["地點名稱", "緯度", "經度", "允許誤差範圍(m)", "允許IP"]); 
    if(!ss.getSheetByName(SHEET_RECORDS)) ss.insertSheet(SHEET_RECORDS).appendRow(["時間戳記", "日期", "時間", "姓名", "動作", "地點", "打卡結果", "GPS座標", "備註"]); 
    if(!ss.getSheetByName(SHEET_ADMIN_LOGS)) ss.insertSheet(SHEET_ADMIN_LOGS).appendRow(["時間", "管理員", "動作", "詳細內容"]);
    if(!ss.getSheetByName(SHEET_SHIFTS)) ss.insertSheet(SHEET_SHIFTS).appendRow(["班別名稱", "上班時間", "下班時間"]); 
}

function handleLineEvents(events) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    let sheet = ss.getSheetByName(SHEET_LINE_IDS);
    if (!sheet) { 
        sheet = ss.insertSheet(SHEET_LINE_IDS);
        sheet.appendRow(["時間", "顯示名稱", "User ID", "事件類型"]);
    } 
    const lastRow = sheet.getLastRow();
    const existingIds = lastRow > 1 ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().map(row => String(row[0])) : [];
    events.forEach(event => { 
        if ((event.type === 'follow' || event.type === 'message') && !existingIds.includes(event.source.userId)) { 
            const profile = getUserProfile(event.source.userId); 
            sheet.appendRow([new Date(), profile ? profile.displayName : "未知", event.source.userId, event.type]); 
            if (event.replyToken) {
                replyLine(event.replyToken, `✅ ID 已紀錄：${event.source.userId}\n請等待管理員設定帳號。\n\n您的打卡系統預設初始密碼為：1234\n(請等待管理員通知開通後再登入)\n\n連結：https://yiheng.vercel.app/`); 
            }
        } 
    });
}

function getUserProfile(uid) { 
    try { return JSON.parse(UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${uid}`, { headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN } }).getContentText());
    } catch (e) { return null; } 
}
function replyLine(token, text) { callLineApi("https://api.line.me/v2/bot/message/reply", { replyToken: token, messages: [{ type: "text", text: text }] });
}
function pushLine(userId, text) { callLineApi("https://api.line.me/v2/bot/message/push", { to: userId, messages: [{ type: "text", text: text }] });
}
function callLineApi(url, payload) { try { UrlFetchApp.fetch(url, { method: "post", headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN, 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true });
} catch(e) {} }
function getDist(lat1, lng1, lat2, lng2) { const R=6371e3, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180, a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2); return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function responseJSON(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function formatDate(date, format) { return Utilities.formatDate(date, Session.getScriptTimeZone(), format);
}
function adminSendPasswords() { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
    if (!sheet) return; 
    const data = sheet.getDataRange().getDisplayValues();
    for (let i = 1; i < data.length; i++) { 
        if (data[i][2] && data[i][2].length > 10 && data[i][1]) { 
            pushLine(data[i][2], `👋 哈囉 ${data[i][0]}，這是您的打卡系統初始密碼：1234\n\n🔑${data[i][1]}\n\n請儘快登入系統並修改密碼。\n\n連結：https://yiheng.vercel.app/。`);
        } 
    } 
}

// ==========================================
// 加密工具函式 
// ==========================================
function hashData(val) {
  if (!val) return "";
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(val), Utilities.Charset.UTF_8);
  let txtHash = "";
  for (let i = 0; i < raw.length; i++) {
    let hashVal = raw[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += "0";
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

// ==========================================
// [新增] 忘記密碼處理邏輯
// ==========================================
function handleRequestReset(name) {
  const cache = CacheService.getScriptCache();
  const coolDownKey = "RESET_COOL_" + name;
  
  // 1. 檢查 10 分鐘冷卻時間
  if (cache.get(coolDownKey)) {
    return { success: false, message: "⏳ 請求太頻繁，請等待 10 分鐘後再試。" };
  }

  // 2. 查找員工 Line ID
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const data = sheet.getDataRange().getValues();
  let lineId = "";
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      lineId = String(data[i][2]).trim();
      break;
    }
  }

  if (!lineId) {
    return { success: false, message: "❌ 找不到此帳號，或該帳號尚未綁定 LINE ID。" };
  }

  // 3. 生成 4 位數驗證碼
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  
  // 4. 存入快取 (驗證碼存 5 分鐘，冷卻存 10 分鐘)
  cache.put("RESET_CODE_" + name, code, 300); 
  cache.put(coolDownKey, "1", 600);

  // 5. 發送 Line
  pushLine(lineId, `🔑 【重設密碼驗證】\n\n您的驗證碼是：${code}\n\n(有效期限 5 分鐘，請勿提供給他人)`);

  return { success: true, message: "驗證碼已發送至您的 LINE" };
}


function handleCheckResetCode(name, code) {
  const cache = CacheService.getScriptCache();
  const storedCode = cache.get("RESET_CODE_" + name);

  if (!storedCode) {
    return { success: false, message: "⚠️ 驗證碼已過期，請重新索取" };
  }
  if (storedCode !== code) {
    return { success: false, message: "❌ 驗證碼錯誤，請再試一次" };
  }
  
  return { success: true, message: "驗證成功" };
}

// ==========================================
// [補強] 驗證並重設密碼 (確認這段在 code.gs 最下方)
// ==========================================
function handleVerifyReset(name, code, newPassword) {
  const cache = CacheService.getScriptCache();
  const storedCode = cache.get("RESET_CODE_" + name);

  // 1. 檢查驗證碼
  if (!storedCode) {
    return { success: false, message: "⚠️ 驗證碼已過期，請重新索取。" };
  }
  if (storedCode !== code) {
    return { success: false, message: "❌ 驗證碼錯誤" };
  }

  // 2. 執行改密碼 (複用現有邏輯)
  // 注意：這裡依賴 handleChangePassword，請確認該函式存在
  const result = handleChangePassword(name, newPassword);
  
  if (result.success) {
    cache.remove("RESET_CODE_" + name); // 成功後移除驗證碼
    return { success: true, message: "密碼重設成功！請使用新密碼登入。" };
  } else {
    return result;
  }
}

// [新增] 取得特定日期的所有打卡紀錄 (用於異常警示分析)
function handleAdminGetDailyRecords(dateStr) {
  // dateStr 格式: "2026-01-17" (來自前端 input type="date")
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  if (!sheet) return { success: true, list: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, list: [] };

  // 為了效能，我們只抓取最後 1500 筆資料來搜尋 (假設單日不會超過這個量)
  const startRow = Math.max(2, lastRow - 1500);
  // [修改] 擴大範圍到 17 (Q欄)
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 17).getDisplayValues();
  // 將 input 的 YYYY-MM-DD 轉為 Sheet 的 YYYY/MM/DD
  const targetDate = dateStr.replace(/-/g, '/');

  // 篩選出該日期的資料 (Column B 是日期)
  const filtered = data.filter(row => row[1] === targetDate);

  return { success: true, list: filtered };
}

// [修正] 管理員查詢特定員工歷史 (接收 UID -> 反查 Name -> 讀取矩陣)
function handleAdminGetStaffHistory(targetUid) {
  // 1. 透過 UID 反查姓名
  const targetName = getNameByUid(targetUid);
  if (!targetName) return { success: false, message: "找不到該員工" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName("打卡紀錄整理");

  // 2. 讀取當前年月
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  
  if (mainSheet) {
     const yVal = mainSheet.getRange("A1").getValue();
     const mVal = mainSheet.getRange("A2").getValue();
     if (yVal && mVal) {
        currentYear = parseInt(yVal);
        currentMonth = parseInt(mVal);
     }
  }

  // 3. 推算上個月
  let lastYear = currentYear;
  let lastMonth = currentMonth - 1;
  if (lastMonth < 1) {
     lastMonth = 12;
     lastYear -= 1;
  }
  const lastMonthSheetName = `${lastYear}/${lastMonth}`;
  const cleanName = String(targetName).trim();

  return { 
    success: true, 
    data: { 
      // [重點] 傳入 targetUid 讓 fetchUserData 可以組出 "姓名+UID"
      current: fetchUserData(ss, "打卡紀錄整理", cleanName, targetUid), 
      last: fetchUserData(ss, lastMonthSheetName, cleanName, targetUid),
      lastMonthName: lastMonthSheetName,
      targetName: cleanName
    } 
  };
}

// [新增] 產生或讀取 UID (Column O / Index 14)
function getOrGenUID(sheet, rowIndex, existingUID) {
  if (existingUID && String(existingUID).length > 2) return existingUID;
  
  // 產生新 UID (8碼亂數)
  const newUID = 'u_' + Math.random().toString(36).substr(2, 8);
  // 寫入 Sheet (第 15 欄)
  sheet.getRange(rowIndex + 1, 15).setValue(newUID);
  return newUID;
}

// [新增] 透過 UID 尋找員工列 (回傳 index, 不是 row number)
function findStaffIndexByUID(data, uid) {
  if (!uid) return -1;
  for (let i = 1; i < data.length; i++) {
    // 檢查 UID (Col 14)
    if (String(data[i][14]) === String(uid)) return i;
  }
  return -1;
}