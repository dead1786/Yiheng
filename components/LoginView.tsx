import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Lock, Loader2, Eye, EyeOff, Fingerprint, ArrowRight, ShieldCheck, KeyRound, MessageSquare, Undo2, CheckCircle2 } from 'lucide-react';

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
  
  // [修改] 忘記密碼流程狀態: 0=正常登入, 1=輸入驗證碼, 2=輸入新密碼
  const [resetStep, setResetStep] = useState(0); 
  const [cooldown, setCooldown] = useState(0);
  const [resetCode, setResetCode] = useState('');
  const [newResetPwd, setNewResetPwd] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // 裝置 ID 初始化
    let storedId = localStorage.getItem('yh_device_id');
    if (!storedId) {
      storedId = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('yh_device_id', storedId);
    }
    setDeviceId(storedId);

    // 倒數計時初始化
    const target = localStorage.getItem('reset_cool_target');
    if (target) {
      const left = Math.ceil((parseInt(target) - Date.now()) / 1000);
      if (left > 0) setCooldown(left);
    }
  }, []);

  // 倒數計時器
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 一般登入
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
            isAdmin: res.isAdmin,
            isSupervisor: res.isSupervisor, 
            regions: res.regions,      
            shift: res.shift 
        });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setLoading(false);
      setError("連線發生錯誤，請稍後再試");
    }
  };

  // 步驟 1: 發送驗證碼
  const handleRequestReset = async () => {
    if (!name) return setError("請先在上方輸入您的「姓名」");
    setError('');
    setIsResetting(true);
    const res = await api.requestReset(name);
    setIsResetting(false);
    
    if (res.success) {
      setResetStep(1); // 進入輸入驗證碼畫面
      setCooldown(600); // 10分鐘
      localStorage.setItem('reset_cool_target', (Date.now() + 600 * 1000).toString());
    } else {
      setError(res.message);
    }
  };

  // 步驟 2: 檢查驗證碼 (不改密碼，只檢查)
  const handleCheckCode = async () => {
    if (!resetCode) return setError("請輸入驗證碼");
    setIsResetting(true);
    const res = await api.checkResetCode(name, resetCode);
    setIsResetting(false);

    if (res.success) {
        setResetStep(2); // 驗證成功，進入新密碼畫面
        setError('');
    } else {
        setError(res.message); // 驗證失敗，直接顯示錯誤
    }
  };

  // 步驟 3: 確認重設密碼
  const handleFinalReset = async () => {
    if (!newResetPwd) return setError("請輸入新密碼");
    if (!/^[1-9]\d{3,}$/.test(newResetPwd)) return setError("密碼需為至少 4 位數字，且開頭不為 0");

    setIsResetting(true);
    const res = await api.verifyReset(name, resetCode, newResetPwd);
    setIsResetting(false);

    if (res.success) {
        alert(res.message);
        // 重置所有狀態回登入頁
        setResetStep(0);
        setPassword('');
        setResetCode('');
        setNewResetPwd('');
        setError('');
    } else {
        setError(res.message);
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
      <div className="w-full max-w-[360px] bg-white rounded-[2rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] p-8 z-10 animate-in zoom-in duration-500 relative transition-all">
        
        {/* === 0. 正常登入模式 === */}
        {resetStep === 0 && (
          <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Name Input */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 focus-within:ring-2 focus-within:ring-[#28B89B]/50 transition-all">
              <div className="mt-2 text-slate-400"><User size={20} /></div>
              <div className="flex-1">
                 <label className="block text-xs font-bold text-slate-500 mb-0.5">姓名</label>
                 <input className="w-full bg-transparent border-none p-0 text-slate-800 font-bold placeholder:text-slate-300 placeholder:font-normal focus:ring-0 outline-none text-base" 
                    placeholder="請輸入姓名" type="text" value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>

            {/* Password Input */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 focus-within:ring-2 focus-within:ring-[#28B89B]/50 transition-all">
              <div className="mt-2 text-slate-400"><Lock size={20} /></div>
              <div className="flex-1">
                 <label className="block text-xs font-bold text-slate-500 mb-0.5">密碼</label>
                 <input className="w-full bg-transparent border-none p-0 text-slate-800 font-bold placeholder:text-slate-300 placeholder:font-normal focus:ring-0 outline-none text-base" 
                    placeholder="請輸入您的密碼" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="button" className="mt-2 text-slate-400 hover:text-[#28B89B]" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Error & Device ID */}
            {error && <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 px-4 rounded-xl animate-pulse">{error}</div>}
            
            <div className="bg-slate-50 rounded-xl py-2 px-4 flex items-center justify-center gap-2 border border-slate-100">
              <Fingerprint className="text-[#28B89B]" size={14} />
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">ID: {deviceId.substring(0, 8)}...</span>
            </div>

            {/* Buttons */}
            <button disabled={loading} className="w-full bg-[#ff9f29] hover:bg-[#ff8f00] text-white font-bold text-lg h-14 rounded-2xl shadow-[0_10px_20px_rgba(255,159,41,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="animate-spin" /> 登入中...</> : <>登入系統 <ArrowRight size={22} strokeWidth={3} /></>}
            </button>
            
            <div className="text-center flex flex-col gap-3 mt-4">
               {/* 發送驗證碼按鈕 */}
               <button type="button" onClick={handleRequestReset} disabled={isResetting || cooldown > 0} 
                 className={`text-sm font-bold transition-colors underline decoration-dotted underline-offset-4 ${cooldown > 0 ? 'text-slate-300 cursor-not-allowed decoration-transparent' : 'text-slate-400 hover:text-[#28B89B]'}`}>
                 {isResetting ? "處理中..." : (cooldown > 0 ? `請等待 ${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, '0')} 後再試` : "忘記密碼？")}
               </button>
               
               {/* [新增] 回到輸入驗證碼按鈕 (只在倒數期間顯示) */}
               {cooldown > 0 && (
                 <button type="button" onClick={() => setResetStep(1)} className="text-sm font-bold text-[#28B89B] hover:text-[#1e8f78] transition-colors flex items-center justify-center gap-1 animate-in fade-in slide-in-from-bottom-2">
                   <MessageSquare size={16}/> 我已收到驗證碼，前往輸入
                 </button>
               )}
            </div>
          </form>
        )}

        {/* === 1. 輸入驗證碼模式 === */}
        {resetStep === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="text-center mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-2"><MessageSquare size={24}/></div>
                <h3 className="font-bold text-lg text-slate-700">輸入驗證碼</h3>
                <p className="text-xs text-slate-400">已發送至 {name} 的 LINE</p>
             </div>

             <div className="bg-slate-50 border-2 border-blue-100 rounded-2xl p-2">
                <input autoFocus className="w-full bg-transparent border-none text-center text-3xl font-black tracking-[0.5em] text-slate-800 placeholder:text-slate-200 focus:ring-0 outline-none h-14" 
                   placeholder="0000" maxLength={4} value={resetCode} onChange={e => setResetCode(e.target.value)} />
             </div>

             {error && <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 px-4 rounded-xl animate-pulse">{error}</div>}

             <button onClick={handleCheckCode} disabled={isResetting} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg h-14 rounded-2xl shadow-[0_10px_20px_rgba(59,130,246,0.3)] transition-all active:scale-[0.98]">
               {isResetting ? "驗證中..." : "下一步"}
             </button>

             <button onClick={() => {setResetStep(0); setError('');}} className="w-full py-2 text-slate-400 font-bold text-sm flex items-center justify-center gap-1 hover:text-slate-600">
               <Undo2 size={16}/> 返回登入
             </button>
          </div>
        )}

        {/* === 2. 輸入新密碼模式 === */}
        {resetStep === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="text-center mb-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-500 mb-2"><KeyRound size={24}/></div>
                <h3 className="font-bold text-lg text-slate-700">設定新密碼</h3>
                <p className="text-xs text-slate-400">驗證成功，請設定您的新密碼</p>
             </div>

             <div className="bg-slate-50 border-2 border-green-100 rounded-2xl p-3">
                <label className="block text-xs font-bold text-slate-500 mb-1 text-center">新密碼 (至少4位數字)</label>
                <input autoFocus className="w-full bg-transparent border-none text-center text-xl font-bold text-slate-800 placeholder:text-slate-300 focus:ring-0 outline-none" 
                   placeholder="輸入新密碼" type="text" value={newResetPwd} onChange={e => setNewResetPwd(e.target.value)} />
             </div>

             {error && <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 px-4 rounded-xl animate-pulse">{error}</div>}

             <button onClick={handleFinalReset} disabled={isResetting} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg h-14 rounded-2xl shadow-[0_10px_20px_rgba(34,197,94,0.3)] transition-all active:scale-[0.98]">
               {isResetting ? "設定中..." : "確認修改"}
             </button>

             <button onClick={() => {setResetStep(0); setError('');}} className="w-full py-2 text-slate-400 font-bold text-sm flex items-center justify-center gap-1 hover:text-slate-600">
               取消
             </button>
          </div>
        )}

      </div>

      <div className="mt-8 w-full max-w-[360px] z-10 animate-in slide-in-from-bottom-4 duration-700 delay-100">
        <div className="flex items-center justify-center gap-2 text-white/60">
           <ShieldCheck size={14} />
           <span className="text-[10px] font-bold tracking-[0.1em] uppercase">Secure AES-256 Encryption</span>
        </div>
      </div>

    </div>
  );
};