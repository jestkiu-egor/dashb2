import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, X, FileText, Image, File } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskComment } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && !file) return;
    setIsLoading(true);

    let fileUrl = '';
    let fileName = '';

    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${taskId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('task-attachments')
        .upload(path, file);
      if (!error) {
        const { data } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(path);
        fileUrl = data.publicUrl;
        fileName = file.name;
      }
    }

    const { data } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        text: newComment.trim(),
        file_url: fileUrl || null,
        file_name: fileName || null,
      })
      .select()
      .single();

    if (data) {
      setComments([...comments, data]);
      setNewComment('');
      setFile(null);
    }
    setIsLoading(false);
  };

  const getFileIcon = (url: string) => {
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return Image;
    if (url.match(/\.pdf$/i)) return FileText;
    return File;
  };

  return (
    <div className="flex flex-col h-full border-t border-white/10">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-white font-bold">Комментарии</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {comments.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              Пока нет комментариев
            </div>
          ) : (
            comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs">
                    {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-slate-200 text-sm whitespace-pre-wrap">
                  {comment.text}
                </p>
                {comment.file_url && (
                  <a
                    href={comment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm"
                  >
                    {(() => {
                      const Icon = getFileIcon(comment.file_url!);
                      return <Icon size={16} />;
                    })()}
                    {comment.file_name || 'Файл'}
                  </a>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-white/10 bg-slate-900/50">
        {file && (
          <div className="mb-3 flex items-center gap-2 bg-white/5 rounded-lg p-2">
            <Paperclip size={14} className="text-slate-400" />
            <span className="text-slate-300 text-sm flex-1 truncate">
              {file.name}
            </span>
            <button
              onClick={() => setFile(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="p-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Paperclip size={18} className="text-slate-400" />
          </label>
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Написать комментарий..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 text-sm"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || (!newComment.trim() && !file)}
            className={cn(
              "p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors",
              (isLoading || (!newComment.trim() && !file)) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}