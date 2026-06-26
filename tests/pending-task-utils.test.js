const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPendingTaskDraft,
  classifyWhatsappBotMessage,
  mergeSpeechPart,
  buildSpeechText,
} = require('../js/femic-pending-task-utils.js');

test('buildPendingTaskDraft creates a manual pending task from typed text', () => {
  const task = buildPendingTaskDraft('Paciente pediu para remarcar para amanha a tarde.', {
    origin: 'manual',
    sourceLabel: 'digitada',
    now: '2026-06-12T10:00:00.000Z',
    today: '2026-06-12',
  });

  assert.equal(task.origin, 'manual');
  assert.equal(task.type, 'remarcacao');
  assert.equal(task.title, 'Remarcação · Pendência digitada');
  assert.equal(task.parsed_shift, 'tarde');
  assert.deepEqual(task.parsed_dates, ['2026-06-13']);
  assert.equal(task.notes, 'Paciente pediu para remarcar para amanha a tarde.');
});

test('mergeSpeechPart avoids duplicated overlap between final speech chunks', () => {
  const combined = mergeSpeechPart('quero remarcar minha consulta', 'consulta para amanha');
  assert.equal(combined, 'quero remarcar minha consulta para amanha');
});

test('buildSpeechText keeps ordered final segments without repeating content', () => {
  const text = buildSpeechText({
    0: 'quero remarcar',
    1: 'remarcar minha consulta',
    2: 'consulta para sexta',
  });

  assert.equal(text, 'quero remarcar minha consulta para sexta');
});

test('classifyWhatsappBotMessage detects scheduling requests with broad wording', () => {
  const result = classifyWhatsappBotMessage('Oi, tem algum encaixe de fisioterapia amanhã à tarde?', {
    today: '2026-06-26',
  });

  assert.equal(result.shouldCreateTask, true);
  assert.equal(result.action, 'marcacao');
  assert.equal(result.shift, 'tarde');
  assert.deepEqual(result.dates, ['2026-06-27']);
});

test('classifyWhatsappBotMessage detects rescheduling requests', () => {
  const result = classifyWhatsappBotMessage('Preciso trocar meu horário para sexta de manhã.', {
    today: '2026-06-26',
  });

  assert.equal(result.shouldCreateTask, true);
  assert.equal(result.action, 'remarcacao');
  assert.equal(result.shift, 'manha');
});

test('classifyWhatsappBotMessage ignores casual messages without scheduling intent', () => {
  const result = classifyWhatsappBotMessage('Bom dia, obrigado pelo atendimento de ontem.', {
    today: '2026-06-26',
  });

  assert.equal(result.shouldCreateTask, false);
  assert.equal(result.reason, 'no_scheduling_intent');
});
