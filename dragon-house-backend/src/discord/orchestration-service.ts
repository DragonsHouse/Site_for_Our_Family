import type { AppConfig } from '../config/env.js';
import type { FamilyEventService } from '../family-events/family-event-service.js';
import type { FamilyQuestDto, FamilyQuestService } from '../quests/quest-service.js';
import type { TowerDefenseResponseStatus } from '../tower-defense/tower-defense-models.js';
import type { TowerDefenseDto, TowerDefenseService } from '../tower-defense/tower-defense-service.js';
import type { FamilyAuthContext, FamilyMember } from '../types.js';
import { isAllowedChannel } from './channel-allowlist.js';
import { DiscordIdentityResolver } from './identity-resolver.js';
import { friendlyDiscordError } from './friendly-messages.js';
import { payloadHash, renderFamilyEventMessage, renderQuestMessage, renderTowerDefenseMessage } from './message-renderer.js';
import { DiscordOrchestrationError } from './orchestration-errors.js';
import type {
  DiscordCommandRequest,
  DiscordInteractionRequest,
  DiscordInteractionResponse,
  DiscordMessageIdentity,
  DiscordMessagePayload,
  DiscordMessageRecord,
  DiscordMessageTransport,
  DiscordOrchestrationSourceModule,
} from './orchestration-models.js';
import type { DiscordOrchestrationRepository } from './orchestration-repository.js';

type ParsedCustomId = {
  module: 'q' | 't' | 'e';
  action: string;
  sourceId: string;
  value?: string;
};

export type DiscordPublishState = 'unpublished' | 'published' | 'synced' | 'error';

export type DiscordPublishReadModel = {
  sourceModule: DiscordOrchestrationSourceModule;
  sourceId: string;
  state: DiscordPublishState;
  published: boolean;
  synced: boolean;
  messageExists: boolean;
  lastSyncedAt: string | null;
  channelLabel: string | null;
  error: { code: string; message: string } | null;
};

export class DiscordOrchestrationService {
  constructor(
    private readonly config: AppConfig,
    private readonly identityResolver: DiscordIdentityResolver,
    private readonly repository: DiscordOrchestrationRepository,
    private readonly transport: DiscordMessageTransport | null,
    private readonly questService: FamilyQuestService | null,
    private readonly towerDefenseService: TowerDefenseService | null,
    private readonly familyEventService: FamilyEventService | null,
  ) {}

  async handleInteraction(request: DiscordInteractionRequest, now = new Date()): Promise<DiscordInteractionResponse> {
    const parsed = parseCustomId(request.customId);
    const idempotencyKey = request.idempotencyKey ?? request.interactionId;
    const sourceModule = sourceModuleFor(parsed.module);
    const existingAction = await this.repository.findActionByIdempotencyKey(idempotencyKey);
    if (existingAction?.status === 'succeeded') {
      return {
        ok: true,
        ephemeral: true,
        content: '🐉 Цю дію вже оброблено в Hub.',
        action: parsed.action,
        sourceModule,
        sourceId: parsed.sourceId,
      };
    }
    await this.repository.saveAction({
      interactionId: request.interactionId,
      idempotencyKey,
      guildId: request.guildId,
      channelId: request.channelId ?? null,
      messageId: request.messageId ?? null,
      discordUserId: request.discordUserId,
      action: parsed.action,
      sourceModule,
      sourceId: parsed.sourceId,
      status: 'received',
      metadata: { customId: request.customId },
    });

    try {
      this.assertGuildAndChannel(request.guildId, request.channelId ?? null);
      const identity = await this.identityResolver.resolve(request.discordUserId);
      const response = await this.dispatch(parsed, identity.auth, now, request);
      await this.repository.saveAction({
        interactionId: request.interactionId,
        idempotencyKey,
        guildId: request.guildId,
        channelId: request.channelId ?? null,
        messageId: request.messageId ?? null,
        discordUserId: request.discordUserId,
        familyMemberId: identity.auth.familyMemberId,
        action: parsed.action,
        sourceModule,
        sourceId: parsed.sourceId,
        status: 'succeeded',
        metadata: { customId: request.customId },
      });
      return response;
    } catch (error) {
      const friendly = friendlyDiscordError(error);
      await this.repository.saveAction({
        interactionId: request.interactionId,
        idempotencyKey,
        guildId: request.guildId,
        channelId: request.channelId ?? null,
        messageId: request.messageId ?? null,
        discordUserId: request.discordUserId,
        action: parsed.action,
        sourceModule,
        sourceId: parsed.sourceId,
        status: 'failed',
        errorCode: friendly.code,
        metadata: { customId: request.customId },
      });
      return { ok: false, ephemeral: true, content: friendly.content, action: parsed.action, sourceModule, sourceId: parsed.sourceId, code: friendly.code };
    }
  }

