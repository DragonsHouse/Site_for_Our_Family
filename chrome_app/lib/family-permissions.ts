import type { FamilyBonus, FamilyPermission, FamilyUser } from './family-types';

export const ALL_FAMILY_PERMISSIONS: FamilyPermission[] = [
  'manage_users',
  'view_members',
  'manage_members',
  'manage_member_roles',
  'manage_member_auth',
  'delete_members',
  'restore_members',
  'view_member_private_fields',
  'manage_tasks',
  'manage_ranks',
  'view_private_notes',
  'manage_family_map',
  'manage_events',
  'manage_buyers',
  'manage_family_posts',
  'manage_family_news',
  'manage_news',
  'view_family_history',
  'manage_family_economy',
  'manage_family_quests',
  'manage_family_assets',
  'manage_discord_integration',
  'manage_backups',
  'manage_accounting',
  'manage_treasury',
  'manage_recruitment',
  'manage_resources',
  'manage_roles'
];

export function hasFamilyPermission(user: FamilyUser, permission: FamilyPermission) {
  return user.role === 'owner' || user.permissions.includes(permission);
}

export function canManageFamilyNews(user: FamilyUser) {
  return (
    hasFamilyPermission(user, 'manage_news') ||
    hasFamilyPermission(user, 'manage_family_news') ||
    hasFamilyPermission(user, 'manage_family_posts')
  );
}

export function canManageFamilyContent(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_news') || hasFamilyPermission(user, 'manage_family_posts');
}

export function canViewFamilyHistory(user: FamilyUser) {
  return user.role === 'owner' || user.rankLevel >= 8 || hasFamilyPermission(user, 'view_family_history');
}

export function canManageFamilyEconomy(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_family_economy');
}

export function canManageFamilyQuests(user: FamilyUser) {
  return user.rankLevel >= 8 || hasFamilyPermission(user, 'manage_family_quests');
}

export function canViewAccounting(user: FamilyUser) {
  return user.rankLevel >= 8 || hasFamilyPermission(user, 'manage_accounting');
}

export function canManageAccounting(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_accounting');
}

export function canViewBonus(user: FamilyUser, bonus: FamilyBonus) {
  return bonus.userId === user.id || bonus.userId === user.nickname || canViewAccounting(user);
}

export function canManageFamilyMap(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_family_map');
}

export function canManageResources(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_resources');
}

export function canManageFamilyAssets(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_family_assets');
}

export function canManageDiscordIntegration(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_discord_integration');
}

export function canManageBackups(user: FamilyUser) {
  return hasFamilyPermission(user, 'manage_backups');
}
