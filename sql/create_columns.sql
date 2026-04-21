-- Таблица колонок для канбана
CREATE TABLE IF NOT EXISTS columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'bg-slate-500',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Включение RLS
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;

-- Публичный доступ
CREATE POLICY "Allow public access" ON columns
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Добавить дефолтные колонки если пусто
INSERT INTO columns (label, color, "order")
SELECT 'Нужно сделать', 'bg-slate-500', 0
WHERE NOT EXISTS (SELECT 1 FROM columns);

INSERT INTO columns (label, color, "order")
SELECT 'В работе', 'bg-indigo-500', 1
WHERE NOT EXISTS (SELECT 1 FROM columns WHERE "order" = 1);

INSERT INTO columns (label, color, "order")
SELECT 'На проверке', 'bg-purple-500', 2
WHERE NOT EXISTS (SELECT 1 FROM columns WHERE "order" = 2);

INSERT INTO columns (label, color, "order")
SELECT 'Готово', 'bg-emerald-500', 3
WHERE NOT EXISTS (SELECT 1 FROM columns WHERE "order" = 3);