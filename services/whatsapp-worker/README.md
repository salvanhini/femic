# FEMIC WhatsApp Worker

Serviço Node separado para enviar confirmações automáticas via Baileys e registrar pedidos de agendamento como pendências revisáveis.

## Variáveis de ambiente

- `FEMIC_SUPABASE_URL`
- `FEMIC_SUPABASE_SERVICE_ROLE_KEY`
- `FEMIC_BAILEYS_SERVICE_NAME`
  - opcional, default: `baileys-main`
- `FEMIC_BAILEYS_POLL_MS`
  - opcional, default: `60000`
- `FEMIC_BAILEYS_SESSION_DIR`
  - opcional, default: `services/whatsapp-worker/.session`
- `FEMIC_BAILEYS_LOG_LEVEL`
  - opcional, default: `info`
- `FEMIC_BAILEYS_REPLY_DELAY_MIN_MS`
  - opcional, default: `1800`
- `FEMIC_BAILEYS_REPLY_DELAY_MAX_MS`
  - opcional, default: `4200`
- `FEMIC_BAILEYS_ADMIN_PHONE`
  - opcional, telefone com DDI para receber aviso quando o bot conectar/reconectar
- `FEMIC_GROQ_API_KEY`
  - opcional, mas recomendado para conversa natural no WhatsApp
- `FEMIC_GROQ_MODEL`
  - opcional, default: `llama-3.3-70b-versatile`

## Instalação

```bash
npm install
```

## Execução

```bash
npm run whatsapp-worker
```

Em hospedagens como Discloud, use o script padrão:

```bash
npm start
```

Na primeira execução, o Baileys imprime o QR no terminal. Depois de conectado, o worker:

- lê `schedule_settings` no Supabase;
- só envia confirmações se `whatsapp_provider = 'baileys'`;
- procura atendimentos `agendado` ou `confirmado` que vencem em `whatsapp_confirmation_hours_before`;
- grava auditoria de envio nos campos do agendamento;
- atualiza a tabela `whatsapp_service_status` para o painel do FEMIC.
- escuta mensagens recebidas pedindo marcação/remarcação;
- usa Groq, quando configurado, para entender frases naturais do paciente;
- espera alguns segundos antes de responder para a conversa ficar mais natural;
- avisa educadamente quando receber áudio e pede para o paciente escrever a solicitação;
- diferencia fisioterapia por convênio/grupo de quiropraxia e liberação miofascial individuais;
- pergunta antes de sugerir horário quando o tipo de atendimento estiver ambíguo;
- calcula sugestões respeitando expediente, bloqueios manuais, serviço individual/grupo e limite de vagas;
- cria uma pendência em `assistant_tasks` para revisão humana;
- não grava agendamento automaticamente na v1.

## Discloud

O projeto já inclui `discloud.config` na raiz:

```ini
NAME=femic-whatsapp-bot
TYPE=bot
MAIN=services/whatsapp-worker/index.mjs
RAM=512
VERSION=latest
START=npm start
```

Se encontrar a área de variáveis no painel do Discloud, cadastre os valores por lá. Se não encontrar, crie um arquivo `.env` na raiz do projeto antes de gerar o ZIP. Use `.env.discloud.example` como referência:

```bash
FEMIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
FEMIC_SUPABASE_SERVICE_ROLE_KEY=service-role-key
FEMIC_BAILEYS_SERVICE_NAME=baileys-main
FEMIC_BAILEYS_SESSION_DIR=.session
FEMIC_BAILEYS_POLL_MS=60000
FEMIC_BAILEYS_REPLY_DELAY_MIN_MS=1800
FEMIC_BAILEYS_REPLY_DELAY_MAX_MS=4200
FEMIC_BAILEYS_PAIRING_PHONE=
FEMIC_BAILEYS_ADMIN_PHONE=
FEMIC_GROQ_API_KEY=
FEMIC_GROQ_MODEL=llama-3.3-70b-versatile
```

O arquivo `.env` real fica no `.gitignore`. Ele não deve ser enviado para GitHub ou compartilhado em conversa.

O primeiro deploy precisa do QR Code do Baileys no log. Depois da conexão, preserve a pasta de sessão para evitar novo pareamento.

Se o QR não aparecer bem no log do Discloud, preencha `FEMIC_BAILEYS_PAIRING_PHONE` com o telefone do WhatsApp da clínica em formato internacional, por exemplo `5516999999999`. No próximo start, o log vai mostrar um código para usar em WhatsApp > Aparelhos conectados > Conectar com número de telefone.

Para gerar um ZIP limpo para upload:

```bash
npm run build:discloud
```

O arquivo será criado em `dist/femic-whatsapp-bot-discloud.zip`.

Se existir um `.env` local, o build inclui esse `.env` no ZIP privado para o Discloud. Se não existir, o ZIP é gerado sem segredos e depende das variáveis configuradas no painel.
