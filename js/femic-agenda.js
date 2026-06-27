const SQL_SCHEMA = `-- FEMIC Agenda v1.5.0 - Supabase seguro + prontuário em nuvem
-- ATENÇÃO: este SQL reseta as tabelas operacionais deste Supabase.
-- Faça backup JSON antes de rodar em um banco com dados reais.
DROP TABLE IF EXISTS session_movements CASCADE;
DROP TABLE IF EXISTS session_packages CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clinical_evolutions CASCADE;
DROP TABLE IF EXISTS clinical_anamneses CASCADE;
DROP TABLE IF EXISTS femic_generated_documents CASCADE;
DROP TABLE IF EXISTS clinic_rules CASCADE;
DROP TABLE IF EXISTS schedule_blocks CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS health_insurances CASCADE;
DROP TABLE IF EXISTS schedule_settings CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PACIENTES
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pathology TEXT,
  whatsapp TEXT,
  birth_date DATE,
  referral_source TEXT,
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

-- CONFIGURAÇÃO INICIAL
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

-- ÍNDICES PARA USO NO PLANO FREE
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

-- SEGURANÇA: anon não acessa dados. Usuários autenticados da clínica acessam tudo.
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

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

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
NOTIFY pgrst, 'reload schema';`;
const $=id=>document.getElementById(id);let patients=[],payers=[],services=[],packages=[],appointments=[],reportAppointments=[],movements=[],clinicRules=[],scheduleBlocks=[],settings={start_time:'08:00',end_time:'20:00',working_days:'1,2,3,4,5,6',slot_interval_minutes:30,max_patients_per_slot:4,whatsapp_provider:'baileys',whatsapp_template_appointment:'',whatsapp_confirmation_hours_before:12,whatsapp_service_name:'baileys-main',slots_config:{}};let currentDate=new Date();let editingServiceId='';let loadedAppointmentQuery='',loadedReportQuery='',aiRadarQuery='',aiRadarAppointments=[],aiRadarLoaded=false,aiRadarLastWeeks=[],recurringSuggestionCache=[];let sessionPackagesEndedAtSupported=null;let whatsappServiceStatus=null;let lastUserInteractionAt=Date.now();const appointmentSearchSelected=new Set();
const packageScheduleCache=new Map();
let showArchivedPatients=false,showInactivePackages=false;
const dayAppointmentCache=new Map();
const packageHistoryCache=new Map();
const packagePatternCache=new Map();
let patientIndex=Object.create(null),serviceIndex=Object.create(null),payerIndex=Object.create(null);
const CLINIC_RULES_STORAGE_KEY='femic_agenda_clinic_rules';
const DEFAULT_WHATSAPP_REMINDER_TEMPLATE='Olá, {nome}! Tudo bem? Passando para confirmar seu atendimento na FEMIC: 📅 {data} ⏰ {hora}. Por favor, responda esta mensagem com: ✅ CONFIRMAR para manter o horário ou ❌ CANCELAR se não puder comparecer. Se precisar remarcar, é só avisar 😊';
function toast(msg,type='info'){const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;$('toastWrap').appendChild(el);setTimeout(()=>el.remove(),3600)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function localIsoDate(d){const x=new Date(d);return String(x.getFullYear())+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}function todayIso(){return localIsoDate(new Date())}function isoDate(d){return localIsoDate(d)}function dateDay(dateStr){const [y,m,d]=String(dateStr).split('-').map(Number);return new Date(y,m-1,d).getDay()}function fmtDate(s){if(!s)return'';const [y,m,d]=String(s).split('-');return d+'/'+m+'/'+y}function fmtDateTime(value){if(!value)return'';const dt=new Date(value);if(Number.isNaN(dt.getTime()))return fmtDate(String(value).slice(0,10));return dt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}function fmtWeekday(s){if(!s)return'';const [y,m,d]=String(s).split('-').map(Number);const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];return dias[new Date(y,m-1,d).getDay()]||''}function cleanPhone(v){return String(v||'').replace(/\D/g,'')}function brl(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}function normalizeTime(t){return String(t||'').slice(0,5)}function timeToMin(t){const [h,m]=normalizeTime(t).split(':').map(Number);return h*60+(m||0)}function minToTime(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}function addMinutes(t,m){return minToTime(timeToMin(t)+Number(m||0))}function base(){return ($('sbUrl').value||localStorage.femic_agenda_url||'').trim().replace(/\/$/,'')}function key(){return ($('sbKey').value||localStorage.femic_agenda_key||'').trim()}function hasValidSession(){const jwt=sessionStorage.getItem('femic_jwt');const expiry=Number(sessionStorage.getItem('femic_token_expiry')||0);return !!(jwt&&expiry&&Date.now()<expiry)}async function ensureSession(){if(hasValidSession())return true;if(sessionStorage.getItem('femic_refresh_token')&&await femicRefreshToken())return true;throw new Error('Faça login para acessar os dados do Supabase.')}function headers(){
  const jwt = sessionStorage.getItem('femic_jwt');
  const expiry = Number(sessionStorage.getItem('femic_token_expiry') || 0);
  const tokenValid = jwt && expiry && Date.now() < expiry;
  const authJwt = tokenValid ? jwt : '';
  if (jwt && expiry && Date.now() > expiry && sessionStorage.getItem('femic_refresh_token')) {
    femicRefreshToken().catch(function(){});
  }
  return{apikey:key(),Authorization:'Bearer '+authJwt,'Content-Type':'application/json',Prefer:'return=representation'};
}
async function api(path,opt={}){await ensureSession();const res=await fetch(base()+'/rest/v1/'+path,{headers:headers(),...opt});const txt=await res.text();let data;try{data=txt?JSON.parse(txt):null}catch(e){data=txt}if(!res.ok){console.error('Supabase error',path,res.status,data);throw new Error((data&&data.message)||txt||('HTTP '+res.status))}return data}
function reminderUtils(){return typeof FEMICWhatsappReminderUtils==='object'&&FEMICWhatsappReminderUtils?FEMICWhatsappReminderUtils:null}
function slotUtils(){return typeof FEMICAppointmentSlotUtils==='object'&&FEMICAppointmentSlotUtils?FEMICAppointmentSlotUtils:null}
function readClinicRulesCache(){try{const raw=JSON.parse(localStorage.getItem(CLINIC_RULES_STORAGE_KEY)||'[]');return Array.isArray(raw)?raw:[]}catch(e){return[]}}
function writeClinicRulesCache(list){localStorage.setItem(CLINIC_RULES_STORAGE_KEY,JSON.stringify(Array.isArray(list)?list:[]))}
function isMissingClinicRulesTableError(err){return /clinic_rules|relation .* does not exist|Could not find the table/i.test(String(err&&err.message||err||''))}
function isMissingScheduleBlocksTableError(err){return /schedule_blocks|relation .* does not exist|Could not find the table|schema cache/i.test(String(err&&err.message||err||''))}
function isMissingEndedAtColumnError(err){return /ended_at|column .* does not exist|schema cache/i.test(String(err&&err.message||err||''))}
function isMissingWhatsappStatusTableError(err){return /whatsapp_service_status|relation .* does not exist|Could not find the table|schema cache/i.test(String(err&&err.message||err||''))}
function isMissingWhatsappSettingsSchemaError(err){return /whatsapp_provider|whatsapp_template_appointment|whatsapp_confirmation_hours_before|whatsapp_service_name|schema cache|column .* does not exist/i.test(String(err&&err.message||err||''))}
async function detectSessionPackagesEndedAtSupport(){
  if(sessionPackagesEndedAtSupported!==null) return sessionPackagesEndedAtSupported;
  try{
    await api('session_packages?select=ended_at&limit=1');
    sessionPackagesEndedAtSupported=true;
  }catch(e){
    if(isMissingEndedAtColumnError(e)){
      sessionPackagesEndedAtSupported=false;
    }else{
      throw e;
    }
  }
  return sessionPackagesEndedAtSupported;
}
function whatsappProviderValue(){
  return 'baileys';
}
function whatsappServiceNameValue(){
  return settings.whatsapp_service_name||localStorage.femic_whatsapp_service_name||'baileys-main';
}
async function refreshWhatsappServiceStatus(){
  if(!base()||!key()||!hasValidSession()){
    whatsappServiceStatus=null;
    renderWhatsappServiceStatus();
    return null;
  }
  try{
    const rows=await api('whatsapp_service_status?select=*&service_name=eq.'+encodeURIComponent(whatsappServiceNameValue())+'&limit=1');
    whatsappServiceStatus=(rows&&rows[0])||null;
  }catch(e){
    if(isMissingWhatsappStatusTableError(e)){
      whatsappServiceStatus=null;
    }else{
      console.error(e);
    }
  }
  renderWhatsappServiceStatus();
  return whatsappServiceStatus;
}
function renderWhatsappServiceStatus(){
  const targets=['whatsappServiceStatusPanel','whatsappServiceStatusInline'];
  const status=whatsappServiceStatus||null;
  const serviceName=whatsappServiceNameValue();
  let message='',severity='info';
  const lastSeen=status&&status.last_seen_at?new Date(status.last_seen_at):null;
  const stale=lastSeen&&!Number.isNaN(lastSeen.getTime())&&(Date.now()-lastSeen.getTime()>3*60*1000);
  if(status&&status.connection_status==='connected'){
    severity=stale?'warning':'success';
    message=stale?'Atenção: bot Baileys sem heartbeat recente.':'Canal WhatsApp: Baileys conectado';
    if(status.last_connected_at) message+=' · conectado em '+fmtDateTime(status.last_connected_at);
    if(status.last_message_at) message+=' · último envio '+fmtDateTime(status.last_message_at);
    if(stale&&status.last_seen_at) message+=' · último sinal '+fmtDateTime(status.last_seen_at);
  }else if(status&&status.connection_status){
    severity='danger';
    message='Atenção: bot Baileys '+status.connection_status+'. O envio automático pode estar parado.';
    if(status.last_error) message+=' · '+String(status.last_error).slice(0,120);
    if(status.last_seen_at) message+=' · último sinal '+fmtDateTime(status.last_seen_at);
  }else{
    severity='warning';
    message='Atenção: FEMIC ainda não recebeu heartbeat do bot "'+serviceName+'". Confirme se o Discloud está rodando.';
  }
  targets.forEach(function(id){
    const node=$(id);
    if(node){
      node.textContent=message;
      node.dataset.status=severity;
      node.style.borderLeftColor=severity==='success'?'#10b981':severity==='danger'?'#ef4444':severity==='warning'?'#f59e0b':'var(--primary2)';
      node.style.background=severity==='success'?'#ecfdf5':severity==='danger'?'#fff1f2':severity==='warning'?'#fffbeb':'#f1fbff';
      node.style.color=severity==='danger'?'#991b1b':severity==='warning'?'#92400e':severity==='success'?'#065f46':'var(--primary)';
    }
  });
}
function packageEndedAtPatchValue(value){
  return sessionPackagesEndedAtSupported ? {ended_at:value} : {};
}
function packageHistoryByPatient(patientId){
  const cacheKey=String(patientId||'');
  if(packageHistoryCache.has(cacheKey)) return packageHistoryCache.get(cacheKey);
  const history=packages
    .filter(p=>String(p.patient_id)===cacheKey)
    .slice()
    .sort((a,b)=>{
      const createdCompare=String(a.created_at||'').localeCompare(String(b.created_at||''));
      if(createdCompare) return createdCompare;
      return String(a.id||'').localeCompare(String(b.id||''));
    });
  packageHistoryCache.set(cacheKey,history);
  return history;
}
function packageTimelineMeta(pkg){
  const history=packageHistoryByPatient(pkg.patient_id);
  const index=history.findIndex(item=>String(item.id)===String(pkg.id));
  const position=index>=0?index+1:1;
  return {
    position,
    total:history.length,
    label:position+'º pacote'
  };
}
function packageTimelineStatus(pkg){
  if(pkg.active!==false) return 'Em andamento';
  if(pkg.ended_at) return 'Encerrado em '+fmtDateTime(pkg.ended_at);
  return 'Inativo sem data registrada';
}
function rebuildReferenceIndexes(){
  patientIndex=Object.create(null);
  serviceIndex=Object.create(null);
  payerIndex=Object.create(null);
  patients.forEach(patient=>{patientIndex[String(patient.id)]=patient;});
  services.forEach(service=>{serviceIndex[String(service.id)]=service;});
  payers.forEach(payer=>{payerIndex[String(payer.id)]=payer;});
}
async function loadClinicRulesCollection(){try{const rows=await api('clinic_rules?select=*&order=priority.asc,created_at.asc');writeClinicRulesCache(rows||[]);return rows||[]}catch(e){if(isMissingClinicRulesTableError(e))return readClinicRulesCache();throw e}}
clinicRules=readClinicRulesCache();
function saveConfig(){localStorage.femic_agenda_url=$('sbUrl').value.trim();localStorage.femic_agenda_key=$('sbKey').value.trim();toast('Configuração salva.','success')}function loadConfig(){$('sbUrl').value=localStorage.femic_agenda_url||'';$('sbKey').value=localStorage.femic_agenda_key||'';const tpl=localStorage.femic_tpl_reminder||DEFAULT_WHATSAPP_REMINDER_TEMPLATE;$('tplReminder').value=tpl;localStorage.femic_whatsapp_provider='baileys';if($('whatsappProvider'))$('whatsappProvider').value='baileys';if($('whatsappServiceName'))$('whatsappServiceName').value=localStorage.femic_whatsapp_service_name||'baileys-main';renderWhatsappProviderBadge();if($('setSlotStart'))$('setSlotStart').value=settings.start_time||'08:00';if($('setSlotEnd'))$('setSlotEnd').value=settings.end_time||'20:00';if(typeof renderSlotsConfig==='function')renderSlotsConfig()}
async function testConnection(){try{await api('patients?select=id&limit=1');toast('Conexão e carregamento funcionando.','success')}catch(e){toast('Erro real: '+e.message,'error')}}
function appointmentWindowQuery(){
  const mode = $('viewMode') ? $('viewMode').value : 'week';
  let from, to;
  if(mode === 'month'){
    from = localIsoDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    to = localIsoDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
  }else{
    const start = weekStart(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    from = localIsoDate(start);
    to = localIsoDate(end);
  }
  return 'appointments?select=*&appointment_date=gte.' + from + '&appointment_date=lte.' + to + '&order=appointment_date.asc,start_time.asc';
}
function appointmentReportQuery(month){
  const parts = String(month || new Date().toISOString().slice(0,7)).split('-').map(Number);
  const y = parts[0], m = parts[1] || 1;
  const from = String(y).padStart(4,'0') + '-' + String(m).padStart(2,'0') + '-01';
  const to = localIsoDate(new Date(y, m, 0));
  return 'appointments?select=*&appointment_date=gte.' + from + '&appointment_date=lte.' + to + '&order=appointment_date.asc,start_time.asc';
}
async function refreshAppointmentWindowIfNeeded(){
  const query = appointmentWindowQuery();
  if(!base() || !key() || query === loadedAppointmentQuery) return;
  try{
    appointments = await api(query) || [];
    loadedAppointmentQuery = query;
    renderAgenda();
    renderAppointmentSearch();
    document.dispatchEvent(new CustomEvent('femic:state-updated'));
  }catch(e){
    console.error(e);
    toast('Erro ao carregar período da agenda: ' + e.message, 'error');
  }
}
async function refreshReportMonthIfNeeded(month){
  const query = appointmentReportQuery(month);
  if(!base() || !key() || query === loadedReportQuery) return;
  try{
    reportAppointments = await api(query) || [];
    loadedReportQuery = query;
    renderReport(true);
    document.dispatchEvent(new CustomEvent('femic:state-updated'));
  }catch(e){
    console.error(e);
    toast('Erro ao carregar relatório mensal: ' + e.message, 'error');
  }
}
async function loadAll(silent=false){if(!base()||!key()){if(!silent)toast('Preencha URL e anon key.','warning');return}try{const apQuery=appointmentWindowQuery();const [pa,hi,sv,pk,ap,mv,st,cr,blocks,endedAtSupport]=await Promise.all([api('patients?select=*&order=name'),api('health_insurances?select=*&order=name'),api('services?select=*&order=name'),api('session_packages?select=*&order=created_at.desc'),api(apQuery),api('session_movements?select=*&order=created_at.desc'),api('schedule_settings?select=*&limit=1'),loadClinicRulesCollection(),loadScheduleBlocksCollection(),detectSessionPackagesEndedAtSupport()]);patients=pa||[];payers=hi||[];services=sv||[];packages=pk||[];appointments=ap||[];scheduleBlocks=blocks||[];loadedAppointmentQuery=apQuery;loadedReportQuery='';reportAppointments=[];aiRadarQuery='';aiRadarLoaded=false;movements=mv||[];clinicRules=cr||[];settings=Object.assign(settings,(st&&st[0])||{});sessionPackagesEndedAtSupported=endedAtSupport;if(typeof renderSlotsConfig==='function')renderSlotsConfig();rebuildReferenceIndexes();patientPickerItemsCache=null;packageScheduleCache.clear();packageHistoryCache.clear();packagePatternCache.clear();dayAppointmentCache.clear();syncForms();refreshWhatsappServiceStatus();recordSystemLoad(true);renderActivePanel();document.dispatchEvent(new CustomEvent('femic:state-updated'));if(!silent)toast('Dados carregados.','success')}catch(e){console.error(e);recordSystemLoad(false,e.message);toast('Erro ao carregar: '+e.message,'error')}}
function toggleSidebar(){
  $('sidebar')?.classList.toggle('show');
  $('overlay')?.classList.toggle('show');
}

function closeSidebar(){
  $('sidebar')?.classList.remove('show');
  $('overlay')?.classList.remove('show');
}

function syncAgendaNavState(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
  document.querySelectorAll('.nav-link[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
}

function getActivePanelName(){
  const active = document.querySelector('.panel.active');
  return active ? String(active.id || '').replace('panel-','') : 'agenda';
}

function defaultClinicRules(){
  return [
    {
      rule_key:'scheduling_human_confirmation',
      rule_category:'assistant',
      title:'Confirmação humana obrigatória',
      description:'Pedidos vindos do WhatsApp geram propostas, mas só são gravados quando a equipe confirma no FEMIC.',
      rule_value_json:{scope:'assistant'},
      active:true,
      priority:10
    },
    {
      rule_key:'respect_working_periods',
      rule_category:'scheduling',
      title:'Respeitar expediente e conflitos',
      description:'Sugestões devem respeitar dias de trabalho, períodos configurados, duração do serviço, atendimento individual/grupo e limite por horário.',
      rule_value_json:{scope:'agenda'},
      active:true,
      priority:20
    },
    {
      rule_key:'clinical_drafts_require_review',
      rule_category:'clinical_ai',
      title:'Rascunhos clínicos precisam de revisão',
      description:'Anamnese e evolução geradas por IA são apenas rascunhos. O profissional revisa antes de salvar.',
      rule_value_json:{scope:'clinical_ai'},
      active:true,
      priority:30
    }
  ];
}

function normalizeClinicRule(rule,index){
  const normalized={
    rule_key:String(rule.rule_key||('clinic_rule_'+(index+1))).trim(),
    rule_category:String(rule.rule_category||'assistant').trim(),
    title:String(rule.title||'Regra da clínica').trim(),
    description:String(rule.description||'').trim(),
    rule_value_json:rule.rule_value_json&&typeof rule.rule_value_json==='object'?rule.rule_value_json:{},
    active:rule.active!==false,
    priority:Number(rule.priority||((index+1)*10))
  };
  if(rule.id) normalized.id=rule.id;
  return normalized;
}

function renderClinicRulesEditor(){
  const editor=$('clinicRulesEditor'),status=$('clinicRulesStatus');
  if(!editor) return;
  const list=(clinicRules&&clinicRules.length?clinicRules:defaultClinicRules()).map(normalizeClinicRule);
  editor.innerHTML=list.map((rule,index)=>`<div class="clinic-rule-item" data-rule-index="${index}">
    <input type="hidden" data-field="id" value="${esc(rule.id||'')}">
    <div class="grid grid-2">
      <div class="field"><label>Título</label><input data-field="title" value="${esc(rule.title)}"></div>
      <div class="field"><label>Chave</label><input data-field="rule_key" value="${esc(rule.rule_key)}"></div>
      <div class="field"><label>Categoria</label><input data-field="rule_category" value="${esc(rule.rule_category)}"></div>
      <div class="field"><label>Prioridade</label><input data-field="priority" type="number" value="${esc(rule.priority)}"></div>
    </div>
    <div class="field" style="margin-top:8px"><label>Descrição</label><textarea data-field="description" rows="3">${esc(rule.description)}</textarea></div>
    <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input data-field="active" type="checkbox" ${rule.active?'checked':''}> Regra ativa</label>
  </div>`).join('');
  if(status) status.textContent=list.length+' regra(s) carregada(s)';
}

function readClinicRulesEditor(){
  const editor=$('clinicRulesEditor');
  if(!editor) return [];
  return Array.from(editor.querySelectorAll('.clinic-rule-item')).map((item,index)=>{
    const value=(field)=>item.querySelector('[data-field="'+field+'"]');
    const id=(value('id')?.value||'').trim();
    const rule=normalizeClinicRule({
      id:id||null,
      rule_key:value('rule_key')?.value,
      rule_category:value('rule_category')?.value,
      title:value('title')?.value,
      description:value('description')?.value,
      active:!!value('active')?.checked,
      priority:value('priority')?.value,
      rule_value_json:{source:'settings'}
    },index);
    if(!rule.id) delete rule.id;
    return rule;
  });
}

async function saveClinicRules(){
  const list=readClinicRulesEditor();
  if(!list.length){toast('Nenhuma regra para salvar.','warning');return}
  clinicRules=list;
  writeClinicRulesCache(list);
  try{
    if(base()&&key()&&hasValidSession()){
      await deleteAllRows('clinic_rules');
      await upsertRows('clinic_rules', list);
      clinicRules=await loadClinicRulesCollection();
    }
    renderClinicRulesEditor();
    renderBackupPanel();
    document.dispatchEvent(new CustomEvent('femic:state-updated'));
    toast('Regras da clínica salvas.','success');
  }catch(e){
    if(isMissingClinicRulesTableError(e)){
      renderClinicRulesEditor();
      toast('Tabela clinic_rules ausente. Regras salvas localmente e incluídas no backup.','warning');
      return;
    }
    toast('Erro ao salvar regras: '+e.message,'error');
  }
}

function resetClinicRulesToDefaults(){
  if(!confirm('Restaurar as regras padrão da clínica?')) return;
  clinicRules=defaultClinicRules();
  writeClinicRulesCache(clinicRules);
  renderClinicRulesEditor();
  renderBackupPanel();
  document.dispatchEvent(new CustomEvent('femic:state-updated'));
  toast('Regras padrão restauradas localmente. Clique em salvar para enviar ao Supabase.','info');
}

function scheduleBlockDate(block){return String(block&&block.block_date||'')}
function isActiveScheduleBlock(block){return !['inactive','reopened','cancelado','cancelled'].includes(String(block&&block.status||'active').toLowerCase())}
function activeScheduleBlocksForDate(date){return scheduleBlocks.filter(block=>scheduleBlockDate(block)===String(date)&&isActiveScheduleBlock(block))}
function activeScheduleBlockForSlot(date,start,end){
  const utils=slotUtils();
  if(!utils||typeof utils.slotBlocked!=='function')return null;
  return activeScheduleBlocksForDate(date).find(block=>utils.slotBlocked({appointment_date:date,start_time:start,end_time:end},[block]))||null;
}
async function loadScheduleBlocksCollection(){
  const from=localIsoDate(new Date(Date.now()-7*86400000));
  const end=new Date();end.setDate(end.getDate()+45);
  try{
    return await api('schedule_blocks?select=*&block_date=gte.'+from+'&block_date=lte.'+isoDate(end)+'&order=block_date.asc,start_time.asc')||[];
  }catch(e){
    if(isMissingScheduleBlocksTableError(e))return[];
    throw e;
  }
}
async function blockScheduleSlot(date,start,end,reason){
  if(!date||!start||!end){toast('Informe data, início e fim para bloquear.','warning');return}
  try{
    await api('schedule_blocks',{method:'POST',body:JSON.stringify({block_date:date,start_time:start,end_time:end,reason:reason||'Bloqueio manual',status:'active',origin:'manual'})});
    await loadAll(true);
    toast('Horário bloqueado. O bot não vai oferecer este encaixe.','success');
  }catch(e){
    toast(isMissingScheduleBlocksTableError(e)?'Tabela schedule_blocks ausente. Rode o SQL atualizado para usar bloqueios.':'Erro ao bloquear horário: '+e.message,isMissingScheduleBlocksTableError(e)?'warning':'error');
  }
}
async function quickBlockSlot(date,start,end){
  const reason=prompt('Motivo do bloqueio deste horário:', 'Bloqueado pela equipe');
  if(reason===null)return;
  await blockScheduleSlot(date,start,end,reason);
}
async function quickBlockDay(date){
  const start=prompt('Qual horário inicial bloquear? Ex.: 08:00', slots()[0]||settings.start_time||'08:00');
  if(!start)return;
  const end=prompt('Qual horário final bloquear?', addMinutes(start,agendaSlotStep()));
  if(!end)return;
  await quickBlockSlot(date,normalizeTime(start),normalizeTime(end));
}
async function reopenScheduleBlock(id){
  if(!id)return;
  try{
    await api('schedule_blocks?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:'inactive',updated_at:new Date().toISOString()})});
    await loadAll(true);
    toast('Horário reaberto.','success');
  }catch(e){
    toast('Erro ao reabrir horário: '+e.message,'error');
  }
}

function recordSystemLoad(ok,message=''){
  localStorage.setItem('femic_last_load_status', ok ? 'ok' : 'error');
  localStorage.setItem('femic_last_load_at', new Date().toISOString());
  if(message) localStorage.setItem('femic_last_load_message', String(message));
}

function healthItemHtml(status,title,detail){
  return `<div class="health-item ${esc(status)}"><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`;
}

function renderSystemHealth(items){
  const target=$('systemHealthGrid');if(!target)return;
  const lastAt=localStorage.getItem('femic_last_load_at');
  const fallback=[
    {status:base()&&key()?'ok':'warn',title:'Configuração Supabase',detail:base()&&key()?'URL e anon key preenchidas.':'Preencha URL e anon key para carregar dados.'},
    {status:hasValidSession()?'ok':'warn',title:'Sessão',detail:hasValidSession()?'Sessão autenticada ativa.':'Faça login para acessar o Supabase.'},
    {status:lastAt?'ok':'neutral',title:'Última atualização',detail:lastAt?new Date(lastAt).toLocaleString('pt-BR'):'Ainda sem carregamento registrado.'}
  ];
  target.innerHTML=(items||fallback).map(item=>healthItemHtml(item.status,item.title,item.detail)).join('');
}

function scriptVersionLabel(name){
  const node=[...document.scripts].find(s=>String(s.src||'').includes(name));
  if(!node)return 'Não encontrado no HTML.';
  const query=String(node.src).split('?')[1]||'sem versão na URL';
  return query;
}

async function checkOptionalTable(table){
  try{
    await api(table+'?select=id&limit=1');
    return {status:'ok',title:table,detail:'Tabela acessível.'};
  }catch(e){
    if(/relation .* does not exist|Could not find the table|schema cache|does not exist/i.test(String(e&&e.message||e||''))){
      return {status:'warn',title:table,detail:'Opcional ausente. Rode o patch incremental se precisar deste recurso.'};
    }
    return {status:'danger',title:table,detail:String(e.message||e).slice(0,120)};
  }
}

async function runSystemHealthCheck(){
  const target=$('systemHealthGrid');
  if(target)target.innerHTML=healthItemHtml('neutral','Verificando','Conferindo sessão, scripts, cache e tabelas opcionais.');
  const items=[
    {status:base()&&key()?'ok':'warn',title:'Configuração Supabase',detail:base()&&key()?'URL e anon key preenchidas.':'Configuração incompleta.'},
    {status:hasValidSession()?'ok':'warn',title:'Sessão',detail:hasValidSession()?'Sessão autenticada ativa.':'Sessão ausente ou expirada.'},
    {status:'ok',title:'Agenda JS',detail:scriptVersionLabel('femic-agenda.js')},
    {status:'ok',title:'Prontuário JS',detail:scriptVersionLabel('femic-unified.js')},
    {status:'ok',title:'Central IA JS',detail:scriptVersionLabel('femic-ai-center.js')},
    {status:'neutral',title:'Service worker/cache',detail:'Limpeza automática configurada no carregamento do sistema.'}
  ];
  const lastAt=localStorage.getItem('femic_last_load_at');
  if(lastAt)items.push({status:localStorage.getItem('femic_last_load_status')==='error'?'danger':'ok',title:'Última atualização',detail:new Date(lastAt).toLocaleString('pt-BR')+(localStorage.getItem('femic_last_load_message')?' · '+localStorage.getItem('femic_last_load_message'):'')});
  if(base()&&key()&&hasValidSession()){
    const optional=['clinical_anamneses','clinical_evolutions','clinic_rules','schedule_blocks','whatsapp_service_status'];
    const checked=await Promise.all(optional.map(checkOptionalTable));
    items.push(...checked);
  }else{
    items.push({status:'warn',title:'Tabelas opcionais',detail:'Faça login para verificar Supabase.'});
  }
  renderSystemHealth(items);
}

function renderPanel(name){
  switch(name){
    case 'agenda':
      renderAgenda();
      renderAppointmentSearch();
      break;
    case 'day':
      renderDay();
      break;
    case 'patients':
      renderLists();
      break;
    case 'packages':
    case 'settings':
      renderLists();
      renderClinicRulesEditor();
      if(name==='settings') renderSystemHealth();
      break;
    case 'reminders':
      renderReminders();
      break;
    case 'agenda-assistida':
      break;
    case 'report':
      renderReport();
      break;
    case 'backup':
      renderBackupPanel();
      break;
    default:
      break;
  }
}

function renderActivePanel(){
  renderPanel(getActivePanelName());
}

function showPanel(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  syncAgendaNavState(name);
  $('panel-'+name).classList.add('active');
  closeSidebar();
  renderPanel(name);
}
function renderAll(){renderAgenda();renderDay();renderReminders();renderAIRadar();renderReport();renderLists();renderBackupPanel();renderAppointmentSearch()}function patientById(id){return patientIndex[String(id)]||patients.find(p=>String(p.id)===String(id))||{}}function serviceById(id){return serviceIndex[String(id)]||services.find(s=>String(s.id)===String(id))||{}}function payerName(id){return (payerIndex[String(id)]||payers.find(p=>String(p.id)===String(id))||{}).name||'Particular'}function patientName(id){return patientById(id).name||'Paciente'}function serviceName(id){return serviceById(id).name||'Sem serviço'}
function assistantPeriodMatches(start,period){const p=String(period||'').toLowerCase();const m=timeToMin(start);if(p==='manha')return m<12*60;if(p==='tarde')return m>=12*60&&m<18*60;if(p==='noite')return m>=18*60;return true}
function assistantAppointmentPayload(input={}){const sid=input.service_id||input.serviceId,pid=input.patient_id||input.patientId,date=input.appointment_date||input.date,start=normalizeTime(input.start_time||input.start);if(!pid)throw new Error('Paciente não identificado.');if(!sid)throw new Error('Serviço não identificado.');if(!date)throw new Error('Data não informada.');if(!start)throw new Error('Horário inicial não informado.');const s=serviceById(sid);if(!s||!s.id)throw new Error('Serviço não encontrado.');const duration=Number(input.duration_minutes||s.duration_minutes||45);const end=normalizeTime(input.end_time||input.end||addMinutes(start,duration));return{patient_id:pid,service_id:sid,appointment_date:date,start_time:start,end_time:end,duration_minutes:duration,status:input.status||'agendado',service_price_at_time:Number(input.service_price_at_time!=null?input.service_price_at_time:getServiceDefaultPrice(sid))}}
async function validateAssistantAppointment(input={}){const payload=assistantAppointmentPayload(input);if(timeToMin(payload.end_time)<=timeToMin(payload.start_time))return{valid:false,reason:'O horário final precisa ser maior que o inicial.',payload};if(!isTodayDate(payload.appointment_date)&&!isWorking(payload.appointment_date))return{valid:false,reason:'Dia fora do expediente.',payload};if(!isInsideWorkingTime(payload.appointment_date,payload.start_time,payload.end_time))return{valid:false,reason:'Horário fora dos períodos de expediente configurados.',payload};let rows=appointments.filter(a=>a.appointment_date===payload.appointment_date);try{rows=await fetchAppointmentsForDate(payload.appointment_date)}catch(e){}const conflict=conflictInAppointmentList(payload,rows,input.ignore_id||input.ignoreId||null);if(conflict)return{valid:false,reason:conflict,payload};return{valid:true,reason:'Horário disponível.',payload,patient:patientById(payload.patient_id),service:serviceById(payload.service_id)}}
async function suggestAssistantAppointmentSlots(input={}){const sid=input.service_id||input.serviceId,pid=input.patient_id||input.patientId;if(!pid)return{slots:[],reason:'Paciente não identificado.'};if(!sid)return{slots:[],reason:'Serviço não identificado.'};const s=serviceById(sid);if(!s||!s.id)return{slots:[],reason:'Serviço não encontrado.'};const dates=(Array.isArray(input.dates)?input.dates:[input.appointment_date||input.date]).filter(Boolean).slice(0,8);if(!dates.length)return{slots:[],reason:'Informe ao menos uma data para buscar horários.'};let rows=appointments.filter(a=>dates.includes(String(a.appointment_date||'')));try{const sorted=[...dates].sort();rows=await fetchAppointmentsForRange(sorted[0],sorted[sorted.length-1])}catch(e){}const servicesById=Object.create(null);services.forEach(service=>{servicesById[String(service.id)]=service});const utils=slotUtils();if(!utils||typeof utils.findSafeAppointmentSlots!=='function')return{slots:[],reason:'Motor de encaixes não carregado.'};const slotsFound=utils.findSafeAppointmentSlots({patientId:pid,serviceId:sid,dates,appointments:rows,scheduleBlocks,servicesById,settings,period:input.requested_period||input.period,limit:5}).map(slot=>Object.assign(slot,{service_price_at_time:Number(getServiceDefaultPrice(sid))}));return{slots:slotsFound,reason:slotsFound.length?'Horários encontrados, priorizando vagas em blocos já ocupados.':'Nenhum horário seguro encontrado nas datas sugeridas.'}}
async function confirmAssistantAppointmentProposal(input={}){const checked=await validateAssistantAppointment(input);if(!checked.valid)throw new Error(checked.reason);const saved=await persistAppointment(null,checked.payload);await loadAll(true);return{saved,patient:patientById(saved.patient_id),service:serviceById(saved.service_id)}}
function findPatientFutureAppointments(patientId, types){
  if(!patientId) return [];
  types = types || ['agendado','confirmado'];
  return appointments.filter(function(a){
    return String(a.patient_id) === String(patientId) && types.indexOf(a.status) !== -1 && String(a.appointment_date) >= todayIso();
  }).sort(function(a,b){
    return String(a.appointment_date).localeCompare(String(b.appointment_date)) || String(a.start_time).localeCompare(String(b.start_time));
  });
}
async function cancelAppointmentProposal(appointmentId){
  var a = appointments.find(function(item){ return String(item.id) === String(appointmentId); });
  if(!a) throw new Error('Agendamento nao encontrado.');
  await api('appointments?id=eq.'+appointmentId,{method:'PATCH',body:JSON.stringify({status:'cancelado'})});
  await loadAll(true);
  return a;
}
function assistantFormatPhone(value){
  const digits=cleanPhone(value).replace(/^55(?=\d{10,11}$)/,'');
  if(digits.length===11)return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if(digits.length===10)return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return value||'';
}
function assistantFindPatientMatches(query){
  const text=String(query||'').trim();
  const digits=cleanPhone(text);
  if(!text&&!digits)return [];
  const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return patients.filter(p=>{
    if(p.archived===true)return false;
    const name=String(p.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    const phone=cleanPhone(p.whatsapp||'');
    return (!!digits&&phone.includes(digits))|| (!!normalized&&(name.includes(normalized)||normalized.includes(name)));
  }).slice(0,8).map(p=>({id:p.id,name:p.name||'Paciente sem nome',whatsapp:assistantFormatPhone(p.whatsapp||''),pathology:p.pathology||''}));
}
async function createAssistantPatient(payload={}){
  const name=String(payload.name||'').trim();
  const whatsapp=assistantFormatPhone(payload.whatsapp||payload.phone||'');
  const pathology=String(payload.pathology||'').trim();
  const birthDate=String(payload.birth_date||'').slice(0,10);
  const referralSource=String(payload.referral_source||'').trim();
  if(!name)throw new Error('Informe o nome do paciente.');
  if(!/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(whatsapp))throw new Error('Informe o WhatsApp completo para criar o paciente.');
  const phone=cleanPhone(whatsapp);
  const dup=patients.find(p=>p.archived!==true&&(cleanPhone(p.whatsapp)===phone||String(p.name||'').trim().toLowerCase()===name.toLowerCase()));
  if(dup)return dup;
  const record={id:makePatientId(),name,pathology,whatsapp,birth_date:birthDate||null,referral_source:referralSource,archived:false,archived_at:null};
  await api('patients',{method:'POST',body:JSON.stringify(record)});
  await loadAll(true);
  return patientById(record.id)||record;
}
async function confirmAssistantRecurringProgram(input={}){
  const sessions=Array.isArray(input.sessions)?input.sessions:[];
  if(!sessions.length)throw new Error('Nenhuma sessao encontrada para confirmar.');
  const patientId=input.patient_id||input.patientId;
  if(!patientId)throw new Error('Paciente nao confirmado.');
  let created=0;
  for(const session of sessions){
    const checked=await validateAssistantAppointment({...session,patient_id:patientId});
    if(!checked.valid)throw new Error(`Conflito ao confirmar ${fmtDate(session.appointment_date)} ${session.start_time}: ${checked.reason}`);
    await persistAppointment(null,checked.payload);
    created++;
  }
  await loadAll(true);
  return {created};
}
window.FEMICAgendaRuntime={
  getState:function(){return{patients:[...patients],payers:[...payers],services:[...services],packages:[...packages],appointments:[...appointments],movements:[...movements],clinicRules:[...clinicRules],scheduleBlocks:[...scheduleBlocks],settings:Object.assign({},settings)}},
  suggestAppointmentSlots:suggestAssistantAppointmentSlots,
  suggestRecurringPrograms:suggestAssistantRecurringPrograms,
  validateAppointmentProposal:validateAssistantAppointment,
  confirmAppointmentProposal:confirmAssistantAppointmentProposal,
  confirmRecurringProgram:confirmAssistantRecurringProgram,
  findFutureAppointments:findPatientFutureAppointments,
  findPatientMatches:assistantFindPatientMatches,
  createPatient:createAssistantPatient,
  cancelAppointment:function(id){return cancelAppointmentProposal(id);},
  api:function(path,opt){return api(path,opt||{});},
  setClinicRules:function(list){clinicRules=Array.isArray(list)?list:[];writeClinicRulesCache(clinicRules);renderBackupPanel();document.dispatchEvent(new CustomEvent('femic:state-updated'));return clinicRules},
  readClinicRulesCache:readClinicRulesCache,
  writeClinicRulesCache:writeClinicRulesCache,
  loadClinicRulesCollection:loadClinicRulesCollection,
  isMissingClinicRulesTableError:isMissingClinicRulesTableError
};

const patientPickerState = {};
let patientPickerItemsCache = null;
function normalizePatientSearch(value){
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
function formatPatientPhone(value){
  const digits = cleanPhone(value).replace(/^55(?=\d{10,11}$)/, '');
  if(digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if(digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return value || 'Sem WhatsApp';
}
function patientPickerItems(){
  if(patientPickerItemsCache) return patientPickerItemsCache;
  patientPickerItemsCache = patients
    .filter(p=>p.archived!==true)
    .slice()
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'))
    .map(p=>({
      id:String(p.id),
      name:p.name || 'Paciente sem nome',
      phone:formatPatientPhone(p.whatsapp || ''),
      pathology:p.pathology || 'Sem patologia',
      haystack:normalizePatientSearch([p.name, p.whatsapp, cleanPhone(p.whatsapp), p.pathology].join(' '))
    }));
  return patientPickerItemsCache;
}
function patientPickerLabel(item){
  return item ? `${item.name} · ${item.phone}` : '';
}
function syncPatientPicker(selectId){
  const state = patientPickerState[selectId];
  const select = $(selectId);
  if(!state || !select) return;
  const item = patientPickerItems().find(p=>String(p.id)===String(select.value));
  state.input.value = item ? patientPickerLabel(item) : '';
}
function renderPatientPickerList(selectId, query){
  const state = patientPickerState[selectId];
  if(!state) return;
  const q = normalizePatientSearch(query);
  const phoneQ = cleanPhone(query);
  let items = patientPickerItems().filter(item=>!q || item.haystack.includes(q) || (phoneQ && item.haystack.includes(phoneQ))).slice(0, 9);
  if(!items.length){
    state.list.innerHTML = '<div class="patient-picker-empty">Nenhum paciente encontrado.</div>';
    state.list.classList.remove('hidden');
    return;
  }
  state.list.innerHTML = items.map(item=>`<button class="patient-picker-option" type="button" data-patient-id="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>${esc(item.phone)} · ${esc(item.pathology)}</span></button>`).join('');
  state.list.querySelectorAll('[data-patient-id]').forEach(btn=>{
    btn.addEventListener('mousedown', function(event){ event.preventDefault(); selectPatientPickerValue(selectId, this.dataset.patientId); });
  });
  state.list.classList.remove('hidden');
}
function selectPatientPickerValue(selectId, patientId){
  const select = $(selectId);
  const state = patientPickerState[selectId];
  if(!select || !state) return;
  select.value = patientId || '';
  syncPatientPicker(selectId);
  state.list.classList.add('hidden');
  select.dispatchEvent(new Event('change', { bubbles:true }));
}
function enhancePatientSelect(selectId){
  const select = $(selectId);
  if(!select) return;
  if(patientPickerState[selectId]){
    syncPatientPicker(selectId);
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'patient-picker';
  wrapper.setAttribute('data-patient-picker-for', selectId);
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.className = 'patient-picker-input';
  input.placeholder = 'Buscar por nome, WhatsApp ou patologia';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'patient-picker-clear';
  clear.textContent = 'Limpar';
  const list = document.createElement('div');
  list.className = 'patient-picker-list hidden';
  wrapper.appendChild(input);
  wrapper.appendChild(clear);
  wrapper.appendChild(list);
  select.parentNode.insertBefore(wrapper, select);
  select.classList.add('patient-select-native');
  patientPickerState[selectId] = { wrapper, input, clear, list };
  input.addEventListener('focus', ()=>renderPatientPickerList(selectId, input.value));
  input.addEventListener('input', ()=>renderPatientPickerList(selectId, input.value));
  input.addEventListener('keydown', function(event){
    if(event.key === 'Escape'){
      list.classList.add('hidden');
      return;
    }
    if(event.key === 'Enter'){
      const first = list.querySelector('[data-patient-id]');
      if(first){
        event.preventDefault();
        selectPatientPickerValue(selectId, first.dataset.patientId);
      }
    }
  });
  clear.addEventListener('click', function(){
    selectPatientPickerValue(selectId, '');
    input.focus();
  });
  document.addEventListener('click', function(event){
    if(!wrapper.contains(event.target)) list.classList.add('hidden');
  });
  select.addEventListener('change', ()=>syncPatientPicker(selectId));
  syncPatientPicker(selectId);
}
function syncPatientPickers(){
  ['apptPatient','pkgPatient','docsPatientSelect','prontuarioPatientSelect'].forEach(syncPatientPicker);
}
function focusPatientPicker(selectId){
  const picker = patientPickerState[selectId];
  if(picker && picker.input){
    picker.input.focus();
    renderPatientPickerList(selectId, picker.input.value);
    return;
  }
  if($(selectId)) $(selectId).focus();
}
window.enhancePatientSelect = enhancePatientSelect;
window.syncPatientPickers = syncPatientPickers;

function syncForms(){
  const patientOpts = patients
    .filter(p=>p.archived!==true)
    .map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.whatsapp?' · '+esc(formatPatientPhone(p.whatsapp)):''}${p.pathology?' · '+esc(p.pathology):''}</option>`)
    .join('');

  const serviceOpts = services
    .filter(s=>s.active!==false)
    .map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`)
    .join('');

  $('apptPatient').innerHTML = '<option value="">Selecione o paciente</option>' + patientOpts;
  $('apptService').innerHTML = '<option value="">Selecione o serviço</option>' + serviceOpts;

  if($('pkgPatient')) $('pkgPatient').innerHTML = '<option value="">Selecione o paciente</option>' + patientOpts;
  if($('pkgService')) $('pkgService').innerHTML = '<option value="">Selecione o serviço</option>' + serviceOpts;

  const pay='<option value="">Sem pagador</option>'+payers.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('svcPayer').innerHTML=pay;

  if($('setStart')) $('setStart').value=settings.start_time||'08:00';
  if($('setEnd')) $('setEnd').value=settings.end_time||'20:00';
  if($('setPeriods')) $('setPeriods').value=settings.working_periods||((settings.start_time||'08:00')+'-'+(settings.end_time||'20:00'));
  if($('setInterval')) $('setInterval').value=String(settings.slot_interval_minutes||30);
  if($('tplReminder')) $('tplReminder').value=settings.whatsapp_template_appointment||localStorage.femic_tpl_reminder||DEFAULT_WHATSAPP_REMINDER_TEMPLATE;
  if($('whatsappProvider')) $('whatsappProvider').value='baileys';
  if($('whatsappServiceName')) $('whatsappServiceName').value=settings.whatsapp_service_name||localStorage.femic_whatsapp_service_name||'baileys-main';
  renderWhatsappProviderBadge();
  renderWhatsappServiceStatus();
  populateAgendaFilters();
  ['apptPatient','pkgPatient'].forEach(enhancePatientSelect);
  syncPatientPickers();
  renderWorkDays()
}
function renderWorkDays(){const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];const active=String(settings.working_days||'1,2,3,4,5').split(',');$('workDays').innerHTML=names.map((n,i)=>`<label class="day-check"><input type="checkbox" class="wd" value="${i}" ${active.includes(String(i))?'checked':''} onchange="renderSlotsConfig()">${n}</label>`).join('');$('recDays').innerHTML=names.map((n,i)=>`<div class="rec-day-card" id="recCard${i}"><label class="rec-title"><input type="checkbox" class="recDay" value="${i}" onchange="toggleRecDayCard(${i})">${n}</label><input type="time" class="recTime" id="recTime${i}" onchange="previewRecurringEnd(${i})"><div class="muted small" id="recEnd${i}">Fim calculado pelo serviço</div></div>`).join('');if(typeof renderSlotsConfig==='function')renderSlotsConfig()}
function weekStart(d){const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));return x}function isTodayDate(dateStr){return String(dateStr)===todayIso()}function isWorking(dateStr){return String(settings.working_days||'1,2,3,4,5,6').split(',').includes(String(dateDay(dateStr)))}function isClosedForView(dateStr){return !isTodayDate(dateStr)&&!isWorking(dateStr)}
function parsePeriods(){const raw=String(settings.working_periods||((settings.start_time||'08:00')+'-'+(settings.end_time||'20:00')));return raw.split(',').map(x=>x.trim()).filter(Boolean).map(p=>{const parts=p.split('-').map(v=>v.trim());return {start:parts[0],end:parts[1]};}).filter(p=>/^\d{2}:\d{2}$/.test(p.start)&&/^\d{2}:\d{2}$/.test(p.end)&&timeToMin(p.start)<timeToMin(p.end));}
function agendaSlotStep(){const step=Number(settings.slot_interval_minutes||30);return Number.isFinite(step)&&step>0?step:30}
function slots(forDay){if(forDay!==undefined&&settings.slots_config&&settings.slots_config[forDay])return settings.slots_config[forDay].slice().sort();const set=new Set(),step=agendaSlotStep();parsePeriods().forEach(p=>{let m=timeToMin(p.start),end=timeToMin(p.end);while(m<end){set.add(minToTime(m));m+=step}});return [...set].sort()}
function isInsideWorkingTime(dateStr,start,end){if(!isTodayDate(dateStr)&&!isWorking(dateStr)) return false;const dow=dateDay(dateStr);if(settings.slots_config&&settings.slots_config[dow]){const daySlots=settings.slots_config[dow];return daySlots.some(s=>normalizeTime(s)===normalizeTime(start));}const s=timeToMin(start),e=timeToMin(end);return parsePeriods().some(p=>s>=timeToMin(p.start)&&e<=timeToMin(p.end));}
function prevPeriod(){if($('viewMode').value==='month')currentDate.setMonth(currentDate.getMonth()-1);else currentDate.setDate(currentDate.getDate()-7);renderAgenda()}function nextPeriod(){if($('viewMode').value==='month')currentDate.setMonth(currentDate.getMonth()+1);else currentDate.setDate(currentDate.getDate()+7);renderAgenda()}function goToday(){currentDate=new Date();$('dayDate').value=todayIso();$('reminderDate').value=isoDate(new Date(Date.now()+86400000));renderActivePanel()}
function agendaActiveFilters(){return{status:$('agendaStatusFilter')?.value||'all',serviceId:$('agendaServiceFilter')?.value||'all'}}
function matchesAgendaFilters(appointment,filters){if(filters.status!=='all'&&appointment.status!==filters.status)return false;if(filters.serviceId!=='all'&&String(appointment.service_id)!==String(filters.serviceId))return false;return true}
function agendaFiltered(list){const filters=agendaActiveFilters();return list.filter(a=>matchesAgendaFilters(a,filters))}
function buildWeekAgendaData(visibleDays){
  const byDate=Object.create(null);
  const openCountByDate=Object.create(null);
  const filters=agendaActiveFilters();
  visibleDays.forEach(day=>{byDate[isoDate(day)]=[]});
  appointments.forEach(appointment=>{
    const date=String(appointment.appointment_date||'');
    if(!byDate[date]) return;
    if(!matchesAgendaFilters(appointment,filters)) return;
    byDate[date].push(appointment);
    if(appointment.status!=='cancelado') openCountByDate[date]=(openCountByDate[date]||0)+1;
  });
  Object.keys(byDate).forEach(date=>{
    byDate[date].sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))||normalizeTime(a.end_time).localeCompare(normalizeTime(b.end_time)));
  });
  return {byDate,openCountByDate};
}
function populateAgendaFilters(){const sel=$('agendaServiceFilter');if(sel){const current=sel.value||'all';sel.innerHTML='<option value="all">Todos os serviços</option>'+services.filter(s=>s.active!==false).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===current)?current:'all'}const searchSel=$('apptSearchService');if(searchSel){const currentSearch=searchSel.value||'all';searchSel.innerHTML='<option value="all">Todos os serviços</option>'+services.filter(s=>s.active!==false).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');searchSel.value=[...searchSel.options].some(o=>o.value===currentSearch)?currentSearch:'all'}}
function clearAgendaFilters(){
  const statusEl=$('agendaStatusFilter');
  if(statusEl) statusEl.value='all';
  const serviceEl=$('agendaServiceFilter');
  if(serviceEl) serviceEl.value='all';
  document.querySelectorAll('#agendaFilterChips .filter-chip').forEach(c=>c.classList.toggle('active',c.dataset.value==='all'));
  renderAgenda()
}
function setAgendaStatusFilter(value){
  const el=$('agendaStatusFilter');
  if(el) el.value=value;
  document.querySelectorAll('#agendaFilterChips .filter-chip').forEach(c=>c.classList.toggle('active',c.dataset.value===value));
  renderAgenda()
}
function openBlockModal(){
  const existing=document.getElementById('femicBlockModalOverlay');
  if(existing)existing.remove();
  const today=todayIso();
  const nextSlot=slots()[0]||'08:00';
  const overlay=document.createElement('div');
  overlay.id='femicBlockModalOverlay';
  overlay.className='block-modal-overlay';
  overlay.innerHTML='<div class="block-modal" onclick="event.stopPropagation()">'+
    '<h3>🔒 Bloquear horário</h3>'+
    '<p class="muted small">Impede agendamentos neste período.</p>'+
    '<div class="field"><label>Data</label><input id="blockDate" type="date" value="'+today+'"></div>'+
    '<div class="field"><label>Início</label><input id="blockStart" type="time" value="'+nextSlot+'"></div>'+
    '<div class="field"><label>Fim</label><input id="blockEnd" type="time" value="'+addMinutes(nextSlot,agendaSlotStep())+'"></div>'+
    '<div class="field"><label>Motivo (opcional)</label><input id="blockReason" placeholder="Ex.: feriado, reunião, manutenção"></div>'+
    '<div class="block-modal-actions">'+
    '<button class="btn secondary" onclick="closeBlockModal()">Cancelar</button>'+
    '<button class="btn primary" onclick="confirmBlock()">Bloquear</button>'+
    '</div></div>';
  overlay.addEventListener('click',closeBlockModal);
  document.body.appendChild(overlay);
  $('blockDate').focus();
}
function closeBlockModal(){
  const el=document.getElementById('femicBlockModalOverlay');
  if(el)el.remove();
}
function confirmBlock(){
  const date=$('blockDate')?.value;
  const start=$('blockStart')?.value;
  const end=$('blockEnd')?.value;
  const reason=$('blockReason')?.value.trim();
  blockScheduleSlot(date,start,end,reason);
  closeBlockModal();
}
function getAppointmentSearchResults(){
  const rawQuery=String($('apptSearchText')?.value||'');
  const queryText=rawQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const queryPhone=cleanPhone(rawQuery);
  const from=$('apptSearchFrom')?.value||'';
  const to=$('apptSearchTo')?.value||'';
  const status=$('apptSearchStatus')?.value||'all';
  const service=$('apptSearchService')?.value||'all';
  const patientsById=Object.create(null);
  patients.forEach(patient=>{patientsById[String(patient.id)]=patient});
  return appointments.filter(a=>{
    const patient=patientsById[String(a.patient_id)]||{};
    const patientText=String((patient.name||'')+' '+(patient.whatsapp||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const phone=cleanPhone(patient.whatsapp||'');
    if(queryText && patientText.indexOf(queryText)===-1 && (!queryPhone || phone.indexOf(queryPhone)===-1)) return false;
    if(from && String(a.appointment_date||'')<from) return false;
    if(to && String(a.appointment_date||'')>to) return false;
    if(status!=='all' && a.status!==status) return false;
    if(service!=='all' && String(a.service_id)!==String(service)) return false;
    return true;
  }).sort((a,b)=>String(a.appointment_date||'').localeCompare(String(b.appointment_date||''))||normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))).slice(0,200);
}
function renderAppointmentSearch(){
  const target=$('apptSearchResults');
  if(!target)return;
  const results=getAppointmentSearchResults();
  const patientsById=Object.create(null);
  const servicesById=Object.create(null);
  patients.forEach(patient=>{patientsById[String(patient.id)]=patient});
  services.forEach(service=>{servicesById[String(service.id)]=service});
  appointmentSearchSelected.forEach(id=>{if(!results.some(a=>String(a.id)===String(id)))appointmentSearchSelected.delete(id)});
  if($('apptSearchCount'))$('apptSearchCount').textContent=results.length+' encontrado(s)';
  if($('apptSelectedCount'))$('apptSelectedCount').textContent=appointmentSearchSelected.size+' selecionado(s)';
  if($('apptBulkBar'))$('apptBulkBar').classList.toggle('active',appointmentSearchSelected.size>0);
  target.innerHTML=results.length?results.map(a=>{
    const patient=patientsById[String(a.patient_id)]||{},service=servicesById[String(a.service_id)]||{},checked=appointmentSearchSelected.has(String(a.id))?'checked':'';
    const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
    return `<div class="appointment-search-row status-${a.status}"><label class="appt-check"><input type="checkbox" ${checked} onchange="toggleAppointmentSearchSelection('${a.id}',this.checked)"></label><div class="appt-search-main"><strong>${esc(patient.name||'Paciente')}</strong><span>${fmtWeekday(a.appointment_date)} · ${fmtDate(a.appointment_date)} · ${normalizeTime(a.start_time)}-${normalizeTime(a.end_time)} · ${esc(service.name||'Sem serviço')}</span></div><span class="status-chip ${a.status}">${label}</span><div class="appt-search-actions"><button class="btn small" onclick="openAppt('${a.appointment_date}','${a.id}')">Editar</button><button class="btn small warning" onclick="cancelAppointmentFromSearch('${a.id}')">Cancelar</button><button class="btn small danger" onclick="deleteAppointmentFromSearch('${a.id}')">Apagar</button></div></div>`;
  }).join(''):'<div class="muted small">Nenhum agendamento encontrado.</div>';
}
function toggleAppointmentSearchSelection(id,checked){if(checked)appointmentSearchSelected.add(String(id));else appointmentSearchSelected.delete(String(id));renderAppointmentSearch()}
function clearAppointmentSearch(){['apptSearchText','apptSearchFrom','apptSearchTo'].forEach(id=>{if($(id))$(id).value=''});if($('apptSearchStatus'))$('apptSearchStatus').value='all';if($('apptSearchService'))$('apptSearchService').value='all';appointmentSearchSelected.clear();renderAppointmentSearch()}
async function cancelAppointmentFromSearch(id){if(!confirm('Cancelar este agendamento?'))return;try{await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify({status:'cancelado'})});appointmentSearchSelected.delete(String(id));await loadAll(true);toast('Agendamento cancelado.','success')}catch(e){toast('Erro ao cancelar: '+e.message,'error')}}
function appointmentFilterById(id){
  return 'appointments?id=eq.' + encodeURIComponent(String(id || ''));
}
async function releaseAppointmentPackageForDelete(a){
  if(!a || !a.id) return;
  const appointmentId = String(a.id);
  const packageId = String(a.session_package_id || '');
  if(a.status === 'concluido' && a.package_consumed && packageId){
    const pk = packages.find(p=>String(p.id)===packageId);
    if(pk){
      const nextRemaining = Number(pk.remaining_sessions || 0) + 1;
      await api('session_packages?id=eq.' + encodeURIComponent(packageId), {
        method:'PATCH',
        body:JSON.stringify({remaining_sessions:nextRemaining})
      });
      pk.remaining_sessions = nextRemaining;
      try{
        await api('session_movements', {
          method:'POST',
          body:JSON.stringify({
            patient_id:a.patient_id,
            appointment_id:null,
            session_package_id:packageId,
            type:'estorno',
            quantity:1
          })
        });
      }catch(e){}
    }
  }
  if(a.package_consumed || packageId){
    await api(appointmentFilterById(appointmentId), {
      method:'PATCH',
      body:JSON.stringify({package_consumed:false,session_package_id:null})
    });
  }
}
async function removeAppointmentRecord(id){
  const appointmentId = String(id || '');
  if(!appointmentId) throw new Error('Agendamento não identificado.');
  const existing = appointments.find(a=>String(a.id)===appointmentId);
  if(existing) await releaseAppointmentPackageForDelete(existing);
  try{
    await api('session_movements?appointment_id=eq.' + encodeURIComponent(appointmentId), {
      method:'PATCH',
      body:JSON.stringify({appointment_id:null})
    });
  }catch(e){}
  await api(appointmentFilterById(appointmentId), {
    method:'DELETE',
    headers:{...headers(), Prefer:'return=minimal'}
  });
  appointments = appointments.filter(a=>String(a.id)!==appointmentId);
  appointmentSearchSelected.delete(appointmentId);
  dayAppointmentCache.clear();
}
async function deleteAppointmentFromSearch(id){if(!confirm('Apagar definitivamente este agendamento?'))return;try{await removeAppointmentRecord(id);await loadAll(true);toast('Agendamento apagado.','success')}catch(e){toast('Erro ao apagar: '+e.message,'error')}}
function selectedAppointmentIds(){return [...appointmentSearchSelected].filter(id=>appointments.some(a=>String(a.id)===String(id)))}
async function bulkCancelAppointments(){const ids=selectedAppointmentIds();if(!ids.length){toast('Selecione ao menos um agendamento.','warning');return}if(!confirm('Cancelar '+ids.length+' agendamento(s) selecionado(s)?'))return;try{for(const id of ids){await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify({status:'cancelado'})})}appointmentSearchSelected.clear();await loadAll(true);toast(ids.length+' agendamento(s) cancelado(s).','success')}catch(e){toast('Erro no cancelamento em massa: '+e.message,'error')}}
async function bulkDeleteAppointments(){const ids=selectedAppointmentIds();if(!ids.length){toast('Selecione ao menos um agendamento.','warning');return}const typed=prompt('Digite APAGAR para excluir definitivamente '+ids.length+' agendamento(s).');if(typed!=='APAGAR')return;try{for(const id of ids){await removeAppointmentRecord(id)}appointmentSearchSelected.clear();await loadAll(true);toast(ids.length+' agendamento(s) apagado(s).','success')}catch(e){toast('Erro ao apagar em massa: '+e.message,'error')}}
function updateAgendaViewToggle(){const mode=$('viewMode')?.value||'week';document.querySelectorAll('.view-chip').forEach(btn=>btn.classList.remove('active'));if(mode==='month')$('viewMonthBtn')?.classList.add('active');else $('viewWeekBtn')?.classList.add('active')}
function setAgendaViewMode(mode){if(!$('viewMode'))return;$('viewMode').value=mode;updateAgendaViewToggle();if(mode==='day'){showPanel('day');return}if(mode==='agenda')showPanel('agenda');renderAgenda()}
function renderAgenda(){populateAgendaFilters();updateAgendaViewToggle();refreshAppointmentWindowIfNeeded();if($('viewMode').value==='month')renderMonth();else renderWeek()}
function shouldShowEmptyMonthDays(){return localStorage.getItem('femic_month_show_empty_days')==='true'}
function toggleMonthEmptyDays(){localStorage.setItem('femic_month_show_empty_days',shouldShowEmptyMonthDays()?'false':'true');renderMonth()}
function renderMonth(){
  $('monthView').classList.remove('hidden');
  $('weekView').classList.add('hidden');
  const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const y=currentDate.getFullYear(),m=currentDate.getMonth();
  const showEmpty=shouldShowEmptyMonthDays();
  const filteredAppointments=agendaFiltered(appointments);
  const appointmentsByDate=Object.create(null);
  const patientNames=Object.create(null);
  const serviceNames=Object.create(null);
  const slotList=slots();
  const slotStep=agendaSlotStep();
  filteredAppointments.forEach(a=>{
    const ds=String(a.appointment_date||'');
    if(!appointmentsByDate[ds]) appointmentsByDate[ds]=[];
    appointmentsByDate[ds].push(a);
  });
  patients.forEach(patient=>{patientNames[String(patient.id)]=patient.name||'Paciente';});
  services.forEach(service=>{serviceNames[String(service.id)]=service.name||'Sem serviço';});
  $('periodLabel').textContent=currentDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  $('monthHead').innerHTML=`<div class="month-list-head"><div><div class="eyebrow">Agenda do mês</div><h3>${currentDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h3></div><div class="month-list-tools"><button class="btn ghost" type="button" onclick="toggleMonthEmptyDays()">${showEmpty?'Ocultar dias vazios':'Mostrar dias vazios'}</button><span class="muted small">Lista mensal oficial da FEMIC</span></div></div>`;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const packageAlertCache=Object.create(null);
  let html='<div class="month-agenda-list">';
  let rendered=0,totalAppointments=0,totalConfirmed=0,totalDone=0;
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,m,day);
    const ds=isoDate(d);
    const list=(appointmentsByDate[ds]||[]).slice().sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
    if(!showEmpty && !list.length && ds!==todayIso()) continue;
    rendered++;
    totalAppointments+=list.length;
    const counts={
      agendado:list.filter(a=>a.status==='agendado').length,
      confirmado:list.filter(a=>a.status==='confirmado').length,
      concluido:list.filter(a=>a.status==='concluido').length
    };
    totalConfirmed+=counts.confirmado;
    totalDone+=counts.concluido;
    const peak=slotList.reduce((max,slot)=>{
      const slotStart=timeToMin(slot);
      const slotEnd=timeToMin(addMinutes(slot,slotStep));
      const count=list.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<slotEnd&&timeToMin(normalizeTime(a.end_time))>slotStart).length;
      return Math.max(max,count);
    },0);
    const dayBlocks=activeScheduleBlocksForDate(ds);
    const hasBlocks=dayBlocks.length>0;
    html+=`<section class="month-agenda-day ${ds===todayIso()?'today':''} ${isClosedForView(ds)?'off':''}">`;
    html+=`<div class="month-agenda-day-head"><div><div class="month-agenda-date">${names[d.getDay()]}, ${fmtDate(ds)}${hasBlocks?' <span class="month-block-indicator" title="Horários bloqueados — clique para reabrir" onclick="event.stopPropagation();reopenScheduleBlock(\''+dayBlocks[0].id+'\')">🔒</span>':''}</div><div class="muted small">${list.length?`${list.length} atendimento(s) no dia`:'Dia livre'}</div></div><div class="month-agenda-summary"><span>${counts.agendado} ag.</span><span>${counts.confirmado} conf.</span><span>${counts.concluido} concl.</span><span>Pico ${peak}/${Number(settings.max_patients_per_slot||4)}</span><button class="btn" type="button" onclick="openAppt('${ds}')">+ Agendar</button></div></div>`;
    html+=list.length?`<div class="month-agenda-items">`+list.map(a=>{
      const patient=patientNames[String(a.patient_id)]||'Paciente';
      const service=serviceNames[String(a.service_id)]||'Sem serviço';
      const alert=appointmentPackageAlertMeta(a,packageAlertCache);
      return `<button class="month-agenda-item status-${a.status}" type="button" onclick="openAppt('${a.appointment_date}','${a.id}')">${alert.show?`<span class="appointment-package-alert-dot" title="${esc(alert.text)}" aria-label="${esc(alert.text)}"></span>`:''}<span class="month-agenda-time"><strong>${normalizeTime(a.start_time)}</strong><small>${normalizeTime(a.end_time)}</small></span><span class="month-agenda-main"><strong>${esc(patient)}</strong><small>${esc(service)}</small></span></button>`;
    }).join('')+`</div>`:`<div class="month-agenda-empty"><span>Sem atendimentos neste dia.</span><button class="btn ghost" type="button" onclick="openAppt('${ds}')">Criar atendimento</button></div>`;
    html+=`</section>`;
  }
  if(!rendered) html+=`<div class="month-agenda-empty-state"><strong>Nenhum atendimento encontrado neste mês com os filtros atuais.</strong><span>Use "Mostrar dias vazios" para criar encaixes ou limpe os filtros da agenda.</span></div>`;
  html+='</div>';
  $('monthCalendar').innerHTML=`<div class="month-agenda-kpis"><div><span>Total no mês</span><strong>${totalAppointments}</strong></div><div><span>Confirmados</span><strong>${totalConfirmed}</strong></div><div><span>Concluídos</span><strong>${totalDone}</strong></div><div><span>Dias exibidos</span><strong>${rendered}</strong></div></div>`+html;
}
function activePackageForService(pid,sid){
  let fallback=null;
  for(const p of packages){
    if(String(p.patient_id)!==String(pid)||String(p.service_id)!==String(sid)||p.active===false) continue;
    if(!fallback) fallback=p;
    if(Number(p.remaining_sessions||0)>0) return p;
  }
  return fallback;
}
function packageSaldoInfo(pid,sid){const pk=activePackageForService(pid,sid);if(!pk)return null;const total=Number(pk.total_sessions||0),remaining=Number(pk.remaining_sessions??pk.saldo??0),used=Math.max(0,total-remaining);return {package:pk,total,remaining,used,cls:remaining===0?'saldo-zero':(remaining<=3?'saldo-low':'muted')}}
function saldoBadge(pid,sid){const info=packageSaldoInfo(pid,sid);if(!info)return '<div class="small muted">Sem pacote</div>';return `<div class="small ${info.cls}"><span class="used-counter">${info.used}/${info.total} sessões usadas</span> · saldo ${info.remaining}</div>`}
function getServiceDefaultPrice(sid){const s=serviceById(sid);return Number(s.price||0)}
function setAppointmentPriceFromService(force=false){const input=$('apptPrice');if(!input)return;const current=String(input.value||'').trim();if(force||!current){input.value=String(getServiceDefaultPrice($('apptService').value)||0)}}
function openAppt(date=null,id=null,slot=null){$('apptId').value=id||'';$('rescheduleOriginId').value='';$('rescheduleCancelOriginal').value='';$('recurring').checked=false;toggleRecurrence();recurringSuggestionCache=[];if($('recSuggestionList'))$('recSuggestionList').innerHTML='';$('deleteApptBtn').style.display=id?'inline-flex':'none';if(id){const a=appointments.find(x=>String(x.id)===String(id));if(!a)return;$('apptPatient').value=a.patient_id;$('apptService').value=a.service_id;$('apptStatus').value=a.status;$('apptDate').value=a.appointment_date;$('apptStart').value=normalizeTime(a.start_time);$('apptEnd').value=normalizeTime(a.end_time);$('apptPrice').value=Number(a.service_price_at_time!=null?a.service_price_at_time:getServiceDefaultPrice(a.service_id));$('apptTitle').textContent='Editar agendamento'}else{$('apptPatient').value='';$('apptService').value='';$('apptStatus').value='agendado';$('apptDate').value=date||todayIso();$('apptStart').value=slot||(parsePeriods()[0]?.start)||settings.start_time||'08:00';$('apptEnd').value='';$('apptPrice').value='';$('apptTitle').textContent='Novo agendamento'}syncPatientPickers();showSaldoInfo();$('apptModal').classList.add('show')}
function closeModal(id){const el=$(id);if(el) el.classList.remove('show')}function toggleRecurrence(){$('recFields').classList.toggle('hidden',!$('recurring').checked); if($('recurring').checked) syncRecurrenceTimes()}
function toggleRecDayCard(i){const card=$('recCard'+i);if(card)card.classList.toggle('active',card.querySelector('.recDay')?.checked);previewRecurringEnd(i)}
function syncRecurrenceTimes(){document.querySelectorAll('.recTime').forEach(inp=>{if(!inp.value)inp.value=$('apptStart').value||'08:00'});document.querySelectorAll('.recDay').forEach(ch=>toggleRecDayCard(ch.value));}
function previewRecurringEnd(i){const inp=$('recTime'+i),out=$('recEnd'+i),s=serviceById($('apptService').value);if(!inp||!out)return;if(!$('apptService').value){out.textContent='Selecione o serviço';return}const start=inp.value||$('apptStart').value||'08:00';const end=addMinutes(start,Number(s.duration_minutes||45));out.textContent='Fim previsto: '+end;}function onServiceChange(updatePrice=false){const sid=$('apptService').value;if(!sid){$('apptEnd').value='';if(updatePrice)$('apptPrice').value='';showSaldoInfo();document.querySelectorAll('.recDay:checked').forEach(ch=>previewRecurringEnd(ch.value));return}const s=serviceById(sid);$('apptEnd').value=addMinutes($('apptStart').value||settings.start_time,Number(s.duration_minutes||45));if(updatePrice)setAppointmentPriceFromService(true);showSaldoInfo();document.querySelectorAll('.recDay:checked').forEach(ch=>previewRecurringEnd(ch.value))}
function showSaldoInfo(){const pid=$('apptPatient').value,sid=$('apptService').value;if(!pid&&!sid){$('saldoInfo').innerHTML='Selecione paciente e serviço para visualizar pacote e saldo.';return}if(!pid){$('saldoInfo').innerHTML='Selecione o paciente para visualizar pacote e saldo.';return}if(!sid){$('saldoInfo').innerHTML='Selecione o serviço para visualizar pacote e saldo.';return}const pk=activePackageForService(pid,sid);let future=0;for(const a of appointments){if(String(a.patient_id)===String(pid)&&String(a.service_id)===String(sid)&&['agendado','confirmado'].includes(a.status)&&String(a.appointment_date||'')>=todayIso())future++;}if(!pk)$('saldoInfo').innerHTML='Sem pacote ativo para este paciente/serviço.';else $('saldoInfo').innerHTML=`Pacote: ${pk.total_sessions} sessões · saldo ${pk.remaining_sessions} · futuras agendadas ${future} · disponível aproximado ${Number(pk.remaining_sessions||0)-future}`}
function conflictInAppointmentList(candidate,list,ignoreId=null){if(activeScheduleBlockForSlot(candidate.appointment_date,candidate.start_time,candidate.end_time))return 'Horário bloqueado manualmente.';const sNew=serviceById(candidate.service_id);const n1=timeToMin(candidate.start_time),n2=timeToMin(candidate.end_time);const sameDay=(list||[]).filter(a=>a.appointment_date===candidate.appointment_date&&a.status!=='cancelado'&&String(a.id)!==String(ignoreId));const overlaps=sameDay.filter(a=>timeToMin(normalizeTime(a.start_time))<n2 && timeToMin(normalizeTime(a.end_time))>n1);if(!overlaps.length)return null;if((sNew.appointment_mode||'grupo')==='individual')return 'Serviço individual exige horário exclusivo.';if(overlaps.some(a=>(serviceById(a.service_id).appointment_mode||'grupo')==='individual'))return 'Já existe atendimento individual neste intervalo.';const max=Number(sNew.max_patients||settings.max_patients_per_slot||4);if(overlaps.length>=max)return 'Limite de pacientes simultâneos atingido.';return null}
function hasConflict(candidate,ignoreId=null){return conflictInAppointmentList(candidate,appointments,ignoreId)}
function recurringWeekdayName(day,short=false){const names=short?['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']:['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];return names[Number(day)]||''}
function recurringBasePayload(){
  const pid=$('apptPatient')?.value||'',sid=$('apptService')?.value||'',date=$('apptDate')?.value||todayIso(),start=$('apptStart')?.value||settings.start_time||'08:00';
  const service=serviceById(sid),duration=Number(service.duration_minutes||45),price=Number(String($('apptPrice')?.value||getServiceDefaultPrice(sid)||0).replace(',','.'))||0;
  return {patient_id:pid,service_id:sid,appointment_date:date,start_time:start,end_time:addMinutes(start,duration),duration_minutes:duration,status:$('apptStatus')?.value||'agendado',service_price_at_time:price};
}
function recurringWorkingDays(){return String(settings.working_days||'1,2,3,4,5').split(',').map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6)}
function recurringWeekdayCombos(days){
  const combos=[];
  days.forEach(d=>combos.push([d]));
  for(let i=0;i<days.length;i++)for(let j=i+1;j<days.length;j++)combos.push([days[i],days[j]]);
  return combos;
}
function recurringRowsByDate(rows){return (rows||[]).reduce((acc,a)=>{const ds=String(a.appointment_date||'');if(!acc[ds])acc[ds]=[];acc[ds].push(a);return acc},{})}
function recurringSlotLoad(candidate,rows){
  const n1=timeToMin(candidate.start_time),n2=timeToMin(candidate.end_time);
  return (rows||[]).filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<n2&&timeToMin(normalizeTime(a.end_time))>n1).length;
}
function scoreRecurringSuggestion(combo,time,basePayload,rowsMap,totalSessions){
  const service=serviceById(basePayload.service_id),duration=Number(service.duration_minutes||basePayload.duration_minutes||45);
  const comboSet=new Set(combo),dowTime=combo.reduce((acc,d)=>{acc[d]=time;return acc},{});
  let created=0,conflicts=0,attempts=0,partialHits=0,emptyHits=0,date=new Date(basePayload.appointment_date+'T00:00:00'),tries=0,lastConflict='';
  while(created<totalSessions&&tries<370){
    const ds=isoDate(date),dow=date.getDay();
    if(comboSet.has(dow)){
      attempts++;
      const st=dowTime[dow]||time;
      const cand={...basePayload,appointment_date:ds,start_time:st,end_time:addMinutes(st,duration),duration_minutes:duration};
      const dayRows=rowsMap[ds]||[];
      const inside=isInsideWorkingTime(ds,cand.start_time,cand.end_time);
      const msg=inside?conflictInAppointmentList(cand,dayRows):'Fora do expediente.';
      if(msg){conflicts++;lastConflict=msg}
      else{
        const load=recurringSlotLoad(cand,dayRows);
        if(load>0)partialHits++;else emptyHits++;
        created++;
      }
    }
    date.setDate(date.getDate()+1);
    tries++;
  }
  const pairBonus=combo.length===2?8:0;
  const score=(created*100)-(conflicts*16)+(partialHits*9)+(emptyHits*3)+pairBonus;
  const badge=created>=totalSessions&&conflicts===0?'Melhor':(created>=Math.ceil(totalSessions*.8)?'Bom':'Atenção');
  return {combo,time,created,conflicts,attempts,partialHits,emptyHits,lastConflict,score,badge,label:combo.map(d=>recurringWeekdayName(d)+' '+time).join(' + ')};
}
function assistantRecurringBadge(index){
  return index===0?'Melhor':(index===1?'Alternativa':'Segura');
}
function assistantRecurringReason(code){
  if(code==='best_fit') return 'Melhor equilíbrio entre cobertura, encaixe e conflitos.';
  if(code==='closest_match') return 'Alternativa próxima ao pedido original.';
  return 'Opção segura para seguir sem quebrar a agenda.';
}
function assistantRecurringSummary(sessions){
  if(!Array.isArray(sessions)||!sessions.length) return 'Sem sessões sugeridas.';
  const map={};
  sessions.forEach(function(item){
    const key=String(item.weekday);
    if(!map[key]) map[key]=item.start_time;
  });
  return Object.keys(map).sort().map(function(key){
    return recurringWeekdayName(Number(key)) + ' ' + map[key];
  }).join(' · ');
}
function assistantRecurringCombos(days,frequency){
  const base=(Array.isArray(days)&&days.length?days:recurringWorkingDays()).map(Number).filter(Number.isInteger);
  if(!base.length) return [];
  const target=Math.max(1, Math.min(Number(frequency||1), base.length));
  const combos=[];
  function walk(start,pick){
    if(pick.length===target){combos.push(pick.slice());return;}
    for(let i=start;i<base.length;i++) walk(i+1,pick.concat(base[i]));
  }
  walk(0,[]);
  return combos;
}
function buildAssistantRecurringPlan(basePayload,combo,time,rowsMap,totalSessions){
  const service=serviceById(basePayload.service_id),duration=Number(service.duration_minutes||basePayload.duration_minutes||45);
  const comboSet=new Set(combo),dowTime=combo.reduce((acc,d)=>{acc[d]=time;return acc},{});
  let created=0,conflicts=0,attempts=0,partialHits=0,emptyHits=0,date=new Date(basePayload.appointment_date+'T00:00:00'),tries=0,lastConflict='';
  const sessions=[];
  while(created<totalSessions&&tries<370){
    const ds=isoDate(date),dow=date.getDay();
    if(comboSet.has(dow)){
      attempts++;
      const st=dowTime[dow]||time;
      const cand={...basePayload,appointment_date:ds,start_time:st,end_time:addMinutes(st,duration),duration_minutes:duration};
      const dayRows=rowsMap[ds]||[];
      const inside=isInsideWorkingTime(ds,cand.start_time,cand.end_time);
      const msg=inside?conflictInAppointmentList(cand,dayRows):'Fora do expediente.';
      if(msg){conflicts++;lastConflict=msg;}
      else{
        const load=recurringSlotLoad(cand,dayRows);
        if(load>0)partialHits++;else emptyHits++;
        created++;
        sessions.push({...cand,weekday:dow,load});
      }
    }
    date.setDate(date.getDate()+1);
    tries++;
  }
  const pairBonus=combo.length===2?8:0;
  const score=(created*100)-(conflicts*16)+(partialHits*9)+(emptyHits*3)+pairBonus;
  const impact=partialHits?`${partialHits} horário(s) aproveitam blocos já ocupados`:`${emptyHits} horário(s) entram em grade mais vazia`;
  return {combo:[...combo],time,created,conflicts,attempts,partialHits,emptyHits,lastConflict,score,sessions,impact,summary:assistantRecurringSummary(sessions),coverage:`${created}/${totalSessions} sessões previstas`};
}
async function suggestAssistantRecurringPrograms(input={}){
  const sid=input.service_id||input.serviceId;
  if(!sid) return {plans:[],reason:'Serviço não identificado.'};
  const service=serviceById(sid);
  if(!service||!service.id) return {plans:[],reason:'Serviço não encontrado.'};
  const totalSessions=Math.max(1,Number(input.total_sessions||input.totalSessions||input.count||1));
  const frequency=Math.max(1,Number(input.frequency_per_week||input.frequencyPerWeek||input.frequency||1));
  const startDate=String(input.start_date||input.startDate||input.appointment_date||todayIso());
  const duration=Number(input.duration_minutes||service.duration_minutes||45);
  const startTime=normalizeTime(input.start_time||input.startTime||settings.start_time||'08:00');
  const basePayload={patient_id:input.patient_id||input.patientId||'assistant-draft',service_id:service.id,appointment_date:startDate,start_time:startTime,end_time:addMinutes(startTime,duration),duration_minutes:duration,status:'agendado',service_price_at_time:Number(getServiceDefaultPrice(service.id))};
  const horizonEnd=addDaysIso(startDate,369);
  const rows=await fetchAppointmentsForRange(startDate,horizonEnd);
  const rowsMap=recurringRowsByDate(rows);
  const combos=assistantRecurringCombos(input.weekdays||input.days,frequency);
  const candidateTimes=[...new Set([startTime,...slots()])].filter(Boolean).filter(function(time){
    if(!assistantPeriodMatches(time,input.period||input.requested_period||'')) return false;
    return parsePeriods().some(function(p){
      return timeToMin(time)>=timeToMin(p.start)&&timeToMin(addMinutes(time,duration))<=timeToMin(p.end);
    });
  });
  const pool=(candidateTimes.length?candidateTimes:[startTime]).flatMap(function(time){
    return combos.map(function(combo){
      return buildAssistantRecurringPlan(basePayload,combo,time,rowsMap,totalSessions);
    });
  }).filter(function(plan){
    return plan.created>0;
  }).sort(function(a,b){
    return b.score-a.score||b.created-a.created||a.conflicts-b.conflicts||b.partialHits-a.partialHits;
  }).slice(0,9).map(function(plan,index){
    const reasonCode=index===0?'best_fit':(index===1?'closest_match':'safe_fallback');
    return {...plan,badge:assistantRecurringBadge(index),reason:assistantRecurringReason(reasonCode),reason_code:reasonCode};
  }).slice(0,3);
  return {plans:pool,reason:pool.length?'Grades recorrentes encontradas.':'Nenhuma grade segura encontrada com os parâmetros atuais.'};
}
function renderRecurringSuggestions(list,loading=false){
  const target=$('recSuggestionList');if(!target)return;
  if(loading){target.innerHTML='<div class="rec-suggestion-empty">Analisando agenda e conflitos...</div>';return}
  if(!list.length){target.innerHTML='<div class="rec-suggestion-empty">Nenhuma sugestão segura encontrada com os dados atuais.</div>';return}
  target.innerHTML=list.map((item,i)=>{
    const badgeClass=item.badge==='Melhor'?'best':(item.badge==='Bom'?'good':'warn');
    const detail=`${item.created} sessão(ões) previstas · ${item.conflicts} conflito(s)`;
    const compact=item.partialHits?`${item.partialHits} encaixe(s) em horários já ocupados`:`${item.emptyHits} horário(s) livre(s)`;
    return `<div class="rec-suggestion-card ${badgeClass}"><div><span class="rec-suggestion-badge">${esc(item.badge)}</span><strong>${esc(item.label)}</strong><small>${esc(detail)} · ${esc(compact)}</small></div><button class="btn small primary" type="button" onclick="useRecurringSuggestion(${i})">Usar esta recorrência</button></div>`;
  }).join('');
}
async function suggestRecurringOptions(){
  const basePayload=recurringBasePayload();
  if(!basePayload.patient_id){toast('Selecione o paciente antes de sugerir recorrência.','warning');return}
  if(!basePayload.service_id){toast('Selecione o serviço antes de sugerir recorrência.','warning');return}
  if(!basePayload.appointment_date){toast('Informe a data inicial antes de sugerir.','warning');return}
  if(!$('recurring')?.checked){$('recurring').checked=true;toggleRecurrence()}
  renderRecurringSuggestions([],true);
  const totalSessions=Math.max(1,Number($('recCount')?.value||1));
  const horizonEnd=addDaysIso(basePayload.appointment_date,369);
  const rows=await fetchAppointmentsForRange(basePayload.appointment_date,horizonEnd);
  const rowsMap=recurringRowsByDate(rows);
  const days=recurringWorkingDays();
  const candidateTimes=[...new Set([basePayload.start_time,...slots()])].filter(t=>isInsideWorkingTime(basePayload.appointment_date,t,addMinutes(t,basePayload.duration_minutes))||parsePeriods().some(p=>timeToMin(t)>=timeToMin(p.start)&&timeToMin(addMinutes(t,basePayload.duration_minutes))<=timeToMin(p.end)));
  const combos=recurringWeekdayCombos(days);
  recurringSuggestionCache=combos.flatMap(combo=>candidateTimes.map(time=>scoreRecurringSuggestion(combo,time,basePayload,rowsMap,totalSessions)))
    .filter(item=>item.created>0)
    .sort((a,b)=>b.score-a.score||b.created-a.created||a.conflicts-b.conflicts||b.partialHits-a.partialHits)
    .slice(0,5);
  renderRecurringSuggestions(recurringSuggestionCache);
}
function useRecurringSuggestion(index){
  const item=recurringSuggestionCache[Number(index)];if(!item)return;
  document.querySelectorAll('.recDay').forEach(ch=>{ch.checked=false});
  document.querySelectorAll('.rec-day-card').forEach(card=>card.classList.remove('active'));
  item.combo.forEach(day=>{
    const check=document.querySelector(`.recDay[value="${day}"]`),timeInput=$('recTime'+day);
    if(check)check.checked=true;
    if(timeInput)timeInput.value=item.time;
    toggleRecDayCard(day);
  });
  $('apptStart').value=item.time;
  onServiceChange();
  toast('Recorrência preenchida. Revise e clique em salvar.','success');
}
async function persistAppointment(id,payload){try{return id?(await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify(payload)}))[0]:(await api('appointments',{method:'POST',body:JSON.stringify(payload)}))[0]}catch(e){if(String(e.message||'').includes('service_price_at_time')){const clone={...payload};delete clone.service_price_at_time;toast('Campo service_price_at_time ausente no banco. Salvando sem ele. Rode o patch SQL v1.4.28 depois.','warning');return id?(await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify(clone)}))[0]:(await api('appointments',{method:'POST',body:JSON.stringify(clone)}))[0]}throw e}}
function confirmOutsideWorkingHours(payload){
  const warnings=[];
  if(!isTodayDate(payload.appointment_date)&&!isWorking(payload.appointment_date))warnings.push('O dia escolhido está fora do expediente.');
  if(!isInsideWorkingTime(payload.appointment_date,payload.start_time,payload.end_time))warnings.push('O horário está fora dos períodos de expediente configurados.');
  if(!warnings.length)return true;
  const ok=confirm(warnings.join('\n')+'\n\nDeseja marcar mesmo assim? Use esta opção apenas para emergências ou encaixes autorizados.');
  if(!ok)toast('Agendamento fora do expediente cancelado.','info');
  return ok;
}
async function saveAppointment(){
  const saveBtn=$('saveApptBtn');
  try{
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...'}
    const id=$('apptId').value;
    if(!$('apptPatient').value){toast('Selecione o paciente antes de salvar.','warning');focusPatientPicker('apptPatient');return}
    if(!$('apptService').value){toast('Selecione o serviço antes de salvar.','warning');$('apptService').focus();return}
    if(!$('apptDate').value){toast('Informe a data do atendimento.','warning');$('apptDate').focus();return}
    if(!$('apptStart').value){toast('Informe o horário inicial.','warning');$('apptStart').focus();return}
    const s=serviceById($('apptService').value);
    if(!$('apptEnd').value)$('apptEnd').value=addMinutes($('apptStart').value,Number(s.duration_minutes||45));
    const agreedPrice=Number(String($('apptPrice')?.value||'0').replace(',','.'));
    if(!Number.isFinite(agreedPrice)||agreedPrice<0){toast('Informe um valor válido para a sessão.','warning');$('apptPrice')?.focus();return}
    const basePayload={patient_id:$('apptPatient').value,service_id:$('apptService').value,appointment_date:$('apptDate').value,start_time:$('apptStart').value,end_time:$('apptEnd').value,duration_minutes:Number(s.duration_minutes||45),status:$('apptStatus').value,service_price_at_time:agreedPrice};
    if(timeToMin(basePayload.end_time)<=timeToMin(basePayload.start_time)){toast('O horário final precisa ser maior que o inicial.','warning');return}
    if(!confirmOutsideWorkingHours(basePayload))return;
    if($('recurring').checked&&!id){await saveRecurring(basePayload);return}
    const msg=hasConflict(basePayload,id);
    if(msg){toast(msg,'warning');return}
    let old=id?appointments.find(a=>String(a.id)===String(id)):null;
    let saved=await persistAppointment(id,basePayload);
    await handlePackageMovement(old,saved);
    if(!id&&$('rescheduleOriginId').value)await finalizeReschedule($('rescheduleOriginId').value,$('rescheduleCancelOriginal').value==='true');
    closeModal('apptModal');
    await loadAll(true);
    toast('Agendamento salvo.','success');
  }catch(e){
    toast('Erro ao salvar: '+e.message,'error');
  }finally{
    if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Salvar agendamento'}
  }
}
async function saveRecurring(payload){const selected=[...document.querySelectorAll('.recDay:checked')].map(x=>Number(x.value));const count=Number($('recCount').value||1);if(!selected.length){toast('Selecione ao menos um dia da semana.','warning');return}const s=serviceById(payload.service_id);const dayTimes={};selected.forEach(d=>{dayTimes[d]=($('recTime'+d)?.value||payload.start_time||'08:00')});let created=0,conflicts=0,date=new Date(payload.appointment_date+'T00:00:00'),tries=0;while(created<count&&tries<370){const ds=isoDate(date),dow=date.getDay();if(selected.includes(dow)&&(isTodayDate(ds)||isWorking(ds))){const st=dayTimes[dow]||payload.start_time;const cand={...payload,appointment_date:ds,start_time:st,end_time:addMinutes(st,Number(s.duration_minutes||payload.duration_minutes||45)),duration_minutes:Number(s.duration_minutes||payload.duration_minutes||45)};let dayRows=appointments.filter(a=>a.appointment_date===ds);try{dayRows=await fetchAppointmentsForDate(ds)}catch(e){}const msg=conflictInAppointmentList(cand,dayRows);if(msg||!isInsideWorkingTime(cand.appointment_date,cand.start_time,cand.end_time))conflicts++;else{const saved=await persistAppointment(null,cand);dayRows.push(saved);created++}}date.setDate(date.getDate()+1);tries++}closeModal('apptModal');await loadAll(true);toast(`${created} agendamentos criados. ${conflicts} conflitos ignorados.`,'success')}
async function finalizeReschedule(originId,cancelOriginal){const old=appointments.find(a=>String(a.id)===String(originId));if(!old||!cancelOriginal)return;if(old.status==='concluido'&&old.package_consumed)await refundPackage(old);await api('appointments?id=eq.'+originId,{method:'PATCH',body:JSON.stringify({status:'cancelado'})});}
function rescheduleAppointment(id){const a=appointments.find(x=>String(x.id)===String(id));if(!a)return;const cancelOriginal=confirm('Remarcar cancelando o agendamento original? Clique em OK para cancelar o original e criar um novo. Clique em Cancelar para criar novo sem cancelar o original.');openAppt(a.appointment_date,null,normalizeTime(a.start_time));$('apptPatient').value=a.patient_id;$('apptService').value=a.service_id;$('apptStatus').value='agendado';$('apptDate').value=a.appointment_date;$('apptStart').value=normalizeTime(a.start_time);syncPatientPickers();onServiceChange();$('rescheduleOriginId').value=id;$('rescheduleCancelOriginal').value=cancelOriginal?'true':'false';$('apptTitle').textContent='Remarcar atendimento';toast(cancelOriginal?'Escolha novo horário. O original será cancelado ao salvar.':'Escolha novo horário. O original será mantido.','info')}
async function deleteAppointment(){const id=$('apptId').value;if(!id||!confirm('Remover este agendamento?'))return;try{await removeAppointmentRecord(id);closeModal('apptModal');await loadAll(true);toast('Agendamento removido.','success')}catch(e){toast('Erro ao remover: '+e.message,'error')}}
function renderDay(){
  const date=$('dayDate').value||todayIso();$('dayDate').value=date;
  const list=appointments.filter(a=>a.appointment_date===date).sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
  const dayBlocks=activeScheduleBlocksForDate(date).sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
  const packageAlertCache=Object.create(null);
  const dayStatusLabels={concluido:'Concluídos',cancelado:'Cancelados'};
  const statusCounts={concluido:0,cancelado:0};
  const patientNames=Object.create(null);
  const serviceNames=Object.create(null);
  const slotList=slots();
  const slotStep=agendaSlotStep();
  patients.forEach(patient=>{patientNames[String(patient.id)]=patient.name||'Paciente'});
  services.forEach(service=>{serviceNames[String(service.id)]=service.name||'Sem serviço'});
  list.forEach(a=>{if(statusCounts[a.status]!==undefined) statusCounts[a.status]++;});
  const peak=slotList.reduce((max,slot)=>{
    const slotStart=timeToMin(slot);
    const slotEnd=timeToMin(addMinutes(slot,slotStep));
    const count=list.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<slotEnd&&timeToMin(normalizeTime(a.end_time))>slotStart).length;
    return Math.max(max,count);
  },0);
  $('dayKpis').innerHTML=`<div class="day-operational-strip"><div class="day-operational-copy"><strong>${fmtWeekday(date)}, ${fmtDate(date)}</strong><span>${list.length} atendimento(s) · ${dayBlocks.length} bloqueio(s) · pico ${peak}/${Number(settings.max_patients_per_slot||4)}</span></div><div class="day-status-row compact">`+['concluido','cancelado'].map(st=>`<div class="day-status-pill ${st}"><span>${dayStatusLabels[st]}</span><strong>${statusCounts[st]||0}</strong></div>`).join('')+`<button class="btn warning" type="button" onclick="quickBlockDay('${date}')">Bloquear horário</button></div></div>`;
  const blockHtml=dayBlocks.length?`<div class="item" style="padding:10px 12px;border-color:#fed7aa;background:#fff7ed"><div style="display:flex;flex-direction:column;gap:8px"><strong>Horários bloqueados para o bot</strong>${dayBlocks.map(block=>`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="status-chip cancelado">${normalizeTime(block.start_time)}-${normalizeTime(block.end_time)}</span><span class="muted small">${esc(block.reason||'Bloqueio manual')}</span><button class="btn small" type="button" onclick="reopenScheduleBlock('${esc(block.id)}')">Reabrir</button></div>`).join('')}</div></div>`:'';
  const appointmentHtml=list.length?list.map(a=>{
    const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
    const nextStatuses=getNextStatuses(a.status);
    const patientLabel=patientNames[String(a.patient_id)]||'Paciente';
    const serviceLabel=serviceNames[String(a.service_id)]||'Sem serviço';
    const alert=appointmentPackageAlertMeta(a,packageAlertCache);
    return `<div class="item status-${a.status}" style="padding:10px 12px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="appt-weekday" style="margin:0;font-size:.7rem">${weekdayShort(a.appointment_date)}</span>
          <strong style="font-size:.9rem">${normalizeTime(a.start_time)}–${normalizeTime(a.end_time)}</strong>
          <span class="status-chip ${a.status}" style="font-size:.68rem;padding:3px 6px">${label}</span>
          ${alert.show?`<span class="appointment-package-alert-dot inline" title="${esc(alert.text)}" aria-label="${esc(alert.text)}"></span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:.82rem;font-weight:700">${esc(patientLabel)}</span>
          <span class="muted" style="font-size:.72rem">${esc(serviceLabel)}${saldoBadgeInline(a.patient_id,a.service_id)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:8px">
          <button class="btn" style="padding:6px 10px;font-size:.72rem" onclick="openPatient('${a.patient_id}')" title="Ficha">👤 Ficha</button>
          <button class="btn" style="padding:6px 10px;font-size:.72rem" onclick="openAppt('${a.appointment_date}','${a.id}')" title="Editar">✏️ Editar</button>
          <button class="btn warning" style="padding:6px 10px;font-size:.72rem" onclick="quickBlockSlot('${a.appointment_date}','${normalizeTime(a.start_time)}','${normalizeTime(a.end_time)}')" title="Bloquear este intervalo">🚫 Bloquear</button>
          <select onchange="quickStatus('${a.id}',this.value);this.value=''" style="width:auto;padding:6px 10px;font-size:.72rem;border-radius:10px;min-width:42px" title="Alterar status">
            <option value="">⚡ Status</option>
            ${nextStatuses.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  }).join(''):'<div class="muted">Nenhum agendamento.</div>';
  $('dayList').innerHTML=blockHtml+appointmentHtml;
}
function reminderFlag(a){return!!(a.appointment_reminder_sent||a.reminder_sent)}
function appointmentDateTime(a,field='start_time'){
  const date=String(a.appointment_date||'');
  const time=normalizeTime(a[field]||a.start_time||'00:00');
  const d=new Date(date+'T'+time+':00');
  return Number.isNaN(d.getTime())?null:d;
}
function appointmentReminderHoursBefore(){
  const value=Number(settings.whatsapp_confirmation_hours_before||12);
  return Number.isFinite(value)&&value>0?value:12;
}
function reminderDueAt(a){
  const utils=reminderUtils();
  if(utils&&typeof utils.reminderDueAt==='function') return utils.reminderDueAt(a,{hoursBefore:appointmentReminderHoursBefore()});
  const base=appointmentDateTime(a);
  if(!base) return null;
  return new Date(base.getTime()-(appointmentReminderHoursBefore()*60*60*1000));
}
function isReminderCandidate(a){
  return ['agendado','confirmado'].includes(a.status);
}
function reminderDueLabel(a){
  const due=reminderDueAt(a);
  if(!due) return 'Sem horário válido';
  const diff=due.getTime()-Date.now();
  if(diff<=0) return 'Vencido para envio';
  const mins=Math.ceil(diff/60000);
  if(mins<60) return 'Vence em '+mins+' min';
  const hours=Math.floor(mins/60), rest=mins%60;
  return 'Vence em '+hours+'h'+(rest?String(rest).padStart(2,'0'):'');
}
function isBaileysProviderOnline(){
  return !!(whatsappServiceStatus&&whatsappServiceStatus.connection_status==='connected');
}
function renderReminderAutomationStatus(){
  const badge=$('reminderModeBadge');
  if(badge){badge.className='mode-badge auto';badge.textContent='Baileys'}
}
function reminderListFor(date){
  return appointments
    .filter(a=>a.appointment_date===date&&isReminderCandidate(a))
    .sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
}
function aiRadarWeekStartValue(){
  const input=$('aiRadarStart');
  const raw=input&&input.value?input.value:todayIso();
  const start=weekStart(new Date(raw+'T00:00:00'));
  const value=isoDate(start);
  if(input&&input.value!==value)input.value=value;
  return value;
}
function aiRadarRange(startValue){
  const start=weekStart(new Date(startValue+'T00:00:00'));
  const end=new Date(start);
  end.setDate(start.getDate()+27);
  return {from:isoDate(start),to:isoDate(end)};
}
function aiRadarQueryFor(startValue){
  const range=aiRadarRange(startValue);
  return 'appointments?select=*&appointment_date=gte.'+range.from+'&appointment_date=lte.'+range.to+'&order=appointment_date.asc,start_time.asc';
}
function getAIRadarPeriod(){
  return $('aiRadarPeriod')?$('aiRadarPeriod').value:'all';
}
function getAIRadarPatientId(){
  return $('aiRadarPatient')?$('aiRadarPatient').value:'';
}
function aiRadarPeriodLabel(period){
  return {manha:'manhã',tarde:'tarde',noite:'noite'}[period]||'todos os períodos';
}
function aiRadarSlotShift(start){
  const m=timeToMin(start);
  if(m<12*60)return 'manha';
  if(m<18*60)return 'tarde';
  return 'noite';
}
async function loadAIRadarAppointments(startValue,force=false){
  const query=aiRadarQueryFor(startValue);
  if(!force&&query===aiRadarQuery&&aiRadarLoaded)return aiRadarAppointments;
  if(!base()||!key()||!sessionStorage.getItem('femic_jwt')){
    aiRadarQuery=query;
    aiRadarAppointments=appointments.filter(a=>{
      const range=aiRadarRange(startValue);
      return String(a.appointment_date||'')>=range.from&&String(a.appointment_date||'')<=range.to;
    });
    aiRadarLoaded=true;
    return aiRadarAppointments;
  }
  aiRadarAppointments=await api(query)||[];
  aiRadarQuery=query;
  aiRadarLoaded=true;
  return aiRadarAppointments;
}
function aiRadarSlotStatus(date,start,end,rows,servicesById,patientsById){
  const max=Number(settings.max_patients_per_slot||4);
  const startMin=timeToMin(start),endMin=timeToMin(end);
  const overlaps=rows.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<endMin&&timeToMin(normalizeTime(a.end_time))>startMin);
  const hasIndividual=overlaps.some(a=>(((servicesById[String(a.service_id)]||{}).appointment_mode)||'grupo')==='individual');
  const occupied=overlaps.length;
  const remaining=hasIndividual?0:Math.max(0,max-occupied);
  const names=overlaps.slice(0,3).map(a=>(patientsById[String(a.patient_id)]||{}).name||'Paciente');
  let cls='open',label='Livre',rank=2;
  if(hasIndividual||remaining<=0){cls='full';label=hasIndividual?'Individual':'Lotado';rank=0}
  else if(remaining===1){cls='almost';label='1 vaga';rank=1}
  else if(occupied>0){cls='best';label='Melhor encaixe';rank=4}
  return {date,start,end,occupied,remaining,max,hasIndividual,patients:names,extra:Math.max(0,overlaps.length-names.length),cls,label,rank};
}
function buildAIRadarWeeks(rows,startValue){
  const start=weekStart(new Date(startValue+'T00:00:00'));
  const period=getAIRadarPeriod();
  const slotList=slots().filter(slot=>period==='all'||assistantPeriodMatches(slot,period));
  const slotStep=agendaSlotStep();
  const servicesById=Object.create(null);
  const patientsById=Object.create(null);
  const rowsByDate=Object.create(null);
  services.forEach(service=>{servicesById[String(service.id)]=service});
  patients.forEach(patient=>{patientsById[String(patient.id)]=patient});
  rows.forEach(a=>{
    const ds=String(a.appointment_date||'');
    if(!rowsByDate[ds]) rowsByDate[ds]=[];
    rowsByDate[ds].push(a);
  });
  const weeks=[];
  for(let w=0;w<4;w++){
    const weekStartDate=new Date(start);
    weekStartDate.setDate(start.getDate()+(w*7));
    const week={start:isoDate(weekStartDate),days:[],counts:{best:0,open:0,almost:0,full:0,total:0}};
    for(let d=0;d<7;d++){
      const day=new Date(weekStartDate);
      day.setDate(weekStartDate.getDate()+d);
      const ds=isoDate(day);
      const dayRows=rowsByDate[ds]||[];
      const daySlots=isWorking(ds)?slotList.map(slot=>{
        const end=addMinutes(slot,slotStep);
        const item=aiRadarSlotStatus(ds,slot,end,dayRows,servicesById,patientsById);
        week.counts[item.cls]++;
        week.counts.total++;
        return item;
      }):[];
      week.days.push({date:ds,closed:!isWorking(ds),slots:daySlots});
    }
    weeks.push(week);
  }
  return weeks;
}
function aiRadarTotals(weeks){
  return weeks.reduce((acc,week)=>{
    ['best','open','almost','full','total'].forEach(k=>acc[k]+=week.counts[k]||0);
    return acc;
  },{best:0,open:0,almost:0,full:0,total:0});
}
function aiRadarOpenSlots(weeks){
  return (weeks||[]).flatMap(week=>week.days.flatMap(day=>day.slots.map(slot=>Object.assign({},slot,{dow:dateDay(slot.date)}))))
    .filter(slot=>slot.remaining>0&&!slot.hasIndividual)
    .sort((a,b)=>b.rank-a.rank||String(a.date).localeCompare(String(b.date))||String(a.start).localeCompare(String(b.start)));
}
function aiRadarFutureOpenSlots(weeks){
  const now=Date.now();
  return aiRadarOpenSlots(weeks).filter(slot=>new Date(slot.date+'T'+slot.start+':00').getTime()>now);
}
function aiRadarSummaryData(weeks){
  const open=aiRadarOpenSlots(weeks);
  const future=aiRadarFutureOpenSlots(weeks);
  const byDay={},byShift={},almostDays=[],freeDays=[];
  (weeks||[]).forEach(week=>week.days.forEach(day=>{
    const slots=day.slots||[];
    const available=slots.filter(slot=>slot.remaining>0&&!slot.hasIndividual).length;
    const almost=slots.filter(slot=>slot.cls==='almost').length;
    const full=slots.filter(slot=>slot.cls==='full').length;
    const best=slots.filter(slot=>slot.cls==='best').length;
    if(slots.length){
      byDay[day.date]=(byDay[day.date]||0)+(best*3)+available;
      if(almost+full>=Math.max(3,Math.ceil(slots.length*.45)))almostDays.push(day.date);
      if(available>=Math.max(4,Math.ceil(slots.length*.65)))freeDays.push(day.date);
    }
  }));
  open.forEach(slot=>{
    const shift=aiRadarSlotShift(slot.start);
    byShift[shift]=(byShift[shift]||0)+(slot.cls==='best'?3:1);
  });
  const bestDay=Object.keys(byDay).sort((a,b)=>byDay[b]-byDay[a])[0]||'';
  const bestShift=Object.keys(byShift).sort((a,b)=>byShift[b]-byShift[a])[0]||'';
  return {future,bestDay,bestShift,almostDays:[...new Set(almostDays)].slice(0,3),freeDays:[...new Set(freeDays)].slice(0,3)};
}
function renderAIRadarSummary(weeks){
  const target=$('aiRadarSummary');
  if(!target)return;
  const data=aiRadarSummaryData(weeks);
  const cards=[
    {label:'Melhor dia',value:data.bestDay?fmtWeekday(data.bestDay):'Sem dados',note:data.bestDay?fmtDate(data.bestDay):'Carregue a agenda para analisar'},
    {label:'Melhor período',value:data.bestShift?aiRadarPeriodLabel(data.bestShift):'Sem destaque',note:'Baseado nos encaixes disponíveis'},
    {label:'Quase lotados',value:data.almostDays.length?data.almostDays.map(fmtDate).join(', '):'Nenhum alerta',note:'Dias com pouca folga'},
    {label:'Mais livres',value:data.freeDays.length?data.freeDays.map(fmtDate).join(', '):'Sem excesso',note:'Dias com bastante espaço'}
  ];
  target.innerHTML=cards.map(card=>`<div class="ai-summary-card"><span>${esc(card.label)}</span><strong>${esc(card.value)}</strong><small>${esc(card.note)}</small></div>`).join('');
}
function renderAIRadarQuickSlots(weeks){
  const target=$('aiRadarQuick');
  if(!target)return;
  const slots=aiRadarFutureOpenSlots(weeks).slice(0,5);
  if(!slots.length){
    target.innerHTML='<div class="card ai-quick-empty"><strong>Nenhum horário disponível nesse filtro.</strong><span class="muted small">Tente outro período ou uma semana diferente.</span></div>';
    return;
  }
  target.innerHTML=`<div class="ai-quick-head"><div><div class="eyebrow">Visão rápida</div><h3>Melhores horários para oferecer agora</h3></div><button class="btn primary" type="button" onclick="copyAIRadarBestSlots()">Copiar melhores horários</button></div><div class="ai-quick-grid">`+slots.map(slot=>{
    const label=slot.cls==='best'?'Encaixe ideal':slot.cls==='almost'?'Última vaga':'Livre';
    return `<article class="ai-quick-slot ${slot.cls}"><div><span>${esc(label)}</span><strong>${fmtWeekday(slot.date).replace('-feira','')}</strong><small>${fmtDate(slot.date)}</small></div><div class="ai-quick-time">${normalizeTime(slot.start)}</div><div class="ai-quick-meta"><span>${slot.remaining} vaga(s)</span><span>${slot.occupied}/${slot.max} ocupadas</span></div><button class="btn" type="button" onclick="openAppt('${slot.date}',null,'${slot.start}')">Agendar</button></article>`;
  }).join('')+'</div>';
}
function aiRadarBestSlotText(slot){
  return fmtWeekday(slot.date).replace('-feira','').toLowerCase()+' '+normalizeTime(slot.start);
}
async function copyAIRadarBestSlots(){
  if(!aiRadarLastWeeks.length){
    await renderAIRadar(false);
  }
  const slots=aiRadarFutureOpenSlots(aiRadarLastWeeks).slice(0,5);
  if(!slots.length){
    toast('Nenhum horário disponível para copiar nesse filtro.','warning');
    return;
  }
  const period=getAIRadarPeriod();
  const msg='Tenho disponibilidade '+(period==='all'?'':'no período da '+aiRadarPeriodLabel(period)+' ')+'em '+slots.map(aiRadarBestSlotText).join(', ')+'.';
  try{
    await navigator.clipboard.writeText(msg);
    toast('Melhores horários copiados para o WhatsApp.','success');
  }catch(e){
    window.prompt('Copie os melhores horários:',msg);
  }
}
async function renderAIRadar(force=false){
  if(!$('aiRadarWeeks'))return;
  const startValue=aiRadarWeekStartValue();
  if(force){aiRadarQuery='';aiRadarLoaded=false}
  $('aiRadarWeeks').innerHTML='<div class="card muted">Carregando radar de horários...</div>';
  try{
    const rows=await loadAIRadarAppointments(startValue,force);
    const weeks=buildAIRadarWeeks(rows,startValue);
    aiRadarLastWeeks=weeks;
    const totals=aiRadarTotals(weeks);
    renderAIRadarQuickSlots(weeks);
    renderAIRadarSummary(weeks);
    const idealFocus=$('aiRadarIdealFocus')&&$('aiRadarIdealFocus').checked;
    if($('aiRadarKpiLine'))$('aiRadarKpiLine').textContent=`${totals.best} encaixe(s) bons · ${totals.open} livres · ${totals.almost} com 1 vaga · ${totals.full} lotados`;
    $('aiRadarKpis').innerHTML=`<span><strong>${totals.best}</strong> encaixes bons</span><span><strong>${totals.open}</strong> livres</span><span><strong>${totals.almost}</strong> com 1 vaga</span><span><strong>${totals.full}</strong> lotados</span>`;
    $('aiRadarWeeks').innerHTML=weeks.map(week=>{
      const weekEnd=addDaysIso(week.start,6);
      return `<section class="card ai-radar-week"><div class="section-title"><div><div class="eyebrow">Semana</div><h3>${fmtDate(week.start)} a ${fmtDate(weekEnd)}</h3></div><span class="muted small">${week.counts.best} encaixe(s) bons · ${week.counts.almost} com 1 vaga</span></div><div class="ai-radar-days">${week.days.map(day=>{
        const weekend=dateDay(day.date)===0||dateDay(day.date)===6?' weekend':'';
        if(day.closed)return `<div class="ai-radar-day closed${weekend}"><div class="ai-radar-day-head"><strong>${fmtWeekday(day.date)}</strong><span>${fmtDate(day.date)}</span></div><div class="muted small">Sem expediente</div></div>`;
        return `<div class="ai-radar-day${weekend}"><div class="ai-radar-day-head"><strong>${fmtWeekday(day.date)}</strong><span>${fmtDate(day.date)}</span></div><div class="ai-radar-slots">${day.slots.map(slot=>`<div class="ai-radar-slot ${slot.cls}${idealFocus&&slot.cls==='best'?' ideal-focus':''}"><div><strong>${slot.start}</strong><span>${slot.label}</span></div><div class="ai-slot-meta"><span>${slot.occupied}/${slot.max}</span><span>${slot.remaining} vaga(s)</span></div>${slot.patients.length?`<div class="ai-slot-patients">${esc(slot.patients.join(', '))}${slot.extra?' +'+slot.extra:''}</div>`:''}${slot.remaining>0?`<button class="btn small" type="button" onclick="openAppt('${slot.date}',null,'${slot.start}')">Agendar</button>`:''}</div>`).join('')}</div></div>`;
      }).join('')}</div></section>`;
    }).join('');
  }catch(e){
    $('aiRadarWeeks').innerHTML='<div class="card"><strong>Não foi possível carregar o radar.</strong><div class="muted small">'+esc(e.message||e)+'</div></div>';
  }
}
function renderReminders(){
  const date=$('reminderDate').value||isoDate(new Date(Date.now()+86400000));
  $('reminderDate').value=date;
  renderReminderAutomationStatus();
  refreshWhatsappServiceStatus();
  const list=reminderListFor(date);
  const patientsById=Object.create(null);
  const servicesById=Object.create(null);
  patients.forEach(patient=>{patientsById[String(patient.id)]=patient});
  services.forEach(service=>{servicesById[String(service.id)]=service});
  const hasReminderPhone=a=>cleanPhone((patientsById[String(a.patient_id)]||{}).whatsapp).length>=10;
  const pending=list.filter(a=>!reminderFlag(a)&&hasReminderPhone(a));
  const sent=list.filter(a=>reminderFlag(a));
  const no=list.filter(a=>!reminderFlag(a)&&!hasReminderPhone(a));
  const due=pending.filter(a=>{const d=reminderDueAt(a);return d&&d.getTime()<=Date.now();});
  $('reminderKpis').innerHTML=`<div class="kpi"><div class="small muted">Pendentes</div><strong>${pending.length}</strong></div><div class="kpi"><div class="small muted">Vencidos</div><strong>${due.length}</strong></div><div class="kpi"><div class="small muted">Enviados</div><strong>${sent.length}</strong></div>`;
  $('reminderList').innerHTML=list.length?list.map(a=>{
    const p=patientsById[String(a.patient_id)]||{},service=servicesById[String(a.service_id)]||{},sentFlag=reminderFlag(a),phoneOk=hasReminderPhone(a),dueText=sentFlag?'Enviado':reminderDueLabel(a),cls=sentFlag?'reminder-enviado':phoneOk?'reminder-pendente':'reminder-semwhats';
    return `<div class="item ${cls}"><div class="item-top"><div><strong>${normalizeTime(a.start_time)} — ${esc(p.name||'Paciente')}</strong><div class="muted small">${esc(p.whatsapp||'Sem WhatsApp')} · ${esc(service.name||'Sem serviço')} · <span class="status-chip ${a.status}">${a.status}</span> · <span class="reminder-state ${cls}">${esc(dueText)}</span></div></div><div class="toolbar">${sentFlag?'<span class="status-chip concluido">Enviado</span>':phoneOk?'<button class="btn btn-compact" onclick="sendReminderNow(\''+a.id+'\')">Enviar WhatsApp</button>':'<span class="status-chip cancelado">Sem WhatsApp</span>'}</div></div></div>`;
  }).join(''):'<div class="muted">Nenhum lembrete nesta data.</div>';
}

