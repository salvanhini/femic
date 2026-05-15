(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }
  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function norm(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
  function todayIso(){ return typeof window.todayIso === 'function' ? window.todayIso() : new Date().toISOString().slice(0,10); }
  function addDays(dateStr, amount){ var d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + amount); return d.toISOString().slice(0,10); }
  function fmtDate(value){ return typeof window.fmtDate === 'function' ? window.fmtDate(value) : value; }
  function fmtWeekday(value){ return typeof window.fmtWeekday === 'function' ? window.fmtWeekday(value) : value; }

  function addMessage(role, html){
    var box = el('assistantMessages');
    if(!box) return;
    box.insertAdjacentHTML('beforeend', '<div class="assistant-message ' + role + '"><div>' + html + '</div></div>');
    box.scrollTop = box.scrollHeight;
  }

  function setDebug(text){
    if(el('assistantDebug')) el('assistantDebug').textContent = text;
    if(el('assistantStatus')) el('assistantStatus').textContent = text;
  }

  function renderSuggestions(){
    var target = el('assistantSuggestions');
    if(!target) return;
    var suggestions = (window.FEMICAssistantRules && window.FEMICAssistantRules.suggestions) || [];
    target.innerHTML = suggestions.map(function(item){
      return '<button class="assistant-suggestion-chip" type="button" onclick="askFemicAssistant(\'' + esc(item).replace(/'/g, '&#39;') + '\')">' + esc(item) + '</button>';
    }).join('');
  }

  function datesFromPrompt(text){
    var raw = norm(text);
    if(raw.indexOf('amanha') !== -1) return [addDays(todayIso(), 1)];
    if(raw.indexOf('hoje') !== -1) return [todayIso()];
    return [todayIso(), addDays(todayIso(), 1), addDays(todayIso(), 2)];
  }

  function periodFromPrompt(text){
    var raw = norm(text);
    if(raw.indexOf('manha') !== -1) return 'manha';
    if(raw.indexOf('tarde') !== -1) return 'tarde';
    if(raw.indexOf('noite') !== -1) return 'noite';
    return '';
  }

  async function answerPrompt(prompt){
    var agenda = window.FEMICAgendaRuntime && window.FEMICAgendaRuntime.getState ? window.FEMICAgendaRuntime.getState() : null;
    if(!agenda){
      addMessage('assistant', '<p>Carregue os dados da agenda antes de consultar horários.</p>');
      return;
    }
    if(norm(prompt).indexOf('pendencia') !== -1){
      if(typeof window.showPanel === 'function') window.showPanel('pendencias');
      addMessage('assistant', '<p>Abri a fila de pendências do WhatsApp. Ali você confirma os horários sugeridos.</p>');
      return;
    }
    var services = (agenda.services || []).filter(function(service){ return service.active !== false; });
    var service = services.find(function(item){ return norm(prompt).indexOf(norm(item.name)) !== -1; }) || services[0];
    var patients = (agenda.patients || []).filter(function(patient){ return patient.archived !== true; });
    var patient = patients.find(function(item){ return norm(prompt).indexOf(norm(item.name)) !== -1; }) || patients[0];
    if(!service || !patient || !window.FEMICAgendaRuntime.suggestAppointmentSlots){
      addMessage('assistant', '<p>Para sugerir horário, preciso de ao menos um paciente ativo e um serviço ativo carregados.</p>');
      return;
    }
    var result = await window.FEMICAgendaRuntime.suggestAppointmentSlots({
      patient_id: patient.id,
      service_id: service.id,
      dates: datesFromPrompt(prompt),
      requested_period: periodFromPrompt(prompt)
    });
    if(!result.slots || !result.slots.length){
      addMessage('assistant', '<p>Não encontrei horário livre nessa busca. ' + esc(result.reason || '') + '</p>');
      return;
    }
    addMessage('assistant', '<p>Encontrei estas opções para <strong>' + esc(service.name) + '</strong>:</p><ul>' + result.slots.map(function(slot){
      return '<li>' + esc(fmtWeekday(slot.date) + ' · ' + fmtDate(slot.date) + ' · ' + slot.start + '-' + slot.end) + '</li>';
    }).join('') + '</ul><p>Para pedidos vindos do WhatsApp, confirme pela aba Pendências.</p>');
  }

  window.toggleAssistantPanel = function(force){
    var panel = el('assistantPanel');
    if(!panel) return;
    var shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
    panel.classList.toggle('is-open', shouldOpen);
    if(shouldOpen) renderSuggestions();
  };

  window.askFemicAssistant = function(text){
    if(el('assistantInput')) el('assistantInput').value = text;
    var form = el('assistantInput') && el('assistantInput').closest('form');
    if(form) form.dispatchEvent(new Event('submit', { cancelable:true }));
  };

  function init(){
    if(el('assistantBuildLabel')) el('assistantBuildLabel').textContent = 'build assistant-phase-1';
    renderSuggestions();
    var form = el('assistantInput') && el('assistantInput').closest('form');
    if(form && !form.dataset.femicAssistantBound){
      form.dataset.femicAssistantBound = 'true';
      form.addEventListener('submit', function(event){
        event.preventDefault();
        var input = el('assistantInput');
        var prompt = input ? String(input.value || '').trim() : '';
        if(!prompt) return;
        addMessage('user', '<p>' + esc(prompt) + '</p>');
        if(input) input.value = '';
        setDebug('Consultando agenda...');
        answerPrompt(prompt).catch(function(error){
          addMessage('assistant', '<p>Não consegui responder agora: ' + esc(error.message || error) + '</p>');
        }).finally(function(){ setDebug('Consultas internas priorizam os dados da agenda.'); });
      });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
