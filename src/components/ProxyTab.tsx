import { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  RefreshCcw, 
  ShieldCheck, 
  ExternalLink,
  Save,
  Key as KeyIcon,
  Calendar
} from 'lucide-react';
import { Project, Proxy } from '../types';
import { format, differenceInDays } from 'date-fns';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface ProxyTabProps {
  project: Project;
  onUpdateProxies: (proxies: Proxy[]) => void;
}

export const ProxyTab = ({ project, onUpdateProxies }: ProxyTabProps) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const getDaysLeft = (date: Date) => {
    const days = differenceInDays(new Date(date), new Date());
    return days;
  };

  const getStatusColor = (days: number) => {
    if (days < 3) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (days < 7) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };
  const [newProxy, setNewProxy] = useState<Partial<Proxy>>({
    type: 'HTTPS',
    ip: '',
    port: '',
    login: '',
    passwordHash: '',
  });

  // В реальном приложении здесь будет fetch к px6.me
  const fetchProxyInfo = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    try {
      // Пример вызова API px6.me (согласно их доке)
      // const res = await fetch(`https://api.px6.me/v1/user/proxies?api_key=${apiKey}`);
      // ... логика обработки
      console.log('Fetching from px6.me with key:', apiKey);
    } catch (error) {
      console.error('API Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProxy = () => {
    if (newProxy.ip && newProxy.port) {
      const proxy: Proxy = {
        id: Math.random().toString(36).substr(2, 9),
        ip: newProxy.ip || '',
        port: newProxy.port || '',
        login: newProxy.login || '',
        passwordHash: newProxy.passwordHash || '',
        type: (newProxy.type as any) || 'HTTPS',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней по дефолту
        ipv6: newProxy.ipv6,
      };
      onUpdateProxies([...project.proxies, proxy]);
      setShowAddForm(false);
      setNewProxy({ type: 'HTTPS' });
    }
  };

  const handleDeleteProxy = (id: string) => {
    onUpdateProxies(project.proxies.filter(p => p.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Секция API Ключа */}
      <div className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
              <KeyIcon size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">Интеграция px6.me</h3>
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
            placeholder="Ваш API Key от px6.me"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
          />
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
            <Save size={18} />
            Сохранить
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
          <input 
            placeholder="IP Адрес" 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            value={newProxy.ip}
            onChange={e => setNewProxy({...newProxy, ip: e.target.value})}
          />
          <input 
            placeholder="Порт" 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            value={newProxy.port}
            onChange={e => setNewProxy({...newProxy, port: e.target.value})}
          />
          <select 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            value={newProxy.type}
            onChange={e => setNewProxy({...newProxy, type: e.target.value as any})}
          >
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS5">SOCKS5</option>
            <option value="HTTP">HTTP</option>
          </select>
          <input 
            placeholder="Логин" 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            value={newProxy.login}
            onChange={e => setNewProxy({...newProxy, login: e.target.value})}
          />
          <input 
            placeholder="Пароль" 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            value={newProxy.passwordHash}
            onChange={e => setNewProxy({...newProxy, passwordHash: e.target.value})}
          />
          <button 
            onClick={handleAddProxy}
            className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Добавить
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {project.proxies.length > 0 ? (
          project.proxies.map((proxy) => (
            <div key={proxy.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-6 group hover:border-indigo-500/30 transition-all">
              <div className="flex items-center gap-6 min-w-[300px]">
                <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <Globe size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">IP:PORT</span>
                    <span className="text-white font-mono font-bold">{proxy.ip}:{proxy.port}</span>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20">{proxy.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">User: <span className="text-orange-400 font-mono">{proxy.login}</span></span>
                    <span className="text-slate-500">Pass: <span className="text-white font-mono">{proxy.passwordHash}</span></span>
                  </div>
                  {proxy.ipv6 && <div className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]">IPv6: {proxy.ipv6}</div>}
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Статус</div>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <ShieldCheck size={16} />
                    Активен
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleCopy(`${proxy.ip}:${proxy.port}`)}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                  >
                    <Copy size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProxy(proxy.id)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
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
