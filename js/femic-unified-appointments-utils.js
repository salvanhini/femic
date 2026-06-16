(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICUnifiedAppointmentsUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function normalizeAppointmentStatus(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function sortAppointmentsNewestFirst(list){
    return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
      var left = String(b && b.appointment_date || '') + String(b && b.start_time || '');
      var right = String(a && a.appointment_date || '') + String(a && a.start_time || '');
      return left.localeCompare(right);
    });
  }

  function sortAppointmentsOldestFirst(list){
    return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
      var left = String(a && a.appointment_date || '') + String(a && a.start_time || '');
      var right = String(b && b.appointment_date || '') + String(b && b.start_time || '');
      return left.localeCompare(right);
    });
  }

  function getCompletedAgendaAppointmentsByPatient(appointments, patientId){
    return sortAppointmentsNewestFirst((appointments || []).filter(function(item){
      return String(item && item.patient_id) === String(patientId) && normalizeAppointmentStatus(item && item.status) === 'concluido';
    }));
  }

  function buildPatientAppointmentSnapshot(appointments, patientId, todayIso){
    var patientAppointments = sortAppointmentsOldestFirst((appointments || []).filter(function(item){
      return String(item && item.patient_id) === String(patientId);
    }));
    var completedAppointments = sortAppointmentsNewestFirst(patientAppointments.filter(function(item){
      return normalizeAppointmentStatus(item && item.status) === 'concluido';
    }));
    var nextAppointments = patientAppointments.filter(function(item){
      var status = normalizeAppointmentStatus(item && item.status);
      if(status !== 'agendado' && status !== 'confirmado') return false;
      return !todayIso || String(item && item.appointment_date || '') >= String(todayIso);
    });

    return {
      all: patientAppointments,
      completed: completedAppointments,
      nextAppointments: nextAppointments
    };
  }

  return {
    buildPatientAppointmentSnapshot: buildPatientAppointmentSnapshot,
    getCompletedAgendaAppointmentsByPatient: getCompletedAgendaAppointmentsByPatient,
    normalizeAppointmentStatus: normalizeAppointmentStatus,
    sortAppointmentsOldestFirst: sortAppointmentsOldestFirst,
    sortAppointmentsNewestFirst: sortAppointmentsNewestFirst
  };
});
