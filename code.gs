const LINE_CHANNEL_ACCESS_TOKEN = "AJPH2+shMd1gD3/Ws+iIMYWNSKs83DcfuoD55E4B2bfUnwTEbaqLgPX/5zDWLfqwnrS8VcR3llEjSE+Lk5euHTjSMhGuXhF1/18kRPttgoT2lFFd5zPpp3o0W1788wzlOMtg06echgvm/T/kWdgoxgdB04t89/1O/w1cDnyilFU=";

// 工作表名稱定義
const SHEET_STAFF = "員工管理";
const SHEET_ADMINS = "管理員名單";
const SHEET_LOCATIONS = "打卡地點設置";
const SHEET_RECORDS = "打卡紀錄";
const SHEET_LINE_IDS = "LINE_ID_收集區";
const SHEET_CURRENT_MONTH = "打卡紀錄整理"; 
const SHEET_ADMIN_LOGS = "管理員操作紀錄";

// ==========================================
// 1. 路由處理區 (Router)
// ==========================================

function doGet(e) {
  return ContentService.createTextOutput("✅ 系統 v9.8 API (Excel 增強版) 運作中");
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

  // --- 一般使用者功能 ---
  if (action === "login") return responseJSON(handleLogin(postData.name, postData.password, postData.deviceId));
  if (action === "changePassword") return responseJSON(handleChangePassword(postData.name, postData.newPassword));
  if (action === "updatePassword") return responseJSON(handleUpdatePassword(postData));
  if (action === "clockIn") return responseJSON(handleClockIn(postData));
  if (action === "getLocations") return responseJSON(getLocations());
  if (action === "getHistory") return responseJSON(handleGetHistory(postData.name));
  
  // --- 管理員後台功能 ---
  if (action === "adminGetData") return responseJSON(handleAdminGetData(postData));
  if (action === "adminUpdateLocation") return responseJSON(handleAdminUpdateLocation(postData));
  if (action === "adminUpdateStaff") return responseJSON(handleAdminUpdateStaff(postData));
  if (action === "adminUnlockStaff") return responseJSON(handleAdminUnlockStaff(postData));
  
  // [修正] 補上取得工作表列表的路由
  if (action === "adminGetSheetList") return responseJSON(handleAdminGetSheetList());

  // [修改] 下載 Excel (支援指定工作表 & 去除公式)
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

// [新增] 取得所有可匯出的工作表列表 (過濾掉系統表)
function handleAdminGetSheetList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();
  
  // [修正] 在這裡加入 "line bot設定" 到排除清單，這樣它就不會出現在下拉選單中
  const systemSheets = [
    SHEET_STAFF, 
    SHEET_ADMINS, 
    SHEET_LOCATIONS, 
    SHEET_RECORDS, 
    SHEET_LINE_IDS, 
    SHEET_ADMIN_LOGS,
    "line bot設定" 
  ];
  
  let list = [];
  // 總是把「目前的整理表」放在第一個
  list.push({ name: SHEET_CURRENT_MONTH, label: `${SHEET_CURRENT_MONTH} (當前)` });

  allSheets.forEach(sheet => {
    const name = sheet.getName();
    // 如果不是系統表，且不是目前的整理表(避免重複)，就加入清單
    if (!systemSheets.includes(name) && name !== SHEET_CURRENT_MONTH) {
      list.push({ name: name, label: name });
    }
  });

  return { success: true, list: list };
}

