# Dragon House Family Hub

Dragon House Family Hub is a family dashboard and backend for managing Dragon House members, authentication, quests, events, tower defense, treasury/accounting, resources, profile data, and Discord operational workflows.

Authoritative business state lives in the backend and PostgreSQL. The Hub is the rich management/read/control interface. Discord is an operational and projection interface: Discord actions call the same backend domain services as Hub actions, and Discord messages must not become a parallel business database.

## Repository structure

```text
Site_for_Our_Family/
|-- chrome_app/
|-- dragon-house-backend/
|-- README.md
`-- .gitignore
```

## Frontend

Path: `chrome_app/`

The frontend is a WXT React browser extension with dashboard, popup, options, authentication UI, Dragon loading screen, family modules, local assets, and UTF-8 audit tooling.

Basic local commands:

```bash
cd chrome_app
npm install
npm run dev
npm run build
```

## Backend

Path: `dragon-house-backend/`

The backend is a Node.js TypeScript API with Express, PostgreSQL repositories, authentication, migrations, Discord orchestration, accounting boundaries, and tests.

Basic local commands:

```bash
cd dragon-house-backend
npm install
npm run db:up
npm run db:migrate
npm run dev
```

## Required software

- Node.js
- npm
- Docker Desktop, for the local PostgreSQL service
- Git

## Environment files

Use `dragon-house-backend/.env.example` as a template for local configuration.

Never commit real `.env` files, database credentials, Discord secrets, bearer tokens, API keys, private keys, cookies, or production credentials.

Production deployment is not configured yet.

## Discord member synchronization

Discord is the source of truth for guild membership, Discord identity, server nickname, avatar, primary hierarchy rank, mapped family role, and permissions granted by Discord role mappings.

Family Hub backend and PostgreSQL remain the source of truth for internal data such as notes, quests, treasury, accounting, statistics, events, tower defense, settings, manual permission grants, and manual permission denials.

Discord automation is intentionally bounded:

- Discord may join/help/withdraw/respond through backend services.
- Discord may publish projections for quests, tower defense, and events.
- Discord may ingest trusted Dragon House operational messages only from configured trusted bot/application/webhook IDs.
- Discord must not approve payouts, mark accounting transactions paid, change salaries, bypass proof, or create arbitrary accounting state.
- Family chat/history channels are not bulk-scraped into Hub.

### Sync lifecycle

1. An owner calls the dry-run endpoint.
2. The backend fetches the Discord guild member snapshot, excludes bots, resolves role mappings, and returns a `planId`, `planHash`, `generatedAt`, and `planExpiresAt`.
3. The owner calls apply sync with `confirm: true`, the latest plan identity, and an `idempotencyKey`.
4. The backend takes a PostgreSQL advisory lock scoped to the Discord guild, recomputes the dry-run, verifies that the plan identity and hash still match, rejects expired plans, and applies the plan in one transaction.
5. The backend records a sync report in `discord_sync_reports` and writes detailed audit entries in `family_audit_log`.

### Sync API

All sync endpoints require authenticated owner access.

- `POST /api/discord/dry-run`
- `POST /api/discord/sync/members/dry-run`
- `POST /api/discord/apply-sync`
- `GET /api/discord/sync-report`

Apply sync requires:

```json
{
  "confirm": true,
  "planId": "dry-run plan id",
  "planGeneratedAt": "dry-run generatedAt value",
  "planExpiresAt": "dry-run planExpiresAt value",
  "planHash": "sha256 dry-run plan hash",
  "idempotencyKey": "caller-generated unique key"
}
```

### Production configuration

Use environment variables for all deployment-specific values:

- `DATABASE_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_TRUSTED_BOT_USER_ID`
- `DISCORD_TRUSTED_APPLICATION_ID`
- `DISCORD_TRUSTED_WEBHOOK_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` for the authenticated account-link callback
- `DISCORD_OAUTH_REDIRECT_URI`
- `DISCORD_OAUTH_SCOPES`
- `DISCORD_LOGIN_SUCCESS_REDIRECT_URI`
- `DISCORD_LOGIN_ERROR_REDIRECT_URI`
- `DISCORD_LOGIN_ALLOWED_REDIRECT_URIS`
- `DISCORD_OAUTH_STATE_TTL_SECONDS`
- `DISCORD_LOGIN_COMPLETION_TTL_SECONDS`
- `DISCORD_OAUTH_START_RATE_LIMIT_PER_MINUTE`
- `DISCORD_OAUTH_COMPLETE_RATE_LIMIT_PER_MINUTE`
- `DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID`
- `DISCORD_SYNC_PROTECTED_OWNER_USER_ID`
- `DISCORD_SYNC_MIN_HUMAN_MEMBERS`
- `DISCORD_SYNC_PLAN_TTL_SECONDS`
- `DISCORD_SYNC_DRY_RUN_RATE_LIMIT_PER_MINUTE`
- `DISCORD_SYNC_APPLY_RATE_LIMIT_PER_HOUR`
- `DISCORD_SYNC_REPORT_RATE_LIMIT_PER_MINUTE`
- `DISCORD_SYNC_AUTO_ENABLED=false` by default; enable deliberately only after dry-run verification
- `DISCORD_TOWER_SYNC_ENABLED`
- `DISCORD_TOWER_SYNC_ACTOR_MEMBER_ID` for the explicit system actor used by tower imports
- `DISCORD_TOWER_SYNC_MESSAGE_LIMIT`
- `DISCORD_TOWER_CAPTER_ROLE_ID` for targeted KD reminders; never use `@everyone`/`@here`
- `DISCORD_TOWER_KD_REMINDER_INTERVAL_SECONDS`
- `DISCORD_SYNC_REPORT_DIR` if filesystem report copies are wanted
- `LOG_LEVEL`
- `LOG_FORMAT`
- `TRUST_PROXY`
- `FRONTEND_ALLOWED_ORIGINS`

Production should run behind HTTPS and a reverse proxy. Do not commit real `.env` files or production credentials.

Discord Developer Portal requirements:

- Enable the Message Content privileged intent while ingestion still reads trusted message text.
- Configure only guild commands during the current stage.
- Grant text/embed publishing permissions per channel: View Channel, Send Messages, Read Message History, Embed Links. Attach Files is required only for future attachment operations.

### Discord OAuth login

Discord OAuth authenticates identity only. Discord member sync remains the source of truth for guild membership, hierarchy rank, mapped Family Hub role, and Discord-derived permissions.

Login flow:

1. The extension calls `POST /api/auth/discord/start`.
2. The backend creates a durable one-time OAuth transaction in PostgreSQL, binds it to an approved redirect target, and returns a Discord authorization URL.
3. Discord redirects to `DISCORD_OAUTH_REDIRECT_URI`, normally `/api/auth/discord/callback`.
4. The backend validates state and PKCE, exchanges the authorization code server-side, fetches `/users/@me`, and resolves `discord_account_links.discord_user_id`.
5. Login is denied if the Discord account is not linked, the member is inactive, the link is not verified for the configured guild, or protected-owner IDs do not match.
6. The backend issues a short-lived one-time completion code, not a Family Hub session token.
7. The extension calls `POST /api/auth/discord/complete` with the completion code and receives the normal Family Hub bearer session.
8. The extension then calls `GET /api/auth/me`, which returns backend member data as the source of truth.

Required Discord Developer Portal redirect URLs:

- Local login: `http://localhost:8787/api/auth/discord/callback`
- Local account linking: `http://localhost:8787/api/discord/account-link/callback`
- Staging: `https://staging-api.example.com/api/auth/discord/callback`
- Production: `https://api.example.com/api/auth/discord/callback`

