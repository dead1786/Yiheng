const LINE_CHANNEL_ACCESS_TOKEN = "AJPH2+shMd1gD3/Ws+iIMYWNSKs83DcfuoD55E4B2bfUnwTEbaqLgPX/5zDWLfqwnrS8VcR3llEjSE+Lk5euHTjSMhGuXhF1/18kRPttgoT2lFFd5zPpp3o0W1788wzlOMtg06echgvm/T/kWdgoxgdB04t89/1O/w1cDnyilFU=";

// 工作表名稱定義
const SHEET_STAFF = "員工管理";
const SHEET_ADMINS = "管理員名單";
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
  
  if (action === "clockIn") return responseJSON(handleClockIn(postData));
  if (action === "getHistory") return responseJSON(handleGetHistory(postData.name, postData.loginTime));
  
  // [新增] 背景檢查狀態路由
  if (action === "checkStatus") return responseJSON(handleCheckStatus(postData.name, postData.loginTime));

  if (action === "getLocations") return responseJSON(getLocations());
  
  // --- 管理員後台功能 ---
  if (action === "adminGetData") return responseJSON(handleAdminGetData(postData));
  if (action === "adminUpdateLocation") return responseJSON(handleAdminUpdateLocation(postData));
  if (action === "adminUpdateStaff") return responseJSON(handleAdminUpdateStaff(postData));
  if (action === "adminUnlockStaff") return responseJSON(handleAdminUnlockStaff(postData));
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

// [修改] 強化版狀態檢查
function handleCheckStatus(name, loginTime) {
  // 1. 先檢查是否被踢 (優先級最高)
  if (!checkSessionValid(name, loginTime)) {
    return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號。" };
  }

  // 2. 檢查是否需要重設密碼 (新增)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      // 檢查第 4 欄 (Index 3) "需重設"
      const status = data[i][3];
      if (status === true || status === "TRUE") {
         return { success: true, status: 'need_reset' };
      }
      break;
    }
  }

  return { success: true, status: 'ok' };
}

