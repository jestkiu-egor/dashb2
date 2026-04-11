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
  Clock
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
  
  const [categories, setCategories] = useState(['2code.MailAi', '2code.MailAssistant', '2code.TranslateAI']);
  const [newKey, setNewKey] = useState({
    name: '2code.MailAi',
    key: '',
    usageLocation: ''
  });

  const checkIntervalRef = useRef<any>(null);

  useEffect(() => {
    loadKeys();
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
      runHealthCheck();
    }, checkFrequency * 60000);

    return () => clearInterval(checkIntervalRef.current);
  }, [project.id, checkFrequency, keys.length]);

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
        // Используем более надежный прокси для POST запросов
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
          const errMsg = result.error?.message || result.error?.type || `Ошибка сервера ${response.status}`;
          await db.updateKeyStatus(k.id, 'error', `Groq API Error: ${errMsg}`);
          continue;
        }

        // Если запрос прошел, значит ключ валиден
        await db.updateKeyStatus(k.id, 'ok');
        
      } catch (err: any) {
        console.error(`Check failed for ${k.id}:`, err);
        await db.updateKeyStatus(k.id, 'error', `Network/Proxy Error: ${err.message}`);
      }
      // Небольшая задержка между запросами, чтобы не спамить прокси
      await new Promise(r => setTimeout(r, 500));
    }
    
    setCheckingKeyId(null);
    await loadKeys();
    setIsChecking(false);
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
    const name = prompt('Введите название нового модуля:');
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
        await db.addApiKey(project.id, { 
          name: newKey.name, 
          key: cleanKey, 
          usageLocation: 'Массовый импорт' 
        });
      }
    }
    
    await loadKeys();
    setIsSeedModalOpen(false);
    setSeedInput('');
    alert('✅ Импорт завершен');
  };

  const filteredKeys = keys.filter(k => 
    (k.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (k.key || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (k.usageLocation || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Шапка управления */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Поиск ключей..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
            <Timer size={18} className="text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Опрос (мин)</span>
              <input 
                type="number" 
                value={checkFrequency}
                onChange={(e) => setCheckFrequency(parseInt(e.target.value) || 1)}
                className="bg-transparent text-white font-bold outline-none w-12 text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={runHealthCheck}
            disabled={isChecking}
            className={cn(
              "p-3 px-5 rounded-2xl border transition-all flex items-center gap-3 font-bold text-xs uppercase tracking-widest",
              isChecking ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            )}
          >
            <RefreshCw size={18} className={cn(isChecking && "animate-spin")} />
            {isChecking ? 'Проверка...' : 'Запустить опрос'}
          </button>
          
          <button 
            onClick={handleAddCategory}
            className="p-3 px-5 bg-white/5 text-slate-300 border border-white/10 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Layers size={18} />
            <span>+ Блок</span>
          </button>

          <button onClick={() => setIsSeedModalOpen(true)} className="p-3 px-5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2">
            <Database size={18} />
            <span>Импорт</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="p-3 px-5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
            <Plus size={20} />
            <span>Ключ</span>
          </button>
        </div>
      </div>

      {/* Список категорий */}
      <div className="space-y-4">
        {categories.map(cat => {
          const catKeys = filteredKeys.filter(k => k.name === cat);
          const isExpanded = expandedCategories.includes(cat);
          const errorCount = catKeys.filter(k => (k as any).last_status === 'error').length;
          const totalCount = catKeys.length;

          if (catKeys.length === 0 && !searchTerm) return null;

          return (
            <div key={cat} className="bg-slate-900/20 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl transition-transform duration-300", isExpanded ? "rotate-0" : "-rotate-90")}>
                    <ChevronDown size={20} className="text-slate-500" />
                  </div>
                  <h3 className="font-bold text-white tracking-wide text-lg">{cat}</h3>
                  {/* Статистика: Всего / Ошибки */}
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border transition-all",
                    errorCount > 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  )}>
                    <span className="opacity-60">Status:</span>
                    <span>{totalCount} / {errorCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {totalCount - errorCount > 0 && <div className="text-[9px] px-2 py-0.5 bg-emerald-500/5 text-emerald-500/40 rounded-md border border-emerald-500/10 font-bold uppercase tracking-widest">System Stable</div>}
                    {errorCount > 0 && <div className="text-[9px] px-2 py-0.5 bg-rose-500/5 text-rose-500/60 rounded-md border border-rose-500/10 font-bold uppercase tracking-widest animate-pulse">Attention Required</div>}
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-4 pt-0 grid grid-cols-1 gap-3">
                      {catKeys.map(k => (
                        <div key={k.id} className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-indigo-500/20 transition-all">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="relative">
                              <div className={cn("w-3.5 h-3.5 rounded-full transition-all duration-500", 
                                checkingKeyId === k.id ? "bg-indigo-500 animate-ping" :
                                (k as any).last_status === 'ok' ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : 
                                (k as any).last_status === 'error' ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]" : "bg-slate-700")} 
                              />
                              {checkingKeyId === k.id && <div className="absolute inset-0 bg-indigo-500 rounded-full animate-pulse" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <code className="text-slate-300 text-xs font-mono truncate max-w-[400px] select-all cursor-text">{k.key}</code>
                                <button onClick={() => {navigator.clipboard.writeText(k.key); alert('Скопировано');}} className="text-slate-600 hover:text-white transition-colors"><Copy size={14} /></button>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">{k.usageLocation || 'Default'}</span>
                                {(k as any).last_check_at && (
                                  <span className="text-[9px] text-slate-600 font-mono flex items-center gap-1">
                                    <Clock size={10} />
                                    {format(new Date((k as any).last_check_at), 'HH:mm:ss')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openLogs(k)} 
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                                (k as any).last_status === 'error' ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white" : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
                              )}
                            >
                              <FileText size={14} />
                              Logs
                            </button>
                            <button onClick={async () => { if(confirm('Удалить ключ?')) { await db.deleteApiKey(k.id); loadKeys(); }}} className="p-2 text-slate-700 hover:text-red-400 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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
              <h2 className="text-2xl font-bold text-white mb-6">Добавить API Ключ</h2>
              <form onSubmit={async (e) => { e.preventDefault(); if(!newKey.key) return; await db.addApiKey(project.id, { name: newKey.name, key: newKey.key.trim(), usageLocation: newKey.usageLocation }); loadKeys(); setIsModalOpen(false); }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Модуль</label>
                  <select value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none">
                    {categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>
                <input placeholder="Ключ gsk_..." value={newKey.key} onChange={e => setNewKey({...newKey, key: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none font-mono" />
                <input placeholder="Где используется (описание)" value={newKey.usageLocation} onChange={e => setNewKey({...newKey, usageLocation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" />
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all">Сохранить ключ</button>
              </form>
            </motion.div>
          </div>
        )}

        {isSeedModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSeedModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2">Массовый импорт</h2>
              <p className="text-slate-400 text-xs mb-6">Вставьте список ключей из сообщения (по одному в строке).</p>
              <div className="space-y-6">
                <select value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none font-bold">
                  {categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
                <textarea value={seedInput} onChange={e => setSeedInput(e.target.value)} placeholder="Вставьте ключи здесь..." rows={10} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none font-mono text-xs resize-none" />
                <button onClick={handleBulkImport} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg">Начать импорт</button>
              </div>
            </motion.div>
          </div>
        )}

        {isLogModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-[#020617] border border-white/10 rounded-3xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-3"><FileText className="text-rose-400" />История ошибок</h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-2 truncate max-w-md">ID: {selectedKeyForLogs?.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={clearLogs} className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest">Очистить БД</button>
                  <button onClick={() => setIsLogModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {keyLogs.map((log, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-rose-400 text-[10px] font-bold uppercase tracking-widest">API Rejection</span>
                      <span className="text-slate-600 text-[10px] font-mono">{format(new Date(log.created_at), 'dd.MM.yy HH:mm:ss')}</span>
                    </div>
                    <p className="text-slate-300 text-sm font-mono bg-black/20 p-3 rounded-lg border border-white/5 leading-relaxed">{log.error_message}</p>
                  </div>
                ))}
                {keyLogs.length === 0 && <p className="text-center text-slate-600 py-10 uppercase text-xs font-bold tracking-widest">Логи чисты</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
