-- BarrioAI: claim token for tienda ownership on the unauthenticated upload path.
--
-- POST /api/upload uses the service_role key (bypasses RLS), so ownership
-- cannot rely on RLS write policies yet. Each tienda gets a claim token:
-- only its SHA-256 hash is stored; the plaintext is returned once at
-- creation and must be presented to update that tienda afterwards.
-- Legacy tiendas have claim_hash NULL and are claimed by the first
-- presenter of a token (see route handler).

alter table public.tiendas
  add column if not exists claim_hash text;

comment on column public.tiendas.claim_hash is
  'SHA-256 hex of the tienda claim token. NULL = unclaimed legacy tienda.';
