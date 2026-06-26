import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DisconnectReason, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';

import slotUtils from '../../js/femic-appointment-slot-utils.js';
import aiUtils from '../../js/femic-whatsapp-ai-utils.js';
import pendingTaskUtils from '../../js/femic-pending-task-utils.js';
import reminderUtils from '../../js/femic-whatsapp-reminder-utils.js';

const {
  buildAppointmentReminderAuditPatch,
  getDueWhatsappConfirmationReminders,
  normalizeWhatsappProvider,
} = reminderUtils;

const {
  classifyWhatsappBotMessage,
  tidySpeechText,
} = pendingTaskUtils;

const {
  findSafeAppointmentSlots,
} = slotUtils;

const {
  chooseServiceForConversationIntent,
  courteousClarificationQuestion,
  mergeConversationIntentState,
  parseGroqConversationJson,
  serviceCatalogForPrompt,
} = aiUtils;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '.runtime');
const sessionDir = process.env.FEMIC_BAILEYS_SESSION_DIR || path.resolve(__dirname, '.session');
const pollMs = Math.max(15000, Number(process.env.FEMIC_BAILEYS_POLL_MS || 60000));
const serviceName = String(process.env.FEMIC_BAILEYS_SERVICE_NAME || 'baileys-main').trim() || 'baileys-main';
const pairingPhone = normalizePhone(process.env.FEMIC_BAILEYS_PAIRING_PHONE || '');
const adminPhone = normalizePhone(process.env.FEMIC_BAILEYS_ADMIN_PHONE || '');
const logLevel = process.env.FEMIC_BAILEYS_LOG_LEVEL || 'info';
const supabaseUrl = String(process.env.FEMIC_SUPABASE_URL || '').trim();
const supabaseServiceRoleKey = String(process.env.FEMIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
const groqApiKey = String(process.env.FEMIC_GROQ_API_KEY || '').trim();
const groqModel = String(process.env.FEMIC_GROQ_MODEL || 'llama-3.3-70b-versatile').trim() || 'llama-3.3-70b-versatile';
const logger = pino({ level: logLevel });

if(!supabaseUrl || !supabaseServiceRoleKey){
  throw new Error('Defina FEMIC_SUPABASE_URL e FEMIC_SUPABASE_SERVICE_ROLE_KEY antes de iniciar o worker do Baileys.');
}

await fs.mkdir(runtimeRoot, { recursive: true });
await fs.mkdir(sessionDir, { recursive: true });

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let socket = null;
let syncInterval = null;
let syncing = false;
let connectionState = 'disconnected';
let pairingCodeRequested = false;
let whatsappStatusTableMissing = false;
let scheduleSettingsTableMissing = false;
let openedOnce = false;
const conversationStateByPhone = new Map();
const conversationStateTtlMs = 15 * 60 * 1000;

function nowIso(){
  return new Date().toISOString();
}

function conversationKey(phone){
  return normalizePhone(phone);
}

function readConversationState(phone){
  const key = conversationKey(phone);
  const state = conversationStateByPhone.get(key);
  if(!state) return null;
  const updatedAt = new Date(state.updatedAt || 0).getTime();
  if(!updatedAt || Date.now() - updatedAt > conversationStateTtlMs){
    conversationStateByPhone.delete(key);
    return null;
  }
  return state;
}

function writeConversationState(phone, state){
  const key = conversationKey(phone);
  conversationStateByPhone.set(key, {
    ...state,
    updatedAt: nowIso(),
  });
}

function clearConversationState(phone){
  conversationStateByPhone.delete(conversationKey(phone));
}

function localIsoDate(value){
  const dt = new Date(value);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function defaultReminderTemplate(){
  return 'Olá, {nome}! Tudo bem? Passando para confirmar seu atendimento na FEMIC: 📅 {data} ⏰ {hora}. Por favor, responda esta mensagem com: ✅ CONFIRMAR para manter o horário ou ❌ CANCELAR se não puder comparecer. Se precisar remarcar, é só avisar 😊';
}

function formatDate(dateValue){
  if(!dateValue) return '';
  const [year, month, day] = String(dateValue).split('-');
  return day && month && year ? `${day}/${month}/${year}` : String(dateValue);
}

function normalizeTime(value){
  return String(value || '').slice(0, 5);
}

function normalizePhone(value){
  const digits = String(value || '').replace(/\D/g, '');
  if(!digits) return '';
  if(digits.length === 10 || digits.length === 11) return `55${digits}`;
  if(digits.length === 12 || digits.length === 13) return digits;
  return digits;
}

function formatReminderMessage(template, reminder){
  const text = String(template || defaultReminderTemplate());
  return text
    .replaceAll('{nome}', reminder.patient.name || 'Paciente')
    .replaceAll('{data}', formatDate(reminder.appointment.appointment_date))
    .replaceAll('{hora}', normalizeTime(reminder.appointment.start_time))
    .replaceAll('{servico}', reminder.service.name || 'Sessão');
}

function toJid(phone){
  return `${phone}@s.whatsapp.net`;
}

async function notifyAdminConnectionOpen(){
  if(!adminPhone || !socket) return;
  const text = openedOnce
    ? `FEMIC WhatsApp: bot Baileys reconectado em ${new Date().toLocaleString('pt-BR')}.`
    : `FEMIC WhatsApp: bot Baileys conectado em ${new Date().toLocaleString('pt-BR')}.`;
  try{
    await socket.sendMessage(toJid(adminPhone), { text });
    logger.info({ adminPhone }, 'Aviso de conexao enviado ao administrador via Baileys');
  }catch(error){
    logger.warn({ err: error, adminPhone }, 'Nao foi possivel enviar aviso de conexao ao administrador');
  }finally{
    openedOnce = true;
  }
}

async function upsertServiceStatus(patch = {}){
  if(whatsappStatusTableMissing) return;
  const row = {
    service_name: serviceName,
    provider: 'baileys',
    connection_status: connectionState,
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    ...patch,
  };
  const { error } = await supabase
    .from('whatsapp_service_status')
    .upsert(row, { onConflict: 'service_name' });
  if(error){
    if(/whatsapp_service_status|relation .* does not exist|Could not find the table|schema cache|PGRST205/i.test(String(error.message || error.code || error))){
      whatsappStatusTableMissing = true;
      logger.warn('Tabela whatsapp_service_status ausente. Rode o patch SQL para mostrar status do bot no FEMIC.');
      return;
    }
    logger.warn({ err: error }, 'Nao foi possivel atualizar whatsapp_service_status');
  }
}

async function readScheduleSettings(){
  if(scheduleSettingsTableMissing) return {};
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if(error){
    if(/schedule_settings|relation .* does not exist|Could not find the table|schema cache|PGRST205/i.test(String(error.message || error.code || error))){
      scheduleSettingsTableMissing = true;
      logger.warn('Tabela schedule_settings ausente; usando configuracoes padrao do bot. Rode o patch SQL para editar pelo FEMIC.');
      await upsertServiceStatus({
        last_error: null,
        meta: {
          schedule_settings_status: 'missing_using_defaults',
          hours_before: 12,
        },
      });
      return {};
    }
    throw error;
  }
  return data || {};
}

async function fetchAppointmentsWindow(now){
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 2);

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('appointment_date', localIsoDate(start))
    .lte('appointment_date', localIsoDate(end))
    .in('status', ['agendado', 'confirmado'])
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if(error) throw error;
  return data || [];
}

async function fetchEntityMap(table, ids){
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  if(!unique.length) return {};
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in('id', unique);
  if(error) throw error;
  return (data || []).reduce((acc, item) => {
    acc[String(item.id)] = item;
    return acc;
  }, {});
}

async function fetchPatients(){
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('name', { ascending: true });
  if(error) throw error;
  return data || [];
}

async function fetchServices(){
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });
  if(error) throw error;
  return data || [];
}

