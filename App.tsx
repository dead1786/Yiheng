import React, { useState, useEffect, createContext, useContext } from 'react';
import { LoginView } from './components/LoginView';
import { ChangePasswordView } from './components/ChangePasswordView';
import { ClockInView } from './components/ClockInView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { Loader2, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { api } from './services/api';



// === 深色模式預覽組件 ===
const DarkModePreview = ({ onExit }: { onExit: () => void }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">深色模式預覽</h1>
          <p className="text-xs text-slate-400">Dark Mode UI Preview</p>
        </div>
        <button 
          onClick={onExit}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
        >
          返回登入
        </button>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6 max-w-md mx-auto">
        
        {/* 1. 地點選擇卡片 */}
        <div className="bg-slate-800 rounded-[2rem] p-6 shadow-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">打卡地點</h3>
          <select className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-[#0bc6a8] outline-none">
            <option>總公司</option>
            <option>台北分公司</option>
            <option>高雄辦公室</option>
          </select>
          
          <div className="flex items-center gap-2 mt-4 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0bc6a8]"></span>
            <span className="text-slate-400">GPS 範圍內</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold ml-auto">IP 符合</span>
          </div>
        </div>

        {/* 2. 地圖區塊 */}
        <div className="bg-slate-800 rounded-[2rem] p-3 shadow-xl border border-slate-700">
          <div className="relative w-full aspect-[16/9] rounded-[1.5rem] overflow-hidden bg-slate-700 flex items-center justify-center">
            <span className="text-slate-500 text-sm">地圖預覽區</span>
          </div>
        </div>

        {/* 3. 打卡按鈕 */}
        <div className="space-y-4">
          {/* 上班按鈕 */}
          <button className="w-full h-24 rounded-[2rem] bg-[#0bc6a8] hover:bg-[#09b095] text-white shadow-[0_15px_30px_-10px_rgba(11,198,168,0.4)] flex items-center justify-between px-8 transition-all active:scale-[0.98]">
            <div className="flex flex-col items-start gap-1">
              <span className="text-2xl font-black tracking-wide">上班打卡</span>
              <span className="text-xs font-medium opacity-80 tracking-widest">CLOCK IN</span>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center">
              →
            </div>
          </button>

          {/* 下班按鈕 */}
          <button className="w-full h-24 rounded-[2rem] bg-[#ff9f28] hover:bg-[#f59015] text-white shadow-[0_15px_30px_-10px_rgba(255,159,40,0.4)] flex items-center justify-between px-8 transition-all active:scale-[0.98]">
            <div className="flex flex-col items-start gap-1">
              <span className="text-2xl font-black tracking-wide">下班打卡</span>
              <span className="text-xs font-medium opacity-80 tracking-widest">CLOCK OUT</span>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center">
              ←
            </div>
          </button>
        </div>

        {/* 4. 統計卡片 */}
        <div className="bg-slate-800 rounded-[2rem] p-6 shadow-xl border border-slate-700">
          <h3 className="text-lg font-black text-white mb-4">當月統計</h3>
          
          <div className="space-y-3">
            {/* 總工時 */}
            <div className="bg-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">總工時</div>
                <div className="text-sm text-slate-500 mt-0.5">本月累計</div>
              </div>
              <div className="text-3xl font-black text-[#0bc6a8]">160<span className="text-base text-slate-400 ml-1">H</span></div>
            </div>

            {/* 遲到次數 */}
            <div className="bg-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">遲到次數</div>
                <div className="text-sm text-slate-500 mt-0.5">本月累計</div>
              </div>
              <div className="text-3xl font-black text-[#ff9f28]">2<span className="text-base text-slate-400 ml-1">次</span></div>
            </div>

            {/* 早退次數 */}
            <div className="bg-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">早退次數</div>
                <div className="text-sm text-slate-500 mt-0.5">本月累計</div>
              </div>
              <div className="text-3xl font-black text-red-500">1<span className="text-base text-slate-400 ml-1">次</span></div>
            </div>
          </div>
        </div>

        {/* 5. 申請表單預覽 */}
        <div className="bg-slate-800 rounded-[2rem] p-6 shadow-xl border border-slate-700">
          <h3 className="text-lg font-black text-white mb-4">補打卡申請</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">補打卡日期</label>
              <input 
                type="date"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl text-white font-bold focus:ring-2 focus:ring-[#0bc6a8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">類型</label>
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 rounded-xl font-bold bg-[#0bc6a8] text-white shadow-md">上班</button>
                <button className="py-3 rounded-xl font-bold bg-slate-700 text-slate-400">下班</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">申請原因</label>
              <textarea 
                placeholder="請簡述補打卡原因..."
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#0bc6a8] outline-none resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* 底部說明 */}
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">這是深色模式 UI 預覽</p>
          <p className="text-slate-600 text-xs mt-1">所有互動功能已禁用</p>
        </div>

      </main>
    </div>
  );
};

// --- Modal Component (保持不變) ---
const ModalDialog = ({ isOpen, type, message, onConfirm, onCancel }: any) => {
  if (!isOpen) return null;
  
  // 判斷是否為錯誤訊息（包含「失敗」「錯誤」等關鍵字）
  const isError = message.includes('失敗') || message.includes('錯誤') || message.includes('無法');
  const isSuccess = message.includes('✅') || message.includes('成功') || message.includes('完成');
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center gap-4">
          {/* 圖示 */}
          <div className={`p-4 rounded-full w-16 h-16 flex items-center justify-center ${
            isError ? 'bg-red-50 text-red-500' : 
            isSuccess ? 'bg-green-50 text-green-500' : 
            type === 'confirm' ? 'bg-orange-50 text-orange-500' : 
            'bg-blue-50 text-blue-500'
          }`}>
            {isError ? <AlertTriangle size={32} /> : 
             isSuccess ? <CheckCircle size={32} /> :
             type === 'confirm' ? <AlertTriangle size={32} /> : 
             <Info size={32} />}
          </div>
          
          {/* 訊息內容 */}
          <p className="text-slate-800 font-bold text-base leading-relaxed whitespace-pre-wrap">{message}</p>
          
          {/* 按鈕 */}
          <div className="flex gap-3 w-full mt-2">
            {type === 'confirm' && (
              <button 
                onClick={onCancel} 
                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
            )}
            <button 
              onClick={onConfirm} 
              className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-colors ${
                isError ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' :
                isSuccess ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200' :
                'bg-[#0bc6a8] text-white hover:bg-[#09b095] shadow-teal-200'
              }`}
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface User {
  name: string;
  uid?: string;           // [新增] 唯一識別碼
  region?: string;        // [新增] 個人分區 (顯示用)
  needReset: boolean;
  allowRemote?: boolean;
  isAdmin?: boolean;
  isSupervisor?: boolean; // [新增]
  regions?: string[];     // [新增] 分區權限
  loginTime?: number;
  shift?: {
    name: string;
    start: string;
    end: string;
  };
}

const SESSION_DURATION = 21 * 24 * 60 * 60 * 1000;

const App: React.FC = () => {
  

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm'; message: string; onConfirm: () => void; onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', message: '', onConfirm: () => {} });

  const showAlert = (msg: string) => { setModalConfig({ isOpen: true, type: 'alert', message: msg, onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })) }); };
  const showConfirm = (msg: string, onYes: () => void) => { setModalConfig({ isOpen: true, type: 'confirm', message: msg, onConfirm: () => { setModalConfig(prev => ({ ...prev, isOpen: false })); onYes(); }, onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false })) }); };

  // [新增] 處理網址自動登入邏輯 (Auto Login Link)
  useEffect(() => {
    const performAutoLogin = async () => {
      // 1. 檢查網址是否有 uid 參數
      const params = new URLSearchParams(window.location.search);
      const uidParam = params.get('uid');

      if (uidParam) {
         // 2. 取得或生成 Device ID (必須與 LoginView 邏輯一致)
         let deviceId = localStorage.getItem('yh_device_id');
         if (!deviceId) {
            deviceId = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('yh_device_id', deviceId);
         }

         // 3. 如果目前沒有登入，才執行自動登入
         const saved = localStorage.getItem('yh_app_session');
         if (!saved) {
             setIsLoading(true);
             // 清除網址參數，避免看起來很亂
             window.history.replaceState({}, '', '/');
             
             try {
                const res = await api.autoLogin(uidParam, deviceId || '');
                if (res.success) {
                    // 自動登入成功
                    handleLogin(res.user); 
                    // 這裡不需 showAlert，直接進去最順暢
                } else {
                    // 自動登入失敗 (可能是換手機或裝置未綁定)
                    // 顯示訊息，停留在登入頁讓使用者手動輸入一次以綁定
                    showAlert(`🔗 連結識別成功！\n但為了安全，${res.message || "請手動登入一次以綁定此裝置。"}`);
                }
             } catch(e) {
                console.error("Auto login error", e);
             }
             setIsLoading(false);
             return; // 中斷後續的 session 檢查
         }
      }
    };
    performAutoLogin();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('yh_app_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          const loginTime = parsed.loginTime || 0;
          const now = new Date().getTime();
          
          // [修改] 邏輯修正：只有「非管理員 且 無UID」才視為異常舊資料
          // (純管理員本來就沒有 UID，必須豁免)
          if ((!parsed.isAdmin && !parsed.uid) || (now - loginTime > SESSION_DURATION)) {
            localStorage.removeItem('yh_app_session');
            setUser(null);
          } else {
            setUser(parsed);
            if (parsed.isAdmin) setShowAdmin(true);
          }
        }
      } catch (e) { localStorage.removeItem('yh_app_session'); }
    }
    setIsLoading(false);
  }, []);

  // [修改] 背景檢查邏輯：包含「強制登出」與「即時密碼重設」
  useEffect(() => {
    if (!user) return;
    
    const checkStatus = async () => {
       try {
         // [修改] 增加 user.name，讓後端能識別無 UID 的管理員
         const res = await api.checkStatus(user.uid || '', user.loginTime, user.name || '');
        
         // 情況 A: 強制登出
         if (!res.success && res.status === 'force_logout') {
            setUser(null);
            setShowAdmin(false);
            localStorage.removeItem('yh_app_session');
            showAlert(res.message || "⚠️ 您已被管理員強制登出系統");
         } 
         // 情況 B: 需重設密碼 (即時觸發)
         else if (res.success && res.status === 'need_reset') {
            if (!user.needReset) {
                const updatedUser = { ...user, needReset: true };
                setUser(updatedUser);
                localStorage.setItem('yh_app_session', JSON.stringify(updatedUser));
                showAlert("⚠️ 管理員要求您立即變更密碼！");
            }
         }
         // [新增] 情況 C: 自動同步狀態 (免登出刷新)
         else if (res.success && res.status === 'ok' && res.updatedUser) {
             const newData = res.updatedUser;
             // 簡單比對幾個關鍵欄位，有變動才更新 State (避免無限 Render)
             const hasChanged = 
                 newData.allowRemote !== user.allowRemote ||
                 newData.isSupervisor !== user.isSupervisor ||
                 JSON.stringify(newData.shift) !== JSON.stringify(user.shift) ||
                 JSON.stringify(newData.regions) !== JSON.stringify(user.regions);
             
             if (hasChanged) {
                 console.log("Auto-sync user profile...");
                 const syncedUser = { ...user, ...newData };
                 setUser(syncedUser);
                 localStorage.setItem('yh_app_session', JSON.stringify(syncedUser));
                 // 若權限變更為管理員/主管，自動切換 Admin 顯示 (可選)
                 // if (newData.isAdmin || newData.isSupervisor) setShowAdmin(true);
             }
         }
       } catch(e) { }
    };

    const intervalId = setInterval(checkStatus, 5000);
    return () => clearInterval(intervalId);
  }, [user]);

  const handleLogin = (userData: User) => {
    // [修正] 優先使用後端傳來的 loginTime (伺服器時間)，若無才使用本機時間 (相容舊版)
    const finalLoginTime = userData.loginTime || new Date().getTime();
    const userWithTime = { ...userData, loginTime: finalLoginTime };
    
    setUser(userWithTime);
    localStorage.setItem('yh_app_session', JSON.stringify(userWithTime));
    // [修改] 管理員或主管都預設開啟後台模式 (LoginView 會消失)
    if (userData.isAdmin || userData.isSupervisor) {
      setShowAdmin(true);
    }
  };
  
  // 修改：直接登出，不問問題
  const handleLogout = () => { 
    setUser(null); 
    setShowAdmin(false); 
    localStorage.removeItem('yh_app_session'); 
  };
  
  const handlePasswordChanged = () => { showAlert("密碼修改完成！請重新登入。"); setUser(null); localStorage.removeItem('yh_app_session'); };

  // [結構重構] 根據狀態決定主內容
  const renderContent = () => {
    // [新增] 深色模式預覽入口
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dark-preview') === 'true') {
      return <DarkModePreview onExit={() => window.location.href = '/'} />;
    }
    
    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
    
    // 1. 沒登入 -> 登入頁
    if (!user) return <LoginView onLogin={handleLogin} />;

    // 2. 需改密碼 -> 改密碼頁
    if (user.needReset) return <ChangePasswordView user={user} onPasswordChanged={handlePasswordChanged} onAlert={showAlert} />;

    // 3. 管理員後台
    // [修改] 傳遞 user 物件以便後台判斷權限 (isSupervisor)
    if (showAdmin && user) return <AdminDashboardView onBack={() => setShowAdmin(false)} onAlert={showAlert} onConfirm={showConfirm} user={user} />;

    // 4. 打卡首頁
    return <ClockInView user={user} onLogout={handleLogout} onAlert={showAlert} onConfirm={showConfirm} onEnterAdmin={() => setShowAdmin(true)} />;
  };


  // [關鍵] ModalDialog 放在最外層，永遠不會被 Unmount
  return (
    <>
      {renderContent()}
      <ModalDialog 
        isOpen={modalConfig.isOpen} 
        type={modalConfig.type} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        onCancel={modalConfig.onCancel} 
      />
    </>
  );
};

export default App;