  async handleCommand(request: DiscordCommandRequest, now = new Date()): Promise<DiscordInteractionResponse> {
    try {
      this.assertGuildAndChannel(request.guildId, request.channelId ?? null);
      if (request.commandName !== 'dragon') throw new Error('DISCORD_COMMAND_NOT_SUPPORTED');
      if (request.subcommand === 'me') return await this.handleMeCommand(request.discordUserId);
      if (request.subcommand === 'status') return await this.handleStatusCommand(request.discordUserId);
      const identity = await this.identityResolver.resolve(request.discordUserId);
      if (request.subcommand === 'quest') return await this.handleQuestCommand(request, identity.auth, now);
      if (request.subcommand === 'tower') return await this.handleTowerCommand(request, identity.auth, now);
      return await this.handleEventCommand(request, identity.auth, now);
    } catch (error) {
      const friendly = friendlyDiscordError(error);
      return { ok: false, ephemeral: true, content: friendly.content, action: request.subcommand, code: friendly.code };
    }
  }

  async publishQuest(questId: string, channelId: string, auth: Parameters<FamilyQuestService['getQuest']>[1]): Promise<DiscordPublishReadModel> {
    if (!this.questService) throw new Error('Quest service is unavailable.');
    this.assertConfiguredPublish(channelId, 'квестів');
    const quest = await this.questService.getQuest(questId, auth);
    return this.syncMessage({
      sourceModule: 'family_quests',
      sourceId: questId,
      messageKind: 'announcement',
      guildId: this.config.discord.guildId!,
      channelId,
    }, renderQuestMessage(quest), 'Квести');
  }

  async publishTowerDefense(defenseId: string, channelId: string, auth: Parameters<TowerDefenseService['getDefense']>[1]): Promise<DiscordPublishReadModel> {
    if (!this.towerDefenseService) throw new Error('Tower Defense service is unavailable.');
    this.assertConfiguredPublish(channelId, 'вишок / стаків');
    const defense = await this.towerDefenseService.getDefense(defenseId, auth);
    return this.syncMessage({
      sourceModule: 'tower_defense',
      sourceId: defenseId,
      messageKind: 'announcement',
      guildId: this.config.discord.guildId!,
      channelId,
    }, renderTowerDefenseMessage(defense), 'Вишки / стаки');
  }

  async publishFamilyEvent(eventId: string, channelId: string, auth: Parameters<FamilyEventService['getEvent']>[1]): Promise<DiscordPublishReadModel> {
    if (!this.familyEventService) throw new Error('Family Event service is unavailable.');
    this.assertConfiguredPublish(channelId, 'подій');
    const event = await this.familyEventService.getEvent(eventId, auth);
    return this.syncMessage({
      sourceModule: 'family_events',
      sourceId: eventId,
      messageKind: 'announcement',
      guildId: this.config.discord.guildId!,
      channelId,
    }, renderFamilyEventMessage(event), 'Події');
  }

  async getPublishState(sourceModule: DiscordOrchestrationSourceModule, sourceId: string, channelId: string | null, channelLabel: string): Promise<DiscordPublishReadModel> {
    if (!this.config.discord.guildId || !channelId) return emptyPublishState(sourceModule, sourceId, channelLabel);
    const record = await this.repository.findMessage({
      sourceModule,
      sourceId,
      messageKind: 'announcement',
      guildId: this.config.discord.guildId,
      channelId,
    });
    return toPublishReadModel(sourceModule, sourceId, record, channelLabel);
  }

