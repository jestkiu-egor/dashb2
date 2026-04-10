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
      .single();

    if (error && error.code !== 'PGRST116') console.error('Ошибка получения настройки:', error);
    return data?.setting_value || null;
  }
};
