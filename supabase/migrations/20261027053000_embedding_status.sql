-- BarrioAI: embedding lifecycle status for productos.
--
-- WHY: when the embedding provider fails during upload, productos rows
-- were saved with embedding = NULL and the search RPC filters
-- `embedding IS NOT NULL`, so those products became permanently
-- invisible with no way to find or repair them. Status + attempts make
-- the failure observable and retryable (see GET /api/cron/retry-embeddings).

alter table public.productos
  add column if not exists embedding_status text not null default 'pending',
  add column if not exists embedding_attempts integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productos_embedding_status_check'
  ) then
    alter table public.productos
      add constraint productos_embedding_status_check
      check (embedding_status in ('pending', 'ready', 'failed'));
  end if;
end $$;

-- Backfill: rows that already carry a vector are ready; the rest need work.
update public.productos
set embedding_status = 'ready'
where embedding is not null and embedding_status <> 'ready';

-- Partial index keeps the retry scan cheap: only unfinished rows.
create index if not exists productos_embedding_pending_idx
  on public.productos (embedding_status)
  where embedding_status <> 'ready';
