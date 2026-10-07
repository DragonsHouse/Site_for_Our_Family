import { describe, expect, it } from 'vitest';
import type { FamilyAuthContext } from '../types.js';
import { MemoryFamilyQuestRepository } from './quest-repository.js';
import { FamilyQuestService } from './quest-service.js';

const managerAuth: FamilyAuthContext = {
  familyMemberId: 'manager-id',
  role: 'member',
  rank: 1,
  status: 'active',
  permissions: ['manage_family_quests'],
};

describe('FamilyQuestService concurrency', () => {
  it('rejects stale quest template edits and allows refetch retry', async () => {
    const service = new FamilyQuestService(new MemoryFamilyQuestRepository());
    const created = await service.createTemplate({
      title: 'Cargo route',
      category: 'logistics',
      description: 'Deliver supplies',
      totalReward: 1000,
      memberRewardPool: 800,
      familyReward: 200,
    }, managerAuth);

    const first = await service.updateTemplate(created.id, { title: 'Cargo route updated', expectedVersion: created.version }, managerAuth);
    expect(first).toMatchObject({ title: 'Cargo route updated', version: created.version + 1 });

    await expect(service.updateTemplate(created.id, { title: 'Stale template edit', expectedVersion: created.version }, managerAuth)).rejects.toMatchObject({
      code: 'QUEST_VERSION_CONFLICT',
    });

    const refetched = (await service.listTemplates(managerAuth)).items.find((template) => template.id === created.id)!;
    const retried = await service.updateTemplate(created.id, { title: 'Retry template edit', expectedVersion: refetched.version }, managerAuth);
    expect(retried).toMatchObject({ title: 'Retry template edit', version: refetched.version + 1 });
  });

  it('rejects stale quest edits and preserves the newer write', async () => {
    const service = new FamilyQuestService(new MemoryFamilyQuestRepository());
    const created = await service.createQuest({
      title: 'Family supply run',
      category: 'logistics',
      status: 'scheduled',
      startsAt: '2026-09-01T10:00:00.000Z',
      totalReward: 2000,
      memberRewardPool: 1500,
      familyReward: 500,
    }, managerAuth);

    const first = await service.updateQuest(created.id, { description: 'First manager save', expectedVersion: created.version }, managerAuth);
    expect(first).toMatchObject({ description: 'First manager save', version: created.version + 1 });

    await expect(service.updateQuest(created.id, { description: 'Stale manager save', expectedVersion: created.version }, managerAuth)).rejects.toMatchObject({
      code: 'QUEST_VERSION_CONFLICT',
    });

    await expect(service.getQuest(created.id, managerAuth)).resolves.toMatchObject({ description: 'First manager save', version: first.version });
  });
});
