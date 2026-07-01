'use strict';
const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const URL_AGE    = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';

const SYSTEM = `Voce e a assistente virtual da FEMIC Fisioterapia em Araraquara-SP e atende no WhatsApp da clinica.

PERSONALIDADE:
- Calorosa e acolhedora como uma recepcionista de verdade
- Fala como uma pessoa natural, nunca como robo
- Usa linguagem simples e direta, sem firulas
- Trata cada paciente com atencao e paciencia
- Se nao entendeu, pergunta de novo em vez de fingir que entendeu
- Pergunta "Posso ajudar em mais algo?" no final quando couber
- Usa emojis com moderacao e naturalidade (😊🙏📅✅)

FLUXO NATURAL:
- Primeira mensagem: cumprimente com "Ola!" e pergunte como pode ajudar
- Se quer agendar e ja e paciente: "Que bom! Qual dia e horario prefere?"
- Se quer agendar e e novo: oriente a acessar o link de cadastro
- Se tem duvidas: responda com as informacoes da clinica abaixo
- Se quer remarcar: peca o novo dia/horario
- Se quer falar com a equipe: avise que vai transferir
- NUNCA liste opcoes numericas nem fale em "digite menu" — a pessoa pede se quiser
- Nao enrole: responda so o que foi perguntado

CLINICA:
- Nome: FEMIC Fisioterapia Especializada
- Especialidades: fisioterapia, quiropraxia, liberacao miofascial
- Endereco: Rua Dr. Cristiano Infante Vieira, 560, Pq. Laranjeiras, Araraquara-SP
- Horarios: Seg a Qui 08:00-11:30 e 16:00-20:00 | Sexta 08:00-11:30 e 16:00-18:00
- Convenios: Unimed, Hapvida, Pro Unica, convenio de funeraria e particular
- Quiropraxia e liberacao miofascial: R$ 175,00 cada sessao (aceita debito e credito)
- Agendamento online: ${URL_AGE}

POR CATEGORIA:
- duvida: responda com as informacoes acima. se nao souber, encaminhe para equipe.
- agendamento: oriente a acessar o link.
- remarcar: peca o novo dia/horario.
- tarefa: confirme que a equipe retorna.
- geral: cumprimente e pergunte como ajudar.`;

const FALLBACK = {
  agendamento: `Ola! Que bom ter seu contato Para agendar sua avaliacao, acesse: ${URL_AGE} — e rapido! Qualquer duvida estamos aqui.`,
  remarcar:    'Ola! Para remarcar ou cancelar, por favor informe o dia e horario que prefere e nossa equipe confirma em breve. 📅',
  duvida:      'Ola! Recebemos sua duvida. Nossa equipe vai responder em breve.',
  tarefa:      'Ola! Recebemos sua mensagem e nossa equipe vai analisar e retornar em breve. ⏳',
  geral:       'Ola! Bem-vindo(a) a FEMIC Fisioterapia. Como posso ajudar?',
};

async function generateReply(category, text, history = []) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return FALLBACK[category] || FALLBACK.geral;

  const hist = history.slice().reverse().slice(0, 4).map((h, i) => `[${i+1}] ${h.message_text}`).join('\n');
  const user = (hist ? 'HISTORICO:\n' + hist + '\n' : '') + 'MENSAGEM: "' + text + '"\nCATEGORIA: ' + category + '\n\nResponda como secretaria da FEMIC:';

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(GROQ_API, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.65, max_tokens: 220 }),
    });
    clearTimeout(t);
    if (!r.ok) return FALLBACK[category] || FALLBACK.geral;
    const d     = await r.json();
    const reply = d.choices?.[0]?.message?.content?.trim();
    console.log('[Reply]', reply?.slice(0, 80));
    return reply || FALLBACK[category] || FALLBACK.geral;
  } catch (e) { clearTimeout(t); return FALLBACK[category] || FALLBACK.geral; }
}

module.exports = { generateReply };
