# FEMIC

Sistema clínico da FEMIC Fisioterapia com:
- gestão de pacientes
- evolução clínica e técnica
- anamnese com IA (Gemini/DeepSeek)
- sincronização com Supabase
- módulo de agenda
- suporte a App da Web (PWA) em modo conservador

## Versões atuais
- Sistema principal (`index.html`): `v3.5.0-pwa`
- Agenda (`agenda.html`): `v1.4.44`

## Estrutura principal
- `index.html`: app clínico principal
- `agenda.html`: módulo de agenda
- `js/femic-app.js`: lógica clínica, IA, backup e sincronização
- `js/femic-agenda.js`: lógica da agenda
- `css/femic.css`: estilo do sistema principal
- `css/femic-agenda.css`: estilo da agenda
- `logo.png`: identidade visual

## IA clínica (anamnese e evolução técnica)
- Provedores suportados: Google Gemini e DeepSeek
- Configurável por:
  - setup inicial
  - página de Backup/Configurações
  - seletor dentro dos cards de IA
- Modo econômico de tokens:
  - reduz tamanho das respostas
  - prioriza escrita mais objetiva
  - pode ser ligado/desligado nos cards de IA

## PWA (App da Web) — implementação conservadora
- Manifestos:
  - `manifest-femic.webmanifest`
  - `manifest-agenda.webmanifest`
- Service workers:
  - `sw-femic.js`
  - `sw-agenda.js`
- Estratégia de segurança:
  - cache apenas de shell/arquivos estáticos
  - **não cacheia** rotas de API do Supabase (`/rest/v1/` e `/auth/v1/`)
  - sincronização permanece em rede

## Backup e sincronização
- Backup local em JSON (export/import)
- Backup manual em nuvem via Supabase
- Restauração de dados via Supabase

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

### 4) Histórico de documentos na nuvem (`documentos.html`)
```sql
create table if not exists public.femic_generated_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id text,
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

drop policy if exists "Allow anon read generated documents" on public.femic_generated_documents;
drop policy if exists "Allow anon insert generated documents" on public.femic_generated_documents;
drop policy if exists "Allow anon update generated documents" on public.femic_generated_documents;

create policy "Authenticated read"
  on public.femic_generated_documents for select
  using (auth.role() = 'authenticated');

create policy "Authenticated insert"
  on public.femic_generated_documents for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated update"
  on public.femic_generated_documents for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

### 5) Templates clínicos (`templates-admin.html`)
SQL recomendado para a tabela usada pela tela administrativa:

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
- Sistema principal (`index.html`): `supabaseUrl` e `supabaseKey` (armazenadas no navegador)
- Agenda (`agenda.html`): `femic_agenda_url` e `femic_agenda_key` (localStorage)
- Documentos (`documentos.html`): usa URL/chave salvas nas configurações da própria tela
- Templates admin (`templates-admin.html`): usa URL/chave do Supabase + login por e-mail/senha (JWT em sessão)

## Configuração de RLS e usuário (Supabase)

### Estratégia atual de RLS no projeto
- Sistema principal: RLS `ENABLE` + policy pública (`USING (true)`) nas tabelas clínicas.
- Formulário de paciente: RLS `ENABLE` + policy pública de leitura/escrita.
- Agenda: RLS `DISABLE` nas tabelas da agenda (modo operacional simples).
- Documentos em nuvem: RLS `ENABLE` + policies apenas para `authenticated`.
- Templates clínicos: RLS `ENABLE` + policy de CRUD para `authenticated`.

### Criar usuário administrativo (Auth)
No Supabase Studio:
1. `Authentication` > `Users` > `Add user`
2. Criar usuário com e-mail e senha para uso no `templates-admin.html`
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
