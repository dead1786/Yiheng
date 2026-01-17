import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  ShieldCheck, Search, Bell, Users, MapPin, Share, Activity, AlertTriangle, 
  Filter, Link, UserMinus, Lock, Unlock, Home, History, User, Settings,
  Download, FileSpreadsheet, Loader2, Unlink, Trash2, Plus, Edit2, X, Save,
  Clock, MessageSquare, FileText, ChevronRight, AlertCircle, Menu, LogOut, LayoutDashboard, Calendar
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onAlert: (msg: string) => void;
  onConfirm: (msg: string, onYes: () => void) => void;
  adminName: string;
}

const LoadingOverlay = ({text = "處理中..."}: {text?: string}) => (
  <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
    <div className="bg-slate-800 text-white px-8 py-6 rounded-2xl shadow-2xl border border-slate-700 flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-[#00bda4] w-10 h-10" />
      <span className="font-bold tracking-widest text-lg">{text}</span>
    </div>
  </div>
);

// 定義 Tab 類型
type MainTab = 'admin' | 'history' | 'others';
type SubTab = 'staff' | 'location' | 'shift' | 'export' | 'line' | 'log';

export const AdminDashboardView = ({ onBack, onAlert, onConfirm, adminName }: Props) => {
  // Navigation State
  const [mainTab, setMainTab] = useState<MainTab>('admin');
  const [subTab, setSubTab] = useState<SubTab>('staff');
  
  // Data State
  const [allData, setAllData] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('admin_cache_all') || '{}'); } catch { return {}; }
  });
  
  const [isBlocking, setIsBlocking] = useState(false); 
  const [blockText, setBlockText] = useState("資料同步中...");
  
  // Forms
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({ name: '', password: '123', lineId: '', needReset: 'TRUE', allowRemote: 'FALSE', shift: '' });
  const [newLoc, setNewLoc] = useState({ name: '', lat: '', lng: '', radius: '500', ip: '' });
  const [newShift, setNewShift] = useState({ name: '', start: '09:00', end: '18:00' });
  const [exportSheet, setExportSheet] = useState('');
  const [sheetList, setSheetList] = useState<{name:string, label:string}[]>([]);

  // Modals for Stats & History
  const [statModal, setStatModal] = useState<{title: string, list: any[]} | null>(null);
  
  // [新增] 員工歷史紀錄 Modal 狀態
  const [historyModalUser, setHistoryModalUser] = useState<string | null>(null);
  const [historyModalData, setHistoryModalData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // [新增] 異常警示日期狀態
  const [statsDate, setStatsDate] = useState(() => {
     return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [dailyRecords, setDailyRecords] = useState<any[]>([]); // 儲存特定日期的打卡紀錄

  useEffect(() => {
    fetchAllData();
    api.adminGetSheetList().then(res => {
        if(res.success && res.list.length > 0) {
            setSheetList(res.list);
            setExportSheet(res.list[0].name);
        }
    });
  }, []);

  // [新增] 當日期改變時，重新抓取該日期的紀錄
  useEffect(() => {
    fetchDailyRecords(statsDate);
  }, [statsDate]);

  // 切換主頁籤時重置子頁籤
  useEffect(() => {
    if (mainTab === 'admin') setSubTab('staff');
    if (mainTab === 'others') setSubTab('line');
  }, [mainTab]);

  const fetchAllData = async (showLoading = false) => {
    if (showLoading) { setBlockText("資料同步中..."); setIsBlocking(true); } 
    const res = await api.adminGetData('all');
    if (showLoading) setIsBlocking(false);

    if (res.success && res.allData) {
      setAllData(res.allData);
      localStorage.setItem('admin_cache_all', JSON.stringify(res.allData));
    }
  };

  // [新增] 抓取單日紀錄
  const fetchDailyRecords = async (date: string) => {
     const res = await api.adminGetDailyRecords(date);
     if (res.success) {
        setDailyRecords(res.list);
     }
  };

  // [新增] 開啟員工歷史紀錄
  const openStaffHistory = async (targetName: string) => {
      setHistoryModalUser(targetName);
      setHistoryLoading(true);
      setHistoryModalData(null);
      
      const res = await api.adminGetStaffHistory(targetName);
      setHistoryLoading(false);
      
      if (res.success) {
          setHistoryModalData(res.data);
      } else {
          onAlert("無法讀取紀錄");
          setHistoryModalUser(null);
      }
  };

  // --- Logic Helpers ---
  // [修改] 異常警示邏輯：改用 dailyRecords + 排除特定班別
  const getDailyStats = useMemo(() => {
    // 如果還沒載入班別或員工資料，先回傳空
    if (!allData.staff || !allData.shift) return { late: [], early: [] };
    
    // 使用從後端抓回來的 dailyRecords (特定日期)，而不是 allData.record (最近100筆)
    const recordsToAnalyze = dailyRecords;
    
    const staffShiftMap = new Map();
    allData.staff.list.forEach((s: any[]) => staffShiftMap.set(s[0], s[7])); // index 7 is shift

    const shiftTimeMap = new Map();
    allData.shift.list.forEach((s: any[]) => shiftTimeMap.set(s[0], { start: s[1], end: s[2] }));

    const lateList: any[] = [];
    const earlyList: any[] = [];
    const personRecords: {[key:string]: {in?: string, out?: string}} = {};

    recordsToAnalyze.forEach((r: any[]) => {
       const name = r[3], time = r[2], type = r[4];
       if(!personRecords[name]) personRecords[name] = {};
       if(type === '上班') { if(!personRecords[name].in || time < personRecords[name].in) personRecords[name].in = time; } 
       else if(type === '下班') { if(!personRecords[name].out || time > personRecords[name].out) personRecords[name].out = time; }
    });

    Object.keys(personRecords).forEach(name => {
        const shiftName = staffShiftMap.get(name);
        
        // [修改] 排除 "大夜班" 和 "小夜/假日班"
        if (shiftName === "大夜班" || shiftName === "小夜/假日班") return;

        const shift = shiftTimeMap.get(shiftName);
        const rec = personRecords[name];
        if (shift) {
            // 判斷遲到 (上班時間 > 班表時間)
            if (rec.in && shift.start && rec.in > (shift.start + ":59")) lateList.push({ name, time: rec.in, shift: shift.start });
            // 判斷早退 (下班時間 < 班表時間)
            if (rec.out && shift.end && rec.out < shift.end) earlyList.push({ name, time: rec.out, shift: shift.end });
        }
    });
    return { late: lateList, early: earlyList };
  }, [allData, dailyRecords]);

  // --- Actions ---
  const handleAction = async (taskName: string, apiCall: Promise<any>) => {
      setBlockText(taskName); setIsBlocking(true);
      const res = await apiCall;
      setIsBlocking(false);
      if(res.success) { onAlert("執行成功"); fetchAllData(false); return true; }
      else { onAlert(res.message || "失敗"); return false; }
  };

  const handleUnbindStaff = (name: string) => onConfirm(`解除 [${name}] 綁定？`, () => handleAction("解綁中...", api.adminUpdateStaff({ op: 'unbind', targetName: name, adminName })));
  const handleKickStaff = (name: string) => onConfirm(`強制登出 [${name}]？`, () => handleAction("執行中...", api.adminUpdateStaff({ op: 'kick', targetName: name, adminName })));
  const handleUnlockStaff = (name: string) => onConfirm(`解除 [${name}] 鎖定？`, () => handleAction("解鎖中...", api.adminUnlockStaff(name, adminName)));
  const handleDeleteStaff = () => { if(editingStaff) onConfirm(`刪除員工 [${editingStaff[0]}]？`, async () => { if(await handleAction("刪除中...", api.adminUpdateStaff({ op: 'delete', targetName: editingStaff[0], adminName }))) setEditingStaff(null); }); };
  const handleSaveStaff = async () => {
    if (!staffForm.name || !staffForm.password) return onAlert("姓名與密碼必填");
    if (staffForm.password !== '******') {
       if (!/^[1-9]\d{3,}$/.test(staffForm.password)) {
          return onAlert("密碼格式錯誤：需為至少 4 位數字，且開頭不能為 0");
       }
    }
    if(await handleAction("儲存中...", api.adminUpdateStaff({ op: isAddingStaff ? 'add' : 'edit', adminName, oldName: editingStaff ? editingStaff[0] : null, newData: staffForm }))) { setIsAddingStaff(false); setEditingStaff(null); }
  };
  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.lat) return onAlert("請填寫資訊");
    if(await handleAction("新增中...", api.adminUpdateLocation({ ...newLoc, op: 'add', adminName }))) setNewLoc({name:'', lat:'', lng:'', radius:'500', ip:''});
  };
  const handleAddShift = async () => {
    if (!newShift.name || !newShift.start || !newShift.end) return onAlert("請填寫資訊");
    if(await handleAction("新增中...", api.adminUpdateShift({ ...newShift, op: 'add', adminName }))) setNewShift({ name: '', start: '09:00', end: '18:00' });
  };
  const handleDeleteShift = (name: string) => onConfirm(`確定刪除班別 [${name}]？`, () => handleAction("刪除中...", api.adminUpdateShift({ op: 'delete', targetName: name, adminName })));
  const handleExport = async () => {
    if(!exportSheet) return;
    setBlockText(`生成報表：${exportSheet}...`); setIsBlocking(true);
    try {
      const res = await api.adminDownloadExcel(adminName, exportSheet);
      if (res.success && res.url) { window.open(res.url, '_blank'); onAlert("✅ 報表下載中..."); }
      else onAlert(res.message || "下載失敗");
    } catch(e) { onAlert("發生錯誤"); } finally { setIsBlocking(false); }
  };

  const openAddStaff = () => { setStaffForm({ name: '', password: '123', lineId: '', needReset: 'TRUE', allowRemote: 'FALSE', shift: '' }); setIsAddingStaff(true); setEditingStaff(null); };
  const openEditStaff = (row: any[]) => { setStaffForm({ name: row[0], password: row[1], lineId: row[2], needReset: row[3], allowRemote: row[4], shift: row[7] || "" }); setEditingStaff(row); setIsAddingStaff(false); };

  const staffList = allData.staff?.list || [];
  const locList = allData.location?.list || [];
  const shiftList = allData.shift?.list || [];
  const recordList = allData.record?.list || [];
  const lineList = allData.line?.list || [];
  const logList = allData.log?.list || [];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex flex-col md:flex-row transition-colors duration-300">
      {isBlocking && <LoadingOverlay text={blockText} />}

      {/* ======================= */}
      {/* 1. SIDEBAR (Desktop Only) */}
      {/* ======================= */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-[#0f172a] border-r border-slate-800">
         <div className="p-6 flex items-center gap-3">
             <div className="bg-[#00bda4] size-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#00bda4]/20">
                <ShieldCheck size={24} />
             </div>
             <div>
                <h2 className="text-lg font-bold leading-tight text-white">管理控制中心</h2>
                <p className="text-[10px] uppercase tracking-widest text-[#00bda4] font-bold">Yiheng Tech</p>
             </div>
         </div>

         <div className="flex-1 px-4 py-6 space-y-2">
             <button onClick={() => setMainTab('admin')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${mainTab === 'admin' ? 'bg-[#1e293b] text-[#00bda4] shadow-md' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                <LayoutDashboard size={20} /> 管理設定
             </button>
             <button onClick={() => setMainTab('history')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${mainTab === 'history' ? 'bg-[#1e293b] text-[#00bda4] shadow-md' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                <History size={20} /> 打卡紀錄
             </button>
             <button onClick={() => setMainTab('others')} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${mainTab === 'others' ? 'bg-[#1e293b] text-[#00bda4] shadow-md' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                <Menu size={20} /> 其他功能
             </button>
         </div>

         <div className="p-4 border-t border-slate-800">
             <button onClick={onBack} className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-slate-500 hover:bg-slate-800 hover:text-white transition-all">
                <Home size={20} /> 返回打卡頁
             </button>
         </div>
      </div>

      {/* ======================= */}
      {/* 2. MAIN CONTENT WRAPPER */}
      {/* ======================= */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
          
          {/* Top Bar (Mobile Only) */}
          <div className="md:hidden sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800">
             <div className="flex items-center p-4 gap-3">
                 <div className="bg-[#00bda4] size-10 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <ShieldCheck size={24} />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold leading-tight text-white">管理控制中心</h2>
                    <p className="text-[10px] uppercase tracking-widest text-[#00bda4] font-bold">Yiheng Tech</p>
                 </div>
             </div>
          </div>

          {/* Sub-Nav Pills */}
          <div className="bg-[#0f172a] sticky top-[72px] md:top-0 z-30 pt-4 pb-2 px-4 md:px-8 md:pt-8 md:pb-6 border-b border-slate-800 md:bg-[#0f172a]/95 backdrop-blur">
             <div className="flex justify-between items-center mb-4 md:mb-6">
                <h3 className="text-2xl font-bold text-white hidden md:block">
                    {mainTab === 'admin' ? '管理設定' : mainTab === 'history' ? '打卡紀錄' : '其他功能'}
                </h3>
                <div className="flex items-center gap-3">
                   <span className="text-slate-500 text-sm font-bold hidden md:block">管理員：{adminName}</span>
                   <button onClick={() => fetchAllData(true)} className="p-2 bg-[#1e293b] rounded-lg text-slate-400 hover:text-white border border-slate-700 hover:border-[#00bda4] transition">
                       <Loader2 size={18} />
                   </button>
                </div>
             </div>

             {/* Pills Container */}
             {mainTab === 'admin' && (
                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                    {[['staff', '員工', Users], ['location', '地點', MapPin], ['shift', '班別', Clock], ['export', '匯出', Share]].map(([key, label, Icon]: any) => (
                        <button key={key} onClick={() => setSubTab(key)} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-all whitespace-nowrap ${subTab === key ? 'bg-[#00bda4] text-white shadow-lg shadow-[#00bda4]/20' : 'bg-[#1e293b] text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                           <Icon size={16} /> <span className="text-sm font-bold">{label}</span>
                        </button>
                    ))}
                </div>
             )}
             {mainTab === 'others' && (
                 <div className="flex gap-3 overflow-x-auto no-scrollbar">
                     <button onClick={() => setSubTab('line')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-all whitespace-nowrap ${subTab === 'line' ? 'bg-[#00bda4] text-white shadow-lg' : 'bg-[#1e293b] text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                        <MessageSquare size={16} /> <span className="text-sm font-bold">Line ID</span>
                     </button>
                     <button onClick={() => setSubTab('log')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-all whitespace-nowrap ${subTab === 'log' ? 'bg-[#00bda4] text-white shadow-lg' : 'bg-[#1e293b] text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                        <FileText size={16} /> <span className="text-sm font-bold">操作紀錄</span>
                     </button>
                 </div>
             )}
          </div>

          {/* Content Body */}
          <div className="p-4 md:p-8 flex flex-col gap-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
            
            {/* [修改] 異常警示卡片：加入日期選擇功能 */}
            {mainTab === 'admin' && (
                <div className="w-full md:max-w-2xl mx-auto bg-[#FF9800]/10 rounded-2xl p-6 border border-[#FF9800]/20 relative overflow-hidden shadow-md shadow-black/20">
                    <div className="flex justify-center mb-4 relative z-10">
                        {/* 使用 relative Group 讓 input 可以覆蓋整個按鈕 */}
                        <div className="relative group cursor-pointer">
                            <div className="text-[#FF9800] text-xs font-bold uppercase tracking-widest flex items-center gap-2 bg-[#FF9800]/10 px-3 py-1 rounded-full border border-[#FF9800]/20 group-hover:bg-[#FF9800]/20 transition">
                                <AlertTriangle size={14} /> 
                                {/* 顯示日期與星期 */}
                                <span>
                                  異常警示 ({statsDate}) 
                                  <span className="ml-1 opacity-70">
                                    {new Date(statsDate).toLocaleDateString('zh-TW', { weekday: 'short' })}
                                  </span>
                                </span>
                                <Edit2 size={12} className="opacity-50" />
                            </div>
                            {/* Input 設為絕對定位，覆蓋整個父層 div，確保點擊必中 */}
                            <input 
                                type="date" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                value={statsDate}
                                onChange={(e) => setStatsDate(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-around w-full relative z-10">
                        <button onClick={() => setStatModal({title: `遲到名單 (${statsDate})`, list: getDailyStats.late})} className="flex-1 flex flex-col items-center justify-center active:opacity-70 transition group">
                            <span className="text-4xl font-black text-[#FF9800] mb-1 group-hover:scale-110 transition-transform drop-shadow-sm">{getDailyStats.late.length}</span>
                            <span className="text-xs font-bold text-[#FF9800]/70">遲到人數</span>
                        </button>
                        <div className="w-[1px] h-10 bg-[#FF9800]/20"></div>
                        <button onClick={() => setStatModal({title: `早退名單 (${statsDate})`, list: getDailyStats.early})} className="flex-1 flex flex-col items-center justify-center active:opacity-70 transition group">
                            <span className="text-4xl font-black text-[#FF9800] mb-1 group-hover:scale-110 transition-transform drop-shadow-sm">{getDailyStats.early.length}</span>
                            <span className="text-xs font-bold text-[#FF9800]/70">早退人數</span>
                        </button>
                    </div>
                </div>
            )}

            {/* STAFF LIST */}
            {mainTab === 'admin' && subTab === 'staff' && (
                <>
                    <div className="flex justify-between items-center px-1">
                        <h3 className="font-bold text-slate-300">員工名單 ({staffList.length})</h3>
                        <button onClick={openAddStaff} className="text-[#00bda4] text-sm font-bold flex items-center gap-1 bg-[#1e293b] px-4 py-2 rounded-full border border-slate-700 shadow-sm active:scale-95 transition hover:bg-slate-700 hover:border-[#00bda4]"><Plus size={16}/> 新增員工</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {staffList.map((row: any[], i: number) => {
                            const isLocked = row[5] === "🔒已鎖定";
                            return (
                                <div key={i} 
                                    // [修改] 點擊卡片 -> 開啟歷史紀錄
                                    onClick={() => openStaffHistory(row[0])} 
                                    className="flex flex-col gap-3 rounded-2xl bg-[#1e293b] p-5 shadow-md shadow-black/10 border border-slate-700 relative overflow-hidden active:scale-[0.99] transition cursor-pointer hover:border-[#00bda4]/50 hover:bg-[#253248]"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1 w-full overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xl font-black text-slate-100 tracking-wide">{row[0]}</p>
                                                {row[7] && <span className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-slate-300 border border-slate-600 font-bold whitespace-nowrap">{row[7]}</span>}
                                            </div>
                                            <p className="text-slate-500 text-xs font-mono font-medium truncate w-full" title={row[2]}>
                                                ID: {row[2] || "未綁定"}
                                            </p>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 items-end">
                                            {/* 狀態標籤 */}
                                            <div className={`flex shrink-0 items-center justify-center rounded-full px-2 py-1 border ${isLocked ? 'bg-[#FF9800]/10 text-[#FF9800] border-[#FF9800]/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                                                <span className="text-[10px] font-bold whitespace-nowrap">{isLocked ? '已鎖定' : '正常'}</span>
                                            </div>
                                            
                                            {/* [新增] 鉛筆編輯按鈕 (阻止冒泡) */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openEditStaff(row); }}
                                                className="bg-blue-500/10 text-blue-400 p-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="h-[1px] bg-slate-700 w-full"></div>
                                    
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        {isLocked ? (
                                            <button onClick={() => handleUnlockStaff(row[0])} className="flex-1 py-2 bg-[#00bda4]/10 text-[#00bda4] rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#00bda4]/20"><Unlock size={14}/> 解鎖</button>
                                        ) : (
                                            <button onClick={() => handleUnbindStaff(row[0])} disabled={row[6] !== "📱已綁定"} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30 disabled:text-slate-500 hover:bg-slate-600"><Unlink size={14}/> 解綁</button>
                                        )}
                                        <button onClick={() => handleKickStaff(row[0])} className="flex-1 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-500/20 border border-transparent hover:border-red-500/30"><UserMinus size={14}/> 踢除</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Shift List */}
            {mainTab === 'admin' && subTab === 'shift' && (
                <>
                    <div className="bg-[#1e293b] p-6 rounded-2xl shadow-md border border-slate-700 md:max-w-3xl md:mx-auto w-full">
                        <h4 className="font-bold mb-4 text-slate-300 flex items-center gap-2"><Plus size={16} className="text-[#00bda4]"/> 新增班別</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <input placeholder="名稱" value={newShift.name} onChange={e=>setNewShift({...newShift, name: e.target.value})} className="md:col-span-3 p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <input type="time" value={newShift.start} onChange={e=>setNewShift({...newShift, start: e.target.value})} className="p-3 bg-[#334155] text-white rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <span className="hidden md:flex items-center justify-center text-slate-500">至</span>
                            <input type="time" value={newShift.end} onChange={e=>setNewShift({...newShift, end: e.target.value})} className="p-3 bg-[#334155] text-white rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                        </div>
                        <button onClick={handleAddShift} className="w-full bg-[#00bda4] text-white font-bold py-3 rounded-xl shadow-lg shadow-[#00bda4]/20 hover:bg-[#00a892] active:scale-[0.98]">確認新增</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shiftList.map((row: any[], i: number) => (
                            <div key={i} className="flex justify-between items-center bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700">
                                <div>
                                    <p className="font-extrabold text-slate-200 text-lg">{row[0]}</p>
                                    <p className="text-xs text-slate-500 font-bold mt-1 bg-slate-800 px-2 py-1 rounded w-fit">{row[1]} - {row[2]}</p>
                                </div>
                                <button onClick={() => handleDeleteShift(row[0])} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {mainTab === 'admin' && subTab === 'location' && (
                <>
                    <div className="bg-[#1e293b] p-6 rounded-2xl shadow-md border border-slate-700 md:max-w-3xl md:mx-auto w-full">
                        <h4 className="font-bold mb-4 text-slate-300 flex items-center gap-2"><Plus size={16} className="text-[#00bda4]"/> 新增打卡地點</h4>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <input placeholder="名稱" value={newLoc.name} onChange={e=>setNewLoc({...newLoc, name: e.target.value})} className="p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <input placeholder="誤差(m)" value={newLoc.radius} onChange={e=>setNewLoc({...newLoc, radius: e.target.value})} className="p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <input placeholder="緯度" value={newLoc.lat} onChange={e=>setNewLoc({...newLoc, lat: e.target.value})} className="p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <input placeholder="經度" value={newLoc.lng} onChange={e=>setNewLoc({...newLoc, lng: e.target.value})} className="p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                            <input placeholder="IP (選填)" value={newLoc.ip} onChange={e=>setNewLoc({...newLoc, ip: e.target.value})} className="col-span-2 p-3 bg-[#334155] text-white placeholder-slate-500 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-[#00bda4]" />
                        </div>
                        <button onClick={handleAddLocation} className="w-full bg-[#00bda4] text-white font-bold py-3 rounded-xl shadow-lg shadow-[#00bda4]/20 hover:bg-[#00a892] active:scale-[0.98]">新增</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locList.map((row: any[], i: number) => (
                            <div key={i} className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700">
                                <div className="flex justify-between">
                                    <p className="font-extrabold text-slate-200 text-lg">{row[0]}</p>
                                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 font-bold h-fit">{row[3]}m</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-mono">{row[1]}, {row[2]}</p>
                                {row[4] && <p className="text-xs text-slate-500 mt-1">IP: {row[4]}</p>}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {mainTab === 'admin' && subTab === 'export' && (
                 <div className="bg-[#1e293b] rounded-2xl p-8 shadow-sm border border-slate-700 text-center mt-4 max-w-lg mx-auto w-full">
                     <div className="bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 border border-green-500/20">
                        <FileSpreadsheet size={40} />
                     </div>
                     <h3 className="text-xl font-bold mb-2 text-white">匯出 Excel</h3>
                     <p className="text-slate-500 text-sm mb-6">請選擇要匯出的月份工作表</p>
                     <select value={exportSheet} onChange={(e) => setExportSheet(e.target.value)} className="w-full p-4 bg-[#334155] text-white rounded-xl font-bold outline-none mb-6 text-center border-none cursor-pointer hover:bg-[#475569]">
                        {sheetList.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                     </select>
                     <button onClick={handleExport} className="w-full bg-[#00bda4] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#00bda4]/20 flex items-center justify-center gap-2 hover:bg-[#00a892] transition-all active:scale-[0.98]">
                        <Download size={20} /> 確認下載
                     </button>
                 </div>
            )}

            {/* HISTORY */}
            {mainTab === 'history' && (
               <div className="flex flex-col gap-4">
                   <div className="flex justify-between items-center mb-2 px-1">
                       <h3 className="font-bold text-slate-300">近期打卡紀錄</h3>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                       {recordList.map((row: any[], i: number) => {
                           const isSuccess = row[6]?.includes('成功');
                           // 判斷方式 (GPS/IP) 通常在備註欄位 row[8]
                           const method = row[8]?.includes('GPS') && row[8]?.includes('IP') ? 'GPS+IP' : (row[8]?.includes('GPS') ? 'GPS' : (row[8]?.includes('IP') ? 'IP' : '未知'));
                           
                           return (
                           <div key={i} className="bg-[#1e293b] p-4 rounded-2xl shadow-sm border border-slate-700 flex flex-col gap-2">
                               <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                     <span className="font-bold text-slate-200 text-lg">{row[3]}</span>
                                     <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${row[4] === '上班' ? 'bg-[#00bda4]/10 text-[#00bda4] border-[#00bda4]/20' : 'bg-[#FF9800]/10 text-[#FF9800] border-[#FF9800]/20'}`}>{row[4]}</span>
                                  </div>
                                  {/* 成功/失敗 狀態顯示 */}
                                  <div className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${isSuccess ? 'bg-slate-800 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                      {isSuccess ? (
                                          <>{method} 打卡成功</>
                                      ) : (
                                          <>{row[6] || '失敗'}</> // 失敗原因
                                      )}
                                  </div>
                               </div>
                               
                               <div className="flex justify-between items-end border-t border-slate-700/50 pt-2">
                                  <p className="text-xs text-slate-400 font-mono">{row[1]} <span className="text-white font-bold text-sm ml-1">{row[2]}</span></p>
                                  {/* 地點放大顯示 */}
                                  <div className="flex items-center gap-1 max-w-[60%] justify-end">
                                      <MapPin size={12} className="text-slate-500 shrink-0"/>
                                      <p className="text-xs text-slate-300 font-bold truncate">{row[5]}</p>
                                  </div>
                               </div>
                           </div>
                       )})}
                   </div>
               </div>
            )}

            {/* OTHERS - Line & Log */}
            {mainTab === 'others' && subTab === 'line' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lineList.map((row: any[], i: number) => (
                       <div key={i} className="bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-700">
                           <div className="flex justify-between mb-2">
                               <span className="font-bold text-slate-200">{row[1]}</span>
                               <span className="text-xs text-slate-500">{new Date(row[0]).toLocaleDateString()}</span>
                           </div>
                           <p className="text-xs text-slate-400 font-mono bg-[#0f172a] p-3 rounded-lg break-all border border-slate-800">{row[2]}</p>
                       </div>
                   ))}
               </div>
            )}
            {mainTab === 'others' && subTab === 'log' && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {logList.map((row: any[], i: number) => (
                       <div key={i} className="bg-[#1e293b] p-4 rounded-2xl shadow-sm border border-slate-700">
                           <div className="flex justify-between mb-1">
                               <span className="font-bold text-[#00bda4] text-xs px-2 py-0.5 bg-[#00bda4]/10 rounded border border-[#00bda4]/20">{row[2]}</span>
                               {/* [修改] 直接顯示字串，解決 Invalid Date 問題 */}
                               <span className="text-xs text-slate-500">{row[0]}</span>
                           </div>
                           <p className="text-sm font-bold text-slate-300 mt-2">{row[3]}</p>
                           <p className="text-xs text-slate-600 mt-1">Admin: {row[1]}</p>
                       </div>
                   ))}
               </div>
            )}

          </div>
      </div>

      {/* ======================= */}
      {/* 3. MOBILE BOTTOM NAV    */}
      {/* ======================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-lg border-t border-slate-800 pb-8 pt-3 px-6 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <button onClick={onBack} className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#00bda4] transition-colors active:scale-95">
            <Home size={26} strokeWidth={2} />
            <span className="text-[10px] font-bold">回首頁</span>
          </button>
          
          <button onClick={() => setMainTab('history')} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${mainTab === 'history' ? 'text-[#00bda4]' : 'text-slate-500'}`}>
            <History size={26} strokeWidth={2} />
            <span className="text-[10px] font-bold">打卡紀錄</span>
          </button>
          
          <button onClick={() => setMainTab('admin')} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${mainTab === 'admin' ? 'text-[#00bda4]' : 'text-slate-500'}`}>
            <div className="relative">
              <ShieldCheck size={26} strokeWidth={2} />
              {mainTab === 'admin' && <div className="absolute -top-0.5 -right-0.5 size-2 bg-[#FF9800] rounded-full border-2 border-[#0f172a]"></div>}
            </div>
            <span className="text-[10px] font-bold">管理設定</span>
          </button>
          
          <button onClick={() => setMainTab('others')} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${mainTab === 'others' ? 'text-[#00bda4]' : 'text-slate-500'}`}>
            <Menu size={26} strokeWidth={2} />
            <span className="text-[10px] font-bold">其他</span>
          </button>
        </div>
      </div>

      {/* ======================= */}
      {/* 4. MODALS               */}
      {/* ======================= */}
      
      {/* Add/Edit Staff Modal */}
      {(isAddingStaff || editingStaff) && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#1e293b] w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-4 border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl text-white flex items-center gap-2">
                        {isAddingStaff ? <div className="bg-[#00bda4]/10 p-2 rounded-full text-[#00bda4]"><Plus size={20}/></div> : <div className="bg-blue-500/10 p-2 rounded-full text-blue-400"><Edit2 size={20}/></div>}
                        {isAddingStaff ? "新增員工" : "編輯員工"}
                    </h3>
                    <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <input value={staffForm.name} onChange={e=>setStaffForm({...staffForm, name: e.target.value})} className="p-3 bg-[#334155] text-white rounded-xl font-bold outline-none placeholder-slate-500 focus:ring-1 focus:ring-[#00bda4]" placeholder="姓名" />
                        <input value={staffForm.shift} onChange={e=>setStaffForm({...staffForm, shift: e.target.value})} className="p-3 bg-[#334155] text-white rounded-xl font-bold outline-none placeholder-slate-500 focus:ring-1 focus:ring-[#00bda4]" placeholder="班別 (例如: 早班)" />
                    </div>
                    <input value={staffForm.password} onChange={e=>setStaffForm({...staffForm, password: e.target.value})} className="w-full p-3 bg-[#334155] text-white rounded-xl font-bold outline-none placeholder-slate-500 focus:ring-1 focus:ring-[#00bda4]" placeholder="密碼" />
                    <input value={staffForm.lineId} onChange={e=>setStaffForm({...staffForm, lineId: e.target.value})} className="w-full p-3 bg-[#334155] text-white rounded-xl font-bold outline-none placeholder-slate-500 focus:ring-1 focus:ring-[#00bda4]" placeholder="Line ID (選填)" />
                    <div className="flex gap-2">
                         <label className="flex-1 flex items-center gap-2 bg-[#334155] p-3 rounded-xl cursor-pointer hover:bg-slate-700">
                            <input type="checkbox" checked={staffForm.needReset === 'TRUE'} onChange={e=>setStaffForm({...staffForm, needReset: e.target.checked?'TRUE':'FALSE'})} className="rounded text-[#00bda4] focus:ring-0 bg-slate-800 border-slate-600" />
                            <span className="text-xs font-bold text-slate-300">重設密碼</span>
                         </label>
                         <label className="flex-1 flex items-center gap-2 bg-[#334155] p-3 rounded-xl cursor-pointer hover:bg-slate-700">
                            <input type="checkbox" checked={staffForm.allowRemote === 'TRUE'} onChange={e=>setStaffForm({...staffForm, allowRemote: e.target.checked?'TRUE':'FALSE'})} className="rounded text-[#00bda4] focus:ring-0 bg-slate-800 border-slate-600" />
                            <span className="text-xs font-bold text-slate-300">遠端打卡</span>
                         </label>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!isAddingStaff && <button onClick={handleDeleteStaff} className="p-4 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20"><Trash2 size={20}/></button>}
                    <button onClick={handleSaveStaff} className="flex-1 bg-[#00bda4] text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-[#00bda4]/20 flex items-center justify-center gap-2 hover:bg-[#00a892]"><Save size={20}/> 儲存</button>
                </div>
            </div>
        </div>
      )}

      {/* Stats Detail Modal */}
      {statModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl max-h-[70vh] flex flex-col border border-slate-700">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                     <h3 className="font-bold text-lg text-white">{statModal.title}</h3>
                     <button onClick={() => setStatModal(null)} className="bg-slate-800 text-slate-400 p-2 rounded-full hover:text-white"><X size={16}/></button>
                 </div>
                 <div className="overflow-y-auto flex-1 space-y-2">
                     {statModal.list.length === 0 ? <p className="text-center text-slate-500 py-4">無資料</p> : 
                        statModal.list.map((item, i) => (
                           <div key={i} className="flex justify-between items-center bg-[#334155] p-3 rounded-xl border border-slate-700">
                               <span className="font-bold text-slate-200">{item.name}</span>
                               <span className="text-xs font-bold text-red-400">{item.time} (班表: {item.shift})</span>
                           </div>
                        ))
                     }
                 </div>
             </div>
        </div>
      )}

      {/* [新增] 員工歷史紀錄 Modal */}
      {historyModalUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-md rounded-[2rem] p-6 shadow-2xl max-h-[80vh] flex flex-col border border-slate-700">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                     <div>
                        <h3 className="font-bold text-lg text-white">{historyModalUser} 打卡紀錄</h3>
                        <p className="text-xs text-slate-500">顯示本月與上月資料</p>
                     </div>
                     <button onClick={() => setHistoryModalUser(null)} className="bg-slate-800 text-slate-400 p-2 rounded-full hover:text-white"><X size={16}/></button>
                 </div>
                 
                 {historyLoading ? (
                     <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#00bda4]" /></div>
                 ) : historyModalData ? (
                     <div className="overflow-y-auto flex-1 space-y-4">
                        {/* 本月 */}
                        <div>
                           <h4 className="text-[#00bda4] font-bold text-sm mb-2 sticky top-0 bg-[#1e293b] py-1">本月紀錄</h4>

                           {/* 列表標題列 */}
                           <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 px-2 mb-2 text-[10px] text-slate-500 font-bold">
                               <div>日期</div>
                               <div className="text-center">上班</div>
                               <div className="text-center">下班</div>
                               <div className="text-right">狀態</div>
                           </div>

                           {historyModalData.current.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">無資料</p> : (
                               <div className="space-y-2">
                                  {historyModalData.current.map((row: any, i: number) => (
                                      <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 text-xs bg-[#334155] p-3 rounded-xl border border-slate-700 items-center">
                                          {/* 日期 */}
                                          <span className="text-slate-300 font-mono font-bold">
                                            {row.date.replace(/^\d{4}\//, '')} {/* 只顯示 月/日 */}
                                          </span>
                                          
                                          {/* 上班時間 */}
                                          <span className={`text-center font-bold ${row.in ? 'text-blue-300' : 'text-slate-600'}`}>
                                            {row.in || '-'}
                                          </span>
                                          
                                          {/* 下班時間 */}
                                          <span className={`text-center font-bold ${row.out ? 'text-orange-300' : 'text-slate-600'}`}>
                                            {row.out || '-'}
                                          </span>
                                          
                                          {/* 狀態 (遲到/早退) */}
                                          <div className="text-right">
                                            {row.status ? (
                                                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    {row.status}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-[10px]">正常</span>
                                            )}
                                          </div>
                                      </div>
                                  ))}
                               </div>
                           )}
                        </div>

                        {/* 上月 */}
                        <div>
                           <h4 className="text-slate-400 font-bold text-sm mb-2 sticky top-0 bg-[#1e293b] py-1">上月 ({historyModalData.lastMonthName})</h4>
                           {historyModalData.last.current.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">無資料</p> : (
                               <div className="space-y-2">
                                  {historyModalData.last.current.map((row: any, i: number) => (
                                      <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 text-xs bg-[#334155] p-3 rounded-xl border border-slate-700 items-center">
                                          {/* 日期 */}
                                          <span className="text-slate-300 font-mono font-bold">
                                            {row.date.replace(/^\d{4}\//, '')} {/* 只顯示 月/日 */}
                                          </span>
                                          
                                          {/* 上班時間 */}
                                          <span className={`text-center font-bold ${row.in ? 'text-blue-300' : 'text-slate-600'}`}>
                                            {row.in || '-'}
                                          </span>
                                          
                                          {/* 下班時間 */}
                                          <span className={`text-center font-bold ${row.out ? 'text-orange-300' : 'text-slate-600'}`}>
                                            {row.out || '-'}
                                          </span>
                                          
                                          {/* 狀態 (遲到/早退) */}
                                          <div className="text-right">
                                            {row.status ? (
                                                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    {row.status}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-[10px]">正常</span>
                                            )}
                                          </div>
                                      </div>
                                  ))}
                               </div>
                           )}
                        </div>
                     </div>
                 ) : (
                     <div className="text-center text-red-400 py-4">讀取失敗</div>
                 )}
             </div>
        </div>
      )}

    </div>
  );
};