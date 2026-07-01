'use strict';
const { tag } = require('./log');
const TG_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT   = process.env.TELEGRAM_CHAT_ID;

function detectHuman(text) {
  const t = text.trim().toLowerCase();
  if (/(quero|preciso|gostaria).{0,20}(falar|fala)\s+(com|comigo)/i.test(t)) return true;
  if (/falar\s+(com|comigo|com\s+a)/i.test(t) && /(humano|pessoa|equipe|atendente|secretaria|dr[a]?\.?)/i.test(t)) return true;
  if (/(quero|preciso|pode).{0,20}(algu[ée]m|humano|pessoa|atendente)/i.test(t)) return true;
  return false;
}

async function notifyTelegram(phone, msg, tipo) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const esc = s => String(s || '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const emoji = '👤';
  const label = 'PACIENTE QUER FALAR COM HUMANO';
  const text = [`${emoji} *${label}*`, '━━━━━━━━━━━━━━━━━━━', `📱 *WhatsApp:* ${esc(phone)}`, `💬 *Msg:* ${esc((msg || '').slice(0, 200))}`, '━━━━━━━━━━━━━━━━━━━', '✅ Inbox atualizado.'].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: Number(TG_CHAT), text, parse_mode: 'Markdown' }) });
  } catch (e) { tag('Telegram', e.message); }
}

module.exports = { detectHuman, notifyTelegram };