  private async dispatch(
    parsed: ParsedCustomId,
    auth: FamilyAuthContext,
    now: Date,
    request: DiscordInteractionRequest,
  ): Promise<DiscordInteractionResponse> {
    if (parsed.module === 'q') return this.handleQuest(parsed, auth, now);
    if (parsed.module === 't') return this.handleTower(parsed, auth, now, request);
    return this.handleEvent(parsed, auth, now);
  }

  private async handleQuest(parsed: ParsedCustomId, auth: FamilyAuthContext, now: Date): Promise<DiscordInteractionResponse> {
    if (!this.questService) throw new Error('Quest service is unavailable.');
    if (parsed.action === 'join' || parsed.action === 'help') {
      const person = await this.questService.joinQuest(parsed.sourceId, {
        role: parsed.action === 'help' ? 'helper' : 'participant',
        metadata: { source: 'discord' },
      }, auth, now);
      return success('q', parsed, person.role === 'helper' ? '🐉 Ви допомагаєте з квестом.' : '🐉 Ви приєдналися до квесту.');
    }
    if (parsed.action === 'withdraw') {
      await this.questService.withdrawQuest(parsed.sourceId, auth, now);
      return success('q', parsed, '🐉 Ви вийшли з квесту.');
    }
    if (parsed.action === 'complete') {
      await this.questService.completeQuest(parsed.sourceId, { comment: 'Completed from Discord orchestration.' }, auth, now);
      return success('q', parsed, '🐉 Квест позначено виконаним у Hub.');
    }
    const quest = await this.questService.getQuest(parsed.sourceId, auth);
    return success('q', parsed, questDetails(quest));
  }

  private async handleTower(parsed: ParsedCustomId, auth: FamilyAuthContext, now: Date, request: DiscordInteractionRequest): Promise<DiscordInteractionResponse> {
    if (!this.towerDefenseService) throw new Error('Tower Defense service is unavailable.');
    if (parsed.action === 'respond') {
      const response = assertTowerResponse(parsed.value);
      await this.towerDefenseService.respond(parsed.sourceId, {
        response,
        source: 'discord',
        externalSource: 'discord',
        externalId: request.interactionId,
        idempotencyKey: request.idempotencyKey ?? request.interactionId,
      }, auth, now);
      return success('t', parsed, towerResponseMessage(response));
    }
    if (parsed.action === 'withdraw') {
      await this.towerDefenseService.withdrawResponse(parsed.sourceId, auth, now);
      return success('t', parsed, '🔥 Відповідь на вишку відкликано.');
    }
    if (parsed.action === 'start') {
      await this.towerDefenseService.startDefense(parsed.sourceId, auth, now);
      return success('t', parsed, '🔥 Захист розпочато у Hub.');
    }
    if (parsed.action === 'complete') {
      await this.towerDefenseService.completeDefense(parsed.sourceId, { result: parsed.value === 'lost' ? 'lost' : 'defended' }, auth, now);
      return success('t', parsed, parsed.value === 'lost' ? '🔥 Захист завершено як втрачений.' : '🔥 Захист завершено як успішний.');
    }
    if (parsed.action === 'cancel') {
      await this.towerDefenseService.cancelDefense(parsed.sourceId, { reason: 'Cancelled from Discord orchestration.' }, auth, now);
      return success('t', parsed, '🔥 Захист скасовано у Hub.');
    }
    const defense = await this.towerDefenseService.getDefense(parsed.sourceId, auth);
    return success('t', parsed, towerDetails(defense));
  }

