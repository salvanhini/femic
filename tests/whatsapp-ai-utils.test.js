const test = require('node:test');
const assert = require('node:assert/strict');

const {
  chooseServiceForConversationIntent,
  courteousClarificationQuestion,
  mergeConversationIntentState,
  parseGroqConversationJson,
} = require('../js/femic-whatsapp-ai-utils.js');

const services = [
  {
    id: 'svc-unimed',
    name: 'Fisioterapia Convênio Unimed',
    appointment_mode: 'grupo',
    max_patients: 4,
    active: true,
  },
  {
    id: 'svc-hapvida',
    name: 'Fisioterapia Convênio Hapvida',
    appointment_mode: 'grupo',
    max_patients: 4,
    active: true,
  },
  {
    id: 'svc-quiro',
    name: 'Quiropraxia',
    appointment_mode: 'individual',
    max_patients: 1,
    active: true,
  },
  {
    id: 'svc-mio',
    name: 'Liberação Miofascial',
    appointment_mode: 'individual',
    max_patients: 1,
    active: true,
  },
];

test('parseGroqConversationJson extracts clean JSON from model text', () => {
  const result = parseGroqConversationJson(`
    Claro. {"should_create_task":true,"action":"marcacao","service_category":"convenio_group","payer_name":"Unimed","shift":"tarde","dates":["2026-06-27"],"needs_clarification":false}
  `);

  assert.equal(result.shouldCreateTask, true);
  assert.equal(result.action, 'marcacao');
  assert.equal(result.serviceCategory, 'convenio_group');
  assert.equal(result.payerName, 'unimed');
  assert.deepEqual(result.dates, ['2026-06-27']);
});

test('chooseServiceForConversationIntent maps convenio fisioterapia to grouped payer service', () => {
  const match = chooseServiceForConversationIntent(services, {
    serviceCategory: 'convenio_group',
    serviceQuery: 'fisioterapia',
    payerName: 'hapvida',
  });

  assert.equal(match.service.id, 'svc-hapvida');
  assert.equal(match.confidence, 'high');
});

test('chooseServiceForConversationIntent maps quiropraxia to individual service', () => {
  const match = chooseServiceForConversationIntent(services, {
    serviceCategory: 'individual_bodywork',
    serviceQuery: 'ajustar coluna quiropraxia',
    payerName: '',
  });

  assert.equal(match.service.id, 'svc-quiro');
  assert.equal(match.service.appointment_mode, 'individual');
});

test('chooseServiceForConversationIntent maps liberacao miofascial to individual service', () => {
  const match = chooseServiceForConversationIntent(services, {
    serviceCategory: 'individual_bodywork',
    serviceQuery: 'liberação miofascial',
    payerName: '',
  });

  assert.equal(match.service.id, 'svc-mio');
  assert.equal(match.service.appointment_mode, 'individual');
});

test('chooseServiceForConversationIntent asks for clarification when category is ambiguous', () => {
  const match = chooseServiceForConversationIntent(services, {
    serviceCategory: 'unknown',
    serviceQuery: 'consulta',
    payerName: '',
  });

  assert.equal(match.service, null);
  assert.equal(match.confidence, 'low');
  assert.match(match.reason, /confirmar/i);
});

test('mergeConversationIntentState keeps short answers from the same patient conversation', () => {
  const first = mergeConversationIntentState(null, parseGroqConversationJson(JSON.stringify({
    should_create_task: true,
    action: 'marcacao',
    service_category: 'convenio_group',
    needs_clarification: true,
    clarification_question: 'Qual convênio você possui?'
  })), 'Convênio');

  const second = mergeConversationIntentState(first, parseGroqConversationJson(JSON.stringify({
    should_create_task: true,
    action: 'marcacao',
    service_category: 'unknown',
    payer_name: 'Unimed',
    needs_clarification: true,
    clarification_question: 'Qual tipo de atendimento você precisa?'
  })), 'Unimed');

  const third = mergeConversationIntentState(second, parseGroqConversationJson(JSON.stringify({
    should_create_task: true,
    action: 'marcacao',
    service_category: 'convenio_group',
    service_query: 'Fisioterapia',
    needs_clarification: false
  })), 'Fisioterapia');

  assert.equal(third.intent.serviceCategory, 'convenio_group');
  assert.equal(third.intent.payerName, 'unimed');
  assert.equal(third.intent.serviceQuery, 'fisioterapia');
  assert.equal(third.intent.needsClarification, false);

  const match = chooseServiceForConversationIntent(services, third.intent);
  assert.equal(match.service.id, 'svc-unimed');
  assert.equal(match.confidence, 'high');
});

test('courteousClarificationQuestion sounds like a polite clinic secretary', () => {
  const question = courteousClarificationQuestion({
    serviceCategory: 'unknown',
    payerName: '',
    serviceQuery: '',
  });

  assert.match(question, /Por gentileza/i);
  assert.match(question, /FEMIC/i);
  assert.match(question, /convênio|quiropraxia|liberação/i);
});
