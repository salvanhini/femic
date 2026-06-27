const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Você é um classificador de intenção de uma clínica de fisioterapia (FEMIC).
Analise a mensagem do paciente e responda APENAS com um JSON sem formatação adicional:

{"intent":"booking","confidence":0.95}
ou
{"intent":"other","confidence":0.8}

"booking" = paciente quer marcar primeira consulta/avaliação/sessão, perguntar sobre valores,
convenios (unimed, hapvida, amil, bradesco, sulamerica, particular),
disponibilidade, como agendar, ou quer iniciar tratamento.
Inclui frases como: "quero marcar", "gostaria de agendar", "como faço para",
"tem como marcar", "quero fazer fisioterapia", "avaliação", "primeira vez",
"quanto custa", "voces atendem [convenio]", "marcar pelo unimed".

"other" = qualquer outro assunto: reclamação, já sou paciente, cancelar,
remarcar, informações sobre horário já agendado, etc.`;

const FALLBACK_KEYWORDS = [
  /quero (marcar|agendar|fazer).*(avaliação|consulta|sessão|atendimento|fisioterapia)/i,
  /gostaria de (marcar|agendar|fazer).*(avaliação|consulta|sessão|fisioterapia)/i,
  /primeira (vez|consulta|avaliação|sessão)/i,
  /como (faço|faz) para (marcar|agendar|iniciar)/i,
  /quero (começar|iniciar) (tratamento|fisioterapia)/i,
  /marcar.*(fisioterapia|consulta|atendimento).*(pelo|com|no|para)/i,
  /(unimed|hapvida|amil|bradesco|sulamerica|particular)/i,
  /preço|valor|quanto custa|tabela/i,
  /tem vaga|horário disponível|disponibilidade/i,
  /vocês (atendem|fazem|aceitam).*(convênio|particular|plano)/i,
  /quero me (consultar|inscrever|matricular)/i,
  /marcar.*(fisioterapia|consulta|sessao|avaliacao).*(pelo|com|no|para).*(unimed|hapvida|amil|bradesco|sulamerica|particular)/i,
  /quero.*(fisioterapia|tratamento).*(pelo|com|na|no).*(unimed|hapvida|amil|bradesco|sulamerica|particular)/i,
];

async function detectWithGroq(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(GROQ_API, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[IntentDetector] Groq erro HTTP:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());

    if (parsed && (parsed.intent === 'booking' || parsed.intent === 'other')) {
      return parsed;
    }

    return null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[IntentDetector] Groq timeout');
    } else {
      console.error('[IntentDetector] Groq error:', err.message);
    }
    return null;
  }
}

function detectWithKeywords(text) {
  for (const regex of FALLBACK_KEYWORDS) {
    if (regex.test(text)) {
      return { intent: 'booking', confidence: 0.7 };
    }
  }
  return { intent: 'other', confidence: 0.8 };
}

async function detectIntent(text) {
  if (!text || typeof text !== 'string') {
    return { intent: 'other', confidence: 1 };
  }

  const originalText = text.trim();

  const groqResult = await detectWithGroq(originalText);

  if (groqResult && groqResult.confidence >= 0.7) {
    console.log('[IntentDetector] Groq:', groqResult.intent, groqResult.confidence, '| Texto:', originalText.slice(0, 80));
    return groqResult;
  }

  const normalizedText = originalText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fallback = detectWithKeywords(normalizedText);
  console.log('[IntentDetector] Fallback:', fallback.intent, fallback.confidence, '| Texto:', originalText.slice(0, 80));
  return fallback;
}

module.exports = { detectIntent };
