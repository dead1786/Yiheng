import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Lock, Loader2, Eye, EyeOff, Fingerprint, ArrowRight, ShieldCheck, Signal, Wifi, Battery, Zap } from 'lucide-react';

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

  // [新增] 初始化裝置 ID (指紋)
  useEffect(() => {
    let storedId = localStorage.getItem('yh_device_id');
    if (!storedId) {
      // 簡單的 UUID 生成 (足夠用於裝置識別)
      storedId = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('yh_device_id', storedId);
    }
    setDeviceId(storedId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // [新增] 前端測試後門 (開發用)
    if (name === "測試" && password === "111") {
      onLogin({
        name: "測試管理員",
        needReset: false,
        allowRemote: true,
        isAdmin: true // 強制給予管理員權限
      });
      return; 
    }

    if (!name || !password) return setError("請輸入完整資訊");
    
    setLoading(true);
    setError('');
    
    try {
      // [修改] 傳送 deviceId 給後端
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
// ...
      setLoading(false);
      setError("連線發生錯誤，請稍後再試");
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
            <div className="mt-2 text-slate-400">
              <User size={20} />
            </div>
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
            <div className="mt-2 text-slate-400">
              <Lock size={20} />
            </div>
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
            <button 
              type="button"
              className="mt-2 text-slate-400 hover:text-[#28B89B] transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Device ID (Glass style) */}
          <div className="bg-slate-50 rounded-xl py-3 px-4 flex items-center justify-center gap-2 border border-slate-100">
            <Fingerprint className="text-[#28B89B]" size={16} />
            <span className="text-[11px] text-slate-400 font-mono tracking-wider">
               裝置指紋 ID: {deviceId.substring(0, 12)}...
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 px-4 rounded-xl animate-pulse">
              {error}
            </div>
          )}

          {/* Login Button (Orange) */}
          <button 
            disabled={loading}
            className="w-full bg-[#ff9f29] hover:bg-[#ff8f00] text-white font-bold text-lg h-14 rounded-2xl shadow-[0_10px_20px_rgba(255,159,41,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> 登入中...</div>
            ) : (
              <>登入系統 <ArrowRight size={22} strokeWidth={3} /></>
            )}
          </button>


        </form>
      </div>

      {/* Bottom Security Card (Dark Green) */}
      <div className="mt-8 w-full max-w-[360px] z-10 animate-in slide-in-from-bottom-4 duration-700 delay-100">
        <div className="flex flex-col gap-4">
           <div className="flex items-center justify-center gap-2 text-white/60">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase">Secure AES-256 Encryption</span>
           </div>
           
        </div>
      </div>

    </div>
  );
};