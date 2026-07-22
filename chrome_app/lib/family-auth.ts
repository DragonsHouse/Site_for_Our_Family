import {
  DEFAULT_STATS,
  DEMO_FAMILY_USERS,
  FAMILY_ROLE_LABELS,
  ROLE_PERMISSIONS
} from './family-data';
import { addFamilyNotificationOnce } from './family-notifications';
import { ALL_FAMILY_PERMISSIONS } from './family-permissions';
import { getFamilyRank } from './family-ranks';
import { sanitizeFamilyTextDeep } from './text-sanitizer';
import type {
  FamilyPermission,
  FamilyResource,
  FamilyRole,
  FamilyStatus,
  FamilyTask,
  FamilyUser,
  FamilyUserStats,
  PromotionRequirement,
  PromotionRequirements
} from './family-types';

export { FAMILY_RESOURCES, FAMILY_ROLE_LABELS } from './family-data';
export type {
  FamilyPermission,
  FamilyResource,
  FamilyRole,
  FamilyStatus,
  FamilyTask,
  FamilyUser,
  FamilyUserStats,
  PromotionRequirement,
  PromotionRequirements
} from './family-types';

const USERS_KEY = 'dragon_house_family_users_v1';
const USERS_SCHEMA_KEY = 'dragon_house_family_users_schema_version';
const USERS_SCHEMA_VERSION = '2-stable-member-id';

export function createFamilyMemberId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function makeRequirementId(label: string, prefix: 'completed' | 'remaining', index: number) {
  return `${prefix}-${index}-${label
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'requirement'}`;
}

function normalizeRequirement(
  value: unknown,
  prefix: 'completed' | 'remaining',
  index: number
): PromotionRequirement | null {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return null;
    return {
      id: makeRequirementId(label, prefix, index),
      label,
      completed: prefix === 'completed',
      completedAt: null
    };
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<PromotionRequirement>;
  if (typeof record.label !== 'string' || !record.label.trim()) return null;
  return {
    id:
      typeof record.id === 'string' && record.id.trim()
        ? record.id
        : makeRequirementId(record.label, prefix, index),
    label: record.label.trim(),
    completed: typeof record.completed === 'boolean' ? record.completed : prefix === 'completed',
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
    type: record.type,
    currentValue: record.currentValue ?? null,
    requiredValue: record.requiredValue ?? null
  };
}

export function normalizePromotionRequirements(value: unknown): PromotionRequirements {
  const record =
    value && typeof value === 'object'
      ? (value as { completed?: unknown; remaining?: unknown })
      : {};
  const completedSource = Array.isArray(record.completed) ? record.completed : [];
  const remainingSource = Array.isArray(record.remaining) ? record.remaining : [];

  return {
    completed: completedSource
      .map((item, index) => normalizeRequirement(item, 'completed', index))
      .filter((item): item is PromotionRequirement => item !== null)
      .map((item) => ({ ...item, completed: true })),
    remaining: remainingSource
      .map((item, index) => normalizeRequirement(item, 'remaining', index))
      .filter((item): item is PromotionRequirement => item !== null)
      .map((item) => ({ ...item, completed: false }))
  };
}

function normalizeStatus(user: Partial<FamilyUser>): FamilyStatus {
  if (user.status === 'away') return 'away';
  if (user.status === 'online' || user.isOnline) return 'online';
  return 'offline';
}

function normalizeStats(value: unknown): FamilyUserStats {
  const record = value && typeof value === 'object' ? (value as Partial<FamilyUserStats>) : {};
  return {
    ...DEFAULT_STATS,
    ...Object.fromEntries(
      Object.entries(record).filter(([, item]) => typeof item === 'number' && Number.isFinite(item))
    )
  };
}

function normalizeTasks(value: unknown, fallback: FamilyTask[]): FamilyTask[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is FamilyTask => {
    if (!item || typeof item !== 'object') return false;
    const task = item as Partial<FamilyTask>;
    return typeof task.id === 'string' && typeof task.title === 'string';
  });
}

