'use strict';
const { S, setState } = require('./session');
const { tag } = require('./log');
const TG_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT   = process.env.TELEGRAM_CHAT_ID;
const URL_AGE   = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';

const MENU_TXT = `Ola! Escolha uma opcao:

1 - Marcar consulta / avaliacao
2 - Duvidas (convenios, tratamento, valores)
3 - Remarcar / cancelar
4 - Falar comigo (equipe da FEMIC)

Digite o numero da opcao desejada.

📍 Digite "voltar" ou "menu" a qualquer momento para ver este menu novamente.`;

const HINT = `📍 Digite "menu" a qualquer momento para voltar.`;

function msgNewPatient() {
  return `Entendi que e sua primeira vez conosco Para agilizar, preencha seus dados pelo link abaixo e nossa equipe confirma o melhor horario:

🔗 ${URL_AGE}

Assim que enviar, ja fico sabendo e retorno por aqui

${HINT}`;
}

function msgExistingPrompt() {
  return `Ja entendi! Voce ja e paciente nosso. Qual dia e horario voce prefere para a consulta?

${HINT}`;
}

function msgHumanTransfer() {
  return `Certo! Estou transferindo para a equipe da FEMIC. Em breve alguem fala com voce por aqui mesmo

${HINT}`;
}

async function notifyTelegram(phone, msg, tipo) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const esc = s => String(s || '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const emoji = tipo === 'booking_existing' ? '📅' : '👤';
  const label = tipo === 'booking_existing' ? 'PACIENTE QUER AGENDAR' : 'PACIENTE QUER FALAR COM HUMANO';
  const text = [`${emoji} *${label}*`, '━━━━━━━━━━━━━━━━━━━', `📱 *WhatsApp:* ${esc(phone)}`, `💬 *Msg:* ${esc((msg || '').slice(0, 200))}`, '━━━━━━━━━━━━━━━━━━━', '✅ Inbox atualizado.'].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: Number(TG_CHAT), text, parse_mode: 'Markdown' }) });
  } catch (e) { tag('Telegram', e.message); }
}

async function handleMenu(sock, jid, phone, text) {
  const opt = text.trim().toLowerCase();

  if (opt === '1' || /^(marcar|agendar|consulta)/i.test(text.trim()) || /marcar|agendar|consulta/.test(opt)) {
    setState(jid, S.EXISTING_PATIENT);
    return { reply: `Ja fez alguma avaliacao conosco antes? (sim / nao)

${HINT}`, storeInbox: false };
  }

  if (opt === '2' || /^(duvida|horario|convenio|valor|preço|preco|tratamento)/i.test(text.trim()) || /duvida|horario|convenio|valor|preço|preco|tratamento/.test(opt)) {
    setState(jid, S.QUESTIONS);
    return { reply: `Claro! Pode perguntar. Sobre convenios, tratamento ou valores, estou aqui para ajudar

${HINT}`, storeInbox: false };
  }

  if (opt === '3' || /^(remarcar|cancelar)/i.test(text.trim()) || /remarcar|cancelar/.test(opt)) {
    setState(jid, S.RESCHEDULE);
    return { reply: `Entendi que quer remarcar. Por favor informe o novo dia e horario desejado e nossa equipe confirma em breve

${HINT}`, storeInbox: false };
  }

  if (opt === '4' || /^(falar|humano|pessoa|equipe|atendente)/i.test(text.trim()) || /falar|humano|pessoa|equipe|atendente/.test(opt)) {
    setState(jid, S.HUMAN);
    notifyTelegram(phone, 'Quer falar com a equipe', 'human').catch(() => {});
    return { reply: msgHumanTransfer(), storeInbox: true, inboxTipo: 'human' };
  }

  // Fallback: vai pro Groq responder naturalmente
  setState(jid, S.QUESTIONS);
  return { reply: null, storeInbox: false };
}

async function handleExistingAnswer(sock, jid, phone, text, intent) {
  const lower = text.trim().toLowerCase();
  if (lower === 'sim' || lower === 's') {
    setState(jid, S.COLLECTING_DATE);
    return { reply: msgExistingPrompt(), storeInbox: false };
  }
  if (lower === 'nao' || lower === 'n' || lower === 'não') {
    setState(jid, S.NEW_PATIENT);
    return { reply: msgNewPatient(), storeInbox: false };
  }
  return { reply: `Por favor, responda "sim" (ja fez) ou "nao" (primeira vez).

${HINT}`, storeInbox: false };
}

module.exports = { MENU_TXT, handleMenu, handleExistingAnswer, msgNewPatient, msgExistingPrompt, notifyTelegram };
