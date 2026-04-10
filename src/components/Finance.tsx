import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, DollarSign, CreditCard, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Project, Transaction } from '../types';
import { useState } from 'react';
import { format, isValid } from 'date-fns';

interface FinanceProps {
  projects: Project[];
  onAddTransaction: (projectId: string, transaction: Transaction) => void;
}

export const Finance = ({ projects, onAddTransaction }: FinanceProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [tName, setTName] = useState('');
  const [tAmount, setTAmount] = useState('');
  const [tType, setTType] = useState<'income' | 'expense'>('expense');
  const [tCategory, setTCategory] = useState('Infrastructure');

  const formatDateSafely = (dateStr: any, formatStr: string) => {
    const date = new Date(dateStr);
    return isValid(date) ? format(date, formatStr) : 'Нет даты';
  };

  const allTransactions = projects
    .flatMap(p => p.transactions)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const stats = [
    { label: 'Общий баланс', value: `$${balance.toLocaleString()}`, change: '+12.5%', isUp: balance >= 0, icon: Wallet, color: 'text-indigo-400 bg-indigo-400/10' },
    { label: 'Доходы', value: `$${totalIncome.toLocaleString()}`, change: '+5.2%', isUp: true, icon: TrendingUp, color: 'text-emerald-400 bg-emerald-400/10' },
    { label: 'Расходы', value: `$${totalExpense.toLocaleString()}`, change: '-2.1%', isUp: false, icon: TrendingDown, color: 'text-rose-400 bg-rose-400/10' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tName || !tAmount || !selectedProjectId) return;

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      name: tName,
      amount: parseFloat(tAmount),
      type: tType,
      category: tCategory,
      date: new Date(),
      status: 'Completed',
    };

    onAddTransaction(selectedProjectId, newTransaction);
    setTName('');
    setTAmount('');
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 space-y-8 relative z-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Финансы</h1>
          <p className="text-slate-400 mt-1">Отслеживайте доходы и расходы ваших проектов.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
        >
          <Plus size={20} />
          <span>Новая транзакция</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className={cn("p-3 rounded-2xl", stat.color)}>
                  <Icon size={24} />
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border",
                  stat.isUp ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-rose-400 bg-rose-400/10 border-rose-400/20"
                )}>
                  {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {stat.change}
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-1">{stat.label}</h3>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Последние транзакции</h2>
            <button className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors">Все операции</button>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {allTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {t.type === 'income' ? <DollarSign size={20} /> : <CreditCard size={20} />}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">{t.name}</h4>
                    <p className="text-slate-500 text-xs">{formatDateSafely(t.date, 'dd.MM.yyyy')} • {t.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-bold text-sm", t.type === 'income' ? "text-emerald-400" : "text-white")}>
                    {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{t.status}</div>
                </div>
              </div>
            ))}
            {allTransactions.length === 0 && (
              <div className="text-center py-8 text-slate-500">Транзакций пока нет</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center space-y-6">
          <div className="w-48 h-48 rounded-full border-8 border-indigo-600/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-8 border-indigo-500 border-t-transparent animate-spin-slow" />
            <div className="text-center">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Бюджет</div>
              <div className="text-3xl font-bold text-white">
                {totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0}%
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-white font-bold">Распределение бюджета</h3>
            <p className="text-slate-500 text-sm max-w-[280px]">Ваши расходы составляют {totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}% от общего дохода.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
              <div className="text-indigo-400 font-bold">{totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}%</div>
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Расходы</div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
              <div className="text-purple-400 font-bold">{totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 100}%</div>
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Остаток</div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Новая транзакция</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Проект</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Название</label>
                  <input
                    autoFocus
                    type="text"
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    placeholder="Например: Оплата хостинга"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Сумма ($)</label>
                    <input
                      type="number"
                      value={tAmount}
                      onChange={(e) => setTAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Тип</label>
                    <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setTType('income')}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                          tType === 'income' ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Доход
                      </button>
                      <button
                        type="button"
                        onClick={() => setTType('expense')}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                          tType === 'expense' ? "bg-rose-500 text-white" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Расход
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Категория</label>
                  <input
                    type="text"
                    value={tCategory}
                    onChange={(e) => setTCategory(e.target.value)}
                    placeholder="Infrastructure, Services, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                >
                  Добавить транзакцию
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