The exact staging and production hosts must be replaced with the deployed HTTPS API domains. The Chrome extension completion URL must be added to `DISCORD_LOGIN_ALLOWED_REDIRECT_URIS`; never allow arbitrary redirect URLs.

### Security model

- Apply sync is owner-only.
- Automatic destructive member sync is opt-in; `DISCORD_SYNC_AUTO_ENABLED` defaults to `false`.
- Apply sync is protected by a database-backed advisory lock scoped to the Discord guild.
- Apply sync is idempotency-keyed to protect duplicate requests. Reusing the same key with a different plan is rejected.
- Apply sync refuses stale plans by comparing the submitted plan identity and `planHash` with a freshly generated dry-run.
- Dry-run, apply, and sync-report endpoints are rate-limited per authenticated Family Hub member. The current limiter is suitable for a single backend instance; multi-instance production should move the limiter store to PostgreSQL or Redis.
- Protected owner identity is configured through stable Family Hub and Discord IDs.
- Manual permissions are preserved separately from Discord-derived permissions.
- Missing primary hierarchy roles remain conflicts and are not auto-created.
- Production logs are structured JSON when `LOG_FORMAT=json`; secret-like fields are redacted before logging.
- Discord OAuth access tokens are used only server-side to resolve identity and are not persisted after login completion.
- OAuth state, PKCE verifier, and login completion codes are short-lived, single-use, and stored durably in PostgreSQL.
- Operational Discord ingestion requires an allowlisted channel and configured trusted source identity.
- Discord accounting feeds are informational/evidence-only unless proof is copied into controlled storage with source message metadata.

