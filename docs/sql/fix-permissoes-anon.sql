-- Fix: dar permissões SELECT/INSERT ao anon para captação pública
GRANT SELECT, INSERT ON patients TO anon;
GRANT SELECT, INSERT ON assistant_tasks TO anon;

-- Policies para anon (caso não tenham sido criadas)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_patients' AND tablename = 'patients') THEN
    CREATE POLICY "anon_insert_patients" ON patients FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_assistant_tasks' AND tablename = 'assistant_tasks') THEN
    CREATE POLICY "anon_insert_assistant_tasks" ON assistant_tasks FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- Policies para authenticated (caso não tenham sido criadas)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_full_access_patients' AND tablename = 'patients') THEN
    CREATE POLICY "authenticated_full_access_patients" ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_all_assistant_tasks' AND tablename = 'assistant_tasks') THEN
    CREATE POLICY "authenticated_all_assistant_tasks" ON assistant_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
