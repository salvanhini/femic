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
    return String(value || '').replace(/\D/g, '').slice(0, 14);
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
    var name = '';

    // Strategy 1: conversation title via cell-frame-title
    try {
      var t1 = document.querySelector('[data-testid="cell-frame-title"]');
      if (t1) {
        var txt = text(t1.textContent || t1.innerText);
        if (txt && txt.length > 1 && txt !== 'WhatsApp') return txt;
      }
    } catch(e) {}

    // Strategy 2: span[title] inside main area with capital letter
    try {
      if (!name) {
        var main = document.querySelector('div[role="main"]');
        if (main) {
          var spans = main.querySelectorAll('span[title]');
          for (var i = 0; i < spans.length; i++) {
            var t = text(spans[i].getAttribute('title'));
            if (t && t.length > 2 && t !== 'WhatsApp' && t !== 'FEMIC' &&
                t !== 'Sair' && t !== 'Sair de' && t !== 'Nova conversa' &&
                t !== 'Status' && t !== 'Comunidades' && t !== 'Listas de transmissão' &&
                t !== 'Configurações' && t !== 'Favoritos') {
              if (/^[A-ZÀ-ÿ]/.test(t.charAt(0))) { name = t; break; }
            }
          }
        }
      }
    } catch(e) {}

    // Strategy 3: heading elements inside main
    try {
      if (!name) {
        var main2 = document.querySelector('div[role="main"]');
        if (main2) {
          var hs = main2.querySelectorAll('h1, h2, h3, h4');
          for (var hi = 0; hi < hs.length; hi++) {
            var ht = text(hs[hi].textContent || hs[hi].innerText);
            if (ht && ht.length > 1 && ht !== 'WhatsApp Web' && ht !== 'Chats') {
              name = ht; break;
            }
          }
        }
      }
    } catch(e) {}

    // Strategy 4: header > [title]
    try {
      if (!name) {
        var hdr = document.querySelector('header');
        var t4a = hdr && hdr.querySelector('[title]');
        if (t4a) {
          var t4 = text(t4a.getAttribute('title'));
          if (t4 && t4.length > 2 && t4 !== 'WhatsApp') name = t4;
        }
      }
    } catch(e) {}

    // Strategy 5: ALL [title] on page, pick best candidate
    try {
      if (!name) {
        var all = document.querySelectorAll('[title]');
        var cands = [];
        var excludes = ['WhatsApp','FEMIC','Sair','Nova conversa','Status',
                        'Comunidades','Listas de transmissão','Configurações',
                        'Favoritos','Ligar','Vídeo','Anexar','Mais opções',
                        'Silenciar','Mensagens','Mídia','Links','Documentos',
                        'Fotos','Vídeos','Arquivos','Stickers','Mapa','Contato',
                        'Sair do grupo','Encerrar','Fechar','Search','Pesquisar',
                        'Emoji','Adesivos','GIF','Enviar','Gravar','Áudio'];
        for (var j = 0; j < all.length; j++) {
          var tt = text(all[j].getAttribute('title'));
          if (tt && tt.length > 3 && excludes.indexOf(tt) === -1 &&
              /^[A-ZÀ-ÿ]/.test(tt.charAt(0))) {
            cands.push(tt);
          }
        }
        if (cands.length) {
          cands.sort(function(a,b){ return b.length - a.length; });
          name = cands[0];
        }
      }
    } catch(e) {}

    // Strategy 6: data-testid="conversation-info" or drawer title
    try {
      if (!name) {
        var ci = document.querySelector('[data-testid="conversation-info"], [data-testid="info-drawer-title"]');
        if (ci) {
          var t6 = text(ci.textContent || ci.innerText);
          if (t6 && t6.length > 1 && t6 !== 'WhatsApp') name = t6.split('\n')[0];
        }
      }
    } catch(e) {}

    // Strategy 7: fallback — first big text in right panel
    try {
      if (!name) {
        var rp = document.querySelector('[data-testid="main"]');
        if (rp) {
          var allPs = rp.querySelectorAll('span');
          for (var k = 0; k < allPs.length; k++) {
            var pt = text(allPs[k].textContent || allPs[k].innerText);
            if (pt && pt.length > 3 && /^[A-ZÀ-ÿ]/.test(pt.charAt(0)) &&
                pt !== 'WhatsApp Web' && pt !== 'Chats') {
              name = pt; break;
            }
          }
        }
      }
    } catch(e) {}

    return name || '';
  }

  function activeChatPhone() {
    var phone = '';

    // Strategy 1: cell-frame-subtitle
    try {
      var sub = document.querySelector('[data-testid="cell-frame-subtitle"]');
      if (sub) {
        var t1 = text(sub.textContent || sub.innerText);
        if (t1 && !/online|digitando|disponível|última vez|há|last seen/i.test(t1)) {
          var d1 = digits(t1);
          if (d1.length >= 10 && d1.length <= 13) phone = d1;
        }
      }
      if (phone && phone.length >= 10) return phone;
    } catch(e) {}

    // Strategy 2: ALL spans — find phone-pattern text
    try {
      if (!phone) {
        var allSpans = document.querySelectorAll('[data-testid="cell-frame-container"] span, div[role="main"] span');
        for (var i = 0; i < allSpans.length; i++) {
          var raw = digits(allSpans[i].textContent || allSpans[i].innerText || '');
          if (raw.length === 11 || raw.length === 12 || raw.length === 13 ||
             (raw.length === 10 && /^0/.test(allSpans[i].textContent || ''))) {
            if (/^(55|[1-9]{2})/.test(raw) || raw.length === 11 || raw.length === 12) {
              phone = raw; break;
            }
          }
        }
      }
    } catch(e) {}

    // Strategy 3: title attributes that look like phone numbers
    try {
      if (!phone) {
        var titled = document.querySelectorAll('[data-testid="cell-frame-container"] [title], [title]');
        for (var j = 0; j < titled.length; j++) {
          var t = titled[j].getAttribute('title') || '';
          if (/^[\d\s\-\(\)\+\+]+$/.test(t) && digits(t).length >= 10) {
            phone = digits(t); if (phone.length >= 10 && phone.length <= 13) break;
          }
        }
      }
    } catch(e) {}

    // Strategy 4: header text regex
    try {
      if (!phone) {
        var hdr = document.querySelector('header');
        if (hdr) {
          var htxt = text(hdr.innerText);
          var m = htxt.match(/(\+\d{0,3}\s?)?(\(\d{2}\))\s?\d{4,5}[-\s]?\d{4}/);
          if (m) phone = digits(m[0]);
        }
      }
    } catch(e) {}

    // Strategy 5: search data-pre-plain-text for sender phone
    try {
      if (!phone) {
        var msgs = document.querySelectorAll('[data-pre-plain-text]');
        for (var k = 0; k < msgs.length; k++) {
          var meta = msgs[k].getAttribute('data-pre-plain-text') || '';
          var mPhone = meta.match(/[\+\(]?(\d{2})[\)\s]?\d{4,5}[-\s]?\d{3,4}/);
          if (mPhone) { phone = digits(mPhone[0]); break; }
        }
      }
    } catch(e) {}

    // Strategy 6: drawer/conversation-info table rows
    try {
      if (!phone) {
        var drawer = document.querySelector('[data-testid="drawer-container"]');
        if (drawer) {
          var allEl = drawer.querySelectorAll('span, div');
          for (var n = 0; n < allEl.length; n++) {
            var raw = digits(allEl[n].textContent || allEl[n].innerText || '');
            if (raw.length === 11 || raw.length === 12 || raw.length === 13) {
              if (/^(55|[1-9]{2})/.test(raw)) { phone = raw; break; }
            }
          }
        }
      }
    } catch(e) {}

    // Final cleanup
    if (phone) {
      if (phone.length === 10) phone = '55' + phone;
      if (phone.length === 11 && phone.charAt(0) === '0') phone = phone.substring(1);
      if (phone.length > 13) phone = phone.substring(0, 13);
    }

    return phone || '';
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

  function showToast(message, tone) {
    tone = tone || 'info';
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:144px;right:24px;z-index:9999999;padding:12px 18px;border-radius:14px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:320px;line-height:1.4;transition:opacity .3s;font-family:"Segoe UI",sans-serif';
    toast.style.background = tone === 'success' ? '#10b981' : tone === 'error' ? '#ef4444' : '#0b5fa5';
    toast.style.color = '#fff';
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    window.setTimeout(function() { toast.style.opacity = '0'; }, 3000);
    window.setTimeout(function() { toast.remove(); }, 3500);
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
    window.setTimeout(function() {
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
        var msg = chrome.runtime.lastError.message;
        setStatus(msg, 'error');
        showToast('Erro: ' + msg, 'error');
        return;
      }
      if (!response || !response.ok) {
        setSendingState(false, 'Enviar');
        var msg = (response && response.error) || 'Não foi possível enviar para o FEMIC.';
        setStatus(msg, 'error');
        showToast('Erro: ' + msg, 'error');
        return;
      }
      setSentCooldown();
      setStatus('Tarefa enviada para o FEMIC com sucesso.', 'success');
      showToast('Tarefa enviada para o FEMIC ✓', 'success');
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

  function getPanel() {
    return document.querySelector('#femic-wa-connector .femic-wa-panel');
  }

  function openPanel() {
    var p = getPanel();
    if (!p) return;
    p.hidden = false;
    document.getElementById(ROOT_ID).classList.add('is-open');
    fillFromChat();
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
      showToast('Nenhuma mensagem encontrada. Selecione um texto no chat.', 'error');
      openPanel();
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
      showToast('Aguarde o envio anterior.', 'info');
      return;
    }

    showToast((detected ? '✏️ ' + ESTADOS[detected].label : '📩 Enviando') + ' para o FEMIC…', 'info');
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
      var btn = e.currentTarget;
      btn.style.transform = 'scale(.85)';
      btn.style.transition = 'transform .12s';
      window.setTimeout(function(){ btn.style.transform = ''; }, 150);
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

  // Auto-fill on conversation change
  var lastChatTitle = '';
  function autoFillOnChatChange() {
    try {
      var target = document.querySelector('[data-testid="cell-frame-title"]') ||
                   document.querySelector('header [title]');
      if (!target) return;
      var current = target.textContent || target.innerText || '';
      if (current && current !== lastChatTitle) {
        lastChatTitle = current;
        var p = getPanel();
        if (p && !p.hidden) {
          fillFromChat();
        }
      }
    } catch(e) {}
  }

  // Observe DOM changes to detect conversation switches
  try {
    var chatObserver = new MutationObserver(function(mutations) {
      var shouldCheck = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList' || m.type === 'attributes') {
          if (m.target && (m.target.getAttribute('data-testid') === 'cell-frame-title' ||
              m.target.getAttribute('data-testid') === 'cell-frame-subtitle' ||
              m.target.tagName === 'HEADER')) {
            shouldCheck = true;
            break;
          }
          var p = m.target.parentElement;
          if (p && (p.getAttribute('data-testid') === 'cell-frame-title' ||
                    p.getAttribute('data-testid') === 'cell-frame-subtitle' ||
                    p.tagName === 'HEADER')) {
            shouldCheck = true;
            break;
          }
        }
      }
      if (shouldCheck) {
        setTimeout(autoFillOnChatChange, 400);
      }
    });

    var observeTarget = document.querySelector('header, [data-testid="cell-frame-title"], [data-testid="cell-frame-container"]');
    if (observeTarget) {
      chatObserver.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title', 'data-testid', 'class']
      });
    }

    var mainArea = document.querySelector('div[role="main"]');
    if (mainArea) {
      chatObserver.observe(mainArea, {
        childList: true,
        subtree: true
      });
    }
  } catch(e) {}

  // Initial fill on load
  window.setTimeout(function() {
    fillFromChat();
  }, 800);

  createPanel();
})();