  private async handleEvent(parsed: ParsedCustomId, auth: FamilyAuthContext, now: Date): Promise<DiscordInteractionResponse> {
    if (!this.familyEventService) throw new Error('Family Event service is unavailable.');
    if (parsed.action === 'respond') {
      const response = assertEventResponse(parsed.value);
      await this.familyEventService.respond(parsed.sourceId, {
        response,
        metadata: { source: 'discord' },
      }, auth, now);
      return success('e', parsed, eventResponseMessage(response));
    }
    if (parsed.action === 'withdraw') {
      await this.familyEventService.withdrawResponse(parsed.sourceId, auth, now);
      return success('e', parsed, '📅 Відповідь на подію відкликано.');
    }
    if (parsed.action === 'start') {
      await this.familyEventService.startEvent(parsed.sourceId, auth, now);
      return success('e', parsed, '📅 Подію розпочато у Hub.');
    }
    if (parsed.action === 'complete') {
      await this.familyEventService.completeEvent(parsed.sourceId, auth, now);
      return success('e', parsed, '📅 Подію завершено у Hub.');
    }
    if (parsed.action === 'cancel') {
      await this.familyEventService.cancelEvent(parsed.sourceId, { reason: 'Cancelled from Discord orchestration.' }, auth, now);
      return success('e', parsed, '📅 Подію скасовано у Hub.');
    }
    const event = await this.familyEventService.getEvent(parsed.sourceId, auth);
    return success('e', parsed, `📅 ${event.title}\nУчасники: ${event.participantCount}\nStatus: ${event.status}`);
  }

  private async handleMeCommand(discordUserId: string): Promise<DiscordInteractionResponse> {
    const identity = await this.identityResolver.resolve(discordUserId);
    return commandSuccess('me', [
      '🐉 Discord привʼязано до Dragon House Hub.',
      `Нік: ${identity.familyMember.nickname}`,
      `Роль: ${roleLabel(identity.familyMember)}`,
      `Статус: ${identity.familyMember.status === 'active' ? 'активний' : 'неактивний'}`,
    ].join('\n'));
  }

  private async handleStatusCommand(discordUserId: string): Promise<DiscordInteractionResponse> {
    try {
      const identity = await this.identityResolver.resolve(discordUserId);
      return commandSuccess('status', [
        '🐉 Dragon House Hub',
        'Discord: привʼязано',
        `Member: ${identity.familyMember.nickname}`,
        `Роль: ${roleLabel(identity.familyMember)}`,
        `Orchestration: ${this.config.discord.orchestration.enabled ? 'увімкнено' : 'вимкнено'}`,
      ].join('\n'));
    } catch (error) {
      const friendly = friendlyDiscordError(error);
      return {
        ok: false,
        ephemeral: true,
        action: 'status',
        code: friendly.code,
        content: [
          '🐉 Dragon House Hub',
          'Discord: не привʼязано',
          `Orchestration: ${this.config.discord.orchestration.enabled ? 'увімкнено' : 'вимкнено'}`,
          friendly.content,
        ].join('\n'),
      };
    }
  }

  private async handleQuestCommand(request: DiscordCommandRequest, auth: FamilyAuthContext, now: Date): Promise<DiscordInteractionResponse> {
    if (!this.questService) throw new Error('Quest service is unavailable.');
    const action = stringOption(request, 'action') ?? 'list';
    if (action === 'list') {
      const quests = await this.questService.listQuests({ activeOnly: true }, auth);
      return commandSuccess('quest', renderQuestList(quests.items));
    }
    const questId = requiredOption(request, 'quest_id');
    if (action === 'join') return this.handleQuest({ module: 'q', action: 'join', sourceId: questId }, auth, now);
    if (action === 'help') return this.handleQuest({ module: 'q', action: 'help', sourceId: questId }, auth, now);
    if (action === 'withdraw') return this.handleQuest({ module: 'q', action: 'withdraw', sourceId: questId }, auth, now);
    if (action === 'complete') return this.handleQuest({ module: 'q', action: 'complete', sourceId: questId }, auth, now);
    if (action === 'publish' || action === 'sync') {
      assertCanPublishFromDiscord(auth);
      const result = await this.publishQuest(questId, this.config.discord.channels.questAnnouncements ?? '', auth);
      return commandSuccess('quest', `🐉 ${result.synced ? 'Discord повідомлення оновлено.' : 'Quest опубліковано в Discord.'}`);
    }
    return this.handleQuest({ module: 'q', action: 'details', sourceId: questId }, auth, now);
  }

