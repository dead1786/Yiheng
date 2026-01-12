import React, { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { ChangePasswordView } from './components/ChangePasswordView';
import { ClockInView } from './components/ClockInView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { Loader2, AlertTriangle, CheckCircle, Info } from 'lucide-react';

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
  needReset: boolean;
  allowRemote?: boolean;
  isAdmin?: boolean;
  loginTime?: number;
}

const SESSION_DURATION = 21 * 24 * 60 * 60 * 1000; // 21天 (毫秒)

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
          // [新增] 檢查是否過期
          const loginTime = parsed.loginTime || 0;
          const now = new Date().getTime();
          if (now - loginTime > SESSION_DURATION) {
            localStorage.removeItem('yh_app_session'); // 過期刪除
            setUser(null);
          } else {
            setUser(parsed);
          }
        }
      } catch (e) { localStorage.removeItem('yh_app_session'); }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    // [新增] 紀錄登入時間
    const userWithTime = { ...userData, loginTime: new Date().getTime() };
    setUser(userWithTime);
    localStorage.setItem('yh_app_session', JSON.stringify(userWithTime));
  };
  const handleLogout = () => { showConfirm("確定要登出系統嗎？", () => { setUser(null); setShowAdmin(false); localStorage.removeItem('yh_app_session'); }); };
  const handlePasswordChanged = () => { showAlert("密碼修改完成！請重新登入。"); setUser(null); localStorage.removeItem('yh_app_session'); };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  // 1. 沒登入 -> 登入頁
  if (!user) return <LoginView onLogin={handleLogin} />;
  
  // 2. 需改密碼 -> 改密碼頁 (這裡也要補上 Modal，以防萬一)
  if (user.needReset) {
    return (
      <>
        <ChangePasswordView user={user} onPasswordChanged={handlePasswordChanged} onAlert={showAlert} />
        <ModalDialog isOpen={modalConfig.isOpen} type={modalConfig.type} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onCancel={modalConfig.onCancel} />
      </>
    );
  }
  
  // 3. 管理員後台 (修正重點：必須把 ModalDialog 包進來)
  if (showAdmin && user) {
    return (
      <>
        <AdminDashboardView 
          onBack={() => setShowAdmin(false)} 
          onAlert={showAlert} 
          onConfirm={showConfirm} 
          adminName={user.name} 
        />
        {/* 這行就是之前漏掉的，把它加回來，彈窗才會出現 */}
        <ModalDialog isOpen={modalConfig.isOpen} type={modalConfig.type} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onCancel={modalConfig.onCancel} />
      </>
    );
  }

  // 4. 打卡首頁
  return (
    <>
      <ClockInView user={user} onLogout={handleLogout} onAlert={showAlert} onConfirm={showConfirm} onEnterAdmin={() => setShowAdmin(true)} />
      <ModalDialog isOpen={modalConfig.isOpen} type={modalConfig.type} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onCancel={modalConfig.onCancel} />
    </>
  );
};

export default App;