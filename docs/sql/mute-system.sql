-- Tabela de mutes (silenciar paciente por tempo determinado)
create table if not exists bot_mutes (
  id uuid default gen_random_uuid() primary key,
  jid text not null unique,
  expires_at timestamptz not null,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_bot_mutes_jid on bot_mutes(jid);
create index if not exists idx_bot_mutes_active on bot_mutes(active);

-- Permissão anon para upsert (bot precisa inserir/atualizar)
grant insert on bot_mutes to anon;
grant update on bot_mutes to anon;
grant select on bot_mutes to anon;

-- RPC para upsert via frontend (evita conflito de chave)
create or replace function mute_patient(p_jid text, p_expires_at timestamptz)
returns void language plpgsql as $$
begin
  insert into bot_mutes (jid, expires_at, active)
  values (p_jid, p_expires_at, true)
  on conflict (jid)
  do update set expires_at = p_expires_at, active = true, created_at = now();
end;
$$;

grant execute on function mute_patient(text, timestamptz) to anon;

-- RPC para remover mute
create or replace function unmute_patient(p_jid text)
returns void language plpgsql as $$
begin
  update bot_mutes set active = false where jid = p_jid;
end;
$$;

grant execute on function unmute_patient(text) to anon;
