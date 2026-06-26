const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findSafeAppointmentSlots,
  slotConflictReason,
} = require('../js/femic-appointment-slot-utils.js');

const settings = {
  working_periods: '08:00-10:00',
  slot_interval_minutes: 30,
  max_patients_per_slot: 4,
};

const servicesById = {
  convenio: {
    id: 'convenio',
    name: 'Fisioterapia Convênio',
    duration_minutes: 30,
    appointment_mode: 'grupo',
    max_patients: 4,
  },
  individual: {
    id: 'individual',
    name: 'Avaliação individual',
    duration_minutes: 30,
    appointment_mode: 'individual',
    max_patients: 1,
  },
};

test('findSafeAppointmentSlots fills partially occupied group slots before empty windows', () => {
  const slots = findSafeAppointmentSlots({
    patientId: 'p3',
    serviceId: 'convenio',
    dates: ['2026-07-01'],
    appointments: [
      { id: 'a1', service_id: 'convenio', appointment_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'agendado' },
      { id: 'a2', service_id: 'convenio', appointment_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'confirmado' },
    ],
    servicesById,
    settings,
    limit: 3,
  });

  assert.equal(slots[0].start_time, '08:00');
  assert.equal(slots[0].load, 2);
  assert.equal(slots[0].remaining_capacity, 2);
});

test('findSafeAppointmentSlots excludes manually blocked times and reopens inactive blocks', () => {
  const blocked = findSafeAppointmentSlots({
    patientId: 'p1',
    serviceId: 'convenio',
    dates: ['2026-07-01'],
    appointments: [],
    scheduleBlocks: [
      { block_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'active' },
    ],
    servicesById,
    settings,
  });

  const reopened = findSafeAppointmentSlots({
    patientId: 'p1',
    serviceId: 'convenio',
    dates: ['2026-07-01'],
    appointments: [],
    scheduleBlocks: [
      { block_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'inactive' },
    ],
    servicesById,
    settings,
  });

  assert.equal(blocked.some((slot) => slot.start_time === '08:00'), false);
  assert.equal(blocked[0].start_time, '08:30');
  assert.equal(reopened[0].start_time, '08:00');
});

test('findSafeAppointmentSlots keeps scanning after the first candidate conflicts', () => {
  const slots = findSafeAppointmentSlots({
    patientId: 'p1',
    serviceId: 'convenio',
    dates: ['2026-07-01'],
    appointments: [
      { id: 'a1', service_id: 'individual', appointment_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'agendado' },
    ],
    servicesById,
    settings,
  });

  assert.equal(slots.some((slot) => slot.start_time === '08:00'), false);
  assert.equal(slots[0].start_time, '08:30');
});

test('slotConflictReason refuses an individual service when another appointment overlaps', () => {
  const reason = slotConflictReason({
    candidate: {
      service_id: 'individual',
      appointment_date: '2026-07-01',
      start_time: '08:00',
      end_time: '08:30',
    },
    appointments: [
      { id: 'a1', service_id: 'convenio', appointment_date: '2026-07-01', start_time: '08:00', end_time: '08:30', status: 'agendado' },
    ],
    servicesById,
    settings,
  });

  assert.equal(reason, 'Serviço individual exige horário exclusivo.');
});
