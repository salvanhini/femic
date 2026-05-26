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
- Este patch não é necessário para as melhorias de saldo/pacotes.

```sql
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

## WhatsApp: lembretes e preparação para Meta Cloud API

## Extensão Chrome: WhatsApp Web para tarefas IA
- Extensão local criada em `chrome-extension/`.
- Ela adiciona um botão flutuante `FEMIC` no WhatsApp Web.
- O botão envia marcações, remarcações e cancelamentos para a aba IA do FEMIC como tarefas operacionais.
- As pendências agora usam a tabela Supabase `assistant_tasks`, compartilhada entre desktop, FEMIC Mobile e extensão.
- O FEMIC Mobile pode gravar lembretes por voz direto nessa mesma fila; se o Supabase falhar, mantém cache local com sincronização pendente.
- Na Fase 1 do assistente de agendamento, as tarefas de marcação/remarcação vindas do WhatsApp passam a gerar propostas com horários válidos.
- A confirmação final continua humana: a equipe clica em um horário sugerido na aba **Pendências** e só então o FEMIC grava o agendamento.
- As propostas respeitam as regras da agenda: expediente, períodos, duração do serviço, conflitos, atendimento individual/grupo e limite de pacientes por horário.
- Instruções completas: `chrome-extension/README.md`.

### Fila compartilhada de pendências
Rode o SQL atualizado mostrado em `Configurações > Banco de dados` para criar `assistant_tasks`. Essa tabela guarda pedidos vindos do WhatsApp Web e lembretes de voz do mobile com status, paciente, telefone, ação solicitada, datas/turno interpretados, sugestões, candidatos, fingerprint da extensão e carimbos de criação/atualização.

## Sistema separado de agendamento
- O app fica em `femic-agendamento/` e deve ser enviado por link fixo aos pacientes.
- Link recomendado: `femic-agendamento/index.html?api=https://SEU-PROJETO.functions.supabase.co/scheduler-api`.
- O paciente informa nome, WhatsApp, serviço e preferência de período.
- A Function `scheduler-api` sugere horários com base no Supabase sem expor nomes de pacientes nem a agenda completa.
- Convênio/grupo prioriza encaixes em horários já ocupados com 1 a 3 pacientes; horários vazios aparecem depois; 4 pacientes bloqueia.
- Particular/individual mostra apenas horários totalmente livres.
- A escolha do paciente cria `appointment_requests.status = 'pendente'`; a clínica aprova na aba **Pendências** antes de criar o agendamento real.

SQL incremental para bancos existentes:

```sql
create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id text references public.patients(id) on delete set null,
  patient_name text not null,
  patient_whatsapp text not null,
  service_id uuid references public.services(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer default 45,
  status text default 'pendente',
  origin text default 'public_scheduler',
  preferred_period text,
  notes text,
  approved_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_appointment_requests_status_created on public.appointment_requests(status, created_at desc);

alter table public.appointment_requests enable row level security;
grant select, insert, update, delete on public.appointment_requests to authenticated;

drop policy if exists "authenticated_full_access_appointment_requests" on public.appointment_requests;
create policy "authenticated_full_access_appointment_requests"
  on public.appointment_requests for all to authenticated
  using (true) with check (true);
```

### Estado atual seguro
- A agenda envia lembretes pelo WhatsApp usando link `wa.me`, com a mensagem já preenchida.
- O envio manual continua funcionando como antes.
- A aba **Lembretes** permite alternar entre modo manual e modo automático local.
- O modo automático local verifica:
  - lembrete de sessão: 12 horas antes do horário marcado;
  - formulário pós-atendimento: 5 horas depois da sessão concluída.
- O navegador precisa estar aberto para o modo automático local abrir o WhatsApp.
- O sistema está preparado para uma futura integração com API, mas não coloca token da Meta no HTML, JS ou `localStorage`.

### Por que não colocar token da Meta no navegador
O token da Meta WhatsApp Cloud API permite enviar mensagens em nome do negócio. Se ele ficar no `index.html`, no `agenda.html`, em JavaScript público ou em `localStorage`, qualquer pessoa com acesso ao navegador ou ao código consegue copiar esse token. Por isso, a arquitetura segura futura é:

```text
index.html/agenda.html -> Supabase Edge Function -> Meta WhatsApp Cloud API
```

Na agenda ficam apenas:
- provedor desejado: `wa.me` ou API preparada;
- URL da Supabase Edge Function;
- nomes dos templates aprovados na Meta.

