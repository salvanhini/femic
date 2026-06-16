const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPatientAppointmentSnapshot,
  getCompletedAgendaAppointmentsByPatient,
  normalizeAppointmentStatus,
} = require('../js/femic-unified-appointments-utils.js');

test('getCompletedAgendaAppointmentsByPatient keeps only completed appointments for the patient ordered from newest to oldest', () => {
  const appointments = [
    { id: 'a1', patient_id: 'p1', service_id: 'svc-1', appointment_date: '2026-06-10', start_time: '08:00', status: 'concluido' },
    { id: 'a2', patient_id: 'p1', service_id: 'svc-1', appointment_date: '2026-06-12', start_time: '09:00', status: 'agendado' },
    { id: 'a3', patient_id: 'p2', service_id: 'svc-2', appointment_date: '2026-06-14', start_time: '10:00', status: 'concluido' },
    { id: 'a4', patient_id: 'p1', service_id: 'svc-3', appointment_date: '2026-06-12', start_time: '07:30', status: 'concluido' },
    { id: 'a5', patient_id: 'p1', service_id: 'svc-1', appointment_date: '2026-06-12', start_time: '11:15', status: 'concluido' },
    { id: 'a6', patient_id: 'p1', service_id: 'svc-1', appointment_date: '2026-06-13', start_time: '08:30', status: 'cancelado' },
  ];

  const result = getCompletedAgendaAppointmentsByPatient(appointments, 'p1');

  assert.deepEqual(result.map((item) => item.id), ['a5', 'a4', 'a1']);
});

test('getCompletedAgendaAppointmentsByPatient returns an empty list when the patient has no completed appointments', () => {
  const appointments = [
    { id: 'a1', patient_id: 'p1', appointment_date: '2026-06-10', start_time: '08:00', status: 'agendado' },
    { id: 'a2', patient_id: 'p1', appointment_date: '2026-06-11', start_time: '09:00', status: 'confirmado' },
    { id: 'a3', patient_id: 'p2', appointment_date: '2026-06-12', start_time: '10:00', status: 'concluido' },
  ];

  const result = getCompletedAgendaAppointmentsByPatient(appointments, 'p1');

  assert.deepEqual(result, []);
});

test('getCompletedAgendaAppointmentsByPatient accepts legacy status formatting differences', () => {
  const appointments = [
    { id: 'a1', patient_id: 'p1', appointment_date: '2026-06-10', start_time: '08:00', status: ' concluído ' },
    { id: 'a2', patient_id: 'p1', appointment_date: '2026-06-11', start_time: '09:00', status: 'CONCLUIDO' },
    { id: 'a3', patient_id: 'p1', appointment_date: '2026-06-12', start_time: '10:00', status: 'cancelado' },
  ];

  const result = getCompletedAgendaAppointmentsByPatient(appointments, 'p1');

  assert.deepEqual(result.map((item) => item.id), ['a2', 'a1']);
});

test('buildPatientAppointmentSnapshot separates completed history from future appointments', () => {
  const appointments = [
    { id: 'a1', patient_id: 'p1', appointment_date: '2026-05-10', start_time: '08:00', status: 'concluido' },
    { id: 'a2', patient_id: 'p1', appointment_date: '2026-07-11', start_time: '09:00', status: 'confirmado' },
    { id: 'a3', patient_id: 'p1', appointment_date: '2026-07-12', start_time: '10:00', status: 'agendado' },
    { id: 'a4', patient_id: 'p1', appointment_date: '2026-05-12', start_time: '11:00', status: 'cancelado' },
    { id: 'a5', patient_id: 'p2', appointment_date: '2026-05-13', start_time: '12:00', status: 'concluido' },
  ];

  const result = buildPatientAppointmentSnapshot(appointments, 'p1', '2026-06-16');

  assert.deepEqual(result.completed.map((item) => item.id), ['a1']);
  assert.deepEqual(result.nextAppointments.map((item) => item.id), ['a2', 'a3']);
  assert.deepEqual(result.all.map((item) => item.id), ['a1', 'a4', 'a2', 'a3']);
});

test('normalizeAppointmentStatus removes accents, spaces and casing noise', () => {
  assert.equal(normalizeAppointmentStatus(' Concluído '), 'concluido');
  assert.equal(normalizeAppointmentStatus('CONFIRMADO'), 'confirmado');
});
