-- Cria a tabela assistant_tasks (necessária para captação + bot)
CREATE TABLE IF NOT EXISTS assistant_tasks (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  phone TEXT,
  service_name TEXT,
  service_id TEXT,
  status TEXT DEFAULT 'aberta',
  notes TEXT,
  suggested_slots TEXT,
  origin TEXT,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE assistant_tasks ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_tasks TO authenticated, anon;

-- Policies
DROP POLICY IF EXISTS "anon_insert_assistant_tasks" ON assistant_tasks;
CREATE POLICY "anon_insert_assistant_tasks" ON assistant_tasks
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_assistant_tasks" ON assistant_tasks;
CREATE POLICY "authenticated_all_assistant_tasks" ON assistant_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON assistant_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_origin ON assistant_tasks(origin);

NOTIFY pgrst, 'reload schema';
