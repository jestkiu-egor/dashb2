import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StarField } from './components/StarField';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { KanbanBoard } from './components/KanbanBoard';
import { Finance } from './components/Finance';
import { SAMPLE_PROJECTS } from './constants';
import { Project, Task, Transaction, Proxy } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { error } = await supabase.from('_test_connection_').select('*').limit(1);
        // Ошибка 'PGRST116' или '42P01' (таблица не найдена) — это успех соединения, 
        // так как база ответила, что таблицы нет.
        if (error && !['42P01', 'PGRST116'].includes(error.code)) {
          console.error('Ошибка подключения к Supabase:', error.message);
        } else {
          console.log('✅ Supabase подключен успешно!');
        }
      } catch (err) {
        console.error('Непредвиденная ошибка при проверке Supabase:', err);
      }
    }
    checkSupabase();
  }, []);

  const handleAddProject = (newProject: Project) => {
    setProjects(prev => [...prev, newProject]);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
  };

  const handleUpdateTasks = (projectId: string, tasks: Task[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks } : p));
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => prev ? { ...prev, tasks } : null);
    }
  };

  const handleUpdateProxies = (projectId: string, proxies: Proxy[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, proxies } : p));
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => prev ? { ...prev, proxies } : null);
    }
  };

  const handleAddTransaction = (projectId: string, transaction: Transaction) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, transactions: [transaction, ...p.transactions] } : p));
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => prev ? { ...prev, transactions: [transaction, ...prev.transactions] } : null);
    }
  };

  const allTransactions = projects.flatMap(p => p.transactions);
  const allTasks = projects.flatMap(p => p.tasks);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return selectedProject ? (
          <ProjectDetail 
            project={selectedProject} 
            onBack={() => setSelectedProject(null)} 
            onUpdateProxies={handleUpdateProxies}
            onUpdateTasks={handleUpdateTasks}
          />
        ) : (
          <ProjectList 
            projects={projects} 
            onSelectProject={setSelectedProject}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
          />
        );
      case 'finance':
        return (
          <Finance 
            projects={projects}
            onAddTransaction={handleAddTransaction}
          />
        );
      case 'backlog':
        return (
          <KanbanBoard 
            tasks={selectedProject ? selectedProject.tasks : allTasks} 
            onUpdateTasks={(tasks) => {
              if (selectedProject) {
                handleUpdateTasks(selectedProject.id, tasks);
              } else if (projects.length > 0) {
                const projId = projects[0].id;
                handleUpdateTasks(projId, tasks);
              }
            }}
          />
        );
      default:
        return <div className="p-8 text-white">Tab not found</div>;
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <StarField />
      
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setSelectedProject(null);
      }} />

      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedProject?.id || '')}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
