const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyAnamneseFields,
  calculateAge,
  getAgeSupportNote,
  shouldShowAppointmentPackageAlert,
} = require('../js/femic-clinical-utils.js');

test('calculateAge returns whole years from birth date', () => {
  assert.equal(calculateAge('1990-06-15', '2026-06-15'), 36);
  assert.equal(calculateAge('1990-06-16', '2026-06-15'), 35);
});

test('getAgeSupportNote returns discrete support message by age band', () => {
  assert.match(getAgeSupportNote(16), /crescimento|carga/i);
  assert.match(getAgeSupportNote(72), /multifatorial|recuperacao/i);
});

test('buildLegacyAnamneseFields maps structured biopsychosocial form to legacy fields', () => {
  const legacy = buildLegacyAnamneseFields({
    queixa_principal: 'Dor lombar ao ficar muito tempo sentada.',
    historia_organizada: 'Quadro iniciou ha 4 meses e piora no fim do expediente.',
    ocupacao_rotina_trabalho: 'Trabalha sentada em escritorio por longos periodos.',
    atividade_fisica_relacao_com_quadro: 'Fazia caminhada e parou por medo de piorar.',
    red_flags_check: 'Sem perda de forca, febre ou trauma importante.',
    tratamentos_previos_e_percepcao: 'Melhorou parcialmente com exercicios e pausas.',
    fatores_psicossociais: 'Relata estresse e sono ruim em semanas mais intensas.',
    medos_e_evitacao: 'Tem medo de travar ao se curvar.',
    objetivos_expectativas: 'Voltar a caminhar e trabalhar sem dor.',
    observacoes_clinicas: 'Boa resposta a educacao e movimento gradual.',
    sintese_clinica: 'Quadro mecanossensivel com forte influencia ocupacional e evitacao de movimento.'
  });

  assert.equal(legacy.chief_complaint, 'Dor lombar ao ficar muito tempo sentada.');
  assert.match(legacy.limitations, /medo de travar/i);
  assert.match(legacy.obs, /Sem perda de forca/i);
  assert.match(legacy.obs, /estresse/i);
});

test('shouldShowAppointmentPackageAlert marks only the last relevant future appointment', () => {
  const appointment = {
    id: 'appt-2',
    patient_id: 'p1',
    service_id: 'svc-1',
    appointment_date: '2026-06-20',
    start_time: '10:00',
    status: 'agendado',
  };
  const stats = {
    remain: 3,
    futureCount: 1,
    toSchedule: 2,
    alert: true,
    lastFuture: {
      id: 'appt-2',
      appointment_date: '2026-06-20',
      start_time: '10:00',
    }
  };

  assert.equal(shouldShowAppointmentPackageAlert(appointment, stats), true);
  assert.equal(shouldShowAppointmentPackageAlert({ ...appointment, id: 'appt-1' }, stats), false);
});
