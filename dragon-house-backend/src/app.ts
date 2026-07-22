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
import { DiscordJsGuildMemberReader, type DiscordGuildMemberReader } from './discord/guild-member-reader.js';
import { DiscordMemberSyncApplyService } from './discord/member-sync-apply-service.js';
import { DiscordMemberSyncDryRunService } from './discord/member-sync-dry-run-service.js';
import {
  InMemoryDiscordRoleMappingRepository,
  PgDiscordRoleMappingRepository,
  type DiscordRoleMappingRepository,
} from './discord/role-mapping-repository.js';
import { createDiscordAccountLinkRouter } from './routes/discord-account-link.js';
import { createDiscordRouter } from './routes/discord.js';
import { createDiscordSyncRouter } from './routes/discord-sync.js';
import { createAuthRouter } from './routes/auth.js';
import { createDiscordAuthRouter } from './routes/auth-discord.js';
import { createHealthRouter } from './routes/health.js';
import { MemoryFamilyMemberRepository, type FamilyMemberRepository } from './members/member-repository.js';
import { PgFamilyMemberRepository } from './members/pg-member-repository.js';
import { FamilyMemberService } from './members/member-service.js';
import { createFamilyMembersRouter } from './routes/family-members.js';
import {
  InMemoryDiscordLoginCompletionRepository,
  PgDiscordLoginCompletionRepository,
  type DiscordLoginCompletionRepository,
} from './auth/discord-login-completion-repository.js';
import { DiscordOAuthLoginService } from './auth/discord-oauth-login-service.js';
import { createLogger } from './logging/logger.js';

export type AppDependencies = {
  discordService?: DiscordService;
  accountLinks?: DiscordAccountLinkRepository;
  oauthStates?: DiscordOAuthStateRepository;
  roleMappings?: DiscordRoleMappingRepository;
  guildMemberReader?: DiscordGuildMemberReader;
  memberSyncApplyService?: DiscordMemberSyncApplyService | null;
  memberSyncDryRunService?: DiscordMemberSyncDryRunService | null;
  accountLinkOAuthService?: DiscordAccountLinkOAuthService;
  authRepository?: FamilyAuthRepository;
  authService?: FamilyAuthService | null;
  loginCompletions?: DiscordLoginCompletionRepository;
  oauthLoginService?: DiscordOAuthLoginService | null;
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
  const roleMappings =
    dependencies.roleMappings ??
    (pgPool ? new PgDiscordRoleMappingRepository(pgPool) : new InMemoryDiscordRoleMappingRepository());
  const memberRepository =
    dependencies.memberRepository ??
    (pgPool ? new PgFamilyMemberRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryFamilyMemberRepository() : null);
  const authRepository =
    dependencies.authRepository ??
    (pgPool ? new PgFamilyAuthRepository(pgPool) : config.nodeEnv === 'test' ? new InMemoryFamilyAuthRepository() : null);
  const authService =
    dependencies.authService !== undefined
      ? dependencies.authService
      : authRepository && memberRepository
        ? new FamilyAuthService(config, authRepository, memberRepository)
        : null;
  const accountLinkOAuthService =
    dependencies.accountLinkOAuthService ??
    new DiscordAccountLinkOAuthService(config, accountLinks, oauthStates);
  const memberService =
    dependencies.memberService !== undefined
      ? dependencies.memberService
      : memberRepository
        ? new FamilyMemberService(memberRepository, authRepository)
        : null;
  const loginCompletions =
    dependencies.loginCompletions ??
    (pgPool ? new PgDiscordLoginCompletionRepository(pgPool) : new InMemoryDiscordLoginCompletionRepository());
  const oauthLoginService =
    dependencies.oauthLoginService !== undefined
      ? dependencies.oauthLoginService
      : authService && memberRepository
        ? new DiscordOAuthLoginService(
            config,
            oauthStates,
            loginCompletions,
            accountLinks,
            memberRepository,
            authService,
            createLogger(config),
          )
        : null;
  const guildMemberReader = dependencies.guildMemberReader ?? new DiscordJsGuildMemberReader(config);
  const memberSyncDryRunService =
    dependencies.memberSyncDryRunService !== undefined
      ? dependencies.memberSyncDryRunService
      : memberRepository
        ? new DiscordMemberSyncDryRunService(guildMemberReader, memberRepository, roleMappings, config)
        : null;
  const memberSyncApplyService =
    dependencies.memberSyncApplyService !== undefined
      ? dependencies.memberSyncApplyService
      : pgPool && memberSyncDryRunService
        ? new DiscordMemberSyncApplyService(pgPool, memberSyncDryRunService, config)
        : null;

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: '256kb' }));

  const healthRouter = createHealthRouter(discordService, pgPool);
  app.use('/api', healthRouter);
  app.use('/', healthRouter);
  app.use('/api', createAuthRouter(authService));
  app.use('/api', createDiscordAuthRouter(config, oauthLoginService));
  app.use('/api', createFamilyMembersRouter(config, authService, memberService));
  app.use('/api', createDiscordRouter(discordService));
  app.use('/api', createDiscordAccountLinkRouter(config, accountLinks, accountLinkOAuthService, authService));
  app.use('/api', createDiscordSyncRouter(config, authService, memberSyncDryRunService, memberSyncApplyService));

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  return {
    app,
    discordService,
    accountLinks,
    oauthStates,
    roleMappings,
    guildMemberReader,
    memberSyncApplyService,
    memberSyncDryRunService,
    accountLinkOAuthService,
    authRepository,
    authService,
    loginCompletions,
    oauthLoginService,
    memberRepository,
    memberService,
    pgPool,
  };
}
