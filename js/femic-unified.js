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
    ],
    receipt: [
      { id:'receipt_session', label:'Recibo de sessão', title:'RECIBO', body:function(ctx){ return 'Recebi de ' + ctx.name + ', em ' + ctx.dateBr + ', referente a atendimento fisioterapêutico realizado na FEMIC.\n\nPara maior clareza, firmo o presente recibo.'; } },
      { id:'receipt_package', label:'Recibo de pacote', title:'RECIBO', body:function(ctx){ return 'Recebi de ' + ctx.name + ', em ' + ctx.dateBr + ', referente a atendimentos fisioterapêuticos realizados na FEMIC.\n\nPara maior clareza, firmo o presente recibo.'; } }
    ]
  };

  var DOC_LABELS = {
    attendance: 'Atestado',
    declaration: 'Declaração',
    exam: 'Pedido de exame',
    report: 'Laudo',
    summary: 'Resumo evolutivo',
    receipt: 'Recibo'
  };

  var DOC_AI_PROMPTS = {
    attendance: [
      { label:'Comparecimento formal', prompt:'Gerar atestado de comparecimento formal, curto e objetivo, confirmando atendimento na data informada.' },
      { label:'Presença com contexto', prompt:'Gerar declaração de comparecimento com breve contexto fisioterapêutico e finalidade administrativa.' }
    ],
    declaration: [
      { label:'Acompanhamento em curso', prompt:'Redigir declaração formal informando que a paciente permanece em acompanhamento fisioterapêutico na FEMIC.' },
      { label:'Uso para trabalho', prompt:'Gerar declaração clínica formal para apresentação em ambiente de trabalho, com linguagem objetiva e profissional.' }
    ],
    exam: [
      { label:'Exame complementar', prompt:'Redigir pedido de exame complementar com justificativa técnica baseada no quadro funcional atual.' },
      { label:'Investigação clínica', prompt:'Gerar solicitação formal de exame para investigação do quadro, com hipótese clínica e justificativa objetiva.' }
    ],
    report: [
      { label:'Laudo funcional', prompt:'Elaborar laudo fisioterapêutico formal com histórico funcional, limitações atuais, impacto ocupacional e conclusão técnica.' },
      { label:'Laudo para afastamento', prompt:'Gerar laudo clínico formal para análise de afastamento temporário, com ênfase em limitações e incapacidade funcional atual.' }
    ],
    summary: [
      { label:'Resumo evolutivo', prompt:'Gerar resumo evolutivo claro, técnico e conciso com progresso, limitações persistentes e conduta atual.' },
      { label:'Síntese para prontuário', prompt:'Montar síntese técnica do acompanhamento fisioterapêutico para registro e compartilhamento clínico interno.' }
    ],
    receipt: [
      { label:'Recibo simples', prompt:'Redigir recibo fisioterapêutico formal, direto e profissional, pronto para assinatura.' },
      { label:'Recibo detalhado', prompt:'Gerar recibo com referência ao atendimento fisioterapêutico realizado e linguagem administrativa formal.' }
    ]
  };

  var runtime = {
    currentPatientId: '',
    patientExport: {
      patientId: '',
      appointments: [],
      htmlByType: { clinical:'', history:'' }
    },
    historyDataset: { source:'empty', patients:[], sessions:[] },
    clinicalCloud: {
      loadedPatientId: '',
      loadingPatientId: '',
      unavailable: false,
      anamneses: [],
      evolutions: []
    },
    historyYearsChart: null,
    historyPathologiesChart: null
  };

  function el(id){ return document.getElementById(id); }
  function escHtml(v){ return typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function clinicalUtils(){ return window.FEMICClinicalUtils || null; }
  function unifiedAppointmentsUtils(){ return window.FEMICUnifiedAppointmentsUtils || null; }
  function patientFichaUtils(){ return window.FEMICPatientFichaUtils || null; }
  function sortAppointmentsNewestFirst(list){
    var utils = unifiedAppointmentsUtils();
    if(utils && typeof utils.sortAppointmentsNewestFirst === 'function') return utils.sortAppointmentsNewestFirst(list);
    return (Array.isArray(list) ? list.slice() : []).sort(function(a,b){
      return (String(b && b.appointment_date || '') + String(b && b.start_time || '')).localeCompare(String(a && a.appointment_date || '') + String(a && a.start_time || ''));
    });
  }
  function getCompletedAgendaAppointmentsByPatient(pid){
    var utils = unifiedAppointmentsUtils();
    var appointments = getAgendaAppointmentsByPatient(pid);
    if(utils && typeof utils.getCompletedAgendaAppointmentsByPatient === 'function'){
      return utils.getCompletedAgendaAppointmentsByPatient(appointments, pid);
    }
    return sortAppointmentsNewestFirst(appointments.filter(function(item){ return item.status === 'concluido'; }));
  }
  function buildPatientAppointmentSnapshot(appointments, pid, todayIso){
    var utils = unifiedAppointmentsUtils();
    if(utils && typeof utils.buildPatientAppointmentSnapshot === 'function'){
      return utils.buildPatientAppointmentSnapshot(appointments, pid, todayIso);
    }
    var sortedAppointments = (appointments || []).filter(function(item){
      return String(item && item.patient_id) === String(pid);
    }).sort(function(a,b){
      return (String(a && a.appointment_date || '') + String(a && a.start_time || '')).localeCompare(String(b && b.appointment_date || '') + String(b && b.start_time || ''));
    });
    return {
      all: sortedAppointments,
      completed: sortAppointmentsNewestFirst(sortedAppointments.filter(function(item){ return item.status === 'concluido'; })),
      nextAppointments: sortedAppointments.filter(function(item){
        return ['agendado','confirmado'].indexOf(item.status) !== -1 && (!todayIso || String(item.appointment_date || '') >= String(todayIso));
      })
    };
  }
  function buildPatientPackageSummary(packages, appointments, todayPackageIso){
    if(!packages.length) return null;
    var item = packages[0];
    var service = window.serviceName ? serviceName(item.service_id) : 'Serviço';
    var total = Number(item.total_sessions || 0);
    var remaining = Number(item.remaining_sessions || 0);
    var used = Math.max(0, total - remaining);
    var pkgAppointments = appointments.filter(function(appt){ return String(appt.service_id) === String(item.service_id); });
    var futurePkg = pkgAppointments.filter(function(appt){
      return ['agendado','confirmado'].indexOf(appt.status) !== -1 && String(appt.appointment_date || '') >= todayPackageIso;
    }).sort(function(a,b){
      return String(a.appointment_date || '').localeCompare(String(b.appointment_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
    var missing = Math.max(0, remaining - futurePkg.length);
    return {
      label: service,
      used: used,
      total: total,
      remaining: remaining,
      alert: missing > 0 ? 'Faltam ' + missing + ' sessões sem agendamento' : 'Agenda do pacote em dia'
    };
  }
  function buildPatientFichaSummaryHtml(model, pid){
    if(!model) return '';
    var statusHtml = model.statusCards.map(function(item){
      return '<div class="kpi patient-ficha-status-card"><div class="small muted">' + escHtml(item.label) + '</div><strong>' + escHtml(item.value) + '</strong></div>';
    }).join('');
    var sectionsHtml = model.sections.map(function(section){
      return '<section class="hub-card patient-ficha-panel"><h4>' + escHtml(section.title) + '</h4><p class="muted small patient-ficha-body">' + escHtml(section.body) + '</p></section>';
    }).join('');
    return '<div class="patient-ficha-shell">' +
      '<section class="card patient-ficha-header-card">' +
        '<div class="patient-ficha-header-top">' +
          '<div>' +
            '<div class="eyebrow">Ficha do paciente</div>' +
            '<h3>' + escHtml(model.header.name) + '</h3>' +
          '</div>' +
          '<div class="patient-ficha-header-meta">' +
            '<span>' + escHtml(model.header.whatsapp) + '</span>' +
            '<span>' + escHtml(model.header.age) + '</span>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="patient-ficha-status-band">' + statusHtml + '</section>' +
      '<section class="patient-ficha-main">' + sectionsHtml + '</section>' +
      '<section class="patient-ficha-actions">' +
        '<button class="btn primary" onclick="openProntuarioPatient(\'' + escHtml(pid) + '\')">' + escHtml(model.secondaryActions[0].label) + '</button>' +
        '<button class="btn" onclick="openDocumentsPatient(\'' + escHtml(pid) + '\')">' + escHtml(model.secondaryActions[1].label) + '</button>' +
        '<button class="btn" onclick="openPatientClinicalExport(\'' + escHtml(pid) + '\')">' + escHtml(model.secondaryActions[2].label) + '</button>' +
      '</section>' +
    '</div>';
  }
  function safeExternalUrl(value){
    var url = String(value || '').trim();
    if(!url) return '';
    if(/^https:\/\//i.test(url)) return url;
    return '';
  }
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
      birth_date: String(raw.birth_date || raw.birthdate || raw.data_nascimento || '').slice(0,10),
      referral_source: String(raw.referral_source || raw.referral || raw.how_found || '').trim(),
      archived: raw.archived === true || raw.status === 'inativo' || raw.status === 'arquivado',
      archived_at: raw.archived_at || null,
      created_at: raw.created_at || new Date().toISOString()
    };
  }
  function normalizeAnamneseRecord(raw){
    raw = raw || {};
    return {
      id: String(raw.id || generateId('a')),
      patient_id: String(raw.patient_id || ''),
      chief_complaint: String(raw.chief_complaint || raw.chief || ''),
      history: String(raw.history || ''),
      diagnosis: String(raw.diagnosis || ''),
      limitations: String(raw.limitations || ''),
      goals: String(raw.goals || ''),
      obs: String(raw.obs || raw.observations || ''),
      occupation_routine: String(raw.occupation_routine || raw.ocupacao_rotina_trabalho || ''),
      physical_activity_context: String(raw.physical_activity_context || raw.atividade_fisica_relacao_com_quadro || ''),
      red_flags: String(raw.red_flags || raw.red_flags_check || ''),
      previous_treatments: String(raw.previous_treatments || raw.tratamentos_previos_e_percepcao || ''),
      psychosocial_factors: String(raw.psychosocial_factors || raw.fatores_psicossociais || ''),
      fear_avoidance: String(raw.fear_avoidance || raw.medos_e_evitacao || ''),
      clinical_summary: String(raw.clinical_summary || raw.sintese_clinica || ''),
      created_at: raw.created_at || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString()
    };
  }
  function normalizeEvolutionRecord(raw){
    raw = raw || {};
    return {
      id: String(raw.id || generateId('e')),
      patient_id: String(raw.patient_id || ''),
      date: String(raw.date || raw.created_at || todayIsoSafe()).slice(0,10),
      conduct: String(raw.conduct || raw.evolution || ''),
      guidance: String(raw.guidance || raw.orientations || ''),
      created_at: raw.created_at || new Date().toISOString()
    };
  }
  function isMissingClinicalTableError(err){
    return /clinical_anamneses|clinical_evolutions|column .* does not exist|relation .* does not exist|Could not find the table/i.test(String(err && err.message || err || ''));
  }
  function canUseCloudClinical(){
    return typeof api === 'function' && typeof base === 'function' && typeof key === 'function' && base() && key() && (!window.hasValidSession || hasValidSession()) && !runtime.clinicalCloud.unavailable;
  }
  async function fetchClinicalForPatient(pid){
    if(!pid || !canUseCloudClinical()) return false;
    if(runtime.clinicalCloud.loadedPatientId === String(pid) || runtime.clinicalCloud.loadingPatientId === String(pid)) return true;
    runtime.clinicalCloud.loadingPatientId = String(pid);
    try{
      var encodedPid = encodeURIComponent(String(pid));
      var rows = await Promise.all([
        api('clinical_anamneses?select=*&patient_id=eq.' + encodedPid + '&limit=1'),
        api('clinical_evolutions?select=*&patient_id=eq.' + encodedPid + '&order=date.desc,created_at.desc')
      ]);
      runtime.clinicalCloud.loadedPatientId = String(pid);
      runtime.clinicalCloud.anamneses = (rows[0] || []).map(normalizeAnamneseRecord);
      runtime.clinicalCloud.evolutions = (rows[1] || []).map(normalizeEvolutionRecord);
      runtime.clinicalCloud.loadingPatientId = '';
      renderUnifiedAll();
      return true;
    }catch(e){
      runtime.clinicalCloud.loadingPatientId = '';
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        if(typeof toast === 'function') toast('Tabelas clínicas em nuvem ainda não existem. Rode o SQL atualizado para sincronizar anamnese e evolução.', 'warning');
        return false;
      }
      throw e;
    }
  }
  function getLoadedCloudAnamnese(pid){
    if(runtime.clinicalCloud.loadedPatientId !== String(pid)) return null;
    return runtime.clinicalCloud.anamneses.find(function(item){ return String(item.patient_id) === String(pid); }) || null;
  }
  function getLoadedCloudEvolutions(pid){
    if(runtime.clinicalCloud.loadedPatientId !== String(pid)) return null;
    return runtime.clinicalCloud.evolutions.filter(function(item){ return String(item.patient_id) === String(pid); });
  }
  async function fetchClinicalBackupPayload(){
    if(!canUseCloudClinical()) return { anamneses:getAnamneses(), clinical_evolutions:getEvolutions(), cloud:false };
    try{
      var rows = await Promise.all([
        api('clinical_anamneses?select=*'),
        api('clinical_evolutions?select=*&order=date.desc,created_at.desc')
      ]);
      return {
        anamneses: (rows[0] || []).map(normalizeAnamneseRecord),
        clinical_evolutions: (rows[1] || []).map(normalizeEvolutionRecord),
        cloud: true
      };
    }catch(e){
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        return { anamneses:getAnamneses(), clinical_evolutions:getEvolutions(), cloud:false };
      }
      throw e;
    }
  }
  async function upsertCloudAnamneses(rows){
    rows = (rows || []).map(normalizeAnamneseRecord).filter(function(item){ return item.patient_id; });
    if(!rows.length || !canUseCloudClinical()) return [];
    var res = await fetch(base() + '/rest/v1/clinical_anamneses?on_conflict=patient_id', {
      method: 'POST',
      headers: Object.assign({}, headers(), { Prefer:'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows)
    });
    var txt = await res.text();
    var data; try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
    if(!res.ok) throw new Error((data && data.message) || txt || 'Erro ao salvar anamnese em nuvem');
    return data || [];
  }
  async function insertCloudEvolutions(rows){
    rows = (rows || []).map(normalizeEvolutionRecord).filter(function(item){ return item.patient_id && item.date; });
    if(!rows.length || !canUseCloudClinical()) return [];
    var res = await fetch(base() + '/rest/v1/clinical_evolutions?on_conflict=id', {
      method: 'POST',
      headers: Object.assign({}, headers(), { Prefer:'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows)
    });
    var txt = await res.text();
    var data; try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
    if(!res.ok) throw new Error((data && data.message) || txt || 'Erro ao salvar evoluções em nuvem');
    return data || [];
  }
  async function restoreClinicalToCloud(clinical, clearBefore){
    if(!canUseCloudClinical()) return false;
    try{
      if(clearBefore && typeof deleteAllRows === 'function'){
        await deleteAllRows('clinical_evolutions');
        await deleteAllRows('clinical_anamneses');
      }
      await upsertCloudAnamneses(clinical.anamneses || []);
      await insertCloudEvolutions(clinical.clinical_evolutions || clinical.evolutions || []);
      runtime.clinicalCloud.loadedPatientId = '';
      return true;
    }catch(e){
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        return false;
      }
      throw e;
    }
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
    var defaults = { professionalName:'FEMIC Fisioterapia', professionalNote:'', professionalCouncil:'', showStamp:'yes', logoData:'logo.png', signatureData:'', stampData:'' };
    try{
      var saved = JSON.parse(localStorage.getItem(STORAGE.documentSettings) || '{}') || {};
      var merged = Object.assign(defaults, saved);
      merged.professionalCouncil = merged.professionalCouncil || merged.professionalNote || '';
      merged.professionalNote = merged.professionalCouncil;
      return merged;
    }catch(e){
      return defaults;
    }
  }
  function saveDocumentSettings(obj){
    localStorage.setItem(STORAGE.documentSettings, JSON.stringify(Object.assign(getDocumentSettings(), obj || {})));
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
    if(window.syncPatientPickers) window.syncPatientPickers();
  }
  function getAnamneseByPatient(pid){
    return getLoadedCloudAnamnese(pid) || getAnamneses().find(function(item){ return String(item.patient_id) === String(pid); }) || null;
  }
  function getPatientSessions(pid){
    return getSessions().filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  }
  function getPatientEvolutions(pid){
    var cloud = getLoadedCloudEvolutions(pid);
    var list = cloud || getEvolutions().filter(function(item){ return String(item.patient_id) === String(pid); });
    return list.sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });
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
    return (getAgendaState().appointments || []).filter(function(item){ return String(item.patient_id) === String(pid); }).sort(function(a,b){
      return (String(a.appointment_date || '') + String(a.start_time || '')).localeCompare(String(b.appointment_date || '') + String(b.start_time || ''));
    });
  }
  async function fetchAllAppointmentsForPatient(pid){
    var fallback = getAgendaAppointmentsByPatient(pid);
    if(!pid) return fallback;
    if(typeof api !== 'function' || typeof base !== 'function' || typeof key !== 'function') return fallback;
    if(!base() || !key()) return fallback;
    if(window.hasValidSession && typeof hasValidSession === 'function' && !hasValidSession()) return fallback;
    try{
      var rows = await api('appointments?select=*&patient_id=eq.' + encodeURIComponent(pid) + '&order=appointment_date.asc,start_time.asc');
      return Array.isArray(rows) ? rows : fallback;
    }catch(e){
      console.error('FEMIC ficha: falha ao buscar histórico completo de agendamentos do paciente.', e);
      return fallback;
    }
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
      if(window.enhancePatientSelect) window.enhancePatientSelect(id);
    });
    if(runtime.currentPatientId){
      setCurrentPatient(runtime.currentPatientId);
    }
    if(window.syncPatientPickers) window.syncPatientPickers();
  }

  var ANAMNESE_FIELD_IDS = ['anamChief','anamHistory','anamDiagnosis','anamLimitations','anamGoals','anamObs'];
  function resetAnamneseFields(){
    ANAMNESE_FIELD_IDS.concat(['evolutionDate','evolutionConduct','evolutionGuidance']).forEach(function(id){
      if(el(id)) el(id).value = '';
    });
  }
  function fillSimpleAnamneseFields(anamnese){
    anamnese = anamnese || {};
    if(el('anamChief')) el('anamChief').value = anamnese.chief_complaint || '';
    if(el('anamHistory')) el('anamHistory').value = anamnese.history || '';
    if(el('anamDiagnosis')) el('anamDiagnosis').value = anamnese.diagnosis || anamnese.clinical_summary || '';
    if(el('anamLimitations')) el('anamLimitations').value = anamnese.limitations || anamnese.physical_activity_context || '';
    if(el('anamGoals')) el('anamGoals').value = anamnese.goals || '';
    if(el('anamObs')) el('anamObs').value = anamnese.obs || '';
  }
  function collectSimpleAnamneseFields(){
    return {
      chief_complaint: el('anamChief') ? String(el('anamChief').value || '').trim() : '',
      history: el('anamHistory') ? String(el('anamHistory').value || '').trim() : '',
      diagnosis: el('anamDiagnosis') ? String(el('anamDiagnosis').value || '').trim() : '',
      limitations: el('anamLimitations') ? String(el('anamLimitations').value || '').trim() : '',
      goals: el('anamGoals') ? String(el('anamGoals').value || '').trim() : '',
      obs: el('anamObs') ? String(el('anamObs').value || '').trim() : ''
    };
  }
  function patientAge(patient){
    var utils = clinicalUtils();
    if(!patient || !patient.birth_date || !utils || typeof utils.calculateAge !== 'function') return null;
    return utils.calculateAge(patient.birth_date);
  }
  function patientAgeSupportText(patient){
    var age = patientAge(patient);
    var utils = clinicalUtils();
    if(age == null || !utils || typeof utils.getAgeSupportNote !== 'function') return 'Sem data de nascimento. Cadastre se quiser apoio etário discreto.';
    return age + ' anos · ' + utils.getAgeSupportNote(age);
  }

  function resolveServiceName(serviceId){
    return window.serviceName ? serviceName(serviceId) : 'Serviço';
  }

  function getPatientFichaViewData(pid, appointments){
    var patient = getPatientById(pid);
    if(!patient) return null;
    appointments = Array.isArray(appointments) ? appointments : [];
    var evolutions = getPatientEvolutions(pid);
    var packages = getAgendaPackagesByPatient(pid);
    var anamnese = getAnamneseByPatient(pid);
    var age = patientAge(patient);
    var today = new Date();
    var todayPackageIso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var appointmentSnapshot = buildPatientAppointmentSnapshot(appointments, pid, todayPackageIso);
    var packageSummary = buildPatientPackageSummary(packages, appointments, todayPackageIso);
    var latestEvolution = evolutions[0] || null;
    var utils = patientFichaUtils();
    var input = {
      patient: patient,
      ageLabel: age != null ? String(age) + ' anos' : 'Não informada',
      nextAppointment: appointmentSnapshot.nextAppointments[0] ? {
        appointment_date: appointmentSnapshot.nextAppointments[0].appointment_date,
        start_time: appointmentSnapshot.nextAppointments[0].start_time,
        service_name: resolveServiceName(appointmentSnapshot.nextAppointments[0].service_id)
      } : null,
      completedCount: appointmentSnapshot.completed.length,
      packageSummary: packageSummary,
      anamnese: anamnese,
      latestEvolution: latestEvolution,
      formatDate: fmtDateSafe,
      formatWeekday: fmtWeekdaySafe,
      formatPhone: formatWhatsapp
    };
    var exportContext = utils && typeof utils.buildPatientFichaExportContext === 'function'
      ? utils.buildPatientFichaExportContext(input)
      : { summaryModel: utils && typeof utils.buildPatientFichaSummaryModel === 'function' ? utils.buildPatientFichaSummaryModel(input) : null };
    return {
      patient: patient,
      input: input,
      appointments: appointments,
      appointmentSnapshot: appointmentSnapshot,
      packageSummary: packageSummary,
      anamnese: anamnese || {},
      evolutions: evolutions,
      latestEvolution: latestEvolution,
      exportContext: exportContext || {},
      model: exportContext && exportContext.summaryModel ? exportContext.summaryModel : null
    };
  }

  function getPatientHistoryExportItemsForPatient(pid, appointments){
    var utils = unifiedAppointmentsUtils();
    if(utils && typeof utils.getPatientHistoryExportItems === 'function'){
      return utils.getPatientHistoryExportItems(appointments, pid, function(serviceId){
        return resolveServiceName(serviceId);
      });
    }
    return [];
  }

  function getPatientExportType(){
    return el('patientExportTypeHistory') && el('patientExportTypeHistory').checked ? 'history' : 'clinical';
  }

  function getClinicalExportDocumentStyles(){
    return [
      ':root{color-scheme:light;--clinical-navy:#0c355d;--clinical-cyan:#2497c8;--clinical-mint:#dff4f2;--clinical-ink:#1a3146;--clinical-muted:#6b7d8e;--clinical-line:rgba(12,53,93,.12);--clinical-bg:#edf5f8;--clinical-card:#ffffff;--clinical-success:#dff3e8;--clinical-danger:#fbe4e4;--clinical-info:#e3f0fb;}',
      '*{box-sizing:border-box}',
      'body{margin:0;font-family:Georgia,"Times New Roman",serif;color:var(--clinical-ink);background:linear-gradient(180deg,#f7fbfd 0%,var(--clinical-bg) 100%);padding:22px}',
      '.clinical-export-doc{max-width:920px;margin:0 auto;background:rgba(255,255,255,.96);border:1px solid var(--clinical-line);border-radius:28px;box-shadow:0 24px 60px rgba(12,53,93,.12);overflow:hidden}',
      '.clinical-export-header{padding:28px 30px 22px;background:linear-gradient(145deg,#ffffff 0%,#f1f8fb 58%,#eef9f7 100%);display:grid;gap:18px;border-bottom:1px solid var(--clinical-line)}',
      '.clinical-export-brand{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}',
      '.clinical-export-brand-mark{display:flex;align-items:center;gap:14px}',
      '.clinical-export-brand-seal{width:54px;height:54px;border-radius:18px;background:linear-gradient(135deg,var(--clinical-navy),#134d7f);color:#fff;display:grid;place-items:center;font-size:1.2rem;font-weight:700;letter-spacing:.08em;box-shadow:0 16px 30px rgba(12,53,93,.16)}',
      '.clinical-export-brand span{display:block;color:var(--clinical-cyan);font-size:.74rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase}',
      '.clinical-export-brand strong{display:block;margin-top:4px;color:var(--clinical-navy);font-size:1.2rem;line-height:1.2}',
      '.clinical-export-brand small{color:var(--clinical-muted);font-size:.88rem;line-height:1.5;text-align:right}',
      '.clinical-export-title{display:grid;gap:6px}',
      '.clinical-export-title .eyebrow{font-size:.75rem;letter-spacing:.22em;text-transform:uppercase;color:var(--clinical-cyan);font-weight:700}',
      '.clinical-export-title h2{margin:0;color:var(--clinical-navy);font-size:2rem;line-height:1.08;font-weight:700}',
      '.clinical-export-subtitle{margin:0;color:var(--clinical-muted);font-size:1rem;line-height:1.6}',
      '.clinical-export-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
      '.clinical-export-meta div,.clinical-export-summary-card{border:1px solid var(--clinical-line);border-radius:20px;padding:14px 16px;background:rgba(255,255,255,.72);backdrop-filter:blur(8px)}',
      '.clinical-export-meta strong,.clinical-export-field strong,.clinical-export-summary-card strong{display:block;color:var(--clinical-cyan);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;font-weight:700}',
      '.clinical-export-meta span{display:block;margin-top:8px;color:var(--clinical-navy);font-size:1rem;line-height:1.45}',
      '.clinical-export-body{padding:26px 30px 32px;display:grid;gap:18px}',
      '.clinical-export-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
      '.clinical-export-summary-card span{display:block;margin-top:6px;color:var(--clinical-navy);font-size:1.65rem;font-weight:700;line-height:1.05}',
      '.clinical-export-section{display:grid;gap:12px}',
      '.clinical-export-section-head{display:flex;justify-content:space-between;align-items:center;gap:12px}',
      '.clinical-export-section h3{margin:0;color:var(--clinical-navy);font-size:1.12rem;line-height:1.2}',
      '.clinical-export-section-note{color:var(--clinical-muted);font-size:.92rem;line-height:1.5}',
      '.clinical-export-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '.clinical-export-field,.clinical-export-block,.clinical-export-history-item{border:1px solid var(--clinical-line);border-radius:20px;background:var(--clinical-card);padding:16px 18px;box-shadow:0 10px 22px rgba(12,53,93,.05)}',
      '.clinical-export-field p,.clinical-export-block p{margin:8px 0 0;white-space:pre-wrap;line-height:1.7;font-size:.98rem;color:var(--clinical-ink)}',
      '.clinical-export-block h4{margin:0;color:var(--clinical-navy);font-size:1rem}',
      '.clinical-export-history-list{display:grid;gap:12px}',
      '.clinical-export-history-item{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start}',
      '.clinical-export-history-accent{width:14px;min-height:100%;border-radius:999px;background:linear-gradient(180deg,var(--clinical-cyan),#69c7cf)}',
      '.clinical-export-history-content{display:grid;gap:10px}',
      '.clinical-export-history-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}',
      '.clinical-export-history-title{color:var(--clinical-navy);font-size:1rem;font-weight:700;line-height:1.3}',
      '.clinical-export-status{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 12px;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}',
      '.clinical-export-status.success{background:var(--clinical-success);color:#19583c}',
      '.clinical-export-status.danger{background:var(--clinical-danger);color:#8a2f2f}',
      '.clinical-export-status.info{background:var(--clinical-info);color:#22547f}',
      '.clinical-export-status.neutral{background:#eef3f7;color:#496072}',
      '.clinical-export-history-meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--clinical-muted);font-size:.9rem;line-height:1.5}',
      '.clinical-export-pill{display:inline-flex;align-items:center;border-radius:999px;padding:7px 10px;background:#f3f8fb;border:1px solid rgba(12,53,93,.08)}',
      '.clinical-export-empty{padding:22px;border:1px dashed rgba(12,53,93,.2);border-radius:20px;background:rgba(255,255,255,.68);color:var(--clinical-muted);text-align:center;line-height:1.6}',
      '.clinical-export-days{list-style:none;margin:0;padding:0;display:grid;gap:10px}',
      '.clinical-export-days li{border:1px solid var(--clinical-line);border-radius:18px;padding:14px 16px;background:#fff;display:flex;justify-content:space-between;gap:12px;font-size:.95rem;line-height:1.45}',
      '.clinical-export-days strong{color:var(--clinical-navy)}',
      '.clinical-export-days span{color:var(--clinical-muted)}',
      '@media(max-width:900px){body{padding:14px}.clinical-export-doc{border-radius:24px}.clinical-export-header,.clinical-export-body{padding:20px}.clinical-export-meta,.clinical-export-grid,.clinical-export-summary-grid{grid-template-columns:1fr}.clinical-export-brand{display:grid}.clinical-export-brand small{text-align:left}.clinical-export-history-item{grid-template-columns:1fr}.clinical-export-history-accent{display:none}.clinical-export-days li{display:grid}}',
      '@media print{@page{size:A4;margin:14mm}body{padding:0;background:#fff}.clinical-export-doc{max-width:none;border:none;box-shadow:none;border-radius:0}.clinical-export-field,.clinical-export-block,.clinical-export-history-item,.clinical-export-summary-card,.clinical-export-meta div,.clinical-export-days li{box-shadow:none;break-inside:avoid}.clinical-export-header{background:#fff}}'
    ].join('');
  }

  function getPatientExportPayload(pid, appointments, includeDays){
    var exportType = getPatientExportType();
    var html = exportType === 'history'
      ? buildPatientHistoryExportHtml(pid, appointments)
      : buildPatientClinicalExportHtml(pid, includeDays, appointments);
    return {
      type: exportType,
      title: exportType === 'history' ? 'Histórico completo do paciente' : 'Ficha clínica do paciente',
      fileTitle: exportType === 'history' ? 'Histórico do paciente FEMIC' : 'Ficha clínica FEMIC',
      html: html
    };
  }

  function updatePatientExportControlState(exportType){
    var includeDaysRow = el('patientExportIncludeDaysRow');
    var note = el('patientExportNote');
    var title = el('patientExportPreviewTitle');
    var eyebrow = el('patientExportPreviewEyebrow');
    if(includeDaysRow) includeDaysRow.style.display = exportType === 'clinical' ? '' : 'none';
    if(note){
      note.textContent = exportType === 'history'
        ? 'A linha do tempo reúne todos os agendamentos do paciente em ordem cronológica, com serviço e status destacados.'
        : 'A ficha clínica reúne identificação, anamnese, evoluções e, opcionalmente, os atendimentos concluídos na agenda.';
    }
    if(title) title.textContent = exportType === 'history' ? 'Histórico completo do paciente' : 'Ficha clínica do paciente';
    if(eyebrow) eyebrow.textContent = exportType === 'history' ? 'Prévia do histórico' : 'Prévia da ficha';
  }

  function renderPatientExportDocument(html){
    var target = el('patientExportPreview');
    if(!target) return;
    target.innerHTML = html || '<div class="clinical-export-empty">Nenhum conteúdo disponível para pré-visualização.</div>';
  }

  function openPatientExportInWindow(payload, shouldPrint){
    if(!payload || !payload.html) return;
    var exportWindow = window.open('', '_blank', 'width=1080,height=820');
    if(!exportWindow) return;
    exportWindow.document.write('<html><head><title>' + payload.fileTitle + '</title><style>' + getClinicalExportDocumentStyles() + '</style></head><body>' + payload.html + '</body></html>');
    exportWindow.document.close();
    exportWindow.focus();
    if(shouldPrint){
      setTimeout(function(){ exportWindow.print(); }, 250);
    }
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
      resetAnamneseFields();
      return;
    }
    fetchClinicalForPatient(pid).catch(function(e){ if(typeof toast === 'function') toast('Erro ao carregar prontuário em nuvem: ' + e.message, 'error'); });
    var anamnese = getAnamneseByPatient(pid) || {};
    var evolutions = getPatientEvolutions(pid);
    var todayIso = todayIsoSafe();
    function paintProntuario(appointments){
      var snapshot = buildPatientAppointmentSnapshot(appointments, pid, todayIso);
      kpis.innerHTML =
        '<div class="kpi"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name) + '</strong></div>' +
        '<div class="kpi"><div class="small muted">Sessões realizadas</div><strong>' + snapshot.completed.length + '</strong></div>' +
        '<div class="kpi"><div class="small muted">Evoluções clínicas</div><strong>' + evolutions.length + '</strong></div>';
    }
    paintProntuario(getAgendaAppointmentsByPatient(pid));
    fillSimpleAnamneseFields(anamnese);
    if(el('evolutionDate') && !el('evolutionDate').value) el('evolutionDate').value = todayIsoSafe();

    var rows = [];
    evolutions.slice(0,4).forEach(function(item){
      rows.push({ date:item.date, html:'<strong>Evolução clínica</strong><div class="muted small">' + fmtDateSafe(item.date) + '</div><div class="muted small">' + escHtml(item.conduct || 'Sem registro') + '</div>' + (item.guidance ? '<div class="muted small">' + escHtml(item.guidance) + '</div>' : '') });
    });
    rows.sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });
    timeline.innerHTML = rows.length ? rows.map(function(item){ return '<div class="item">' + item.html + '</div>'; }).join('') : '<div class="muted">Ainda não há evoluções clínicas para este paciente.</div>';
    fetchAllAppointmentsForPatient(pid).then(function(fullAppointments){
      if(String(getSelectedPatientId()) !== String(pid)) return;
      paintProntuario(fullAppointments);
    }).catch(function(){});
  }

  function renderUnifiedDocuments(){
    var pid = getSelectedPatientId();
    var patient = getPatientById(pid);
    if(el('docDateInput') && !el('docDateInput').value) el('docDateInput').value = todayIsoSafe();
    var settings = getDocumentSettings();
    if(el('professionalNameInput') && !el('professionalNameInput').value) el('professionalNameInput').value = settings.professionalName || 'FEMIC Fisioterapia';
    if(el('professionalNoteInput') && !el('professionalNoteInput').value) el('professionalNoteInput').value = settings.professionalCouncil || settings.professionalNote || '';
    if(el('showStampSelect') && !el('showStampSelect').value) el('showStampSelect').value = settings.showStamp || 'yes';
    populateDocPresets();
    renderDocQuickModels();
    renderDocAiQuickPrompts();
    renderDocumentAssetPreviews();
    setDocumentStep(getDocumentStep());
    setDocAiStatus('Pronto para gerar. O texto entra no editor para revisão antes de salvar no histórico.', 'neutral');
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
      var url = safeExternalUrl(doc.drive_url);
      return '<div class="item"><div><strong>' + escHtml(doc.title || 'Documento') + '</strong><div class="muted small">' + escHtml(doc.category || 'Sem categoria') + (doc.obs ? ' · ' + escHtml(doc.obs) : '') + '</div></div><div class="toolbar">' + (url ? '<a class="btn" href="' + escHtml(url) + '" target="_blank" rel="noopener">Abrir</a>' : '<span class="muted small">Link inválido</span>') + '<button class="btn danger" onclick="deleteUnifiedPatientDocument(\'' + escHtml(doc.id) + '\')">Remover</button></div></div>';
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
      var guiaUrl = safeExternalUrl(g.drive_url);
      return '<div class="item"><div><strong>' + escHtml(g.convenio || 'Convênio') + '</strong><div class="muted small">Guia ' + escHtml(g.numero || '-') + ' · ' + used + '/' + auth + ' usadas · saldo ' + remaining + '</div></div><div class="toolbar">' + (guiaUrl ? '<a class="btn" href="' + escHtml(guiaUrl) + '" target="_blank" rel="noopener">Drive</a>' : '') + '<button class="btn danger" onclick="deleteUnifiedGuia(\'' + escHtml(g.id) + '\')">Remover</button></div></div>';
    }).join('') : '<div class="muted">Nenhuma guia cadastrada para este paciente.</div>';
  }

  function renderGeneratedDocumentsHistory(pid){
    var target = el('generatedDocumentsHistory');
    if(!target) return;
    pid = pid || getSelectedPatientId();
    var query = normalizeText(el('generatedDocSearch') ? el('generatedDocSearch').value : '');
    var typeFilter = el('generatedDocTypeFilter') ? el('generatedDocTypeFilter').value : '';
    var list = pid ? getGeneratedDocumentsByPatient(pid) : getGeneratedDocuments().slice().sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
    list = list.filter(function(doc){
      if(typeFilter && String(doc.type || '') !== typeFilter) return false;
      if(!query) return true;
      return normalizeText([doc.patient_name, doc.title, doc.type_label, doc.body, doc.date].join(' ')).indexOf(query) !== -1;
    }).slice(0, 80);
    target.innerHTML = list.length ? list.map(function(doc){
      var snippet = String(doc.body_text || '').trim();
      if(!snippet && doc.body){
        var box = document.createElement('div');
        box.innerHTML = doc.body;
        snippet = box.innerText || String(doc.body || '');
      }
      snippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 180);
      return '<div class="doc-history-card"><div class="doc-history-main"><span>' + escHtml(doc.type_label || doc.type || 'Documento') + '</span><strong>' + escHtml(doc.title || 'Documento') + '</strong><div class="muted small">' + escHtml(doc.patient_name || '-') + ' · ' + fmtDateSafe(doc.date) + '</div><p>' + escHtml(snippet || 'Sem texto salvo.') + '</p></div><div class="doc-history-actions"><button class="btn primary" onclick="openGeneratedDocument(\'' + escHtml(doc.id) + '\')">Consultar</button><button class="btn" onclick="duplicateGeneratedDocument(\'' + escHtml(doc.id) + '\')">Duplicar como novo</button><button class="btn danger" onclick="deleteGeneratedDocument(\'' + escHtml(doc.id) + '\')">Remover</button></div></div>';
    }).join('') : '<div class="muted">Nenhum documento salvo ainda.</div>';
  }

  function normalizeText(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function getDocumentStep(){
    var raw = Number(localStorage.getItem('femic_document_step') || 1);
    return raw >= 1 && raw <= 4 ? raw : 1;
  }

  function setDocumentStep(step){
    step = Math.max(1, Math.min(4, Number(step || 1)));
    localStorage.setItem('femic_document_step', String(step));
    var stage = el('panel-documentos');
    if(stage) stage.setAttribute('data-doc-step', String(step));
  }

  function getSelectedDocPreset(){
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var presetId = el('docPresetSelect') ? el('docPresetSelect').value : '';
    return (DOC_PRESETS[type] || []).find(function(item){ return item.id === presetId; }) || (DOC_PRESETS[type] || [])[0] || { title:'DOCUMENTO', label:'Documento' };
  }

  function renderDocQuickModels(){
    var target = el('docQuickModels');
    if(!target) return;
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var presetId = el('docPresetSelect') ? el('docPresetSelect').value : '';
    var items = DOC_PRESETS[type] || [];
    target.innerHTML = items.map(function(item){
      return '<button class="doc-quick-model ' + (item.id === presetId ? 'active' : '') + '" type="button" onclick="selectDocQuickModel(\'' + escHtml(item.id) + '\')"><strong>' + escHtml(item.label) + '</strong><span>' + escHtml(item.title || DOC_LABELS[type] || 'Documento') + '</span></button>';
    }).join('');
  }

  function getDocAiPromptSuggestions(){
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    return DOC_AI_PROMPTS[type] || DOC_AI_PROMPTS.attendance || [];
  }

  function renderDocAiQuickPrompts(){
    var target = el('docAiQuickPrompts');
    if(!target) return;
    var items = getDocAiPromptSuggestions();
    target.innerHTML = items.map(function(item, index){
      return '<button class="doc-ai-chip" type="button" onclick="applyDocAiPromptSuggestion(' + index + ')"><strong>' + escHtml(item.label) + '</strong><span>' + escHtml(item.prompt) + '</span></button>';
    }).join('');
  }

  function setDocAiStatus(message, tone){
    var target = el('docAiStatus');
    if(!target) return;
    target.textContent = message || 'Pronto para gerar. O texto entra no editor para revisão antes de salvar no histórico.';
    target.dataset.tone = tone || 'neutral';
  }

  function documentAssetPreviewMap(){
    return {
      logoData: 'docLogoPreview',
      signatureData: 'docSignaturePreview',
      stampData: 'docStampPreview'
    };
  }

  function renderDocumentAssetPreviews(){
    var settings = getDocumentSettings();
    var map = documentAssetPreviewMap();
    Object.keys(map).forEach(function(key){
      var img = el(map[key]);
      if(!img) return;
      var src = settings[key] || '';
      img.src = src || '';
      img.classList.toggle('empty', !src);
    });
  }

  function renderDocumentImage(src, className, alt){
    return src ? '<img class="' + className + '" src="' + escHtml(src) + '" alt="' + escHtml(alt || '') + '">' : '';
  }

  function textToDocumentHtml(text){
    return escHtml(text || '').replace(/\n/g, '<br>');
  }

  function sanitizeDocumentHtml(html){
    var box = document.createElement('div');
    box.innerHTML = String(html || '');
    box.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(function(node){ node.remove(); });
    box.querySelectorAll('*').forEach(function(node){
      var allowed = ['B','STRONG','I','EM','U','BR','P','DIV','SPAN','UL','OL','LI'];
      if(allowed.indexOf(node.tagName) === -1){
        node.replaceWith(document.createTextNode(node.textContent || ''));
        return;
      }
      Array.from(node.attributes).forEach(function(attr){
        if(attr.name !== 'style') node.removeAttribute(attr.name);
      });
      if(node.getAttribute('style')){
        var style = node.getAttribute('style');
        var keep = [];
        var align = style.match(/text-align\s*:\s*(left|right|center|justify)/i);
        var size = style.match(/font-size\s*:\s*(10pt|12pt|14pt|16pt|18pt)/i);
        var transform = style.match(/text-transform\s*:\s*uppercase/i);
        if(align) keep.push('text-align:' + align[1].toLowerCase());
        if(size) keep.push('font-size:' + size[1].toLowerCase());
        if(transform) keep.push('text-transform:uppercase');
        if(keep.length) node.setAttribute('style', keep.join(';'));
        else node.removeAttribute('style');
      }
    });
    return box.innerHTML.trim();
  }

  function looksLikeHtml(value){
    return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
  }

  function getDocumentBodyHtml(){
    var editor = el('docBodyEditor');
    if(editor) return sanitizeDocumentHtml(editor.innerHTML);
    var raw = el('docBodyInput') ? el('docBodyInput').value.trim() : '';
    return sanitizeDocumentHtml(looksLikeHtml(raw) ? raw : textToDocumentHtml(raw));
  }

  function getDocumentBodyText(){
    var editor = el('docBodyEditor');
    if(editor) return editor.innerText.trim();
    var raw = el('docBodyInput') ? el('docBodyInput').value.trim() : '';
    if(!looksLikeHtml(raw)) return raw;
    var box = document.createElement('div');
    box.innerHTML = raw;
    return box.innerText.trim();
  }

  function setDocumentBodyContent(value){
    var html = looksLikeHtml(value) ? sanitizeDocumentHtml(value) : textToDocumentHtml(value || '');
    if(el('docBodyEditor')) el('docBodyEditor').innerHTML = html;
    if(el('docBodyInput')) el('docBodyInput').value = html;
  }

  function insertDocumentHtmlAtCursor(html){
    var editor = el('docBodyEditor');
    if(!editor) return;
    editor.focus();
    try{
      if(document.queryCommandSupported && document.queryCommandSupported('insertHTML')){
        document.execCommand('insertHTML', false, html);
        return;
      }
    }catch(e){}
    var selection = window.getSelection();
    if(!selection || !selection.rangeCount){
      editor.innerHTML += html;
      return;
    }
    var range = selection.getRangeAt(0);
    if(!editor.contains(range.commonAncestorContainer)){
      editor.innerHTML += html;
      return;
    }
    range.deleteContents();
    var fragment = range.createContextualFragment(html);
    var lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if(lastNode){
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function normalizePastedDocumentText(text){
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[ \f\v]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeAiDocumentText(text){
    return String(text || '')
      .replace(/^```[a-z]*\s*/gim, '')
      .replace(/```$/gim, '')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function syncDocumentBodyInput(){
    if(el('docBodyEditor') && el('docBodyInput')){
      el('docBodyInput').value = getDocumentBodyHtml();
    }
  }

  window.syncDocumentEditorFromInput = function(){
    if(el('docBodyInput')) setDocumentBodyContent(el('docBodyInput').value || '');
  };

  window.clearDocumentAiPrompt = function(){
    if(el('docAiPromptInput')) el('docAiPromptInput').value = '';
    setDocAiStatus('Pedido limpo. Informe o que a IA deve redigir.', 'neutral');
  };

  window.applyDocAiPromptSuggestion = function(index){
    var items = getDocAiPromptSuggestions();
    var item = items[index];
    if(!item || !el('docAiPromptInput')) return;
    el('docAiPromptInput').value = item.prompt;
    setDocAiStatus('Sugestão aplicada. Ajuste o texto se precisar e gere o rascunho.', 'neutral');
  };

  function handleDocumentEditorPaste(event){
    var editor = el('docBodyEditor');
    if(!editor) return;
    event.preventDefault();
    var clipboard = event.clipboardData || window.clipboardData;
    var text = clipboard ? (clipboard.getData('text/plain') || '') : '';
    text = normalizePastedDocumentText(text);
    if(!text) return;
    insertDocumentHtmlAtCursor(textToDocumentHtml(text));
    syncDocumentBodyInput();
    renderUnifiedDocumentPreview();
  }

  function wrapDocumentSelection(styleText){
    var editor = el('docBodyEditor');
    if(!editor) return;
    editor.focus();
    var selection = window.getSelection();
    if(!selection || !selection.rangeCount) return;
    var range = selection.getRangeAt(0);
    if(!editor.contains(range.commonAncestorContainer)) return;
    var span = document.createElement('span');
    span.setAttribute('style', styleText);
    if(range.collapsed){
      span.appendChild(document.createTextNode('\u200b'));
      range.insertNode(span);
      range.setStart(span.firstChild, 1);
      range.collapse(true);
    }else{
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    syncDocumentBodyInput();
    renderUnifiedDocumentPreview();
  }

  window.formatDocumentBody = function(command, value){
    var editor = el('docBodyEditor');
    if(!editor) return;
    editor.focus();
    if(command === 'uppercase'){
      wrapDocumentSelection('text-transform:uppercase');
      return;
    }
    if(command === 'fontSize' && value){
      wrapDocumentSelection('font-size:' + value);
      return;
    }
    try{ document.execCommand(command, false, null); }catch(e){}
    syncDocumentBodyInput();
    renderUnifiedDocumentPreview();
  };

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
    renderDocQuickModels();
    renderDocAiQuickPrompts();
    renderUnifiedDocumentPreview();
  }

  function documentMetaHtml(type, patient, dateValue, ctx){
    if(type === 'receipt'){
      return '<div class="doc-meta doc-meta-receipt">' +
        '<div class="meta-box"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name || '-') + '</strong></div>' +
        '<div class="meta-box"><div class="small muted">Data</div><strong>' + escHtml(fmtDateSafe(dateValue)) + '</strong></div>' +
      '</div>';
    }
    return '<div class="doc-meta">' +
      '<div class="meta-box"><div class="small muted">Paciente</div><strong>' + escHtml(patient.name || '-') + '</strong></div>' +
      '<div class="meta-box"><div class="small muted">Data</div><strong>' + escHtml(fmtDateSafe(dateValue)) + '</strong></div>' +
      '<div class="meta-box"><div class="small muted">Patologia</div><strong>' + escHtml(patient.pathology || '-') + '</strong></div>' +
    '</div>';
  }

  function buildPremiumDocumentBrandHtml(settings, dateValue, type){
    var typeLabel = DOC_LABELS[type] || 'Documento';
    return '<div class="doc-brand">' +
      '<div class="doc-brand-main">' +
        '<div class="doc-brand-mark">' +
          '<div class="doc-brand-seal">F</div>' +
          '<div class="doc-brand-copy">' +
            '<span>FEMIC</span>' +
            '<strong>Fisioterapia Especializada</strong>' +
            ((settings.professionalCouncil || '') ? '<small>' + escHtml(settings.professionalCouncil) + '</small>' : '') +
          '</div>' +
        '</div>' +
        (settings.logoData ? '<div class="doc-brand-logo-wrap">' + renderDocumentImage(settings.logoData, 'doc-logo-img', 'Logo') + '</div>' : '') +
      '</div>' +
      '<div class="doc-brand-side">' +
        '<div class="doc-brand-pill">' + escHtml(typeLabel) + '</div>' +
        '<small>Emitido em ' + escHtml(fmtDateSafe(dateValue)) + '</small>' +
      '</div>' +
    '</div>';
  }

  function getPremiumDocumentSheetStyles(){
    return [
      '@page{size:A4;margin:16mm}',
      '*{box-sizing:border-box}',
      'body{margin:0;padding:22px;font-family:Georgia,"Times New Roman",serif;color:#193248;background:linear-gradient(180deg,#f7fbfd 0%,#eef6fa 100%)}',
      '.document-sheet{max-width:900px;margin:0 auto;background:rgba(255,255,255,.96);border:1px solid rgba(11,60,111,.14);border-radius:26px;box-shadow:0 22px 48px rgba(11,60,111,.10);padding:28px 30px 32px}',
      '.document-sheet-premium h2{margin:18px 0 14px;color:#0c355d;font-size:2rem;line-height:1.08}',
      '.doc-brand{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;padding-bottom:20px;margin-bottom:22px;border-bottom:1px solid rgba(11,60,111,.14)}',
      '.doc-brand-main{display:grid;gap:14px;min-width:0}',
      '.doc-brand-mark{display:flex;align-items:center;gap:14px}',
      '.doc-brand-seal{width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#0c355d,#134d7f);color:#fff;display:grid;place-items:center;font-size:1.3rem;font-weight:700;letter-spacing:.08em;box-shadow:0 16px 30px rgba(12,53,93,.18)}',
      '.doc-brand-copy{display:grid;gap:4px}',
      '.doc-brand-copy span{display:block;color:#2497c8;font-size:.74rem;font-weight:700;letter-spacing:.28em;text-transform:uppercase}',
      '.doc-brand-copy strong{display:block;color:#0c355d;font-size:1.25rem;line-height:1.15}',
      '.doc-brand-copy small,.doc-brand-side small{display:block;color:#6b7d8e;font-size:.88rem;line-height:1.5}',
      '.doc-brand-logo-wrap{display:flex;align-items:center}',
      '.doc-logo-img{max-width:260px;max-height:118px;object-fit:contain}',
      '.doc-brand-side{display:grid;gap:10px;justify-items:end;text-align:right}',
      '.doc-brand-pill{display:inline-flex;align-items:center;min-height:32px;padding:7px 11px;border-radius:999px;background:#e9f4fb;color:#0c355d;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}',
      '.doc-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:22px}',
      '.doc-meta-receipt{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.meta-box{border:1px solid rgba(11,60,111,.12);border-radius:18px;padding:13px 15px;background:linear-gradient(180deg,#fff,#f7fbfd)}',
      '.meta-box .small{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#2497c8}',
      '.meta-box strong{display:block;margin-top:8px;color:#0c355d;font-size:1rem;line-height:1.45}',
      '.doc-body{white-space:pre-wrap;line-height:1.72;font-size:12.2pt;min-height:310px;color:#193248}',
      '.doc-body p{margin:0 0 12px}',
      '.doc-sign{margin-top:34px;padding-top:18px;border-top:1px dashed rgba(11,60,111,.22);color:#64748b}',
      '.doc-sign-premium{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}',
      '.doc-signature-block{min-width:260px;text-align:center;color:#183043}',
      '.doc-signature-img{display:block;max-width:230px;max-height:92px;object-fit:contain;margin:0 auto 6px}',
      '.doc-sign-line{border-top:1px solid rgba(11,60,111,.34);margin:2px auto 8px;width:240px;max-width:100%}',
      '.doc-professional-name{display:block;color:#0c355d;font-size:11.5pt}',
      '.doc-professional-council{display:block;margin-top:3px;color:#64748b;font-size:10pt;font-weight:700}',
      '.doc-stamp-img{max-width:150px;max-height:150px;object-fit:contain;opacity:.92}',
      '@media(max-width:760px){body{padding:14px}.document-sheet{padding:18px;border-radius:22px}.doc-brand,.doc-sign-premium{display:grid}.doc-brand-side{justify-items:start;text-align:left}.doc-meta,.doc-meta-receipt{grid-template-columns:1fr}}',
      '@media print{body{padding:0;background:#fff}.document-sheet{max-width:none;border:none;box-shadow:none;border-radius:0;padding:0}}'
    ].join('');
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
    var settings = Object.assign(getDocumentSettings(), {
      professionalName: (el('professionalNameInput') && el('professionalNameInput').value.trim()) || 'FEMIC Fisioterapia',
      professionalCouncil: (el('professionalNoteInput') && el('professionalNoteInput').value.trim()) || '',
      showStamp: (el('showStampSelect') && el('showStampSelect').value) || 'yes'
    });
    settings.professionalNote = settings.professionalCouncil;
    saveDocumentSettings(settings);
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var preset = getSelectedDocPreset();
    var ctx = getDocumentContext(pid);
    var dateValue = el('docDateInput') ? el('docDateInput').value : todayIsoSafe();
    var body = getDocumentBodyHtml() || textToDocumentHtml('Use o botão "Gerar texto" para preencher um documento com base no contexto clínico do paciente.');
    preview.innerHTML =
      '<div class="document-sheet document-sheet-premium">' +
        buildPremiumDocumentBrandHtml(settings, dateValue, type) +
        '<h2>' + escHtml(preset.title || 'DOCUMENTO') + '</h2>' +
        documentMetaHtml(type, patient, dateValue, ctx) +
        '<div class="doc-body">' + body + '</div>' +
        '<div class="doc-sign doc-sign-premium"><div class="doc-signature-block">' + renderDocumentImage(settings.signatureData, 'doc-signature-img', 'Assinatura') + '<div class="doc-sign-line"></div><strong class="doc-professional-name">' + escHtml(settings.professionalName) + '</strong>' + (settings.professionalCouncil ? '<span class="doc-professional-council">' + escHtml(settings.professionalCouncil) + '</span>' : '') + '</div>' + (settings.showStamp === 'yes' ? renderDocumentImage(settings.stampData, 'doc-stamp-img', 'Carimbo') : '') + '</div>' +
      '</div>';
  }

  function renderSavedDocumentSheet(doc){
    var settings = getDocumentSettings();
    var patient = getPatientById(doc.patient_id) || { name: doc.patient_name || 'Paciente', pathology: '' };
    var body = doc.body ? sanitizeDocumentHtml(doc.body) : textToDocumentHtml(doc.body_text || 'Sem texto salvo.');
    var title = doc.title || doc.type_label || 'DOCUMENTO';
    var ctx = getDocumentContext(doc.patient_id);
    return '<div class="document-sheet document-sheet-premium">' +
      buildPremiumDocumentBrandHtml(settings, doc.date, doc.type) +
      '<h2>' + escHtml(title) + '</h2>' +
      documentMetaHtml(doc.type, patient, doc.date, ctx) +
      '<div class="doc-body">' + body + '</div>' +
      '<div class="doc-sign doc-sign-premium"><div class="doc-signature-block">' + renderDocumentImage(settings.signatureData, 'doc-signature-img', 'Assinatura') + '<div class="doc-sign-line"></div><strong class="doc-professional-name">' + escHtml(settings.professionalName || 'FEMIC Fisioterapia') + '</strong>' + (settings.professionalCouncil ? '<span class="doc-professional-council">' + escHtml(settings.professionalCouncil) + '</span>' : '') + '</div>' + (settings.showStamp === 'yes' ? renderDocumentImage(settings.stampData, 'doc-stamp-img', 'Carimbo') : '') + '</div>' +
    '</div>';
  }

  async function saveGeneratedDocumentToCloud(doc){
    if(typeof api !== 'function' || !base() || !key()) return { skipped:true };
    try{
      var payload = {
        id: doc.id,
        patient_id: doc.patient_id,
        patient_name: doc.patient_name,
        document_type: doc.type,
        document_title: doc.title,
        document_body: doc.body,
        document_date: doc.date,
        rendered_html: doc.body,
        metadata: { body_text: doc.body_text || '', local_id: doc.id },
        source: 'femic_unified'
      };
      try{
        await api('femic_generated_documents', {
          method:'POST',
          body:JSON.stringify(payload)
        });
      }catch(firstError){
        if(!/uuid|invalid input syntax/i.test(String(firstError && firstError.message || ''))) throw firstError;
        delete payload.id;
        await api('femic_generated_documents', {
          method:'POST',
          body:JSON.stringify(payload)
        });
      }
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

  async function offerLocalClinicalMigration(){
    if(localStorage.getItem('femic_clinical_cloud_migration_done') === 'yes') return;
    if(!canUseCloudClinical()) return;
    var localAnamneses = getAnamneses().map(normalizeAnamneseRecord).filter(function(item){ return item.patient_id; });
    var localEvolutions = getEvolutions().map(normalizeEvolutionRecord).filter(function(item){ return item.patient_id; });
    if(!localAnamneses.length && !localEvolutions.length){
      localStorage.setItem('femic_clinical_cloud_migration_done', 'yes');
      return;
    }
    if(!confirm('Encontrei anamnese/evoluções antigas salvas neste navegador. Migrar esses dados para o Supabase para usar em outros dispositivos?')) return;
    try{
      await upsertCloudAnamneses(localAnamneses);
      await insertCloudEvolutions(localEvolutions);
      localStorage.setItem('femic_clinical_cloud_migration_done', 'yes');
      runtime.clinicalCloud.loadedPatientId = '';
      if(typeof toast === 'function') toast('Prontuário local migrado para o Supabase.', 'success');
      renderUnifiedAll();
    }catch(e){
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        if(typeof toast === 'function') toast('Para migrar o prontuário, rode primeiro o SQL atualizado no Supabase.', 'warning');
        return;
      }
      if(typeof toast === 'function') toast('Erro ao migrar prontuário local: ' + e.message, 'error');
    }
  }

  function renderUnifiedAll(){
    populateUnifiedPatientSelects();
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

  async function buildUnifiedBackupPayload(){
    var agenda = getAgendaState();
    var tables = {
      patients: agenda.patients || [],
      health_insurances: agenda.payers || [],
      services: agenda.services || [],
      schedule_settings: agenda.settings && agenda.settings.id ? [agenda.settings] : (agenda.settings ? [agenda.settings] : []),
      clinic_rules: agenda.clinicRules || [],
      session_packages: agenda.packages || [],
      appointments: agenda.appointments || [],
      session_movements: agenda.movements || []
    };
    if(typeof fetchTableForBackup === 'function' && typeof loadClinicRulesCollection === 'function' && base() && key() && (!window.hasValidSession || hasValidSession())){
      tables = {
        patients: await fetchTableForBackup('patients'),
        health_insurances: await fetchTableForBackup('health_insurances'),
        services: await fetchTableForBackup('services'),
        schedule_settings: await fetchTableForBackup('schedule_settings'),
        clinic_rules: await loadClinicRulesCollection(),
        session_packages: await fetchTableForBackup('session_packages'),
        appointments: await fetchTableForBackup('appointments'),
        session_movements: await fetchTableForBackup('session_movements')
      };
    }
    var cloudClinical = await fetchClinicalBackupPayload();
    return {
      app: 'FEMIC Unified',
      version: 'v1-unified-index',
      exported_at: new Date().toISOString(),
      note: 'Backup unificado com agenda, prontuário, documentos e histórico clínico da FEMIC.',
      tables: tables,
      clinical: {
        sessions: getSessions(),
        anamneses: cloudClinical.anamneses,
        clinical_evolutions: cloudClinical.clinical_evolutions,
        patient_documents: getPatientDocuments(),
        generated_documents: getGeneratedDocuments(),
        guias: getGuias(),
        source: cloudClinical.cloud ? 'supabase' : 'local'
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
        var payload = await buildUnifiedBackupPayload();
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
        var restoredClinicalCloud = await restoreClinicalToCloud(clinical, !!tables);
        if(!restoredClinicalCloud && Array.isArray(clinical.anamneses)) saveAnamneses(clinical.anamneses);
        if(!restoredClinicalCloud && Array.isArray(clinical.clinical_evolutions)) saveEvolutions(clinical.clinical_evolutions);
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

    window.runAnnualOperationalReset = async function(){
      if(!base() || !key()){
        if(typeof toast === 'function') toast('Preencha URL e anon key antes do reset anual.', 'warning');
        return;
      }
      var typed = prompt('Antes do reset, o sistema exportará um backup JSON completo. Depois apagará agenda, pacotes, movimentos, anamnese e evoluções, preservando pacientes, serviços, pagadores e configurações. Digite RESET para confirmar.');
      if(typed !== 'RESET') return;
      try{
        if(typeof toast === 'function') toast('Exportando backup completo antes do reset...', 'info');
        var payload = await buildUnifiedBackupPayload();
        if(typeof downloadJsonFile === 'function'){
          downloadJsonFile('femic_backup_pre_reset_' + todayIsoSafe().replace(/-/g, '') + '.json', payload);
        }
        if(typeof toast === 'function') toast('Limpando dados operacionais do ano...', 'info');
        await deleteAllRows('session_movements');
        await deleteAllRows('appointments');
        await deleteAllRows('session_packages');
        try{ await deleteAllRows('clinical_evolutions'); }catch(e){ if(!isMissingClinicalTableError(e)) throw e; }
        try{ await deleteAllRows('clinical_anamneses'); }catch(e){ if(!isMissingClinicalTableError(e)) throw e; }
        saveSessions([]);
        saveAnamneses([]);
        saveEvolutions([]);
        runtime.clinicalCloud.loadedPatientId = '';
        runtime.clinicalCloud.anamneses = [];
        runtime.clinicalCloud.evolutions = [];
        await loadAll(true);
        renderUnifiedAll();
        if(typeof toast === 'function') toast('Reset anual concluído. Pacientes, serviços, pagadores e configurações foram preservados.', 'success');
      }catch(e){
        console.error(e);
        if(typeof toast === 'function') toast('Erro no reset anual: ' + e.message, 'error');
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

  window.saveUnifiedAnamnese = async function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var now = new Date().toISOString();
    var list = getAnamneses();
    var existing = getAnamneseByPatient(pid);
    var fields = collectSimpleAnamneseFields();
    var payload = {
      id: existing && existing.id ? existing.id : generateId('a'),
      patient_id: pid,
      chief_complaint: fields.chief_complaint || '',
      history: fields.history || '',
      diagnosis: fields.diagnosis || '',
      limitations: fields.limitations || '',
      goals: fields.goals || '',
      obs: fields.obs || '',
      occupation_routine: existing && existing.occupation_routine ? existing.occupation_routine : '',
      physical_activity_context: existing && existing.physical_activity_context ? existing.physical_activity_context : '',
      red_flags: existing && existing.red_flags ? existing.red_flags : '',
      previous_treatments: existing && existing.previous_treatments ? existing.previous_treatments : '',
      psychosocial_factors: existing && existing.psychosocial_factors ? existing.psychosocial_factors : '',
      fear_avoidance: existing && existing.fear_avoidance ? existing.fear_avoidance : '',
      clinical_summary: fields.diagnosis || (existing && existing.clinical_summary ? existing.clinical_summary : ''),
      created_at: existing && existing.created_at ? existing.created_at : now,
      updated_at: now
    };
    try{
      if(canUseCloudClinical()){
        var saved = await upsertCloudAnamneses([payload]);
        runtime.clinicalCloud.loadedPatientId = String(pid);
        runtime.clinicalCloud.anamneses = (saved && saved.length ? saved : [payload]).map(normalizeAnamneseRecord);
        renderUnifiedAll();
        if(typeof toast === 'function') toast('Anamnese salva no Supabase.', 'success');
        return;
      }
      var index = list.findIndex(function(item){ return String(item.patient_id) === String(pid); });
      if(index >= 0) list[index] = payload; else list.push(payload);
      saveAnamneses(list);
      if(typeof toast === 'function') toast('Anamnese salva localmente.', 'warning');
    }catch(e){
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        var localIndex = list.findIndex(function(item){ return String(item.patient_id) === String(pid); });
        if(localIndex >= 0) list[localIndex] = payload; else list.push(payload);
        saveAnamneses(list);
        if(typeof toast === 'function') toast('Anamnese salva localmente. Rode o SQL atualizado para ativar nuvem.', 'warning');
        return;
      }
      if(typeof toast === 'function') toast('Erro ao salvar anamnese: ' + e.message, 'error');
    }
  };

  window.saveUnifiedEvolution = async function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var list = getEvolutions();
    var payload = {
      id: generateId('e'),
      patient_id: pid,
      date: el('evolutionDate') && el('evolutionDate').value ? el('evolutionDate').value : todayIsoSafe(),
      conduct: el('evolutionConduct') ? el('evolutionConduct').value.trim() : '',
      guidance: el('evolutionGuidance') ? el('evolutionGuidance').value.trim() : '',
      created_at: new Date().toISOString()
    };
    try{
      if(canUseCloudClinical()){
        var saved = await insertCloudEvolutions([payload]);
        runtime.clinicalCloud.loadedPatientId = String(pid);
        runtime.clinicalCloud.evolutions = (saved || [payload]).concat(runtime.clinicalCloud.evolutions || []).map(normalizeEvolutionRecord).sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });
        if(typeof toast === 'function') toast('Evolução clínica salva no Supabase.', 'success');
      }else{
        list.push(payload);
        saveEvolutions(list);
        if(typeof toast === 'function') toast('Evolução clínica salva localmente.', 'warning');
      }
      if(el('evolutionDate')) el('evolutionDate').value = todayIsoSafe();
      if(el('evolutionConduct')) el('evolutionConduct').value = '';
      if(el('evolutionGuidance')) el('evolutionGuidance').value = '';
      renderUnifiedAll();
    }catch(e){
      if(isMissingClinicalTableError(e)){
        runtime.clinicalCloud.unavailable = true;
        list.push(payload);
        saveEvolutions(list);
        if(typeof toast === 'function') toast('Evolução salva localmente. Rode o SQL atualizado para ativar nuvem.', 'warning');
        return;
      }
      if(typeof toast === 'function') toast('Erro ao salvar evolução: ' + e.message, 'error');
    }
  };

  window.generateUnifiedDocument = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var preset = getSelectedDocPreset();
    if(!preset){
      if(typeof toast === 'function') toast('Nenhum modelo disponível para este tipo.', 'warning');
      return;
    }
    var ctx = getDocumentContext(pid);
    setDocumentBodyContent(preset.body(ctx));
    renderUnifiedDocumentPreview();
    setDocumentStep(3);
    if(typeof toast === 'function') toast('Documento gerado a partir do contexto do paciente.', 'success');
  };

  window.generateUnifiedDocumentWithAI = async function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var prompt = el('docAiPromptInput') ? String(el('docAiPromptInput').value || '').trim() : '';
    if(!prompt){
      setDocAiStatus('Informe no campo o que a IA deve redigir para este documento.', 'warning');
      if(typeof toast === 'function') toast('Descreva primeiro o documento que a IA deve escrever.', 'warning');
      return;
    }
    if(!window.FEMICClinicalAI || typeof window.FEMICClinicalAI.generateDocumentDraft !== 'function'){
      setDocAiStatus('A IA clínica não está disponível na página. Atualize o sistema.', 'error');
      if(typeof toast === 'function') toast('A IA clínica ainda não foi carregada nesta tela.', 'warning');
      return;
    }
    var button = el('docAiGenerateBtn');
    var patient = getPatientById(pid) || {};
    var preset = getSelectedDocPreset();
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var dateValue = el('docDateInput') ? el('docDateInput').value : todayIsoSafe();
    var ctx = getDocumentContext(pid);
    if(button) button.disabled = true;
    setDocAiStatus('Gerando rascunho com IA...', 'loading');
    try{
      var result = await window.FEMICClinicalAI.generateDocumentDraft({
        patient: patient,
        context: ctx,
        documentType: type,
        documentTypeLabel: DOC_LABELS[type] || preset.title || 'Documento',
        documentTitle: preset.title || 'DOCUMENTO',
        documentModelLabel: preset.label || '',
        documentDate: fmtDateSafe(dateValue),
        baseText: getDocumentBodyText(),
        userPrompt: prompt
      });
      var cleanText = normalizeAiDocumentText(result.draft);
      if(!cleanText) throw new Error('A IA retornou um rascunho vazio.');
      setDocumentBodyContent(cleanText);
      renderUnifiedDocumentPreview();
      setDocumentStep(3);
      var providerName = window.FEMICClinicalAI.providerLabel ? window.FEMICClinicalAI.providerLabel(result.provider) : result.provider;
      setDocAiStatus('Rascunho gerado via ' + providerName + '. Revise o texto no editor e salve no histórico quando estiver pronto.', 'success');
      if(typeof toast === 'function') toast('Rascunho do documento gerado com IA.', 'success');
    }catch(e){
      setDocAiStatus('Falha ao gerar com IA: ' + ((e && e.message) || 'erro desconhecido'), 'error');
      if(typeof toast === 'function') toast('Não foi possível gerar o documento com IA: ' + ((e && e.message) || 'erro desconhecido'), 'error');
    }finally{
      if(button) button.disabled = false;
    }
  };

  window.saveGeneratedDocument = async function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var patient = getPatientById(pid);
    var type = el('docTypeSelect') ? el('docTypeSelect').value : 'attendance';
    var preset = getSelectedDocPreset();
    var entry = {
      id: generateId('gd'),
      patient_id: pid,
      patient_name: patient ? patient.name : 'Paciente',
      type: type,
      type_label: preset.title || 'DOCUMENTO',
      title: preset.title || 'DOCUMENTO',
      body: getDocumentBodyHtml(),
      body_text: getDocumentBodyText(),
      date: el('docDateInput') && el('docDateInput').value ? el('docDateInput').value : todayIsoSafe(),
      created_at: new Date().toISOString()
    };
    var list = getGeneratedDocuments();
    list.unshift(entry);
    saveGeneratedDocuments(list.slice(0, 120));
    var cloudResult = await saveGeneratedDocumentToCloud(entry);
    renderGeneratedDocumentsHistory(pid);
    setDocumentStep(4);
    if(typeof toast === 'function'){
      var msg = 'Documento salvo no histórico.';
      if(cloudResult.ok === false){
        msg = 'Documento salvo localmente. Nuvem não salvou: ' + ((cloudResult.error && cloudResult.error.message) || 'verifique a tabela femic_generated_documents.');
      }
      toast(msg, cloudResult.ok === false ? 'warning' : 'success');
    }
  };

  window.printUnifiedDocument = function(){
    renderUnifiedDocumentPreview();
    var preview = el('documentPreview');
    if(!preview) return;
    var printWindow = window.open('', '_blank', 'width=900,height=700');
    if(!printWindow) return;
    printWindow.document.write('<html><head><title>Documento FEMIC</title><style>' + getPremiumDocumentSheetStyles() + '</style></head><body>' + preview.innerHTML + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function(){ printWindow.print(); }, 300);
  };

  window.saveUnifiedPatientDocument = function(){
    var pid = ensurePatientSelected();
    if(!pid) return;
    var title = el('patientDocumentTitle') ? el('patientDocumentTitle').value.trim() : '';
    var category = el('patientDocumentCategory') ? el('patientDocumentCategory').value.trim() : '';
    var driveUrl = safeExternalUrl(el('patientDocumentUrl') ? el('patientDocumentUrl').value : '');
    var obs = el('patientDocumentObs') ? el('patientDocumentObs').value.trim() : '';
    if(!title || !driveUrl){
      if(typeof toast === 'function') toast('Informe título e um link https:// válido do documento.', 'warning');
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
    var guiaUrl = safeExternalUrl(el('guiaDriveUrl') ? el('guiaDriveUrl').value : '');
    if((el('guiaDriveUrl') && el('guiaDriveUrl').value.trim()) && !guiaUrl){
      if(typeof toast === 'function') toast('Informe um link https:// válido para a guia, ou deixe em branco.', 'warning');
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
      drive_url: guiaUrl,
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

  window.openGeneratedDocument = function(documentId){
    var doc = getGeneratedDocuments().find(function(item){ return String(item.id) === String(documentId); });
    if(!doc) return;
    var title = el('generatedDocumentModalTitle');
    var body = el('generatedDocumentModalBody');
    var modal = el('generatedDocumentModal');
    if(title) title.textContent = doc.title || doc.type_label || 'Consulta do documento';
    if(body) body.innerHTML = renderSavedDocumentSheet(doc);
    if(modal) modal.classList.add('show');
  };

  window.printGeneratedDocumentFromModal = function(){
    var body = el('generatedDocumentModalBody');
    if(!body || !body.innerHTML.trim()) return;
    var printWindow = window.open('', '_blank', 'width=900,height=700');
    if(!printWindow) return;
    printWindow.document.write('<html><head><title>Documento FEMIC</title><style>' + getPremiumDocumentSheetStyles() + '</style></head><body>' + body.innerHTML + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function(){ printWindow.print(); }, 300);
  };

  window.loadGeneratedDocument = function(documentId){
    var doc = getGeneratedDocuments().find(function(item){ return String(item.id) === String(documentId); });
    if(!doc) return;
    setCurrentPatient(doc.patient_id);
    if(typeof showPanel === 'function') showPanel('documentos');
    setDocumentBodyContent(doc.body || doc.body_text || '');
    if(el('docDateInput')) el('docDateInput').value = doc.date || todayIsoSafe();
    if(el('docTypeSelect')) el('docTypeSelect').value = doc.type || 'attendance';
    populateDocPresets();
    setDocumentStep(4);
    renderUnifiedAll();
  };

  window.duplicateGeneratedDocument = function(documentId){
    var doc = getGeneratedDocuments().find(function(item){ return String(item.id) === String(documentId); });
    if(!doc) return;
    setCurrentPatient(doc.patient_id);
    if(typeof showPanel === 'function') showPanel('documentos');
    setDocumentBodyContent(doc.body || doc.body_text || '');
    if(el('docDateInput')) el('docDateInput').value = todayIsoSafe();
    if(el('docTypeSelect')) el('docTypeSelect').value = doc.type || 'attendance';
    populateDocPresets();
    setDocumentStep(3);
    renderUnifiedAll();
    if(typeof toast === 'function') toast('Documento duplicado como novo rascunho. O original foi preservado.', 'success');
  };

  window.selectDocQuickModel = function(type){
    if(el('docPresetSelect')) el('docPresetSelect').value = type || '';
    renderDocQuickModels();
    renderUnifiedDocumentPreview();
    setDocumentStep(2);
  };

  window.handleDocumentAssetUpload = function(keyName, input){
    var file = input && input.files && input.files[0];
    if(!file) return;
    if(file.type !== 'image/png'){
      if(typeof toast === 'function') toast('Use uma imagem PNG para logo, assinatura ou carimbo.', 'warning');
      input.value = '';
      return;
    }
    if(file.size > 1500 * 1024){
      if(typeof toast === 'function') toast('Imagem muito grande. Use PNG com até 1,5 MB para não pesar o sistema.', 'warning');
      input.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var patch = {};
        patch[keyName] = String(reader.result || '');
        saveDocumentSettings(patch);
        renderDocumentAssetPreviews();
        renderUnifiedDocumentPreview();
        if(typeof toast === 'function') toast('Imagem do documento salva.', 'success');
      }catch(e){
        if(typeof toast === 'function') toast('Não foi possível salvar a imagem. Tente um arquivo menor.', 'error');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  window.clearDocumentAsset = function(keyName){
    var patch = {};
    patch[keyName] = '';
    saveDocumentSettings(patch);
    renderDocumentAssetPreviews();
    renderUnifiedDocumentPreview();
    if(typeof toast === 'function') toast('Imagem removida da identidade do documento.', 'info');
  };

  window.setDocumentStep = setDocumentStep;
  window.renderUnifiedDocumentPreview = renderUnifiedDocumentPreview;
  window.renderGeneratedDocumentsHistory = function(){ renderGeneratedDocumentsHistory(getSelectedPatientId()); };

  window.deleteGeneratedDocument = function(documentId){
    if(!confirm('Remover este documento do histórico?')) return;
    saveGeneratedDocuments(getGeneratedDocuments().filter(function(item){ return String(item.id) !== String(documentId); }));
    if(typeof toast === 'function') toast('Documento removido do histórico.', 'warning');
  };

  window.loadHistoryFromCurrentState = function(){
    var evolutionSessions = getEvolutions().map(function(item){
      item = normalizeEvolutionRecord(item);
      return normalizeSessionRecord({ id:'hist-' + item.id, patient_id:item.patient_id, date:item.date, obs:item.conduct, source:'evolution', created_at:item.created_at });
    });
    setHistoryDataset('current', getPatients(), getSessions().concat(evolutionSessions));
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
      var sessions = (clinical.sessions || []).map(normalizeSessionRecord);
      var evolutionSessions = (clinical.clinical_evolutions || []).map(function(item){
        item = normalizeEvolutionRecord(item);
        return normalizeSessionRecord({ id:'hist-' + item.id, patient_id:item.patient_id, date:item.date, obs:item.conduct, source:'evolution', created_at:item.created_at });
      });
      setHistoryDataset('backup', patients, sessions.concat(evolutionSessions));
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

  function buildPatientClinicalExportHtml(pid, includeDays, appointments){
    var patient = getPatientById(pid);
    if(!patient) return '';
    appointments = Array.isArray(appointments) ? appointments : getAgendaAppointmentsByPatient(pid);
    var fichaData = getPatientFichaViewData(pid, appointments);
    if(!fichaData) return '';
    var anamnese = fichaData.anamnese || {};
    var evolutions = fichaData.evolutions || [];
    var completedAppointments = fichaData.appointmentSnapshot && Array.isArray(fichaData.appointmentSnapshot.completed) ? fichaData.appointmentSnapshot.completed : [];
    var daysHtml = includeDays
      ? (completedAppointments.length
        ? completedAppointments.map(function(item){
            return '<li><strong>' + escHtml(fmtDateSafe(item.appointment_date)) + '</strong><span>' + escHtml(fmtWeekdaySafe(item.appointment_date) + ' · ' + String(item.start_time || '').slice(0,5) + ' · ' + resolveServiceName(item.service_id)) + '</span></li>';
          }).join('')
        : '<li>Nenhum atendimento concluído na agenda.</li>')
      : '';
    var evolutionHtml = evolutions.length
      ? evolutions.map(function(item){
          return '<article class="clinical-export-block"><h4>' + escHtml(fmtDateSafe(item.date)) + '</h4><p><strong>Evolução:</strong> ' + escHtml(item.conduct || 'Sem registro') + '</p><p><strong>Orientações:</strong> ' + escHtml(item.guidance || 'Sem orientações registradas') + '</p></article>';
        }).join('')
      : '<div class="clinical-export-empty">Nenhuma evolução clínica cadastrada.</div>';
    return '' +
      '<div class="clinical-export-doc">' +
        '<header class="clinical-export-header">' +
          '<div class="clinical-export-brand"><div class="clinical-export-brand-mark"><div class="clinical-export-brand-seal">F</div><div><span>FEMIC</span><strong>Fisioterapia Especializada</strong></div></div><small>Ficha clínica do paciente<br>Emitida em ' + escHtml(fmtDateSafe(todayIsoSafe())) + '</small></div>' +
          '<div class="clinical-export-title"><div class="eyebrow">Ficha F</div><h2>Ficha clínica do paciente</h2><p class="clinical-export-subtitle">Documento clínico consolidado com contexto funcional, evolução recente e visão rápida do acompanhamento.</p></div>' +
          '<div class="clinical-export-meta"><div><strong>Paciente</strong><span>' + escHtml(patient.name || '-') + '</span></div><div><strong>WhatsApp</strong><span>' + escHtml(formatWhatsapp(patient.whatsapp || '-')) + '</span></div><div><strong>Patologia</strong><span>' + escHtml(patient.pathology || 'Sem patologia registrada') + '</span></div></div>' +
        '</header>' +
        '<div class="clinical-export-body">' +
          '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Panorama rápido</h3><span class="clinical-export-section-note">Leitura imediata do momento clínico e operacional do paciente.</span></div><div class="clinical-export-summary-grid"><div class="clinical-export-summary-card"><strong>Sessões realizadas</strong><span>' + escHtml(String(fichaData.appointmentSnapshot.completed.length)) + '</span></div><div class="clinical-export-summary-card"><strong>Próximo atendimento</strong><span>' + escHtml(fichaData.model && fichaData.model.statusCards[0] ? fichaData.model.statusCards[0].value : 'Sem próximos atendimentos') + '</span></div><div class="clinical-export-summary-card"><strong>Saldo do pacote</strong><span>' + escHtml(fichaData.model && fichaData.model.statusCards[2] ? fichaData.model.statusCards[2].value : 'Sem pacote ativo') + '</span></div></div></section>' +
          '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Anamnese</h3><span class="clinical-export-section-note">Base clínica resumida para consulta rápida.</span></div><div class="clinical-export-grid">' +
            '<div class="clinical-export-field"><strong>Queixa principal</strong><p>' + escHtml(anamnese.chief_complaint || 'Não registrada') + '</p></div>' +
            '<div class="clinical-export-field"><strong>História atual</strong><p>' + escHtml(anamnese.history || 'Não registrada') + '</p></div>' +
            '<div class="clinical-export-field"><strong>Diagnóstico / hipótese</strong><p>' + escHtml(anamnese.diagnosis || 'Não registrado') + '</p></div>' +
            '<div class="clinical-export-field"><strong>Limitações funcionais</strong><p>' + escHtml(anamnese.limitations || 'Não registradas') + '</p></div>' +
            '<div class="clinical-export-field"><strong>Objetivos</strong><p>' + escHtml(anamnese.goals || 'Não registrados') + '</p></div>' +
            '<div class="clinical-export-field"><strong>Observações</strong><p>' + escHtml(anamnese.obs || 'Sem observações') + '</p></div>' +
          '</div></section>' +
          '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Evoluções clínicas</h3><span class="clinical-export-section-note">Registros recentes do acompanhamento fisioterapêutico.</span></div>' + evolutionHtml + '</section>' +
          (includeDays ? '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Dias atendidos</h3><span class="clinical-export-section-note">Atendimentos concluídos já realizados na agenda.</span></div><ul class="clinical-export-days">' + daysHtml + '</ul></section>' : '') +
        '</div>' +
      '</div>';
  }

  function buildPatientHistoryExportHtml(pid, appointments){
    var patient = getPatientById(pid);
    if(!patient) return '';
    var fichaData = getPatientFichaViewData(pid, appointments || []);
    if(!fichaData) return '';
    var items = getPatientHistoryExportItemsForPatient(pid, appointments || []);
    var historySummaryUtils = patientFichaUtils();
    var historyModel = historySummaryUtils && typeof historySummaryUtils.buildPatientHistorySummaryModel === 'function'
      ? historySummaryUtils.buildPatientHistorySummaryModel({
          items: items.map(function(item){
            return {
              appointment_date: item.appointment_date,
              weekdayLabel: fmtWeekdaySafe(item.appointment_date),
              start_time: item.start_time,
              statusLabel: item.statusLabel,
              serviceLabel: item.serviceLabel
            };
          }),
          formatDate: fmtDateSafe
        })
      : { countLabel: items.length + ' registros', emptyMessage: 'Nenhum registro encontrado para este paciente.', rows: [] };
    var rowsHtml = historyModel.rows.length
      ? historyModel.rows.map(function(row){
          return '<article class="clinical-export-history-item"><div class="clinical-export-history-accent"></div><div class="clinical-export-history-content"><div class="clinical-export-history-top"><div class="clinical-export-history-title">' + escHtml(row.title) + '</div><span class="clinical-export-status ' + escHtml(row.statusTone) + '">' + escHtml(row.statusLabel) + '</span></div><div class="clinical-export-history-meta"><span class="clinical-export-pill">' + escHtml(row.weekdayLabel || '-') + '</span><span class="clinical-export-pill">' + escHtml(row.timeLabel || '--:--') + '</span><span class="clinical-export-pill">' + escHtml(row.serviceLabel || 'Serviço') + '</span></div><p>' + escHtml(row.body) + '</p></div></article>';
        }).join('')
      : '<div class="clinical-export-empty">' + escHtml(historyModel.emptyMessage) + '</div>';
    var summaryCardsHtml = historyModel.summaryCards.map(function(card){
      return '<div class="clinical-export-summary-card"><strong>' + escHtml(card.label) + '</strong><span>' + escHtml(card.value) + '</span></div>';
    }).join('');
    return '' +
      '<div class="clinical-export-doc">' +
        '<header class="clinical-export-header">' +
          '<div class="clinical-export-brand"><div class="clinical-export-brand-mark"><div class="clinical-export-brand-seal">F</div><div><span>FEMIC</span><strong>Fisioterapia Especializada</strong></div></div><small>Histórico completo do paciente<br>Emitido em ' + escHtml(fmtDateSafe(todayIsoSafe())) + '</small></div>' +
          '<div class="clinical-export-title"><div class="eyebrow">Ficha F</div><h2>Histórico completo do paciente</h2><p class="clinical-export-subtitle">Linha do tempo integral dos agendamentos do paciente, pensada para leitura confortável também sem impressora.</p></div>' +
          '<div class="clinical-export-meta"><div><strong>Paciente</strong><span>' + escHtml(fichaData.exportContext && fichaData.exportContext.header ? fichaData.exportContext.header.name : patient.name || '-') + '</span></div><div><strong>WhatsApp</strong><span>' + escHtml(fichaData.exportContext && fichaData.exportContext.exportMeta ? fichaData.exportContext.exportMeta.phone : formatWhatsapp(patient.whatsapp || '-')) + '</span></div><div><strong>Patologia</strong><span>' + escHtml(fichaData.exportContext && fichaData.exportContext.exportMeta ? fichaData.exportContext.exportMeta.pathology : patient.pathology || 'Sem patologia registrada') + '</span></div></div>' +
        '</header>' +
        '<div class="clinical-export-body">' +
          '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Resumo</h3><span class="clinical-export-section-note">Indicadores rápidos do histórico para navegação mais leve.</span></div><div class="clinical-export-summary-grid"><div class="clinical-export-summary-card"><strong>Registros no histórico</strong><span>' + escHtml(historyModel.countLabel) + '</span></div>' + summaryCardsHtml + '</div></section>' +
          '<section class="clinical-export-section"><div class="clinical-export-section-head"><h3>Linha do tempo de atendimentos</h3><span class="clinical-export-section-note">Todos os eventos em ordem cronológica, com status e serviço destacados.</span></div><div class="clinical-export-history-list">' + rowsHtml + '</div></section>' +
        '</div>' +
      '</div>';
  }

  window.openPatient = async function(pid){
    if(!el('patientFicha')) return;
    setCurrentPatient(pid);
    var appointments = await fetchAllAppointmentsForPatient(pid);
    var fichaData = getPatientFichaViewData(pid, appointments);
    if(!fichaData) return;
    el('patientFicha').innerHTML = buildPatientFichaSummaryHtml(fichaData.model, pid);
    if(el('patientModal')) el('patientModal').classList.add('show');
    renderUnifiedAll();
  };

  window.openPatientClinicalExport = async function(pid){
    var patient = getPatientById(pid);
    if(!patient || !el('patientExportPatientId')) return;
    el('patientExportPatientId').value = pid;
    if(el('patientExportTypeClinical')) el('patientExportTypeClinical').checked = true;
    if(el('patientExportIncludeDays')) el('patientExportIncludeDays').checked = true;
    runtime.patientExport.patientId = pid;
    runtime.patientExport.appointments = await fetchAllAppointmentsForPatient(pid);
    if(el('patientExportModal')) el('patientExportModal').classList.add('show');
    window.renderPatientClinicalExportPreview();
  };

  window.renderPatientClinicalExportPreview = function(){
    var pid = el('patientExportPatientId') ? el('patientExportPatientId').value : runtime.patientExport.patientId;
    if(!pid) return;
    var includeDays = !!(el('patientExportIncludeDays') && el('patientExportIncludeDays').checked);
    var payload = getPatientExportPayload(pid, runtime.patientExport.appointments || [], includeDays);
    runtime.patientExport.patientId = pid;
    runtime.patientExport.htmlByType[payload.type] = payload.html;
    updatePatientExportControlState(payload.type);
    renderPatientExportDocument(payload.html);
    if(el('patientExportPreviewBadge')) el('patientExportPreviewBadge').textContent = payload.type === 'history' ? 'Histórico em tela' : 'Ficha em tela';
  };

  window.openPatientClinicalExportWindow = function(){
    var pid = el('patientExportPatientId') ? el('patientExportPatientId').value : runtime.patientExport.patientId;
    if(!pid) return;
    var includeDays = !!(el('patientExportIncludeDays') && el('patientExportIncludeDays').checked);
    var payload = getPatientExportPayload(pid, runtime.patientExport.appointments || [], includeDays);
    openPatientExportInWindow(payload, false);
  };

  window.printPatientClinicalExport = async function(){
    var pid = el('patientExportPatientId') ? el('patientExportPatientId').value : '';
    if(!pid) return;
    var includeDays = !!(el('patientExportIncludeDays') && el('patientExportIncludeDays').checked);
    if(!runtime.patientExport.appointments.length){
      runtime.patientExport.appointments = await fetchAllAppointmentsForPatient(pid);
    }
    var payload = getPatientExportPayload(pid, runtime.patientExport.appointments || [], includeDays);
    if(!payload.html) return;
    openPatientExportInWindow(payload, true);
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
      if(el('anamChief')) el('anamChief').value = draft.queixa_principal || draft.chief_complaint || draft.chief || '';
      if(el('anamHistory')) el('anamHistory').value = draft.historia_organizada || draft.history || '';
      if(el('anamDiagnosis')) el('anamDiagnosis').value = draft.sintese_clinica || draft.clinical_summary || draft.diagnosis || '';
      if(el('anamLimitations')) el('anamLimitations').value = draft.atividade_fisica_relacao_com_quadro || draft.limitations || '';
      if(el('anamGoals')) el('anamGoals').value = draft.objetivos_expectativas || draft.goals || '';
      if(el('anamObs')) el('anamObs').value = draft.observacoes_clinicas || draft.obs || draft.observations || '';
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
    document.addEventListener('femic:state-updated', function(){ offerLocalClinicalMigration().catch(function(e){ console.error(e); }); });
    document.addEventListener('femic:unified-state-updated', renderUnifiedAll);
    if(el('docBodyInput')) el('docBodyInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('docBodyEditor')){
      el('docBodyEditor').addEventListener('input', function(){
        syncDocumentBodyInput();
        renderUnifiedDocumentPreview();
      });
      el('docBodyEditor').addEventListener('paste', handleDocumentEditorPaste);
      if(el('docBodyInput') && el('docBodyInput').value) setDocumentBodyContent(el('docBodyInput').value);
    }
    if(el('professionalNameInput')) el('professionalNameInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('professionalNoteInput')) el('professionalNoteInput').addEventListener('input', renderUnifiedDocumentPreview);
    if(el('showStampSelect')) el('showStampSelect').addEventListener('change', renderUnifiedDocumentPreview);
    if(el('docAiPromptInput')) el('docAiPromptInput').addEventListener('input', function(){
      setDocAiStatus('Pedido atualizado. Gere um novo rascunho quando quiser.', 'neutral');
    });
    renderUnifiedAll();
    offerLocalClinicalMigration().catch(function(e){ console.error(e); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
