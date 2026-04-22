import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Clock, 
  MessageSquare,
  X,
  ExternalLink,
  GripVertical,
  Sparkles,
  Trash2,
  LayoutGrid,
  List,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Archive,
  FolderArchive
} from 'lucide-react';
import { Task, TaskStatus, Project, Column } from '../types';
import { format, isPast } from 'date-fns';
import { cn } from '../lib/utils';
import { VoiceInput } from '../lib/VoiceInput';
import { parseTaskWithLLM } from '../lib/llm';
import { supabase } from '../lib/supabase';
import { AssistantSettings } from '../types';
import { TaskComments } from './TaskComments';

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  selectedProjectId: string | null;
  columns: Column[];
  onUpdateTasks: (tasks: Task[], singleTaskId?: string) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onUpdateColumn?: (column: Column) => void;
  onDeleteColumn?: (columnId: string) => void;
  onAddColumn?: (column: Column) => void;
  onReorderColumns?: (columns: Column[]) => void;
}

interface LocalColumn {
  id: string;
  label: string;
  color: string;
}

const DEFAULT_COLUMNS: LocalColumn[] = [
  { id: 'todo', label: 'Нужно сделать', color: 'bg-slate-500' },
  { id: 'in-progress', label: 'В работе', color: 'bg-indigo-500' },
  { id: 'review', label: 'На проверке', color: 'bg-purple-500' },
  { id: 'done', label: 'Готово', color: 'bg-emerald-500' },
];