function normalizePermissions(value: unknown, role: FamilyRole): FamilyPermission[] {
  if (role === 'owner') return ROLE_PERMISSIONS.owner;
  if (!Array.isArray(value)) return ROLE_PERMISSIONS[role];
  const known = new Set(ALL_FAMILY_PERMISSIONS);
  const permissions = value.filter(
    (item): item is FamilyPermission => typeof item === 'string' && known.has(item as FamilyPermission)
  );
  return permissions;
}

function normalizeRole(value: unknown, fallback: FamilyRole): FamilyRole {
  if (value === 'elder' || value === 'recruit' || value === 'guest') return 'member';
  return typeof value === 'string' && value in FAMILY_ROLE_LABELS ? (value as FamilyRole) : fallback;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' || value === null ? value : null;
}

function normalizeDiscordLinkStatus(value: unknown, userId: string | null) {
  if (value === 'pending' || value === 'linked' || value === 'error' || value === 'not_linked') {
    return value;
  }
  return userId ? 'linked' : 'not_linked';
}

function normalizeUser(user: Partial<FamilyUser>, fallback: FamilyUser): FamilyUser {
  const status = normalizeStatus(user);
  const role = fallback.nickname === 'Anastasia_Dragons' ? 'owner' : normalizeRole(user.role, fallback.role);
  const rankLevel =
    typeof user.rankLevel === 'number' && Number.isFinite(user.rankLevel)
      ? user.rankLevel
      : fallback.rankLevel;
  const familyRank = getFamilyRank(rankLevel);
  return {
    ...fallback,
    ...user,
    id: typeof user.id === 'string' && user.id.trim() ? user.id : fallback.id,
    nickname: fallback.nickname,
    staticId: fallback.staticId,
    role,
    rank: familyRank.title,
    rankLevel,
    nextRank:
      typeof user.nextRank === 'string' || user.nextRank === null
        ? user.nextRank
        : fallback.nextRank,
    promotionProgress:
      typeof user.promotionProgress === 'number'
        ? user.promotionProgress
        : fallback.promotionProgress,
    promotionRequirements: normalizePromotionRequirements(
      user.promotionRequirements ?? fallback.promotionRequirements
    ),
    displayName:
      typeof user.displayName === 'string' && user.displayName.trim()
        ? user.displayName
        : fallback.displayName,
    avatarUrl:
      typeof user.avatarUrl === 'string'
        ? user.avatarUrl
        : user.avatarUrl === null
          ? null
          : fallback.avatarUrl,
    avatarDataUrl:
      typeof user.avatarDataUrl === 'string'
        ? user.avatarDataUrl
        : user.avatarDataUrl === null
          ? null
          : fallback.avatarDataUrl,
    status,
    accountStatus: user.accountStatus === 'inactive' ? 'inactive' : 'active',
    statusMessage:
      typeof user.statusMessage === 'string' || user.statusMessage === null
        ? user.statusMessage
        : fallback.statusMessage,
    promotionUpdatedAt:
      typeof user.promotionUpdatedAt === 'string' || user.promotionUpdatedAt === null
        ? user.promotionUpdatedAt
        : fallback.promotionUpdatedAt,
    joinedAt:
      typeof user.joinedAt === 'string' || user.joinedAt === null ? user.joinedAt : fallback.joinedAt,
    notes: typeof user.notes === 'string' || user.notes === null ? user.notes : fallback.notes,
    permissions: normalizePermissions(user.permissions, role),
    stats: normalizeStats(user.stats ?? fallback.stats),
    tasks: normalizeTasks(user.tasks, fallback.tasks),
    isOnline: status === 'online',
    deletedAt: typeof user.deletedAt === 'string' || user.deletedAt === null ? user.deletedAt : null,
    discordUserId: normalizeNullableString(user.discordUserId),
    discordUsername: normalizeNullableString(user.discordUsername),
    discordDisplayName: normalizeNullableString(user.discordDisplayName),
    discordAvatarUrl: normalizeNullableString(user.discordAvatarUrl),
    discordLinkedAt: normalizeNullableString(user.discordLinkedAt),
    discordSyncedAt: normalizeNullableString(user.discordSyncedAt),
    discordLinkStatus: normalizeDiscordLinkStatus(user.discordLinkStatus, normalizeNullableString(user.discordUserId)),
    externalSource: user.externalSource ?? 'family_hub',
    externalId: normalizeNullableString(user.externalId),
    externalRevision: normalizeNullableString(user.externalRevision),
    externalCreatedAt: normalizeNullableString(user.externalCreatedAt),
    externalUpdatedAt: normalizeNullableString(user.externalUpdatedAt),
    lastSyncedAt: normalizeNullableString(user.lastSyncedAt),
    syncStatus: user.syncStatus ?? 'local_only',
    syncError: normalizeNullableString(user.syncError)
  };
}

