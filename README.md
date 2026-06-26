# FEMIC

Sistema clínico da FEMIC Fisioterapia com:
- gestão de pacientes
- evolução clínica e técnica
- anamnese e evolução com IA (Gemini/Groq/DeepSeek)
- sincronização com Supabase
- agenda unificada
- pacotes de sessões com saldo, recorrência e apoio para renovação

## Versões atuais
- Sistema unificado (`index.html`)

## Atualizações recentes

### Agenda, pacotes e saldo
- A busca **Buscar agendamentos para editar ou apagar** agora mostra o dia da semana antes da data.
- Cards de pacotes ativos exibem um aviso discreto quando o paciente ainda tem saldo, mas está na última sessão futura ou sem futuras marcadas.
- O card do pacote mostra:
  - saldo atual;
  - futuras marcadas;
  - última sessão futura;
  - quantidade que ainda falta agendar.
- O botão **Completar saldo** cria apenas as sessões que faltam para cobrir o saldo do pacote.
- O sistema detecta o padrão recente do paciente/serviço, por exemplo terça e quinta às 08:00, e tenta criar as próximas sessões nesses mesmos dias e horários.
- A criação respeita as regras já existentes de expediente, duração do serviço, conflitos e limite de pacientes.
- O saldo do pacote continua sendo consumido somente quando a sessão é marcada como `concluido`.
- Essa melhoria não exige alteração no Supabase. Ela usa as tabelas existentes `session_packages`, `appointments`, `patients` e `services`.

### Ficha do paciente
- A ficha mostra um resumo mais útil dos pacotes:
  - sessões usadas;
  - saldo;
  - futuras marcadas;
  - aviso de última futura ou ausência de futuras.
- O objetivo é reduzir a necessidade de procurar manualmente na agenda quando o paciente ainda tem saldo.

### Anamnese e evolução em nuvem
- Para salvar anamnese e evolução clínica no Supabase, é necessário criar as tabelas `clinical_anamneses` e `clinical_evolutions`.
- Use o patch SQL seguro da seção **Patch seguro: anamnese e evolução no Supabase**.
- Não use o SQL completo/resetado apenas para ativar esse recurso.

## Estrutura principal
- `index.html`: app clínico, agenda, documentos, histórico e IA
- `js/femic-agenda.js`: lógica da agenda
- `js/femic-unified.js`: prontuário, documentos, ficha, exportação clínica e histórico
- `js/femic-ai-center.js`: Central IA e apoio clínico
- `css/femic-agenda.css`: estilo principal do sistema unificado
- `css/femic-unified.css`: complementos do módulo unificado
- `logo.png`: identidade visual

## IA clínica (anamnese e evolução técnica)
- Provedores suportados: Google Gemini, Groq e DeepSeek
- Configurável na aba IA e em Configurações
- Consultas internas de agenda/sessões/pacotes funcionam sem API externa
- Anamnese e evolução são preenchidas como rascunho revisável, sem salvamento automático

## PWA
- Manifesto ativo: `manifest-agenda.webmanifest`
- O sistema unificado remove service workers antigos ao carregar para evitar cache obsoleto durante a refatoração.

## Backup e sincronização
- Backup local em JSON (export/import)
- Backup manual em nuvem via Supabase
- Restauração de dados via Supabase
- Backup completo inclui agenda, pacientes, pacotes, histórico de sessões, documentos e dados clínicos disponíveis.

## Patch seguro: anamnese e evolução no Supabase

Use este SQL quando o banco já existe e você só precisa ativar o salvamento de anamnese e evolução clínica em nuvem.

Importante:
- Este patch não apaga dados.
- Este patch não recria a agenda.
- Este patch também ativa os novos campos de cadastro clínico (`birth_date`, `referral_source`) e da anamnese rápida biopsicossocial.
- Este patch não é necessário para as melhorias de saldo/pacotes.

