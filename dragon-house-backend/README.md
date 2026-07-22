# Dragon House Backend

Local backend shell for the future Dragon House Discord integration.

This project intentionally does not connect to Discord unless the required environment
configuration is present. Never put Discord bot tokens, client secrets, webhook secrets,
or database credentials into the Chrome extension.

## Scripts

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Auth session TTL

Backend auth issues opaque bearer session tokens and stores only token hashes in PostgreSQL. Normal sessions use `AUTH_SESSION_TTL_HOURS`; remember-me sessions use `AUTH_REMEMBER_ME_TTL_DAYS`. Raw passwords, session tokens, Discord tokens, client secrets, and bot tokens must never be logged or stored in frontend code.

## Discord OAuth login

Discord OAuth login is server-side authorization-code flow with one-time state, PKCE, and one-time completion codes.

- `POST /api/auth/discord/start` creates a PostgreSQL-backed OAuth transaction and returns the Discord authorization URL.
- `GET /api/auth/discord/callback` validates state, exchanges the provider code server-side, resolves `discord_account_links.discord_user_id`, and issues a short-lived completion code.
- `POST /api/auth/discord/complete` consumes the completion code once and creates a normal Family Hub session.
- `GET /api/auth/me` returns safe backend member profile fields. It never exposes password hashes, raw session tokens, Discord access tokens, OAuth state, or completion-code hashes.

OAuth never creates Family Hub members and never links accounts by nickname, username, display name, avatar, GTA name, or Static ID. Unlinked, inactive, unresolved, left-guild, or protected-owner-mismatched users are denied with stable safe error codes.

Required local Discord Developer Portal redirect URLs:

- `http://localhost:8787/api/auth/discord/callback`
- `http://localhost:8787/api/discord/account-link/callback`

Use HTTPS URLs for staging and production. Keep extension/web completion targets in `DISCORD_LOGIN_ALLOWED_REDIRECT_URIS`; arbitrary redirect targets are rejected.
