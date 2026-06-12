const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPendingTaskDraft,
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
