import { useState, useEffect, useRef } from 'react';
import { 
  Key as KeyIcon, 
  Plus, 
  Trash2, 
  Copy, 
  Search,
  ChevronRight,
  Database,
  ShieldCheck,
  ChevronDown,
  Timer,
  FileText,
  RefreshCw,
  X,
  Layers,
  Clock,
  ClipboardCheck,
  MessageSquare,
  Check
} from 'lucide-react';
import { Project, ApiKey } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/db';
import { format } from 'date-fns';

interface ApiTabProps {
  project: Project;
  onUpdateApiKeys: (projectId: string, keys: ApiKey[]) => void;
}

export const ApiTab = ({ project, onUpdateApiKeys }: ApiTabProps) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedKeyForLogs, setSelectedKeyForLogs] = useState<any>(null);
  const [keyLogs, setKeyLogs] = useState<any[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [checkFrequency, setCheckFrequency] = useState(30);
  const [expandedCategories, setOpenCategories] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkingKeyId, setCheckingKeyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [tempComment, setTempComment] = useState('');
  
  const [categories, setCategories] = useState(['2code.MailAi', '2code.MailAssistant', '2code.TranslateAI']);
  const [newKey, setNewKey] = useState({
    name: '2code.MailAi',
    key: '',
    usageLocation: '',
    comment: ''
  });

  const checkIntervalRef = useRef<any>(null);

  useEffect(() => {
    loadKeys();
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
      runHealthCheck();
    }, checkFrequency * 60000);

    return () => clearInterval(checkIntervalRef.current);
  }, [project.id, checkFrequency]);

  async function loadKeys() {
    const data = await db.fetchApiKeys(project.id);
    if (data) {
      setKeys(data);
      const uniqueCats = Array.from(new Set([...categories, ...data.map((k: any) => k.name)]));
      setCategories(uniqueCats);
    }
  }

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const runHealthCheck = async () => {
    if (isChecking || keys.length === 0) return;
    setIsChecking(true);
    
    for (const k of keys) {
      setCheckingKeyId(k.id);
      try {
        const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(groqUrl)}`;
        
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${k.key.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1
          })
        });

        const result = await response.json();

        if (!response.ok) {
          const errMsg = result.error?.message || result.error?.type || `Error ${response.status}`;
          await db.updateKeyStatus(k.id, 'error', errMsg);
          continue;
        }

        await db.updateKeyStatus(k.id, 'ok');
      } catch (err: any) {
        await db.updateKeyStatus(k.id, 'error', err.message);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    
    setCheckingKeyId(null);
    await loadKeys();
    setIsChecking(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openLogs = async (key: any) => {
    setSelectedKeyForLogs(key);
    const logs = await db.fetchKeyLogs(key.id);
    setKeyLogs(logs || []);
    setIsLogModalOpen(true);
  };

  const clearLogs = async () => {
    if (selectedKeyForLogs) {
      await db.clearKeyLogs(selectedKeyForLogs.id);
      setKeyLogs([]);
    }
  };

  const handleAddCategory = () => {
    const name = prompt('Введите название модуля:');
    if (name && !categories.includes(name)) {
      setCategories(prev => [...prev, name]);
    }
  };

  const handleBulkImport = async () => {
    if (!seedInput.trim()) return;
    const lines = seedInput.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const cleanKey = line.trim().replace(/^[, ]+|[, ]+$/g, '');
      if (cleanKey) {
        await db.addApiKey(project.id, { name: newKey.name, key: cleanKey, usageLocation: 'Bulk Import' });
      }
    }
    await loadKeys();
    setIsSeedModalOpen(false);
    setSeedInput('');
    alert('✅ Готово');
  };

  const handleUpdateComment = async (id: string) => {
    await db.updateApiKey(id, { comment: tempComment });
    setEditingCommentId(null);
    loadKeys();
  };

  const filteredKeys = keys.filter(k => 
    (k.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (k.key || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (k.usageLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (k.comment || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* УПРАВЛЕНИЕ */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-[24px] border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-white outline-none focus:border-indigo-500/50" />
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <Timer size={16} className="text-indigo-400" />
            <input type="number" value={checkFrequency} onChange={(e) => setCheckFrequency(parseInt(e.target.value) || 1)} className="bg-transparent text-white font-bold outline-none w-10 text-xs" />
            <span className="text-[10px] text-slate-500 uppercase font-bold">мин</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={runHealthCheck} disabled={isChecking} className={cn("p-2.5 rounded-xl border transition-all", isChecking ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400" : "bg-white/5 border-white/10 text-slate-400 hover:text-white")}><RefreshCw size={18} className={cn(isChecking && "animate-spin")} /></button>
          <button onClick={handleAddCategory} className="px-4 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl font-bold text-xs uppercase hover:bg-white/10 flex items-center gap-2"><Layers size={16} /> Блок</button>
          <button onClick={() => setIsSeedModalOpen(true)} className="px-4 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs uppercase hover:bg-emerald-600">Импорт</button>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-500 shadow-lg">+ Ключ</button>
        </div>
      </div>

      {/* ТАБЛИЧНЫЙ ЛИСТИНГ ПО КАТЕГОРИЯМ */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catKeys = filteredKeys.filter(k => k.name === cat);
          const isExpanded = expandedCategories.includes(cat);
          const errorCount = catKeys.filter(k => (k as any).last_status === 'error').length;
          if (catKeys.length === 0 && !searchTerm) return null;

          return (
            <div key={cat} className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <button onClick={() => toggleCategory(cat)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <ChevronDown size={18} className={cn("text-slate-500 transition-transform duration-300", isExpanded ? "rotate-0" : "-rotate-90")} />
                  <h3 className="font-bold text-white text-sm">{cat}</h3>
                  <div className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border", errorCount > 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                    {catKeys.length} / {errorCount}
                  </div>
                </div>
                {errorCount > 0 && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest animate-pulse">Issues Found</span>}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-950/20">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/5">
                          <th className="pl-12 py-2 w-10"></th>
                          <th className="py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Key</th>
                          <th className="py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Location</th>
                          <th className="py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Comment</th>
                          <th className="py-2 text-right pr-6 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {catKeys.map(k => (
                          <tr key={k.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="pl-12 py-2.5">
                              <div className={cn("w-2.5 h-2.5 rounded-full", 
                                checkingKeyId === k.id ? "bg-indigo-500 animate-pulse" :
                                (k as any).last_status === 'ok' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : 
                                (k as any).last_status === 'error' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" : "bg-slate-700")} 
                              />
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-3">
                                <code className="text-slate-300 text-[11px] font-mono truncate max-w-[300px]">{k.key}</code>
                                <button 
                                  onClick={() => handleCopy(k.key, k.id)} 
                                  className="text-slate-600 hover:text-white transition-colors p-1"
                                >
                                  {copiedId === k.id ? (
                                    <ClipboardCheck size={14} className="text-emerald-400 animate-in zoom-in duration-200" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="py-2.5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{k.usageLocation || 'Default'}</span>
                            </td>
                            <td className="py-2.5">
                              {editingCommentId === k.id ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    autoFocus
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white w-40 outline-none focus:border-indigo-500"
                                    value={tempComment}
                                    onChange={e => setTempComment(e.target.value)}
                                    onBlur={() => handleUpdateComment(k.id)}
                                    onKeyDown={e => e.key === 'Enter' && handleUpdateComment(k.id)}
                                  />
                                  <button onClick={() => handleUpdateComment(k.id)}><Check size={14} className="text-emerald-400" /></button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => { setEditingCommentId(k.id); setTempComment(k.comment || ''); }}
                                  className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/comment"
                                >
                                  <span className={cn(!k.comment && "italic opacity-40 text-[9px]")}>{k.comment || 'add comment...'}</span>
                                  <MessageSquare size={10} className="opacity-0 group-hover/comment:opacity-100 transition-opacity" />
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 text-right pr-6">
                              <div className="flex items-center justify-end gap-3">
                                {(k as any).last_check_at && <span className="text-[9px] text-slate-600 font-mono italic">{format(new Date((k as any).last_check_at), 'HH:mm')}</span>}
                                <button onClick={() => openLogs(k)} className={cn("px-2 py-1 rounded-md text-[9px] font-bold uppercase border transition-all", (k as any).last_status === 'error' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-white/5 border-white/5 text-slate-500 hover:text-white")}>Logs</button>
                                <button onClick={async () => { if(confirm('Удалить?')) { await db.deleteApiKey(k.id); loadKeys(); }}} className="p-1.5 text-slate-700 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Новый ключ</h2>
              <form onSubmit={async (e) => { e.preventDefault(); if(!newKey.key) return; await db.addApiKey(project.id, { name: newKey.name, key: newKey.key.trim(), usageLocation: newKey.usageLocation, comment: newKey.comment }); loadKeys(); setIsModalOpen(false); }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Модуль</label>
                  <select value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none">
                    {categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>
                <input placeholder="Ключ gsk_..." value={newKey.key} onChange={e => setNewKey({...newKey, key: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none font-mono" />
                <input placeholder="Локация использования" value={newKey.usageLocation} onChange={e => setNewKey({...newKey, usageLocation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" />
                <input placeholder="Комментарий" value={newKey.comment} onChange={e => setNewKey({...newKey, comment: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" />
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Сохранить</button>
              </form>
            </motion.div>
          </div>
        )}

        {isSeedModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSeedModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2">Массовый импорт</h2>
              <div className="space-y-6">
                <select value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none">
                  {categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
                <textarea value={seedInput} onChange={e => setSeedInput(e.target.value)} placeholder="Список ключей..." rows={10} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none font-mono text-xs resize-none" />
                <button onClick={handleBulkImport} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold">Импортировать</button>
              </div>
            </motion.div>
          </div>
        )}

        {isLogModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-[#020617] border border-white/10 rounded-3xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-3"><FileText className="text-rose-400" />Logs</h2>
                <div className="flex items-center gap-3">
                  <button onClick={clearLogs} className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest">Очистить БД</button>
                  <button onClick={() => setIsLogModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {keyLogs.map((log, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-rose-400 text-[10px] font-bold uppercase">Error</span>
                      <span className="text-slate-600 text-[10px] font-mono">{format(new Date(log.created_at), 'dd.MM.yy HH:mm:ss')}</span>
                    </div>
                    <p className="text-slate-300 text-sm font-mono bg-black/20 p-2 rounded-lg border border-white/5 whitespace-pre-wrap">{log.error_message}</p>
                  </div>
                ))}
                {keyLogs.length === 0 && <p className="text-center text-slate-600 py-10 uppercase text-xs font-bold tracking-widest">No errors</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
