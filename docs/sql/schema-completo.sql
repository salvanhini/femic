-- FEMIC v1.5.0 - Schema Completo + Migration v4
-- Execute no SQL Editor do Supabase
-- ATENÇÃO: este SQL reseta as tabelas operacionais deste Supabase.
-- Faça backup JSON antes de rodar em um banco com dados reais.

-- ===================== DROP TABLES (ordem segura) =====================

DROP TABLE IF EXISTS session_movements CASCADE;
DROP TABLE IF EXISTS session_packages CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clinical_evolutions CASCADE;
DROP TABLE IF EXISTS clinical_anamneses CASCADE;
DROP TABLE IF EXISTS femic_generated_documents CASCADE;
DROP TABLE IF EXISTS clinic_rules CASCADE;
DROP TABLE IF EXISTS schedule_blocks CASCADE;
DROP TABLE IF EXISTS whatsapp_service_status CASCADE;
DROP TABLE IF EXISTS assistant_tasks CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS health_insurances CASCADE;
DROP TABLE IF EXISTS schedule_settings CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================== CRIAÇÃO DAS TABELAS =====================

-- PACIENTES
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pathology TEXT,
  whatsapp TEXT,
  birth_date DATE,
  referral_source TEXT,
  feedback_sent BOOLEAN DEFAULT FALSE,
  feedback_sent_at TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PAGADORES / CONVÊNIOS
CREATE TABLE health_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SERVIÇOS
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'particular',
  price NUMERIC DEFAULT 0,
  duration_minutes INTEGER DEFAULT 45,
  appointment_mode TEXT DEFAULT 'grupo',
  max_patients INTEGER DEFAULT 4,
  health_insurance_id UUID REFERENCES health_insurances(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PACOTES DE SESSÕES
CREATE TABLE session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  total_sessions INTEGER DEFAULT 0,
  remaining_sessions INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AGENDA
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 45,
  status TEXT DEFAULT 'agendado',
  package_consumed BOOLEAN DEFAULT FALSE,
  session_package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  appointment_reminder_sent BOOLEAN DEFAULT FALSE,
  appointment_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  appointment_reminder_provider_used TEXT,
  appointment_reminder_delivery_status TEXT,
  appointment_reminder_error_message TEXT,
  appointment_reminder_last_attempt_at TIMESTAMP WITH TIME ZONE,
  appointment_reminder_external_id TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  service_price_at_time NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ANAMNESE CLÍNICA
CREATE TABLE clinical_anamneses (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  chief_complaint TEXT,
  history TEXT,
  diagnosis TEXT,
  limitations TEXT,
  goals TEXT,
  obs TEXT,
  occupation_routine TEXT,
  physical_activity_context TEXT,
  red_flags TEXT,
  previous_treatments TEXT,
  psychosocial_factors TEXT,
  fear_avoidance TEXT,
  clinical_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- EVOLUÇÕES CLÍNICAS
CREATE TABLE clinical_evolutions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  conduct TEXT,
  guidance TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- HISTÓRICO DE DOCUMENTOS GERADOS
CREATE TABLE femic_generated_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  document_type TEXT,
  document_title TEXT,
  document_body TEXT,
  document_date DATE,
  rendered_html TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'femic_unified',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- HISTÓRICO DE MOVIMENTOS DE SESSÃO
CREATE TABLE session_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  session_package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  type TEXT,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- REGRAS COMPLEMENTARES DA CLÍNICA
CREATE TABLE clinic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  rule_category TEXT DEFAULT 'assistant',
  title TEXT NOT NULL,
  description TEXT,
  rule_value_json JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CONFIGURAÇÕES DA AGENDA
CREATE TABLE schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TEXT DEFAULT '08:00',
  end_time TEXT DEFAULT '20:00',
  working_days TEXT DEFAULT '1,2,3,4,5,6',
  working_periods TEXT DEFAULT '08:00-12:00,16:00-20:00',
  max_patients_per_slot INTEGER DEFAULT 4,
  slot_interval_minutes INTEGER DEFAULT 30,
  whatsapp_provider TEXT DEFAULT 'baileys',
  whatsapp_template_appointment TEXT,
  whatsapp_confirmation_hours_before INTEGER DEFAULT 12,
  whatsapp_service_name TEXT DEFAULT 'baileys-main',
  slots_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- BLOQUEIOS MANUAIS DA AGENDA
CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'active',
  origin TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STATUS DO CANAL WHATSAPP
CREATE TABLE whatsapp_service_status (
  service_name TEXT PRIMARY KEY,
  provider TEXT DEFAULT 'baileys',
  connection_status TEXT DEFAULT 'disconnected',
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PENDÊNCIAS DE CAPTAÇÃO (usado por captacao.html + bot)
CREATE TABLE assistant_tasks (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===================== CONFIGURAÇÃO INICIAL =====================

INSERT INTO schedule_settings (
  start_time,
  end_time,
  working_days,
  working_periods,
  max_patients_per_slot,
  slot_interval_minutes,
  whatsapp_provider,
  whatsapp_template_appointment,
  whatsapp_confirmation_hours_before,
  whatsapp_service_name,
  slots_config
) VALUES (
  '08:00',
  '20:00',
  '1,2,3,4,5,6',
  '08:00-12:00,16:00-20:00',
  4,
  30,
  'baileys',
  'Olá, {nome}! Tudo bem? Passando para confirmar seu atendimento na FEMIC: 📅 {data} ⏰ {hora}. Por favor, responda esta mensagem com: ✅ CONFIRMAR para manter o horário ou ❌ CANCELAR se não puder comparecer. Se precisar remarcar, é só avisar 😊',
  12,
  'baileys-main',
  '{"1":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"],"2":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"],"3":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"],"4":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"],"5":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"],"6":["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30"]}'
);

-- ===================== ÍNDICES =====================

CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_whatsapp ON patients(whatsapp);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_session_packages_patient ON session_packages(patient_id);
CREATE INDEX idx_movements_patient ON session_movements(patient_id);
CREATE INDEX idx_clinical_evolutions_patient_date ON clinical_evolutions(patient_id, date DESC);
CREATE INDEX idx_femic_generated_documents_patient ON femic_generated_documents(patient_id);
CREATE INDEX idx_femic_generated_documents_created ON femic_generated_documents(created_at DESC);
CREATE INDEX idx_schedule_blocks_date_status ON schedule_blocks(block_date, status);
CREATE INDEX idx_whatsapp_service_status_updated ON whatsapp_service_status(updated_at DESC);
CREATE INDEX idx_assistant_tasks_status ON assistant_tasks(status);
CREATE INDEX idx_assistant_tasks_origin ON assistant_tasks(origin);

-- ===================== RLS (Row Level Security) =====================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE femic_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anon: SELECT + INSERT para captação pública (pacientes e pendências)
GRANT SELECT, INSERT ON patients TO anon;
GRANT SELECT, INSERT ON assistant_tasks TO anon;

CREATE POLICY "authenticated_full_access_patients" ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_health_insurances" ON health_insurances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_services" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_schedule_settings" ON schedule_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_session_packages" ON session_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_session_movements" ON session_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_clinic_rules" ON clinic_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_schedule_blocks" ON schedule_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_whatsapp_service_status" ON whatsapp_service_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_clinical_anamneses" ON clinical_anamneses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_clinical_evolutions" ON clinical_evolutions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_femic_generated_documents" ON femic_generated_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_assistant_tasks" ON assistant_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies para anon (captação pública)
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_assistant_tasks" ON assistant_tasks FOR INSERT TO anon WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
