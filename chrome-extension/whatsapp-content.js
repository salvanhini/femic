(function () {
  'use strict';

  const ROOT_ID = 'femic-wa-connector';
  const SEND_COOLDOWN_MS = 4000;
  const ESTADOS = {
    marcacao: { value: 'marcacao', label: 'Marcação' },
    remarcacao: { value: 'remarcacao', label: 'Remarcação' },
    cancelamento: { value: 'cancelamento', label: 'Cancelamento' }
  };

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

  function formatWhatsapp(value) {
    const raw = digits(value);
    if (!raw) return '';
    if (raw.length <= 2) return '(' + raw;
    if (raw.length <= 7) return '(' + raw.slice(0, 2) + ') ' + raw.slice(2);
    return '(' + raw.slice(0, 2) + ') ' + raw.slice(2, 7) + '-' + raw.slice(7);
  }

  function norm(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function activeChatName() {
    const header = document.querySelector('header');
    const title = header && header.querySelector('[title]');
    if (title && text(title.getAttribute('title'))) return text(title.getAttribute('title'));
    const headerText = header ? text(header.innerText).split('\n')[0] : '';
    return headerText || '';
  }

  function activeChatPhone() {
    const header = document.querySelector('header');
    if (!header) return '';
    const spans = header.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
      const raw = digits(spans[i].textContent);
      if (raw.length >= 10) return raw;
    }
    const all = text(header.innerText);
    const match = all.match(/(\d{2})\s?\d{4,5}[-\s]?\d{4}/);
    return match ? digits(match[0]) : '';
  }

  function selectedMessageText() {
    const selected = window.getSelection && text(window.getSelection().toString());
    if (selected) return selected;
    const messages = Array.from(document.querySelectorAll('[data-pre-plain-text] span.selectable-text, div.message-in span.selectable-text, div.message-out span.selectable-text'));
    const last = messages[messages.length - 1];
    return last ? text(last.innerText) : '';
  }

  function lastReceivedMessageText() {
    const inMessages = document.querySelectorAll('div.message-in div.copyable-text');
    if (!inMessages.length) return '';
    const last = inMessages[inMessages.length - 1];
    const spans = last.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
      const t = text(spans[i].innerText);
      if (t.length > 3) return t;
    }
    return text(last.innerText);
  }

  function detectAction(texto) {
    const n = norm(texto);
    if (/cancel|cancela|desmarcar|desmarca|nao vou poder|nao poderei/.test(n)) return 'cancelamento';
    if (/remarcar|reagendar|remanejar|mudar|trocar|alterar/.test(n)) return 'remarcacao';
    if (/marcar|agendar|queria|gostaria|preciso|pode|podia|consigo|vaga|horario|dia\s\d|semana|mes.*que vem/.test(n)) return 'marcacao';
    if (/quinta|sexta|sabado|domingo|segunda|terca|quarta/.test(n)) return 'marcacao';
    if (/manha|tarde|noite/.test(n)) return 'marcacao';
    return '';
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
      setSentCooldown();
      setStatus('Tarefa enviada para o FEMIC com sucesso.', 'success');
    });
  }

  function fillFromChat() {
    const name = activeChatName();
    const phone = activeChatPhone();
    const selected = selectedMessageText();
    const last = lastReceivedMessageText();
    const message = selected || last || '';
    const detected = detectAction(message);

    const nameInput = document.querySelector('#femicWaPatient');
    const phoneInput = document.querySelector('#femicWaPhone');
    const actionInput = document.querySelector('#femicWaAction');
    const messageInput = document.querySelector('#femicWaMessage');

    if (nameInput) nameInput.value = name;
    if (phoneInput) phoneInput.value = formatWhatsapp(phone);
    if (actionInput && detected) actionInput.value = detected;
    if (messageInput) messageInput.value = message || messageInput.value;

    setStatus(
      detected ? 'Ação detectada: ' + ESTADOS[detected].label : 'Nenhuma ação clara detectada. Selecione manualmente.',
      detected ? 'info' : 'warning'
    );
  }

  function quickSend() {
    const name = activeChatName();
    const phone = activeChatPhone();
    const selected = selectedMessageText();
    const last = lastReceivedMessageText();
    const message = selected || last || '';
    const detected = detectAction(message);

    if (!message.trim()) {
      setStatus('Nenhuma mensagem encontrada. Selecione uma mensagem ou abra o painel.', 'error');
      return;
    }

    const payload = {
      action: detected || 'marcacao',
      patient_name: name,
      phone: formatWhatsapp(phone),
      message_text: message
    };

    if (sendButton() && sendButton().disabled) {
      setStatus('Aguarde o envio anterior.', 'info');
      return;
    }

    sendToFemic(payload);
  }

  function bindPhoneMask() {
    const input = document.querySelector('#femicWaPhone');
    if (!input || input.dataset.maskBound === 'true') return;
    input.dataset.maskBound = 'true';
    const applyMask = () => { input.value = formatWhatsapp(input.value); };
    input.addEventListener('input', applyMask);
    input.addEventListener('blur', applyMask);
    applyMask();
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
      setStatus('Aguarde a confirmação do último envio.', 'info');
      return;
    }
    sendToFemic(payload);
  }

  function createPanel() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <button class="femic-wa-tab" type="button" title="FEMIC">F</button>
      <button class="femic-wa-quick" type="button" id="femicWaQuick" title="Enviar conversa atual">⚡</button>
      <div class="femic-wa-panel" hidden>
        <div class="femic-wa-head">
          <strong>FEMIC — Enviar para agenda</strong>
          <button type="button" id="femicWaClose">×</button>
        </div>
        <label>Ação detectada
          <select id="femicWaAction">
            <option value="marcacao">Marcação</option>
            <option value="remarcacao">Remarcação</option>
            <option value="cancelamento">Cancelamento</option>
          </select>
        </label>
        <label>Paciente
          <input id="femicWaPatient" placeholder="Nome do paciente">
        </label>
        <label>WhatsApp
          <input id="femicWaPhone" placeholder="(16) 99999-9999" inputmode="numeric" maxlength="15">
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
          <textarea id="femicWaMessage" rows="4" placeholder="Selecionada automaticamente ou escreva o pedido"></textarea>
        </label>
        <div class="femic-wa-actions">
          <button type="button" id="femicWaCapture" title="Preencher dados do chat atual">📋 Capturar</button>
          <button type="button" id="femicWaSend">Enviar</button>
        </div>
        <p id="femicWaStatus">⚡ Botão rápido envia com um clique. Abra o FEMIC em outra aba.</p>
      </div>
    `;
    document.documentElement.appendChild(root);

    bindPhoneMask();

    const panel = root.querySelector('.femic-wa-panel');

    function openPanel() {
      panel.hidden = false;
      root.classList.add('is-open');
      fillFromChat();
    }
    function closePanel() {
      panel.hidden = true;
      root.classList.remove('is-open');
    }
    function togglePanel() {
      if (panel.hidden) openPanel();
      else closePanel();
    }

    root.addEventListener('click', (e) => e.stopPropagation());

    root.querySelector('.femic-wa-tab').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    root.querySelector('#femicWaQuick').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      quickSend();
    });

    root.querySelector('#femicWaClose').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });

    root.querySelector('#femicWaCapture').addEventListener('click', fillFromChat);
    root.querySelector('#femicWaSend').addEventListener('click', submit);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });
  }

  createPanel();
})();