function mergeDemoUsers(users: FamilyUser[]): FamilyUser[] {
  let changed = false;
  const nextUsers: FamilyUser[] = [];
  const seenDemoNicknames = new Set<string>();

  for (const user of users) {
    const normalizedNickname = user.nickname.toLowerCase();
    const demoUser = DEMO_FAMILY_USERS.find(
      (item) => item.nickname.toLowerCase() === normalizedNickname
    );

    if (!demoUser) {
      const role = normalizeRole(user.role, 'member');
      const rankLevel =
        typeof user.rankLevel === 'number' && Number.isFinite(user.rankLevel) ? user.rankLevel : 1;
      nextUsers.push({
        ...user,
        id: typeof user.id === 'string' && user.id.trim() ? user.id : createFamilyMemberId(),
        role,
        rank: getFamilyRank(rankLevel).title,
        rankLevel,
        promotionRequirements: normalizePromotionRequirements(user.promotionRequirements),
        status: normalizeStatus(user),
        accountStatus: user.accountStatus === 'inactive' ? 'inactive' : 'active',
        stats: normalizeStats(user.stats),
        tasks: normalizeTasks(user.tasks, []),
        permissions: normalizePermissions(user.permissions, role),
        deletedAt: typeof user.deletedAt === 'string' || user.deletedAt === null ? user.deletedAt : null,
        discordUserId: normalizeNullableString(user.discordUserId),
        discordUsername: normalizeNullableString(user.discordUsername),
        discordDisplayName: normalizeNullableString(user.discordDisplayName),
        discordAvatarUrl: normalizeNullableString(user.discordAvatarUrl),
        discordLinkedAt: normalizeNullableString(user.discordLinkedAt),
        discordSyncedAt: normalizeNullableString(user.discordSyncedAt),
        discordLinkStatus: normalizeDiscordLinkStatus(
          user.discordLinkStatus,
          normalizeNullableString(user.discordUserId)
        ),
        externalSource: user.externalSource ?? 'family_hub',
        externalId: normalizeNullableString(user.externalId),
        externalRevision: normalizeNullableString(user.externalRevision),
        externalCreatedAt: normalizeNullableString(user.externalCreatedAt),
        externalUpdatedAt: normalizeNullableString(user.externalUpdatedAt),
        lastSyncedAt: normalizeNullableString(user.lastSyncedAt),
        syncStatus: user.syncStatus ?? 'local_only',
        syncError: normalizeNullableString(user.syncError)
      });
      continue;
    }

    if (seenDemoNicknames.has(normalizedNickname)) {
      changed = true;
      continue;
    }

    seenDemoNicknames.add(normalizedNickname);
    const hasPersonalPassword = Boolean(user.passwordHash);
    const normalizedUser = normalizeUser(user, demoUser);
    const nextUser: FamilyUser = {
      ...normalizedUser,
      passwordHash: user.passwordHash ?? demoUser.passwordHash,
      mustChangePassword: hasPersonalPassword
        ? (user.mustChangePassword ?? demoUser.mustChangePassword)
        : true
    };

    if (JSON.stringify(nextUser) !== JSON.stringify(user)) {
      changed = true;
    }

    nextUsers.push(nextUser);
  }

  for (const demoUser of DEMO_FAMILY_USERS) {
    if (!seenDemoNicknames.has(demoUser.nickname.toLowerCase())) {
      nextUsers.push(demoUser);
      changed = true;
    }
  }

  if (changed) {
    writeUsers(nextUsers);
  }

  return nextUsers;
}

