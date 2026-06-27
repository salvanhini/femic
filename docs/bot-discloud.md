# Bot WhatsApp FEMIC — DisCloud

Bot Baileys que envia lembretes de consulta 12h antes pelo WhatsApp.

## Deploy no DisCloud

1. Faça upload da pasta `bot/` como um app Node.js no DisCloud
2. Configure as variáveis de ambiente:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (service_role key do Supabase)
WHATSAPP_SERVICE_NAME=baileys-main
WHATSAPP_LOGIN_METHOD=qr
WHATSAPP_PAIRING_PHONE=
HOURS_BEFORE=12
CHECK_INTERVAL_MINUTES=5
HEARTBEAT_INTERVAL_SECONDS=60
CLINIC_TIME_ZONE=America/Sao_Paulo
REMINDER_TOLERANCE_MINUTES=30
```

Use a `service_role key` no bot servidor. A `anon key` pode causar `permission denied for table appointments`
se as policies de RLS não liberarem leitura e atualização para acesso anônimo.

3. Inicie o bot. Na primeira execução, escaneie o QR Code com o WhatsApp que enviará as mensagens
4. O bot verifica a cada 5 minutos se há consultas com lembrete pendente e envia automaticamente

Se o QR Code não aparecer bem no log da DisCloud, mude `WHATSAPP_LOGIN_METHOD=pairing`
e preencha `WHATSAPP_PAIRING_PHONE` com o número da clínica em formato internacional,
por exemplo `5516999999999`.
O bot mostrará um código para usar em WhatsApp > Dispositivos conectados >
Conectar dispositivo > Conectar com número de telefone.

O `discloud.config` precisa ficar na raiz do pacote enviado, junto de `index.js` e `package.json`.
Para este projeto, envie o conteúdo da pasta `bot/` para a DisCloud.

## Local (dev)

```bash
cd bot
cp .env.example .env  # preencha as credenciais
npm install
npm start
```
