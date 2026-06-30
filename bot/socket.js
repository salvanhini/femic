'use strict';
const path = require('path');
const fs   = require('fs/promises');
const { Browsers, DisconnectReason, fetchLatestWaWebVersion, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino   = require('pino');
const qrcode = require('qrcode-terminal');
const { tag } = require('./log');
const { updateStatus } = require('./supabase');
const { S, getSession, setState, touch } = require('./session');
const { handleMenu, handleExistingAnswer, MENU_TXT } = require('./menu');

const SVC_NAME  = process.env.WHATSAPP_SERVICE_NAME || 'baileys-main';
const AUTH_DIR  = path.join(__dirname, 'auth-' + SVC_NAME);
const LOGIN     = (process.env.WHATSAPP_LOGIN_METHOD || 'qr').trim();
const PAIR_PHONE = (process.env.WHATSAPP_PAIRING_PHONE || '').replace(/\D/g, '');
const RESET     = process.env.RESET_SESSION === 'true';

let sock        = null;
let sockGen     = 0;
let connected   = false;
let everConn    = false;
let reconnTimer = null;
let resetBusy   = false;
let starting    = false;
let consec515   = 0;

function closeSock() { if (sock) { try { sock.end(); } catch (_) {} sock = null; sockGen++; } }

function scheduleReconnect(ms, fn) {
  if (reconnTimer) return;
  reconnTimer = setTimeout(() => { reconnTimer = null; (fn || startBot)().catch(e => { tag('Reconn', e.message); scheduleReconnect(20000); }); }, ms);
}

async function resetSession(reason) {
  if (resetBusy) return;
  resetBusy = true;
  tag('Auth', 'Resetando sessao. Motivo:', reason);
  closeSock();
  await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(e => tag('Auth', 'Erro ao deletar auth:', e.message));
  resetBusy = false;
  scheduleReconnect(5000);
}

function jidToPhone(jid) {
  if (!jid) return '';
  if (jid.endsWith('@lid')) return jid;
  return jid.replace(/\D/g, '');
}

function delay() { return new Promise(r => setTimeout(r, 1000 + Math.random() * 2000)); }

async function startBot() {
  if (starting) return;
  starting = true;
  try {
    if (RESET) {
      closeSock();
      await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
      tag('Auth', 'RESET_SESSION ativo. Remova a variavel apos conectar.');
    }
    connected = false;

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const { version, isLatest } = await fetchLatestWaWebVersion();
    tag('Bot', 'WhatsApp Web v' + version.join('.') + (isLatest ? ' (latest)' : ''));
    closeSock();

    sock = makeWASocket({
      auth: state, version, printQRInTerminal: false,
      logger: pino({ level: 'warn' }), browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: true, syncFullHistory: false,
      connectTimeoutMs: 60000, retryRequestDelayMs: 2000,
      keepAliveIntervalMs: 25000,
      fireInitQueries: false,
    });

    if (!state.creds.registered && LOGIN === 'pairing' && PAIR_PHONE) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PAIR_PHONE);
          console.log('\n=== CODIGO DE PAREAMENTO ===\nNumero: +' + PAIR_PHONE + '\nCodigo: ' + code + '\n');
        } catch (e) { tag('Pair', e.message); }
      }, 3000);
    }

    const curGen = sockGen;

    sock.ev.on('connection.update', async (u) => {
      if (curGen !== sockGen) return;
      if (u.qr) {
        console.log('\n=== QR CODE — escaneie no WhatsApp ===\n');
        qrcode.generate(u.qr, { small: true });
        console.log('');
      }
      if (u.connection === 'open') {
        connected = true; everConn = true; consec515 = 0;
        if (reconnTimer) { clearTimeout(reconnTimer); reconnTimer = null; }
        tag('Bot', 'Conectado!');
        updateStatus(SVC_NAME, 'connected');
      }
      if (u.connection === 'close') {
        connected = false;
        const code   = u.lastDisconnect?.error?.output?.statusCode;
        const reason = u.lastDisconnect?.error?.message || 'desconhecido';
        tag('Bot', 'Desconectado. Codigo:', code || '?', '| Motivo:', reason);
        if (u.lastDisconnect?.error?.data) {
          tag('Bot', 'Dados do erro:', JSON.stringify(u.lastDisconnect.error.data).slice(0, 500));
        }
        if (code === 515 || code === 405) {
          consec515++;
          const delay = consec515 >= 3 ? 120000 : consec515 >= 2 ? 60000 : 30000;
          tag('Bot', `515 consecutivo #${consec515}, reconectando em ${delay/1000}s`);
          closeSock();
          updateStatus(SVC_NAME, 'reconnecting', reason);
          scheduleReconnect(delay);
          return;
        }
        if (code === DisconnectReason.loggedOut) {
          updateStatus(SVC_NAME, 'logged_out', reason);
          await resetSession(reason);
        } else {
          updateStatus(SVC_NAME, 'reconnecting', reason);
          scheduleReconnect(10000);
        }
      }
    });

    sock.ev.on('creds.update', (creds) => { if (curGen === sockGen) saveCreds(creds); });
    sock.ev.on('messages.upsert', ({ messages }) => {
      if (curGen !== sockGen || !messages) return;
      for (const m of messages) handleMessage(sock, m).catch(e => tag('Msg', e.message));
    });

  } finally { starting = false; }
}

