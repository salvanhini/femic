(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICWhatsappReminderUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function normalizeWhatsappProvider(value){
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'baileys' || normalized === 'api' || normalized === 'wa_me'
      ? normalized
      : 'wa_me';
  }

  function normalizePhone(value){
    var digits = String(value || '').replace(/\D/g, '');
    if(!digits) return '';
    if(digits.length === 10 || digits.length === 11) return '55' + digits;
    if(digits.length === 12 || digits.length === 13) return digits;
    return '';
  }

  function normalizeAppointmentStatus(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function appointmentDateTime(appointment, field){
    var date = String(appointment && appointment.appointment_date || '');
    var time = String((appointment && appointment[field || 'start_time']) || appointment && appointment.start_time || '00:00').slice(0, 5);
    var dt = new Date(date + 'T' + time + ':00');
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function reminderDueAt(appointment, options){
    var base = appointmentDateTime(appointment, 'start_time');
    var hoursBefore = Number(options && options.hoursBefore);
    if(!base) return null;
    if(!Number.isFinite(hoursBefore)) hoursBefore = 12;
    return new Date(base.getTime() - (hoursBefore * 60 * 60 * 1000));
  }

  function reminderAlreadyHandled(appointment){
    if(!appointment) return false;
    if(appointment.appointment_reminder_sent || appointment.reminder_sent) return true;
    return String(appointment.appointment_reminder_delivery_status || '').toLowerCase() === 'sent';
  }

  function buildAppointmentReminderAuditPatch(input){
    var sentAt = String(input && input.sentAt || new Date().toISOString());
    var provider = normalizeWhatsappProvider(input && input.provider);
    var deliveryStatus = String(input && input.deliveryStatus || 'sent').trim().toLowerCase();
    var delivered = deliveryStatus === 'sent' || deliveryStatus === 'delivered';
    return {
      appointment_reminder_sent: delivered,
      appointment_reminder_sent_at: delivered ? sentAt : null,
      reminder_sent: delivered,
      reminder_sent_at: delivered ? sentAt : null,
      appointment_reminder_provider_used: provider,
      appointment_reminder_delivery_status: deliveryStatus,
      appointment_reminder_error_message: input && input.errorMessage ? String(input.errorMessage) : null,
      appointment_reminder_last_attempt_at: sentAt,
      appointment_reminder_external_id: input && input.externalMessageId ? String(input.externalMessageId) : null
    };
  }

  function getDueWhatsappConfirmationReminders(input){
    var appointments = Array.isArray(input && input.appointments) ? input.appointments : [];
    var patientsById = input && input.patientsById || {};
    var servicesById = input && input.servicesById || {};
    var now = new Date(input && input.now || Date.now());
    var hoursBefore = Number(input && input.hoursBefore);
    if(!Number.isFinite(hoursBefore)) hoursBefore = 12;

    return appointments
      .filter(function(appointment){
        var status = normalizeAppointmentStatus(appointment && appointment.status);
        var startAt = appointmentDateTime(appointment, 'start_time');
        var patient = patientsById[String(appointment && appointment.patient_id || '')];
        var phone = normalizePhone(patient && patient.whatsapp);
        var dueAt = reminderDueAt(appointment, { hoursBefore: hoursBefore });

        if(status !== 'agendado' && status !== 'confirmado') return false;
        if(reminderAlreadyHandled(appointment)) return false;
        if(!startAt || !dueAt) return false;
        if(!phone) return false;
        if(dueAt.getTime() > now.getTime()) return false;
        if(startAt.getTime() < now.getTime()) return false;
        return true;
      })
      .map(function(appointment){
        var patient = patientsById[String(appointment && appointment.patient_id || '')] || {};
        var service = servicesById[String(appointment && appointment.service_id || '')] || {};
        return {
          appointment: appointment,
          patient: patient,
          service: service,
          phone: normalizePhone(patient.whatsapp),
          dueAt: reminderDueAt(appointment, { hoursBefore: hoursBefore })
        };
      })
      .sort(function(left, right){
        return left.dueAt.getTime() - right.dueAt.getTime();
      });
  }

  return {
    appointmentDateTime: appointmentDateTime,
    buildAppointmentReminderAuditPatch: buildAppointmentReminderAuditPatch,
    getDueWhatsappConfirmationReminders: getDueWhatsappConfirmationReminders,
    normalizeAppointmentStatus: normalizeAppointmentStatus,
    normalizeWhatsappProvider: normalizeWhatsappProvider,
    reminderDueAt: reminderDueAt
  };
});
