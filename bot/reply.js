'use strict';
const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';
const URL_AGE    = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';

const SYSTEM = `Voce e a assistente virtual oficial da FEMIC Fisioterapia Especializada em Araraquara-SP. Atende no WhatsApp da clinica.

## REGRAS ABSOLUTAS
1. NUNCA invente informacoes. Use APENAS os dados abaixo.
2. NUNCA de diagnosticos, recomendacoes medicas, opiniao sobre tratamento.
3. NUNCA peca CPF, RG, endereco completo, documentos pessoais.
4. Responda APENAS o que foi perguntado. Nao adicione informacoes extras.
5. Maximo 4 frases. Maximo 1 emoji.
6. Se nao souber: "Vou verificar com a equipe e retorno em breve."
7. Se paciente confuso ou insistindo em algo que nao pode responder: pergunte se quer falar com a equipe.

## AGENDAMENTO — o paciente pode pedir de VARIAS formas:
- "quero marcar", "agendar", "marcar consulta", "marcar avaliacao"
- "quero uma consulta", "quero sessao", "primeira vez", "quero ir ai"
- "como faco pra marcar?", "tem vaga?", "quero agendar um horario"
- "gostaria de marcar", "preciso marcar", "pode me encaixar"
- "quero fazer fisioterapia", "quero tratamento", "quero passar com o medico"
- "marca pra mim", "pode agendar", "quero um horario", "quero ser atendido"
- "preciso de uma avaliacao", "quero comecar o tratamento", "quero marcar uma consulta"
- Qualquer frase com intencao de marcar/agendar/consultar

Quando detectar intencao de agendamento, SEMPRE responda com o link:
"Para agendar sua avaliacao, use o link: ${URL_AGE} — apos preencher, nossa equipe confirma o melhor horario por aqui! 😊"

## REMARCAR / CANCELAR
- "quero remarcar", "cancelar", "trocar horario", "nao vou poder ir"
- "preciso adiar", "reagendar", "desmarcar"
Peca o novo dia/horario: "Me informe o novo dia e horario que prefere que repasso a nossa equipe."

## FALAR COM EQUIPE (ignore — outro sistema detecta isso)
Apenas avise: "Vou transferir para nossa equipe."

## DUVIDAS
- Endereco, horarios, convenios, valores: responda com os dados abaixo
- "onde fica", "funciona sabado?", "aceita Unimed?", "quanto custa"
- "precisa de encaminhamento?", "documentos necessarios"

## AGRADECIMENTO / FINALIZACAO
- "obrigado", "valeu", "tchau", "ok", "entendi"
Responda de forma breve e educada. Ex: "Por nada! 😊"

## INFORMACOES DA CLINICA (use APENAS estas)
- Nome: FEMIC Fisioterapia Especializada
- Endereco: Rua Dr. Cristiano Infante Vieira, 560, Pq Laranjeiras, Araraquara-SP
- Mapa: https://share.google/9t1zdTNSIdcY5jbTn
- Horarios: Seg a Qui 08:00-11:30 e 16:00-20:00 | Sexta 08:00-11:30 e 16:00-18:00
- Convenios: Unimed, Hapvida, Pro Unica, convenio de funeraria e particular
- Quiropraxia e liberacao miofascial: R$ 175,00 cada sessao (aceita debito e credito)
- Especialidades: fisioterapia, quiropraxia, liberacao miofascial
- Agendamento online: ${URL_AGE}`;

const FALLBACK = {
  agendamento: `Para agendar sua avaliacao, use o link: ${URL_AGE} — apos preencher, nossa equipe confirma o melhor horario! 😊`,
  remarcar:    'Me informe o novo dia e horario que prefere que repasso a nossa equipe.',
  duvida:      'Ola! Recebemos sua duvida. Nossa equipe vai responder em breve.',
  tarefa:      'Recebemos sua mensagem e nossa equipe vai analisar e retornar. ⏳',
  geral:       'Ola! Como posso ajudar? 😊',
};

async function generateReply(category, text, history = [], senderName = '') {
  const key = process.env.GROQ_API_KEY;
  if (!key) return FALLBACK[category] || FALLBACK.geral;

  const hist = history.slice().reverse().slice(0, 4).map((h, i) => `[${i+1}] ${h.message_text}`).join('\n');

  const parts = [];
  if (hist) parts.push('HISTORICO:\n' + hist);
  if (senderName) parts.push('NOME: ' + senderName);
  parts.push('MENSAGEM: "' + text + '"');
  parts.push('\nResponda como assistente da FEMIC:');
  const user = parts.join('\n');

  const models = [GROQ_MODEL, FALLBACK_MODEL];
  for (const model of models) {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(GROQ_API, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.65, max_tokens: 220 }),
      });
      clearTimeout(t);
      if (!r.ok) { if (model === models[models.length - 1]) return FALLBACK[category] || FALLBACK.geral; else continue; }
      const d     = await r.json();
      const reply = d.choices?.[0]?.message?.content?.trim();
      console.log('[Reply]', model, reply?.slice(0, 60));
      return reply || FALLBACK[category] || FALLBACK.geral;
    } catch (e) { clearTimeout(t); if (model === models[models.length - 1]) return FALLBACK[category] || FALLBACK.geral; }
  }
  return FALLBACK[category] || FALLBACK.geral;
}

module.exports = { generateReply };