function readUsers(): FamilyUser[] {
  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) {
    const seed = sanitizeFamilyTextDeep(DEMO_FAMILY_USERS);
    writeUsers(seed);
    return seed;
  }

  try {
    const parsed = sanitizeFamilyTextDeep(JSON.parse(raw) as unknown);
    if (!Array.isArray(parsed)) {
      writeUsers(DEMO_FAMILY_USERS);
      return DEMO_FAMILY_USERS;
    }
    return mergeDemoUsers(parsed as FamilyUser[]);
  } catch {
    writeUsers(DEMO_FAMILY_USERS);
    return DEMO_FAMILY_USERS;
  }
}

function writeUsers(users: FamilyUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(sanitizeFamilyTextDeep(users)));
  window.localStorage.setItem(USERS_SCHEMA_KEY, USERS_SCHEMA_VERSION);
}

export function getFamilyUsers(): FamilyUser[] {
  return readUsers();
}

export function updateFamilyUserAvatar(nickname: string, avatarDataUrl: string | null): FamilyUser {
  const users = readUsers();
  const user = users.find((item) => item.nickname === nickname);
  if (!user) {
    throw new Error('User not found');
  }

  const nextUser: FamilyUser = {
    ...user,
    avatarUrl: avatarDataUrl,
    avatarDataUrl,
    lastActive: new Date().toISOString()
  };
  writeUsers(users.map((item) => (item.nickname === nickname ? nextUser : item)));
  return nextUser;
}

function updateFamilyUserAccess(
  nickname: string,
  updates: {
    role: FamilyRole;
    rank: string;
    rankLevel: number;
    permissions: FamilyPermission[];
  }
): FamilyUser {
  const users = readUsers();
  const user = users.find((item) => item.nickname === nickname);
  if (!user) {
    throw new Error('User not found');
  }

  const role = nickname === 'Anastasia_Dragons' ? 'owner' : updates.role;
  const previousPermissions = normalizePermissions(user.permissions, user.role);
  const nextPermissions = normalizePermissions(updates.permissions, role);
  const changedAt = new Date().toISOString();
  const nextUser: FamilyUser = {
    ...user,
    role,
    rank: updates.rank,
    rankLevel: updates.rankLevel,
    permissions: nextPermissions,
    promotionUpdatedAt: changedAt
  };

  writeUsers(users.map((item) => (item.nickname === nickname ? nextUser : item)));

  if (user.rank !== nextUser.rank || user.rankLevel !== nextUser.rankLevel) {
    void addFamilyNotificationOnce({
      eventKey: `rank-changed:${user.id}:${changedAt}`,
      userId: user.id,
      staticId: user.staticId,
      type: 'rank_changed',
      title: 'Ранг змінено',
      message: `Тобі змінено ранг на "${nextUser.rank}"`,
      createdAt: changedAt,
      relatedEntityType: 'member',
      relatedEntityId: user.id
    });
  }

  if (user.role !== nextUser.role) {
    void addFamilyNotificationOnce({
      eventKey: `role-changed:${user.id}:${changedAt}`,
      userId: user.id,
      staticId: user.staticId,
      type: nextUser.role === 'moderator' ? 'moderator_assigned' : 'role_changed',
      title: nextUser.role === 'moderator' ? 'Тебе призначено модератором' : 'Роль змінено',
      message:
        nextUser.role === 'moderator'
          ? 'Тебе призначено модератором Dragon House'
          : `Тобі змінено роль на "${FAMILY_ROLE_LABELS[nextUser.role]}"`,
      createdAt: changedAt,
      relatedEntityType: 'member',
      relatedEntityId: user.id
    });
  }

  const previousPermissionSet = new Set(previousPermissions);
  const nextPermissionSet = new Set(nextPermissions);
  for (const permission of nextPermissions) {
    if (!previousPermissionSet.has(permission)) {
      void addFamilyNotificationOnce({
        eventKey: `permission-granted:${user.id}:${permission}:${changedAt}`,
        userId: user.id,
        staticId: user.staticId,
        type: 'permission_granted',
        title: 'Новий доступ',
        message: `Тобі видано новий permission: ${permission}`,
        createdAt: changedAt,
        relatedEntityType: 'member',
        relatedEntityId: user.id
      });
    }
  }
  for (const permission of previousPermissions) {
    if (!nextPermissionSet.has(permission)) {
      void addFamilyNotificationOnce({
        eventKey: `permission-revoked:${user.id}:${permission}:${changedAt}`,
        userId: user.id,
        staticId: user.staticId,
        type: 'permission_revoked',
        title: 'Доступ змінено',
        message: `У тебе забрано permission: ${permission}`,
        createdAt: changedAt,
        relatedEntityType: 'member',
        relatedEntityId: user.id
      });
    }
  }

  return nextUser;
}

