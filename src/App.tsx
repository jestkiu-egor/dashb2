import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StarField } from './components/StarField';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { KanbanBoard } from './components/KanbanBoard';
import { Finance } from './components/Finance';
import { AssistantPage } from './components/AssistantPage';
import { SAMPLE_PROJECTS } from './constants';
import { Project, Task, Transaction, Column } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);

  // Загрузка данных из Supabase
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        console.log('[App] Загрузка проектов из Supabase...');
        
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*');

        if (projectsError) throw projectsError;
        
        if (projectsData && projectsData.length > 0) {
          const projectsWithTasks = await Promise.all(projectsData.map(async (p) => {
            // Загружаем задачи
            const { data: tasks } = await supabase.from('tasks').select('*').eq('project_id', p.id);
            
            // Загружаем прокси и ключи с проверкой на ошибки (если таблиц нет)
            let proxies: any[] = [];
            let apiKeys: any[] = [];
            
            try {
              const { data: pData } = await supabase.from('proxies').select('*').eq('project_id', p.id);
              proxies = pData || [];
            } catch (e) { console.log('Table proxies not found'); }

            try {
              const { data: kData } = await supabase.from('api_keys').select('*').eq('project_id', p.id);
              apiKeys = kData || [];
            } catch (e) { console.log('Table api_keys not found'); }

            return {
              ...p,
              createdAt: p.created_at ? new Date(p.created_at) : new Date(),
              tasks: (tasks || []).map(t => ({
                ...t,
                createdAt: t.created_at ? new Date(t.created_at) : new Date(),
                dueDate: t.due_date ? new Date(t.due_date) : undefined,
                comments: t.comments || []
              })),
              proxies: (proxies || []).map(pr => ({
                ...pr,
                expiresAt: pr.expires_at ? new Date(pr.expires_at) : new Date()
              })),
              apiKeys: (apiKeys || []).map(k => ({
                ...k,
                expiresAt: k.expires_at ? new Date(k.expires_at) : new Date()
              })),
              subscriptions: [],
              transactions: []
            };
          }));

          console.log('[App] Проекты успешно загружены:', projectsWithTasks);
          setProjects(projectsWithTasks);
        } else {
          console.log('[App] В базе нет проектов, показываем демо-данные');
          setProjects(SAMPLE_PROJECTS);
        }
      } catch (err) {
        console.error('[App] Ошибка Supabase:', err);
        setProjects(SAMPLE_PROJECTS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Загрузка колонок из Supabase
  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const { data, error } = await supabase
          .from('columns')
          .select('*')
          .order('order', { ascending: true });

        if (error) throw error;
        setColumns(data || []);
      } catch (err) {
        console.error('Ошибка загрузки колонок:', err);
      }
    };

    fetchColumns();
  }, []);

  // Обновление колонки
  const handleUpdateColumn = async (column: Column) => {
    try {
      const { error } = await supabase
        .from('columns')
        .update({ label: column.label, color: column.color, order: column.order })
        .eq('id', column.id);

      if (error) throw error;
      setColumns(prev => prev.map(c => c.id === column.id ? column : c));
    } catch (err) {
      console.error('Ошибка обновления колонки:', err);
    }
  };

  // Удаление колонки
  const handleDeleteColumn = async (columnId: string) => {
    try {
      const { error } = await supabase
        .from('columns')
        .delete()
        .eq('id', columnId);

      if (error) throw error;
      setColumns(prev => prev.filter(c => c.id !== columnId));
    } catch (err) {
      console.error('Ошибка удаления колонки:', err);
    }
  };

  // Добавление колонки
  const handleAddColumn = async (column: Column) => {
    try {
      const { data, error } = await supabase
        .from('columns')
        .insert([{
          project_id: column.project_id,
          label: column.label,
          color: column.color,
          order: column.order
        }])
        .select()
        .single();

      if (error) throw error;
      setColumns(prev => [...prev, data]);
    } catch (err) {
      console.error('Ошибка добавления колонки:', err);
    }
  };

  // Переименование колонок
  const handleReorderColumns = async (newColumns: Column[]) => {
    setColumns(newColumns);
    try {
      for (const col of newColumns) {
        await supabase
          .from('columns')
          .update({ order: col.order })
          .eq('id', col.id);
      }
    } catch (err) {
      console.error('Ошибка сохранения порядка колонок:', err);
    }
  };

  const handleAddProject = async (newProject: Project) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: newProject.name,
          description: newProject.description
        }])
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => [...prev, { ...newProject, id: data.id }]);
    } catch (err) {
      console.error('Ошибка добавления проекта:', err);
      setProjects(prev => [...prev, newProject]);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
    } catch (err) {
      console.error('Ошибка удаления проекта:', err);
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: updatedProject.name,
          description: updatedProject.description
        })
        .eq('id', updatedProject.id);

      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
    } catch (err) {
      console.error('Ошибка обновления проекта:', err);
    }
  };

  const handleUpdateTasks = async (projectId: string, tasks: Task[]) => {
    // Обновляем локальное состояние для мгновенного отклика
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks } : p));
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => prev ? { ...prev, tasks } : null);
    }

    // Синхронизируем изменения с Supabase
    // В идеале обновляем только измененную задачу, но для простоты обновляем все переданные
    // В данном контексте tasks - это весь список задач проекта
    try {
      for (const task of tasks) {
        const { error } = await supabase
          .from('tasks')
          .upsert({
            id: task.id.includes('.') ? undefined : task.id, // Если ID временный (из Math.random), пусть база создаст новый
            project_id: projectId,
            title: task.title,
            description: task.description,
            amount: task.amount,
            status: task.status,
            priority: task.priority,
            is_paid: task.isPaid,
            due_date: task.dueDate?.toISOString()
          })
          .eq('id', task.id);
        
        if (error) console.error('Ошибка сохранения задачи:', error.message);
      }
    } catch (err) {
      console.error('Ошибка синхронизации задач:', err);
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

  const handleDeleteTask = async (projectId: string, taskId: string) => {
    try {
      // Удаляем из базы
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      // Обновляем локально
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p
      ));
      if (selectedProject?.id === projectId) {
        setSelectedProject(prev => prev ? { 
          ...prev, 
          tasks: prev.tasks.filter(t => t.id !== taskId) 
        } : null);
      }
    } catch (err) {
      console.error('Ошибка удаления задачи:', err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return selectedProject ? (
          <ProjectDetail 
            project={selectedProject} 
            onBack={() => setSelectedProject(null)} 
            onUpdateTasks={(tasks) => handleUpdateTasks(selectedProject.id, tasks)}
            onDeleteTask={(taskId) => handleDeleteTask(selectedProject.id, taskId)}
            projects={projects}
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
            columns={columns}
            onUpdateTasks={(tasks) => {
              if (taskProjectId) {
                handleUpdateTasks(taskProjectId, tasks);
              } else if (projects.length > 0) {
                // Если проект не выбран, пробуем найти projectId у первой задачи
                const pId = tasks[0]?.project_id || projects[0].id;
                handleUpdateTasks(pId, tasks);
              }
            }}
            onDeleteTask={(taskId) => {
              // Находим задачу во всем списке, чтобы узнать её projectId
              const taskToDelete = allTasks.find(t => t.id === taskId);
              // У задач из БД поле называется project_id (из маппинга) или projectId
              const pId = taskToDelete?.project_id || taskToDelete?.projectId;
              
              if (pId) {
                console.log(`[App] Удаление задачи ${taskId} из проекта ${pId}`);
                handleDeleteTask(pId, taskId);
              } else {
                console.error('[App] Не удалось определить проект для удаления задачи:', taskId);
                // Если не нашли, пробуем удалить без привязки к локальному проекту
                supabase.from('tasks').delete().eq('id', taskId).then(({ error }) => {
                  if (!error) setProjects(prev => prev.map(p => ({...p, tasks: p.tasks.filter(t => t.id !== taskId)})));
                });
              }
            }}
            onSelectProject={setTaskProjectId}
            onUpdateColumn={handleUpdateColumn}
            onDeleteColumn={handleDeleteColumn}
            onAddColumn={handleAddColumn}
            onReorderColumns={handleReorderColumns}
          />
        );
      case 'assistant':
        return <AssistantPage isOpen={activeTab === 'assistant' || isAssistantOpen} />;
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