```sql
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS referral_source TEXT;

CREATE TABLE IF NOT EXISTS clinical_anamneses (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  chief_complaint TEXT,
  history TEXT,
  diagnosis TEXT,
  limitations TEXT,
  goals TEXT,
  obs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS occupation_routine TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS physical_activity_context TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS red_flags TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS previous_treatments TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS psychosocial_factors TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS fear_avoidance TEXT;

ALTER TABLE clinical_anamneses
ADD COLUMN IF NOT EXISTS clinical_summary TEXT;

CREATE TABLE IF NOT EXISTS clinical_evolutions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  conduct TEXT,
  guidance TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_patient_date
ON clinical_evolutions(patient_id, date DESC);

ALTER TABLE clinical_anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_evolutions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_anamneses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_evolutions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinical_anamneses'
      AND policyname = 'authenticated_full_access_clinical_anamneses'
  ) THEN
    CREATE POLICY "authenticated_full_access_clinical_anamneses"
    ON clinical_anamneses
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinical_evolutions'
      AND policyname = 'authenticated_full_access_clinical_evolutions'
  ) THEN
    CREATE POLICY "authenticated_full_access_clinical_evolutions"
    ON clinical_evolutions
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
```

## WhatsApp: bot Baileys no Discloud

O FEMIC usa um único canal automático de WhatsApp: o worker Baileys em `services/whatsapp-worker/`, hospedado no Discloud. O painel continua sendo o lugar de revisão e decisão; o bot envia lembretes, recebe pedidos de marcação/remarcação e cria pendências para a equipe confirmar.

Fluxo atual:
- O worker conecta no WhatsApp com Baileys e mantém a sessão fora do navegador.
- Quando `FEMIC_GROQ_API_KEY` está configurada no Discloud, o bot usa Groq para entender frases naturais do paciente.
- Quando `FEMIC_BAILEYS_ADMIN_PHONE` está configurado, o bot envia aviso por WhatsApp ao conectar ou reconectar.
- Lembretes são enviados automaticamente 12 horas antes para agendamentos `agendado` e `confirmado`.
- Pedidos recebidos pelo WhatsApp viram registros em `assistant_tasks`, mesmo quando o telefone ainda não está cadastrado como paciente.
- O bot sugere horários seguros quando consegue identificar serviço, data/turno e agenda suficiente.
- Fisioterapia por convênio, como Unimed, Hapvida, Pro Única ou outros, é tratada como grupo; quiropraxia e liberação miofascial são tratadas como individuais quando os serviços estão cadastrados assim.
- A v1 não agenda sozinha: a equipe revisa a pendência no FEMIC e confirma manualmente.
- O botão manual por `wa.me` fica apenas como contingência operacional quando o bot estiver indisponível.

Regras de agenda usadas pelo bot:
- Horários bloqueados em `schedule_blocks` não aparecem como sugestão.
- Se `schedule_blocks` ainda não existir, o worker segue funcionando e registra aviso no status/log.
- Agendamentos cancelados não ocupam vaga.
- Serviço individual exige exclusividade no intervalo.
- Serviço em grupo/convênio compartilha horário até `max_patients` do serviço ou limite global da agenda.
- Para convênio/grupo, o algoritmo prioriza preencher horários parcialmente ocupados antes de sugerir janelas vazias.

No painel FEMIC:
- `Configurações > WhatsApp` mostra apenas status do bot Baileys, nome do serviço, template e instruções de conexão.
- `Lembretes` funciona como fila/auditoria de pendentes, enviados, falhas, último erro e contingência manual.
- `Pendências` mostra solicitações vindas do bot para agendar, responder, ignorar ou bloquear horário.

Para gerar o pacote do Discloud:

```bash
npm run build:discloud
```

O arquivo final fica em `dist/femic-whatsapp-bot-discloud.zip`. As instruções operacionais detalhadas ficam em `services/whatsapp-worker/README.md`.

### Patch incremental para Supabase existente

Se o banco já existe, rode este patch antes de usar o bot Baileys:

