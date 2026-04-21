import { supabase } from './supabase';
import { AssistantSettings } from '../types';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaGV4bXlraHZlZGJ4eXFwdG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3OTE5NTQsImV4cCI6MjA5MTM2Nzk1NH0.hEouIs0gLy59YlD9pgwVqzlxXvkuJC6XkqiToGUS0qs';

export interface ParsedTask {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  amount?: number;
  status?: 'backlog' | 'bugs' | 'done' | 'paid';
  externalUrl?: string;
  isPaid?: boolean;
  isAgreed?: boolean;
}

export async function parseTaskWithLLM(
  text: string,
  settings: AssistantSettings
): Promise<ParsedTask | null> {
  // Проверяем что есть настройки (прокси)
  if (!settings || !settings.proxy_host || !settings.proxy_port) {
    console.error('Proxy not configured');
    return null;
  }

  try {
    console.log('Sending to Edge Function:', { 
      text: text?.slice(0, 50), 
      hasKey: !!settings.llm_api_key,
      keyPrefix: settings.llm_api_key?.slice(0, 10),
      proxy: settings.proxy_host 
    });
    
    const response = await fetch(
      'https://aghexmykhvedbxyqptof.supabase.co/functions/v1/llm-proxy',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ text, settings }),
      }
    );

    // Если ошибка сервера - возвращаем null
    if (!response.ok) {
      const error = await response.json();
      console.error('Edge function error:', error);
      return null;
    }

    const result = await response.json();
    
    // Если в ответе есть ошибка от LLM - возвращаем null
    if (result.error) {
      console.error('LLM error:', result.error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error parsing task with LLM:', error);
    return null;
  }
}