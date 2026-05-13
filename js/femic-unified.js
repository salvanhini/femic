(function(){
  'use strict';

  var STORAGE = {
    sessions: 'femic_sessions',
    anamneses: 'femic_anamneses',
    evolutions: 'femic_clinical_evolutions',
    documents: 'femic_documents',
    guias: 'femic_guias',
    generatedDocs: 'femic_generated_documents_local',
    documentSettings: 'femic_document_settings_unified'
  };

  var DOC_PRESETS = {
    attendance: [
      { id:'attendance_simple', label:'Comparecimento simples', title:'ATESTADO DE COMPARECIMENTO', body:function(ctx){ return 'Declaro, para os devidos fins, que ' + ctx.name + ' compareceu a atendimento fisioterapêutico na FEMIC em ' + ctx.dateBr + '.'; } },
      { id:'attendance_session', label:'Comparecimento com sessão realizada', title:'ATESTADO DE COMPARECIMENTO', body:function(ctx){ return 'Declaro, para os devidos fins, que ' + ctx.name + ' compareceu à FEMIC em ' + ctx.dateBr + ' para atendimento fisioterapêutico relacionado ao quadro de ' + ctx.pathology + '.'; } }
    ],
    declaration: [
      { id:'decl_followup', label:'Acompanhamento em curso', title:'DECLARAÇÃO DE ATENDIMENTO', body:function(ctx){ return 'Declaro, para os devidos fins, que ' + ctx.name + ' encontra-se em acompanhamento fisioterapêutico na FEMIC' + (ctx.period ? ' ' + ctx.period : '') + '.'; } },
      { id:'decl_presence', label:'Presença na data', title:'DECLARAÇÃO DE ATENDIMENTO', body:function(ctx){ return 'Declaro que ' + ctx.name + ' esteve nesta clínica em ' + ctx.dateBr + ' para atendimento fisioterapêutico relacionado ao quadro de ' + ctx.pathology + '.'; } }
    ],
    exam: [
      { id:'exam_xray', label:'Pedido de raio-X', title:'PEDIDO DE EXAME', body:function(ctx){ return 'Solicito exame de raio-X para melhor avaliação do quadro clínico de ' + ctx.name + '.\n\nHipótese clínica: ' + ctx.pathology + '.\n\nJustificativa: ' + ctx.reason + '.'; } },
      { id:'exam_mri', label:'Pedido de ressonância', title:'PEDIDO DE EXAME', body:function(ctx){ return 'Solicito ressonância magnética para investigação complementar do quadro de ' + ctx.name + '.\n\nHipótese clínica: ' + ctx.pathology + '.\n\nJustificativa: ' + ctx.reason + '.'; } }
    ],
    report: [
      { id:'report_simple', label:'Laudo simples', title:'LAUDO SIMPLES', body:function(ctx){ return 'Paciente: ' + ctx.name + '.\n\nQuadro principal: ' + ctx.pathology + '.\n\nQueixa principal: ' + ctx.chief + '.\n\nHistória atual: ' + ctx.history + '.\n\nDiagnóstico / hipótese: ' + ctx.diagnosis + '.\n\nLimitações funcionais: ' + ctx.limitations + '.'; } },
      { id:'report_progress', label:'Laudo com evolução', title:'LAUDO SIMPLES', body:function(ctx){ return 'Paciente ' + ctx.name + ', em acompanhamento fisioterapêutico por ' + ctx.pathology + '.\n\nForam registradas ' + ctx.sessionCount + ' sessões até o momento.\n\nÚltima conduta registrada: ' + ctx.lastConduct + '.\n\nÚltima orientação registrada: ' + ctx.lastGuidance + '.'; } }
    ],
    summary: [
      { id:'summary_basic', label:'Resumo evolutivo', title:'RESUMO EVOLUTIVO', body:function(ctx){ return 'Resumo evolutivo de ' + ctx.name + '.\n\nPatologia / quadro principal: ' + ctx.pathology + '.\n\nTotal de sessões registradas: ' + ctx.sessionCount + '.\n\nÚltima evolução clínica: ' + ctx.lastConduct + '.\n\nOrientação mais recente: ' + ctx.lastGuidance + '.'; } },
      { id:'summary_short', label:'Resumo curto', title:'RESUMO EVOLUTIVO', body:function(ctx){ return ctx.name + ' encontra-se em acompanhamento por ' + ctx.pathology + ', com ' + ctx.sessionCount + ' sessões registradas.'; } }
    ]
  };

  var runtime = {
    currentPatientId: '',
    historyDataset: { source:'empty', patients:[], sessions:[] },
    historyYearsChart: null,
    historyPathologiesChart: null
  };

  function el(id){ return document.getElementById(id); }
  function escHtml(v){ return typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function safeArrayParse(key){
    try{
      var raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(e){
      return [];
    }
  }
  function saveArray(key, list){
    localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
    dispatchUnifiedState();
  }
  function getAgendaState(){
    return window.FEMICAgendaRuntime && typeof window.FEMICAgendaRuntime.getState === 'function'
      ? window.FEMICAgendaRuntime.getState()
      : { patients:[], payers:[], services:[], packages:[], appointments:[], movements:[], clinicRules:[], settings:{} };
  }
  function getPatients(){ return getAgendaState().patients || []; }
  function getPatientById(pid){ return getPatients().find(function(p){ return String(p.id) === String(pid); }) || null; }
  function getActivePatients(){ return getPatients().filter(function(p){ return p.archived !== true; }).sort(function(a,b){ return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'); }); }
  function generateId(prefix){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + window.crypto.randomUUID();
    return prefix + Date.now() + Math.random().toString(36).slice(2, 10);
  }
  function normalizeSessionRecord(raw){
    raw = raw || {};
    return {
      id: String(raw.id || generateId('s')),
      patient_id: String(raw.patient_id || raw.linked_patient_id || ''),
      date: String(raw.date || raw.response_date || '').slice(0,10),
      obs: String(raw.obs || ''),
      source: String(raw.source || 'manual'),
      created_at: raw.created_at || new Date().toISOString()
    };
  }
  function normalizePatientRecord(raw){
    raw = raw || {};
    return {
      id: String(raw.id || generateId('p')),
      name: String(raw.name || raw.patient_name || '').trim(),
      pathology: String(raw.pathology || raw.patient_pathology || '').trim(),
      whatsapp: String(raw.whatsapp || raw.patient_whatsapp || '').trim(),
      archived: raw.archived === true || raw.status === 'inativo' || raw.status === 'arquivado',
      archived_at: raw.archived_at || null,
      created_at: raw.created_at || new Date().toISOString()
    };
  }
  function getSessions(){ return safeArrayParse(STORAGE.sessions).map(normalizeSessionRecord).filter(function(s){ return s.id && s.patient_id && s.date; }); }
  function saveSessions(list){ saveArray(STORAGE.sessions, (list || []).map(normalizeSessionRecord)); }
  function getAnamneses(){ return safeArrayParse(STORAGE.anamneses).filter(function(x){ return x && x.patient_id; }); }
  function saveAnamneses(list){ saveArray(STORAGE.anamneses, list || []); }
  function getEvolutions(){ return safeArrayParse(STORAGE.evolutions).filter(function(x){ return x && x.patient_id; }); }
  function saveEvolutions(list){ saveArray(STORAGE.evolutions, list || []); }
  function getPatientDocuments(){ return safeArrayParse(STORAGE.documents).filter(function(x){ return x && x.patient_id; }); }
  function savePatientDocuments(list){ saveArray(STORAGE.documents, list || []); }
  function getGuias(){ return safeArrayParse(STORAGE.guias).filter(function(x){ return x && x.patient_id; }); }
  function saveGuias(list){ saveArray(STORAGE.guias, list || []); }
  function getGeneratedDocuments(){ return safeArrayParse(STORAGE.generatedDocs).filter(function(x){ return x && x.patient_id; }); }
  function saveGeneratedDocuments(list){ saveArray(STORAGE.generatedDocs, list || []); }
  function getDocumentSettings(){
    try{
      return Object.assign({ professionalName:'FEMIC Fisioterapia', professionalNote:'', showStamp:'yes' }, JSON.parse(localStorage.getItem(STORAGE.documentSettings) || '{}'));
    }catch(e){
      return { professionalName:'FEMIC Fisioterapia', professionalNote:'', showStamp:'yes' };
    }
  }
  function saveDocumentSettings(obj){
    localStorage.setItem(STORAGE.documentSettings, JSON.stringify(obj || {}));
  }
  function normName(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function normPhone(value){
    return String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  }
  function formatWhatsapp(value){
    var digits = normPhone(value);
    if(digits.length === 11) return '(' + digits.slice(0,2) + ') ' + digits.slice(2,7) + '-' + digits.slice(7);
    if(digits.length === 10) return '(' + digits.slice(0,2) + ') ' + digits.slice(2,6) + '-' + digits.slice(6);
    return digits;
  }
  function todayIsoSafe(){ return typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10); }
  function fmtDateSafe(value){ return typeof fmtDate === 'function' ? fmtDate(value) : String(value || ''); }
  function fmtWeekdaySafe(value){ return typeof fmtWeekday === 'function' ? fmtWeekday(value) : fmtDateSafe(value); }
  function clampInt(v, min, max){
    if(v == null || v === '') return null;
    var n = Math.round(parseFloat(String(v).replace(',', '.')));
    if(isNaN(n)) return null;
    return Math.max(min, Math.min(max, n));
  }
  function sessionKey(patientId, date, obs){
    return [String(patientId || ''), String(date || '').slice(0,10), String(obs || '').trim()].join('|');
  }
  function getSelectedPatientId(){
    return runtime.currentPatientId || (el('prontuarioPatientSelect') && el('prontuarioPatientSelect').value) || (el('docsPatientSelect') && el('docsPatientSelect').value) || '';
  }
  function setCurrentPatient(pid){
    runtime.currentPatientId = pid || '';
    ['prontuarioPatientSelect','docsPatientSelect'].forEach(function(id){
      if(el(id)) el(id).value = runtime.currentPatientId;
    });
  }
  function getAnamneseByPatient(pid){
    return getAnamneses().find(function(item){ return String(item.patient_id) === String(pid); }) || null;
  }
  function getPatientSessions(pid){
    return getSessions().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  }
  function getPatientEvolutions(pid){
    return getEvolutions().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });
  }
  function getDocumentsByPatient(pid){
    return getPatientDocuments().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
  }
  function getGuiasByPatient(pid){
    return getGuias().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
  }
  function getGeneratedDocumentsByPatient(pid){
    return getGeneratedDocuments().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
  }
  function getAgendaAppointmentsByPatient(pid){
    return (getAgendaState().appointments || []).filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(a.appointment_date || '') + String(a.start_time || '') > String(b.appointment_date || '') + String(b.start_time || '') ? 1 : -1; });
  }
  function getAgendaPackagesByPatient(pid){
    return (getAgendaState().packages || []).filter(function(item){ return String(item.patient_id) === String(pid); });
  }
  function dispatchUnifiedState(){
    document.dispatchEvent(new CustomEvent('femic:unified-state-updated'));
    renderUnifiedAll();
  }

  function populateUnifiedPatientSelects(){
    var patients = getActivePatients();
    var options = ['<option value="">Selecione o paciente</option>'].concat(patients.map(function(p){
      return '<option value="' + escHtml(p.id) + '">' + escHtml(p.name) + (p.whatsapp ? ' · ' + escHtml(formatWhatsapp(p.whatsapp)) : '') + '</option>';
    })).join('');
    ['prontuarioPatientSelect','docsPatientSelect'].forEach(function(id){
      if(el(id)) el(id).innerHTML = options;
    });
    if(runtime.currentPatientId){
      setCurrentPatient(runtime.currentPatientId);
    }
  }

  function renderPatientHub(){
    var target = el('patientHubContent');
    var status = el('patientHubStatus');
    if(!target || !status) return;
    var pid = getSelectedPatientId();
    var patient = getPatientById(pid);
    if(!patient){
      status.textContent = 'Selecione um paciente para consolidar o contexto.';
      target.className = 'unified-empty-state';
      target.innerHTML = 'Abra a ficha de um paciente ou selecione-o no prontuário para ver agenda, pacote, evolução, documentos e atalhos em um único lugar.';
      return;
    }
    var sessions = getPatientSessions(pid);
    var evolutions = getPatientEvolutions(pid);
    var docs = getDocumentsByPatient(pid);
    var guias = getGuiasByPatient(pid);
    var appointments = getAgendaAppointmentsByPatient(pid);
    var packages = getAgendaPackagesByPatient(pid);
    status.textContent = 'Paciente ativo: ' + patient.name;
    target.className = '';
    target.innerHTML =
      '<div class="hub-grid">' +
        '<div class="hub-card"><h4>Dados centrais</h4><div><strong>' + escHtml(patient.name) + '</strong></div><div class="muted small">' + escHtml(formatWhatsapp(patient.whatsapp || '-')) + ' · ' + escHtml(patient.pathology || 'Sem patologia') + '</div></div>' +
        '<div class="hub-card"><h4>Agenda</h4><div><strong>' + appointments.filter(function(a){ return ['agendado','confirmado'].indexOf(a.status) !== -1; }).length + '</strong> futuro(s)</div><div class="muted small">' + appointments.length + ' agendamento(s) totais</div></div>' +
        '<div class="hub-card"><h4>Prontuário</h4><div><strong>' + sessions.length + '</strong> sessão(ões) clínicas</div><div class="muted small">' + evolutions.length + ' evolução(ões) clínicas</div></div>' +
        '<div class="hub-card"><h4>Documentos</h4><div><strong>' + (docs.length + guias.length) + '</strong> registro(s)</div><div class="muted small">' + getGeneratedDocumentsByPatient(pid).length + ' documento(s) gerado(s)</div></div>' +
      '</div>' +
      '<div class="timeline-soft" style="margin-top:14px">' +
        '<div class="event"><strong>Pacotes</strong><div class="muted small" style="margin-top:6px">' + (packages.length ? packages.map(function(pkg){
          var total = Number(pkg.total_sessions || 0);
          var remaining = Number(pkg.remaining_sessions || 0);
          return escHtml((window.serviceName ? serviceName(pkg.service_id) : 'Serviço') + ': ' + (total - remaining) + '/' + total + ' usadas · saldo ' + remaining);
        }).join('<br>') : 'Sem pacote ativo.') + '</div></div>' +
        '<div class="event"><strong>Última evolução</strong><div class="muted small" style="margin-top:6px">' + (evolutions[0] ? escHtml((fmtDateSafe(evolutions[0].date) + ' · ' + (evolutions[0].conduct || 'Sem registro'))) : 'Nenhuma evolução clínica registrada.') + '</div></div>' +
        '<div class="event"><strong>Atalhos</strong><div class="toolbar" style="margin-top:10px"><button class="btn" onclick="openProntuarioPatient(\'' + escHtml(pid) + '\')">Abrir prontuário</button><button class="btn" onclick="openDocumentsPatient(\'' + escHtml(pid) + '\')">Abrir documentos</button></div></div>' +
      '</div>';
  }

  function renderUnifiedProntuario(){
    var pid = getSelectedPatientId();
    var patient = getPatientById(pid);
    var kpis = el('prontuarioKpis');
    var timeline = el('prontuarioTimeline');
    if(!kpis || !timeline) return;
    if(!patient){
      kpis.innerHTML = '<div class="kpi"><div class="small muted">Prontuário</div><strong>Selecione um paciente</strong></div>';
      timeline.innerHTML = '<div class="muted">Selecione um paciente para carregar a linha do cuidado.</div>';
      ['anamChief','anamHistory','anamDiagnosis','anamLimitations','anamGoals','anamObs','evolutionDate','evolutionConduct','evolutionGuidance'].forEach(function(id){
        if(el(id)) el(id).value = '';
      });
      return;
    }
    var anamnese = getAnamneseByPatient(pid) || {};
    var evolutions = getPatientEvolutions(pid);
    var appointments = getAgendaAppointmentsByPatient(pid);
    var completedAppointments = appointments.filter(function(item){ return item.status === 'concluido'; });
    kpis.innerHTML =
      '<div class="kpi"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name) + '</strong></div>' +
      '<div class="kpi"><div class="small muted">Sessões realizadas</div><strong>' + completedAppointments.length + '</strong></div>' +
      '<div class="kpi"><div class="small muted">Evoluções clínicas</div><strong>' + evolutions.length + '</strong></div>';
    if(el('anamChief')) el('anamChief').value = anamnese.chief_complaint || '';
    if(el('anamHistory')) el('anamHistory').value = anamnese.history || '';
    if(el('anamDiagnosis')) el('anamDiagnosis').value = anamnese.diagnosis || '';
    if(el('anamLimitations')) el('anamLimitations').value = anamnese.limitations || '';
    if(el('anamGoals')) el('anamGoals').value = anamnese.goals || '';
    if(el('anamObs')) el('anamObs').value = anamnese.obs || '';
    if(el('evolutionDate') && !el('evolutionDate').value) el('evolutionDate').value = todayIsoSafe();

    var rows = [];
    evolutions.slice(0,4).forEach(function(item){
      rows.push({ date:item.date, html:'<strong>Evolução clínica</strong><div class="muted small">' + fmtDateSafe(item.date) + '</div><div class="muted small">' + escHtml(item.conduct || 'Sem registro') + '</div>' + (item.guidance ? '<div class="muted small">' + escHtml(item.guidance) + '</div>' : '') });
    });
    rows.sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });
    timeline.innerHTML = rows.length ? rows.map(function(item){ return '<div class="item">' + item.html + '</div>'; }).join('') : '<div class="muted">Ainda não há evoluções clínicas para este paciente.</div>';
  }

  function renderUnifiedDocuments(){
    var pid = getSelectedPatientId();
    var patient = getPatientById(pid);
    if(el('docDateInput') && !el('docDateInput').value) el('docDateInput').value = todayIsoSafe();
    var settings = getDocumentSettings();
    if(el('professionalNameInput') && !el('professionalNameInput').value) el('professionalNameInput').value = settings.professionalName || 'FEMIC Fisioterapia';
    if(el('professionalNoteInput') && !el('professionalNoteInput').value) el('professionalNoteInput').value = settings.professionalNote || '';
    if(el('showStampSelect') && !el('showStampSelect').value) el('showStampSelect').value = settings.showStamp || 'yes';
    populateDocPresets();
    renderUnifiedDocumentPreview();
    renderUnifiedPatientDocumentsList(pid);
    renderUnifiedGuiasList(pid);
    renderGeneratedDocumentsHistory(pid);
    if(!patient && el('documentPreview')){
      el('documentPreview').innerHTML = '<div class="unified-empty-state">Selecione um paciente para gerar documentos contextualizados.</div>';
    }
  }

  function renderUnifiedPatientDocumentsList(pid){
    var target = el('documentsListUnified');
    if(!target) return;
    var docs = pid ? getDocumentsByPatient(pid) : [];
    target.innerHTML = docs.length ? docs.map(function(doc){
      return '<div class="item"><div><strong>' + escHtml(doc.title || 'Documento') + '</strong><div class="muted small">' + escHtml(doc.category || 'Sem categoria') + (doc.obs ? ' · ' + escHtml(doc.obs) : '') + '</div></div><div class="toolbar"><a class="btn" href="' + escHtml(doc.drive_url || '#') + '" target="_blank" rel="noopener">Abrir</a><button class="btn danger" onclick="deleteUnifiedPatientDocument(\'' + escHtml(doc.id) + '\')">Remover</button></div></div>';
    }).join('') : '<div class="muted">Nenhum documento do paciente cadastrado.</div>';
  }

  function renderUnifiedGuiasList(pid){
    var target = el('guiasListUnified');
    if(!target) return;
    var list = pid ? getGuiasByPatient(pid) : [];
    target.innerHTML = list.length ? list.map(function(g){
      var auth = Number(g.sessoes_auth || 0);
      var used = Number(g.sessoes_usadas || 0);
      var remaining = auth - used;
      return '<div class="item"><div><strong>' + escHtml(g.convenio || 'Convênio') + '</strong><div class="muted small">Guia ' + escHtml(g.numero || '-') + ' · ' + used + '/' + auth + ' usadas · saldo ' + remaining + '</div></div><div class="toolbar">' + (g.drive_url ? '<a class="btn" href="' + escHtml(g.drive_url) + '" target="_blank" rel="noopener">Drive</a>' : '') + '<button class="btn danger" onclick="deleteUnifiedGuia(\'' + escHtml(g.id) + '\')">Remover</button></div></div>';
    }).join('') : '<div class="muted">Nenhuma guia cadastrada para este paciente.</div>';
  }

  function renderGeneratedDocumentsHistory(pid){
    var target = el('generatedDocumentsHistory');
    if(!target) return;
    var list = pid ? getGeneratedDocumentsByPatient(pid) : getGeneratedDocuments().slice().sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); }).slice(0,10);
    target.innerHTML = list.length ? list.map(function(doc){
      return '<div class="item"><div><strong>' + escHtml(doc.title || 'Documento') + '</strong><div class="muted small">' + escHtml(doc.patient_name || '-') + ' · ' + fmtDateSafe(doc.date) + ' · ' + escHtml(doc.type_label || doc.type || '') + '</div></div><div class="toolbar"><button class="btn" onclick="loadGeneratedDocument(\'' + escHtml(doc.id) + '\')">Carregar</button><button class="btn danger" onclick="deleteGeneratedDocument(\'' + escHtml(doc.id) + '\')">Remover</button></div></div>';
    }).join('') : '<div class="muted">Nenhum documento salvo ainda.</div>';
  }

  function getDocumentContext(pid){
    var patient = getPatientById(pid) || {};
    var anamnese = getAnamneseByPatient(pid) || {};
    var sessions = getPatientSessions(pid);
    var evolutions = getPatientEvolutions(pid);
    var firstSession = sessions[0] || {};
    var lastSession = sessions[sessions.length - 1] || {};
    var latestEvolution = evolutions[0] || {};
    var firstDate = firstSession.date ? fmtDateSafe(firstSession.date) : '-';
    var lastDate = lastSession.date ? fmtDateSafe(lastSession.date) : '-';
    return {
      name: patient.name || 'Paciente',
      pathology: patient.pathology || anamnese.diagnosis || 'quadro clínico em acompanhamento',
      chief: anamnese.chief_complaint || 'sem registro',
      history: anamnese.history || 'sem histórico detalhado',
      diagnosis: anamnese.diagnosis || patient.pathology || 'sem hipótese registrada',
      limitations: anamnese.limitations || 'sem limitações descritas',
      goals: anamnese.goals || 'sem objetivos descritos',
      dateBr: fmtDateSafe(el('docDateInput') ? el('docDateInput').value : todayIsoSafe()),
      sessionCount: sessions.length,
      lastConduct: latestEvolution.conduct || 'sem conduta registrada',
      lastGuidance: latestEvolution.guidance || 'sem orientação registrada',
      period: sessions.length ? ('de ' + firstDate + ' a ' + lastDate) : '',
      reason: anamnese.diagnosis || patient.pathology || 'necessidade de investigação complementar'
    };
  }

  function populateDocPresets(){
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var target = el('docPresetSelect');
    if(!target) return;
    var presets = DOC_PRESETS[type] || [];
    target.innerHTML = presets.map(function(item){
      return '<option value="' + escHtml(item.id) + '">' + escHtml(item.label) + '</option>';
    }).join('');
  }

  function renderUnifiedDocumentPreview(){
    var preview = el('documentPreview');
    if(!preview) return;
    var pid = getSelectedPatientId();
    var patient = getPatientById(pid);
    if(!patient){
      preview.innerHTML = '<div class="unified-empty-state">Selecione um paciente para montar o documento.</div>';
      return;
    }
    var settings = {
      professionalName: (el('professionalNameInput') && el('professionalNameInput').value.trim()) || 'FEMIC Fisioterapia',
      professionalNote: (el('professionalNoteInput') && el('professionalNoteInput').value.trim()) || '',
      showStamp: (el('showStampSelect') && el('showStampSelect').value) || 'yes'
    };
    saveDocumentSettings(settings);
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var body = (el('docBodyInput') && el('docBodyInput').value.trim()) || 'Use o botão "Gerar texto" para preencher um documento com base no contexto clínico do paciente.';
    preview.innerHTML =
      '<div class="document-sheet">' +
        '<h2>' + escHtml((DOC_PRESETS[type] && DOC_PRESETS[type][0] && DOC_PRESETS[type][0].title) || 'DOCUMENTO') + '</h2>' +
        '<div class="doc-meta">' +
          '<div class="meta-box"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name || '-') + '</strong></div>' +
          '<div class="meta-box"><div class="small muted">Data</div><strong>' + escHtml(fmtDateSafe(el('docDateInput') ? el('docDateInput').value : todayIsoSafe())) + '</strong></div>' +
          '<div class="meta-box"><div class="small muted">Patologia</div><strong>' + escHtml(patient.pathology || '-') + '</strong></div>' +
        '</div>' +
        '<div class="doc-body">' + escHtml(body).replace(/\n/g, '<br>') + '</div>' +
        '<div class="doc-sign"><strong>' + escHtml(settings.professionalName) + '</strong>' + (settings.professionalNote ? '<br>' + escHtml(settings.professionalNote) : '') + '</div>' +
      '</div>';
  }

  async function saveGeneratedDocumentToCloud(doc){
    if(typeof api !== 'function' || !base() || !key()) return { skipped:true };
    try{
      await api('femic_generated_documents', {
        method:'POST',
        body:JSON.stringify({
          id: doc.id,
          patient_id: doc.patient_id,
          patient_name: doc.patient_name,
          document_type: doc.type,
          document_title: doc.title,
          document_body: doc.body,
          document_date: doc.date,
          source: 'femic_unified'
        })
      });
      return { ok:true };
    }catch(e){
      return { ok:false, error:e };
    }
  }

  function renderHistoryPanel(){
    var dataset = runtime.historyDataset || { patients:[], sessions:[] };
    var patients = Array.isArray(dataset.patients) ? dataset.patients.slice() : [];
    var sessions = Array.isArray(dataset.sessions) ? dataset.sessions.slice() : [];
    var searchName = normName(el('historySearchPatient') ? el('historySearchPatient').value : '');
    var searchPhone = normPhone(el('historySearchPhone') ? el('historySearchPhone').value : '');
    var pathologyFilter = el('historyFilterPathology') ? el('historyFilterPathology').value : '';
    var yearFilter = el('historyFilterYear') ? el('historyFilterYear').value : '';

    var pathologies = Array.from(new Set(patients.map(function(p){ return String(p.pathology || 'Sem patologia').trim(); }).filter(Boolean))).sort(function(a,b){ return a.localeCompare(b, 'pt-BR'); });
    var years = Array.from(new Set(sessions.map(function(s){ return String(s.date || '').slice(0,4); }).filter(Boolean))).sort();
    if(el('historyFilterPathology')){
      var currentPathology = el('historyFilterPathology').value;
      el('historyFilterPathology').innerHTML = '<option value="">Todas</option>' + pathologies.map(function(value){ return '<option value="' + escHtml(value) + '">' + escHtml(value) + '</option>'; }).join('');
      el('historyFilterPathology').value = currentPathology && pathologies.indexOf(currentPathology) !== -1 ? currentPathology : '';
      pathologyFilter = el('historyFilterPathology').value;
    }
    if(el('historyFilterYear')){
      var currentYear = el('historyFilterYear').value;
      el('historyFilterYear').innerHTML = '<option value="">Todos</option>' + years.map(function(value){ return '<option value="' + escHtml(value) + '">' + escHtml(value) + '</option>'; }).join('');
      el('historyFilterYear').value = currentYear && years.indexOf(currentYear) !== -1 ? currentYear : '';
      yearFilter = el('historyFilterYear').value;
    }

    var rows = patients.map(function(patient){
      var patientSessions = sessions.filter(function(session){
        return String(session.patient_id) === String(patient.id) && (!yearFilter || String(session.date || '').slice(0,4) === yearFilter);
      }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
      return {
        patient: patient,
        sessions: patientSessions,
        lastSessionDate: patientSessions.length ? patientSessions[patientSessions.length - 1].date : '-'
      };
    }).filter(function(row){
      if(searchName && normName(row.patient.name).indexOf(searchName) === -1) return false;
      if(searchPhone && normPhone(row.patient.whatsapp).indexOf(searchPhone) === -1) return false;
      if(pathologyFilter && String(row.patient.pathology || 'Sem patologia') !== pathologyFilter) return false;
      return row.sessions.length > 0;
    });

    var totalPatients = rows.length;
    var totalSessions = rows.reduce(function(sum, row){ return sum + row.sessions.length; }, 0);
    var avgPerPatient = totalPatients ? (totalSessions / totalPatients).toFixed(1) : '0';
    var lastSession = rows.reduce(function(latest, row){
      if(!row.lastSessionDate || row.lastSessionDate === '-') return latest;
      return !latest || String(row.lastSessionDate) > String(latest) ? row.lastSessionDate : latest;
    }, '');
    if(el('historyKpis')){
      el('historyKpis').innerHTML =
        '<div class="kpi"><div class="small muted">Pacientes</div><strong>' + totalPatients + '</strong></div>' +
        '<div class="kpi"><div class="small muted">Sessões</div><strong>' + totalSessions + '</strong></div>' +
        '<div class="kpi"><div class="small muted">Média / paciente</div><strong>' + avgPerPatient + '</strong></div>' +
        '<div class="kpi"><div class="small muted">Última sessão</div><strong>' + (lastSession ? fmtDateSafe(lastSession) : '-') + '</strong></div>';
    }

    if(el('historyPatientsBody')){
      el('historyPatientsBody').innerHTML = rows.length ? rows.map(function(row){
        return '<tr><td>' + escHtml(row.patient.name || '-') + '</td><td>' + escHtml(row.patient.pathology || 'Sem patologia') + '</td><td>' + row.sessions.length + '</td><td>' + (row.lastSessionDate && row.lastSessionDate !== '-' ? fmtDateSafe(row.lastSessionDate) : '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Nenhum registro encontrado.</td></tr>';
    }

    var pathologyMap = {};
    rows.forEach(function(row){
      var key = row.patient.pathology || 'Sem patologia';
      if(!pathologyMap[key]) pathologyMap[key] = { pathology:key, patients:0, sessions:0, lastSessionDate:'' };
      pathologyMap[key].patients += 1;
      pathologyMap[key].sessions += row.sessions.length;
      if(row.lastSessionDate && row.lastSessionDate !== '-' && (!pathologyMap[key].lastSessionDate || row.lastSessionDate > pathologyMap[key].lastSessionDate)) pathologyMap[key].lastSessionDate = row.lastSessionDate;
    });
    var pathologyRows = Object.values(pathologyMap).sort(function(a,b){ return b.sessions - a.sessions; });
    if(el('historyPathologiesBody')){
      el('historyPathologiesBody').innerHTML = pathologyRows.length ? pathologyRows.map(function(row){
        return '<tr><td>' + escHtml(row.pathology) + '</td><td>' + row.patients + '</td><td>' + row.sessions + '</td><td>' + (row.lastSessionDate ? fmtDateSafe(row.lastSessionDate) : '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Nenhuma patologia encontrada.</td></tr>';
    }

    renderHistoryCharts(rows, pathologyRows);
  }

  function renderHistoryCharts(rows, pathologyRows){
    if(!window.Chart || !el('historyYearsChart') || !el('historyPathologiesChart')) return;
    var yearCounts = {};
    rows.forEach(function(row){
      row.sessions.forEach(function(session){
        var year = String(session.date || '').slice(0,4);
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });
    });
    var yearLabels = Object.keys(yearCounts).sort();
    var yearData = yearLabels.map(function(label){ return yearCounts[label]; });

    if(runtime.historyYearsChart) runtime.historyYearsChart.destroy();
    runtime.historyYearsChart = new Chart(el('historyYearsChart'), {
      type: 'bar',
      data: { labels: yearLabels, datasets:[{ label:'Sessões', data:yearData, backgroundColor:'#0b3c6f' }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
    });

    var topPathologies = pathologyRows.slice(0,8);
    if(runtime.historyPathologiesChart) runtime.historyPathologiesChart.destroy();
    runtime.historyPathologiesChart = new Chart(el('historyPathologiesChart'), {
      type: 'doughnut',
      data: {
        labels: topPathologies.map(function(row){ return row.pathology; }),
        datasets:[{
          data: topPathologies.map(function(row){ return row.sessions; }),
          backgroundColor:['#0b3c6f','#0f5c5c','#1fb6e9','#10b981','#f59e0b','#ef4444','#2563eb','#94a3b8']
        }]
      },
      options: { responsive:true, maintainAspectRatio:false }
    });
  }

  function renderUnifiedBackupSummary(){
    if(el('bkClinicalSessions')) el('bkClinicalSessions').textContent = String(getSessions().length);
    if(el('bkClinicalEvolutions')) el('bkClinicalEvolutions').textContent = String(getEvolutions().length);
    if(el('bkClinicalDocuments')) el('bkClinicalDocuments').textContent = String(getPatientDocuments().length + getGuias().length + getGeneratedDocuments().length);
  }

  function renderUnifiedAll(){
    populateUnifiedPatientSelects();
    renderPatientHub();
    renderUnifiedProntuario();
    renderUnifiedDocuments();
    renderUnifiedBackupSummary();
    if(runtime.historyDataset && runtime.historyDataset.source !== 'empty') renderHistoryPanel();
  }

  function ensurePatientSelected(){
    var pid = getSelectedPatientId();
    if(!pid){
      if(typeof toast === 'function') toast('Selecione um paciente primeiro.', 'warning');
      return '';
    }
    return pid;
  }

  async function upsertPatientsToSupabase(rows){
    if(!rows.length || typeof upsertRows !== 'function' || !base() || !key()) return;
    await upsertRows('patients', rows.map(normalizePatientRecord));
  }

  function buildUnifiedBackupPayload(){
    var agenda = getAgendaState();
    return {
      app: 'FEMIC Unified',
      version: 'v1-unified-index',
      exported_at: new Date().toISOString(),
      note: 'Backup unificado com agenda, prontuário, documentos e histórico clínico da FEMIC.',
      tables: {
        patients: agenda.patients || [],
        health_insurances: agenda.payers || [],
        services: agenda.services || [],
        schedule_settings: agenda.settings && agenda.settings.id ? [agenda.settings] : (agenda.settings ? [agenda.settings] : []),
        clinic_rules: agenda.clinicRules || [],
        session_packages: agenda.packages || [],
        appointments: agenda.appointments || [],
        session_movements: agenda.movements || []
      },
      clinical: {
        sessions: getSessions(),
        anamneses: getAnamneses(),
        clinical_evolutions: getEvolutions(),
        patient_documents: getPatientDocuments(),
        generated_documents: getGeneratedDocuments(),
        guias: getGuias()
      },
      settings: {
        forms_link: localStorage.getItem('femic_form_link') || '',
        document_settings: getDocumentSettings()
      }
    };
  }

  async function restoreAgendaTablesFromBackup(tables){
    var required = ['patients','health_insurances','services','schedule_settings','session_packages','appointments','session_movements'];
    var missing = required.filter(function(keyName){ return !Array.isArray(tables[keyName]); });
    if(missing.length) return { restored:false, reason:'missing', missing:missing };
    if(!base() || !key()) return { restored:false, reason:'config' };
    await deleteAllRows('session_movements');
    await deleteAllRows('appointments');
    await deleteAllRows('session_packages');
    await deleteAllRows('services');
    await deleteAllRows('health_insurances');
    await deleteAllRows('schedule_settings');
    try{ await deleteAllRows('clinic_rules'); }catch(e){ if(!(typeof isMissingClinicRulesTableError === 'function' && isMissingClinicRulesTableError(e))) throw e; }
    await upsertRows('patients', (tables.patients || []).map(normalizePatientRecord));
    await upsertRows('health_insurances', tables.health_insurances || []);
    await upsertRows('services', tables.services || []);
    await upsertRows('schedule_settings', tables.schedule_settings || []);
    if(Array.isArray(tables.clinic_rules)){
      if(typeof writeClinicRulesCache === 'function') writeClinicRulesCache(tables.clinic_rules);
      try{ await upsertRows('clinic_rules', tables.clinic_rules); }catch(e){ if(!(typeof isMissingClinicRulesTableError === 'function' && isMissingClinicRulesTableError(e))) throw e; }
    }
    await upsertRows('session_packages', tables.session_packages || []);
    await upsertRows('appointments', tables.appointments || []);
    await upsertRows('session_movements', tables.session_movements || []);
    return { restored:true };
  }

  function extractClinicalPayloadFromBackup(data){
    if(data && data.clinical) return data.clinical;
    return {
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      anamneses: Array.isArray(data.anamneses) ? data.anamneses : [],
      clinical_evolutions: Array.isArray(data.clinical_evolutions) ? data.clinical_evolutions : (Array.isArray(data.evolutions) ? data.evolutions : []),
      patient_documents: Array.isArray(data.patient_documents) ? data.patient_documents : (Array.isArray(data.documents) ? data.documents : []),
      generated_documents: Array.isArray(data.generated_documents) ? data.generated_documents : [],
      guias: Array.isArray(data.guias) ? data.guias : []
    };
  }

  function extractPatientsForLegacyRestore(data){
    if(data && data.tables && Array.isArray(data.tables.patients)) return data.tables.patients;
    if(Array.isArray(data.patients)) return data.patients;
    return [];
  }

  function setHistoryDataset(source, patients, sessions){
    runtime.historyDataset = {
      source: source || 'unknown',
      patients: Array.isArray(patients) ? patients.map(normalizePatientRecord) : [],
      sessions: Array.isArray(sessions) ? sessions.map(normalizeSessionRecord) : []
    };
    renderHistoryPanel();
  }

  function installBackupOverrides(){
    var originalRenderBackupPanel = window.renderBackupPanel;
    if(typeof originalRenderBackupPanel === 'function'){
      window.renderBackupPanel = function(){
        originalRenderBackupPanel();
        renderUnifiedBackupSummary();
      };
    }

    window.exportAgendaBackup = async function(){
      try{
        if(typeof toast === 'function') toast('Preparando backup unificado...', 'info');
        var payload = buildUnifiedBackupPayload();
        if(typeof downloadJsonFile === 'function'){
          downloadJsonFile('femic_unified_backup_' + todayIsoSafe().replace(/-/g, '') + '.json', payload);
        }else{
          var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'femic_unified_backup_' + todayIsoSafe().replace(/-/g, '') + '.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
        if(typeof toast === 'function') toast('Backup unificado exportado com sucesso.', 'success');
      }catch(e){
        console.error(e);
        if(typeof toast === 'function') toast('Erro ao exportar backup unificado: ' + e.message, 'error');
      }
    };

    window.restoreAgendaBackup = async function(event){
      var file = event.target.files && event.target.files[0];
      if(!file) return;
      try{
        var text = await file.text();
        var backup = JSON.parse(text);
        var tables = backup.tables || null;
        var clinical = extractClinicalPayloadFromBackup(backup);
        var restoredAgenda = false;
        if(tables){
          if(!confirm('Restaurar agenda e dados clínicos contidos neste backup?')){ event.target.value = ''; return; }
          var agendaResult = await restoreAgendaTablesFromBackup(tables);
          restoredAgenda = agendaResult.restored === true;
          if(agendaResult.reason === 'config'){
            if(typeof toast === 'function') toast('Sem configuração Supabase ativa: restaurando apenas a parte clínica local.', 'warning');
          }
        } else if(Array.isArray(backup.sessions) || Array.isArray(backup.anamneses) || Array.isArray(backup.documents) || Array.isArray(backup.clinical_evolutions)){
          if(!confirm('Restaurar somente os dados clínicos deste backup legado?')){ event.target.value = ''; return; }
          var legacyPatients = extractPatientsForLegacyRestore(backup).map(normalizePatientRecord);
          if(legacyPatients.length && base() && key()){
            await upsertPatientsToSupabase(legacyPatients);
            await loadAll(true);
          }
        } else {
          throw new Error('Formato de backup não reconhecido.');
        }

        if(Array.isArray(clinical.sessions)) saveSessions(clinical.sessions);
        if(Array.isArray(clinical.anamneses)) saveAnamneses(clinical.anamneses);
        if(Array.isArray(clinical.clinical_evolutions)) saveEvolutions(clinical.clinical_evolutions);
        if(Array.isArray(clinical.patient_documents)) savePatientDocuments(clinical.patient_documents);
        if(Array.isArray(clinical.generated_documents)) saveGeneratedDocuments(clinical.generated_documents);
        if(Array.isArray(clinical.guias)) saveGuias(clinical.guias);
        if(backup.settings && backup.settings.document_settings) saveDocumentSettings(backup.settings.document_settings);

        if(restoredAgenda) await loadAll(true);
        renderUnifiedAll();
        if(typeof toast === 'function') toast('Restauração concluída com sucesso.', 'success');
      }catch(e){
        console.error(e);
        if(typeof toast === 'function') toast('Erro ao restaurar backup: ' + e.message, 'error');
      }finally{
        event.target.value = '';
      }
    };
  }

  window.selectUnifiedPatient = function(pid, source){
    setCurrentPatient(pid || '');
    renderUnifiedAll();
    if(source === 'documentos') renderUnifiedDocuments();
    if(source === 'prontuario') renderUnifiedProntuario();
  };

  window.openProntuarioPatient = function(pid){
    setCurrentPatient(pid);
    if(typeof showPanel === 'function') showPanel('prontuario');
    renderUnifiedAll();
  };

  window.openDocumentsPatient = function(pid){
    setCurrentPatient(pid);
    if(typeof showPanel === 'function') showPanel('documentos');
    renderUnifiedAll();
  };

  window.saveUnifiedAnamnese = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var now = new Date().toISOString();
    var list = getAnamneses();
    var existing = getAnamneseByPatient(pid);
    var payload = {
      id: existing && existing.id ? existing.id : generateId('a'),
      patient_id: pid,
      chief_complaint: el('anamChief') ? el('anamChief').value.trim() : '',
      history: el('anamHistory') ? el('anamHistory').value.trim() : '',
      diagnosis: el('anamDiagnosis') ? el('anamDiagnosis').value.trim() : '',
      limitations: el('anamLimitations') ? el('anamLimitations').value.trim() : '',
      goals: el('anamGoals') ? el('anamGoals').value.trim() : '',
      obs: el('anamObs') ? el('anamObs').value.trim() : '',
      created_at: existing && existing.created_at ? existing.created_at : now,
      updated_at: now
    };
    var index = list.findIndex(function(item){ return String(item.patient_id) === String(pid); });
    if(index >= 0) list[index] = payload; else list.push(payload);
    saveAnamneses(list);
    if(typeof toast === 'function') toast('Anamnese salva.', 'success');
  };

  window.saveUnifiedEvolution = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var list = getEvolutions();
    list.push({
      id: generateId('e'),
      patient_id: pid,
      date: el('evolutionDate') && el('evolutionDate').value ? el('evolutionDate').value : todayIsoSafe(),
      conduct: el('evolutionConduct') ? el('evolutionConduct').value.trim() : '',
      guidance: el('evolutionGuidance') ? el('evolutionGuidance').value.trim() : '',
      created_at: new Date().toISOString()
    });
    saveEvolutions(list);
    if(el('evolutionDate')) el('evolutionDate').value = todayIsoSafe();
    if(el('evolutionConduct')) el('evolutionConduct').value = '';
    if(el('evolutionGuidance')) el('evolutionGuidance').value = '';
    if(typeof toast === 'function') toast('Evolução clínica salva.', 'success');
  };

  window.generateUnifiedDocument = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var presetId = el('docPresetSelect') ? el('docPresetSelect').value : '';
    var preset = (DOC_PRESETS[type] || []).find(function(item){ return item.id === presetId; }) || (DOC_PRESETS[type] || [])[0];
    if(!preset){
      if(typeof toast === 'function') toast('Nenhum modelo disponível para este tipo.', 'warning');
      return;
    }
    var ctx = getDocumentContext(pid);
    if(el('docBodyInput')) el('docBodyInput').value = preset.body(ctx);
    renderUnifiedDocumentPreview();
    if(typeof toast === 'function') toast('Documento gerado a partir do contexto do paciente.', 'success');
  };

  window.saveGeneratedDocument = async function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var patient = getPatientById(pid);
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var preset = (DOC_PRESETS[type] || [])[0] || { title:'DOCUMENTO' };
    var entry = {
      id: generateId('gd'),
      patient_id: pid,
      patient_name: patient ? patient.name : 'Paciente',
      type: type,
      type_label: preset.title || 'DOCUMENTO',
      title: preset.title || 'DOCUMENTO',
      body: el('docBodyInput') ? el('docBodyInput').value.trim() : '',
      date: el('docDateInput') && el('docDateInput').value ? el('docDateInput').value : todayIsoSafe(),
      created_at: new Date().toISOString()
    };
    var list = getGeneratedDocuments();
    list.unshift(entry);
    saveGeneratedDocuments(list.slice(0, 120));
    var cloudResult = await saveGeneratedDocumentToCloud(entry);
    renderGeneratedDocumentsHistory(pid);
    if(typeof toast === 'function'){
      toast(cloudResult.ok === false ? 'Documento salvo localmente. A tabela em nuvem não está pronta.' : 'Documento salvo no histórico.', cloudResult.ok === false ? 'warning' : 'success');
    }
  };

  window.printUnifiedDocument = function(){
    renderUnifiedDocumentPreview();
    var preview = el('documentPreview');
    if(!preview) return;
    var printWindow = window.open('', '_blank', 'width=900,height=700');
    if(!printWindow) return;
    printWindow.document.write('<html><head><title>Documento FEMIC</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#183043} h2{color:#0b3c6f} .doc-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.meta-box{border:1px solid #dbe5ea;border-radius:12px;padding:10px}.doc-body{white-space:pre-wrap;line-height:1.65}.doc-sign{margin-top:28px;padding-top:16px;border-top:1px dashed #c9d6de;color:#64748b}</style></head><body>' + preview.innerHTML + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function(){ printWindow.print(); }, 300);
  };

  window.saveUnifiedPatientDocument = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var title = el('patientDocumentTitle') ? el('patientDocumentTitle').value.trim() : '';
    var category = el('patientDocumentCategory') ? el('patientDocumentCategory').value.trim() : '';
    var driveUrl = el('patientDocumentUrl') ? el('patientDocumentUrl').value.trim() : '';
    var obs = el('patientDocumentObs') ? el('patientDocumentObs').value.trim() : '';
    if(!title || !driveUrl){
      if(typeof toast === 'function') toast('Informe título e link do documento.', 'warning');
      return;
    }
    var list = getPatientDocuments();
    list.unshift({
      id: generateId('d'),
      patient_id: pid,
      title: title,
      category: category,
      drive_url: driveUrl,
      obs: obs,
      created_at: new Date().toISOString()
    });
    savePatientDocuments(list);
    ['patientDocumentTitle','patientDocumentCategory','patientDocumentUrl','patientDocumentObs'].forEach(function(id){ if(el(id)) el(id).value = ''; });
    if(typeof toast === 'function') toast('Documento do paciente salvo.', 'success');
  };

  window.deleteUnifiedPatientDocument = function(documentId){
    if(!confirm('Remover este documento do paciente?')) return;
    savePatientDocuments(getPatientDocuments().filter(function(item){ return String(item.id) !== String(documentId); }));
    if(typeof toast === 'function') toast('Documento removido.', 'warning');
  };

  window.saveUnifiedGuia = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var convenio = el('guiaConvenio') ? el('guiaConvenio').value.trim() : '';
    var numero = el('guiaNumero') ? el('guiaNumero').value.trim() : '';
    if(!convenio || !numero){
      if(typeof toast === 'function') toast('Informe convênio e número da guia.', 'warning');
      return;
    }
    var list = getGuias();
    list.unshift({
      id: generateId('g'),
      patient_id: pid,
      convenio: convenio,
      numero: numero,
      data_auth: el('guiaDataAuth') ? el('guiaDataAuth').value : '',
      validade: el('guiaValidade') ? el('guiaValidade').value : '',
      sessoes_auth: clampInt(el('guiaSessoesAuth') && el('guiaSessoesAuth').value, 0, 999) || 0,
      sessoes_usadas: clampInt(el('guiaSessoesUsadas') && el('guiaSessoesUsadas').value, 0, 999) || 0,
      drive_url: el('guiaDriveUrl') ? el('guiaDriveUrl').value.trim() : '',
      obs: el('guiaObs') ? el('guiaObs').value.trim() : '',
      created_at: new Date().toISOString()
    });
    saveGuias(list);
    ['guiaConvenio','guiaNumero','guiaDataAuth','guiaValidade','guiaSessoesAuth','guiaSessoesUsadas','guiaDriveUrl','guiaObs'].forEach(function(id){ if(el(id)) el(id).value = ''; });
    if(typeof toast === 'function') toast('Guia salva.', 'success');
  };

  window.deleteUnifiedGuia = function(guiaId){
    if(!confirm('Remover esta guia?')) return;
    saveGuias(getGuias().filter(function(item){ return String(item.id) !== String(guiaId); }));
    if(typeof toast === 'function') toast('Guia removida.', 'warning');
  };

  window.loadGeneratedDocument = function(documentId){
    var doc = getGeneratedDocuments().find(function(item){ return String(item.id) === String(documentId); });
    if(!doc) return;
    setCurrentPatient(doc.patient_id);
    if(typeof showPanel === 'function') showPanel('documentos');
    if(el('docBodyInput')) el('docBodyInput').value = doc.body || '';
    if(el('docDateInput')) el('docDateInput').value = doc.date || todayIsoSafe();
    if(el('docTypeSelect')) el('docTypeSelect').value = doc.type || 'attendance';
    populateDocPresets();
    renderUnifiedAll();
  };

  window.deleteGeneratedDocument = function(documentId){
    if(!confirm('Remover este documento do histórico?')) return;
    saveGeneratedDocuments(getGeneratedDocuments().filter(function(item){ return String(item.id) !== String(documentId); }));
    if(typeof toast === 'function') toast('Documento removido do histórico.', 'warning');
  };

  window.loadHistoryFromCurrentState = function(){
    setHistoryDataset('current', getPatients(), getSessions());
    if(typeof toast === 'function') toast('Histórico carregado com os dados atuais do sistema.', 'success');
  };

  window.loadHistoryFromBackup = async function(event){
    var file = event.target.files && event.target.files[0];
    if(!file) return;
    try{
      var text = await file.text();
      var backup = JSON.parse(text);
      var patients = extractPatientsForLegacyRestore(backup);
      var clinical = extractClinicalPayloadFromBackup(backup);
      setHistoryDataset('backup', patients, clinical.sessions || []);
      if(typeof toast === 'function') toast('Histórico carregado a partir do backup.', 'success');
    }catch(e){
      console.error(e);
      if(typeof toast === 'function') toast('Não foi possível ler o backup para o histórico.', 'error');
    }finally{
      event.target.value = '';
    }
  };

  window.exportHistoryCsv = function(){
    var body = el('historyPatientsBody');
    if(!body) return;
    var rows = [['Paciente','Patologia','Sessões','Última sessão']];
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function(tr){
      var cells = Array.prototype.map.call(tr.children, function(td){ return td.innerText; });
      if(cells.length === 4) rows.push(cells);
    });
    var csv = rows.map(function(row){
      return row.map(function(cell){ return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'femic_historico_resumo.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  function buildPatientClinicalExportHtml(pid, includeDays){
    var patient = getPatientById(pid);
    if(!patient) return '';
    var anamnese = getAnamneseByPatient(pid) || {};
    var evolutions = getPatientEvolutions(pid);
    var appointments = getAgendaAppointmentsByPatient(pid).filter(function(item){ return item.status === 'concluido'; });
    var daysHtml = includeDays
      ? (appointments.length
        ? appointments.map(function(item){
            return '<li>' + escHtml(fmtWeekdaySafe(item.appointment_date) + ' · ' + fmtDateSafe(item.appointment_date) + ' · ' + String(item.start_time || '').slice(0,5) + ' · ' + (window.serviceName ? serviceName(item.service_id) : 'Serviço')) + '</li>';
          }).join('')
        : '<li>Nenhum atendimento concluído na agenda.</li>')
      : '';
    var evolutionHtml = evolutions.length
      ? evolutions.map(function(item){
          return '<article class="clinical-export-block"><h4>' + escHtml(fmtDateSafe(item.date)) + '</h4><p><strong>Evolução:</strong> ' + escHtml(item.conduct || 'Sem registro') + '</p><p><strong>Orientações:</strong> ' + escHtml(item.guidance || 'Sem orientações registradas') + '</p></article>';
        }).join('')
      : '<p>Nenhuma evolução clínica cadastrada.</p>';
    return '' +
      '<div class="clinical-export-doc">' +
        '<header class="clinical-export-header">' +
          '<div><div class="eyebrow">FEMIC</div><h2>Ficha clínica do paciente</h2></div>' +
          '<div class="clinical-export-meta"><div><strong>Paciente</strong><span>' + escHtml(patient.name || '-') + '</span></div><div><strong>WhatsApp</strong><span>' + escHtml(formatWhatsapp(patient.whatsapp || '-')) + '</span></div><div><strong>Patologia</strong><span>' + escHtml(patient.pathology || 'Sem patologia registrada') + '</span></div></div>' +
        '</header>' +
        '<section class="clinical-export-section"><h3>Anamnese</h3><div class="clinical-export-grid">' +
          '<div><strong>Queixa principal</strong><p>' + escHtml(anamnese.chief_complaint || 'Não registrada') + '</p></div>' +
          '<div><strong>História atual</strong><p>' + escHtml(anamnese.history || 'Não registrada') + '</p></div>' +
          '<div><strong>Diagnóstico / hipótese</strong><p>' + escHtml(anamnese.diagnosis || 'Não registrado') + '</p></div>' +
          '<div><strong>Limitações funcionais</strong><p>' + escHtml(anamnese.limitations || 'Não registradas') + '</p></div>' +
          '<div><strong>Objetivos</strong><p>' + escHtml(anamnese.goals || 'Não registrados') + '</p></div>' +
          '<div><strong>Observações</strong><p>' + escHtml(anamnese.obs || 'Sem observações') + '</p></div>' +
        '</div></section>' +
        '<section class="clinical-export-section"><h3>Evoluções clínicas</h3>' + evolutionHtml + '</section>' +
        (includeDays ? '<section class="clinical-export-section"><h3>Dias atendidos</h3><ul class="clinical-export-days">' + daysHtml + '</ul></section>' : '') +
      '</div>';
  }

  window.openPatient = function(pid){
    var patient = getPatientById(pid);
    if(!patient || !el('patientFicha')) return;
    setCurrentPatient(pid);
    var sessions = getPatientSessions(pid);
    var evolutions = getPatientEvolutions(pid);
    var docs = getDocumentsByPatient(pid);
    var guias = getGuiasByPatient(pid);
    var appointments = getAgendaAppointmentsByPatient(pid);
    var packages = getAgendaPackagesByPatient(pid);
    var upcoming = appointments.filter(function(item){ return ['agendado','confirmado'].indexOf(item.status) !== -1; });
    var completed = appointments.filter(function(item){ return item.status === 'concluido'; });
    var anamnese = getAnamneseByPatient(pid);
    var sortedAppointments = appointments.slice().sort(function(a,b){
      return String(a.appointment_date || '').localeCompare(String(b.appointment_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
    var nextAppointments = sortedAppointments.filter(function(item){ return ['agendado','confirmado'].indexOf(item.status) !== -1; }).slice(0,5);
    var packageLines = packages.length ? packages.map(function(item){
      var service = window.serviceName ? serviceName(item.service_id) : 'Serviço';
      var total = Number(item.total_sessions || 0);
      var remaining = Number(item.remaining_sessions || 0);
      var used = Math.max(0, total - remaining);
      return '<div class="patient-ficha-line"><strong>' + escHtml(service) + '</strong><span>' + used + '/' + total + ' usadas · saldo ' + remaining + '</span></div>';
    }).join('') : '<div class="muted">Sem pacote ativo.</div>';
    var evolutionLines = evolutions.length ? evolutions.slice(0,4).map(function(item){
      return '<div class="item"><strong>' + fmtDateSafe(item.date) + '</strong><div class="muted small">' + escHtml(item.conduct || 'Sem registro') + '</div>' + (item.guidance ? '<div class="muted small">' + escHtml(item.guidance) + '</div>' : '') + '</div>';
    }).join('') : '<div class="muted">Nenhuma evolução clínica registrada.</div>';
    el('patientFicha').innerHTML =
      '<div class="patient-ficha-shell">' +
        '<div class="patient-ficha-kpis">' +
          '<div class="kpi patient-ficha-kpi"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name) + '</strong></div>' +
          '<div class="kpi patient-ficha-kpi"><div class="small muted">WhatsApp</div><strong>' + escHtml(formatWhatsapp(patient.whatsapp || '-')) + '</strong></div>' +
          '<div class="kpi patient-ficha-kpi"><div class="small muted">Agenda</div><strong>' + upcoming.length + ' futuros</strong></div>' +
          '<div class="kpi patient-ficha-kpi"><div class="small muted">Sessões realizadas</div><strong>' + completed.length + '</strong></div>' +
        '</div>' +
        '<div class="patient-ficha-actions"><button class="btn primary" onclick="openProntuarioPatient(\'' + escHtml(pid) + '\')">Abrir prontuário</button><button class="btn" onclick="openDocumentsPatient(\'' + escHtml(pid) + '\')">Abrir documentos</button><button class="btn" onclick="openPatientClinicalExport(\'' + escHtml(pid) + '\')">Exportar ficha</button></div>' +
        '<div class="patient-ficha-overview">' +
          '<section class="hub-card patient-ficha-panel"><h4>Próximos atendimentos</h4><div class="muted small">' + (nextAppointments.length ? nextAppointments.map(function(item){ return fmtWeekdaySafe(item.appointment_date) + ' · ' + fmtDateSafe(item.appointment_date) + ' · ' + String(item.start_time || '').slice(0,5) + ' · ' + escHtml(window.serviceName ? serviceName(item.service_id) : 'Serviço'); }).join('<br>') : 'Sem agendamentos futuros.') + '</div></section>' +
          '<section class="hub-card patient-ficha-panel"><h4>Pacotes</h4><div class="patient-ficha-lines">' + packageLines + '</div></section>' +
          '<section class="hub-card patient-ficha-panel"><h4>Anamnese</h4><div class="muted small">' + (anamnese ? escHtml((anamnese.chief_complaint || 'Sem queixa principal') + ' · ' + (anamnese.diagnosis || 'Sem hipótese registrada')) : 'Nenhuma anamnese cadastrada.') + '</div></section>' +
          '<section class="hub-card patient-ficha-panel"><h4>Documentos e guias</h4><div class="muted small">' + docs.length + ' documento(s) · ' + guias.length + ' guia(s)</div></section>' +
        '</div>' +
        '<section class="card patient-ficha-panel patient-ficha-panel-wide"><div class="section-title"><h3>Últimas evoluções clínicas</h3><span class="muted small">' + completed.length + ' atendimento(s) concluído(s) na agenda</span></div><div class="list">' + evolutionLines + '</div></section>' +
      '</div>';
    if(el('patientModal')) el('patientModal').classList.add('show');
    renderUnifiedAll();
  };

  window.openPatientClinicalExport = function(pid){
    var patient = getPatientById(pid);
    if(!patient || !el('patientExportPatientId')) return;
    el('patientExportPatientId').value = pid;
    if(el('patientExportIncludeDays')) el('patientExportIncludeDays').checked = true;
    if(el('patientExportModal')) el('patientExportModal').classList.add('show');
  };

  window.printPatientClinicalExport = function(){
    var pid = el('patientExportPatientId') ? el('patientExportPatientId').value : '';
    if(!pid) return;
    var includeDays = !!(el('patientExportIncludeDays') && el('patientExportIncludeDays').checked);
    var html = buildPatientClinicalExportHtml(pid, includeDays);
    if(!html) return;
    var printWindow = window.open('', '_blank', 'width=980,height=760');
    if(!printWindow) return;
    printWindow.document.write('<html><head><title>Ficha clínica FEMIC</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#183043;background:#f8fbff}.clinical-export-doc{max-width:920px;margin:0 auto;background:#fff;border:1px solid #d9e6ef;border-radius:22px;padding:28px 30px}.clinical-export-header{display:grid;gap:18px;margin-bottom:24px}.clinical-export-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.clinical-export-meta div,.clinical-export-block,.clinical-export-section{border:1px solid #d9e6ef;border-radius:16px;background:#fff;padding:14px 16px}.clinical-export-section{margin-top:16px}.clinical-export-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.clinical-export-grid p,.clinical-export-block p{margin:8px 0 0;white-space:pre-wrap;line-height:1.55}.clinical-export-days{margin:0;padding-left:20px}.clinical-export-days li{margin:0 0 6px}.eyebrow{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#5b7a93}h2,h3,h4{margin:0;color:#0b3c6f}@media print{body{background:#fff;padding:0}.clinical-export-doc{border:none;border-radius:0;padding:0}}</style></head><body>' + html + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function(){ printWindow.print(); }, 300);
    if(el('patientExportModal')) el('patientExportModal').classList.remove('show');
  };

  window.FEMICUnifiedRuntime = {
    getState: function(){
      var pid = getSelectedPatientId();
      return {
        selectedPatientId: pid,
        currentPatient: pid ? getPatientById(pid) : null,
        patients: getPatients(),
        sessions: getSessions(),
        anamneses: getAnamneses(),
        evolutions: getEvolutions(),
        documents: getPatientDocuments(),
        guias: getGuias(),
        generatedDocuments: getGeneratedDocuments(),
        currentAnamnese: pid ? getAnamneseByPatient(pid) : null,
        currentEvolutions: pid ? getPatientEvolutions(pid) : [],
        currentAppointments: pid ? getAgendaAppointmentsByPatient(pid) : [],
        currentPackages: pid ? getAgendaPackagesByPatient(pid) : []
      };
    },
    focusPatient: function(pid){
      setCurrentPatient(pid || '');
      renderUnifiedAll();
    },
    applyAnamneseDraft: function(draft){
      draft = draft || {};
      if(el('anamChief')) el('anamChief').value = draft.chief_complaint || draft.chief || '';
      if(el('anamHistory')) el('anamHistory').value = draft.history || '';
      if(el('anamDiagnosis')) el('anamDiagnosis').value = draft.diagnosis || '';
      if(el('anamLimitations')) el('anamLimitations').value = draft.limitations || '';
      if(el('anamGoals')) el('anamGoals').value = draft.goals || '';
      if(el('anamObs')) el('anamObs').value = draft.obs || draft.observations || '';
    },
    applyEvolutionDraft: function(draft){
      draft = draft || {};
      if(el('evolutionDate') && !el('evolutionDate').value) el('evolutionDate').value = todayIsoSafe();
      if(el('evolutionConduct')) el('evolutionConduct').value = draft.conduct || draft.evolution || '';
      if(el('evolutionGuidance')) el('evolutionGuidance').value = draft.guidance || draft.orientations || '';
    }
  };

  function init(){
    installBackupOverrides();
    populateDocPresets();
    loadHistoryFromCurrentState();
    document.addEventListener('femic:state-updated', renderUnifiedAll);
    document.addEventListener('femic:unified-state-updated', renderUnifiedAll);
    if(el('docBodyInput')) el('docBodyInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('professionalNameInput')) el('professionalNameInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('professionalNoteInput')) el('professionalNoteInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('showStampSelect')) el('showStampSelect').addEventListener('change', renderUnifiedDocumentPreview);
    renderUnifiedAll();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
