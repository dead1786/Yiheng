import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, MessageSquare, MapPin, ClipboardList, LogOut, Plus, RefreshCw, Trash2, Edit2, FileText, X, Save, Unlock, Loader2, Unlink, FileSpreadsheet, Download, Clock } from 'lucide-react';

interface Props {
  onBack: () => void;
  onAlert: (msg: string) => void;
  onConfirm: (msg: string, onYes: () => void) => void;
  adminName: string;
}

const LoadingOverlay = ({text = "資料同步中..."}: {text?: string}) => (
  <div className="fixed inset-0 z-[9999] bg-white/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
    <div className="bg-black/80 text-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-400 w-10 h-10" />
      <span className="font-bold tracking-widest text-lg">{text}</span>
    </div>
  </div>
);

const ExportModal = ({ isOpen, onClose, onConfirm, adminName }: any) => {
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState<{name:string, label:string}[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.adminGetSheetList().then(res => {
        setLoading(false);
        if (res.success && res.list && res.list.length > 0) {
          setSheets(res.list);
          setSelectedSheet(res.list[0].name); 
        } else {
          setSheets([]); 
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="text-center mb-6">
          <div className="bg-green-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 text-green-600 shadow-inner">
            <FileSpreadsheet size={28} />
          </div>
          <h3 className="font-bold text-xl text-gray-800">匯出 Excel 報表</h3>
          <p className="text-sm text-gray-500 mt-1">請選擇要匯出的月份資料</p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400 flex flex-col items-center gap-2">
            <Loader2 className="animate-spin" /> 讀取選單中...
          </div>
        ) : (
          <div className="space-y-4">
             <div className="relative">
                <select 
                  value={selectedSheet} 
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                >
                  {sheets.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">▼</div>
             </div>
             
             <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 leading-relaxed">
                💡 系統將下載打卡紀錄。
             </div>

             <div className="flex gap-3 mt-4">
                <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">取消</button>
                <button 
                  onClick={() => onConfirm(selectedSheet)} 
                  disabled={!selectedSheet}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download size={18}/> 確認匯出
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

type DataType = 'staff' | 'line' | 'location' | 'record' | 'log' | 'shift';
interface DataSection { headers: string[]; list: any[]; }
interface AllData { staff: DataSection; line: DataSection; location: DataSection; record: DataSection; log: DataSection; shift: DataSection; }

export const AdminDashboardView = ({ onBack, onAlert, onConfirm, adminName }: Props) => {
  const [activeTab, setActiveTab] = useState<DataType>('record');
  
  const [allData, setAllData] = useState<AllData>(() => {
    try { return JSON.parse(localStorage.getItem('admin_cache_all') || '{}'); } catch { return {}; }
  });
  
  const [isBlocking, setIsBlocking] = useState(false); 
  const [blockText, setBlockText] = useState("資料同步中...");
  const [isFetching, setIsFetching] = useState(false); 
  const [showExport, setShowExport] = useState(false);

  // Staff Form
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', password: '123', lineId: '', needReset: 'TRUE', allowRemote: 'FALSE', shift: '' });
  
  // Location Form
  const [newLoc, setNewLoc] = useState({ name: '', lat: '', lng: '', radius: '500' });

  // Shift Form
  const [newShift, setNewShift] = useState({ name: '', start: '09:00', end: '18:00' });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async (showLoading = false) => {
    if (showLoading) { setBlockText("資料同步中..."); setIsBlocking(true); } 
    else setIsFetching(true); 

    const res = await api.adminGetData('all');
    
    if (showLoading) setIsBlocking(false);
    else setIsFetching(false);

    if (res.success && res.allData) {
      setAllData(res.allData);
      localStorage.setItem('admin_cache_all', JSON.stringify(res.allData));
    } else {
      if (showLoading) onAlert("資料載入失敗");
    }
  };

  const handleDownloadExcel = async (sheetName: string) => {
    setShowExport(false);
    setBlockText(`正在生成報表：${sheetName}...`);
    setIsBlocking(true);
    
    try {
      const res = await api.adminDownloadExcel(adminName, sheetName);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        onAlert("✅ 報表已生成，正在下載...");
      } else {
        onAlert(res.message || "下載失敗");
      }
    } catch (e) {
      onAlert("發生錯誤");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.lat || !newLoc.lng) return onAlert("請填寫完整資訊");
    setBlockText("新增中...");
    setIsBlocking(true);
    const res = await api.adminUpdateLocation({ ...newLoc, op: 'add', adminName });
    setIsBlocking(false);
    if (res.success) {
      onAlert("地點新增成功！");
      setNewLoc({ name: '', lat: '', lng: '', radius: '500' });
      fetchAllData(false); 
    } else { onAlert("新增失敗"); }
  };

  const handleAddShift = async () => {
    if (!newShift.name || !newShift.start || !newShift.end) return onAlert("請填寫完整資訊");
    setBlockText("新增班別中...");
    setIsBlocking(true);
    const res = await api.adminUpdateShift({ ...newShift, op: 'add', adminName });
    setIsBlocking(false);
    if (res.success) {
      onAlert("班別新增成功！");
      setNewShift({ name: '', start: '09:00', end: '18:00' });
      fetchAllData(false); 
    } else { onAlert("新增失敗"); }
  };

  const handleDeleteShift = (name: string) => {
    onConfirm(`確定要刪除班別 [${name}] 嗎？`, async () => {
        setBlockText("刪除中...");
        setIsBlocking(true);
        const res = await api.adminUpdateShift({ op: 'delete', targetName: name, adminName });
        setIsBlocking(false);
        if(res.success) { onAlert("刪除成功"); fetchAllData(false); }
        else { onAlert(res.message); }
    });
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name || !staffForm.password) return onAlert("姓名與密碼必填");
    setBlockText("儲存中...");
    setIsBlocking(true);
    const op = isAddingStaff ? 'add' : 'edit';
    const payload = { op, adminName, oldName: editingStaff ? editingStaff[0] : null, newData: staffForm };
    const res = await api.adminUpdateStaff(payload);
    setIsBlocking(false);
    if (res.success) {
      onAlert(isAddingStaff ? "新增成功" : "更新成功");
      setIsAddingStaff(false);
      setEditingStaff(null);
      fetchAllData(false); 
    } else { onAlert(res.message); }
  };

  const handleDeleteStaff = (name: string) => {
    onConfirm(`確定要刪除員工 [${name}] 嗎？此動作無法復原。`, async () => {
      setBlockText("刪除中...");
      setIsBlocking(true);
      const res = await api.adminUpdateStaff({ op: 'delete', targetName: name, adminName });
      setIsBlocking(false);
      if (res.success) { onAlert("刪除成功"); fetchAllData(false); } 
      else { onAlert(res.message); }
    });
  };

  const handleUnlockStaff = (name: string) => {
    onConfirm(`確定要解除 [${name}] 的鎖定狀態嗎？`, async () => {
      setBlockText("解鎖中...");
      setIsBlocking(true);
      const res = await api.adminUnlockStaff(name, adminName);
      setIsBlocking(false);
      if (res.success) { onAlert("解鎖成功"); fetchAllData(false); }
      else { onAlert(res.message); }
    });
  };

  const handleUnbindStaff = (name: string) => {
    onConfirm(`確定要解除 [${name}] 的裝置綁定嗎？`, async () => {
      setBlockText("解綁中...");
      setIsBlocking(true);
      const res = await api.adminUpdateStaff({ op: 'unbind', targetName: name, adminName });
      setIsBlocking(false);
      if (res.success) { onAlert("解綁成功！"); fetchAllData(false); }
      else { onAlert(res.message); }
    });
  };

  const openEditStaff = (row: any[]) => {
    setStaffForm({ 
        name: row[0], 
        password: row[1], 
        lineId: row[2], 
        needReset: row[3], 
        allowRemote: row[4],
        shift: row[7] || "" 
    });
    setEditingStaff(row);
    setIsAddingStaff(false);
  };

  const openAddStaff = () => {
    setStaffForm({ name: '', password: '123', lineId: '', needReset: 'TRUE', allowRemote: 'FALSE', shift: '' });
    setIsAddingStaff(true);
    setEditingStaff(null);
  };

  const currentData = allData[activeTab] || { headers: [], list: [] };

  const tabs = [
    { id: 'record', label: '打卡紀錄', icon: <ClipboardList size={18} /> },
    { id: 'staff', label: '員工管理', icon: <Users size={18} /> },
    { id: 'shift', label: '班別設定', icon: <Clock size={18} /> },
    { id: 'line', label: 'LINE ID', icon: <MessageSquare size={18} /> },
    { id: 'location', label: '地點設置', icon: <MapPin size={18} /> },
    { id: 'log', label: '操作紀錄', icon: <FileText size={18} /> },
  ];

  const getCellStyle = (headerName: string) => {
    if (!headerName) return "max-w-[150px] truncate";
    if (headerName.includes("時間戳記") || headerName.includes("User ID") || headerName.includes("GPS") || headerName.includes("時間")) {
      return "whitespace-nowrap min-w-fit"; 
    }
    return "max-w-[150px] truncate";
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {isBlocking && <LoadingOverlay text={blockText} />}
      
      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} onConfirm={handleDownloadExcel} adminName={adminName} />

      <div className="bg-gray-800 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold flex items-center gap-2">🛡️ 管理員後台 <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">{adminName}</span></h1>
        <div className="flex items-center gap-2">
          {isFetching && <div className="text-xs text-green-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> 背景同步中...</div>}
          <button onClick={() => setShowExport(true)} className="bg-green-600 p-2 rounded-lg hover:bg-green-500 text-sm flex items-center gap-1 font-bold shadow-sm transition active:scale-95" title="下載打卡報表"><FileSpreadsheet size={16} /> 匯出 Excel</button>
          <button onClick={() => fetchAllData(true)} className="bg-gray-700 p-2 rounded-lg hover:bg-gray-600 text-sm flex items-center gap-1" title="強制刷新"><RefreshCw size={16} /></button>
          <button onClick={onBack} className="bg-gray-700 p-2 rounded-lg hover:bg-gray-600 text-sm flex items-center gap-1"><LogOut size={16} /> 返回</button>
        </div>
      </div>

      <div className="bg-white shadow p-2 flex overflow-x-auto gap-2 sticky top-16 z-10">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setIsAddingStaff(false); setEditingStaff(null); }} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          
          {/* Staff Tab Header - 修正：總是顯示 */}
          {activeTab === 'staff' && (
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <span className="text-sm text-gray-500 font-bold">員工列表</span>
              <button onClick={openAddStaff} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 hover:bg-green-700"><Plus size={16}/> 新增</button>
            </div>
          )}

          {/* Staff Edit Form - 修正：改為彈出視窗 */}
          {(isAddingStaff || editingStaff) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  
                  {/* Modal Header */}
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                     <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                       {isAddingStaff ? 
                         <div className="bg-green-100 p-2 rounded-full text-green-600"><Plus size={24}/></div> : 
                         <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Edit2 size={24}/></div>
                       }
                       {isAddingStaff ? "新增員工" : "編輯員工"}
                     </h3>
                     <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-full">
                       <X size={24} />
                     </button>
                  </div>

                  {/* Form Content */}
                  <div className="grid grid-cols-1 gap-4 mb-6">
                    <div>
                        <label className="text-sm font-bold text-gray-500 mb-1 block">姓名</label>
                        <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                               value={staffForm.name} 
                               onChange={e=>setStaffForm({...staffForm, name: e.target.value})} 
                               placeholder="輸入姓名" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-500 mb-1 block">密碼</label>
                        <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                               value={staffForm.password} 
                               onChange={e=>setStaffForm({...staffForm, password: e.target.value})} 
                               placeholder={!isAddingStaff ? "不修改請留空 (******)" : "預設密碼"} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-1 block">LINE ID</label>
                            <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                                   value={staffForm.lineId} 
                                   onChange={e=>setStaffForm({...staffForm, lineId: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-1 block">班別</label>
                            <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                                   value={staffForm.shift} 
                                   onChange={e=>setStaffForm({...staffForm, shift: e.target.value})} 
                                   placeholder="例如：早班" />
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <label className="text-sm font-bold text-gray-500 mb-3 block">帳號權限設定</label>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                                   checked={staffForm.needReset === 'TRUE'} 
                                   onChange={e=>setStaffForm({...staffForm, needReset: e.target.checked?'TRUE':'FALSE'})} /> 
                            <span className="text-gray-700 font-medium group-hover:text-blue-600 transition">下次登入需重設密碼</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                                   checked={staffForm.allowRemote === 'TRUE'} 
                                   onChange={e=>setStaffForm({...staffForm, allowRemote: e.target.checked?'TRUE':'FALSE'})} /> 
                            <span className="text-gray-700 font-medium group-hover:text-blue-600 transition">允許遠端打卡 (免 GPS 檢查)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="flex gap-3">
                    <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">取消</button>
                    <button onClick={handleSaveStaff} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2"><Save size={18}/> 儲存變更</button>
                  </div>

                </div>
              </div>
          )}

          {/* Location Tab Header */}
          {activeTab === 'location' && (
            <div className="p-4 bg-blue-50 border-b border-blue-100 grid gap-3">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Plus size={16}/> 新增地點</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input placeholder="地點名稱" className="p-2 border rounded" value={newLoc.name} onChange={e=>setNewLoc({...newLoc, name: e.target.value})} />
                <input placeholder="誤差(m)" className="p-2 border rounded" value={newLoc.radius} onChange={e=>setNewLoc({...newLoc, radius: e.target.value})} />
                <input placeholder="緯度" className="p-2 border rounded" value={newLoc.lat} onChange={e=>setNewLoc({...newLoc, lat: e.target.value})} />
                <input placeholder="經度" className="p-2 border rounded" value={newLoc.lng} onChange={e=>setNewLoc({...newLoc, lng: e.target.value})} />
              </div>
              <button onClick={handleAddLocation} className="bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 w-full md:w-auto">確認新增</button>
            </div>
          )}

          {/* Shift Tab Header */}
          {activeTab === 'shift' && (
            <div className="p-4 bg-blue-50 border-b border-blue-100 grid gap-3">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Plus size={16}/> 新增班別</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input placeholder="班別名稱 (例如：早班)" className="p-2 border rounded" value={newShift.name} onChange={e=>setNewShift({...newShift, name: e.target.value})} />
                <input type="time" placeholder="上班時間" className="p-2 border rounded" value={newShift.start} onChange={e=>setNewShift({...newShift, start: e.target.value})} />
                <input type="time" placeholder="下班時間" className="p-2 border rounded" value={newShift.end} onChange={e=>setNewShift({...newShift, end: e.target.value})} />
              </div>
              <button onClick={handleAddShift} className="bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 w-full md:w-auto">確認新增</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  {currentData.headers.length > 0 ? currentData.headers.map((h: string, i: number) => <th key={i} className="px-4 py-3 whitespace-nowrap bg-gray-100 sticky top-0">{h}</th>) : <th>欄位</th>}
                  {(activeTab === 'staff' || activeTab === 'shift') && <th className="px-4 py-3 text-right bg-gray-100 sticky top-0">管理</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentData.list.length > 0 ? currentData.list.map((row: any[], i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {row.map((cell:string, j:number) => (
                      <td key={j} className={`px-4 py-3 ${getCellStyle(currentData.headers[j])} ${cell==="🔒已鎖定" ? "text-red-600 font-bold bg-red-50" : ""} ${cell==="📱已綁定" ? "text-green-600 font-bold" : ""}`} title={cell}>
                        {cell}
                      </td>
                    ))}
                    {activeTab === 'staff' && (
                      <td className="px-4 py-3 flex justify-end gap-2 items-center">
                        {row.includes("📱已綁定") && (
                           <button onClick={()=>handleUnbindStaff(row[0])} className="p-1.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded flex items-center gap-1 text-xs font-bold" title="解除裝置綁定"><Unlink size={14}/> 解綁</button>
                        )}
                        {row.includes("🔒已鎖定") && (
                           <button onClick={()=>handleUnlockStaff(row[0])} className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded flex items-center gap-1 text-xs font-bold" title="解鎖"><Unlock size={14}/> 解鎖</button>
                        )}
                        <button onClick={()=>openEditStaff(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="編輯"><Edit2 size={16}/></button>
                        <button onClick={()=>handleDeleteStaff(row[0])} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="刪除"><Trash2 size={16}/></button>
                      </td>
                    )}
                    {activeTab === 'shift' && (
                      <td className="px-4 py-3 flex justify-end gap-2 items-center">
                        <button onClick={()=>handleDeleteShift(row[0])} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="刪除"><Trash2 size={16}/></button>
                      </td>
                    )}
                  </tr>
                )) : <tr><td className="p-8 text-center text-gray-400" colSpan={currentData.headers.length + 1}>目前沒有資料</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};