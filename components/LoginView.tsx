import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Lock, Loader2, Smartphone } from 'lucide-react';

interface Props {
  onLogin: (user: any) => void;
}

export const LoginView = ({ onLogin }: Props) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');

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
      setLoading(false);
      setError("連線發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm animate-in fade-in duration-500">
        <div className="text-center mb-8">
          <div className="bg-blue-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-inner">
            <Lock size={40} />
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">益恆打卡系統</h1>
          <p className="text-gray-400 text-sm mt-1">請登入您的帳號</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="姓名"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400" size={20} />
            <input 
              type="password" 
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
            <Smartphone size={12} />
            <span>裝置綁定 ID: {deviceId.substring(0, 8)}...</span>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-bold bg-red-50 p-2 rounded-lg whitespace-pre-line">
              {error}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> 驗證中...</div> : "登入系統"}
          </button>
        </form>
      </div>
    </div>
  );
};