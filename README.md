# Dragon House Family Hub

Dragon House Family Hub is a local family dashboard and backend for managing Dragon House members, authentication, tasks, quests, resources, profile data, and related family tools.

This repository preserves the current local working baseline. It is not configured for production deployment yet.

## Repository structure

```text
Site_for_Our_Family/
├── chrome_app/
├── dragon-house-backend/
├── README.md
└── .gitignore
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

The backend is a Node.js TypeScript API with Express, PostgreSQL repositories, authentication, migrations, and tests.

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
