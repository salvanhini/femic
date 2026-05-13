(function () {
  'use strict';

  const ROOT_ID = 'femic-wa-connector';
  const SEND_COOLDOWN_MS = 4000;
  const ACTIONS = [
    ['marcacao', 'Marcação'],
    ['remarcacao', 'Remarcação'],
    ['cancelamento', 'Cancelamento']
  ];

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function activeChatName() {
    const header = document.querySelector('header');
    const title = header && header.querySelector('[title]');
    if (title && text(title.getAttribute('title'))) return text(title.getAttribute('title'));
    const headerText = header ? text(header.innerText).split('\n')[0] : '';
    return headerText || '';
  }

  function selectedMessageText() {
    const selected = window.getSelection && text(window.getSelection().toString());
    if (selected) return selected;
    const messages = Array.from(document.querySelectorAll('[data-pre-plain-text] span.selectable-text, div.message-in span.selectable-text, div.message-out span.selectable-text'));
    const last = messages[messages.length - 1];
    return last ? text(last.innerText) : '';
  }

  function setStatus(message, tone) {
    const status = document.querySelector('#femicWaStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone || 'info';
  }

  function sendButton() {
    return document.querySelector('#femicWaSend');
  }

  function setSendingState(isSending, label) {
    const button = sendButton();
    if (!button) return;
    button.disabled = isSending;
    button.dataset.state = isSending ? 'sending' : (button.dataset.state || 'idle');
    button.textContent = label || (isSending ? 'Enviando...' : 'Enviar');
  }

  function setSentCooldown() {
    const button = sendButton();
    if (!button) return;
    button.disabled = true;
    button.dataset.state = 'success';
    button.textContent = 'Enviado';
    window.setTimeout(() => {
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = 'Enviar';
    }, SEND_COOLDOWN_MS);
  }

  function sendToFemic(payload) {
    setSendingState(true, 'Enviando...');
    chrome.runtime.sendMessage({ type: 'SEND_FEMIC_EVENT', payload }, (response) => {
      if (chrome.runtime.lastError) {
        setSendingState(false, 'Enviar');
        setStatus(chrome.runtime.lastError.message, 'error');
        return;
      }
      if (!response || !response.ok) {
        setSendingState(false, 'Enviar');
        setStatus((response && response.error) || 'Não foi possível enviar para o FEMIC.', 'error');
        return;
      }
      if (response.duplicate || response.ignored) {
        setSentCooldown();
        setStatus('Este envio já foi recebido há poucos segundos. Evitei duplicar a tarefa.', 'success');
        return;
      }
      setSentCooldown();
      setStatus('Tarefa enviada para o FEMIC com sucesso.', 'success');
    });
  }

  function fillFromChat() {
    const nameInput = document.querySelector('#femicWaPatient');
    const messageInput = document.querySelector('#femicWaMessage');
    if (nameInput && !nameInput.value) nameInput.value = activeChatName();
    if (messageInput) messageInput.value = selectedMessageText() || messageInput.value;
  }

  function submit() {
    const payload = {
      action: document.querySelector('#femicWaAction')?.value || 'marcacao',
      patient_name: document.querySelector('#femicWaPatient')?.value || activeChatName(),
      phone: document.querySelector('#femicWaPhone')?.value || '',
      requested_period: document.querySelector('#femicWaPeriod')?.value || '',
      requested_date: document.querySelector('#femicWaDate')?.value || '',
      message_text: document.querySelector('#femicWaMessage')?.value || selectedMessageText()
    };
    if (!payload.message_text.trim()) {
      setStatus('Informe ou selecione uma mensagem do WhatsApp.', 'error');
      return;
    }
    if (sendButton() && sendButton().disabled) {
      setStatus('Aguarde a confirmação do último envio antes de clicar novamente.', 'info');
      return;
    }
    sendToFemic(payload);
  }

  function createPanel() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <button class="femic-wa-tab" type="button" title="FEMIC">FEMIC</button>
      <div class="femic-wa-panel" hidden>
        <div class="femic-wa-head">
          <strong>Enviar para FEMIC</strong>
          <button type="button" id="femicWaClose">×</button>
        </div>
        <label>Ação
          <select id="femicWaAction">${ACTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
        </label>
        <label>Paciente
          <input id="femicWaPatient" placeholder="Nome do paciente">
        </label>
        <label>WhatsApp
          <input id="femicWaPhone" placeholder="16999999999">
        </label>
        <div class="femic-wa-row">
          <label>Período
            <select id="femicWaPeriod">
              <option value="">Sem preferência</option>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </select>
          </label>
          <label>Data
            <input id="femicWaDate" type="date">
          </label>
        </div>
        <label>Mensagem
          <textarea id="femicWaMessage" rows="4" placeholder="Selecione uma mensagem ou escreva o pedido do paciente"></textarea>
        </label>
        <div class="femic-wa-actions">
          <button type="button" id="femicWaCapture">Capturar conversa</button>
          <button type="button" id="femicWaSend">Enviar</button>
        </div>
        <p id="femicWaStatus">Abra o FEMIC em outra aba antes de enviar.</p>
      </div>
    `;
    document.documentElement.appendChild(root);
    const panel = root.querySelector('.femic-wa-panel');
    const openPanel = () => {
      panel.hidden = false;
      root.classList.add('is-open');
      fillFromChat();
    };
    const closePanel = () => {
      panel.hidden = true;
      root.classList.remove('is-open');
    };
    const togglePanel = () => {
      if (panel.hidden) openPanel();
      else closePanel();
    };
    root.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    root.querySelector('.femic-wa-tab').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
    root.querySelector('#femicWaClose').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    });
    root.querySelector('#femicWaCapture').addEventListener('click', fillFromChat);
    root.querySelector('#femicWaSend').addEventListener('click', submit);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) closePanel();
    });
  }

  createPanel();
})();
