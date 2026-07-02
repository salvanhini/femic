'use strict';
require('dotenv').config();
const { tag } = require('./log');
const { startBot, getSock, isConnected } = require('./socket');
const { sendReminders } = require('./reminders');
const { updateStatus, cleanupInbox } = require('./supabase');

const CHECK_MS = (Number(process.env.CHECK_INTERVAL_MINUTES) || 5) * 60000;
const HB_MS    = (Number(process.env.HEARTBEAT_INTERVAL_SECONDS) || 60) * 1000;
const SVC_NAME = process.env.WHATSAPP_SERVICE_NAME || 'baileys-main';

let schedulerOn  = false;
let heartbeatOn  = false;
let inboxCleaned = false;

function hb() { updateStatus(SVC_NAME, isConnected() ? 'connected' : 'disconnected').catch(e => tag('HB', e.message)); }

startBot().catch(e => { console.error('[Fatal]', e); process.exit(1); });

// Scheduler e heartbeat rodam independente do socket
const ivSched = setInterval(() => {
  const sock = getSock();
  if (sock && isConnected()) sendReminders(sock).catch(() => {});
}, CHECK_MS);
const ivHB = setInterval(hb, HB_MS);
const ivInbox = setInterval(() => {
  if (!inboxCleaned) { inboxCleaned = true; cleanupInbox(30).catch(() => {}); }
}, 10000);

let unhandledCount = 0;
process.on('unhandledRejection', e => {
  unhandledCount++;
  tag('Fatal', 'Unhandled:', e?.message || e);
  if (unhandledCount >= 5) { tag('Fatal', '5+ unhandled rejections, exiting.'); process.exit(1); }
});
process.on('uncaughtException', e => {
  tag('Fatal', 'Uncaught:', e?.message || e);
  process.exit(1);
});
