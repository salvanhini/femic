const APP_VERSION = 'v3.5.0-pwa';
  // Link estável para o módulo separado de agenda.
  // No GitHub Pages, salve a agenda oficial como agenda.html na mesma pasta deste sistema principal.
  const FEMIC_AGENDA_URL = './agenda.html';
  const FEMIC_DOCUMENTS_URL = './documentos.html';
  const REPORT_LOGO_DATA_URI = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" fill="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stop-color="#24c3ef"/>
          <stop offset="0.55" stop-color="#0b64b7"/>
          <stop offset="1" stop-color="#0b3c6f"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="18" fill="url(#g)"/>
      <circle cx="14" cy="14" r="5" fill="white" fill-opacity="0.95"/>
      <circle cx="28" cy="20" r="5" fill="white" fill-opacity="0.95"/>
      <circle cx="17" cy="34" r="5" fill="white" fill-opacity="0.95"/>
      <circle cx="34" cy="40" r="5" fill="white" fill-opacity="0.95"/>
      <rect x="28" y="50" width="48" height="14" rx="7" transform="rotate(-28 28 50)" fill="white" fill-opacity="0.2"/>
      <text x="80" y="30" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="3" fill="#0b3c6f">FEM</text>
      <text x="141" y="30" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="3" fill="#16b5e5">IC</text>
      <text x="80" y="49" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#64748b">Fisioterapia · Araraquara, SP</text>
    </svg>`);

  const ANAMNESE_TEMPLATES = [
  /* ── COLUNA ─────────────────────────────────────────────── */
  {
    id:'cervicalgia_mecanica',
    label:'Cervicalgia mecânico-postural',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor em região cervical, associada a rigidez, tensão muscular e desconforto ao final do dia, com piora em posturas mantidas.',
      history:'Quadro com características mecânico-posturais, relacionado a sobrecarga funcional, manutenção prolongada de postura e uso repetitivo de computador/dispositivos.',
      diagnosis:'Hipótese compatível com cervicalgia mecânico-postural.',
      limitations:'Limitação para rotação cervical, manutenção prolongada de postura sentada, atividades repetitivas e movimentos amplos de cabeça e pescoço.',
      goals:'Redução do quadro álgico, melhora da mobilidade cervical, correção postural e ganho de controle muscular.',
      obs:'Paciente orientado(a) quanto à ergonomia, pausas posturais e adesão ao plano terapêutico.'
    }
  },
  {
    id:'hernia_cervical',
    label:'Hérnia de disco cervical',
    group:'Coluna',
    values:{
      chief:'Paciente refere cervicalgia com irradiação para membro superior, associada a parestesia, desconforto e limitação funcional.',
      history:'Quadro sugestivo de comprometimento discogênico cervical, com piora a movimentos cervicais, posturas mantidas e sobrecarga funcional.',
      diagnosis:'Hipótese compatível com hérnia de disco cervical com comprometimento radicular.',
      limitations:'Limitação para movimentos cervicais, esforços com membro superior, permanência prolongada em posturas desfavoráveis e atividades repetitivas.',
      goals:'Redução da dor, melhora da mobilidade, alívio de sinais compressivos e progressão funcional segura.',
      obs:'Orientado(a) a evitar movimentos bruscos e sobrecarga, mantendo seguimento fisioterapêutico.'
    }
  },
  {
    id:'cefaleia_tensional',
    label:'Cefaleia tensional / dor de cabeça',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor de cabeça de característica tensional, associada a tensão cervical, rigidez suboccipital e piora ao final do dia ou em períodos de estresse.',
      history:'Quadro associado a tensão musculoesquelética cervical e suboccipital, com padrão mecânico e relação com postura, estresse e sobrecarga funcional.',
      diagnosis:'Hipótese compatível com cefaleia tensional de origem musculoesquelética / cervicogênica.',
      limitations:'Limitação para concentração, atividades prolongadas, exposição à luz intensa e situações de sobrecarga posicional.',
      goals:'Redução da frequência e intensidade das crises, melhora da mobilidade cervical, controle muscular e qualidade de vida.',
      obs:'Paciente orientado(a) quanto a gatilhos posturais, pausas ativas e técnicas de autocuidado.'
    }
  },
  {
    id:'lombalgia_mecanica',
    label:'Lombalgia mecânica',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor em região lombar, com piora aos esforços, permanência prolongada em pé/sentado(a) e movimentos de flexão.',
      history:'Quadro de início progressivo, com padrão mecânico, associado a sobrecarga funcional e limitação em atividades de vida diária.',
      diagnosis:'Hipótese compatível com lombalgia mecânica.',
      limitations:'Limitação para abaixar, levantar cargas, permanecer sentado(a) por tempo prolongado e realizar atividades funcionais com flexão de tronco.',
      goals:'Controle do quadro álgico, melhora funcional, ganho de mobilidade lombopélvica e estabilidade de core.',
      obs:'Paciente orientado(a) quanto à proteção lombar, ajustes posturais e exercícios domiciliares.'
    }
  },
  {
    id:'lombociatalgia',
    label:'Lombociatalgia',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor lombar com irradiação para membro inferior, associada a desconforto neural e limitação funcional.',
      history:'Quadro compatível com irritação lombossacra, com piora a esforços, permanência prolongada sentado(a) e determinados movimentos da coluna.',
      diagnosis:'Hipótese compatível com lombociatalgia por comprometimento radicular L4-S1.',
      limitations:'Limitação para marcha prolongada, permanecer sentado(a), mudanças posturais e atividades com sobrecarga lombar.',
      goals:'Redução da dor irradiada, melhora funcional, ganho de mobilidade e progressão segura das atividades.',
      obs:'Paciente orientado(a) quanto a sinais de agravamento e necessidade de acompanhamento evolutivo.'
    }
  },
  {
    id:'hernia_lombar',
    label:'Hérnia de disco lombar',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor lombar intensa com irradiação para membro inferior, parestesia e limitação funcional importante.',
      history:'Quadro discogênico lombar com comprometimento neural, piora a esforços, inclinações e permanência sentado(a). Diagnóstico por imagem confirmado.',
      diagnosis:'Hérnia de disco lombar com comprometimento radicular, em tratamento fisioterapêutico conservador.',
      limitations:'Limitação importante para marcha, esforços, flexão de tronco e permanência sentado(a) por tempo prolongado.',
      goals:'Controle da dor e inflamação, descompressão neural progressiva, estabilização lombar e retorno funcional seguro.',
      obs:'Paciente orientado(a) quanto a posições de alívio, proteção da coluna e sinais de alerta neurológico.'
    }
  },
  {
    id:'estenose_canal',
    label:'Estenose do canal lombar',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor lombar com irradiação bilateral e dificuldade progressiva para caminhar, com melhora em flexão de tronco.',
      history:'Quadro progressivo compatível com compressão do canal vertebral lombar, com claudicação neurogênica e piora à extensão e ortostatismo prolongado.',
      diagnosis:'Hipótese compatível com estenose do canal lombar com comprometimento funcional.',
      limitations:'Limitação importante para marcha, ortostatismo prolongado e extensão lombar. Melhora em posições de flexão.',
      goals:'Melhora da tolerância à marcha, controle de sintomas, fortalecimento e estabilização lombar segura.',
      obs:'Paciente orientado(a) quanto a posições de alívio, progressão gradual e monitoramento contínuo dos sintomas.'
    }
  },
  {
    id:'espondilolistese',
    label:'Espondilolistese',
    group:'Coluna',
    values:{
      chief:'Paciente refere dor lombar persistente, com irradiação ocasional e dificuldade para atividades que exijam extensão ou carga axial.',
      history:'Quadro associado a escorregamento vertebral, com instabilidade segmentar e repercussão funcional progressiva.',
      diagnosis:'Espondilolistese lombar em acompanhamento fisioterapêutico conservador.',
      limitations:'Limitação para extensão lombar, cargas axiais, esforços e atividades de impacto.',
      goals:'Estabilização segmentar, controle do quadro álgico, melhora funcional e orientação postural.',
      obs:'Paciente orientado(a) quanto aos movimentos de risco, progressão segura e importância do fortalecimento muscular.'
    }
  },

  /* ── QUADRIL ─────────────────────────────────────────────── */
  {
    id:'coxartrose',
    label:'Coxartrose / artrose de quadril',
    group:'Quadril',
    values:{
      chief:'Paciente refere dor em região inguinal e quadril, com rigidez matinal, crepitação e limitação progressiva para marcha e atividades funcionais.',
      history:'Quadro degenerativo de quadril com padrão progressivo, piora em carga, rotações e após repouso prolongado.',
      diagnosis:'Hipótese compatível com coxartrose, com limitação funcional moderada a importante.',
      limitations:'Limitação para marcha, subir/descer escadas, calçar sapatos, rotação de quadril e atividades com carga.',
      goals:'Controle da dor, melhora da mobilidade, fortalecimento do complexo lombo-pélvico-femoral e ganho de funcionalidade.',
      obs:'Paciente orientado(a) quanto ao manejo de carga, proteção articular e progressão terapêutica conforme tolerância.'
    }
  },
  {
    id:'quadril_tendinopatia_glutea',
    label:'Tendinopatia glútea / dor lateral do quadril',
    group:'Quadril',
    values:{
      chief:'Paciente refere dor lateral em quadril, com piora à marcha, ao apoio e ao deitar sobre o lado acometido.',
      history:'Quadro compatível com sobrecarga tendínea e instabilidade do complexo lombo-pélvico-femoral, com repercussão funcional.',
      diagnosis:'Hipótese compatível com tendinopatia glútea / síndrome dolorosa lateral do quadril.',
      limitations:'Limitação para caminhar, subir escadas, permanecer em apoio prolongado e deitar sobre o lado sintomático.',
      goals:'Redução da dor, melhora da estabilidade pélvica, fortalecimento progressivo e retorno funcional.',
      obs:'Paciente orientado(a) quanto à adaptação das atividades e ao manejo de carga conforme tolerância clínica.'
    }
  },
  {
    id:'bursite_trocanterica',
    label:'Bursite trocantérica',
    group:'Quadril',
    values:{
      chief:'Paciente refere dor em região lateral de quadril, com sensibilidade local e desconforto ao apoio e marcha.',
      history:'Quadro de característica inflamatória e mecânica, associado a sobrecarga local e limitação funcional progressiva.',
      diagnosis:'Hipótese compatível com bursite trocantérica.',
      limitations:'Limitação para marcha prolongada, apoio unipodal, subir escadas e deitar sobre o lado acometido.',
      goals:'Controle do quadro álgico, melhora funcional, redução de sobrecarga local e progressão terapêutica segura.',
      obs:'Paciente orientado(a) quanto à redução de impacto, manejo de carga e continuidade do acompanhamento fisioterapêutico.'
    }
  },
  {
    id:'pos_op_atq',
    label:'Pós-operatório de ATQ (artroplastia total de quadril)',
    group:'Quadril',
    values:{
      chief:'Paciente em fase pós-operatória de artroplastia total de quadril, com dor, edema residual e limitação funcional para marcha e atividades.',
      history:'Paciente submetido(a) a ATQ, encontrando-se em fase de reabilitação. Evolução compatível com protocolo pós-operatório.',
      diagnosis:'Pós-operatório de artroplastia total de quadril em reabilitação fisioterapêutica.',
      limitations:'Limitação para marcha, transferências, escadas, calçar sapatos e atividades com rotação e flexão de quadril acima de 90°.',
      goals:'Controle álgico e edema, recuperação de marcha, força e funcionalidade, com respeito às precauções do implante.',
      obs:'Paciente orientado(a) quanto às precauções do pós-operatório de ATQ, uso de dispositivo auxiliar e progressão segura.'
    }
  },
  {
    id:'impacto_femoroacetabular',
    label:'Síndrome do impacto femoroacetabular',
    group:'Quadril',
    values:{
      chief:'Paciente refere dor inguinal e em quadril, com piora em flexão, rotação interna e atividades que exijam amplitude extrema.',
      history:'Quadro compatível com impacto femoroacetabular, com limitação funcional e repercussão em atividades esportivas e cotidianas.',
      diagnosis:'Hipótese compatível com síndrome do impacto femoroacetabular.',
      limitations:'Limitação para flexão profunda de quadril, rotações, agachamentos e atividades esportivas de maior intensidade.',
      goals:'Controle da dor, melhora da estabilidade lombo-pélvica, fortalecimento glúteo e retorno funcional progressivo.',
      obs:'Paciente orientado(a) quanto aos movimentos de impacto e progressão dentro dos limites sintomáticos.'
    }
  },

  /* ── JOELHO ─────────────────────────────────────────────── */
  {
    id:'gonalgia',
    label:'Gonalgia / dor no joelho',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor em joelho, principalmente durante esforço, marcha prolongada e atividades funcionais.',
      history:'Quadro associado a sobrecarga funcional do joelho, com repercussão em atividades de vida diária e tolerância ao movimento.',
      diagnosis:'Hipótese compatível com disfunção mecânica de joelho.',
      limitations:'Limitação para agachar, subir e descer escadas, caminhar por longos períodos e realizar atividades com carga.',
      goals:'Controle da dor, melhora funcional, ganho de força e progressão do desempenho nas atividades habituais.',
      obs:'Paciente orientado(a) quanto ao controle de carga, progressão gradual e continuidade dos exercícios prescritos.'
    }
  },
  {
    id:'gonartrose',
    label:'Gonartrose',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor em joelho, associada a rigidez, crepitação e limitação funcional progressiva.',
      history:'Quadro degenerativo progressivo, com piora em atividades de carga, agachamento, marcha prolongada e subida/descida de escadas.',
      diagnosis:'Hipótese compatível com gonartrose medial/lateral com limitação funcional.',
      limitations:'Limitação para marcha prolongada, subir e descer escadas, agachar e realizar atividades funcionais com carga.',
      goals:'Redução da dor, melhora funcional, ganho de estabilidade e fortalecimento global do membro inferior.',
      obs:'Paciente orientado(a) quanto ao manejo de carga, exercícios domiciliares e progressão conforme tolerância.'
    }
  },
  {
    id:'sindrome_femoropatelar',
    label:'Síndrome femoropatelar',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor anterior no joelho, principalmente ao subir/descer escadas, agachar e permanecer sentado(a) por tempo prolongado.',
      history:'Quadro compatível com sobrecarga femoropatelar, associado a desalinhamentos e déficit de controle muscular.',
      diagnosis:'Hipótese compatível com síndrome femoropatelar.',
      limitations:'Limitação para agachar, subir/descer escadas, permanecer sentado(a) por longos períodos e flexão repetida de joelho.',
      goals:'Redução da dor, melhora do alinhamento funcional, fortalecimento de quadríceps e glúteos e ganho de controle biomecânico.',
      obs:'Paciente orientado(a) quanto à mecânica de movimento e redução de sobrecargas.'
    }
  },
  {
    id:'condromalacia_patelar',
    label:'Condromalácia patelar',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor anterior no joelho, especialmente em escadas, agachamentos e permanência sentada prolongada.',
      history:'Quadro associado a sobrecarga patelofemoral e desequilíbrio muscular, com impacto funcional progressivo.',
      diagnosis:'Hipótese compatível com condromalácia patelar.',
      limitations:'Limitação para subir escadas, agachar, permanecer sentado(a) por longos períodos e atividades de impacto.',
      goals:'Redução do quadro álgico, melhora do alinhamento funcional, fortalecimento muscular e retorno progressivo às atividades.',
      obs:'Paciente orientado(a) quanto à progressão gradual da carga e à necessidade de regularidade terapêutica.'
    }
  },
  {
    id:'meniscopatia',
    label:'Meniscopatia / lesão de menisco',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor em joelho, com sensação de bloqueio, derrame articular e limitação funcional. Piora em rotação e carga.',
      history:'Quadro compatível com lesão meniscal, confirmado por exame de imagem, com repercussão funcional em marcha, agachamento e atividades de carga.',
      diagnosis:'Meniscopatia de joelho em acompanhamento fisioterapêutico conservador.',
      limitations:'Limitação para agachar, rotacionar, caminhar em pisos irregulares e realizar atividades de impacto.',
      goals:'Controle da dor e edema, melhora do controle neuromuscular, fortalecimento progressivo e retorno funcional.',
      obs:'Paciente orientado(a) quanto às atividades permitidas, proteção articular e sinais de agravamento.'
    }
  },
  {
    id:'pos_op_lca',
    label:'Pós-operatório de LCA',
    group:'Joelho',
    values:{
      chief:'Paciente em fase pós-operatória de reconstrução de LCA, com dor, edema residual e limitação funcional.',
      history:'Paciente submetido(a) a reconstrução de LCA. Evolução compatível com protocolo pós-operatório e fase de reabilitação atual.',
      diagnosis:'Pós-operatório de reconstrução de ligamento cruzado anterior em reabilitação fisioterapêutica.',
      limitations:'Limitação para carga total, rotações, agachamentos profundos e atividades esportivas. Fase específica do protocolo.',
      goals:'Controle de edema e dor, recuperação de arco de movimento, fortalecimento progressivo e retorno esportivo seguro.',
      obs:'Paciente orientado(a) quanto ao protocolo pós-operatório, restrições da fase e critérios de progressão.'
    }
  },
  {
    id:'pos_operatorio_joelho',
    label:'Pós-operatório de joelho (geral)',
    group:'Joelho',
    values:{
      chief:'Paciente refere dor, edema e limitação funcional no pós-operatório de joelho.',
      history:'Quadro compatível com fase pós-operatória de joelho, com necessidade de recuperação de mobilidade, controle de dor e reabilitação funcional.',
      diagnosis:'Paciente em reabilitação pós-operatória de joelho.',
      limitations:'Limitação para marcha, flexoextensão, apoio, transferências e atividades funcionais conforme fase do protocolo.',
      goals:'Controle álgico e inflamatório, recuperação de amplitude de movimento, ganho de força e retorno funcional progressivo.',
      obs:'Paciente orientado(a) quanto às restrições e progressão segura da reabilitação.'
    }
  },
  {
    id:'pos_op_atj',
    label:'Pós-operatório de ATJ (artroplastia total de joelho)',
    group:'Joelho',
    values:{
      chief:'Paciente em fase pós-operatória de artroplastia total de joelho, com dor, edema e limitação para marcha e atividades funcionais.',
      history:'Paciente submetido(a) a ATJ, encontrando-se em fase de reabilitação. Evolução compatível com protocolo pós-operatório.',
      diagnosis:'Pós-operatório de artroplastia total de joelho em reabilitação fisioterapêutica.',
      limitations:'Limitação para marcha, flexoextensão completa, subir/descer escadas, transferências e atividades funcionais.',
      goals:'Controle de edema e dor, recuperação de amplitude de movimento, ganho de força e independência funcional.',
      obs:'Paciente orientado(a) quanto às metas de amplitude, uso de dispositivo auxiliar, prevenção de TVP e progressão segura.'
    }
  },

  /* ── FRATURAS E PÓS-OP ─────────────────────────────────── */
  {
    id:'fratura_mmii',
    label:'Pós-fratura de membro inferior',
    group:'Fraturas / Pós-op',
    values:{
      chief:'Paciente em reabilitação após fratura de membro inferior, com dor residual, limitação funcional e adaptação à carga.',
      history:'Paciente com histórico de fratura em membro inferior, com período de imobilização. Apresentando limitação funcional, encurtamento muscular e déficit de força.',
      diagnosis:'Pós-fratura de membro inferior em fase de reabilitação fisioterapêutica.',
      limitations:'Limitação para carga, marcha, transferências e amplitude de movimento conforme segmento acometido e fase de consolidação.',
      goals:'Recuperação de força, mobilidade articular, marcha funcional e independência nas atividades de vida diária.',
      obs:'Paciente orientado(a) quanto à progressão de carga, sinais de alerta e importância do seguimento regular.'
    }
  },
  {
    id:'fratura_femur',
    label:'Pós-fratura de fêmur (conservador ou cirúrgico)',
    group:'Fraturas / Pós-op',
    values:{
      chief:'Paciente em reabilitação após fratura de fêmur, com limitação importante para marcha, transferências e atividades funcionais.',
      history:'Histórico de fratura de fêmur, com ou sem fixação cirúrgica, em fase de reabilitação. Apresentando atrofia muscular, limitação de mobilidade e déficit funcional.',
      diagnosis:'Pós-fratura de fêmur em reabilitação fisioterapêutica.',
      limitations:'Limitação importante para carga, marcha, transferências, subir/descer escadas e atividades funcionais do membro inferior.',
      goals:'Recuperação de força e mobilidade, treino de marcha progressivo, ganho de equilíbrio e independência funcional.',
      obs:'Paciente orientado(a) quanto à progressão de carga, prevenção de quedas e uso de dispositivo auxiliar conforme indicação.'
    }
  },
  {
    id:'fratura_tornozelo_pe',
    label:'Pós-fratura de tornozelo / pé',
    group:'Fraturas / Pós-op',
    values:{
      chief:'Paciente em reabilitação após fratura de tornozelo ou pé, com dor, edema residual e limitação para apoio e marcha.',
      history:'Histórico de fratura de tornozelo ou estruturas do pé, com período de imobilização. Em fase de recuperação de carga e mobilidade articular.',
      diagnosis:'Pós-fratura de tornozelo / pé em reabilitação fisioterapêutica.',
      limitations:'Limitação para carga total, marcha em piso irregular, subir/descer escadas e amplitude articular do tornozelo e pé.',
      goals:'Recuperação de mobilidade articular, força, propriocepção, marcha funcional e retorno às atividades habituais.',
      obs:'Paciente orientado(a) quanto à progressão de carga, calçado adequado e exercícios domiciliares.'
    }
  },
  {
    id:'fratura_mmss',
    label:'Pós-fratura de membro superior',
    group:'Fraturas / Pós-op',
    values:{
      chief:'Paciente em reabilitação após fratura de membro superior, com dor residual, rigidez articular e limitação funcional.',
      history:'Histórico de fratura em membro superior, com período de imobilização. Apresentando limitação de mobilidade articular, força reduzida e déficit funcional.',
      diagnosis:'Pós-fratura de membro superior em reabilitação fisioterapêutica.',
      limitations:'Limitação para mobilidade articular, força de preensão, alcances e atividades funcionais do membro superior acometido.',
      goals:'Recuperação de amplitude de movimento, força, destreza e funcionalidade do membro superior.',
      obs:'Paciente orientado(a) quanto à progressão dos exercícios, cuidados com o segmento e continuidade do acompanhamento.'
    }
  },
  {
    id:'fratura_clavícula',
    label:'Pós-fratura de clavícula',
    group:'Fraturas / Pós-op',
    values:{
      chief:'Paciente em reabilitação pós-fratura de clavícula, com dor, limitação para elevação do membro superior e desconforto na cintura escapular.',
      history:'Histórico de fratura de clavícula, com ou sem fixação cirúrgica, em fase de reabilitação. Apresentando limitação de mobilidade de ombro e déficit funcional.',
      diagnosis:'Pós-fratura de clavícula em reabilitação fisioterapêutica.',
      limitations:'Limitação para elevação, abdução, alcance acima da cabeça e atividades que exijam força no membro superior.',
      goals:'Recuperação de mobilidade e força do complexo do ombro, melhora da funcionalidade e retorno às atividades habituais.',
      obs:'Paciente orientado(a) quanto à progressão de amplitude, proteção da região e cuidados durante a consolidação.'
    }
  },

  /* ── PÉ E TORNOZELO ─────────────────────────────────────── */
  {
    id:'entorse_tornozelo',
    label:'Entorse de tornozelo',
    group:'Pé e Tornozelo',
    values:{
      chief:'Paciente refere dor, edema e instabilidade em tornozelo após episódio de entorse, com limitação para apoio e marcha.',
      history:'Quadro pós-entorse de tornozelo, com comprometimento ligamentar e repercussão funcional em marcha e apoio.',
      diagnosis:'Hipótese compatível com entorse de tornozelo com comprometimento ligamentar.',
      limitations:'Limitação para marcha, corrida, piso irregular, esportes e atividades de impacto.',
      goals:'Controle de edema e dor, recuperação de mobilidade, fortalecimento e treino proprioceptivo.',
      obs:'Paciente orientado(a) quanto à progressão de carga, calçado adequado e sinais de instabilidade recorrente.'
    }
  },
  {
    id:'instabilidade_tornozelo',
    label:'Instabilidade crônica de tornozelo',
    group:'Pé e Tornozelo',
    values:{
      chief:'Paciente refere episódios recorrentes de entorse e sensação de instabilidade em tornozelo, com limitação para atividades físicas.',
      history:'Quadro de instabilidade crônica de tornozelo, com histórico de entorses repetidos e déficit de controle neuromuscular.',
      diagnosis:'Hipótese compatível com instabilidade crônica de tornozelo lateral.',
      limitations:'Limitação para piso irregular, corrida, saltos e atividades esportivas com mudança de direção.',
      goals:'Melhora do controle neuromuscular, fortalecimento de tornozelo e perna, treino proprioceptivo e retorno funcional.',
      obs:'Paciente orientado(a) quanto à importância da regularidade dos exercícios e uso de órtese conforme indicação.'
    }
  },
  {
    id:'fascite_plantar',
    label:'Fascite plantar',
    group:'Pé e Tornozelo',
    values:{
      chief:'Paciente refere dor em região plantar, principalmente ao dar os primeiros passos pela manhã e após repouso prolongado.',
      history:'Quadro compatível com sobrecarga da fáscia plantar, com padrão mecânico e repercussão em marcha e ortostatismo prolongado.',
      diagnosis:'Hipótese compatível com fascite plantar.',
      limitations:'Limitação para marcha prolongada, ortostatismo, atividades de impacto e calçados inadequados.',
      goals:'Redução da dor, melhora do apoio plantar, alongamento e fortalecimento intrínseco do pé.',
      obs:'Paciente orientado(a) quanto a calçado adequado, palmilha e exercícios domiciliares.'
    }
  },
  {
    id:'tendinopatia_aquiles',
    label:'Tendinopatia de Aquiles',
    group:'Pé e Tornozelo',
    values:{
      chief:'Paciente refere dor em tendão calcâneo, com piora ao início da atividade, após repouso e em esforços de propulsão.',
      history:'Quadro progressivo de tendinopatia de Aquiles, com sobrecarga funcional, piora em corrida, saltos e subidas.',
      diagnosis:'Hipótese compatível com tendinopatia de Aquiles de inserção ou corpo do tendão.',
      limitations:'Limitação para corrida, saltos, subidas, esportes e marcha em velocidade aumentada.',
      goals:'Controle da dor, fortalecimento excêntrico progressivo, melhora funcional e retorno gradual às atividades.',
      obs:'Paciente orientado(a) quanto ao protocolo de carga progressiva, calçado adequado e controle de esforço.'
    }
  },
  {
    id:'hallux_valgus',
    label:'Hallux valgus / joanete',
    group:'Pé e Tornozelo',
    values:{
      chief:'Paciente refere dor e desconforto em região do hálux, com limitação para calçar sapatos e deambulação prolongada.',
      history:'Quadro de deformidade em hálux com repercussão funcional em marcha e tolerância ao calçado.',
      diagnosis:'Hipótese compatível com hallux valgus com impacto funcional.',
      limitations:'Limitação para calçar sapatos fechados, marcha prolongada, esportes e atividades de impacto.',
      goals:'Redução da dor, melhora do alinhamento funcional do pé, fortalecimento intrínseco e orientações para calçado.',
      obs:'Paciente orientado(a) quanto a calçado adequado, palmilha de separação e exercícios domiciliares.'
    }
  },

  /* ── OMBRO ──────────────────────────────────────────────── */
  {
    id:'tendinopatia_ombro',
    label:'Tendinopatia do ombro / manguito rotador',
    group:'Ombro',
    values:{
      chief:'Paciente refere dor em ombro, com piora à elevação do membro superior e atividades acima da linha do ombro.',
      history:'Quadro progressivo, associado a sobrecarga funcional e limitação durante movimentos de alcance, elevação e rotação.',
      diagnosis:'Hipótese compatível com tendinopatia do manguito rotador.',
      limitations:'Limitação para vestir-se, pentear cabelo, alcançar objetos em planos elevados e tarefas repetitivas com membro superior.',
      goals:'Controle da dor, melhora de amplitude de movimento, fortalecimento progressivo e ganho de controle escapular.',
      obs:'Paciente orientado(a) a evitar sobrecarga acima da linha do ombro e respeitar limites sintomáticos.'
    }
  },
  {
    id:'capsulite_adesiva',
    label:'Capsulite adesiva',
    group:'Ombro',
    values:{
      chief:'Paciente refere dor importante e rigidez em ombro, com limitação global de movimento e repercussão em atividades de autocuidado.',
      history:'Quadro progressivo de capsulite adesiva, com importante restrição funcional e piora em atividades de alcance.',
      diagnosis:'Hipótese compatível com capsulite adesiva — fase de congelamento.',
      limitations:'Limitação importante para elevação, rotação e atividades funcionais do membro superior acometido.',
      goals:'Controle do quadro álgico, melhora progressiva da mobilidade articular e recuperação funcional.',
      obs:'Paciente orientado(a) quanto ao curso evolutivo do quadro e importância da adesão terapêutica.'
    }
  },
  {
    id:'pos_operatorio_ombro',
    label:'Pós-operatório de ombro',
    group:'Ombro',
    values:{
      chief:'Paciente refere dor e limitação funcional no pós-operatório de ombro, com necessidade de progressão conforme protocolo.',
      history:'Paciente submetido(a) a cirurgia de ombro, em fase de reabilitação. Evolução compatível com protocolo pós-operatório.',
      diagnosis:'Paciente em reabilitação pós-operatória de ombro.',
      limitations:'Limitação para elevação, rotação, alcance e atividades funcionais do membro superior conforme fase do protocolo.',
      goals:'Controle da dor, recuperação de mobilidade, ganho progressivo de função e retorno seguro às atividades.',
      obs:'Paciente orientado(a) quanto ao protocolo, limites funcionais e adesão domiciliar.'
    }
  },

  /* ── OUTROS ─────────────────────────────────────────────── */
  {
    id:'epicondilalgia_lateral',
    label:'Epicondilalgia lateral',
    group:'Outros',
    values:{
      chief:'Paciente refere dor em face lateral do cotovelo, com piora em preensão e esforços repetitivos.',
      history:'Quadro progressivo, associado a uso repetitivo do membro superior e sobrecarga tendínea dos extensores.',
      diagnosis:'Hipótese compatível com epicondilalgia lateral.',
      limitations:'Limitação para segurar objetos, abrir recipientes, escrever e realizar atividades repetitivas com membro superior.',
      goals:'Redução da dor, melhora da função, controle de carga e fortalecimento progressivo dos extensores.',
      obs:'Paciente orientado(a) quanto ao manejo de esforços repetitivos e progressão terapêutica.'
    }
  },
  {
    id:'tunel_carpal',
    label:'Síndrome do túnel do carpo',
    group:'Outros',
    values:{
      chief:'Paciente refere dor, formigamento e desconforto em mão/punho, com possível piora noturna e ao segurar objetos.',
      history:'Quadro progressivo, associado a compressão neural no canal do carpo e sobrecarga funcional de punho e mão.',
      diagnosis:'Hipótese compatível com síndrome do túnel do carpo.',
      limitations:'Limitação para atividades finas, preensão prolongada, digitação e tarefas repetitivas.',
      goals:'Redução de sintomas, melhora funcional, orientação ergonômica e progressão segura das atividades.',
      obs:'Paciente orientado(a) quanto a posicionamento, pausas e sinais de agravamento.'
    }
  },
  {
    id:'fibromialgia',
    label:'Fibromialgia',
    group:'Outros',
    values:{
      chief:'Paciente refere dor difusa, fadiga e desconforto musculoesquelético generalizado.',
      history:'Quadro crônico, com períodos de exacerbação, impacto funcional e possível associação com sono não reparador.',
      diagnosis:'Quadro compatível com fibromialgia.',
      limitations:'Limitação para atividades de vida diária, tolerância ao esforço e manutenção de rotina funcional plena.',
      goals:'Controle de sintomas, melhora da funcionalidade, educação terapêutica e progressão gradual da atividade física.',
      obs:'Paciente orientado(a) quanto à importância da regularidade terapêutica e autocuidado.'
    }
  },
  {
    id:'avc_reabilitacao',
    label:'Neurológico / pós-AVC',
    group:'Outros',
    values:{
      chief:'Paciente apresenta déficit motor e limitação funcional decorrentes de evento neurológico prévio.',
      history:'Quadro neurológico com comprometimento motor, funcional e possível alteração de equilíbrio e marcha.',
      diagnosis:'Paciente em reabilitação neurológica pós-AVC.',
      limitations:'Limitação para marcha, transferências, equilíbrio, coordenação e atividades de vida diária.',
      goals:'Melhora funcional, ganho de independência, treino de marcha e evolução da capacidade motora.',
      obs:'Paciente e/ou acompanhante orientados quanto à continuidade terapêutica e segurança funcional.'
    }
  }
];

  const ANAMNESE_PHRASES = [
  { field:'anamneseChief', text:'Paciente refere dor com piora ao esforço e melhora parcial com repouso.' },
  { field:'anamneseChief', text:'Paciente relata rigidez, desconforto e limitação para atividades funcionais.' },
  { field:'anamneseHistory', text:'Quadro com evolução progressiva, associado a limitação funcional nas atividades diárias.' },
  { field:'anamneseHistory', text:'Sintomatologia com características mecânicas, exacerbada por sobrecarga funcional.' },
  { field:'anamneseHistory', text:'Paciente em acompanhamento por quadro crônico, com períodos de piora e melhora.' },
  { field:'anamneseDiagnosis', text:'Hipótese clínica compatível com disfunção musculoesquelética de padrão mecânico.' },
  { field:'anamneseDiagnosis', text:'Quadro compatível com sobrecarga funcional e déficit de controle motor.' },
  { field:'anamneseLimitations', text:'Limitação para atividades de vida diária, esforço físico e manutenção prolongada de postura.' },
  { field:'anamneseLimitations', text:'Dificuldade para marcha prolongada, transferências e atividades com carga.' },
  { field:'anamneseLimitations', text:'Limitação para movimentos repetitivos, alcances e manutenção funcional da rotina.' },
  { field:'anamneseGoals', text:'Redução do quadro álgico, melhora funcional e retorno progressivo às atividades habituais.' },
  { field:'anamneseGoals', text:'Ganho de mobilidade, fortalecimento progressivo e melhora do controle motor.' },
  { field:'anamneseGoals', text:'Melhora da independência funcional e progressão segura da capacidade física.' },
  { field:'anamneseObs', text:'Paciente orientado(a) quanto ao plano terapêutico e necessidade de adesão domiciliar.' },
  { field:'anamneseObs', text:'Sem sinais de alerta clínico relatados no momento da avaliação fisioterapêutica.' },
  { field:'anamneseObs', text:'Evolução será acompanhada conforme resposta clínica e adesão ao tratamento.' }
];

  const CLINICAL_TEMPLATES = [
  /* ── COLUNA ─────────────────────────────────────────────── */
  {
    id:'cervical_postural', group:'Coluna',
    label:'Cervical / reeducação postural',
    conduct:'Executados exercícios de mobilidade cervical, alongamentos específicos para musculatura suboccipital e escalenos, e treino de correção postural com ênfase em controle muscular profundo e redução de sobrecarga funcional. Realizada orientação ergonômica.',
    guidance:'Orientado(a) quanto a pausas posturais regulares, ergonomia no ambiente de trabalho e execução de mobilidade cervical leve ao longo do dia.'
  },
  {
    id:'cervical_cefaleia', group:'Coluna',
    label:'Cervical / cefaleia tensional',
    conduct:'Realizadas técnicas de mobilização suboccipital, liberação de musculatura pericrâniana, exercícios de controle cervical profundo e recursos para alívio da tensão muscular. Trabalho de reeducação postural e orientações sobre gatilhos.',
    guidance:'Orientado(a) quanto a pausas posturais, hidratação, técnicas de relaxamento e controle dos gatilhos posturais e de tensão.'
  },
  {
    id:'lombar_core', group:'Coluna',
    label:'Lombar / core e estabilização',
    conduct:'Realizados exercícios de estabilização de core, ativação de multífidos e transverso abdominal, controle motor lombopélvico e mobilidade de coluna lombar, com progressão conforme tolerância e qualidade do movimento.',
    guidance:'Orientado(a) a manter exercícios de ativação abdominal, controle postural e proteção lombar em domicílio, evitando sobrecarga desnecessária.'
  },
  {
    id:'lombociatalgia_neurodinamica', group:'Coluna',
    label:'Lombociatalgia / mobilidade neural',
    conduct:'Realizadas técnicas de mobilidade lombossacra, controle motor, exercícios de estabilização e recursos de mobilidade neural progressiva, conforme tolerância clínica e resposta do quadro.',
    guidance:'Orientado(a) a evitar posturas e esforços que exacerbem a irradiação, manter exercícios prescritos e observar sinais de agravamento neurológico.'
  },
  {
    id:'coluna_estenose', group:'Coluna',
    label:'Estenose de canal / claudicação neurogênica',
    conduct:'Realizados exercícios em posição de flexão lombar, fortalecimento de core e membros inferiores, treino de marcha progressivo e orientações sobre posições de alívio sintomático. Exercícios adaptados para minimizar extensão lombar.',
    guidance:'Orientado(a) quanto às posições de alívio, progressão gradual da marcha e atividades com flexão leve de tronco para redução dos sintomas.'
  },

  /* ── QUADRIL ─────────────────────────────────────────────── */
  {
    id:'gluteo', group:'Quadril',
    label:'Fortalecimento de glúteos / estabilização pélvica',
    conduct:'Executados exercícios de fortalecimento para glúteos médio e máximo, estabilização lombo-pélvica e controle de valgismo dinâmico, com progressão de carga conforme padrão funcional e tolerância apresentada.',
    guidance:'Orientado(a) a manter ativação de glúteos, exercícios domiciliares simples e observar controle de dor e qualidade do movimento.'
  },
  {
    id:'quadril_coxartrose', group:'Quadril',
    label:'Quadril / coxartrose',
    conduct:'Realizados exercícios de mobilidade do quadril, fortalecimento de glúteos e musculatura periarticular, treino funcional adaptado e orientações sobre proteção articular. Progressão conforme tolerância e dor.',
    guidance:'Orientado(a) quanto ao manejo de carga, superfícies de apoio, calçado adequado e exercícios domiciliares de baixo impacto.'
  },
  {
    id:'pos_op_atq_conduta', group:'Quadril',
    label:'Pós-op ATQ / artroplastia de quadril',
    conduct:'Realizadas condutas compatíveis com protocolo pós-operatório de ATQ: exercícios isométricos, mobilidade ativa assistida, treino de transferências, marcha com dispositivo auxiliar e orientações sobre precauções do implante.',
    guidance:'Orientado(a) quanto às precauções de quadril (flexão < 90°, sem adução cruzada, sem rotação interna excessiva), uso de dispositivo auxiliar e progressão conforme fase do protocolo.'
  },

  /* ── JOELHO ─────────────────────────────────────────────── */
  {
    id:'joelho_gonartrose', group:'Joelho',
    label:'Joelho / gonartrose',
    conduct:'Executados exercícios de fortalecimento de quadríceps e glúteos em cadeia cinética aberta e fechada, mobilidade articular, treino de equilíbrio e funcional, conforme tolerância e fase clínica.',
    guidance:'Orientado(a) a manter exercícios domiciliares, observar manejo de carga e evitar sobrecargas articulares desnecessárias.'
  },
  {
    id:'femoropatelar', group:'Joelho',
    label:'Joelho / síndrome femoropatelar',
    conduct:'Realizados exercícios de controle biomecânico femoropatelar, fortalecimento de quadríceps e glúteo médio, correção de padrões de movimento, treino proprioceptivo e orientações sobre mecânica de agachamento.',
    guidance:'Orientado(a) a evitar excesso de agachamentos com valgismo, cargas provocativas e escadas em excesso. Manter progressão gradual dos exercícios prescritos.'
  },
  {
    id:'joelho_menisco', group:'Joelho',
    label:'Joelho / meniscopatia',
    conduct:'Realizados exercícios de fortalecimento sem compressão excessiva, mobilidade articular, controle neuromuscular e propriocepção. Evitados movimentos de rotação com carga e agachamento profundo conforme tolerância.',
    guidance:'Orientado(a) quanto às atividades permitidas na fase atual, proteção articular e sinais de agravamento (bloqueio, derrame, dor intensa).'
  },
  {
    id:'pos_op_lca_conduta', group:'Joelho',
    label:'Pós-op LCA / ligamento cruzado anterior',
    conduct:'Realizadas condutas compatíveis com fase atual do protocolo pós-LCA: exercícios em cadeia cinética fechada, controle de edema, fortalecimento progressivo, treino neuromuscular e funcional conforme critérios de progressão.',
    guidance:'Orientado(a) quanto às restrições da fase, critérios de progressão de carga e importância da regularidade na reabilitação para retorno esportivo seguro.'
  },
  {
    id:'pos_op_atj_conduta', group:'Joelho',
    label:'Pós-op ATJ / artroplastia de joelho',
    conduct:'Realizadas condutas de reabilitação pós-ATJ: exercícios isométricos, mobilização articular progressiva, treino de marcha, transferências e fortalecimento conforme protocolo e tolerância.',
    guidance:'Orientado(a) quanto às metas de amplitude, uso de dispositivo auxiliar, prevenção de complicações e progressão funcional conforme protocolo.'
  },

  /* ── FRATURAS E PÓS-OP ─────────────────────────────────── */
  {
    id:'fratura_reabilitacao', group:'Fraturas / Pós-op',
    label:'Fratura consolidada em reabilitação',
    conduct:'Realizadas condutas de reabilitação pós-fratura incluindo: mobilidade articular progressiva, fortalecimento segmentar, treino funcional e de carga, conforme fase de consolidação e tolerância clínica.',
    guidance:'Orientado(a) quanto à progressão de carga, sinais de alerta e importância do seguimento regular para evolução segura da reabilitação.'
  },
  {
    id:'pos_op_fratura_mmii', group:'Fraturas / Pós-op',
    label:'Pós-op de fratura de membro inferior',
    conduct:'Realizadas condutas pós-operatórias compatíveis com fase atual: controle de edema, mobilidade articular, fortalecimento progressivo, treino de transferências e marcha com dispositivo auxiliar conforme liberação médica.',
    guidance:'Orientado(a) quanto à progressão de carga autorizada, prevenção de quedas, uso de dispositivo auxiliar e sinais de alerta pós-operatórios.'
  },
  {
    id:'pos_op_fratura_mmss', group:'Fraturas / Pós-op',
    label:'Pós-op de fratura de membro superior',
    conduct:'Realizadas condutas de reabilitação pós-fratura de membro superior: mobilidade articular progressiva, fortalecimento muscular segmentar, destreza e treino funcional conforme fase e protocolo.',
    guidance:'Orientado(a) quanto às restrições de carga, progressão de amplitude e exercícios domiciliares para manutenção dos ganhos.'
  },
  {
    id:'pos_op_fratura_tornozelo', group:'Fraturas / Pós-op',
    label:'Pós-op de fratura de tornozelo / pé',
    conduct:'Realizadas condutas compatíveis com fase atual de reabilitação pós-fratura: mobilidade de tornozelo e pé, controle de edema, fortalecimento progressivo, treino proprioceptivo e progressão de carga conforme liberação médica.',
    guidance:'Orientado(a) quanto à progressão de carga, calçado adequado, palmilha e exercícios domiciliares de mobilidade e fortalecimento.'
  },

  /* ── PÉ E TORNOZELO ─────────────────────────────────────── */
  {
    id:'tornozelo_entorse', group:'Pé e Tornozelo',
    label:'Tornozelo / entorse aguda ou recorrente',
    conduct:'Realizados exercícios de mobilidade, fortalecimento de fibulares e musculatura intrínseca do pé, treino de estabilidade e propriocepção para tornozelo, conforme fase de recuperação e tolerância clínica.',
    guidance:'Orientado(a) a manter cuidados com apoio, progressão gradual de carga e exercícios domiciliares voltados à estabilidade do tornozelo.'
  },
  {
    id:'fascite_plantar_conduta', group:'Pé e Tornozelo',
    label:'Fascite plantar',
    conduct:'Executados alongamentos da fáscia plantar e musculatura posterior da perna, liberação miofascial, exercícios de fortalecimento intrínseco do pé e orientações sobre apoio plantar e calçado.',
    guidance:'Orientado(a) a manter alongamentos matinais antes do primeiro passo, uso de palmilha e calçado adequado, e manejo de carga durante marcha prolongada.'
  },
  {
    id:'aquiles_conduta', group:'Pé e Tornozelo',
    label:'Tendão de Aquiles / tendinopatia',
    conduct:'Realizados exercícios de fortalecimento excêntrico e isométrico do tríceps sural, mobilidade de tornozelo, liberação de musculatura posterior e progressão de carga conforme protocolo e tolerância à dor.',
    guidance:'Orientado(a) quanto ao protocolo de carga progressiva, calçado com salto leve para descarga do tendão e controle de atividades de impacto.'
  },

  /* ── OMBRO ──────────────────────────────────────────────── */
  {
    id:'manguito', group:'Ombro',
    label:'Manguito rotador',
    conduct:'Realizados exercícios para manguito rotador (rotadores externos e internos) e controle escapular, com foco em estabilidade dinâmica do ombro, progressão gradual de carga e melhora da função do membro superior.',
    guidance:'Orientado(a) a evitar sobrecarga acima da linha do ombro, manter exercícios prescritos e respeitar os limites sintomáticos durante o dia.'
  },
  {
    id:'capsulite_ombro', group:'Ombro',
    label:'Ombro / capsulite adesiva',
    conduct:'Realizadas mobilizações articulares de glenoumeral, exercícios ativos assistidos, pendulares e recursos para ganho progressivo de amplitude de movimento, respeitando dor e irritabilidade do quadro.',
    guidance:'Orientado(a) quanto à importância da regularidade dos exercícios, progressão gradual e respeito aos limites funcionais do ombro para evitar regressão.'
  },
  {
    id:'pos_operatorio_ombro', group:'Ombro',
    label:'Pós-operatório de ombro',
    conduct:'Realizadas condutas de reabilitação pós-operatória com foco em controle álgico, mobilidade progressiva, ganho funcional e respeito às restrições do protocolo cirúrgico.',
    guidance:'Orientado(a) quanto às restrições da fase, uso adequado do membro e importância da continuidade do plano terapêutico.'
  },

  /* ── GERAIS ─────────────────────────────────────────────── */
  {
    id:'alongamento_global', group:'Geral',
    label:'Alongamento e mobilidade global',
    conduct:'Realizados exercícios de alongamento global e segmentar, com foco em ganho de mobilidade, redução de tensão muscular e melhora da amplitude de movimento, respeitando a tolerância clínica do(a) paciente.',
    guidance:'Orientado(a) a manter alongamentos leves em domicílio, 2 vezes ao dia, sem ultrapassar o limiar doloroso.'
  },
  {
    id:'fortalecimento_funcional', group:'Geral',
    label:'Fortalecimento funcional progressivo',
    conduct:'Realizados exercícios de fortalecimento funcional em cadeia cinética aberta e fechada, com progressão de carga, controle motor e treino de padrões de movimento, conforme tolerância e fase clínica.',
    guidance:'Orientado(a) a manter regularidade nos exercícios domiciliares, progressão gradual e observação da resposta dolorosa durante e após as atividades.'
  },
  {
    id:'propriocepcao_equilibrio', group:'Geral',
    label:'Propriocepção e equilíbrio',
    conduct:'Realizado treino proprioceptivo e de equilíbrio com progressão de complexidade, em superfícies estáveis e instáveis, associado a fortalecimento de membro inferior e tronco.',
    guidance:'Orientado(a) a realizar exercícios de equilíbrio domiciliar com segurança, próximo a apoio, e progredir conforme confiança e controle.'
  },
  {
    id:'fibromialgia_conduta', group:'Geral',
    label:'Fibromialgia / exercícios leves',
    conduct:'Realizados exercícios leves de mobilidade global, técnicas de relaxamento muscular e progressão funcional gradual, respeitando fadiga, tolerância e resposta clínica do(a) paciente.',
    guidance:'Orientado(a) quanto à regularidade terapêutica, autocuidado, controle de esforço e manutenção de rotina ativa dentro da tolerância.'
  },
  {
    id:'avc_neuro', group:'Geral',
    label:'Neurológico / pós-AVC',
    conduct:'Executados exercícios de facilitação motora, treino de equilíbrio, transferências, marcha e atividades funcionais, conforme capacidade e resposta apresentada pelo(a) paciente.',
    guidance:'Orientado(a) paciente e/ou acompanhante quanto à continuidade dos estímulos terapêuticos, segurança funcional e rotina domiciliar.'
  }
];

  const CLINICAL_PHRASES = [
  { target:'conduct', text:'Paciente apresentou boa tolerância às condutas propostas durante o atendimento.' },
  { target:'conduct', text:'Conduta executada com progressão compatível com a resposta clínica apresentada.' },
  { target:'conduct', text:'Sem intercorrências durante a realização dos exercícios terapêuticos.' },
  { target:'conduct', text:'Evolução funcional observada de forma gradual e compatível com o plano terapêutico.' },
  { target:'guidance', text:'Orientado(a) a manter exercícios domiciliares conforme prescrição fisioterapêutica.' },
  { target:'guidance', text:'Orientado(a) a evitar sobrecargas e respeitar limites dolorosos durante as atividades diárias.' },
  { target:'guidance', text:'Reforçadas orientações ergonômicas, autocuidado e adesão ao tratamento.' },
  { target:'guidance', text:'Paciente orientado(a) quanto à importância da regularidade do acompanhamento fisioterapêutico.' }
];

  ANAMNESE_PHRASES.push(
    { field:'anamneseChief', text:'Paciente refere dor localizada, sem irradiação importante no momento da avaliação.' },
    { field:'anamneseChief', text:'Paciente relata piora em atividades de carga e melhora parcial com repouso relativo.' },
    { field:'anamneseHistory', text:'Quadro relacionado a episódio traumático ou sobrecarga recente, com limitação funcional proporcional ao relato.' },
    { field:'anamneseHistory', text:'Paciente relata recorrência dos sintomas, com impacto em atividades ocupacionais e rotina doméstica.' },
    { field:'anamneseDiagnosis', text:'Hipótese clínica compatível com quadro traumato-ortopédico em acompanhamento fisioterapêutico.' },
    { field:'anamneseLimitations', text:'Limitação para subir e descer escadas, agachar, ajoelhar ou permanecer em apoio prolongado.' },
    { field:'anamneseLimitations', text:'Limitação para elevação do membro superior, alcance acima da cabeça e atividades repetitivas.' },
    { field:'anamneseGoals', text:'Retorno progressivo às atividades funcionais com segurança, redução de dor e melhora de capacidade física.' },
    { field:'anamneseObs', text:'Este registro não substitui avaliação médica quando houver sinais de alerta ou piora clínica importante.' }
  );

  CLINICAL_PHRASES.push(
    { target:'conduct', text:'Realizada progressão de carga respeitando dor, fadiga e qualidade do movimento.' },
    { target:'conduct', text:'Mantida ênfase em controle motor, estabilidade articular e execução sem compensações.' },
    { target:'conduct', text:'Realizados exercícios de fortalecimento segmentar e funcional, conforme tolerância do(a) paciente.' },
    { target:'conduct', text:'Realizado treino proprioceptivo e de equilíbrio, com progressão gradual de complexidade.' },
    { target:'conduct', text:'Aplicadas técnicas de terapia manual e mobilidade, com resposta clínica monitorada durante o atendimento.' },
    { target:'conduct', text:'Paciente evolui com melhora gradual, mantendo necessidade de progressão terapêutica supervisionada.' },
    { target:'conduct', text:'Paciente apresenta evolução lenta, sendo mantido ajuste de carga e reavaliação contínua dos sintomas.' },
    { target:'conduct', text:'Paciente relata reagudização recente; conduta adaptada para controle de sintomas e retomada gradual.' },
    { target:'guidance', text:'Orientado(a) a manter exercícios domiciliares com qualidade, sem realizar movimentos que aumentem dor de forma persistente.' },
    { target:'guidance', text:'Orientado(a) a aplicar estratégias de manejo de carga nas atividades diárias e evitar picos de esforço.' },
    { target:'guidance', text:'Orientado(a) a observar sinais de alerta, como piora progressiva, perda de força importante ou sintomas neurológicos.' },
    { target:'guidance', text:'Reforçada a importância da continuidade dos exercícios após melhora dos sintomas para reduzir risco de recidiva.' }
  );
  const ORIENTATION_PACKS = {
    geral: { title:'Orientações gerais FEMIC', link:'https://salvanhini.github.io/femic/orientacoes.html', keywords:['geral','orientacoes gerais','orientação geral'] },
    dor_cronica: { title:'Dor Crônica', link:'https://salvanhini.github.io/femic/dor-cronica', keywords:['dor cronica','dor crônica','dor persistente','dor prolongada','sensibilizacao','sensibilização','dor ha muito tempo','dor há muito tempo'] },
    calor_gelo: { title:'Calor e Gelo', link:'https://salvanhini.github.io/femic/calor-gelo', keywords:['calor','gelo','crioterapia','termoterapia','compressa'] },
    capsulite_adesiva: { title:'Capsulite Adesiva', link:'https://salvanhini.github.io/femic/capsulite-adesiva.html', keywords:['capsulite','ombro congelado','capsulite adesiva'] },
    cefaleia_tensional: { title:'Cefaleia Tensional e Enxaqueca', link:'https://salvanhini.github.io/femic/cefaleia-tensional.html', keywords:['cefaleia','cefaleia tensional','enxaqueca','dor de cabeca','dor de cabeça'] },
    cervicobraquialgia: { title:'Cervicobraquialgia', link:'https://salvanhini.github.io/femic/cervicobraquialgia.html', keywords:['cervicobraquialgia','braquialgia','dor cervical irradiada','dor irradiada no braço','dor irradiada no braco'] },
    ciatalgia: { title:'Ciatalgia', link:'https://salvanhini.github.io/femic/ciatalgia.html', keywords:['ciatalgia','ciatica','ciática','nervo ciatico','nervo ciático','dor ciatica','dor ciática'] },
    entorse_tornozelo: { title:'Entorse de Tornozelo', link:'https://salvanhini.github.io/femic/entorse-tornozelo.html', keywords:['entorse de tornozelo','entorse tornozelo','tornozelo','torção tornozelo','torcao tornozelo'] },
    epicondilite: { title:'Epicondilite', link:'https://salvanhini.github.io/femic/epicondilite.html', keywords:['epicondilite','epicondilite lateral','epicondilite medial','cotovelo do tenista','cotovelo do golfista','cotovelo'] },
    fascite_plantar: { title:'Fascite Plantar', link:'https://salvanhini.github.io/femic/fascite-plantar.html', keywords:['fascite','fascite plantar','dor no calcanhar','calcaneo','calcâneo','esporão','esporao'] },
    cervicalgia: { title:'Cervicalgia', link:'https://salvanhini.github.io/femic/femic_cervicalgia.html', keywords:['cervicalgia','dor cervical','pescoço','pescoco','dor no pescoco','dor no pescoço'] },
    sindrome_femoropatelar: { title:'Dor Femoropatelar', link:'https://salvanhini.github.io/femic/femoropatelar.html', keywords:['femoropatelar','dor femoropatelar','sindrome femoropatelar','síndrome femoropatelar','condromalacia','condromalácia','dor anterior no joelho'] },
    fraturas: { title:'Fraturas', link:'https://salvanhini.github.io/femic/fraturas.html', keywords:['fratura','fraturas','osso quebrado','consolidação óssea','consolidacao ossea'] },
    lca: { title:'LCA', link:'https://salvanhini.github.io/femic/lca.html', keywords:['lca','ligamento cruzado anterior','pós-operatório lca','pos operatorio lca','pos-operatorio lca','pós operatorio lca'] },
    lombalgia: { title:'Lombalgia', link:'https://salvanhini.github.io/femic/lombalgia.html', keywords:['lombalgia','dor lombar','coluna lombar','lombar'] },
    manguito_rotador: { title:'Tendinopatia do Manguito Rotador', link:'https://salvanhini.github.io/femic/manguito-rotador.html', keywords:['manguito','manguito rotador','tendinopatia manguito','tendinite ombro','tendinite do ombro','lesão do manguito','lesao do manguito','ombro'] },
    menisco: { title:'Lesão Meniscal', link:'https://salvanhini.github.io/femic/menisco.html', keywords:['menisco','meniscal','lesão meniscal','lesao meniscal','lesão de menisco','lesao de menisco'] },
    artrose_joelho: { title:'Osteoartrite de Joelho', link:'https://salvanhini.github.io/femic/osteoartrite-joelho.html', keywords:['osteoartrite de joelho','osteoartrite joelho','artrose de joelho','artrose joelho','gonartrose'] },
    tunel_carpo: { title:'Síndrome do Túnel do Carpo', link:'https://salvanhini.github.io/femic/tunel-carpo.html', keywords:['tunel do carpo','túnel do carpo','sindrome do tunel do carpo','síndrome do túnel do carpo','carpo'] }
  };

  const ORIENTATION_HISTORY_KEY = 'femic_orientation_pack_history';

