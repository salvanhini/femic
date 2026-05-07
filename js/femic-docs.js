let store = { source:'', patients:[], sessions:[], anamneses:[], evolutions:[], documents:[] };
let currentDocType = 'attendance';
let stampDataUrl = '';
let signatureDataUrl = '';
const STORAGE_HISTORY_KEY = 'femic_document_history_v1';
const STORAGE_SETTINGS_KEY = 'femic_document_settings_v1';
const CLOUD_HISTORY_TABLE = 'femic_generated_documents';
let cloudHistoryCache = [];

function getSettings(){
  try{
    return Object.assign({
      supabaseUrl:'',
      supabaseKey:'',
      professionalName:'',
      professionalNote:'',
      showStamp:'yes',
      stampDataUrl:'',
      signatureDataUrl:''
    }, JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY) || '{}'));
  }catch(e){
    return {
      supabaseUrl:'',
      supabaseKey:'',
      professionalName:'',
      professionalNote:'',
      showStamp:'yes',
      stampDataUrl:'',
      signatureDataUrl:''
    };
  }
}

function saveSettings(){
  const payload = {
    supabaseUrl: document.getElementById('settingsSupabaseUrl').value.trim(),
    supabaseKey: document.getElementById('settingsSupabaseKey').value.trim(),
    professionalName: document.getElementById('settingsProfessionalName').value.trim(),
    professionalNote: document.getElementById('settingsProfessionalNote').value.trim(),
    showStamp: document.getElementById('settingsShowStamp').value,
    stampDataUrl: stampDataUrl || '',
    signatureDataUrl: signatureDataUrl || ''
  };
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(payload));
  syncSettingsToMain();
  toast('Configurações salvas neste navegador.', 'success');
}

function loadSettings(notify){
  const s = getSettings();
  document.getElementById('settingsSupabaseUrl').value = s.supabaseUrl || '';
  document.getElementById('settingsSupabaseKey').value = s.supabaseKey || '';
  document.getElementById('settingsProfessionalName').value = s.professionalName || '';
  document.getElementById('settingsProfessionalNote').value = s.professionalNote || '';
  document.getElementById('settingsShowStamp').value = s.showStamp || 'yes';
  stampDataUrl = s.stampDataUrl || '';
  signatureDataUrl = s.signatureDataUrl || '';
  syncSettingsToMain();
  updateAssetPreviews();
  if(notify) toast('Configurações recarregadas.', 'info');
}

function syncSettingsToMain(){
  const s = getSettings();
  document.getElementById('supabaseUrl').value = s.supabaseUrl || '';
  document.getElementById('supabaseKey').value = s.supabaseKey || '';
  document.getElementById('professionalNameInput').value = s.professionalName || '';
  document.getElementById('professionalNoteInput').value = s.professionalNote || '';
  document.getElementById('showStampSelect').value = s.showStamp || 'yes';
  stampDataUrl = s.stampDataUrl || '';
  signatureDataUrl = s.signatureDataUrl || '';
  renderDocument();
  updateAssetPreviews();
}

function applyStoredSupabaseToMain(){
  saveSettings();
  toast('Supabase salvo e aplicado na tela principal.', 'success');
}

function resetSettings(){
  localStorage.removeItem(STORAGE_SETTINGS_KEY);
  stampDataUrl = '';
  signatureDataUrl = '';
  loadSettings();
  renderDocument();
  updateAssetPreviews();
  toast('Configurações removidas deste navegador.', 'warning');
}

function showPanel(name){
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  const panel = document.getElementById('panel-' + name);
  if(panel) panel.classList.add('active');
}


function toggleAdvanced(){
  const el = document.getElementById('advancedFields');
  if(!el) return;
  el.classList.toggle('show');
}

function updateAssetPreviews(){
  const stamp = document.getElementById('stampPreview');
  const sign = document.getElementById('signaturePreview');
  if(stamp){
    stamp.innerHTML = stampDataUrl ? '<img src="' + stampDataUrl + '" alt="Carimbo">' : 'Nenhum';
  }
  if(sign){
    sign.innerHTML = signatureDataUrl ? '<img src="' + signatureDataUrl + '" alt="Assinatura">' : 'Nenhuma';
  }
}

function quickGenerate(){
  const patient = getPatient();
  if(!patient){
    toast('Selecione um paciente.', 'warning');
    return;
  }
  setDocType('attendance');
  autoSelectPreset(patient);
  applyPreset();
  toast('Documento rápido gerado.', 'success');
}


const PHRASES = [
  'Paciente em acompanhamento fisioterapêutico regular.',
  'Apresenta quadro compatível com a hipótese clínica registrada.',
  'Mantém limitação funcional parcial para as atividades habituais.',
  'Evolução clínica compatível com o plano terapêutico proposto.',
  'Necessita continuidade do acompanhamento fisioterapêutico.',
  'Sugere-se investigação complementar conforme avaliação clínica.',
  'Paciente orientado(a) quanto às medidas domiciliares e autocuidado.',
  'Quadro com indicação de seguimento e reavaliação conforme evolução.'
];