### Current channel map

- welcome: reserved/read-only operational context.
- nickname change: operational read/audit.
- family history: reserved; no bulk history ingestion.
- family chat: reserved; no bulk family-chat scraping.
- quant news: reserved projection channel.
- quest info: operational read.
- quest announcements: quest projection/write channel.
- quest payments: accounting-related evidence/feed channel, not payment authority.
- tower guard: tower operational read/projection channel.
- events: event projection/write channel.
- admin log: audit/read channel.
- accounting: accounting feed/evidence channel.
- family photos: reserved media/evidence channel.

### Migrations and CI

Migrations are forward-only. Do not rewrite already-applied migrations; add a new migration for schema changes. CI runs backend typecheck, lint, tests, build, `db:migrate`, `db:verify`, and `db:migrate:status`, plus frontend typecheck, tests, lint, and `build:chrome`. The E2E CI job starts a fresh PostgreSQL service, prepares `dragon_house_e2e`, starts the real backend, builds the Chrome app, and runs Playwright against real browser -> backend HTTP -> PostgreSQL flows.

### Real backend E2E workflow

Use a separate E2E database only. The backend refuses E2E reset/seed/test-auth unless `NODE_ENV=test`, `E2E_TEST_MODE=true`, and the connected database name matches `E2E_DATABASE_NAME` and contains `e2e`.

Local commands:

```bash
# E2E setup/reset/seed
cd dragon-house-backend
$env:NODE_ENV='test'
$env:E2E_TEST_MODE='true'
$env:E2E_DATABASE_NAME='dragon_house_e2e'
$env:DATABASE_URL='postgresql://dragon_house:dragon_house@127.0.0.1:5433/dragon_house_e2e'
$env:PORT='8788'
npm run e2e:db:reset
npm run e2e:db:setup
npm run db:verify

# backend start for E2E
npm run e2e:start
```

In another terminal:

```bash
cd chrome_app
$env:PLAYWRIGHT_BACKEND_URL='http://127.0.0.1:8788'
$env:VITE_DRAGON_HOUSE_BACKEND_API_BASE_URL='http://127.0.0.1:8788'
npm run build:chrome
npm run test:e2e:real
```

Clean/reset E2E data:

```bash
cd dragon-house-backend
npm run e2e:db:reset
```

### Audit policy

Create events include the initial safe member context. Permission-change audit events are separate only when permissions are created or materially changed by sync. Repeated unchanged sync runs must not create member-change audit noise.

### Test policy

Auth tests keep production password hashing unchanged. Test setup reuses precomputed bcrypt hashes so the normal `npm run test` command remains deterministic and CI-friendly.

### Backup and restore

The current Family Backup UI is not a production PostgreSQL backup system. Production backup planning must cover PostgreSQL dumps or PITR, payment-proof/file storage, an off-machine copy, a retention policy, and a restore test in a safe environment before the backup can be treated as reliable.

### Known limitations

- OAuth login supports the Chrome extension flow, but public staging/production URLs and Discord Developer Portal redirect URLs still need to be configured before deployment.
- The current unauthenticated OAuth rate limiter is process-local and suitable for one backend instance. Multi-instance production should move it to PostgreSQL or Redis.
- Scheduled Discord member sync exists but is disabled by default and must be enabled only after dry-run verification.
- Discord banner/profile decoration fields are not fetched until the Discord reader supports those API fields.
- Deployment, Docker production images, HTTPS, reverse proxy configuration, sanitized staging bootstrap, and payment-proof object storage are not included yet.
