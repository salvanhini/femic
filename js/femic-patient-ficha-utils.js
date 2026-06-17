(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
    return;
  }
  root.FEMICPatientFichaUtils = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function asText(value){
    return String(value || '').trim();
  }

  function clipText(value, limit){
    value = asText(value).replace(/\s+/g, ' ');
    if(!value) return '';
    if(value.length <= limit) return value;
    return value.slice(0, Math.max(0, limit - 1)).trimEnd() + '…';
  }

  function formatAgeLabel(value){
    return asText(value) || 'Não informada';
  }

  function buildPatientFichaExportContext(input){
    input = input || {};
    var patient = input.patient || {};
    var formatPhone = typeof input.formatPhone === 'function' ? input.formatPhone : function(value){ return asText(value); };
    return {
      header: {
        name: asText(patient.name) || 'Paciente',
        phone: formatPhone(patient.whatsapp || '-') || '-',
        pathology: asText(patient.pathology) || 'Sem patologia registrada',
        age: formatAgeLabel(input.ageLabel)
      },
      exportMeta: {
        patientId: asText(patient.id),
        phone: formatPhone(patient.whatsapp || '-') || '-',
        pathology: asText(patient.pathology) || 'Sem patologia registrada',
        age: formatAgeLabel(input.ageLabel)
      },
      summaryModel: buildPatientFichaSummaryModel(input)
    };
  }

  function buildPatientHistorySummaryModel(input){
    input = input || {};
    var items = Array.isArray(input.items) ? input.items : [];
    var formatDate = typeof input.formatDate === 'function' ? input.formatDate : function(value){ return asText(value); };
    var attended = 0;
    var missed = 0;
    var future = 0;
    function toneForStatus(statusLabel){
      var normalized = asText(statusLabel).toLowerCase();
      if(normalized === 'atendido') return 'success';
      if(normalized === 'falta') return 'danger';
      if(normalized === 'agendado' || normalized === 'confirmado') return 'info';
      return 'neutral';
    }
    items.forEach(function(item){
      var normalized = asText(item && item.statusLabel).toLowerCase();
      if(normalized === 'atendido') attended += 1;
      else if(normalized === 'falta') missed += 1;
      else if(normalized === 'agendado' || normalized === 'confirmado') future += 1;
    });
    return {
      countLabel: items.length ? items.length + ' registro' + (items.length === 1 ? '' : 's') : 'Sem histórico',
      emptyMessage: 'Nenhum registro encontrado para este paciente.',
      summaryCards: [
        { label: 'Atendidos', value: String(attended) },
        { label: 'Faltas', value: String(missed) },
        { label: 'Futuros', value: String(future) }
      ],
      rows: items.map(function(item){
        var time = asText(item.start_time).slice(0, 5);
        var parts = [asText(item.weekdayLabel), time, asText(item.statusLabel), asText(item.serviceLabel)].filter(Boolean);
        return {
          title: formatDate(item.appointment_date),
          body: parts.join(' · '),
          statusLabel: asText(item.statusLabel),
          statusTone: toneForStatus(item.statusLabel),
          serviceLabel: asText(item.serviceLabel),
          weekdayLabel: asText(item.weekdayLabel),
          timeLabel: time
        };
      })
    };
  }

  function buildPatientFichaSummaryModel(input){
    input = input || {};
    var patient = input.patient || {};
    var nextAppointment = input.nextAppointment || null;
    var packageSummary = input.packageSummary || null;
    var anamnese = input.anamnese || null;
    var latestEvolution = input.latestEvolution || null;
    var formatDate = typeof input.formatDate === 'function' ? input.formatDate : function(value){ return asText(value); };
    var formatWeekday = typeof input.formatWeekday === 'function' ? input.formatWeekday : function(value){ return asText(value); };
    var formatPhone = typeof input.formatPhone === 'function' ? input.formatPhone : function(value){ return asText(value); };
    var ageLabel = formatAgeLabel(input.ageLabel);
    var completedCount = Number(input.completedCount || 0);

    var nextStatus = nextAppointment
      ? (formatDate(nextAppointment.appointment_date) + ' às ' + asText(nextAppointment.start_time).slice(0, 5))
      : 'Sem próximos atendimentos';
    var nextBody = nextAppointment
      ? [formatWeekday(nextAppointment.appointment_date), formatDate(nextAppointment.appointment_date), asText(nextAppointment.start_time).slice(0, 5), asText(nextAppointment.service_name || 'Serviço')].filter(Boolean).join(' · ')
      : 'Sem agendamentos futuros.';

    var packageStatus = packageSummary
      ? String(Math.max(0, Number(packageSummary.remaining || 0))) + ' sessões'
      : 'Sem pacote ativo';
    var packageParts = packageSummary
      ? [
          asText(packageSummary.label || 'Pacote ativo'),
          String(Math.max(0, Number(packageSummary.used || 0))) + '/' + String(Math.max(0, Number(packageSummary.total || 0))) + ' usadas',
          'saldo ' + String(Math.max(0, Number(packageSummary.remaining || 0))),
          asText(packageSummary.alert || '')
        ].filter(Boolean)
      : [];
    var packageBody = packageParts.length ? packageParts.join(' · ') : 'Sem pacote ativo no momento.';

    var clinicalLines = [];
    if(anamnese){
      if(asText(anamnese.chief_complaint)) clinicalLines.push(asText(anamnese.chief_complaint));
      if(asText(anamnese.clinical_summary || anamnese.diagnosis)) clinicalLines.push(asText(anamnese.clinical_summary || anamnese.diagnosis));
    }
    var clinicalBody = clinicalLines.length ? clipText(clinicalLines.join(' · '), 220) : 'Sem resumo clínico disponível.';

    var latestStatus = latestEvolution ? formatDate(latestEvolution.date) : 'Sem evolução';
    var latestLines = [];
    if(latestEvolution){
      latestLines.push(formatDate(latestEvolution.date));
      if(asText(latestEvolution.conduct)) latestLines.push(asText(latestEvolution.conduct));
      else if(asText(latestEvolution.guidance)) latestLines.push(asText(latestEvolution.guidance));
    }
    var latestBody = latestLines.length ? clipText(latestLines.join(' · '), 220) : 'Nenhuma evolução clínica registrada.';

    return {
      header: {
        name: asText(patient.name) || 'Paciente',
        whatsapp: formatPhone(patient.whatsapp || '-') || '-',
        age: ageLabel
      },
      statusCards: [
        { label: 'Próximo atendimento', value: nextStatus },
        { label: 'Sessões realizadas', value: String(completedCount) },
        { label: 'Saldo do pacote', value: packageStatus },
        { label: 'Último registro', value: latestStatus }
      ],
      sections: [
        { key: 'next', title: 'Próximo atendimento', body: nextBody },
        { key: 'package', title: 'Pacote atual', body: packageBody },
        { key: 'clinical', title: 'Resumo clínico', body: clinicalBody },
        { key: 'latest', title: 'Último registro', body: latestBody }
      ],
      secondaryActions: [
        { key: 'prontuario', label: 'Abrir prontuário' },
        { key: 'documents', label: 'Abrir documentos' },
        { key: 'export', label: 'Exportar ficha' }
      ]
    };
  }

  return {
    buildPatientFichaExportContext: buildPatientFichaExportContext,
    buildPatientFichaSummaryModel: buildPatientFichaSummaryModel,
    buildPatientHistorySummaryModel: buildPatientHistorySummaryModel
  };
});
