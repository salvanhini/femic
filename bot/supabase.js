'use strict';
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const url = process.env.SUPABASE_URL || process.env.FEMIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.FEMIC_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('[Supabase] URL e KEY obrigatorios.'); process.exit(1); }

const sb = createClient(url, key, { realtime: { transport: WebSocket } });

function pad2(n) { return String(n).padStart(2, '0'); }

function buildWindow() {
  const tz        = process.env.CLINIC_TIME_ZONE || 'America/Sao_Paulo';
  const hours     = Number(process.env.HOURS_BEFORE) || 12;
  const tol       = Number(process.env.REMINDER_TOLERANCE_MINUTES) || 30;
  const t         = new Date(Date.now() + hours * 3600000);
  const fmt       = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p         = Object.fromEntries(fmt.formatToParts(t).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  const totalMin  = Number(p.hour) * 60 + Number(p.minute);
  const ft = Math.max(0, totalMin - tol);
  const tt = Math.min(1439, totalMin + tol);
  return { targetDate: `${p.year}-${p.month}-${p.day}`, fromTime: pad2(Math.floor(ft / 60)) + ':' + pad2(ft % 60), toTime: pad2(Math.floor(tt / 60)) + ':' + pad2(tt % 60) };
}

async function fetchDueReminders() {
  const w = buildWindow();
  const { data, error } = await sb.from('appointments').select('id,appointment_date,start_time,status,patients(name,whatsapp)').eq('appointment_date', w.targetDate).in('status', ['agendado', 'confirmado']).or('appointment_reminder_sent.is.false,appointment_reminder_sent.is.null,reminder_sent.is.false,reminder_sent.is.null').gte('start_time', w.fromTime).lte('start_time', w.toTime).order('start_time');
  if (error) { console.error('[Supabase] fetchReminders:', error.message); return []; }
  return (data || []).filter(a => a.patients?.whatsapp);
}

async function markReminderSent(id, status, errMsg) {
  const ok = status === 'sent';
  const n  = new Date().toISOString();
  await sb.from('appointments').update({ appointment_reminder_sent: ok, appointment_reminder_sent_at: ok ? n : null, appointment_reminder_delivery_status: status, appointment_reminder_error_message: errMsg || null, appointment_reminder_last_attempt_at: n, reminder_sent: ok, reminder_sent_at: ok ? n : null }).eq('id', id).then(r => { if (r.error) console.error('[Supabase] markSent:', r.error.message); });
}

async function getTemplate() {
  const { data } = await sb.from('schedule_settings').select('whatsapp_template_appointment').limit(1).single();
  return data?.whatsapp_template_appointment || 'Ola, {nome}! Lembrete da sua consulta na FEMIC: 📅 {data} ⏰ {hora}.';
}

async function updateStatus(name, status, errMsg) {
  const n = new Date().toISOString();
  await sb.from('whatsapp_service_status').upsert({ service_name: name, provider: 'baileys', connection_status: status, last_seen_at: n, last_error: errMsg ? String(errMsg).slice(0, 500) : null, updated_at: n, ...(status === 'connected' ? { last_connected_at: n } : {}) }, { onConflict: 'service_name' }).then(r => { if (r.error) console.error('[Supabase] updateStatus:', r.error.message); });
}

async function storeInbox(phone, text, intent, skipInbox, jid, senderName) {
  if (skipInbox) return;
  await sb.from('whatsapp_inbox').insert({ phone, jid, sender_name: senderName || null, message_text: text.slice(0, 2000), category: intent?.category || 'geral', confidence: intent?.confidence || 0, status: 'pendente' }).then(r => { if (r.error) console.error('[Supabase] storeInbox:', r.error.message); });
}

async function storeInboxTyped(phone, text, tipo, skipInbox, jid, senderName) {
  if (skipInbox) return;
  await sb.from('whatsapp_inbox').insert({ phone, jid, sender_name: senderName || null, message_text: text.slice(0, 2000), category: tipo || 'geral', status: 'pendente' }).then(r => { if (r.error) console.error('[Supabase] storeInbox:', r.error.message); });
}

async function getHistory(phone, limit = 20) {
  const { data, error } = await sb.from('whatsapp_inbox').select('message_text, category, received_at').eq('phone', phone.replace(/\D/g, '')).not('category', 'in', '("human")').order('received_at', { ascending: false }).limit(limit);
  if (error) { console.error('[Supabase] getHistory:', error.message); return []; }
  return data || [];
}

async function setMute(jid, expiresAt) {
  const { error } = await sb.from('bot_mutes').upsert(
    { jid, expires_at: expiresAt, active: true },
    { onConflict: 'jid' }
  );
  if (error) console.error('[Supabase] setMute:', error.message);
}

async function getMute(jid) {
  const { data, error } = await sb.from('bot_mutes').select('expires_at, active').eq('jid', jid).single();
  if (error) return null;
  return data;
}

async function listActiveMutes() {
  const { data, error } = await sb.from('bot_mutes').select('jid, expires_at').eq('active', true);
  if (error) { console.error('[Supabase] listMutes:', error.message); return []; }
  return data || [];
}

async function unmute(jid) {
  const { error } = await sb.from('bot_mutes').update({ active: false }).eq('jid', jid);
  if (error) console.error('[Supabase] unmute:', error.message);
}

async function cleanupInbox(days = 30) {
  const c = new Date(Date.now() - days * 86400000).toISOString();
  const { error, count } = await sb.from('whatsapp_inbox').delete({ count: 'exact' }).lt('received_at', c);
  if (error) console.error('[Supabase] cleanup:', error.message);
  else console.log('[Supabase] Limpeza:', count || 0, 'mensagens.');
}

async function patientExists(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.length < 10) return false;
  const last8 = d.slice(-8);
  const { data, error } = await sb.from('patients').select('id').or(`whatsapp.eq.${d},whatsapp.ilike.%${last8}`).limit(1);
  if (error) { console.error('[Supabase] patientExists:', error.message); return false; }
  return !!(data && data.length > 0);
}

