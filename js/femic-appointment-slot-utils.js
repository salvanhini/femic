(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.FEMICAppointmentSlotUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function normalizeTime(value){
    var text = String(value || '').trim();
    if(!text) return '';
    var parts = text.split(':');
    return String(parts[0] || '00').padStart(2, '0') + ':' + String(parts[1] || '00').padStart(2, '0');
  }

  function timeToMin(value){
    var time = normalizeTime(value);
    var parts = time.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }

  function minToTime(value){
    var mins = Math.max(0, Number(value) || 0);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }

  function addMinutes(time, minutes){
    return minToTime(timeToMin(time) + Number(minutes || 0));
  }

  function parsePeriods(settings){
    var text = String(settings && settings.working_periods || '').trim();
    if(!text) text = String(settings && settings.start_time || '08:00') + '-' + String(settings && settings.end_time || '20:00');
    return text.split(',')
      .map(function(part){
        var bits = part.trim().split('-');
        return { start: normalizeTime(bits[0]), end: normalizeTime(bits[1]) };
      })
      .filter(function(period){
        return period.start && period.end && timeToMin(period.end) > timeToMin(period.start);
      });
  }

  function appointmentMode(service){
    return String(service && service.appointment_mode || 'grupo').toLowerCase();
  }

  function serviceCapacity(service, settings){
    var max = Number(service && service.max_patients);
    if(!Number.isFinite(max) || max < 1) max = Number(settings && settings.max_patients_per_slot);
    return Number.isFinite(max) && max > 0 ? max : 4;
  }

  function overlaps(leftStart, leftEnd, rightStart, rightEnd){
    return timeToMin(normalizeTime(leftStart)) < timeToMin(normalizeTime(rightEnd))
      && timeToMin(normalizeTime(rightStart)) < timeToMin(normalizeTime(leftEnd));
  }

  function isActiveBlock(block){
    var status = String(block && block.status || 'active').toLowerCase();
    return status !== 'inactive' && status !== 'reopened' && status !== 'cancelado' && status !== 'cancelled';
  }

  function blockDate(block){
    return String(block && (block.block_date || block.date || block.appointment_date) || '');
  }

  function slotBlocked(candidate, scheduleBlocks){
    return (scheduleBlocks || []).some(function(block){
      if(!isActiveBlock(block)) return false;
      if(blockDate(block) !== String(candidate.appointment_date || '')) return false;
      return overlaps(candidate.start_time, candidate.end_time, block.start_time, block.end_time);
    });
  }

  function activeOverlaps(candidate, appointments){
    return (appointments || []).filter(function(appointment){
      if(String(appointment && appointment.appointment_date || '') !== String(candidate.appointment_date || '')) return false;
      if(String(appointment && appointment.status || '').toLowerCase() === 'cancelado') return false;
      if(candidate.ignore_id && String(appointment.id) === String(candidate.ignore_id)) return false;
      return overlaps(candidate.start_time, candidate.end_time, appointment.start_time, appointment.end_time);
    });
  }

  function slotConflictReason(input){
    var candidate = input && input.candidate || {};
    var servicesById = input && input.servicesById || {};
    var settings = input && input.settings || {};
    var service = servicesById[String(candidate.service_id || '')] || {};

    if(slotBlocked(candidate, input && input.scheduleBlocks || [])) return 'Horário bloqueado manualmente.';

    var overlapsList = activeOverlaps(candidate, input && input.appointments || []);
    if(!overlapsList.length) return '';

    if(appointmentMode(service) === 'individual') return 'Serviço individual exige horário exclusivo.';
    var hasIndividual = overlapsList.some(function(appointment){
      var existingService = servicesById[String(appointment.service_id || '')] || {};
      return appointmentMode(existingService) === 'individual';
    });
    if(hasIndividual) return 'Já existe atendimento individual neste intervalo.';
    if(overlapsList.length >= serviceCapacity(service, settings)) return 'Limite de pacientes simultâneos atingido.';
    return '';
  }

  function periodMatches(start, period){
    var p = String(period || '').toLowerCase();
    var m = timeToMin(start);
    if(p === 'manha') return m < 12 * 60;
    if(p === 'tarde') return m >= 12 * 60 && m < 18 * 60;
    if(p === 'noite') return m >= 18 * 60;
    return true;
  }

  function findSafeAppointmentSlots(input){
    input = input || {};
    var service = (input.servicesById || {})[String(input.serviceId || input.service_id || '')] || {};
    var serviceId = input.serviceId || input.service_id || service.id;
    var duration = Number(input.durationMinutes || input.duration_minutes || service.duration_minutes || 45);
    var step = Number(input.settings && input.settings.slot_interval_minutes || 30);
    var dates = Array.isArray(input.dates) ? input.dates : [input.date || input.appointment_date].filter(Boolean);
    var limit = Math.max(1, Number(input.limit || 5));
    var slots = [];

    dates.forEach(function(date){
      parsePeriods(input.settings || {}).forEach(function(period){
        for(var minute = timeToMin(period.start); minute + duration <= timeToMin(period.end); minute += step){
          var start = minToTime(minute);
          var end = addMinutes(start, duration);
          if(!periodMatches(start, input.period || input.requested_period)) continue;
          var candidate = {
            patient_id: input.patientId || input.patient_id || '',
            service_id: serviceId,
            appointment_date: date,
            start_time: start,
            end_time: end,
            duration_minutes: duration,
            status: 'agendado'
          };
          var reason = slotConflictReason({
            candidate: candidate,
            appointments: input.appointments || [],
            scheduleBlocks: input.scheduleBlocks || [],
            servicesById: input.servicesById || {},
            settings: input.settings || {}
          });
          if(!reason){
            var load = activeOverlaps(candidate, input.appointments || []).length;
            var capacity = serviceCapacity(service, input.settings || {});
            slots.push(Object.assign({}, candidate, {
              date: date,
              start: start,
              end: end,
              load: load,
              capacity: capacity,
              remaining_capacity: Math.max(0, capacity - load)
            }));
          }
        }
      });
    });

    return slots.sort(function(a, b){
      return b.load - a.load
        || String(a.appointment_date).localeCompare(String(b.appointment_date))
        || timeToMin(a.start_time) - timeToMin(b.start_time);
    }).slice(0, limit);
  }

  return {
    activeOverlaps: activeOverlaps,
    addMinutes: addMinutes,
    findSafeAppointmentSlots: findSafeAppointmentSlots,
    normalizeTime: normalizeTime,
    parsePeriods: parsePeriods,
    slotBlocked: slotBlocked,
    slotConflictReason: slotConflictReason,
    timeToMin: timeToMin
  };
});
