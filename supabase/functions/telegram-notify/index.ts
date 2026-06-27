const TELEGRAM_API = 'https://api.telegram.org/bot';

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function escMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function formatMessage(data: {
  name: string;
  whatsapp: string;
  pathology: string;
  insurance: string;
  preferred_day: string;
  preferred_period: string;
  history: string;
  patient_id: string;
}): string {
  const dayLabel = data.preferred_day
    ? ({ segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' }[data.preferred_day] || data.preferred_day)
    : 'Não informado';
  const periodLabel = data.preferred_period
    ? ({ manha: 'Manhã', tarde: 'Tarde' }[data.preferred_period] || data.preferred_period)
    : 'Não informado';

  const lines = [
    '📋 *NOVA SOLICITAÇÃO DE AVALIAÇÃO*',
    '━━━━━━━━━━━━━━━━━━━',
    `👤 *Nome:* ${escMarkdown(data.name)}`,
    `📱 *WhatsApp:* ${escMarkdown(data.whatsapp)}`,
    `🩺 *Patologia:* ${escMarkdown(data.pathology)}`,
    `🏥 *Convênio:* ${escMarkdown(data.insurance || 'Não informado')}`,
    `📅 *Preferência:* ${dayLabel} - ${periodLabel}`,
  ];

  if (data.history) {
    lines.push(`📝 *Histórico:* ${escMarkdown(data.history)}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━');
  lines.push(`📎 \`${data.patient_id || 'sem ID'}\``);

  return lines.join('\n');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return respond(204, {});
  }

  if (req.method !== 'POST') {
    return respond(405, { ok: false, error: 'Método não permitido' });
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');
    return respond(500, { ok: false, error: 'Telegram não configurado' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond(400, { ok: false, error: 'JSON inválido' });
  }

  const name = String(body.name || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  const pathology = String(body.pathology || '').trim();

  if (!name || !whatsapp || !pathology) {
    return respond(400, { ok: false, error: 'Campos obrigatórios: name, whatsapp, pathology' });
  }

  const data = {
    name,
    whatsapp,
    pathology,
    insurance: String(body.insurance || '').trim(),
    preferred_day: String(body.preferred_day || '').trim(),
    preferred_period: String(body.preferred_period || '').trim(),
    history: String(body.history || '').trim(),
    patient_id: String(body.patient_id || '').trim(),
  };

  const text = formatMessage(data);
  const telegramUrl = `${TELEGRAM_API}${token}/sendMessage`;

  try {
    const res = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text,
        parse_mode: 'Markdown',
      }),
    });

    const result = await res.json();

    if (!res.ok || !result.ok) {
      console.error('Erro Telegram API:', JSON.stringify(result));
      return respond(502, { ok: false, error: result.description || 'Erro ao enviar mensagem' });
    }

    console.log('Notificação enviada para Telegram:', data.patient_id || data.name);
    return respond(200, { ok: true });
  } catch (err) {
    console.error('Erro ao chamar Telegram API:', err);
    return respond(502, { ok: false, error: 'Falha na comunicação com Telegram' });
  }
});
