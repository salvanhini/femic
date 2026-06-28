require('dotenv/config');
const { Browsers, fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

(async () => {
  const authDir = './baileys-auth-test';
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const versionInfo = await fetchLatestBaileysVersion();

  console.log('Versão:', versionInfo.version.join('.'));

  const sock = makeWASocket({
    auth: state,
    version: versionInfo.version,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      console.log('QR CODE:');
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection === 'open') {
      console.log('[TEST] Conectado! Aguardando mensagens...');
      console.log('[TEST] isOnline:', update.isOnline);
    }
    if (update.connection === 'close') {
      const code = update.lastDisconnect?.error?.output?.statusCode;
      console.log('[TEST] Desconectado. Código:', code, 'Motivo:', update.lastDisconnect?.error?.message);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Try multiple event patterns
  sock.ev.on('messages.upsert', (data) => {
    console.log('[TEST] messages.upsert DISPARADO!');
    console.log('[TEST] messages.upsert data:', JSON.stringify(data).slice(0, 500));
  });

  sock.ev.on('messages.update', (data) => {
    console.log('[TEST] messages.update:', JSON.stringify(data).slice(0, 200));
  });

  sock.ev.on('messages.notification', (data) => {
    console.log('[TEST] messages.notification:', JSON.stringify(data).slice(0, 200));
  });

  sock.ev.on('message', (data) => {
    console.log('[TEST] message event:', JSON.stringify(data).slice(0, 200));
  });

  console.log('[TEST] Bot de teste rodando. Envie uma mensagem de outro WhatsApp para o número do bot.');
})();
