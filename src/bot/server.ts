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

logger('Инициализация бота (LLM + Manual Edition)...');

// Проверка наличия переменных окружения
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logger('КРИТИЧЕСКАЯ ОШИБКА: Переменные Supabase не найдены в .env');
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

type BotStep = 'awaiting_project' | 'awaiting_description' | 'confirm_task';
interface Session {
  title: string;
  amount: number;
  date: Date;
  projectId?: string;
  projectName?: string;
  description?: string;
  externalUrl?: string;
  status?: string;
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

  // Если ждем описание
  if (session?.step === 'awaiting_description') {
    session.description = text;
    session.step = 'confirm_task';
    sessions.set(userId, session);
    return showSummary(ctx, session);
  }

  // Новая задача: запускаем ИИ-парсинг
  logger(`[NEW TASK] от ${ctx.from.username}: ${text}`);
  const loadingMsg = await ctx.reply('🔍 Анализирую задачу...');

  try {
    const { data: settingsData } = await supabase.from('assistant_settings').select('*').limit(1).single();
    
    // Пытаемся распарсить задачу через ИИ
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
      status: parsed?.status || 'todo',
      isPaid: parsed?.isPaid || false,
      isAgreed: parsed?.isAgreed || false,
      description: parsed?.description || text,
      date: new Date(),
      step: 'awaiting_project'
    });

    const { data: projects } = await supabase.from('projects').select('id, name');
    
    await bot.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    if (!projects || projects.length === 0) {
      return ctx.reply('В базе нет проектов. Создайте проект в дашборде.');
    }

    const buttons = projects.map(p => [Markup.button.callback(p.name, `proj_${p.id}`)]);
    buttons.push([Markup.button.callback('❌ Отменить', 'cancel')]);

    return ctx.reply(`Задача: "${sessions.get(userId)?.title}"\nКуда добавить?`, Markup.inlineKeyboard(buttons));
  } catch (err: any) {
    logger(`Ошибка парсинга: ${err.message}`);
    ctx.reply('Произошла ошибка при анализе задачи. Попробуйте еще раз.');
  }
});

bot.action(/proj_(.+)/, async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const projectId = ctx.match[1];
    const session = sessions.get(userId);
    if (!session) return await ctx.answerCbQuery('Сессия истекла.');

    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
    session.projectId = projectId;
    session.projectName = project?.name || 'Проект';
    session.step = 'awaiting_description';
    sessions.set(userId, session);

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Проект: **${session.projectName}**\n\nНапиши дополнительные детали (описание) или нажми пропустить:`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏭ Пропустить описание', 'skip_desc')],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ])
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
  if (!session || !session.projectId) return await ctx.answerCbQuery('Ошибка');

  try {
    const { error } = await supabase.from('tasks').insert([{
      project_id: session.projectId,
      title: session.title,
      amount: session.amount,
      description: session.description || '',
      status: session.status || 'todo',
      priority: 'medium',
      external_url: session.externalUrl || '',
      is_paid: session.isPaid || false,
      is_agreed: session.isAgreed || false
    }]);

    if (error) throw error;

    sessions.delete(userId);
    await ctx.answerCbQuery();
    return ctx.editMessageText(`✅ Задача успешно создана в проекте ${session.projectName}!`);
  } catch (err: any) {
    logger(`Ошибка БД: ${err.message}`);
    ctx.reply(`Ошибка при сохранении: ${err.message}`);
  }
});

bot.action('edit_desc', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const session = sessions.get(userId);
  if (!session) return;
  session.step = 'awaiting_description';
  sessions.set(userId, session);
  await ctx.answerCbQuery();
  return ctx.editMessageText('Напиши новое описание для задачи:');
});

bot.action('cancel', async (ctx) => {
  sessions.delete(ctx.from?.id || 0);
  try { await ctx.answerCbQuery('Отменено'); } catch (e) {}
  ctx.editMessageText('Отменено.');
});

async function showSummary(ctx: any, session: Session) {
  const summary = `📋 **Резюме задачи:**\n\n` +
    `**Название:** ${session.title}\n` +
    `**Сумма:** ${session.amount} ₽\n` +
    `**Проект:** ${session.projectName}\n` +
    `**Описание:** ${session.description || 'нет'}\n\n` +
    `Создать задачу?`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Подтвердить и создать', 'confirm_save')],
    [Markup.button.callback('📝 Изменить описание', 'edit_desc')],
    [Markup.button.callback('❌ Отмена', 'cancel')]
  ]);

  try {
    if (ctx.callbackQuery) {
      return await ctx.editMessageText(summary, { parse_mode: 'Markdown', ...keyboard });
    } else {
      return await ctx.reply(summary, { parse_mode: 'Markdown', ...keyboard });
    }
  } catch (e) {
    // Если Markdown ломается из-за спецсимволов, отправляем обычный текст
    return ctx.reply(summary.replace(/\*/g, ''), keyboard);
  }
}

bot.catch((err: any) => logger(`ГЛОБАЛЬНАЯ ОШИБКА: ${err.message || err}`));

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
