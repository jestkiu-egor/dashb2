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
  Plus,
  ListTodo
} from 'lucide-react';
import { Project, Proxy, ApiKey, Subscription, Task, Column } from '../types';
import { format, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { KanbanBoard } from './KanbanBoard';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdateTasks: (tasks: Task[]) => void;
  onDeleteTask: (taskId: string) => void;
  projects: Project[];
  columns: Column[];
}

type TabType = 'overview' | 'tasks' | 'proxy' | 'api' | 'subscriptions';

export const ProjectDetail = ({ project, onBack, onUpdateTasks, onDeleteTask, projects, columns }: ProjectDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: Globe },
    { id: 'tasks', label: 'Задачи', icon: ListTodo },
    { id: 'proxy', label: 'PROXY', icon: Globe },
    { id: 'api', label: 'API', icon: Key },
    { id: 'subscriptions', label: 'Подписки', icon: CreditCard },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="p-8 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={onBack}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{project.name}</h1>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full border border-indigo-500/30">Active</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Clock size={14} />
                  Создан {format(project.createdAt, 'dd.MM.yyyy')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20">
              <Plus size={20} />
              Новый ресурс
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all border",
                activeTab === tab.id
                  ? "bg-white/10 border-white/20 text-white shadow-xl"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
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

              {activeTab === 'tasks' && (
                <div className="flex-1 min-h-0">
                  <KanbanBoard 
                    tasks={project.tasks}
                    projects={projects}
                    selectedProjectId={project.id}
                    columns={columns}
                    onUpdateTasks={onUpdateTasks}
                    onDeleteTask={onDeleteTask}
                    onSelectProject={() => {}}
                  />
                </div>
              )}

              {activeTab === 'proxy' && (
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white font-bold">Активные прокси</h3>
                    <button className="text-indigo-400 text-sm font-bold hover:text-indigo-300">Управление ресурсами</button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {project.proxies.map((proxy) => (
                      <div key={proxy.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                            <Globe size={20} />
                          </div>
                          <div>
                            <p className="text-white font-bold">{proxy.host}:{proxy.port}</p>
                            <p className="text-slate-500 text-xs">{proxy.type.toUpperCase()} • {proxy.provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-emerald-400 text-sm font-bold">Expires in</p>
                            <p className="text-slate-500 text-xs">{differenceInDays(proxy.expiresAt, new Date())} days</p>
                          </div>
                          <button 
                            onClick={() => handleCopy(`${proxy.host}:${proxy.port}:${proxy.username}:${proxy.password}`)}
                            className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"
                          >
                            <Copy size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {project.apiKeys.map((key) => (
                    <div key={key.id} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl group hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                            <Key size={20} />
                          </div>
                          <div>
                            <p className="text-white font-bold">{key.name}</p>
                            <p className="text-slate-500 text-xs">{key.provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-lg text-slate-500 transition-all"><Eye size={18} /></button>
                          <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-lg text-slate-500 transition-all"><Copy size={18} /></button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-black/20 rounded-2xl p-4 font-mono text-sm text-slate-400 break-all">
                          {key.key.replace(/./g, '*').slice(0, 32)}...
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-xs">Expires {format(key.expiresAt, 'MMM dd, yyyy')}</span>
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">ACTIVE</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'subscriptions' && (
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {project.subscriptions.map((sub) => (
                      <div key={sub.id} className="p-8 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                            <CreditCard size={28} />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-white mb-1">{sub.service}</h4>
                            <p className="text-slate-500 text-sm">Monthly billing • Auto-renew</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-12">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-white">${sub.amount}</p>
                            <p className="text-slate-500 text-xs">per month</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1">
                              <Clock size={16} />
                              {format(sub.nextBilling, 'MMM dd')}
                            </div>
                            <p className="text-slate-500 text-xs">Next payment</p>
                          </div>
                          <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><ChevronRight size={20} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