  private async handleTowerCommand(request: DiscordCommandRequest, auth: FamilyAuthContext, now: Date): Promise<DiscordInteractionResponse> {
    if (!this.towerDefenseService) throw new Error('Tower Defense service is unavailable.');
    const action = stringOption(request, 'action') ?? 'list';
    if (action === 'list') {
      const defenses = await this.towerDefenseService.listDefenses({ status: 'all' }, auth);
      return commandSuccess('tower', renderTowerList(defenses.items));
    }
    const defenseId = requiredOption(request, 'defense_id');
    if (action === 'joining' || action === 'confirmed' || action === 'unavailable') {
      return this.handleTower({ module: 't', action: 'respond', sourceId: defenseId, value: action }, auth, now, requestFromCommand(request));
    }
    if (action === 'withdraw') return this.handleTower({ module: 't', action: 'withdraw', sourceId: defenseId }, auth, now, requestFromCommand(request));
    if (action === 'start') return this.handleTower({ module: 't', action: 'start', sourceId: defenseId }, auth, now, requestFromCommand(request));
    if (action === 'complete_defended') return this.handleTower({ module: 't', action: 'complete', sourceId: defenseId, value: 'defended' }, auth, now, requestFromCommand(request));
    if (action === 'complete_lost') return this.handleTower({ module: 't', action: 'complete', sourceId: defenseId, value: 'lost' }, auth, now, requestFromCommand(request));
    if (action === 'cancel') return this.handleTower({ module: 't', action: 'cancel', sourceId: defenseId }, auth, now, requestFromCommand(request));
    if (action === 'publish' || action === 'sync') {
      assertCanPublishFromDiscord(auth);
      const result = await this.publishTowerDefense(defenseId, this.config.discord.channels.towerGuard ?? '', auth);
      return commandSuccess('tower', `🔥 ${result.synced ? 'Discord повідомлення оновлено.' : 'Захист опубліковано в Discord.'}`);
    }
    return this.handleTower({ module: 't', action: 'details', sourceId: defenseId }, auth, now, requestFromCommand(request));
  }

  private async handleEventCommand(request: DiscordCommandRequest, auth: FamilyAuthContext, now: Date): Promise<DiscordInteractionResponse> {
    if (!this.familyEventService) throw new Error('Family Event service is unavailable.');
    const action = stringOption(request, 'action') ?? 'list';
    if (action === 'list') {
      const events = await this.familyEventService.listEvents({ status: 'all' }, auth);
      return commandSuccess('event', renderEventList(events.items));
    }
    const eventId = requiredOption(request, 'event_id');
    if (action === 'interested' || action === 'joining' || action === 'confirmed' || action === 'declined') {
      return this.handleEvent({ module: 'e', action: 'respond', sourceId: eventId, value: action }, auth, now);
    }
    if (action === 'withdraw') return this.handleEvent({ module: 'e', action: 'withdraw', sourceId: eventId }, auth, now);
    if (action === 'start') return this.handleEvent({ module: 'e', action: 'start', sourceId: eventId }, auth, now);
    if (action === 'complete') return this.handleEvent({ module: 'e', action: 'complete', sourceId: eventId }, auth, now);
    if (action === 'cancel') return this.handleEvent({ module: 'e', action: 'cancel', sourceId: eventId }, auth, now);
    if (action === 'publish' || action === 'sync') {
      assertCanPublishFromDiscord(auth);
      const result = await this.publishFamilyEvent(eventId, this.config.discord.channels.events ?? '', auth);
      return commandSuccess('event', `📅 ${result.synced ? 'Discord повідомлення оновлено.' : 'Подію опубліковано в Discord.'}`);
    }
    return this.handleEvent({ module: 'e', action: 'details', sourceId: eventId }, auth, now);
  }

