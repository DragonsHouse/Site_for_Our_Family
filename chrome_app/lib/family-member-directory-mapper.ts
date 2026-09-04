import type { DragonMember, DragonMemberRole } from '../entrypoints/dashboard/family/members-models.ts';
import type { FamilyMemberDirectoryItem } from './family-member-directory-client.ts';

export function mapDirectoryMember(member: FamilyMemberDirectoryItem): DragonMember {
  return {
    id: member.memberId,
    discordNickname: member.discord.serverNickname ?? member.discord.displayName ?? member.displayName,
    dragonTitle: member.rank.title ?? `Rank ${member.rank.level}`,
    role: mapRole(member.role, member.rank.level),
    rank: member.rank.title ?? `Rank ${member.rank.level}`,
    rankLevel: member.rank.level,
    joinedAt: member.joinedAt?.slice(0, 10) ?? '',
    status: 'offline',
    staticId: '',
    discordUserId: null,
    discordSyncedAt: null,
    discordGuildActive: member.discord.linked,
    discordSyncState: member.discord.linked ? 'linked' : 'not-linked',
    avatarUrl: member.avatarUrl ?? member.discord.avatarUrl,
  };
}

function mapRole(role: FamilyMemberDirectoryItem['role'], rank: number): DragonMemberRole {
  if (role === 'owner') return 'volodarka_predvichnoho_polumia';
  if (rank >= 8) return 'keeper_of_flame';
  if (rank >= 6) return 'elder';
  if (rank >= 4) return 'senior_dragon';
  if (rank >= 2) return 'dragon';
  return 'egg';
}