const PRESETS = {
  attendance: [
    { id:'attendance_simple', label:'Comparecimento simples', title:'ATESTADO DE COMPARECIMENTO', body:(ctx)=>`Declaro, ${ctx.purpose}, que ${ctx.name} compareceu a atendimento fisioterapêutico na FEMIC Fisioterapia em ${ctx.dateBr}.` },
    { id:'attendance_session', label:'Comparecimento com sessão realizada', title:'ATESTADO DE COMPARECIMENTO', body:(ctx)=>`Declaro, ${ctx.purpose}, que ${ctx.name} compareceu a esta clínica em ${ctx.dateBr}, tendo sido submetido(a) a atendimento fisioterapêutico conforme conduta proposta para o quadro de ${ctx.pathology}${ctx.side ? ' (' + ctx.side + ')' : ''}.` },
    { id:'attendance_time', label:'Comparecimento com período do dia', title:'ATESTADO DE COMPARECIMENTO', body:(ctx)=>`Declaro, para os devidos fins, que ${ctx.name} compareceu à FEMIC Fisioterapia em ${ctx.dateBr} para realização de atendimento fisioterapêutico, permanecendo em acompanhamento conforme necessidade clínica.` },
  ],
  declaration: [
    { id:'decl_followup', label:'Declaração de acompanhamento', title:'DECLARAÇÃO DE ATENDIMENTO', body:(ctx)=>`Declaro, ${ctx.purpose}, que ${ctx.name} encontra-se em acompanhamento fisioterapêutico nesta clínica, em razão de ${ctx.pathology}${ctx.period ? ' ' + ctx.period : ''}.` },
    { id:'decl_periodic', label:'Declaração de tratamento em curso', title:'DECLARAÇÃO DE ATENDIMENTO', body:(ctx)=>`Declaro, para os devidos fins, que ${ctx.name} realiza acompanhamento fisioterapêutico periódico na FEMIC Fisioterapia, conforme plano terapêutico definido para o quadro clínico apresentado.` },
    { id:'decl_presence', label:'Declaração de presença na data', title:'DECLARAÇÃO DE ATENDIMENTO', body:(ctx)=>`Declaro, para os devidos fins, que ${ctx.name} esteve nesta clínica em ${ctx.dateBr} para atendimento fisioterapêutico relacionado ao quadro de ${ctx.pathology}.` },
  ],
  exam: [
    { id:'exam_xray', label:'Pedido de raio-X', title:'PEDIDO DE EXAME', body:(ctx)=>`Solicito exame de raio-X para melhor avaliação do quadro clínico de ${ctx.name}, considerando acompanhamento fisioterapêutico em curso por ${ctx.pathology}${ctx.side ? ' (' + ctx.side + ')' : ''}.\n\nJustificativa clínica: ${ctx.reason}.` },
    { id:'exam_mri', label:'Pedido de ressonância magnética', title:'PEDIDO DE EXAME', body:(ctx)=>`Solicito ressonância magnética para investigação complementar do quadro clínico de ${ctx.name}, em acompanhamento fisioterapêutico por ${ctx.pathology}${ctx.side ? ' (' + ctx.side + ')' : ''}.\n\nJustificativa clínica: ${ctx.reason}.` },
    { id:'exam_ultrasound', label:'Pedido de ultrassom', title:'PEDIDO DE EXAME', body:(ctx)=>`Solicito exame de ultrassonografia para melhor esclarecimento do quadro apresentado por ${ctx.name}, atualmente em acompanhamento fisioterapêutico${ctx.side ? ' relacionado a ' + ctx.side : ''}.\n\nHipótese clínica: ${ctx.pathology}.\n\nJustificativa: ${ctx.reason}.` },
    { id:'exam_ct', label:'Pedido de tomografia', title:'PEDIDO DE EXAME', body:(ctx)=>`Solicito tomografia computadorizada para avaliação complementar do quadro clínico de ${ctx.name}${ctx.side ? ', considerando ' + ctx.side : ''}.\n\nQuadro principal: ${ctx.pathology}.\n\nJustificativa clínica: ${ctx.reason}.` },
  ],
  report: [
    { id:'report_simple', label:'Laudo simples padrão', title:'LAUDO SIMPLES', body:(ctx)=>`Paciente: ${ctx.name}.\n\nQuadro principal: ${ctx.pathology}.\n\nQueixa principal: ${ctx.chief}.\n\nHistória atual: ${ctx.history}.\n\nDiagnóstico / hipótese: ${ctx.diagnosis}.\n\nLimitações funcionais: ${ctx.limitations}.\n\nObserva-se acompanhamento fisioterapêutico conforme registros clínicos disponíveis.` },
    { id:'report_progress', label:'Laudo com evolução', title:'LAUDO SIMPLES', body:(ctx)=>`Paciente ${ctx.name}, em acompanhamento fisioterapêutico por ${ctx.pathology}${ctx.side ? ' (' + ctx.side + ')' : ''}.\n\nForam registradas ${ctx.sessionCount} sessões até o momento. Dor inicial: ${ctx.firstPain}. Dor atual: ${ctx.lastPain}.\n\nÚltima conduta registrada: ${ctx.lastConduct}.\n\nÚltima orientação registrada: ${ctx.lastGuidance}.` },
    { id:'report_objective', label:'Laudo objetivo para encaminhamento', title:'LAUDO SIMPLES', body:(ctx)=>`Encaminho informações clínicas resumidas de ${ctx.name}, em acompanhamento fisioterapêutico por ${ctx.pathology}${ctx.period ? ' ' + ctx.period : ''}.\n\nQueixa principal: ${ctx.chief}.\n\nLimitações funcionais observadas: ${ctx.limitations}.\n\nConduta recente: ${ctx.lastConduct}.` },
  ],
  summary: [
    { id:'summary_basic', label:'Resumo evolutivo padrão', title:'RESUMO EVOLUTIVO', body:(ctx)=>`Resumo evolutivo de ${ctx.name}.\n\nPatologia / quadro principal: ${ctx.pathology}.\n\nTotal de sessões registradas: ${ctx.sessionCount}.\n\nDor inicial: ${ctx.firstPain}.\nDor atual: ${ctx.lastPain}.\n\nÚltima evolução técnica: ${ctx.lastConduct}.\n\nOrientação mais recente: ${ctx.lastGuidance}.` },
    { id:'summary_short', label:'Resumo curto', title:'RESUMO EVOLUTIVO', body:(ctx)=>`${ctx.name} encontra-se em acompanhamento por ${ctx.pathology}, com ${ctx.sessionCount} sessões registradas. Houve evolução de dor de ${ctx.firstPain} para ${ctx.lastPain}.` },
    { id:'summary_for_patient', label:'Resumo para paciente', title:'RESUMO EVOLUTIVO', body:(ctx)=>`Paciente ${ctx.name} segue em acompanhamento fisioterapêutico${ctx.period ? ' ' + ctx.period : ''}. Até o momento, foram registradas ${ctx.sessionCount} sessões, com evolução clínica compatível com o plano terapêutico proposto.\n\nOrientação atual: ${ctx.lastGuidance}.` },
  ]
};



