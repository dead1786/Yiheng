import React, { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { ChangePasswordView } from './components/ChangePasswordView';
import { ClockInView } from './components/ClockInView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { Loader2, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { api } from './services/api';

// --- Modal Component (保持不變) ---
const ModalDialog = ({ isOpen, type, message, onConfirm, onCancel }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`p-3 rounded-full ${type === 'alert' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
            {type === 'alert' ? <Info size={32} /> : <AlertTriangle size={32} />}
          </div>
          <p className="text-gray-800 font-medium text-lg leading-relaxed whitespace-pre-wrap">{message}</p>
          <div className="flex gap-3 w-full mt-2">
            {type === 'confirm' && (<button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">取消</button>)}
            <button onClick={onConfirm} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">確定</button>
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
    const userWithTime = { ...userData, loginTime: new Date().getTime() };
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