import { createFamilyDiscordSyncClient, type FamilyDiscordSyncClient } from '../../../lib/family-discord-sync-client.ts';
import {
  canApplyPlan,
  createIdempotencyKey,
  filterPlanItems
} from './discord-sync-utils';

export type DragonDiscordSyncService = FamilyDiscordSyncClient & {
  filterPlanItems: typeof filterPlanItems;
  canApplyPlan: typeof canApplyPlan;
  createIdempotencyKey: typeof createIdempotencyKey;
};

export function createDragonDiscordSyncService(client = createFamilyDiscordSyncClient()): DragonDiscordSyncService {
  return {
    ...client,
    filterPlanItems,
    canApplyPlan,
    createIdempotencyKey
  };
}
