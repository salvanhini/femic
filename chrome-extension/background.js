const FEMIC_EVENT_TYPE = 'FEMIC_EXTENSION_EVENT';
const FEMIC_EVENT_CHANNEL = 'FEMIC_EXTENSION_EVENT_CHANNEL';
const RECENT_EVENT_WINDOW_MS = 60000;
const recentEventCache = new Map();

function limitText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeEvent(input = {}) {
  const action = String(input.action || '').trim();
  const messageText = limitText(input.message_text, 1200);
  const requestedDate = limitText(input.requested_date, 10);
  const requestedPeriod = limitText(input.requested_period, 20).toLowerCase();
  if (!['marcacao', 'remarcacao', 'cancelamento'].includes(action) || !messageText) {
    throw new Error('Evento incompleto. Informe ação e mensagem.');
  }
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    throw new Error('Data solicitada inválida. Use o formato AAAA-MM-DD.');
  }
  if (requestedPeriod && !['manha', 'tarde', 'noite'].includes(requestedPeriod)) {
    throw new Error('Período inválido. Use manhã, tarde ou noite.');
  }
  return {
    type: FEMIC_EVENT_TYPE,
    source: 'whatsapp_web',
    action,
    message_text: messageText,
    patient_name: limitText(input.patient_name, 120),
    phone: normalizePhone(input.phone).slice(0, 15),
    requested_date: requestedDate,
    requested_period: requestedPeriod,
    created_at: new Date().toISOString()
  };
}

function eventFingerprint(payload) {
  return JSON.stringify({
    action: payload.action,
    patient_name: String(payload.patient_name || '').trim().toLowerCase(),
    phone: normalizePhone(payload.phone),
    requested_date: String(payload.requested_date || '').trim(),
    requested_period: String(payload.requested_period || '').trim().toLowerCase(),
    message_text: String(payload.message_text || '').trim().toLowerCase()
  });
}

function isDuplicateRecentEvent(payload) {
  const key = eventFingerprint(payload);
  const now = Date.now();
  const last = recentEventCache.get(key) || 0;
  recentEventCache.forEach((timestamp, cacheKey) => {
    if (now - timestamp > RECENT_EVENT_WINDOW_MS) recentEventCache.delete(cacheKey);
  });
  if (last && now - last < RECENT_EVENT_WINDOW_MS) return true;
  return false;
}

function rememberRecentEvent(payload) {
  recentEventCache.set(eventFingerprint(payload), Date.now());
}

async function getSettings() {
  const saved = await chrome.storage.local.get({
    femicUrlHint: '',
    autoOpenFemic: false
  });
  return saved;
}

function isFemicTab(tab, urlHint) {
  const url = String(tab.url || '');
  const title = String(tab.title || '');
  if (urlHint && url.includes(urlHint)) return true;
  return /femic/i.test(title) ||
    /\/index\.html(?:$|[?#])/.test(url) ||
    /\/agenda\.html(?:$|[?#])/.test(url) ||
    /^https:\/\/[^/]+\.github\.io\/.*(?:index|agenda)\.html(?:$|[?#])/.test(url);
}

async function findFemicTab() {
  const { femicUrlHint } = await getSettings();
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => isFemicTab(tab, femicUrlHint));
}

async function postToFemicTab(tabId, payload) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [payload, FEMIC_EVENT_CHANNEL],
    func: (eventPayload, channelName) => {
      const url = String(window.localStorage.getItem('femic_agenda_url') || '').trim();
      const key = String(window.localStorage.getItem('femic_agenda_key') || '').trim();
      const jwt = String(window.sessionStorage.getItem('femic_jwt') || '').trim();
      const expiry = Number(window.sessionStorage.getItem('femic_token_expiry') || 0);
      if (!url || !key) {
        return { ok: false, error: 'FEMIC aberto, mas o Supabase nao esta configurado. Abra Configuracoes e informe URL/anon key.' };
      }
      if (!jwt || !expiry || Date.now() >= expiry) {
        return { ok: false, error: 'FEMIC aberto, mas nao esta conectado ao Supabase. Faca login no FEMIC antes de enviar.' };
      }
      document.dispatchEvent(new CustomEvent(channelName, { detail: eventPayload }));
      return { ok: true };
    }
  });
  const result = results && results[0] && results[0].result;
  if (!result || !result.ok) {
    throw new Error((result && result.error) || 'Nao foi possivel entregar o evento para a aba FEMIC.');
  }
}

async function sendEventToFemic(input) {
  const payload = normalizeEvent(input);
  if (isDuplicateRecentEvent(payload)) {
    return { ok: true, duplicate: true, ignored: true, payload };
  }
  const tab = await findFemicTab();
  if (!tab || !tab.id) {
    throw new Error('Abra o FEMIC em outra aba antes de enviar. Se estiver no GitHub Pages ou em uma URL específica, abra o popup da extensão e informe um identificador como index.html, localhost ou github.io.');
  }
  await postToFemicTab(tab.id, payload);
  rememberRecentEvent(payload);
  return { ok: true, tabId: tab.id, payload };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'SEND_FEMIC_EVENT') return false;
  sendEventToFemic(message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
