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
import { DiscordSyncEngineService } from './discord/sync-engine-service.js';
import {
  InMemoryDiscordSyncAuditRepository,
  PgDiscordSyncAuditRepository,
  type DiscordSyncAuditRepository,
} from './discord/sync-audit-repository.js';
import {
  InMemoryDiscordRoleMappingRepository,
  PgDiscordRoleMappingRepository,
  type DiscordRoleMappingRepository,
} from './discord/role-mapping-repository.js';
import { DiscordIdentityResolver } from './discord/identity-resolver.js';
import {
  InMemoryDiscordOrchestrationRepository,
  PgDiscordOrchestrationRepository,
  type DiscordOrchestrationRepository,
} from './discord/orchestration-repository.js';
import { DiscordOrchestrationService } from './discord/orchestration-service.js';
import { createDiscordAccountLinkRouter } from './routes/discord-account-link.js';
import { createDiscordRouter } from './routes/discord.js';
import { createDiscordOrchestrationRouter } from './routes/discord-orchestration.js';
import { createDiscordSyncRouter } from './routes/discord-sync.js';
import { createAuthRouter } from './routes/auth.js';
import { createDiscordAuthRouter } from './routes/auth-discord.js';
import { createHealthRouter } from './routes/health.js';
import { MemoryFamilyMemberRepository, type FamilyMemberRepository } from './members/member-repository.js';
import { PgFamilyMemberRepository } from './members/pg-member-repository.js';
import { FamilyMemberService } from './members/member-service.js';
import { createFamilyMembersRouter } from './routes/family-members.js';
import { createFamilyQuestsRouter } from './routes/family-quests.js';
import { PgFamilyQuestRepository } from './quests/pg-quest-repository.js';
import { MemoryFamilyQuestRepository, type FamilyQuestRepository } from './quests/quest-repository.js';
import { FamilyQuestService } from './quests/quest-service.js';
import { FamilyAccountingReadService } from './accounting/accounting-read-service.js';
import { FamilyAccountingService } from './accounting/accounting-service.js';
import { FamilyQuestPayoutService } from './accounting/quest-payout-service.js';
import { PgRewardFinanceService, type RewardFinanceHandoff } from './accounting/reward-finance-service.js';
import { createFamilyAccountingRouter } from './routes/family-accounting.js';
import { createFamilyTowerDefenseRouter } from './routes/family-tower-defense.js';
import { PgTowerDefenseRepository } from './tower-defense/pg-tower-defense-repository.js';
import { MemoryTowerDefenseRepository, type TowerDefenseRepository } from './tower-defense/tower-defense-repository.js';
import { TowerDefenseService } from './tower-defense/tower-defense-service.js';
import { MemberActivityService } from './member-activity/member-activity-service.js';
import { createFamilyMemberActivityRouter } from './routes/family-member-activity.js';
import { PgFamilyEventRepository } from './family-events/pg-family-event-repository.js';
import { MemoryFamilyEventRepository, type FamilyEventRepository } from './family-events/family-event-repository.js';
import { FamilyEventService } from './family-events/family-event-service.js';
import { createFamilyEventsRouter } from './routes/family-events.js';
import { FamilyCalendarService } from './calendar/family-calendar-service.js';
import { createFamilyCalendarRouter } from './routes/family-calendar.js';
import { PgAchievementRepository } from './achievements/pg-achievement-repository.js';
import { MemoryAchievementRepository, type AchievementRepository } from './achievements/achievement-repository.js';
import { AchievementService } from './achievements/achievement-service.js';
import { createFamilyAchievementsRouter } from './routes/family-achievements.js';
import { PgRewardAllocationRepository } from './achievements/pg-reward-allocation-repository.js';
import { MemoryRewardAllocationRepository, type RewardAllocationRepository } from './achievements/reward-allocation-repository.js';
import { RewardAllocationService } from './achievements/reward-allocation-service.js';
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
  discordSyncAuditRepository?: DiscordSyncAuditRepository;
  discordSyncEngineService?: DiscordSyncEngineService | null;
  discordOrchestrationRepository?: DiscordOrchestrationRepository;
  discordOrchestrationService?: DiscordOrchestrationService | null;
  accountLinkOAuthService?: DiscordAccountLinkOAuthService;
  authRepository?: FamilyAuthRepository;
  authService?: FamilyAuthService | null;
  loginCompletions?: DiscordLoginCompletionRepository;
  oauthLoginService?: DiscordOAuthLoginService | null;
  memberRepository?: FamilyMemberRepository;
  memberService?: FamilyMemberService | null;
  questRepository?: FamilyQuestRepository;
  questService?: FamilyQuestService | null;
  questPayoutService?: FamilyQuestPayoutService | null;
  accountingReadService?: FamilyAccountingReadService | null;
  accountingService?: FamilyAccountingService | null;
  towerDefenseRepository?: TowerDefenseRepository;
  towerDefenseService?: TowerDefenseService | null;
  familyEventRepository?: FamilyEventRepository;
  familyEventService?: FamilyEventService | null;
  familyCalendarService?: FamilyCalendarService | null;
  memberActivityService?: MemberActivityService | null;
  achievementRepository?: AchievementRepository;
  achievementService?: AchievementService | null;
  rewardAllocationRepository?: RewardAllocationRepository;
  rewardAllocationService?: RewardAllocationService | null;
  rewardFinanceService?: RewardFinanceHandoff | null;
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
    new DiscordAccountLinkOAuthService(config, accountLinks, oauthStates, fetch, authService ? memberRepository : null);
  const memberService =
    dependencies.memberService !== undefined
      ? dependencies.memberService
      : memberRepository
        ? new FamilyMemberService(memberRepository, authRepository)
        : null;
  const questRepository =
    dependencies.questRepository ??
    (pgPool ? new PgFamilyQuestRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryFamilyQuestRepository() : null);
  const questService =
    dependencies.questService !== undefined
      ? dependencies.questService
      : questRepository
        ? new FamilyQuestService(questRepository, memberRepository)
        : null;
  const questPayoutService =
    dependencies.questPayoutService !== undefined
      ? dependencies.questPayoutService
      : pgPool
        ? new FamilyQuestPayoutService(pgPool)
        : null;
  const accountingReadService =
    dependencies.accountingReadService !== undefined
      ? dependencies.accountingReadService
      : pgPool
        ? new FamilyAccountingReadService(pgPool)
        : null;
  const accountingService =
    dependencies.accountingService !== undefined
      ? dependencies.accountingService
      : pgPool
        ? new FamilyAccountingService(pgPool)
        : null;
  const towerDefenseRepository =
    dependencies.towerDefenseRepository ??
    (pgPool ? new PgTowerDefenseRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryTowerDefenseRepository() : null);
  const towerDefenseService =
    dependencies.towerDefenseService !== undefined
      ? dependencies.towerDefenseService
      : towerDefenseRepository
        ? new TowerDefenseService(towerDefenseRepository)
        : null;
  const familyEventRepository =
    dependencies.familyEventRepository ??
    (pgPool ? new PgFamilyEventRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryFamilyEventRepository() : null);
  const familyEventService =
    dependencies.familyEventService !== undefined
      ? dependencies.familyEventService
      : familyEventRepository
        ? new FamilyEventService(familyEventRepository)
        : null;
  const familyCalendarService =
    dependencies.familyCalendarService !== undefined
      ? dependencies.familyCalendarService
      : new FamilyCalendarService(familyEventRepository, towerDefenseRepository, questRepository);
  const achievementRepository =
    dependencies.achievementRepository ??
    (pgPool ? new PgAchievementRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryAchievementRepository() : null);
  const rewardFinanceService =
    dependencies.rewardFinanceService !== undefined
      ? dependencies.rewardFinanceService
      : pgPool
        ? new PgRewardFinanceService(pgPool)
        : null;
  const rewardAllocationRepository =
    dependencies.rewardAllocationRepository ??
    (pgPool ? new PgRewardAllocationRepository(pgPool) : config.nodeEnv === 'test' ? new MemoryRewardAllocationRepository() : null);
  const achievementService =
    dependencies.achievementService !== undefined
      ? dependencies.achievementService
      : achievementRepository && memberRepository && questRepository && towerDefenseRepository && familyEventRepository
        ? new AchievementService(achievementRepository, memberRepository, questRepository, towerDefenseRepository, familyEventRepository, rewardFinanceService, rewardAllocationRepository)
        : null;
  const rewardAllocationService =
    dependencies.rewardAllocationService !== undefined
      ? dependencies.rewardAllocationService
      : rewardAllocationRepository && achievementRepository && memberRepository && towerDefenseRepository && familyEventRepository
        ? new RewardAllocationService(rewardAllocationRepository, achievementRepository, memberRepository, towerDefenseRepository, familyEventRepository)
        : null;
  const memberActivityService =
    dependencies.memberActivityService !== undefined
      ? dependencies.memberActivityService
      : memberRepository && questRepository && towerDefenseRepository
        ? new MemberActivityService(memberRepository, questRepository, towerDefenseRepository, accountingReadService, familyEventRepository, achievementRepository, achievementService)
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
  const discordSyncAuditRepository =
    dependencies.discordSyncAuditRepository ??
    (pgPool ? new PgDiscordSyncAuditRepository(pgPool) : new InMemoryDiscordSyncAuditRepository());
  const discordSyncEngineService =
    dependencies.discordSyncEngineService !== undefined
      ? dependencies.discordSyncEngineService
      : new DiscordSyncEngineService(memberSyncDryRunService, memberSyncApplyService, roleMappings, discordSyncAuditRepository, config);
  const discordOrchestrationRepository =
    dependencies.discordOrchestrationRepository ??
    (pgPool ? new PgDiscordOrchestrationRepository(pgPool) : new InMemoryDiscordOrchestrationRepository());
  const discordOrchestrationService =
    dependencies.discordOrchestrationService !== undefined
      ? dependencies.discordOrchestrationService
      : memberRepository
        ? new DiscordOrchestrationService(
            config,
            new DiscordIdentityResolver(accountLinks, memberRepository),
            discordOrchestrationRepository,
            discordService,
            questService,
            towerDefenseService,
            familyEventService,
          )
        : null;
  if (discordOrchestrationService) {
    discordService.registerButtonInteractionHandler((request) => discordOrchestrationService.handleInteraction(request));
    discordService.registerCommandInteractionHandler((request) => discordOrchestrationService.handleCommand(request));
  }

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
  app.use('/api', createFamilyAccountingRouter(config, authService, accountingReadService, accountingService));
  app.use('/api', createFamilyMemberActivityRouter(config, authService, memberActivityService));
  app.use('/api', createFamilyAchievementsRouter(config, authService, achievementService));
  app.use('/api', createFamilyEventsRouter(config, authService, familyEventService, rewardAllocationService, achievementService));
  app.use('/api', createFamilyCalendarRouter(config, authService, familyCalendarService));
  app.use('/api', createFamilyQuestsRouter(config, authService, questService, questPayoutService));
  app.use('/api', createFamilyTowerDefenseRouter(config, authService, towerDefenseService, rewardAllocationService, achievementService));
  app.use('/api', createDiscordRouter(discordService));
  app.use('/api', createDiscordOrchestrationRouter(config, authService, discordOrchestrationService));
  app.use('/api', createDiscordAccountLinkRouter(config, accountLinks, accountLinkOAuthService, authService));
  app.use('/api', createDiscordSyncRouter(config, authService, memberSyncDryRunService, memberSyncApplyService, discordSyncEngineService));

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
    discordSyncAuditRepository,
    discordSyncEngineService,
    discordOrchestrationRepository,
    discordOrchestrationService,
    accountLinkOAuthService,
    authRepository,
    authService,
    loginCompletions,
    oauthLoginService,
    memberRepository,
    memberService,
    questRepository,
    questService,
    questPayoutService,
    accountingReadService,
    accountingService,
    towerDefenseRepository,
    towerDefenseService,
    familyEventRepository,
    familyEventService,
    familyCalendarService,
    memberActivityService,
    achievementRepository,
    achievementService,
    rewardAllocationRepository,
    rewardAllocationService,
    rewardFinanceService,
    pgPool,
  };
}
