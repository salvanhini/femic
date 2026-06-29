'use strict';
const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM = `Classifique a mensagem de WhatsApp de uma clinica de fisioterapia. Responda SOMENTE com JSON puro (sem backticks): {"category":"agendamento","confidence":0.95}

CATEGORIAS:
"agendamento" → quer marcar consulta/avaliacao, perguntar preco, convenio, disponibilidade.
  Ex: "quero marcar", "tem vaga", "quanto custa", "aceita Unimed", "primeira vez".
"remarcar" → quer remarcar, cancelar ou trocar horario de consulta existente.
  Ex: "remarcar", "cancelar", "nao vou poder ir", "trocar horario".
"duvida" → duvida sobre endereco, horario de funcionamento, documentos, tratamento.
  Ex: "onde fica", "funciona sabado", "preciso de encaminhamento".
"tarefa" → aguarda acao da clinica: retorno, documento, confirmacao.
  Ex: "aguardo retorno", "pode me enviar", "confirmar presenca".
"geral" → cumprimento, agradecimento, spam, sem intencao clara.

Confidence deve refletir certeza real (0.0–1.0).`;

const KB = [
  [/\b(marcar|agendar|consulta|avalia[çc]ao|atendimento|sess[aã]o)\b/i, 'agendamento'],
  [/\b(quero|gostaria|preciso).{0,25}(fisioterapia|tratamento|consultar)\b/i, 'agendamento'],
  [/\bprimeira (vez|consulta|avalia[çc]ao)\b/i, 'agendamento'],
  [/\b(quanto custa|valor|pre[çc]o|conveni[oa]|unimed|hapvida|amil|bradesco|particular|plano)\b/i, 'agendamento'],
  [/\b(tem vaga|disponibil|horario disponivel)\b/i, 'agendamento'],
  [/\b(remarcar|reagendar|cancelar|desmarcar|trocar|adiar).{0,20}(consulta|sess[aã]o|horario|data|dia)?\b/i, 'remarcar'],
  [/\bn[aã]o (vou|consigo|posso) (ir|comparecer)\b/i, 'remarcar'],
  [/\b(onde fica|endere[çc]o|como chegar|localiza[çc]ao)\b/i, 'duvida'],
  [/\b(funciona|abre|fecha|hor[aá]rio de (funcionamento|atendimento))\b/i, 'duvida'],
  [/\b(encaminhamento|laudo|pedido m[eé]dico|documentos)\b/i, 'duvida'],
  [/\b(aguardo|aguardando).{0,20}(retorno|resposta|contato)\b/i, 'tarefa'],
  [/\b(pode|poderia|consegue).{0,20}(enviar|mandar|passar)\b/i, 'tarefa'],
  [/\bconfirmar? (presen[çc]a|consulta|agendamento)\b/i, 'tarefa'],
];

function strip(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

async function callGroq(text) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(GROQ_API, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }], temperature: 0.1, max_tokens: 60, response_format: { type: 'json_object' } }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const d   = await r.json();
    const raw = d.choices?.[0]?.message?.content || '';
    const p   = JSON.parse(raw);
    const ok  = ['agendamento','remarcar','duvida','tarefa','geral'];
    if (p?.category && ok.includes(p.category)) return { category: p.category, confidence: Number(p.confidence) || 0.8 };
    return null;
  } catch (e) { clearTimeout(t); if (e.name !== 'AbortError') console.warn('[Intent] Groq:', e.message); return null; }
}

async function detectIntent(text) {
  if (!text?.trim()) return { category: 'geral', confidence: 1 };
  const t = text.trim();
  const g = await callGroq(t);
  if (g?.confidence >= 0.7) { console.log('[Intent] Groq →', g.category, g.confidence); return g; }
  const norm = strip(t);
  for (const [re, cat] of KB) { if (re.test(norm)) { console.log('[Intent] KB →', cat); return { category: cat, confidence: 0.72 }; } }
  return { category: 'geral', confidence: 0.8 };
}

module.exports = { detectIntent };
