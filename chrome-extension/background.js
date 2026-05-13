const FEMIC_EVENT_TYPE = 'FEMIC_EXTENSION_EVENT';
const RECENT_EVENT_WINDOW_MS = 5000;
const recentEventCache = new Map();

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeEvent(input = {}) {
  const action = String(input.action || '').trim();
  const messageText = String(input.message_text || '').trim();
  if (!['marcacao', 'remarcacao', 'cancelamento'].includes(action) || !messageText) {
    throw new Error('Evento incompleto. Informe ação e mensagem.');
  }
  return {
    type: FEMIC_EVENT_TYPE,
    source: 'whatsapp_web',
    action,
    message_text: messageText,
    patient_name: String(input.patient_name || '').trim(),
    phone: normalizePhone(input.phone),
    requested_date: String(input.requested_date || '').trim(),
    requested_period: String(input.requested_period || '').trim(),
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
  recentEventCache.set(key, now);
  return false;
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
  return /femic/i.test(title) || /\/index\.html(?:$|[?#])/.test(url) || /\/agenda\.html(?:$|[?#])/.test(url);
}

async function findFemicTab() {
  const { femicUrlHint } = await getSettings();
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => isFemicTab(tab, femicUrlHint));
}

async function postToFemicTab(tabId, payload) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [payload],
    func: (eventPayload) => {
      window.postMessage(eventPayload, '*');
    }
  });
}

async function sendEventToFemic(input) {
  const payload = normalizeEvent(input);
  if (isDuplicateRecentEvent(payload)) {
    return { ok: true, duplicate: true, ignored: true, payload };
  }
  const tab = await findFemicTab();
  if (!tab || !tab.id) {
    throw new Error('Abra o FEMIC em outra aba antes de enviar.');
  }
  await postToFemicTab(tab.id, payload);
  return { ok: true, tabId: tab.id, payload };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'SEND_FEMIC_EVENT') return false;
  sendEventToFemic(message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
