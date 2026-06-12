(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICPendingTaskUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tidySpeechText(text){
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function mergeSpeechPart(current, part){
    current = tidySpeechText(current);
    part = tidySpeechText(part);
    if(!part) return current;
    if(!current) return part;

    var currentNorm = norm(current);
    var partNorm = norm(part);
    if(currentNorm === partNorm || currentNorm.indexOf(partNorm) !== -1) return current;
    if(partNorm.indexOf(currentNorm) === 0) return part;

    var currentWords = current.split(' ');
    var partWords = part.split(' ');
    var maxOverlap = Math.min(currentWords.length, partWords.length);
    for(var size = maxOverlap; size > 0; size--){
      var currentTail = norm(currentWords.slice(-size).join(' '));
      var partHead = norm(partWords.slice(0, size).join(' '));
      if(currentTail === partHead){
        return tidySpeechText(current + ' ' + partWords.slice(size).join(' '));
      }
    }
    return tidySpeechText(current + ' ' + part);
  }

  function buildSpeechText(finalSegments){
    var text = '';
    Object.keys(finalSegments || {}).sort(function(a, b){
      return Number(a) - Number(b);
    }).forEach(function(key){
      text = mergeSpeechPart(text, finalSegments[key]);
    });
    return text;
  }

  function detectAction(text){
    var normalized = norm(text);
    if(/cancel|desmarc|nao vou|nao pod/.test(normalized)) return 'cancelamento';
    if(/remarc|reagen|remanej|mudar|trocar|alterar/.test(normalized)) return 'remarcacao';
    if(/marcar|agendar|queria|gostaria|preciso|pode|podia|consigo|vaga|horario/.test(normalized)) return 'marcacao';
    return 'marcacao';
  }

  function detectShift(text){
    var normalized = norm(text);
    if(/\bmanha\b/.test(normalized)) return 'manha';
    if(/\btarde\b/.test(normalized)) return 'tarde';
    if(/\bnoite\b/.test(normalized)) return 'noite';
    return '';
  }

  function dateToIso(date){
    return new Date(date).toISOString().slice(0, 10);
  }

  function detectDates(text, todayIso){
    var normalized = norm(text);
    var dates = [];
    var weekdays = { domingo:0, segund:1, terc:2, quarta:3, quint:4, sext:5, sabad:6 };
    var today = todayIso ? new Date(todayIso + 'T00:00:00') : new Date();

    Object.keys(weekdays).forEach(function(name){
      if(normalized.indexOf(name) === -1) return;
      var dow = weekdays[name];
      var candidate = new Date(today);
      var diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + (diff === 0 ? 7 : diff));
      dates.push(dateToIso(candidate));
    });

    var slashMatch = normalized.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if(slashMatch){
      var day = parseInt(slashMatch[1], 10);
      var month = parseInt(slashMatch[2], 10);
      var year = month < today.getMonth() + 1 ? today.getFullYear() + 1 : today.getFullYear();
      dates.push(year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'));
    }

    if(normalized.indexOf('hoje') !== -1) dates.push(dateToIso(today));
    if(normalized.indexOf('amanha') !== -1){
      var tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dates.push(dateToIso(tomorrow));
    }

    return Array.from(new Set(dates));
  }

  function taskTypeLabel(type){
    return { marcacao:'Marcação', remarcacao:'Remarcação', cancelamento:'Cancelamento' }[type] || 'Outro';
  }

  function makeTaskId(){
    return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function buildPendingTaskDraft(text, options){
    options = options || {};
    var cleanText = tidySpeechText(text);
    var origin = options.origin || 'manual';
    var sourceLabel = options.sourceLabel || (origin === 'voice' ? 'por voz' : 'digitada');
    var now = options.now || new Date().toISOString();
    var action = detectAction(cleanText);

    return {
      id: options.id || makeTaskId(),
      title: taskTypeLabel(action) + ' · Pendência ' + sourceLabel,
      type: action,
      status: 'aberta',
      priority: 'normal',
      patient_id: '',
      patient_name: '',
      service_id: '',
      service_name: '',
      phone: '',
      origin: origin,
      requested_action: action,
      notes: cleanText,
      suggested_slots: [],
      candidates: [],
      parsed_shift: detectShift(cleanText),
      parsed_dates: detectDates(cleanText, options.today),
      needs_review: true,
      created_at: now,
      updated_at: now,
      completed_at: null
    };
  }

  function speechErrorMessage(event){
    var code = String(event && event.error || '');
    if(code === 'not-allowed' || code === 'service-not-allowed') return 'Permissão do microfone bloqueada neste navegador.';
    if(code === 'audio-capture') return 'Nenhum microfone disponível para captura.';
    if(code === 'no-speech') return 'Nenhuma voz detectada. Tente novamente.';
    if(code === 'network') return 'Erro de rede ao usar o microfone.';
    if(code === 'aborted') return 'Captação interrompida antes de concluir.';
    return 'Falha no microfone.';
  }

  return {
    buildPendingTaskDraft: buildPendingTaskDraft,
    buildSpeechText: buildSpeechText,
    detectAction: detectAction,
    detectDates: detectDates,
    detectShift: detectShift,
    mergeSpeechPart: mergeSpeechPart,
    norm: norm,
    speechErrorMessage: speechErrorMessage,
    taskTypeLabel: taskTypeLabel,
    tidySpeechText: tidySpeechText
  };
});