async function fetchScheduleBlocks(from, to){
  const { data, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .gte('block_date', from)
    .lte('block_date', to)
    .order('block_date', { ascending: true })
    .order('start_time', { ascending: true });
  if(error){
    if(/schedule_blocks|relation .* does not exist|Could not find the table|schema cache/i.test(String(error.message || error))){
      logger.warn('Tabela schedule_blocks ausente; sugestoes seguem sem bloqueios manuais.');
      return [];
    }
    throw error;
  }
  return data || [];
}

async function fetchAppointmentsRange(from, to){
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .in('status', ['agendado', 'confirmado'])
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });
  if(error) throw error;
  return data || [];
}

function servicesById(services){
  return (services || []).reduce((acc, service) => {
    acc[String(service.id)] = service;
    return acc;
  }, {});
}

function textNorm(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPatientByPhone(patients, phone){
  const normalized = normalizePhone(phone);
  return (patients || []).find((patient) => normalizePhone(patient.whatsapp) === normalized) || null;
}

function chooseServiceFromText(services, text){
  const normalized = textNorm(text);
  return (services || []).find((service) => {
    const name = textNorm(service.name);
    return name && normalized.includes(name);
  }) || null;
}

function buildGroqConversationPrompt({ text, patient, services, today, conversationState }){
  const priorIntent = conversationState && conversationState.intent ? conversationState.intent : null;
  const priorHistory = conversationState && Array.isArray(conversationState.history) ? conversationState.history.slice(-5) : [];
  return [
    'Voce e a atendente virtual da FEMIC Fisioterapia no WhatsApp.',
    'Fale como uma secretaria educada, acolhedora e objetiva: cumprimente quando fizer sentido, use "por gentileza", agradeca as informacoes e evite respostas secas.',
    'Nao use linguagem tecnica, nao mencione JSON, IA, sistema, banco ou algoritmo para o paciente.',
    'Se precisar perguntar algo, faca uma pergunta por vez, de forma curta e profissional.',
    'Sua tarefa e interpretar a mensagem do paciente e responder APENAS um JSON valido, sem markdown.',
    'Nunca confirme, marque, cancele ou prometa horario definitivo. A equipe humana sempre confirma no painel FEMIC.',
    'Classifique fisioterapia pelo convenio como service_category="convenio_group". Convenios comuns: Unimed, Hapvida, Pro Unica e outros.',
    'Classifique quiropraxia e liberacao miofascial como service_category="individual_bodywork".',
    'Se o paciente nao deixar claro se quer convenio, quiropraxia ou liberacao miofascial, marque needs_clarification=true e escreva uma pergunta curta.',
    'Se for mensagem casual sem pedido operacional, use should_create_task=false e reply vazio.',
    '',
    'JSON esperado:',
    '{"should_create_task":true,"action":"marcacao|remarcacao|cancelamento|duvida","service_category":"convenio_group|individual_bodywork|unknown","service_query":"","payer_name":"","shift":"manha|tarde|noite|","dates":["YYYY-MM-DD"],"needs_clarification":false,"clarification_question":"","reply":"","confidence":"high|medium|low"}',
    '',
    `Data de hoje: ${today}`,
    `Paciente cadastrado: ${patient && patient.name ? patient.name : 'nao identificado'}`,
    `Servicos cadastrados: ${JSON.stringify(serviceCatalogForPrompt(services))}`,
    `Contexto anterior desta conversa: ${JSON.stringify({ intent: priorIntent, history: priorHistory })}`,
    '',
    `Mensagem do paciente: ${text}`,
  ].join('\n');
}

async function classifyWithGroq({ text, patient, services, today, conversationState }){
  if(!groqApiKey) return null;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Voce interpreta conversas de WhatsApp para uma clinica. Responda somente JSON valido, mas escreva campos de resposta como uma secretaria educada da FEMIC.' },
        { role: 'user', content: buildGroqConversationPrompt({ text, patient, services, today, conversationState }) },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok){
    throw new Error((data && data.error && data.error.message) || `Falha no Groq (${response.status})`);
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return parseGroqConversationJson(content);
}

function classificationFromAi(aiIntent, fallback){
  if(!aiIntent) return fallback;
  if(!aiIntent.shouldCreateTask){
    return {
      shouldCreateTask: false,
      reason: 'groq_no_task',
      action: aiIntent.action,
      shift: aiIntent.shift,
      dates: aiIntent.dates,
      text: fallback.text,
    };
  }
  if(aiIntent.action === 'cancelamento'){
    return {
      shouldCreateTask: false,
      reason: 'cancellation_not_supported_by_bot_v1',
      action: 'cancelamento',
      shift: aiIntent.shift,
      dates: aiIntent.dates,
      text: fallback.text,
    };
  }
  return {
    shouldCreateTask: true,
    reason: 'groq_scheduling_intent',
    action: aiIntent.action === 'remarcacao' ? 'remarcacao' : 'marcacao',
    shift: aiIntent.shift || fallback.shift || '',
    dates: aiIntent.dates && aiIntent.dates.length ? aiIntent.dates : fallback.dates,
    text: fallback.text,
  };
}

function defaultCandidateDates(classification){
  const parsed = classification && Array.isArray(classification.dates) ? classification.dates : [];
  if(parsed.length) return parsed.slice(0, 4);
  const dates = [];
  const cursor = new Date();
  for(let i = 1; dates.length < 5 && i <= 14; i += 1){
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + i);
    const dow = next.getDay();
    if(dow !== 0) dates.push(localIsoDate(next));
  }
  return dates;
}

