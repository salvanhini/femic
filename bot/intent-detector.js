const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Você é um classificador de mensagens de WhatsApp de uma clínica de fisioterapia (FEMIC).
Analise a mensagem do paciente e responda APENAS com um JSON sem formatação adicional:

{"category":"agendamento","confidence":0.95}

Categorias possíveis:

"agendamento" = paciente quer MARCAR primeira consulta/avaliação/sessão, perguntar sobre valores,
convenios (unimed, hapvida, amil, bradesco, sulamerica, particular),
disponibilidade, como agendar, ou quer iniciar tratamento.
Inclui frases como: "quero marcar", "gostaria de agendar", "como faço para",
"tem como marcar", "quero fazer fisioterapia", "avaliação", "primeira vez",
"quanto custa", "voces atendem [convenio]", "marcar pelo unimed".

"remarcar" = paciente já é paciente e quer REMARCAR, CANCELAR, ou mudar horário de consulta existente.
Inclui: "remarcar", "cancelar", "trocar horário", "adiar", "não vou poder ir", "mudar data".

"duvida" = paciente tem DÚVIDA sobre tratamento, valores, convênios, endereço, horário de funcionamento,
documentos necessários, ou qualquer informação geral.
Inclui: "qual o valor", "funciona de segunda", "onde fica", "preciso de encaminhamento".

"tarefa" = paciente precisa de ALGUMA ACAO da clinica: aguarda retorno, envio de documento,
confirmação de presença, resultado, ou qualquer coisa que precise de follow-up.
Inclui: "pode me enviar", "aguardo retorno", "quando vai sair", "confirmação".

"geral" = qualquer outro assunto: cumprimento, agradecimento, reclamação, mensagem sem sentido, etc.`;

const FALLBACK_KEYWORDS = [
  // agendamento
  { regex: /quero (marcar|agendar|fazer).*(avaliação|consulta|sessão|atendimento|fisioterapia)/i, cat: 'agendamento' },
  { regex: /gostaria de (marcar|agendar|fazer).*(avaliação|consulta|sessão|fisioterapia)/i, cat: 'agendamento' },
  { regex: /primeira (vez|consulta|avaliação|sessão)/i, cat: 'agendamento' },
  { regex: /como (faço|faz) para (marcar|agendar|iniciar)/i, cat: 'agendamento' },
  { regex: /quero (começar|iniciar) (tratamento|fisioterapia)/i, cat: 'agendamento' },
  { regex: /marcar.*(fisioterapia|consulta|atendimento).*(pelo|com|no|para)/i, cat: 'agendamento' },
  { regex: /(unimed|hapvida|amil|bradesco|sulamerica|particular)/i, cat: 'agendamento' },
  { regex: /preço|valor|quanto custa|tabela/i, cat: 'agendamento' },
  { regex: /tem vaga|horário disponível|disponibilidade/i, cat: 'agendamento' },
  { regex: /vocês (atendem|fazem|aceitam).*(convênio|particular|plano)/i, cat: 'agendamento' },
  { regex: /quero me (consultar|inscrever|matricular)/i, cat: 'agendamento' },
  // remarcar
  { regex: /remarcar|reagendar|trocar.*(horário|dia|data)/i, cat: 'remarcar' },
  { regex: /cancelar.*(consulta|agendamento|sessão)/i, cat: 'remarcar' },
  { regex: /não vou poder|não posso ir|adiar/i, cat: 'remarcar' },
  { regex: /mudar.*(horário|data|dia)/i, cat: 'remarcar' },
  // duvida
  { regex: /funciona (de|das|nos)/i, cat: 'duvida' },
  { regex: /onde fica|endereço|localização/i, cat: 'duvida' },
  { regex: /preciso de (encaminhamento|laudo|documento)/i, cat: 'duvida' },
  { regex: /qual (o )?horário (de funcionamento|de atendimento)/i, cat: 'duvida' },
  // tarefa
  { regex: /pode me (enviar|mandar|passar)/i, cat: 'tarefa' },
  { regex: /aguardo (retorno|resposta)/i, cat: 'tarefa' },
  { regex: /confirmação|confirmar (presença|presenca)/i, cat: 'tarefa' },
  // standalone patterns
  { regex: /^(quero )?marcar$/i, cat: 'agendamento' },
  { regex: /^(quero )?agendar$/i, cat: 'agendamento' },
  { regex: /^agendamento$/i, cat: 'agendamento' },
  { regex: /^(quero uma|quero )?consulta$/i, cat: 'agendamento' },
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

    if (parsed && parsed.category && ['agendamento', 'remarcar', 'duvida', 'tarefa', 'geral'].includes(parsed.category)) {
      return { category: parsed.category, confidence: parsed.confidence || 0.8 };
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
  for (const { regex, cat } of FALLBACK_KEYWORDS) {
    if (regex.test(text)) {
      return { category: cat, confidence: 0.7 };
    }
  }
  return { category: 'geral', confidence: 0.8 };
}

async function detectIntent(text) {
  if (!text || typeof text !== 'string') {
    return { category: 'geral', confidence: 1 };
  }

  const originalText = text.trim();

  const groqResult = await detectWithGroq(originalText);

  if (groqResult && groqResult.confidence >= 0.7) {
    console.log('[IntentDetector] Groq:', groqResult.category, groqResult.confidence, '| Texto:', originalText.slice(0, 80));
    return groqResult;
  }

  const normalizedText = originalText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fallback = detectWithKeywords(normalizedText);
  console.log('[IntentDetector] Fallback:', fallback.category, fallback.confidence, '| Texto:', originalText.slice(0, 80));
  return fallback;
}

module.exports = { detectIntent };
