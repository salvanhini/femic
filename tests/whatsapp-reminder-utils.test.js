const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAppointmentReminderAuditPatch,
  getDueFeedbackReminders,
  getDueWhatsappConfirmationReminders,
  normalizeWhatsappProvider,
  reminderDueAt,
} = require('../js/femic-whatsapp-reminder-utils.js');

test('normalizeWhatsappProvider keeps current providers and falls back to baileys', () => {
  assert.equal(normalizeWhatsappProvider('baileys'), 'baileys');
  assert.equal(normalizeWhatsappProvider('wa_me'), 'wa_me');
  assert.equal(normalizeWhatsappProvider('api'), 'baileys');
  assert.equal(normalizeWhatsappProvider('unknown'), 'baileys');
  assert.equal(normalizeWhatsappProvider(''), 'baileys');
});

test('reminderDueAt returns 12h before the appointment start by default', () => {
  const due = reminderDueAt({
    appointment_date: '2026-06-25',
    start_time: '20:30',
  });

  assert.equal(due && due.toISOString(), '2026-06-25T11:30:00.000Z');
});

test('getDueWhatsappConfirmationReminders keeps only unsent due appointments with valid phone and eligible status', () => {
  const reminders = getDueWhatsappConfirmationReminders({
    appointments: [
      {
        id: 'a1',
        patient_id: 'p1',
        service_id: 'svc-1',
        appointment_date: '2026-06-25',
        start_time: '20:00',
        status: 'agendado',
        appointment_reminder_sent: false,
      },
      {
        id: 'a2',
        patient_id: 'p2',
        service_id: 'svc-2',
        appointment_date: '2026-06-25',
        start_time: '11:00',
        status: 'confirmado',
        appointment_reminder_sent: true,
      },
      {
        id: 'a3',
        patient_id: 'p3',
        service_id: 'svc-3',
        appointment_date: '2026-06-25',
        start_time: '22:00',
        status: 'cancelado',
        appointment_reminder_sent: false,
      },
      {
        id: 'a4',
        patient_id: 'p4',
        service_id: 'svc-4',
        appointment_date: '2026-06-26',
        start_time: '10:00',
        status: 'agendado',
        appointment_reminder_sent: false,
      },
      {
        id: 'a5',
        patient_id: 'p5',
        service_id: 'svc-5',
        appointment_date: '2026-06-25',
        start_time: '21:00',
        status: 'confirmado',
        appointment_reminder_sent: false,
      },
    ],
    patientsById: {
      p1: { id: 'p1', name: 'Ana', whatsapp: '(16) 99999-1111' },
      p2: { id: 'p2', name: 'Beto', whatsapp: '(16) 99999-2222' },
      p3: { id: 'p3', name: 'Caio', whatsapp: '(16) 99999-3333' },
      p4: { id: 'p4', name: 'Dora', whatsapp: '(16) 99999-4444' },
      p5: { id: 'p5', name: 'Eva', whatsapp: '' },
    },
    servicesById: {
      'svc-1': { id: 'svc-1', name: 'Pilates' },
      'svc-2': { id: 'svc-2', name: 'RPG' },
      'svc-3': { id: 'svc-3', name: 'Fisio' },
      'svc-4': { id: 'svc-4', name: 'Drenagem' },
      'svc-5': { id: 'svc-5', name: 'Avaliação' },
    },
    now: '2026-06-25T12:05:00.000Z',
    hoursBefore: 12,
  });

  assert.deepEqual(reminders.map((item) => item.appointment.id), ['a1']);
  assert.equal(reminders[0].patient.name, 'Ana');
  assert.equal(reminders[0].service.name, 'Pilates');
  assert.equal(reminders[0].phone, '5516999991111');
});

