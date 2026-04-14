import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Loader2, Bot, Plus, Clipboard, Zap, Pencil, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AssistantSettings } from '../types';
import { cn } from '../lib/utils';

interface AssistantPageProps {
  isOpen?: boolean;
}

const parseProxyString = (proxyString: string): { host: string; port: number; login: string; password: string } | null => {
  const parts = proxyString.trim().split(':');
  if (parts.length !== 4) return null;
  
  const [host, portStr, login, password] = parts;
  const port = parseInt(portStr, 10);
  
  if (!host || isNaN(port) || !login || !password) return null;
  
  return { host, port, login, password };
};

export const AssistantPage = ({ isOpen = true }: AssistantPageProps) => {
  const [settings, setSettings] = useState<AssistantSettings>({
    id: '',
    llm_api_url: '',
    llm_model: 'llama-3.3-70b-versatile',
    llm_api_key: '',
    llm_prompt: '',
    proxy_host: '',
    proxy_port: 0,
    proxy_login: '',
    proxy_password: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'ok' | 'error' | null>(null);
  const [proxyStatus, setProxyStatus] = useState<'ok' | 'error' | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('assistant_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          llm_api_url: data.llm_api_url || '',
          llm_model: data.llm_model || 'llama-3.3-70b-versatile',
          llm_api_key: data.llm_api_key || '',
          llm_prompt: data.llm_prompt || '',
          proxy_host: data.proxy_host || '',
          proxy_port: data.proxy_port || 0,
          proxy_login: data.proxy_login || '',
          proxy_password: data.proxy_password || '',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) {
      setMessage('Supabase не настроен. Проверьте .env файл.');
      return;
    }
    setIsSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('assistant_settings')
        .upsert({
          id: settings.id || undefined,
          llm_api_url: settings.llm_api_url,
          llm_model: settings.llm_model,
          llm_api_key: settings.llm_api_key,
          llm_prompt: settings.llm_prompt,
          proxy_host: settings.proxy_host,
          proxy_port: settings.proxy_port,
          proxy_login: settings.proxy_login,
          proxy_password: settings.proxy_password,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      setMessage('Настройки сохранены!');
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportProxy = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsed = parseProxyString(clipboardText);
      
      if (parsed) {
        setSettings({
          ...settings,
          proxy_host: parsed.host,
          proxy_port: parsed.port,
          proxy_login: parsed.login,
          proxy_password: parsed.password,
        });
        setMessage('Прокси импортировано из буфера!');
      } else {
        setMessage('Неверный формат прокси. Ожидается: ip:port:login:password');
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
      setMessage('Не удалось прочитать буфер обмена');
    }
  };

  const checkApiKey = async () => {
    if (!settings.llm_api_key) {
      setKeyStatus('error');
      return;
    }
    
    setIsCheckingKey(true);
    setKeyStatus(null);
    
    try {
      const apiUrl = settings.llm_api_url 
        ? settings.llm_api_url.replace('/chat/completions', '/models')
        : 'https://api.groq.com/openai/v1/models';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.llm_api_key}`,
        }
      });
      
      if (response.ok) {
        setKeyStatus('ok');
      } else {
        const errorText = await response.text();
        console.error('API Key check failed:', response.status, errorText);
        setKeyStatus('error');
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      setKeyStatus('error');
    } finally {
      setIsCheckingKey(false);
    }
  };

  const checkProxy = async () => {
    if (!settings.proxy_host || !settings.proxy_port) {
      setProxyStatus('error');
      return;
    }
    
    setIsCheckingProxy(true);
    setProxyStatus(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const proxyUrl = settings.proxy_login && settings.proxy_password
        ? `http://${settings.proxy_login}:${settings.proxy_password}@${settings.proxy_host}:${settings.proxy_port}`
        : `http://${settings.proxy_host}:${settings.proxy_port}`;

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 401) {
        setProxyStatus('ok');
      } else {
        setProxyStatus('error');
      }
    } catch (error) {
      console.error('Error checking proxy:', error);
      setProxyStatus('error');
    } finally {
      setIsCheckingProxy(false);
    }
  };

  if (!isOpen) return null;

  if (!supabase) {
    return (
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Ассистент</h1>
              <p className="text-slate-400 text-sm">Настройки AI и прокси</p>
            </div>
          </div>
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-red-400">
            <p className="font-bold mb-2">Supabase не настроен</p>
            <p className="text-sm">Проверьте файл .env и укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Ассистент</h1>
              <p className="text-slate-400 text-sm">Настройки AI и прокси</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
            Сохранить
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-6 animate-pulse">
              <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
              <div className="space-y-4">
                <div className="h-12 bg-white/5 rounded-xl"></div>
                <div className="h-12 bg-white/5 rounded-xl"></div>
                <div className="h-24 bg-white/5 rounded-xl"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mb-6 p-4 rounded-xl",
                  message.includes('Ошибка') 
                    ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                )}
              >
                {message}
              </motion.div>
            )}

            <div className="space-y-6">
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-bold text-white mb-4">LLM Настройки</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-400 mb-2">API URL</label>
                    <input
                      type="url"
                      value={settings.llm_api_url}
                      onChange={(e) => setSettings({ ...settings, llm_api_url: e.target.value })}
                      placeholder="https://api.llm.example.com/v1/chat/completions"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-400 mb-2">Модель</label>
                    <input
                      type="text"
                      value={settings.llm_model}
                      onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
                      placeholder="llama-3.3-70b-versatile"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-400 mb-2">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={settings.llm_api_key}
                        onChange={(e) => { setSettings({ ...settings, llm_api_key: e.target.value }); setKeyStatus(null); }}
                        placeholder="gsk_..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={checkApiKey}
                        disabled={isCheckingKey || !settings.llm_api_key}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isCheckingKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : keyStatus === 'ok' ? (
                          <span className="text-green-400">✓</span>
                        ) : keyStatus === 'error' ? (
                          <span className="text-red-400">✗</span>
                        ) : (
                          <span className="text-slate-400">Проверить</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-400 mb-2">Промпт для парсинга</label>
                    {isEditingPrompt ? (
                      <div className="space-y-2">
                        <textarea
                          value={settings.llm_prompt}
                          onChange={(e) => setSettings({ ...settings, llm_prompt: e.target.value })}
                          placeholder="Промпт, который отправляется в LLM..."
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPrompt(false)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-1"
                          >
                            <Check size={14} />
                            Сохранить
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingPrompt(false)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-400 rounded-lg text-sm"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm font-mono max-h-24 overflow-y-auto">
                          {settings.llm_prompt || 'Промпт не задан - будет использоваться стандартный:\nТы парсишь задачу. Верни JSON с полями: title, description, assignee, dueDate (YYYY-MM-DD), amount, priority (low/medium/high), externalUrl. Верни ТОЛЬКО валидный JSON без markdown.'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingPrompt(true)}
                          className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                          title="Редактировать промпт"
                        >
                          <Pencil size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Прокси</h2>
                
                <div className="mb-4 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <label className="block text-sm font-bold text-indigo-400 mb-2">Быстрая вставка proxy</label>
                  <div className="flex gap-2">
                    <input
                      id="proxy-quick-input"
                      type="text"
                      placeholder="ip:port:login:password (например 161.115.231.113:9149:UZtsa1:h4fKKh)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      onChange={(e) => {
                        const parsed = parseProxyString(e.target.value);
                        if (parsed) {
                          setSettings({
                            ...settings,
                            proxy_host: parsed.host,
                            proxy_port: parsed.port,
                            proxy_login: parsed.login,
                            proxy_password: parsed.password,
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleImportProxy}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2"
                    >
                      <Clipboard size={18} />
                      Из буфера
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">IP адрес</label>
                    <input
                      type="text"
                      value={settings.proxy_host}
                      onChange={(e) => setSettings({ ...settings, proxy_host: e.target.value })}
                      placeholder="192.168.1.1"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Порт</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={settings.proxy_port || ''}
                        onChange={(e) => { setSettings({ ...settings, proxy_port: parseInt(e.target.value) || 0 }); setProxyStatus(null); }}
                        placeholder="8080"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={checkProxy}
                        disabled={isCheckingProxy || !settings.proxy_host || !settings.proxy_port}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isCheckingProxy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : proxyStatus === 'ok' ? (
                          <span className="text-green-400">✓</span>
                        ) : proxyStatus === 'error' ? (
                          <span className="text-red-400">✗</span>
                        ) : (
                          <span className="text-slate-400">Проверить</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Логин</label>
                    <input
                      type="text"
                      value={settings.proxy_login}
                      onChange={(e) => setSettings({ ...settings, proxy_login: e.target.value })}
                      placeholder="username"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Пароль</label>
                    <input
                      type="password"
                      value={settings.proxy_password}
                      onChange={(e) => setSettings({ ...settings, proxy_password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};