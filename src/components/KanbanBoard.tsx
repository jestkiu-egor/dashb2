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
  ArrowDown
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
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  
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
              {task.isPaid ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">Опл</span>
              ) : (
                <span className="text-slate-600">-</span>
              )}
              {task.isAgreed ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">Согл</span>
              ) : (
                <span className="text-slate-600">-</span>
              )}
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
    if (value.trim()) {
      onEdit(value.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="flex-shrink-0 w-[320px] flex flex-col bg-white/[0.02] rounded-2xl p-3 border border-white/[0.05]">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={14} className="text-slate-600 cursor-grab" />
          <div className={cn("w-2 h-2 rounded-full", column.color)} />
          {isEditing ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="bg-transparent border-b border-indigo-500 text-white text-xs font-bold outline-none w-24"
            />
          ) : (
            <span 
              onClick={() => { setIsEditing(true); setValue(column.label); }}
              className="text-white text-xs font-bold cursor-pointer hover:text-indigo-400"
            >
              {column.label}
            </span>
          )}
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
        <div className="px-2 py-2 text-center text-base text-indigo-400 font-bold mt-1 mb-2 bg-indigo-500/10 rounded-lg mx-1">
          {totalAmount.toLocaleString()} ₽
        </div>
      )}
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 min-h-[100px] space-y-2 pt-2",
              snapshot.isDraggingOver && "bg-indigo-500/5 rounded-lg"
            )}
          >
            {tasks.map((task, index) => (
              <div key={task.id} onClick={() => onTaskClick(task)}>
                <TaskCard task={task} column={column} index={index} />
              </div>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export const KanbanBoard = ({ tasks, projects, selectedProjectId, columns: dbColumns, onUpdateTasks, onSelectProject, onUpdateColumn, onDeleteColumn, onAddColumn, onReorderColumns }: KanbanBoardProps) => {
  const columns = dbColumns?.length > 0 ? dbColumns : DEFAULT_COLUMNS;
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
  
  // Filters for list view
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');

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

    // Filter by date (due date)
    if (filterDate) {
      const filterDateTime = new Date(filterDate).getTime();
      result = result.filter(t => !t.dueDate || new Date(t.dueDate).getTime() === filterDateTime);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    // Filter by payment
    if (filterPayment === 'paid') {
      result = result.filter(t => t.isPaid);
    } else if (filterPayment === 'unpaid') {
      result = result.filter(t => !t.isPaid);
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
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filteredTasks, searchQuery, sortBy, sortDir, filterDate, filterStatus, filterPayment]);

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

  const listTotalAmount = sortedAndFilteredTasks.reduce((sum, t) => sum + (t.amount || 0), 0);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Handle column reordering
    if (type === 'COLUMN') {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      const reorderedColumns = newColumns.map((col, idx) => ({ ...col, order: idx }));
      if (onReorderColumns) {
        onReorderColumns(reorderedColumns);
      } else {
        setColumns(reorderedColumns);
      }
      return;
    }

    // Handle task reordering
    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;

    const sourceTasks = filteredTasks.filter(t => t.status === sourceColumnId);
    const destTasks = sourceColumnId === destColumnId 
      ? sourceTasks 
      : filteredTasks.filter(t => t.status === destColumnId);

    if (sourceColumnId === destColumnId) {
      // Reorder within same column
      const newTasks = Array.from(sourceTasks);
      const [removed] = newTasks.splice(source.index, 1);
      newTasks.splice(destination.index, 0, removed);

      // Update all tasks with new order
      const updatedTasks = tasks.map(t => {
        const newTask = newTasks.find(nt => nt.id === t.id);
        if (newTask) {
          const newIndex = newTasks.findIndex(nt => nt.id === t.id);
          return { ...t, order: newIndex };
        }
        return t;
      });
      onUpdateTasks(updatedTasks, draggableId);
    } else {
      // Move to different column
      const taskToMove = tasks.find(t => t.id === draggableId);
      if (!taskToMove) return;

      // Remove from source
      let updatedTasks = tasks.filter(t => t.id !== draggableId);

      // Add to destination at position
      const destColumnTasks = updatedTasks.filter(t => t.status === destColumnId);
      const taskWithNewStatus = { ...taskToMove, status: destColumnId as TaskStatus };
      
      destColumnTasks.splice(destination.index, 0, taskWithNewStatus);
      
      // Rebuild tasks
      const otherTasks = updatedTasks.filter(t => t.status !== destColumnId);
      onUpdateTasks([...otherTasks, ...destColumnTasks], draggableId);
    }
  };

  const handleEditColumn = (columnId: string, newLabel: string) => {
    if (onUpdateColumn) {
      const column = columns.find(c => c.id === columnId);
      if (column) {
        onUpdateColumn({ ...column, label: newLabel });
      }
    } else {
      setColumns(columns.map(c => 
        c.id === columnId ? { ...c, label: newLabel } : c
      ));
    }
  };

  const handleDeleteColumn = (columnId: string) => {
    setDeleteConfirmColumn(columnId);
  };

  const confirmDeleteColumn = () => {
    if (deleteConfirmColumn) {
      if (onDeleteColumn) {
        onDeleteColumn(deleteConfirmColumn);
      } else {
        setColumns(columns.filter(c => c.id !== deleteConfirmColumn));
      }
      setDeleteConfirmColumn(null);
    }
  };

  const handleAddColumnLocal = () => {
    if (!newColumnName.trim()) return;
    const colors = ['bg-slate-500', 'bg-indigo-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    if (onAddColumn && selectedProjectId) {
      onAddColumn({
        id: '',
        project_id: selectedProjectId,
        label: newColumnName.trim(),
        color: colors[columns.length % colors.length],
        order: columns.length
      });
    } else {
      const newId = 'col-' + Math.random().toString(36).substr(2, 9);
      setColumns([...columns, {
        id: newId,
        label: newColumnName.trim(),
        color: colors[columns.length % colors.length]
      }]);
    }
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
    setNewTaskStatus(columns[0]?.id || 'backlog');
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
    onUpdateTasks([...tasks, newTask], newTask.id);
    resetTaskForm();
    setIsAddTaskModalOpen(false);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updatedTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    onUpdateTasks(updatedTasks, updatedTask.id);
    setSelectedTask(updatedTask);
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
      onDeleteTask(taskId);
      setSelectedTask(null);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleAICreateTask = async (text: string) => {
    console.log('AI button clicked, text:', text);
    
    setIsProcessing(true);
    
    let settings: AssistantSettings | null = null;
    let errorMessage = '';
    
    if (supabase) {
      console.log('Fetching settings from Supabase...');
      const { data, error } = await supabase
        .from('assistant_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error) {
        console.log('Error fetching settings:', error.message);
        errorMessage = 'Ошибка загрузки настроек ассистента';
      } else {
        console.log('Settings fetched:', data);
        settings = data;
      }
    } else {
      console.log('Supabase not available');
      errorMessage = 'Supabase не настроен';
    }

    if (!settings) {
      alert(errorMessage || 'Ошибка загрузки настроек');
      setIsProcessing(false);
      return;
    }

    if (!settings.proxy_host || !settings.proxy_port) {
      alert('Прокси не настроен. Перейдите в Настройки → Ассистент-парсер и настройте прокси.');
      setIsProcessing(false);
      return;
    }

    try {
      console.log('Calling LLM with settings:', settings);
      const parsed = await parseTaskWithLLM(text, settings);
      
      console.log('Parsed result:', parsed);
      
      if (parsed) {
        // Заполняем форму данными из LLM
        setNewTaskTitle(parsed.title || text.slice(0, 50));
        setNewTaskDescription(parsed.description || text);
        setNewTaskAssignee(parsed.assignee || '');
        setNewTaskDueDate(parsed.dueDate || '');
        setNewTaskAmount(parsed.amount || 0);
        
        // Открываем модалку создания задачи
        setIsAddTaskModalOpen(true);
      } else {
alert('Ошибка связи с нейронкой. Проверьте настройки прокси и API в Настройки → Ассистент-парсер');
      }
    } catch (error) {
      console.error('Error creating AI task:', error);
      alert('Ошибка связи с нейронкой. Проверьте настройки прокси и API в Настройки → Ассистент-парсер');
    } finally {
      setIsProcessing(false);
    }
  };

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
                setNewTaskStatus(columns[0]?.id || 'backlog');
                setIsAddTaskModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all text-sm"
            >
              <Plus size={16} />
              <span>Задача</span>
            </button>
            <VoiceInput 
              onTranscript={(text) => {
                setAiText(text);
                handleAICreateTask(text);
              }}
              onFileTranscript={(text) => {
                setAiText(text);
                handleAICreateTask(text);
              }}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {view === 'list' && (
          <div className="space-y-4">
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
            <div className="flex gap-3 items-center">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 [color-scheme:dark]"
                placeholder="Дата"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="all">Все статусы</option>
                {columns.map(col => (
                  <option key={col.id} value={col.id}>{col.label}</option>
                ))}
              </select>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="all">Все</option>
                <option value="paid">Оплачено</option>
                <option value="unpaid">Не оплачено</option>
              </select>
            </div>
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
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar"
              >
                {columns.map((column, index) => {
                  const baseTasks = filteredTasks.filter(t => t.status === column.id);
                  const columnTasks = kanbanSearchQuery 
                    ? baseTasks.filter(t => 
                        t.title.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
                        t.description?.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
                        t.assignee?.toLowerCase().includes(kanbanSearchQuery.toLowerCase())
                      )
                    : baseTasks;
                  return (
                    <Draggable key={column.id} draggableId={`column-${column.id}`} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <ColumnComponent
                            column={column}
                            tasks={columnTasks}
                            onEdit={(label) => handleEditColumn(column.id, label)}
                            onDelete={() => handleDeleteColumn(column.id)}
                            onAddTask={() => {
                              setNewTaskStatus(column.id);
                              setIsAddTaskModalOpen(true);
                            }}
                            onTaskClick={handleTaskClick}
                          />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
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
              <div className="col-span-2 flex items-center justify-end gap-2 cursor-pointer hover:text-white" onClick={() => handleSort('amount')}>
                Сумма <SortIcon column="amount" />
              </div>
              <div className="col-span-1 text-right">Ссылка</div>
              <div className="col-span-1"></div>
            </div>
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 bg-indigo-500/10">
              <div className="col-span-4"></div>
              <div className="col-span-2"></div>
              <div className="col-span-2"></div>
              <div className="col-span-2 text-right text-indigo-400 font-bold text-lg">
                Итого: {listTotalAmount.toLocaleString()} ₽
              </div>
              <div className="col-span-1"></div>
              <div className="col-span-1"></div>
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
                    <div className="col-span-2 text-right">
                      <span className="text-indigo-400 font-bold">{task.amount?.toLocaleString() || 0} ₽</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      {task.isPaid && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Оплачено</span>}
                      {task.comments.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
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
                    <div className="col-span-1"></div>
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
            onDelete={handleDeleteTask}
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
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
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
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="submit"
                    className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                  >
                    Создать вручную
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipboardText = await navigator.clipboard.readText();
                        if (clipboardText.trim()) {
                          handleAICreateTask(clipboardText);
                        }
                      } catch (err) {
                        console.error('Failed to read clipboard:', err);
                      }
                    }}
                    className="py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    AI
                  </button>
                </div>
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