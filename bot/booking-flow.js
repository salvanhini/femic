const { normalizeWhatsappJid } = require('./reminder-utils.js');
const { supabase } = require('./supabase.js');

const CAPTACAO_URL = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';

function getPhoneFromJid(jid) {
  if (!jid) return '';
  return jid.replace(/[^0-9]/g, '');
}

async function patientExistsByPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return false;

  const last8 = digits.slice(-8);

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .or('whatsapp.eq.' + digits + ',whatsapp.ilike.%' + last8)
    .limit(1);

  if (error) {
    console.error('[BookingFlow] Erro ao buscar paciente:', error.message);
    return false;
  }

  return data && data.length > 0;
}

async function waitForTaskByPhone(phone, timeoutMs = 120000) {
  const digits = phone.replace(/\D/g, '');
  const startTime = Date.now();
  const intervalMs = 3000;

  return new Promise((resolve) => {
    const check = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        resolve(null);
        return;
      }

      try {
        const last8 = digits.slice(-8);
        const { data, error } = await supabase
          .from('assistant_tasks')
          .select('id, title, patient_name, phone, notes, created_at')
          .or('phone.eq.' + digits + ',phone.ilike.%' + last8)
          .eq('origin', 'captacao_publica')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const task = data[0];
          const taskPhone = (task.phone || '').replace(/\D/g, '');
          if (taskPhone.slice(-8) === last8) {
            resolve(task);
            return;
          }
        }
      } catch (err) {
        console.error('[BookingFlow] Erro no polling:', err.message);
      }

      setTimeout(check, intervalMs);
    };

    setTimeout(check, intervalMs);
  });
}

const TELEGRAM_API = 'https://api.telegram.org/bot';

async function sendTelegramNotification(task, patientPhone) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    '📋 *NOVA PENDÊNCIA DE AVALIAÇÃO*',
    '━━━━━━━━━━━━━━━━━━━',
    '👤 *Nome:* ' + (task.patient_name || 'Não informado').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&'),
    '📱 *WhatsApp:* ' + (patientPhone || task.phone || '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&'),
    '💬 *Observação:* ' + ((task.notes || '').slice(0, 150) || 'Sem observação').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&'),
    '━━━━━━━━━━━━━━━━━━━',
    '✅ Pendência registrada automaticamente no sistema.',
  ].join('\n');

  try {
    await fetch(TELEGRAM_API + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: text,
        parse_mode: 'Markdown',
      }),
    });
    console.log('[Telegram] Notificação enviada para o chat', chatId);
  } catch (err) {
    console.error('[Telegram] Erro ao enviar:', err.message);
  }
}

function secretaryWelcome() {
  return [
    'Olá! 😊 Aqui é da *FEMIC Fisioterapia*!',
    '',
    'Vi que você quer agendar uma avaliação — que ótimo!',
    '',
    'Para agilizar, clique no link abaixo e preencha seus dados rapidinho:',
    '🔗 ' + CAPTACAO_URL,
    '',
    'Assim que enviar, nossa equipe confirma o melhor horário pra você! 💙',
  ].join('\n');
}

function secretaryConfirmation(task) {
  const name = task?.patient_name || 'Paciente';
  return [
    'Recebemos seus dados, ' + name + '! ✅',
    '',
    'Sua solicitação de avaliação está registrada com sucesso.',
    'Em breve confirmaremos o melhor horário pelo WhatsApp.',
    '',
    'Qualquer dúvida, é só chamar! 💙',
    '',
    '_FEMIC Fisioterapia_',
  ].join('\n');
}

const pendingIntents = new Map();

async function handleBookingIntent(sock, jid, text) {
  const phone = getPhoneFromJid(jid);

  if (!phone) {
    console.warn('[BookingFlow] JID sem telefone:', jid);
    return;
  }

  if (pendingIntents.has(phone)) {
    console.log('[BookingFlow] Fluxo já em andamento para', phone.slice(0, 4) + '...');
    return;
  }

  const exists = await patientExistsByPhone(phone);
  if (exists) {
    console.log('[BookingFlow] Paciente já cadastrado, ignorando:', phone.slice(0, 4) + '...');
    return;
  }

  pendingIntents.set(phone, Date.now());
  console.log('[BookingFlow] Novo lead detectado:', phone.slice(0, 4) + '...');

  try {
    await sock.sendMessage(jid, { text: secretaryWelcome() });
    console.log('[BookingFlow] Mensagem de boas-vindas enviada para', phone.slice(0, 4) + '...');

    const task = await waitForTaskByPhone(phone);
    if (task) {
      console.log('[BookingFlow] Formulário preenchido! Task:', task.id);
      await sock.sendMessage(jid, { text: secretaryConfirmation(task) });
      console.log('[BookingFlow] Confirmação enviada para', phone.slice(0, 4) + '...');
      sendTelegramNotification(task, phone).catch(function(err) {
        console.error('[BookingFlow] Erro Telegram:', err.message);
      });
    } else {
      console.log('[BookingFlow] Timeout aguardando formulário de', phone.slice(0, 4) + '...');
    }
  } catch (err) {
    console.error('[BookingFlow] Erro no fluxo:', err.message);
  } finally {
    pendingIntents.delete(phone);
  }
}

module.exports = { handleBookingIntent, getPhoneFromJid };
