'use strict';

const TIMEOUT = 30 * 60 * 1000; // 30 min

const S = {
  QUESTIONS: 'QUESTIONS',
  HUMAN: 'HUMAN',
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
  const neu = { state: S.QUESTIONS, createdAt: Date.now() };
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
