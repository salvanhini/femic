(function(){
  'use strict';

  var STORAGE_KEY = 'femic_ai_center_config_v1';
  var state = {
    status: 'IA clinica pronta para rascunhos de anamnese, evolucao e tratamento.',
    debug: 'IA clinica iniciando...',
    clinicalMode: '',
    treatmentDraftText: '',
    speechRecognition: null,
    speechListening: false,
    assistantBookingData: null,
    assistantBookingPlans: [],
    assistantBookingReason: '',
    assistantBookingSelectedPlan: -1,
    assistantBookingPatientCandidates: []
  };

  var DEFAULT_ASSISTANT_RULES = [
    'Use sempre os dados internos do sistema como contexto de apoio quando eles estiverem disponiveis.',
    'Responda em portugues do Brasil, com objetividade, sem texto longo e sem inventar dados ausentes.',
    'Em anamnese, evolucao clinica e plano de tratamento, gere apenas rascunhos revisaveis e nunca salve automaticamente; o profissional deve revisar antes de salvar.',
    'Nao de diagnostico definitivo, prescricao medica ou promessa de resultado clinico.',
    'Se faltarem dados clinicos, produza um rascunho seguro e deixe claro que precisa de revisao humana.'
  ].join('\n');

  function el(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function norm(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
  function todayIso(){ return typeof window.todayIso === 'function' ? window.todayIso() : new Date().toISOString().slice(0,10); }
  function isoDate(date){
    if(typeof window.isoDate === 'function') return window.isoDate(date);
    return new Date(date).toISOString().slice(0,10);
  }
  function fmtDate(value){ return typeof window.fmtDate === 'function' ? window.fmtDate(value) : String(value || ''); }
  function fmtWeekday(value){ return typeof window.fmtWeekday === 'function' ? window.fmtWeekday(value) : fmtDate(value); }
  function normalizeTime(value){ return typeof window.normalizeTime === 'function' ? window.normalizeTime(value) : String(value || '').slice(0,5); }
  function timeToMin(value){
    if(typeof window.timeToMin === 'function') return window.timeToMin(value);
    var parts = normalizeTime(value).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  function minToTime(total){
    if(typeof window.minToTime === 'function') return window.minToTime(total);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function addDays(dateStr, amount){
    var date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + amount);
    return isoDate(date);
  }
  function weekdayIndexFromQuery(text){
    var labels = [
      ['domingo','dom'],
      ['segunda','seg'],
      ['terca','ter'],
      ['quarta','qua'],
      ['quinta','qui'],
      ['sexta','sex'],
      ['sabado','sab']
    ];
    var found = [];
    labels.forEach(function(variants, idx){
      if(variants.some(function(item){ return text.indexOf(item) !== -1; })) found.push(idx);
    });
    return found;
  }
  function nextDateForWeekday(baseDateStr, targetDow){
    var date = new Date(baseDateStr + 'T00:00:00');
    var diff = (targetDow - date.getDay() + 7) % 7;
    if(diff === 0) diff = 7;
    date.setDate(date.getDate() + diff);
    return isoDate(date);
  }
  function getAgendaState(){
    return window.FEMICAgendaRuntime && typeof window.FEMICAgendaRuntime.getState === 'function'
      ? window.FEMICAgendaRuntime.getState()
      : { patients:[], services:[], packages:[], appointments:[], settings:{} };
  }
  function getUnifiedState(){
    return window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.getState === 'function'
      ? window.FEMICUnifiedRuntime.getState()
      : { currentPatient:null, currentEvolutions:[] };
  }
  function getConfig(){
    var saved = {};
    try{ saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }catch(e){}
    return {
      provider: saved.provider || 'gemini',
      geminiModel: saved.geminiModel || 'gemini-2.5-flash',
      geminiKey: saved.geminiKey || '',
      deepseekModel: saved.deepseekModel || 'deepseek-chat',
      deepseekKey: saved.deepseekKey || '',
      groqModel: saved.groqModel || 'llama-3.3-70b-versatile',
      groqKey: saved.groqKey || '',
      rules: saved.rules || DEFAULT_ASSISTANT_RULES
    };
  }
  function saveConfigToStorage(config){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, getConfig(), config || {})));
  }
  function readConfigFromInputs(){
    return {
      provider: el('assistantAiProvider') ? el('assistantAiProvider').value : 'gemini',
      geminiModel: el('assistantGeminiModel') ? el('assistantGeminiModel').value.trim() : 'gemini-2.5-flash',
      geminiKey: el('assistantGeminiKey') ? el('assistantGeminiKey').value.trim() : '',
      deepseekModel: el('assistantDeepseekModel') ? el('assistantDeepseekModel').value.trim() : 'deepseek-chat',
      deepseekKey: el('assistantDeepseekKey') ? el('assistantDeepseekKey').value.trim() : '',
      groqModel: el('assistantGroqModel') ? el('assistantGroqModel').value.trim() : 'llama-3.3-70b-versatile',
      groqKey: el('assistantGroqKey') ? el('assistantGroqKey').value.trim() : '',
      rules: el('assistantAiRules') ? el('assistantAiRules').value.trim() || DEFAULT_ASSISTANT_RULES : getConfig().rules
    };
  }
  function fillConfigInputs(){
    var config = getConfig();
    if(el('assistantAiProvider')) el('assistantAiProvider').value = config.provider;
    if(el('assistantGeminiModel')) el('assistantGeminiModel').value = config.geminiModel;
    if(el('assistantGeminiKey')) el('assistantGeminiKey').value = config.geminiKey;
    if(el('assistantDeepseekModel')) el('assistantDeepseekModel').value = config.deepseekModel;
    if(el('assistantDeepseekKey')) el('assistantDeepseekKey').value = config.deepseekKey;
    if(el('assistantGroqModel')) el('assistantGroqModel').value = config.groqModel;
    if(el('assistantGroqKey')) el('assistantGroqKey').value = config.groqKey;
    if(el('assistantAiRules')) el('assistantAiRules').value = config.rules || DEFAULT_ASSISTANT_RULES;
  }
  function providerLabel(provider){
    return { gemini:'Gemini', groq:'Groq', deepseek:'DeepSeek' }[provider] || provider;
  }
  function providerOrder(start){
    var base = ['gemini','groq','deepseek'];
    var first = start || getConfig().provider || 'gemini';
    return [first].concat(base.filter(function(item){ return item !== first; }));
  }
  function providerHasKey(config, provider){
    return !!String(config[provider + 'Key'] || '').trim();
  }
  function renderAssistantAiProviderBadge(){
    var provider = el('assistantAiProvider') ? el('assistantAiProvider').value : getConfig().provider;
    if(el('assistantAiProviderBadge')) el('assistantAiProviderBadge').textContent = provider;
    if(el('assistantAiStatusInput')) el('assistantAiStatusInput').value = 'Rascunhos clinicos usam esta configuracao; o salvamento continua manual.';
  }
  function setDebug(text){
    state.debug = text;
    if(el('aiCenterDebug')) el('aiCenterDebug').textContent = text;
  }
  function setClinicalAiStatus(text){
    if(el('clinicalAiModalStatus')) el('clinicalAiModalStatus').textContent = text;
  }
  function speechRecognitionCtor(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function makeTaskId(){
    return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }
  function cleanPhone(value){
    return String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  }
  function limitText(value, maxLength){
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function assistantRuntime(){
    return window.FEMICAgendaRuntime || null;
  }
  function listAssistantServices(){
    return (getAgendaState().services || []).filter(function(service){ return service.active !== false; }).sort(function(a,b){
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }
  function listAssistantPatients(){
    return (getAgendaState().patients || []).filter(function(patient){ return patient.archived !== true; }).sort(function(a,b){
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }
  function weekdayLabel(day){
    return ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(day)] || '';
  }
  function parseAssistantSessionCount(text){
    var n = norm(text);
    var match = n.match(/(\d+)\s*(sess|atend|consulta|encontro)/);
    return match ? Number(match[1]) : 0;
  }
  function parseAssistantFrequency(text){
    var n = norm(text);
    var match = n.match(/(\d+)\s*(x|vez(?:es)?)\s*(?:por\s*)?semana/);
    if(match) return Number(match[1]);
    return 0;
  }
  function parseAssistantPhone(text){
    var match = String(text || '').match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/);
    return match ? cleanPhone(match[0]).slice(-11) : '';
  }
  function parseAssistantName(text, isNewPatient){
    var raw = String(text || '').trim();
    var byMarker = raw.match(/(?:nova?\s+paciente|novo\s+paciente|paciente)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,60})/i);
    if(byMarker) return limitText(byMarker[1].split(/,|;| - /)[0], 80);
    if(isNewPatient){
      var start = raw.split(',')[0];
      start = start.replace(/^(nova?\s+paciente|novo\s+paciente|paciente)\s*/i, '');
      if(start && !/\d/.test(start)) return limitText(start, 80);
    }
    var first = raw.split(',')[0].trim();
    if(first && !/\d/.test(first) && first.split(' ').length <= 5) return limitText(first, 80);
    return '';
  }
  function findAssistantPatientCandidates(name, phone){
    var runtime = assistantRuntime();
    var query = phone || name || '';
    if(runtime && typeof runtime.findPatientMatches === 'function') return runtime.findPatientMatches(query) || [];
    var agenda = getAgendaState();
    var normalized = norm(name);
    return (agenda.patients || []).filter(function(patient){
      if(patient.archived === true) return false;
      return (!!phone && cleanPhone(patient.whatsapp) === cleanPhone(phone)) || (!!normalized && norm(patient.name).indexOf(normalized) !== -1);
    }).slice(0, 8).map(function(patient){
      return { id: patient.id, name: patient.name || 'Paciente sem nome', whatsapp: patient.whatsapp || '', pathology: patient.pathology || '' };
    });
  }
  function resolveAssistantExistingPatientId(data, candidates){
    if(data && data.patient_id) return String(data.patient_id);
    candidates = Array.isArray(candidates) ? candidates : [];
    if(candidates.length === 1) return String(candidates[0].id || '');
    var phone = cleanPhone(data && data.patient_phone || '');
    var name = norm(data && data.patient_name || '');
    var exact = candidates.find(function(item){
      return (!!phone && cleanPhone(item.whatsapp || '') === phone) || (!!name && norm(item.name || '') === name);
    });
    return exact ? String(exact.id || '') : '';
  }
  function assistantDefaultStartDate(days){
    days = Array.isArray(days) ? days : [];
    if(!days.length) return '';
    return nextDateForWeekday(todayIso(), days[0]);
  }
  function assistantServiceLabel(service){
    if(!service) return 'Servico nao selecionado';
    var mode = service.appointment_mode === 'individual' ? 'individual' : 'grupo';
    return [service.name || 'Servico', mode, (service.duration_minutes || 45) + ' min'].join(' · ');
  }
  function renderAssistantPatientSelect(selectedId){
    var select = el('assistantPatientSelect');
    if(!select) return;
    var options = ['<option value="">Selecione um paciente já cadastrado</option>'].concat(listAssistantPatients().map(function(patient){
      var extra = patient.whatsapp ? ' · ' + formatPatientPhone(patient.whatsapp) : '';
      return '<option value="' + esc(patient.id) + '"' + (String(patient.id) === String(selectedId || '') ? ' selected' : '') + '>' + esc((patient.name || 'Paciente sem nome') + extra) + '</option>';
    }));
    select.innerHTML = options.join('');
  }
  function renderAssistantServiceSelect(selectedId){
    var select = el('assistantServiceSelect');
    if(!select) return;
    var options = ['<option value="">Selecione o serviço</option>'].concat(listAssistantServices().map(function(service){
      var mode = service.appointment_mode === 'individual' ? 'Individual' : 'Grupo';
      return '<option value="' + esc(service.id) + '"' + (String(service.id) === String(selectedId || '') ? ' selected' : '') + '>' + esc((service.name || 'Servico') + ' · ' + mode) + '</option>';
    }));
    select.innerHTML = options.join('');
  }
  function setAssistantInlineStatus(message){
    if(el('assistantPatientInlineStatus')) el('assistantPatientInlineStatus').textContent = message || '';
  }
  function setAssistantNewPatientMode(enabled){
    enabled = !!enabled;
    var box = el('assistantNewPatientFields');
    var select = el('assistantPatientSelect');
    var btn = el('assistantTogglePatientModeBtn');
    if(box) box.classList.toggle('hidden', !enabled);
    if(btn) btn.textContent = enabled ? 'Usar paciente cadastrado' : 'Novo paciente';
    if(enabled){
      if(select) select.value = '';
      setAssistantInlineStatus('Preencha nome, WhatsApp e observacao para criar um novo paciente.');
    }else{
      setAssistantInlineStatus('Selecione um paciente já cadastrado. Se não encontrar, abra o cadastro inline.');
    }
  }
  function syncAssistantPatientModeFromForm(){
    var selectedId = el('assistantPatientSelect') ? el('assistantPatientSelect').value : '';
    var hasNewName = !!(el('assistantNewPatientName') && el('assistantNewPatientName').value.trim());
    var hasNewPhone = !!(el('assistantNewPatientPhone') && cleanPhone(el('assistantNewPatientPhone').value));
    setAssistantNewPatientMode(!selectedId && (hasNewName || hasNewPhone || !selectedId && !el('assistantNewPatientFields')?.classList.contains('hidden')));
    if(selectedId) setAssistantNewPatientMode(false);
  }
  function clearAssistantNewPatientFields(){
    if(el('assistantNewPatientName')) el('assistantNewPatientName').value = '';
    if(el('assistantNewPatientPhone')) el('assistantNewPatientPhone').value = '';
    if(el('assistantNewPatientPathology')) el('assistantNewPatientPathology').value = '';
  }
  function readAssistantReviewForm(){
    var weekdays = [];
    document.querySelectorAll('[data-assistant-weekday]').forEach(function(input){
      if(input.checked) weekdays.push(Number(input.value));
    });
    var selectedPatientId = el('assistantPatientSelect') ? el('assistantPatientSelect').value : '';
    var selectedPatient = listAssistantPatients().find(function(item){ return String(item.id) === String(selectedPatientId); }) || null;
    var isNewPatient = !selectedPatientId && !el('assistantNewPatientFields')?.classList.contains('hidden');
    var serviceId = el('assistantServiceSelect') ? el('assistantServiceSelect').value : '';
    var selectedService = listAssistantServices().find(function(item){ return String(item.id) === String(serviceId); }) || null;
    return {
      patient_mode: selectedPatient ? 'existing' : (isNewPatient ? 'new' : 'unknown'),
      patient_id: selectedPatient ? selectedPatient.id : '',
      patient_name: selectedPatient ? (selectedPatient.name || '') : (el('assistantNewPatientName') ? el('assistantNewPatientName').value.trim() : ''),
      patient_phone: selectedPatient ? cleanPhone(selectedPatient.whatsapp || '') : (el('assistantNewPatientPhone') ? cleanPhone(el('assistantNewPatientPhone').value) : ''),
      patient_pathology: selectedPatient ? (selectedPatient.pathology || '') : (el('assistantNewPatientPathology') ? el('assistantNewPatientPathology').value.trim() : ''),
      service_id: serviceId,
      service_name: selectedService ? selectedService.name || '' : '',
      weekdays: weekdays,
      period: el('assistantPeriod') ? el('assistantPeriod').value : '',
      frequency_per_week: Number(el('assistantFrequency') ? el('assistantFrequency').value || 0 : 0),
      total_sessions: Number(el('assistantTotalSessions') ? el('assistantTotalSessions').value || 0 : 0),
      start_date: el('assistantStartDate') ? el('assistantStartDate').value : '',
      notes: ''
    };
  }
  function assistantMissingFields(data){
    var missing = [];
    if(!data.patient_name) missing.push('Nome do paciente');
    if(data.patient_mode === 'new' && !data.patient_phone) missing.push('WhatsApp do paciente');
    if(!data.service_id) missing.push('Servico');
    if(!Array.isArray(data.weekdays) || !data.weekdays.length) missing.push('Dias da semana');
    if(!Number(data.frequency_per_week || 0)) missing.push('Frequencia semanal');
    if(!Number(data.total_sessions || 0)) missing.push('Quantidade de sessoes');
    if(!data.start_date) missing.push('Data inicial');
    return missing;
  }

  function assistantBookingSummary(data){
    if(!data) return '';
    var bits = [];
    if(data.patient_name) bits.push(data.patient_name);
    if(data.service_name) bits.push(data.service_name);
    if(Array.isArray(data.weekdays) && data.weekdays.length) bits.push(data.weekdays.map(weekdayLabel).join(' / '));
    if(data.period) bits.push(data.period);
    if(data.frequency_per_week) bits.push(data.frequency_per_week + 'x/sem');
    if(data.total_sessions) bits.push(data.total_sessions + ' sessoes');
    return bits.join(' · ');
  }

  function populateAssistantBookingForm(){
    var data = state.assistantBookingData || {};
    if(!data.patient_name && !data.service_id) return;
    renderAssistantPatientSelect(data.patient_id || '');
    renderAssistantServiceSelect(data.service_id || '');
    if(el('assistantStartDate')) el('assistantStartDate').value = data.start_date || '';
    if(el('assistantPeriod')) el('assistantPeriod').value = data.period || '';
    if(el('assistantFrequency')) el('assistantFrequency').value = data.frequency_per_week || '';
    if(el('assistantTotalSessions')) el('assistantTotalSessions').value = data.total_sessions || '';
    var newPatientMode = data.patient_mode === 'new' || (!data.patient_id && (!!data.patient_name || !!data.patient_phone));
    if(el('assistantNewPatientName')) el('assistantNewPatientName').value = newPatientMode ? (data.patient_name || '') : '';
    if(el('assistantNewPatientPhone')) el('assistantNewPatientPhone').value = newPatientMode ? assistantFormatPhone(data.patient_phone || '') : '';
    if(el('assistantNewPatientPathology')) el('assistantNewPatientPathology').value = newPatientMode ? (data.patient_pathology || '') : '';
    document.querySelectorAll('[data-assistant-weekday]').forEach(function(input){
      input.checked = Array.isArray(data.weekdays) && data.weekdays.indexOf(Number(input.value)) !== -1;
    });
    setAssistantNewPatientMode(newPatientMode);
    renderAssistantReviewDayState();
  }
  function renderAssistantReview(){
    var target = el('assistantBookingReview');
    if(!target) return;
    var data = state.assistantBookingData || {};
    if(!data.patient_name && !data.service_id){
      target.innerHTML = '';
      return;
    }
    var missing = state.assistantMissingFields && state.assistantMissingFields.length ? state.assistantMissingFields : assistantMissingFields(data);
    var selectedPatient = data.patient_id ? listAssistantPatients().find(function(item){ return String(item.id) === String(data.patient_id); }) : null;
    var selectedService = data.service_id ? listAssistantServices().find(function(item){ return String(item.id) === String(data.service_id); }) : null;
    var patientLabel = selectedPatient ? (selectedPatient.name || 'Paciente') : (data.patient_name || 'Paciente nao informado');
    var patientConfirmed = !!(data.patient_id && data.patient_mode === 'existing');
    var patientStatus = patientConfirmed ? 'Paciente pronto para agenda.' : 'Confirme o paciente antes de criar a grade.';
    var summaryLines = [
      '<div><span>Paciente</span><strong>' + esc(patientLabel) + '</strong></div>',
      '<div><span>WhatsApp</span><strong>' + esc(assistantFormatPhone(data.patient_phone || '') || 'Nao informado') + '</strong></div>',
      '<div><span>Servico</span><strong>' + esc(assistantServiceLabel(selectedService)) + '</strong></div>',
      '<div><span>Dias</span><strong>' + esc(Array.isArray(data.weekdays) && data.weekdays.length ? data.weekdays.map(weekdayLabel).join(' / ') : 'Nao informado') + '</strong></div>',
      '<div><span>Periodo</span><strong>' + esc(data.period ? String(data.period).replace(/^./, function(letter){ return letter.toUpperCase(); }) : 'Qualquer periodo') + '</strong></div>',
      '<div><span>Ritmo</span><strong>' + esc((data.frequency_per_week || 0) ? (data.frequency_per_week + 'x por semana') : 'Nao informado') + '</strong></div>',
      '<div><span>Sessoes</span><strong>' + esc((data.total_sessions || 0) ? String(data.total_sessions) : 'Nao informado') + '</strong></div>',
      '<div><span>Inicio</span><strong>' + esc(data.start_date ? fmtDate(data.start_date) : 'Nao informado') + '</strong></div>'
    ];
    target.innerHTML =
      '<div class="assistant-review-card">' +
        '<div class="assistant-review-head">' +
          '<div><span class="assistant-chip">Resumo</span><strong>' + esc(assistantBookingSummary(data) || 'Preencha os dados para montar a grade') + '</strong></div>' +
          '<div class="muted small">' + esc(patientStatus) + '</div>' +
        '</div>' +
        (missing.length ? '<div class="assistant-warning">Faltando: ' + esc(missing.join(' · ')) + '</div>' : '') +
        '<div class="assistant-summary-grid">' + summaryLines.join('') + '</div>' +
        '<div class="assistant-review-actions">' +
          '<button class="btn primary" type="button" onclick="window.recalculateAssistantBooking()">Atualizar melhores opcoes</button>' +
          '<button class="btn" type="button" onclick="window.confirmAssistantBookingPatient()">' + (patientConfirmed ? 'Paciente confirmado' : 'Confirmar paciente') + '</button>' +
        '</div>' +
      '</div>';
  }
  function renderAssistantPlans(){
    var target = el('assistantBookingPlans');
    if(!target) return;
    var plans = state.assistantBookingPlans || [];
    if(!plans.length){
      var missing = state.assistantMissingFields || [];
      target.innerHTML = '<div class="assistant-empty">' + esc(missing.length ? 'Complete os campos essenciais para sugerir a grade.' : (state.assistantBookingReason || 'As grades sugeridas aparecem aqui depois da revisao.')) + '</div>';
      return;
    }
    target.innerHTML = '<div class="assistant-plan-grid">' + plans.map(function(plan, index){
      var selected = Number(state.assistantBookingSelectedPlan) === index;
      return '<article class="assistant-plan-card' + (selected ? ' selected' : '') + '">' +
        '<div class="assistant-plan-top"><span class="assistant-chip">' + esc(plan.badge || ('Grade ' + (index + 1))) + '</span><strong>' + esc(plan.summary || 'Grade recorrente') + '</strong></div>' +
        '<p class="muted small">' + esc(plan.reason || '') + '</p>' +
        '<div class="assistant-plan-meta"><span>' + esc(plan.coverage || '') + '</span><span>' + esc((plan.conflicts || 0) + ' conflito(s) evitado(s)') + '</span><span>' + esc(plan.impact || '') + '</span></div>' +
        '<div class="assistant-plan-actions"><button class="btn small" type="button" onclick="window.selectAssistantBookingPlan(' + index + ')">Usar esta grade</button>' +
        '<button class="btn small primary" type="button" onclick="window.confirmAssistantBookingPlan(' + index + ')">Confirmar grade</button></div>' +
      '</article>';
    }).join('') + '</div>';
  }
  function renderAssistantBookingWorkspace(){
    populateAssistantBookingForm();
    renderAssistantReview();
    renderAssistantPlans();
  }

  window.startAssistantBooking = async function(){
    var form = readAssistantReviewForm();
    state.assistantBookingData = form;
    state.assistantBookingPlans = [];
    state.assistantBookingSelectedPlan = -1;
    state.assistantBookingPatientCandidates = [];
    state.assistantMissingFields = assistantMissingFields(form);
    if(state.assistantMissingFields.length){
      renderAssistantBookingWorkspace();
      return;
    }
    try{
      var runtime = assistantRuntime();
      if(!runtime || typeof runtime.suggestRecurringPrograms !== 'function'){
        throw new Error('A agenda ainda nao expôs sugestoes recorrentes. Atualize a pagina.');
      }
      var result = await runtime.suggestRecurringPrograms({
        service_id: form.service_id,
        weekdays: form.weekdays,
        period: form.period,
        frequency_per_week: form.frequency_per_week,
        total_sessions: form.total_sessions,
        start_date: form.start_date
      });
      state.assistantBookingPlans = result.plans || [];
      state.assistantBookingReason = result.reason || '';
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Melhores opcoes calculadas para a grade.', 'success');
    }catch(error){
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Nao consegui calcular a grade: ' + (error.message || error), 'warning');
    }
  };
  window.recalculateAssistantBooking = async function(){
    if(!state.assistantBookingData) return;
    var form = readAssistantReviewForm();
    state.assistantBookingData = form;
    state.assistantMissingFields = assistantMissingFields(form);
    if(state.assistantMissingFields.length){
      renderAssistantBookingWorkspace();
      return;
    }
    try{
      var runtime = assistantRuntime();
      if(!runtime || typeof runtime.suggestRecurringPrograms !== 'function'){
        throw new Error('A agenda ainda nao expôs sugestoes recorrentes. Atualize a pagina.');
      }
      var result = await runtime.suggestRecurringPrograms({
        service_id: form.service_id,
        weekdays: form.weekdays,
        period: form.period,
        frequency_per_week: form.frequency_per_week,
        total_sessions: form.total_sessions,
        start_date: form.start_date
      });
      state.assistantBookingPlans = result.plans || [];
      state.assistantBookingReason = result.reason || '';
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Melhores opcoes atualizadas.', 'success');
    }catch(error){
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Nao consegui atualizar a grade: ' + (error.message || error), 'warning');
    }
  };
  window.selectAssistantBookingPlan = function(index){
    state.assistantBookingSelectedPlan = Number(index);
    renderAssistantBookingWorkspace();
  };
  window.confirmAssistantBookingPatient = async function(){
    var data = readAssistantReviewForm();
    state.assistantBookingData = data;
    var runtime = assistantRuntime();
    try{
      if(data.patient_mode === 'new'){
        if(!runtime || typeof runtime.createPatient !== 'function') throw new Error('Criacao de paciente ainda indisponivel.');
        var created = await runtime.createPatient({ name: data.patient_name, whatsapp: data.patient_phone, pathology: data.patient_pathology });
        data.patient_id = created.id;
        data.patient_mode = 'existing';
      }else{
        if(!data.patient_id) throw new Error('Selecione o paciente existente antes de confirmar.');
        var patient = listAssistantPatients().find(function(item){ return String(item.id) === String(data.patient_id); });
        if(!patient) throw new Error('Paciente selecionado nao foi encontrado.');
      }
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Paciente confirmado para a agenda.', 'success');
    }catch(error){
      if(typeof window.toast === 'function') window.toast('Nao consegui confirmar o paciente: ' + (error.message || error), 'error');
    }
  };
  window.confirmAssistantBookingPlan = async function(index){
    var data = state.assistantBookingData;
    var plans = state.assistantBookingPlans || [];
    var plan = plans[Number(index)];
    if(!plan){
      if(typeof window.toast === 'function') window.toast('Grade sugerida nao encontrada.', 'warning');
      return;
    }
    if(!(data && data.patient_id)){
      if(typeof window.toast === 'function') window.toast('Confirme o paciente antes de criar a grade.', 'warning');
      return;
    }
    var resume = (data.patient_name || 'Paciente') + '\n' + (data.service_name || 'Servico') + '\n' + (plan.summary || '') + '\n' + (plan.coverage || '');
    if(!window.confirm('Confirmar esta grade recorrente?\n\n' + resume)) return;
    try{
      var runtime = assistantRuntime();
      if(!runtime || typeof runtime.confirmRecurringProgram !== 'function') throw new Error('Confirmacao recorrente indisponivel.');
      var result = await runtime.confirmRecurringProgram({ patient_id: data.patient_id, sessions: plan.sessions || [] });
      state.assistantBookingSelectedPlan = Number(index);
      state.assistantBookingReason = (result.created || 0) + ' sessoes criadas a partir da grade.';
      renderAssistantBookingWorkspace();
      if(typeof window.toast === 'function') window.toast('Grade confirmada com sucesso.', 'success');
    }catch(error){
      if(typeof window.toast === 'function') window.toast('Nao consegui confirmar a grade: ' + (error.message || error), 'error');
    }
  };
  window.renderAssistantReviewDayState = function(){
    document.querySelectorAll('.assistant-day').forEach(function(label){
      var input = label.querySelector('input');
      label.classList.toggle('active', !!(input && input.checked));
    });
  };

  function buildSystemPrompt(){
    return [
      'Voce e a IA clinica da FEMIC.',
      'Seu papel e ajudar com rascunhos revisaveis de anamnese, evolucao clinica e plano de tratamento.',
      getConfig().rules || DEFAULT_ASSISTANT_RULES
    ].join('\n');
  }
  function buildExternalPrompt(prompt){
    return buildSystemPrompt() + '\n\nSolicitacao:\n' + prompt;
  }
  async function callGemini(config, prompt){
    var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(config.geminiModel) + ':generateContent?key=' + encodeURIComponent(config.geminiKey), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ contents:[{ parts:[{ text: buildExternalPrompt(prompt) }] }] })
    });
    var data = await response.json();
    if(!response.ok) throw new Error((data && data.error && data.error.message) || 'Falha no Gemini');
    return (((data || {}).candidates || [])[0] || {}).content && ((((data || {}).candidates || [])[0].content.parts || [])[0] || {}).text || '';
  }
  async function callGroq(config, prompt){
    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + config.groqKey
      },
      body: JSON.stringify({
        model: config.groqModel,
        messages: [{ role:'system', content: buildSystemPrompt() }, { role:'user', content: prompt }],
        temperature: 0.2
      })
    });
    var data = await response.json();
    if(!response.ok) throw new Error((data && data.error && data.error.message) || 'Falha no Groq');
    return (((data || {}).choices || [])[0] || {}).message && ((((data || {}).choices || [])[0] || {}).message.content) || '';
  }
  async function callDeepSeek(config, prompt){
    var response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + config.deepseekKey
      },
      body: JSON.stringify({
        model: config.deepseekModel,
        messages: [{ role:'system', content: buildSystemPrompt() }, { role:'user', content: prompt }],
        temperature: 0.2
      })
    });
    var data = await response.json();
    if(!response.ok) throw new Error((data && data.error && data.error.message) || 'Falha no DeepSeek');
    return (((data || {}).choices || [])[0] || {}).message && ((((data || {}).choices || [])[0] || {}).message.content) || '';
  }
  async function callExternalWithFallback(prompt, provider){
    var config = getConfig();
    var order = providerOrder(provider).filter(function(item){ return providerHasKey(config, item); });
    if(!order.length) throw new Error('Configure ao menos uma chave de IA para usar os rascunhos clinicos.');
    var lastError = null;
    for(var i = 0; i < order.length; i += 1){
      var current = order[i];
      try{
        if(current === 'gemini') return { provider: current, text: await callGemini(config, prompt) };
        if(current === 'groq') return { provider: current, text: await callGroq(config, prompt) };
        if(current === 'deepseek') return { provider: current, text: await callDeepSeek(config, prompt) };
      }catch(error){
        lastError = error;
      }
    }
    throw lastError || new Error('Falha ao consultar os provedores configurados.');
  }
  function extractJson(text){
    var raw = String(text || '').trim();
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if(start === -1 || end === -1 || end <= start) throw new Error('A resposta nao veio em JSON valido.');
    return JSON.parse(raw.slice(start, end + 1));
  }
  function getSelectedPatientOrWarn(){
    var unified = getUnifiedState();
    if(unified.currentPatient) return unified.currentPatient;
    window.alert('Selecione um paciente no prontuario antes de usar a IA clinica.');
    return null;
  }
  function readFieldValue(id){
    return el(id) ? String(el(id).value || '').trim() : '';
  }
  function buildAnamneseContext(patient){
    var lines = [];
    if(patient && patient.name) lines.push('Paciente: ' + patient.name);
    var age = patientAgeLabel(patient);
    if(age) lines.push('Idade: ' + age + ' anos');
    if(patient && patient.referral_source) lines.push('Como nos encontrou: ' + patient.referral_source);
    if(patient && patient.pathology) lines.push('Patologia conhecida: ' + patient.pathology);
    if(readFieldValue('anamChief')) lines.push('Queixa principal atual: ' + readFieldValue('anamChief'));
    if(readFieldValue('anamHistory')) lines.push('Historia/anamnese: ' + readFieldValue('anamHistory'));
    if(readFieldValue('anamDiagnosis')) lines.push('Diagnostico/hipotese atual: ' + readFieldValue('anamDiagnosis'));
    if(readFieldValue('anamLimitations')) lines.push('Limitacoes atuais: ' + readFieldValue('anamLimitations'));
    if(readFieldValue('anamGoals')) lines.push('Objetivos atuais: ' + readFieldValue('anamGoals'));
    if(readFieldValue('anamObs')) lines.push('Observacoes atuais: ' + readFieldValue('anamObs'));
    return lines.join('\n');
  }
  function buildEvolutionContext(patient){
    var unified = getUnifiedState();
    var lastEvolution = (unified.currentEvolutions || [])[0];
    var lines = [];
    if(patient && patient.name) lines.push('Paciente: ' + patient.name);
    if(patient && patient.pathology) lines.push('Patologia conhecida: ' + patient.pathology);
    if(lastEvolution && lastEvolution.conduct) lines.push('Ultima evolucao registrada: ' + lastEvolution.conduct);
    if(lastEvolution && lastEvolution.guidance) lines.push('Ultima orientacao registrada: ' + lastEvolution.guidance);
    if(readFieldValue('evolutionConduct')) lines.push('Conduta atual ja digitada: ' + readFieldValue('evolutionConduct'));
    if(readFieldValue('evolutionGuidance')) lines.push('Orientacoes atuais ja digitadas: ' + readFieldValue('evolutionGuidance'));
    return lines.join('\n');
  }
  function patientAgeLabel(patient){
    if(!patient) return '';
    var explicit = patient.age || patient.idade;
    if(explicit) return String(explicit);
    var utils = window.FEMICClinicalUtils || null;
    if(!utils || typeof utils.calculateAge !== 'function') return '';
    var birth = patient.birth_date || patient.birthdate || patient.birth || patient.data_nascimento;
    var age = utils.calculateAge(birth);
    return age != null ? String(age) : '';
  }
  function buildTreatmentContext(patient){
    var unified = getUnifiedState();
    var anamnese = unified.currentAnamnese || {};
    var lastEvolutions = (unified.currentEvolutions || []).slice(0, 4);
    var lines = [];
    if(patient && patient.name) lines.push('Paciente: ' + patient.name);
    var age = patientAgeLabel(patient);
    if(age) lines.push('Idade: ' + age + ' anos');
    if(patient && patient.pathology) lines.push('Patologia/observacao do cadastro: ' + patient.pathology);
    if(anamnese.chief_complaint || readFieldValue('anamChief')) lines.push('Queixa principal: ' + (readFieldValue('anamChief') || anamnese.chief_complaint));
    if(anamnese.history || readFieldValue('anamHistory')) lines.push('Historia/anamnese: ' + (readFieldValue('anamHistory') || anamnese.history));
    if(anamnese.diagnosis || anamnese.clinical_summary || readFieldValue('anamDiagnosis')) lines.push('Diagnostico/hipotese: ' + (readFieldValue('anamDiagnosis') || anamnese.diagnosis || anamnese.clinical_summary));
    if(anamnese.limitations || anamnese.physical_activity_context || readFieldValue('anamLimitations')) lines.push('Limitacoes funcionais: ' + (readFieldValue('anamLimitations') || anamnese.limitations || anamnese.physical_activity_context));
    if(anamnese.goals || readFieldValue('anamGoals')) lines.push('Objetivos funcionais: ' + (readFieldValue('anamGoals') || anamnese.goals));
    if(anamnese.obs || readFieldValue('anamObs')) lines.push('Observacoes: ' + (readFieldValue('anamObs') || anamnese.obs));
    if(readFieldValue('evolutionConduct')) lines.push('Conduta/evolucao digitada agora: ' + readFieldValue('evolutionConduct'));
    if(readFieldValue('evolutionGuidance')) lines.push('Orientacoes digitadas agora: ' + readFieldValue('evolutionGuidance'));
    lastEvolutions.forEach(function(item, idx){
      var text = [item.conduct, item.guidance].filter(Boolean).join(' | ');
      if(text) lines.push('Evolucao recente ' + (idx + 1) + ' (' + fmtDate(item.date) + '): ' + text);
    });
    lines.push('');
    lines.push('Contexto adicional livre:');
    return lines.join('\n');
  }
  function renderTreatmentDraft(text){
    state.treatmentDraftText = String(text || '').trim();
    var box = el('clinicalTreatmentDraft');
    var actions = el('clinicalTreatmentActions');
    if(!box || !actions) return;
    if(!state.treatmentDraftText){
      box.classList.add('hidden');
      actions.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.innerHTML = '<div class="clinical-treatment-title">Rascunho revisavel</div><div class="clinical-treatment-text">' + esc(state.treatmentDraftText).replace(/\n/g, '<br>') + '</div>';
    box.classList.remove('hidden');
    actions.classList.remove('hidden');
  }
  function resetTreatmentDraft(){
    renderTreatmentDraft('');
  }
  function setClinicalAIInputVisible(visible){
    ['clinicalAiInputToolbar','clinicalAiPromptField','clinicalAiModalStatus'].forEach(function(id){
      if(el(id)) el(id).classList.toggle('hidden', !visible);
    });
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').classList.toggle('hidden', !visible);
  }
  function renderClinicalAIChoices(){
    var target = el('clinicalAiChoices');
    if(!target) return;
    var choices = [
      { mode:'anamnese', title:'Organizar anamnese', text:'Distribui o relato nos blocos rápidos biopsicossociais.', tone:'start' },
      { mode:'evolucao', title:'Registrar evolucao', text:'Resume a sessao de hoje em evolucao clinica e orientacoes.', tone:'session' },
      { mode:'tratamento', title:'Planejar tratamento', text:'Gera um plano FEMIC faseado para revisar, copiar ou aplicar.', tone:'plan' }
    ];
    target.innerHTML = choices.map(function(item){
      return '<button class="clinical-ai-choice ' + item.tone + '" type="button" onclick="selectClinicalAIMode(\'' + item.mode + '\')"><strong>' + esc(item.title) + '</strong><span>' + esc(item.text) + '</span></button>';
    }).join('');
    target.classList.remove('hidden');
  }
  function openClinicalAIAssistant(){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    state.clinicalMode = '';
    resetTreatmentDraft();
    stopClinicalAIMicrophone();
    if(el('clinicalAiMode')) el('clinicalAiMode').value = '';
    if(el('clinicalAiModalTitle')) el('clinicalAiModalTitle').textContent = 'Assistente IA';
    if(el('clinicalAiModalHelper')) el('clinicalAiModalHelper').textContent = 'Escolha o que voce quer gerar. A IA usa o contexto do paciente e entrega apenas rascunhos para revisao.';
    if(el('clinicalAiPrompt')) el('clinicalAiPrompt').value = '';
    if(el('clinicalAiSubmitBtn')){
      el('clinicalAiSubmitBtn').disabled = false;
      el('clinicalAiSubmitBtn').textContent = 'Gerar rascunho';
    }
    setClinicalAIInputVisible(false);
    renderClinicalAIChoices();
    var modal = el('clinicalAiModal');
    if(modal) modal.classList.add('show');
  }
  function selectClinicalAIMode(mode){
    openClinicalAIModal(mode);
  }
  function openClinicalAIModal(mode){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    if(!mode){
      openClinicalAIAssistant();
      return;
    }
    state.clinicalMode = mode;
    if(el('clinicalAiMode')) el('clinicalAiMode').value = mode;
    resetTreatmentDraft();
    if(el('clinicalAiChoices')) el('clinicalAiChoices').classList.add('hidden');
    setClinicalAIInputVisible(true);
    if(el('clinicalAiModalTitle')) el('clinicalAiModalTitle').textContent = mode === 'anamnese' ? 'Gerar rascunho de anamnese' : (mode === 'tratamento' ? 'Assistente de tratamento FEMIC' : 'Gerar rascunho de evolucao clinica');
    if(el('clinicalAiModalHelper')) el('clinicalAiModalHelper').textContent = mode === 'anamnese'
      ? 'Descreva o caso de forma livre. A IA vai organizar a anamnese rápida em queixa, história, ocupação, atividade física, red flags, psicossociais e síntese clínica.'
      : (mode === 'tratamento'
        ? 'Revise o contexto do paciente e acrescente detalhes clinicos livres. A IA vai gerar um plano de tratamento para voce revisar, copiar ou aplicar na evolucao.'
        : 'Descreva a sessao, resposta do paciente, conduta e orientacoes. Voce pode usar o microfone e complementar o que ja estiver escrito.');
    if(el('clinicalAiPrompt')) el('clinicalAiPrompt').value = mode === 'anamnese' ? buildAnamneseContext(patient) : (mode === 'tratamento' ? buildTreatmentContext(patient) : buildEvolutionContext(patient));
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').disabled = false;
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').textContent = mode === 'anamnese' ? 'Gerar anamnese' : (mode === 'tratamento' ? 'Gerar plano' : 'Gerar evolucao');
    setClinicalAiStatus(speechRecognitionCtor() ? 'Digite ou dite o resumo clinico e depois gere o rascunho.' : 'Digite o resumo clinico. Seu navegador nao expôs reconhecimento de voz nesta tela.');
    var micBtn = el('clinicalAiMicBtn');
    if(micBtn){
      micBtn.disabled = !speechRecognitionCtor();
      micBtn.classList.remove('is-listening');
      micBtn.textContent = 'Usar microfone';
    }
    var modal = el('clinicalAiModal');
    if(modal) modal.classList.add('show');
    window.setTimeout(function(){
      if(el('clinicalAiPrompt')) el('clinicalAiPrompt').focus();
    }, 40);
  }
  function closeClinicalAIModal(){
    stopClinicalAIMicrophone();
    if(el('clinicalAiModal')) el('clinicalAiModal').classList.remove('show');
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').textContent = 'Gerar rascunho';
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').classList.remove('hidden');
    if(el('clinicalAiChoices')) el('clinicalAiChoices').classList.add('hidden');
    setClinicalAIInputVisible(true);
  }
  function clearClinicalAIPrompt(){
    if(el('clinicalAiPrompt')) el('clinicalAiPrompt').value = '';
    setClinicalAiStatus('Campo limpo. Voce pode digitar ou ditar um novo resumo clinico.');
  }
  function stopClinicalAIMicrophone(){
    if(state.speechRecognition && state.speechListening){
      try{ state.speechRecognition.stop(); }catch(e){}
    }
    state.speechListening = false;
    var micBtn = el('clinicalAiMicBtn');
    if(micBtn){
      micBtn.classList.remove('is-listening');
      micBtn.textContent = 'Usar microfone';
    }
  }
  function startClinicalAIMicrophone(){
    var Ctor = speechRecognitionCtor();
    if(!Ctor){
      setClinicalAiStatus('Reconhecimento de voz nao disponivel neste navegador.');
      if(typeof window.toast === 'function') window.toast('Microfone indisponivel neste navegador.', 'warning');
      return;
    }
    stopClinicalAIMicrophone();
    var recognition = new Ctor();
    state.speechRecognition = recognition;
    state.speechListening = true;
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    var baseText = readFieldValue('clinicalAiPrompt');
    recognition.onstart = function(){
      var micBtn = el('clinicalAiMicBtn');
      if(micBtn){
        micBtn.classList.add('is-listening');
        micBtn.textContent = 'Parar microfone';
      }
      setClinicalAiStatus('Microfone ativo. Fale naturalmente e o texto sera inserido no resumo clinico.');
    };
    recognition.onresult = function(event){
      var finalText = '';
      var interimText = '';
      for(var i = event.resultIndex; i < event.results.length; i += 1){
        var transcript = String(event.results[i][0].transcript || '').trim();
        if(!transcript) continue;
        if(event.results[i].isFinal) finalText += (finalText ? ' ' : '') + transcript;
        else interimText += (interimText ? ' ' : '') + transcript;
      }
      if(el('clinicalAiPrompt')){
        var merged = baseText;
        if(finalText) merged = (merged ? merged + '\n' : '') + finalText;
        el('clinicalAiPrompt').value = interimText ? (merged ? merged + '\n' : '') + interimText : merged;
      }
      if(finalText) baseText = el('clinicalAiPrompt') ? String(el('clinicalAiPrompt').value || '').trim() : baseText;
    };
    recognition.onerror = function(event){
      stopClinicalAIMicrophone();
      setClinicalAiStatus('Falha no microfone: ' + (event && event.error ? event.error : 'erro desconhecido') + '.');
    };
    recognition.onend = function(){
      state.speechListening = false;
      var micBtn = el('clinicalAiMicBtn');
      if(micBtn){
        micBtn.classList.remove('is-listening');
        micBtn.textContent = 'Usar microfone';
      }
    };
    recognition.start();
  }
  function toggleClinicalAIMicrophone(){
    if(state.speechListening) stopClinicalAIMicrophone();
    else startClinicalAIMicrophone();
  }
  async function generateAnamneseDraft(patient, notes){
    var prompt = [
      'Monte anamnese fisioterapeutica objetiva em JSON.',
      'Responda apenas JSON valido, sem markdown.',
      'Campos obrigatorios: chief_complaint, history, diagnosis, limitations, goals, obs.',
      'Limite por campo: ate 260 caracteres. Seja curto, objetivo e util para prontuario.',
      'Se algum dado nao foi informado, escreva de forma segura e concisa como "Nao informado".',
      'Paciente: ' + patient.name,
      patientAgeLabel(patient) ? 'Idade: ' + patientAgeLabel(patient) + ' anos' : '',
      patient.referral_source ? 'Como nos encontrou: ' + patient.referral_source : '',
      'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
      'Contexto clinico:',
      notes
    ].filter(Boolean).join('\n');
    var external = await callExternalWithFallback(prompt, getConfig().provider);
    return { provider: external.provider, draft: extractJson(external.text) };
  }
  async function generateEvolutionDraft(patient, notes){
    var unified = getUnifiedState();
    var lastEvolution = (unified.currentEvolutions || [])[0];
    var prompt = [
      'Monte evolucao clinica fisioterapeutica curta em JSON.',
      'Responda apenas JSON valido, sem markdown.',
      'Campos obrigatorios: conduct, guidance.',
      'Limite: conduct ate 320 caracteres; guidance ate 220 caracteres.',
      'Paciente: ' + patient.name,
      'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
      lastEvolution && lastEvolution.conduct ? 'Ultima evolucao registrada: ' + lastEvolution.conduct.slice(0,220) : '',
      'Contexto clinico da sessao:',
      notes
    ].filter(Boolean).join('\n');
    var external = await callExternalWithFallback(prompt, getConfig().provider);
    return { provider: external.provider, draft: extractJson(external.text) };
  }
  async function generateTreatmentDraft(patient, notes){
    var prompt = [
      'Atue como Especialista Clinico Senior em Fisioterapia Musculoesqueletica, Quiropraxia e Dor Cronica.',
      'Contexto FEMIC: reabilitacao funcional, resgate de autonomia, coluna, joelho e dor cronica.',
      'Intervencoes permitidas: terapia manual avancada, quiropraxia como modulacao mecanica/neurologica, cinesioterapia funcional, exercicio terapeutico e educacao em dor.',
      'Restricoes obrigatorias: nao recomende acupuntura, dry needling, choquinhos, ultrassom passivo, infravermelho, recursos passivos de baixo valor ou protocolos engessados de Pilates classico.',
      'Responda em portugues do Brasil, com linguagem clinica objetiva, baseada em evidencias e como rascunho para revisao profissional.',
      'Nao de diagnostico definitivo nem prometa resultado. Se houver sinais de alerta, indique triagem/encaminhamento antes de progredir.',
      '',
      'Estrutura obrigatoria:',
      '1. Raciocinio clinico e triagem: red flags, yellow flags e hipotese provavel.',
      '2. Educacao em dor: analogia simples para explicar ao paciente por que o movimento pode ser seguro.',
      '3. Protocolo FEMIC faseado: Fase 1 modulacao de sintomas; Fase 2 mobilidade/reset; Fase 3 capacidade e forca funcional.',
      '4. Tarefa de casa: 1 ou 2 exercicios simples e de alta aderencia.',
      '5. Criterios de alta funcional: testes e tarefas do dia a dia.',
      '',
      'Paciente: ' + patient.name,
      'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
      'Contexto clinico:',
      notes
    ].join('\n');
    var external = await callExternalWithFallback(prompt, getConfig().provider);
    return { provider: external.provider, draft: String(external.text || '').trim() };
  }
  async function generateDocumentDraft(options){
    options = options || {};
    var patient = options.patient || {};
    var context = options.context || {};
    var prompt = [
      'Atue como especialista em documentacao clinica de fisioterapia da FEMIC.',
      'Escreva em portugues do Brasil com tom clinico formal, objetivo e profissional.',
      'Gere um rascunho revisavel de documento fisioterapeutico.',
      'Use apenas os dados fornecidos. Nao invente dados ausentes; quando faltar algo, redija de forma segura e neutra.',
      'Nao use markdown, nao use cercas de codigo, nao use asteriscos, nao use hashtags.',
      'Entregue somente o corpo do documento, pronto para edicao no prontuario.',
      'Organize em paragrafos claros. Pode usar titulos simples em caixa alta quando fizer sentido para laudo, declaracao, resumo ou recibo.',
      '',
      'Tipo do documento: ' + (options.documentTypeLabel || options.documentType || 'Documento'),
      'Titulo base: ' + (options.documentTitle || 'DOCUMENTO'),
      options.documentModelLabel ? 'Modelo base selecionado: ' + options.documentModelLabel : '',
      'Paciente: ' + (patient.name || 'Paciente'),
      patient.pathology ? 'Patologia conhecida: ' + patient.pathology : '',
      context.chief ? 'Queixa principal: ' + context.chief : '',
      context.history ? 'Historia atual: ' + context.history : '',
      context.diagnosis ? 'Diagnostico ou hipotese: ' + context.diagnosis : '',
      context.limitations ? 'Limitacoes funcionais: ' + context.limitations : '',
      context.goals ? 'Objetivos terapêuticos: ' + context.goals : '',
      context.sessionCount != null ? 'Total de sessoes registradas: ' + context.sessionCount : '',
      context.lastConduct ? 'Ultima conduta registrada: ' + context.lastConduct : '',
      context.lastGuidance ? 'Ultima orientacao registrada: ' + context.lastGuidance : '',
      options.documentDate ? 'Data de emissao: ' + options.documentDate : '',
      options.baseText ? 'Texto-base atual para aproveitar, adaptar ou substituir se necessario:\n' + options.baseText : '',
      '',
      'Solicitacao do profissional:',
      String(options.userPrompt || '').trim()
    ].filter(Boolean).join('\n');
    var external = await callExternalWithFallback(prompt, getConfig().provider);
    return { provider: external.provider, draft: String(external.text || '').trim() };
  }
  async function fillAnamneseWithAI(){
    openClinicalAIModal('anamnese');
  }
  async function fillEvolutionWithAI(){
    openClinicalAIModal('evolucao');
  }
  async function fillTreatmentWithAI(){
    openClinicalAIModal('tratamento');
  }
  async function submitClinicalAIModal(){
    var mode = (el('clinicalAiMode') ? el('clinicalAiMode').value : '') || state.clinicalMode;
    var patient = getSelectedPatientOrWarn();
    var notes = readFieldValue('clinicalAiPrompt');
    var submitBtn = el('clinicalAiSubmitBtn');
    if(!patient) return;
    if(!mode){
      setClinicalAiStatus('Escolha primeiro se deseja criar anamnese, registrar evolucao ou planejar tratamento.');
      if(typeof window.toast === 'function') window.toast('Escolha uma acao do Assistente IA.', 'warning');
      return;
    }
    if(!notes){
      setClinicalAiStatus('Descreva ou dite o contexto clinico antes de gerar o rascunho.');
      if(typeof window.toast === 'function') window.toast('Informe o contexto clinico antes de usar a IA.', 'warning');
      return;
    }
    if(submitBtn) submitBtn.disabled = true;
    setDebug('Montando rascunho clinico com IA...');
    setClinicalAiStatus('Gerando rascunho com IA...');
    try{
      if(mode === 'anamnese'){
        var anamneseResult = await generateAnamneseDraft(patient, notes);
        if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyAnamneseDraft === 'function'){
          window.FEMICUnifiedRuntime.applyAnamneseDraft(anamneseResult.draft);
        }
        setDebug('Rascunho de anamnese gerado via ' + providerLabel(anamneseResult.provider) + '. Revise antes de salvar.');
        setClinicalAiStatus('Rascunho de anamnese aplicado. Revise os campos antes de salvar.');
        if(typeof window.toast === 'function') window.toast('Rascunho de anamnese aplicado.', 'success');
        closeClinicalAIModal();
      }else if(mode === 'tratamento'){
        var treatmentResult = await generateTreatmentDraft(patient, notes);
        renderTreatmentDraft(treatmentResult.draft);
        setDebug('Plano de tratamento gerado via ' + providerLabel(treatmentResult.provider) + '. Revise antes de registrar.');
        setClinicalAiStatus('Plano de tratamento pronto como rascunho. Revise, copie ou aplique em evolução.');
        if(typeof window.toast === 'function') window.toast('Plano de tratamento gerado.', 'success');
      }else{
        var evolutionResult = await generateEvolutionDraft(patient, notes);
        if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyEvolutionDraft === 'function'){
          window.FEMICUnifiedRuntime.applyEvolutionDraft(evolutionResult.draft);
        }
        setDebug('Rascunho de evolucao gerado via ' + providerLabel(evolutionResult.provider) + '. Revise antes de salvar.');
        setClinicalAiStatus('Rascunho de evolucao aplicado. Revise os campos antes de salvar.');
        if(typeof window.toast === 'function') window.toast('Rascunho de evolucao aplicado.', 'success');
        closeClinicalAIModal();
      }
    }catch(error){
      setDebug('Falha ao gerar rascunho clinico: ' + (error.message || 'erro desconhecido'));
      setClinicalAiStatus('Falha: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Nao consegui gerar o rascunho agora: ' + error.message, 'error');
    }finally{
      if(submitBtn) submitBtn.disabled = false;
    }
  }

  function copyTreatmentDraft(){
    var text = state.treatmentDraftText || '';
    if(!text){
      setClinicalAiStatus('Gere um plano de tratamento antes de copiar.');
      return;
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        setClinicalAiStatus('Plano copiado para a area de transferencia.');
        if(typeof window.toast === 'function') window.toast('Plano copiado.', 'success');
      }).catch(function(){
        window.prompt('Copie o plano de tratamento:', text);
      });
    }else{
      window.prompt('Copie o plano de tratamento:', text);
    }
  }
  function applyTreatmentDraftToEvolution(){
    var text = state.treatmentDraftText || '';
    if(!text){
      setClinicalAiStatus('Gere um plano de tratamento antes de aplicar.');
      return;
    }
    if(el('evolutionDate') && !el('evolutionDate').value) el('evolutionDate').value = todayIso();
    if(el('evolutionConduct')){
      var current = String(el('evolutionConduct').value || '').trim();
      el('evolutionConduct').value = current ? current + '\n\nPlano de tratamento FEMIC:\n' + text : 'Plano de tratamento FEMIC:\n' + text;
    }
    setClinicalAiStatus('Plano aplicado no campo de evolucao. Revise antes de salvar.');
    if(typeof window.toast === 'function') window.toast('Plano aplicado em evolução. Revise antes de salvar.', 'success');
    closeClinicalAIModal();
  }

  window.renderAssistantAiProviderBadge = renderAssistantAiProviderBadge;
  window.openClinicalAIAssistant = openClinicalAIAssistant;
  window.selectClinicalAIMode = selectClinicalAIMode;
  window.fillTreatmentWithAI = fillTreatmentWithAI;
  window.copyTreatmentDraft = copyTreatmentDraft;
  window.applyTreatmentDraftToEvolution = applyTreatmentDraftToEvolution;
  window.saveAssistantAiConfig = function(){
    var config = readConfigFromInputs();
    saveConfigToStorage(config);
    renderAssistantAiProviderBadge();
    setDebug('Configuracao clinica salva com provedor principal ' + providerLabel(config.provider) + '.');
    if(typeof window.toast === 'function') window.toast('Configuracao da IA clinica salva.', 'success');
  };
  window.saveAssistantAiRules = function(){
    saveConfigToStorage({ rules: el('assistantAiRules') ? el('assistantAiRules').value.trim() || DEFAULT_ASSISTANT_RULES : DEFAULT_ASSISTANT_RULES });
    setDebug('Regras da IA clinica atualizadas.');
    if(typeof window.toast === 'function') window.toast('Regras da IA salvas.', 'success');
  };
  window.resetAssistantAiRules = function(){
    if(el('assistantAiRules')) el('assistantAiRules').value = DEFAULT_ASSISTANT_RULES;
    saveConfigToStorage({ rules: DEFAULT_ASSISTANT_RULES });
    setDebug('Regras padrao da IA clinica restauradas.');
    if(typeof window.toast === 'function') window.toast('Regras padrao restauradas.', 'success');
  };
  window.testAssistantAiConfig = async function(){
    var config = readConfigFromInputs();
    saveConfigToStorage(config);
    renderAssistantAiProviderBadge();
    var order = providerOrder(config.provider).filter(function(provider){ return providerHasKey(config, provider); });
    if(!order.length){
      if(typeof window.toast === 'function') window.toast('Nenhuma chave de API foi configurada para os rascunhos clinicos.', 'warning');
      return;
    }
    setDebug('Testando provedor clinico externo...');
    try{
      var external = await callExternalWithFallback('Responda apenas: ok FEMIC clinico', config.provider);
      setDebug('Teste clinico concluido com sucesso usando ' + providerLabel(external.provider) + '.');
      if(typeof window.toast === 'function') window.toast('Teste concluido com sucesso usando ' + providerLabel(external.provider) + '.', 'success');
    }catch(error){
      setDebug('Falha no teste clinico: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Falha ao testar IA clinica: ' + error.message, 'error');
    }
  };
  window.fillAnamneseWithAI = fillAnamneseWithAI;
  window.fillEvolutionWithAI = fillEvolutionWithAI;
  window.FEMICClinicalAI = Object.assign(window.FEMICClinicalAI || {}, {
    generateDocumentDraft: generateDocumentDraft,
    generateAnamneseDraft: generateAnamneseDraft,
    providerLabel: providerLabel
  });
  window.closeClinicalAIModal = closeClinicalAIModal;
  window.clearClinicalAIPrompt = clearClinicalAIPrompt;
  window.toggleClinicalAIMicrophone = toggleClinicalAIMicrophone;
  window.submitClinicalAIModal = submitClinicalAIModal;

  function init(){
    fillConfigInputs();
    renderAssistantAiProviderBadge();
    renderAssistantBookingWorkspace();
    document.addEventListener('femic:state-updated', function(){
      renderAssistantBookingWorkspace();
    });
    setDebug('IA clinica pronta para apoiar o prontuario. Cadastros assistidos podem ser feitos na Agenda inteligente.');
    var assistantToggleBtn = el('assistantTogglePatientModeBtn');
    if(assistantToggleBtn) assistantToggleBtn.addEventListener('click', function(){
      var showingNew = !(el('assistantNewPatientFields') && el('assistantNewPatientFields').classList.contains('hidden'));
      if(!showingNew) clearAssistantNewPatientFields();
      setAssistantNewPatientMode(!showingNew);
      renderAssistantReviewDayState();
    });
    var assistantPatientSelect = el('assistantPatientSelect');
    if(assistantPatientSelect) assistantPatientSelect.addEventListener('change', function(){
      if(this.value){
        clearAssistantNewPatientFields();
        setAssistantNewPatientMode(false);
      }
    });
    var assistantStartBtn = el('assistantBookingStartBtn');
    if(assistantStartBtn) assistantStartBtn.addEventListener('click', window.startAssistantBooking);
    var assistantSavePendingBtn = el('assistantSavePendingBtn');
    if(assistantSavePendingBtn) assistantSavePendingBtn.classList.add('hidden');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
