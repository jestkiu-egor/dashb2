import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Globe, 
  Key, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Eye, 
  Trash2, 
  MessageSquare,
  Plus
} from 'lucide-react';
import { Project, Proxy, ApiKey, Subscription, Task } from '../types';
import { format, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { ProxyTab } from './ProxyTab';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdateProxies: (projectId: string, proxies: Proxy[]) => void;
  onUpdateTasks: (projectId: string, tasks: Task[]) => void;
}

type TabType = 'overview' | 'proxy' | 'api' | 'subscriptions';

export const ProjectDetail = ({ project, onBack, onUpdateProxies, onUpdateTasks }: ProjectDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: Globe },
    { id: 'proxy', label: 'PROXY', icon: Globe },
    { id: 'api', label: 'API', icon: Key },
    { id: 'subscriptions', label: 'Подписки', icon: CreditCard },
  ];

  const getStatusColor = (expiresAt: Date) => {
    const daysLeft = differenceInDays(new Date(expiresAt), new Date());
    if (daysLeft < 3) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (daysLeft < 7) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };

  const getDaysLeft = (expiresAt: Date) => {
    const days = differenceInDays(new Date(expiresAt), new Date());
    return days > 0 ? `${days}д` : 'Истекло';
  };

  return (
    <div className="p-8 space-y-8 relative z-10">
      <header className="flex items-center gap-6">
        <button 
          onClick={onBack}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all border border-white/10"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
          <p className="text-slate-400 mt-1">{project.description}</p>
        </div>
      </header>

      <div className="flex items-center gap-2 p-1 bg-slate-900/60 rounded-2xl border border-white/10 w-fit backdrop-blur-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300",
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">Задачи</h3>
                <div className="flex items-end justify-between">
                  <span className="text-5xl font-bold text-white">{project.tasks.length}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
                      <CheckCircle2 size={16} />
                      {project.tasks.filter(t => t.status === 'done').length} Готово
                    </span>
                    <span className="text-indigo-400 text-sm font-bold flex items-center gap-1">
                      <Clock size={16} />
                      {project.tasks.filter(t => t.status === 'in-progress').length} В работе
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">Прокси</h3>
                <div className="flex items-end justify-between">
                  <span className="text-5xl font-bold text-white">{project.proxies.length}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-emerald-400 text-sm font-bold">Активно</span>
                    <span className="text-slate-500 text-xs">Всего ресурсов</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">API Ключи</h3>
                <div className="flex items-end justify-between">
                  <span className="text-5xl font-bold text-white">{project.apiKeys.length}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-purple-400 text-sm font-bold">Интегрировано</span>
                    <span className="text-slate-500 text-xs">Активные ключи</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'proxy' && (
            <ProxyTab 
              project={project} 
              onUpdateProxies={(proxies) => onUpdateProxies(project.id, proxies)} 
            />
          )}

          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">API Ключи</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-semibold hover:bg-indigo-600 hover:text-white transition-all">
                  <Plus size={18} />
                  <span>Добавить Ключ</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {project.apiKeys.map((key) => (
                  <div key={key.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400">
                        <Key size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold">{key.name}</h4>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-500">Место: <span className="text-indigo-400">{key.usageLocation}</span></span>
                          <span className="text-slate-500 font-mono truncate max-w-[200px]">{key.key}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="space-y-1 text-right">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Срок действия</div>
                        <div className="flex items-center gap-3 justify-end">
                          <span className="text-emerald-400 font-mono text-sm">{format(new Date(key.expiresAt), 'dd.MM.yyyy')}</span>
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getStatusColor(key.expiresAt))}>
                            {getDaysLeft(key.expiresAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-500 hover:text-white transition-colors"><Copy size={20} /></button>
                        <button className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={20} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">Услуги и Подписки</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-semibold hover:bg-indigo-600 hover:text-white transition-all">
                  <Plus size={18} />
                  <span>Добавить Услугу</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {project.subscriptions.map((sub) => (
                  <div key={sub.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-400">
                        <CreditCard size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold">{sub.serviceName}</h4>
                        <div className="text-slate-500 text-sm">Активная подписка</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="space-y-1 text-right">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Следующее списание</div>
                        <div className="flex items-center gap-3 justify-end">
                          <span className="text-emerald-400 font-mono text-sm">{format(new Date(sub.expiresAt), 'dd.MM.yyyy')}</span>
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getStatusColor(sub.expiresAt))}>
                            {getDaysLeft(sub.expiresAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-500 hover:text-white transition-colors"><Eye size={20} /></button>
                        <button className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={20} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
