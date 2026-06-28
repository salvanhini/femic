# INSTRUÇÕES DE DEPLOY

## 1. CRIAR TABELA whatsapp_inbox

**Onde:** Supabase Dashboard → SQL Editor
**O que colar:**
Abra `docs/sql/create_whatsapp_inbox.sql`, copie todo o conteúdo e cole no SQL Editor.
Execute (botão "Run" ou Ctrl+Enter).

---

## 2. DEPLOY DA EDGE FUNCTION (Telegram)

**Pré-requisito:** Supabase CLI instalado e logado
```bash
npm install -g supabase        # se não tiver
supabase login                 # logar no Supabase
```

**No terminal, dentro da pasta do projeto:**
```bash
supabase link --project-ref uhpyinpugdvcsmghgimd
# (vai pedir a database password)
supabase functions deploy telegram-notify
```

Verificar segredos:
```bash
supabase secrets list
# Deve mostrar TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID
# Se não tiver, rodar:
supabase secrets set TELEGRAM_BOT_TOKEN=8245510284:AAGLWQNKY-IgeTNAfrlBFWe5HdKX3h67wZA
supabase secrets set TELEGRAM_CHAT_ID=1053536284
```

---

## 3. DEPLOY DO BOT (DisCloud)

**Arquivo:** `/tmp/femic-bot.zip` (64 KB)

**Passos no DisCloud:**
1. Acessar https://discloud.com e fazer login
2. Ir em "Bots" → "Upload Bot"
3. Selecionar o arquivo `femic-bot.zip`
4. Clicar em "Upload"

**Configurar variáveis de ambiente no DisCloud:**
No painel do bot → "Environment Variables", adicionar:
```
SUPABASE_URL=https://uhpyinpugdvcsmghgimd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocHlpbnB1Z2R2Y3NtZ2hnaW1kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjU4MjE4MiwiZXhwIjoyMDk4MTU4MTgyfQ.k08XHD5nP3J9wgYj-yO5FocXDGJGofYjDWnL4AlubKA
GROQ_API_KEY=<sua chave Groq>
GROQ_MODEL=llama-3.3-70b-versatile
CLINIC_TIME_ZONE=America/Sao_Paulo
CHECK_INTERVAL_MINUTES=5
HOURS_BEFORE=12
```

**IMPORTANTE:** Use `SUPABASE_SERVICE_ROLE_KEY`, NÃO use `SUPABASE_ANON_KEY`. O bot precisa de permissão de escrita no banco.

---

## 4. DEPLOY DO SITE (index.html + js/)

Se estiver usando Vercel, Netlify ou GitHub Pages:
- Fazer push do código atualizado para o repositório
- O deploy automático vai incluir as alterações em:
  - `index.html` (nav Inbox + botões de limpeza)
  - `js/femic-agenda.js` (renderInbox + cleanup + fix agenda-assistida)
  - `js/femic-ai-center.js` (exposição da função + listener)
  - `js/femic-unified.js`
  - `captacao.html` (correção do erro title/type)

---

## 5. TESTAR

1. Abrir o site e ir na aba "Inbox" — deve mostrar KPIs zerados (tabela vazia)
2. Enviar uma mensagem para o WhatsApp do bot — deve aparecer no Inbox
3. Abrir "Agenda Assistida" — select de pacientes deve estar populado
4. Ir em "Pendências" → clicar "Agendar" — deve abrir Agenda Assistida com dados preenchidos
5. Testar formulário de captação — task + Telegram devem chegar
