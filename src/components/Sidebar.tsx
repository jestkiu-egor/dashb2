import { motion, AnimatePresence } from 'motion/react';
import { Home, Wallet, ListTodo, ChevronRight, ChevronLeft, ChevronDown, LayoutDashboard, Folder, Check, Bot, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { Project } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onOpenAssistant?: () => void;
}

export const Sidebar = ({ activeTab, setActiveTab, projects, selectedProjectId, onSelectProject }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'finance', label: 'Финансы', icon: Wallet },
    { id: 'backlog', label: 'Задачи', icon: ListTodo },
    { id: 'assistant', label: 'Ассистент', icon: Bot },
  ];

  const handleBacklogClick = () => {
    if (activeTab === 'backlog') {
      setIsProjectsOpen(!isProjectsOpen);
    } else {
      setActiveTab('backlog');
      setIsProjectsOpen(true);
    }
  };

  return (
    <motion.div
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="h-screen bg-slate-950/80 backdrop-blur-xl border-r border-white/10 flex flex-col relative z-10"
    >
      <div className="p-5 flex items-center justify-between">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">2code</span>
          </motion.div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isBacklog = item.id === 'backlog';
          const isAssistant = item.id === 'assistant';

          return (
            <div key={item.id}>
              <button
                onClick={isBacklog ? handleBacklogClick : isAssistant ? () => { if (onOpenAssistant) onOpenAssistant(); } : () => { setActiveTab(item.id); setIsProjectsOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative",
                  isActive 
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={20} className={cn("transition-transform duration-300", isActive && "scale-110", isAssistant && "text-purple-400")} />
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-medium flex-1 text-left"
                  >
                    {item.label}
                  </motion.span>
                )}
                {!isCollapsed && isBacklog && (
                  <ChevronDown 
                    size={16} 
                    className={cn(
                      "transition-transform text-slate-500",
                      isProjectsOpen && "rotate-180"
                    )} 
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-5 bg-indigo-500 rounded-r-full"
                  />
                )}
              </button>

              <AnimatePresence>
                {isBacklog && isProjectsOpen && !isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-4"
                  >
                    <div className="py-2 space-y-1">
                      <button
                        onClick={() => { onSelectProject(null); setIsProjectsOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          !selectedProjectId 
                            ? "bg-indigo-600/30 text-indigo-400" 
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Folder size={14} />
                        <span>Все проекты</span>
                        {!selectedProjectId && <Check size={14} className="ml-auto" />}
                      </button>
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => { onSelectProject(project.id); setIsProjectsOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            selectedProjectId === project.id 
                              ? "bg-indigo-600/30 text-indigo-400" 
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <Folder size={14} />
                          <span className="truncate">{project.name}</span>
                          <span className="ml-auto text-xs text-slate-500">
                            {project.tasks.length}
                          </span>
                          {selectedProjectId === project.id && <Check size={14} className="ml-1" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-white/5">
        <div className={cn("flex items-center gap-3 p-2", isCollapsed && "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            RK
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white truncate">Ramzi K.</span>
              <span className="text-xs text-slate-500 truncate">korteramzi@gmail.com</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