async function handleMessage(activeSock, msg) {
  if (msg.key.fromMe) return;
  if (msg.key.remoteJid?.endsWith('@g.us')) return;
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '').trim();
  if (!text) return;
  const jid   = msg.key.remoteJid;
  const phone = jidToPhone(jid);
  tag('Msg', phone.slice(0,6) + '***:', text.slice(0,80));

  const { generateReply }  = require('./reply');
  const { bookingNew } = require('./booking');
  const { storeInbox, storeInboxTyped, getHistory } = require('./supabase');

  const session = getSession(jid);
  touch(jid);

  // "voltar" / "menu" / "0" — sempre volta pro MENU
  if (/^(voltar|menu|0)$/i.test(text.trim())) {
    setState(jid, S.MENU);
    await delay();
    await activeSock.sendMessage(jid, { text: MENU_TXT });
    return;
  }

  // session-based routing
  if (session.state === S.MENU) {
    const result = await handleMenu(activeSock, jid, phone, text);
    storeInbox(phone, text, null, !result.storeInbox, jid).catch(() => {});
    await delay();
    await activeSock.sendMessage(jid, { text: result.reply });
    return;
  }

  if (session.state === S.EXISTING_PATIENT) {
    const result = await handleExistingAnswer(activeSock, jid, phone, text);
    storeInbox(phone, text, null, true, jid).catch(() => {});
    await delay();
    await activeSock.sendMessage(jid, { text: result.reply });
    return;
  }

  if (session.state === S.NEW_PATIENT) {
    storeInbox(phone, text, null, true, jid).catch(() => {});
    await bookingNew(activeSock, jid, phone);
    return;
  }

  if (session.state === S.COLLECTING_DATE) {
    storeInboxTyped(phone, text, 'booking_existing', false, jid).catch(() => {});
    await delay();
    await activeSock.sendMessage(jid, { text: 'Anotei! Nossa equipe vai verificar a disponibilidade e confirma em breve.\n\n📍 Digite "menu" a qualquer momento para voltar.' });
    const { notifyTelegram } = require('./menu');
    notifyTelegram(phone, 'Prefere: ' + text.slice(0, 200), 'booking_existing').catch(() => {});
    setState(jid, S.MENU);
    return;
  }

  if (session.state === S.HUMAN) {
    storeInboxTyped(phone, text, 'human', false, jid).catch(() => {});
    return;
  }

  if (session.state === S.RESCHEDULE) {
    storeInboxTyped(phone, text, 'reschedule', false, jid).catch(() => {});
    await delay();
    await activeSock.sendMessage(jid, { text: 'Anotei! Nossa equipe vai analisar e retorna em breve.\n\n📍 Digite "menu" a qualquer momento para voltar.' });
    setState(jid, S.MENU);
    return;
  }

  // QUESTIONS — Groq responde, permanece em QUESTIONS (não volta pro MENU)
  // Para sair, paciente digita "menu"/"voltar"/"0"
  if (session.state === S.QUESTIONS) {
    try { await activeSock.sendPresenceUpdate('composing', jid); } catch (_) {}
    const history = await getHistory(phone, 4);
    const reply   = await generateReply('duvida', text, history);
    storeInbox(phone, text, { category: 'duvida', confidence: 0.8 }, true, jid).catch(() => {});
    if (reply) {
      await delay();
      await activeSock.sendMessage(jid, { text: reply });
    }
    try { await activeSock.sendPresenceUpdate('paused', jid); } catch (_) {}
    return;
  }

  // fallback — mostra o menu
  setState(jid, S.MENU);
  await delay();
  await activeSock.sendMessage(jid, { text: MENU_TXT });
}

module.exports = { startBot, closeSock, getSock: () => sock, isConnected: () => connected, jidToPhone };
