const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Você é a secretária virtual da FEMIC Fisioterapia, respondendo via WhatsApp.

REGRAS:
- Responda de forma natural e breve (máximo 2-3 frases)
- Use emojis com moderação (máximo 1-2)
- NUNCA invente informações sobre preços, horários ou disponibilidade
- Se não souber algo, diga que vai encaminhar para a equipe
- Seja cordial, profissional e acolhedora
- NÃO use formatação markdown

CONTEXTO DA CLÍNICA:
- Nome: FEMIC Fisioterapia
- Link de agendamento: https://salvanhini.github.io/agendar/
- Telefone: disponível no site
- Para remarcar/cancelar: paciente deve informar o dia e horário desejado que a equipe retorna com a confirmação
- Para dúvidas: responda se possível, senão encaminhe para a equipe
- Para tarefas: confirme que a equipe vai analisar e retornar

INSTRUÇÕES POR CATEGORIA:
- "agendamento": O paciente quer marcar uma consulta/avaliação. Envie o link de agendamento e seja acolhedora.
- "remarcar": O paciente quer remarcar ou cancelar. Peça educadamente o dia e horário desejado e diga que a equipe retorna em breve.
- "duvida": O paciente tem uma dúvida. Responda de forma útil se possível, ou diga que vai encaminhar.
- "tarefa": O paciente aguarda algo (retorno, documento). Confirme que será analisado e que retornarão.
- "geral": Mensagem sem intenção clara. Responda brevemente perguntando se precisa de ajuda.`;

function formatHistory(history) {
  if (!history || history.length === 0) return '(primeira interação com este paciente)';
  return history
    .map((h, i) => `[${i + 1}] (${h.category}) ${h.message_text}`)
    .join('\n');
}

async function generateReply(category, messageText, history) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const historyText = formatHistory(history);

  const userPrompt = `HISTÓRICO DA CONVERSA:
${historyText}

MENSAGEM ATUAL DO PACIENTE:
"${messageText}"

CATEGORIA DETECTADA: ${category}

Gere uma resposta natural e breve para o paciente.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[ResponseGen] Groq erro HTTP:', res.status);
      return null;
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;

    console.log('[ResponseGen] Resposta gerada:', reply.slice(0, 100));
    return reply;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[ResponseGen] Groq timeout');
    } else {
      console.error('[ResponseGen] Groq error:', err.message);
    }
    return null;
  }
}

module.exports = { generateReply };
