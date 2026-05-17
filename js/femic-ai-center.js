(function(){
  'use strict';

  var STORAGE_KEY = 'femic_ai_center_config_v1';
  var TASKS_STORAGE_KEY = 'femic_ai_tasks_v1';
  var state = {
    status: 'IA clinica pronta para rascunhos de anamnese e evolucao.',
    debug: 'IA clinica iniciando...',
    clinicalMode: '',
    speechRecognition: null,
    speechListening: false
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
  function readTasks(){
    try{
      var raw = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(e){
      return [];
    }
  }
  function saveTasks(list){
    try{
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }catch(e){
      if(typeof window.toast === 'function') window.toast('Nao foi possivel salvar a pendencia localmente. Verifique o armazenamento do navegador.', 'error');
      throw e;
    }
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
  function normalizeExtensionPayload(payload){
    payload = payload || {};
    var allowed = ['marcacao','remarcacao','cancelamento'];
    var action = limitText(payload.action || payload.requested_action, 32);
    var message = limitText(payload.message_text, 1200);
    var period = limitText(payload.requested_period, 20).toLowerCase();
    var date = limitText(payload.requested_date, 10);
    if(payload.type !== 'FEMIC_EXTENSION_EVENT' || payload.source !== 'whatsapp_web') return null;
    if(allowed.indexOf(action) === -1 || !message) return null;
    if(date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '';
    if(period && ['manha','tarde','noite'].indexOf(period) === -1) period = '';
    return {
      type: 'FEMIC_EXTENSION_EVENT',
      source: 'whatsapp_web',
      action: action,
      requested_action: action,
      message_text: message,
      patient_name: limitText(payload.patient_name, 120),
      phone: cleanPhone(payload.phone).slice(0, 11),
      requested_date: date,
      requested_period: period,
      service_name: limitText(payload.service_name, 120),
      created_at: payload.created_at || new Date().toISOString()
    };
  }
  function extensionTaskFingerprint(payload){
    return [
      payload.action,
      norm(payload.patient_name),
      cleanPhone(payload.phone),
      payload.requested_date || '',
      payload.requested_period || '',
      norm(payload.message_text)
    ].join('|');
  }
  function findRecentExtensionDuplicate(payload){
    var fingerprint = extensionTaskFingerprint(payload);
    var now = Date.now();
    return readTasks().find(function(task){
      if(task.origin !== 'chrome_extension' || task.extension_fingerprint !== fingerprint) return false;
      var created = Date.parse(task.created_at || task.updated_at || '');
      return created && now - created < 10 * 60 * 1000;
    }) || null;
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
  function detectDateFromText(texto){
    var n = norm(texto);
    var result = [];
    var diasSemana = { domingo:0, segund:1, terc:2, quarta:3, quint:4, sext:5, sabad:6, sab:6, dom:0, seg:1, ter:2, qua:3, qui:4, sex:5 };
    for(var name in diasSemana){
      if(n.indexOf(name) !== -1){
        var dow = diasSemana[name];
        var date = nextDateForWeekday(todayIso(), dow);
        result.push({ date: date, label: name + ' (' + fmtDate(date) + ')', dow: dow });
      }
    }
    var matchDate = n.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if(matchDate){
      var day = parseInt(matchDate[1], 10), month = parseInt(matchDate[2], 10);
      var now = new Date();
      var y = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      var ds = y + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
      result.push({ date: ds, label: fmtDate(ds) });
    }
    var matchWord = n.match(/(hoje|amanha|depois\s*de\s*amanha|essa\s*semana|proxima\s*semana)/);
    if(matchWord){
      var word = matchWord[1];
      if(word === 'hoje') result.push({ date: todayIso(), label: 'Hoje' });
      else if(word === 'amanha') result.push({ date: addDays(todayIso(), 1), label: 'Amanha' });
      else if(word === 'depois de amanha') result.push({ date: addDays(todayIso(), 2), label: 'Depois de amanha' });
    }
    return result;
  }
  function detectShiftFromText(texto){
    var n = norm(texto);
    if(n.indexOf('manha') !== -1) return 'manha';
    if(n.indexOf('tarde') !== -1) return 'tarde';
    if(n.indexOf('noite') !== -1) return 'noite';
    return '';
  }
  function detectServiceFromText(texto, services){
    var n = norm(texto);
    if(!services || !services.length) return null;
    return services.find(function(s){
      if(!s.active || s.active === false) return false;
      return n.indexOf(norm(s.name)) !== -1;
    }) || null;
  }
  function findServiceFromPayload(payload, patient){
    var agenda = getAgendaState();
    var services = (agenda.services || []).filter(function(service){ return service.active !== false; });
    var text = norm([
      (payload && payload.service_name) || '',
      (payload && payload.message_text) || '',
      (payload && payload.requested_period) || ''
    ].join(' '));
    if(text){
      var exact = services.find(function(service){ return text.indexOf(norm(service.name)) !== -1; });
      if(exact) return { service: exact, inferred_from:'mensagem', needs_review:false };
    }
    if(patient && patient.id){
      var recent = (agenda.appointments || []).filter(function(item){
        return String(item.patient_id) === String(patient.id) && item.service_id;
      }).sort(function(a,b){
        return String(b.appointment_date || '').localeCompare(String(a.appointment_date || '')) || String(b.start_time || '').localeCompare(String(a.start_time || ''));
      })[0];
      if(recent){
        var byHistory = services.find(function(service){ return String(service.id) === String(recent.service_id); });
        if(byHistory) return { service: byHistory, inferred_from:'historico recente', needs_review:false };
      }
    }
    if(services.length === 1) return { service: services[0], inferred_from:'servico unico', needs_review:false };
    return { service:null, inferred_from:'', needs_review:true };
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
  function inferDurationForPatient(patient, service){
    if(service && service.duration_minutes) return Number(service.duration_minutes);
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
  function slotsForDate(dateStr, duration, patient, service){
    var agenda = getAgendaState();
    var workingDays = String((agenda.settings && agenda.settings.working_days) || '1,2,3,4,5,6').split(',');
    var date = new Date(dateStr + 'T00:00:00');
    if(!workingDays.includes(String(date.getDay()))) return [];
    var step = Number((agenda.settings && agenda.settings.slot_interval_minutes) || 30);
    var periods = parsePeriods(agenda.settings);
    var appointments = (agenda.appointments || []).filter(function(item){
      return item.appointment_date === dateStr && item.status !== 'cancelado';
    });
    var maxPatients = Number((service && service.max_patients) || (agenda.settings && agenda.settings.max_patients_per_slot) || 4);
    var result = [];
    periods.forEach(function(period){
      for(var minute = timeToMin(period.start); minute + duration <= timeToMin(period.end); minute += step){
        var start = minToTime(minute);
        var end = minToTime(minute + duration);
        var overlaps = appointments.filter(function(item){
          return timeToMin(normalizeTime(item.start_time)) < minute + duration && timeToMin(normalizeTime(item.end_time)) > minute;
        });
        var hasIndividual = overlaps.some(function(item){
          var other = (agenda.services || []).find(function(s){ return String(s.id) === String(item.service_id); }) || {};
          return (other.appointment_mode || 'grupo') === 'individual';
        });
        if((service && service.appointment_mode) === 'individual' && overlaps.length) continue;
        if(hasIndividual) continue;
        if(overlaps.length < maxPatients){
          result.push({
            patient_id: patient && patient.id || '',
            service_id: service && service.id || '',
            date: dateStr,
            appointment_date: dateStr,
            start: start,
            start_time: start,
            end: end,
            end_time: end,
            duration_minutes: duration,
            service_price_at_time: Number(service && service.price || 0),
            load: overlaps.length
          });
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
  function buildSuggestedSlots(payload, patient, service){
    var text = ((payload && payload.message_text) || '') + ' ' + ((payload && payload.requested_period) || '');
    if(!patient || !service) return [];
    var duration = inferDurationForPatient(patient || {}, service);
    return inferDatesFromPayload(payload).reduce(function(all, date){
      return all.concat(slotsForDate(date, duration, patient, service).filter(function(slot){ return shiftFilter(slot, text); }));
    }, []).slice(0, 5);
  }
  async function hydrateTaskSuggestions(taskId, payload, patient, service){
    if(!patient || !service || !window.FEMICAgendaRuntime || typeof window.FEMICAgendaRuntime.suggestAppointmentSlots !== 'function') return;
    try{
      var result = await window.FEMICAgendaRuntime.suggestAppointmentSlots({
        patient_id: patient.id,
        service_id: service.id,
        dates: inferDatesFromPayload(payload),
        requested_period: (payload && payload.requested_period) || '',
        period: (payload && payload.requested_period) || ''
      });
      var list = readTasks();
      var task = list.find(function(item){ return item.id === taskId; });
      if(!task) return;
      task.suggested_slots = result.slots || [];
      task.suggestion_reason = result.reason || '';
      task.updated_at = new Date().toISOString();
      saveTasks(list);
      renderExtensionPendingTasks();
    }catch(e){
      console.warn('Falha ao atualizar sugestões da agenda:', e);
    }
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
      service_id: task.service_id || '',
      service_name: task.service_name || '',
      suggestion_reason: task.suggestion_reason || '',
      phone: task.phone || '',
      origin: task.origin || 'manual',
      requested_action: task.requested_action || '',
      notes: task.notes || '',
      suggested_slots: Array.isArray(task.suggested_slots) ? task.suggested_slots : [],
      candidates: Array.isArray(task.candidates) ? task.candidates : [],
      parsed_shift: task.parsed_shift || '',
      parsed_dates: Array.isArray(task.parsed_dates) ? task.parsed_dates : [],
      extension_fingerprint: task.extension_fingerprint || '',
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
  function taskServiceName(task){
    if(task.service_name) return task.service_name;
    var agenda = getAgendaState();
    var service = (agenda.services || []).find(function(item){ return String(item.id) === String(task.service_id); });
    return service ? service.name : '';
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
  function renderSlotProposal(task, slot, index, maxIndex){
    var dateLabel = fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date);
    var timeLabel = slot.start + (slot.end ? '-' + slot.end : '');
    var isBest = index === 0;
    return '<div class="proposal-slot ' + (isBest ? 'proposal-best' : '') + '">' +
      (isBest ? '<span class="proposal-badge">Melhor opção</span>' : '') +
      '<strong>' + esc(dateLabel) + '</strong>' +
      '<span class="proposal-time">' + esc(timeLabel) + '</span>' +
      '<div class="proposal-actions">' +
        '<button class="btn small primary" type="button" onclick="confirmAssistantTaskSlot(\'' + esc(task.id) + '\',' + index + ')">✓ Confirmar</button>' +
        (maxIndex > 1 ? '<button class="btn small" type="button" onclick="showAssistantTaskSlots(\'' + esc(task.id) + '\')">Ver mais opções</button>' : '') +
        '<button class="btn small" type="button" onclick="openAgendaForDate(\'' + esc(slot.date) + '\')">📅 Abrir agenda</button>' +
      '</div>' +
    '</div>';
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
      if(task.needs_review) tags.push('<span class="tag-review">Revisar paciente</span>');
      if(task.phone) tags.push('<span class="tag-phone">' + esc(task.phone) + '</span>');
      if(taskServiceName(task)) tags.push('<span class="tag-service">' + esc(taskServiceName(task)) + '</span>');
      if(task.parsed_shift) tags.push('<span class="tag-shift">Turno: ' + esc(task.parsed_shift) + '</span>');
      if(task.suggestion_reason && !(task.suggested_slots || []).length) tags.push('<span class="tag-reason">' + esc(task.suggestion_reason) + '</span>');
      var slots = task.suggested_slots || [];
      var candidates = task.candidates || [];
      var maxVisible = 2;
      return '<article class="pending-task-item ' + esc(task.status) + '">' +
        '<div class="pending-task-top">' +
          '<div><strong>' + esc(task.title) + '</strong><div class="muted small">' +
            esc(taskTypeLabel(task.type)) + ' · ' + esc(taskStatusLabel(task.status)) +
            (taskPatientName(task) ? ' · ' + esc(taskPatientName(task)) : '') +
          '</div></div>' +
          '<div class="pending-task-actions">' +
            '<button class="btn small" type="button" onclick="editAssistantTask(\'' + esc(task.id) + '\')">Editar</button>' +
            '<button class="btn small" type="button" onclick="setAssistantTaskStatus(\'' + esc(task.id) + '\',\'concluida\')">Concluir</button>' +
            '<button class="btn small danger" type="button" onclick="setAssistantTaskStatus(\'' + esc(task.id) + '\',\'cancelada\')">Descartar</button>' +
          '</div>' +
        '</div>' +
        (task.notes ? '<div class="muted small pending-task-notes">📝 ' + esc(task.notes) + '</div>' : '') +
        (slots.length && ['marcacao','remarcacao'].indexOf(task.type) !== -1 ? '<div class="proposal-group">' +
          slots.slice(0, maxVisible).map(function(slot, index){ return renderSlotProposal(task, slot, index, slots.length - 1); }).join('') +
          (slots.length > maxVisible ? '<button class="btn small" type="button" onclick="showAssistantTaskSlots(\'' + esc(task.id) + '\')" style="margin-top:6px">+ Ver todos os ' + slots.length + ' horários</button>' : '') +
        '</div>' : '') +
        (candidates.length && task.type === 'cancelamento' ? '<div class="proposal-group"><div class="muted small" style="margin-bottom:6px">Agendamentos futuros deste paciente:</div>' +
          candidates.slice(0, 4).map(function(item){
            return '<div class="cancel-candidate">' +
              '<span>' + esc(fmtDate(item.appointment_date) + ' ' + normalizeTime(item.start_time)) + ' — ' + esc(serviceName(item.service_id)) + '</span>' +
              '<button class="btn small danger" type="button" onclick="confirmAssistantCancellation(\'' + esc(task.id) + '\',\'' + esc(item.id) + '\')">✕ Cancelar este</button>' +
            '</div>';
          }).join('') +
        '</div>' : '') +
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
    payload = normalizeExtensionPayload(payload);
    if(!payload) return null;
    var duplicate = findRecentExtensionDuplicate(payload);
    if(duplicate){
      if(typeof window.toast === 'function') window.toast('Pendencia repetida ignorada para evitar duplicidade.', 'warning');
      setDebug('Pendencia repetida ignorada: ' + duplicate.title);
      return duplicate;
    }
    var action = payload.action;
    var match = findPatientFromPayload(payload);
    var patient = match.patient;
    var agenda = getAgendaState();
    var serviceMatch = findServiceFromPayload(payload, patient);
    var service = serviceMatch.service;
    if(!service && agenda && agenda.services){
      service = detectServiceFromText(payload.message_text, agenda.services);
      if(service) serviceMatch = { service: service, inferred_from:'mensagem', needs_review:false };
    }
    var parsedShift = detectShiftFromText(payload.message_text);
    var parsedDates = detectDateFromText(payload.message_text);
    if(!action) action = 'marcacao';
    var suggestions = action === 'cancelamento' ? [] : buildSuggestedSlots(payload, patient, service);
    var candidates = action === 'cancelamento' ? buildCancellationCandidates(patient) : [];
    var title = taskTypeLabel(action) + (patient ? ' · ' + patient.name : (payload.patient_name ? ' · ' + payload.patient_name : ''));
    var task = upsertTask({
      title: title,
      type: action,
      status: 'aberta',
      priority: action === 'cancelamento' ? 'alta' : 'normal',
      patient_id: patient ? patient.id : '',
      patient_name: patient ? patient.name : (payload.patient_name || ''),
      service_id: service ? service.id : '',
      service_name: service ? service.name : '',
      phone: payload.phone || '',
      origin: 'chrome_extension',
      requested_action: action,
      notes: payload.message_text || '',
      suggested_slots: suggestions,
      candidates: candidates,
      parsed_shift: parsedShift,
      parsed_dates: parsedDates.map(function(d){ return d.date; }),
      extension_fingerprint: extensionTaskFingerprint(payload),
      needs_review: !patient || match.ambiguous || (action !== 'cancelamento' && serviceMatch.needs_review),
      created_at: payload.created_at || new Date().toISOString()
    });
    if(action !== 'cancelamento') hydrateTaskSuggestions(task.id, payload, patient, service);
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
    if(patient && patient.pathology) lines.push('Patologia conhecida: ' + patient.pathology);
    if(readFieldValue('anamChief')) lines.push('Queixa principal atual: ' + readFieldValue('anamChief'));
    if(readFieldValue('anamHistory')) lines.push('Historia atual registrada: ' + readFieldValue('anamHistory'));
    if(readFieldValue('anamDiagnosis')) lines.push('Diagnostico/hipotese atual: ' + readFieldValue('anamDiagnosis'));
    if(readFieldValue('anamLimitations')) lines.push('Limitacoes funcionais atuais: ' + readFieldValue('anamLimitations'));
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
  function openClinicalAIModal(mode){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    state.clinicalMode = mode;
    if(el('clinicalAiMode')) el('clinicalAiMode').value = mode;
    if(el('clinicalAiModalTitle')) el('clinicalAiModalTitle').textContent = mode === 'anamnese' ? 'Gerar rascunho de anamnese' : 'Gerar rascunho de evolucao clinica';
    if(el('clinicalAiModalHelper')) el('clinicalAiModalHelper').textContent = mode === 'anamnese'
      ? 'Descreva queixa, historia, limitacoes e objetivo. Voce pode complementar o que ja esta na ficha e usar o microfone para ditar o contexto.'
      : 'Descreva a sessao, resposta do paciente, conduta e orientacoes. Voce pode usar o microfone e complementar o que ja estiver escrito.';
    if(el('clinicalAiPrompt')) el('clinicalAiPrompt').value = mode === 'anamnese' ? buildAnamneseContext(patient) : buildEvolutionContext(patient);
    if(el('clinicalAiSubmitBtn')) el('clinicalAiSubmitBtn').disabled = false;
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
      'Monte anamnese fisioterapeutica curta em JSON.',
      'Responda apenas JSON valido, sem markdown.',
      'Campos obrigatorios: chief_complaint, history, diagnosis, limitations, goals, obs.',
      'Limite por campo: ate 220 caracteres.',
      'Preencha todos os campos mesmo que de forma concisa e segura.',
      'Paciente: ' + patient.name,
      'Patologia conhecida: ' + (patient.pathology || 'nao informada'),
      'Contexto clinico:',
      notes
    ].join('\n');
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
  async function fillAnamneseWithAI(){
    openClinicalAIModal('anamnese');
  }
  async function fillEvolutionWithAI(){
    openClinicalAIModal('evolucao');
  }
  async function submitClinicalAIModal(){
    var mode = (el('clinicalAiMode') ? el('clinicalAiMode').value : '') || state.clinicalMode;
    var patient = getSelectedPatientOrWarn();
    var notes = readFieldValue('clinicalAiPrompt');
    var submitBtn = el('clinicalAiSubmitBtn');
    if(!patient) return;
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
      }else{
        var evolutionResult = await generateEvolutionDraft(patient, notes);
        if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyEvolutionDraft === 'function'){
          window.FEMICUnifiedRuntime.applyEvolutionDraft(evolutionResult.draft);
        }
        setDebug('Rascunho de evolucao gerado via ' + providerLabel(evolutionResult.provider) + '. Revise antes de salvar.');
        setClinicalAiStatus('Rascunho de evolucao aplicado. Revise os campos antes de salvar.');
        if(typeof window.toast === 'function') window.toast('Rascunho de evolucao aplicado.', 'success');
      }
      closeClinicalAIModal();
    }catch(error){
      setDebug('Falha ao gerar rascunho clinico: ' + (error.message || 'erro desconhecido'));
      setClinicalAiStatus('Falha: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Nao consegui gerar o rascunho agora: ' + error.message, 'error');
    }finally{
      if(submitBtn) submitBtn.disabled = false;
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
  window.closeClinicalAIModal = closeClinicalAIModal;
  window.clearClinicalAIPrompt = clearClinicalAIPrompt;
  window.toggleClinicalAIMicrophone = toggleClinicalAIMicrophone;
  window.submitClinicalAIModal = submitClinicalAIModal;
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
  window.confirmAssistantTaskSlot = async function(id, index){
    var list = readTasks();
    var task = list.find(function(item){ return item.id === id; });
    if(!task) return;
    var slot = (task.suggested_slots || [])[index];
    if(!slot){
      if(typeof window.toast === 'function') window.toast('Horário sugerido não encontrado.', 'warning');
      return;
    }
    if(!window.FEMICAgendaRuntime || typeof window.FEMICAgendaRuntime.confirmAppointmentProposal !== 'function'){
      if(typeof window.toast === 'function') window.toast('Agenda ainda não expôs confirmação segura. Atualize a página.', 'warning');
      return;
    }
    var label = (taskPatientName(task) || 'Paciente') + '\n' + (taskServiceName(task) || 'Serviço') + '\n' + fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date) + ' · ' + slot.start + '-' + slot.end;
    if(!window.confirm('Confirmar este agendamento?\n\n' + label)) return;
    try{
      var result = await window.FEMICAgendaRuntime.confirmAppointmentProposal(slot);
      task.status = 'concluida';
      task.completed_at = new Date().toISOString();
      task.updated_at = task.completed_at;
      task.result_appointment_id = result && result.saved ? result.saved.id : '';
      saveTasks(list);
      renderExtensionPendingTasks();
      if(typeof window.toast === 'function') window.toast('Agendamento confirmado pela pendência do WhatsApp.', 'success');
      setDebug('Agendamento confirmado a partir da pendencia: ' + task.title);
    }catch(error){
      if(typeof window.toast === 'function') window.toast('Não consegui confirmar: ' + (error.message || error), 'error');
      setDebug('Falha ao confirmar pendencia: ' + (error.message || error));
    }
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
  window.showAssistantTaskSlots = function(id){
    var list = readTasks();
    var task = list.find(function(item){ return item.id === id; });
    if(!task || !task.suggested_slots || !task.suggested_slots.length) return;
    var slots = task.suggested_slots;
    var msg = 'HORARIOS DISPONIVEIS:\n\n';
    slots.forEach(function(slot, i){
      msg += (i+1) + '. ' + fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date) + ' · ' + slot.start + '-' + slot.end + '\n';
    });
    var choice = window.prompt(msg + '\nDigite o numero do horario desejado (ou deixe em branco para cancelar):', '');
    if(!choice) return;
    var index = parseInt(String(choice).trim(), 10) - 1;
    if(isNaN(index) || index < 0 || index >= slots.length){
      if(typeof window.toast === 'function') window.toast('Numero invalido.', 'warning');
      return;
    }
    confirmAssistantTaskSlot(id, index);
  };
  window.openAgendaForDate = function(date){
    if(typeof window.showPanel === 'function') window.showPanel('agenda');
    if(typeof window.currentDate !== 'undefined' && date){
      window.currentDate = new Date(date + 'T12:00:00');
      if(typeof window.renderAgenda === 'function') window.renderAgenda();
    }
    if(typeof window.toast === 'function') window.toast('Agenda aberta para ' + fmtDate(date), 'info');
  };
  window.confirmAssistantCancellation = async function(taskId, appointmentId){
    if(!appointmentId || !window.FEMICAgendaRuntime || typeof window.FEMICAgendaRuntime.cancelAppointment !== 'function'){
      if(typeof window.toast === 'function') window.toast('Funcao de cancelamento indisponivel.', 'warning');
      return;
    }
    if(!window.confirm('Tem certeza que deseja CANCELAR este agendamento?')) return;
    try{
      await window.FEMICAgendaRuntime.cancelAppointment(appointmentId);
      var list = readTasks();
      var task = list.find(function(item){ return item.id === taskId; });
      if(task){
        task.status = 'concluida';
        task.completed_at = new Date().toISOString();
        task.updated_at = task.completed_at;
        saveTasks(list);
        renderExtensionPendingTasks();
      }
      if(typeof window.toast === 'function') window.toast('Agendamento cancelado com sucesso.', 'success');
    }catch(error){
      if(typeof window.toast === 'function') window.toast('Erro ao cancelar: ' + (error.message || error), 'error');
    }
  };
  window.FEMICAssistantTasks = {
    list: readTasks,
    create: upsertTask,
    fromExtension: createTaskFromExtension
  };

  // Voice task creation (mobile-friendly)
  var voiceRec = null;
  var voiceListening = false;
  var voiceText = '';

  function startVoiceTask() {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      if (typeof window.toast === 'function') window.toast('Microfone não disponível neste navegador.', 'warning');
      return;
    }
    if (voiceListening) {
      stopVoiceTask();
      return;
    }
    var btn = el('voiceTaskBtn');
    voiceText = '';
    voiceRec = new Ctor();
    voiceRec.lang = 'pt-BR';
    voiceRec.interimResults = true;
    voiceRec.continuous = true;
    voiceRec.onstart = function() {
      voiceListening = true;
      if (btn) { btn.textContent = '🔴 Gravando...'; btn.classList.add('is-recording'); }
      if (typeof window.toast === 'function') window.toast('Fale seu lembrete agora.', 'info');
    };
    voiceRec.onresult = function(event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) voiceText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (btn) btn.textContent = '🔴 ' + (voiceText + interim).slice(0, 40);
    };
    voiceRec.onerror = function() {
      stopVoiceTask();
      if (typeof window.toast === 'function') window.toast('Falha no microfone.', 'error');
    };
    voiceRec.onend = function() {
      if (voiceListening) {
        voiceListening = false;
        if (voiceText.trim()) {
          createVoiceTask(voiceText.trim());
        } else {
          if (typeof window.toast === 'function') window.toast('Nada captado. Tente novamente.', 'warning');
        }
      }
      if (btn) { btn.textContent = '🎤 Nova por voz'; btn.classList.remove('is-recording'); }
    };
    voiceRec.start();
  }

  function stopVoiceTask() {
    if (voiceRec && voiceListening) {
      try { voiceRec.stop(); } catch(e) {}
    }
    voiceListening = false;
    var btn = el('voiceTaskBtn');
    if (btn) { btn.textContent = '🎤 Nova por voz'; btn.classList.remove('is-recording'); }
  }

  function createVoiceTask(text) {
    var n = norm(text);
    var action = '';
    if (/cancel|desmarc|nao vou|nao pod/.test(n)) action = 'cancelamento';
    else if (/remarc|reagen|remanej|mudar|trocar|alterar/.test(n)) action = 'remarcacao';
    else if (/marcar|agendar|queria|gostaria|preciso|pode|podia|consigo|vaga|horario/.test(n)) action = 'marcacao';
    if (!action) action = 'marcacao';
    var title = taskTypeLabel(action) + ' · Lembrete por voz';
    var task = upsertTask({
      title: title,
      type: action,
      status: 'aberta',
      priority: 'normal',
      patient_id: '',
      patient_name: '',
      service_id: '',
      service_name: '',
      phone: '',
      origin: 'voice',
      requested_action: action,
      notes: text,
      suggested_slots: [],
      candidates: [],
      parsed_shift: detectShiftFromText(text),
      parsed_dates: detectDateFromText(text).map(function(d){ return d.date; }),
      needs_review: true,
      created_at: new Date().toISOString()
    });
    if (typeof window.toast === 'function') window.toast('Lembrete por voz criado: ' + task.title, 'success');
    setDebug('Lembrete por voz: ' + task.title);
  }

  window.startVoiceTask = startVoiceTask;

  document.addEventListener('FEMIC_EXTENSION_EVENT_CHANNEL', function(event){
    var data = event && event.detail;
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
    var voiceBtn = el('voiceTaskBtn');
    if (voiceBtn) voiceBtn.addEventListener('click', startVoiceTask);
    setDebug('IA clinica pronta para apoiar o prontuario. A operacao segue concentrada em Pendencias.');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
