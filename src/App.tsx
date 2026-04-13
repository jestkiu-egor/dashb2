import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { StarField } from './components/StarField';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { KanbanBoard } from './components/KanbanBoard';
import { Finance } from './components/Finance';
import { AssistantPage } from './components/AssistantPage';
import { SAMPLE_PROJECTS } from './constants';
import { Project, Task, Transaction } from './types';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);

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

  const handleAddTransaction = (projectId: string, transaction: Transaction) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, transactions: [transaction, ...p.transactions] } : p));
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => prev ? { ...prev, transactions: [transaction, ...prev.transactions] } : null);
    }
  };

  // For global finance view, we might want all transactions from all projects
  const allTransactions = projects.flatMap(p => p.transactions);
  const allTasks = projects.flatMap(p => p.tasks);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return selectedProject ? (
          <ProjectDetail 
            project={selectedProject} 
            onBack={() => setSelectedProject(null)} 
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
            tasks={allTasks}
            projects={projects}
            selectedProjectId={taskProjectId}
            onUpdateTasks={(tasks) => {
              if (taskProjectId) {
                handleUpdateTasks(taskProjectId, tasks);
              } else if (projects.length > 0) {
                handleUpdateTasks(projects[0].id, tasks);
              }
            }}
            onSelectProject={setTaskProjectId}
          />
        );
      case 'assistant':
        return <AssistantPage isOpen={isAssistantOpen} />;
      default:
        return <div className="p-8 text-white">Tab not found</div>;
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <StarField />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedProject(null);
          if (tab !== 'backlog') setTaskProjectId(null);
          if (tab === 'assistant') setIsAssistantOpen(true);
        }}
        projects={projects}
        selectedProjectId={taskProjectId}
        onSelectProject={setTaskProjectId}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

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
