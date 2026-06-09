# Fechamento Final da Agenda Semanal - Design

## Contexto

O projeto FEMIC chegou a um ponto de maturidade em que o foco deixou de ser adicionar funcionalidades e passou a ser estabilizar, otimizar e polir a experiência final. A agenda semanal é a área mais sensível para esse fechamento porque concentra uso frequente, leitura rápida de informações e maior risco de lentidão perceptível quando o volume de dados cresce.

A base atual já atende o fluxo principal, mas a semana acumula sinais de expansão incremental: renderização com filtragens repetidas, folha de estilos com múltiplas camadas sobrepostas para o mesmo componente e risco de inconsistência visual entre versões antigas e atuais dos cards.

## Objetivo

Executar um fechamento conservador inteligente da agenda semanal, preservando a arquitetura atual e concentrando as mudanças em:

- performance pontual da renderização semanal;
- correção de fragilidades com potencial de bug sob maior volume de dados;
- limpeza cirúrgica de redundâncias e código morto apenas nas áreas tocadas;
- polimento visual dos cards de pacientes com direção minimalista e destaque controlado para status e horários.

## Escopo

Incluído neste fechamento:

- otimização do fluxo de preparação de dados da agenda semanal;
- redução de trabalho repetido durante filtros e montagem visual da semana;
- limpeza de CSS redundante ou conflitante ligado aos cards e à grade semanal;
- refinamento da hierarquia visual dos cards da semana;
- validação funcional da visão semanal em desktop e mobile.

Fora de escopo:

- refatoração ampla de arquitetura;
- mudança de persistência, banco, Supabase ou integrações externas;
- alteração de regras de negócio de pacotes, saldo, lembretes ou IA, exceto se algum bug diretamente ligado à agenda semanal precisar de ajuste pequeno e seguro;
- reorganização massiva de arquivos.

## Abordagens Consideradas

### 1. Conservador puro

Mexer apenas em bugs claros e pequenos ajustes visuais.

Prós:

- risco mínimo;
- execução rápida.

Contras:

- mantém acúmulo visual e técnico já perceptível;
- ganho limitado em desempenho futuro.

### 2. Conservador inteligente

Preservar a estrutura do sistema e atuar cirurgicamente na agenda semanal, limpando redundâncias, reduzindo recomputações e refinando os cards.

Prós:

- melhor equilíbrio entre segurança e melhoria real;
- reduz lentidão perceptível sem reabrir a arquitetura;
- melhora consistência visual do componente mais importante do fechamento.

Contras:

- exige validação mais cuidadosa que um retoque superficial.

### 3. Conservador com preparação para escala

Executar a abordagem 2 e ainda adicionar pequenas bases internas para suportar crescimento de dados, desde que sem risco estrutural.

Prós:

- deixa o sistema mais pronto para maior volume;
- pode reduzir custo de renderização e leitura no futuro próximo.

Contras:

- aumenta o escopo de verificação;
- pode tocar mais áreas do que o necessário para o fechamento.

## Abordagem Escolhida

Seguir a abordagem 2, com adoção pontual de elementos da abordagem 3 apenas quando o ganho for claro e o risco for baixo.

Isso significa:

- não refatorar a arquitetura;
- melhorar a preparação e reutilização dos dados exibidos na semana;
- reduzir concorrência de estilos herdados e duplicados nos cards semanais;
- priorizar legibilidade, consistência e desempenho percebido.

## Arquitetura da Solução

### JavaScript

O arquivo principal da agenda será preservado. A mudança será localizada no fluxo da agenda semanal.

Direção técnica:

- consolidar a lista de agendamentos visíveis por ciclo de render;
- evitar filtragens repetidas por dia e por status dentro do mesmo desenho da semana;
- agrupar dados por dia para reutilização em contagem, layout dos eventos e resumo visual;
- manter as regras atuais de abertura, clique e resumo dos cards;
- remover ou neutralizar utilitários redundantes apenas se estiver claro que não são mais usados na área alterada.

### CSS

O CSS da agenda será racionalizado sem redesign amplo.

Direção visual:

- criar uma camada final mais clara e estável para os cards semanais;
- reduzir excesso de sombra, borda e ruído visual;
- reforçar a hierarquia entre horário, nome do paciente e estado do atendimento;
- manter diferenciação por status com contraste suficiente, mas sem aparência carregada;
- garantir responsividade consistente da grade e dos cards.

## Componentes Afetados

- `js/femic-agenda.js`
- `css/femic-agenda.css`

Opcionalmente, apenas se necessário para consistência local e sem ampliar escopo:

- estilos compartilhados diretamente envolvidos na agenda semanal.

## Fluxo de Dados

Fluxo desejado para a visão semanal:

1. Ler filtros ativos uma vez por render.
2. Derivar uma coleção visível da semana atual.
3. Agrupar essa coleção por data.
4. Reutilizar os grupos para:
   - contagem por dia;
   - layout visual dos eventos;
   - estados de vazio/fechado;
   - resumo ao abrir um item.
5. Renderizar a interface sem recalcular desnecessariamente as mesmas listas.

Esse fluxo melhora a previsibilidade do custo de renderização sem alterar a origem dos dados nem a lógica de negócio.

## Tratamento de Risco

As alterações devem permanecer restritas à visão semanal e seus estilos correspondentes. Se surgir necessidade de mudança estrutural fora dessa área, ela não entra neste fechamento.

Critérios de contenção:

- não alterar contratos de persistência;
- não alterar formato de dados vindos do Supabase;
- não mover responsabilidade entre módulos;
- preferir limpeza local em vez de deduplicação agressiva global;
- interromper qualquer refino que exija cascata de mudanças fora da agenda semanal.

## Estratégia de Teste

Validação mínima obrigatória:

- abrir a agenda semanal e confirmar renderização correta;
- verificar filtros por status e serviço;
- testar clique em card e abertura do resumo;
- testar criação/abertura a partir do clique em espaço da grade;
- verificar estados de hoje, dia fechado e cards com status distintos;
- revisar a visualização em desktop e mobile;
- executar verificações locais de sintaxe e regressão básica disponíveis no projeto.

## Critérios de Sucesso

- a agenda semanal renderiza com menos recomputação visível e sem regressão funcional;
- os cards ficam mais limpos, legíveis e consistentes;
- estilos redundantes ou conflitantes da área tocada deixam de competir entre si;
- nenhuma regra de negócio principal é alterada;
- o fechamento entrega maior confiança para uso com volume crescente de dados sem reabrir a arquitetura.
