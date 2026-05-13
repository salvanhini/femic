function setStatus(message) {
  document.getElementById('status').textContent = message;
}

async function load() {
  const saved = await chrome.storage.local.get({ femicUrlHint: '' });
  document.getElementById('femicUrlHint').value = saved.femicUrlHint;
}

async function save() {
  const femicUrlHint = document.getElementById('femicUrlHint').value.trim();
  await chrome.storage.local.set({ femicUrlHint });
  setStatus('Configuração salva.');
}

function sendTest() {
  chrome.runtime.sendMessage({
    type: 'SEND_FEMIC_EVENT',
    payload: {
      action: 'marcacao',
      patient_name: 'Teste Extensão FEMIC',
      message_text: 'Teste de integração da extensão Chrome.',
      requested_period: 'tarde'
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }
    setStatus(response && response.ok ? 'Teste enviado para o FEMIC.' : (response && response.error) || 'Falha no teste.');
  });
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('test').addEventListener('click', sendTest);
load();