```sql
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_reminder_provider_used TEXT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_reminder_delivery_status TEXT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_reminder_error_message TEXT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_reminder_last_attempt_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_reminder_external_id TEXT;

ALTER TABLE schedule_settings
ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT DEFAULT 'baileys';

ALTER TABLE schedule_settings
ADD COLUMN IF NOT EXISTS whatsapp_template_appointment TEXT;

ALTER TABLE schedule_settings
ADD COLUMN IF NOT EXISTS whatsapp_confirmation_hours_before INTEGER DEFAULT 12;

ALTER TABLE schedule_settings
ADD COLUMN IF NOT EXISTS whatsapp_service_name TEXT DEFAULT 'baileys-main';

UPDATE schedule_settings
SET whatsapp_template_appointment = COALESCE(
  whatsapp_template_appointment,
  'Olá, {nome}! Tudo bem? Passando para confirmar seu atendimento na FEMIC: 📅 {data} ⏰ {hora}. Por favor, responda esta mensagem com: ✅ CONFIRMAR para manter o horário ou ❌ CANCELAR se não puder comparecer. Se precisar remarcar, é só avisar 😊'
);

CREATE TABLE IF NOT EXISTS assistant_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'outro',
  status TEXT DEFAULT 'aberta',
  priority TEXT DEFAULT 'normal',
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT,
  suggestion_reason TEXT,
  phone TEXT,
  origin TEXT DEFAULT 'manual',
  requested_action TEXT,
  notes TEXT,
  suggested_slots JSONB DEFAULT '[]'::jsonb,
  candidates JSONB DEFAULT '[]'::jsonb,
  parsed_shift TEXT,
  parsed_dates JSONB DEFAULT '[]'::jsonb,
  extension_fingerprint TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status_updated
ON assistant_tasks(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_tasks_origin
ON assistant_tasks(origin);

CREATE TABLE IF NOT EXISTS schedule_blocks (
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

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date_status
ON schedule_blocks(block_date, status);

CREATE TABLE IF NOT EXISTS whatsapp_service_status (
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

CREATE INDEX IF NOT EXISTS idx_whatsapp_service_status_updated
ON whatsapp_service_status(updated_at DESC);

ALTER TABLE whatsapp_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_service_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_blocks TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_tasks'
      AND policyname = 'authenticated_full_access_assistant_tasks'
  ) THEN
    CREATE POLICY "authenticated_full_access_assistant_tasks"
    ON assistant_tasks
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_blocks'
      AND policyname = 'authenticated_full_access_schedule_blocks'
  ) THEN
    CREATE POLICY "authenticated_full_access_schedule_blocks"
    ON schedule_blocks
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_service_status'
      AND policyname = 'authenticated_full_access_whatsapp_service_status'
  ) THEN
    CREATE POLICY "authenticated_full_access_whatsapp_service_status"
    ON whatsapp_service_status
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
```

## Configuração SQL completa (Supabase)

### 1) Sistema principal (`index.html`)
Execute no SQL Editor do Supabase usado pelo sistema principal:

```sql
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pathology TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pain INTEGER,
  functionality INTEGER,
  satisfaction INTEGER,
  symptoms TEXT[],
  obs TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anamneses (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  chief_complaint TEXT,
  history TEXT,
  diagnosis TEXT,
  limitations TEXT,
  comorbidities TEXT,
  medications TEXT,
  goals TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_evolutions (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  date DATE,
  conduct TEXT,
  guidance TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  drive_url TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access" ON patients FOR ALL USING (true);
CREATE POLICY "Public access" ON sessions FOR ALL USING (true);
CREATE POLICY "Public access" ON anamneses FOR ALL USING (true);
CREATE POLICY "Public access" ON clinical_evolutions FOR ALL USING (true);
CREATE POLICY "Public access" ON patient_documents FOR ALL USING (true);
```

### 2) Respostas de formulário do paciente (`index.html` > importação automática)
```sql
create table if not exists patient_form_responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz default now(),
  response_date date not null,
  patient_name text not null,
  patient_whatsapp text not null,
  patient_pathology text,
  pain integer,
  functionality integer,
  satisfaction integer,
  symptoms text[],
  obs text,
  source text default 'patient_public_form',
  imported boolean default false,
  linked_patient_id text,
  imported_at timestamptz
);

alter table patient_form_responses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_form_responses'
      and policyname = 'Public insert and read'
  ) then
    create policy "Public insert and read"
    on patient_form_responses
    for all
    using (true)
    with check (true);
  end if;
end
$$;
```

### 3) Agenda (`agenda.html`)
Atenção: esse SQL da agenda faz `DROP TABLE` e recria a estrutura da agenda.

