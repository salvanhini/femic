const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCompletedAgendaAppointmentsByPatient,
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