export async function createFamilyUser(input: {
  nickname: string;
  staticId: string;
  rankLevel: number;
  role: FamilyRole;
  joinedAt: string | null;
  accountStatus: 'active' | 'inactive';
  avatarDataUrl?: string | null;
  permissions?: FamilyPermission[];
  notes?: string | null;
  discordUserId?: string | null;
  discordUsername?: string | null;
}): Promise<FamilyUser> {
  const users = readUsers();
  const nickname = input.nickname.trim();
  const staticId = input.staticId.trim();
  if (!nickname) throw new Error('Nickname is required');
  if (!staticId) throw new Error('Static ID is required');
  if (users.some((user) => user.nickname.toLowerCase() === nickname.toLowerCase())) {
    throw new Error('Nickname must be unique');
  }
  if (users.some((user) => user.staticId === staticId)) {
    throw new Error('Static ID must be unique');
  }

  const now = new Date().toISOString();
  const role = normalizeRole(input.role, 'member');
  const rank = getFamilyRank(input.rankLevel);
  const user: FamilyUser = {
    id: createFamilyMemberId(),
    nickname,
    staticId,
    passwordHash: null,
    mustChangePassword: true,
    role,
    rank: rank.title,
    rankLevel: rank.level,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: nickname,
    avatarUrl: input.avatarDataUrl ?? null,
    avatarDataUrl: input.avatarDataUrl ?? null,
    status: 'offline',
    accountStatus: input.accountStatus,
    statusMessage: null,
    nextRank: rank.level < 10 ? getFamilyRank(rank.level + 1).title : null,
    promotionUpdatedAt: now,
    joinedAt: input.joinedAt,
    notes: input.notes?.trim() || null,
    permissions: normalizePermissions(input.permissions, role),
    stats: { ...DEFAULT_STATS },
    tasks: [],
    deletedAt: input.accountStatus === 'inactive' ? now : null,
    discordUserId: input.discordUserId?.trim() || null,
    discordUsername: input.discordUsername?.trim() || null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinkedAt: null,
    discordSyncedAt: null,
    discordLinkStatus: input.discordUserId?.trim() ? 'linked' : 'not_linked',
    externalSource: 'family_hub',
    externalId: null,
    externalRevision: null,
    externalCreatedAt: now,
    externalUpdatedAt: now,
    lastSyncedAt: null,
    syncStatus: 'local_only',
    syncError: null
  };
  writeUsers([user, ...users]);
  return user;
}

