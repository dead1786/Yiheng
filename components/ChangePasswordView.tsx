import React, { useState } from 'react';
import { api } from '../services/api';
import { KeyRound, Loader2 } from 'lucide-react';

// 遮罩
const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] bg-white/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
    <div className="bg-black/80 text-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-400 w-10 h-10" />
      <span className="font-bold tracking-widest text-lg">處理中...</span>
    </div>
  </div>
);

export const ChangePasswordView = ({ user, onPasswordChanged, onAlert }: any) => {
  const [newPwd, setNewPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(newPwd.length < 4) return onAlert("密碼至少 4 位數");

    setLoading(true); // 鎖定
    const res = await api.changePassword(user.name, newPwd);
    setLoading(false); // 解鎖
    
    if (res.success) {
      if(onPasswordChanged) onPasswordChanged(); // 讓 App.tsx 處理彈窗
    } else {
      onAlert(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      {loading && <LoadingOverlay />}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border-t-4 border-orange-500 animate-in zoom-in duration-300">
        <div className="flex justify-center mb-4 text-orange-500"><KeyRound size={48} /></div>
        <h2 className="text-xl font-bold text-center mb-2">請設定新密碼</h2>
        <p className="text-sm text-gray-500 text-center mb-6">為了帳號安全，首次登入需重設密碼。</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="text" 
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              className="w-full p-3 border rounded-xl text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="輸入新密碼"
              required
            />
            <p className="text-xs text-red-500 text-center mt-2 font-bold">* 密碼長度至少需 4 位數</p>
          </div>
          <button disabled={loading} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-lg shadow-orange-200">
            確認修改
          </button>
        </form>
      </div>
    </div>
  );
};