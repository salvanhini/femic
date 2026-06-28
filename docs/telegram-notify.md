# Notificação de Captação via Telegram

Sempre que um paciente preencher o formulário de captação (`captacao.html`), uma mensagem estruturada é enviada automaticamente para um chat do Telegram com os dados da solicitação.

## Arquitetura

```
captacao.html  ──POST──>  Supabase Edge Function  ──sendMessage──>  Telegram Bot API  ──>  Seu Chat
                                 │
                                 └── Lê TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID dos Secrets
```

A Edge Function é escrita em Deno/TypeScript e roda serverless no próprio Supabase. O token do bot nunca é exposto no frontend.

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- Acesso ao projeto Supabase (project ref: `uhpyinpugdvcsmghgimd`)
- Token de bot do Telegram (criado via [@BotFather](https://t.me/BotFather))
- Chat ID de destino (obtido via [@userinfobot](https://t.me/userinfobot))

## Deploy passo a passo

### 1. Instalar Supabase CLI (se não tiver)

```bash
npm install -g supabase
# ou via brew
# brew install supabase/tap/supabase
```

Verifique:

```bash
supabase --version
```

### 2. Login no Supabase

```bash
supabase login
```

Abra o link que aparecer no terminal e faça o login no browser.

### 3. Linkar com o projeto

```bash
supabase link --project-ref uhpyinpugdvcsmghgimd
```

Será solicitada uma database password — é a senha que você definiu quando criou o projeto no Supabase. Se não lembrar, redefina em **Project Settings → Database → Reset Database Password**.

### 4. Configurar os segredos (variáveis de ambiente)

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=8245510284:AAGLWQNKY-IgeTNAfrlBFWe5HdKX3h67wZA
supabase secrets set TELEGRAM_CHAT_ID=1053536284
```

Para verificar se foram criados:

```bash
supabase secrets list
```

### 5. Fazer deploy da função

```bash
supabase functions deploy telegram-notify
```

A saída esperada:

```
Deploying telegram-notify...
Successfully deployed telegram-notify
```

### 6. Testar

Acesse o `captacao.html`, preencha o formulário e envie. A mensagem deve aparecer no Telegram em segundos.

Para testar diretamente pela API:

```bash
curl -X POST https://uhpyinpugdvcsmghgimd.supabase.co/functions/v1/telegram-notify \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "whatsapp": "16999999999",
    "pathology": "Dor no ombro",
    "insurance": "Unimed",
    "preferred_day": "quarta",
    "preferred_period": "tarde",
    "history": "Teste de envio",
    "patient_id": "p_test_001"
  }'
```

---

## Atualizar a função

Após modificar o arquivo `supabase/functions/telegram-notify/index.ts`, basta rodar novamente:

```bash
supabase functions deploy telegram-notify
```

## Logs

Para ver logs da função:

```bash
supabase functions logs telegram-notify
```

## Remover

```bash
supabase functions delete telegram-notify
```

---

## Arquivos envolvidos

| Arquivo | Descrição |
|---|---|
| `supabase/functions/telegram-notify/index.ts` | Código da Edge Function |
| `supabase/functions/telegram-notify/deno.json` | Config da task de serve |
| `captacao.html` | Frontend — chamada fire-and-forget para a função |

## Formato da mensagem no Telegram

```
📋 NOVA SOLICITAÇÃO DE AVALIAÇÃO
━━━━━━━━━━━━━━━━━━━
👤 Nome: Maria Silva
📱 WhatsApp: 16999999999
🩺 Patologia: Dor no joelho direito
🏥 Convênio: Unimed
📅 Preferência: Segunda - Manhã
📝 Histórico: Há duas semanas sinto dor...
━━━━━━━━━━━━━━━━━━━
📎 p_xxxxx
```
