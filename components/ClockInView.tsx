import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useDarkMode } from '../App';
import { 
  MapPin, LogOut, Navigation, CheckCircle, ShieldCheck, History, X, 
  Crown, KeyRound, Loader2, RefreshCw, Timer, Calculator,
  Building2, Bell, Wifi, Cloud, LogIn, Calendar, BarChart3, Settings, Lock, 
  ToggleRight, ToggleLeft, ArrowRightFromLine, FileText, FilePlus, ChevronRight
} from 'lucide-react';

const getDistanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
};

interface Props {
  user: any;
  onLogout: () => void;
  onAlert: (msg: string) => void;
  onConfirm: (msg: string, onYes: () => void) => void;
  onEnterAdmin: () => void;
}

const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] bg-white/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
    <div className="bg-black/80 text-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-400 w-10 h-10" />
      <span className="font-bold tracking-widest text-lg">處理中...</span>
    </div>
  </div>
);

export const ClockInView = ({ user, onLogout, onAlert, onConfirm, onEnterAdmin }: Props) => {
  const { isDark, toggleDark } = useDarkMode();
  const [locations, setLocations] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('cached_locations') || '[]'); } catch { return []; } });
  
  // [修改] 初始化地點：優先讀取個人上次的打卡地點 (last_station_用戶名)
  const [selectedLoc, setSelectedLoc] = useState(() => { 
    try { 
      const locs = JSON.parse(localStorage.getItem('cached_locations') || '[]');
      const saved = localStorage.getItem(`last_station_${user.name}`);
      // 如果有存過，且該地點還在目前的清單中，就直接選用
      if (saved && locs.find((l: any) => l.name === saved)) return saved;
      return locs[0]?.name || ''; 
    } catch { return ''; } 
  });

  const [historyData, setHistoryData] = useState<any>(() => { try { return JSON.parse(localStorage.getItem(`cached_history_${user.name}`) || 'null'); } catch { return null; } });
  
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [status, setStatus] = useState('定位中...');
  // [新增] IP 狀態
  const [clientIp, setClientIp] = useState('');
  
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  // [新增] 按鈕鎖定狀態 (20小時)
  const [lockState, setLockState] = useState<{ in: number; out: number }>({ in: 0, out: 0 });
  
  const [isClockingIn, setIsClockingIn] = useState(false);

  // [新增] 讀取本地鎖定狀態
  useEffect(() => {
    try {
      const savedLock = localStorage.getItem(`lock_state_${user.name}`);
      if (savedLock) setLockState(JSON.parse(savedLock));
    } catch(e) {}
  }, [user.name]);

  // [新增] 計算距離 & 檢查鎖定時間
  useEffect(() => {
    if (coords && selectedLoc && locations.length > 0) {
      const target = locations.find(l => l.name === selectedLoc);
      if (target) {
         const dist = getDistanceInMeters(coords.lat, coords.lng, Number(target.lat), Number(target.lng));
         setCurrentDist(dist);
      }
    }
  }, [coords, selectedLoc, locations]);

  // [新增] 抓取 IP
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        if(data.ip) setClientIp(data.ip);
      })
      .catch(e => console.log("IP Check Fail", e));
  }, []);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [result, setResult] = useState('');
  
  const [showHistory, setShowHistory] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [historyTab, setHistoryTab] = useState<'current' | 'last'>('current');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: '', new1: '', new2: '' });
  
  const [lastSuccess, setLastSuccess] = useState('');

  // === 申請功能 State ===
  const [showRequestMenu, setShowRequestMenu] = useState(false);
  const [showMakeupForm, setShowMakeupForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  
  // 補打卡表單資料
  const [makeupDate, setMakeupDate] = useState('');
  const [makeupType, setMakeupType] = useState<'in' | 'out'>('in');
  const [makeupReason, setMakeupReason] = useState('');
  
  // 請假表單資料
  const [leaveDateStart, setLeaveDateStart] = useState('');
  const [leaveDateEnd, setLeaveDateEnd] = useState('');
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveHalfDay, setLeaveHalfDay] = useState(false);
  const [leaveType, setLeaveType] = useState('事假');
  const [leaveReason, setLeaveReason] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === 統計功能 State ===
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // === 設定 Modal State ===
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const exitIntentRef = useRef(false);

  const getLocationWithRetry = (retryCount = 0) => {
    if (!("geolocation" in navigator)) {
      setStatus('瀏覽器不支援 GPS');
      return;
    }
    if (retryCount > 0) setStatus(`定位校正中... (第 ${retryCount} 次)`);
    else setStatus('定位更新中...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('✅ GPS 訊號良好');
      },
      (err) => {
        console.warn("GPS Fail:", err);
        if (retryCount < 3) {
          setTimeout(() => getLocationWithRetry(retryCount + 1), 1500);
        } else {
          if (!coords) setStatus('❌ 無法取得定位 (請重整網頁)');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchHistory = async (showLoading = true) => { 
    if (showLoading) {
        setShowHistory(true); 
        setLoadingHistory(true); 
    }
    try {
        // [修改] 改傳 user.uid
        const res = await api.getHistory(user.uid, user.loginTime);
        
        // [新增] 檢查強制登出
        if (res.status === 'force_logout') {
            onAlert(res.message);
            onLogout();
            return;
        }

        if (res.success) { 
          setHistoryData(res.data); 
          localStorage.setItem(`cached_history_${user.name}`, JSON.stringify(res.data)); 
          
          if (res.data.lastRawRec) {
            setLastSuccess(res.data.lastRawRec);
          } else {
            setLastSuccess("尚無紀錄");
          }
        } 
    } catch(e) {
        console.error(e);
    } finally {
        setLoadingHistory(false); 
    }
  };

  useEffect(() => {
    api.getLocations().then(res => { 
        if(res.success && res.list.length > 0) { 
            setLocations(res.list); 
            localStorage.setItem('cached_locations', JSON.stringify(res.list)); 
            if (!selectedLoc) setSelectedLoc(res.list[0].name); 
        } 
    });
    fetchHistory(false);
    
    getLocationWithRetry(0);
    const intervalId = setInterval(() => getLocationWithRetry(0), 10000); 

    window.history.pushState({ view: 'root' }, '', '');
    const handlePopState = (event: PopStateEvent) => {
      if (document.body.classList.contains('modal-open')) {
        setShowHistory(false);
        setShowChangePwd(false);
        document.body.classList.remove('modal-open');
        window.history.pushState({ view: 'root' }, '', '');
        return;
      }
      if (exitIntentRef.current) return;
      else {
        // [修改] 增加 removeEventListener 確保能真的離開
        onConfirm("確定要離開打卡系統嗎？", () => { 
            window.removeEventListener('popstate', handlePopState);
            // [修正] 嘗試退回上一頁，並強制呼叫關閉視窗 (解決部分瀏覽器點擊無效的問題)
            window.history.go(-2); 
            setTimeout(() => { window.close(); }, 200);
        });
        exitIntentRef.current = true;
        window.history.pushState({ view: 'root' }, '', '');
        setTimeout(() => { exitIntentRef.current = false; }, 3000);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (showHistory || showChangePwd) {
      document.body.classList.add('modal-open');
      window.history.pushState({ view: 'modal' }, '', '');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [showHistory, showChangePwd]);

  // [修正] 增加安全檢查，確保 ip 欄位存在且為字串才執行 includes，避免畫面變白
  const currentLocData = locations.find(l => l.name === selectedLoc);
  const isIpMatch = !!(currentLocData && 
                       typeof currentLocData.ip === 'string' && 
                       currentLocData.ip.trim() !== '' && 
                       clientIp && 
                       currentLocData.ip.includes(clientIp));

  // [修改] 允許條件：GPS定位成功 OR 遠端權限 OR (有IP且IP符合該地點設定)
  const canSubmit = coords || user.allowRemote || isIpMatch;
  const formatTime = (ts: number) => {
      if (!ts) return "";
      return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  
  const formatDateTime = (ts: number) => {
      if (!ts) return "";
      const date = new Date(ts);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${month}/${day} ${time}`;
  };
  
  // [新增] 判斷是否為 20 小時內的紀錄
  const isRecentIn = (Date.now() - lockState.in) < 20 * 60 * 60 * 1000;
  const isRecentOut = (Date.now() - lockState.out) < 20 * 60 * 60 * 1000;

  // [新增] 核心打卡邏輯 (原本的 handleClockIn 改名為 executeClockIn)
  const executeClockIn = async (type: '上班' | '下班', force = false) => {
    const payload = { 
      name: user.name, 
      uid: user.uid, // [新增] 傳送 UID
      station: selectedLoc, 
      lat: coords ? coords.lat : 0, 
      lng: coords ? coords.lng : 0, 
      type, 
      force, 
      loginTime: user.loginTime,
      ip: clientIp 
    };
    setIsClockingIn(true);
    const res = await api.clockIn(payload);
    setIsClockingIn(false);
    
    if (res.status === 'force_logout') {
        onAlert(res.message);
        onLogout();
        return;
    }

    if(res.success) {
      const now = Date.now();
      const newLock = { ...lockState, [type === '上班' ? 'in' : 'out']: now };
      setLockState(newLock);
      localStorage.setItem(`lock_state_${user.name}`, JSON.stringify(newLock));

      localStorage.setItem(`last_station_${user.name}`, selectedLoc);

      setResult(`${type}打卡成功！`); 
      setTimeout(() => setResult(''), 3000);
      setTimeout(() => { fetchHistory(false); }, 1500);
    } else {
      if (res.status === 'warning_duplicate') { 
        if (onConfirm) { onConfirm(res.message, () => { executeClockIn(type, true); }); } 
        else { if(confirm(res.message)) executeClockIn(type, true); } 
      } else { 
        onAlert ? onAlert(res.message) : alert(res.message); 
      }
    }
  };

  // [新增] 按鈕觸發的入口 (包含早退檢查)
  const handleClockIn = (type: '上班' | '下班') => {
      // 早退檢查邏輯
      if (type === '下班' && user.shift?.end) {
          const now = new Date();
          // 取得目前時間的 HH:mm 格式
          const currentHm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
          const shiftEnd = user.shift.end;

          // 若目前時間 小於 下班時間 (字串比對 "17:59" < "18:00")
          if (currentHm < shiftEnd) {
              onConfirm(
                  `⚠️ 尚未到下班時間 (${shiftEnd})，打卡將視為「早退」。\n\n您確定要現在打卡嗎？`, 
                  () => {
                      // 使用者點選確認 -> 執行打卡
                      executeClockIn(type, false);
                  }
              );
              return; // 中斷，等待使用者確認
          }
      }

      // 正常情況，直接執行
      executeClockIn(type, false);
  };
  
  const handleChangePassword = async () => {
    if (!pwdForm.old || !pwdForm.new1 || !pwdForm.new2) return onAlert("請填寫所有欄位");
    if (pwdForm.new1 !== pwdForm.new2) return onAlert("兩次新密碼輸入不一致");
    
    // [修改] 驗證：至少4位數字，且開頭不為0
    if (!/^[1-9]\d{3,}$/.test(pwdForm.new1)) {
        return onAlert("密碼格式錯誤：需為至少 4 位數字，且開頭不能為 0");
    }

    setIsGlobalLoading(true);
    const res = await api.updatePassword(user.name, pwdForm.old, pwdForm.new1);
    setIsGlobalLoading(false);
    if (res.success) {
      onAlert("密碼修改成功！下次請用新密碼登入。");
      setShowChangePwd(false);
      setPwdForm({ old: '', new1: '', new2: '' });
    } else { onAlert(res.message); }
  };

  // === 提交補打卡申請 ===
  const handleSubmitMakeup = async () => {
    if (!makeupDate || !makeupReason.trim()) {
      return onAlert("請填寫完整資料");
    }
    
    setIsSubmitting(true);
    const res = await api.submitMakeupRequest({
      uid: user.uid || '',
      name: user.name,
      date: makeupDate,
      type: makeupType,
      reason: makeupReason
    });
    setIsSubmitting(false);
    
    if (res.success) {
      onAlert("✅ 補打卡申請已提交！\n請等待主管審核。");
      setShowMakeupForm(false);
      setMakeupDate('');
      setMakeupReason('');
    } else {
      onAlert(res.message);
    }
  };

  // === 提交請假申請 ===
  const handleSubmitLeave = async () => {
    if (!leaveDateStart || !leaveDateEnd || !leaveReason.trim()) {
      return onAlert("請填寫完整資料");
    }
    
    setIsSubmitting(true);
    const res = await api.submitLeaveRequest({
      uid: user.uid || '',
      name: user.name,
      dateStart: leaveDateStart,
      dateEnd: leaveDateEnd,
      days: leaveDays,
      halfDay: leaveHalfDay,
      leaveType: leaveType,
      reason: leaveReason
    });
    setIsSubmitting(false);
    
    if (res.success) {
      onAlert("✅ 請假申請已提交！\n此功能尚未完全開放，請耐心等候。");
      setShowLeaveForm(false);
      setLeaveDateStart('');
      setLeaveDateEnd('');
      setLeaveReason('');
    } else {
      onAlert(res.message);
    }
  };
// === 取得統計資料 ===
  const handleOpenStats = async () => {
    setShowStatsModal(true);
    setLoadingStats(true);
    
    try {
      const res = await api.getMonthlyStats(user.uid || '', user.name);
      if (res.success) {
        setMonthlyStats(res.stats);
      } else {
        onAlert(res.message || "無法取得統計資料");
      }
    } catch (e) {
      onAlert("連線失敗，請稍後再試");
    } finally {
      setLoadingStats(false);
    }
  };

  const isWeekend = (dayStr: string) => (dayStr === "週六" || dayStr === "週日");

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const getRowStyle = (note: string, dayStr: string, dateStr: string) => { 
      let style = "transition-colors ";
      if (isToday(dateStr)) {
          style += "bg-yellow-100 hover:bg-yellow-200 font-bold border-l-4 border-yellow-500 shadow-sm";
      } else {
          if (isWeekend(dayStr)) style += "bg-red-50 hover:bg-red-100";
          else style += "hover:bg-gray-50";
          
          if (note && (note.includes("假") || note.includes("特休") || note.includes("節"))) style += " border-l-4 border-orange-500";
      }
      return style; 
  };
  
  const renderHistoryRows = () => { 
      if (!historyData || !historyData[historyTab] || historyData[historyTab].length === 0) 
          return <tr><td colSpan={5} className="text-center py-8 text-gray-400">目前尚無資料</td></tr>; 
      
      return historyData[historyTab].map((row: any, i: number) => { 
          const isLeave = row.note && (row.note.includes("假") || row.note.includes("特休") || row.note.includes("節")); 
          return ( 
            <tr key={i} className={`border-b ${getRowStyle(row.note, row.day, row.date)}`}> 
                <td className={`px-2 py-3 font-medium ${isWeekend(row.day) ? 'text-red-600' : 'text-gray-700'}`}>
                    {row.date} <span className="text-xs opacity-75">{row.day}</span>
                </td> 
                <td className="px-2 py-3 text-blue-600 font-bold text-xs whitespace-pre-wrap">{row.in}</td> 
                <td className="px-2 py-3 text-orange-500 font-bold text-xs whitespace-pre-wrap">{row.out}</td> 
                <td className="px-2 py-3 text-gray-600 text-xs">{row.status}</td> 
                <td className={`px-2 py-3 text-xs font-bold ${isLeave ? 'text-orange-600' : 'text-gray-400'}`}>{row.note}</td> 
            </tr> 
          ); 
      }); 
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] dark:bg-slate-900 flex flex-col font-sans relative pb-24">
      {isGlobalLoading && <LoadingOverlay />}

      {/* 1. Header Area */}
      <header className="px-6 py-6 flex items-center justify-between bg-transparent">
        <div className="flex items-center gap-3">
          <div className="bg-[#dcfce7] dark:bg-slate-700 p-2.5 rounded-xl">
             <Building2 className="text-[#0bc6a8]" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">每日打卡工作台</h1>
              {/* [修改] 管理員與主管入口 */}
              {(user.isAdmin || user.isSupervisor) && (
                <button 
                  onClick={onEnterAdmin}
                  className="bg-[#ff9f28] text-white p-1 rounded-md shadow-sm hover:bg-[#e88e20] transition-colors"
                  title="進入管理後台"
                >
                  <Crown size={14} fill="currentColor" />
                </button>
              )}
            </div>
            <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 dark:text-slate-400">
                    {user.name} {user.region ? <span className="text-xs text-slate-400">({user.region})</span> : ''}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">UID: {user.uid}</p>
            </div>
          </div>
        </div>
        
        {/* [修改] 右上角改為登出按鈕 */}
        <button 
          onClick={() => onConfirm("確定要登出系統嗎？", onLogout)}
          className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="登出"
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 px-6 space-y-6 w-full max-w-md mx-auto">
        
        {/* 2. Three Status Cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* GPS Card */}
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-sm flex flex-col items-center justify-center gap-2 min-h-[110px]">
            <div className="bg-[#e0fbf6] p-2 rounded-full mb-1">
               <MapPin className="text-[#0bc6a8]" size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400">GPS狀態</span>
            <span className={`text-sm font-black ${coords ? 'text-slate-800' : 'text-orange-500 animate-pulse'}`}>
              {coords ? '已定位' : '定位中'}
            </span>
          </div>
          
          {/* IP Card */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-sm flex flex-col items-center justify-center gap-2 min-h-[110px]">
            <div className="bg-[#e0fbf6] p-2 rounded-full mb-1">
               <Wifi className="text-[#0bc6a8]" size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400">網路IP</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate w-full text-center" title={clientIp}>
              {clientIp || '...'}
            </span>
          </div>
          
          {/* Remote Card */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-sm flex flex-col items-center justify-center gap-2 min-h-[110px]">
            <div className="bg-[#e0fbf6] p-2 rounded-full mb-1">
               <Cloud className="text-[#0bc6a8]" size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400">遠端模式</span>
            <span className={`text-sm font-black ${user.allowRemote ? 'text-[#0bc6a8]' : 'text-slate-300'}`}>
              {user.allowRemote ? '已開啟' : '未開啟'}
            </span>
          </div>
        </div>

        {/* 3. Map Section */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-[2rem] shadow-sm">
          <div className="relative w-full aspect-[16/9] rounded-[1.5rem] overflow-hidden bg-slate-100">
             {/* Google Maps Iframe */}
             {coords ? (
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`}
                  className="w-full h-full opacity-90 grayscale-[0.2]"
                ></iframe>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Loader2 className="animate-spin mb-2 text-[#0bc6a8]" />
                  <span className="text-xs font-bold">衛星定位中...</span>
                </div>
             )}
             
             {/* Center Marker Overlay (Visual only) */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4 pointer-events-none">
                 <div className="relative">
                    <span className="absolute w-4 h-4 bg-[#0bc6a8] rounded-full animate-ping opacity-75"></span>
                    <MapPin className="text-[#0bc6a8] fill-white relative z-10 drop-shadow-lg" size={40} />
                 </div>
             </div>
          </div>

          {/* Map Footer Info */}
          <div className="flex items-center justify-between px-3 py-3">
             <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${currentDist !== null && currentDist < (locations.find(l=>l.name===selectedLoc)?.radius || 500) ? 'bg-[#0bc6a8]' : 'bg-orange-500'}`}></span>
                <div className="flex flex-col">
                   {/* Location Selector (Hidden styling) */}
                   <select 
                      value={selectedLoc} 
                      onChange={e => setSelectedLoc(e.target.value)} 
                      className="text-sm font-black text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none p-0 cursor-pointer"
                   >
                      {locations.map(loc => <option key={loc.name} value={loc.name}>{loc.name}</option>)}
                   </select>
                   <span className="text-[10px] text-slate-400 font-bold">
                     距離公司範圍：{currentDist !== null ? `${currentDist} 公尺` : '計算中'}
                   </span>
                </div>
             </div>
             
             {/* [修改] 右側狀態區：垂直排列 GPS 與 IP 狀態 */}
             <div className="flex flex-col items-end gap-1">
                 {/* GPS 狀態 */}
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentDist !== null && currentDist < (locations.find(l=>l.name===selectedLoc)?.radius || 500)
                    ? 'bg-[#dcfce7] dark:bg-slate-700 text-[#0bc6a8]' 
                    : 'bg-red-50 text-red-500'
                 }`}>
                    {currentDist !== null && currentDist < (locations.find(l=>l.name===selectedLoc)?.radius || 500) ? 'GPS 範圍內' : 'GPS 範圍外'}
                 </span>
                 
                 {/* [新增] IP 狀態 */}
                 {locations.find(l=>l.name===selectedLoc)?.ip ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isIpMatch ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
                    }`}>
                        {isIpMatch ? 'IP 符合' : 'IP 不符'}
                    </span>
                 ) : (
                    <span className="text-[10px] text-slate-300 font-bold px-1">無 IP 限制</span>
                 )}
             </div>
          </div>
        </div>


        {/* 5. Big Action Buttons */}
        {result ? (
           <div className="w-full py-8 rounded-[2rem] bg-[#0bc6a8] text-white flex flex-col items-center justify-center shadow-lg animate-in fade-in zoom-in">
             <CheckCircle size={48} className="mb-2" />
             <span className="text-2xl font-bold">{result}</span>
           </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {/* Clock IN (Teal) */}
            <button 
              onClick={() => handleClockIn('上班')}
              disabled={isClockingIn || !canSubmit} 
              className="w-full h-24 rounded-[2rem] bg-[#0bc6a8] hover:bg-[#09b095] text-white shadow-[0_15px_30px_-10px_rgba(11,198,168,0.4)] flex items-center justify-between px-8 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
            >
               <div className="flex flex-col items-start gap-1">
                  <span className="text-2xl font-black tracking-wide">
                     {isRecentIn ? `已打卡 ${formatDateTime(lockState.in)}` : "上班打卡"}
                  </span>
                  <span className="text-xs font-medium opacity-80 tracking-widest">
                     {isRecentIn ? "點擊可重複打卡" : "CLOCK IN"}
                  </span>
               </div>
               <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center">
                  {isClockingIn ? <Loader2 className="animate-spin" /> : <ArrowRightFromLine size={24} />}
               </div>
            </button>

            {/* Clock OUT (Orange) */}
            <button 
              onClick={() => handleClockIn('下班')}
              disabled={isClockingIn || !canSubmit}
              className="w-full h-24 rounded-[2rem] bg-[#ff9f28] hover:bg-[#f59015] text-white shadow-[0_15px_30px_-10px_rgba(255,159,40,0.4)] flex items-center justify-between px-8 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
            >
               <div className="flex flex-col items-start gap-1">
                  <span className="text-2xl font-black tracking-wide">
                     {isRecentOut ? `已打卡 ${formatDateTime(lockState.out)}` : "下班打卡"}
                  </span>
                  <span className="text-xs font-medium opacity-80 tracking-widest">
                     {isRecentOut ? "點擊可重複打卡" : "CLOCK OUT"}
                  </span>
               </div>
               <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center">
                  {isClockingIn ? <Loader2 className="animate-spin" /> : <LogOut size={24} className="ml-1" />}
               </div>
            </button>
          </div>
        )}
      </main>

      {/* 6. Bottom Navigation (White, Fixed) */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 pb-6 pt-2 px-6 flex justify-between items-center z-40 text-slate-400 dark:text-slate-500">
         
         <button onClick={() => fetchHistory(true)} className="flex flex-col items-center gap-1 hover:text-[#0bc6a8] transition-colors">
            <History size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">紀錄</span>
         </button>
         
         {/* 統計按鈕 */}
         <button onClick={handleOpenStats} className="flex flex-col items-center gap-1 hover:text-[#0bc6a8] transition-colors">
            <BarChart3 size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">統計</span>
         </button>

         <button className="flex flex-col items-center gap-1 text-[#0bc6a8]">
            <Calendar size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">打卡</span>
         </button>

         {/* 申請按鈕 */}
         <button onClick={() => setShowRequestMenu(true)} className="flex flex-col items-center gap-1 hover:text-[#0bc6a8] transition-colors">
            <FileText size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">申請</span>
         </button>

        <button onClick={() => setShowSettingsModal(true)} className="flex flex-col items-center gap-1 hover:text-[#0bc6a8] transition-colors">
            <Settings size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">設定</span>
         </button>
      </nav>

      {/* Modal 部分保持原本功能 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowHistory(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-md h-[70vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-700">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">打卡紀錄</h3>
                <button onClick={() => setShowHistory(false)} className="bg-slate-200 dark:bg-slate-700 p-2 rounded-full hover:bg-slate-300"><X size={16}/></button>
            </div>
            <div className="flex p-3 gap-2 bg-white">
              <button onClick={() => setHistoryTab('current')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${historyTab === 'current' ? 'bg-[#0bc6a8] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>本月</button>
              <button onClick={() => setHistoryTab('last')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${historyTab === 'last' ? 'bg-[#0bc6a8] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>上月</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-white dark:bg-slate-800 sticky top-0">
                        <tr>
                            <th className="px-2 py-3">日期</th>
                            <th className="px-2 py-3">上班</th>
                            <th className="px-2 py-3">下班</th>
                            <th className="px-2 py-3">備註</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {loadingHistory && !historyData ? (<tr><td colSpan={5} className="text-center py-10 text-slate-400"><Loader2 className="animate-spin inline mr-2"/>讀取中...</td></tr>) : renderHistoryRows()}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowChangePwd(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-xs shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-blue-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-blue-500"><KeyRound size={28} /></div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">修改密碼</h3>
            </div>
            <div className="space-y-4">
              <div><input type="password" value={pwdForm.old} onChange={e=>setPwdForm({...pwdForm, old: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="目前密碼" /></div>
              <div><input type="password" value={pwdForm.new1} onChange={e=>setPwdForm({...pwdForm, new1: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="新密碼 (至少4位)" /></div>
              <div><input type="password" value={pwdForm.new2} onChange={e=>setPwdForm({...pwdForm, new2: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="確認新密碼" /></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowChangePwd(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200">取消</button>
              <button onClick={handleChangePassword} className="flex-1 py-3 bg-[#0bc6a8] text-white rounded-xl font-bold hover:bg-[#09b095] shadow-lg shadow-teal-200">確認修改</button>
            </div>
          </div>
        </div>
      )}

      {/* === 申請選單彈窗 === */}
      {showRequestMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowRequestMenu(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-xs shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-[#0bc6a8]">
                <FileText size={28} />
              </div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">選擇申請類型</h3>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => { setShowRequestMenu(false); setShowMakeupForm(true); }}
                className="w-full bg-[#0bc6a8] hover:bg-[#09b095] text-white py-4 rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <FilePlus size={20} />
                補打卡申請
              </button>
              
              <button 
                disabled
                className="w-full bg-slate-200 dark:bg-slate-700 text-slate-400 py-4 rounded-xl font-bold text-base cursor-not-allowed flex items-center justify-center gap-2 opacity-50"
              >
                <Calendar size={20} />
                請假申請（尚未開放）
              </button>
            </div>
            
            <button 
              onClick={() => setShowRequestMenu(false)}
              className="w-full mt-4 py-3 text-slate-500 dark:text-slate-300 font-bold hover:text-slate-700 dark:text-slate-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* === 補打卡申請表單 === */}
      {showMakeupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in overflow-y-auto" onClick={() => setShowMakeupForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm shadow-2xl p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-blue-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-blue-500">
                <FilePlus size={28} />
              </div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">補打卡申請</h3>
            </div>
            
            <div className="space-y-4">
              {/* 日期選擇 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">補打卡日期</label>
                <input 
                  type="date"
                  value={makeupDate}
                  onChange={(e) => setMakeupDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>
              
              {/* 類型選擇 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">類型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setMakeupType('in')}
                    className={`py-3 rounded-xl font-bold transition-all ${makeupType === 'in' ? 'bg-[#0bc6a8] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                  >
                    上班
                  </button>
                  <button 
                    onClick={() => setMakeupType('out')}
                    className={`py-3 rounded-xl font-bold transition-all ${makeupType === 'out' ? 'bg-[#ff9f28] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                  >
                    下班
                  </button>
                </div>
              </div>
              
              {/* 原因 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">申請原因</label>
                <textarea 
                  value={makeupReason}
                  onChange={(e) => setMakeupReason(e.target.value)}
                  placeholder="請簡述補打卡原因..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  rows={4}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setShowMakeupForm(false); setMakeupDate(''); setMakeupReason(''); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSubmitMakeup}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-[#0bc6a8] text-white rounded-xl font-bold hover:bg-[#09b095] shadow-lg shadow-teal-200 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : "提交申請"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 請假申請表單（預留） === */}
      {showLeaveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in overflow-y-auto" onClick={() => setShowLeaveForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm shadow-2xl p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-purple-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-purple-500">
                <Calendar size={28} />
              </div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">請假申請</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">起始日期</label>
                  <input 
                    type="date"
                    value={leaveDateStart}
                    onChange={(e) => setLeaveDateStart(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">結束日期</label>
                  <input 
                    type="date"
                    value={leaveDateEnd}
                    onChange={(e) => setLeaveDateEnd(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">請假天數</label>
                  <input 
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(parseFloat(e.target.value))}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">類型</label>
                  <select 
                    value={leaveHalfDay ? 'half' : 'full'}
                    onChange={(e) => setLeaveHalfDay(e.target.value === 'half')}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-purple-200 outline-none"
                  >
                    <option value="full">整天</option>
                    <option value="half">半天</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">假別</label>
                <select 
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-purple-200 outline-none"
                >
                  <option>事假</option>
                  <option>病假</option>
                  <option>特休</option>
                  <option>婚假</option>
                  <option>喪假</option>
                  <option>產假</option>
                  <option>陪產假</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">請假原因</label>
                <textarea 
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="請簡述請假原因..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-200 outline-none resize-none"
                  rows={4}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setShowLeaveForm(false); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSubmitLeave}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 shadow-lg shadow-purple-200 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : "提交申請"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 統計 Modal === */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowStatsModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-[#0bc6a8]/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-[#0bc6a8]">
                <BarChart3 size={28} />
              </div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">當月統計</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{user.name} 的出勤統計</p>
            </div>

            {loadingStats ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="animate-spin text-[#0bc6a8] mb-2" size={32} />
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">載入中...</p>
              </div>
            ) : monthlyStats ? (
              <div className="space-y-4">
                {/* 統計月份 */}
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">統計月份</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{monthlyStats.month}</div>
                </div>

                {/* 統計數據 */}
                <div className="space-y-3">
                  {/* 總工時 */}
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">總工時</div>
                      <div className="text-sm text-slate-400 mt-0.5">本月累計</div>
                    </div>
                    <div className="text-3xl font-black text-[#0bc6a8]">{monthlyStats.totalHours}<span className="text-base text-slate-400 ml-1">H</span></div>
                  </div>

                  {/* 遲到次數 */}
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">遲到次數</div>
                      <div className="text-sm text-slate-400 mt-0.5">本月累計</div>
                    </div>
                    <div className="text-3xl font-black text-[#ff9f28]">{monthlyStats.lateCount}<span className="text-base text-slate-400 ml-1">次</span></div>
                  </div>

                  {/* 早退次數 */}
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">早退次數</div>
                      <div className="text-sm text-slate-400 mt-0.5">本月累計</div>
                    </div>
                    <div className="text-3xl font-black text-red-500">{monthlyStats.earlyCount}<span className="text-base text-slate-400 ml-1">次</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400">
                <p className="text-sm">無統計資料</p>
              </div>
            )}

            <button 
              onClick={() => setShowStatsModal(false)}
              className="w-full mt-6 py-3 bg-[#0bc6a8] text-white rounded-xl font-bold hover:bg-[#09b095] shadow-lg shadow-teal-200 transition-all"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* === 設定 Modal === */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-slate-600 dark:text-slate-300">
                <Settings size={28} />
              </div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">設定</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">個人化設定</p>
            </div>

            <div className="space-y-3">
              {/* 深色模式切換 */}
              <button
                onClick={toggleDark}
                className="w-full bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <ToggleRight className="text-[#0bc6a8]" size={24} strokeWidth={2.5} />
                  ) : (
                    <ToggleLeft className="text-slate-400" size={24} strokeWidth={2.5} />
                  )}
                  <div className="text-left">
                    <div className="font-bold text-slate-800 dark:text-slate-100">深色模式</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isDark ? '已開啟' : '已關閉'}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-[#0bc6a8] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {isDark ? 'ON' : 'OFF'}
                </div>
              </button>

              {/* 修改密碼 */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowChangePwd(true);
                }}
                className="w-full bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <KeyRound className="text-slate-400 dark:text-slate-500" size={24} strokeWidth={2.5} />
                  <div className="text-left">
                    <div className="font-bold text-slate-800 dark:text-slate-100">修改密碼</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">變更登入密碼</div>
                  </div>
                </div>
                <ArrowRightFromLine className="text-slate-400" size={20} />
              </button>
            </div>

            <button 
              onClick={() => setShowSettingsModal(false)}
              className="w-full mt-6 py-3 bg-slate-200 dark:bg-slate-700 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};