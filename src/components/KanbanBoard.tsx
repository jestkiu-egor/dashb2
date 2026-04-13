import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Clock, 
  MessageSquare,
  X,
  ExternalLink,
  Folder,
  GripVertical,
  Sparkles,
  Trash2,
  Check,
  LayoutGrid,
  List,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Task, TaskStatus, Project } from '../types';
import { format, isPast } from 'date-fns';
import { cn } from '../lib/utils';
import { VoiceInput } from '../lib/VoiceInput';
import { parseTaskWithAI } from '../lib/groq';

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  selectedProjectId: string | null;
  onUpdateTasks: (tasks: Task[]) => void;
  onSelectProject: (projectId: string | null) => void;
}

interface Column {
  id: string;
  label: string;
  color: string;
}

const DEFAULT_COLUMNS: Column[] = [
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
}

function TaskModal({ task, columns, onClose, onUpdate }: TaskModalProps) {
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
        className="relative w-full max-w-2xl h-full bg-slate-950 border-l border-white/10 flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", column?.color)} />
            <span className="text-slate-400 text-sm">{column?.label}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <h2 className="text-2xl font-bold text-white mb-6">{task.title}</h2>
          
          {task.description && (
            <div className="mb-6">
              <h3 className="text-slate-400 text-sm font-bold uppercase mb-2">Описание</h3>
              <p className="text-slate-300">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-slate-400 text-sm font-bold uppercase mb-2">Сумма</h3>
              <span className="text-indigo-400 font-bold text-xl">
                {task.amount?.toLocaleString() || 0} ₽
              </span>
            </div>
            <div>
              <h3 className="text-slate-400 text-sm font-bold uppercase mb-2">Оплата</h3>
              <button
                onClick={() => setEditedTask({ ...editedTask, isPaid: !task.isPaid })}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold border",
                  task.isPaid 
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                    : "bg-white/5 border-white/10 text-slate-400"
                )}
              >
                {task.isPaid ? 'Оплачено' : 'Не оплачено'}
              </button>
            </div>
          </div>

          {task.externalUrl && (
            <div className="mb-6">
              <h3 className="text-slate-400 text-sm font-bold uppercase mb-2">Ссылка</h3>
              <a href={task.externalUrl} target="_blank" rel="noreferrer" 
                className="text-indigo-400 hover:text-indigo-300 break-all">
                {task.externalUrl}
              </a>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-2">Статус</h3>
            <div className="flex flex-wrap gap-2">
              {columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => setEditedTask({ ...editedTask, status: col.id as TaskStatus })}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                    task.status === col.id 
                      ? "bg-indigo-600 border-indigo-500 text-white" 
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/30"
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TaskCard({ task, column }: { task: Task; column: Column }) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className="bg-slate-900/60 border border-white/10 p-4 rounded-xl hover:border-indigo-500/30 transition-all cursor-pointer"
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
          <Clock size={12} />
          <span className={cn(isOverdue && "text-red-400 font-bold")}>
            {task.dueDate ? format(new Date(task.dueDate), 'dd.MM') : '-'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {task.comments.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {task.comments.length}
            </span>
          )}
          {task.externalUrl && (
            <a href={task.externalUrl} target="_blank" rel="noreferrer" 
              className="text-indigo-400 hover:text-indigo-300"
              onClick={(e) => e.stopPropagation()}>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SortableTaskCard({ task, column, onClick }: { task: Task; column: Column; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task' } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 150ms ease',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={false}
      animate={isDragging 
        ? { opacity: 0.5, scale: 1.02, boxShadow: "0 10px 40px rgba(99, 102, 241, 0.3)" } 
        : { opacity: 1, scale: 1, boxShadow: "none" }}
      className={cn(isDragging && "z-50 cursor-grabbing")}
      {...attributes}
      {...listeners}
    >
      <div onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <TaskCard task={task} column={column} />
      </div>
    </motion.div>
  );
}

function SortableColumn({ column, tasks, onEdit, onDelete, onAddTask, onTaskClick, onDragOver, onDragLeave, isOver }: { 
  column: Column; 
  tasks: Task[];
  onEdit: (newLabel: string) => void;
  onDelete: () => void;
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  isOver?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column-${column.id}`, data: { type: 'column' } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 150ms ease',
  };

  const totalAmount = tasks.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <motion.div 
      ref={setNodeRef}
      style={style}
      layout
      animate={isDragging ? { scale: 1.02, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" } : { scale: 1, boxShadow: "none" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "flex-shrink-0 w-72 flex flex-col bg-white/[0.02] rounded-2xl p-3 border transition-colors",
        isDragging ? "z-50 opacity-90 border-indigo-500/50 cursor-grabbing" : "border-white/[0.05]",
        isOver && "border-indigo-500/50 bg-indigo-500/5"
      )}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-400 touch-none select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </div>
          <div className={cn("w-2 h-2 rounded-full", column.color)} />
          <ColumnNameEditor 
            label={column.label} 
            onSave={onEdit} 
          />
          <span className="text-slate-500 text-xs bg-white/5 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button 
            onClick={onDelete}
            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button 
            onClick={onAddTask}
            className="p-1 text-slate-500 hover:text-white transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      {totalAmount > 0 && (
        <div className="px-2 text-sm text-indigo-400 font-bold mt-1">
          {totalAmount.toLocaleString()} ₽
        </div>
      )}
      <div className="flex-1 min-h-[100px] pt-3">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <AnimatePresence>
              {tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  column={column}
                  onClick={() => onTaskClick(task)}
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </div>
    </motion.div>
  );
}

export const KanbanBoard = ({ tasks, projects, selectedProjectId, onUpdateTasks, onSelectProject }: KanbanBoardProps) => {
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('todo');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAmount, setNewTaskAmount] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteConfirmColumn, setDeleteConfirmColumn] = useState<string | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'status' | 'date'>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const filteredTasks = selectedProjectId 
    ? tasks.filter(t => tasks.includes(t))
    : tasks;

  const sortedAndFilteredTasks = useMemo(() => {
    let result = [...filteredTasks];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'date':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filteredTasks, searchQuery, sortBy, sortDir]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return <ArrowUpDown size={14} className="text-slate-500" />;
    return sortDir === 'asc' ? <ArrowUp size={14} className="text-indigo-400" /> : <ArrowDown size={14} className="text-indigo-400" />;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    
    if (activeIdStr.startsWith('column-')) {
      const columnId = activeIdStr.replace('column-', '');
      const overIdStr = over.id as string;
      
      if (overIdStr.startsWith('column-') && columnId !== overIdStr.replace('column-', '')) {
        const oldIndex = columns.findIndex(c => `column-${c.id}` === activeIdStr);
        const newIndex = columns.findIndex(c => `column-${c.id}` === overIdStr);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newColumns = [...columns];
          const [removed] = newColumns.splice(oldIndex, 1);
          newColumns.splice(newIndex, 0, removed);
          setColumns(newColumns);
        }
      }
      return;
    }

    const activeTask = tasks.find(t => t.id === activeIdStr);
    if (!activeTask) return;

    let newStatus = activeTask.status;

    if (overColumnId) {
      newStatus = overColumnId;
    } else {
      const overIdStr = over.id as string;
      if (overIdStr.startsWith('column-')) {
        newStatus = overIdStr.replace('column-', '') as TaskStatus;
      } else {
        const overTask = tasks.find(t => t.id === overIdStr);
        if (overTask) {
          newStatus = overTask.status;
        }
      }
    }

    if (newStatus !== activeTask.status) {
      const updatedTasks = tasks.map(t => 
        t.id === activeIdStr ? { ...t, status: newStatus } : t
      );
      onUpdateTasks(updatedTasks);
    }
  };

  const handleEditColumn = (columnId: string, newLabel: string) => {
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, label: newLabel } : c
    ));
  };

  const handleDeleteColumn = (columnId: string) => {
    setDeleteConfirmColumn(columnId);
  };

  const confirmDeleteColumn = () => {
    if (deleteConfirmColumn) {
      setColumns(columns.filter(c => c.id !== deleteConfirmColumn));
      setDeleteConfirmColumn(null);
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    const newId = 'col-' + Math.random().toString(36).substr(2, 9);
    const colors = ['bg-slate-500', 'bg-indigo-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    setColumns([...columns, {
      id: newId,
      label: newColumnName.trim(),
      color: colors[columns.length % colors.length]
    }]);
    setNewColumnName('');
    setIsAddColumnModalOpen(false);
  };

  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskDueDate('');
    setNewTaskAmount('');
    setNewTaskLink('');
    setNewTaskDescription('');
    setNewTaskStatus('todo');
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      description: newTaskDescription,
      status: newTaskStatus as TaskStatus,
      priority: 'medium',
      comments: [],
      dueDate: newTaskDueDate ? new Date(newTaskDueDate) : undefined,
      amount: newTaskAmount ? parseFloat(newTaskAmount) : 0,
      isPaid: false,
      isAgreed: false,
      externalUrl: newTaskLink || undefined,
      assignee: newTaskAssignee || undefined,
    };
    onUpdateTasks([...tasks, newTask]);
    resetTaskForm();
    setIsAddTaskModalOpen(false);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updatedTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    onUpdateTasks(updatedTasks);
    setSelectedTask(updatedTask);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleAICreateTask = async (text: string) => {
    setIsProcessing(true);
    setAiModalOpen(false);
    
    try {
      const parsed = await parseTaskWithAI(text);
      
      if (parsed) {
        const newTask: Task = {
          id: Math.random().toString(36).substr(2, 9),
          title: parsed.title || text.slice(0, 50),
          description: parsed.description || text,
          status: 'todo',
          priority: parsed.priority || 'medium',
          comments: [],
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
          amount: parsed.amount || 0,
          isPaid: false,
          isAgreed: false,
          externalUrl: parsed.externalUrl,
          assignee: parsed.assignee,
        };
        onUpdateTasks([...tasks, newTask]);
      } else {
        const newTask: Task = {
          id: Math.random().toString(36).substr(2, 9),
          title: text.slice(0, 50),
          description: text,
          status: 'todo',
          priority: 'medium',
          comments: [],
          dueDate: undefined,
          amount: 0,
          isPaid: false,
          isAgreed: false,
        };
        onUpdateTasks([...tasks, newTask]);
      }
    } catch (error) {
      console.error('Error creating AI task:', error);
    } finally {
      setIsProcessing(false);
      setAiText('');
      setAiInputText('');
    }
  };

  const activeTask = activeId && !activeId.startsWith('column-') ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="p-6 space-y-6 relative z-10 h-full flex flex-col">
      <header>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Задачи</h1>
            {currentProject && (
              <p className="text-indigo-400 text-sm mt-1">{currentProject.name}</p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  view === 'kanban' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  view === 'list' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"
                )}
              >
                <List size={18} />
              </button>
            </div>
            <button
              onClick={() => setIsAddColumnModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white text-sm"
            >
              <Plus size={16} />
              <span>Колонка</span>
            </button>
            <button
              onClick={() => {
                setNewTaskStatus('todo');
                setIsAddTaskModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all text-sm"
            >
              <Plus size={16} />
              <span>Задача</span>
            </button>
            <VoiceInput 
              onTranscript={(text) => setAiText(text)}
              onFileTranscript={(text) => setAiText(text)}
              isProcessing={isProcessing}
            />
            <button
              onClick={() => {
                if (aiText) {
                  handleAICreateTask(aiText);
                } else {
                  setAiModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all text-sm"
            >
              <Sparkles size={16} />
              <span>AI</span>
            </button>
          </div>
        </div>

        {view === 'list' && (
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск задач..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}
      </header>

      {view === 'kanban' && (
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={kanbanSearchQuery}
            onChange={(e) => setKanbanSearchQuery(e.target.value)}
            placeholder="Поиск задач..."
            className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>
      )}

      {view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar">
            <SortableContext items={columns.map(c => `column-${c.id}`)} strategy={horizontalListSortingStrategy}>
              {columns.map((column) => {
                const baseTasks = filteredTasks.filter(t => t.status === column.id);
                const columnTasks = kanbanSearchQuery 
                  ? baseTasks.filter(t => 
                      t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
                      t.description?.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
                      t.assignee?.toLowerCase().includes(kanbanSearchQuery.toLowerCase())
                    )
                  : baseTasks;
                return (
                  <SortableColumn
                    key={column.id}
                    column={column}
                    tasks={columnTasks}
                    onEdit={(label) => handleEditColumn(column.id, label)}
                    onDelete={() => handleDeleteColumn(column.id)}
                    onAddTask={() => {
                      setNewTaskStatus(column.id);
                      setIsAddTaskModalOpen(true);
                    }}
                    onTaskClick={handleTaskClick}
                    onDragOver={() => setOverColumnId(column.id)}
                    onDragLeave={() => setOverColumnId(null)}
                    isOver={overColumnId === column.id}
                  />
                );
              })}
            </SortableContext>
          </div>

          <DragOverlay>
            {activeId && activeId.startsWith('column-') && (
              <div className="bg-slate-900/90 border border-indigo-500/50 rounded-2xl p-3 shadow-2xl w-72 opacity-90">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-slate-400" />
                  <div className={cn("w-2 h-2 rounded-full", columns.find(c => c.id === activeId.replace('column-', ''))?.color)} />
                  <span className="text-white font-bold uppercase text-xs">
                    {columns.find(c => c.id === activeId.replace('column-', ''))?.label}
                  </span>
                </div>
              </div>
            )}
            {activeTask && (
              <div className="bg-slate-900/90 border border-indigo-500/50 p-4 rounded-xl shadow-2xl w-72 opacity-90 cursor-grabbing">
                <h4 className="text-white font-medium text-sm">{activeTask.title}</h4>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 text-xs font-bold text-slate-500 uppercase">
              <div className="col-span-4 flex items-center gap-2 cursor-pointer hover:text-white" onClick={() => handleSort('title')}>
                Название <SortIcon column="title" />
              </div>
              <div className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-white" onClick={() => handleSort('status')}>
                Статус <SortIcon column="status" />
              </div>
              <div className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-white" onClick={() => handleSort('date')}>
                Дата <SortIcon column="date" />
              </div>
              <div className="col-span-2 text-right">Сумма</div>
              <div className="col-span-2"></div>
            </div>
            {sortedAndFilteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {searchQuery ? 'Ничего не найдено' : 'Нет задач'}
              </div>
            ) : (
              sortedAndFilteredTasks.map((task) => {
                const column = columns.find(c => c.id === task.status);
                const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors items-center"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", column?.color)} />
                      <span className="text-white font-medium truncate">{task.title}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-sm">{column?.label}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Clock size={14} className={cn("text-slate-500", isOverdue && "text-red-400")} />
                      <span className={cn("text-sm", isOverdue ? "text-red-400 font-bold" : "text-slate-400")}>
                        {task.dueDate ? format(new Date(task.dueDate), 'dd.MM.yyyy') : '-'}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-indigo-400 font-bold">
                      {task.amount?.toLocaleString() || 0} ₽
                    </div>
                    <div className="col-span-2 flex items-center gap-3 text-slate-500">
                      {task.comments.length > 0 && (
                        <span className="flex items-center gap-1 text-xs">
                          <MessageSquare size={12} />
                          {task.comments.length}
                        </span>
                      )}
                      {task.externalUrl && (
                        <a href={task.externalUrl} target="_blank" rel="noreferrer" 
                          className="text-indigo-400 hover:text-indigo-300"
                          onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedTask && (
          <TaskModal 
            task={selectedTask} 
            columns={columns}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdateTask}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddColumnModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddColumnModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Новая колонка</h2>
                <button 
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleAddColumn(); }}>
                <input
                  autoFocus
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Название колонки"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 mb-4"
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Добавить
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddTaskModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { resetTaskForm(); setIsAddTaskModalOpen(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Новая задача</h2>
                <button 
                  onClick={() => { resetTaskForm(); setIsAddTaskModalOpen(false); }}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Название *</label>
                  <input
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Что нужно сделать?"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">Постановщик</label>
                    <input
                      type="text"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      placeholder="Имя"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">Крайний срок</label>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Сумма (₽)</label>
                  <input
                    type="number"
                    value={newTaskAmount}
                    onChange={(e) => setNewTaskAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Ссылка (Битрикс24)</label>
                  <input
                    type="url"
                    value={newTaskLink}
                    onChange={(e) => setNewTaskLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Описание</label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Детали задачи..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Статус</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                  >
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Создать задачу
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmColumn && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold text-white mb-2">Удалить колонку?</h2>
              <p className="text-slate-400 text-sm mb-6">
                Задачи в этой колонке останутся, но будут без статуса.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmColumn(null)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmDeleteColumn}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAiModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-purple-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Создать задачу с помощью ИИ</h2>
                </div>
                <button 
                  onClick={() => setAiModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Опишите задачу обычным текстом. ИИ распознает название, срок, сумму, исполнителя и создаст задачу.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); handleAICreateTask(aiInputText); }}>
                <textarea
                  autoFocus
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="Например: Нужно сделать лендинг для клиента Сидоров до пятницы, бюджет 50 тысяч, ответственный Петр"
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAiModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!aiInputText.trim() || isProcessing}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {isProcessing ? 'Обработка...' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function ColumnNameEditor({ label, onSave }: { label: string; onSave: (label: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(label);

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="bg-transparent border-b border-indigo-500 text-white text-xs font-bold uppercase outline-none w-24"
      />
    );
  }

  return (
    <span 
      onClick={() => { setIsEditing(true); setValue(label); }}
      className="text-white text-xs font-bold uppercase cursor-pointer hover:text-indigo-400 transition-colors"
    >
      {label}
    </span>
  );
}
