import { Telegraf, Context, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

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

type BotStep = 'awaiting_project' | 'awaiting_description' | 'confirm_task';
interface Session {
  title: string;
  amount: number;
  date: Date;
  projectId?: string;
  projectName?: string;
  description?: string;
  step: BotStep;
}

const sessions = new Map<number, Session>();

bot.start((ctx) => {
  const userId = ctx.from.id;
  logger(`[START] Пользователь ${userId}`);
  sessions.delete(userId);
  ctx.reply('Привет! Присылай мне задачи в формате: "Оценить задачу 500 рублей"');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  logger(`[TEXT] от ${ctx.from.username || userId}: "${text}"`);
  
  const session = sessions.get(userId);

  // Состояние: ввод описания
  if (session?.step === 'awaiting_description') {
    logger(`[SESSION] Получено описание для задачи "${session.title}"`);
    session.description = text;
    session.step = 'confirm_task';
    sessions.set(userId, session);
    return showSummary(ctx, session);
  }

  // Парсинг новой задачи
  const amountMatch = text.match(/(\d+)\s*(рублей|руб|р|₽)/i);
  
  if (amountMatch) {
    const amount = parseInt(amountMatch[1]);
    const title = text.replace(amountMatch[0], '').trim() || 'Новая задача';
    logger(`[MATCH] Найдена сумма ${amount} для задачи "${title}"`);
    
    sessions.set(userId, {
      title,
      amount,
      date: new Date(),
      step: 'awaiting_project'
    });

    try {
      logger(`[DB] Запрос проектов из Supabase...`);
      const { data: projects, error } = await supabase.from('projects').select('id, name');
      
      if (error) {
        logger(`[DB ERROR] Ошибка получения проектов: ${JSON.stringify(error)}`);
        return ctx.reply(`Ошибка БД при получении проектов: ${error.message}`);
      }

      logger(`[DB SUCCESS] Найдено проектов: ${projects?.length || 0}`);

      if (!projects || projects.length === 0) {
        return ctx.reply('В базе пока нет проектов. Создайте проект в дашборде.');
      }

      const buttons = projects.map(p => Markup.button.callback(p.name, `proj_${p.id}`));
      logger(`[REPLY] Отправка списка проектов...`);
      return ctx.reply(`Куда добавить задачу "${title}" (${amount} ₽)?`, Markup.inlineKeyboard(buttons, { columns: 2 }));
    } catch (err: any) {
      logger(`[CRITICAL] Исключение: ${err.message}`);
      return ctx.reply(`Критическая ошибка: ${err.message}`);
    }
  } else {
    logger(`[NO MATCH] Сумма не найдена в тексте`);
    return ctx.reply('Я не увидел сумму в сообщении. Напишите, например: "Задача 500 руб"');
  }
});

// Обработка выбора проекта
bot.action(/proj_(.+)/, async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const projectId = ctx.match[1];
    logger(`[ACTION] Выбран проект ID: ${projectId}`);
    
    const session = sessions.get(userId);
    if (!session) {
      logger(`[WARN] Сессия не найдена при выборе проекта`);
      return await ctx.answerCbQuery('Сессия истекла. Пришли задачу заново.');
    }

    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
    session.projectId = projectId;
    session.projectName = project?.name || 'Проект';
    session.step = 'awaiting_description';
    sessions.set(userId, session);

    logger(`[REPLY] Запрос описания...`);
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Проект: ${session.projectName}\n\nНапиши описание задачи или нажми кнопку:`, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏭ Пропустить описание', 'skip_desc')],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ])
    });
  } catch (e: any) {
    logger(`[ERROR] Action proj: ${e.message}`);
    try { await ctx.answerCbQuery('Произошла ошибка'); } catch (ignore) {}
  }
});

bot.action('skip_desc', async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const session = sessions.get(userId);
    if (!session) return await ctx.answerCbQuery('Сессия истекла');
    
    logger(`[ACTION] Пропуск описания`);
    session.description = '';
    session.step = 'confirm_task';
    sessions.set(userId, session);
    await ctx.answerCbQuery();
    return showSummary(ctx, session);
  } catch (e: any) { logger(`[ERROR] Skip desc: ${e.message}`); }
});

bot.action('confirm_save', async (ctx) => {
  try {
    const userId = ctx.from?.id || 0;
    const session = sessions.get(userId);
    if (!session || !session.projectId) return await ctx.answerCbQuery('Ошибка сессии');

    logger(`[DB] Сохранение задачи в БД...`);
    const { error } = await supabase.from('tasks').insert([{
      project_id: session.projectId,
      title: session.title,
      amount: session.amount,
      description: session.description || '',
      status: 'todo',
      priority: 'medium'
    }]);

    if (error) {
      logger(`[DB ERROR] Ошибка сохранения: ${JSON.stringify(error)}`);
      return ctx.reply(`Ошибка БД: ${error.message}`);
    }

    logger(`[SUCCESS] Задача создана!`);
    sessions.delete(userId);
    await ctx.answerCbQuery();
    return ctx.editMessageText(`✅ Задача добавлена в проект ${session.projectName}!\n\n${session.title}\n💰 ${session.amount} ₽`);
  } catch (err: any) {
    logger(`[ERROR] Confirm save: ${err.message}`);
    try { await ctx.answerCbQuery('Ошибка БД'); } catch (ignore) {}
  }
});

bot.action('cancel', async (ctx) => {
  try {
    sessions.delete(ctx.from?.id || 0);
    await ctx.answerCbQuery('Отменено');
    ctx.editMessageText('Создание задачи отменено.');
  } catch (e) {}
});

async function showSummary(ctx: any, session: Session) {
  const summary = `📋 Резюме:\n\nНазвание: ${session.title}\nСумма: ${session.amount} ₽\nПроект: ${session.projectName}\nОписание: ${session.description || 'нет'}\n\nСоздать задачу?`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Создать задачу', 'confirm_save')],
    [Markup.button.callback('❌ Отмена', 'cancel')]
  ]);
  try {
    if (ctx.callbackQuery) {
      return await ctx.editMessageText(summary, keyboard);
    } else {
      return await ctx.reply(summary, keyboard);
    }
  } catch (e: any) { logger(`[ERROR] Show summary: ${e.message}`); }
}

bot.catch((err: any) => {
  logger(`ГЛОБАЛЬНАЯ ОШИБКА: ${err.message || err}`);
  if (err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNRESET')) {
    logger('Сетевая ошибка. Бот попробует продолжить работу автоматически...');
  }
});

const startBot = async () => {
  try {
    await bot.launch();
    logger('Бот успешно запущен и слушает сообщения!');
  } catch (err: any) {
    logger(`Ошибка запуска: ${err.message}`);
    setTimeout(startBot, 5000); // Рестарт через 5 секунд при ошибке запуска
  }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
