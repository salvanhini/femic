(function () {
  'use strict';

  const ROOT_ID = 'femic-wa-connector';
  const SEND_COOLDOWN_MS = 4000;
  const AUTO_REFRESH_DELAY_MS = 450;
  const CAPTURES_KEY = 'femic-wa-captures';
  const FIELDS_TO_TRACK = ['femicWaPatient', 'femicWaPhone', 'femicWaAction', 'femicWaPeriod', 'femicWaDate', 'femicWaMessage'];
  const ESTADOS = {
    marcacao: { value: 'marcacao', label: 'Marcacao' },
    remarcacao: { value: 'remarcacao', label: 'Remarcacao' },
    cancelamento: { value: 'cancelamento', label: 'Cancelamento' }
  };

  let autoRefreshTimer = null;
  let autoChatSignature = '';
  let chatObserver = null;
  let micRecognition = null;
  let micListening = false;
  let micSupported = false;

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function normalizePhoneForUi(value) {
    let raw = digits(value);
    if (raw.startsWith('55') && raw.length >= 12) raw = raw.slice(2);
    if (raw.length > 11) raw = raw.slice(-11);
    return raw.slice(0, 11);
  }

  function formatWhatsapp(value) {
    const raw = normalizePhoneForUi(value);
    if (!raw) return '';
    if (raw.length <= 2) return '(' + raw;
    if (raw.length <= 6) return '(' + raw.slice(0, 2) + ') ' + raw.slice(2);
    if (raw.length <= 10) return '(' + raw.slice(0, 2) + ') ' + raw.slice(2, 6) + '-' + raw.slice(6);
    return '(' + raw.slice(0, 2) + ') ' + raw.slice(2, 7) + '-' + raw.slice(7, 11);
  }

  function normalizePhoneForSend(value) {
    const raw = normalizePhoneForUi(value);
    return raw ? '55' + raw : '';
  }

  function norm(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function fieldMeta(id) {
    return {
      input: document.getElementById(id),
      note: document.getElementById(id + 'Note')
    };
  }

  function setFieldState(id, tone, message) {
    const meta = fieldMeta(id);
    if (!meta.input) return;
    meta.input.dataset.captureState = tone || 'empty';
    if (meta.note) {
      meta.note.textContent = message || '';
      meta.note.dataset.tone = tone || 'empty';
    }
  }

  function markManualEdit(id) {
    const meta = fieldMeta(id);
    if (!meta.input) return;
    meta.input.dataset.dirty = 'true';
    setFieldState(id, 'manual', 'Editado manualmente. Nova captura so entra por acao explicita.');
  }

  function isDirty(id) {
    const meta = fieldMeta(id);
    return !!(meta.input && meta.input.dataset.dirty === 'true');
  }

  function setCapturedValue(id, value, options) {
    const meta = fieldMeta(id);
    const opts = options || {};
    if (!meta.input) return false;
    if (opts.preserveManual && isDirty(id)) return false;
    if (!value && !opts.allowEmpty) return false;
    meta.input.value = value || '';
    meta.input.dataset.autoValue = value || '';
    meta.input.dataset.dirty = 'false';
    setFieldState(id, opts.tone || 'strong', opts.message || 'Capturado da conversa atual.');
    return true;
  }

  function resetFieldTracking(id) {
    const meta = fieldMeta(id);
    if (!meta.input) return;
    meta.input.dataset.autoValue = '';
    meta.input.dataset.dirty = 'false';
    setFieldState(id, 'empty', '');
  }

  function bindFieldTracking() {
    FIELDS_TO_TRACK.forEach(function (id) {
      const meta = fieldMeta(id);
      if (!meta.input || meta.input.dataset.trackBound === 'true') return;
      meta.input.dataset.trackBound = 'true';
      const handler = function () {
        if ((meta.input.dataset.autoValue || '') !== meta.input.value) markManualEdit(id);
      };
      meta.input.addEventListener('input', handler);
      meta.input.addEventListener('change', handler);
    });
  }

  function activeChatNameDetails() {
    let found = { value: '', confidence: 'weak', source: 'heuristica visual' };

    try {
      const t1 = document.querySelector('[data-testid="cell-frame-title"]');
      if (t1) {
        const txt = text(t1.textContent || t1.innerText);
        if (txt && txt.length > 1 && txt !== 'WhatsApp') return { value: txt, confidence: 'strong', source: 'titulo da conversa' };
      }
    } catch (e) {}

    try {
      const main = document.querySelector('div[role="main"]');
      if (main) {
        const spans = main.querySelectorAll('span[title]');
        for (let i = 0; i < spans.length; i += 1) {
          const candidate = text(spans[i].getAttribute('title'));
          if (candidate && candidate.length > 2 && candidate !== 'WhatsApp' && candidate !== 'FEMIC' && /^[A-ZÀ-ÿ]/.test(candidate.charAt(0))) {
            return { value: candidate, confidence: 'weak', source: 'titulo visivel' };
          }
        }
      }
    } catch (e) {}

    try {
      const ci = document.querySelector('[data-testid="conversation-info"], [data-testid="info-drawer-title"]');
      if (ci) {
        const txt = text(ci.textContent || ci.innerText).split('\n')[0];
        if (txt && txt !== 'WhatsApp') return { value: txt, confidence: 'strong', source: 'drawer da conversa' };
      }
    } catch (e) {}

    try {
      const all = document.querySelectorAll('[title]');
      const excludes = ['WhatsApp', 'FEMIC', 'Sair', 'Nova conversa', 'Status', 'Comunidades', 'Listas de transmissão', 'Configurações', 'Favoritos', 'Ligar', 'Vídeo', 'Anexar', 'Mais opções', 'Silenciar', 'Mensagens', 'Mídia', 'Links', 'Documentos', 'Fotos', 'Vídeos', 'Arquivos', 'Stickers', 'Mapa', 'Contato', 'Encerrar', 'Fechar', 'Search', 'Pesquisar', 'Emoji', 'Adesivos', 'GIF', 'Enviar', 'Gravar', 'Áudio'];
      for (let i = 0; i < all.length; i += 1) {
        const candidate = text(all[i].getAttribute('title'));
        if (candidate && candidate.length > 3 && excludes.indexOf(candidate) === -1 && /^[A-ZÀ-ÿ]/.test(candidate.charAt(0))) {
          found = { value: candidate, confidence: 'weak', source: 'titulo amplo da pagina' };
          break;
        }
      }
    } catch (e) {}

    return found;
  }

  function activeChatPhoneDetails() {
    let phone = '';
    let confidence = 'weak';
    let source = 'heuristica visual';

    try {
      const sub = document.querySelector('[data-testid="cell-frame-subtitle"]');
      if (sub) {
        const subtitle = text(sub.textContent || sub.innerText);
        if (subtitle && !/online|digitando|disponível|ultima vez|há|last seen/i.test(subtitle)) {
          const parsed = normalizePhoneForUi(subtitle);
          if (parsed.length >= 10) return { value: parsed, confidence: 'strong', source: 'subtitulo da conversa' };
        }
      }
    } catch (e) {}

    try {
      const drawer = document.querySelector('[data-testid="drawer-container"]');
      if (drawer) {
        const allEl = drawer.querySelectorAll('span, div');
        for (let i = 0; i < allEl.length; i += 1) {
          const parsed = normalizePhoneForUi(allEl[i].textContent || allEl[i].innerText || '');
          if (parsed.length >= 10) return { value: parsed, confidence: 'strong', source: 'drawer do contato' };
        }
      }
    } catch (e) {}

    try {
      const spans = document.querySelectorAll('[data-testid="cell-frame-container"] span, div[role="main"] span');
      for (let i = 0; i < spans.length; i += 1) {
        const parsed = normalizePhoneForUi(spans[i].textContent || spans[i].innerText || '');
        if (parsed.length >= 10) {
          phone = parsed;
          confidence = 'weak';
          source = 'texto visivel da conversa';
          break;
        }
      }
    } catch (e) {}

    if (!phone) {
      try {
        const titled = document.querySelectorAll('[data-testid="cell-frame-container"] [title], [title]');
        for (let i = 0; i < titled.length; i += 1) {
          const parsed = normalizePhoneForUi(titled[i].getAttribute('title') || '');
          if (parsed.length >= 10) {
            phone = parsed;
            confidence = 'weak';
            source = 'atributo de titulo';
            break;
          }
        }
      } catch (e) {}
    }

    if (!phone) {
      try {
        const msgs = document.querySelectorAll('[data-pre-plain-text]');
        for (let i = 0; i < msgs.length; i += 1) {
          const parsed = normalizePhoneForUi(msgs[i].getAttribute('data-pre-plain-text') || '');
          if (parsed.length >= 10) {
            phone = parsed;
            confidence = 'weak';
            source = 'metadado da mensagem';
            break;
          }
        }
      } catch (e) {}
    }

    return { value: phone, confidence: phone ? confidence : 'weak', source: phone ? source : 'telefone nao localizado' };
  }

  function selectedMessageDetails() {
    const selected = window.getSelection && text(window.getSelection().toString());
    if (selected) return { value: selected, confidence: 'strong', source: 'trecho selecionado' };
    const messages = Array.from(document.querySelectorAll('[data-pre-plain-text] span.selectable-text, div.message-in span.selectable-text, div.message-out span.selectable-text'));
    const last = messages[messages.length - 1];
    const fallback = last ? text(last.innerText) : '';
    return { value: fallback, confidence: fallback ? 'weak' : 'weak', source: fallback ? 'ultima mensagem visivel' : 'mensagem nao localizada' };
  }

  function lastReceivedMessageDetails() {
    const inMessages = document.querySelectorAll('div.message-in div.copyable-text');
    if (!inMessages.length) return { value: '', confidence: 'weak', source: 'sem mensagem recebida' };
    const last = inMessages[inMessages.length - 1];
    const spans = last.querySelectorAll('span');
    for (let i = 0; i < spans.length; i += 1) {
      const value = text(spans[i].innerText);
      if (value.length > 3) return { value: value, confidence: 'weak', source: 'ultima mensagem recebida' };
    }
    return { value: text(last.innerText), confidence: 'weak', source: 'ultima mensagem recebida' };
  }

  function detectAction(texto) {
    const normalized = norm(texto);
    if (/cancel|cancela|desmarcar|desmarca|nao vou poder|nao poderei/.test(normalized)) return 'cancelamento';
    if (/remarcar|reagendar|remanejar|mudar|trocar|alterar/.test(normalized)) return 'remarcacao';
    if (/marcar|agendar|queria|gostaria|preciso|pode|podia|consigo|vaga|horario|dia\s\d|semana|mes.*que vem/.test(normalized)) return 'marcacao';
    if (/quinta|sexta|sabado|domingo|segunda|terca|quarta/.test(normalized)) return 'marcacao';
    if (/manha|tarde|noite/.test(normalized)) return 'marcacao';
    return '';
  }

  function getChatSnapshot() {
    const name = activeChatNameDetails();
    const phone = activeChatPhoneDetails();
    const selected = selectedMessageDetails();
    const fallback = lastReceivedMessageDetails();
    const message = selected.value ? selected : fallback;
    const action = detectAction(message.value);
    return {
      name: name,
      phone: phone,
      message: message,
      action: {
        value: action,
        confidence: action ? 'strong' : 'weak',
        source: action ? 'intencao inferida da mensagem' : 'confirmacao manual necessaria'
      },
      signature: [name.value, phone.value, message.value.slice(0, 120)].join('|')
    };
  }

  function showToast(message, tone) {
    const toneName = tone || 'info';
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:144px;right:24px;z-index:9999999;padding:12px 18px;border-radius:14px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:320px;line-height:1.4;transition:opacity .3s;font-family:"Segoe UI",sans-serif';
    toast.style.background = toneName === 'success' ? '#10b981' : toneName === 'error' ? '#ef4444' : toneName === 'warning' ? '#d97706' : '#0b5fa5';
    toast.style.color = '#fff';
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    window.setTimeout(function () { toast.style.opacity = '0'; }, 3000);
    window.setTimeout(function () { toast.remove(); }, 3500);
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

  function getPanel() {
    return document.querySelector('#' + ROOT_ID + ' .femic-wa-panel');
  }

  function panelVisible() {
    const panel = getPanel();
    return !!(panel && !panel.hidden);
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
    window.setTimeout(function () {
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = 'Enviar';
    }, SEND_COOLDOWN_MS);
  }

  function getCaptures() {
    try {
      return JSON.parse(localStorage.getItem(CAPTURES_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCapture(name, phone) {
    let list = getCaptures();
    list.unshift({ name: name || '', phone: normalizePhoneForSend(phone), time: Date.now() });
    if (list.length > 20) list = list.slice(0, 20);
    try {
      localStorage.setItem(CAPTURES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function wasAlreadySent(name, phone) {
    const list = getCaptures();
    const cleanPhone = normalizePhoneForSend(phone);
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const sameName = item.name && name && String(item.name).toLowerCase() === String(name).toLowerCase();
      const samePhone = item.phone && cleanPhone && String(item.phone) === String(cleanPhone);
      if (sameName || samePhone) return item;
    }
    return null;
  }

  function clearPanel() {
    FIELDS_TO_TRACK.forEach(function (id) {
      const meta = fieldMeta(id);
      if (meta.input) meta.input.value = '';
      resetFieldTracking(id);
    });
    const action = document.querySelector('#femicWaAction');
    const period = document.querySelector('#femicWaPeriod');
    const date = document.querySelector('#femicWaDate');
    if (action) action.value = 'marcacao';
    if (period) period.value = '';
    if (date) date.value = '';
  }

  function fillFromChat(options) {
    const opts = options || {};
    const snapshot = getChatSnapshot();
    if (!snapshot.signature) {
      setStatus('Nao consegui localizar a conversa atual. Revise manualmente.', 'warning');
      return snapshot;
    }

    if (opts.source === 'auto' && snapshot.signature === autoChatSignature) return snapshot;

    setCapturedValue('femicWaPatient', snapshot.name.value, {
      preserveManual: opts.preserveManual,
      tone: snapshot.name.value ? snapshot.name.confidence : 'warning',
      message: snapshot.name.value ? 'Paciente vindo de ' + snapshot.name.source + '.' : 'Nome nao encontrado automaticamente.'
    });
    setCapturedValue('femicWaPhone', formatWhatsapp(snapshot.phone.value), {
      preserveManual: opts.preserveManual,
      tone: snapshot.phone.value ? snapshot.phone.confidence : 'warning',
      message: snapshot.phone.value ? 'WhatsApp vindo de ' + snapshot.phone.source + '.' : 'Telefone nao encontrado com seguranca.'
    });
    if (snapshot.action.value) {
      setCapturedValue('femicWaAction', snapshot.action.value, {
        preserveManual: opts.preserveManual,
        tone: 'strong',
        message: 'Acao inferida da mensagem atual.'
      });
    } else if (!opts.preserveManual || !isDirty('femicWaAction')) {
      setFieldState('femicWaAction', 'warning', 'Acao incerta. Confirme antes de enviar.');
    }
    setCapturedValue('femicWaMessage', snapshot.message.value, {
      preserveManual: opts.preserveManual,
      tone: snapshot.message.value ? snapshot.message.confidence : 'warning',
      message: snapshot.message.value ? 'Mensagem vinda de ' + snapshot.message.source + '.' : 'Mensagem nao localizada automaticamente.'
    });

    const previous = wasAlreadySent(snapshot.name.value, snapshot.phone.value);
    if (previous) {
      const ago = Math.max(1, Math.round((Date.now() - previous.time) / 60000));
      setStatus('Este contato ja foi enviado ha ' + ago + ' min. Revise antes de reenviar.', 'warning');
    } else if (!snapshot.action.value || (!snapshot.name.value && !snapshot.phone.value)) {
      setStatus('Captura parcial. Revise os campos destacados antes de enviar.', 'warning');
    } else if (opts.source === 'auto') {
      setStatus('Conversa trocada. Campos livres foram atualizados sem sobrescrever sua edicao.', 'info');
    } else {
      setStatus('Captura pronta. Revise e envie quando estiver seguro.', 'success');
    }

    autoChatSignature = snapshot.signature;
    return snapshot;
  }

  function bindPhoneMask() {
    const input = document.querySelector('#femicWaPhone');
    if (!input || input.dataset.maskBound === 'true') return;
    input.dataset.maskBound = 'true';
    const applyMask = function () {
      input.value = formatWhatsapp(input.value);
    };
    input.addEventListener('input', applyMask);
    input.addEventListener('blur', applyMask);
    applyMask();
  }

  function checkMicSupport() {
    micSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const btn = document.querySelector('#femicWaMic');
    if (!btn) return;
    btn.title = micSupported ? 'Ditar mensagem da tarefa' : 'Microfone indisponivel';
    if (!micSupported) btn.style.opacity = '.5';
  }

  function stopMic() {
    if (micRecognition && micListening) {
      try { micRecognition.stop(); } catch (e) {}
    }
    micListening = false;
    const btn = document.querySelector('#femicWaMic');
    if (btn) btn.classList.remove('is-listening');
  }

  function startMic() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      showToast('Microfone indisponivel. Digite a mensagem manualmente.', 'error');
      const msgInput = document.querySelector('#femicWaMessage');
      if (msgInput) msgInput.focus();
      return;
    }
    if (micListening) {
      stopMic();
      return;
    }
    try {
      micRecognition = new Ctor();
    } catch (e) {
      showToast('Microfone bloqueado. Verifique as permissoes do navegador.', 'error');
      return;
    }
    micRecognition.lang = 'pt-BR';
    micRecognition.interimResults = true;
    micRecognition.continuous = true;
    const baseText = document.querySelector('#femicWaMessage');
    let existing = baseText ? String(baseText.value || '').trim() : '';
    micRecognition.onstart = function () {
      micListening = true;
      const btn = document.querySelector('#femicWaMic');
      if (btn) btn.classList.add('is-listening');
      setStatus('Microfone ativo. Fale agora para montar a mensagem.', 'info');
    };
    micRecognition.onresult = function (event) {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (baseText) {
        baseText.value = existing + (existing && final ? ' ' : '') + final + interim;
        markManualEdit('femicWaMessage');
      }
      if (final) existing = baseText ? String(baseText.value || '').trim() : existing;
    };
    micRecognition.onerror = function (event) {
      stopMic();
      let message = 'Falha no microfone.';
      if (event && event.error === 'not-allowed') message = 'Microfone bloqueado. Libere a permissao no navegador.';
      else if (event && event.error === 'no-speech') message = 'Nenhuma voz detectada. Tente novamente.';
      else if (event && event.error === 'network') message = 'Erro de rede ao usar o microfone.';
      setStatus(message, 'error');
      showToast(message, 'error');
    };
    micRecognition.onend = function () {
      stopMic();
    };
    try {
      micRecognition.start();
    } catch (e) {
      stopMic();
      showToast('Nao foi possivel iniciar o microfone.', 'error');
    }
  }

  function sendToFemic(payload) {
    setSendingState(true, 'Enviando...');
    chrome.runtime.sendMessage({ type: 'SEND_FEMIC_EVENT', payload: payload }, function (response) {
      if (chrome.runtime.lastError) {
        setSendingState(false, 'Enviar');
        const message = chrome.runtime.lastError.message;
        setStatus(message, 'error');
        showToast('Erro: ' + message, 'error');
        return;
      }
      if (!response || !response.ok) {
        setSendingState(false, 'Enviar');
        const message = (response && response.error) || 'Nao foi possivel enviar para o FEMIC.';
        setStatus(message, 'error');
        showToast('Erro: ' + message, 'error');
        return;
      }
      if (response.duplicate || response.ignored) {
        setSendingState(false, 'Enviar');
        setStatus('Pedido repetido ignorado para evitar duplicidade recente.', 'warning');
        showToast('Envio ignorado por duplicidade recente.', 'info');
        return;
      }
      saveCapture(payload.patient_name, payload.phone);
      clearPanel();
      setSentCooldown();
      setStatus('Tarefa enviada para o FEMIC com sucesso.', 'success');
      showToast('Tarefa enviada para o FEMIC.', 'success');
    });
  }

  function buildPayloadFromInputs() {
    return {
      action: document.querySelector('#femicWaAction')?.value || 'marcacao',
      patient_name: text(document.querySelector('#femicWaPatient')?.value || ''),
      phone: normalizePhoneForSend(document.querySelector('#femicWaPhone')?.value || ''),
      requested_period: document.querySelector('#femicWaPeriod')?.value || '',
      requested_date: document.querySelector('#femicWaDate')?.value || '',
      message_text: text(document.querySelector('#femicWaMessage')?.value || '')
    };
  }

  function quickSend() {
    const panel = getPanel();
    const snapshot = fillFromChat({ preserveManual: false, source: 'manual' });
    if (!snapshot.message.value.trim()) {
      if (panel) panel.hidden = false;
      setStatus('Nenhuma mensagem encontrada. Revise manualmente.', 'error');
      showToast('Nenhuma mensagem encontrada. Abra o painel e revise.', 'error');
      return;
    }
    if (!snapshot.action.value || (!snapshot.name.value && !snapshot.phone.value)) {
      if (panel) panel.hidden = false;
      setStatus('Captura parcial. Revise os campos antes do envio rapido.', 'warning');
      showToast('Revise os campos antes de enviar.', 'info');
      return;
    }
    const payload = {
      action: snapshot.action.value,
      patient_name: snapshot.name.value,
      phone: normalizePhoneForSend(snapshot.phone.value),
      message_text: snapshot.message.value,
      requested_period: '',
      requested_date: ''
    };
    if (sendButton() && sendButton().disabled) {
      setStatus('Aguarde o envio anterior.', 'info');
      return;
    }
    setStatus('Envio rapido pronto. Mandando para Pendencias.', 'info');
    sendToFemic(payload);
  }

  function submit() {
    const payload = buildPayloadFromInputs();
    if (!payload.message_text.trim()) {
      setStatus('Informe ou selecione uma mensagem do WhatsApp.', 'error');
      return;
    }
    if (sendButton() && sendButton().disabled) {
      setStatus('Aguarde a confirmacao do ultimo envio.', 'info');
      return;
    }
    sendToFemic(payload);
  }

  function scheduleAutoCapture() {
    if (!panelVisible()) return;
    if (autoRefreshTimer) window.clearTimeout(autoRefreshTimer);
    autoRefreshTimer = window.setTimeout(function () {
      fillFromChat({ preserveManual: true, source: 'auto' });
    }, AUTO_REFRESH_DELAY_MS);
  }

  function bindChatObserver() {
    if (chatObserver) return;
    const target = document.body;
    if (!target) return;
    chatObserver = new MutationObserver(function () {
      scheduleAutoCapture();
    });
    chatObserver.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['title', 'data-testid', 'class'] });
  }

  function createPanel() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <button class="femic-wa-btn" type="button" id="femicWaBtn" title="Abrir FEMIC">F</button>
      <button class="femic-wa-quick" type="button" id="femicWaQuick" title="Envio rapido da conversa atual">⚡</button>
      <div class="femic-wa-panel" hidden>
        <div class="femic-wa-head">
          <strong>FEMIC — enviar para Pendencias</strong>
          <button type="button" id="femicWaClose">×</button>
        </div>
        <label>Acao
          <select id="femicWaAction">
            <option value="marcacao">Marcacao</option>
            <option value="remarcacao">Remarcacao</option>
            <option value="cancelamento">Cancelamento</option>
          </select>
          <span class="femic-wa-note" id="femicWaActionNote"></span>
        </label>
        <label>Paciente
          <input id="femicWaPatient" placeholder="Nome do paciente">
          <span class="femic-wa-note" id="femicWaPatientNote"></span>
        </label>
        <label>WhatsApp
          <input id="femicWaPhone" placeholder="(16) 99999-9999" inputmode="numeric" maxlength="16">
          <span class="femic-wa-note" id="femicWaPhoneNote"></span>
        </label>
        <div class="femic-wa-row">
          <label>Periodo
            <select id="femicWaPeriod">
              <option value="">Sem preferencia</option>
              <option value="manha">Manha</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </select>
            <span class="femic-wa-note" id="femicWaPeriodNote"></span>
          </label>
          <label>Data
            <input id="femicWaDate" type="date">
            <span class="femic-wa-note" id="femicWaDateNote"></span>
          </label>
        </div>
        <label>Mensagem
          <textarea id="femicWaMessage" rows="4" placeholder="Selecionada automaticamente ou escrita manualmente"></textarea>
          <span class="femic-wa-note" id="femicWaMessageNote"></span>
        </label>
        <div class="femic-wa-actions">
          <button type="button" id="femicWaCapture" title="Preencher dados da conversa atual">Capturar</button>
          <button type="button" id="femicWaMic" title="Ditar mensagem">🎤</button>
          <button type="button" id="femicWaSend">Enviar</button>
        </div>
        <p id="femicWaStatus">Abra a conversa, capture e envie para Pendencias.</p>
      </div>
    `;
    document.documentElement.appendChild(root);

    bindFieldTracking();
    bindPhoneMask();
    checkMicSupport();
    bindChatObserver();
    FIELDS_TO_TRACK.forEach(resetFieldTracking);

    const panel = root.querySelector('.femic-wa-panel');
    const btn = root.querySelector('#femicWaBtn');

    try {
      const saved = localStorage.getItem('femic-wa-btn-pos');
      if (saved) {
        const pos = JSON.parse(saved);
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
          root.style.right = 'auto';
          root.style.bottom = 'auto';
          root.style.left = pos.left + 'px';
          root.style.top = pos.top + 'px';
        }
      }
    } catch (e) {}

    function closePanel() {
      panel.hidden = true;
    }

    function openPanel() {
      panel.hidden = false;
      fillFromChat({ preserveManual: true, source: 'manual' });
    }

    function togglePanel() {
      if (panel.hidden) openPanel();
      else closePanel();
    }

    let isDragging = false;
    let dragThreshold = 5;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    function onPointerDown(e) {
      if (e.button && e.button !== 0) return;
      isDragging = false;
      moved = false;
      startX = e.clientX || (e.touches && e.touches[0].clientX);
      startY = e.clientY || (e.touches && e.touches[0].clientY);
      const rect = root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      btn.classList.add('is-dragging');
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = cx - startX;
      const dy = cy - startY;
      if (!isDragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
        isDragging = true;
        moved = true;
      }
      if (!isDragging) return;
      e.preventDefault();
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.left = (startLeft + dx) + 'px';
      root.style.top = (startTop + dy) + 'px';
    }

    function onPointerUp() {
      btn.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
      if (isDragging) {
        const rect = root.getBoundingClientRect();
        try {
          localStorage.setItem('femic-wa-btn-pos', JSON.stringify({ left: rect.left, top: rect.top }));
        } catch (e) {}
      }
      isDragging = false;
    }

    btn.addEventListener('mousedown', onPointerDown);
    btn.addEventListener('touchstart', onPointerDown, { passive: true });
    btn.addEventListener('click', function (e) {
      if (moved) return;
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    root.addEventListener('click', function (e) { e.stopPropagation(); });

    root.querySelector('#femicWaQuick').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      quickSend();
    });

    root.querySelector('#femicWaClose').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });

    root.querySelector('#femicWaCapture').addEventListener('click', function () {
      fillFromChat({ preserveManual: false, source: 'manual' });
    });
    root.querySelector('#femicWaMic').addEventListener('click', startMic);
    root.querySelector('#femicWaSend').addEventListener('click', submit);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });
  }

  createPanel();
})();
