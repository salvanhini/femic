(function(){
  'use strict';

  var STORAGE_KEY = 'femic_ai_center_config_v1';
  var state = {
    messages: [],
    status: 'Central IA pronta. Consultas internas usam primeiro os dados do sistema.',
    debug: 'IA iniciando…',
    build: window.FEMIC_ASSISTANT_BUILD || 'ai-center-1'
  };

  var DEFAULT_ASSISTANT_RULES = [
    'Use sempre os dados internos do sistema como fonte principal para agenda, sessões, pacotes, pacientes e disponibilidade.',
    'Não use paciente selecionado em perguntas genéricas. Só use contexto do paciente quando o usuário citar o nome ou pedir explicitamente o paciente selecionado.',
    'Responda em português do Brasil, com objetividade, sem texto longo e sem inventar dados ausentes.',
    'Quando houver horários disponíveis, priorize menor ocupação, encaixe dentro do expediente, turno solicitado e conflitos atuais.',
    'Informe limitações da resposta quando faltarem dados, horários configurados, nome do paciente ou chave de API.',
    'Em anamnese e evolução clínica, gere rascunhos concisos por campo e nunca salve automaticamente; o profissional deve revisar antes de salvar.',
    'Não dê diagnóstico definitivo, prescrição médica ou promessa de resultado clínico.'
  ].join('\n');

  function el(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function norm(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
  function todayIso(){ return typeof window.todayIso === 'function' ? window.todayIso() : new Date().toISOString().slice(0,10); }
  function isoDate(date){
    if(typeof window.isoDate === 'function') return window.isoDate(date);
    var d = new Date(date);
    return d.toISOString().slice(0,10);
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
      ['terca','terça','ter'],
      ['quarta','qua'],
      ['quinta','qui'],
      ['sexta','sex'],
      ['sabado','sábado','sab']
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
      : { selectedPatientId:'', currentPatient:null, currentAnamnese:null, currentEvolutions:[] };
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
    if(el('assistantAiStatusInput')) el('assistantAiStatusInput').value = 'Consultas internas continuam funcionando mesmo sem provedor externo.';
  }
  function setStatus(text){
    state.status = text;
    if(el('assistantStatus')) el('assistantStatus').textContent = text;
    if(el('aiCenterStatus')) el('aiCenterStatus').textContent = text;
  }
  function setDebug(text){
    state.debug = text;
    if(el('assistantDebug')) el('assistantDebug').textContent = text;
    if(el('aiCenterDebug')) el('aiCenterDebug').textContent = text;
  }
  function addMessage(role, html){
    state.messages.push({ role: role, html: html });
    renderMessages();
  }
  function renderSuggestions(){
    if(el('assistantSuggestions')) el('assistantSuggestions').innerHTML = '';
    if(el('aiCenterSuggestions')) el('aiCenterSuggestions').innerHTML = '';
  }
  function renderMessages(){
    var panelHtml = state.messages.map(function(item){
      return '<div class="assistant-message ' + item.role + '">' + item.html + '</div>';
    }).join('');
    var centerHtml = state.messages.map(function(item){
      return '<div class="ai-message ' + item.role + '">' + item.html + '</div>';
    }).join('');
    if(el('assistantMessages')) el('assistantMessages').innerHTML = panelHtml;
    if(el('aiCenterMessages')) el('aiCenterMessages').innerHTML = centerHtml;
    ['assistantMessages','aiCenterMessages'].forEach(function(id){
      if(el(id)) el(id).scrollTop = el(id).scrollHeight;
    });
  }
  function getPatientMatch(question){
    var agenda = getAgendaState();
    var patients = agenda.patients || [];
    var normalizedQuestion = norm(question);
    var exact = patients.find(function(patient){
      return normalizedQuestion.indexOf(norm(patient.name)) !== -1;
    });
    if(exact) return exact;
    var scored = patients.map(function(patient){
      var tokens = norm(patient.name).split(' ').filter(Boolean);
      var score = tokens.reduce(function(total, token){
        return total + (normalizedQuestion.indexOf(token) !== -1 ? 1 : 0);
      }, 0);
      return { patient: patient, score: score };
    }).filter(function(entry){ return entry.score > 0; }).sort(function(a,b){ return b.score - a.score; });
    return scored[0] ? scored[0].patient : null;
  }
  function wantsSelectedPatientContext(question){
    var normalized = norm(question);
    return [
      'paciente selecionado',
      'este paciente',
      'esse paciente',
      'deste paciente',
      'desse paciente',
      'paciente atual'
    ].some(function(item){ return normalized.indexOf(item) !== -1; });
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
    if(normalized.indexOf('manha') !== -1 || normalized.indexOf('manhã') !== -1) return minute < 12 * 60;
    if(normalized.indexOf('noite') !== -1) return minute >= 18 * 60;
    return true;
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
  function summarizeSlots(slots, limit){
    return slots.slice(0, limit || 5).map(function(slot){
      return fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date) + ' · ' + slot.start;
    });
  }
  function answerFreeTomorrow(){
    var tomorrow = addDays(todayIso(), 1);
    var slots = slotsForDate(tomorrow, 45);
    if(!slots.length){
      return { handled:true, html:'<strong>Não encontrei horário livre amanhã.</strong><div class="muted small">A busca considerou os períodos configurados no expediente e os conflitos atuais da agenda para ' + esc(fmtDate(tomorrow)) + '.</div>' };
    }
    var items = summarizeSlots(slots, 6).map(function(line){ return '<li>' + esc(line) + '</li>'; }).join('');
    return { handled:true, html:'<strong>Encontrei estes horários livres amanhã:</strong><ul>' + items + '</ul>' };
  }
  function answerSessionCount(question){
    var patient = getPatientMatch(question);
    if(!patient) return { handled:false };
    var agenda = getAgendaState();
    var count = (agenda.appointments || []).filter(function(item){
      return String(item.patient_id) === String(patient.id) && item.status === 'concluido';
    }).length;
    return { handled:true, html:'<strong>' + esc(patient.name) + '</strong> tem <strong>' + count + '</strong> sessão(ões) realizada(s) com base nos atendimentos concluídos da agenda.' };
  }
  function answerPackageBalance(question){
    var patient = getPatientMatch(question);
    if(!patient) return { handled:false };
    var agenda = getAgendaState();
    var packages = (agenda.packages || []).filter(function(item){ return String(item.patient_id) === String(patient.id); });
    if(!packages.length){
      return { handled:true, html:'<strong>' + esc(patient.name) + '</strong> não tem pacote ativo cadastrado no sistema.' };
    }
    var lines = packages.map(function(item){
      var total = Number(item.total_sessions || 0);
      var remaining = Number(item.remaining_sessions || 0);
      var service = typeof window.serviceName === 'function' ? window.serviceName(item.service_id) : 'Serviço';
      return '<li>' + esc(service) + ': ' + Math.max(0, total - remaining) + '/' + total + ' usadas · saldo ' + remaining + '</li>';
    }).join('');
    return { handled:true, html:'<strong>Saldo de pacote de ' + esc(patient.name) + ':</strong><ul>' + lines + '</ul>' };
  }
  function answerUpcomingAppointments(question){
    var patient = getPatientMatch(question);
    if(!patient) return { handled:false };
    var agenda = getAgendaState();
    var upcoming = (agenda.appointments || []).filter(function(item){
      return String(item.patient_id) === String(patient.id) && ['agendado','confirmado'].indexOf(item.status) !== -1;
    }).sort(function(a,b){
      return String(a.appointment_date || '').localeCompare(String(b.appointment_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || ''));
    }).slice(0,5);
    if(!upcoming.length){
      return { handled:true, html:'<strong>' + esc(patient.name) + '</strong> não tem atendimentos futuros no momento.' };
    }
    var lines = upcoming.map(function(item){
      var service = typeof window.serviceName === 'function' ? window.serviceName(item.service_id) : 'Serviço';
      return '<li>' + esc(fmtWeekday(item.appointment_date) + ' · ' + fmtDate(item.appointment_date) + ' · ' + normalizeTime(item.start_time) + ' · ' + service) + '</li>';
    }).join('');
    return { handled:true, html:'<strong>Próximos atendimentos de ' + esc(patient.name) + ':</strong><ul>' + lines + '</ul>' };
  }
  function answerBestSlots(question){
    var patient = getPatientMatch(question) || (wantsSelectedPatientContext(question) ? getUnifiedState().currentPatient : null);
    var days = weekdayIndexFromQuery(norm(question));
    var base = todayIso();
    var duration = inferDurationForPatient(patient || {});
    var dates = [];
    if(norm(question).indexOf('amanha') !== -1) dates = [addDays(base,1)];
    if(norm(question).indexOf('hoje') !== -1) dates = [base];
    if(days.length){
      days.forEach(function(dow){
        for(var i=0;i<4;i++){
          dates.push(nextDateForWeekday(addDays(base, i * 7), dow));
        }
      });
    }
    dates = dates.filter(function(item, idx){ return dates.indexOf(item) === idx; });
    if(!dates.length) dates = [addDays(base,1), addDays(base,2), addDays(base,3)];
    var slots = dates.reduce(function(all, date){
      return all.concat(slotsForDate(date, duration).filter(function(slot){ return shiftFilter(slot, question); }));
    }, []);
    slots.sort(function(a,b){
      return a.load - b.load || String(a.date).localeCompare(String(b.date)) || timeToMin(a.start) - timeToMin(b.start);
    });
    if(!slots.length){
      return { handled:true, html:'<strong>Não encontrei horários livres no recorte pedido.</strong><div class="muted small">Tente ampliar os dias ou remover a restrição de turno.</div>' };
    }
    var intro = patient ? 'Melhores opções para <strong>' + esc(patient.name) + '</strong>' : 'Melhores horários encontrados';
    var lines = summarizeSlots(slots, 5).map(function(line){ return '<li>' + esc(line) + '</li>'; }).join('');
    return { handled:true, html:'<strong>' + intro + ':</strong><ul>' + lines + '</ul><div class="muted small">Critérios usados: expediente configurado, conflitos atuais e menor ocupação por faixa.</div>' };
  }
  function answerAgendaLoad(question){
    var agenda = getAgendaState();
    var targetDate = norm(question).indexOf('amanha') !== -1 ? addDays(todayIso(), 1) : todayIso();
    var list = (agenda.appointments || []).filter(function(item){ return item.appointment_date === targetDate; });
    var counts = {
      agendado: list.filter(function(item){ return item.status === 'agendado'; }).length,
      confirmado: list.filter(function(item){ return item.status === 'confirmado'; }).length,
      concluido: list.filter(function(item){ return item.status === 'concluido'; }).length,
      cancelado: list.filter(function(item){ return item.status === 'cancelado'; }).length
    };
    return { handled:true, html:'<strong>Carga operacional de ' + esc(fmtDate(targetDate)) + ':</strong><ul><li>Agendados: ' + counts.agendado + '</li><li>Confirmados: ' + counts.confirmado + '</li><li>Concluídos: ' + counts.concluido + '</li><li>Cancelados: ' + counts.cancelado + '</li></ul>' };
  }
  function resolveInternalQuestion(question){
    var normalized = norm(question);
    if(!normalized) return { handled:true, html:'<strong>Escreva a pergunta que você quer fazer.</strong>' };
    if(normalized.indexOf('livre') !== -1 && normalized.indexOf('amanha') !== -1) return answerFreeTomorrow();
    if(normalized.indexOf('sess') !== -1 && (normalized.indexOf('quant') !== -1 || getPatientMatch(question))) return answerSessionCount(question);
    if(normalized.indexOf('saldo') !== -1 || normalized.indexOf('pacote') !== -1) return answerPackageBalance(question);
    if(normalized.indexOf('proxim') !== -1 && normalized.indexOf('atendimento') !== -1) return answerUpcomingAppointments(question);
    if(normalized.indexOf('melhor horario') !== -1 || normalized.indexOf('melhor horário') !== -1 || normalized.indexOf('marcar') !== -1 || normalized.indexOf('encaix') !== -1 || normalized.indexOf('tarde') !== -1 || normalized.indexOf('manha') !== -1 || normalized.indexOf('manhã') !== -1) return answerBestSlots(question);
    if(normalized.indexOf('ocupacao') !== -1 || normalized.indexOf('ocupação') !== -1) return answerAgendaLoad(question);
    return { handled:false };
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
    return (((data || {}).choices || [])[0] || {}).message && ((((data || {}).choices || [])[0].message || {}).content) || '';
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
    return (((data || {}).choices || [])[0] || {}).message && ((((data || {}).choices || [])[0].message || {}).content) || '';
  }
  async function callExternalWithFallback(prompt, preferred){
    var config = getConfig();
    var order = providerOrder(preferred);
    var lastError = null;
    for(var i=0;i<order.length;i++){
      var provider = order[i];
      if(!providerHasKey(config, provider)) continue;
      try{
        setDebug('Consultando ' + providerLabel(provider) + '…');
        var text = provider === 'gemini'
          ? await callGemini(config, prompt)
          : provider === 'groq'
            ? await callGroq(config, prompt)
            : await callDeepSeek(config, prompt);
        return { ok:true, provider: provider, text: text };
      }catch(error){
        lastError = error;
        var next = order.slice(i + 1).find(function(candidate){ return providerHasKey(config, candidate); });
        if(next && window.confirm(providerLabel(provider) + ' falhou: ' + error.message + '. Deseja tentar com ' + providerLabel(next) + '?')){
          continue;
        }
        throw error;
      }
    }
    if(lastError) throw lastError;
    throw new Error('Nenhuma API externa está configurada no momento.');
  }
  function buildSystemPrompt(){
    return [
      'Você é a Central IA da FEMIC, integrada a agenda, pacientes, pacotes, anamnese e evolução clínica.',
      getConfig().rules || DEFAULT_ASSISTANT_RULES
    ].join('\n');
  }
  function buildExternalPrompt(prompt){
    return buildSystemPrompt() + '\n\nSolicitação:\n' + prompt;
  }
  function buildGeneralPrompt(question){
    var agenda = getAgendaState();
    var unified = getUnifiedState();
    var patient = unified.currentPatient;
    return [
      'Você é a Central IA da FEMIC.',
      'Dados internos resumidos:',
      '- pacientes ativos: ' + ((agenda.patients || []).filter(function(item){ return item.archived !== true; }).length),
      '- agendamentos totais: ' + ((agenda.appointments || []).length),
      '- paciente selecionado: ' + (patient ? patient.name : 'nenhum'),
      patient ? '- patologia do paciente selecionado: ' + (patient.pathology || 'não informada') : '',
      'Pergunta do usuário: ' + question
    ].filter(Boolean).join('\n');
  }
  function extractJson(text){
    var raw = String(text || '').trim();
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if(start === -1 || end === -1 || end <= start) throw new Error('A resposta não veio em JSON válido.');
    return JSON.parse(raw.slice(start, end + 1));
  }
  async function submitQuestion(question){
    var value = String(question || '').trim();
    if(!value) return;
    if(el('assistantInput')) el('assistantInput').value = '';
    if(el('aiCenterInput')) el('aiCenterInput').value = '';
    addMessage('user', '<p>' + esc(value) + '</p>');
    setStatus('Processando pergunta…');
    try{
      var internal = resolveInternalQuestion(value);
      if(internal.handled){
        addMessage('assistant', '<div>' + internal.html + '</div>');
        setStatus('Resposta entregue com base nos dados internos do sistema.');
        setDebug('Consulta operacional resolvida sem API externa.');
        return;
      }
      var external = await callExternalWithFallback(buildGeneralPrompt(value), getConfig().provider);
      addMessage('assistant', '<div><strong>Resposta da IA externa (' + esc(providerLabel(external.provider)) + '):</strong><div class="assistant-rich-text">' + esc(external.text).replace(/\n/g, '<br>') + '</div></div>');
      setStatus('Resposta entregue com apoio do provedor ' + providerLabel(external.provider) + '.');
      setDebug('Fallback externo ativo via ' + providerLabel(external.provider) + '.');
    }catch(error){
      addMessage('assistant', '<div><strong>Não consegui concluir essa consulta agora.</strong><div class="muted small">' + esc(error.message || 'Falha desconhecida') + '</div></div>');
      setStatus('Falha na consulta. Você pode ajustar a pergunta ou revisar as chaves das APIs.');
      setDebug('Erro: ' + (error.message || 'falha desconhecida'));
    }
  }
  function getSelectedPatientOrWarn(){
    var unified = getUnifiedState();
    if(unified.currentPatient) return unified.currentPatient;
    window.alert('Selecione um paciente no prontuário antes de usar a IA clínica.');
    return null;
  }
  async function fillAnamneseWithAI(){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    var notes = window.prompt('Resumo curto para anamnese: queixa, contexto e objetivo principal.');
    if(!notes) return;
    setStatus('Montando rascunho de anamnese com IA…');
    try{
      var prompt = [
        'Monte anamnese fisioterapêutica curta em JSON.',
        'Responda apenas JSON válido. Textos objetivos, sem parágrafos longos.',
        'Campos obrigatórios: chief_complaint, history, diagnosis, limitations, goals, obs.',
        'Limite por campo: até 180 caracteres.',
        'Paciente: ' + patient.name,
        'Patologia conhecida: ' + (patient.pathology || 'não informada'),
        'Resumo: ' + notes
      ].join('\n');
      var external = await callExternalWithFallback(prompt, getConfig().provider);
      var draft = extractJson(external.text);
      if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyAnamneseDraft === 'function'){
        window.FEMICUnifiedRuntime.applyAnamneseDraft(draft);
      }
      addMessage('assistant', '<div><strong>Rascunho de anamnese aplicado.</strong><div class="muted small">Revise os campos antes de salvar.</div></div>');
      setStatus('Rascunho de anamnese preenchido com apoio do ' + providerLabel(external.provider) + '.');
      setDebug('Anamnese estruturada via ' + providerLabel(external.provider) + '.');
    }catch(error){
      addMessage('assistant', '<div><strong>Não consegui preencher a anamnese agora.</strong><div class="muted small">' + esc(error.message || 'Falha desconhecida') + '</div></div>');
      setStatus('Falha ao preencher anamnese com IA.');
      setDebug('Erro na anamnese: ' + (error.message || 'falha desconhecida'));
    }
  }
  async function fillEvolutionWithAI(){
    var patient = getSelectedPatientOrWarn();
    if(!patient) return;
    var notes = window.prompt('Resumo curto da sessão: conduta, resposta do paciente e orientação principal.');
    if(!notes) return;
    var unified = getUnifiedState();
    var lastEvolution = (unified.currentEvolutions || [])[0];
    setStatus('Montando rascunho de evolução clínica com IA…');
    try{
      var prompt = [
        'Monte evolução clínica fisioterapêutica curta em JSON.',
        'Responda apenas JSON válido. Seja direto.',
        'Campos obrigatórios: conduct, guidance.',
        'Limite: conduct até 240 caracteres; guidance até 180 caracteres.',
        'Paciente: ' + patient.name,
        'Patologia conhecida: ' + (patient.pathology || 'não informada'),
        lastEvolution ? 'Última evolução: ' + (lastEvolution.conduct || '').slice(0,220) : '',
        'Sessão atual: ' + notes
      ].filter(Boolean).join('\n');
      var external = await callExternalWithFallback(prompt, getConfig().provider);
      var draft = extractJson(external.text);
      if(window.FEMICUnifiedRuntime && typeof window.FEMICUnifiedRuntime.applyEvolutionDraft === 'function'){
        window.FEMICUnifiedRuntime.applyEvolutionDraft(draft);
      }
      addMessage('assistant', '<div><strong>Rascunho de evolução clínica aplicado.</strong><div class="muted small">Revise os campos antes de salvar.</div></div>');
      setStatus('Rascunho de evolução preenchido com apoio do ' + providerLabel(external.provider) + '.');
      setDebug('Evolução estruturada via ' + providerLabel(external.provider) + '.');
    }catch(error){
      addMessage('assistant', '<div><strong>Não consegui preencher a evolução clínica agora.</strong><div class="muted small">' + esc(error.message || 'Falha desconhecida') + '</div></div>');
      setStatus('Falha ao preencher evolução clínica com IA.');
      setDebug('Erro na evolução: ' + (error.message || 'falha desconhecida'));
    }
  }
  function toggleAssistantPanel(force){
    var panel = el('assistantPanel');
    if(!panel) return;
    var willOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    panel.classList.toggle('is-open', willOpen);
    if(willOpen && el('assistantInput')){
      setTimeout(function(){
        if(el('assistantInput')) el('assistantInput').focus();
      }, 50);
    }
  }
  function openAIFromFab(){
    toggleAssistantPanel(true);
  }
  function wireForms(){
    var fab = el('assistantFab');
    if(fab && !fab.dataset.aiFabBound){
      fab.dataset.aiFabBound = 'true';
      fab.addEventListener('click', function(event){
        event.preventDefault();
        toggleAssistantPanel();
      });
    }
    var panelForm = el('assistantPanelForm');
    if(panelForm){
      panelForm.addEventListener('submit', function(event){
        event.preventDefault();
        submitQuestion(el('assistantInput') ? el('assistantInput').value : '');
      });
    }
    if(el('aiCenterForm')){
      el('aiCenterForm').addEventListener('submit', function(event){
        event.preventDefault();
        submitQuestion(el('aiCenterInput') ? el('aiCenterInput').value : '');
      });
    }
    ['assistantInput','aiCenterInput'].forEach(function(id){
      if(!el(id)) return;
      el(id).addEventListener('keydown', function(event){
        if(event.key === 'Enter' && !event.shiftKey){
          event.preventDefault();
          submitQuestion(event.target.value);
        }
      });
    });
  }
  function initGreeting(){
    if(state.messages.length) return;
    addMessage('assistant', '<div><strong>Central IA pronta.</strong><div class="muted small">Você pode perguntar sobre horários livres, melhores encaixes, sessões realizadas, pacotes, ocupação da agenda e usar apoio clínico para anamnese e evolução.</div></div>');
  }

  window.renderAssistantAiProviderBadge = renderAssistantAiProviderBadge;
  window.saveAssistantAiConfig = function(){
    var config = readConfigFromInputs();
    saveConfigToStorage(config);
    renderAssistantAiProviderBadge();
    setStatus('Configuração de IA salva. Consultas internas continuam independentes das APIs.');
    setDebug('Configuração salva com provedor principal ' + providerLabel(config.provider) + '.');
    if(typeof window.toast === 'function') window.toast('Configuração da IA salva.', 'success');
  };
  window.saveAssistantAiRules = function(){
    saveConfigToStorage({ rules: el('assistantAiRules') ? el('assistantAiRules').value.trim() || DEFAULT_ASSISTANT_RULES : DEFAULT_ASSISTANT_RULES });
    setStatus('Regras da IA salvas.');
    setDebug('Regras comportamentais atualizadas para respostas externas e rascunhos clínicos.');
    if(typeof window.toast === 'function') window.toast('Regras da IA salvas.', 'success');
  };
  window.resetAssistantAiRules = function(){
    if(el('assistantAiRules')) el('assistantAiRules').value = DEFAULT_ASSISTANT_RULES;
    saveConfigToStorage({ rules: DEFAULT_ASSISTANT_RULES });
    setStatus('Regras padrão da IA restauradas.');
    setDebug('A IA voltou ao comportamento padrão FEMIC.');
    if(typeof window.toast === 'function') window.toast('Regras padrão restauradas.', 'success');
  };
  window.testAssistantAiConfig = async function(){
    var config = readConfigFromInputs();
    saveConfigToStorage(config);
    renderAssistantAiProviderBadge();
    var order = providerOrder(config.provider).filter(function(provider){ return providerHasKey(config, provider); });
    if(!order.length){
      if(typeof window.toast === 'function') window.toast('Nenhuma chave de API foi configurada. As consultas internas continuam ativas.', 'warning');
      return;
    }
    setStatus('Testando configuração externa…');
    try{
      var external = await callExternalWithFallback('Responda apenas: ok FEMIC', config.provider);
      setStatus('Teste concluído com sucesso usando ' + providerLabel(external.provider) + '.');
      setDebug('Teste externo concluído com sucesso.');
      if(typeof window.toast === 'function') window.toast('Teste concluído com sucesso usando ' + providerLabel(external.provider) + '.', 'success');
    }catch(error){
      setStatus('Falha ao testar a configuração externa.');
      setDebug('Falha no teste: ' + (error.message || 'erro desconhecido'));
      if(typeof window.toast === 'function') window.toast('Falha ao testar IA externa: ' + error.message, 'error');
    }
  };
  window.toggleAssistantPanel = toggleAssistantPanel;
  window.openAIFromFab = openAIFromFab;
  window.fillAnamneseWithAI = fillAnamneseWithAI;
  window.fillEvolutionWithAI = fillEvolutionWithAI;

  function init(){
    fillConfigInputs();
    renderAssistantAiProviderBadge();
    if(el('assistantBuildLabel')) el('assistantBuildLabel').textContent = 'build ' + state.build;
    renderSuggestions();
    wireForms();
    initGreeting();
    setStatus(state.status);
    setDebug('Central IA ativa. Modo híbrido: dados internos primeiro, provedores externos por demanda.');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
