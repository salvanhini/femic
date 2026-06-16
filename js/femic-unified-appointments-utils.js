(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICUnifiedAppointmentsUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function sortAppointmentsNewestFirst(list){
    return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
      var left = String(b && b.appointment_date || '') + String(b && b.start_time || '');
      var right = String(a && a.appointment_date || '') + String(a && a.start_time || '');
      return left.localeCompare(right);
    });
  }

  function getCompletedAgendaAppointmentsByPatient(appointments, patientId){
    return sortAppointmentsNewestFirst((appointments || []).filter(function(item){
      return String(item && item.patient_id) === String(patientId) && String(item && item.status) === 'concluido';
    }));
  }

  return {
    getCompletedAgendaAppointmentsByPatient: getCompletedAgendaAppointmentsByPatient,
    sortAppointmentsNewestFirst: sortAppointmentsNewestFirst
  };
});
