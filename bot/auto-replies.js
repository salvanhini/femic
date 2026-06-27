const AUTO_REPLIES = {
  tarefa: 'Recebemos sua mensagem! Nossa equipe vai analisar e retornar em breve. ⏳',
  remarcar: 'Para remarcar ou cancelar sua consulta, entre em contato pelo telefone (XX) XXXX-XXXX. 📞',
  duvida: 'Sua dúvida foi registrada! Responderemos em breve. Para urgências, ligue (XX) XXXX-XXXX.',
};

function getAutoReply(category) {
  return AUTO_REPLIES[category] || null;
}

module.exports = { getAutoReply };
