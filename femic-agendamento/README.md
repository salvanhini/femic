# FEMIC Agendamento

Modulo separado para pacientes solicitarem horarios por um link fixo.

## Link fixo

Depois de publicar a Edge Function `scheduler-api`, envie aos pacientes:

```text
https://SEU-DOMINIO/femic-agendamento/index.html?api=https://SEU-PROJETO.functions.supabase.co/scheduler-api
```

## Supabase

Variaveis da Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

A Function le `services`, `schedule_settings` e `appointments`, sugere horarios otimizados e grava em `appointment_requests`.

