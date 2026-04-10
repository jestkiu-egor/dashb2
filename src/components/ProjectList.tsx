import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, MoreVertical, Layers, X, Trash2, Edit2 } from 'lucide-react';
import { Project } from '../types';
import { format, isValid } from 'date-fns';
import { useState } from 'react';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onAddProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectList = ({ projects, onSelectProject, onAddProject, onDeleteProject }: ProjectListProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const formatDateSafely = (dateStr: any, formatStr: string) => {
    const date = new Date(dateStr);
    return isValid(date) ? format(date, formatStr) : 'Нет даты';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: projectName,
      description: projectDesc,
      proxies: [],
      apiKeys: [],
      subscriptions: [],
      tasks: [],
      transactions: [],
      createdAt: new Date(),
    };

    onAddProject(newProject);
    setProjectName('');
    setProjectDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 space-y-8 relative z-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Проекты</h1>
          <p className="text-slate-400 mt-1">Управляйте вашими проектами и задачами.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]"
        >
          <Plus size={20} />
          <span>Новый проект</span>
        </button>
      </header>

      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
        <Search className="text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Поиск проектов..." 
          className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <motion.div
            key={project.id}
            whileHover={{ y: -5 }}
            className="group bg-slate-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl hover:border-indigo-500/50 transition-all cursor-pointer relative overflow-hidden"
            onClick={() => onSelectProject(project)}
          >
            <div className="absolute top-4 right-4 z-20">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === project.id ? null : project.id);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
              >
                <MoreVertical size={20} />
              </button>
              
              <AnimatePresence>
                {openMenuId === project.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                    >
                      <Edit2 size={16} />
                      Редактировать
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-400/10 transition-colors"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                  {formatDateSafely(project.createdAt, 'dd.MM.yyyy')}
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-sm mb-8 line-clamp-2 leading-relaxed">
              {project.description}
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    U{i}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span>{project.tasks?.length || 0} Задач</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <span>{project.proxies?.length || 0} Прокси</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Новый проект</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Название</label>
                  <input
                    autoFocus
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Введите название проекта..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Описание</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Коротко о проекте..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                >
                  Создать проект
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
