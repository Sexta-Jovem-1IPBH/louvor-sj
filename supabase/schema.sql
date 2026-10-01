-- Schema inicial do App de Louvor SJ
-- Regras de negocio: ver CLAUDE.md (repertorio so cresce, historico de alteracoes, RLS)

create extension if not exists pgcrypto;

-- ========== musicas ==========
create table if not exists musicas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  titulo_normalizado text not null,
  tom_original text,
  tom_grupo text,
  slides_drive_id text,
  slides_origem text check (slides_origem in ('manual', 'gerado')),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists musicas_titulo_normalizado_idx on musicas (titulo_normalizado);

-- ========== secoes ==========
create table if not exists secoes (
  id uuid primary key default gen_random_uuid(),
  musica_id uuid not null references musicas(id),
  ordem int not null,
  tipo text not null,
  acordes text,
  letra text,
  letra_cifrada text
);

create index if not exists secoes_musica_id_idx on secoes (musica_id);

-- ========== midias ==========
create table if not exists midias (
  id uuid primary key default gen_random_uuid(),
  musica_id uuid not null references musicas(id),
  tipo text check (tipo in ('segunda_voz', 'voz_principal', 'instrumental', 'ensaio', 'referencia')),
  voz_instrumento text,
  drive_file_id text not null,
  mime_type text,
  tamanho_bytes bigint,
  enviado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create index if not exists midias_musica_id_idx on midias (musica_id);

-- ========== cultos ==========
create table if not exists cultos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  observacao text
);

-- ========== setlist ==========
create table if not exists setlist (
  id uuid primary key default gen_random_uuid(),
  culto_id uuid not null references cultos(id),
  musica_id uuid not null references musicas(id),
  ordem int not null,
  tom text
);

create index if not exists setlist_culto_id_idx on setlist (culto_id);

-- ========== historico_alteracoes ==========
create table if not exists historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  antes jsonb,
  depois jsonb,
  usuario uuid references auth.users(id),
  em timestamptz not null default now()
);

create index if not exists historico_alteracoes_registro_idx on historico_alteracoes (tabela, registro_id);

-- ========== trigger: atualizado_em ==========
create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists musicas_set_atualizado_em on musicas;
create trigger musicas_set_atualizado_em
  before update on musicas
  for each row execute function set_atualizado_em();

-- ========== RLS ==========
alter table musicas enable row level security;
alter table secoes enable row level security;
alter table midias enable row level security;
alter table cultos enable row level security;
alter table setlist enable row level security;
alter table historico_alteracoes enable row level security;

-- Leitura publica (sem login) em todas as tabelas
create policy "leitura publica musicas" on musicas for select using (true);
create policy "leitura publica secoes" on secoes for select using (true);
create policy "leitura publica midias" on midias for select using (true);
create policy "leitura publica cultos" on cultos for select using (true);
create policy "leitura publica setlist" on setlist for select using (true);
create policy "leitura publica historico" on historico_alteracoes for select using (true);

-- Escrita (insert/update) só para quem está logado com Google. Sem policy de DELETE
-- em musicas/secoes => delete sempre bloqueado para anon/authenticated (regra: repertorio so cresce).
create policy "insert autenticado musicas" on musicas for insert with check (auth.uid() is not null);
create policy "update autenticado musicas" on musicas for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "insert autenticado secoes" on secoes for insert with check (auth.uid() is not null);
create policy "update autenticado secoes" on secoes for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "insert autenticado midias" on midias for insert with check (auth.uid() is not null);
create policy "delete proprio midias" on midias for delete using (enviado_por = auth.uid());

create policy "insert autenticado cultos" on cultos for insert with check (auth.uid() is not null);
create policy "update autenticado cultos" on cultos for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "insert autenticado setlist" on setlist for insert with check (auth.uid() is not null);
create policy "update autenticado setlist" on setlist for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "delete autenticado setlist" on setlist for delete using (auth.uid() is not null);

create policy "insert autenticado historico" on historico_alteracoes for insert with check (auth.uid() is not null);
