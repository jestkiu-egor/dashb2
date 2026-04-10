import { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Copy, 
  RefreshCcw, 
  ShieldCheck, 
  Save,
  Key as KeyIcon,
  ClipboardCheck
} from 'lucide-react';
import { Project, Proxy } from '../types';
import { differenceInDays, isValid } from 'date-fns';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
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
  const [newProxy, setNewProxy] = useState<Partial<Proxy>>({
    type: 'HTTPS',
    ip: '',
    port: '',
    login: '',
    passwordHash: '',
  });

  useEffect(() => {
    async function loadSettings() {
      const key = await db.getSetting(project.id, 'px6_api_key');
      if (key) setApiKey(key);
    }
    loadSettings();
  }, [project.id]);

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      alert('Пожалуйста, введите ключ');
      return;
    }
    setIsLoading(true);
    try {
      await db.saveSetting(project.id, 'px6_api_key', apiKey);
      alert('✅ API Ключ успешно сохранен в базу');
      fetchProxyInfo();
    } catch (err) {
      alert('❌ Ошибка при сохранении ключа');
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysLeft = (dateStr: Date | string) => {
    const date = new Date(dateStr);
    if (!isValid(date)) return 0;
    return differenceInDays(date, new Date());
  };

  const getStatusColor = (days: number) => {
    if (days < 3) return 'text-red-400 bg-red-400/10 border-red-400/20';
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
        const fetchedProxies: Proxy[] = [];
        
        for (const p: any of rawList) {
          const ipAddr = p.host || p.ip;
          const portStr = p.port.toString();

          const exists = (project.proxies || []).some(existing => 
            existing.ip === ipAddr && existing.port === portStr
          );
          if (exists) continue;

          const proxyData: Partial<Proxy> = {
            ip: ipAddr,
            port: portStr,
            login: p.user,
            passwordHash: p.pass,
            type: (p.type === 'socks' ? 'SOCKS5' : 'HTTPS') as any,
            ipv6: p.host ? p.ip : undefined,
            expiresAt: new Date(p.unixtime_end * 1000),
          };

          const created = await db.addProxy(project.id, proxyData);
          if (created) {
            fetchedProxies.push({
              id: created.id,
              ip: created.ip,
              port: created.port,
              login: created.login,
              passwordHash: created.password_hash,
              type: created.proxy_type,
              ipv6: created.ipv6,
              expiresAt: new Date(created.expires_at),
            });
          }
        }

        if (fetchedProxies.length > 0) {
          onUpdateProxies([...(project.proxies || []), ...fetchedProxies]);
          alert(`✅ Подгружено новых прокси: ${fetchedProxies.length}\nБаланс: ${data.balance} ${data.currency}`);
        } else {
          alert(`Новых прокси не найдено.\nБаланс: ${data.balance} ${data.currency}`);
        }
      } else {
        alert(`Ошибка API: ${data.error || 'Неверный формат ответа'}`);
      }
    } catch (error) {
      console.error('Ошибка API px6.link:', error);
      alert('Произошла ошибка при запросе к API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProxy = async () => {
    if (newProxy.ip && newProxy.port) {
      const proxyData: Partial<Proxy> = {
        ip: newProxy.ip,
        port: newProxy.port,
        login: newProxy.login || '',
        passwordHash: newProxy.passwordHash || '',
        type: (newProxy.type as any) || 'HTTPS',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipv6: newProxy.ipv6,
      };
      
      const created = await db.addProxy(project.id, proxyData);
      if (created) {
        onUpdateProxies([...(project.proxies || []), {
          id: created.id,
          ip: created.ip,
          port: created.port,
          login: created.login,
          passwordHash: created.password_hash,
          type: created.proxy_type,
          ipv6: created.ipv6,
          expiresAt: new Date(created.expires_at),
        }]);
      }
      
      setShowAddForm(false);
      setNewProxy({ type: 'HTTPS', ip: '', port: '', login: '', passwordHash: '' });
    }
  };

  const handleDeleteProxy = async (id: string) => {
    if (window.confirm('Удалить этот прокси из базы?')) {
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
      {/* Секция API */}
      <div className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
              <KeyIcon size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">Интеграция px6.link</h3>
              <p className="text-slate-400 text-xs">Введите API ключ для синхронизации данных</p>
            </div>
          </div>
          <button 
            onClick={fetchProxyInfo}
            disabled={isLoading || !apiKey}
            className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={20} className={cn(isLoading && "animate-spin")} />
          </button>
        </div>
        
        <div className="flex gap-3">
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Ваш API Key от px6.link"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
          />
          <button 
            onClick={saveApiKey}
            disabled={isLoading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {isLoading ? 'Загрузка...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe size={20} className="text-indigo-400" />
          Список Прокси
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-semibold hover:bg-indigo-600 hover:text-white transition-all"
        >
          <Plus size={18} />
          <span>Добавить вручную</span>
        </button>
      </div>

      {showAddForm && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/60 border border-white/10 p-6 rounded-3xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <input placeholder="IP Адрес" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" value={newProxy.ip} onChange={e => setNewProxy({...newProxy, ip: e.target.value})} />
          <input placeholder="Порт" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" value={newProxy.port} onChange={e => setNewProxy({...newProxy, port: e.target.value})} />
          <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" value={newProxy.type} onChange={e => setNewProxy({...newProxy, type: e.target.value as any})}>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS5">SOCKS5</option>
            <option value="HTTP">HTTP</option>
          </select>
          <input placeholder="Логин" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" value={newProxy.login} onChange={e => setNewProxy({...newProxy, login: e.target.value})} />
          <input placeholder="Пароль" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white" value={newProxy.passwordHash} onChange={e => setNewProxy({...newProxy, passwordHash: e.target.value})} />
          <button onClick={handleAddProxy} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Добавить</button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(project.proxies || []).length > 0 ? (
          project.proxies.map((proxy) => (
            <div key={proxy.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-6 group hover:border-indigo-500/30 transition-all">
              <div className="flex items-center gap-6 min-w-[400px]">
                <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <Globe size={24} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Прокси</span>
                    {/* IP */}
                    <button 
                      onClick={() => handleCopy(proxy.ip, 'ip')}
                      className="text-white font-mono font-bold hover:text-indigo-400 transition-colors flex items-center gap-1 group/btn"
                    >
                      {proxy.ip}
                      <Copy size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-slate-600">:</span>
                    {/* Port */}
                    <button 
                      onClick={() => handleCopy(proxy.port, 'port')}
                      className="text-white font-mono font-bold hover:text-indigo-400 transition-colors flex items-center gap-1 group/btn"
                    >
                      {proxy.port}
                      <Copy size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20">{proxy.type}</span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">User:</span>
                      <button 
                        onClick={() => handleCopy(proxy.login, 'user')}
                        className="text-orange-400 font-mono hover:text-orange-300 transition-colors flex items-center gap-1 group/btn"
                      >
                        {proxy.login}
                        <Copy size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">Pass:</span>
                      <button 
                        onClick={() => handleCopy(proxy.passwordHash, 'pass')}
                        className="text-white font-mono hover:text-indigo-400 transition-colors flex items-center gap-1 group/btn"
                      >
                        {proxy.passwordHash}
                        <Copy size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </div>
                  {proxy.ipv6 && <div className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]">IPv6: {proxy.ipv6}</div>}
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Срок</div>
                  <div className={cn("flex items-center gap-2 text-sm font-bold", getStatusColor(getDaysLeft(proxy.expiresAt)))}>
                    <ShieldCheck size={16} />
                    {getDaysLeft(proxy.expiresAt)}д
                  </div>
                </div>
                
                <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                  {/* Кнопка ОБЩЕГО копирования */}
                  <button 
                    onClick={() => handleCopy(`${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.passwordHash}`, 'all')}
                    title="Копировать всё (IP:PORT:USER:PASS)"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      copiedId === `all-${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.passwordHash}` 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {copiedId?.startsWith('all') ? <ClipboardCheck size={16} /> : <Copy size={16} />}
                    <span>{copiedId?.startsWith('all') ? 'Скопировано!' : 'Копировать всё'}</span>
                  </button>
                  
                  <button 
                    onClick={() => handleDeleteProxy(proxy.id)}
                    className="p-3 text-slate-500 hover:text-red-400 hover:bg-rose-400/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-900/20 border border-dashed border-white/5 rounded-3xl">
            <Globe size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500">Прокси пока не добавлены</p>
          </div>
        )}
      </div>
    </div>
  );
};
