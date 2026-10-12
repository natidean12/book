-- Cosmic Bloom — banco de dados (Supabase). Cole tudo no "SQL Editor" e clique em Run.
-- É seguro rodar mais de uma vez.

-- 1) Tabela única de registros (livros, metas, bingo, cores, A-Z, roletas, ajustes...)
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  kind       text        not null,
  year       int,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),   -- hora da edição (vem do aparelho)
  synced_at  timestamptz not null default now(),   -- hora em que o servidor recebeu
  primary key (user_id, id)
);

create index if not exists records_sync_idx on public.records (user_id, synced_at);
create index if not exists records_kind_year_idx on public.records (user_id, kind, year);

-- 2) synced_at sempre preenchido pelo servidor (permite buscar "o que mudou desde a última vez")
create or replace function public.set_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_set_synced_at on public.records;
create trigger records_set_synced_at before insert or update on public.records
for each row execute function public.set_synced_at();

-- 3) Segurança: cada pessoa só enxerga e altera os próprios dados
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.records for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records_delete_own" on public.records for delete using (auth.uid() = user_id);

-- 4) Armazenamento privado para os PDFs/EPUBs (pasta com o id de cada pessoa)
insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

drop policy if exists "books_select_own" on storage.objects;
drop policy if exists "books_insert_own" on storage.objects;
drop policy if exists "books_update_own" on storage.objects;
drop policy if exists "books_delete_own" on storage.objects;

create policy "books_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