No Supabase ficam os segredos:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WABA_ID`

### Configuração no sistema FEMIC
Na agenda, acesse:

```text
Configurações -> WhatsApp API
```

Campos disponíveis:
- **Provedor de envio**
  - `Link WhatsApp seguro`: usa `wa.me`, recomendado enquanto a API não estiver pronta.
  - `API preparada via Supabase Edge Function`: salva a configuração para implementação futura, mas não envia pela API nesta versão.
- **Endpoint da Edge Function**
  - Exemplo: `https://SEU-PROJETO.functions.supabase.co/send-whatsapp-reminder`
- **Template Meta: sessão**
  - Sugestão: `lembrete_sessao`
- **Template Meta: formulário**
  - Sugestão: `formulario_pos_sessao`

Importante: nesta versão, o envio real continua por `wa.me`. A Edge Function precisa ser implementada e testada antes de substituir esse fallback seguro.

### Configuração no site da Meta
1. Acesse o Meta for Developers e crie um app do tipo Business.
2. Adicione o produto **WhatsApp** ao app.
3. No WhatsApp Manager, conecte ou crie:
   - Business Portfolio;
   - WhatsApp Business Account, também chamado WABA;
   - número de telefone comercial.
4. Guarde os IDs:
   - `WABA_ID`;
   - `PHONE_NUMBER_ID`.
5. Crie um token permanente pelo Business Manager/System User com permissões:
   - `whatsapp_business_messaging`;
   - `whatsapp_business_management`.
6. Registre o número da Cloud API, se a Meta solicitar PIN/código.
7. Crie templates de mensagem em português do Brasil (`pt_BR`), categoria Utility:
   - `lembrete_sessao`
   - `formulario_pos_sessao`
8. Aguarde aprovação dos templates pela Meta.
9. Teste um envio no painel da Meta ou com Postman antes de ligar no sistema.

Referências oficiais:
- Cloud API overview: https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- Mensagens e templates: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
- Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- Coleção Postman da Meta: https://www.postman.com/meta/whatsapp-business-platform/overview

### Supabase Edge Function sugerida
Crie uma função chamada:

```text
send-whatsapp-reminder
```

Segredos no Supabase:

```bash
supabase secrets set WHATSAPP_TOKEN="TOKEN_DA_META"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="PHONE_NUMBER_ID"
supabase secrets set WHATSAPP_WABA_ID="WABA_ID"
```

Contrato recomendado do corpo enviado pela agenda:

```json
{
  "kind": "appointment",
  "appointment_id": "uuid",
  "patient_id": "p123",
  "patient_name": "Nome do paciente",
  "patient_whatsapp": "16999999999",
  "appointment_date": "2026-05-10",
  "start_time": "08:00",
  "end_time": "08:45",
  "service_name": "Fisioterapia",
  "form_link": "https://...",
  "template_name": "lembrete_sessao"
}
```

Regras recomendadas para a Edge Function:
- validar o JWT do usuário logado no Supabase;
- aceitar apenas origem/domínio do sistema FEMIC;
- normalizar telefone para formato E.164 com DDI 55;
- enviar somente templates aprovados;
- retornar JSON com `ok`, `message_id` e `error`;
- gravar log em uma tabela separada antes de marcar lembrete como enviado.

### Tabela opcional para fila/log de WhatsApp
Para não mexer na tabela `appointments`, use uma tabela separada:

```sql
create table if not exists whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete set null,
  patient_id text references patients(id) on delete set null,
  kind text not null,
  provider text default 'meta_cloud_api',
  template_name text,
  phone text,
  status text default 'pending',
  message_id text,
  error text,
  payload jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz
);

alter table whatsapp_outbox enable row level security;

create policy "Authenticated read whatsapp outbox"
on whatsapp_outbox
for select
to authenticated
using (true);
```

### Estratégia para não quebrar o sistema
1. Manter `wa.me` como fallback.
2. Criar a Edge Function e testar fora da agenda.
3. Criar `whatsapp_outbox` para logs.
4. Só depois ligar o provedor API na agenda.
5. Se a API falhar, manter envio por `wa.me`.

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
- Agenda: versões antigas usavam RLS `DISABLE`; o SQL seguro atual usa RLS `ENABLE` com acesso para `authenticated` e Edge Functions com `service_role` apenas no servidor.
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
