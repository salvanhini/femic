# FEMIC

Sistema clínico da FEMIC Fisioterapia com:
- gestão de pacientes
- evolução clínica e técnica
- anamnese com IA (Gemini/DeepSeek)
- sincronização com Supabase
- módulo de agenda
- suporte a App da Web (PWA) em modo conservador

## Versões atuais
- Sistema principal (`index.html`): `v3.5.0-pwa`
- Agenda (`agenda.html`): `v1.4.44`

## Estrutura principal
- `index.html`: app clínico principal
- `agenda.html`: módulo de agenda
- `js/femic-app.js`: lógica clínica, IA, backup e sincronização
- `js/femic-agenda.js`: lógica da agenda
- `css/femic.css`: estilo do sistema principal
- `css/femic-agenda.css`: estilo da agenda
- `logo.png`: identidade visual

## IA clínica (anamnese e evolução técnica)
- Provedores suportados: Google Gemini e DeepSeek
- Configurável por:
  - setup inicial
  - página de Backup/Configurações
  - seletor dentro dos cards de IA
- Modo econômico de tokens:
  - reduz tamanho das respostas
  - prioriza escrita mais objetiva
  - pode ser ligado/desligado nos cards de IA

## PWA (App da Web) — implementação conservadora
- Manifestos:
  - `manifest-femic.webmanifest`
  - `manifest-agenda.webmanifest`
- Service workers:
  - `sw-femic.js`
  - `sw-agenda.js`
- Estratégia de segurança:
  - cache apenas de shell/arquivos estáticos
  - **não cacheia** rotas de API do Supabase (`/rest/v1/` e `/auth/v1/`)
  - sincronização permanece em rede

## Backup e sincronização
- Backup local em JSON (export/import)
- Backup manual em nuvem via Supabase
- Restauração de dados via Supabase

## Observações
- As chaves de API ficam no armazenamento local do navegador.
- Para produção, usar HTTPS.
