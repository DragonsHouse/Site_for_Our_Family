# Dragon House Local Database Setup

PowerShell steps for local development only.

1. Install Docker Desktop.
2. Start Docker Desktop and wait until Docker is running.
3. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Open `.env` and change `POSTGRES_PASSWORD` plus the password inside `DATABASE_URL`.
5. Do not add `DISCORD_CLIENT_SECRET` until you are intentionally testing OAuth.
6. Install dependencies:
   ```powershell
   npm install
   ```
7. Start PostgreSQL:
   ```powershell
   npm run db:up
   ```
8. Check container status:
   ```powershell
   npm run db:status
   ```
9. Apply schema migrations:
   ```powershell
   npm run db:migrate
   ```
   This applies `001_family_auth.sql` and later schema-only migrations such as
   `002_family_members_domain.sql`. Do not edit already applied migrations.
10. Verify schema constraints:
    ```powershell
    npm run db:verify
    ```
11. Start backend:
    ```powershell
    npm run dev
    ```
12. Check database health:
    ```powershell
    Invoke-RestMethod http://localhost:8787/health/database
    ```

Do not commit `.env`. Real Discord secrets, bot tokens, database passwords, and OAuth secrets must stay local/backend-only.

The destructive reset command is dev-only and requires explicit confirmation:

```powershell
$env:NODE_ENV="development"
$env:CONFIRM_DATABASE_RESET="dragon_house"
npm run db:reset:dev
```

Do not use reset for normal setup.

Real Family Hub local data is not imported automatically. Export a JSON backup in Family Hub before any future migration dry-run or apply step.

For an empty development database, a first owner can be created manually:

```powershell
npm run family:bootstrap-owner -- --nickname "DevOwner" --login "dev-owner" --static-id "1000" --password "temporary-password1"
```

This bootstrap command is development-only, refuses a second active owner, and must not be run automatically.
