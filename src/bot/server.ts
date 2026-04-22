import { Telegraf, Context, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTaskWithLLM } from '../lib/llm.js';
import { AssistantSettings } from '../types.js';

// Корректная загрузка .env для ESM в Windows
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const logFile = 'bot_errors.log';
const logger = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
};

logger('Инициализация бота (Status Selection Edition)...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

type BotStep = 'awaiting_project' | 'awaiting_status' | 'awaiting_description' | 'confirm_task';
interface Session {
  title: string;
  amount: number;
  date: Date;
  projectId?: string;
  projectName?: string;
  statusId?: string;
  statusName?: string;
  description?: string;
  externalUrl?: string;
  isPaid?: boolean;
  isAgreed?: boolean;
  step: BotStep;
}

const sessions = new Map<number, Session>();

bot.start((ctx) => {
  sessions.delete(ctx.from.id);
  ctx.reply('Привет! Я помогу добавить задачу. Просто напиши что нужно сделать и сумму.');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const session = sessions.get(userId);

  if (session?.step === 'awaiting_description') {
    session.description = text;
    session.step = 'confirm_task';
    sessions.set(userId, session);
    return showSummary(ctx, session);
  }

  logger(`[NEW TASK] от ${ctx.from.username}: ${text}`);
  const loadingMsg = await ctx.reply('🔍 Анализирую задачу...');

  try {
    const { data: settingsData } = await supabase.from('assistant_settings').select('*').limit(1).single();
    let parsed: any = null;
    if (settingsData) {
      parsed = await parseTaskWithLLM(text, settingsData as AssistantSettings);
    }

    const amountMatch = text.match(/(\d+)\s*(рублей|руб|р|₽)/i);
    const manualAmount = amountMatch ? parseInt(amountMatch[1]) : 0;

    sessions.set(userId, {
      title: parsed?.title || text.split('\n')[0].slice(0, 100),
      amount: parsed?.amount || manualAmount,
      externalUrl: parsed?.externalUrl || '',
      isPaid: parsed?.isPaid || false,
      isAgreed: parsed?.isAgreed || false,
      description: parsed?.description || text,
      date: new Date(),
      step: 'awaiting_project'
    });

    const { data: projects } = await supabase.from('projects').select('id, name');
    await bot.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    if (!projects || projects.length === 0) return ctx.reply('Нет проектов в БД.');

    const buttons = projects.map(p => [Markup.button.callback(p.name, `proj_${p.id}`)]);
    buttons.push([Markup.button.callback('❌ Отменить', 'cancel')]);

    return ctx.reply(`Задача: "${sessions.get(userId)?.title}"\n\nВыбери проект:`, Markup.inlineKeyboard(buttons));
  } catch (err: any) {
    logger(`Ошибка: ${err.message}`);
    ctx.reply('Ошибка. Попробуйте еще раз.');
  }
});

// 1. Выбор проекта -> Переход к выбору статуса
bot.action(/proj_(.+)/, async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const projectId = ctx.match[1];
    const session = sessions.get(userId);
    if (!session) return await ctx.answerCbQuery('Сессия истекла.');

    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
    session.projectId = projectId;
    session.projectName = project?.name || 'Проект';
    session.step = 'awaiting_status';
    sessions.set(userId, session);

    // Загружаем колонки (статусы) именно из kanban_columns
    // Сначала пробуем найти колонки именно этого проекта
    let { data: columns } = await supabase.from('kanban_columns').select('id, label').eq('project_id', projectId).order('order_num');
    
    // Если для проекта нет колонок, берем "общие" (где project_id is null)
    if (!columns || columns.length === 0) {
      logger(`[DB] Колонки для проекта ${projectId} не найдены, ищем общие...`);
      const { data: globalCols } = await supabase.from('kanban_columns').select('id, label').is('project_id', null).order('order_num');
      columns = globalCols;
    }
    
    // Если и общих нет, используем дефолтные
    const defaultCols = [
      { id: 'todo', label: 'Нужно сделать' },
      { id: 'in-progress', label: 'В работе' },
      { id: 'review', label: 'На проверке' },
      { id: 'done', label: 'Готово' }
    ];

    const currentCols = (columns && columns.length > 0) ? columns : defaultCols;

    const buttons = currentCols.map(c => [Markup.button.callback(c.label, `stat_${c.id}`)]);
    buttons.push([Markup.button.callback('❌ Отменить', 'cancel')]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Проект: ${session.projectName}\n\nВ какой статус (колонку) добавить задачу?`, Markup.inlineKeyboard(buttons));
  } catch (e) { await ctx.answerCbQuery(); }
});

// 2. Выбор статуса -> Переход к вводу описания
bot.action(/stat_(.+)/, async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const statusId = ctx.match[1];
    const session = sessions.get(userId);
    if (!session) return await ctx.answerCbQuery('Сессия истекла.');

    session.statusId = statusId;
    session.step = 'awaiting_description';
    sessions.set(userId, session);

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Напиши детали (описание) или нажми пропустить:`, {
      ...Markup.inlineKeyboard([[Markup.button.callback('⏭ Пропустить', 'skip_desc')], [Markup.button.callback('❌ Отмена', 'cancel')]])
    });
  } catch (e) { await ctx.answerCbQuery(); }
});

bot.action('skip_desc', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const session = sessions.get(userId);
  if (!session) return;
  session.step = 'confirm_task';
  sessions.set(userId, session);
  await ctx.answerCbQuery();
  return showSummary(ctx, session);
});

bot.action('confirm_save', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const session = sessions.get(userId);
  if (!session || !session.projectId) return;

  try {
    const { error } = await supabase.from('tasks').insert([{
      project_id: session.projectId,
      title: session.title,
      amount: session.amount,
      description: session.description || '',
      status: session.statusId || 'todo', // Используем выбранный статус!
      priority: 'medium',
      external_url: session.externalUrl || '',
      is_paid: session.isPaid || false,
      is_agreed: session.isAgreed || false
    }]);

    if (error) throw error;
    sessions.delete(userId);
    await ctx.answerCbQuery();
    return ctx.editMessageText(`✅ Задача добавлена в ${session.projectName}!`);
  } catch (err: any) {
    logger(`Ошибка БД: ${err.message}`);
    ctx.reply(`Ошибка: ${err.message}`);
  }
});

bot.action('cancel', async (ctx) => {
  sessions.delete(ctx.from?.id || 0);
  try { await ctx.answerCbQuery(); } catch (e) {}
  ctx.editMessageText('Отменено.');
});

async function showSummary(ctx: any, session: Session) {
  const summary = `📋 Резюме:\n\n` +
    `Название: ${session.title}\n` +
    `Сумма: ${session.amount} ₽\n` +
    `Проект: ${session.projectName}\n` +
    `Описание: ${session.description || 'нет'}\n\n` +
    `Создать задачу?`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Создать', 'confirm_save')],
    [Markup.button.callback('❌ Отмена', 'cancel')]
  ]);

  if (ctx.callbackQuery) return await ctx.editMessageText(summary, keyboard);
  return await ctx.reply(summary, keyboard);
}

bot.catch((err: any) => logger(`ГЛОБАЛЬНАЯ ОШИБКА: ${err.message || err}`));
const startBot = async () => {
  try { await bot.launch(); logger('Бот запущен!'); } catch (err: any) { setTimeout(startBot, 5000); }
};
startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
