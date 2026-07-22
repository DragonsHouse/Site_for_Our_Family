import cors from 'cors';
import express from 'express';
import type pg from 'pg';
import type { AppConfig } from './config/env.js';
import { FamilyAuthService } from './auth/auth-service.js';
import { InMemoryFamilyAuthRepository, type FamilyAuthRepository } from './auth/auth-repository.js';
import { PgFamilyAuthRepository } from './auth/pg-auth-repository.js';
import { createPgPool } from './db/pool.js';
import { createCorsOptions } from './http/cors.js';
import { DiscordService } from './discord/discord-service.js';
import {
  InMemoryDiscordAccountLinkRepository,
  PgDiscordAccountLinkRepository,
  type DiscordAccountLinkRepository,
} from './discord/account-link-repository.js';
import { DiscordAccountLinkOAuthService } from './discord/discord-account-link-oauth-service.js';
import {
  InMemoryDiscordOAuthStateRepository,
  PgDiscordOAuthStateRepository,
  type DiscordOAuthStateRepository,
} from './discord/oauth-state-repository.js';
import { createDiscordAccountLinkRouter } from './routes/discord-account-link.js';
import { createDiscordRouter } from './routes/discord.js';
import { createAuthRouter } from './routes/auth.js';
import { createHealthRouter } from './routes/health.js';
import { MemoryFamilyMemberRepository, type FamilyMemberRepository } from './members/member-repository.js';
import { PgFamilyMemberRepository } from './members/pg-member-repository.js';
import { FamilyMemberService } from './members/member-service.js';
import { createFamilyMembersRouter } from './routes/family-members.js';

export type AppDependencies = {
  discordService?: DiscordService;
  accountLinks?: DiscordAccountLinkRepository;
  oauthStates?: DiscordOAuthStateRepository;
  accountLinkOAuthService?: DiscordAccountLinkOAuthService;
  authRepository?: FamilyAuthRepository;
  authService?: FamilyAuthService | null;
  memberRepository?: FamilyMemberRepository;
  memberService?: FamilyMemberService | null;
  pgPool?: pg.Pool | null;
};

export function createApp(config: AppConfig, dependencies: AppDependencies = {}) {
  const app = express();
  const discordService = dependencies.discordService ?? new DiscordService(config);
  const pgPool = dependencies.pgPool !== undefined ? dependencies.pgPool : createPgPool(config);
  const accountLinks =
    dependencies.accountLinks ??
    (pgPool ? new PgDiscordAccountLinkRepository(pgPool) : new InMemoryDiscordAccountLinkRepository());
  const oauthStates =
    dependencies.oauthStates ??
    (pgPool ? new PgDiscordOAuthStateRepository(pgPool) : new InMemoryDiscordOAuthStateRepository());
  const authRepository =
    dependencies.authRepository ??
    (pgPool ? new PgFamilyAuthRepository(pgPool) : config.nodeEnv === 'test' ? new InMemoryFamilyAuthRepository() : null);
  const authService =
    dependencies.authService !== undefined
      ? dependencies.authService
      : authRepository
        ? new FamilyAuthService(config, authRepository)
        : null;
  const accountLinkOAuthService =
    dependencies.accountLinkOAuthService ??
    new DiscordAccountLinkOAuthService(config, accountLinks, oauthStates);
  const memberRepository =
    dependencies.memberRepository ??
    (pgPool ? new PgFamilyMemberRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryFamilyMemberRepository() : null);
  const memberService =
    dependencies.memberService !== undefined
      ? dependencies.memberService
      : memberRepository
        ? new FamilyMemberService(memberRepository, authRepository)
        : null;

  app.disable('x-powered-by');
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: '256kb' }));

  const healthRouter = createHealthRouter(discordService, pgPool);
  app.use('/api', healthRouter);
  app.use('/', healthRouter);
  app.use('/api', createAuthRouter(authService));
  app.use('/api', createFamilyMembersRouter(config, authService, memberService));
  app.use('/api', createDiscordRouter(discordService));
  app.use('/api', createDiscordAccountLinkRouter(config, accountLinks, accountLinkOAuthService, authService));

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  return {
    app,
    discordService,
    accountLinks,
    oauthStates,
    accountLinkOAuthService,
    authRepository,
    authService,
    memberRepository,
    memberService,
    pgPool,
  };
}