// [修改] 處理 Excel 下載 (去除公式 + 完整格式複製 + 指定工作表 + 智慧跨頁判斷)
function handleAdminDownloadExcel(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 1. 決定要匯出的工作表 (若沒傳 sheetName 則預設當前月份)
  const targetSheetName = data.sheetName || SHEET_CURRENT_MONTH;
  const srcSheet = ss.getSheetByName(targetSheetName);
  if (!srcSheet) return { success: false, message: `找不到「${targetSheetName}」工作表` };

  // 定義暫存檔名
  const tempFileName = `匯出暫存_${targetSheetName}_(可刪除)`;
  // 0. 清理舊的暫存檔
  try {
    const oldFiles = DriveApp.getFilesByName(tempFileName);
    while (oldFiles.hasNext()) {
      oldFiles.next().setTrashed(true);
    }
  } catch(e) {}

  try {
    const lastRow = srcSheet.getLastRow();
    // [修正] 強制抓到第 34 欄 (AH欄)，確保 C1:AH32 的格式範圍被包含
    const lastCol = Math.max(srcSheet.getLastColumn(), 34); 

    // 1. 建立中繼工作表
    const stagingSheet = ss.insertSheet("Export_Staging_" + new Date().getTime());
    // 2. 複製欄寬 (確保格式跑版最小化)
    for (let c = 1; c <= lastCol; c++) {
      try {
        stagingSheet.setColumnWidth(c, srcSheet.getColumnWidth(c));
      } catch(e) {}
    }

    // 3. 複製資料到中繼表 (智慧區塊處理)
    let targetRow = 1;
    let hasData = false;
    let r = 1; // 來源列指標
    const BLOCK_STEP = 33; // 預設一個區塊的高度(含間隔)

    while (r <= lastRow) {
      // 檢查當前區塊是否有資料 (檢查第 5 欄 E欄)
      const cellMain = srcSheet.getRange(r, 5).getValue();
      const hasMainData = String(cellMain).trim() !== "";

      // 檢查是否為延伸區塊 (檢查下一個區塊的 E 欄，例如 E34)
      // 相對於 r，下一個區塊開始於 r + 33
      let isExtended = false;
      if (r + 33 <= lastRow) {
         const cellExt = srcSheet.getRange(r + 33, 5).getValue();
         if (String(cellExt).trim() !== "") {
           isExtended = true;
         }
      }

      if (hasMainData) {
        hasData = true;
        let height = 32; // 預設高度 (C1:AH32)
        let nextStep = BLOCK_STEP; // 預設跳一個區塊

        // 如果下一個區塊也有資料，視為同一組，一次抓 65 列
        if (isExtended) {
          height = 65; // C1:AH65
          nextStep = BLOCK_STEP * 2; // 跳過兩個區塊 (66列)
        }

        // 邊界檢查
        if (r + height - 1 > lastRow) {
           height = lastRow - r + 1;
        }

        // 定義來源與目標範圍
        const srcRange = srcSheet.getRange(r, 1, height, lastCol);
        const destRange = stagingSheet.getRange(targetRow, 1, height, lastCol);

        // A. 複製格式與值
        srcRange.copyTo(destRange);
        
        // B. 去除公式 (轉為純數值)
        const plainValues = srcRange.getValues(); 
        destRange.setValues(plainValues); 

        // 更新指標
        targetRow += height; // 目標列往下堆疊
        r += nextStep;       // 來源列依照判斷跳躍

      } else {
        // 該區塊無資料，跳過
        r += BLOCK_STEP;
      }
    }

    if (!hasData) {
      ss.deleteSheet(stagingSheet);
      return { success: false, message: "沒有找到任何資料" };
    }

    SpreadsheetApp.flush();
    // 4. 建立外部新檔案
    const newSS = SpreadsheetApp.create(tempFileName);
    
    // 5. 跨檔案複製
    const exportedSheet = stagingSheet.copyTo(newSS);
    exportedSheet.setName(targetSheetName); 
    newSS.deleteSheet(newSS.getSheets()[0]); // 刪除預設工作表

    // 6. 刪除本地中繼表
    ss.deleteSheet(stagingSheet);
    
    // 7. 設定權限
    try {
      const file = DriveApp.getFileById(newSS.getId());
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      logAdminAction(data.adminName || "未知", "匯出權限警告", "檔案已建立但無法設為公開: " + permErr.toString());
    }

    // 8. 回傳連結
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

  if (!staffSheet) return { success: false, message: "系統尚未初始化 (請執行 setupSystem)" };
  const cleanName = name.trim();
  const cleanPwd = password.trim();
  const now = new Date().getTime();

  let userFound = false;
  let targetRow = -1;
  const staffData = staffSheet.getDataRange().getValues();

  for (let i = 1; i < staffData.length; i++) {
    if (String(staffData[i][0]).trim() === cleanName) {
      userFound = true;
      targetRow = i + 1;
      
      const lockedUntil = staffData[i][7] ? new Date(staffData[i][7]).getTime() : 0;
      if (lockedUntil > now) {
        const waitHours = Math.ceil((lockedUntil - now) / (1000 * 60 * 60));
        return { success: false, message: `⛔ 帳號已被鎖定！\n請等待 ${waitHours} 小時或聯繫管理員解鎖。` };
      }

      if (String(staffData[i][1]).trim() === cleanPwd) {
        const storedDeviceId = staffData[i][10];
        
        // 裝置綁定檢查
        if (deviceId) {
          if (storedDeviceId && String(storedDeviceId).trim() !== "") {
            if (String(storedDeviceId).trim() !== deviceId) {
              return { success: false, message: "⛔ 此帳號已綁定其他裝置！\n請使用原手機登入，或聯繫管理員「解綁」。" };
            }
          } else {
            staffSheet.getRange(targetRow, 11).setValue(deviceId);
          }
        }
        
        staffSheet.getRange(targetRow, 6, 1, 4).setValues([[0, "", "", 24]]);
        const status = staffData[i][3]; 
        const allowRemote = (staffData[i][4] === true || staffData[i][4] === "TRUE");
        
        let isAdmin = false;
        if (adminSheet) {
          const adminData = adminSheet.getDataRange().getValues();
          for (let j = 1; j < adminData.length; j++) {
            if (String(adminData[j][0]).trim() === cleanName) {
              isAdmin = true;
              break;
            }
          }
        }
        
        return { 
          success: true, 
          name: cleanName, 
          needReset: (status === true || status === "TRUE"), 
          allowRemote: allowRemote, 
          isAdmin: isAdmin 
        };
      } else {
        let failCount = Number(staffData[i][5]) || 0;
        let lastFail = staffData[i][6] ? new Date(staffData[i][6]).getTime() : 0;
        let lockDuration = Number(staffData[i][8]) || 24;

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
  }
  
  if (!userFound) return { success: false, message: "帳號或密碼錯誤" };
}

function handleClockIn(data) {
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

  let target = null;
  const locs = locSheet.getDataRange().getValues();
  for(let i=1; i<locs.length; i++) {
    if(locs[i][0] === data.station) {
      target = { lat: locs[i][1], lng: locs[i][2], r: locs[i][3] };
      break;
    }
  }
  
  let res = "成功";
  let distInfo = "";
  let note = data.note || "";
  
  if (target) {
    const dist = getDist(data.lat, data.lng, target.lat, target.lng);
    distInfo = Math.round(dist) + "m";
    if (dist > target.r) {
      if (allowRemote) { 
        res = "成功";
        note += ` (遠端: ${distInfo})`; 
      } else { 
        res = `失敗 (距離 ${distInfo})`;
      }
    }
  } else { res = "地點異常"; }

  const now = new Date();
  sheet.appendRow([now, formatDate(now,"yyyy/MM/dd"), formatDate(now,"HH:mm:ss"), data.name, data.type, data.station, res, `${data.lat},${data.lng}`, note]);
  SpreadsheetApp.flush(); 
  return res.includes("失敗") ? { success: false, message: res } : { success: true, message: "打卡成功" };
}

function handleGetHistory(name) {
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
        log: handleAdminGetData({ dataType: 'log' })
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
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "找不到工作表" };

  const allData = sheet.getDataRange().getDisplayValues();
  if (allData.length === 0) return { success: true, headers: [], list: [] };

  let headers = allData[0];
  let list = [];
  
  if (data.dataType === 'staff') {
    headers = ["姓名", "密碼", "LINE_ID", "需重設", "遠端", "帳號狀態", "裝置綁定"];
    const now = new Date().getTime();
    list = allData.slice(1).map(row => {
      const lockedTime = row[7] ? new Date(row[7]).getTime() : 0;
      const isLocked = lockedTime > now;
      const deviceId = row[10];
      const isBound = (deviceId && deviceId.length > 5);
      return [ row[0], "******", row[2], row[3], row[4], isLocked ? "🔒已鎖定" : "正常", isBound ? "📱已綁定" : "未綁定" ];
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

function handleAdminUpdateStaff(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const op = data.op;
  const adminName = data.adminName || "未知管理員";

  if (op === 'add') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) { if(rows[i][0] === data.newData.name) return { success: false, message: "員工姓名已存在" }; }
    sheet.appendRow([ data.newData.name, data.newData.password, data.newData.lineId || "", "TRUE", data.newData.allowRemote === "TRUE" ? "TRUE" : "FALSE", 0, "", "", 24, "", "" ]);
    logAdminAction(adminName, "新增員工", `新增了 ${data.newData.name} (權限:${data.newData.allowRemote === 'TRUE' ? '遠端' : '一般'})`);
    return { success: true };
  }

  if (op === 'edit') {
    const rows = sheet.getDataRange().getValues();
    for(let i=1; i<rows.length; i++) {
      if(rows[i][0] === data.oldName) {
        const oldRow = rows[i];
        const oldData = { name: String(oldRow[0]), pwd: String(oldRow[1]), line: String(oldRow[2]), reset: String(oldRow[3]).toUpperCase(), remote: String(oldRow[4]).toUpperCase() };
        let newPwd = data.newData.password;
        if (newPwd === "******") newPwd = oldData.pwd;
        const newData = { name: String(data.newData.name), pwd: String(newPwd), line: String(data.newData.lineId), reset: String(data.newData.needReset).toUpperCase(), remote: String(data.newData.allowRemote).toUpperCase() };
        
        let changes = [];
        if (oldData.name !== newData.name) changes.push(`姓名: ${oldData.name} -> ${newData.name}`);
        if (oldData.pwd !== newData.pwd) changes.push(`密碼已變更`);
        if (oldData.line !== newData.line) changes.push(`LineID: ${oldData.line || "無"} -> ${newData.line || "無"}`);
        if (oldData.reset !== newData.reset) changes.push(`需重設: ${oldData.reset} -> ${newData.reset}`);
        if (oldData.remote !== newData.remote) changes.push(`遠端: ${oldData.remote} -> ${newData.remote}`);

        sheet.getRange(i+1, 1, 1, 5).setValues([[ newData.name, newData.pwd, newData.line, newData.reset, newData.remote ]]);
        sheet.getRange(i+1, 6, 1, 4).setValues([[0, "", "", 24]]);
        const logDetail = changes.length > 0 ?
          `修改了 ${data.oldName} 的資料：${changes.join('、')}` : `修改了 ${data.oldName} 的資料 (無實質變更)`;
        logAdminAction(adminName, "編輯員工", logDetail);
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
  const sheet = ss.getSheetByName(SHEET_STAFF);
  const rows = sheet.getDataRange().getValues();
  for(let i=1; i<rows.length; i++) { 
      if(rows[i][0] === data.name) { 
          if (String(rows[i][1]).trim() !== data.oldPassword.trim()) { 
              return { success: false, message: "舊密碼錯誤" };
          } 
          sheet.getRange(i+1, 2).setValue(data.newPassword.trim()); 
          logAdminAction(data.name, "修改密碼", "使用者自行修改密碼");
          return { success: true };
      } 
  }
  return { success: false, message: "找不到帳號" };
}

// Helpers
function handleChangePassword(name, newPwd) { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STAFF);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { 
        if (data[i][0] === name) { 
            sheet.getRange(i + 1, 2).setValue(newPwd);
            sheet.getRange(i + 1, 4).setValue("FALSE"); 
            return { success: true }; 
        } 
    } 
    return { success: false, message: "找不到該帳號" };
}

function handleAdminUpdateLocation(data) { 
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
    if (data.op === 'add') { 
        sheet.appendRow([data.name, data.lat, data.lng, data.radius]);
        logAdminAction(data.adminName, "新增地點", `新增了 ${data.name} (緯度:${data.lat}, 經度:${data.lng}, 半徑:${data.radius}m)`); 
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
    for (let r = 0; r < data.length; r++) { 
        for (let c = 0; c < data[r].length; c++) { 
            if (data[r][c] === targetName) { 
                const startRow = r + 1;
                const endRow = Math.min(r + 32, data.length); 
                for (let i = startRow; i < endRow; i++) { 
                    if (data[i][2]) { 
                        result.push({ date: data[i][2], day: data[i][3] || "", in: data[i][c] || "", out: data[i][c+1] || "", note: data[i][c+2] || "" });
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
        if (data[i][0]) list.push({ name: data[i][0], lat: data[i][1], lng: data[i][2], radius: data[i][3] });
    } 
    return { success: true, list: list };
}

function setupSystem() { 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if(!ss.getSheetByName(SHEET_STAFF)) ss.insertSheet(SHEET_STAFF).appendRow(["姓名", "密碼", "LINE_ID", "需重設密碼", "允許遠端", "失敗次數", "最後失敗", "鎖定直到", "鎖定倍率", "最後上線時間", "裝置ID"]); 
    if(!ss.getSheetByName(SHEET_ADMINS)) ss.insertSheet(SHEET_ADMINS).appendRow(["姓名", "密碼", "備註"]);
    if(!ss.getSheetByName(SHEET_LOCATIONS)) ss.insertSheet(SHEET_LOCATIONS).appendRow(["地點名稱", "緯度", "經度", "允許誤差範圍(m)"]); 
    if(!ss.getSheetByName(SHEET_RECORDS)) ss.insertSheet(SHEET_RECORDS).appendRow(["時間戳記", "日期", "時間", "姓名", "動作", "地點", "打卡結果", "GPS座標", "備註"]); 
    if(!ss.getSheetByName(SHEET_ADMIN_LOGS)) ss.insertSheet(SHEET_ADMIN_LOGS).appendRow(["時間", "管理員", "動作", "詳細內容"]);
}

function handleLineEvents(events) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    let sheet = ss.getSheetByName(SHEET_LINE_IDS);
    if (!sheet) { 
        sheet = ss.insertSheet(SHEET_LINE_IDS);
        sheet.appendRow(["時間", "顯示名稱", "User ID", "事件類型"]);
    } 
    
    // 取得現有 ID 列表 (避免重複登記)
    const lastRow = sheet.getLastRow();
    // [防呆] 如果只有標題列(1行)，就設為空陣列，避免 getRange 報錯
    const existingIds = lastRow > 1 
        ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().map(row => String(row[0])) 
        : [];

    events.forEach(event => { 
        if ((event.type === 'follow' || event.type === 'message') && !existingIds.includes(event.source.userId)) { 
            const profile = getUserProfile(event.source.userId); 
            sheet.appendRow([new Date(), profile ? profile.displayName : "未知", event.source.userId, event.type]); 
            
            // [修正] 移除錯誤的 data[i][1]，直接顯示通用預設密碼文字
            if (event.replyToken) {
                replyLine(event.replyToken, 
                    `✅ ID 已紀錄：${event.source.userId}\n` +
                    `請等待管理員設定帳號。\n\n` +
                    `您的打卡系統預設初始密碼為：123\n` +
                    `(請等待管理員通知開通後再登入)\n\n` +
                    `連結：https://yiheng.vercel.app/`
                ); 
            }
        } 
    });
}

function getUserProfile(uid) { 
    try { 
        return JSON.parse(UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${uid}`, { headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN } }).getContentText());
    } catch (e) { return null; } 
}

function replyLine(token, text) { 
    callLineApi("https://api.line.me/v2/bot/message/reply", { replyToken: token, messages: [{ type: "text", text: text }] });
}

function pushLine(userId, text) { 
    callLineApi("https://api.line.me/v2/bot/message/push", { to: userId, messages: [{ type: "text", text: text }] });
}

function callLineApi(url, payload) { 
    try { 
        UrlFetchApp.fetch(url, { method: "post", headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN, 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true });
    } catch(e) {} 
}

function getDist(lat1, lng1, lat2, lng2) { 
    const R=6371e3, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180, a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function responseJSON(data) { 
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date, format) { 
    return Utilities.formatDate(date, Session.getScriptTimeZone(), format);
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