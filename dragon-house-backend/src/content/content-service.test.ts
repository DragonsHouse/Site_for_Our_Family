import { describe, expect, it } from 'vitest';
import type { FamilyAuthContext } from '../types.js';
import { MemoryFamilyContentRepository } from './content-repository.js';
import { FamilyContentService } from './content-service.js';
import type { FamilyContentBlockRecord, FamilyNewsPostRecord, FamilyRecruitmentSettingsRecord } from './content-models.js';

const now = '2026-10-07T10:00:00.000Z';

describe('FamilyContentService shared content', () => {
  it('serves shared news posts and lets managers create backend-visible posts', async () => {
    const service = createService();

    const created = await service.createNewsPost({
      type: 'announcement',
      title: 'Спільна новина',
      body: 'Це бачить інший браузер.',
      pinned: true,
      notificationRequired: false,
    }, owner(), new Date(now));

    const secondContext = await service.listNewsPosts({}, member());

    expect(created).toMatchObject({ title: 'Спільна новина', pinned: true, version: 1 });
    expect(secondContext.items.map((post) => post.id)).toContain(created.id);
  });

  it('keeps Home and Rules content backend-versioned with stale update protection', async () => {
    const service = createService();
    const rules = await service.listContentBlocks('rules', member());
    const rule = rules.items[0]!;

    const updated = await service.updateContentBlock(rule.id, {
      title: rule.title,
      body: 'Оновлене shared правило.',
      contact: null,
      expectedVersion: rule.version,
    }, owner(), new Date(now));

    await expect(service.updateContentBlock(rule.id, {
      title: rule.title,
      body: 'Старий overwrite',
      contact: null,
      expectedVersion: rule.version,
    }, owner(), new Date(now))).rejects.toMatchObject({
      code: 'CONTENT_VERSION_CONFLICT',
      httpStatus: 409,
    });

    expect(updated.body).toBe('Оновлене shared правило.');
    expect((await service.listContentBlocks('rules', member())).items[0]?.version).toBe(rule.version + 1);
  });

  it('stores recruitment status, requirements and contact as shared backend settings', async () => {
    const service = createService();
    const current = await service.getRecruitmentSettings(member());

    const updated = await service.updateRecruitmentSettings({
      isOpen: false,
      description: 'Набір тимчасово на паузі.',
      requirements: ['Залишити заявку в Discord', 'Дочекатися співбесіди'],
      contact: 'Anastasia_Dragons',
      expectedVersion: current.version,
    }, owner(), new Date(now));

    expect(updated).toMatchObject({
      isOpen: false,
      description: 'Набір тимчасово на паузі.',
      contact: 'Anastasia_Dragons',
      requirements: ['Залишити заявку в Discord', 'Дочекатися співбесіди'],
      version: current.version + 1,
    });
  });

  it('denies ordinary members from editing shared content', async () => {
    const service = createService();
    const home = (await service.listContentBlocks('home', member())).items[0]!;

    await expect(service.updateContentBlock(home.id, {
      title: home.title,
      body: home.body,
      contact: home.contact,
      expectedVersion: home.version,
    }, member())).rejects.toMatchObject({
      code: 'CONTENT_PERMISSION_DENIED',
    });
  });
});

function createService() {
  return new FamilyContentService(new MemoryFamilyContentRepository(
    [
      block('home-intro', 'home', 10),
      block('family-rule-honor', 'rules', 10),
    ],
    recruitment(),
    [newsPost()],
  ));
}

function block(id: string, scope: 'home' | 'rules', sortOrder: number): FamilyContentBlockRecord {
  return {
    id,
    scope,
    title: id,
    body: 'Shared body',
    contact: null,
    sortOrder,
    version: 1,
    updatedByFamilyMemberId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function recruitment(): FamilyRecruitmentSettingsRecord {
  return {
    id: 'dragon-house',
    isOpen: true,
    description: 'Набір відкритий.',
    requirements: ['Адекватність'],
    contact: 'Dragon House',
    version: 1,
    updatedByFamilyMemberId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function newsPost(): FamilyNewsPostRecord {
  return {
    id: 'post-1',
    type: 'family_news',
    title: 'Seed',
    body: 'Seed body',
    authorFamilyMemberId: null,
    authorName: 'Dragon House',
    pinned: false,
    urgent: false,
    notificationRequired: false,
    archivedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function owner(): FamilyAuthContext {
  return { familyMemberId: 'owner-id', role: 'owner', rank: 10, status: 'active', permissions: [] };
}

function member(): FamilyAuthContext {
  return { familyMemberId: 'member-id', role: 'member', rank: 1, status: 'active', permissions: [] };
}
