-- FEMIC v2 Migration: Página pública + confirmação + encerrar tratamento
-- Execute no SQL Editor do Supabase

-- ===================== PARTE 1: RLS para página pública =====================

-- Permite que o público (anon) crie pacientes
CREATE POLICY "anon_insert_patients" ON patients
  FOR INSERT TO anon
  WITH CHECK (true);

-- Permite que o público crie tasks de agendamento
CREATE POLICY "anon_insert_assistant_tasks" ON assistant_tasks
  FOR INSERT TO anon
  WITH CHECK (true);

-- ===================== PARTE 2: Coluna welcome_sent em appointments =====================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMP WITH TIME ZONE;

-- ===================== PARTE 3: Coluna feedback_sent em patients =====================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMP WITH TIME ZONE;

-- ===================== VERIFICAÇÃO =====================

-- SELECT * FROM pg_policies WHERE tablename IN ('patients','assistant_tasks');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'appointments' AND column_name IN ('welcome_sent','welcome_sent_at');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'patients' AND column_name IN ('feedback_sent','feedback_sent_at');
