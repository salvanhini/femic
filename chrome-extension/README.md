# FEMIC WhatsApp Connector

Extensão local do Chrome para transformar pedidos recebidos no WhatsApp Web em tarefas na aba IA do FEMIC.

## Instalação

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `chrome-extension` deste projeto.
5. Se o FEMIC estiver aberto por arquivo local (`file://`), habilite `Permitir acesso a URLs de arquivo` nos detalhes da extensão.

## Uso

1. Abra o FEMIC em uma aba.
2. Abra `https://web.whatsapp.com` em outra aba.
3. Entre em uma conversa.
4. Clique no botão flutuante `FEMIC`.
5. Escolha `Marcação`, `Remarcação` ou `Cancelamento`.
6. Revise paciente, telefone, período, data e mensagem.
7. Clique em `Enviar`.

O FEMIC receberá um evento `FEMIC_EXTENSION_EVENT` e criará uma tarefa em `IA > Pendências operacionais`.

## Observações

- A extensão não agenda automaticamente.
- A confirmação final continua manual dentro do FEMIC.
- O telefone pode ser preenchido manualmente quando o WhatsApp Web não expõe o número na tela.
- Se houver mais de uma aba parecida, abra o popup da extensão e preencha um identificador da URL do FEMIC, como `index.html` ou `localhost:8000`.