document.getElementById('jsonFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    store.source = 'JSON';
    store.patients = Array.isArray(data.patients) ? data.patients : [];
    store.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    store.anamneses = Array.isArray(data.anamneses) ? data.anamneses : [];
    store.evolutions = Array.isArray(data.clinical_evolutions) ? data.clinical_evolutions : (Array.isArray(data.evolutions) ? data.evolutions : []);
    store.documents = Array.isArray(data.patient_documents) ? data.patient_documents : (Array.isArray(data.documents) ? data.documents : []);
    afterLoad();
    toast('Backup JSON carregado com sucesso.', 'success');
  }catch(err){
    console.error(err);
    toast('Não foi possível ler o JSON.', 'error');
  }
});

function handleSignatureUpload(event){
  const file = event.target.files && event.target.files[0];
  if(!file){
    signatureDataUrl = '';
    renderDocument();
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev){
    signatureDataUrl = ev.target.result || '';
    renderDocument();
    updateAssetPreviews();
    const s = getSettings(); s.signatureDataUrl = signatureDataUrl; localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(s));
    toast('Assinatura carregada com sucesso.', 'success');
  };
  reader.onerror = function(){
    toast('Não foi possível carregar a assinatura.', 'error');
  };
  reader.readAsDataURL(file);
}

function handleStampUpload(event){
  const file = event.target.files && event.target.files[0];
  if(!file){
    stampDataUrl = '';
    renderDocument();
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev){
    stampDataUrl = ev.target.result || '';
    renderDocument();
    updateAssetPreviews();
    const s = getSettings(); s.stampDataUrl = stampDataUrl; localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(s));
    toast('Carimbo carregado com sucesso.', 'success');
  };
  reader.onerror = function(){
    toast('Não foi possível carregar a imagem do carimbo.', 'error');
  };
  reader.readAsDataURL(file);
}

function toast(msg, type){
  type = type || 'info';
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3500);
}

