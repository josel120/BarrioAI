# BarrioAI — CI/CD

## Deploy model

- **Vercel Git integration owns all deploys.** There is intentionally no custom
  deploy job in `.github/workflows/`.
  - Push to `main` → production deploy.
  - Every pull request / branch push → preview deploy with a unique URL.
- **Branch strategy:** `main` is production. Do all work on short-lived
  feature branches, open a PR, merge to `main` only when CI is green.
- **Suggested required status checks** (GitHub → Settings → Branches →
  branch protection for `main`):
  - `Typecheck`, `Lint`, `Build` (from the `CI` workflow) — required.
  - `Migration lint / dry-run` (from the `Supabase` workflow) — do NOT make
    required; it only runs when `supabase/**` changes and skips gracefully
    without its optional secret.

## Workflows

| File | Trigger | Jobs | Secrets |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | `push` + `pull_request` | Install, Typecheck, Lint, Build | none |
| `.github/workflows/supabase.yml` | `push`/`pull_request` touching `supabase/**`, or manual dispatch | Migration lint / dry-run | `SUPABASE_ACCESS_TOKEN` (optional) |

- `ci.yml` pins Node `24` in `actions/setup-node@v4` (local toolchain at
  time of writing: Node v24.19.0) with the npm cache enabled, then `npm ci`
  (deterministic install from `package-lock.json`). The `install` job fails
  fast if the lockfile drifts out of sync with `package.json`.
- The `build` job sets all 7 app env vars to empty-but-present strings so
  the build exercises the lazy-client behavior (it must succeed with no
  real credentials, exactly as Vercel's build does before runtime env is
  injected).
- `supabase.yml` always lists `supabase/migrations/*.sql` (no secrets
  needed). The `supabase db lint --linked` step runs only when the
  `SUPABASE_ACCESS_TOKEN` secret exists; otherwise a step prints a skip
  note and the job exits 0 — a PR is never failed for a missing optional
  secret.

## Secrets inventory

### GitHub Actions secrets (repo → Settings → Secrets and variables → Actions)

| Name | Purpose | Where to create it | Used by |
| --- | --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | (Optional) Personal access token letting CI lint the linked Supabase project | Supabase dashboard → account menu → Access Tokens → "Generate new token" | `supabase.yml` only; job skips with a note when absent |

The `CI` workflow needs no secrets at all.

### Runtime env vars (Vercel, NOT GitHub secrets)

Set these in Vercel → project → Settings → Environment Variables, for both
Preview and Production (names only — never paste values into git or chat):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose with a `NEXT_PUBLIC_` prefix)
- `META_API_BASE_URL`
- `META_API_KEY`
- `META_VISION_MODEL`
- `OPENAI_API_KEY` (optional)
- `EMBEDDING_MODEL` (optional, defaults to `text-embedding-3-small`)

See `.env.example` for what each variable does.

## Enabling linked-project lint (click-ops)

1. Create the Supabase project (dashboard) — human step, CI cannot do this.
2. Locally, once: `npx supabase link --project-ref <ref>` (stores the link;
   commit `supabase/config.toml`, never commit tokens).
3. Supabase dashboard → account → Access Tokens → generate a token.
4. GitHub repo → Settings → Secrets and variables → Actions → New
   repository secret → name `SUPABASE_ACCESS_TOKEN`, paste the token.
5. Push a change under `supabase/**` (or run the `Supabase` workflow via
   "Run workflow") and check the `Lint linked project` step output.

## How to read CI failures

- **Install red:** `package-lock.json` is out of sync. Run `npm install`
  locally and commit the updated lockfile.
- **Typecheck red:** `npx tsc --noEmit` output names the file and line.
- **Lint red:** `npm run lint` output names the rule and file.
- **Build red:** `npm run build` output. If it passes locally but fails in
  CI, check for case-sensitive import paths (CI runs on Linux) and for
  code that reads env vars at import time instead of lazily.
- **Supabase workflow missing on a PR:** expected — it only triggers when
  `supabase/**` changes. Never add it as a required check.

## Reproduce each job locally (exact commands)

Prerequisite: Node 24 (`node --version` should print `v24.x`) and a clean
install:

```bash
npm ci
npx tsc --noEmit
npm run lint
```

Build with empty-but-present env (what the `build` job does):

```bash
# bash / GitHub runner equivalent
NEXT_PUBLIC_SUPABASE_URL="" SUPABASE_SERVICE_ROLE_KEY="" \
META_API_BASE_URL="" META_API_KEY="" META_VISION_MODEL="" \
OPENAI_API_KEY="" EMBEDDING_MODEL="" npm run build
```

```powershell
# PowerShell equivalent
$env:NEXT_PUBLIC_SUPABASE_URL=""; $env:SUPABASE_SERVICE_ROLE_KEY=""
$env:META_API_BASE_URL=""; $env:META_API_KEY=""
$env:META_VISION_MODEL=""; $env:OPENAI_API_KEY=""
$env:EMBEDDING_MODEL=""; npm run build
```

Supabase dry-run (no secrets):

```bash
ls supabase/migrations   # informational; empty repo prints "no such directory", which is fine
```

With a token + linked project (mirrors the gated CI step):

```bash
export SUPABASE_ACCESS_TOKEN="<token>"   # PowerShell: $env:SUPABASE_ACCESS_TOKEN="<token>"
npx supabase db lint --linked --fail-on error
```

## Known caveats

- The repo currently contains **both** `package-lock.json` and
  `pnpm-lock.yaml`. CI uses `npm ci` + `package-lock.json` (which is in
  sync with `package.json`). The repo should standardize on one package
  manager and delete the other lockfile; that cleanup is outside this
  slice's owned files.
- `supabase/migrations/` now holds the 4-file chain (see `docs/SUPABASE_PROD.md`
  appendix); until `SUPABASE_ACCESS_TOKEN` is set, `supabase.yml` exercises
  only its listing + skip-note path.
