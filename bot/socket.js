'use strict';
const path = require('path');
const fs   = require('fs/promises');
const { Browsers, DisconnectReason, fetchLatestWaWebVersion, makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino   = require('pino');
const qrcode = require('qrcode-terminal');
const { tag } = require('./log');
const { updateStatus, patientExists } = require('./supabase');
const { S, getSession, setState, touch } = require('./session');
const { detectHuman, notifyTelegram } = require('./menu');
const { staffReplied, isMuted, loadMutes } = require('./mute');

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
function smartDelay(text) {
  const ms = text && text.length < 80 ? 1000 : text && text.length < 180 ? 1800 : 2500;
  return new Promise(r => setTimeout(r, ms + Math.random() * 800));
}

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
        const { sb } = require('./supabase');
        loadMutes(sb);
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
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (curGen !== sockGen || !messages || type !== 'notify') return;
      for (const m of messages) {
        if (m.key.fromMe && !m.key.remoteJid?.endsWith('@g.us')) {
          staffReplied(m.key.remoteJid);
        }
        handleMessage(sock, m).catch(e => tag('Msg', e.message));
      }
    });

  } finally { starting = false; }
}

async function handleMessage(activeSock, msg) {
  if (msg.key.fromMe) return;
  if (msg.key.remoteJid?.endsWith('@g.us')) return;

  // Extrai texto ou áudio
  let text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '').trim();

  // Áudio → transcrição com Whisper
  if (!text && msg.message?.audioMessage) {
    try {
      const buffer = await downloadMediaMessage(msg, {});
      const { transcribeAudio } = require('./transcribe');
      text = (await transcribeAudio(buffer)) || '';
    } catch (_) {}
  }

  if (!text) return;
  const jid   = msg.key.remoteJid;
  const phone = jidToPhone(jid);
  const senderName = msg.pushName || '';

  // Verifica se esse paciente está mutado (staff respondeu ou mute manual)
  if (isMuted(jid)) return;

  tag('Msg', phone.slice(0,6) + '***:', text.slice(0,80));

  const { generateReply } = require('./reply');
  const { storeInboxTyped } = require('./supabase');
  const session = getSession(jid);
  touch(jid);

  // HUMAN — detecta antes de Groq
  if (detectHuman(text)) {
    setState(jid, S.HUMAN);
    storeInboxTyped(phone, text, 'human', false, jid, senderName).catch(() => {});
    notifyTelegram(phone, text, 'human').catch(() => {});
    await smartDelay(text);
    await activeSock.sendMessage(jid, { text: 'Certo! Estou transferindo para nossa equipe. Em breve alguem fala com voce por aqui mesmo. 😊' });
    return;
  }

  // HUMAN state — só armazena, bot não responde
  if (session.state === S.HUMAN) {
    storeInboxTyped(phone, text, 'human', false, jid, senderName).catch(() => {});
    return;
  }

  // TUDO o resto → Groq responde naturalmente
  setState(jid, S.QUESTIONS);

  // Descobre se é paciente existente (só para números regulares)
  let patientContext = '';
  if (phone && !phone.endsWith('@lid')) {
    try {
      const exists = await patientExists(phone);
      if (exists) patientContext = ' (paciente existente)';
    } catch (_) {}
  }

  // Monta histórico da sessão em memória
  if (!session.msgs) session.msgs = [];
  session.msgs.push({ role: 'user', content: text.slice(0, 2000) });
  const histArr = session.msgs
    .filter(m => m.role === 'user')
    .slice(-6)
    .map(m => ({ message_text: m.content }));

  try { await activeSock.sendPresenceUpdate('composing', jid); } catch (_) {}
  const reply = await generateReply('geral', text, histArr, senderName);
  if (reply) {
    session.msgs.push({ role: 'assistant', content: reply });
    if (session.msgs.length > 40) session.msgs = session.msgs.slice(-40);
    await smartDelay(reply);
    await activeSock.sendMessage(jid, { text: reply });
  }
  try { await activeSock.sendPresenceUpdate('paused', jid); } catch (_) {}
}

module.exports = { startBot, closeSock, getSock: () => sock, isConnected: () => connected, jidToPhone };