export async function updateFamilyUserProfile(
  originalNickname: string,
  updates: {
    nickname: string;
    staticId: string;
    rankLevel: number;
    role: FamilyRole;
    joinedAt: string | null;
    accountStatus: 'active' | 'inactive';
    avatarDataUrl?: string | null;
    permissions: FamilyPermission[];
    notes?: string | null;
    discordUserId?: string | null;
    discordUsername?: string | null;
  }
): Promise<FamilyUser> {
  const users = readUsers();
  const user = users.find((item) => item.nickname === originalNickname);
  if (!user) throw new Error('User not found');
  const nickname = updates.nickname.trim();
  const staticId = updates.staticId.trim();
  if (!nickname) throw new Error('Nickname is required');
  if (!staticId) throw new Error('Static ID is required');
  if (
    users.some(
      (item) => item.nickname !== originalNickname && item.nickname.toLowerCase() === nickname.toLowerCase()
    )
  ) {
    throw new Error('Nickname must be unique');
  }
  if (users.some((item) => item.nickname !== originalNickname && item.staticId === staticId)) {
    throw new Error('Static ID must be unique');
  }

  const role = originalNickname === 'Anastasia_Dragons' ? 'owner' : normalizeRole(updates.role, 'member');
  const rank = getFamilyRank(updates.rankLevel);
  const staticIdChanged = user.staticId !== staticId;
  const now = new Date().toISOString();
  const nextUser: FamilyUser = {
    ...user,
    id: user.id,
    nickname: originalNickname === 'Anastasia_Dragons' ? 'Anastasia_Dragons' : nickname,
    staticId,
    passwordHash: user.passwordHash,
    role,
    rank: rank.title,
    rankLevel: rank.level,
    permissions: normalizePermissions(updates.permissions, role),
    joinedAt: updates.joinedAt,
    accountStatus: originalNickname === 'Anastasia_Dragons' ? 'active' : updates.accountStatus,
    deletedAt:
      originalNickname === 'Anastasia_Dragons'
        ? null
        : updates.accountStatus === 'inactive'
          ? user.deletedAt ?? now
          : null,
    isOnline: updates.accountStatus === 'active' ? user.isOnline : false,
    status: updates.accountStatus === 'active' ? user.status : 'offline',
    displayName: originalNickname === 'Anastasia_Dragons' ? 'Anastasia_Dragons' : nickname,
    avatarUrl: updates.avatarDataUrl ?? user.avatarUrl,
    avatarDataUrl: updates.avatarDataUrl ?? user.avatarDataUrl,
    notes: updates.notes?.trim() || null,
    discordUserId: updates.discordUserId?.trim() || null,
    discordUsername: updates.discordUsername?.trim() || null,
    discordDisplayName: user.discordDisplayName ?? null,
    discordAvatarUrl: user.discordAvatarUrl ?? null,
    discordLinkedAt: user.discordLinkedAt ?? null,
    discordSyncedAt: user.discordSyncedAt ?? null,
    discordLinkStatus: updates.discordUserId?.trim()
      ? user.discordLinkStatus === 'pending'
        ? 'pending'
        : 'linked'
      : 'not_linked',
    externalUpdatedAt: now,
    promotionUpdatedAt: now
  };
  writeUsers(users.map((item) => (item.nickname === originalNickname ? nextUser : item)));
  return nextUser;
}

export function deactivateFamilyUser(nickname: string): FamilyUser {
  if (nickname === 'Anastasia_Dragons') {
    throw new Error('Protected owner cannot be deactivated');
  }
  const users = readUsers();
  const user = users.find((item) => item.nickname === nickname);
  if (!user) throw new Error('User not found');
  const nextUser: FamilyUser = {
    ...user,
    accountStatus: 'inactive',
    isOnline: false,
    status: 'offline',
    deletedAt: new Date().toISOString()
  };
  writeUsers(users.map((item) => (item.nickname === nickname ? nextUser : item)));
  return nextUser;
}

export function roleLabel(role: FamilyRole) {
  return FAMILY_ROLE_LABELS[role];
}