function formatSlotLine(slot, index){
  return `${index + 1}. ${formatDate(slot.appointment_date)} às ${normalizeTime(slot.start_time)} (${slot.load}/${slot.capacity} vagas ocupadas)`;
}

function buildSchedulingReply(slots, options = {}){
  if(options.clarificationQuestion){
    return options.clarificationQuestion;
  }
  if(!slots.length){
    return 'Recebi seu pedido de agendamento e deixei para a equipe revisar. Assim que conferirem a agenda, retornam por aqui com as melhores opções.';
  }
  return 'Recebi seu pedido e deixei para a equipe confirmar no sistema. Encontrei estas opções possíveis:\n\n'
    + slots.slice(0, 3).map(formatSlotLine).join('\n')
    + '\n\nA equipe FEMIC vai revisar e confirmar antes de marcar.';
}

function taskNotes(text, aiIntent, serviceMatch){
  const lines = [tidySpeechText(text)];
  if(aiIntent){
    lines.push('');
    lines.push('Interpretação IA:');
    lines.push(`- categoria: ${aiIntent.serviceCategory || 'unknown'}`);
    lines.push(`- serviço/pedido: ${aiIntent.serviceQuery || '-'}`);
    lines.push(`- convênio: ${aiIntent.payerName || '-'}`);
    lines.push(`- confiança: ${aiIntent.confidence || '-'}`);
  }
  if(serviceMatch && serviceMatch.reason){
    lines.push(`- decisão de serviço: ${serviceMatch.reason}`);
  }
  return lines.join('\n');
}

