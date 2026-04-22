import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Plus, Settings, ChevronRight, Search, Loader2, Archive, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface Assistant {
  id: string;
  name: string;
  description: string;
  created_at: string;
  is_archived: boolean;
}

interface IntegrationsPageProps {
  onSelectAssistant: (id: string) => void;
}

export const IntegrationsPage = ({ onSelectAssistant }: IntegrationsPageProps) => {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAssistants();
  }, []);

  const loadAssistants = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('assistants')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssistants(data || []);
    } catch (err) {
      console.error('Ошибка загрузки ассистентов:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    try {
      const { error } = await supabase
        .from('assistants')
        .insert([{
          id: slug,
          name: newName,
          description: newDescription,
        }]);

      if (error) throw error;
      
      setAssistants(prev => [{
        id: slug,
        name: newName,
        description: newDescription,
        created_at: new Date().toISOString(),
        is_archived: false,
      }, ...prev]);
      
      setIsCreating(false);
      setNewName('');
      setNewDescription('');
      onSelectAssistant(slug);
    } catch (err) {
      console.error('Ошибка создания:', err);
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('assistants')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      setAssistants(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Ошибка архивации:', err);
    }
  };

  const filteredAssistants = assistants.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Интеграции</h1>
              <p className="text-slate-400 text-sm">Управление AI ассистентами</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
          >
            <Plus size={18} />
            Новый ассистент
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            <AnimatePresence>
              {isCreating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 bg-white/[0.02] rounded-2xl border border-white/5 p-6 overflow-hidden"
                >
                  <h3 className="text-lg font-bold text-white mb-4">Создание нового ассистента</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Название</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Например: Ассистент-парсер"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Описание</label>
                      <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Например: Настройки AI и прокси для парсинга задач"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCreate}
                        disabled={!newName.trim()}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50"
                      >
                        Создать
                      </button>
                      <button
                        onClick={() => { setIsCreating(false); setNewName(''); setNewDescription(''); }}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-slate-400 rounded-xl"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {assistants.length === 0 && !isCreating ? (
              <div className="text-center py-20">
                <Bot className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">Нет ассистентов</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Создать первого ассистента
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAssistants.map((assistant) => (
                  <button
                    key={assistant.id}
                    onClick={() => onSelectAssistant(assistant.id)}
                    className="group relative bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl border border-white/5 hover:border-white/10 p-6 text-left transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-600/50 to-pink-600/50 rounded-xl flex items-center justify-center">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{assistant.name}</h3>
                          <p className="text-sm text-slate-400">{assistant.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                    <button
                      onClick={(e) => handleArchive(assistant.id, e)}
                      className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                      title="Архивировать"
                    >
                      <Archive size={14} className="text-slate-400" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;