function fmtDate(d){
  if(!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const parts = d.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('pt-BR');
}

function todayIso(){ return new Date().toISOString().slice(0,10); }

function escapeHtml(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function getPurposeText(){
  const val = document.getElementById('documentPurposeSelect').value;
  const map = {
    geral: 'para os devidos fins',
    trabalho: 'para fins trabalhistas',
    escola: 'para fins escolares',
    inss: 'para apresentação junto ao INSS / perícia',
    'convênio': 'para apresentação junto ao convênio',
    uso_pessoal: 'para uso pessoal'
  };
  return map[val] || 'para os devidos fins';
}

function getBodySideText(){
  const val = document.getElementById('bodySideSelect').value;
  const map = { direito:'lado direito', esquerdo:'lado esquerdo', bilateral:'comprometimento bilateral' };
  return map[val] || '';
}

function periodText(){
  const s = document.getElementById('periodStartInput').value;
  const e = document.getElementById('periodEndInput').value;
  if(s && e) return 'no período de ' + fmtDate(s) + ' a ' + fmtDate(e);
  if(s) return 'a partir de ' + fmtDate(s);
  if(e) return 'até ' + fmtDate(e);
  return '';
}

function renderPhraseList(){
  const el = document.getElementById('phraseList');
  el.innerHTML = PHRASES.map(p => '<button class="phrase-btn" onclick="insertPhrase(' + JSON.stringify(p).replace(/"/g,'&quot;') + ')">' + escapeHtml(p) + '</button>').join('');
}

function insertPhrase(phrase){
  const ta = document.getElementById('docBodyInput');
  const current = ta.value.trim();
  ta.value = current ? current + '\n\n' + phrase : phrase;
  renderDocument();
}

function getHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]'); } catch(e){ return []; }
}

function saveHistory(list){
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(list || []));
}

function buildDocumentEntry(){
  const patient = getPatient();
  if(!patient) return null;
  return {
    id: 'd' + Date.now(),
    patientId: patient.id || '',
    patientName: patient.name || '',
    documentType: currentDocType || '',
    title: document.getElementById('docTitleInput').value || 'DOCUMENTO',
    body: document.getElementById('docBodyInput').value || '',
    date: document.getElementById('docDateInput').value || todayIso(),
    renderedHtml: document.getElementById('printArea').innerHTML || document.getElementById('preview').innerHTML || '',
    createdAt: new Date().toISOString(),
    metadata: {
      pathology: patient.pathology || '',
      whatsapp: patient.whatsapp || '',
      cpf: document.getElementById('patientCpfInput').value.trim(),
      rg: document.getElementById('patientRgInput').value.trim(),
      birth: document.getElementById('patientBirthInput').value.trim(),
      purpose: document.getElementById('documentPurposeSelect').value,
      bodySide: document.getElementById('bodySideSelect').value,
      periodStart: document.getElementById('periodStartInput').value,
      periodEnd: document.getElementById('periodEndInput').value,
      includeClinicalSummary: !!(document.getElementById('includeClinicalSummary') && document.getElementById('includeClinicalSummary').checked)
    }
  };
}

async function saveCurrentDocument(){
  const entry = buildDocumentEntry();
  if(!entry){
    toast('Selecione um paciente antes de salvar.', 'warning');
    return;
  }

  const list = [entry].concat(getHistory()).slice(0, 30);
  saveHistory(list);
  renderHistoryList();
  toast('Documento salvo no histórico local.', 'success');

  if(hasSupabaseConfig()){
    const ok = await saveDocumentToSupabase(entry);
    if(ok){
      await loadCloudHistory(true, true);
      toast('Documento também salvo no Supabase.', 'success');
    }
  }else{
    toast('Supabase não configurado. O documento ficou salvo apenas neste dispositivo.', 'info');
  }
}


function hasSupabaseConfig(){
  const url = document.getElementById('supabaseUrl').value.trim();
  const key = document.getElementById('supabaseKey').value.trim();
  return !!(url && key);
}

function getSupabaseHeaders(){
  const key = document.getElementById('supabaseKey').value.trim();
  const jwt = sessionStorage.getItem('femic_jwt') || key;
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + jwt,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

function getSupabaseBaseUrl(){
  return document.getElementById('supabaseUrl').value.trim().replace(/\/$/, '');
}

async function saveDocumentToSupabase(entry){
  try{
    const url = getSupabaseBaseUrl();
    const payload = {
      patient_id: String(entry.patientId || ''),
      patient_name: entry.patientName || '',
      document_type: entry.documentType || '',
      document_title: entry.title || '',
      document_body: entry.body || '',
      document_date: entry.date || todayIso(),
      rendered_html: entry.renderedHtml || '',
      metadata: entry.metadata || {},
      status: 'active',
      source: 'gerador_documentos_femic_v1_6'
    };
    const res = await fetch(url + '/rest/v1/' + CLOUD_HISTORY_TABLE, {
      method:'POST',
      headers:getSupabaseHeaders(),
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const msg = await res.text();
      throw new Error('HTTP ' + res.status + ' — ' + msg);
    }
    return true;
  }catch(err){
    console.error(err);
    toast('Não foi possível salvar no Supabase. Verifique se a tabela foi criada em Configurações.', 'warning');
    return false;
  }
}

async function loadCloudHistory(filterCurrentPatient, silent){
  if(!hasSupabaseConfig()){
    if(!silent) toast('Configure URL e anon key do Supabase primeiro.', 'warning');
    return;
  }
  try{
    const url = getSupabaseBaseUrl();
    const patient = getPatient();
    let query = '?select=*&status=eq.active&order=created_at.desc&limit=50';
    if(filterCurrentPatient && patient && patient.id){
      query += '&patient_id=eq.' + encodeURIComponent(String(patient.id));
    }
    const res = await fetch(url + '/rest/v1/' + CLOUD_HISTORY_TABLE + query, { headers:getSupabaseHeaders() });
    if(!res.ok){
      const msg = await res.text();
      throw new Error('HTTP ' + res.status + ' — ' + msg);
    }
    cloudHistoryCache = await res.json();
    renderCloudHistoryList();
    showHistoryPanel('cloud');
    if(!silent) toast('Histórico do Supabase carregado.', 'success');
  }catch(err){
    console.error(err);
    const el = document.getElementById('cloudHistoryList');
    if(el) el.innerHTML = '<div class="muted small">Não foi possível carregar. Confira se a tabela femic_generated_documents existe no Supabase.</div>';
    if(!silent) toast('Erro ao carregar histórico do Supabase.', 'error');
  }
}

function showHistoryPanel(type){
  const local = type !== 'cloud';
  document.getElementById('historyPanelLocal').classList.toggle('active', local);
  document.getElementById('historyPanelCloud').classList.toggle('active', !local);
  document.getElementById('historyLocalTab').classList.toggle('active', local);
  document.getElementById('historyCloudTab').classList.toggle('active', !local);
}

function normalizeCloudItem(item){
  return {
    id: item.id,
    patientId: item.patient_id || '',
    patientName: item.patient_name || '',
    documentType: item.document_type || '',
    title: item.document_title || 'DOCUMENTO',
    body: item.document_body || '',
    date: item.document_date || todayIso(),
    renderedHtml: item.rendered_html || '',
    createdAt: item.created_at || '',
    metadata: item.metadata || {}
  };
}

function renderCloudHistoryList(){
  const el = document.getElementById('cloudHistoryList');
  if(!el) return;
  if(!cloudHistoryCache.length){
    el.innerHTML = '<div class="muted small">Nenhum documento encontrado no Supabase.</div>';
    return;
  }
  el.innerHTML = cloudHistoryCache.map(raw => {
    const item = normalizeCloudItem(raw);
    const id = JSON.stringify(String(item.id)).replace(/"/g,'&quot;');
    return '<div class="history-item">' +
      '<div onclick="loadCloudHistoryItem(' + id + ')" style="cursor:pointer;">' +
        '<strong>' + escapeHtml(item.title) + '</strong> <span class="cloud-badge">☁️ Supabase</span>' +
        '<div class="small muted" style="margin-top:4px;">' + escapeHtml(item.patientName || '-') + ' · ' + escapeHtml(fmtDate(item.date)) + ' · ' + escapeHtml(item.documentType || '-') + '</div>' +
      '</div>' +
      '<div class="toolbar" style="margin-top:10px;">' +
        '<button class="btn secondary" type="button" onclick="loadCloudHistoryItem(' + id + ')">Abrir</button>' +
        '<button class="btn ghost" type="button" onclick="duplicateCloudHistory(' + id + ')">Duplicar</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function loadEntryIntoEditor(entry, keepTodayDate){
  if(!entry) return;
  document.getElementById('docTitleInput').value = entry.title || 'DOCUMENTO';
  document.getElementById('docDateInput').value = keepTodayDate ? todayIso() : (entry.date || todayIso());
  document.getElementById('docBodyInput').value = entry.body || '';
  if(entry.documentType || entry.document_type){
    setDocType(entry.documentType || entry.document_type);
    document.getElementById('docTitleInput').value = entry.title || 'DOCUMENTO';
    document.getElementById('docBodyInput').value = entry.body || '';
  }
  renderDocument();
}

function loadCloudHistoryItem(id){
  const raw = cloudHistoryCache.find(x => String(x.id) === String(id));
  if(!raw) return;
  loadEntryIntoEditor(normalizeCloudItem(raw), false);
  toast('Documento carregado do Supabase para edição.', 'info');
}

function duplicateCloudHistory(id){
  const raw = cloudHistoryCache.find(x => String(x.id) === String(id));
  if(!raw) return;
  loadEntryIntoEditor(normalizeCloudItem(raw), true);
  toast('Documento duplicado para reenvio.', 'success');
}

async function copyCloudHistorySql(){
  const el = document.getElementById('cloudHistorySql');
  const txt = el ? el.textContent : '';
  try{
    await navigator.clipboard.writeText(txt);
    toast('SQL copiado.', 'success');
  }catch(err){
    console.error(err);
    toast('Não foi possível copiar o SQL.', 'error');
  }
}

function renderHistoryList(){
  const el = document.getElementById('historyList');
  const list = getHistory();
  if(!list.length){
    el.innerHTML = '<div class="muted small">Nenhum documento salvo ainda.</div>';
    return;
  }
  el.innerHTML = list.map(item =>
    '<div class="history-item">' +
      '<div onclick="loadHistoryItem(' + JSON.stringify(item.id).replace(/"/g,'&quot;') + ')" style="cursor:pointer;">' +
        '<strong>' + escapeHtml(item.title) + '</strong>' +
        '<div class="small muted" style="margin-top:4px;">' + escapeHtml(item.patientName) + ' · ' + escapeHtml(fmtDate(item.date)) + '</div>' +
      '</div>' +
      '<div class="toolbar" style="margin-top:10px;">' +
        '<button class="btn secondary" type="button" onclick="loadHistoryItem(' + JSON.stringify(item.id).replace(/"/g,'&quot;') + ')">Abrir</button>' +
        '<button class="btn ghost" type="button" onclick="duplicateHistory(' + JSON.stringify(item.id).replace(/"/g,'&quot;') + ')">Duplicar</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function loadHistoryItem(id){
  const item = getHistory().find(x => x.id === id);
  if(!item) return;
  loadEntryIntoEditor({
    title:item.title,
    body:item.body,
    date:item.date,
    documentType:item.documentType || item.document_type || ''
  }, false);
  toast('Documento carregado do histórico local.', 'info');
}


function duplicateHistory(id){
  const item = getHistory().find(x => x.id === id);
  if(!item) return;
  loadEntryIntoEditor({
    title:item.title,
    body:item.body,
    date:item.date,
    documentType:item.documentType || item.document_type || ''
  }, true);
  toast('Documento duplicado para edição.', 'success');
}

async function copyWhatsAppText(){
  const patient = getPatient();
  const title = document.getElementById('docTitleInput').value || 'DOCUMENTO';
  const body = document.getElementById('docBodyInput').value || '';
  const txt = title + '\n\n' + (patient ? ('Paciente: ' + (patient.name || '-') + '\n') : '') + body;
  try{
    await navigator.clipboard.writeText(txt);
    toast('Texto simplificado copiado para WhatsApp.', 'success');
  }catch(err){
    console.error(err);
    toast('Não foi possível copiar para WhatsApp.', 'error');
  }
}

function buildContext(patient){
  const sessions = getPatientSessions(patient.id);
  const anamnese = getPatientAnamnese(patient.id);
  const evolutions = getPatientEvolutions(patient.id);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const lastEv = evolutions.length ? evolutions[evolutions.length - 1] : null;

  return {
    name: patient.name || 'Paciente',
    pathology: patient.pathology || 'quadro em acompanhamento fisioterapêutico',
    dateBr: fmtDate(document.getElementById('docDateInput').value || todayIso()),
    purpose: getPurposeText(),
    side: getBodySideText(),
    period: periodText(),
    sessionCount: sessions.length,
    firstPain: (first && first.pain != null ? first.pain : '-'),
    lastPain: (last && last.pain != null ? last.pain : '-'),
    chief: (anamnese && anamnese.chief_complaint) || 'Não informada',
    history: (anamnese && anamnese.history) || 'Não informada',
    diagnosis: (anamnese && (anamnese.diagnosis || patient.pathology)) || patient.pathology || 'Não informado',
    limitations: (anamnese && anamnese.limitations) || 'Não informadas',
    reason: (anamnese && (anamnese.chief_complaint || anamnese.diagnosis)) || 'necessidade de melhor investigação complementar conforme evolução clínica',
    lastConduct: (lastEv && lastEv.conduct) || 'Sem conduta descrita',
    lastGuidance: (lastEv && lastEv.guidance) || 'Sem orientação registrada'
  };
}

function populatePresets(){
  const sel = document.getElementById('presetSelect');
  const presets = PRESETS[currentDocType] || [];
  sel.innerHTML = '<option value="">Selecione um modelo</option>' + presets.map(p => '<option value="' + p.id + '">' + p.label + '</option>').join('');
}

function applyPreset(){
  const patient = getPatient();
  const sel = document.getElementById('presetSelect');
  const selected = sel.value;
  if(!selected || !patient){
    generateTemplate();
    return;
  }
  const presets = PRESETS[currentDocType] || [];
  const preset = presets.find(p => p.id === selected);
  if(!preset) return;
  const ctx = buildContext(patient);
  document.getElementById('docTitleInput').value = preset.title;
  document.getElementById('docBodyInput').value = preset.body(ctx);
  renderDocument();
}

function afterLoad(){
  document.getElementById('kpiPatients').textContent = store.patients.length;
  document.getElementById('kpiSessions').textContent = store.sessions.length;
  document.getElementById('kpiSource').textContent = store.source || 'Nenhuma';
  populatePatients();
}

function populatePatients(){
  const sel = document.getElementById('patientSelect');
  const options = store.patients
    .slice()
    .sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map(p => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || 'Sem nome') + '</option>')
    .join('');
  sel.innerHTML = '<option value="">Selecione</option>' + options;
  document.getElementById('docDateInput').value = todayIso();
  populatePresets();
  const patient = getPatient();
  if(patient) autoSelectPreset(patient);
  generateTemplate();
}

async function loadFromSupabase(){
  const url = document.getElementById('supabaseUrl').value.trim().replace(/\/$/, '');
  const key = document.getElementById('supabaseKey').value.trim();
  if(!url || !key){
    toast('Configure o Supabase nas configurações ou refaça o login.', 'warning');
    return;
  }
  const jwt = sessionStorage.getItem('femic_jwt') || key;
  try{
    const headers = {
      'apikey': key,
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json'
    };
    const queries = [
      ['patients', 'patients'],
      ['sessions', 'sessions'],
      ['anamneses', 'anamneses'],
      ['clinical_evolutions', 'evolutions'],
      ['patient_documents', 'documents']
    ];
    const results = {};
    for(const [table, keyName] of queries){
      const res = await fetch(url + '/rest/v1/' + table + '?select=*', { headers });
      if(!res.ok) throw new Error(table + ' → HTTP ' + res.status);
      results[keyName] = await res.json();
    }
    store.source = 'Supabase';
    store.patients = results.patients || [];
    store.sessions = results.sessions || [];
    store.anamneses = results.anamneses || [];
    store.evolutions = results.evolutions || [];
    store.documents = results.documents || [];
    afterLoad();
    toast('Dados carregados do Supabase.', 'success');
  }catch(err){
    console.error(err);
    toast('Não foi possível carregar do Supabase: ' + err.message, 'error');
  }
}

function setDocType(type){
  currentDocType = type;
  const chips = document.querySelectorAll('.doc-chip');
  chips.forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const titleMap = {
    attendance:'ATESTADO DE COMPARECIMENTO',
    declaration:'DECLARAÇÃO DE ATENDIMENTO',
    exam:'PEDIDO DE EXAME',
    report:'LAUDO SIMPLES',
    summary:'RESUMO EVOLUTIVO'
  };
  document.getElementById('docTitleInput').value = titleMap[type] || 'DOCUMENTO';
  populatePresets();
  generateTemplate();
}

function getPatient(){
  const pid = document.getElementById('patientSelect').value;
  return store.patients.find(p => String(p.id) === String(pid)) || null;
}

function getPatientSessions(pid){
  return store.sessions
    .filter(s => String(s.patient_id) === String(pid))
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function getPatientAnamnese(pid){
  return store.anamneses.find(a => String(a.patient_id) === String(pid)) || null;
}

function getPatientEvolutions(pid){
  return store.evolutions
    .filter(e => String(e.patient_id) === String(pid))
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function onPatientChange(){ generateTemplate(); }

function autoSelectPreset(patient){
  if(!patient) return;
  const presets = PRESETS[currentDocType] || [];
  if(!presets.length) return;
  const sessions = getPatientSessions(patient.id);
  let chosen = presets[0];
  if(currentDocType === 'summary' && sessions.length > 3){
    chosen = presets.find(p => p.id.includes('basic')) || presets[0];
  } else if(currentDocType === 'report' && patient.pathology){
    chosen = presets.find(p => p.id.includes('progress')) || presets[0];
  } else if(currentDocType === 'attendance'){
    chosen = presets.find(p => p.id.includes('session')) || presets[0];
  }
  document.getElementById('presetSelect').value = chosen.id;
}

function generateTemplate(){
  const patient = getPatient();
  if(!patient){
    document.getElementById('docBodyInput').value = '';
    renderDocument();
    return;
  }

  const presets = PRESETS[currentDocType] || [];
  const select = document.getElementById('presetSelect');
  if(!select.value){ autoSelectPreset(patient); }
  let preset = presets.find(p => p.id === select.value);
  if(!preset && presets.length){
    preset = presets[0];
    select.value = preset.id;
  }

  const ctx = buildContext(patient);
  const body = preset ? preset.body(ctx) : '';
  const title = preset ? preset.title : (document.getElementById('docTitleInput').value || 'DOCUMENTO');

  document.getElementById('docTitleInput').value = title;
  document.getElementById('docBodyInput').value = body;
  renderDocument();
}

function renderDocument(){
  const patient = getPatient();
  const title = document.getElementById('docTitleInput').value || 'DOCUMENTO';
  const dateIso = document.getElementById('docDateInput').value || todayIso();
  const dateBr = fmtDate(dateIso);
  const professional = document.getElementById('professionalNameInput').value.trim();
  const professionalNote = document.getElementById('professionalNoteInput').value.trim();
  const cpf = document.getElementById('patientCpfInput').value.trim();
  const rg = document.getElementById('patientRgInput').value.trim();
  const birth = document.getElementById('patientBirthInput').value.trim();
  const showStamp = document.getElementById('showStampSelect').value === 'yes';
  const includeClinicalSummary = document.getElementById('includeClinicalSummary') ? document.getElementById('includeClinicalSummary').checked : false;
  const body = document.getElementById('docBodyInput').value || '';
  const sessions = patient ? getPatientSessions(patient.id) : [];
  const first = sessions[0];
  const last = sessions[sessions.length - 1];

  let infoBlock = '<div class="muted">Selecione um paciente para gerar o documento.</div>';
  let summaryBlock = '';
  if(patient){
    let extraItems = '';
    if(sessions.length){
      extraItems += '<div class="doc-info-item"><strong>Sessões realizadas</strong>' + sessions.length + '</div>';
      extraItems += '<div class="doc-info-item"><strong>Dor inicial → atual</strong>' + (first && first.pain != null ? first.pain : '-') + ' → ' + (last && last.pain != null ? last.pain : '-') + '</div>';
      if(includeClinicalSummary){
        summaryBlock = '<div class="doc-summary">' +
          '<strong style="color:#065f46;">🩺 Resumo clínico</strong><br>' +
          '<span style="font-size:14px;color:#047857;">Acompanhamento com ' + sessions.length + ' sessão(ões). ' +
          'Dor inicial/atual: ' + (first && first.pain != null ? first.pain : '-') + ' → ' + (last && last.pain != null ? last.pain : '-') + '.</span>' +
        '</div>';
      }
    }
    infoBlock = '<div class="doc-info-grid">' +
      '<div class="doc-info-item"><strong>Paciente</strong>' + escapeHtml(patient.name || '-') + '</div>' +
      '<div class="doc-info-item"><strong>Telefone</strong>' + escapeHtml(patient.whatsapp || '-') + '</div>' +
      '<div class="doc-info-item"><strong>Diagnóstico / Patologia</strong>' + escapeHtml(patient.pathology || '-') + '</div>' +
      '<div class="doc-info-item"><strong>Data do documento</strong>' + escapeHtml(dateBr || '-') + '</div>' +
      (cpf ? '<div class="doc-info-item"><strong>CPF</strong>' + escapeHtml(cpf) + '</div>' : '') +
      (rg ? '<div class="doc-info-item"><strong>RG</strong>' + escapeHtml(rg) + '</div>' : '') +
      (birth ? '<div class="doc-info-item"><strong>Data de nascimento</strong>' + escapeHtml(fmtDate(birth)) + '</div>' : '') +
      extraItems +
    '</div>';
  }

  const html = '<div class="doc-page">' +
    '<div class="doc-head">' +
      '<div class="doc-brand">' +
        '<img src="./logo.png" alt="FEMIC" onerror="this.style.display=\'none\'">' +
        '<div><h2>FEMIC Fisioterapia</h2><small>Clínica especializada em reabilitação · Araraquara, SP</small></div>' +
      '</div>' +
      '<div style="font-size:12px;color:#0369a1;text-align:right;line-height:1.6;">Documento clínico<br><strong>' + escapeHtml(dateBr || '') + '</strong></div>' +
    '</div>' +
    '<div class="doc-title">' + escapeHtml(title) + '</div>' +
    infoBlock +
    summaryBlock +
    '<div class="doc-body">' + escapeHtml(body) + '</div>' +
    '<div class="doc-sign">' +
      (showStamp && stampDataUrl ? '<img src="' + stampDataUrl + '" alt="Carimbo" style="max-width:180px; max-height:110px; object-fit:contain; margin-bottom:10px;">' : '') +
      (signatureDataUrl ? '<img src="' + signatureDataUrl + '" alt="Assinatura" style="max-width:220px; max-height:90px; object-fit:contain; margin-bottom:6px;">' : '') +
      '<div class="doc-sign-line">' +
        '<div>' + escapeHtml(professional || 'Responsável') + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:400;">' + escapeHtml(professionalNote || '') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.getElementById('preview').innerHTML = html;
  document.getElementById('printArea').innerHTML = html;
}

async function copyDocumentText(){
  const title = document.getElementById('docTitleInput').value || 'DOCUMENTO';
  const body = document.getElementById('docBodyInput').value || '';
  const patient = getPatient();
  const cpf = document.getElementById('patientCpfInput').value.trim();
  const rg = document.getElementById('patientRgInput').value.trim();
  const birth = document.getElementById('patientBirthInput').value.trim();
  const content = title + '\n\nPaciente: ' + (patient && patient.name ? patient.name : '-') +
    '\nPatologia: ' + (patient && patient.pathology ? patient.pathology : '-') +
    '\nTelefone: ' + (patient && patient.whatsapp ? patient.whatsapp : '-') +
    (cpf ? '\nCPF: ' + cpf : '') +
    (rg ? '\nRG: ' + rg : '') +
    (birth ? '\nData de nascimento: ' + fmtDate(birth) : '') +
    '\n\n' + body;
  try{
    await navigator.clipboard.writeText(content);
    toast('Texto copiado para a área de transferência.', 'success');
  }catch(err){
    console.error(err);
    toast('Não foi possível copiar o texto.', 'error');
  }
}

function printCurrent(){
  const patient = getPatient();
  if(!patient){
    toast('Selecione um paciente antes de imprimir.', 'warning');
    return;
  }
  renderDocument();
  window.print();
}

function femicShowSetup(){
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
  const saved = getSavedSupabase();
  if(saved.url) document.getElementById('setupUrl').value = saved.url;
  if(saved.key) document.getElementById('setupKey').value = saved.key;
}

function getSavedSupabase(){
  try{
    const cfg = JSON.parse(localStorage.getItem('femic_docs_config') || '{}');
    return { url: cfg.supabaseUrl || '', key: cfg.supabaseKey || '' };
  }catch(e){ return { url:'', key:'' }; }
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
  const cfg = JSON.parse(localStorage.getItem('femic_docs_config') || '{}');
  cfg.supabaseUrl = url; cfg.supabaseKey = akey;
  localStorage.setItem('femic_docs_config', JSON.stringify(cfg));
  document.getElementById('supabaseUrl').value = url;
  document.getElementById('supabaseKey').value = akey;
  const si = document.getElementById('settingsSupabaseUrl');
  const sk = document.getElementById('settingsSupabaseKey');
  if(si) si.value = url;
  if(sk) sk.value = akey;
  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = 'block';
  setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
}

async function femicLogin(){
  const saved = getSavedSupabase();
  if(!saved.url || !saved.key){ femicShowSetup(); return; }
  const email    = (document.getElementById('loginEmail').value || '').trim();
  const password = document.getElementById('loginPassword').value || '';
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');
  if(!email || !password){
    errEl.textContent = 'Preencha email e senha.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.textContent = 'Entrando…'; btn.disabled = true;
  try{
    const res = await fetch(saved.url + '/auth/v1/token?grant_type=password', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey': saved.key },
      body: JSON.stringify({ email, password })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.message || 'Credenciais inválidas');
    }
    const data = await res.json();
    sessionStorage.setItem('femic_jwt', data.access_token);
    sessionStorage.setItem('femic_user', email);
    document.getElementById('femicLoginOverlay').style.display = 'none';
    const lbl = document.getElementById('loginUserLabel');
    if(lbl) lbl.textContent = email.split('@')[0] + ' · Sair';
    document.getElementById('supabaseUrl').value = saved.url;
    document.getElementById('supabaseKey').value = saved.key;
    toast('Bem-vindo, ' + email.split('@')[0] + '!', 'success');
    await loadFromSupabase();
  }catch(e){
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

function femicLogout(){
  if(!confirm('Sair da sessão?')) return;
  sessionStorage.removeItem('femic_jwt');
  sessionStorage.removeItem('femic_user');
  location.reload();
}

function checkFemicAuth(){
  const jwt     = sessionStorage.getItem('femic_jwt');
  const overlay = document.getElementById('femicLoginOverlay');
  const saved   = getSavedSupabase();
  const hasConfig = !!(saved.url && saved.key);
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
  if(hasConfig){
    document.getElementById('supabaseUrl').value = saved.url;
    document.getElementById('supabaseKey').value = saved.key;
  }
}

checkFemicAuth();
document.getElementById('docDateInput').value = todayIso();
populatePresets();
renderPhraseList();
renderHistoryList();
renderCloudHistoryList();
loadSettings();
updateAssetPreviews();
renderDocument();
