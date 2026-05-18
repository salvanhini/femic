const SQL_SCHEMA = `-- FEMIC Agenda v1.5.0 - Supabase seguro + prontuário em nuvem
-- ATENÇÃO: este SQL reseta as tabelas operacionais deste Supabase.
-- Faça backup JSON antes de rodar em um banco com dados reais.
DROP TABLE IF EXISTS session_movements CASCADE;
DROP TABLE IF EXISTS session_packages CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clinical_evolutions CASCADE;
DROP TABLE IF EXISTS clinical_anamneses CASCADE;
DROP TABLE IF EXISTS clinic_rules CASCADE;
DROP TABLE IF EXISTS assistant_tasks CASCADE;
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
  form_reminder_sent BOOLEAN DEFAULT FALSE,
  form_reminder_sent_at TIMESTAMP WITH TIME ZONE,
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

-- PENDÊNCIAS OPERACIONAIS DO ASSISTENTE
CREATE TABLE assistant_tasks (
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

-- CONFIGURAÇÕES DA AGENDA
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

-- CONFIGURAÇÃO INICIAL
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

-- ÍNDICES PARA USO NO PLANO FREE
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_whatsapp ON patients(whatsapp);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_session_packages_patient ON session_packages(patient_id);
CREATE INDEX idx_movements_patient ON session_movements(patient_id);
CREATE INDEX idx_clinical_evolutions_patient_date ON clinical_evolutions(patient_id, date DESC);
CREATE INDEX idx_assistant_tasks_status_updated ON assistant_tasks(status, updated_at DESC);
CREATE INDEX idx_assistant_tasks_origin ON assistant_tasks(origin);
CREATE INDEX idx_assistant_tasks_fingerprint ON assistant_tasks(extension_fingerprint);

-- SEGURANÇA: anon não acessa dados. Usuários autenticados da clínica acessam tudo.
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_evolutions ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "authenticated_full_access_assistant_tasks" ON assistant_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_clinical_anamneses" ON clinical_anamneses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access_clinical_evolutions" ON clinical_evolutions FOR ALL TO authenticated USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;
const $=id=>document.getElementById(id);let patients=[],payers=[],services=[],packages=[],appointments=[],movements=[],clinicRules=[],settings={start_time:'08:00',end_time:'20:00',working_days:'1,2,3,4,5,6',slot_interval_minutes:30,max_patients_per_slot:4};let currentDate=new Date();let editingServiceId='';let loadedAppointmentQuery='',aiRadarQuery='',aiRadarAppointments=[],aiRadarLoaded=false,aiRadarLastWeeks=[],recurringSuggestionCache=[];const appointmentSearchSelected=new Set();
const packageScheduleCache=new Map();
const dayAppointmentCache=new Map();
const CLINIC_RULES_STORAGE_KEY='femic_agenda_clinic_rules';
function toast(msg,type='info'){const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;$('toastWrap').appendChild(el);setTimeout(()=>el.remove(),3600)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function localIsoDate(d){const x=new Date(d);return String(x.getFullYear())+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}function todayIso(){return localIsoDate(new Date())}function isoDate(d){return localIsoDate(d)}function dateDay(dateStr){const [y,m,d]=String(dateStr).split('-').map(Number);return new Date(y,m-1,d).getDay()}function fmtDate(s){if(!s)return'';const [y,m,d]=String(s).split('-');return d+'/'+m+'/'+y}function fmtWeekday(s){if(!s)return'';const [y,m,d]=String(s).split('-').map(Number);const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];return dias[new Date(y,m-1,d).getDay()]||''}function cleanPhone(v){return String(v||'').replace(/\D/g,'')}function brl(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}function normalizeTime(t){return String(t||'').slice(0,5)}function timeToMin(t){const [h,m]=normalizeTime(t).split(':').map(Number);return h*60+(m||0)}function minToTime(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}function addMinutes(t,m){return minToTime(timeToMin(t)+Number(m||0))}function base(){return ($('sbUrl').value||localStorage.femic_agenda_url||'').trim().replace(/\/$/,'')}function key(){return ($('sbKey').value||localStorage.femic_agenda_key||'').trim()}function hasValidSession(){const jwt=sessionStorage.getItem('femic_jwt');const expiry=Number(sessionStorage.getItem('femic_token_expiry')||0);return !!(jwt&&expiry&&Date.now()<expiry)}async function ensureSession(){if(hasValidSession())return true;if(sessionStorage.getItem('femic_refresh_token')&&await femicRefreshToken())return true;throw new Error('Faça login para acessar os dados do Supabase.')}function headers(){
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
function readClinicRulesCache(){try{const raw=JSON.parse(localStorage.getItem(CLINIC_RULES_STORAGE_KEY)||'[]');return Array.isArray(raw)?raw:[]}catch(e){return[]}}
function writeClinicRulesCache(list){localStorage.setItem(CLINIC_RULES_STORAGE_KEY,JSON.stringify(Array.isArray(list)?list:[]))}
function isMissingClinicRulesTableError(err){return /clinic_rules|relation .* does not exist|Could not find the table/i.test(String(err&&err.message||err||''))}
async function loadClinicRulesCollection(){try{const rows=await api('clinic_rules?select=*&order=priority.asc,created_at.asc');writeClinicRulesCache(rows||[]);return rows||[]}catch(e){if(isMissingClinicRulesTableError(e))return readClinicRulesCache();throw e}}
clinicRules=readClinicRulesCache();
function saveConfig(){localStorage.femic_agenda_url=$('sbUrl').value.trim();localStorage.femic_agenda_key=$('sbKey').value.trim();toast('Configuração salva.','success')}function loadConfig(){$('sbUrl').value=localStorage.femic_agenda_url||'';$('sbKey').value=localStorage.femic_agenda_key||'';const tpl=localStorage.femic_tpl_reminder||'Olá, {nome}! Tudo bem? Passando para confirmar seu atendimento na FEMIC: 📅 {data} ⏰ {hora}. Por favor, responda esta mensagem com: ✅ CONFIRMAR para manter o horário ou ❌ CANCELAR se não puder comparecer. Se precisar remarcar, é só avisar 😊';const formTpl=localStorage.femic_tpl_form_reminder||'Olá, {nome}! Obrigado por comparecer à FEMIC. Quando puder, responda o formulário pós-atendimento: {form_link}';$('tplReminder').value=tpl;if($('tplFormReminder'))$('tplFormReminder').value=formTpl;if($('formLinkInput'))$('formLinkInput').value=localStorage.femic_form_link||'';if($('whatsappProvider'))$('whatsappProvider').value=localStorage.femic_whatsapp_provider||'wa_me';if($('whatsappEndpoint'))$('whatsappEndpoint').value=localStorage.femic_whatsapp_endpoint||'';if($('whatsappTplAppointment'))$('whatsappTplAppointment').value=localStorage.femic_whatsapp_tpl_appointment||'lembrete_sessao';if($('whatsappTplForm'))$('whatsappTplForm').value=localStorage.femic_whatsapp_tpl_form||'formulario_pos_sessao';renderWhatsappProviderBadge()}
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
  if(!base() || !key() || query === loadedAppointmentQuery) return;
  try{
    appointments = await api(query) || [];
    loadedAppointmentQuery = query;
    renderReport();
    document.dispatchEvent(new CustomEvent('femic:state-updated'));
  }catch(e){
    console.error(e);
    toast('Erro ao carregar relatório mensal: ' + e.message, 'error');
  }
}
async function loadAll(silent=false){if(!base()||!key()){if(!silent)toast('Preencha URL e anon key.','warning');return}try{const apQuery=appointmentWindowQuery();const [pa,hi,sv,pk,ap,mv,st,cr]=await Promise.all([api('patients?select=*&order=name'),api('health_insurances?select=*&order=name'),api('services?select=*&order=name'),api('session_packages?select=*&order=created_at.desc'),api(apQuery),api('session_movements?select=*&order=created_at.desc'),api('schedule_settings?select=*&limit=1'),loadClinicRulesCollection()]);patients=pa||[];payers=hi||[];services=sv||[];packages=pk||[];appointments=ap||[];loadedAppointmentQuery=apQuery;aiRadarQuery='';aiRadarLoaded=false;movements=mv||[];clinicRules=cr||[];settings=Object.assign(settings,(st&&st[0])||{});packageScheduleCache.clear();dayAppointmentCache.clear();syncForms();renderActivePanel();document.dispatchEvent(new CustomEvent('femic:state-updated'));if(window.renderExtensionPendingTasks) window.renderExtensionPendingTasks();if(!silent)toast('Dados carregados.','success')}catch(e){console.error(e);toast('Erro ao carregar: '+e.message,'error')}}
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
    case 'packages':
    case 'settings':
      renderLists();
      renderClinicRulesEditor();
      break;
    case 'reminders':
      renderReminders();
      break;
    case 'ai':
      renderAIRadar();
      break;
    case 'report':
      renderReport();
      break;
    case 'backup':
      renderBackupPanel();
      break;
    case 'pendencias':
      if(window.renderExtensionPendingTasks) window.renderExtensionPendingTasks();
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
function renderAll(){renderAgenda();renderDay();renderReminders();renderAIRadar();renderReport();renderLists();renderBackupPanel();renderAppointmentSearch();if(window.renderExtensionPendingTasks) window.renderExtensionPendingTasks()}function patientById(id){return patients.find(p=>String(p.id)===String(id))||{}}function serviceById(id){return services.find(s=>String(s.id)===String(id))||{}}function payerName(id){return (payers.find(p=>String(p.id)===String(id))||{}).name||'Particular'}function patientName(id){return patientById(id).name||'Paciente'}function serviceName(id){return serviceById(id).name||'Sem serviço'}
function assistantPeriodMatches(start,period){const p=String(period||'').toLowerCase();const m=timeToMin(start);if(p==='manha')return m<12*60;if(p==='tarde')return m>=12*60&&m<18*60;if(p==='noite')return m>=18*60;return true}
function assistantAppointmentPayload(input={}){const sid=input.service_id||input.serviceId,pid=input.patient_id||input.patientId,date=input.appointment_date||input.date,start=normalizeTime(input.start_time||input.start);if(!pid)throw new Error('Paciente não identificado.');if(!sid)throw new Error('Serviço não identificado.');if(!date)throw new Error('Data não informada.');if(!start)throw new Error('Horário inicial não informado.');const s=serviceById(sid);if(!s||!s.id)throw new Error('Serviço não encontrado.');const duration=Number(input.duration_minutes||s.duration_minutes||45);const end=normalizeTime(input.end_time||input.end||addMinutes(start,duration));return{patient_id:pid,service_id:sid,appointment_date:date,start_time:start,end_time:end,duration_minutes:duration,status:input.status||'agendado',service_price_at_time:Number(input.service_price_at_time!=null?input.service_price_at_time:getServiceDefaultPrice(sid))}}
async function validateAssistantAppointment(input={}){const payload=assistantAppointmentPayload(input);if(timeToMin(payload.end_time)<=timeToMin(payload.start_time))return{valid:false,reason:'O horário final precisa ser maior que o inicial.',payload};if(!isTodayDate(payload.appointment_date)&&!isWorking(payload.appointment_date))return{valid:false,reason:'Dia fora do expediente.',payload};if(!isInsideWorkingTime(payload.appointment_date,payload.start_time,payload.end_time))return{valid:false,reason:'Horário fora dos períodos de expediente configurados.',payload};let rows=appointments.filter(a=>a.appointment_date===payload.appointment_date);try{rows=await fetchAppointmentsForDate(payload.appointment_date)}catch(e){}const conflict=conflictInAppointmentList(payload,rows,input.ignore_id||input.ignoreId||null);if(conflict)return{valid:false,reason:conflict,payload};return{valid:true,reason:'Horário disponível.',payload,patient:patientById(payload.patient_id),service:serviceById(payload.service_id)}}
async function suggestAssistantAppointmentSlots(input={}){const sid=input.service_id||input.serviceId,pid=input.patient_id||input.patientId;if(!pid)return{slots:[],reason:'Paciente não identificado.'};if(!sid)return{slots:[],reason:'Serviço não identificado.'};const s=serviceById(sid);if(!s||!s.id)return{slots:[],reason:'Serviço não encontrado.'};const duration=Number(input.duration_minutes||s.duration_minutes||45);const dates=(Array.isArray(input.dates)?input.dates:[input.appointment_date||input.date]).filter(Boolean).slice(0,8);if(!dates.length)return{slots:[],reason:'Informe ao menos uma data para buscar horários.'};const slotsFound=[];let lastReason='Nenhum horário disponível nas datas sugeridas.';for(const date of dates){if(slotsFound.length>=5)break;if(!isTodayDate(date)&&!isWorking(date)){lastReason='Dia fora do expediente.';continue}let dayRows=appointments.filter(a=>a.appointment_date===date);try{dayRows=await fetchAppointmentsForDate(date)}catch(e){}for(const period of parsePeriods()){for(let minute=timeToMin(period.start);minute+duration<=timeToMin(period.end);minute+=Number(settings.slot_interval_minutes||30)){if(slotsFound.length>=5)break;const start=minToTime(minute);if(!assistantPeriodMatches(start,input.requested_period||input.period))continue;const payload={patient_id:pid,service_id:sid,appointment_date:date,start_time:start,end_time:addMinutes(start,duration),duration_minutes:duration,status:'agendado',service_price_at_time:Number(getServiceDefaultPrice(sid))};const conflict=conflictInAppointmentList(payload,dayRows,input.ignore_id||input.ignoreId||null);if(conflict){lastReason=conflict;continue}slotsFound.push({patient_id:pid,service_id:sid,date,appointment_date:date,start,start_time:start,end:payload.end_time,end_time:payload.end_time,duration_minutes:duration,service_price_at_time:payload.service_price_at_time,load:dayRows.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<timeToMin(payload.end_time)&&timeToMin(normalizeTime(a.end_time))>timeToMin(start)).length})}}}return{slots:slotsFound,reason:slotsFound.length?'Horários encontrados.':lastReason}}
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
window.FEMICAgendaRuntime={
  getState:function(){return{patients:[...patients],payers:[...payers],services:[...services],packages:[...packages],appointments:[...appointments],movements:[...movements],clinicRules:[...clinicRules],settings:Object.assign({},settings)}},
  suggestAppointmentSlots:suggestAssistantAppointmentSlots,
  validateAppointmentProposal:validateAssistantAppointment,
  confirmAppointmentProposal:confirmAssistantAppointmentProposal,
  findFutureAppointments:findPatientFutureAppointments,
  cancelAppointment:function(id){return cancelAppointmentProposal(id);},
  api:function(path,opt){return api(path,opt||{});},
  setClinicRules:function(list){clinicRules=Array.isArray(list)?list:[];writeClinicRulesCache(clinicRules);renderBackupPanel();document.dispatchEvent(new CustomEvent('femic:state-updated'));return clinicRules},
  readClinicRulesCache:readClinicRulesCache,
  writeClinicRulesCache:writeClinicRulesCache,
  loadClinicRulesCollection:loadClinicRulesCollection,
  isMissingClinicRulesTableError:isMissingClinicRulesTableError
};
function syncForms(){
  const patientOpts = patients
    .filter(p=>p.archived!==true)
    .map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`)
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

  $('setStart').value=settings.start_time||'08:00';
  $('setEnd').value=settings.end_time||'20:00';
  if($('setPeriods')) $('setPeriods').value=settings.working_periods||((settings.start_time||'08:00')+'-'+(settings.end_time||'20:00'));
  $('setInterval').value=String(settings.slot_interval_minutes||30);
  populateAgendaFilters();
  renderWorkDays()
}
function renderWorkDays(){const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];const active=String(settings.working_days||'1,2,3,4,5').split(',');$('workDays').innerHTML=names.map((n,i)=>`<label class="day-check"><input type="checkbox" class="wd" value="${i}" ${active.includes(String(i))?'checked':''}>${n}</label>`).join('');$('recDays').innerHTML=names.map((n,i)=>`<div class="rec-day-card" id="recCard${i}"><label class="rec-title"><input type="checkbox" class="recDay" value="${i}" onchange="toggleRecDayCard(${i})">${n}</label><input type="time" class="recTime" id="recTime${i}" onchange="previewRecurringEnd(${i})"><div class="muted small" id="recEnd${i}">Fim calculado pelo serviço</div></div>`).join('')}
function weekStart(d){const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));return x}function isTodayDate(dateStr){return String(dateStr)===todayIso()}function isWorking(dateStr){return String(settings.working_days||'1,2,3,4,5,6').split(',').includes(String(dateDay(dateStr)))}function isClosedForView(dateStr){return !isTodayDate(dateStr)&&!isWorking(dateStr)}
function parsePeriods(){const raw=String(settings.working_periods||((settings.start_time||'08:00')+'-'+(settings.end_time||'20:00')));return raw.split(',').map(x=>x.trim()).filter(Boolean).map(p=>{const parts=p.split('-').map(v=>v.trim());return {start:parts[0],end:parts[1]};}).filter(p=>/^\d{2}:\d{2}$/.test(p.start)&&/^\d{2}:\d{2}$/.test(p.end)&&timeToMin(p.start)<timeToMin(p.end));}
function slots(){const set=new Set(),step=Number(settings.slot_interval_minutes||30);parsePeriods().forEach(p=>{let m=timeToMin(p.start),end=timeToMin(p.end);while(m<end){set.add(minToTime(m));m+=step}});return [...set].sort()}
function isInsideWorkingTime(dateStr,start,end){if(!isTodayDate(dateStr)&&!isWorking(dateStr)) return false;const s=timeToMin(start),e=timeToMin(end);return parsePeriods().some(p=>s>=timeToMin(p.start)&&e<=timeToMin(p.end));}
function prevPeriod(){if($('viewMode').value==='month')currentDate.setMonth(currentDate.getMonth()-1);else currentDate.setDate(currentDate.getDate()-7);renderAgenda()}function nextPeriod(){if($('viewMode').value==='month')currentDate.setMonth(currentDate.getMonth()+1);else currentDate.setDate(currentDate.getDate()+7);renderAgenda()}function goToday(){currentDate=new Date();$('dayDate').value=todayIso();$('reminderDate').value=isoDate(new Date(Date.now()+86400000));renderActivePanel()}
function agendaFiltered(list){const st=$('agendaStatusFilter')?.value||'all';const sv=$('agendaServiceFilter')?.value||'all';return list.filter(a=>(st==='all'||a.status===st)&&(sv==='all'||String(a.service_id)===String(sv)))}
function populateAgendaFilters(){const sel=$('agendaServiceFilter');if(sel){const current=sel.value||'all';sel.innerHTML='<option value="all">Todos os serviços</option>'+services.filter(s=>s.active!==false).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===current)?current:'all'}const searchSel=$('apptSearchService');if(searchSel){const currentSearch=searchSel.value||'all';searchSel.innerHTML='<option value="all">Todos os serviços</option>'+services.filter(s=>s.active!==false).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');searchSel.value=[...searchSel.options].some(o=>o.value===currentSearch)?currentSearch:'all'}}
function clearAgendaFilters(){if($('agendaStatusFilter'))$('agendaStatusFilter').value='all';if($('agendaServiceFilter'))$('agendaServiceFilter').value='all';renderAgenda()}
function getAppointmentSearchResults(){
  const rawQuery=String($('apptSearchText')?.value||'');
  const queryText=rawQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const queryPhone=cleanPhone(rawQuery);
  const from=$('apptSearchFrom')?.value||'';
  const to=$('apptSearchTo')?.value||'';
  const status=$('apptSearchStatus')?.value||'all';
  const service=$('apptSearchService')?.value||'all';
  return appointments.filter(a=>{
    const patient=patientById(a.patient_id);
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
  appointmentSearchSelected.forEach(id=>{if(!results.some(a=>String(a.id)===String(id)))appointmentSearchSelected.delete(id)});
  if($('apptSearchCount'))$('apptSearchCount').textContent=results.length+' encontrado(s)';
  if($('apptSelectedCount'))$('apptSelectedCount').textContent=appointmentSearchSelected.size+' selecionado(s)';
  if($('apptBulkBar'))$('apptBulkBar').classList.toggle('active',appointmentSearchSelected.size>0);
  target.innerHTML=results.length?results.map(a=>{
    const patient=patientById(a.patient_id),service=serviceById(a.service_id),checked=appointmentSearchSelected.has(String(a.id))?'checked':'';
    const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
    return `<div class="appointment-search-row status-${a.status}"><label class="appt-check"><input type="checkbox" ${checked} onchange="toggleAppointmentSearchSelection('${a.id}',this.checked)"></label><div class="appt-search-main"><strong>${esc(patient.name||'Paciente')}</strong><span>${fmtWeekday(a.appointment_date)} · ${fmtDate(a.appointment_date)} · ${normalizeTime(a.start_time)}-${normalizeTime(a.end_time)} · ${esc(service.name||'Sem serviço')}</span></div><span class="status-chip ${a.status}">${label}</span><div class="appt-search-actions"><button class="btn small" onclick="openAppt('${a.appointment_date}','${a.id}')">Editar</button><button class="btn small warning" onclick="cancelAppointmentFromSearch('${a.id}')">Cancelar</button><button class="btn small danger" onclick="deleteAppointmentFromSearch('${a.id}')">Apagar</button></div></div>`;
  }).join(''):'<div class="muted small">Nenhum agendamento encontrado.</div>';
}
function toggleAppointmentSearchSelection(id,checked){if(checked)appointmentSearchSelected.add(String(id));else appointmentSearchSelected.delete(String(id));renderAppointmentSearch()}
function clearAppointmentSearch(){['apptSearchText','apptSearchFrom','apptSearchTo'].forEach(id=>{if($(id))$(id).value=''});if($('apptSearchStatus'))$('apptSearchStatus').value='all';if($('apptSearchService'))$('apptSearchService').value='all';appointmentSearchSelected.clear();renderAppointmentSearch()}
async function cancelAppointmentFromSearch(id){if(!confirm('Cancelar este agendamento?'))return;try{await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify({status:'cancelado'})});appointmentSearchSelected.delete(String(id));await loadAll(true);toast('Agendamento cancelado.','success')}catch(e){toast('Erro ao cancelar: '+e.message,'error')}}
async function deleteAppointmentFromSearch(id){if(!confirm('Apagar definitivamente este agendamento?'))return;try{await api('appointments?id=eq.'+id,{method:'DELETE'});appointmentSearchSelected.delete(String(id));await loadAll(true);toast('Agendamento apagado.','success')}catch(e){toast('Erro ao apagar: '+e.message,'error')}}
function selectedAppointmentIds(){return [...appointmentSearchSelected].filter(id=>appointments.some(a=>String(a.id)===String(id)))}
async function bulkCancelAppointments(){const ids=selectedAppointmentIds();if(!ids.length){toast('Selecione ao menos um agendamento.','warning');return}if(!confirm('Cancelar '+ids.length+' agendamento(s) selecionado(s)?'))return;try{for(const id of ids){await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify({status:'cancelado'})})}appointmentSearchSelected.clear();await loadAll(true);toast(ids.length+' agendamento(s) cancelado(s).','success')}catch(e){toast('Erro no cancelamento em massa: '+e.message,'error')}}
async function bulkDeleteAppointments(){const ids=selectedAppointmentIds();if(!ids.length){toast('Selecione ao menos um agendamento.','warning');return}const typed=prompt('Digite APAGAR para excluir definitivamente '+ids.length+' agendamento(s).');if(typed!=='APAGAR')return;try{for(const id of ids){await api('appointments?id=eq.'+id,{method:'DELETE'})}appointmentSearchSelected.clear();await loadAll(true);toast(ids.length+' agendamento(s) apagado(s).','success')}catch(e){toast('Erro ao apagar em massa: '+e.message,'error')}}
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
  $('periodLabel').textContent=currentDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  $('monthHead').innerHTML=`<div class="month-list-head"><div><div class="eyebrow">Agenda do mês</div><h3>${currentDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h3></div><div class="month-list-tools"><button class="btn ghost" type="button" onclick="toggleMonthEmptyDays()">${showEmpty?'Ocultar dias vazios':'Mostrar dias vazios'}</button><span class="muted small">Lista mensal oficial da FEMIC</span></div></div>`;
  const daysInMonth=new Date(y,m+1,0).getDate();
  let html='<div class="month-agenda-list">';
  let rendered=0,totalAppointments=0,totalConfirmed=0,totalDone=0;
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,m,day);
    const ds=isoDate(d);
    const list=agendaFiltered(appointments.filter(a=>a.appointment_date===ds)).sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
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
    const peak=slots().reduce((max,slot)=>{
      const slotStart=timeToMin(slot);
      const slotEnd=timeToMin(addMinutes(slot,Number(settings.slot_interval_minutes||30)));
      const count=list.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<slotEnd&&timeToMin(normalizeTime(a.end_time))>slotStart).length;
      return Math.max(max,count);
    },0);
    html+=`<section class="month-agenda-day ${ds===todayIso()?'today':''} ${isClosedForView(ds)?'off':''}">`;
    html+=`<div class="month-agenda-day-head"><div><div class="month-agenda-date">${names[d.getDay()]}, ${fmtDate(ds)}</div><div class="muted small">${list.length?`${list.length} atendimento(s) no dia`:'Dia livre'}</div></div><div class="month-agenda-summary"><span>${counts.agendado} ag.</span><span>${counts.confirmado} conf.</span><span>${counts.concluido} concl.</span><span>Pico ${peak}/${Number(settings.max_patients_per_slot||4)}</span><button class="btn" type="button" onclick="openAppt('${ds}')">+ Agendar</button></div></div>`;
    html+=list.length?`<div class="month-agenda-items">`+list.map(a=>{
      const patient=patientName(a.patient_id);
      const service=serviceName(a.service_id);
      const statusLabel={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
      return `<button class="month-agenda-item status-${a.status}" type="button" onclick="openAppt('${a.appointment_date}','${a.id}')"><span class="month-agenda-time"><strong>${normalizeTime(a.start_time)}</strong><small>${normalizeTime(a.end_time)}</small></span><span class="month-agenda-main"><strong>${esc(patient)}</strong><small>${esc(service)}</small></span><span class="status-chip ${a.status}">${esc(statusLabel)}</span></button>`;
    }).join('')+`</div>`:`<div class="month-agenda-empty"><span>Sem atendimentos neste dia.</span><button class="btn ghost" type="button" onclick="openAppt('${ds}')">Criar atendimento</button></div>`;
    html+=`</section>`;
  }
  if(!rendered) html+=`<div class="month-agenda-empty-state"><strong>Nenhum atendimento encontrado neste mês com os filtros atuais.</strong><span>Use "Mostrar dias vazios" para criar encaixes ou limpe os filtros da agenda.</span></div>`;
  html+='</div>';
  $('monthCalendar').innerHTML=`<div class="month-agenda-kpis"><div><span>Total no mês</span><strong>${totalAppointments}</strong></div><div><span>Confirmados</span><strong>${totalConfirmed}</strong></div><div><span>Concluídos</span><strong>${totalDone}</strong></div><div><span>Dias exibidos</span><strong>${rendered}</strong></div></div>`+html;
}
function saldoBadge(pid,sid){const pk=packages.find(p=>String(p.patient_id)===String(pid)&&String(p.service_id)===String(sid)&&p.active!==false);if(!pk)return '<div class="small muted">Sem pacote</div>';const total=Number(pk.total_sessions||0),r=Number(pk.remaining_sessions||0),used=Math.max(0,total-r);return `<div class="small ${r===0?'saldo-zero':r<=3?'saldo-low':'muted'}"><span class="used-counter">${used}/${total} sessões usadas</span> · saldo ${r}</div>`}
function getServiceDefaultPrice(sid){const s=serviceById(sid);return Number(s.price||0)}
function setAppointmentPriceFromService(force=false){const input=$('apptPrice');if(!input)return;const current=String(input.value||'').trim();if(force||!current){input.value=String(getServiceDefaultPrice($('apptService').value)||0)}}
function openAppt(date=null,id=null,slot=null){$('apptId').value=id||'';$('rescheduleOriginId').value='';$('rescheduleCancelOriginal').value='';$('recurring').checked=false;toggleRecurrence();recurringSuggestionCache=[];if($('recSuggestionList'))$('recSuggestionList').innerHTML='';$('deleteApptBtn').style.display=id?'inline-flex':'none';if(id){const a=appointments.find(x=>String(x.id)===String(id));if(!a)return;$('apptPatient').value=a.patient_id;$('apptService').value=a.service_id;$('apptStatus').value=a.status;$('apptDate').value=a.appointment_date;$('apptStart').value=normalizeTime(a.start_time);$('apptEnd').value=normalizeTime(a.end_time);$('apptPrice').value=Number(a.service_price_at_time!=null?a.service_price_at_time:getServiceDefaultPrice(a.service_id));$('apptTitle').textContent='Editar agendamento'}else{$('apptPatient').value='';$('apptService').value='';$('apptStatus').value='agendado';$('apptDate').value=date||todayIso();$('apptStart').value=slot||(parsePeriods()[0]?.start)||settings.start_time||'08:00';$('apptEnd').value='';$('apptPrice').value='';$('apptTitle').textContent='Novo agendamento'}showSaldoInfo();$('apptModal').classList.add('show')}
function closeModal(id){$(id).classList.remove('show')}function toggleRecurrence(){$('recFields').classList.toggle('hidden',!$('recurring').checked); if($('recurring').checked) syncRecurrenceTimes()}
function toggleRecDayCard(i){const card=$('recCard'+i);if(card)card.classList.toggle('active',card.querySelector('.recDay')?.checked);previewRecurringEnd(i)}
function syncRecurrenceTimes(){document.querySelectorAll('.recTime').forEach(inp=>{if(!inp.value)inp.value=$('apptStart').value||'08:00'});document.querySelectorAll('.recDay').forEach(ch=>toggleRecDayCard(ch.value));}
function previewRecurringEnd(i){const inp=$('recTime'+i),out=$('recEnd'+i),s=serviceById($('apptService').value);if(!inp||!out)return;if(!$('apptService').value){out.textContent='Selecione o serviço';return}const start=inp.value||$('apptStart').value||'08:00';const end=addMinutes(start,Number(s.duration_minutes||45));out.textContent='Fim previsto: '+end;}function onServiceChange(updatePrice=false){const sid=$('apptService').value;if(!sid){$('apptEnd').value='';if(updatePrice)$('apptPrice').value='';showSaldoInfo();document.querySelectorAll('.recDay:checked').forEach(ch=>previewRecurringEnd(ch.value));return}const s=serviceById(sid);$('apptEnd').value=addMinutes($('apptStart').value||settings.start_time,Number(s.duration_minutes||45));if(updatePrice)setAppointmentPriceFromService(true);showSaldoInfo();document.querySelectorAll('.recDay:checked').forEach(ch=>previewRecurringEnd(ch.value))}
function showSaldoInfo(){const pid=$('apptPatient').value,sid=$('apptService').value;if(!pid&&!sid){$('saldoInfo').innerHTML='Selecione paciente e serviço para visualizar pacote e saldo.';return}if(!pid){$('saldoInfo').innerHTML='Selecione o paciente para visualizar pacote e saldo.';return}if(!sid){$('saldoInfo').innerHTML='Selecione o serviço para visualizar pacote e saldo.';return}const pk=packages.find(p=>String(p.patient_id)===String(pid)&&String(p.service_id)===String(sid)&&p.active!==false);const future=appointments.filter(a=>String(a.patient_id)===String(pid)&&String(a.service_id)===String(sid)&&['agendado','confirmado'].includes(a.status)&&String(a.appointment_date||'')>=todayIso()).length;if(!pk)$('saldoInfo').innerHTML='Sem pacote ativo para este paciente/serviço.';else $('saldoInfo').innerHTML=`Pacote: ${pk.total_sessions} sessões · saldo ${pk.remaining_sessions} · futuras agendadas ${future} · disponível aproximado ${Number(pk.remaining_sessions||0)-future}`}
function conflictInAppointmentList(candidate,list,ignoreId=null){const sNew=serviceById(candidate.service_id);const n1=timeToMin(candidate.start_time),n2=timeToMin(candidate.end_time);const sameDay=(list||[]).filter(a=>a.appointment_date===candidate.appointment_date&&a.status!=='cancelado'&&String(a.id)!==String(ignoreId));const overlaps=sameDay.filter(a=>timeToMin(normalizeTime(a.start_time))<n2 && timeToMin(normalizeTime(a.end_time))>n1);if(!overlaps.length)return null;if((sNew.appointment_mode||'grupo')==='individual')return 'Serviço individual exige horário exclusivo.';if(overlaps.some(a=>(serviceById(a.service_id).appointment_mode||'grupo')==='individual'))return 'Já existe atendimento individual neste intervalo.';const max=Number(sNew.max_patients||settings.max_patients_per_slot||4);if(overlaps.length>=max)return 'Limite de pacientes simultâneos atingido.';return null}
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
async function saveAppointment(){const saveBtn=$('saveApptBtn');try{if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...'}const id=$('apptId').value;if(!$('apptPatient').value){toast('Selecione o paciente antes de salvar.','warning');$('apptPatient').focus();return}if(!$('apptService').value){toast('Selecione o serviço antes de salvar.','warning');$('apptService').focus();return}if(!$('apptDate').value){toast('Informe a data do atendimento.','warning');$('apptDate').focus();return}if(!$('apptStart').value){toast('Informe o horário inicial.','warning');$('apptStart').focus();return}const s=serviceById($('apptService').value);if(!$('apptEnd').value) $('apptEnd').value=addMinutes($('apptStart').value,Number(s.duration_minutes||45));const agreedPrice=Number(String($('apptPrice')?.value||'0').replace(',','.'));if(!Number.isFinite(agreedPrice)||agreedPrice<0){toast('Informe um valor válido para a sessão.','warning');$('apptPrice')?.focus();return}const basePayload={patient_id:$('apptPatient').value,service_id:$('apptService').value,appointment_date:$('apptDate').value,start_time:$('apptStart').value,end_time:$('apptEnd').value,duration_minutes:Number(s.duration_minutes||45),status:$('apptStatus').value,service_price_at_time:agreedPrice};if(timeToMin(basePayload.end_time)<=timeToMin(basePayload.start_time)){toast('O horário final precisa ser maior que o inicial.','warning');return}if(!isTodayDate(basePayload.appointment_date)&&!isWorking(basePayload.appointment_date)){toast('Dia fora do expediente.','warning');return}if(!isInsideWorkingTime(basePayload.appointment_date,basePayload.start_time,basePayload.end_time)){toast('Horário fora dos períodos de expediente configurados.','warning');return}if($('recurring').checked&&!id){await saveRecurring(basePayload);return}const msg=hasConflict(basePayload,id);if(msg){toast(msg,'warning');return}let old=id?appointments.find(a=>String(a.id)===String(id)):null;let saved=await persistAppointment(id,basePayload);await handlePackageMovement(old,saved);if(!id&&$('rescheduleOriginId').value){await finalizeReschedule($('rescheduleOriginId').value,$('rescheduleCancelOriginal').value==='true')}closeModal('apptModal');await loadAll(true);toast('Agendamento salvo.','success')}catch(e){toast('Erro ao salvar: '+e.message,'error')}finally{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Salvar agendamento'}}}
async function saveRecurring(payload){const selected=[...document.querySelectorAll('.recDay:checked')].map(x=>Number(x.value));const count=Number($('recCount').value||1);if(!selected.length){toast('Selecione ao menos um dia da semana.','warning');return}const s=serviceById(payload.service_id);const dayTimes={};selected.forEach(d=>{dayTimes[d]=($('recTime'+d)?.value||payload.start_time||'08:00')});let created=0,conflicts=0,date=new Date(payload.appointment_date+'T00:00:00'),tries=0;while(created<count&&tries<370){const ds=isoDate(date),dow=date.getDay();if(selected.includes(dow)&&(isTodayDate(ds)||isWorking(ds))){const st=dayTimes[dow]||payload.start_time;const cand={...payload,appointment_date:ds,start_time:st,end_time:addMinutes(st,Number(s.duration_minutes||payload.duration_minutes||45)),duration_minutes:Number(s.duration_minutes||payload.duration_minutes||45)};let dayRows=appointments.filter(a=>a.appointment_date===ds);try{dayRows=await fetchAppointmentsForDate(ds)}catch(e){}const msg=conflictInAppointmentList(cand,dayRows);if(msg||!isInsideWorkingTime(cand.appointment_date,cand.start_time,cand.end_time))conflicts++;else{const saved=await persistAppointment(null,cand);dayRows.push(saved);created++}}date.setDate(date.getDate()+1);tries++}closeModal('apptModal');await loadAll(true);toast(`${created} agendamentos criados. ${conflicts} conflitos ignorados.`,'success')}
async function handlePackageMovement(oldA,newA){if(!newA)return;if(oldA&&oldA.status==='concluido'&&oldA.package_consumed&&newA.status!=='concluido'){await refundPackage(oldA);return}if(newA.status==='concluido'&&!newA.package_consumed){await consumePackage(newA)}}
async function consumePackage(a){const pk=packages.find(p=>String(p.patient_id)===String(a.patient_id)&&String(p.service_id)===String(a.service_id)&&p.active!==false);if(!pk){toast('Concluído, mas sem pacote para consumir.','warning');return}if(Number(pk.remaining_sessions||0)<=0){toast('Concluído, mas pacote sem saldo.','warning');return}await api('session_packages?id=eq.'+pk.id,{method:'PATCH',body:JSON.stringify({remaining_sessions:Number(pk.remaining_sessions)-1})});await api('appointments?id=eq.'+a.id,{method:'PATCH',body:JSON.stringify({package_consumed:true,session_package_id:pk.id})});await api('session_movements',{method:'POST',body:JSON.stringify({patient_id:a.patient_id,appointment_id:a.id,session_package_id:pk.id,type:'consumo',quantity:-1})})}
async function refundPackage(a){const pk=packages.find(p=>String(p.id)===String(a.session_package_id));if(pk){await api('session_packages?id=eq.'+pk.id,{method:'PATCH',body:JSON.stringify({remaining_sessions:Number(pk.remaining_sessions||0)+1})});await api('session_movements',{method:'POST',body:JSON.stringify({patient_id:a.patient_id,appointment_id:a.id,session_package_id:pk.id,type:'estorno',quantity:1})})}await api('appointments?id=eq.'+a.id,{method:'PATCH',body:JSON.stringify({package_consumed:false,session_package_id:null})})}
async function finalizeReschedule(originId,cancelOriginal){const old=appointments.find(a=>String(a.id)===String(originId));if(!old||!cancelOriginal)return;if(old.status==='concluido'&&old.package_consumed)await refundPackage(old);await api('appointments?id=eq.'+originId,{method:'PATCH',body:JSON.stringify({status:'cancelado'})});}
function rescheduleAppointment(id){const a=appointments.find(x=>String(x.id)===String(id));if(!a)return;const cancelOriginal=confirm('Remarcar cancelando o agendamento original? Clique em OK para cancelar o original e criar um novo. Clique em Cancelar para criar novo sem cancelar o original.');openAppt(a.appointment_date,null,normalizeTime(a.start_time));$('apptPatient').value=a.patient_id;$('apptService').value=a.service_id;$('apptStatus').value='agendado';$('apptDate').value=a.appointment_date;$('apptStart').value=normalizeTime(a.start_time);onServiceChange();$('rescheduleOriginId').value=id;$('rescheduleCancelOriginal').value=cancelOriginal?'true':'false';$('apptTitle').textContent='Remarcar atendimento';toast(cancelOriginal?'Escolha novo horário. O original será cancelado ao salvar.':'Escolha novo horário. O original será mantido.','info')}
async function deleteAppointment(){const id=$('apptId').value;if(!id||!confirm('Remover este agendamento?'))return;try{await api('appointments?id=eq.'+id,{method:'DELETE'});closeModal('apptModal');await loadAll(true);toast('Agendamento removido.','success')}catch(e){toast('Erro ao remover: '+e.message,'error')}}
function renderDay(){
  const date=$('dayDate').value||todayIso();$('dayDate').value=date;
  const list=appointments.filter(a=>a.appointment_date===date).sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
  const dayStatusLabels={concluido:'Concluídos',cancelado:'Cancelados'};
  const peak=slots().reduce((max,slot)=>{
    const slotStart=timeToMin(slot);
    const slotEnd=timeToMin(addMinutes(slot,Number(settings.slot_interval_minutes||30)));
    const count=list.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<slotEnd&&timeToMin(normalizeTime(a.end_time))>slotStart).length;
    return Math.max(max,count);
  },0);
  $('dayKpis').innerHTML=`<div class="day-operational-strip"><div class="day-operational-copy"><strong>${fmtWeekday(date)}, ${fmtDate(date)}</strong><span>${list.length} atendimento(s) · pico ${peak}/${Number(settings.max_patients_per_slot||4)}</span></div><div class="day-status-row compact">`+['concluido','cancelado'].map(st=>`<div class="day-status-pill ${st}"><span>${dayStatusLabels[st]}</span><strong>${list.filter(a=>a.status===st).length}</strong></div>`).join('')+`</div></div>`;
  $('dayList').innerHTML=list.length?list.map(a=>{
    const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
    const nextStatuses=getNextStatuses(a.status);
    return `<div class="item status-${a.status}" style="padding:10px 12px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="appt-weekday" style="margin:0;font-size:.7rem">${weekdayShort(a.appointment_date)}</span>
          <strong style="font-size:.9rem">${normalizeTime(a.start_time)}–${normalizeTime(a.end_time)}</strong>
          <span class="status-chip ${a.status}" style="font-size:.68rem;padding:3px 6px">${label}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:.82rem;font-weight:700">${esc(patientName(a.patient_id))}</span>
          <span class="muted" style="font-size:.72rem">${esc(serviceName(a.service_id))}${saldoBadgeInline(a.patient_id,a.service_id)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:8px">
          <button class="btn" style="padding:6px 10px;font-size:.72rem" onclick="openPatient('${a.patient_id}')" title="Ficha">👤 Ficha</button>
          <button class="btn" style="padding:6px 10px;font-size:.72rem" onclick="openAppt('${a.appointment_date}','${a.id}')" title="Editar">✏️ Editar</button>
          <button class="btn primary" style="padding:6px 10px;font-size:.72rem" onclick="sendWhatsapp('${a.id}',false,'appointment')" title="WhatsApp">💬 WhatsApp</button>
          <select onchange="quickStatus('${a.id}',this.value);this.value=''" style="width:auto;padding:6px 10px;font-size:.72rem;border-radius:10px;min-width:42px" title="Alterar status">
            <option value="">⚡ Status</option>
            ${nextStatuses.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  }).join(''):'<div class="muted">Nenhum agendamento.</div>';
}
function reminderFlag(a,kind){return kind==='form'?!!a.form_reminder_sent:!!(a.appointment_reminder_sent||a.reminder_sent)}
function appointmentDateTime(a,field='start_time'){
  const date=String(a.appointment_date||'');
  const time=normalizeTime(a[field]||a.start_time||'00:00');
  const d=new Date(date+'T'+time+':00');
  return Number.isNaN(d.getTime())?null:d;
}
function reminderDueAt(a,kind){
  const base=appointmentDateTime(a,kind==='form'?'end_time':'start_time');
  if(!base) return null;
  return kind==='form'?new Date(base.getTime()+(5*60*60*1000)):new Date(base.getTime()-(12*60*60*1000));
}
function isReminderCandidate(a,kind){
  return kind==='form'?a.status==='concluido':['agendado','confirmado'].includes(a.status);
}
function reminderPhoneOk(a){return cleanPhone(patientById(a.patient_id).whatsapp).length>=10}
function reminderDueLabel(a,kind){
  const due=reminderDueAt(a,kind);
  if(!due) return 'Sem horário válido';
  const diff=due.getTime()-Date.now();
  if(diff<=0) return 'Vencido para envio';
  const mins=Math.ceil(diff/60000);
  if(mins<60) return 'Vence em '+mins+' min';
  const hours=Math.floor(mins/60), rest=mins%60;
  return 'Vence em '+hours+'h'+(rest?String(rest).padStart(2,'0'):'');
}
function getReminderMode(){return localStorage.getItem('femic_reminder_mode')==='auto'?'auto':'manual'}
function setReminderMode(mode){
  localStorage.setItem('femic_reminder_mode',mode==='auto'?'auto':'manual');
  renderReminderAutomationStatus();
  renderReminders();
  if(mode==='auto'){
    toast('Envio automático ativado. Mantenha a agenda aberta para disparar os WhatsApps.','info');
    processAutomaticReminders();
  }else{
    toast('Envio manual ativado.','info');
  }
}
function renderReminderAutomationStatus(){
  const mode=getReminderMode();
  const badge=$('reminderModeBadge'),status=$('reminderAutoStatus'),manual=$('manualModeBtn'),auto=$('autoModeBtn');
  if(badge){badge.className='mode-badge '+mode;badge.textContent=mode==='auto'?'Automático':'Manual'}
  if(status) status.textContent=mode==='auto'?'Automático ativo: verifica vencidos a cada minuto e abre o WhatsApp quando chegar a hora.':'Manual: você escolhe quando enviar.';
  if(manual) manual.classList.toggle('primary',mode==='manual');
  if(auto) auto.classList.toggle('primary',mode==='auto');
}
function reminderListFor(kind,date){
  return appointments
    .filter(a=>a.appointment_date===date&&isReminderCandidate(a,kind))
    .sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
}
function dueAutomaticReminders(){
  const now=Date.now();
  return ['appointment','form'].flatMap(kind=>appointments
    .filter(a=>isReminderCandidate(a,kind)&&!reminderFlag(a,kind)&&reminderPhoneOk(a))
    .map(a=>({a,kind,due:reminderDueAt(a,kind)}))
    .filter(x=>{
      if(!x.due||x.due.getTime()>now) return false;
      const start=appointmentDateTime(x.a,'start_time');
      if(x.kind==='form') return now<=x.due.getTime()+(24*60*60*1000);
      return start&&now<=start.getTime();
    })
  ).sort((x,y)=>x.due-y.due);
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
function aiRadarSlotStatus(date,start,end,rows){
  const max=Number(settings.max_patients_per_slot||4);
  const startMin=timeToMin(start),endMin=timeToMin(end);
  const overlaps=rows.filter(a=>a.status!=='cancelado'&&timeToMin(normalizeTime(a.start_time))<endMin&&timeToMin(normalizeTime(a.end_time))>startMin);
  const hasIndividual=overlaps.some(a=>(serviceById(a.service_id).appointment_mode||'grupo')==='individual');
  const occupied=overlaps.length;
  const remaining=hasIndividual?0:Math.max(0,max-occupied);
  const names=overlaps.slice(0,3).map(a=>patientName(a.patient_id));
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
  const weeks=[];
  for(let w=0;w<4;w++){
    const weekStartDate=new Date(start);
    weekStartDate.setDate(start.getDate()+(w*7));
    const week={start:isoDate(weekStartDate),days:[],counts:{best:0,open:0,almost:0,full:0,total:0}};
    for(let d=0;d<7;d++){
      const day=new Date(weekStartDate);
      day.setDate(weekStartDate.getDate()+d);
      const ds=isoDate(day);
      const dayRows=rows.filter(a=>a.appointment_date===ds);
      const daySlots=isWorking(ds)?slotList.map(slot=>{
        const end=addMinutes(slot,Number(settings.slot_interval_minutes||30));
        const item=aiRadarSlotStatus(ds,slot,end,dayRows);
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
  const kind=$('reminderType')?$('reminderType').value:'appointment';
  const date=$('reminderDate').value||isoDate(new Date(Date.now()+86400000));
  $('reminderDate').value=date;
  renderReminderAutomationStatus();
  const list=reminderListFor(kind,date);
  $('reminderTitle').textContent=kind==='form'?'Formulários pós-atendimento':'Lembretes de sessão';
  const pending=list.filter(a=>!reminderFlag(a,kind)&&reminderPhoneOk(a));
  const sent=list.filter(a=>reminderFlag(a,kind));
  const no=list.filter(a=>!reminderFlag(a,kind)&&!reminderPhoneOk(a));
  const due=pending.filter(a=>{const d=reminderDueAt(a,kind);return d&&d.getTime()<=Date.now();});
  $('reminderKpis').innerHTML=`<div class="kpi"><div class="small muted">Pendentes</div><strong>${pending.length}</strong></div><div class="kpi"><div class="small muted">Vencidos agora</div><strong>${due.length}</strong></div><div class="kpi"><div class="small muted">Enviados</div><strong>${sent.length}</strong></div><div class="kpi"><div class="small muted">Sem WhatsApp</div><strong>${no.length}</strong></div>`;
  $('reminderList').innerHTML=list.length?list.map(a=>{
    const p=patientById(a.patient_id),sentFlag=reminderFlag(a,kind),phoneOk=reminderPhoneOk(a),dueText=sentFlag?'Enviado':reminderDueLabel(a,kind),cls=sentFlag?'reminder-enviado':phoneOk?'reminder-pendente':'reminder-semwhats';
    return `<div class="item ${cls}"><div class="item-top"><div><strong>${normalizeTime(a.start_time)} — ${esc(p.name||'Paciente')}</strong><div class="muted small">${esc(p.whatsapp||'Sem WhatsApp')} · ${esc(serviceName(a.service_id))} · <span class="status-chip ${a.status}">${a.status}</span> · <span class="reminder-state ${cls}">${esc(dueText)}</span></div></div><div class="toolbar">${sentFlag?'<span class="status-chip concluido">Enviado</span>':phoneOk?`<button class="btn primary" onclick="sendWhatsapp('${a.id}',true,'${kind}')">Enviar</button><button class="btn" onclick="markReminder('${a.id}','${kind}')">Marcar enviado</button>`:'<span class="status-chip cancelado">Sem WhatsApp</span>'}</div></div></div>`;
  }).join(''):'<div class="muted">Nenhum lembrete nesta data.</div>';
}
async function markReminder(id,kind='appointment'){
  const now=new Date().toISOString();
  const body=kind==='form'
    ? {form_reminder_sent:true,form_reminder_sent_at:now}
    : {appointment_reminder_sent:true,appointment_reminder_sent_at:now,reminder_sent:true,reminder_sent_at:now};
  await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify(body)});
  await loadAll(true);
  renderReminders();
  toast('Lembrete marcado como enviado.','success');
}
async function sendWhatsapp(id,mark=false,kind='appointment'){
  const a=appointments.find(x=>String(x.id)===String(id));if(!a)return false;
  if((localStorage.femic_whatsapp_provider||'wa_me')==='api'){
    toast('API preparada, mas envio real ainda usa link seguro até a Edge Function estar implementada.','info');
  }
  const p=patientById(a.patient_id);const phone='55'+cleanPhone(p.whatsapp);
  if(phone.length<12){toast('Paciente sem WhatsApp válido.','warning');return false}
  const defaultTpl=kind==='form'?'Olá, {nome}! Obrigado por comparecer à FEMIC. Quando puder, responda o formulário pós-atendimento: {form_link}':'';
  const tpl=kind==='form'
    ? (localStorage.femic_tpl_form_reminder||($('tplFormReminder')?.value)||defaultTpl)
    : ((localStorage.femic_tpl_reminder||$('tplReminder').value)||'');
  const msg=tpl.replaceAll('{nome}',p.name||'').replaceAll('{data}',fmtDate(a.appointment_date)).replaceAll('{hora}',normalizeTime(a.start_time)).replaceAll('{servico}',serviceName(a.service_id)).replaceAll('{form_link}',localStorage.femic_form_link||($('formLinkInput')?.value)||'');
  const opened=window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg),'_blank');
  if(!opened){toast('O navegador bloqueou a janela do WhatsApp. Use o modo manual ou libere pop-ups para a agenda.','warning');return false}
  if(mark) await markReminder(id,kind);
  return true;
}
function sendNextReminder(){
  const kind=$('reminderType')?$('reminderType').value:'appointment';
  const date=$('reminderDate').value;
  const next=reminderListFor(kind,date).filter(a=>!reminderFlag(a,kind)&&reminderPhoneOk(a)).sort((a,b)=>normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)))[0];
  if(!next)toast('Nenhum lembrete pendente.','info');else sendWhatsapp(next.id,true,kind);
}
function renderWhatsappProviderBadge(){
  const provider=$('whatsappProvider')?.value||localStorage.femic_whatsapp_provider||'wa_me';
  const badge=$('whatsappProviderBadge');
  if(!badge) return;
  badge.className='mode-badge '+(provider==='api'?'auto':'manual');
  badge.textContent=provider==='api'?'API preparada':'wa.me';
}
function saveWhatsappApiConfig(){
  const provider=$('whatsappProvider')?.value||'wa_me';
  localStorage.femic_whatsapp_provider=provider;
  localStorage.femic_whatsapp_endpoint=($('whatsappEndpoint')?.value||'').trim();
  localStorage.femic_whatsapp_tpl_appointment=($('whatsappTplAppointment')?.value||'lembrete_sessao').trim()||'lembrete_sessao';
  localStorage.femic_whatsapp_tpl_form=($('whatsappTplForm')?.value||'formulario_pos_sessao').trim()||'formulario_pos_sessao';
  renderWhatsappProviderBadge();
  if(provider==='api') toast('Configuração salva. O envio pela API fica preparado, mas o sistema mantém fallback seguro por link até a Edge Function ser implementada.','info');
  else toast('WhatsApp por link seguro ativado.','success');
}
function testWhatsappApiConfig(){
  const provider=$('whatsappProvider')?.value||'wa_me';
  const endpoint=($('whatsappEndpoint')?.value||'').trim();
  if(provider==='wa_me'){toast('Configuração atual usa link WhatsApp seguro.','success');return}
  if(!endpoint||!/^https:\/\/[a-z0-9-]+\.functions\.supabase\.co\/[a-z0-9-_/]+$/i.test(endpoint)){
    toast('Informe uma URL de Supabase Edge Function válida.','warning');
    return;
  }
  toast('Formato local aprovado. Próximo passo: criar a Edge Function com o token da Meta no Supabase.','success');
}
function statusButtons(a){
  const id=String(a.id);
  return `<div class="status-actions">
    <button class="btn success status-mini" ${a.status==='concluido'?'disabled':''} onclick="quickStatus('${id}','concluido')">✓ Concluir</button>
    <button class="btn danger status-mini" ${a.status==='cancelado'?'disabled':''} onclick="quickStatus('${id}','cancelado')">✕ Cancelar</button>
  </div>`;
}
async function quickStatus(id,newStatus){
  const old=appointments.find(a=>String(a.id)===String(id));
  if(!old) return;
  if(old.status===newStatus){toast('Este agendamento já está com esse status.','info');return;}
  const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[newStatus]||newStatus;
  if(!confirm('Alterar status para '+label+'?')) return;
  try{
    const updated=(await api('appointments?id=eq.'+id,{method:'PATCH',body:JSON.stringify({status:newStatus})}))[0] || {...old,status:newStatus};
    await handlePackageMovement(old,updated);
    await loadAll(true);
    toast('Status atualizado para '+label+'.','success');
  }catch(e){console.error(e);toast('Erro ao alterar status: '+e.message,'error')}
}
function renderReport(){const month=$('reportMonth').value||new Date().toISOString().slice(0,7);$('reportMonth').value=month;refreshReportMonthIfNeeded(month);const done=appointments.filter(a=>a.status==='concluido'&&String(a.appointment_date).startsWith(month));const groups={};done.forEach(a=>{const s=serviceById(a.service_id),key=(s.health_insurance_id||'')+'|'+(s.id||'')+'|'+Number(a.service_price_at_time||s.price||0);if(!groups[key])groups[key]={payer:payerName(s.health_insurance_id),service:s.name||'Sem serviço',q:0,price:Number(a.service_price_at_time||s.price||0)};groups[key].q++});const rows=Object.values(groups),total=rows.reduce((a,r)=>a+r.q*r.price,0);$('reportKpis').innerHTML=`<div class="kpi"><div class="small muted">Concluídos</div><strong>${done.length}</strong></div><div class="kpi"><div class="small muted">Total</div><strong>${brl(total)}</strong></div><div class="kpi"><div class="small muted">Cancelados</div><strong>${appointments.filter(a=>a.status==='cancelado'&&String(a.appointment_date).startsWith(month)).length}</strong></div><div class="kpi"><div class="small muted">Agendados</div><strong>${appointments.filter(a=>['agendado','confirmado'].includes(a.status)&&String(a.appointment_date).startsWith(month)).length}</strong></div>`;$('reportBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.payer)}</td><td>${esc(r.service)}</td><td>${r.q}</td><td>${brl(r.price)}</td><td><strong>${brl(r.q*r.price)}</strong></td></tr>`).join(''):'<tr><td colspan="5" class="muted">Sem atendimentos concluídos.</td></tr>'}
function exportCsv(){const rows=[['Pagador','Serviço','Quantidade','Valor','Total']];document.querySelectorAll('#reportBody tr').forEach(tr=>{const cells=[...tr.children].map(td=>td.innerText);if(cells.length===5)rows.push(cells)});const csv=rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='relatorio_agenda_femic.csv';a.click()}


