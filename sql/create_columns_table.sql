-- Таблица колонок канбана
CREATE TABLE IF NOT EXISTS columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'bg-slate-500',
  order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Включение RLS
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;

-- Политика доступа
CREATE POLICY "Allow public access for columns" ON columns
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Вставка дефолтных колонок для существующих проектов
INSERT INTO columns (project_id, label, color, order)
SELECT p.id, 'Нужно сделать', 'bg-slate-500', 0
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM columns cp WHERE cp.project_id = p.id);

INSERT INTO columns (project_id, label, color, order)
SELECT p.id, 'В работе', 'bg-indigo-500', 1
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM columns cp WHERE cp.project_id = p.id AND cp.label = 'В работе');

INSERT INTO columns (project_id, label, color, order)
SELECT p.id, 'На проверке', 'bg-purple-500', 2
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM columns cp WHERE cp.project_id = p.id AND cp.label = 'На проверке');

INSERT INTO columns (project_id, label, color, order)
SELECT p.id, 'Готово', 'bg-emerald-500', 3
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM columns cp WHERE cp.project_id = p.id AND cp.label = 'Готово');