async function pollTask(phone, ms = 120000) {
  const d = phone.replace(/\D/g, '');
  const last8 = d.slice(-8);
  const end = Date.now() + ms;
  return new Promise(resolve => {
    const check = async () => {
      if (Date.now() >= end) { resolve(null); return; }
      const { data, error } = await sb.from('assistant_tasks').select('id,title,patient_name,phone,notes,created_at').or(`phone.eq.${d},phone.ilike.%${last8}`).eq('origin', 'captacao_publica').order('created_at', { ascending: false }).limit(1);
      if (!error && data?.length > 0 && (data[0].phone || '').replace(/\D/g, '').slice(-8) === last8) { resolve(data[0]); return; }
      setTimeout(check, 3000);
    };
    setTimeout(check, 3000);
  });
}

async function sendDailySummary() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Busca mensagens de ontem (BRT)
  const hoje = new Date();
  const tz = process.env.CLINIC_TIME_ZONE || 'America/Sao_Paulo';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hojeStr = fmt.format(hoje);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = fmt.format(ontem);

  const { data, error } = await sb.from('whatsapp_inbox')
    .select('category, status')
    .gte('received_at', ontemStr + 'T00:00:00-03:00')
    .lt('received_at', hojeStr + 'T00:00:00-03:00');

  if (error) { console.error('[Supabase] dailySummary:', error.message); return; }

  const total = data?.length || 0;
  const human = (data || []).filter(r => r.category === 'human').length;
  const agendamento = (data || []).filter(r => r.category === 'agendamento').length;
  const pendentes = (data || []).filter(r => r.status === 'pendente').length;

  const msg = `📊 *Resumo FEMIC — ${ontemStr}*\n${'━'.repeat(20)}\n💬 ${total} mensagens\n👤 ${human} pediram humano\n📅 ${agendamento} pediram agendamento\n⏳ ${pendentes} pendentes`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId), text: msg, parse_mode: 'Markdown' }),
    });
    console.log('[Supabase] Resumo diario enviado.');
  } catch (e) { console.error('[Supabase] dailySummary:', e.message); }
}

// Agenda o resumo diario para 08:00 BRT
let lastSummaryDate = '';
setInterval(async () => {
  const tz = process.env.CLINIC_TIME_ZONE || 'America/Sao_Paulo';
  const now = new Date();
  const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const hoje = fmtDate.format(now);
  const parts = Object.fromEntries(fmtTime.formatToParts(now).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  const hhmm = parts.hour + ':' + parts.minute;

  if (hhmm === '08:00' && lastSummaryDate !== hoje) {
    lastSummaryDate = hoje;
    await sendDailySummary();
  }
}, 60_000);

// Limpeza automatica do historico a cada 24h (remove >30 dias)
setInterval(() => cleanupInbox(30), 24 * 60 * 60 * 1000);

module.exports = { sb, fetchDueReminders, markReminderSent, getTemplate, updateStatus, storeInbox, storeInboxTyped, getHistory, cleanupInbox, patientExists, pollTask, setMute, getMute, listActiveMutes, unmute, sendDailySummary };
