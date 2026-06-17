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

  function toPatientHistoryStatusLabel(status){
    var normalized = normalizeAppointmentStatus(status);
    if(normalized === 'concluido') return 'Atendido';
    if(normalized === 'cancelado') return 'Falta';
    if(normalized === 'agendado') return 'Agendado';
    if(normalized === 'confirmado') return 'Confirmado';
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Desconhecido';
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

  function getPatientHistoryExportItems(appointments, patientId, serviceNameResolver){
    var resolveServiceName = typeof serviceNameResolver === 'function'
      ? serviceNameResolver
      : function(){ return 'Serviço'; };
    return sortAppointmentsOldestFirst((appointments || []).filter(function(item){
      return String(item && item.patient_id) === String(patientId);
    })).map(function(item){
      return {
        id: item && item.id,
        patient_id: item && item.patient_id,
        service_id: item && item.service_id,
        appointment_date: String(item && item.appointment_date || ''),
        start_time: String(item && item.start_time || ''),
        status: item && item.status,
        statusLabel: toPatientHistoryStatusLabel(item && item.status),
        serviceLabel: resolveServiceName(item && item.service_id, item)
      };
    });
  }

  return {
    buildPatientAppointmentSnapshot: buildPatientAppointmentSnapshot,
    getCompletedAgendaAppointmentsByPatient: getCompletedAgendaAppointmentsByPatient,
    getPatientHistoryExportItems: getPatientHistoryExportItems,
    normalizeAppointmentStatus: normalizeAppointmentStatus,
    sortAppointmentsOldestFirst: sortAppointmentsOldestFirst,
    sortAppointmentsNewestFirst: sortAppointmentsNewestFirst,
    toPatientHistoryStatusLabel: toPatientHistoryStatusLabel
  };
});
