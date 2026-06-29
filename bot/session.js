'use strict';

const TIMEOUT = 30 * 60 * 1000; // 30 min

const S = {
  MENU: 'MENU',
  QUESTIONS: 'QUESTIONS',
  NEW_PATIENT: 'NEW_PATIENT',
  EXISTING_PATIENT: 'EXISTING_PATIENT',
  COLLECTING_DATE: 'COLLECTING_DATE',
  HUMAN: 'HUMAN',
  RESCHEDULE: 'RESCHEDULE',
};

const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TIMEOUT) sessions.delete(k);
  }
}, 60_000);

function getSession(jid) {
  const s = sessions.get(jid);
  if (s && Date.now() - s.createdAt < TIMEOUT) return s;
  const neu = { state: S.MENU, createdAt: Date.now() };
  sessions.set(jid, neu);
  return neu;
}

function setState(jid, state) {
  const s = sessions.get(jid);
  if (s) { s.state = state; s.createdAt = Date.now(); }
}

function touch(jid) {
  const s = sessions.get(jid);
  if (s) s.createdAt = Date.now();
}

function forget(jid) {
  sessions.delete(jid);
}

module.exports = { S, getSession, setState, touch, forget };
