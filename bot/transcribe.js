'use strict';
const GROQ_API = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODELS   = ['whisper-large-v3-turbo', 'whisper-base'];

async function transcribeAudio(buffer, attempt = 0) {
  const key = process.env.GROQ_API_KEY;
  if (!key || attempt >= MODELS.length) return null;

  const model = MODELS[attempt];
  const body  = new FormData();
  body.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'audio.ogg');
  body.append('model', model);
  body.append('language', 'pt');
  body.append('response_format', 'json');

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 15000);

  try {
    const r = await fetch(GROQ_API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (r.status === 429) {
      // rate limit — espera 2s e tenta de novo com mesmo modelo
      await new Promise(r => setTimeout(r, 2000));
      return transcribeAudio(buffer, attempt);
    }

    if (!r.ok) return transcribeAudio(buffer, attempt + 1);

    const d = await r.json();
    return (d.text || '').trim() || null;
  } catch (e) {
    clearTimeout(t);
    return transcribeAudio(buffer, attempt + 1);
  }
}

module.exports = { transcribeAudio };
