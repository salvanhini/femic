-- FEMIC: Liberar INSERT anônimo para página pública de agendamento
-- Execute no SQL Editor do Supabase (uma vez)

-- 1. Permite que o público crie pacientes (só INSERT, sem SELECT/UPDATE/DELETE)
CREATE POLICY "anon_insert_patients" ON patients
  FOR INSERT TO anon
  WITH CHECK (true);

-- 2. Permite que o público crie tasks de agendamento
CREATE POLICY "anon_insert_assistant_tasks" ON assistant_tasks
  FOR INSERT TO anon
  WITH CHECK (true);

-- 3. Permite que o público crie health_insurances (se necessário)
CREATE POLICY "anon_insert_health_insurances" ON health_insurances
  FOR INSERT TO anon
  WITH CHECK (true);

-- Verificar se as policies foram criadas:
-- SELECT * FROM pg_policies WHERE tablename IN ('patients','assistant_tasks','health_insurances');
