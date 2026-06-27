require('dotenv/config');
const fs = require('fs/promises');
const {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { processReminders } = require('./reminder.js');
const { updateServiceStatus } = require('./supabase.js');
const { detectIntent } = require('./intent-detector.js');
const { handleBookingIntent, getPhoneFromJid } = require('./booking-flow.js');

const serviceName = process.env.WHATSAPP_SERVICE_NAME || 'baileys-main';
const authDir = './baileys-auth-' + serviceName;
const checkInterval = (Number(process.env.CHECK_INTERVAL_MINUTES) || 5) * 60 * 1000;
const heartbeatInterval = (Number(process.env.HEARTBEAT_INTERVAL_SECONDS) || 60) * 1000;
const loginMethod = String(process.env.WHATSAPP_LOGIN_METHOD || 'qr').trim().toLowerCase();
const pairingPhone = String(process.env.WHATSAPP_PAIRING_PHONE || process.env.FEMIC_BAILEYS_PAIRING_PHONE || '').replace(/\D/g, '');
let latestSock = null;
let whatsappConnected = false;
let schedulerStarted = false;
let heartbeatStarted = false;
let reconnectTimer = null;
let authResetInProgress = false;
let lastAuthResetAt = 0;

function runReminderCheck() {
  if (!latestSock || !whatsappConnected) {
    console.log('WhatsApp ainda não conectado. Aguardando conexão para enviar lembretes.');
    return;
  }

  processReminders(latestSock).catch(function(err) {
    console.error('Erro ao processar lembretes:', err.message);
  });
}

function startReminderScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setTimeout(runReminderCheck, 5000);
  setInterval(runReminderCheck, checkInterval);
  console.log('Bot FEMIC rodando. Verificando a cada ' + (checkInterval / 1000) + 's.');
}

function sendHeartbeat(status, error) {
  updateServiceStatus({
    connectionStatus: status || (whatsappConnected ? 'connected' : 'disconnected'),
    error: error,
  }).catch(function(err) {
    console.error('Falha ao enviar heartbeat:', err.message);
  });
}

function startHeartbeatScheduler() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;
  setTimeout(function() { sendHeartbeat(); }, 3000);
  setInterval(function() { sendHeartbeat(); }, heartbeatInterval);
}

function scheduleReconnect(delayMs) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(function() {
    reconnectTimer = null;
    startBot().catch(function(err) {
      console.error('Erro ao reconectar:', err.message);
    });
  }, delayMs);
}

async function resetAuthAndReconnect(reason) {
  if (authResetInProgress) return;
  const now = Date.now();
  if (now - lastAuthResetAt < 60000) {
    console.log('Sessão já foi limpa recentemente. Aguardando antes de tentar novo QR.');
    scheduleReconnect(30000);
    return;
  }
  lastAuthResetAt = now;
  authResetInProgress = true;
  try {
    console.log('Limpando sessão Baileys para gerar novo QR. Motivo: ' + reason);
    await fs.rm(authDir, { recursive: true, force: true });
  } catch (err) {
    console.error('Erro ao limpar sessão Baileys:', err.message);
  } finally {
    authResetInProgress = false;
    scheduleReconnect(3000);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const versionInfo = await fetchLatestBaileysVersion();
  console.log(
    'Usando WhatsApp Web v' +
    versionInfo.version.join('.') +
    (versionInfo.isLatest ? ' (latest).' : '.')
  );

  const sock = makeWASocket({
    auth: state,
    version: versionInfo.version,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  latestSock = sock;

  if (!state.creds.registered && loginMethod === 'pairing' && pairingPhone && typeof sock.requestPairingCode === 'function') {
    setTimeout(function() {
      sock.requestPairingCode(pairingPhone).then(function(code) {
        console.log('');
        console.log('=== CÓDIGO DE PAREAMENTO WHATSAPP ===');
        console.log('Telefone: +' + pairingPhone);
        console.log('Código: ' + code);
        console.log('No WhatsApp: Dispositivos conectados > Conectar dispositivo > Conectar com número de telefone.');
        console.log('');
      }).catch(function(err) {
        console.error('Erro ao gerar código de pareamento:', err.message);
      });
    }, 3000);
  }

  sock.ev.on('connection.update', function(update) {
    if (update.qr) {
      console.log('');
      console.log('=== ESCANEIE O QR CODE PARA CONECTAR O WHATSAPP ===');
      console.log('No WhatsApp: Dispositivos conectados > Conectar dispositivo.');
      console.log('');
      qrcode.generate(update.qr, { small: true });
      console.log('');
    }

    if (update.connection === 'open') {
      whatsappConnected = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      console.log('Bot "' + serviceName + '" conectado ao WhatsApp!');
      sendHeartbeat('connected');
      runReminderCheck();
    }

    if (update.connection === 'close') {
      whatsappConnected = false;
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const reason = update.lastDisconnect?.error?.message || 'motivo não informado';
      const shouldReconnect =
        !update.lastDisconnect ||
        statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada. Código: ' + (statusCode || 'sem código') + '. Motivo: ' + reason + '.');
      sendHeartbeat(shouldReconnect ? 'reconnecting' : 'logged_out', reason);
      if (statusCode === 405 && !whatsappConnected) {
        console.log('Falha 405 antes do login. Limpando sessão para gerar QR Code novo.');
        resetAuthAndReconnect(reason);
      } else if (shouldReconnect && !reconnectTimer) {
        console.log('Reconectando em 10s...');
        scheduleReconnect(10000);
      } else if (!shouldReconnect) {
        console.log('WhatsApp deslogado. A sessão será limpa para gerar um novo QR Code.');
        resetAuthAndReconnect(reason);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async function({ messages }) {
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid && msg.key.remoteJid.endsWith('@g.us')) continue;

        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || '';
        if (!text.trim()) continue;

        const jid = msg.key.remoteJid;
        const phone = getPhoneFromJid(jid);
        if (!phone) continue;

        const { intent, confidence } = await detectIntent(text);
        if (intent === 'booking' && confidence >= 0.7) {
          console.log('[Bot] Booking intent detectado de', phone.slice(0, 4) + '...');
          handleBookingIntent(sock, jid, text).catch(function(err) {
            console.error('[Bot] Erro no booking flow:', err.message);
          });
        }
      } catch (err) {
        console.error('[Bot] Erro ao processar mensagem:', err.message);
      }
    }
  });

  startReminderScheduler();
  startHeartbeatScheduler();
}

startBot().catch(function(err) {
  console.error('Fatal:', err);
  process.exit(1);
});
