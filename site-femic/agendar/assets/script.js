(function(){
  'use strict';

  var config = window.FEMIC_SUPABASE || {};
  var SUPABASE_URL = (config.url || '').replace(/\/$/, '');
  var SUPABASE_ANON_KEY = config.anonKey || '';
  var IS_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  var CONFIG_KEY = 'femic_agendar_config';

  (function loadFromLocalStorage(){
    try{
      var saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      if(saved.url && saved.key && !IS_CONFIGURED){
        SUPABASE_URL = saved.url;
        SUPABASE_ANON_KEY = saved.key;
        IS_CONFIGURED = true;
      }
    }catch(e){}
  })();

  function el(id){ return document.getElementById(id); }

  function toast(msg, type){
    type = type || 'info';
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    el('toastContainer').appendChild(t);
    setTimeout(function(){ t.remove(); }, 4000);
  }

  function cleanPhone(value){
    return String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  }

  function formatPhone(value){
    var digits = cleanPhone(value);
    if(digits.length === 11) return '(' + digits.slice(0,2) + ') ' + digits.slice(2,7) + '-' + digits.slice(7);
    if(digits.length === 10) return '(' + digits.slice(0,2) + ') ' + digits.slice(2,6) + '-' + digits.slice(6);
    return value;
  }

  function generateId(prefix){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + window.crypto.randomUUID();
    return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayIso(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function api(path, options){
    return fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      ...options
    }).then(function(res){
      return res.text().then(function(txt){
        var data;
        try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
        if(!res.ok) throw new Error((data && data.message) || txt || 'HTTP ' + res.status);
        return data;
      });
    });
  }

  function getFormData(){
    return {
      name: String(el('fieldName').value || '').trim(),
      phone: cleanPhone(el('fieldPhone').value || ''),
      birth: String(el('fieldBirth').value || '').trim(),
      pathology: String(el('fieldPathology').value || '').trim(),
      payer: String(el('fieldPayer').value || '').trim(),
      date: String(el('fieldDate').value || '').trim(),
      period: String(el('fieldPeriod').value || '').trim(),
      history: String(el('fieldHistory').value || '').trim()
    };
  }

  function validateForm(data){
    if(!data.name) return 'Informe o nome completo.';
    if(!data.phone || data.phone.length < 10) return 'Informe o WhatsApp com DDD.';
    if(!data.pathology) return 'Informe a principal queixa ou patologia.';
    if(!data.payer) return 'Selecione o convênio.';
    return null;
  }

  function createPatient(data){
    var patientId = generateId('p_');
    return api('patients', {
      method: 'POST',
      body: JSON.stringify({
        id: patientId,
        name: data.name,
        whatsapp: formatPhone(data.phone),
        birth_date: data.birth || null,
        pathology: data.pathology,
        referral_source: 'site_agendamento',
        archived: false,
        created_at: new Date().toISOString()
      })
    }).then(function(){ return patientId; });
  }

  function createTask(data, patientId, patientName){
    var now = new Date().toISOString();
    var notes = [];
    if(data.payer) notes.push('Convênio: ' + data.payer);
    if(data.history) notes.push('Histórico: ' + data.history);
    if(data.date) notes.push('Data sugerida: ' + data.date);
    if(data.period) notes.push('Período: ' + data.period);

    return api('assistant_tasks', {
      method: 'POST',
      body: JSON.stringify({
        id: 'public_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: 'Avaliação via site · ' + patientName,
        type: 'marcacao',
        status: 'aberta',
        priority: data.payer === 'Particular' ? 'alta' : 'normal',
        patient_id: patientId,
        patient_name: patientName,
        phone: data.phone,
        origin: 'assistant_booking',
        requested_action: 'marcacao',
        notes: notes.join('\n'),
        service_name: 'Avaliação',
        suggested_slots: [],
        candidates: [],
        parsed_shift: data.period || '',
        parsed_dates: data.date ? [data.date] : [],
        needs_review: true,
        assistant_kind: 'booking',
        assistant_data: {
          patient_mode: 'existing',
          patient_id: patientId,
          patient_name: patientName,
          patient_phone: data.phone,
          patient_pathology: data.pathology,
          service_id: '',
          service_name: 'Avaliação',
          period: data.period || '',
          start_date: data.date || '',
          notes: data.history || '',
          convenio: data.payer
        },
        assistant_plans: [],
        assistant_missing_fields: [],
        assistant_patient_candidates: [],
        assistant_patient_confirmed: true,
        assistant_selected_plan: -1,
        created_at: now,
        updated_at: now,
        completed_at: null
      })
    });
  }

  function handleSubmit(e){
    e.preventDefault();
    if(!IS_CONFIGURED){
      toast('Página ainda não configurada. O administrador precisa definir o Supabase em config.js.', 'error');
      return;
    }

    var data = getFormData();
    var error = validateForm(data);
    if(error){ toast(error, 'error'); return; }

    var btn = el('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    createPatient(data).then(function(patientId){
      return createTask(data, patientId, data.name);
    }).then(function(){
      el('formCard').style.display = 'none';
      el('successState').classList.add('show');
    }).catch(function(err){
      toast('Erro ao enviar: ' + (err.message || err), 'error');
      btn.disabled = false;
      btn.textContent = 'Solicitar agendamento';
    });
  }

  function init(){
    var dateInput = el('fieldDate');
    if(dateInput) dateInput.setAttribute('min', todayIso());

    var phoneInput = el('fieldPhone');
    if(phoneInput){
      phoneInput.addEventListener('input', function(){
        var digits = cleanPhone(this.value);
        if(digits.length <= 11){
          var f = '';
          if(digits.length > 2) f = '(' + digits.slice(0,2) + ') ';
          if(digits.length > 7) f += digits.slice(2,7) + '-' + digits.slice(7);
          else if(digits.length > 2) f += digits.slice(2);
          else f = digits;
          this.value = f;
        }else{
          this.value = this.value.slice(0, 16);
        }
      });
    }

    el('schedulingForm').addEventListener('submit', handleSubmit);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
