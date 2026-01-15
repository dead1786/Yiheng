import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { MapPin, LogOut, Navigation, CheckCircle, ShieldCheck, History, X, Crown, KeyRound, Loader2, RefreshCw, Timer } from 'lucide-react';

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
  const [locations, setLocations] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('cached_locations') || '[]'); } catch { return []; } });
  const [selectedLoc, setSelectedLoc] = useState(() => { try { const locs = JSON.parse(localStorage.getItem('cached_locations') || '[]'); return locs[0]?.name || ''; } catch { return ''; } });
  const [historyData, setHistoryData] = useState<any>(() => { try { return JSON.parse(localStorage.getItem(`cached_history_${user.name}`) || 'null'); } catch { return null; } });
  
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [status, setStatus] = useState('定位中...');
  // [新增] IP 狀態
  const [clientIp, setClientIp] = useState('');
  
  const [isClockingIn, setIsClockingIn] = useState(false);

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
        // [修改] 傳入 loginTime
        const res = await api.getHistory(user.name, user.loginTime);
        
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
            window.history.go(-2); 
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

  // [新增] 檢查目前 IP 是否符合當選地點的 IP 設定
  const currentLocData = locations.find(l => l.name === selectedLoc);
  const isIpMatch = currentLocData && currentLocData.ip && clientIp && currentLocData.ip.includes(clientIp);

  // [修改] 允許條件：GPS定位成功 OR 遠端權限 OR (有IP且IP符合該地點設定)
  const canSubmit = coords || user.allowRemote || isIpMatch;

  const handleClockIn = async (type: '上班' | '下班', force = false) => {
    // [修改] Payload 增加 ip 欄位
    const payload = { 
      name: user.name, 
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
    
    // [新增] 檢查強制登出
    if (res.status === 'force_logout') {
        onAlert(res.message);
        onLogout();
        return;
    }

    if(res.success) {
      setResult(`${type}打卡成功！`); 
      setTimeout(() => setResult(''), 3000);
      setTimeout(() => { fetchHistory(false); }, 1000);
    } else {
      if (res.status === 'warning_duplicate') { 
        if (onConfirm) { onConfirm(res.message, () => { handleClockIn(type, true); }); } 
        else { if(confirm(res.message)) handleClockIn(type, true); } 
      } else { 
        onAlert ? onAlert(res.message) : alert(res.message); 
      }
    }
  };
  
  const handleChangePassword = async () => {
    if (!pwdForm.old || !pwdForm.new1 || !pwdForm.new2) return onAlert("請填寫所有欄位");
    if (pwdForm.new1 !== pwdForm.new2) return onAlert("兩次新密碼輸入不一致");
    if (pwdForm.new1.length < 4) return onAlert("新密碼至少需要 4 位數");
    setIsGlobalLoading(true);
    const res = await api.updatePassword(user.name, pwdForm.old, pwdForm.new1);
    setIsGlobalLoading(false);
    if (res.success) {
      onAlert("密碼修改成功！下次請用新密碼登入。");
      setShowChangePwd(false);
      setPwdForm({ old: '', new1: '', new2: '' });
    } else { onAlert(res.message); }
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
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col items-center">
      {isGlobalLoading && <LoadingOverlay />}

      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg overflow-hidden pb-6">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">{user.name} {user.allowRemote && <ShieldCheck size={18} className="text-yellow-300" />}</h2>
            <p className="text-blue-200 text-xs mt-1">{user.allowRemote ? "已啟用遠端權限" : status}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => getLocationWithRetry(0)} className="bg-white/20 p-2 rounded-full hover:bg-white/30" title="同步定位"><RefreshCw size={18} /></button>
            {user.isAdmin && (<button onClick={onEnterAdmin} className="bg-yellow-400 text-blue-900 p-2 rounded-full hover:bg-yellow-300 shadow-lg animate-bounce" title="管理員後台"><Crown size={18} /></button>)}
            <button onClick={() => setShowChangePwd(true)} className="bg-white/20 p-2 rounded-full hover:bg-white/30" title="修改密碼"><KeyRound size={18} /></button>
            <button onClick={() => fetchHistory(true)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><History size={18} /></button>
            <button onClick={() => onConfirm("確定要登出系統嗎？", onLogout)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><LogOut size={18} /></button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">打卡地點</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3.5 text-blue-500" size={20} />
              <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)} className="w-full pl-10 p-3 bg-gray-50 border rounded-xl font-bold text-gray-700 outline-none">
                {locations.length > 0 ? locations.map(loc => <option key={loc.name} value={loc.name}>{loc.name}</option>) : <option>載入地點中...</option>}
              </select>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative h-48 bg-gray-100">
            {coords ? ( <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`}></iframe> ) : ( <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><Navigation className={user.allowRemote ? "" : "animate-pulse"} size={32} /><span className="text-sm">{user.allowRemote ? "遠端模式" : "定位中..."}</span></div> )}
          </div>
          
          {result ? ( 
            <div className="py-6 bg-green-500 text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-lg animate-in fade-in"><CheckCircle /> {result}</div> 
          ) : ( 
            <div className="grid grid-cols-2 gap-4"> 
              <button 
                onClick={() => handleClockIn('上班')} 
                disabled={isClockingIn || !canSubmit} 
                className="py-6 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {isClockingIn ? <Loader2 className="animate-spin" /> : "上班"}
              </button> 
              <button 
                onClick={() => handleClockIn('下班')} 
                disabled={isClockingIn || !canSubmit} 
                className="py-6 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {isClockingIn ? <Loader2 className="animate-spin" /> : "下班"}
              </button> 
            </div> 
          )}

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <Timer size={12} /> 最近打卡：{lastSuccess || '載入中...'}
            </p>
          </div>

        </div>
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-gray-800">打卡紀錄</h3><button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X /></button></div>
            <div className="flex p-2 gap-2 bg-gray-50">
              <button onClick={() => setHistoryTab('current')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${historyTab === 'current' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>本月</button>
              <button onClick={() => setHistoryTab('last')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${historyTab === 'last' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>上月 ({historyData?.lastMonthName})</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-2 py-3">日期</th>
                            <th className="px-2 py-3">上班</th>
                            <th className="px-2 py-3">下班</th>
                            <th className="px-2 py-3">狀態</th>
                            <th className="px-2 py-3">備註</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loadingHistory && !historyData ? (<tr><td colSpan={5} className="text-center py-10 text-gray-500">同步資料中...</td></tr>) : renderHistoryRows()}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6">
            <div className="text-center mb-6">
              <div className="bg-blue-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 text-blue-600"><KeyRound size={24} /></div>
              <h3 className="font-bold text-lg text-gray-800">修改密碼</h3>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-bold text-gray-500">目前密碼</label><input type="password" value={pwdForm.old} onChange={e=>setPwdForm({...pwdForm, old: e.target.value})} className="w-full p-2 border rounded-lg mt-1" /></div>
              <div><label className="text-xs font-bold text-gray-500">新密碼</label><input type="password" value={pwdForm.new1} onChange={e=>setPwdForm({...pwdForm, new1: e.target.value})} className="w-full p-2 border rounded-lg mt-1" placeholder="至少 4 位數" /></div>
              <div><label className="text-xs font-bold text-gray-500">確認新密碼</label><input type="password" value={pwdForm.new2} onChange={e=>setPwdForm({...pwdForm, new2: e.target.value})} className="w-full p-2 border rounded-lg mt-1" /></div>
              <p className="text-[10px] text-red-500 font-bold text-center">* 密碼長度至少需 4 位數</p>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowChangePwd(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">取消</button>
              <button onClick={handleChangePassword} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};