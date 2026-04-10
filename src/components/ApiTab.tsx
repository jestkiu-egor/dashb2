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
  ClipboardCheck,
  ChevronDown,
  Timer,
  AlertCircle,
  FileText,
  RefreshCw,
  Settings2,
  X
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
  const [keys, setKeys] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedKeyForLogs, setSelectedKeyForLogs] = useState<any>(null);
  const [keyLogs, setKeyLogs] = useState<any[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [checkFrequency, setCheckFrequency] = useState(30); // в минутах
  const [expandedCategories, setOpenCategories] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  
  const [categories, setCategories] = useState(['2code.MailAi', '2code.MailAssistant', '2code.TranslateAI']);
  const [newKey, setNewKey] = useState({
    name: '2code.MailAi',
    key: '',
    usageLocation: ''
  });

  const checkIntervalRef = useRef<any>(null);

  useEffect(() => {
    loadKeys();
    // Настройка интервала проверки
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
      // Собираем уникальные категории из базы
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
    if (isChecking) return;
    setIsChecking(true);
    console.log('🔄 Запуск плановой проверки ключей...');
    
    for (const k of keys) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${k.key_value}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Если ты тут - дай ответ ок" }],
            max_tokens: 5
          })
        });

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content?.toLowerCase() || '';
        
        if (content.includes('ок') || content.includes('ok')) {
          await db.updateKeyStatus(k.id, 'ok');
        } else {
          await db.updateKeyStatus(k.id, 'error', `Неверный ответ: ${content.substring(0, 100)}`);
        }
      } catch (err: any) {
        await db.updateKeyStatus(k.id, 'error', err.message || 'Ошибка сети');
      }
    }
    
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
      alert('Логи очищены');
    }
  };

  const handleAddCategory = () => {
    const name = prompt('Введите название нового модуля:');
    if (name && !categories.includes(name)) {
      setCategories(prev => [...prev, name]);
      setNewKey(prev => ({ ...prev, name }));
    }
  };

  return (
    <div className="space-y-6">
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
              <span className="text-[10px] text-slate-500 font-bold uppercase">Опрос каждые (мин)</span>
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
            className="p-3 bg-white/5 hover:bg-white/10 text-indigo-400 rounded-2xl border border-white/10 transition-all disabled:opacity-50"
            title="Проверить сейчас"
          >
            <RefreshCw size={20} className={cn(isChecking && "animate-spin")} />
          </button>
          <button onClick={() => setIsSeedModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold hover:bg-emerald-600 hover:text-white transition-all">
            <Database size={18} />
            <span>Импорт</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
            <Plus size={20} />
            <span>Добавить Ключ</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const catKeys = keys.filter(k => k.name === cat && (k.key_value.includes(searchTerm) || k.usage_location?.includes(searchTerm)));
          const isExpanded = expandedCategories.includes(cat);
          if (catKeys.length === 0 && !searchTerm) return null;

          return (
            <div key={cat} className="bg-slate-900/20 border border-white/5 rounded-3xl overflow-hidden">
              <button 
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl transition-transform duration-300", isExpanded ? "rotate-0" : "-rotate-90")}>
                    <ChevronDown size={20} className="text-slate-500" />
                  </div>
                  <h3 className="font-bold text-white tracking-wide">{cat}</h3>
                  <span className="px-2 py-0.5 bg-white/5 text-slate-500 text-[10px] font-bold rounded-lg border border-white/5">
                    {catKeys.length} ключей
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500/50" />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 grid grid-cols-1 gap-3">
                      {catKeys.map(k => (
                        <div key={k.id} className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-indigo-500/20 transition-all">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Индикатор статуса */}
                            <div 
                              className={cn(
                                "w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                                k.last_status === 'ok' ? "bg-emerald-500 shadow-emerald-500/40" : 
                                k.last_status === 'error' ? "bg-rose-500 shadow-rose-500/40" : "bg-slate-700"
                              )} 
                              title={k.last_check_at ? `Последняя проверка: ${format(new Date(k.last_check_at), 'HH:mm:ss')}` : 'Еще не проверялся'}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <code className="text-slate-300 text-xs font-mono truncate max-w-[300px]">{k.key_value}</code>
                                <button onClick={() => {navigator.clipboard.writeText(k.key_value); alert('Скопировано');}} className="text-slate-600 hover:text-white transition-colors"><Copy size={14} /></button>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase">{k.usage_location || 'Без описания'}</span>
                                {k.last_check_at && <span className="text-[9px] text-slate-600 font-mono italic">{format(new Date(k.last_check_at), 'HH:mm')}</span>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openLogs(k)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-all"
                            >
                              <FileText size={14} />
                              Логи
                            </button>
                            <button onClick={async () => { if(confirm('Удалить?')) { await db.deleteApiKey(k.id); loadKeys(); }}} className="p-2 text-slate-700 hover:text-red-400 transition-colors">
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

      {/* Модалки */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Новый ключ</h2>
                <button onClick={handleAddCategory} className="text-xs text-indigo-400 hover:underline">+ Создать модуль</button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); await db.addApiKey(project.id, { name: newKey.name, key: newKey.key, usageLocation: newKey.usageLocation }); loadKeys(); setIsModalOpen(false); }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Модуль</label>
                  <select value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none">
                    {categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>
                <input placeholder="Ключ gsk_..." value={newKey.key} onChange={e => setNewKey({...newKey, key: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" />
                <input placeholder="Где используется" value={newKey.usageLocation} onChange={e => setNewKey({...newKey, usageLocation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" />
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Сохранить</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Модалка Логов */}
        {isLogModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-[#020617] border border-white/10 rounded-3xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <FileText className="text-rose-400" />
                    История ошибок
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-1 truncate max-w-md">{selectedKeyForLogs?.key_value}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={clearLogs} className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-500 hover:text-white transition-all">Очистить БД</button>
                  <button onClick={() => setIsLogModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X /></button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {keyLogs.map((log, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 text-[10px] font-bold uppercase tracking-widest">Ошибка</span>
                      <span className="text-slate-600 text-[10px] font-mono">{format(new Date(log.created_at), 'dd.MM.yy HH:mm:ss')}</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed font-mono bg-black/20 p-2 rounded-lg border border-white/5">
                      {log.error_message}
                    </p>
                  </div>
                ))}
                {keyLogs.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-600">
                    <ShieldCheck size={48} className="mb-4 opacity-20" />
                    <p className="font-bold uppercase text-xs tracking-widest">Ошибок не зафиксировано</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