function packagePatternSummary(p){
  try{
    if(!p || !Array.isArray(appointments)) return '';
    const packageId = String(p.id);
    const hasDirectLinks = appointments.some(a => String(a.session_package_id || '') === packageId);
    const related = appointments.filter(a => {
      if(String(a.patient_id) !== String(p.patient_id)) return false;
      if(a.status === 'cancelado') return false;
      if(hasDirectLinks) return String(a.session_package_id || '') === packageId;
      return String(a.service_id) === String(p.service_id);
    });
    if(!related.length){
      return `<div class="package-pattern"><div class="package-pattern-title">🗓️ Padrão de agendamento</div><div class="package-pattern-note">Ainda não há agendamentos suficientes para identificar dias e horários deste pacote.</div></div>`;
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
    if(!items.length) return '';
    const chips = items.slice(0,8).map(x =>
      `<span class="package-pattern-chip">${weekdayFull[x.weekday]} · ${x.time} <span class="muted">${x.count}x</span></span>`
    ).join('');
    const extra = items.length > 8 ? `<div class="package-pattern-note">+ ${items.length - 8} outro(s) horário(s) menos frequente(s).</div>` : '';
    const note = items.length > 1 ? 'Use este resumo como apoio para renovação. Ele é calculado pelo histórico e não altera os agendamentos.' : 'Padrão calculado automaticamente pelo histórico deste pacote.';
    return `<div class="package-pattern"><div class="package-pattern-title">🗓️ Padrão de agendamento</div><div class="package-pattern-list">${chips}</div>${extra}<div class="package-pattern-note">${note}</div></div>`;
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
function packageScheduleLine(a){
  if(!a)return 'Sem futuras marcadas';
  return fmtWeekday(a.appointment_date)+' · '+fmtDate(a.appointment_date)+' · '+normalizeTime(a.start_time);
}
function packageScheduleSummaryHtml(p,list){
  const st=packageScheduleStats(p,list);
  const cls=st.alert?'package-schedule-alert':'package-schedule-ok';
  const alertText=st.alert?(st.futureCount?'Última sessão futura':'Sem futuras marcadas'):'Agenda suficiente para o saldo atual';
  const action=st.toSchedule>0&&p.active!==false?`<button class="btn ghost package-complete-btn" onclick="completePackageBalance('${p.id}')">Completar saldo</button>`:'';
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
  onServiceChange(true);
}
async function completePackageBalance(id){
  const p=packages.find(x=>String(x.id)===String(id));
  if(!p){toast('Pacote não encontrado.','warning');return}
  try{
    toast('Analisando saldo e agenda do pacote...','info');
    const rows=await fetchPackageAppointments(p,true);
    const stats=packageScheduleStats(p,rows);
    if(stats.toSchedule<=0){toast('Este pacote já tem futuras suficientes para o saldo atual.','success');return}
    const pattern=inferRecentPackagePattern(rows);
    const startBase=stats.lastFuture?addDaysIso(stats.lastFuture.appointment_date,1):(stats.lastAny?addDaysIso(stats.lastAny.appointment_date,1):todayIso());
    const startDate=String(startBase)<todayIso()?todayIso():startBase;
    if(!pattern.length){
      fillRecurringFromPackage(p,stats.toSchedule,[],startDate);
      toast('Não achei padrão recente. Complete os dias manualmente no agendamento recorrente.','warning');
      return;
    }
    const patternLabel=pattern.map(x=>['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][x.weekday]+' '+x.time).join(', ');
    const ok=confirm('Completar saldo deste pacote?\n\nPaciente: '+patientName(p.patient_id)+'\nServiço: '+serviceName(p.service_id)+'\nSaldo: '+stats.remain+'\nFuturas marcadas: '+stats.futureCount+'\nNovas sessões: '+stats.toSchedule+'\nÚltima futura: '+packageScheduleLine(stats.lastFuture)+'\nPadrão: '+patternLabel);
    if(!ok)return;
    const service=serviceById(p.service_id);
    const duration=Number(service.duration_minutes||45);
    const dayTimes=pattern.reduce((acc,item)=>{if(!acc[item.weekday])acc[item.weekday]=[];acc[item.weekday].push(item.time);return acc},{});
    let created=0,conflicts=0,tries=0,date=new Date(startDate+'T00:00:00');
    while(created<stats.toSchedule&&tries<370){
      const ds=isoDate(date),wd=date.getDay(),times=dayTimes[wd]||[];
      for(const st of times){
        if(created>=stats.toSchedule)break;
        const cand={patient_id:p.patient_id,service_id:p.service_id,appointment_date:ds,start_time:st,end_time:addMinutes(st,duration),duration_minutes:duration,status:'agendado',service_price_at_time:Number(service.price||0)};
        if((!isTodayDate(ds)&&!isWorking(ds))||!isInsideWorkingTime(ds,cand.start_time,cand.end_time)){conflicts++;continue}
        const dayRows=await fetchAppointmentsForDate(ds);
        const msg=conflictInAppointmentList(cand,dayRows);
        if(msg){conflicts++;continue}
        const saved=await persistAppointment(null,cand);
        dayRows.push(saved);
        rows.push(saved);
        created++;
      }
      date.setDate(date.getDate()+1);
      tries++;
    }
    packageScheduleCache.delete(packageScheduleKey(p));
    closeModal('apptModal');
    await loadAll(true);
    toast(created+' sessão(ões) criada(s). '+conflicts+' encaixe(s) ignorado(s).',created?'success':'warning');
  }catch(e){
    console.error(e);
    toast('Erro ao completar saldo: '+e.message,'error');
  }
}
function patientCard(p){const linked=appointments.some(a=>String(a.patient_id)===String(p.id))||packages.some(pk=>String(pk.patient_id)===String(p.id))||movements.some(m=>String(m.patient_id)===String(p.id));const archived=p.archived===true;return `<div class="item patient-card ${archived?'archived':''}"><div class="item-top"><div><strong>${esc(p.name||'Sem nome')}</strong>${archived?' <span class="muted small">(inativo)</span>':''}<div class="muted small">${esc(p.whatsapp||'Sem WhatsApp')} · ${esc(p.pathology||'Sem patologia')}</div></div><div class="toolbar"><button class="btn" onclick="openPatient('${p.id}')">Ficha</button><button class="btn ghost" onclick="openEditPatient('${p.id}')">✏️ Editar</button>${archived?`<button class="btn success" onclick="reactivatePatient('${p.id}')">Reativar</button>`:`<button class="btn warning" onclick="archivePatient('${p.id}')">Inativar</button>`}<button class="btn danger" onclick="deletePatientSafe('${p.id}')">Apagar</button></div></div>${linked?'<div class="muted small" style="margin-top:8px">Possui vínculo: apagar será bloqueado; use inativar.</div>':''}</div>`}
function renderLists(){$('payerList').innerHTML=payers.map(p=>`<div class="item"><div class="item-top"><strong>${esc(p.name)}</strong><button class="btn danger" onclick="removePayer('${p.id}')">Remover</button></div></div>`).join('')||'<div class="muted">Nenhum pagador.</div>';$('serviceList').innerHTML=services.map(s=>`<div class="item"><div class="item-top"><div><strong>${esc(s.name)}</strong><div class="muted small">${payerName(s.health_insurance_id)} · ${brl(s.price)} · ${s.duration_minutes}min · ${s.appointment_mode}</div></div><button class="btn danger" onclick="removeService('${s.id}')">Remover</button></div></div>`).join('')||'<div class="muted">Nenhum serviço.</div>';const activePk=packages.filter(p=>p.active!==false),inactivePk=packages.filter(p=>p.active===false);if($('packageListActive')){$('packagesActiveCount').textContent=activePk.length+' ativo(s)';$('packagesInactiveCount').textContent=inactivePk.length+' inativo(s)';$('packageListActive').innerHTML=activePk.length?activePk.map(packageCard).join(''):'<div class="muted">Nenhum pacote ativo.</div>';$('packageListInactive').innerHTML=inactivePk.length?inactivePk.map(packageCard).join(''):'<div class="muted">Nenhum pacote inativo.</div>'}else if($('packageList')){$('packageList').innerHTML=packages.length?packages.map(packageCard).join(''):'<div class="muted">Nenhum pacote.</div>'}const activePatients=patients.filter(p=>p.archived!==true),archivedPatients=patients.filter(p=>p.archived===true);if($('patientListActive')){$('patientsActiveCount').textContent=activePatients.length+' ativo(s)';$('patientsArchivedCount').textContent=archivedPatients.length+' inativo(s)';$('patientListActive').innerHTML=activePatients.length?activePatients.map(patientCard).join(''):'<div class="muted">Nenhum paciente ativo.</div>';$('patientListArchived').innerHTML=archivedPatients.length?archivedPatients.map(patientCard).join(''):'<div class="muted">Nenhum paciente inativo.</div>'}}
function formatWhatsappInput(input){let v=input.value.replace(/\D/g,'').slice(0,11);if(v.length>6)input.value=`(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;else if(v.length>2)input.value=`(${v.slice(0,2)}) ${v.slice(2)}`;else if(v.length>0)input.value=`(${v}`;}
function makePatientId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
async function savePatient(){const name=$('newPatientName').value.trim();const whatsapp=$('newPatientWhatsapp').value.trim();const pathology=$('newPatientPathology').value.trim();if(!name){toast('Informe o nome do paciente.','warning');return}if(!/^\(\d{2}\)\s\d{5}-\d{4}$/.test(whatsapp)){toast('Digite o WhatsApp no formato (99) 99999-9999.','warning');return}const phone=cleanPhone(whatsapp);const dup=patients.find(p=>p.archived!==true&&(cleanPhone(p.whatsapp)===phone||String(p.name||'').trim().toLowerCase()===name.toLowerCase()));if(dup&&!confirm('Já existe paciente com nome ou WhatsApp parecido. Deseja cadastrar mesmo assim?'))return;const payload={id:makePatientId(),name,pathology,whatsapp,archived:false,archived_at:null};try{await api('patients',{method:'POST',body:JSON.stringify(payload)});$('newPatientName').value='';$('newPatientWhatsapp').value='';$('newPatientPathology').value='';await loadAll(true);toast('Paciente salvo no Supabase e disponível na agenda.','success')}catch(e){toast('Erro ao salvar paciente: '+e.message,'error')}}
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
    $('pkgPatient').focus();
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

  const payload={patient_id:patientId,service_id:serviceId,total_sessions:total,remaining_sessions:remaining,active:true};
  try{
    await api('session_packages',{method:'POST',body:JSON.stringify(payload)});
    $('pkgPatient').value='';
    $('pkgService').value='';
    $('pkgTotal').value='';
    $('pkgRemain').value='';
    await loadAll(true);
    toast('Pacote salvo.','success');
  }catch(e){
    toast('Erro: '+e.message,'error');
  }
}async function saveSettings(){const working=[...document.querySelectorAll('.wd:checked')].map(x=>x.value).join(',')||'1,2,3,4,5,6';const payload={start_time:$('setStart').value,end_time:$('setEnd').value,working_periods:$('setPeriods').value.trim()||(($('setStart').value||'08:00')+'-'+($('setEnd').value||'20:00')),slot_interval_minutes:Number($('setInterval').value),working_days:working,max_patients_per_slot:Number(settings.max_patients_per_slot||4)};try{if(settings.id)await api('schedule_settings?id=eq.'+settings.id,{method:'PATCH',body:JSON.stringify(payload)});else await api('schedule_settings',{method:'POST',body:JSON.stringify(payload)});await loadAll(true);toast('Expediente salvo.','success')}catch(e){toast('Erro: '+e.message,'error')}}async function removePackage(id){const p=packages.find(x=>String(x.id)===String(id));if(!p)return;const used=Number(p.total_sessions||0)-Number(p.remaining_sessions||0);const linked=appointments.some(a=>String(a.session_package_id)===String(id))||movements.some(m=>String(m.session_package_id)===String(id));if(used>0||linked){if(confirm('Este pacote já tem uso ou vínculo no histórico. Para preservar os dados, ele será inativado em vez de apagado. Continuar?')){await api('session_packages?id=eq.'+id,{method:'PATCH',body:JSON.stringify({active:false})});await loadAll(true);toast('Pacote inativado.','success')}return}if(confirm('Remover este pacote definitivamente?')){await api('session_packages?id=eq.'+id,{method:'DELETE'});await loadAll(true);toast('Pacote removido.','success')}}async function removeService(id){if(appointments.some(a=>String(a.service_id)===String(id))||packages.some(p=>String(p.service_id)===String(id))){toast('Serviço em uso. Não removi para preservar histórico.','warning');return}if(confirm('Remover serviço?')){await api('services?id=eq.'+id,{method:'DELETE'});await loadAll(true)}}async function removePayer(id){if(services.some(s=>String(s.health_insurance_id)===String(id))){toast('Pagador vinculado a serviço. Remova/inative serviços primeiro.','warning');return}if(confirm('Remover pagador?')){await api('health_insurances?id=eq.'+id,{method:'DELETE'});await loadAll(true)}}

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
    await upsertRows('session_packages', tables.session_packages);
    await upsertRows('appointments', tables.appointments);
    await upsertRows('session_movements', tables.session_movements);

    await loadAll(true);
    toast('Backup restaurado com sucesso.', 'success');
  }catch(e){
    console.error(e);
    toast('Erro ao restaurar backup: ' + e.message, 'error');
  }finally{
    event.target.value = '';
  }
}

function saveTemplates(){localStorage.femic_tpl_reminder=$('tplReminder').value;if($('tplFormReminder'))localStorage.femic_tpl_form_reminder=$('tplFormReminder').value;if($('formLinkInput'))localStorage.femic_form_link=$('formLinkInput').value.trim();toast('Modelos salvos.','success')}async function copySql(){await navigator.clipboard.writeText(SQL_SCHEMA);toast('SQL copiado.','success')}
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
    p.active !== false
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

  await api('session_packages?id=eq.' + pk.id, {
    method:'PATCH',
    body: JSON.stringify({
      remaining_sessions: remaining - 1
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
    await api('session_packages?id=eq.' + pk.id, {
      method:'PATCH',
      body: JSON.stringify({
        remaining_sessions: Number(pk.remaining_sessions || 0) + 1
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
  $('editPatientPathology').value = p.pathology || '';
  $('editPatientModal').classList.add('show');
}

async function saveEditPatient(){
  const id    = $('editPatientId').value;
  const name  = $('editPatientName').value.trim();
  const whats = $('editPatientWhatsapp').value.trim();
  const path  = $('editPatientPathology').value.trim();
  if(!name){ toast('Informe o nome do paciente.','warning'); return; }
  if(whats && !/^\(\d{2}\)\s\d{5}-\d{4}$/.test(whats)){ toast('WhatsApp inválido. Use (99) 99999-9999.','warning'); return; }
  try{
    await api('patients?id=eq.' + encodeURIComponent(id), {
      method:'PATCH',
      body: JSON.stringify({ name, whatsapp: whats, pathology: path })
    });
    closeModal('editPatientModal');
    await loadAll(true);
    toast('Paciente atualizado com sucesso.','success');
  }catch(e){
    toast('Erro ao salvar: ' + e.message,'error');
  }
}


/* =========================================================
   FEMIC Agenda v1.4.36 - Ficha com dia da semana — Correção de layout semanal + busca + edição de pacotes
   ========================================================= */

function packageCard(p){
  const total=Number(p.total_sessions||0);
  const remain=Number(p.remaining_sessions||0);
  const used=Math.max(0,total-remain);
  const pct=total?Math.min(100,(used/total)*100):0;
  const cls=remain<=0?'saldo-zero':(remain<=3?'saldo-low':'');
  const inactive=p.active===false;

  return `<div class="item package-card ${inactive?'inactive':''}">
    <div class="item-top">
      <div>
        <strong>${esc(patientName(p.patient_id))}</strong>${inactive?' <span class="muted small">(inativo)</span>':''}
        <div class="muted small">${esc(serviceName(p.service_id))}</div>
      </div>
      <div class="package-actions">
        <button class="btn" onclick="editPackage('${p.id}')">Editar</button>
        <button class="btn danger" onclick="removePackage('${p.id}')">Remover</button>
      </div>
    </div>
    <div class="small"><span class="used-counter">${used}/${total} sessões usadas</span> · <span class="${cls}">saldo ${remain}</span></div>
    <div class="package-progress"><span style="width:${pct}%"></span></div>
    ${inactive?'':`<div class="package-schedule-placeholder" data-package-schedule-id="${esc(p.id)}">Verificando agenda do pacote...</div>`}
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
  const payload = {
    total_sessions: newTotal,
    remaining_sessions: newRemaining,
    active: keepActive
  };

  const msg =
    'Confirmar edição do pacote?\n\n' +
    'Paciente: ' + patientName(p.patient_id) + '\n' +
    'Serviço: ' + serviceName(p.service_id) + '\n' +
    'Usadas: ' + newUsed + '/' + newTotal + '\n' +
    'Saldo: ' + newRemaining + '\n' +
    'Status: ' + (keepActive ? 'ativo' : 'inativo');

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

function renderLists(){
  $('payerList').innerHTML=payers.map(p=>`<div class="item"><div class="item-top"><strong>${esc(p.name)}</strong><button class="btn danger" onclick="removePayer('${p.id}')">Remover</button></div></div>`).join('')||'<div class="muted">Nenhum pagador.</div>';

  $('serviceList').innerHTML=services.map(s=>`<div class="item"><div class="item-top"><div><strong>${esc(s.name)}</strong><div class="muted small">${payerName(s.health_insurance_id)} · ${brl(s.price)} · ${s.duration_minutes}min · ${s.appointment_mode}</div></div><div class="toolbar"><button class="btn" onclick="startServiceEdit('${s.id}')">Editar</button><button class="btn danger" onclick="removeService('${s.id}')">Remover</button></div></div></div>`).join('')||'<div class="muted">Nenhum serviço.</div>';

  const activePk=packages.filter(p=>p.active!==false);
  const inactivePk=packages.filter(p=>p.active===false);

  if($('packageListActive')){
    const pkQuery = $('packageSearch') ? $('packageSearch').value.trim().toLowerCase() : '';
    const filterPk = pk => {
      if(!pkQuery) return true;
      const patName = String((patients.find(p=>String(p.id)===String(pk.patient_id))||{}).name||'').toLowerCase();
      const svcName = String((services.find(s=>String(s.id)===String(pk.service_id))||{}).name||'').toLowerCase();
      return patName.includes(pkQuery) || svcName.includes(pkQuery);
    };
    const filteredActivePk   = activePk.filter(filterPk);
    const filteredInactivePk = inactivePk.filter(filterPk);
    const totalActive = activePk.length;
    $('packagesActiveCount').textContent   = pkQuery ? `${filteredActivePk.length}/${totalActive} encontrado(s)` : `${activePk.length} ativo(s)`;
    $('packagesInactiveCount').textContent = inactivePk.length+' inativo(s)';
    $('packageListActive').innerHTML   = filteredActivePk.length   ? filteredActivePk.map(packageCard).join('')   : `<div class="muted">${pkQuery ? 'Nenhum pacote encontrado.' : 'Nenhum pacote ativo.'}</div>`;
    $('packageListInactive').innerHTML = filteredInactivePk.length ? filteredInactivePk.map(packageCard).join('') : `<div class="muted">${pkQuery ? 'Nenhum pacote encontrado.' : 'Nenhum pacote inativo.'}</div>`;
  }else if($('packageList')){
    $('packageList').innerHTML=packages.length?packages.map(packageCard).join(''):'<div class="muted">Nenhum pacote.</div>';
  }

  const query = $('patientActiveSearch') ? cleanPhone($('patientActiveSearch').value).toLowerCase() || $('patientActiveSearch').value.trim().toLowerCase() : '';
  let activePatients=patients.filter(p=>p.archived!==true);
  const archivedPatients=patients.filter(p=>p.archived===true);

  if(query){
    activePatients = activePatients.filter(p=>{
      const name = String(p.name||'').toLowerCase();
      const phone = cleanPhone(p.whatsapp||'');
      const pathology = String(p.pathology||'').toLowerCase();
      return name.includes(query) || phone.includes(query) || pathology.includes(query);
    });
  }

  if($('patientListActive')){
    const totalActive = patients.filter(p=>p.archived!==true).length;
    $('patientsActiveCount').textContent = query ? `${activePatients.length}/${totalActive} encontrado(s)` : `${activePatients.length} ativo(s)`;
    $('patientsArchivedCount').textContent=archivedPatients.length+' inativo(s)';
    $('patientListActive').innerHTML=activePatients.length?activePatients.map(patientCard).join(''):'<div class="muted">Nenhum paciente encontrado.</div>';
    $('patientListArchived').innerHTML=archivedPatients.length?archivedPatients.map(patientCard).join(''):'<div class="muted">Nenhum paciente inativo.</div>';
  }
  hydratePackageScheduleSummaries();
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
function femicWeekBoundsV1434(){
  const periods=parsePeriods();
  let start=8*60,end=20*60;
  if(periods.length){
    start=Math.min(...periods.map(p=>timeToMin(p.start)));
    end=Math.max(...periods.map(p=>timeToMin(p.end)));
  }else{
    start=timeToMin(settings.start_time||'08:00');
    end=timeToMin(settings.end_time||'20:00');
  }
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){start=8*60;end=20*60;}
  start=Math.floor(start/60)*60;
  end=Math.ceil(end/60)*60;
  return {start,end,total:end-start};
}
function femicIntervalsOverlapV1434(a,b){return a.start < b.end && b.start < a.end;}
function femicLayoutAppointmentsV1434(list,bounds){
  const items=list.map(a=>{
    let st=timeToMin(normalizeTime(a.start_time));
    let en=timeToMin(normalizeTime(a.end_time));
    if(!Number.isFinite(st)) st=bounds.start;
    if(!Number.isFinite(en)||en<=st) en=st+Number(a.duration_minutes||serviceById(a.service_id).duration_minutes||45||45);
    st=femicClamp(st,bounds.start,bounds.end);
    en=femicClamp(en,bounds.start,bounds.end);
    if(en<=st) en=Math.min(bounds.end,st+15);
    return {a,start:st,end:en,col:0,cols:1};
  }).sort((x,y)=>(x.start-y.start)||(x.end-y.end));
  const groups=[];
  items.forEach(it=>{
    let g=groups.find(gr=>gr.some(o=>femicIntervalsOverlapV1434(it,o)));
    if(!g){g=[];groups.push(g);}
    g.push(it);
  });
  groups.forEach(group=>{
    group.sort((x,y)=>(x.start-y.start)||(x.end-y.end));
    const colEnds=[];
    group.forEach(it=>{
      let col=colEnds.findIndex(end=>end<=it.start);
      if(col<0){col=colEnds.length;colEnds.push(it.end);}else colEnds[col]=it.end;
      it.col=col;
    });
    const totalCols=Math.max(1,colEnds.length);
    group.forEach(it=>it.cols=totalCols);
  });
  return items;
}
function femicWeekCardV1434(a,style){
  const p=patientById(a.patient_id),s=serviceById(a.service_id);
  const label={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído',cancelado:'Cancelado'}[a.status]||a.status;
  return `<div class="femic-week-card status-${a.status}" style="${style}" onclick="event.stopPropagation();openAppt('${a.appointment_date}','${a.id}')"><div class="week-card-main"><div class="appt-time">${normalizeTime(a.start_time)}–${normalizeTime(a.end_time)}</div><strong class="appt-name" title="${esc(p.name||'Paciente')}">${esc(p.name||'Paciente')}</strong><div class="week-card-service">${esc(s.name||'Sem serviço')}</div></div><div class="appt-meta"><span class="status-chip ${a.status}">${label}</span></div>${saldoBadge(a.patient_id,a.service_id)}</div>`;
}
function femicWeekClickV1434(ev,ds,bounds,pxPerMin){
  if(ev.target.closest('.femic-week-card')) return;
  const dayEl=ev.currentTarget;
  if(dayEl.classList.contains('closed')) return;
  const rect=dayEl.getBoundingClientRect();
  const y=femicClamp(ev.clientY-rect.top,0,rect.height);
  const step=Number(settings.slot_interval_minutes||30);
  const raw=bounds.start + Math.round((y/pxPerMin)/step)*step;
  const minute=femicClamp(raw,bounds.start,bounds.end-step);
  openAppt(ds,null,minToTime(minute));
}
function renderWeek(){
  $('monthView').classList.add('hidden');
  $('weekView').classList.remove('hidden');
  const start=weekStart(currentDate);
  const allDays=[0,1,2,3,4,5,6].map(i=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  const days=allDays.filter(d=>isWorking(isoDate(d)));
  const visibleDays=days.length?days:allDays;
  $('periodLabel').textContent=`Semana de ${fmtDate(isoDate(visibleDays[0]))} a ${fmtDate(isoDate(visibleDays[visibleDays.length-1]))}`;
  const bounds=femicWeekBoundsV1434();
  const pxPerMin=1.22;
  const hourHeight=Math.round(60*pxPerMin);
  const timelineHeight=Math.round(bounds.total*pxPerMin);
  const slotList=slots();
  const timeMarks=[];
  for(let m=bounds.start;m<=bounds.end;m+=60) timeMarks.push(m);
  let html=`<div class="gcal-week-shell"><div class="gcal-week-board" style="grid-template-columns:84px repeat(${visibleDays.length}, minmax(180px,1fr));">`;
  html+=`<div class="gcal-week-corner"></div>`;
  visibleDays.forEach(d=>{
    const ds=isoDate(d);
    const openCount=agendaFiltered(appointments.filter(a=>a.appointment_date===ds&&a.status!=='cancelado')).length;
    const weekLabel=d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
    html+=`<div class="gcal-week-head ${ds===todayIso()?'today':''}"><span class="gcal-week-head-day">${weekLabel}</span><strong>${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</strong><span class="gcal-week-head-meta">${openCount} ag.</span></div>`;
  });
  html+=`<div class="gcal-week-axis" style="height:${timelineHeight}px;--hour-height:${hourHeight}px">`;
  timeMarks.forEach(min=>{ html+=`<div class="gcal-week-axis-label" style="top:${Math.round((min-bounds.start)*pxPerMin)}px">${minToTime(min)}</div>`; });
  html+=`</div>`;
  visibleDays.forEach(d=>{
    const ds=isoDate(d);
    const off=isClosedForView(ds);
    const dayItems=femicLayoutAppointmentsV1434(agendaFiltered(appointments.filter(a=>a.appointment_date===ds)),bounds);
    html+=`<div class="gcal-week-day ${ds===todayIso()?'today':''} ${off?'closed':''}" style="height:${timelineHeight}px;--hour-height:${hourHeight}px" onclick="femicWeekClickV1434(event,'${ds}',{start:${bounds.start},end:${bounds.end}},${pxPerMin})">`;
    dayItems.forEach(it=>{
      const top=Math.round((it.start-bounds.start)*pxPerMin);
      const height=Math.max(26,Math.round((it.end-it.start)*pxPerMin));
      const laneWidth=100/Math.max(it.cols,1);
      const left=(laneWidth*it.col);
      const widthStyle=`calc(${laneWidth}% - 8px)`;
      html+=`<button class="gcal-week-event status-${it.a.status}" style="top:${top}px;height:${height}px;left:calc(${left}% + 4px);width:${widthStyle}" onclick="event.stopPropagation();openAppt('${it.a.appointment_date}','${it.a.id}')"><span class="gcal-week-event-time">${normalizeTime(it.a.start_time)}-${normalizeTime(it.a.end_time)}</span><strong>${esc(patientName(it.a.patient_id))}</strong><span class="gcal-week-event-service">${esc(serviceName(it.a.service_id))}</span></button>`;
    });
    html+=`</div>`;
  });
  html+=`</div></div>`;
  $('weekBoard').innerHTML=html;
}


/* FEMIC v1.4.36 — fallbacks seguros para aba Dia */
if(typeof weekdayShort !== 'function'){
  function weekdayShort(dateStr){
    if(!dateStr) return '';
    const d = new Date(String(dateStr) + 'T00:00:00');
    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    return dias[d.getDay()] || '';
  }
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

if(typeof getNextStatuses !== 'function'){
  function getNextStatuses(current){
    const all = [
      { value:'concluido', label:'Concluído' },
      { value:'cancelado', label:'Cancelado' }
    ];
    return all.filter(s => s.value !== current);
  }
}

if(typeof saldoBadgeInline !== 'function'){
  function saldoBadgeInline(patientId, serviceId){
    try{
      if(!Array.isArray(packages)) return '';
      const pk = packages.find(p =>
        String(p.patient_id) === String(patientId) &&
        String(p.service_id) === String(serviceId) &&
        p.active !== false
      );
      if(!pk) return '';
      const remaining = Number(pk.remaining_sessions ?? pk.saldo ?? 0);
      const total = Number(pk.total_sessions ?? 0);
      if(total <= 0) return '';
      return ` · saldo ${remaining}`;
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

function processAutomaticReminders(){
  if(getReminderMode()!=='auto') return;
  if(!base()||!key()||!sessionStorage.getItem('femic_jwt')||hasOpenModal()) return;
  const next=dueAutomaticReminders()[0];
  if(!next) return;
  const stamp=next.kind+':'+String(next.a.id);
  const last=localStorage.getItem('femic_auto_reminder_last')||'';
  const lastAt=Number(localStorage.getItem('femic_auto_reminder_last_at')||0);
  if(last===stamp && Date.now()-lastAt<10*60*1000) return;
  localStorage.setItem('femic_auto_reminder_last',stamp);
  localStorage.setItem('femic_auto_reminder_last_at',String(Date.now()));
  sendWhatsapp(next.a.id,true,next.kind);
}

applyAgendaTheme();renderWorkDays();renderReminderAutomationStatus();syncAgendaNavState('agenda');renderAll();if(base()&&key()&&sessionStorage.getItem('femic_jwt'))loadAll(true);
function hasOpenModal(){
  return !!document.querySelector('.modal-backdrop.show');
}
setInterval(()=>{
  if(base()&&key()&&sessionStorage.getItem('femic_jwt')&&!hasOpenModal()) loadAll(true);
  processAutomaticReminders();
},60000);

/* FEMIC v1.4.32 — fallback seguro para status rápidos */
if(typeof getNextStatuses !== 'function'){
  function getNextStatuses(current){
    const all = [
      { value:'concluido', label:'Concluído' },
      { value:'cancelado', label:'Cancelado' }
    ];
    return all.filter(s => s.value !== current);
  }
}
