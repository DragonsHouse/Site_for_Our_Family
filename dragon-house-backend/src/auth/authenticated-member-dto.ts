import type { FamilyAuthUser, FamilyMember, FamilyMemberStatus, FamilyPermission, FamilyRole, FamilySession } from '../types.js';

/**
 * Birthday onboarding became mandatory for members created after this rollout.
 *
 * The database intentionally stores only `date_of_birth`; there is no persisted
 * `birthday_required` flag because that would duplicate state. Existing members
 * created before this cutoff keep legacy Hub access and receive a profile
 * completion prompt, while members created on/after the cutoff must provide a
 * birthday before onboarding can complete.
 *
 * Migration version alone cannot derive this at runtime: environments can apply
 * the migration at different times, and existing rows are not stamped with the
 * migration that first observed them. This cutoff can be removed later when all
 * pre-rollout members have completed birthdays or if a formal onboarding version
 * field is introduced.
 */
const BIRTHDAY_ONBOARDING_CUTOFF_ISO = '2026-07-27T00:00:00.000Z';
const BIRTHDAY_ONBOARDING_CUTOFF = Date.parse(BIRTHDAY_ONBOARDING_CUTOFF_ISO);

export type MemberOnboardingState =
  | 'complete'
  | 'static_id_required'
  | 'birthday_required'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'account_deactivated';

export type MemberOnboardingStatus = {
  complete: boolean;
  state: MemberOnboardingState;
  requirements: {
    staticId: {
      satisfied: boolean;
      value?: string;
    };
    discordLink: {
      satisfied: boolean;
    };
    inGameNickname: {
      satisfied: boolean;
    };
    birthday: {
      satisfied: boolean;
      required: boolean;
    };
  };
};

export type MemberProfileCompletionStatus = {
  complete: boolean;
  state: 'complete' | 'birthday_required';
  legacyAccessAllowed: boolean;
  requirements: {
    birthday: {
      satisfied: boolean;
      required: boolean;
    };
  };
};

export type AuthenticatedMemberDto = {
  memberId: string;
  nickname: string;
  displayName: string;
  staticId: string | null;
  role: FamilyRole;
  rank: number;
  status: FamilyMemberStatus;
  permissions: FamilyPermission[];
  discord: {
    linked: boolean;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    serverNickname: string | null;
    avatar: string | null;
    guildId: string | null;
    lastSyncedAt: string | null;
  };
  session: {
    loginProvider: FamilySession['loginProvider'];
    expiresAt: string;
    lastUsedAt: string | null;
    mustChangePassword: boolean;
  };
  onboarding: MemberOnboardingStatus;
  profileCompletion: MemberProfileCompletionStatus;
};

export function createAuthenticatedMemberDto(
  member: FamilyMember,
  session: Pick<FamilySession, 'loginProvider' | 'expiresAt' | 'lastUsedAt'>,
  authUser: Pick<FamilyAuthUser, 'mustChangePassword'>,
): AuthenticatedMemberDto {
  const discordLinked = member.discord?.linked === true && Boolean(member.discord.discordUserId);
  const onboarding = createMemberOnboardingStatus(member, discordLinked);
  const profileCompletion = createMemberProfileCompletionStatus(member);
  return {
    memberId: member.id,
    nickname: member.nickname,
    displayName: displayName(member),
    staticId: member.staticId,
    role: member.role,
    rank: member.rank,
    status: member.status,
    permissions: member.permissions,
    discord: {
      linked: discordLinked,
      userId: member.discord?.discordUserId ?? null,
      username: member.discord?.discordUsername ?? null,
      displayName: discordDisplayName(member),
      serverNickname: member.discord?.discordServerNickname?.trim() || null,
      avatar: member.discord?.discordAvatar ?? null,
      guildId: member.discord?.guildId ?? null,
      lastSyncedAt: member.discord?.lastSyncedAt ?? null,
    },
    session: {
      loginProvider: session.loginProvider,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      mustChangePassword: authUser.mustChangePassword,
    },
    onboarding,
    profileCompletion,
  };
}

export function createMemberOnboardingStatus(member: FamilyMember, discordLinked = member.discord?.linked === true && Boolean(member.discord.discordUserId)): MemberOnboardingStatus {
  const staticId = member.staticId?.trim() || null;
  const staticIdSatisfied = Boolean(staticId);
  const inGameNicknameSatisfied = Boolean(member.nickname?.trim());
  const birthdayRequired = isBirthdayRequiredForOnboarding(member);
  const birthdaySatisfied = !birthdayRequired || isDateOnly(member.dateOfBirth);
  let state: MemberOnboardingState = 'complete';

  if (member.status !== 'active' || member.deletedAt) state = 'account_deactivated';
  else if (!discordLinked) state = 'discord_link_required';
  else if (!staticIdSatisfied) state = 'static_id_required';
  else if (!inGameNicknameSatisfied) state = 'member_access_denied';
  else if (!birthdaySatisfied) state = 'birthday_required';

  return {
    complete: state === 'complete',
    state,
    requirements: {
      staticId: {
        satisfied: staticIdSatisfied,
        ...(staticId ? { value: staticId } : {}),
      },
      discordLink: {
        satisfied: discordLinked,
      },
      inGameNickname: {
        satisfied: inGameNicknameSatisfied,
      },
      birthday: {
        satisfied: birthdaySatisfied,
        required: birthdayRequired,
      },
    },
  };
}

export function createMemberProfileCompletionStatus(member: FamilyMember): MemberProfileCompletionStatus {
  const birthdaySatisfied = isDateOnly(member.dateOfBirth);
  const birthdayRequired = true;
  const legacyAccessAllowed = !birthdaySatisfied && !isBirthdayRequiredForOnboarding(member);
  const state = birthdaySatisfied ? 'complete' : 'birthday_required';

  return {
    complete: state === 'complete',
    state,
    legacyAccessAllowed,
    requirements: {
      birthday: {
        satisfied: birthdaySatisfied,
        required: birthdayRequired,
      },
    },
  };
}

function displayName(member: FamilyMember): string {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || member.nickname;
}

function discordDisplayName(member: FamilyMember): string | null {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || (member.discord?.discordUsername ?? null);
}

function isDateOnly(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function isBirthdayRequiredForOnboarding(member: FamilyMember): boolean {
  const createdAt = Date.parse(member.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  return createdAt >= BIRTHDAY_ONBOARDING_CUTOFF;
}
