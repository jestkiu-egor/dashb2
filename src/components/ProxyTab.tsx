import { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Copy, 
  RefreshCw, 
  ShieldCheck, 
  Save,
  Key as KeyIcon,
  ClipboardCheck,
  Timer,
  Clock
} from 'lucide-react';
import { Project, Proxy } from '../types';
import { differenceInDays, isValid, startOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/db';

interface ProxyTabProps {
  project: Project;
  onUpdateProxies: (proxies: Proxy[]) => void;
}

export const ProxyTab = ({ project, onUpdateProxies }: ProxyTabProps) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkFrequency, setCheckFrequency] = useState(12);
  const [newProxy, setNewProxy] = useState<Partial<Proxy>>({
    type: 'HTTPS',
    ip: '',
    port: '',
    login: '',
    passwordHash: '',
  });

  const checkIntervalRef = useRef<any>(null);

  useEffect(() => {
    async function loadSettings() {
      const key = await db.getSetting(project.id, 'px6_api_key');
      if (key) setApiKey(key);
    }
    loadSettings();

    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
      fetchProxyInfo();
    }, checkFrequency * 3600000);

    return () => clearInterval(checkIntervalRef.current);
  }, [project.id, checkFrequency]);

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      alert('Введите ключ');
      return;
    }
    setIsLoading(true);
    try {
      await db.saveSetting(project.id, 'px6_api_key', apiKey);
      alert('✅ Ключ сохранен. Синхронизирую...');
      fetchProxyInfo();
    } catch (err) {
      alert('❌ Ошибка сохранения');
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysLeft = (dateStr: Date | string) => {
    const targetDate = new Date(dateStr);
    if (!isValid(targetDate)) return 0;
    const days = differenceInDays(startOfDay(targetDate), startOfDay(new Date()));
    return days;
  };

  const getStatusColor = (days: number) => {
    if (days <= 0) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    if (days < 3) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    if (days < 7) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };

  const fetchProxyInfo = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    try {
      const proxyUrl = 'https://corsproxy.io/?';
      const apiUrl = encodeURIComponent(`https://px6.link/api/${apiKey}/getproxy`);
      const response = await fetch(proxyUrl + apiUrl);
      const data = await response.json();

      if (data.status === 'yes' && data.list) {
        const rawList = Object.values(data.list);
        const currentProjects = await db.fetchProjects();
        const currentProject = currentProjects.find(p => p.id === project.id);
        const currentProxies = currentProject?.proxies || [];

        for (const p: any of rawList) {
          const ipAddr = p.host || p.ip;
          const portStr = p.port.toString();
          const expirationDate = new Date(p.unixtime_end * 1000);
          const existing = currentProxies.find(ep => ep.ip === ipAddr && ep.port === portStr);

          if (existing) {
            await db.updateProxy(existing.id, { expiresAt: expirationDate });
          } else {
            await db.addProxy(project.id, {
              ip: ipAddr,
              port: portStr,
              login: p.user,
              passwordHash: p.pass,
              type: (p.type === 'socks' ? 'SOCKS5' : 'HTTPS') as any,
              expiresAt: expirationDate,
            });
          }
        }

        const refreshed = await db.fetchProjects();
        const refreshedProj = refreshed.find(p => p.id === project.id);
        if (refreshedProj) onUpdateProxies(refreshedProj.proxies);
        alert('✅ Синхронизация завершена');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProxy = async () => {
    if (newProxy.ip && newProxy.port) {
      await db.addProxy(project.id, {
        ...newProxy,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      } as any);
      const refreshed = await db.fetchProjects();
      const proj = refreshed.find(p => p.id === project.id);
      if (proj) onUpdateProxies(proj.proxies);
      setShowAddForm(false);
      setNewProxy({ type: 'HTTPS', ip: '', port: '', login: '', passwordHash: '' });
    }
  };

  const handleDeleteProxy = async (id: string) => {
    if (confirm('Удалить прокси?')) {
      await db.deleteProxy(id);
      onUpdateProxies((project.proxies || []).filter(p => p.id !== id));
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(`${type}-${text}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-white/10 p-6 rounded-[32px] backdrop-blur-2xl space-y-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-[20px] flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
              <KeyIcon size={28} />
            </div>
            <div>
              <h3 className="text-white font-bold text-2xl tracking-tight">API Интеграция</h3>
              <p className="text-slate-400 text-sm">Синхронизация данных с px6.link</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-950/50 px-6 py-3 rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all">
              <Timer size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Авто-опрос</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={checkFrequency}
                    onChange={(e) => setCheckFrequency(parseInt(e.target.value) || 1)}
                    className="bg-transparent text-white font-bold outline-none w-10 text-sm"
                  />
                  <span className="text-[10px] text-slate-600 font-bold uppercase">часов</span>
                </div>
              </div>
            </div>
            <button 
              onClick={fetchProxyInfo}
              disabled={isLoading || !apiKey}
              className={cn(
                "p-4 px-6 rounded-2xl border transition-all flex items-center gap-3 font-bold text-xs uppercase tracking-widest shadow-lg",
                isLoading ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400" : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
              )}
            >
              <RefreshCw size={20} className={cn(isLoading && "animate-spin")} />
              {isLoading ? 'Синхронизация...' : 'Обновить сейчас'}
            </button>
          </div>
        </div>
        
        <div className="flex gap-4">
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Введите секретный API ключ..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 font-mono text-sm shadow-inner"
          />
          <button 
            onClick={saveApiKey}
            disabled={isLoading}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3 disabled:opacity-50"
          >
            <Save size={20} />
            Сохранить
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Globe size={24} className="text-indigo-400" />
          Список прокси
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-2xl font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
        >
          <Plus size={20} />
          <span>Добавить вручную</span>
        </button>
      </div>

      {showAddForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 border border-white/10 p-6 rounded-3xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-3 gap-4 shadow-2xl">
          <input placeholder="IP Адрес" className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white" value={newProxy.ip} onChange={e => setNewProxy({...newProxy, ip: e.target.value})} />
          <input placeholder="Порт" className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white" value={newProxy.port} onChange={e => setNewProxy({...newProxy, port: e.target.value})} />
          <select className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={newProxy.type} onChange={e => setNewProxy({...newProxy, type: e.target.value as any})}>
            <option value="HTTPS" className="bg-slate-900">HTTPS</option>
            <option value="SOCKS5" className="bg-slate-900">SOCKS5</option>
          </select>
          <input placeholder="Логин" className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white" value={newProxy.login} onChange={e => setNewProxy({...newProxy, login: e.target.value})} />
          <input placeholder="Пароль" className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white" value={newProxy.passwordHash} onChange={e => setNewProxy({...newProxy, passwordHash: e.target.value})} />
          <button onClick={handleAddProxy} className="bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all py-3">Добавить в базу</button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(project.proxies || []).map((proxy) => {
          const daysLeft = getDaysLeft(proxy.expiresAt);
          const fullString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.passwordHash}`;
          
          return (
            <div key={proxy.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-6 group hover:border-indigo-500/30 transition-all shadow-lg hover:shadow-indigo-500/5">
              <div className="flex items-center gap-6 min-w-[400px]">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner border",
                  daysLeft <= 0 ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                )}>
                  <Globe size={28} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Host</span>
                    <button onClick={() => {handleCopy(proxy.ip, 'ip'); setCopiedId(`ip-${proxy.id}`);}} className="text-white font-mono font-bold hover:text-indigo-400 transition-colors flex items-center gap-2">
                      {proxy.ip}
                      <Copy size={12} className={cn("transition-opacity", copiedId === `ip-${proxy.id}` ? "opacity-100 text-emerald-400" : "opacity-0 group-hover:opacity-100")} />
                    </button>
                    <span className="text-slate-700">:</span>
                    <button onClick={() => {handleCopy(proxy.port, 'port'); setCopiedId(`p-${proxy.id}`);}} className="text-indigo-100 font-mono hover:text-indigo-400 transition-colors flex items-center gap-2">
                      {proxy.port}
                      <Copy size={12} className={cn("transition-opacity", copiedId === `p-${proxy.id}` ? "opacity-100 text-emerald-400" : "opacity-0 group-hover:opacity-100")} />
                    </button>
                    <span className="px-2.5 py-0.5 bg-white/5 text-slate-400 text-[10px] font-bold rounded-lg border border-white/5">{proxy.type}</span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase">User:</span>
                      <button onClick={() => {handleCopy(proxy.login, 'u'); setCopiedId(`u-${proxy.id}`);}} className="text-orange-400/80 font-mono hover:text-orange-300 transition-colors flex items-center gap-2">
                        {proxy.login}
                        <Copy size={12} className={cn("transition-opacity", copiedId === `u-${proxy.id}` ? "opacity-100 text-emerald-400" : "opacity-0 group-hover:opacity-100")} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase">Pass:</span>
                      <button onClick={() => {handleCopy(proxy.passwordHash, 'pw'); setCopiedId(`pw-${proxy.id}`);}} className="text-slate-300 font-mono hover:text-indigo-400 transition-colors flex items-center gap-2">
                        {proxy.passwordHash}
                        <Copy size={12} className={cn("transition-opacity", copiedId === `pw-${proxy.id}` ? "opacity-100 text-emerald-400" : "opacity-0 group-hover:opacity-100")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Осталось</div>
                  <div className={cn("flex items-center gap-2 text-base font-bold", getStatusColor(daysLeft))}>
                    <Clock size={18} />
                    {daysLeft}д
                  </div>
                </div>
                
                <div className="flex items-center gap-3 border-l border-white/5 pl-6">
                  {/* Кнопка "КОПИРОВАТЬ ВСЁ" */}
                  <button 
                    onClick={() => {handleCopy(fullString, 'all'); setCopiedId(`all-${proxy.id}`);}}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-lg group/all",
                      copiedId === `all-${proxy.id}` 
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-emerald-500/10" 
                        : "bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                    )}
                  >
                    {copiedId === `all-${proxy.id}` ? <ClipboardCheck size={20} /> : <Copy size={20} className="group-hover/all:scale-110 transition-transform" />}
                    <div className="flex flex-col items-start leading-tight">
                      <span className="uppercase tracking-tighter">{copiedId === `all-${proxy.id}` ? 'Скопировано' : 'Копировать'}</span>
                      <span className="text-[9px] opacity-60 font-normal">IP:PORT:USER:PASS</span>
                    </div>
                  </button>
                  
                  <button onClick={() => handleDeleteProxy(proxy.id)} className="p-3 text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-2xl transition-all">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {(!project.proxies || project.proxies.length === 0) && (
          <div className="text-center py-24 bg-slate-900/20 border border-dashed border-white/10 rounded-[40px]">
            <Globe size={64} className="mx-auto text-slate-800 mb-6" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Прокси отсутствуют</p>
          </div>
        )}
      </div>
    </div>
  );
};
