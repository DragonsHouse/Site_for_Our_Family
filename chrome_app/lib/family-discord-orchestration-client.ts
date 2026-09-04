import { authenticatedFetch } from './family-backend-auth-client.ts';

export type DiscordPublishState = 'unpublished' | 'published' | 'synced' | 'error';

export type FamilyDiscordPublishState = {
  sourceModule: 'family_quests' | 'tower_defense' | 'family_events';
  sourceId: string;
  state: DiscordPublishState;
  published: boolean;
  synced: boolean;
  messageExists: boolean;
  lastSyncedAt: string | null;
  channelLabel: string | null;
  error: { code: string; message: string } | null;
};

export class FamilyDiscordOrchestrationApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'FamilyDiscordOrchestrationApiError';
  }
}

export async function getQuestDiscordState(questId: string, signal?: AbortSignal): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/discord`, { method: 'GET', signal }));
}

export async function publishQuestToDiscord(questId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/discord/publish`, { method: 'POST' }));
}

export async function syncQuestToDiscord(questId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/discord/sync`, { method: 'POST' }));
}

export async function getTowerDefenseDiscordState(defenseId: string, signal?: AbortSignal): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/discord`, { method: 'GET', signal }));
}

export async function publishTowerDefenseToDiscord(defenseId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/discord/publish`, { method: 'POST' }));
}

export async function syncTowerDefenseToDiscord(defenseId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/discord/sync`, { method: 'POST' }));
}

export async function getFamilyEventDiscordState(eventId: string, signal?: AbortSignal): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/events/${encodeURIComponent(eventId)}/discord`, { method: 'GET', signal }));
}

export async function publishFamilyEventToDiscord(eventId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/events/${encodeURIComponent(eventId)}/discord/publish`, { method: 'POST' }));
}

export async function syncFamilyEventToDiscord(eventId: string): Promise<FamilyDiscordPublishState> {
  return parsePublishState(await authenticatedFetch(`/api/family/events/${encodeURIComponent(eventId)}/discord/sync`, { method: 'POST' }));
}

async function parsePublishState(response: Response): Promise<FamilyDiscordPublishState> {
  const body = await parseJson(response);
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? friendlyDiscordOrchestrationError(body.message, typeof body.code === 'string' ? body.code : null) : `Discord request failed: ${response.status}`;
    throw new FamilyDiscordOrchestrationApiError(message, isRecord(body) && typeof body.code === 'string' ? body.code : 'DISCORD_REQUEST_FAILED', response.status);
  }
  return assertPublishState(body);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function assertPublishState(value: unknown): FamilyDiscordPublishState {
  if (!isRecord(value)) throw malformed();
  const state = value.state;
  if (state !== 'unpublished' && state !== 'published' && state !== 'synced' && state !== 'error') throw malformed();
  const sourceModule = value.sourceModule;
  if (sourceModule !== 'family_quests' && sourceModule !== 'tower_defense' && sourceModule !== 'family_events') throw malformed();
  if (typeof value.sourceId !== 'string') throw malformed();
  return {
    sourceModule,
    sourceId: value.sourceId,
    state,
    published: Boolean(value.published),
    synced: Boolean(value.synced),
    messageExists: Boolean(value.messageExists),
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    channelLabel: typeof value.channelLabel === 'string' ? value.channelLabel : null,
    error: isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'
      ? { code: value.error.code, message: value.error.message }
      : null,
  };
}

function friendlyDiscordOrchestrationError(message: string, code: string | null): string {
  if (code === 'DISCORD_ORCHESTRATION_DISABLED') return 'Discord orchestration вимкнена.';
  if (code === 'DISCORD_CHANNEL_NOT_CONFIGURED') return message || 'Discord канал не налаштований.';
  if (code === 'DISCORD_PERMISSION_DENIED') return 'У вас немає прав для Discord publish/sync.';
  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function malformed(): Error {
  return new Error('Discord orchestration response was malformed.');
}
