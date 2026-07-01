'use strict';
const { tag } = require('./log');

const STAFF_TIMEOUT = 15 * 60 * 1000; // 15 min

// Mapa em memória: jid → timestamp
const staffReplies = new Map();
const manualMutes  = new Map(); // jid → expiresAt

// Limpeza periódica a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of staffReplies) if (now > v) staffReplies.delete(k);
  for (const [k, v] of manualMutes) if (now > v) manualMutes.delete(k);
}, 60_000);

function staffReplied(jid) {
  staffReplies.set(jid, Date.now() + STAFF_TIMEOUT);
}

function isMuted(jid) {
  const staff = staffReplies.get(jid);
  if (staff && Date.now() < staff) return true;
  const manual = manualMutes.get(jid);
  if (manual && Date.now() < manual) return true;
  return false;
}

function muteUntil(jid, expiresAt) {
  manualMutes.set(jid, expiresAt);
}

function unmute(jid) {
  manualMutes.delete(jid);
  staffReplies.delete(jid);
}

// Carrega mutes ativos do Supabase na inicialização
async function loadMutes(supabase) {
  try {
    const { data, error } = await supabase
      .from('bot_mutes')
      .select('jid, expires_at')
      .eq('active', true);
    if (error) { tag('Mute', 'Erro ao carregar:', error.message); return; }
    const now = Date.now();
    for (const row of data || []) {
      const exp = new Date(row.expires_at + 'Z').getTime();
      if (exp > now) manualMutes.set(row.jid, exp);
    }
    tag('Mute', `${manualMutes.size} mutes ativos carregados.`);
  } catch (e) { tag('Mute', 'Erro:', e.message); }
}

function getStaffTimeout() { return STAFF_TIMEOUT; }

module.exports = { staffReplied, isMuted, muteUntil, unmute, loadMutes, getStaffTimeout };
