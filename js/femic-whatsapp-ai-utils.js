(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICWhatsappAIUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  var KNOWN_PAYERS = ['unimed', 'hapvida', 'pro unica', 'prounica', 'pro-unica'];

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalPayer(value){
    var text = norm(value);
    if(!text) return '';
    if(/pro\s*unica|prounica/.test(text)) return 'pro unica';
    return text;
  }

  function firstJsonObject(text){
    var raw = String(text || '').trim();
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if(start === -1 || end === -1 || end <= start) return '';
    return raw.slice(start, end + 1);
  }

  function safeArray(value){
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  }

  function normalizeAction(value){
    var action = norm(value);
    if(/remarc|reagen|trocar|alterar|mudar/.test(action)) return 'remarcacao';
    if(/cancel|desmarc/.test(action)) return 'cancelamento';
    if(/duvida|pergunta|informacao/.test(action)) return 'duvida';
    return 'marcacao';
  }

  function normalizeCategory(value){
    var text = norm(value);
    if(/convenio|grupo|fisioterapia/.test(text)) return 'convenio_group';
    if(/individual|quiro|quiroprax|miofasc|liberacao|manual/.test(text)) return 'individual_bodywork';
    return 'unknown';
  }

  function parseGroqConversationJson(text){
    var parsed = {};
    var json = firstJsonObject(text);
    if(json){
      try{ parsed = JSON.parse(json); }catch(e){ parsed = {}; }
    }
    var serviceQuery = parsed.service_query || parsed.service || parsed.servico || '';
    var payer = canonicalPayer(parsed.payer_name || parsed.payer || parsed.convenio || '');
    return {
      shouldCreateTask: parsed.should_create_task !== false && parsed.shouldCreateTask !== false,
      action: normalizeAction(parsed.action || parsed.intent || 'marcacao'),
      serviceCategory: normalizeCategory(parsed.service_category || parsed.serviceCategory || ''),
      serviceQuery: norm(serviceQuery),
      payerName: payer,
      shift: norm(parsed.shift || parsed.period || parsed.turno || ''),
      dates: safeArray(parsed.dates || parsed.parsed_dates),
      needsClarification: !!(parsed.needs_clarification || parsed.needsClarification),
      clarificationQuestion: String(parsed.clarification_question || parsed.clarificationQuestion || '').trim(),
      reply: String(parsed.reply || parsed.response || '').trim(),
      confidence: norm(parsed.confidence || 'medium') || 'medium',
      raw: parsed,
    };
  }

  function inferIntentFromShortAnswer(message){
    var text = norm(message);
    var patch = {};
    if(!text) return patch;
    if(/convenio|convênio/.test(text)) patch.serviceCategory = 'convenio_group';
    if(/unimed|hapvida|pro\s*unica|prounica/.test(text)) patch.payerName = canonicalPayer(text);
    if(/fisioterapia|fisio/.test(text)){
      patch.serviceQuery = 'fisioterapia';
      patch.serviceCategory = 'convenio_group';
    }
    if(/quiro|quiroprax|coluna|ajust/.test(text)){
      patch.serviceQuery = 'quiropraxia';
      patch.serviceCategory = 'individual_bodywork';
    }
    if(/miofasc|liberacao|liberação|liberar/.test(text)){
      patch.serviceQuery = 'liberacao miofascial';
      patch.serviceCategory = 'individual_bodywork';
    }
    return patch;
  }

  function mergeConversationIntentState(previousState, nextIntent, message, nowIso){
    var previous = previousState && previousState.intent ? previousState.intent : {};
    var inferred = inferIntentFromShortAnswer(message);
    var next = nextIntent || {};
    var merged = {
      shouldCreateTask: next.shouldCreateTask !== false && previous.shouldCreateTask !== false,
      action: next.action && next.action !== 'marcacao' ? next.action : (previous.action || next.action || 'marcacao'),
      serviceCategory: next.serviceCategory && next.serviceCategory !== 'unknown'
        ? next.serviceCategory
        : (inferred.serviceCategory || previous.serviceCategory || 'unknown'),
      serviceQuery: next.serviceQuery || inferred.serviceQuery || previous.serviceQuery || '',
      payerName: next.payerName || inferred.payerName || previous.payerName || '',
      shift: next.shift || previous.shift || '',
      dates: next.dates && next.dates.length ? next.dates : (previous.dates || []),
      needsClarification: !!next.needsClarification,
      clarificationQuestion: next.clarificationQuestion || '',
      reply: next.reply || '',
      confidence: next.confidence || previous.confidence || 'medium',
      raw: next.raw || {},
    };

    if(merged.serviceCategory !== 'unknown' && merged.serviceQuery && (merged.payerName || merged.serviceCategory === 'individual_bodywork')){
      merged.needsClarification = false;
      merged.clarificationQuestion = '';
    }

    var history = previousState && Array.isArray(previousState.history) ? previousState.history.slice(-5) : [];
    history.push({ role: 'patient', text: String(message || ''), at: nowIso || new Date().toISOString() });
    return { intent: merged, history: history };
  }

  function serviceMode(service){
    return norm(service && service.appointment_mode || 'grupo');
  }

  function serviceText(service){
    return norm([
      service && service.name,
      service && service.type,
      service && service.payer_name,
      service && service.health_insurance_name,
    ].filter(Boolean).join(' '));
  }

  function activeServices(services){
    return (services || []).filter(function(service){ return service && service.active !== false; });
  }

  function exactTextMatch(services, query){
    var normalized = norm(query);
    if(!normalized) return null;
    return activeServices(services).find(function(service){
      var text = serviceText(service);
      return text && (text.indexOf(normalized) !== -1 || normalized.indexOf(text) !== -1);
    }) || null;
  }

  function payerMatches(text, payerName){
    var payer = canonicalPayer(payerName);
    if(!payer) return true;
    if(payer === 'pro unica') return /pro\s*unica|prounica/.test(text);
    return text.indexOf(payer) !== -1;
  }

  function chooseConvenioService(services, intent){
    var payer = canonicalPayer(intent && intent.payerName);
    var candidates = activeServices(services).filter(function(service){
      var text = serviceText(service);
      return serviceMode(service) !== 'individual'
        && /fisioterapia|fisio|convenio|grupo|unimed|hapvida|pro\s*unica|prounica/.test(text)
        && payerMatches(text, payer);
    });
    if(candidates.length) return candidates[0];
    return activeServices(services).find(function(service){
      return serviceMode(service) !== 'individual' && /fisioterapia|fisio|convenio|grupo/.test(serviceText(service));
    }) || null;
  }

  function chooseIndividualBodyworkService(services, intent){
    var query = norm(intent && intent.serviceQuery);
    var wantsMio = /miofasc|liberacao|liberar/.test(query);
    var wantsQuiro = /quiro|quiroprax|coluna|ajust/.test(query);
    return activeServices(services).find(function(service){
      var text = serviceText(service);
      if(serviceMode(service) !== 'individual') return false;
      if(wantsMio) return /miofasc|liberacao/.test(text);
      if(wantsQuiro) return /quiro|quiroprax/.test(text);
      return /miofasc|liberacao|quiro|quiroprax/.test(text);
    }) || null;
  }

  function chooseServiceForConversationIntent(services, intent){
    intent = intent || {};
    if(intent.serviceCategory === 'convenio_group'){
      var convenio = chooseConvenioService(services, intent);
      return convenio
        ? { service: convenio, confidence: intent.payerName ? 'high' : 'medium', reason: 'Serviço de fisioterapia por convênio/grupo.' }
        : { service: null, confidence: 'low', reason: 'Precisa confirmar qual convênio ou serviço de fisioterapia.' };
    }

    if(intent.serviceCategory === 'individual_bodywork'){
      var individual = chooseIndividualBodyworkService(services, intent);
      return individual
        ? { service: individual, confidence: 'high', reason: 'Serviço individual identificado.' }
        : { service: null, confidence: 'low', reason: 'Precisa confirmar se é quiropraxia ou liberação miofascial.' };
    }

    var exact = exactTextMatch(services, intent.serviceQuery);
    if(exact) return { service: exact, confidence: 'high', reason: 'Serviço encontrado pelo texto do paciente.' };

    return { service: null, confidence: 'low', reason: 'Precisa confirmar se é fisioterapia por convênio, quiropraxia ou liberação miofascial.' };
  }

  function serviceCatalogForPrompt(services){
    return activeServices(services).map(function(service){
      return {
        id: service.id,
        name: service.name,
        mode: service.appointment_mode || 'grupo',
        max_patients: service.max_patients || null,
      };
    });
  }

  function courteousClarificationQuestion(intent){
    intent = intent || {};
    if(intent.serviceCategory === 'convenio_group' && !intent.payerName){
      return 'Perfeito. Por gentileza, você poderia me informar qual é o seu convênio? Atendemos opções como Unimed, Hapvida, Pro Única e outros.';
    }
    if(intent.serviceCategory === 'unknown' || (!intent.serviceCategory && !intent.serviceQuery)){
      return 'Claro, vou te ajudar pelo atendimento da FEMIC. Por gentileza, você procura fisioterapia pelo convênio, quiropraxia ou liberação miofascial?';
    }
    if(intent.serviceCategory === 'individual_bodywork' && !intent.serviceQuery){
      return 'Claro. Por gentileza, você deseja atendimento de quiropraxia ou liberação miofascial?';
    }
    return 'Obrigada pelas informações. Por gentileza, poderia me confirmar o tipo de atendimento desejado para eu encaminhar corretamente à equipe FEMIC?';
  }

  return {
    chooseServiceForConversationIntent: chooseServiceForConversationIntent,
    courteousClarificationQuestion: courteousClarificationQuestion,
    mergeConversationIntentState: mergeConversationIntentState,
    parseGroqConversationJson: parseGroqConversationJson,
    serviceCatalogForPrompt: serviceCatalogForPrompt,
  };
});
