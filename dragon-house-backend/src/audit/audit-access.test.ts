import { describe, expect, it } from 'vitest';
import { TEST_ACTORS, type TestActor } from '../test/actor-sessions.js';
import type { FamilyAuthContext } from '../types.js';
import { auditScopePredicate, canViewPrivateMemberAuditFields, redactAuditPayload, resolveAuditScope } from './audit-access.js';

const auth = (actor: TestActor): FamilyAuthContext => ({ familyMemberId: actor.id, role: actor.role, rank: actor.rank, status: 'active', permissions: actor.permissions });

describe('audit log domain scope', () => {
  it('gives owners every domain, including unknown future entity types', () => {
    expect(resolveAuditScope(auth(TEST_ACTORS.owner))).toEqual({ kind: 'all' });
    const values: unknown[] = [];
    expect(auditScopePredicate({ kind: 'all' }, values)).toBeNull();
    expect(values).toEqual([]);
  });

  it('limits a deputy to the domains their permissions manage', () => {
    expect(resolveAuditScope(auth(TEST_ACTORS.deputy))).toEqual({ kind: 'scoped', entityTypes: ['family_tower', 'family_treasury_entry'], discordSyncMemberActions: false });
  });

  it('limits a single-domain manager to that domain only', () => {
    expect(resolveAuditScope(auth(TEST_ACTORS.mapManager))).toEqual({ kind: 'scoped', entityTypes: ['family_map_state'], discordSyncMemberActions: false });
    expect(resolveAuditScope(auth(TEST_ACTORS.memberManager))).toEqual({ kind: 'scoped', entityTypes: ['family_member'], discordSyncMemberActions: false });
    expect(resolveAuditScope(auth(TEST_ACTORS.questManager))).toEqual({ kind: 'scoped', entityTypes: ['family_tower'], discordSyncMemberActions: false });
  });

  it('lets Discord integration managers follow only member-sync history', () => {
    const scope = resolveAuditScope(auth(TEST_ACTORS.discordManager));
    expect(scope).toEqual({ kind: 'scoped', entityTypes: [], discordSyncMemberActions: true });
    const values: unknown[] = [];
    expect(auditScopePredicate(scope, values)).toBe("((a.entity_type = 'family_member' and a.action like $1))");
    expect(values).toEqual(['discord_sync_%']);
  });

  it('denies members and roles without a managed audit domain', () => {
    expect(resolveAuditScope(auth(TEST_ACTORS.member))).toEqual({ kind: 'none' });
    expect(resolveAuditScope(auth(TEST_ACTORS.accountingManager))).toEqual({ kind: 'none' });
    expect(resolveAuditScope({ ...auth(TEST_ACTORS.member), role: 'deputy' })).toEqual({ kind: 'none' });
    const values: unknown[] = [];
    expect(auditScopePredicate({ kind: 'none' }, values)).toBe('false');
  });

  it('builds a parameterised predicate without interpolating values', () => {
    const values: unknown[] = ['existing'];
    const predicate = auditScopePredicate(resolveAuditScope(auth(TEST_ACTORS.deputy)), values);
    expect(predicate).toBe('(a.entity_type = any($2::text[]))');
    expect(values).toEqual(['existing', ['family_tower', 'family_treasury_entry']]);
  });
});

describe('audit payload redaction', () => {
  const legacyMemberSnapshot = {
    id: 'member-1',
    nickname: 'Visible_Name',
    role: 'member',
    rank: 3,
    dateOfBirth: '1990-05-10',
    date_of_birth: '1990-05-10',
    notes: 'private note',
    profileMetadata: { phone: 'secret' },
    onboarding_metadata: { step: 2 },
    discord: { discordUserId: '123456789012345678', discordUsername: 'user' },
    discordUserId: '123456789012345678',
    passwordHash: '$2a$12$abc',
    nested: [{ sessionToken: 'tok', Authorization: 'Bearer x', notes: 'nested note', kept: true }],
  };

  it('removes private member details and secrets for ordinary viewers, including legacy snake_case rows', () => {
    expect(redactAuditPayload(legacyMemberSnapshot, { includePrivateMemberFields: false })).toEqual({
      id: 'member-1',
      nickname: 'Visible_Name',
      role: 'member',
      rank: 3,
      nested: [{ kept: true }],
    });
  });

  it('keeps private member fields for authorised viewers but never returns secrets', () => {
    const redacted = redactAuditPayload(legacyMemberSnapshot, { includePrivateMemberFields: true }) as Record<string, unknown>;
    expect(redacted).toMatchObject({ dateOfBirth: '1990-05-10', notes: 'private note', discordUserId: '123456789012345678' });
    expect(JSON.stringify(redacted)).not.toMatch(/passwordHash|sessionToken|Authorization|\$2a\$/u);
  });

  it('passes through scalars and nulls and bounds recursion depth', () => {
    expect(redactAuditPayload(null, { includePrivateMemberFields: false })).toBeNull();
    expect(redactAuditPayload('text', { includePrivateMemberFields: false })).toBe('text');
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i += 1) deep = { next: deep };
    expect(JSON.stringify(redactAuditPayload(deep, { includePrivateMemberFields: false }))).toContain('[redacted]');
  });

  it('grants private member fields only to owners and explicit private-field viewers', () => {
    expect(canViewPrivateMemberAuditFields(auth(TEST_ACTORS.owner))).toBe(true);
    expect(canViewPrivateMemberAuditFields(auth(TEST_ACTORS.privateViewer))).toBe(true);
    for (const actor of [TEST_ACTORS.deputy, TEST_ACTORS.memberManager, TEST_ACTORS.mapManager, TEST_ACTORS.member]) {
      expect(canViewPrivateMemberAuditFields(auth(actor)), actor.id).toBe(false);
    }
  });
});
