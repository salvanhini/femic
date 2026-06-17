const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPatientFichaSummaryModel,
  buildPatientFichaExportContext,
  buildPatientHistorySummaryModel,
} = require('../js/femic-patient-ficha-utils.js');

test('buildPatientFichaSummaryModel prioritizes the operational summary and keeps secondary details out of the main blocks', () => {
  const result = buildPatientFichaSummaryModel({
    patient: {
      id: 'p1',
      name: 'Ana Souza',
      whatsapp: '11999998888',
      birth_date: '1990-05-10',
      referral_source: 'Ortopedista',
    },
    ageLabel: '34 anos',
    nextAppointment: {
      appointment_date: '2026-06-20',
      start_time: '08:00',
      service_name: 'Fisioterapia ortopédica',
    },
    completedCount: 5,
    packageSummary: {
      label: 'Ortopedia',
      used: 3,
      total: 10,
      remaining: 7,
      alert: 'Faltam 2 sessoes sem agendamento',
    },
    anamnese: {
      chief_complaint: 'Dor lombar',
      clinical_summary: 'Quadro mecanico com piora ao sentar.',
    },
    latestEvolution: {
      date: '2026-06-14',
      conduct: 'Melhora parcial da dor, tolerando melhor as atividades.',
      guidance: 'Manter exercicios em casa.',
    },
    formatDate: (value) => `data:${value}`,
    formatWeekday: (value) => `dia:${value}`,
    formatPhone: (value) => `fone:${value}`,
  });

  assert.equal(result.header.name, 'Ana Souza');
  assert.equal(result.header.whatsapp, 'fone:11999998888');
  assert.equal(result.header.age, '34 anos');

  assert.deepEqual(result.statusCards.map((item) => item.label), [
    'Próximo atendimento',
    'Sessões realizadas',
    'Saldo do pacote',
    'Último registro',
  ]);

  assert.equal(result.statusCards[0].value, 'data:2026-06-20 às 08:00');
  assert.equal(result.statusCards[2].value, '7 sessões');
  assert.equal(result.statusCards[3].value, 'data:2026-06-14');

  assert.deepEqual(result.sections.map((item) => item.title), [
    'Próximo atendimento',
    'Pacote atual',
    'Resumo clínico',
    'Último registro',
  ]);

  assert.match(result.sections[0].body, /Fisioterapia ortopédica/);
  assert.match(result.sections[1].body, /3\/10 usadas/);
  assert.match(result.sections[2].body, /Dor lombar/);
  assert.match(result.sections[2].body, /Quadro mecanico/);
  assert.match(result.sections[3].body, /Melhora parcial/);

  assert.equal(result.secondaryActions.length, 3);
  assert.equal(result.secondaryActions[0].label, 'Abrir prontuário');

  assert.equal(result.sections.some((item) => /Documentos|guias|Sessões realizadas/i.test(item.title + item.body)), false);
});

test('buildPatientFichaSummaryModel provides clear empty states when operational data is missing', () => {
  const result = buildPatientFichaSummaryModel({
    patient: {
      id: 'p2',
      name: 'Paciente sem agenda',
      whatsapp: '',
    },
    ageLabel: 'Não informada',
    nextAppointment: null,
    completedCount: 0,
    packageSummary: null,
    anamnese: null,
    latestEvolution: null,
    formatDate: (value) => value,
    formatWeekday: (value) => value,
    formatPhone: (value) => value,
  });

  assert.equal(result.statusCards[0].value, 'Sem próximos atendimentos');
  assert.equal(result.statusCards[2].value, 'Sem pacote ativo');
  assert.equal(result.statusCards[3].value, 'Sem evolução');
  assert.match(result.sections[0].body, /Sem agendamentos futuros/);
  assert.match(result.sections[1].body, /Sem pacote ativo/);
  assert.match(result.sections[2].body, /Sem resumo clínico/);
  assert.match(result.sections[3].body, /Nenhuma evolução clínica registrada/);
});

test('buildPatientFichaExportContext creates a coherent export-ready model from ficha sources', () => {
  const result = buildPatientFichaExportContext({
    patient: {
      id: 'p1',
      name: 'Ana Souza',
      whatsapp: '11999998888',
      pathology: 'Lombalgia',
    },
    ageLabel: '34 anos',
    nextAppointment: {
      appointment_date: '2026-06-20',
      start_time: '08:00',
      service_name: 'Fisioterapia ortopedica',
    },
    completedCount: 5,
    packageSummary: {
      label: 'Ortopedia',
      used: 3,
      total: 10,
      remaining: 7,
      alert: 'Faltam 2 sessoes sem agendamento',
    },
    anamnese: {
      chief_complaint: 'Dor lombar',
      clinical_summary: 'Quadro mecanico com piora ao sentar.',
    },
    latestEvolution: {
      date: '2026-06-14',
      conduct: 'Melhora parcial da dor',
      guidance: 'Manter exercicios em casa.',
    },
    formatDate: (value) => `data:${value}`,
    formatWeekday: (value) => `dia:${value}`,
    formatPhone: (value) => `fone:${value}`,
  });

  assert.equal(result.header.name, 'Ana Souza');
  assert.equal(result.summaryModel.statusCards[0].value, 'data:2026-06-20 às 08:00');
  assert.equal(result.exportMeta.pathology, 'Lombalgia');
  assert.equal(result.exportMeta.phone, 'fone:11999998888');
});

test('buildPatientHistorySummaryModel creates empty state and timeline rows for the export modal', () => {
  const filled = buildPatientHistorySummaryModel({
    items: [
      {
        appointment_date: '2026-06-10',
        weekdayLabel: 'Terça-feira',
        start_time: '08:00',
        statusLabel: 'Atendido',
        serviceLabel: 'Avaliacao',
      },
      {
        appointment_date: '2026-06-11',
        weekdayLabel: 'Quarta-feira',
        start_time: '09:00',
        statusLabel: 'Falta',
        serviceLabel: 'Pilates',
      },
    ],
    formatDate: (value) => `data:${value}`,
  });
  const empty = buildPatientHistorySummaryModel({
    items: [],
    formatDate: (value) => value,
  });

  assert.equal(filled.countLabel, '2 registros');
  assert.match(filled.rows[0].body, /Terça-feira/);
  assert.match(filled.rows[1].body, /Falta/);
  assert.deepEqual(filled.summaryCards.map((item) => item.label), ['Atendidos', 'Faltas', 'Futuros']);
  assert.equal(filled.rows[0].statusTone, 'success');
  assert.equal(filled.rows[1].statusTone, 'danger');
  assert.equal(empty.countLabel, 'Sem histórico');
  assert.match(empty.emptyMessage, /Nenhum registro encontrado/);
  assert.equal(empty.summaryCards[0].value, '0');
});
