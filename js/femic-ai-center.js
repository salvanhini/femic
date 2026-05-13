(function(){
  'use strict';

  var STORAGE_KEY = 'femic_ai_center_config_v1';
  var TASKS_STORAGE_KEY = 'femic_ai_tasks_v1';
  var state = {
    status: 'IA clinica pronta para rascunhos de anamnese e evolucao.',
    debug: 'IA clinica iniciando...'
  };

  var DEFAULT_ASSISTANT_RULES = [
    'Use sempre os dados internos do sistema como contexto de apoio quando eles estiverem disponiveis.',
    'Responda em portugues do Brasil, com objetividade, sem texto longo e sem inventar dados ausentes.',
    'Em anamnese e evolucao clinica, gere rascunhos concisos por campo e nunca salve automaticamente; o profissional deve revisar antes de salvar.',
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
    if(el('assistantAiStatusInput')) el('assistantAiStatusInput').value = 'Usado apenas para rascunhos clinicos. Pendencias operacionais nao dependem desta IA.';
  }
  function setDebug(text){
    state.debug = text;
    if(el('aiCenterDebug')) el('aiCenterDebug').textContent = text;
  }
  function readTasks(){
    try{
      var raw = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(e){
      return [];
    }
  }
  function saveTasks(list){
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }
  function makeTaskId(){
    return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }
  function cleanPhone(value){
    return String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  }
  function taskTypeLabel(type){
    return { marcacao:'Marcacao', remarcacao:'Remarcacao', cancelamento:'Cancelamento', laudo:'Laudo', retorno:'Retorno', outro:'Outro' }[type] || 'Outro';
  }
  function taskStatusLabel(status){
    return { aberta:'Aberta', em_andamento:'Em andamento', concluida:'Concluida', cancelada:'Cancelada' }[status] || 'Aberta';
  }
  function findPatientFromPayload(payload){
    var agenda = getAgendaState();
    var patients = agenda.patients || [];
    var phone = cleanPhone(payload && payload.phone);
    if(phone){
      var byPhone = patients.find(function(patient){ return cleanPhone(patient.whatsapp) === phone; });
      if(byPhone) return { patient: byPhone, ambiguous:false };
    }
    var name = String((payload && payload.patient_name) || '').trim();
    if(name){
      var normalized = norm(name);
      var exact = patients.filter(function(patient){ return norm(patient.name) === normalized; });
      if(exact.length === 1) return { patient: exact[0], ambiguous:false };
      var partial = patients.filter(function(patient){ return norm(patient.name).indexOf(normalized) !== -1 || normalized.indexOf(norm(patient.name)) !== -1; });
      if(partial.length === 1) return { patient: partial[0], ambiguous:false };
      if(partial.length > 1) return { patient: null, ambiguous:true };
    }
    return { patient:null, ambiguous:false };
  }
  function inferDatesFromPayload(payload){
    var dates = [];
    if(payload && payload.requested_date && /^\d{4}-\d{2}-\d{2}$/.test(String(payload.requested_date))){
      dates.push(String(payload.requested_date));
    }
    if(!dates.length){
      var text = norm(((payload && payload.message_text) || '') + ' ' + ((payload && payload.requested_period) || ''));
      var days = weekdayIndexFromQuery(text);
      if(days.length){
        days.forEach(function(dow){ dates.push(nextDateForWeekday(todayIso(), dow)); });
      }
    }
    if(!dates.length) dates = [addDays(todayIso(), 1), addDays(todayIso(), 2), addDays(todayIso(), 3)];
    return dates.filter(function(item, index){ return dates.indexOf(item) === index; }).slice(0, 4);
  }
  function inferDurationForPatient(patient){
    var agenda = getAgendaState();
    var appointments = (agenda.appointments || []).filter(function(item){ return String(item.patient_id) === String(patient.id); });
    var recent = appointments.slice().sort(function(a,b){
      return String(b.appointment_date || '').localeCompare(String(a.appointment_date || '')) || String(b.start_time || '').localeCompare(String(a.start_time || ''));
    })[0];
    if(recent && recent.duration_minutes) return Number(recent.duration_minutes);
    return 45;
  }
  function parsePeriods(settings){
    var raw = String((settings && settings.working_periods) || ((settings && settings.start_time) || '08:00') + '-' + ((settings && settings.end_time) || '20:00'));
    return raw.split(',').map(function(item){
      var parts = item.trim().split('-');
      return { start: (parts[0] || '').trim(), end: (parts[1] || '').trim() };
    }).filter(function(item){
      return /^\d{2}:\d{2}$/.test(item.start) && /^\d{2}:\d{2}$/.test(item.end) && timeToMin(item.end) > timeToMin(item.start);
    });
  }
  function slotsForDate(dateStr, duration){
    var agenda = getAgendaState();
    var step = Number((agenda.settings && agenda.settings.slot_interval_minutes) || 30);
    var periods = parsePeriods(agenda.settings);
    var appointments = (agenda.appointments || []).filter(function(item){
      return item.appointment_date === dateStr && item.status !== 'cancelado';
    });
    var maxPatients = Number((agenda.settings && agenda.settings.max_patients_per_slot) || 4);
    var result = [];
    periods.forEach(function(period){
      for(var minute = timeToMin(period.start); minute + duration <= timeToMin(period.end); minute += step){
        var start = minToTime(minute);
        var end = minToTime(minute + duration);
        var overlaps = appointments.filter(function(item){
          return timeToMin(normalizeTime(item.start_time)) < minute + duration && timeToMin(normalizeTime(item.end_time)) > minute;
        });
        if(overlaps.length < maxPatients){
          result.push({ date: dateStr, start: start, end: end, load: overlaps.length });
        }
      }
    });
    return result.sort(function(a,b){
      return a.load - b.load || timeToMin(a.start) - timeToMin(b.start);
    });
  }
  function shiftFilter(slot, text){
    var normalized = norm(text);
    var minute = timeToMin(slot.start);
    if(normalized.indexOf('tarde') !== -1) return minute >= 12 * 60 && minute < 18 * 60;
    if(normalized.indexOf('manha') !== -1) return minute < 12 * 60;
    if(normalized.indexOf('noite') !== -1) return minute >= 18 * 60;
    return true;
  }
  function buildSuggestedSlots(payload, patient){
    var text = ((payload && payload.message_text) || '') + ' ' + ((payload && payload.requested_period) || '');
    var duration = inferDurationForPatient(patient || {});
    return inferDatesFromPayload(payload).reduce(function(all, date){
      return all.concat(slotsForDate(date, duration).filter(function(slot){ return shiftFilter(slot, text); }));
    }, []).slice(0, 5);
  }
  function buildCancellationCandidates(patient){
    if(!patient) return [];
    var agenda = getAgendaState();
    return (agenda.appointments || []).filter(function(item){
      return String(item.patient_id) === String(patient.id) && ['agendado','confirmado'].indexOf(item.status) !== -1 && String(item.appointment_date || '') >= todayIso();
    }).sort(function(a,b){
      return String(a.appointment_date || '').localeCompare(String(b.appointment_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || ''));
    }).slice(0, 5);
  }
  function normalizeTask(task){
    var now = new Date().toISOString();
    task = task || {};
    return {
      id: String(task.id || makeTaskId()),
      title: String(task.title || 'Tarefa sem titulo').trim(),
      type: String(task.type || 'outro'),
      status: String(task.status || 'aberta'),
      priority: String(task.priority || 'normal'),
      patient_id: task.patient_id || '',
      patient_name: task.patient_name || '',
      phone: task.phone || '',
      origin: task.origin || 'manual',
      requested_action: task.requested_action || '',
      notes: task.notes || '',
      suggested_slots: Array.isArray(task.suggested_slots) ? task.suggested_slots : [],
      candidates: Array.isArray(task.candidates) ? task.candidates : [],
      needs_review: task.needs_review === true,
      created_at: task.created_at || now,
      updated_at: now,
      completed_at: task.completed_at || null
    };
  }
  function taskPatientName(task){
    if(task.patient_name) return task.patient_name;
    var agenda = getAgendaState();
    var patient = (agenda.patients || []).find(function(item){ return String(item.id) === String(task.patient_id); });
    return patient ? patient.name : '';
  }
  function getExtensionTasks(){
    return readTasks().filter(function(task){ return task.origin === 'chrome_extension'; }).sort(function(a,b){
      var statusWeight = { aberta:0, em_andamento:1, concluida:2, cancelada:3 };
      return (statusWeight[a.status] || 9) - (statusWeight[b.status] || 9) || String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });
  }
  function renderPendingNavBadge(){
    var badge = el('pendingNavBadge');
    if(!badge) return;
    var openCount = getExtensionTasks().filter(function(task){ return ['concluida','cancelada'].indexOf(task.status) === -1; }).length;
    badge.textContent = String(openCount);
    badge.classList.toggle('hidden', openCount <= 0);
  }
  function renderPendingKpis(tasks){
    var target = el('pendingKpis');
    if(!target) return;
    var counts = {
      aberta: tasks.filter(function(task){ return task.status === 'aberta'; }).length,
      em_andamento: tasks.filter(function(task){ return task.status === 'em_andamento'; }).length,
      concluida: tasks.filter(function(task){ return task.status === 'concluida'; }).length,
      cancelada: tasks.filter(function(task){ return task.status === 'cancelada'; }).length
    };
    target.innerHTML = [
      { label:'Abertas', value:counts.aberta, note:'aguardando acao' },
      { label:'Em andamento', value:counts.em_andamento, note:'com revisao em curso' },
      { label:'Concluidas', value:counts.concluida, note:'ja resolvidas' },
      { label:'Canceladas', value:counts.cancelada, note:'descartadas' }
    ].map(function(item){
      return '<div class="card kpi"><div class="eyebrow">' + esc(item.label) + '</div><strong>' + item.value + '</strong><span class="muted small">' + esc(item.note) + '</span></div>';
    }).join('');
  }
  function renderExtensionPendingTasks(){
    var target = el('pendingTaskList');
    var allTasks = getExtensionTasks();
    renderPendingNavBadge();
    renderPendingKpis(allTasks);
    if(!target) return;
    var statusFilter = el('pendingTaskStatusFilter') ? el('pendingTaskStatusFilter').value : 'open';
    var typeFilter = el('pendingTaskTypeFilter') ? el('pendingTaskTypeFilter').value : 'all';
    var list = allTasks.filter(function(task){
      if(statusFilter === 'open' && ['concluida','cancelada'].indexOf(task.status) !== -1) return false;
      if(statusFilter !== 'open' && statusFilter !== 'all' && task.status !== statusFilter) return false;
      if(typeFilter !== 'all' && task.type !== typeFilter) return false;
      return true;
    });
    target.innerHTML = list.length ? list.map(function(task){
      var tags = [];
      if(task.needs_review) tags.push('<span>revisar paciente</span>');
      if(task.phone) tags.push('<span>' + esc(task.phone) + '</span>');
      (task.suggested_slots || []).slice(0, 3).forEach(function(slot){
        tags.push('<span>' + esc(fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date) + ' · ' + slot.start) + '</span>');
      });
      (task.candidates || []).slice(0, 3).forEach(function(item){
        tags.push('<span>' + esc('Candidato: ' + fmtDate(item.appointment_date) + ' ' + normalizeTime(item.start_time)) + '</span>');
      });
      return '<article class="pending-task-item ' + esc(task.status) + '">' +
        '<div class="pending-task-top">' +
          '<div><strong>' + esc(task.title) + '</strong><div class="muted small">' + esc(taskTypeLabel(task.type)) + ' · ' + esc(taskStatusLabel(task.status)) + (taskPatientName(task) ? ' · ' + esc(taskPatientName(task)) : '') + '</div></div>' +
          '<div class="pending-task-actions"><button class="btn small" type="button" onclick="editAssistantTask(\'' + esc(task.id) + '\')">Editar</button><button class="btn small" type="button" onclick="setAssistantTaskStatus(\'' + esc(task.id) + '\',\'concluida\')">Concluir</button><button class="btn small danger" type="button" onclick="setAssistantTaskStatus(\'' + esc(task.id) + '\',\'cancelada\')">Cancelar</button></div>' +
        '</div>' +
        (task.notes ? '<div class="muted small pending-task-notes">' + esc(task.notes) + '</div>' : '') +
        (tags.length ? '<div class="pending-task-tags">' + tags.join('') + '</div>' : '') +
      '</article>';
    }).join('') : '<div class="muted small">Nenhuma pendencia da extensao neste filtro.</div>';
  }
  function upsertTask(task){
    var normalized = normalizeTask(task);
    var list = readTasks();
    var index = list.findIndex(function(item){ return item.id === normalized.id; });
    if(index === -1) list.unshift(normalized);
    else list[index] = Object.assign({}, list[index], normalized);
    saveTasks(list);
    renderExtensionPendingTasks();
    return normalized;
  }
  function createTaskFromExtension(payload){
    payload = payload || {};
    var allowed = ['marcacao','remarcacao','cancelamento'];
    var action = String(payload.action || payload.requested_action || '').trim();
    if(allowed.indexOf(action) === -1 || !String(payload.message_text || '').trim()) return null;
    var match = findPatientFromPayload(payload);
    var patient = match.patient;
    var suggestions = action === 'cancelamento' ? [] : buildSuggestedSlots(payload, patient);
    var candidates = action === 'cancelamento' ? buildCancellationCandidates(patient) : [];
    var title = taskTypeLabel(action) + (patient ? ' · ' + patient.name : (payload.patient_name ? ' · ' + payload.patient_name : ''));
    var task = upsertTask({
      title: title,
      type: action,
      status: 'aberta',
      priority: action === 'cancelamento' ? 'alta' : 'normal',
      patient_id: patient ? patient.id : '',
      patient_name: patient ? patient.name : (payload.patient_name || ''),
      phone: payload.phone || '',
      origin: 'chrome_extension',
      requested_action: action,
      notes: payload.message_text || '',
      suggested_slots: suggestions,
      candidates: candidates,
      needs_review: !patient || match.ambiguous,
      created_at: payload.created_at || new Date().toISOString()
    });
    setDebug('Extensao do WhatsApp conectada. Ultima tarefa: ' + task.title);
    if(typeof window.toast === 'function') window.toast('Pendencia recebida do WhatsApp Web.', 'success');
    return task;
  }
  function buildSystemPrompt(){
    return [
      'Voce e a IA clinica da FEMIC.',
      'Seu papel e ajudar apenas com rascunhos de anamnese e evolucao clinica.',
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
  async function fillAnamneseWithAI(){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    var notes = window.prompt('Resumo curto para anamnese: queixa, contexto e objetivo principal.');
    if(!notes) return;
    setDebug('Montando rascunho de anamnese com IA...');
    try{
      var prompt = [
        'Monte anamnese fisioterapeutica curta em JSON.',
        'Responda apenas JSON valido. Textos objetivos, sem paragrafos longos.',
        'Campos obrigatorios: chief_complaint, history, diagnosis, limitations, goals, obs.',
        'Limite por campo: ate 180 caracteres.',
        'Paciente: ' + patient.name,
        'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
        'Resumo: ' + notes
      ].join('\n');
      var external = await callExternalWithFallback(prompt, getConfig().provider);
      var draft = extractJson(external.text);
      if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyAnamneseDraft === 'function'){
        window.FEMICUnifiedRuntime.applyAnamneseDraft(draft);
      }
      setDebug('Rascunho de anamnese gerado via ' + providerLabel(external.provider) + '. Revise antes de salvar.');
      if(typeof window.toast === 'function') window.toast('Rascunho de anamnese aplicado.', 'success');
    }catch(error){
      setDebug('Falha ao preencher anamnese: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Nao consegui preencher a anamnese agora: ' + error.message, 'error');
    }
  }
  async function fillEvolutionWithAI(){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    var notes = window.prompt('Resumo curto da sessao: conduta, resposta do paciente e orientacao principal.');
    if(!notes) return;
    var unified = getUnifiedState();
    var lastEvolution = (unified.currentEvolutions || [])[0];
    setDebug('Montando rascunho de evolucao clinica com IA...');
    try{
      var prompt = [
        'Monte evolucao clinica fisioterapeutica curta em JSON.',
        'Responda apenas JSON valido. Seja direto.',
        'Campos obrigatorios: conduct, guidance.',
        'Limite: conduct ate 240 caracteres; guidance ate 180 caracteres.',
        'Paciente: ' + patient.name,
        'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
        lastEvolution ? 'Ultima evolucao: ' + (lastEvolution.conduct || '').slice(0,220) : '',
        'Sessao atual: ' + notes
      ].filter(Boolean).join('\n');
      var external = await callExternalWithFallback(prompt, getConfig().provider);
      var draft = extractJson(external.text);
      if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyEvolutionDraft === 'function'){
        window.FEMICUnifiedRuntime.applyEvolutionDraft(draft);
      }
      setDebug('Rascunho de evolucao gerado via ' + providerLabel(external.provider) + '. Revise antes de salvar.');
      if(typeof window.toast === 'function') window.toast('Rascunho de evolucao aplicado.', 'success');
    }catch(error){
      setDebug('Falha ao preencher evolucao: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Nao consegui preencher a evolucao agora: ' + error.message, 'error');
    }
  }

  window.renderAssistantAiProviderBadge = renderAssistantAiProviderBadge;
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
  window.renderExtensionPendingTasks = renderExtensionPendingTasks;
  window.setAssistantTaskStatus = function(id, status){
    var list = readTasks();
    var task = list.find(function(item){ return item.id === id; });
    if(!task) return;
    task.status = status;
    task.updated_at = new Date().toISOString();
    task.completed_at = status === 'concluida' ? new Date().toISOString() : task.completed_at;
    saveTasks(list);
    renderExtensionPendingTasks();
  };
  window.editAssistantTask = function(id){
    var list = readTasks();
    var task = list.find(function(item){ return item.id === id; });
    if(!task) return;
    var title = window.prompt('Titulo da tarefa', task.title || '');
    if(!title) return;
    var notes = window.prompt('Observacoes da tarefa', task.notes || '') || '';
    task.title = title.trim();
    task.notes = notes.trim();
    task.updated_at = new Date().toISOString();
    saveTasks(list);
    renderExtensionPendingTasks();
    if(typeof window.toast === 'function') window.toast('Pendencia atualizada.', 'success');
  };
  window.FEMICAssistantTasks = {
    list: readTasks,
    create: upsertTask,
    fromExtension: createTaskFromExtension
  };

  window.addEventListener('message', function(event){
    var data = event && event.data;
    if(!data || data.type !== 'FEMIC_EXTENSION_EVENT') return;
    createTaskFromExtension(data);
  });

  window.addEventListener('storage', function(event){
    if(event.key === TASKS_STORAGE_KEY) renderExtensionPendingTasks();
  });

  function init(){
    fillConfigInputs();
    renderAssistantAiProviderBadge();
    renderExtensionPendingTasks();
    setDebug('IA clinica ativa. A parte operacional agora fica concentrada nas pendencias do WhatsApp.');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
