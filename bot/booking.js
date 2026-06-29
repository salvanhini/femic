'use strict';
const { pollTask, storeInboxTyped } = require('./supabase');
const { tag } = require('./log');
const { forget } = require('./session');

const URL_AGE = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';
const TG_API  = 'https://api.telegram.org/bot';
const pending = new Map();

async function notifyTelegram(task, phone) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const esc = s => String(s || '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const text = ['📋 *NOVA PENDENCIA DE AVALIACAO*', '━━━━━━━━━━━━━━━━━━━', '👤 *Nome:* ' + esc(task.patient_name || 'Nao informado'), '📱 *WhatsApp:* ' + esc(phone || task.phone), '💬 *Obs:* ' + esc((task.notes || '').slice(0, 150) || 'Sem observacao'), '━━━━━━━━━━━━━━━━━━━', '✅ Registrado automaticamente no sistema.'].join('\n');
  try {
    await fetch(TG_API + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: Number(chatId), text, parse_mode: 'Markdown' }) });
    tag('Telegram', 'Notificacao enviada.');
  } catch (e) { tag('Telegram', e.message); }
}

function msgWelcome() { return 'Ola! Aqui e da FEMIC Fisioterapia!\n\nFico feliz que queira agendar uma avaliacao! Para agilizar, preencha seus dados pelo link abaixo:\n🔗 ' + URL_AGE + '\n\nAssim que enviar, confirmamos o melhor horario pra voce! 💙'; }
function msgConfirmation(task) { return 'Recebemos seus dados, ' + (task?.patient_name || 'paciente') + '! ✅\n\nSua solicitacao esta registrada. Em breve a equipe confirma o horario pelo WhatsApp.\n\nQualquer duvida e so chamar! 💙 — FEMIC Fisioterapia'; }

async function bookingNew(sock, jid, phone) {
  if (pending.has(phone)) { tag('Booking', 'Ja em andamento:', phone.slice(0,6) + '***'); return; }
  pending.set(phone, Date.now());
  tag('Booking', 'Novo lead:', phone.slice(0,6) + '***');
  try {
    await sock.sendMessage(jid, { text: msgWelcome() });
    const task = await pollTask(phone);
    if (task) {
      tag('Booking', 'Formulario recebido! Task:', task.id);
      await sock.sendMessage(jid, { text: msgConfirmation(task) });
      notifyTelegram(task, phone).catch(() => {});
    } else {
      tag('Booking', 'Timeout. Lead nao preencheu formulario:', phone.slice(0,6) + '***');
    }
  } catch (e) { tag('Booking', 'Erro:', e.message); }
  finally { pending.delete(phone); forget(jid); }
}

module.exports = { bookingNew };
