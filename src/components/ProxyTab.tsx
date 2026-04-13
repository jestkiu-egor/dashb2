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
  Clock,
  Wallet,
  Coins
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
  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  
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
      if (key) {
        setApiKey(key);
        silentUpdate(key);
      }
    }
    loadSettings();

    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
      fetchProxyInfo();
    }, checkFrequency * 3600000);

    return () => clearInterval(checkIntervalRef.current);
  }, [project.id, checkFrequency]);

  const silentUpdate = async (key: string) => {
    try {
      const targetUrl = `https://px6.link/api/${key}/getproxy?_t=${Date.now()}`;
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (data.status === 'yes') {
        setBalance(data.balance);
        setCurrency(data.currency);
      }
    } catch (e) {}
  };

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
    if (days <= 0) return 'text-rose-500';
    if (days < 3) return 'text-orange-400';
    if (days < 7) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const fetchProxyInfo = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    try {
      const targetUrl = `https://px6.link/api/${apiKey}/getproxy?_t=${Date.now()}`;
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const data = await response.json();

      if (data.status === 'yes' && data.list) {
        setBalance(data.balance);
        setCurrency(data.currency);
        
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
        alert(`✅ Готово!\nБаланс: ${data.balance} ${data.currency}`);
      } else {
        alert(`Ошибка API: ${data.error || 'Неверный ответ'}`);
      }
    } catch (error: any) {
      console.error(error);
      alert('Ошибка при синхронизации.');
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
      <div className="bg-slate-900/60 border border-white/10 p-8 rounded-[32px] backdrop-blur-2xl space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -mr-32 -mt-32" />
        
        <div className="flex flex-wrap items-start justify-between gap-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-[22px] flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
              <KeyIcon size={32} />
            </div>
            <div>
              <h3 className="text-white font-bold text-2xl tracking-tight uppercase tracking-widest">Proxy Интеграция</h3>
              <p className="text-slate-400 text-sm mt-1">Авто-синхронизация с сервисом px6.link</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* УЛУЧШЕННЫЙ ВИДЖЕТ БАЛАНСА (Виден всегда, если есть данные) */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-lg shadow-emerald-500/5 min-w-[180px]">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                <Coins size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-[0.1em]">Ваш баланс</span>
                <span className="text-xl font-black text-emerald-400 leading-none mt-1">
                  {balance || '0.00'} <span className="text-xs font-bold opacity-60 uppercase">{currency || 'RUB'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/50 px-5 py-3 rounded-2xl border border-white/5">
              <Timer size={18} className="text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Опрос</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={checkFrequency} onChange={(e) => setCheckFrequency(parseInt(e.target.value) || 1)} className="bg-transparent text-white font-bold outline-none w-8 text-xs" />
                  <span className="text-[9px] text-slate-600 font-bold uppercase">ч</span>
                </div>
              </div>
            </div>

            <button 
              onClick={fetchProxyInfo} 
              disabled={isLoading || !apiKey} 
              className={cn(
                "p-4 px-8 rounded-2xl border transition-all font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-3 shadow-xl",
                isLoading ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400" : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
              <span>{isLoading ? '...' : 'Обновить'}</span>
            </button>
          </div>
        </div>
        
        <div className="flex gap-4 relative z-10">
          <div className="relative flex-1">
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder="Введите секретный API ключ для px6.link..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 font-mono text-sm shadow-inner transition-all" 
            />
          </div>
          <button onClick={saveApiKey} disabled={isLoading} className="px-10 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95">
            <Save size={20} className="text-indigo-400" />
            <span>Сохранить ключ</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[32px] overflow-hidden backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.01]">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-tight">
            <Globe size={20} className="text-indigo-400" />
            Список активных прокси
          </h2>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all text-xs uppercase tracking-widest">
            <Plus size={16} />
            <span>Добавить</span>
          </button>
        </div>

        {showAddForm && (
          <div className="p-6 bg-slate-950/50 border-b border-white/5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-in fade-in slide-in-from-top-4">
            <input placeholder="IP" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm" value={newProxy.ip} onChange={e => setNewProxy({...newProxy, ip: e.target.value})} />
            <input placeholder="Порт" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm" value={newProxy.port} onChange={e => setNewProxy({...newProxy, port: e.target.value})} />
            <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none" value={newProxy.type} onChange={e => setNewProxy({...newProxy, type: e.target.value as any})}>
              <option value="HTTPS" className="bg-slate-900">HTTPS</option>
              <option value="SOCKS5" className="bg-slate-900">SOCKS5</option>
            </select>
            <input placeholder="Логин" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm" value={newProxy.login} onChange={e => setNewProxy({...newProxy, login: e.target.value})} />
            <input placeholder="Пароль" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm" value={newProxy.passwordHash} onChange={e => setNewProxy({...newProxy, passwordHash: e.target.value})} />
            <button onClick={handleAddProxy} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 text-xs py-2 uppercase">Создать</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Адрес / Host</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Авторизация</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Тип</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Срок</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {(project.proxies || []).map((proxy) => {
                const daysLeft = getDaysLeft(proxy.expiresAt);
                const fullString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.passwordHash}`;
                
                return (
                  <tr key={proxy.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", daysLeft <= 0 ? "bg-rose-500 shadow-rose-500/40" : "bg-emerald-500 shadow-emerald-500/40")} />
                        <div className="flex items-center font-mono text-xs font-bold text-white">
                          <button onClick={() => {handleCopy(proxy.ip, 'ip'); setCopiedId(`ip-${proxy.id}`);}} className="hover:text-indigo-400 transition-colors">{proxy.ip}</button>
                          <span className="mx-1 text-slate-600">:</span>
                          <button onClick={() => {handleCopy(proxy.port, 'port'); setCopiedId(`p-${proxy.id}`);}} className="hover:text-indigo-400 transition-colors">{proxy.port}</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-4 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 font-bold uppercase text-[9px]">U:</span>
                          <button onClick={() => {handleCopy(proxy.login, 'u'); setCopiedId(`u-${proxy.id}`);}} className="text-orange-400/80 hover:text-orange-300 transition-colors">{proxy.login}</button>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
                          <span className="text-slate-600 font-bold uppercase text-[9px]">P:</span>
                          <button onClick={() => {handleCopy(proxy.passwordHash, 'pw'); setCopiedId(`pw-${proxy.id}`);}} className="text-slate-400 hover:text-white transition-colors">{proxy.passwordHash}</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center text-[10px]">
                      <span className="bg-white/5 border border-white/5 text-slate-500 px-2 py-0.5 rounded-md font-bold">{proxy.type}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className={cn("text-xs font-bold font-mono", getStatusColor(daysLeft))}>
                        {daysLeft}д
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {handleCopy(fullString, 'all'); setCopiedId(`all-${proxy.id}`);}}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all border",
                            copiedId?.startsWith('all') ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-indigo-600 hover:border-indigo-500"
                          )}
                        >
                          {copiedId?.startsWith('all') ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                          <span>{copiedId?.startsWith('all') ? 'OK' : 'ВСЁ'}</span>
                        </button>
                        <button onClick={() => handleDeleteProxy(proxy.id)} className="p-2 text-slate-700 hover:text-rose-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!project.proxies || project.proxies.length === 0) && (
            <div className="text-center py-20 text-slate-600 uppercase text-[10px] font-bold tracking-[0.2em]">
              Данные отсутствуют
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