  private async syncMessage(identity: DiscordMessageIdentity, payload: DiscordMessagePayload, channelLabel: string): Promise<DiscordPublishReadModel> {
    const hash = payloadHash(payload);
    const current = await this.repository.findMessage(identity);
    if (!this.transport) throw new DiscordOrchestrationError('DISCORD_TRANSPORT_UNAVAILABLE', 'Discord transport is unavailable.', 503);

    let sent: { messageId: string };
    let recovered = false;
    if (current?.messageId) {
      try {
        sent = await this.transport.editMessage(identity.channelId, current.messageId, payload);
      } catch {
        recovered = true;
        sent = await this.transport.sendMessage(identity.channelId, payload);
      }
    } else {
      sent = await this.transport.sendMessage(identity.channelId, payload);
    }

    const syncedAt = new Date().toISOString();
    await this.repository.saveMessage({
      ...identity,
      messageId: sent.messageId,
      payloadHash: hash,
      syncedAt,
      externalId: `${identity.sourceModule}:${identity.sourceId}:${identity.messageKind}:${identity.guildId}:${identity.channelId}`,
      metadata: recovered ? { recoveredFromMissingMessage: true, previousMessageId: current?.messageId ?? null } : {},
    });
    return {
      sourceModule: identity.sourceModule,
      sourceId: identity.sourceId,
      state: current ? 'synced' : 'published',
      published: true,
      synced: Boolean(current),
      messageExists: true,
      lastSyncedAt: syncedAt,
      channelLabel,
      error: null,
    };
  }

  private assertGuildAndChannel(guildId: string, channelId: string | null): void {
    if (!this.config.discord.guildId || guildId !== this.config.discord.guildId) {
      throw new Error('DISCORD_GUILD_NOT_ALLOWED');
    }
    if (channelId && !isAllowedChannel(this.config, channelId)) {
      throw new Error('DISCORD_CHANNEL_NOT_ALLOWED');
    }
  }

  private assertConfiguredPublish(channelId: string, channelLabel: string): void {
    if (!this.config.discord.orchestration.enabled) {
      throw new DiscordOrchestrationError('DISCORD_ORCHESTRATION_DISABLED', 'Discord orchestration вимкнена.', 503);
    }
    if (!this.config.discord.guildId) throw new DiscordOrchestrationError('DISCORD_GUILD_NOT_CONFIGURED', 'Discord guild не налаштований.', 400);
    if (!channelId) throw new DiscordOrchestrationError('DISCORD_CHANNEL_NOT_CONFIGURED', `Канал для ${channelLabel} Discord не налаштований.`, 400);
    if (!isAllowedChannel(this.config, channelId)) throw new DiscordOrchestrationError('DISCORD_CHANNEL_NOT_ALLOWED', 'Discord channel is not allowed.', 403);
  }
}

export function parseCustomId(customId: string): ParsedCustomId {
  const [prefix, module, action, sourceId, value] = customId.split(':');
  if (prefix !== 'dh' || !['q', 't', 'e'].includes(module) || !action || !sourceId) {
    throw new Error('Invalid Dragon House Discord custom id.');
  }
  return { module: module as ParsedCustomId['module'], action, sourceId, value };
}

function sourceModuleFor(module: ParsedCustomId['module']): DiscordOrchestrationSourceModule {
  if (module === 'q') return 'family_quests';
  if (module === 't') return 'tower_defense';
  return 'family_events';
}

function success(module: ParsedCustomId['module'], parsed: ParsedCustomId, content: string): DiscordInteractionResponse {
  return { ok: true, ephemeral: true, content, action: parsed.action, sourceModule: sourceModuleFor(module), sourceId: parsed.sourceId };
}

function commandSuccess(action: string, content: string): DiscordInteractionResponse {
  return { ok: true, ephemeral: true, content, action };
}

function assertTowerResponse(value: string | undefined): TowerDefenseResponseStatus {
  if (value === 'joining' || value === 'confirmed' || value === 'unavailable' || value === 'available') return value;
  throw new Error('Invalid tower response.');
}

function assertEventResponse(value: string | undefined) {
  if (value === 'interested' || value === 'joining' || value === 'confirmed' || value === 'declined') return value;
  throw new Error('Invalid event response.');
}

function towerResponseMessage(response: TowerDefenseResponseStatus): string {
  if (response === 'confirmed') return '🔥 Ви підтвердили участь у захисті.';
  if (response === 'joining') return '🔥 Ви відмітили, що йдете на захист.';
  if (response === 'unavailable') return '🔥 Ви відмітили, що не можете прийти.';
  return '🔥 Відповідь на захист оновлено.';
}

function eventResponseMessage(response: string): string {
  if (response === 'confirmed') return '📅 Ви підтвердили участь у події.';
  if (response === 'joining') return '📅 Ви відмітили, що йдете на подію.';
  if (response === 'interested') return '📅 Ви відмітили інтерес до події.';
  return '📅 Ви відмітили, що не можете прийти.';
}

