function pad2(value) {
  return String(value).padStart(2, '0');
}

function timeToMinutes(time) {
  const parts = String(time || '00:00').slice(0, 5).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTime(totalMinutes) {
  const minutes = Math.max(0, Math.min(1439, totalMinutes));
  return pad2(Math.floor(minutes / 60)) + ':' + pad2(minutes % 60);
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = {};
  formatter.formatToParts(date).forEach(function(part) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  });
  return parts;
}

function buildReminderWindow(input) {
  const hoursBefore = Number(input && input.hoursBefore) || 12;
  const toleranceMinutes = Number(input && input.toleranceMinutes) || 30;
  const timeZone = (input && input.timeZone) || 'America/Sao_Paulo';
  const now = new Date((input && input.now) || Date.now());
  const target = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
  const parts = zonedParts(target, timeZone);
  const targetTime = pad2(parts.hour) + ':' + pad2(parts.minute);
  const targetMinutes = timeToMinutes(targetTime);

  return {
    targetDate: parts.year + '-' + parts.month + '-' + parts.day,
    targetTime: targetTime,
    fromTime: minutesToTime(targetMinutes - toleranceMinutes),
    toTime: minutesToTime(targetMinutes + toleranceMinutes),
  };
}

function normalizeWhatsappPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return '';
}

function normalizeWhatsappJid(value) {
  const raw = String(value || '').trim();
  if (raw.includes('@s.whatsapp.net')) return raw;
  const phone = normalizeWhatsappPhone(raw);
  return phone ? phone + '@s.whatsapp.net' : '';
}

function buildReminderUpdate(input) {
  const status = String((input && input.status) || 'sent').trim().toLowerCase();
  const delivered = status === 'sent' || status === 'delivered';
  const now = String((input && input.now) || new Date().toISOString());

  const update = {
    appointment_reminder_sent: delivered,
    appointment_reminder_sent_at: delivered ? now : null,
    appointment_reminder_provider_used: 'baileys',
    appointment_reminder_delivery_status: status,
    appointment_reminder_error_message: input && input.error ? String(input.error) : null,
    appointment_reminder_last_attempt_at: now,
    reminder_sent: delivered,
    reminder_sent_at: delivered ? now : null,
  };

  if (input && input.externalId) update.appointment_reminder_external_id = input.externalId;
  return update;
}

module.exports = {
  buildReminderUpdate,
  buildReminderWindow,
  normalizeWhatsappJid,
  normalizeWhatsappPhone,
};
