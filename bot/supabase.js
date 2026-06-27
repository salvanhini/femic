const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { buildReminderUpdate, buildReminderWindow } = require('./reminder-utils.js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.FEMIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.FEMIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltam SUPABASE_URL e SUPABASE_ANON_KEY no .env ou FEMIC_SUPABASE_URL e FEMIC_SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

if (/seu-projeto|cole-a-chave/i.test(supabaseUrl + ' ' + supabaseKey)) {
  console.error('Preencha o .env com a URL e a chave reais do Supabase antes de iniciar o bot.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: WebSocket,
  },
});

async function fetchDueReminders(hoursBefore) {
  const window = buildReminderWindow({
    hoursBefore: hoursBefore,
    timeZone: process.env.CLINIC_TIME_ZONE || process.env.TZ || 'America/Sao_Paulo',
    toleranceMinutes: process.env.REMINDER_TOLERANCE_MINUTES || 30,
  });
  console.log(
    'Buscando lembretes para ' +
    window.targetDate +
    ' entre ' +
    window.fromTime +
    ' e ' +
    window.toTime +
    ' (' +
    (process.env.CLINIC_TIME_ZONE || process.env.TZ || 'America/Sao_Paulo') +
    ').'
  );

  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, patient_id, service_id, patients(name, whatsapp)')
    .eq('appointment_date', window.targetDate)
    .in('status', ['agendado', 'confirmado'])
    .or('appointment_reminder_sent.is.false,appointment_reminder_sent.is.null')
    .or('reminder_sent.is.false,reminder_sent.is.null')
    .gte('start_time', window.fromTime)
    .lte('start_time', window.toTime)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Erro ao buscar lembretes:', error.message);
    if (/permission denied|row-level security|rls/i.test(error.message)) {
      console.error('Permissão insuficiente no Supabase. Configure SUPABASE_SERVICE_ROLE_KEY no .env ou nas variáveis da DisCloud.');
    }
    return [];
  }

  return (data || []).filter(a => a.patients && a.patients.whatsapp);
}

async function markReminderSent(appointmentId, payload) {
  const update = buildReminderUpdate(payload || {});

  const { error } = await supabase
    .from('appointments')
    .update(update)
    .eq('id', appointmentId);

  if (error) {
    console.error('Erro ao marcar lembrete', appointmentId, error.message);
    if (/permission denied|row-level security|rls/i.test(error.message)) {
      console.error('Permissão insuficiente no Supabase. Configure SUPABASE_SERVICE_ROLE_KEY no .env ou nas variáveis da DisCloud.');
    }
  }
}

async function updateServiceStatus(payload) {
  const now = new Date().toISOString();
  const serviceName = process.env.WHATSAPP_SERVICE_NAME || 'baileys-main';
  const connectionStatus = payload && payload.connectionStatus
    ? String(payload.connectionStatus)
    : 'connected';

  const record = {
    service_name: serviceName,
    provider: 'baileys',
    connection_status: connectionStatus,
    last_seen_at: now,
    last_error: payload && payload.error ? String(payload.error).slice(0, 500) : null,
    meta: {
      pid: process.pid,
      check_interval_minutes: Number(process.env.CHECK_INTERVAL_MINUTES) || 5,
      hours_before: Number(process.env.HOURS_BEFORE) || 12,
      clinic_time_zone: process.env.CLINIC_TIME_ZONE || process.env.TZ || 'America/Sao_Paulo',
    },
    updated_at: now,
  };

  if (connectionStatus === 'connected') record.last_connected_at = now;
  if (payload && payload.lastMessageAt) record.last_message_at = payload.lastMessageAt;

  const { error } = await supabase
    .from('whatsapp_service_status')
    .upsert(record, { onConflict: 'service_name' });

  if (error) {
    console.error('Erro ao atualizar heartbeat do bot:', error.message);
  }
}

async function getTemplate() {
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('whatsapp_template_appointment')
    .limit(1)
    .single();

  if (error || !data) {
    return 'Olá, {nome}! Lembrete da sua consulta na FEMIC: 📅 {data} ⏰ {hora}.';
  }
  return data.whatsapp_template_appointment;
}

module.exports = { supabase, fetchDueReminders, markReminderSent, updateServiceStatus, getTemplate };
