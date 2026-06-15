(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICClinicalUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function normalizeText(value){
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function joinParts(parts){
    return parts.map(normalizeText).filter(Boolean).join(' ');
  }

  function calculateAge(birthDate, referenceDate){
    if(!birthDate) return null;
    var birth = new Date(String(birthDate) + 'T00:00:00');
    if(Number.isNaN(birth.getTime())) return null;
    var ref = referenceDate ? new Date(String(referenceDate) + 'T00:00:00') : new Date();
    if(Number.isNaN(ref.getTime())) ref = new Date();
    var age = ref.getFullYear() - birth.getFullYear();
    var hasBirthdayPassed =
      ref.getMonth() > birth.getMonth() ||
      (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
    if(!hasBirthdayPassed) age -= 1;
    return age >= 0 ? age : null;
  }

  function getAgeSupportNote(age){
    if(!Number.isFinite(age)) return '';
    if(age <= 17) return 'Faixa jovem: confirme crescimento, carga esportiva, rotina escolar e sinais de alerta para trauma ou doença sistêmica.';
    if(age >= 60) return 'Faixa mais velha: considere apresentação multifatorial, recuperação mais gradual, comorbidades e impacto funcional na autonomia.';
    return 'Use a idade como contexto clínico discreto para prevalência, recuperação e tolerância de carga, sem automatizar conduta.';
  }

  function buildLegacyAnamneseFields(structured){
    structured = structured || {};
    return {
      chief_complaint: normalizeText(structured.queixa_principal),
      history: normalizeText(structured.historia_organizada),
      diagnosis: normalizeText(structured.sintese_clinica || structured.observacoes_clinicas),
      limitations: joinParts([
        structured.atividade_fisica_relacao_com_quadro,
        structured.medos_e_evitacao
      ]),
      goals: normalizeText(structured.objetivos_expectativas),
      obs: [
        structured.red_flags_check ? 'Red flags: ' + normalizeText(structured.red_flags_check) : '',
        structured.tratamentos_previos_e_percepcao ? 'Tratamentos prévios: ' + normalizeText(structured.tratamentos_previos_e_percepcao) : '',
        structured.fatores_psicossociais ? 'Fatores psicossociais: ' + normalizeText(structured.fatores_psicossociais) : '',
        structured.ocupacao_rotina_trabalho ? 'Rotina/ocupação: ' + normalizeText(structured.ocupacao_rotina_trabalho) : '',
        structured.observacoes_clinicas ? 'Observações: ' + normalizeText(structured.observacoes_clinicas) : ''
      ].filter(Boolean).join(' | ')
    };
  }

  function shouldShowAppointmentPackageAlert(appointment, stats){
    if(!appointment || !stats || !stats.alert || !stats.lastFuture) return false;
    return String(appointment.id || '') === String(stats.lastFuture.id || '');
  }

  function packageAlertCopy(stats){
    if(!stats || !stats.alert) return '';
    return stats.futureCount ? 'Última sessão futura do pacote' : 'Saldo sem agenda suficiente';
  }

  return {
    buildLegacyAnamneseFields: buildLegacyAnamneseFields,
    calculateAge: calculateAge,
    getAgeSupportNote: getAgeSupportNote,
    packageAlertCopy: packageAlertCopy,
    shouldShowAppointmentPackageAlert: shouldShowAppointmentPackageAlert
  };
});
