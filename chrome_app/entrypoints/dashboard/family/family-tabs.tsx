import type { FamilyTab } from '../../../lib/family-types';
import { DragonTabs } from '../dragon-ui/dragon-ui';

const TABS: Array<{ key: FamilyTab; label: string; room: string }> = [
  { key: 'cabinet', label: 'Dashboard', room: 'Entrance Hall' },
  { key: 'members', label: 'Members', room: 'Hall of Guardians' },
  { key: 'profile', label: 'Profile', room: 'Dragon Chamber' },
  { key: 'calendar', label: 'Calendar', room: 'Hall of Chronicles' },
  { key: 'events', label: 'Events', room: 'Event Watch' },
  { key: 'tower-defense', label: 'Вогняна варта', room: 'War Chamber' },
  { key: 'achievements', label: 'Achievements', room: 'Seal Engine' },
  { key: 'resources', label: 'Resources', room: 'Treasury' },
  { key: 'discord-sync', label: 'Discord Sync', room: 'Sync Chamber' },
  { key: 'family', label: 'Family', room: 'Hall of Flame' },
  { key: 'buyers', label: 'Buyers', room: 'Trade Vault' },
  { key: 'map', label: 'Map', room: 'War Table' }
];

export function FamilyTabs({
  activeTab,
  onChange
}: {
  activeTab: FamilyTab;
  onChange: (tab: FamilyTab) => void;
}) {
  return <DragonTabs tabs={TABS} activeTab={activeTab} onChange={onChange} />;
}
