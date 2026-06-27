const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildReminderWindow,
  buildReminderUpdate,
  normalizeWhatsappJid,
} = require('./reminder-utils.js');

test('buildReminderWindow uses Sao Paulo clinic time instead of server UTC time', () => {
  const window = buildReminderWindow({
    now: '2026-06-25T11:00:00.000Z',
    hoursBefore: 12,
    timeZone: 'America/Sao_Paulo',
    toleranceMinutes: 30,
  });

  assert.deepEqual(window, {
    targetDate: '2026-06-25',
    targetTime: '20:00',
    fromTime: '19:30',
    toTime: '20:30',
  });
});

test('normalizeWhatsappJid keeps the ninth digit for Brazilian mobile numbers', () => {
  assert.equal(
    normalizeWhatsappJid('(16) 99999-1111'),
    '5516999991111@s.whatsapp.net'
  );
});

test('buildReminderUpdate keeps failed reminders open for a future retry', () => {
  const patch = buildReminderUpdate({
    status: 'failed',
    error: 'Socket disconnected',
    now: '2026-06-25T09:12:00.000Z',
  });

  assert.equal(patch.appointment_reminder_sent, false);
  assert.equal(patch.reminder_sent, false);
  assert.equal(patch.appointment_reminder_delivery_status, 'failed');
  assert.equal(patch.appointment_reminder_error_message, 'Socket disconnected');
});