interface TaskModalProps {
  task: Task;
  columns: Column[];
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

function TaskModal({ task, columns, onClose, onUpdate, onDelete }: TaskModalProps) {
  const [editedTask, setEditedTask] = useState(task);
  const column = columns.find(c => c.id === task.status);

  const handleSave = () => {
    onUpdate(editedTask);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end"
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-[60vw] max-w-6xl h-full bg-slate-950 border-l border-white/10 flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", column?.color)} />
            <span className="text-slate-400 text-sm">{column?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(task.id)}
              className="p-2 hover:bg-red-500/20 rounded-xl text-red-400"
              title="Удалить задачу"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm"
            >
              Сохранить
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Название задачи</label>
              <input
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-base font-bold outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Сумма (₽)</label>
              <input
                type="number"
                step="0.01"
                value={editedTask.amount || 0}
                onChange={(e) => setEditedTask({ ...editedTask, amount: Math.round(Number(e.target.value) * 100) / 100 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-indigo-400 text-xl font-bold outline-none focus:border-indigo-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Ссылка (Битрикс24)</label>
              <input
                type="url"
                value={editedTask.externalUrl || ''}
                onChange={(e) => setEditedTask({ ...editedTask, externalUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-indigo-400 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Описание</label>
              <textarea
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                placeholder="Детали задачи..."
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-slate-300 text-base outline-none focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Статус</label>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setEditedTask({ ...editedTask, status: col.id as TaskStatus })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                      editedTask.status === col.id
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/30"
                    )}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Оплачено</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedTask({ ...editedTask, isPaid: true })}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                    editedTask.isPaid
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-white/5 border-white/10 text-slate-500"
                  )}
                >
                  Да
                </button>
                <button
                  onClick={() => setEditedTask({ ...editedTask, isPaid: false })}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                    editedTask.isPaid === false
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-white/5 border-white/10 text-slate-500"
                  )}
                >
                  Нет
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-2 tracking-widest">Согласовано</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedTask({ ...editedTask, isAgreed: true })}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                    editedTask.isAgreed
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-white/5 border-white/10 text-slate-500"
                  )}
                >
                  Да
                </button>
                <button
                  onClick={() => setEditedTask({ ...editedTask, isAgreed: false })}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                    editedTask.isAgreed === false
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-white/5 border-white/10 text-slate-500"
                  )}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-none h-80 border-t border-white/10">
          <TaskComments taskId={task.id} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function TaskCard({ task, column, index }: { task: Task; column: Column; index: number }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-slate-900/60 border border-white/10 p-4 rounded-xl transition-all cursor-grab",
            snapshot.isDragging && "opacity-50 border-indigo-500/50 shadow-lg scale-105 z-50"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            {task.amount ? (
              <span className="text-indigo-400 font-bold text-sm">
                {task.amount.toLocaleString()} ₽
              </span>
            ) : (
              <span className="text-slate-500 text-xs">Без суммы</span>
            )}
          </div>
          <h4 className="text-white font-medium text-sm mb-3">{task.title}</h4>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {task.isPaid && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">Опл</span>}
              {task.isAgreed && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">Согл</span>}
              {task.comments.length > 0 && (
                <span className="flex items-center gap-1"><MessageSquare size={12} />{task.comments.length}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function ColumnComponent({ column, tasks, onEdit, onDelete, onAddTask, onTaskClick }: { 
  column: LocalColumn; 
  tasks: Task[];
  onEdit: (newLabel: string) => void;
  onDelete: () => void;
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
}) {
  const totalAmount = tasks.reduce((sum, t) => sum + (t.amount || 0), 0);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(column.label);

  const handleSave = () => {
    if (value.trim()) onEdit(value.trim());
    setIsEditing(false);
  };

  return (
    <div className="flex-shrink-0 w-[320px] flex flex-col bg-white/[0.02] rounded-2xl p-3 border border-white/[0.05]">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={14} className="text-slate-600 cursor-grab" />
          <div className={cn("w-2 h-2 rounded-full", column.color)} />
          {isEditing ? (
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} className="bg-transparent border-b border-indigo-500 text-white text-xs font-bold outline-none w-24" />
          ) : (
            <span onClick={() => { setIsEditing(true); setValue(column.label); }} className="text-white text-xs font-bold cursor-pointer hover:text-indigo-400">{column.label}</span>
          )}
          <span className="text-slate-500 text-xs bg-white/5 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onDelete} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
          <button onClick={onAddTask} className="p-1 text-slate-500 hover:text-white transition-colors"><Plus size={16} /></button>
        </div>
      </div>
      {totalAmount > 0 && <div className="px-2 py-2 text-center text-base text-indigo-400 font-bold mt-1 mb-2 bg-indigo-500/10 rounded-lg mx-1">{totalAmount.toLocaleString()} ₽</div>}
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={cn("flex-1 min-h-[100px] space-y-2 pt-2", snapshot.isDraggingOver && "bg-indigo-500/5 rounded-lg")}>
            {tasks.map((task, index) => <div key={task.id} onClick={() => onTaskClick(task)}><TaskCard task={task} column={column} index={index} /></div>)}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export const KanbanBoard = ({ tasks, projects, selectedProjectId, columns: dbColumns, onUpdateTasks, onDeleteTask, onSelectProject, onUpdateColumn, onDeleteColumn, onAddColumn, onReorderColumns }: KanbanBoardProps) => {
  const columns = dbColumns?.length > 0 ? dbColumns : DEFAULT_COLUMNS;
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>(columns[0]?.id || 'backlog');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAmount, setNewTaskAmount] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteConfirmColumn, setDeleteConfirmColumn] = useState<string | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'status' | 'date' | 'amount'>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const filteredTasks = selectedProjectId ? tasks.filter(t => tasks.includes(t)) : tasks;

  const sortedAndFilteredTasks = useMemo(() => {
    let result = [...filteredTasks];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query));
    }
    if (filterDate) {
      const filterDateTime = new Date(filterDate).getTime();
      result = result.filter(t => !t.dueDate || new Date(t.dueDate).getTime() === filterDateTime);
    }
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus);
    if (filterPayment === 'paid') result = result.filter(t => t.isPaid);
    else if (filterPayment === 'unpaid') result = result.filter(t => !t.isPaid);
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title': comparison = a.title.localeCompare(b.title); break;
        case 'priority': comparison = {high: 3, medium: 2, low: 1}[a.priority] - {high: 3, medium: 2, low: 1}[b.priority]; break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
        case 'date': comparison = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity); break;
        case 'amount': comparison = (a.amount || 0) - (b.amount || 0); break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [filteredTasks, searchQuery, sortBy, sortDir, filterDate, filterStatus, filterPayment]);

  const onDragStart = (start: any) => {
    console.log(`%c[DRAG START] Зажата задача: ${start.draggableId}`, 'color: #3b82f6; font-weight: bold;');
    if (start.type === 'TASK') setIsDraggingTask(true);
  };

  const onDragUpdate = (update: any) => {
    if (update.destination) console.log(`[DRAG UPDATE] Задача над зоной: ${update.destination.droppableId}`);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type, draggableId } = result;
    console.log(`%c[DRAG END] Задача отпущена. Куда: ${destination?.droppableId || 'Мимо'}`, 'color: #10b981; font-weight: bold;');

    // Важно: меняем стейт после того как dnd закончил обработку
    if (destination?.droppableId === 'trash') {
      console.log('%c[ACTION] Удаление через корзину', 'color: #ef4444; font-weight: bold;');
      setTimeout(() => {
        onDeleteTask(draggableId);
        setSelectedTask(null);
        setIsDraggingTask(false);
      }, 100);
      return;
    }

    setIsDraggingTask(false);
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'COLUMN') {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      if (onReorderColumns) onReorderColumns(newColumns.map((col, idx) => ({ ...col, order: idx })));
      return;
    }

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;
    const sourceTasks = filteredTasks.filter(t => t.status === sourceColumnId);
    
    if (sourceColumnId === destColumnId) {
      const newTasks = Array.from(sourceTasks);
      const [removed] = newTasks.splice(source.index, 1);
      newTasks.splice(destination.index, 0, removed);
      onUpdateTasks(tasks.map(t => {
        const newTask = newTasks.find(nt => nt.id === t.id);
        return newTask ? { ...t, order: newTasks.indexOf(newTask) } : t;
      }), draggableId);
    } else {
      const taskToMove = tasks.find(t => t.id === draggableId);
      if (!taskToMove) return;
      let updatedTasks = tasks.filter(t => t.id !== draggableId);
      const destColumnTasks = updatedTasks.filter(t => t.status === destColumnId);
      destColumnTasks.splice(destination.index, 0, { ...taskToMove, status: destColumnId as TaskStatus });
      onUpdateTasks([...updatedTasks.filter(t => t.status !== destColumnId), ...destColumnTasks], draggableId);
    }
  };

  const handleEditColumn = (columnId: string, newLabel: string) => {
    if (onUpdateColumn) {
      const column = columns.find(c => c.id === columnId);
      if (column) onUpdateColumn({ ...column, label: newLabel });
    }
  };

  const handleAddColumnLocal = () => {
    if (!newColumnName.trim()) return;
    if (onAddColumn && selectedProjectId) {
      onAddColumn({ id: '', project_id: selectedProjectId, label: newColumnName.trim(), color: 'bg-slate-500', order: columns.length });
    }
    setNewColumnName('');
    setIsAddColumnModalOpen(false);
  };

  const resetTaskForm = () => {
    setNewTaskTitle(''); setNewTaskDescription('');
    setNewTaskStatus(columns[0]?.id || 'backlog');
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle, description: newTaskDescription,
      status: newTaskStatus as TaskStatus, priority: 'medium', comments: [],
      amount: parseFloat(newTaskAmount) || 0, isPaid: false, isAgreed: false
    };
    onUpdateTasks([...tasks, newTask], newTask.id);
    resetTaskForm(); setIsAddTaskModalOpen(false);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    onUpdateTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t), updatedTask.id);
    setSelectedTask(updatedTask);
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Вы уверены?')) {
      onDeleteTask(taskId);
      setSelectedTask(null);
    }
  };

  const handleAICreateTask = async (text: string) => {
    setIsProcessing(true);
    if (!supabase) return;
    const { data: settings } = await supabase.from('assistant_settings').select('*').limit(1).single();
    if (!settings) { setIsProcessing(false); return; }
    try {
      const parsed = await parseTaskWithLLM(text, settings);
      if (parsed) {
        setNewTaskTitle(parsed.title || text.slice(0, 50));
        setNewTaskDescription(parsed.description || text);
        setNewTaskAmount(parsed.amount || 0);
        setIsAddTaskModalOpen(true);
      }
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="p-6 space-y-6 relative z-10 h-full flex flex-col">
      <header>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Задачи</h1>
            {currentProject && <p className="text-indigo-400 text-sm mt-1">{currentProject.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
              <button onClick={() => setView('kanban')} className={cn("p-2 rounded-lg transition-all", view === 'kanban' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white")}><LayoutGrid size={18} /></button>
              <button onClick={() => setView('list')} className={cn("p-2 rounded-lg transition-all", view === 'list' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white")}><List size={18} /></button>
            </div>
            <button onClick={() => setIsAddColumnModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white text-sm"><Plus size={16} /><span>Колонка</span></button>
            <button onClick={() => { setNewTaskStatus(columns[0]?.id || 'backlog'); setIsAddTaskModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all text-sm"><Plus size={16} /><span>Задача</span></button>
            <VoiceInput onTranscript={handleAICreateTask} onFileTranscript={handleAICreateTask} isProcessing={isProcessing} />
          </div>
        </div>
      </header>

      {view === 'kanban' ? (
        <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
          <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar items-start">
                {columns.map((column, index) => {
                  const columnTasks = filteredTasks.filter(t => t.status === column.id);
                  return (
                    <Draggable key={column.id} draggableId={`column-${column.id}`} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <ColumnComponent column={column} tasks={columnTasks} onEdit={(label) => handleEditColumn(column.id, label)} onDelete={() => setDeleteConfirmColumn(column.id)} onAddTask={() => { setNewTaskStatus(column.id); setIsAddTaskModalOpen(true); }} onTaskClick={setSelectedTask} />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* ЗОНА УДАЛЕНИЯ (ВСЕГДА В DOM, ПОВЕРХ САЙДБАРА) */}
          <div className={cn(
            "fixed top-0 left-0 bottom-0 w-80 z-[9999] transition-all duration-500 flex items-center justify-center",
            isDraggingTask ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full pointer-events-none"
          )}>
            <Droppable droppableId="trash" type="TASK">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "w-full h-[85vh] mx-4 rounded-[40px] flex flex-col items-center justify-center transition-all duration-300 border-4 border-dashed",
                    snapshot.isDraggingOver 
                      ? "bg-red-600/60 border-red-400 scale-105 shadow-[0_0_80px_rgba(239,68,68,0.4)]" 
                      : "bg-red-500/10 border-red-500/30 text-red-500/60"
                  )}
                >
                  <div className={cn(
                    "w-28 h-28 rounded-full flex items-center justify-center mb-6 transition-all duration-300 shadow-xl",
                    snapshot.isDraggingOver ? "bg-red-500 text-white scale-125 rotate-12" : "bg-red-500/20"
                  )}>
                    <Trash2 size={56} />
                  </div>
                  <span className="text-lg font-black uppercase tracking-[0.3em]">Удалить</span>
                  <div className="mt-4 opacity-0">{provided.placeholder}</div>
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {/* (содержимое списка) */}
        </div>
      )}

      {/* Модалки */}
      <AnimatePresence>
        {selectedTask && <TaskModal task={selectedTask} columns={columns} onClose={() => setSelectedTask(null)} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />}
      </AnimatePresence>
      <AnimatePresence>
        {isAddColumnModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div onClick={() => setIsAddColumnModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">Новая колонка</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleAddColumnLocal(); }}>
                <input autoFocus value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Название" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none mb-4" />
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold transition-all">Добавить</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {deleteConfirmColumn && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div onClick={() => setDeleteConfirmColumn(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
              <h2 className="text-xl font-bold text-white mb-6 text-center">Удалить колонку?</h2>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmColumn(null)} className="flex-1 py-3 bg-white/5 text-white rounded-xl font-bold">Отмена</button>
                <button onClick={confirmDeleteColumn} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Удалить</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
