import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MoreVertical, 
  Clock, 
  MessageSquare, 
  LayoutGrid, 
  List, 
  Search,
  ChevronRight,
  MoreHorizontal,
  X,
  Send,
  User,
  ExternalLink,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Task, TaskStatus, Comment } from '../types';
import { format } from 'date-fns';
import { useState } from 'react';
import { cn } from '../lib/utils';

interface KanbanBoardProps {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'Нужно сделать', color: 'bg-slate-500' },
  { id: 'in-progress', label: 'В работе', color: 'bg-indigo-500' },
  { id: 'review', label: 'На проверке', color: 'bg-purple-500' },
  { id: 'done', label: 'Готово', color: 'bg-emerald-500' },
];

export const KanbanBoard = ({ tasks, onUpdateTasks }: KanbanBoardProps) => {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [newTaskAmount, setNewTaskAmount] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      description: newTaskDesc,
      status: newTaskStatus,
      priority: newTaskPriority,
      comments: [],
      dueDate: new Date(),
      amount: newTaskAmount ? parseFloat(newTaskAmount) : 0,
      isPaid: false,
      isAgreed: false,
      externalUrl: newTaskLink,
    };

    onUpdateTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskAmount('');
    setNewTaskLink('');
    setIsModalOpen(false);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status } : t);
    onUpdateTasks(updatedTasks);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTask) return;

    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      author: 'Вы',
      text: commentText,
      createdAt: new Date(),
    };

    const updatedTask = {
      ...selectedTask,
      comments: [...selectedTask.comments, newComment]
    };

    const updatedTasks = tasks.map(t => t.id === selectedTask.id ? updatedTask : t);
    onUpdateTasks(updatedTasks);
    setSelectedTask(updatedTask);
    setCommentText('');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'low': return 'text-emerald-400 bg-emerald-400/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  const getColumnSum = (status: TaskStatus) => {
    return tasks
      .filter(t => t.status === status)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  return (
    <div className="p-8 space-y-8 relative z-10 h-full flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Бек-лог задач</h1>
          <p className="text-slate-400 mt-1">Управляйте задачами и отслеживайте прогресс.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-900/60 rounded-xl border border-white/10 backdrop-blur-xl">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                "p-2 rounded-lg transition-all",
                view === 'kanban' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"
              )}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                view === 'list' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"
              )}
            >
              <List size={20} />
            </button>
          </div>
          <button 
            onClick={() => {
              setNewTaskStatus('todo');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
          >
            <Plus size={20} />
            <span>Добавить задачу</span>
          </button>
        </div>
      </header>

      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
        <Search className="text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Поиск задач..." 
          className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-600"
        />
      </div>

      <AnimatePresence mode="wait">
        {view === 'kanban' ? (
          <motion.div
            key="kanban"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex gap-6 overflow-x-auto pb-8 flex-1 min-h-0 custom-scrollbar"
          >
            {COLUMNS.map((column) => (
              <div 
                key={column.id} 
                className="flex-shrink-0 w-80 flex flex-col gap-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", column.color)} />
                      <h3 className="font-bold text-white uppercase tracking-widest text-xs">{column.label}</h3>
                      <span className="text-slate-500 text-xs font-bold bg-white/5 px-2 py-0.5 rounded-full">
                        {tasks.filter(t => t.status === column.id).length}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-indigo-400 pl-5 uppercase tracking-tighter">
                      Всего: {getColumnSum(column.id).toLocaleString()} руб.
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setNewTaskStatus(column.id);
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-slate-500 hover:text-white transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex-1 space-y-4 min-h-[200px] bg-white/[0.02] rounded-3xl p-2 border border-white/[0.05]">
                  {tasks.filter(t => t.status === column.id).map((task) => (
                    <motion.div
                      key={task.id}
                      layoutId={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedTask(task)}
                      className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl backdrop-blur-xl hover:border-indigo-500/30 transition-all cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-2">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/5", getPriorityColor(task.priority))}>
                            {task.priority}
                          </span>
                          {task.amount && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/10">
                              {task.amount.toLocaleString()} ₽
                            </span>
                          )}
                        </div>
                        <button className="p-1 text-slate-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>

                      <h4 className="text-white font-bold mb-2 leading-tight">{task.title}</h4>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {task.isPaid ? (
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                            <CheckCircle2 size={10} /> Оплачено
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">
                            <AlertCircle size={10} /> Не оплачено
                          </div>
                        )}
                        {task.isAgreed ? (
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                            Согласовано
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                            Нужно согласовать
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-3 text-slate-500">
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <Clock size={12} />
                              <span>{format(task.dueDate, 'dd.MM.yyyy')}</span>
                            </div>
                          )}
                          {task.externalUrl && (
                            <a 
                              href={task.externalUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {task.comments.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <MessageSquare size={12} />
                              <span>{task.comments.length}</span>
                            </div>
                          )}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-[10px] text-indigo-400 font-bold border border-indigo-500/20">
                          RK
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar"
          >
            <div className="grid grid-cols-12 px-6 py-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
              <div className="col-span-6">Название задачи</div>
              <div className="col-span-2">Статус</div>
              <div className="col-span-2">Приоритет</div>
              <div className="col-span-2 text-right">Срок</div>
            </div>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedTask(task)}
                className="grid grid-cols-12 items-center px-6 py-4 bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-xl hover:border-indigo-500/30 transition-all group cursor-pointer"
              >
                <div className="col-span-6 flex items-center gap-4">
                  <div className={cn("w-2 h-2 rounded-full", COLUMNS.find(c => c.id === task.status)?.color)} />
                  <div>
                    <h4 className="text-white font-bold text-sm">{task.title}</h4>
                    <p className="text-slate-500 text-xs truncate max-w-md">{task.description}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-xs font-medium bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                    {COLUMNS.find(c => c.id === task.status)?.label}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-white/5", getPriorityColor(task.priority))}>
                    {task.priority}
                  </span>
                </div>
                <div className="col-span-2 text-right text-slate-500 text-xs font-mono">
                  {task.dueDate ? format(task.dueDate, 'dd.MM.yyyy') : '-'}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                <h2 className="text-2xl font-bold text-white">Новая задача</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Название</label>
                  <input
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Что нужно сделать?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Сумма (₽)</label>
                    <input
                      type="number"
                      value={newTaskAmount}
                      onChange={(e) => setNewTaskAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Приоритет</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
                    >
                      <option value="low" className="bg-slate-900">Низкий</option>
                      <option value="medium" className="bg-slate-900">Средний</option>
                      <option value="high" className="bg-slate-900">Высокий</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ссылка (B24/Bitrix)</label>
                  <input
                    type="text"
                    value={newTaskLink}
                    onChange={(e) => setNewTaskLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Описание</label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Детали задачи..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                >
                  Создать задачу
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-5xl h-full bg-slate-950 border-l border-white/10 flex overflow-hidden"
            >
              {/* Left Side: Task Body */}
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar border-r border-white/5">
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="mb-8 p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 flex items-center gap-2 text-sm font-bold"
                >
                  <X size={20} />
                  Закрыть
                </button>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex gap-4 items-center">
                      <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/5", getPriorityColor(selectedTask.priority))}>
                        {selectedTask.priority} Priority
                      </div>
                      {selectedTask.amount && (
                        <div className="flex items-center gap-2 text-indigo-400 font-bold">
                          <DollarSign size={16} />
                          <span className="text-xl">{selectedTask.amount.toLocaleString()} ₽</span>
                        </div>
                      )}
                    </div>
                    <h2 className="text-4xl font-bold text-white tracking-tight leading-tight">
                      {selectedTask.title}
                    </h2>
                  </div>

                  <div className="grid grid-cols-3 gap-8 py-8 border-y border-white/5">
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Статус</span>
                      <div className="flex items-center gap-2 text-white font-bold">
                        <div className={cn("w-2 h-2 rounded-full", COLUMNS.find(c => c.id === selectedTask.status)?.color)} />
                        {COLUMNS.find(c => c.id === selectedTask.status)?.label}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Оплата</span>
                      <div className={cn(
                        "font-bold",
                        selectedTask.isPaid ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {selectedTask.isPaid ? 'Оплачено' : 'Не оплачено'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Согласовано</span>
                      <div className={cn(
                        "font-bold",
                        selectedTask.isAgreed ? "text-indigo-400" : "text-slate-500"
                      )}>
                        {selectedTask.isAgreed ? 'Согласовано' : 'Не согласовано'}
                      </div>
                    </div>
                  </div>

                  {selectedTask.externalUrl && (
                    <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
                      <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                        <ExternalLink size={14} />
                        Внешняя ссылка
                      </h3>
                      <a 
                        href={selectedTask.externalUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 font-bold break-all flex items-center gap-2"
                      >
                        {selectedTask.externalUrl}
                        <ChevronRight size={16} />
                      </a>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-white font-bold text-lg">Описание</h3>
                    <p className="text-slate-400 leading-relaxed text-lg whitespace-pre-wrap">
                      {selectedTask.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Chat */}
              <div className="w-[400px] flex flex-col bg-slate-900/50">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-400" />
                    Обсуждение
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-[10px] text-indigo-400 font-bold">
                          {comment.author[0]}
                        </div>
                        <span className="text-xs font-bold text-white">{comment.author}</span>
                        <span className="text-[10px] text-slate-600 font-bold uppercase">
                          {format(comment.createdAt, 'HH:mm')}
                        </span>
                      </div>
                      <div className="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none text-sm text-slate-300 leading-relaxed">
                        {comment.text}
                      </div>
                    </div>
                  ))}
                  {selectedTask.comments.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                      <MessageSquare size={48} />
                      <p className="text-sm font-bold uppercase tracking-widest">Сообщений пока нет</p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-950">
                  <form onSubmit={handleAddComment} className="relative">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Написать комментарий..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-12 py-4 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    />
                    <button 
                      type="submit"
                      disabled={!commentText.trim()}
                      className="absolute right-2 top-2 bottom-2 w-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl flex items-center justify-center transition-all"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
