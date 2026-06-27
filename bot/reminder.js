const { fetchDueReminders, markReminderSent, updateServiceStatus, getTemplate } = require('./supabase.js');
const { normalizeWhatsappJid } = require('./reminder-utils.js');

async function processReminders(sock) {
  const hoursBefore = process.env.HOURS_BEFORE || '12';
  const appointments = await fetchDueReminders(hoursBefore);

  if (!appointments.length) {
    console.log('Nenhum lembrete pendente.');
    return;
  }

  console.log(appointments.length + ' lembrete(s) pendente(s).');
  const template = await getTemplate();

  for (const apt of appointments) {
    const patient = apt.patients;
    if (!patient || !patient.whatsapp) continue;

    const jid = normalizeWhatsappJid(patient.whatsapp);
    if (!jid) continue;

    const message = template
      .replace(/\{nome\}/g, patient.name || 'Paciente')
      .replace(/\{data\}/g, formatDate(apt.appointment_date))
      .replace(/\{hora\}/g, (apt.start_time || '').slice(0, 5));

    try {
      await sock.sendMessage(jid, { text: message });
      await markReminderSent(apt.id, { status: 'sent' });
      await updateServiceStatus({ connectionStatus: 'connected', lastMessageAt: new Date().toISOString() });
      console.log('Enviado para ' + patient.name);
    } catch (err) {
      console.error('Erro ao enviar para ' + patient.name + ':', err.message);
      await markReminderSent(apt.id, { status: 'failed', error: err.message });
    }
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

module.exports = { processReminders };
