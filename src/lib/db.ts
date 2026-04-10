import { supabase } from './supabase';
import { Project, Proxy, Task, Transaction } from '../types';

export const db = {
  // Загрузка всех проектов со всеми связанными данными
  async fetchProjects(): Promise<Project[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        proxies (*),
        tasks (*),
        transactions (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки проектов:', error);
      return [];
    }

    return (projects || []).map(p => ({
      ...p,
      proxies: p.proxies || [],
      tasks: p.tasks || [],
      transactions: p.transactions || [],
      apiKeys: [], // Пока оставляем пустым или берем из settings
      subscriptions: []
    }));
  },

  // Создание нового проекта
  async createProject(name: string, description: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name, description }])
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания проекта:', error);
      return null;
    }

    return {
      ...data,
      proxies: [],
      tasks: [],
      transactions: [],
      apiKeys: [],
      subscriptions: []
    };
  },

  // Удаление проекта
  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) console.error('Ошибка удаления проекта:', error);
  },

  // Добавление прокси
  async addProxy(projectId: string, proxy: Partial<Proxy>) {
    const { data, error } = await supabase
      .from('proxies')
      .insert([{
        project_id: projectId,
        ip: proxy.ip,
        port: proxy.port,
        login: proxy.login,
        password_hash: proxy.passwordHash,
        proxy_type: proxy.type,
        ipv6: proxy.ipv6,
        expires_at: proxy.expiresAt?.toISOString()
      }])
      .select()
      .single();

    if (error) console.error('Ошибка добавления прокси:', error);
    return data;
  },

  // Удаление прокси
  async deleteProxy(id: string) {
    const { error } = await supabase.from('proxies').delete().eq('id', id);
    if (error) console.error('Ошибка удаления прокси:', error);
  },

  // Сохранение настроек проекта (например, API ключа)
  async saveSetting(projectId: string, key: string, value: string) {
    const { error } = await supabase
      .from('project_settings')
      .upsert({ 
        project_id: projectId, 
        setting_key: key, 
        setting_value: value 
      }, { onConflict: 'project_id, setting_key' });

    if (error) console.error('Ошибка сохранения настройки:', error);
  },

  // Получение настройки
  async getSetting(projectId: string, key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('project_settings')
      .select('setting_value')
      .eq('project_id', projectId)
      .eq('setting_key', key)
      .maybeSingle();

    if (error) console.error('Ошибка получения настройки:', error);
    return data?.setting_value || null;
  },

  // Работа с API Ключами
  async fetchApiKeys(projectId: string): Promise<ApiKey[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки API ключей:', error);
      return [];
    }

    return (data || []).map(k => ({
      id: k.id,
      name: k.name,
      key: k.key_value,
      usageLocation: k.usage_location,
      expiresAt: k.expires_at ? new Date(k.expires_at) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }));
  },

  async addApiKey(projectId: string, keyData: Partial<ApiKey>) {
    const { data, error } = await supabase
      .from('api_keys')
      .insert([{
        project_id: projectId,
        name: keyData.name,
        key_value: keyData.key,
        usage_location: keyData.usageLocation,
        expires_at: keyData.expiresAt?.toISOString()
      }])
      .select()
      .single();

    if (error) console.error('Ошибка добавления API ключа:', error);
    return data;
  },

  async deleteApiKey(id: string) {
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (error) console.error('Ошибка удаления API ключа:', error);
  },

  // Обновление статуса проверки ключа
  async updateKeyStatus(id: string, status: 'ok' | 'error', errorMessage?: string) {
    const { error } = await supabase
      .from('api_keys')
      .update({ 
        last_status: status, 
        last_check_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (status === 'error' && errorMessage) {
      await supabase.from('api_key_logs').insert([{
        key_id: id,
        error_message: errorMessage
      }]);
    }
  },

  // Получение логов для ключа
  async fetchKeyLogs(keyId: string) {
    const { data, error } = await supabase
      .from('api_key_logs')
      .select('*')
      .eq('key_id', keyId)
      .order('created_at', { ascending: false });
    return error ? [] : data;
  },

  // Очистка логов
  async clearKeyLogs(keyId: string) {
    await supabase.from('api_key_logs').delete().eq('key_id', keyId);
  }
};