function checkSessionValid(name, clientLoginTime) {
  if (!clientLoginTime) return true;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
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
  const systemSheets = [SHEET_STAFF, SHEET_ADMINS, SHEET_LOCATIONS, SHEET_RECORDS, SHEET_LINE_IDS, SHEET_ADMIN_LOGS, SHEET_SHIFTS, "line bot設定", "北區維運班表", "國定假日", "待處理"];
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
  const now = new Date().getTime();

  let isAdmin = false;
  let adminPwdCorrect = false;
  if (adminSheet) {
    const adminData = adminSheet.getDataRange().getValues();
    for (let j = 1; j < adminData.length; j++) {
      if (String(adminData[j][0]).trim() === cleanName) {
        if (String(adminData[j][1]).trim() === cleanPwd) {
           isAdmin = true;
           adminPwdCorrect = true;
        }
        break;
      }
    }
  }

  let isStaff = false;
  let staffRowIndex = -1;
  let staffData = staffSheet.getDataRange().getValues();
  for (let i = 1; i < staffData.length; i++) {
    if (String(staffData[i][0]).trim() === cleanName) {
      isStaff = true;
      staffRowIndex = i;
      break;
    }
  }

  if (isAdmin && !isStaff) {
    return { 
      success: true, 
      name: cleanName, 
      needReset: false, 
      allowRemote: true, 
      isAdmin: true 
    };
  }

  if (isStaff) {
    const row = staffData[staffRowIndex];
    const targetRow = staffRowIndex + 1;
    const lockedUntil = row[7] ? new Date(row[7]).getTime() : 0;
    if (lockedUntil > now) {
      const waitHours = Math.ceil((lockedUntil - now) / (1000 * 60 * 60));
      return { success: false, message: `⛔ 帳號已被鎖定！\n請等待 ${waitHours} 小時或聯繫管理員解鎖。` };
    }

    let staffPwdCorrect = (String(row[1]).trim() === cleanPwd);
    if (adminPwdCorrect || staffPwdCorrect) {
       if (!isAdmin) { 
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
       
       staffSheet.getRange(targetRow, 6, 1, 4).setValues([[0, "", "", 24]]);
       const status = row[3]; 
       const allowRemote = (row[4] === true || row[4] === "TRUE");
       return { 
          success: true, 
          name: cleanName, 
          needReset: (status === true || status === "TRUE"), 
          allowRemote: allowRemote || isAdmin, 
          isAdmin: isAdmin 
        };
    } else {
       let failCount = Number(row[5]) || 0;
       let lastFail = row[6] ? new Date(row[6]).getTime() : 0;
       let lockDuration = Number(row[8]) || 24;

       if (now - lastFail <= 600000) { failCount++; } else { failCount = 1; }

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
  if (data.loginTime && !checkSessionValid(data.name, data.loginTime)) {
    return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號，請重新登入。" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  const locSheet = ss.getSheetByName(SHEET_LOCATIONS);
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  
  if (!data.force && checkTooFrequent(data.name, sheet)) {
    return { success: false, status: 'warning_duplicate', message: "⚠️ 系統偵測您 1 小時內已經打過卡。\n\n您確定要重複打卡嗎？" };
  }
  updateLastActive(data.name);
  let allowRemote = false;
  const staffData = staffSheet.getDataRange().getValues();
  for(let i=1; i<staffData.length; i++) {
    if(staffData[i][0] === data.name) {
      const flag = staffData[i][4];
      allowRemote = (flag === true || flag === "TRUE" || flag === "true");
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
  sheet.appendRow([now, formatDate(now,"yyyy/MM/dd"), formatDate(now,"HH:mm:ss"), data.name, data.type, data.station, res, `${data.lat},${data.lng}`, note]);
  SpreadsheetApp.flush(); 
  return res.includes("失敗") ? { success: false, message: res } : { success: true, message: "打卡成功" };
}

function handleGetHistory(name, loginTime) {
  if (loginTime && !checkSessionValid(name, loginTime)) {
     return { success: false, status: 'force_logout', message: "管理者已強制登出您的帳號，請重新登入。" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const lastMonthName = `${d.getFullYear()}/${d.getMonth() + 1}`;
  const lastRawRec = getLastRawClockIn(name);
  return { success: true, data: { current: fetchUserData(ss, SHEET_CURRENT_MONTH, name), last: fetchUserData(ss, lastMonthName, name), lastMonthName: lastMonthName, lastRawRec: lastRawRec } };
}

function getLastRawClockIn(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const startRow = Math.max(2, lastRow - 100);
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getDisplayValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (row[3] === name && row[6].includes("成功")) { return `${row[1]} ${row[2]} (${row[4]})`; }
  }
  return null;
}

function handleAdminGetData(data) {
  if (data.dataType === 'all') {
    return {
      success: true,
      allData: {
        staff: handleAdminGetData({ dataType: 'staff' }),
        line: handleAdminGetData({ dataType: 'line' }),
        location: handleAdminGetData({ dataType: 'location' }),
        record: handleAdminGetData({ dataType: 'record' }),
        log: handleAdminGetData({ dataType: 'log' }),
        shift: handleAdminGetData({ dataType: 'shift' })
      }
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetName = "";
  if (data.dataType === 'staff') sheetName = SHEET_STAFF;
  else if (data.dataType === 'line') sheetName = SHEET_LINE_IDS;
  else if (data.dataType === 'location') sheetName = SHEET_LOCATIONS;
  else if (data.dataType === 'record') sheetName = SHEET_RECORDS;
  else if (data.dataType === 'log') sheetName = SHEET_ADMIN_LOGS;
  else if (data.dataType === 'shift') sheetName = SHEET_SHIFTS;
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "找不到工作表" };

  const allData = sheet.getDataRange().getDisplayValues();
  if (allData.length === 0) return { success: true, headers: [], list: [] };

  let headers = allData[0];
  let list = [];
  
  if (data.dataType === 'staff') {
    headers = ["姓名", "密碼", "LINE_ID", "需重設", "遠端", "帳號狀態", "裝置綁定", "班別"];
    const now = new Date().getTime();
    list = allData.slice(1).map(row => {
      const lockedTime = row[7] ? new Date(row[7]).getTime() : 0;
      const isLocked = lockedTime > now;
      const deviceId = row[10];
      const isBound = (deviceId && deviceId.length > 5);
      const shift = row[11] || ""; 
      return [ row[0], "******", row[2], row[3], row[4], isLocked ? "🔒已鎖定" : "正常", isBound ? "📱已綁定" : "未綁定", shift ];
    });
  } 
  else if (data.dataType === 'record' || data.dataType === 'log') {
    const rawData = allData.slice(1);
    list = rawData.slice(-100).reverse();
  } else {
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
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { if(rows[i][0] === data.newData.name) return { success: false, message: "員工姓名已存在" }; }
    sheet.appendRow([ data.newData.name, data.newData.password, data.newData.lineId || "", "TRUE", data.newData.allowRemote === "TRUE" ? "TRUE" : "FALSE", 0, "", "", 24, "", "", data.newData.shift || "", "" ]);
    logAdminAction(adminName, "新增員工", `新增了 ${data.newData.name}`);
    return { success: true };
  }

  if (op === 'edit') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) {
      if(rows[i][0] === data.oldName) {
        const oldRow = rows[i];
        const oldData = { name: String(oldRow[0]), pwd: String(oldRow[1]), line: String(oldRow[2]), reset: String(oldRow[3]).toUpperCase(), remote: String(oldRow[4]).toUpperCase(), shift: String(oldRow[11]||"") };
        let newPwd = data.newData.password;
        if (newPwd === "******") newPwd = oldData.pwd;
        const newData = { name: String(data.newData.name), pwd: String(newPwd), line: String(data.newData.lineId), reset: String(data.newData.needReset).toUpperCase(), remote: String(data.newData.allowRemote).toUpperCase(), shift: String(data.newData.shift || "") };
        let changes = [];
        if (oldData.name !== newData.name) changes.push(`姓名: ${oldData.name} -> ${newData.name}`);
        if (oldData.pwd !== newData.pwd) changes.push(`密碼已變更`);
        if (oldData.line !== newData.line) changes.push(`LineID: ${oldData.line} -> ${newData.line}`);
        if (oldData.shift !== newData.shift) changes.push(`班別: ${oldData.shift} -> ${newData.shift}`);
        sheet.getRange(i+1, 1, 1, 5).setValues([[ newData.name, newData.pwd, newData.line, newData.reset, newData.remote ]]);
        sheet.getRange(i+1, 6, 1, 4).setValues([[0, "", "", 24]]);
        sheet.getRange(i+1, 12).setValue(newData.shift);
        const logDetail = changes.length > 0 ? `修改 ${data.oldName}：${changes.join('、')}` : `修改 ${data.oldName} (無變更)`;
        logAdminAction(adminName, "編輯員工", logDetail);
        
        updateAdminPasswordIfExist(data.oldName, newData.name, newData.pwd);
        return { success: true };
      }
    }
    return { success: false, message: "找不到該員工" };
  }

  if (op === 'kick') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { 
        if(rows[i][0] === data.targetName) { 
            sheet.getRange(i+1, 13).setValue(new Date());
            logAdminAction(adminName, "強制登出", `將 ${data.targetName} 強制登出`);
            return { success: true };
        } 
    }
    return { success: false, message: "找不到該員工" };
  }

  if (op === 'unbind') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { 
        if(rows[i][0] === data.targetName) { 
            sheet.getRange(i+1, 11).setValue("");
            logAdminAction(adminName, "解除綁定", `解除了 ${data.targetName} 的裝置綁定`);
            return { success: true };
        } 
    }
    return { success: false, message: "找不到該員工" };
  }

  if (op === 'delete') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { 
        if(rows[i][0] === data.targetName) { 
            sheet.deleteRow(i+1);
            logAdminAction(adminName, "刪除員工", `刪除了 ${data.targetName}`); 
            return { success: true };
        } 
    }
    return { success: false, message: "找不到該員工" };
  }
  return { success: false, message: "未知操作" };
}

function updateAdminPasswordIfExist(oldName, newName, newPwd) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   if (!sheet) return;
   const rows = sheet.getDataRange().getValues();
   for(let i=1; i<rows.length; i++) {
      if(rows[i][0] === oldName) {
         sheet.getRange(i+1, 1).setValue(newName);
         sheet.getRange(i+1, 2).setValue(newPwd);
         return;
      }
   }
}

function handleAdminUnlockStaff(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const rows = sheet.getDataRange().getValues();
  for(let i=1; i<rows.length; i++) { 
      if(rows[i][0] === data.targetName) { 
          sheet.getRange(i+1, 6, 1, 4).setValues([[0, "", "", 24]]);
          logAdminAction(data.adminName, "解除鎖定", `解鎖了 ${data.targetName} 的帳號`); 
          return { success: true };
      } 
  }
  return { success: false, message: "找不到員工" };
}

function handleUpdatePassword(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let updated = false;
  
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  if (staffSheet) {
    const rows = staffSheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { 
      if(rows[i][0] === data.name) { 
          if (String(rows[i][1]).trim() !== data.oldPassword.trim()) { 
          } else {
             staffSheet.getRange(i+1, 2).setValue(data.newPassword.trim());
             updated = true;
          }
      } 
    }
  }

  const adminSheet = ss.getSheetByName(SHEET_ADMINS);
  if (adminSheet) {
     const rows = adminSheet.getDataRange().getValues();
     for(let i=1; i<rows.length; i++) {
        if(rows[i][0] === data.name) {
             if (String(rows[i][1]).trim() === data.oldPassword.trim()) {
                 adminSheet.getRange(i+1, 2).setValue(data.newPassword.trim());
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

    const staffSheet = ss.getSheetByName(SHEET_STAFF);
    if(staffSheet) {
      const data = staffSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) { 
          if (data[i][0] === name) { 
              staffSheet.getRange(i + 1, 2).setValue(newPwd);
              staffSheet.getRange(i + 1, 4).setValue("FALSE"); 
              updated = true;
          } 
      }
    }
    
    const adminSheet = ss.getSheetByName(SHEET_ADMINS);
    if(adminSheet) {
      const data = adminSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) { 
          if (data[i][0] === name) { 
              adminSheet.getRange(i + 1, 2).setValue(newPwd);
              updated = true;
          } 
      }
    }

    if(updated) return { success: true };
    return { success: false, message: "找不到該帳號" };
}

function handleAdminUpdateLocation(data) { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
    if (data.op === 'add') { 
        // [修改] 寫入 IP 欄位
        sheet.appendRow([data.name, data.lat, data.lng, data.radius, data.ip || ""]);
        logAdminAction(data.adminName, "新增地點", `新增 ${data.name} (IP:${data.ip || "無"})`); 
        return { success: true };
    } 
    return { success: false, message: "目前僅支援新增" };
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

function checkTooFrequent(name, recordSheet) { 
    const lastRow = recordSheet.getLastRow();
    if (lastRow < 2) return false;
    const startRow = Math.max(2, lastRow - 20);
    const data = recordSheet.getRange(startRow, 1, lastRow - startRow + 1, 4).getValues();
    const now = new Date().getTime();
    for (let i = data.length - 1; i >= 0; i--) { 
        if (data[i][3] === name) { 
            const lastTime = new Date(data[i][0]).getTime();
            if ((now - lastTime) / 1000 / 60 < 60) return true; 
            return false;
        } 
    } 
    return false;
}

function fetchUserData(ss, sheetName, targetName) { 
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getDisplayValues();
    let result = [];
    for (let r = 0; r < data.length; r += 33) { 
        if (!data[r]) continue;
        for (let c = 4; c < data[r].length; c++) { 
            if (data[r][c] === targetName) { 
                const startRow = r + 1;
                const endRow = Math.min(r + 32, data.length); 
                for (let i = startRow; i < endRow; i++) { 
                    if (data[i] && data[i][2]) { 
                        result.push({ 
                            date: data[i][2], 
                            day: data[i][3] || "", 
                            in: data[i][c] || "", 
                            out: data[i][c+1] || "", 
                            status: data[i][c+2] || "", 
                            note: data[i][c+3] || "" 
                        });
                    } 
                } 
                return result;
            } 
        } 
    } 
    return result;
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
                replyLine(event.replyToken, `✅ ID 已紀錄：${event.source.userId}\n請等待管理員設定帳號。\n\n您的打卡系統預設初始密碼為：123\n(請等待管理員通知開通後再登入)\n\n連結：https://yiheng.vercel.app/`); 
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
            pushLine(data[i][2], `👋 哈囉 ${data[i][0]}，這是您的打卡系統初始密碼：123\n\n🔑${data[i][1]}\n\n請儘快登入系統並修改密碼。\n\n連結：https://yiheng.vercel.app/。`);
        } 
    } 
}