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
