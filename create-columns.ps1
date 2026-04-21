$body = @"
CREATE TABLE IF NOT EXISTS columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'bg-slate-500',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON columns FOR ALL TO public USING (true) WITH CHECK (true);
INSERT INTO columns (label, color, "order") VALUES 
  ('Нужно сделать', 'bg-slate-500', 0),
  ('В работе', 'bg-indigo-500', 1),
  ('На проверке', 'bg-purple-500', 2),
  ('Готово', 'bg-emerald-500', 3)
ON CONFLICT DO NOTHING;
"@

$headers = @{
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaGV4bXlraHZlZGJ4eXB0b2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyNjUyNDczNCwiZXhwIjoyMDM0MTIwNzM0fQ.WJ1VE2m2eDt1eN5hI1fAK4eWz1eN5hI1fAK4eWz1eN5hI1fAK'
  'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaGV4bXlraHZlZGJ4eXB0b2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyNjUyNDczNCwiZXhwIjoyMDM0MTIwNzM0fQ.WJ1VE2m2eDt1eN5hI1fAK4eWz1eN5hI1fAK4eWz1eN5hI1fAK'
  'Content-Type' = 'application/json'
  'Prefer' = 'params=runtime=execute'
}

Invoke-WebRequest -Uri "https://aghexmykhvedbxyqptof.supabase.co/rest/v1/rpc/exec_sql" -Method POST -Headers $headers -Body $body