async function createSchedulingTask({ text, remotePhone, patient, service, slots, action, shift, dates, aiIntent, serviceMatch }){
  const now = nowIso();
  const titleName = patient && patient.name ? patient.name : normalizePhone(remotePhone);
  const payload = {
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${action === 'remarcacao' ? 'Remarcação' : 'Marcação'} via bot · ${titleName}`,
    type: action === 'remarcacao' ? 'remarcacao' : 'marcacao',
    status: 'aberta',
    priority: 'normal',
    patient_id: patient && patient.id ? String(patient.id) : null,
    patient_name: patient && patient.name ? patient.name : '',
    service_id: service && service.id ? service.id : null,
    service_name: service && service.name ? service.name : '',
    suggestion_reason: slots.length ? 'Bot sugeriu horários seguros; equipe precisa confirmar.' : (serviceMatch && serviceMatch.reason ? serviceMatch.reason : 'Bot não encontrou horário seguro; equipe precisa revisar.'),
    phone: normalizePhone(remotePhone),
    origin: 'whatsapp_bot',
    requested_action: action,
    notes: taskNotes(text, aiIntent, serviceMatch),
    suggested_slots: slots,
    candidates: slots,
    parsed_shift: shift || '',
    parsed_dates: dates,
    needs_review: true,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  const { error } = await supabase.from('assistant_tasks').insert(payload);
  if(error){
    if(/assistant_tasks|relation .* does not exist|Could not find the table|schema cache/i.test(String(error.message || error))){
      logger.warn({ table: 'assistant_tasks', phone: normalizePhone(remotePhone) }, 'Tabela assistant_tasks ausente; pedido do bot nao foi persistido');
      return null;
    }
    throw error;
  }
  logger.info({ taskId: payload.id, phone: normalizePhone(remotePhone), slots: slots.length }, 'Pendencia de agenda criada pelo bot');
  return payload;
}

async function handleIncomingSchedulingMessage(message){
  const remoteJid = message && message.key && message.key.remoteJid;
  if(!remoteJid || remoteJid.endsWith('@g.us')) return;
  const rawText = message.message?.conversation
    || message.message?.extendedTextMessage?.text
    || message.message?.imageMessage?.caption
    || '';
  const text = tidySpeechText(rawText);
  if(!text) return;
  const remotePhone = String(remoteJid).split('@')[0];
  const today = localIsoDate(new Date());
  const fallbackClassification = classifyWhatsappBotMessage(text, { today });
  const settings = await readScheduleSettings();
  const patients = await fetchPatients();
  const services = await fetchServices();
  const patient = findPatientByPhone(patients, remotePhone);
  const previousConversationState = readConversationState(remotePhone);
  let aiIntent = null;
  try{
    aiIntent = await classifyWithGroq({ text, patient, services, today, conversationState: previousConversationState });
    if(aiIntent){
      const nextState = mergeConversationIntentState(previousConversationState, aiIntent, text, nowIso());
      writeConversationState(remotePhone, nextState);
      aiIntent = nextState.intent;
    }
  }catch(error){
    logger.warn({ err: error, remotePhone: normalizePhone(remotePhone) }, 'Groq falhou; usando classificador local');
    await upsertServiceStatus({
      last_error: error && error.message ? `Groq: ${error.message}` : 'Groq indisponivel',
    });
  }
  const classification = classificationFromAi(aiIntent, fallbackClassification);
  logger.info({
    remotePhone: normalizePhone(remotePhone),
    preview: text.slice(0, 120),
    reason: classification.reason,
    ai: !!aiIntent,
  }, 'Mensagem recebida no WhatsApp');
  if(!classification.shouldCreateTask){
    logger.info({ remotePhone: normalizePhone(remotePhone), reason: classification.reason }, 'Mensagem ignorada pelo bot de agenda');
    if(aiIntent && aiIntent.reply){
      await socket.sendMessage(remoteJid, { text: aiIntent.reply });
    }
    await upsertServiceStatus({
      last_error: null,
      meta: {
        last_inbound_status: 'ignored',
        last_inbound_reason: classification.reason,
        last_inbound_phone: normalizePhone(remotePhone),
        last_inbound_at: nowIso(),
      },
    });
    return;
  }

  const action = classification.action;
  const serviceMatch = aiIntent
    ? chooseServiceForConversationIntent(services, aiIntent)
    : { service: chooseServiceFromText(services, text), confidence: 'medium', reason: 'Serviço encontrado pelo texto.' };
  const service = serviceMatch.service;
  const dates = defaultCandidateDates(classification);
  const shift = classification.shift;
  const needsClarification = !!(aiIntent && (aiIntent.needsClarification || !service || serviceMatch.confidence === 'low'));
  if(!needsClarification && service){
    clearConversationState(remotePhone);
  }
  const from = dates[0] || localIsoDate(new Date());
  const to = dates[dates.length - 1] || from;
  const [appointments, scheduleBlocks] = await Promise.all([
    fetchAppointmentsRange(from, to),
    fetchScheduleBlocks(from, to),
  ]);

  const slots = service && !needsClarification ? findSafeAppointmentSlots({
    patientId: patient && patient.id ? patient.id : `whatsapp-${normalizePhone(remotePhone)}`,
    serviceId: service.id,
    dates,
    appointments,
    scheduleBlocks,
    servicesById: servicesById(services),
    settings,
    period: shift,
    limit: 5,
  }) : [];

  const task = await createSchedulingTask({ text, remotePhone, patient, service, slots, action, shift, dates, aiIntent, serviceMatch });
  const clarificationQuestion = needsClarification
    ? (aiIntent && aiIntent.clarificationQuestion) || courteousClarificationQuestion(aiIntent)
    : '';
  await socket.sendMessage(remoteJid, { text: buildSchedulingReply(slots, { clarificationQuestion }) });
  await upsertServiceStatus({
    last_message_at: nowIso(),
    last_error: null,
    meta: {
      last_inbound_status: task ? 'task_created' : 'task_not_persisted',
      last_inbound_action: action,
      last_inbound_phone: normalizePhone(remotePhone),
      last_inbound_at: nowIso(),
      last_task_id: task && task.id,
      last_suggested_slots: slots.length,
      last_ai_provider: aiIntent ? 'groq' : 'local',
      last_service_match_confidence: serviceMatch.confidence,
    },
  });
  logger.info({ phone: normalizePhone(remotePhone), action, slots: slots.length, taskId: task && task.id }, 'Pedido de agenda processado pelo bot');
}

async function patchAppointmentReminder(appointmentId, patch){
  const { error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', appointmentId);
  if(error) throw error;
}

async function sendReminder(reminder, settings){
  const template = settings.whatsapp_template_appointment || defaultReminderTemplate();
  const text = formatReminderMessage(template, reminder);
  const response = await socket.sendMessage(toJid(reminder.phone), { text });
  return response && response.key && response.key.id ? String(response.key.id) : null;
}

async function syncRemindersOnce(){
  if(syncing) return;
  syncing = true;

  try{
    const settings = await readScheduleSettings();
    const provider = normalizeWhatsappProvider(settings.whatsapp_provider);
    const hoursBefore = Number(settings.whatsapp_confirmation_hours_before || 12);
    const now = new Date();

    await upsertServiceStatus({
      provider: provider,
      meta: {
        mode: provider === 'baileys' ? 'active' : 'standby',
        poll_ms: pollMs,
        hours_before: Number.isFinite(hoursBefore) ? hoursBefore : 12,
      },
    });

    if(provider !== 'baileys' || connectionState !== 'connected' || !socket) return;

    const appointments = await fetchAppointmentsWindow(now);
    const patientIds = appointments.map((item) => item.patient_id);
    const serviceIds = appointments.map((item) => item.service_id);
    const [patientsById, servicesById] = await Promise.all([
      fetchEntityMap('patients', patientIds),
      fetchEntityMap('services', serviceIds),
    ]);

    const dueReminders = getDueWhatsappConfirmationReminders({
      appointments,
      patientsById,
      servicesById,
      now: now.toISOString(),
      hoursBefore,
    });

    for(const reminder of dueReminders){
      try{
        const externalId = await sendReminder(reminder, settings);
        await patchAppointmentReminder(
          reminder.appointment.id,
          buildAppointmentReminderAuditPatch({
            provider: 'baileys',
            deliveryStatus: 'sent',
            sentAt: nowIso(),
            externalMessageId: externalId,
          }),
        );
        await upsertServiceStatus({
          last_message_at: nowIso(),
          last_error: null,
        });
        logger.info({ appointmentId: reminder.appointment.id, patientId: reminder.patient.id }, 'Confirmacao enviada via Baileys');
      }catch(error){
        await patchAppointmentReminder(
          reminder.appointment.id,
          buildAppointmentReminderAuditPatch({
            provider: 'baileys',
            deliveryStatus: 'failed',
            sentAt: nowIso(),
            errorMessage: error && error.message ? error.message : String(error),
          }),
        );
        await upsertServiceStatus({
          last_error: error && error.message ? error.message : String(error),
        });
        logger.error({ err: error, appointmentId: reminder.appointment.id }, 'Falha ao enviar confirmacao via Baileys');
      }
    }
  }catch(error){
    logger.error({ err: error }, 'Falha no ciclo de sincronizacao de lembretes');
    await upsertServiceStatus({
      last_error: error && error.message ? error.message : String(error),
    });
  }finally{
    syncing = false;
  }
}

function ensureSyncLoop(){
  if(syncInterval) return;
  syncInterval = setInterval(() => {
    syncRemindersOnce().catch((error) => {
      logger.error({ err: error }, 'Erro inesperado no loop de sincronizacao');
    });
  }, pollMs);
}

function stopSyncLoop(){
  if(!syncInterval) return;
  clearInterval(syncInterval);
  syncInterval = null;
}

function disconnectStatusCode(lastDisconnect){
  const error = lastDisconnect && lastDisconnect.error;
  return error && error.output && typeof error.output.statusCode === 'number'
    ? error.output.statusCode
    : undefined;
}

async function resetBrokenSession(reason){
  pairingCodeRequested = false;
  try{
    await fs.rm(sessionDir, { recursive: true, force: true });
    logger.warn({ sessionDir, reason }, 'Sessao Baileys removida; um novo pareamento sera solicitado');
  }catch(error){
    logger.error({ err: error, sessionDir }, 'Falha ao remover sessao Baileys quebrada');
  }
}

function printQrToLogs(qr){
  if(!qr) return;
  logger.info('QR Code recebido. Escaneie pelo WhatsApp em Aparelhos conectados.');
  qrcodeTerminal.generate(qr, { small: true }, (code) => {
    console.log('\n===== FEMIC WHATSAPP QR CODE =====\n');
    console.log(code);
    console.log('\n===== FIM DO QR CODE =====\n');
  });
  logger.info({ qr }, 'QR bruto para pareamento, caso o desenho nao apareca no log');
}

async function requestPairingCodeIfConfigured(){
  if(pairingCodeRequested || !pairingPhone || !socket || socket.authState?.creds?.registered) return;
  pairingCodeRequested = true;
  try{
    const code = await socket.requestPairingCode(pairingPhone);
    logger.info({ pairingPhone, code }, 'Codigo de pareamento do WhatsApp gerado');
    console.log(`\n===== FEMIC WHATSAPP CODIGO DE PAREAMENTO =====\n${code}\n===== FIM DO CODIGO =====\n`);
  }catch(error){
    pairingCodeRequested = false;
    logger.warn({ err: error }, 'Nao foi possivel gerar codigo de pareamento; use o QR Code do log');
  }
}

async function startSocket(){
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  socket = makeWASocket({
    auth: state,
    logger,
    defaultQueryTimeoutMs: 60000,
  });
  await requestPairingCodeIfConfigured();

  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if(type !== 'notify' || !Array.isArray(messages)) return;
    for(const message of messages){
      if(message.key?.fromMe) continue;
      handleIncomingSchedulingMessage(message).catch(async (error) => {
        logger.error({ err: error }, 'Falha ao processar mensagem recebida para agenda');
        await upsertServiceStatus({
          last_error: error && error.message ? error.message : String(error),
        });
      });
    }
  });
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if(connection){
      connectionState = connection;
    }

    if(qr){
      printQrToLogs(qr);
    }

    if(connection === 'open'){
      logger.info('Baileys conectado ao WhatsApp');
      await upsertServiceStatus({
        connection_status: 'connected',
        last_connected_at: nowIso(),
        last_error: null,
      });
      await notifyAdminConnectionOpen();
      ensureSyncLoop();
      await syncRemindersOnce();
      return;
    }

    if(connection === 'close'){
      stopSyncLoop();
      const statusCode = disconnectStatusCode(lastDisconnect);
      const lastError = lastDisconnect && lastDisconnect.error
        ? (lastDisconnect.error.message || String(lastDisconnect.error))
        : 'Conexao encerrada';
      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      await upsertServiceStatus({
        connection_status: loggedOut ? 'logged_out' : 'disconnected',
        last_error: lastError,
      });
      logger.warn({ statusCode, lastError }, 'Conexao Baileys encerrada');
      if(loggedOut){
        await resetBrokenSession(lastError);
      }
      setTimeout(() => {
        startSocket().catch((error) => {
          logger.error({ err: error }, 'Falha ao reconectar o Baileys');
        });
      }, 3000);
      return;
    }

    await upsertServiceStatus({
      connection_status: connectionState,
    });
  });
}

process.on('SIGINT', async () => {
  stopSyncLoop();
  connectionState = 'disconnected';
  await upsertServiceStatus({ connection_status: 'disconnected' });
  process.exit(0);
});

process.on('SIGTERM', async () => {
  stopSyncLoop();
  connectionState = 'disconnected';
  await upsertServiceStatus({ connection_status: 'disconnected' });
  process.exit(0);
});

await upsertServiceStatus({
  connection_status: 'starting',
  meta: { poll_ms: pollMs },
});

await startSocket();
