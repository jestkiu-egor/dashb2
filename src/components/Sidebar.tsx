import { motion } from 'motion/react';
import { Home, Wallet, ListTodo, ChevronRight, ChevronLeft, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'finance', label: 'Финансы', icon: Wallet },
    { id: 'backlog', label: 'Бек-лог задач', icon: ListTodo },
  ];

  return (
    <motion.div
      animate={{ width: isCollapsed ? 80 : 260 }}
      className="h-screen bg-slate-950/80 backdrop-blur-xl border-r border-white/10 flex flex-col relative z-10"
    >
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">Cosmo</span>
          </motion.div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group relative",
                isActive 
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={22} className={cn("transition-transform duration-300", isActive && "scale-110")} />
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-medium"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-white/5">
        <div className={cn("flex items-center gap-3 p-2", isCollapsed && "justify-center")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
            RK
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">Ramzi K.</span>
              <span className="text-xs text-slate-500">korteramzi@gmail.com</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
