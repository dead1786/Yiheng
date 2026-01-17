import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Lock, Loader2, Eye, EyeOff, Fingerprint, ArrowRight, ShieldCheck, KeyRound, MessageSquare, CheckCircle } from 'lucide-react';

interface Props {
  onLogin: (user: any) => void;
}

export const LoginView = ({ onLogin }: Props) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // [新增] 忘記密碼流程狀態: 0=無, 1=輸入驗證碼, 2=輸入新密碼
  const [resetStep, setResetStep] = useState(0); 
  const [resetCode, setResetCode] = useState('');
  const [newResetPwd, setNewResetPwd] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let storedId = localStorage.getItem('yh_device_id');
    if (!storedId) {
      storedId = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('yh_device_id', storedId);
    }
    setDeviceId(storedId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return setError("請輸入完整資訊");
    
    setLoading(true);
    setError('');
    
    try {
      const res = await api.login(name, password, deviceId);
      setLoading(false);

      if (res.success) {
        onLogin({ 
          name: res.name, 
          needReset: res.needReset,
          allowRemote: res.allowRemote,
          isAdmin: res.isAdmin 
        });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setLoading(false);
      setError("連線發生錯誤，請稍後再試");
    }
  };

  // [新增] 請求驗證碼
  const handleRequestReset = async () => {
    if (!name) return setError("請先在上方輸入您的「姓名」");
    setError('');
    setIsResetting(true);
    const res = await api.requestReset(name);
    setIsResetting(false);
    
    if (res.success) {
      setResetStep(1); // 進入輸入驗證碼階段
    } else {
      setError(res.message);
    }
  };

  // [新增] 執行密碼重設
  const handleVerifyAndReset = async () => {
    if (!resetCode) return alert("請輸入驗證碼");
    if (resetStep === 1) {
        setResetStep(2); // 切換到輸入新密碼介面
        return;
    }

    if (!newResetPwd) return alert("請輸入新密碼");
    if (!/^[1-9]\d{3,}$/.test(newResetPwd)) return alert("密碼格式需為至少 4 位數字，且開頭不為 0");

    setIsResetting(true);
    const res = await api.verifyReset(name, resetCode, newResetPwd);
    setIsResetting(false);

    if (res.success) {
        alert(res.message);
        setResetStep(0);
        setPassword(''); // 清空舊密碼
    } else {
        alert(res.message);
        if (res.message.includes("過期") || res.message.includes("錯誤")) {
            setResetStep(0); // 失敗則退回
        }
    }
  };

  return (
    <div className="min-h-screen bg-[#28B89B] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* Logo Area */}
      <div className="flex flex-col items-center mb-8 z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-white text-3xl font-bold tracking-wider mb-1 shadow-black/5 drop-shadow-sm">益恆科技</h1>
        <p className="text-white/80 text-base font-medium tracking-widest">線上打卡</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[360px] bg-white rounded-[2rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] p-8 z-10 animate-in zoom-in duration-500">
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Name Input */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 focus-within:ring-2 focus-within:ring-[#28B89B]/50 transition-all">
            <div className="mt-2 text-slate-400"><User size={20} /></div>
            <div className="flex-1">
               <label className="block text-xs font-bold text-slate-500 mb-0.5">姓名</label>
               <input 
                  className="w-full bg-transparent border-none p-0 text-slate-800 font-bold placeholder:text-slate-300 placeholder:font-normal focus:ring-0 outline-none text-base" 
                  placeholder="請輸入姓名" 
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
            </div>
          </div>

          {/* Password Input */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 focus-within:ring-2 focus-within:ring-[#28B89B]/50 transition-all">
            <div className="mt-2 text-slate-400"><Lock size={20} /></div>
            <div className="flex-1">
               <label className="block text-xs font-bold text-slate-500 mb-0.5">密碼</label>
               <input 
                  className="w-full bg-transparent border-none p-0 text-slate-800 font-bold placeholder:text-slate-300 placeholder:font-normal focus:ring-0 outline-none text-base" 
                  placeholder="請輸入您的密碼" 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
            </div>
            <button type="button" className="mt-2 text-slate-400 hover:text-[#28B89B] transition-colors" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Device ID */}
          <div className="bg-slate-50 rounded-xl py-3 px-4 flex items-center justify-center gap-2 border border-slate-100">
            <Fingerprint className="text-[#28B89B]" size={16} />
            <span className="text-[11px] text-slate-400 font-mono tracking-wider">
               裝置指紋 ID: {deviceId.substring(0, 12)}...
            </span>
          </div>

          {error && <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 px-4 rounded-xl animate-pulse">{error}</div>}

          <button disabled={loading} className="w-full bg-[#ff9f29] hover:bg-[#ff8f00] text-white font-bold text-lg h-14 rounded-2xl shadow-[0_10px_20px_rgba(255,159,41,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4">
            {loading ? (<div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> 登入中...</div>) : (<>登入系統 <ArrowRight size={22} strokeWidth={3} /></>)}
          </button>
          
          {/* [新增] 忘記密碼按鈕 */}
          <div className="text-center">
             <button type="button" onClick={handleRequestReset} disabled={isResetting} className="text-sm font-bold text-slate-400 hover:text-[#28B89B] transition-colors underline decoration-dotted underline-offset-4">
               {isResetting ? "處理中..." : "忘記密碼？"}
             </button>
          </div>
        </form>
      </div>

      <div className="mt-8 w-full max-w-[360px] z-10 animate-in slide-in-from-bottom-4 duration-700 delay-100">
        <div className="flex flex-col gap-4">
           <div className="flex items-center justify-center gap-2 text-white/60">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase">Secure AES-256 Encryption</span>
           </div>
        </div>
      </div>

      {/* [新增] 重設密碼 Modal */}
      {resetStep > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95">
               <div className="text-center mb-6">
                  <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                     {resetStep === 1 ? <MessageSquare size={30}/> : <KeyRound size={30}/>}
                  </div>
                  <h3 className="font-black text-xl text-slate-800">{resetStep === 1 ? "輸入驗證碼" : "設定新密碼"}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                      {resetStep === 1 ? "驗證碼已發送至您的 LINE (效期3分鐘)" : "請輸入您想使用的新密碼"}
                  </p>
               </div>

               <div className="space-y-4">
                  {resetStep === 1 && (
                     <input 
                       autoFocus
                       className="w-full text-center text-2xl tracking-[0.5em] font-black p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-xl outline-none"
                       placeholder="0000"
                       maxLength={4}
                       value={resetCode}
                       onChange={e => setResetCode(e.target.value)}
                     />
                  )}
                  
                  {resetStep === 2 && (
                     <input 
                       autoFocus
                       type="text"
                       className="w-full text-center text-xl font-bold p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-xl outline-none"
                       placeholder="輸入新密碼"
                       value={newResetPwd}
                       onChange={e => setNewResetPwd(e.target.value)}
                     />
                  )}

                  <button 
                    onClick={handleVerifyAndReset} 
                    disabled={isResetting}
                    className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-95 transition-all"
                  >
                    {isResetting ? "處理中..." : (resetStep === 1 ? "下一步" : "確認修改")}
                  </button>
                  
                  <button onClick={() => { setResetStep(0); setResetCode(''); setNewResetPwd(''); }} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600">
                    取消
                  </button>
               </div>
           </div>
        </div>
      )}

    </div>
  );
};