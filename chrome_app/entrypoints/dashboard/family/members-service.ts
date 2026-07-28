import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';
import { DRAGON_MEMBERS_MOCK_DATA } from './members-mock-data';
import {
  DRAGON_MEMBER_ROLE_META,
  DRAGON_MEMBER_STATUS_META,
  type DragonMember,
  type DragonMemberRole,
  type DragonMembersFilters,
  type DragonMemberStatus
} from './members-models';

export type DragonMemberCreateInput = Omit<DragonMember, 'id'>;
export type DragonMemberUpdateInput = Partial<DragonMember>;

export type DragonMembersRepository = Repository<
  DragonMember,
  DragonMemberCreateInput,
  DragonMemberUpdateInput,
  DragonMembersFilters
>;

export const mockDragonMembersRepository: DragonMembersRepository = createMockRepository<
  DragonMember,
  DragonMemberCreateInput,
  DragonMemberUpdateInput,
  DragonMembersFilters
>(DRAGON_MEMBERS_MOCK_DATA, (input) => ({
  id: globalThis.crypto?.randomUUID?.() ?? `member-${Date.now()}`,
  ...input
}));

export type DragonMembersStats = {
  totalMembers: number;
  onlineMembers: number;
  inVoiceMembers: number;
  birthdayMembers: number;
  roleCounts: Record<DragonMemberRole, number>;
  statusCounts: Record<DragonMemberStatus, number>;
};

export function getDragonMemberInitials(member: DragonMember) {
  return member.discordNickname
    .split(/[_\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function formatDragonMemberDate(date: string) {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

export function formatDragonMemberBirthday(date?: string) {
  if (!date) {
    return 'Hidden';
  }

  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'long' }).format(new Date(`${date}T00:00:00`));
}

export function filterDragonMembers(members: DragonMember[], filters: DragonMembersFilters) {
  const search = filters.search.trim().toLowerCase();

  return members
    .filter((member) => {
      const roleMeta = DRAGON_MEMBER_ROLE_META[member.role];
      const matchesSearch =
        !search ||
        member.discordNickname.toLowerCase().includes(search) ||
        member.rank.toLowerCase().includes(search) ||
        roleMeta.label.toLowerCase().includes(search) ||
        member.dragonTitle.toLowerCase().includes(search);
      const matchesRole = filters.role === 'all' || member.role === filters.role;
      const matchesStatus = filters.status === 'all' || member.status === filters.status;
      const matchesJoinYear = !filters.joinYear || member.joinedAt.startsWith(filters.joinYear);
      const matchesBirthdayMonth = !filters.birthdayMonth || member.birthday?.slice(5, 7) === filters.birthdayMonth;

      return matchesSearch && matchesRole && matchesStatus && matchesJoinYear && matchesBirthdayMonth;
    })
    .sort((left, right) => compareDragonMembers(left, right, filters));
}

export function getDragonMembersStats(members: DragonMember[]): DragonMembersStats {
  const roleCounts = createRoleCounts();
  const statusCounts = createStatusCounts();

  members.forEach((member) => {
    roleCounts[member.role] += 1;
    statusCounts[member.status] += 1;
  });

  return {
    totalMembers: members.length,
    onlineMembers: members.filter((member) => member.status === 'online').length,
    inVoiceMembers: members.filter((member) => member.status === 'in_voice').length,
    birthdayMembers: members.filter((member) => Boolean(member.birthday)).length,
    roleCounts,
    statusCounts
  };
}

export function getDragonMemberJoinYears(members: DragonMember[]) {
  return Array.from(new Set(members.map((member) => member.joinedAt.slice(0, 4)))).sort((left, right) => right.localeCompare(left));
}

export function getDragonMemberBirthdayMonths(members: DragonMember[]) {
  return Array.from(new Set(members.map((member) => member.birthday?.slice(5, 7)).filter(Boolean) as string[])).sort();
}

function compareDragonMembers(left: DragonMember, right: DragonMember, filters: DragonMembersFilters) {
  const direction = filters.direction === 'asc' ? 1 : -1;
  const leftRole = DRAGON_MEMBER_ROLE_META[left.role].order;
  const rightRole = DRAGON_MEMBER_ROLE_META[right.role].order;
  const leftStatus = getStatusOrder(left.status);
  const rightStatus = getStatusOrder(right.status);

  const resultBySort = {
    nickname: left.discordNickname.localeCompare(right.discordNickname),
    role: leftRole - rightRole,
    rank: left.rankLevel - right.rankLevel,
    joinedAt: left.joinedAt.localeCompare(right.joinedAt),
    status: leftStatus - rightStatus
  } satisfies Record<DragonMembersFilters['sort'], number>;

  const result = resultBySort[filters.sort];
  return result === 0 ? left.discordNickname.localeCompare(right.discordNickname) : result * direction;
}

function createRoleCounts(): Record<DragonMemberRole, number> {
  return Object.keys(DRAGON_MEMBER_ROLE_META).reduce(
    (counts, role) => ({
      ...counts,
      [role]: 0
    }),
    {} as Record<DragonMemberRole, number>
  );
}

function createStatusCounts(): Record<DragonMemberStatus, number> {
  return Object.keys(DRAGON_MEMBER_STATUS_META).reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0
    }),
    {} as Record<DragonMemberStatus, number>
  );
}

function getStatusOrder(status: DragonMemberStatus) {
  return {
    online: 5,
    in_voice: 4,
    recently_active: 3,
    away: 2,
    offline: 1
  }[status];
}
