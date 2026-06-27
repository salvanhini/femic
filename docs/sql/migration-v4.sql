-- FEMIC v4 Migration: Slots Config + Cleanup
-- Execute no SQL Editor do Supabase
--
-- ⚠️ ANTES DE EXECUTAR: faça um backup completo via Supabase Dashboard
--   (Database → Backup → Enable Point-in-Time Recovery ou export JSON manual)

-- ===================== PARTE 1: Backup (se existir) + Drop assistant_tasks =====================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'assistant_tasks') THEN
    CREATE TABLE IF NOT EXISTS assistant_tasks_backup_v4 AS
    SELECT * FROM assistant_tasks;
    DROP TABLE IF EXISTS assistant_tasks CASCADE;
  END IF;
END $$;

-- ===================== PARTE 2: Adicionar slots_config (se não existir) =====================

ALTER TABLE schedule_settings ADD COLUMN IF NOT EXISTS slots_config JSONB DEFAULT '{}'::jsonb;

-- Preencher slots_config baseado nos working_periods existentes (apenas se vazio)
-- Gera slots de 30min das 08:00 às 12:00 e 14:00 às 18:00 para dias úteis
UPDATE schedule_settings
SET slots_config = (
  SELECT jsonb_object_agg(dow::text, slots)
  FROM (
    SELECT unnest(string_to_array(COALESCE(working_days, '1,2,3,4,5,6'), ',')) AS dow
  ) days,
  LATERAL (
    SELECT jsonb_agg(t) AS slots
    FROM (
      SELECT to_char(generate_series(
        '08:00'::time, '12:00'::time, '30 minutes'::interval
      ), 'HH24:MI') AS t
      UNION
      SELECT to_char(generate_series(
        '14:00'::time, '18:00'::time, '30 minutes'::interval
      ), 'HH24:MI')
    ) sub
  ) slots_sub
)
WHERE slots_config IS NULL OR slots_config = '{}'::jsonb;

-- ===================== PARTE 3: Limpeza de colunas legadas =====================

-- Colunas não usadas em appointments (form_reminder já não é mais usado)
ALTER TABLE appointments DROP COLUMN IF EXISTS form_reminder_sent;
ALTER TABLE appointments DROP COLUMN IF EXISTS form_reminder_sent_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS welcome_sent;
ALTER TABLE appointments DROP COLUMN IF EXISTS welcome_sent_at;

-- ===================== PARTE 4: Índices =====================

DROP INDEX IF EXISTS idx_assistant_tasks_status_updated;
DROP INDEX IF EXISTS idx_assistant_tasks_origin;
DROP INDEX IF EXISTS idx_assistant_tasks_fingerprint;

-- ===================== VERIFICAÇÃO =====================

-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'schedule_settings' AND column_name = 'slots_config';
-- SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'assistant_tasks_backup_v4');
