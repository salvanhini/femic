-- FEMIC v3 Migration: Remove Pendências + Slot-based Expediente
-- Execute no SQL Editor do Supabase
--
-- ⚠️ ANTES DE EXECUTAR: faça um backup completo via Supabase Dashboard
--   (Database → Backup → Enable Point-in-Time Recovery ou export JSON manual)
--   A perda de dados da tabela assistant_tasks é INTENCIONAL e IRREVERSÍVEL.

-- ===================== PARTE 1: Backup da tabela assistant_tasks =====================
-- (Opcional, se quiser salvar antes de deletar)

CREATE TABLE IF NOT EXISTS assistant_tasks_backup_v3 AS
SELECT * FROM assistant_tasks;

-- ===================== PARTE 2: Drop tabela assistant_tasks =====================

DROP TABLE IF EXISTS assistant_tasks CASCADE;

-- ===================== PARTE 3: Drop RLS policies da antiga assistant_tasks =====================

DROP POLICY IF EXISTS "anon_insert_assistant_tasks" ON assistant_tasks;

-- ===================== PARTE 4: Adicionar slots_config (JSONB por dia) =====================

ALTER TABLE schedule_settings ADD COLUMN IF NOT EXISTS slots_config JSONB DEFAULT '{}'::jsonb;

-- ===================== PARTE 5: Limpeza de colunas legadas (opcional) =====================
-- Descomente se quiser remover colunas que não serão mais usadas:

-- ALTER TABLE schedule_settings DROP COLUMN IF EXISTS working_periods;

-- ===================== VERIFICAÇÃO =====================

-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'schedule_settings' AND column_name = 'slots_config';
-- SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'assistant_tasks'); -- deve retornar false
-- SELECT COUNT(*) FROM assistant_tasks_backup_v3; -- deve mostrar o backup salvo
