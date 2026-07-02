'use strict';
const { tag }   = require('./log');
const { fetchDueReminders, markReminderSent, getTemplate } = require('./supabase');

function normalizeJid(raw) {
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  let d = String(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (!d.startsWith('55')) d = '55' + d;
  return d + '@s.whatsapp.net';
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

async function sendReminders(sock) {
  if (!sock) return;
  const apts = await fetchDueReminders();
  if (!apts.length) { tag('Reminder', 'Nenhum lembrete.'); return; }
  tag('Reminder', apts.length + ' lembrete(s).');
  const tpl = await getTemplate();
  for (let i = 0; i < apts.length; i++) {
    const apt = apts[i];
    const p   = apt.patients;
    const jid = normalizeJid(p.whatsapp);
    if (!jid) continue;
    const msg = tpl.replace(/\{nome\}/g, p.name || 'Paciente').replace(/\{data\}/g, formatDate(apt.appointment_date)).replace(/\{hora\}/g, (apt.start_time || '').slice(0, 5));
    try {
      await sock.sendMessage(jid, { text: msg });
      await markReminderSent(apt.id, 'sent');
      tag('Reminder', 'Enviado para', p.name);
    } catch (e) {
      await markReminderSent(apt.id, 'failed', e.message);
      tag('Reminder', 'Erro para', p.name, e.message);
    }
    if (i < apts.length - 1) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
    }
  }
}

module.exports = { sendReminders };
