import { supabase } from './supabase';
import { Project, Proxy, Task, Transaction, ApiKey } from '../types';

export const db = {
  // Загрузка всех проектов со всеми связанными данными + Маппинг полей
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
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: new Date(p.created_at),
      // МАППИНГ ПРОКСИ
      proxies: (p.proxies || []).map((pr: any) => ({
        id: pr.id,
        ip: pr.ip,
        port: pr.port,
        login: pr.login,
        passwordHash: pr.password_hash,
        type: pr.proxy_type,
        ipv6: pr.ipv6,
        expiresAt: new Date(pr.expires_at)
      })),
      // МАППИНГ ЗАДАЧ
      tasks: (p.tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date ? new Date(t.due_date) : undefined,
        amount: t.amount,
        isPaid: t.is_paid,
        isAgreed: t.is_agreed,
        externalUrl: t.external_url,
        comments: t.comments || []
      })),
      // МАППИНГ ТРАНЗАКЦИЙ
      transactions: (p.transactions || []).map((tr: any) => ({
        id: tr.id,
        name: tr.name,
        amount: tr.amount,
        type: tr.transaction_type,
        category: tr.category,
        date: new Date(tr.date),
        status: tr.status
      })),
      apiKeys: [], 
      subscriptions: []
    }));
  },

  async createProject(name: string, description: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name, description }])
      .select()
      .single();

    if (error) return null;
    return { ...data, proxies: [], tasks: [], transactions: [], apiKeys: [], subscriptions: [], createdAt: new Date(data.created_at) };
  },

  async deleteProject(id: string) {
    await supabase.from('projects').delete().eq('id', id);
  },

  async updateProject(id: string, updates: { name: string, description: string }): Promise<boolean> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id);
    if (error) {
      console.error('Ошибка обновления проекта:', error);
      return false;
    }
    return true;
  },

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
    return data;
  },

  async updateProxy(id: string, updates: Partial<Proxy>) {
    await supabase
      .from('proxies')
      .update({
        expires_at: updates.expiresAt?.toISOString(),
        proxy_type: updates.type,
        ip: updates.ip,
        port: updates.port
      })
      .eq('id', id);
  },

  async deleteProxy(id: string) {
    await supabase.from('proxies').delete().eq('id', id);
  },

  async saveSetting(projectId: string, key: string, value: string) {
    await supabase.from('project_settings').upsert({ project_id: projectId, setting_key: key, setting_value: value }, { onConflict: 'project_id, setting_key' });
  },

  async getSetting(projectId: string, key: string): Promise<string | null> {
    const { data } = await supabase.from('project_settings').select('setting_value').eq('project_id', projectId).eq('setting_key', key).maybeSingle();
    return data?.setting_value || null;
  },

  async fetchApiKeys(projectId: string): Promise<ApiKey[]> {
    const { data } = await supabase.from('api_keys').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    return (data || []).map(k => ({
      id: k.id,
      name: k.name,
      key: k.key_value,
      usageLocation: k.usage_location,
      comment: k.comment,
      expiresAt: k.expires_at ? new Date(k.expires_at) : new Date(),
      last_status: k.last_status,
      last_check_at: k.last_check_at
    }));
  },

  async addApiKey(projectId: string, keyData: Partial<ApiKey>) {
    const { data } = await supabase.from('api_keys').insert([{ 
      project_id: projectId, 
      name: keyData.name, 
      key_value: keyData.key, 
      usage_location: keyData.usageLocation,
      comment: keyData.comment
    }]).select().single();
    return data;
  },

  async updateApiKey(id: string, updates: Partial<ApiKey>) {
    const { error } = await supabase
      .from('api_keys')
      .update({
        comment: updates.comment,
        usage_location: updates.usageLocation,
        name: updates.name
      })
      .eq('id', id);
    if (error) console.error('Ошибка обновления API ключа:', error);
  },

  async deleteApiKey(id: string) {
    await supabase.from('api_keys').delete().eq('id', id);
  },

  async updateKeyStatus(id: string, status: 'ok' | 'error', errorMessage?: string) {
    await supabase.from('api_keys').update({ last_status: status, last_check_at: new Date().toISOString() }).eq('id', id);
    if (status === 'error' && errorMessage) {
      await supabase.from('api_key_logs').insert([{ key_id: id, error_message: errorMessage }]);
    }
  },

  async fetchKeyLogs(keyId: string) {
    const { data } = await supabase.from('api_key_logs').select('*').eq('key_id', keyId).order('created_at', { ascending: false });
    return data || [];
  },

  async clearKeyLogs(keyId: string) {
    await supabase.from('api_key_logs').delete().eq('key_id', keyId);
  }
};
