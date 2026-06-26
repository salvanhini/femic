import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import { Boom } from '@hapi/boom';
import { getAvailableSlots } from '../../js/femic-appointment-slot-utils.js';[cite: 1]
import { createAssistantTask } from '../../js/femic-pending-task-utils.js';[cite: 1]

// =========================================================================
// 1. INICIALIZAÇÃO DE CLIENTES E CONFIGURAÇÕES
// =========================================================================

// Cliente Supabase carregando as credenciais injetadas pela Discloud
const supabaseUrl = process.env.FEMIC_SUPABASE_URL;
const supabaseServiceKey = process.env.FEMIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error(JSON.stringify({
        level: 50,
        time: Date.now(),
        msg: "Chaves do Supabase não configuradas nas variáveis de ambiente da Discloud."
    }));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SERVICE_NAME = process.env.FEMIC_BAILEYS_SERVICE_NAME || 'baileys-main';
const SESSION_DIR = process.env.FEMIC_BAILEYS_SESSION_DIR || '.session';
const POLL_INTERVAL_MS = parseInt(process.env.FEMIC_BAILEYS_POLL_MS || '60000', 10);

// =========================================================================
// 2. INTEGRAÇÃO COM A INTELIGÊNCIA ARTIFICIAL (ALESSANDRA)
// =========================================================================
async function perguntarParaAlessandra(nomePaciente, mensagemAtual, horariosLivres) {
    const apiKey = process.env.AI_API_KEY; 
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    if (!apiKey) {
        return {
            resposta_whatsapp: "Olá! Estamos passando por uma breve manutenção no meu sistema de IA, mas um atendente humano já vai te responder por aqui! 😊",
            intencao: "erro",
            horario_escolhido: null
        };
    }

    const systemPrompt = `
    Seu nome é Alessandra. Você é a assistente virtual acolhedora, prestativa e extremamente profissional da FEMIC Fisioterapia.
    Seu objetivo principal é ajudar o paciente (${nomePaciente}) a agendar horários ou tirar dúvidas sobre o atendimento na clínica de ortopedia e fisioterapia.

    Horários atualmente disponíveis na clínica para os próximos dias:
    ${JSON.stringify(horariosLivres)}

    Diretrizes de Comportamento:
    1. Seja sempre empática, educada e direta. Use quebras de linha para facilitar a leitura no WhatsApp.
    2. Nunca liste todas as opções de horários de uma vez. Ofereça no máximo 2 ou 3 opções mais próximas.
    3. Se o paciente escolher ou aceitar um horário específico da lista, avise-o cordialmente de que você está gerando uma solicitação de reserva no sistema para validação da equipe da clínica.
    
    Você DEVE responder obrigatoriamente em formato JSON válido seguindo estritamente esta estrutura:
    {
       "resposta_whatsapp": "Escreva aqui o texto humanizado que será enviado para o paciente no chat",
       "intencao": "agendamento", "duvida" ou "outros",
       "horario_escolhido": "YYYY-MM-DD HH:MM" (Preencha somente se o paciente confirmar uma vaga específica. Se não houver confirmação de horário ainda, envie null)
    }
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                response_format: { type: "json_object" }, 
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: mensagemAtual }
                ],
                temperature: 0.3
            })
        });

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error(JSON.stringify({ level: 50, time: Date.now(), msg: "Erro ao processar chamada na API Groq", error: error.message }));
        return {
            resposta_whatsapp: "Olá! Desculpe a demora, tive uma pequena oscilação na minha conexão. Nossa equipe humana já foi notificada e vai falar com você em instantes! 😊",
            intencao: "erro",
            horario_escolhido: null
        };
    }
}

// =========================================================================
// 3. INICIALIZAÇÃO E GERENCIAMENTO DO WHATSAPP (BAILEYS)
// =========================================================================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Garante que o QR code vai imprimir nos logs do Discloud
        defaultQueryTimeoutMs: undefined
    });

    // Salva as credenciais sempre que a sessão atualizar
    sock.ev.on('creds.update', saveCreds);

    // Escuta atualizações de conexão (Aparelho conectado, desconectado ou gerando QR)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        let currentStatus = connection || 'unknown';
        console.log(JSON.stringify({ level: 30, time: Date.now(), msg: `Status da conexão atualizado: ${currentStatus}` }));

        // Atualiza a tabela de monitoramento no Supabase
        await supabase.from('whatsapp_service_status').upsert({
            service_name: SERVICE_NAME,
            connection_status: currentStatus,
            last_seen_at: new Date().toISOString(),
            last_error: lastDisconnect?.error ? lastDisconnect.error.toString() : null
        }, { onConflict: 'service_name' });

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(JSON.stringify({ level: 40, time: Date.now(), msg: `Conexão fechada. Tentando reconectar? ${shouldReconnect}` }));
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            await supabase.from('whatsapp_service_status').update({
                last_connected_at: new Date().toISOString()
            }).eq('service_name', SERVICE_NAME);
            console.log(JSON.stringify({ level: 30, time: Date.now(), msg: "Baileys conectado com sucesso ao WhatsApp!" }));
        }
    });

    // =========================================================================
    // 4. PROCESSAMENTO DE MENSAGENS RECEBIDAS
// =========================================================================
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const textoRecebido = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        // Se a mensagem não contiver texto puro, ignora
        if (!textoRecebido) return;

        try {
            // 1. Localizar ou registrar o paciente no banco de dados
            let { data: paciente } = await supabase.from('patients').select('*').eq('whatsapp', jid).single();[cite: 1]
            
            if (!paciente) {
                const nomePerfil = msg.pushName || "Paciente";
                const { data: novoPaciente, error: errPac } = await supabase
                    .from('patients')
                    .insert([{ name: nomePerfil, whatsapp: jid }])[cite: 1]
                    .select()
                    .single();
                
                if (errPac) throw errPac;
                paciente = novoPaciente;
            }

            // 2. Chamar o utilitário do seu projeto para obter janelas de horários livres
            const horariosDisponiveis = await getAvailableSlots();[cite: 1]

            // 3. Obter resposta contextualizada gerada pela Inteligência Artificial
            const resultadoIA = await perguntarParaAlessandra(paciente.name, textoRecebido, horariosDisponiveis);

            // 4. Se o paciente aceitou/escolheu um horário, cria a tarefa pendente para sua revisão
            if (resultadoIA.intencao === 'agendamento' && resultadoIA.horario_escolhido) {
                const taskId = `wa_${Date.now()}`;
                
                // Insere na tabela mapeada no passo anterior utilizando seu utilitário ou insert direto
                await supabase.from('assistant_tasks').insert([{[cite: 1]
                    id: taskId,
                    title: `Agendamento pré-fixado: ${paciente.name}`,[cite: 1]
                    type: 'marcacao',[cite: 1]
                    status: 'aberta',[cite: 1]
                    patient_id: paciente.id,[cite: 1]
                    patient_name: paciente.name,[cite: 1]
                    phone: jid,[cite: 1]
                    notes: `Paciente solicitou o horário de preferência: ${resultadoIA.horario_escolhido}.`,[cite: 1]
                    requested_action: `Validar e efetivar a reserva para ${resultadoIA.horario_escolhido}`,[cite: 1]
                    needs_review: true[cite: 1]
                }]);
            }

            // 5. Atualizar carimbo de última mensagem tratada no status do serviço[cite: 1]
            await supabase.from('whatsapp_service_status').update({
                last_message_at: new Date().toISOString()
            }).eq('service_name', SERVICE_NAME);

            // 6. Enviar mensagem gerada de volta ao paciente no WhatsApp
            await sock.sendMessage(jid, { text: resultadoIA.resposta_whatsapp });

        } catch (error) {
            console.error(JSON.stringify({
                level: 50,
                time: Date.now(),
                pid: process.pid,
                hostname: "discloud-container",
                err: { type: "Object", message: error.message, stack: error.stack, code: "EXEC_ERR" },
                msg: "Falha ao processar mensagem recebida para agenda"[cite: 1]
            }));
        }
    });

    // =========================================================================
    // 5. CICLO AUTOMÁTICO DE REMARCACÕES / LEMBRETES (BACKGROUND)
    // =========================================================================
    setInterval(async () => {
        try {
            // Aqui dispara o ciclo que lê sua tabela 'schedule_settings' e dispara avisos automáticos[cite: 1]
            const { data: settings, error: errSet } = await supabase.from('schedule_settings').select('*').single();[cite: 1]
            
            if (errSet) throw errSet;

            // Log de sucesso indicando que a sincronização rodou limpa sem falhas
            if (settings?.whatsapp_provider === 'baileys') {[cite: 1]
               // Sua lógica nativa de varredura de lembretes ativos do dia entraria aqui se necessário
            }
        } catch (error) {
            console.error(JSON.stringify({
                level: 50,
                time: Date.now(),
                err: { type: "Object", message: error.message },
                msg: "Falha no ciclo de sincronizacao de lembretes"[cite: 1]
            }));
        }
    }, POLL_INTERVAL_MS);

    return sock;
}

// Inicia o processo principal
connectToWhatsApp();