```sql
DROP TABLE IF EXISTS session_movements CASCADE;
DROP TABLE IF EXISTS session_packages CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS health_insurances CASCADE;
DROP TABLE IF EXISTS schedule_settings CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pathology TEXT,
  whatsapp TEXT,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE health_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

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
  form_reminder_sent BOOLEAN DEFAULT FALSE,
  form_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  service_price_at_time NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE session_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  session_package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  type TEXT,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TEXT DEFAULT '08:00',
  end_time TEXT DEFAULT '20:00',
  working_days TEXT DEFAULT '1,2,3,4,5,6',
  working_periods TEXT DEFAULT '08:00-12:00,16:00-20:00',
  max_patients_per_slot INTEGER DEFAULT 4,
  slot_interval_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO schedule_settings (
  start_time,
  end_time,
  working_days,
  working_periods,
  max_patients_per_slot,
  slot_interval_minutes
) VALUES (
  '08:00',
  '20:00',
  '1,2,3,4,5,6',
  '08:00-12:00,16:00-20:00',
  4,
  30
);

ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_insurances DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_movements DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
```

### 4) Histórico de documentos na nuvem
```sql
create table if not exists public.femic_generated_documents (
  id text primary key,
  patient_id text references public.patients(id) on delete set null,
  patient_name text,
  document_type text,
  document_title text,
  document_body text,
  document_date date,
  rendered_html text,
  metadata jsonb default '{}'::jsonb,
  status text default 'active',
  source text default 'gerador_documentos_femic',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_femic_gendocs_patient_id
  on public.femic_generated_documents(patient_id);

create index if not exists idx_femic_gendocs_created_at
  on public.femic_generated_documents(created_at desc);

alter table public.femic_generated_documents enable row level security;

grant select, insert, update, delete on public.femic_generated_documents to authenticated;

drop policy if exists "authenticated_full_access_femic_generated_documents" on public.femic_generated_documents;

create policy "authenticated_full_access_femic_generated_documents"
  on public.femic_generated_documents for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
```

### 5) Templates clínicos
SQL recomendado para templates clínicos, caso o recurso seja reativado:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.clinical_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  group_name text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clinical_templates_type
  on public.clinical_templates(type);

create index if not exists idx_clinical_templates_created_at
  on public.clinical_templates(created_at desc);

alter table public.clinical_templates enable row level security;

drop policy if exists "Authenticated CRUD clinical templates" on public.clinical_templates;
create policy "Authenticated CRUD clinical templates"
  on public.clinical_templates
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

### 6) Variáveis de conexão usadas no front
- Sistema unificado (`index.html`): `femic_agenda_url` e `femic_agenda_key` (localStorage)
- FEMIC Mobile (`femic-mobile.html`): usa as mesmas chaves `femic_agenda_url` e `femic_agenda_key`, com login Supabase próprio no celular.

## Configuração de RLS e usuário (Supabase)

### Estratégia atual de RLS no projeto
- Sistema principal: RLS `ENABLE` + policy pública (`USING (true)`) nas tabelas clínicas.
- Formulário de paciente: RLS `ENABLE` + policy pública de leitura/escrita.
- Agenda: versões antigas usavam RLS `DISABLE`; o SQL seguro atual usa RLS `ENABLE` com acesso para `authenticated` e uso de `service_role` apenas em serviços internos, como o bot no Discloud.
- Documentos em nuvem: RLS `ENABLE` + policies apenas para `authenticated`, se a tabela for usada.
- Templates clínicos: RLS `ENABLE` + policy de CRUD para `authenticated`, se o recurso for reativado.

### Criar usuário administrativo (Auth)
No Supabase Studio:
1. `Authentication` > `Users` > `Add user`
2. Criar usuário com e-mail e senha para uso administrativo, se necessário
3. Confirmar e-mail manualmente no painel (se necessário)

Opcional via SQL (perfil complementar em tabela própria):
```sql
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;

drop policy if exists "App users read own profile" on public.app_users;
create policy "App users read own profile"
  on public.app_users
  for select
  using (auth.uid() = id);

drop policy if exists "Admins full access app_users" on public.app_users;
create policy "Admins full access app_users"
  on public.app_users
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

### Boas práticas recomendadas
- Não usar `service_role` no front-end.
- Para produção, evitar policy pública (`USING (true)`) em tabelas sensíveis.
- Preferir policy por usuário (`auth.uid()`) ou por papel (`authenticated` + regra de negócio).
- Revisar periodicamente as policies em `Authentication` e `Database` > `Policies`.

## Observações
- As chaves de API ficam no armazenamento local do navegador.
- Para produção, usar HTTPS.
