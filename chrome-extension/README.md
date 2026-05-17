# FEMIC WhatsApp Connector

Extensão local do Chrome para transformar pedidos recebidos no WhatsApp Web em tarefas na aba IA do FEMIC.

## Instalação

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `chrome-extension` deste projeto.
5. Se o FEMIC estiver aberto por arquivo local (`file://`), habilite `Permitir acesso a URLs de arquivo` nos detalhes da extensão.
6. Para GitHub Pages, a extensão já permite páginas em `https://*.github.io/*`. Se houver mais de um sistema aberto, use o identificador no popup.

## Uso

1. Abra o FEMIC em uma aba.
2. Abra `https://web.whatsapp.com` em outra aba.
3. Entre em uma conversa.
4. Clique no botão flutuante `FEMIC`.
5. Escolha `Marcação`, `Remarcação` ou `Cancelamento`.
6. Revise paciente, telefone, período, data e mensagem.
7. Clique em `Enviar`.

O FEMIC receberá o evento interno `FEMIC_EXTENSION_EVENT` pelo canal DOM da extensão e criará uma tarefa em `IA > Pendências operacionais`.

## Observações

- A extensão não agenda automaticamente.
- A confirmação final continua manual dentro do FEMIC.
- O telefone pode ser preenchido manualmente quando o WhatsApp Web não expõe o número na tela.
- Se houver mais de uma aba parecida, abra o popup da extensão e preencha um identificador da URL do FEMIC, como `index.html`, `localhost:8000` ou `github.io`.
- A extensão não solicita permissão ampla para todos os sites; ela mira WhatsApp Web, arquivos locais, localhost/127.0.0.1 e GitHub Pages.
