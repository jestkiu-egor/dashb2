import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { parseTaskWithLLM, ParsedTask } from '../lib/llm';
import { AssistantSettings } from '../types';

dotenv.config();

const logFile = 'bot_errors.log';
const logger = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
};

logger('Инициализация бота...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface Session {
  title: string;
  amount: number;
  projectId?: string;
  projectName?: string;
  status?: 'backlog' | 'bugs' | 'done' | 'paid';
  description?: string;
  isPaid?: boolean;
  isAgreed?: boolean;
  externalUrl?: string;
}

const sessions = new Map<number, Session>();

bot.start((ctx) => {
  const userId = ctx.from.id;
  logger(`[START] Пользователь ${userId}`);
  sessions.delete(userId);
  ctx.reply('Привет! Присылай мне задачи в свободном формате. Пример: "Дать доступ менеджеру до пятницы - 500 рублей"');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  logger(`[TEXT] от ${ctx.from.username || userId}: "${text}"`);

  const amountMatch = text.match(/(\d+)\s*(рублей|руб|р|₽)/i);
  let amount = 0;
  if (amountMatch) {
    amount = parseInt(amountMatch[1]);
  }

  const title = text.replace(/(\d+)\s*(рублей|руб|р|₽)/gi, '').trim() || 'Новая задача';

  sessions.set(userId, {
    title,
    amount,
    status: 'backlog',
    description: text
  });

  try {
    logger(`[DB] Запрос проектов...`);
    const { data: projects, error } = await supabase.from('projects').select('id, name');

    if (error) {
      logger(`[DB ERROR] Ошибка проектов: ${JSON.stringify(error)}`);
      return ctx.reply(`Ошибка БД: ${error.message}`);
    }

    if (!projects || projects.length === 0) {
      return ctx.reply('Нет проектов. Создайте проект в дашборде.');
    }

    const buttons = projects.map(p => [Markup.button.callback(p.name, `proj_${p.id}`)]);
    buttons.push([Markup.button.callback('❌ Отменить', 'cancel')]);

    return ctx.reply(`Задача: "${title}"${amount > 0 ? ` (${amount} ₽)` : ''}\n\nКуда добавить?`, Markup.inlineKeyboard(buttons));
  } catch (err: any) {
    logger(`[CRITICAL] ${err.message}`);
    return ctx.reply(`Ошибка: ${err.message}`);
  }
});

bot.action(/proj_(.+)/, async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const projectId = ctx.match[1];
    const session = sessions.get(userId);
    if (!session) {
      logger(`[WARN] Сессия не найдена`);
      return await ctx.answerCbQuery('Сессия истекла. Пришли задачу заново.');
    }

    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
    session.projectId = projectId;
    session.projectName = project?.name || 'Проект';

    await ctx.answerCbQuery();
    await ctx.editMessageText(`⏳ Парсинг задачи...`);

    logger(`[LLM] Вызов Edge Function...`);
    const { data: settingsData } = await supabase.from('assistant_settings').select('*').limit(1).single();
    const settings: AssistantSettings = {
      id: settingsData.id,
      llm_api_url: settingsData.llm_api_url,
      llm_model: settingsData.llm_model,
      llm_api_key: settingsData.llm_api_key,
      llm_prompt: settingsData.llm_prompt,
      proxy_host: settingsData.proxy_host,
      proxy_port: settingsData.proxy_port,
      proxy_login: settingsData.proxy_login,
      proxy_password: settingsData.proxy_password
    };

    const parsed = await parseTaskWithLLM(session.description || session.title, settings);

    if (!parsed) {
      logger(`[LLM ERROR] Не удалось распарсить`);
      sessions.delete(userId);
      return ctx.editMessageText(`❌ Не удалось распарсить задачу. Уточни текст:`);
    }

    logger(`[LLM SUCCESS] ${JSON.stringify(parsed)}`);

    const { error: insertError } = await supabase.from('tasks').insert([{
      project_id: projectId,
      title: parsed.title || session.title,
      description: parsed.description || session.description || '',
      amount: parsed.amount || session.amount || 0,
      external_url: parsed.externalUrl || '',
      status: parsed.status || 'backlog',
      is_paid: parsed.isPaid || false,
      is_agreed: parsed.isAgreed || false
    }]);

    if (insertError) {
      logger(`[DB ERROR] Создание задачи: ${JSON.stringify(insertError)}`);
      sessions.delete(userId);
      return ctx.editMessageText(`❌ Ошибка создания: ${insertError.message}`);
    }

    logger(`[SUCCESS] Задача создана: ${parsed.title}`);
    sessions.delete(userId);

    const statusText = { backlog: 'БЭКЛОГ', bugs: 'БАГИ', done: 'СДЕЛАНО', paid: 'ПРИНЯТО И ОПЛАЧЕНО' }[parsed.status || 'backlog'];
    const paidText = parsed.isPaid ? '✅ Оплачено' : '❌ Не оплачено';
    const agreedText = parsed.isAgreed ? '✅ Согласовано' : '❌ Не согласовано';

    const reply = `✅ Задача создана!

📌 ${parsed.title}
${parsed.amount ? `💰 ${parsed.amount} ₽` : ''}
📋 Статус: ${statusText}
${paidText}
${agreedText}
${parsed.externalUrl ? `🔗 ${parsed.externalUrl}` : ''}
📝 ${parsed.description || 'нет'}`;

    return ctx.editMessageText(reply);
  } catch (e: any) {
    logger(`[ERROR] ${e.message}`);
    sessions.delete(ctx.from?.id || 0);
    try { await ctx.answerCbQuery('Ошибка'); } catch (_) {}
    return ctx.editMessageText(`❌ Ошибка: ${e.message}`);
  }
});

bot.action('cancel', async (ctx) => {
  try {
    sessions.delete(ctx.from?.id || 0);
    await ctx.answerCbQuery('Отменено');
    ctx.editMessageText('Создание отменено.');
  } catch (e) {}
});

bot.catch((err: any) => {
  logger(`ГЛОБАЛЬНАЯ ОШИБКА: ${err.message || err}`);
  if (err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNRESET')) {
    logger('Сетевая ошибка. Бот продолжит работу...');
  }
});

const startBot = async () => {
  try {
    await bot.launch();
    logger('Бот запущен!');
  } catch (err: any) {
    logger(`Ошибка запуска: ${err.message}`);
    setTimeout(startBot, 5000);
  }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));