test('getDueWhatsappConfirmationReminders prevents duplicates already attempted by provider status and keeps due order', () => {
  const reminders = getDueWhatsappConfirmationReminders({
    appointments: [
      {
        id: 'a1',
        patient_id: 'p1',
        service_id: 'svc-1',
        appointment_date: '2026-06-25',
        start_time: '18:00',
        status: 'agendado',
        appointment_reminder_delivery_status: 'sent',
      },
      {
        id: 'a2',
        patient_id: 'p2',
        service_id: 'svc-1',
        appointment_date: '2026-06-25',
        start_time: '18:30',
        status: 'agendado',
        appointment_reminder_delivery_status: 'failed',
      },
      {
        id: 'a3',
        patient_id: 'p3',
        service_id: 'svc-1',
        appointment_date: '2026-06-25',
        start_time: '17:00',
        status: 'confirmado',
      },
    ],
    patientsById: {
      p1: { id: 'p1', whatsapp: '(16) 99999-1111' },
      p2: { id: 'p2', whatsapp: '(16) 99999-2222' },
      p3: { id: 'p3', whatsapp: '(16) 99999-3333' },
    },
    servicesById: {
      'svc-1': { id: 'svc-1', name: 'Pilates' },
    },
    now: '2026-06-25T09:45:00.000Z',
    hoursBefore: 12,
  });

  assert.deepEqual(reminders.map((item) => item.appointment.id), ['a3', 'a2']);
});

test('buildAppointmentReminderAuditPatch marks successful deliveries for baileys', () => {
  const patch = buildAppointmentReminderAuditPatch({
    provider: 'baileys',
    deliveryStatus: 'sent',
    sentAt: '2026-06-25T09:10:00.000Z',
    externalMessageId: 'wamid.123',
  });

  assert.deepEqual(patch, {
    appointment_reminder_sent: true,
    appointment_reminder_sent_at: '2026-06-25T09:10:00.000Z',
    reminder_sent: true,
    reminder_sent_at: '2026-06-25T09:10:00.000Z',
    appointment_reminder_provider_used: 'baileys',
    appointment_reminder_delivery_status: 'sent',
    appointment_reminder_error_message: null,
    appointment_reminder_last_attempt_at: '2026-06-25T09:10:00.000Z',
    appointment_reminder_external_id: 'wamid.123',
  });
});

test('buildAppointmentReminderAuditPatch keeps reminder open on failure and records the error', () => {
  const patch = buildAppointmentReminderAuditPatch({
    provider: 'baileys',
    deliveryStatus: 'failed',
    sentAt: '2026-06-25T09:12:00.000Z',
    errorMessage: 'Socket disconnected',
  });

  assert.equal(patch.appointment_reminder_sent, false);
  assert.equal(patch.reminder_sent, false);
  assert.equal(patch.appointment_reminder_delivery_status, 'failed');
  assert.equal(patch.appointment_reminder_error_message, 'Socket disconnected');
  assert.equal(patch.appointment_reminder_last_attempt_at, '2026-06-25T09:12:00.000Z');
});

test('getDueFeedbackReminders returns archived patients due within 15-20 day window', () => {
  const due = getDueFeedbackReminders({
    patients: [
      { id: 'p1', name: 'Ana', whatsapp: '(16) 99999-1111', archived: true, archived_at: '2026-06-06T10:00:00.000Z', feedback_sent: null },
      { id: 'p2', name: 'Beto', whatsapp: '(16) 99999-2222', archived: true, archived_at: '2026-06-01T10:00:00.000Z', feedback_sent: null },
      { id: 'p3', name: 'Caio', whatsapp: '(16) 99999-3333', archived: false, archived_at: '2026-06-10T10:00:00.000Z', feedback_sent: null },
      { id: 'p4', name: 'Dora', whatsapp: '(16) 99999-4444', archived: true, archived_at: '2026-06-10T10:00:00.000Z', feedback_sent: true },
    ],
    now: '2026-06-25T12:00:00.000Z',
    minDays: 15,
    maxDays: 20,
  });

  assert.equal(due.length, 1);
  assert.equal(due[0].patient.id, 'p1');
  assert.equal(due[0].patient.name, 'Ana');
  assert.equal(due[0].phone, '5516999991111');
});

test('getDueFeedbackReminders excludes patients without archived_at', () => {
  const due = getDueFeedbackReminders({
    patients: [
      { id: 'p1', name: 'Ana', whatsapp: '(16) 99999-1111', archived: true, archived_at: null, feedback_sent: null },
    ],
    now: '2026-06-25T12:00:00.000Z',
  });

  assert.equal(due.length, 0);
});

test('getDueFeedbackReminders returns empty when no patients match the window', () => {
  const due = getDueFeedbackReminders({
    patients: [
      { id: 'p1', name: 'Ana', whatsapp: '(16) 99999-1111', archived: true, archived_at: '2026-06-01T10:00:00.000Z', feedback_sent: null },
    ],
    now: '2026-06-05T12:00:00.000Z',
    minDays: 15,
    maxDays: 20,
  });

  assert.equal(due.length, 0);
});