function renderWhatsappProviderBadge(){
  const provider='baileys';
  const badge=$('whatsappProviderBadge');
  if(!badge) return;
  badge.className='mode-badge auto';
  badge.textContent='Baileys';
  renderWhatsappServiceStatus();
}
async function saveWhatsappApiConfig(){
  const provider='baileys';
  const serviceName=($('whatsappServiceName')?.value||'baileys-main').trim()||'baileys-main';
  localStorage.femic_whatsapp_provider=provider;
  localStorage.femic_whatsapp_service_name=serviceName;
  try{
    const payload={whatsapp_provider:provider,whatsapp_service_name:serviceName,whatsapp_confirmation_hours_before:appointmentReminderHoursBefore()};
    if(settings.id) await api('schedule_settings?id=eq.'+settings.id,{method:'PATCH',body:JSON.stringify(payload)});
    else await api('schedule_settings',{method:'POST',body:JSON.stringify(Object.assign({start_time:settings.start_time||'08:00',end_time:settings.end_time||'20:00',working_days:settings.working_days||'1,2,3,4,5,6',working_periods:settings.working_periods||'08:00-12:00,16:00-20:00',max_patients_per_slot:Number(settings.max_patients_per_slot||4),slot_interval_minutes:Number(settings.slot_interval_minutes||30),whatsapp_template_appointment:settings.whatsapp_template_appointment||DEFAULT_WHATSAPP_REMINDER_TEMPLATE},payload))});
    settings.whatsapp_provider=provider;
    settings.whatsapp_service_name=serviceName;
    renderWhatsappProviderBadge();
    refreshWhatsappServiceStatus();
    toast('Bot Baileys salvo como canal automático do FEMIC.','success');
  }catch(e){
    toast(isMissingWhatsappSettingsSchemaError(e)?'Atualize o Supabase com o patch incremental de WhatsApp/Baileys antes de salvar esse provedor.':'Erro ao salvar configuração do WhatsApp: '+e.message,isMissingWhatsappSettingsSchemaError(e)?'warning':'error');
  }
}
function testWhatsappApiConfig(){
  refreshWhatsappServiceStatus();
  toast('Status do bot Baileys atualizado. Confira conexão, último envio e último erro no painel.','success');
}
function statusButtons(a){
  const id=String(a.id);
  return `<div class="status-actions">
    <button class="btn success status-mini" ${a.status==='concluido'?'disabled':''} onclick="quickStatus('${id}','concluido')">✓ Concluir</button>
    <button class="btn danger status-mini" ${a.status==='cancelado'?'disabled':''} onclick="quickStatus('${id}','cancelado')">✕ Cancelar</button>
  </div>`;
}
function renderReport(skipRefresh=false){const month=$('reportMonth').value||new Date().toISOString().slice(0,7);$('reportMonth').value=month;if(!skipRefresh)refreshReportMonthIfNeeded(month);const query=appointmentReportQuery(month);const source=loadedReportQuery===query?reportAppointments:appointments.filter(a=>String(a.appointment_date).startsWith(month));const servicesById=Object.create(null);const payersById=Object.create(null);let doneCount=0,cancelledCount=0,scheduledCount=0;const groups={};services.forEach(service=>{servicesById[String(service.id)]=service});payers.forEach(payer=>{payersById[String(payer.id)]=payer});source.forEach(a=>{if(a.status==='concluido'){doneCount++;const s=servicesById[String(a.service_id)]||{};const price=Number(a.service_price_at_time||s.price||0);const key=(s.health_insurance_id||'')+'|'+(s.id||'')+'|'+price;if(!groups[key])groups[key]={payer:(payersById[String(s.health_insurance_id)]||{}).name||'Particular',service:s.name||'Sem serviço',q:0,price};groups[key].q++;}else if(a.status==='cancelado'){cancelledCount++;}else if(a.status==='agendado'||a.status==='confirmado'){scheduledCount++;}});const rows=Object.values(groups),total=rows.reduce((a,r)=>a+r.q*r.price,0);$('reportKpis').innerHTML=`<div class="kpi"><div class="small muted">Concluídos</div><strong>${doneCount}</strong></div><div class="kpi"><div class="small muted">Total</div><strong>${brl(total)}</strong></div><div class="kpi"><div class="small muted">Cancelados</div><strong>${cancelledCount}</strong></div><div class="kpi"><div class="small muted">Agendados</div><strong>${scheduledCount}</strong></div>`;$('reportBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.payer)}</td><td>${esc(r.service)}</td><td>${r.q}</td><td>${brl(r.price)}</td><td><strong>${brl(r.q*r.price)}</strong></td></tr>`).join(''):'<tr><td colspan="5" class="muted">Sem atendimentos concluídos.</td></tr>'}
function exportCsv(){const rows=[['Pagador','Serviço','Quantidade','Valor','Total']];document.querySelectorAll('#reportBody tr').forEach(tr=>{const cells=[...tr.children].map(td=>td.innerText);if(cells.length===5)rows.push(cells)});const csv=rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='relatorio_agenda_femic.csv';a.click()}


function packagePatternSummary(p){
  try{
    if(!p || !Array.isArray(appointments)) return '';
    const packageId = String(p.id);
    if(packagePatternCache.has(packageId)) return packagePatternCache.get(packageId);
    const hasDirectLinks = appointments.some(a => String(a.session_package_id || '') === packageId);
    const related = appointments.filter(a => {
      if(String(a.patient_id) !== String(p.patient_id)) return false;
      if(a.status === 'cancelado') return false;
      if(hasDirectLinks) return String(a.session_package_id || '') === packageId;
      return String(a.service_id) === String(p.service_id);
    });
    if(!related.length){
      const emptyHtml=`<div class="package-pattern"><div class="package-pattern-title">🗓️ Padrão de agendamento</div><div class="package-pattern-note">Ainda não há agendamentos suficientes para identificar dias e horários deste pacote.</div></div>`;
      packagePatternCache.set(packageId,emptyHtml);
      return emptyHtml;
    }
    const weekdayFull = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const map = {};
    related.forEach(a => {
      const dateStr = a.appointment_date;
      const timeStr = normalizeTime(a.start_time || '');
      if(!dateStr || !timeStr) return;
      const d = new Date(String(dateStr) + 'T00:00:00');
      if(Number.isNaN(d.getTime())) return;
      const wd = d.getDay();
      const key = wd + '|' + timeStr;
      if(!map[key]) map[key] = { weekday: wd, time: timeStr, count: 0 };
      map[key].count += 1;
    });
    const items = Object.values(map).sort((a,b) => {
      if(a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.time.localeCompare(b.time);
    });
    if(!items.length){
      packagePatternCache.set(packageId,'');
      return '';
    }
    const chips = items.slice(0,8).map(x =>
      `<span class="package-pattern-chip">${weekdayFull[x.weekday]} · ${x.time} <span class="muted">${x.count}x</span></span>`
    ).join('');
    const extra = items.length > 8 ? `<div class="package-pattern-note">+ ${items.length - 8} outro(s) horário(s) menos frequente(s).</div>` : '';
    const note = items.length > 1 ? 'Use este resumo como apoio para renovação. Ele é calculado pelo histórico e não altera os agendamentos.' : 'Padrão calculado automaticamente pelo histórico deste pacote.';
    const html=`<div class="package-pattern"><div class="package-pattern-title">🗓️ Padrão de agendamento</div><div class="package-pattern-list">${chips}</div>${extra}<div class="package-pattern-note">${note}</div></div>`;
    packagePatternCache.set(packageId,html);
    return html;
  }catch(e){return '';}
}
function packageScheduleKey(p){return String(p?.patient_id||'')+'|'+String(p?.service_id||'')}
async function fetchPackageAppointments(p,force=false){
  const cacheKey=packageScheduleKey(p);
  if(!force&&packageScheduleCache.has(cacheKey))return packageScheduleCache.get(cacheKey);
  try{
    const query='appointments?select=*&patient_id=eq.'+encodeURIComponent(p.patient_id)+'&service_id=eq.'+encodeURIComponent(p.service_id)+'&order=appointment_date.asc,start_time.asc';
    const rows=await api(query)||[];
    packageScheduleCache.set(cacheKey,rows);
    return rows;
  }catch(e){
    console.warn('Falha ao buscar agenda completa do pacote:',e);
    const fallback=appointments.filter(a=>String(a.patient_id)===String(p.patient_id)&&String(a.service_id)===String(p.service_id));
    packageScheduleCache.set(cacheKey,fallback);
    return fallback;
  }
}
async function fetchAppointmentsForDate(dateStr){
  if(dayAppointmentCache.has(dateStr))return dayAppointmentCache.get(dateStr);
  const rows=await api('appointments?select=*&appointment_date=eq.'+encodeURIComponent(dateStr)+'&order=start_time.asc')||[];
  dayAppointmentCache.set(dateStr,rows);
  return rows;
}
async function fetchAppointmentsForRange(fromDate,toDate){
  try{
    if(!base()||!key()||!sessionStorage.getItem('femic_jwt'))throw new Error('Sem conexão ativa.');
    return await api('appointments?select=*&appointment_date=gte.'+encodeURIComponent(fromDate)+'&appointment_date=lte.'+encodeURIComponent(toDate)+'&order=appointment_date.asc,start_time.asc')||[];
  }catch(e){
    return appointments.filter(a=>String(a.appointment_date||'')>=String(fromDate)&&String(a.appointment_date||'')<=String(toDate));
  }
}
function isFutureScheduledAppointment(a){return ['agendado','confirmado'].includes(a.status)&&String(a.appointment_date||'')>=todayIso()}
function compareAppointmentAsc(a,b){return String(a.appointment_date||'').localeCompare(String(b.appointment_date||''))||normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))}
function addDaysIso(dateStr,days){const d=new Date(String(dateStr)+'T00:00:00');d.setDate(d.getDate()+Number(days||0));return isoDate(d)}
function packageScheduleStats(p,list){
  const total=Number(p.total_sessions||0),remain=Number(p.remaining_sessions||0);
  const related=(list||[]).filter(a=>String(a.patient_id)===String(p.patient_id)&&String(a.service_id)===String(p.service_id));
  const futures=related.filter(isFutureScheduledAppointment).sort(compareAppointmentAsc);
  const valid=related.filter(a=>a.status!=='cancelado').sort(compareAppointmentAsc);
  const lastFuture=futures[futures.length-1]||null;
  const lastAny=valid[valid.length-1]||null;
  return {total,remain,used:Math.max(0,total-remain),futures,futureCount:futures.length,lastFuture,lastAny,toSchedule:Math.max(0,remain-futures.length),alert:remain>0&&futures.length<=1};
}
function clinicalUtils(){return window.FEMICClinicalUtils||null}
function appointmentPackageAlertMeta(appointment,cache){
  if(!appointment)return {show:false,text:''};
  const key=String(appointment.patient_id||'')+'::'+String(appointment.service_id||'');
  cache=cache||Object.create(null);
  if(!cache[key]){
    const pkg=activePackageForService(appointment.patient_id,appointment.service_id);
    cache[key]={stats:pkg?packageScheduleStats(pkg,appointments):null};
  }
  const stats=cache[key].stats;
  const utils=clinicalUtils();
  const show=utils&&typeof utils.shouldShowAppointmentPackageAlert==='function'
    ? utils.shouldShowAppointmentPackageAlert(appointment,stats)
    : !!(stats&&stats.alert&&stats.lastFuture&&String(stats.lastFuture.id||'')===String(appointment.id||''));
  const text=utils&&typeof utils.packageAlertCopy==='function' ? utils.packageAlertCopy(stats) : (stats&&stats.alert?(stats.futureCount?'Última sessão futura do pacote':'Saldo sem agenda suficiente'):'');
  return {show,text};
}
function packageScheduleLine(a){
  if(!a)return 'Sem futuras marcadas';
  return fmtWeekday(a.appointment_date)+' · '+fmtDate(a.appointment_date)+' · '+normalizeTime(a.start_time);
}
function packageScheduleSummaryHtml(p,list){
  const st=packageScheduleStats(p,list);
  const cls=st.alert?'package-schedule-alert':'package-schedule-ok';
  const alertText=st.alert?(st.futureCount?'Última sessão futura':'Sem futuras marcadas'):'Agenda suficiente para o saldo atual';
  const action=st.toSchedule>0&&p.active!==false?`<button class="btn ghost package-plan-btn" onclick="planPackageRecurrence('${p.id}')">Planejar recorrência</button>`:'';
  return `<div class="package-schedule ${cls}"><div><strong>${esc(alertText)}</strong><span>${esc(packageScheduleLine(st.lastFuture))} · futuras ${st.futureCount} · faltam agendar ${st.toSchedule}</span></div>${action}</div>`;
}
async function hydratePackageScheduleSummaries(){
  const nodes=[...document.querySelectorAll('[data-package-schedule-id]')];
  if(!nodes.length)return;
  const queue=nodes.slice();
  async function worker(){
    while(queue.length){
      const node=queue.shift();
      const p=packages.find(x=>String(x.id)===String(node.dataset.packageScheduleId));
      if(!p)continue;
      const rows=await fetchPackageAppointments(p);
      if(node.isConnected)node.innerHTML=packageScheduleSummaryHtml(p,rows);
    }
  }
  await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));
}
function inferRecentPackagePattern(list){
  const recent=(list||[]).filter(a=>a.status!=='cancelado'&&a.appointment_date&&a.start_time).sort((a,b)=>-compareAppointmentAsc(a,b)).slice(0,10);
  const seen=new Set(),items=[];
  recent.forEach(a=>{
    const wd=dateDay(a.appointment_date),time=normalizeTime(a.start_time),key=wd+'|'+time;
    if(seen.has(key))return;
    seen.add(key);
    items.push({weekday:wd,time});
  });
  return items.sort((a,b)=>(a.weekday-b.weekday)||a.time.localeCompare(b.time));
}
function fillRecurringFromPackage(p,count,pattern,startDate){
  openAppt(startDate||todayIso(),null,pattern[0]?.time||((parsePeriods()[0]||{}).start)||settings.start_time||'08:00');
  $('apptPatient').value=p.patient_id;
  $('apptService').value=p.service_id;
  $('apptStatus').value='agendado';
  $('recurring').checked=true;
  $('recCount').value=String(Math.max(1,count||1));
  toggleRecurrence();
  pattern.forEach(item=>{
    const ch=$('recCard'+item.weekday)?.querySelector('.recDay'),time=$('recTime'+item.weekday);
    if(ch)ch.checked=true;
    if(time)time.value=item.time;
    toggleRecDayCard(item.weekday);
  });
  syncPatientPickers();
  onServiceChange(true);
}
async function planPackageRecurrence(id){
  const p=packages.find(x=>String(x.id)===String(id));
  if(!p){toast('Pacote não encontrado.','warning');return}
  try{
    toast('Preparando recorrência do pacote...','info');
    const rows=await fetchPackageAppointments(p,true);
    const st=packageScheduleStats(p,rows);
    const pattern=inferRecentPackagePattern(rows);
    const startBase=st.lastFuture?addDaysIso(st.lastFuture.appointment_date,1):(st.lastAny?addDaysIso(st.lastAny.appointment_date,1):todayIso());
    const startDate=String(startBase)<todayIso()?todayIso():startBase;
    fillRecurringFromPackage(p,Math.max(1,st.toSchedule||st.remain||1),pattern,startDate);
    if(pattern.length)toast('Recorrência preparada pelo padrão recente. Revise e salve.','success');
    else toast('Recorrência aberta. Escolha os dias ou use o assistente de recorrência.','warning');
  }catch(e){
    toast('Erro ao preparar recorrência: '+e.message,'error');
  }
}
function patientCard(p,linkedSet){const linked=linkedSet?linkedSet.has(String(p.id)):(appointments.some(a=>String(a.patient_id)===String(p.id))||packages.some(pk=>String(pk.patient_id)===String(p.id))||movements.some(m=>String(m.patient_id)===String(p.id)));const archived=p.archived===true;const meta=[p.whatsapp||'Sem WhatsApp',p.birth_date?fmtDate(p.birth_date):'',p.referral_source||'',p.pathology||'Sem patologia'].filter(Boolean).join(' · ');return `<div class="item patient-card ${archived?'archived':''}"><div class="item-top"><div><strong>${esc(p.name||'Sem nome')}</strong>${archived?' <span class="muted small">(inativo)</span>':''}<div class="muted small">${esc(meta)}</div></div><div class="toolbar"><button class="btn" onclick="openPatient('${p.id}')">Ficha</button><button class="btn ghost" onclick="openEditPatient('${p.id}')">✏️ Editar</button>${archived?`<button class="btn success" onclick="reactivatePatient('${p.id}')">Reativar</button>`:`<button class="btn warning" onclick="archivePatient('${p.id}')">Inativar</button>`}<button class="btn danger" onclick="deletePatientSafe('${p.id}')">Apagar</button></div></div>${linked?'<div class="muted small" style="margin-top:8px">Possui vínculo: apagar será bloqueado; use inativar.</div>':''}</div>`}
function formatWhatsappInput(input){let v=input.value.replace(/\D/g,'').slice(0,11);if(v.length>6)input.value=`(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;else if(v.length>2)input.value=`(${v.slice(0,2)}) ${v.slice(2)}`;else if(v.length>0)input.value=`(${v}`;}
function makePatientId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function isMissingPatientSchemaError(error){return /birth_date|referral_source|column .* does not exist/i.test(String(error&&error.message||error||''))}
async function savePatient(){const name=$('newPatientName').value.trim();const whatsapp=$('newPatientWhatsapp').value.trim();const birthDate=$('newPatientBirthDate')?$('newPatientBirthDate').value:'';const referralSource=$('newPatientReferralSource')?$('newPatientReferralSource').value.trim():'';const pathology=$('newPatientPathology').value.trim();if(!name){toast('Informe o nome do paciente.','warning');return}if(!/^\(\d{2}\)\s\d{5}-\d{4}$/.test(whatsapp)){toast('Digite o WhatsApp no formato (99) 99999-9999.','warning');return}const phone=cleanPhone(whatsapp);const dup=patients.find(p=>p.archived!==true&&(cleanPhone(p.whatsapp)===phone||String(p.name||'').trim().toLowerCase()===name.toLowerCase()));if(dup&&!confirm('Já existe paciente com nome ou WhatsApp parecido. Deseja cadastrar mesmo assim?'))return;const payload={id:makePatientId(),name,pathology,whatsapp,birth_date:birthDate||null,referral_source:referralSource,archived:false,archived_at:null};try{await api('patients',{method:'POST',body:JSON.stringify(payload)});$('newPatientName').value='';$('newPatientWhatsapp').value='';if($('newPatientBirthDate'))$('newPatientBirthDate').value='';if($('newPatientReferralSource'))$('newPatientReferralSource').value='';$('newPatientPathology').value='';await loadAll(true);toast('Paciente salvo no Supabase e disponível na agenda.','success')}catch(e){toast(isMissingPatientSchemaError(e)?'Atualize o Supabase com o patch incremental de patients antes de usar data de nascimento e origem do paciente.':'Erro ao salvar paciente: '+e.message,isMissingPatientSchemaError(e)?'warning':'error')}}
async function archivePatient(id){if(!confirm('Inativar este paciente? Ele sairá das listas de novo agendamento, mas o histórico será preservado.'))return;try{await api('patients?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({archived:true,archived_at:new Date().toISOString()})});await loadAll(true);toast('Paciente inativado.','success')}catch(e){toast('Erro ao inativar: '+e.message,'error')}}
async function reactivatePatient(id){try{await api('patients?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({archived:false,archived_at:null})});await loadAll(true);toast('Paciente reativado.','success')}catch(e){toast('Erro ao reativar: '+e.message,'error')}}
async function deletePatientSafe(id){const linked=appointments.some(a=>String(a.patient_id)===String(id))||packages.some(p=>String(p.patient_id)===String(id))||movements.some(m=>String(m.patient_id)===String(id));if(linked){toast('Paciente possui vínculos. Não apaguei; use Inativar para preservar histórico.','warning');return}if(!confirm('Apagar este paciente definitivamente? Só faça isso para cadastro criado por engano.'))return;try{await api('patients?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await loadAll(true);toast('Paciente apagado.','success')}catch(e){toast('Erro ao apagar: '+e.message,'error')}}
async function savePayer(){const name=$('payerName').value.trim();if(!name)return;try{await api('health_insurances',{method:'POST',body:JSON.stringify({name,active:true})});$('payerName').value='';await loadAll(true);toast('Pagador salvo.','success')}catch(e){toast('Erro: '+e.message,'error')}}async function saveService(){const name=$('svcName').value.trim();const price=Number(String($('svcPrice').value||0).replace(',','.'));if(!name){toast('Informe o nome do serviço.','warning');return}if(!Number.isFinite(price)||price<0){toast('Informe um valor válido para o serviço.','warning');return}try{if(editingServiceId){await api('services?id=eq.'+editingServiceId,{method:'PATCH',body:JSON.stringify({name:name,price:price})});cancelServiceEdit(false);await loadAll(true);toast('Serviço atualizado.','success');return}const payload={name:name,health_insurance_id:$('svcPayer').value||null,price:price,duration_minutes:Number($('svcDur').value||45),appointment_mode:$('svcMode').value,max_patients:Number($('svcMax').value||4),type:$('svcMode').value==='individual'?'particular':'convenio',active:true};await api('services',{method:'POST',body:JSON.stringify(payload)});$('svcName').value='';$('svcPrice').value='';await loadAll(true);toast('Serviço salvo.','success')}catch(e){toast('Erro: '+e.message,'error')}}async function savePackage(){
  const patientId = $('pkgPatient').value;
  const serviceId = $('pkgService').value;
  const total = Number($('pkgTotal').value||0);
  const remainRaw = $('pkgRemain').value;
  const remaining = remainRaw === '' ? total : Number(remainRaw||0);

  if(!patientId){
    toast('Selecione um paciente antes de salvar o pacote.','warning');
    focusPatientPicker('pkgPatient');
    return;
  }
  if(!serviceId){
    toast('Selecione um serviço antes de salvar o pacote.','warning');
    $('pkgService').focus();
    return;
  }
  if(!total || total <= 0){
    toast('Informe o total de sessões do pacote.','warning');
    $('pkgTotal').focus();
    return;
  }
  if(remaining < 0 || remaining > total){
    toast('O saldo inicial deve ficar entre 0 e o total de sessões.','warning');
    $('pkgRemain').focus();
    return;
  }

  const patient = patientById(patientId);
  const service = serviceById(serviceId);
  const used = total - remaining;
  const msg = `Confirmar criação do pacote?\n\nPaciente: ${patient.name || '-'}\nServiço: ${service.name || '-'}\nTotal: ${total} sessões\nUsadas: ${used}/${total}\nSaldo inicial: ${remaining}`;
  if(!confirm(msg)) return;

  const payload={patient_id:patientId,service_id:serviceId,total_sessions:total,remaining_sessions:remaining,active:true,...packageEndedAtPatchValue(null)};
  try{
    await api('session_packages',{method:'POST',body:JSON.stringify(payload)});
    $('pkgPatient').value='';
    $('pkgService').value='';
    $('pkgTotal').value='';
    $('pkgRemain').value='';
    syncPatientPickers();
    await loadAll(true);
    toast('Pacote salvo.','success');
  }catch(e){
    toast('Erro: '+e.message,'error');
  }
}function renderSlotsConfig(){
  const step=Number($('setInterval')?.value||30);
  const start=$('setSlotStart')?.value||'08:00';
  const end=$('setSlotEnd')?.value||'20:00';
  const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const days=String(settings.working_days||'1,2,3,4,5').split(',');
  let m=timeToMin(start),endMin=timeToMin(end);
  const slots=[];
  while(m<endMin){slots.push(minToTime(m));m+=step}
  const slotsConfig=settings.slots_config||{};
  let html='';
  days.forEach(d=>{
    const dayNum=Number(d);
    const enabled=slotsConfig[dayNum]||[];
    html+=`<div class="slots-day-row"><strong class="slots-day-label">${names[dayNum]}</strong><div class="slots-day-grid">`;
    slots.forEach(s=>{
      const active=enabled.includes(s);
      html+=`<label class="slot-toggle ${active?'active':''}"><input type="checkbox" data-day="${dayNum}" data-time="${s}" ${active?'checked':''} onchange="this.parentElement.classList.toggle('active')">${s}</label>`;
    });
    html+=`</div></div>`;
  });
  const grid=$('slotsConfigGrid');
  if(grid) grid.innerHTML=html;
}
async function saveSettings(){
  const working=[...document.querySelectorAll('.wd:checked')].map(x=>x.value).join(',')||'1,2,3,4,5,6';
  const step=Number($('setInterval')?.value||30);
  const start=$('setSlotStart')?.value||'08:00';
  const end=$('setSlotEnd')?.value||'20:00';
  const slotsConfig={};
  document.querySelectorAll('#slotsConfigGrid input[type=checkbox]').forEach(cb=>{
    if(cb.checked){
      const day=cb.dataset.day;
      const time=cb.dataset.time;
      if(!slotsConfig[day]) slotsConfig[day]=[];
      slotsConfig[day].push(time);
    }
  });
  const payload={
    start_time:start,
    end_time:end,
    working_periods:'',
    slot_interval_minutes:step,
    working_days:working,
    max_patients_per_slot:Number(settings.max_patients_per_slot||4),
    slots_config:slotsConfig
  };
  try{
    if(settings.id) await api('schedule_settings?id=eq.'+settings.id,{method:'PATCH',body:JSON.stringify(payload)});
    else await api('schedule_settings',{method:'POST',body:JSON.stringify(payload)});
    await loadAll(true);
    toast('Expediente salvo.','success')
  }catch(e){
    toast('Erro: '+e.message,'error')
  }
}async function removePackage(id){const p=packages.find(x=>String(x.id)===String(id));if(!p)return;const used=Number(p.total_sessions||0)-Number(p.remaining_sessions||0);const linked=appointments.some(a=>String(a.session_package_id)===String(id))||movements.some(m=>String(m.session_package_id)===String(id));if(used>0||linked){if(confirm('Este pacote já tem uso ou vínculo no histórico. Para preservar os dados, ele será inativado em vez de apagado. Continuar?')){await api('session_packages?id=eq.'+id,{method:'PATCH',body:JSON.stringify({active:false,...packageEndedAtPatchValue(p.ended_at||new Date().toISOString())})});await loadAll(true);toast('Pacote inativado.','success')}return}if(confirm('Remover este pacote definitivamente?')){await api('session_packages?id=eq.'+id,{method:'DELETE'});await loadAll(true);toast('Pacote removido.','success')}}async function removeService(id){if(appointments.some(a=>String(a.service_id)===String(id))||packages.some(p=>String(p.service_id)===String(id))){toast('Serviço em uso. Não removi para preservar histórico.','warning');return}if(confirm('Remover serviço?')){await api('services?id=eq.'+id,{method:'DELETE'});await loadAll(true)}}async function removePayer(id){if(services.some(s=>String(s.health_insurance_id)===String(id))){toast('Pagador vinculado a serviço. Remova/inative serviços primeiro.','warning');return}if(confirm('Remover pagador?')){await api('health_insurances?id=eq.'+id,{method:'DELETE'});await loadAll(true)}}

function renderBackupPanel(){
  if($('bkPatients')) $('bkPatients').textContent = patients.length;
  if($('bkAppointments')) $('bkAppointments').textContent = appointments.length;
  if($('bkPackages')) $('bkPackages').textContent = packages.length;
  if($('bkMovements')) $('bkMovements').textContent = movements.length;
  if($('bkServices')) $('bkServices').textContent = services.length;
  if($('bkPayers')) $('bkPayers').textContent = payers.length;
  if($('bkClinicRules')) $('bkClinicRules').textContent = clinicRules.length;
}

function downloadJsonFile(filename, payload){
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchTableForBackup(table){
  return await api(table + '?select=*');
}
async function fetchOptionalTableForBackup(table, missingCheck){
  try{return await fetchTableForBackup(table)}catch(e){if(missingCheck&&missingCheck(e))return[];throw e}
}

function startServiceEdit(id){
  const service = services.find(s => String(s.id) === String(id));
  if(!service) return;
  editingServiceId = String(id);
  if($('svcName')) $('svcName').value = service.name || '';
  if($('svcPrice')) $('svcPrice').value = Number(service.price || 0);
  if($('svcPayer')) $('svcPayer').value = service.health_insurance_id || '';
  if($('svcDur')) $('svcDur').value = String(service.duration_minutes || 45);
  if($('svcMode')) $('svcMode').value = service.appointment_mode || 'grupo';
  if($('svcMax')) $('svcMax').value = Number(service.max_patients || 4);
  ['svcPayer','svcDur','svcMode','svcMax'].forEach(idName => { if($(idName)) $(idName).disabled = true; });
  if($('saveServiceBtn')) $('saveServiceBtn').textContent = 'Salvar edição';
  if($('cancelServiceEditBtn')) $('cancelServiceEditBtn').style.display = 'inline-flex';
  if($('svcName')) $('svcName').focus();
  toast('Editando nome e valor do serviço. Duração e modo ficam preservados.', 'info');
}

function cancelServiceEdit(clearFields=true){
  editingServiceId = '';
  ['svcPayer','svcDur','svcMode','svcMax'].forEach(idName => { if($(idName)) $(idName).disabled = false; });
  if($('saveServiceBtn')) $('saveServiceBtn').textContent = 'Adicionar serviço';
  if($('cancelServiceEditBtn')) $('cancelServiceEditBtn').style.display = 'none';
  if(clearFields){
    ['svcName','svcPrice'].forEach(idName => { if($(idName)) $(idName).value = ''; });
  }
}

async function exportAgendaBackup(){
  if(!base() || !key()){
    toast('Preencha URL e anon key antes de exportar.', 'warning');
    return;
  }
  try{
    toast('Preparando backup...', 'info');
    const data = {
      app: 'FEMIC Agenda',
      version: 'v1.4.28-valor-editavel-confiavel',
      exported_at: new Date().toISOString(),
      note: 'Backup completo da agenda FEMIC. Contém pacientes, agenda, pacotes, histórico, serviços, pagadores, configurações e regras da clínica.',
      tables: {
        patients: await fetchTableForBackup('patients'),
        health_insurances: await fetchTableForBackup('health_insurances'),
        services: await fetchTableForBackup('services'),
        schedule_settings: await fetchTableForBackup('schedule_settings'),
        clinic_rules: await loadClinicRulesCollection(),
        schedule_blocks: await fetchOptionalTableForBackup('schedule_blocks', isMissingScheduleBlocksTableError),
        session_packages: await fetchTableForBackup('session_packages'),
        appointments: await fetchTableForBackup('appointments'),
        session_movements: await fetchTableForBackup('session_movements')
      }
    };
    const stamp = localIsoDate(new Date()).replaceAll('-', '');
    downloadJsonFile('femic_agenda_backup_' + stamp + '.json', data);
    toast('Backup exportado com sucesso.', 'success');
  }catch(e){
    console.error(e);
    toast('Erro ao exportar backup: ' + e.message, 'error');
  }
}

async function deleteAllRows(table){
  // Exige filtro no Supabase REST. Todas as tabelas da agenda têm id.
  return await api(table + '?id=not.is.null', {method:'DELETE'});
}

async function upsertRows(table, rows){
  if(!Array.isArray(rows) || !rows.length) return [];
  const res = await fetch(base() + '/rest/v1/' + table + '?on_conflict=id', {
    method:'POST',
    headers:Object.assign({}, headers(), {Prefer:'resolution=merge-duplicates,return=representation'}),
    body: JSON.stringify(rows)
  });
  const txt = await res.text();
  let data; try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
  if(!res.ok){
    console.error('Restore error', table, res.status, data);
    throw new Error((data && data.message) || txt || ('Erro ao restaurar ' + table));
  }
  return data || [];
}

async function restoreAgendaBackup(event){
  const file = event.target.files && event.target.files[0];
  if(!file) return;
  if(!base() || !key()){
    toast('Preencha URL e anon key antes de restaurar.', 'warning');
    event.target.value = '';
    return;
  }
  try{
    const text = await file.text();
    const backup = JSON.parse(text);
    const tables = backup.tables || backup;
    const required = ['patients','health_insurances','services','schedule_settings','session_packages','appointments','session_movements'];
    const missing = required.filter(k => !Array.isArray(tables[k]));
    if(missing.length){
      throw new Error('Arquivo inválido. Faltam tabelas: ' + missing.join(', '));
    }

    const ok = confirm(
      'Restaurar backup da Agenda FEMIC?\n\n' +
      'Isto vai substituir agendamentos, pacotes, serviços, pagadores, histórico e configurações da agenda.\n' +
      'Pacientes do arquivo serão inseridos/atualizados, mas pacientes existentes não serão apagados.\n\n' +
      'Confirma a restauração?'
    );
    if(!ok){ event.target.value=''; return; }

    toast('Restaurando backup...', 'info');

    // Apaga somente tabelas operacionais da agenda, em ordem segura.
    await deleteAllRows('session_movements');
    await deleteAllRows('appointments');
    await deleteAllRows('session_packages');
    await deleteAllRows('services');
    await deleteAllRows('health_insurances');
    await deleteAllRows('schedule_settings');
    try{await deleteAllRows('clinic_rules')}catch(e){if(!isMissingClinicRulesTableError(e))throw e}
    try{await deleteAllRows('schedule_blocks')}catch(e){if(!isMissingScheduleBlocksTableError(e))throw e}

    // Pacientes: upsert seguro, sem apagar pacientes externos.
    await upsertRows('patients', tables.patients);
    await upsertRows('health_insurances', tables.health_insurances);
    await upsertRows('services', tables.services);
    await upsertRows('schedule_settings', tables.schedule_settings);
    if(Array.isArray(tables.clinic_rules)){
      writeClinicRulesCache(tables.clinic_rules);
      try{await upsertRows('clinic_rules', tables.clinic_rules)}catch(e){if(!isMissingClinicRulesTableError(e))throw e}
    }else{
      writeClinicRulesCache([]);
    }
    if(Array.isArray(tables.schedule_blocks)){
      try{await upsertRows('schedule_blocks', tables.schedule_blocks)}catch(e){if(!isMissingScheduleBlocksTableError(e))throw e}
    }

    // Valida integridade referencial antes do upsert
    const validPatientIds = new Set((tables.patients||[]).map(p=>String(p.id)));
    const validServiceIds = new Set((tables.services||[]).map(s=>String(s.id)));

    // Pacotes: registra órfãos e restaura apenas os válidos, um a um
    const orphanPackages = [];
    const cleanPackages = [];
    (tables.session_packages||[]).forEach(pkg=>{
      if(validPatientIds.has(String(pkg.patient_id)) && (!pkg.service_id || validServiceIds.has(String(pkg.service_id)))){
        cleanPackages.push(pkg);
      }else{
        orphanPackages.push(pkg);
      }
    });
    if(orphanPackages.length){
      console.warn('Ignorando '+orphanPackages.length+' pacote(s) órfão(s) no restore:', orphanPackages.map(p=>{return{id:p.id,patient_id:p.patient_id,service_id:p.service_id}}));
    }
    // Upsert individual para evitar que um único erro de FK derrube o lote
    const restoredPkgIds = new Set();
    for(const pkg of cleanPackages){
      try{
        await upsertRows('session_packages', [pkg]);
        restoredPkgIds.add(String(pkg.id));
      }catch(e){
        console.warn('Falha ao restaurar pacote '+pkg.id+': '+e.message, pkg);
      }
    }

    const orphanAppts = [];
    const cleanAppts = [];
    (tables.appointments||[]).forEach(a=>{
      const ok = validPatientIds.has(String(a.patient_id)) && (!a.service_id || validServiceIds.has(String(a.service_id))) && (!a.session_package_id || restoredPkgIds.has(String(a.session_package_id)));
      if(ok) cleanAppts.push(a);
      else orphanAppts.push(a);
    });
    if(orphanAppts.length){
      console.warn('Ignorando '+orphanAppts.length+' agendamento(s) órfão(s) no restore.');
    }
    const restoredApptIds = new Set();
    for(const a of cleanAppts){
      try{
        const r = await upsertRows('appointments', [a]);
        if(r&&r[0]) restoredApptIds.add(String(r[0].id));
        else if(a.id) restoredApptIds.add(String(a.id));
      }catch(e){
        console.warn('Falha ao restaurar agendamento '+a.id+': '+e.message, a);
      }
    }

    const orphanMoves = [];
    for(const m of (tables.session_movements||[])){
      const ok = validPatientIds.has(String(m.patient_id)) && (!m.appointment_id || restoredApptIds.has(String(m.appointment_id))) && (!m.session_package_id || restoredPkgIds.has(String(m.session_package_id)));
      if(ok){
        try{
          await upsertRows('session_movements', [m]);
        }catch(e){
          console.warn('Falha ao restaurar movimento '+m.id+': '+e.message, m);
        }
      }else{
        orphanMoves.push(m);
      }
    }
    if(orphanMoves.length){
      console.warn('Ignorando '+orphanMoves.length+' movimento(s) órfão(s) no restore.');
    }

    await loadAll(true);
    toast('Backup restaurado com sucesso.', 'success');
  }catch(e){
    console.error(e);
    toast('Erro ao restaurar backup: ' + e.message, 'error');
  }finally{
    event.target.value = '';
  }
}

async function sendReminderNow(appointmentId){
  try{
    const patch = {
      appointment_reminder_sent: false,
      reminder_sent: false,
      appointment_reminder_sent_at: null,
      reminder_sent_at: null,
      appointment_reminder_delivery_status: null,
      appointment_reminder_error_message: null,
      appointment_reminder_last_attempt_at: new Date(Date.now() - 86400000).toISOString()
    };
    await api('appointments?id=eq.' + appointmentId, {method:'PATCH', body: JSON.stringify(patch)});
    const a = appointments.find(x => String(x.id) === String(appointmentId));
    if(a){
      Object.assign(a, patch);
    }
    renderReminders();
    toast('Lembrete redefinido. O bot Baileys enviará em instantes.','success');
  }catch(e){
    toast('Erro: '+e.message,'error');
  }
}
async function saveTemplates(){const template=($('tplReminder')?.value||'').trim()||DEFAULT_WHATSAPP_REMINDER_TEMPLATE;localStorage.femic_tpl_reminder=template;try{const payload={whatsapp_template_appointment:template};if(settings.id)await api('schedule_settings?id=eq.'+settings.id,{method:'PATCH',body:JSON.stringify(payload)});else await api('schedule_settings',{method:'POST',body:JSON.stringify({start_time:settings.start_time||'08:00',end_time:settings.end_time||'20:00',working_days:settings.working_days||'1,2,3,4,5,6',working_periods:settings.working_periods||'08:00-12:00,16:00-20:00',max_patients_per_slot:Number(settings.max_patients_per_slot||4),slot_interval_minutes:Number(settings.slot_interval_minutes||30),whatsapp_provider:'baileys',whatsapp_template_appointment:template,whatsapp_confirmation_hours_before:appointmentReminderHoursBefore(),whatsapp_service_name:settings.whatsapp_service_name||'baileys-main'})});settings.whatsapp_template_appointment=template;toast('Modelo salvo.','success')}catch(e){toast(isMissingWhatsappSettingsSchemaError(e)?'Atualize o Supabase com o patch incremental de WhatsApp/Baileys antes de salvar o modelo.':'Erro ao salvar modelo: '+e.message,isMissingWhatsappSettingsSchemaError(e)?'warning':'error')}}async function copySql(){const ok=confirm('Este SQL faz RESET COMPLETO e apaga tabelas operacionais antes de recriar a estrutura. Use apenas em banco vazio ou depois de backup JSON. Deseja copiar mesmo assim?');if(!ok)return;await navigator.clipboard.writeText(SQL_SCHEMA);toast('SQL destrutivo copiado.','warning')}
$('sqlBox').textContent=SQL_SCHEMA;loadConfig();checkFemicAuth();$('dayDate').value=todayIso();$('reminderDate').value=isoDate(new Date(Date.now()+86400000));$('reportMonth').value=new Date().toISOString().slice(0,7);
/* =========================================================
   FEMIC Agenda v1.4.36 - Ficha com dia da semana — Correção robusta de consumo de pacote
   - Concluído consome pacote mesmo se o status já estiver concluído
   - Usa pacote do mesmo serviço; se não achar, usa pacote único ativo do paciente
   - Estorna ao sair de concluído
   ========================================================= */

function findPackageForAppointment(a){
  const active = packages.filter(p =>
    String(p.patient_id) === String(a.patient_id) &&
    p.active !== false &&
    Number(p.remaining_sessions || 0) > 0
  );

  const exact = active.find(p => String(p.service_id) === String(a.service_id));
  if(exact) return exact;

  if(active.length === 1) return active[0];

  return null;
}

async function handlePackageMovement(oldA,newA){
  if(!newA) return;

  const oldWasDone = oldA && oldA.status === 'concluido';
  const newIsDone = newA.status === 'concluido';

  if(oldWasDone && oldA.package_consumed && !newIsDone){
    await refundPackage(oldA);
    return;
  }

  if(newIsDone && !newA.package_consumed){
    await consumePackage(newA);
  }
}

async function consumePackage(a){
  const pk = findPackageForAppointment(a);

  if(!pk){
    toast('Atendimento concluído, mas nenhum pacote ativo compatível foi encontrado para este paciente.','warning');
    return false;
  }

  const remaining = Number(pk.remaining_sessions || 0);

  if(remaining <= 0){
    toast('Atendimento concluído, mas o pacote está sem saldo.','warning');
    return false;
  }

  const nextRemaining=remaining-1;
  const shouldClosePackage=nextRemaining<=0;

  await api('session_packages?id=eq.' + pk.id, {
    method:'PATCH',
    body: JSON.stringify({
      remaining_sessions: nextRemaining,
      active: shouldClosePackage ? false : pk.active!==false,
      ...packageEndedAtPatchValue(shouldClosePackage ? new Date().toISOString() : null)
    })
  });

  await api('appointments?id=eq.' + a.id, {
    method:'PATCH',
    body: JSON.stringify({
      package_consumed: true,
      session_package_id: pk.id
    })
  });

  await api('session_movements', {
    method:'POST',
    body: JSON.stringify({
      patient_id: a.patient_id,
      appointment_id: a.id,
      session_package_id: pk.id,
      type: 'consumo',
      quantity: -1
    })
  });

  return true;
}

async function refundPackage(a){
  let pk = null;

  if(a.session_package_id){
    pk = packages.find(p => String(p.id) === String(a.session_package_id));
  }

  if(!pk){
    pk = findPackageForAppointment(a);
  }

  if(pk){
    const nextRemaining=Number(pk.remaining_sessions || 0) + 1;
    await api('session_packages?id=eq.' + pk.id, {
      method:'PATCH',
      body: JSON.stringify({
        remaining_sessions: nextRemaining,
        active: true,
        ...packageEndedAtPatchValue(null)
      })
    });

    await api('session_movements', {
      method:'POST',
      body: JSON.stringify({
        patient_id: a.patient_id,
        appointment_id: a.id,
        session_package_id: pk.id,
        type: 'estorno',
        quantity: 1
      })
    });
  }

  await api('appointments?id=eq.' + a.id, {
    method:'PATCH',
    body: JSON.stringify({
      package_consumed: false,
      session_package_id: null
    })
  });

  return true;
}

async function quickStatus(id,newStatus){
  const old = appointments.find(a => String(a.id) === String(id));
  if(!old) return;

  const label = {agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[newStatus] || newStatus;

  if(old.status === newStatus){
    if(newStatus === 'concluido' && !old.package_consumed){
      if(!confirm('Este atendimento já está concluído, mas o pacote ainda não foi consumido. Corrigir agora?')) return;
      try{
        await consumePackage(old);
        await loadAll(true);
        toast('Pacote corrigido para este atendimento.','success');
      }catch(e){
        console.error(e);
        toast('Erro ao corrigir pacote: ' + e.message, 'error');
      }
    }else{
      toast('Este agendamento já está com esse status.','info');
    }
    return;
  }

  if(!confirm('Alterar status para ' + label + '?')) return;

  try{
    const updated = (await api('appointments?id=eq.' + id, {
      method:'PATCH',
      body: JSON.stringify({status:newStatus})
    }))[0] || {...old,status:newStatus};

    await handlePackageMovement(old, updated);
    await loadAll(true);

    if(newStatus === 'concluido'){
      // Sinalizar para o sistema clínico (index.html) que há evolução técnica pendente
      try{
        const pending = JSON.parse(localStorage.getItem('femic_pending_evolutions') || '[]');
        const already = pending.some(x => x.appointment_id === String(id));
        if(!already){
          pending.push({
            patient_id: String(old.patient_id),
            appointment_id: String(id),
            appointment_date: old.appointment_date,
            flagged_at: new Date().toISOString()
          });
          localStorage.setItem('femic_pending_evolutions', JSON.stringify(pending));
        }
      }catch(e){ console.warn('Erro ao gravar pending evolution:', e); }
      toast('Status atualizado e pacote processado.','success');
    }else{
      // Se voltou de concluído, remove o pending
      if(old.status === 'concluido'){
        try{
          const pending = JSON.parse(localStorage.getItem('femic_pending_evolutions') || '[]');
          localStorage.setItem('femic_pending_evolutions', JSON.stringify(pending.filter(x => x.appointment_id !== String(id))));
        }catch(e){}
      }
      toast('Status atualizado para ' + label + '.','success');
    }
  }catch(e){
    console.error(e);
    toast('Erro ao alterar status: ' + e.message, 'error');
  }
}

/* ============================================================
   EDITAR PACIENTE
   ============================================================ */
function openEditPatient(pid){
  const p = patientById(pid);
  if(!p){ toast('Paciente não encontrado.','error'); return; }
  $('editPatientId').value = pid;
  $('editPatientName').value = p.name || '';
  $('editPatientWhatsapp').value = p.whatsapp || '';
  if($('editPatientBirthDate')) $('editPatientBirthDate').value = String(p.birth_date || '').slice(0,10);
  if($('editPatientReferralSource')) $('editPatientReferralSource').value = p.referral_source || '';
  $('editPatientPathology').value = p.pathology || '';
  $('editPatientModal').classList.add('show');
}

async function saveEditPatient(){
  const id    = $('editPatientId').value;
  const name  = $('editPatientName').value.trim();
  const whats = $('editPatientWhatsapp').value.trim();
  const birthDate = $('editPatientBirthDate') ? $('editPatientBirthDate').value : '';
  const referralSource = $('editPatientReferralSource') ? $('editPatientReferralSource').value.trim() : '';
  const path  = $('editPatientPathology').value.trim();
  if(!name){ toast('Informe o nome do paciente.','warning'); return; }
  if(whats && !/^\(\d{2}\)\s\d{5}-\d{4}$/.test(whats)){ toast('WhatsApp inválido. Use (99) 99999-9999.','warning'); return; }
  try{
    await api('patients?id=eq.' + encodeURIComponent(id), {
      method:'PATCH',
      body: JSON.stringify({ name, whatsapp: whats, birth_date: birthDate || null, referral_source: referralSource, pathology: path })
    });
    closeModal('editPatientModal');
    await loadAll(true);
    toast('Paciente atualizado com sucesso.','success');
  }catch(e){
    toast(isMissingPatientSchemaError(e)?'Atualize o Supabase com o patch incremental de patients antes de editar nascimento e origem.':'Erro ao salvar: ' + e.message,isMissingPatientSchemaError(e)?'warning':'error');
  }
}


/* =========================================================
   FEMIC Agenda v1.4.36 - Ficha com dia da semana — Correção de layout semanal + busca + edição de pacotes
   ========================================================= */

function packageCard(p,context){
  context=context||{};
  const patientNames=context.patientNames||null;
  const serviceNames=context.serviceNames||null;
  const total=Number(p.total_sessions||0);
  const remain=Number(p.remaining_sessions||0);
  const used=Math.max(0,total-remain);
  const pct=total?Math.min(100,(used/total)*100):0;
  const cls=remain<=0?'saldo-zero':(remain<=3?'saldo-low':'');
  const inactive=p.active===false;
  const timeline=packageTimelineMeta(p);
  const historyBadge=timeline.total>1?`<span class="package-history-badge">Histórico de ${timeline.total} pacotes</span>`:'';
  const createdAt=p.created_at?fmtDateTime(p.created_at):'Data não registrada';
  const statusLine=packageTimelineStatus(p);
  const metaHtml=`<div class="package-meta"><span class="package-order-chip">${esc(timeline.label)}</span>${historyBadge}</div><div class="package-dates muted small">Criado em ${esc(createdAt)} · ${esc(statusLine)}</div>`;

  if(inactive){
    return `<div class="item package-card inactive package-card-compact">
      <div class="item-top">
        <div>
          <strong>${esc((patientNames&&patientNames[String(p.patient_id)])||patientName(p.patient_id))}</strong> <span class="muted small">(inativo)</span>
          ${metaHtml}
          <div class="muted small">${esc((serviceNames&&serviceNames[String(p.service_id)])||serviceName(p.service_id))} · ${used}/${total} sessões usadas · saldo ${remain}</div>
        </div>
        <div class="package-actions">
          <button class="btn" onclick="editPackage('${p.id}')">Editar</button>
          <button class="btn success" onclick="reactivatePackage('${p.id}')">Reativar</button>
        </div>
      </div>
    </div>`;
  }

  return `<div class="item package-card ${inactive?'inactive':''}">
    <div class="item-top">
      <div>
        <strong>${esc((patientNames&&patientNames[String(p.patient_id)])||patientName(p.patient_id))}</strong>
        <div class="muted small">${esc((serviceNames&&serviceNames[String(p.service_id)])||serviceName(p.service_id))}</div>
        ${metaHtml}
      </div>
      <div class="package-actions">
        <button class="btn" onclick="editPackage('${p.id}')">Editar</button>
        <button class="btn danger" onclick="removePackage('${p.id}')">Remover</button>
      </div>
    </div>
    <div class="small"><span class="used-counter">${used}/${total} sessões usadas</span> · <span class="${cls}">saldo ${remain}</span></div>
    <div class="package-progress"><span style="width:${pct}%"></span></div>
    <div class="package-schedule-placeholder" data-package-schedule-id="${esc(p.id)}">Verificando agenda do pacote...</div>
    ${packagePatternSummary(p)}
  </div>`;
}

async function editPackage(id){
  const p = packages.find(x=>String(x.id)===String(id));
  if(!p){
    toast('Pacote não encontrado.','warning');
    return;
  }

  const currentTotal = Number(p.total_sessions || 0);
  const currentRemaining = Number(p.remaining_sessions || 0);
  const used = Math.max(0, currentTotal - currentRemaining);

  const totalInput = prompt(
    'Total de sessões do pacote:\n\nSessões já usadas: ' + used + '\nO total não pode ser menor que as usadas.',
    String(currentTotal)
  );
  if(totalInput === null) return;

  const newTotal = Number(totalInput);
  if(!Number.isFinite(newTotal) || newTotal < used || newTotal <= 0){
    toast('Total inválido. O total deve ser maior que zero e não pode ser menor que as sessões já usadas.','warning');
    return;
  }

  const remainingInput = prompt(
    'Saldo restante do pacote:\n\nDeve ficar entre 0 e ' + newTotal + '.',
    String(currentRemaining)
  );
  if(remainingInput === null) return;

  const newRemaining = Number(remainingInput);
  if(!Number.isFinite(newRemaining) || newRemaining < 0 || newRemaining > newTotal){
    toast('Saldo inválido. Informe um valor entre 0 e o total do pacote.','warning');
    return;
  }

  const newUsed = newTotal - newRemaining;
  if(newUsed < used){
    const ok = confirm(
      'Atenção: essa alteração reduz as sessões usadas aparentes de ' + used + ' para ' + newUsed + '.\n\n' +
      'Isso pode não refletir o histórico real. Deseja continuar?'
    );
    if(!ok) return;
  }

  const activeText = p.active === false ? 'inativo' : 'ativo';
  const keepActive = confirm('Este pacote está ' + activeText + '.\n\nClique OK para manter ativo.\nClique Cancelar para deixar/inativar.');
  const resolvedActive = keepActive && newRemaining > 0;
  const payload = {
    total_sessions: newTotal,
    remaining_sessions: newRemaining,
    active: resolvedActive,
    ...packageEndedAtPatchValue(resolvedActive ? null : (p.ended_at || new Date().toISOString()))
  };

  const msg =
    'Confirmar edição do pacote?\n\n' +
    'Paciente: ' + patientName(p.patient_id) + '\n' +
    'Serviço: ' + serviceName(p.service_id) + '\n' +
    'Usadas: ' + newUsed + '/' + newTotal + '\n' +
    'Saldo: ' + newRemaining + '\n' +
    'Status: ' + (resolvedActive ? 'ativo' : 'inativo');

  if(!confirm(msg)) return;

  try{
    await api('session_packages?id=eq.' + id, {
      method:'PATCH',
      body: JSON.stringify(payload)
    });
    await loadAll(true);
    toast('Pacote atualizado.','success');
  }catch(e){
    toast('Erro ao editar pacote: ' + e.message,'error');
  }
}

function toggleArchivedPatients(){
  showArchivedPatients=!showArchivedPatients;
  renderLists();
}
window.toggleArchivedPatients=toggleArchivedPatients;

function toggleInactivePackages(){
  showInactivePackages=!showInactivePackages;
  renderLists();
}
window.toggleInactivePackages=toggleInactivePackages;

async function reactivatePackage(id){
  try{
    await api('session_packages?id=eq.' + encodeURIComponent(id), {
      method:'PATCH',
      body: JSON.stringify({active:true,...packageEndedAtPatchValue(null)})
    });
    showInactivePackages=false;
    await loadAll(true);
    toast('Pacote reativado.','success');
  }catch(e){
    toast('Erro ao reativar pacote: ' + e.message,'error');
  }
}
window.reactivatePackage=reactivatePackage;

function renderLists(){
  const patientsById=Object.create(null);
  const servicesById=Object.create(null);
  const patientNames=Object.create(null);
  const serviceNames=Object.create(null);
  const linkedPatientIds=new Set();
  patients.forEach(patient=>{patientsById[String(patient.id)]=patient});
  services.forEach(service=>{servicesById[String(service.id)]=service});
  patients.forEach(patient=>{patientNames[String(patient.id)]=patient.name||'Paciente'});
  services.forEach(service=>{serviceNames[String(service.id)]=service.name||'Sem serviço'});
  appointments.forEach(a=>linkedPatientIds.add(String(a.patient_id)));
  packages.forEach(pk=>linkedPatientIds.add(String(pk.patient_id)));
  movements.forEach(m=>linkedPatientIds.add(String(m.patient_id)));
  $('payerList').innerHTML=payers.map(p=>`<div class="item"><div class="item-top"><strong>${esc(p.name)}</strong><button class="btn danger" onclick="removePayer('${p.id}')">Remover</button></div></div>`).join('')||'<div class="muted">Nenhum pagador.</div>';

  $('serviceList').innerHTML=services.map(s=>`<div class="item"><div class="item-top"><div><strong>${esc(s.name)}</strong><div class="muted small">${payerName(s.health_insurance_id)} · ${brl(s.price)} · ${s.duration_minutes}min · ${s.appointment_mode}</div></div><div class="toolbar"><button class="btn" onclick="startServiceEdit('${s.id}')">Editar</button><button class="btn danger" onclick="removeService('${s.id}')">Remover</button></div></div></div>`).join('')||'<div class="muted">Nenhum serviço.</div>';

  const activePk=packages.filter(p=>p.active!==false);
  const inactivePk=packages.filter(p=>p.active===false);

  if($('packageListActive')){
    const pkQuery = $('packageSearch') ? $('packageSearch').value.trim().toLowerCase() : '';
    const filterPk = pk => {
      if(!pkQuery) return true;
      const patName = String((patientsById[String(pk.patient_id)]||{}).name||'').toLowerCase();
      const svcName = String((servicesById[String(pk.service_id)]||{}).name||'').toLowerCase();
      return patName.includes(pkQuery) || svcName.includes(pkQuery);
    };
    const filteredActivePk   = activePk.filter(filterPk);
    const filteredInactivePk = showInactivePackages ? inactivePk.filter(filterPk) : [];
    const packageCardContext={patientNames,serviceNames};
    const totalActive = activePk.length;
    $('packagesActiveCount').textContent   = pkQuery ? `${filteredActivePk.length}/${totalActive} encontrado(s)` : `${activePk.length} ativo(s)`;
    $('packagesInactiveCount').textContent = inactivePk.length+' inativo(s)';
    $('packageListActive').innerHTML   = filteredActivePk.length   ? filteredActivePk.map(pk=>packageCard(pk,packageCardContext)).join('')   : `<div class="muted">${pkQuery ? 'Nenhum pacote encontrado.' : 'Nenhum pacote ativo.'}</div>`;
    if($('toggleInactivePackagesBtn')) $('toggleInactivePackagesBtn').textContent = showInactivePackages ? 'Ocultar pacotes inativos' : 'Ver pacotes inativos';
    if($('packageInactivePanel')) $('packageInactivePanel').classList.toggle('hidden', !showInactivePackages);
    if($('packageListInactive')) $('packageListInactive').innerHTML = showInactivePackages
      ? (filteredInactivePk.length ? filteredInactivePk.map(pk=>packageCard(pk,packageCardContext)).join('') : `<div class="muted">${pkQuery ? 'Nenhum pacote inativo encontrado.' : 'Nenhum pacote inativo.'}</div>`)
      : '';
  }else if($('packageList')){
    $('packageList').innerHTML=packages.length?packages.map(pk=>packageCard(pk,{patientNames,serviceNames})).join(''):'<div class="muted">Nenhum pacote.</div>';
  }

  const query = $('patientActiveSearch') ? cleanPhone($('patientActiveSearch').value).toLowerCase() || $('patientActiveSearch').value.trim().toLowerCase() : '';
  const archivedQuery = $('patientArchivedSearch') ? cleanPhone($('patientArchivedSearch').value).toLowerCase() || $('patientArchivedSearch').value.trim().toLowerCase() : '';
  const allActivePatients=patients.filter(p=>p.archived!==true);
  const allArchivedPatients=patients.filter(p=>p.archived===true);
  let activePatients=allActivePatients.slice();
  let archivedPatients=allArchivedPatients.slice();

  if(query){
    activePatients = activePatients.filter(p=>{
      const name = String(p.name||'').toLowerCase();
      const phone = cleanPhone(p.whatsapp||'');
      const pathology = String(p.pathology||'').toLowerCase();
      return name.includes(query) || phone.includes(query) || pathology.includes(query);
    });
  }
  if(showArchivedPatients&&archivedQuery){
    archivedPatients = archivedPatients.filter(p=>{
      const name = String(p.name||'').toLowerCase();
      const phone = cleanPhone(p.whatsapp||'');
      const pathology = String(p.pathology||'').toLowerCase();
      return name.includes(archivedQuery) || phone.includes(archivedQuery) || pathology.includes(archivedQuery);
    });
  }

  if($('patientListActive')){
    const totalActive = allActivePatients.length;
    const totalArchived = allArchivedPatients.length;
    $('patientsActiveCount').textContent = query ? `${activePatients.length}/${totalActive} encontrado(s)` : `${activePatients.length} ativo(s)`;
    $('patientsArchivedCount').textContent=totalArchived+' inativo(s)';
    $('patientListActive').innerHTML=activePatients.length?activePatients.map(patient=>patientCard(patient,linkedPatientIds)).join(''):'<div class="muted">Nenhum paciente encontrado.</div>';
    if($('toggleArchivedPatientsBtn')) $('toggleArchivedPatientsBtn').textContent = showArchivedPatients ? 'Ocultar pacientes inativos' : 'Ver pacientes inativos';
    if($('patientArchivedPanel')) $('patientArchivedPanel').classList.toggle('hidden', !showArchivedPatients);
    if($('patientListArchived')) $('patientListArchived').innerHTML=showArchivedPatients
      ? (archivedPatients.length?archivedPatients.map(patient=>patientCard(patient,linkedPatientIds)).join(''):'<div class="muted">Nenhum paciente inativo encontrado.</div>')
      : '';
  }
  const packagesPanelActive=$('panel-packages')?.classList.contains('active');
  if(packagesPanelActive){
    hydratePackageScheduleSummaries();
  }
}


/* =========================================================
   FEMIC Agenda v1.4.36 - Ficha com dia da semana — Total de sessões visível na recorrência
   Ajuste visual: mostra a quantidade total de sessões ao lado do valor.
   ========================================================= */

function getRecurringTotalSessionsVisual(){
  const ids = [
    'recurrenceQuantity','recurringQuantity','recQty','recCount',
    'recurrenceCount','recurringCount','recTotal','recurrenceTotalSessions',
    'recurringTotalSessions','multiCount','multiQty'
  ];

  for(const id of ids){
    const el = document.getElementById(id);
    if(el && String(el.value || '').trim() !== ''){
      return Number(el.value || 0) || 0;
    }
  }

  const candidates = Array.from(document.querySelectorAll(
    '#recurrenceOptions input[type="number"], #recurrenceBox input[type="number"], #recurrenceFields input[type="number"], .recurrence-options input[type="number"], .recorrencia-box input[type="number"], .recorrencia-fields input[type="number"]'
  ));

  const qtyLike = candidates.find(el => {
    const text = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
    return text.includes('quant') || text.includes('sess') || text.includes('total') || text.includes('qtd');
  });

  if(qtyLike) return Number(qtyLike.value || 0) || 0;

  return 0;
}

function ensureRecurringSessionTotalPreview(){
  const valueField = document.getElementById('apptPrice') ||
                     document.getElementById('servicePriceAtTime') ||
                     document.getElementById('appointmentPrice') ||
                     document.querySelector('input[data-role="service-price"], input[name="service_price_at_time"]');

  if(!valueField) return;

  if(document.getElementById('recurringTotalSessionsPreview')) return;

  const box = document.createElement('div');
  box.id = 'recurringTotalSessionsPreview';
  box.className = 'recurring-total-preview';
  box.innerHTML = '<span>Total de sessões</span><strong id="recurringTotalSessionsValue">0</strong>';

  valueField.insertAdjacentElement('afterend', box);
  updateRecurringTotalSessionsPreview();
}

function updateRecurringTotalSessionsPreview(){
  const el = document.getElementById('recurringTotalSessionsValue');
  if(!el) return;
  const total = getRecurringTotalSessionsVisual();
  el.textContent = total ? String(total) : '—';
}

document.addEventListener('input', function(ev){
  if(ev.target && ev.target.matches('input, select')){
    updateRecurringTotalSessionsPreview();
  }
});

document.addEventListener('change', function(ev){
  if(ev.target && ev.target.matches('input, select')){
    updateRecurringTotalSessionsPreview();
  }
});

const originalOpenAppointmentModal_v1420 = window.openAppointmentModal;
if(typeof originalOpenAppointmentModal_v1420 === 'function'){
  window.openAppointmentModal = function(){
    const result = originalOpenAppointmentModal_v1420.apply(this, arguments);
    setTimeout(()=>{
      ensureRecurringSessionTotalPreview();
      updateRecurringTotalSessionsPreview();
    }, 80);
    return result;
  };
}

setTimeout(()=>{
  ensureRecurringSessionTotalPreview();
  updateRecurringTotalSessionsPreview();
}, 300);



/* =========================================================
   FEMIC Agenda v1.4.36 — funções seguras da semana proporcional
   ========================================================= */
function weekdayShort(dateStr){
  const nomes=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  return nomes[dateDay(dateStr)] || '';
}
function femicClamp(n,min,max){return Math.max(min,Math.min(max,n));}
function femicIntervalsOverlapV1434(a,b){return a.start < b.end && b.start < a.end;}
function femicWeekClickV1434(ev,ds,bounds,pxPerMin){
  if(ev.target.closest('.week-v3-event')) return;
  const dayEl=ev.currentTarget;
  if(dayEl.classList.contains('closed')) return;
  const rect=dayEl.getBoundingClientRect();
  const y=femicClamp(ev.clientY-rect.top,0,rect.height);
  const step=agendaSlotStep();
  const raw=bounds.start + Math.round((y/pxPerMin)/step)*step;
  const minute=femicClamp(raw,bounds.start,bounds.end-step);
  openAppt(ds,null,minToTime(minute));
}
function slotSummaryStatusButtons(a){
  const options=[
    {value:'agendado',label:'Agendado'},
    {value:'confirmado',label:'Confirmar'},
    {value:'concluido',label:'Concluir'},
    {value:'cancelado',label:'Cancelar'}
  ].filter(item=>item.value!==a.status);
  return options.map(item=>`<button class="btn ${item.value==='concluido'?'success':item.value==='cancelado'?'danger':item.value==='confirmado'?'primary':'ghost'}" type="button" onclick="closeModal('slotSummaryModal');quickStatus('${a.id}','${item.value}')">${item.label}</button>`).join('');
}
function weekTimelineBounds(){
  const periods=parsePeriods();
  const starts=periods.map(p=>timeToMin(p.start)).filter(Number.isFinite);
  const ends=periods.map(p=>timeToMin(p.end)).filter(Number.isFinite);
  let start=starts.length?Math.min(...starts):timeToMin(settings.start_time||'08:00');
  let end=ends.length?Math.max(...ends):timeToMin(settings.end_time||'20:00');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){
    start=8*60;
    end=20*60;
  }
  start=Math.floor(start/60)*60;
  end=Math.ceil(end/60)*60;
  return {start,end,total:end-start};
}
function weekV3ItemsForDay(ds,dayAppointments,bounds,patientNames,serviceDurations){
  return dayAppointments.map(a=>{
    const st=timeToMin(normalizeTime(a.start_time));
    let en=timeToMin(normalizeTime(a.end_time));
    if(!Number.isFinite(st)) return null;
    if(!Number.isFinite(en)||en<=st){
      const fallbackDuration=Number(a.duration_minutes||serviceDurations[String(a.service_id)]||45);
      en=st+(Number.isFinite(fallbackDuration)&&fallbackDuration>0?fallbackDuration:45);
    }
    const start=femicClamp(st,bounds.start,bounds.end);
    const end=femicClamp(en,bounds.start,bounds.end);
    if(end<=start) return null;
    const patientLabel=patientNames[String(a.patient_id)]||'Paciente';
    return {date:ds,start,end,startLabel:normalizeTime(a.start_time),endLabel:normalizeTime(a.end_time),patientLabel,appointment:a,col:0,cols:1};
  }).filter(Boolean).sort((a,b)=>(a.start-b.start)||(a.end-b.end)||a.patientLabel.localeCompare(b.patientLabel,'pt-BR'));
}
function layoutWeekV3Items(items){
  const buckets=[];
  items.forEach(item=>{
    let bucket=buckets.find(list=>list.some(other=>femicIntervalsOverlapV1434(item,other)));
    if(!bucket){bucket=[];buckets.push(bucket);}
    bucket.push(item);
  });
  buckets.forEach(bucket=>{
    bucket.sort((a,b)=>(a.start-b.start)||(a.end-b.end));
    const colEnds=[];
    bucket.forEach(item=>{
      let col=colEnds.findIndex(end=>end<=item.start);
      if(col<0){col=colEnds.length;colEnds.push(item.end);}else colEnds[col]=item.end;
      item.col=col;
    });
    const cols=Math.max(1,colEnds.length);
    bucket.forEach(item=>item.cols=cols);
  });
  return items;
}
function openWeekAppointmentSummary(key){
  const item=window.FEMICWeekV3Cache&&window.FEMICWeekV3Cache[key];
  if(!item) return;
  const a=appointments.find(row=>String(row.id)===String(item.appointmentId));
  if(!a) return;
  const patient=patientById(a.patient_id);
  const statusLabel={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
  const title=$('slotSummaryTitle'),subtitle=$('slotSummarySubtitle'),body=$('slotSummaryBody'),addBtn=$('slotSummaryAddBtn');
  if(title) title.textContent=`${fmtWeekday(item.date)}, ${fmtDate(item.date)} · ${item.startLabel}-${item.endLabel}`;
  if(subtitle) subtitle.textContent=`${patient.name||'Paciente'} · ${serviceName(a.service_id)} · ${statusLabel}`;
  if(addBtn) addBtn.onclick=function(){closeModal('slotSummaryModal');openAppt(item.date,null,item.startLabel);};
  if(body){
    body.innerHTML='<div class="slot-summary-list">'+
      `<div class="slot-summary-row status-${a.status}">
        <div class="slot-summary-main">
          <strong>${esc(patient.name||'Paciente')}</strong>
          <span>${normalizeTime(a.start_time)}-${normalizeTime(a.end_time)} · ${esc(serviceName(a.service_id))}</span>
          <span class="status-chip ${a.status}">${statusLabel}</span>
        </div>
        <div class="slot-summary-actions">${slotSummaryStatusButtons(a)}</div>
      </div>`+
    '</div>';
  }
  $('slotSummaryModal')?.classList.add('show');
}
function weekV3StatusClass(status){
  return status==='concluido'?'done':status==='cancelado'?'cancelled':status==='confirmado'?'confirmed':'scheduled';
}
function renderWeek(){
  $('monthView').classList.add('hidden');
  $('weekView').classList.remove('hidden');
  const start=weekStart(currentDate);
  const allDays=[0,1,2,3,4,5,6].map(i=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  const days=allDays.filter(d=>isWorking(isoDate(d)));
  const visibleDays=days.length?days:allDays;
  $('periodLabel').textContent=`Semana de ${fmtDate(isoDate(visibleDays[0]))} a ${fmtDate(isoDate(visibleDays[visibleDays.length-1]))}`;
  const bounds=weekTimelineBounds();
  const pxPerMin=1.42;
  const hourHeight=Math.round(60*pxPerMin);
  const timelineHeight=Math.round(bounds.total*pxPerMin);
  const timeMarks=[];
  for(let m=bounds.start;m<=bounds.end;m+=60) timeMarks.push(m);
  const weekData=buildWeekAgendaData(visibleDays);
  const patientNames=Object.create(null);
  const serviceDurations=Object.create(null);
  const packageAlertCache=Object.create(null);
  patients.forEach(patient=>{patientNames[String(patient.id)]=patient.name||'Paciente'});
  services.forEach(service=>{serviceDurations[String(service.id)]=Number(service.duration_minutes)||45});
  window.FEMICWeekV3Cache={};
  let itemIndex=0;
  let html=`<div class="week-v3-shell"><div class="week-v3-board" style="grid-template-columns:64px repeat(${visibleDays.length}, minmax(144px,1fr));">`;
  html+=`<div class="week-v3-corner"></div>`;
  visibleDays.forEach(d=>{
    const ds=isoDate(d);
    const openCount=weekData.openCountByDate[ds]||0;
    const weekLabel=d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
    html+=`<div class="week-v3-head ${ds===todayIso()?'today':''}"><span>${weekLabel}</span><strong>${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</strong><small>${openCount} ag.</small></div>`;
  });
  html+=`<div class="week-v3-axis" style="height:${timelineHeight}px;--hour-height:${hourHeight}px">`;
  timeMarks.forEach(min=>{html+=`<div class="week-v3-axis-label" style="top:${Math.round((min-bounds.start)*pxPerMin)}px">${minToTime(min)}</div>`});
  html+=`</div>`;
  const dayBlocksByDate=Object.create(null);
  visibleDays.forEach(d=>{
    const ds=isoDate(d);
    dayBlocksByDate[ds]=activeScheduleBlocksForDate(ds);
  });
  visibleDays.forEach(d=>{
    const ds=isoDate(d);
    const closed=isClosedForView(ds);
    const dayAppointments=weekData.byDate[ds]||[];
    const dayBlocks=dayBlocksByDate[ds]||[];
    const items=layoutWeekV3Items(weekV3ItemsForDay(ds,dayAppointments,bounds,patientNames,serviceDurations));
    html+=`<div class="week-v3-day ${ds===todayIso()?'today':''} ${closed?'closed':''}" style="height:${timelineHeight}px;--hour-height:${hourHeight}px" onclick="femicWeekClickV1434(event,'${ds}',{start:${bounds.start},end:${bounds.end}},${pxPerMin})">`;
    dayBlocks.forEach(block=>{
      const bStart=timeToMin(block.start_time);
      const bEnd=timeToMin(block.end_time);
      if(bEnd<=bounds.start||bStart>=bounds.end)return;
      const top=Math.round(Math.max(bStart,bounds.start)-bounds.start)*pxPerMin;
      const h=Math.round((Math.min(bEnd,bounds.end)-Math.max(bStart,bounds.start))*pxPerMin);
      html+=`<div class="week-v3-block" style="top:${top}px;height:${Math.max(6,h)}px" title="${esc(block.reason||'Bloqueado')} — clique para reabrir" onclick="event.stopPropagation();reopenScheduleBlock('${esc(block.id)}')"></div>`;
    });
    items.forEach(item=>{
      const key='a'+(itemIndex++);
      const a=item.appointment;
      window.FEMICWeekV3Cache[key]={date:item.date,startLabel:item.startLabel,endLabel:item.endLabel,appointmentId:String(a.id||'')};
      const top=Math.round((item.start-bounds.start)*pxPerMin);
      const height=Math.max(54,Math.round((item.end-item.start)*pxPerMin));
      const laneWidth=100/Math.max(item.cols,1);
      const left=laneWidth*item.col;
      const widthStyle=`calc(${laneWidth}% - 8px)`;
      const status=a.status||'agendado';
      const alert=appointmentPackageAlertMeta(a,packageAlertCache);
      html+=`<button class="week-v3-event ${weekV3StatusClass(status)} status-${status}" type="button" style="top:${top}px;height:${height}px;left:calc(${left}% + 4px);width:${widthStyle}" onclick="event.stopPropagation();openWeekAppointmentSummary('${key}')">
        ${alert.show?`<span class="appointment-package-alert-dot week" title="${esc(alert.text)}" aria-label="${esc(alert.text)}"></span>`:''}
        <div class="week-v3-event-time"><span>${item.startLabel}-${item.endLabel}</span></div>
        <strong class="week-v3-event-name">${esc(item.patientLabel)}</strong>
      </button>`;
    });
    html+=`</div>`;
  });
  html+=`</div></div>`;
  $('weekBoard').innerHTML=html;
}


function getAgendaTheme(){
  return localStorage.getItem('femic_agenda_theme') || localStorage.getItem('femic_theme') || 'light';
}

function setAgendaTheme(theme){
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;
  localStorage.setItem('femic_agenda_theme', next);
  localStorage.setItem('femic_theme', next);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#0d1717' : '#0b3c6f');
}

function applyAgendaTheme(){
  setAgendaTheme(getAgendaTheme());
}

function toggleAgendaTheme(){
  const next = getAgendaTheme() === 'light' ? 'dark' : 'light';
  setAgendaTheme(next);
  toast('Tema ' + (next === 'dark' ? 'escuro' : 'claro') + ' ativado.', 'info');
}

function toggleTheme(){
  toggleAgendaTheme();
}

function getNextStatuses(current){
  const all = [
    { value:'concluido', label:'Concluído' },
    { value:'cancelado', label:'Cancelado' }
  ];
  return all.filter(s => s.value !== current);
}

if(typeof saldoBadgeInline !== 'function'){
  function saldoBadgeInline(patientId, serviceId){
    try{
      const info=packageSaldoInfo(patientId,serviceId);
      if(!info||info.total<=0) return '';
      return ` · saldo ${info.remaining}`;
    }catch(e){
      return '';
    }
  }
}

/* ============================================================
   FEMIC AUTH — Configuração + Login / Logout
   ============================================================ */
function femicShowSetup(){
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
  const u = localStorage.femic_agenda_url || '';
  const k = localStorage.femic_agenda_key || '';
  if(u) document.getElementById('setupUrl').value = u;
  if(k) document.getElementById('setupKey').value = k;
}

function femicSaveSetup(){
  const url  = (document.getElementById('setupUrl').value || '').trim().replace(/\/$/,'');
  const akey = (document.getElementById('setupKey').value || '').trim();
  const errEl = document.getElementById('setupError');
  if(!url || !url.startsWith('https://')){
    errEl.textContent = 'Informe a URL completa do Supabase (começa com https://).';
    errEl.style.display = 'block'; return;
  }
  if(!akey || akey.length < 20){
    errEl.textContent = 'Informe a chave anônima (anon key) do Supabase.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  localStorage.femic_agenda_url = url;
  localStorage.femic_agenda_key = akey;
  // Sincronizar com os inputs internos da agenda
  if($('sbUrl')) $('sbUrl').value = url;
  if($('sbKey')) $('sbKey').value = akey;
  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = 'block';
  setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
}

async function femicLogin(){
  const urlVal = (localStorage.femic_agenda_url || '').trim();
  const keyVal = (localStorage.femic_agenda_key || '').trim();
  const email    = (document.getElementById('loginEmail').value || '').trim();
  const password = document.getElementById('loginPassword').value || '';
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if(!urlVal || !keyVal){ femicShowSetup(); return; }
  if(!email || !password){
    errEl.textContent = 'Preencha email e senha.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.textContent = 'Entrando…'; btn.disabled = true;

  try {
    const res = await fetch(urlVal + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': keyVal },
      body: JSON.stringify({ email, password })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.message || 'Credenciais inválidas');
    }
    const data = await res.json();
    sessionStorage.setItem('femic_jwt',  data.access_token);
    sessionStorage.setItem('femic_refresh_token', data.refresh_token);
    var expiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    sessionStorage.setItem('femic_token_expiry', String(expiresAt));
    sessionStorage.setItem('femic_user', email);
    document.getElementById('femicLoginOverlay').style.display = 'none';
    const lbl = document.getElementById('loginUserLabel');
    if(lbl) lbl.textContent = email.split('@')[0] + ' · Sair';
    if(base() && key()) loadAll(true);
    toast('Bem-vindo, ' + email.split('@')[0] + '!', 'success');
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

async function femicRefreshToken(){
  const urlVal = (localStorage.femic_agenda_url || '').trim();
  const keyVal = (localStorage.femic_agenda_key || '').trim();
  const refreshToken = sessionStorage.getItem('femic_refresh_token');
  if(!urlVal || !keyVal || !refreshToken) return false;
  try {
    const res = await fetch(urlVal + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': keyVal },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if(!res.ok){ sessionStorage.removeItem('femic_refresh_token'); return false; }
    const data = await res.json();
    sessionStorage.setItem('femic_jwt', data.access_token);
    sessionStorage.setItem('femic_refresh_token', data.refresh_token);
    var expiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    sessionStorage.setItem('femic_token_expiry', String(expiresAt));
    return true;
  } catch(e) { return false; }
}

function femicLogout(){
  if(!confirm('Sair da sessão?')) return;
  sessionStorage.removeItem('femic_jwt');
  sessionStorage.removeItem('femic_refresh_token');
  sessionStorage.removeItem('femic_token_expiry');
  sessionStorage.removeItem('femic_user');
  location.reload();
}

function checkFemicAuth(){
  const jwt     = sessionStorage.getItem('femic_jwt');
  const overlay = document.getElementById('femicLoginOverlay');
  const hasConfig = !!(localStorage.femic_agenda_url && localStorage.femic_agenda_key);
  if(!jwt){
    if(overlay) overlay.style.display = 'flex';
    if(!hasConfig){
      document.getElementById('loginStep1').style.display = 'block';
      document.getElementById('loginStep2').style.display = 'none';
    } else {
      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = 'block';
      setTimeout(() => document.getElementById('loginEmail')?.focus(), 150);
    }
    return;
  }
  if(overlay) overlay.style.display = 'none';
  const email = sessionStorage.getItem('femic_user') || '';
  const lbl   = document.getElementById('loginUserLabel');
  if(lbl && email) lbl.textContent = email.split('@')[0] + ' · Sair';
}

applyAgendaTheme();renderWorkDays();renderReminderAutomationStatus();syncAgendaNavState('agenda');renderActivePanel();if(base()&&key()&&sessionStorage.getItem('femic_jwt'))loadAll(true);
function hasOpenModal(){
  return !!document.querySelector('.modal-backdrop.show');
}
function shouldBackgroundRefresh(){
  if(document.hidden) return false;
  if(!base()||!key()||!sessionStorage.getItem('femic_jwt')) return false;
  if(hasOpenModal()) return false;
  if(Date.now()-lastUserInteractionAt<15000) return false;
  return ['agenda','day','report','reminders','ai','packages','settings'].includes(getActivePanelName());
}
['pointerdown','keydown','visibilitychange'].forEach(function(evt){
  document.addEventListener(evt,function(){lastUserInteractionAt=Date.now();},{passive:true});
});
setInterval(()=>{
  if(shouldBackgroundRefresh()) loadAll(true);
},120000);