function stringOption(request: DiscordCommandRequest, name: string): string | null {
  const value = request.options[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredOption(request: DiscordCommandRequest, name: string): string {
  const value = stringOption(request, name);
  if (!value) throw new DiscordOrchestrationError('DISCORD_COMMAND_MISSING_OPTION', `Для цієї команди потрібно вказати ${name}.`, 400);
  return value;
}

function requestFromCommand(request: DiscordCommandRequest): DiscordInteractionRequest {
  return {
    interactionId: request.interactionId,
    idempotencyKey: request.idempotencyKey ?? request.interactionId,
    guildId: request.guildId,
    channelId: request.channelId ?? null,
    discordUserId: request.discordUserId,
    customId: `dh:command:${request.subcommand}:manual`,
  };
}

function assertCanPublishFromDiscord(auth: FamilyAuthContext): void {
  if (auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_discord_integration')) return;
  throw new DiscordOrchestrationError('DISCORD_PERMISSION_DENIED', 'Permission denied.', 403);
}

function roleLabel(member: FamilyMember): string {
  if (member.role === 'owner') return 'Голова';
  if (member.role === 'deputy') return 'Зам';
  if (member.rank >= 9) return 'Хранитель полумʼя';
  if (member.rank >= 8) return 'Старші дракони';
  return `Rank ${member.rank}`;
}

function renderQuestList(quests: FamilyQuestDto[]): string {
  const visible = quests.slice(0, 5);
  if (!visible.length) return '🐉 Активних або майбутніх квестів зараз немає.';
  return ['🐉 Активні Family Quests:', ...visible.map((quest) => `• ${quest.title} — ${quest.status}`)].join('\n');
}

function renderTowerList(defenses: TowerDefenseDto[]): string {
  const visible = defenses.filter((defense) => defense.status !== 'completed' && defense.status !== 'cancelled').slice(0, 5);
  if (!visible.length) return '🔥 Активних або майбутніх захистів зараз немає.';
  return ['🔥 Tower Defense:', ...visible.map((defense) => `• ${defense.title} — ${defense.status}`)].join('\n');
}

function renderEventList(events: Array<{ title: string; status: string; startsAt: string }>): string {
  const visible = events.filter((event) => event.status !== 'completed' && event.status !== 'cancelled').slice(0, 5);
  if (!visible.length) return '📅 Майбутніх Family Events зараз немає.';
  return ['📅 Family Events:', ...visible.map((event) => `• ${event.title} — ${formatDate(event.startsAt)} — ${event.status}`)].join('\n');
}

function questDetails(quest: FamilyQuestDto): string {
  return [
    `🐉 ${quest.title}`,
    `Status: ${quest.status}`,
    `Учасники: ${quest.participants.filter((item) => !item.leftAt).length}`,
    `Помічники: ${quest.helpers.filter((item) => !item.leftAt).length}`,
  ].join('\n');
}

function towerDetails(defense: TowerDefenseDto): string {
  return [
    `🔥 ${defense.title}`,
    `Вишка: ${defense.tower.name}`,
    `Status: ${defense.status}`,
    `Підтвердили: ${defense.confirmedCount}`,
    `Готовність: ${defense.presentCount}/${defense.minimumGuardCount}`,
  ].join('\n');
}

function emptyPublishState(sourceModule: DiscordOrchestrationSourceModule, sourceId: string, channelLabel: string): DiscordPublishReadModel {
  return {
    sourceModule,
    sourceId,
    state: 'unpublished',
    published: false,
    synced: false,
    messageExists: false,
    lastSyncedAt: null,
    channelLabel,
    error: null,
  };
}

function toPublishReadModel(sourceModule: DiscordOrchestrationSourceModule, sourceId: string, record: DiscordMessageRecord | null, channelLabel: string): DiscordPublishReadModel {
  if (!record) return emptyPublishState(sourceModule, sourceId, channelLabel);
  return {
    sourceModule,
    sourceId,
    state: 'synced',
    published: true,
    synced: true,
    messageExists: Boolean(record.messageId),
    lastSyncedAt: record.syncedAt,
    channelLabel,
    error: null,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}
