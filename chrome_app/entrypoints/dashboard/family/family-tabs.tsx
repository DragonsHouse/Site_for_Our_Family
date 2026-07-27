import type { FamilyTab } from '../../../lib/family-types';
import { DragonTabs } from '../dragon-ui/dragon-ui';

const TABS: Array<{ key: FamilyTab; label: string; room: string }> = [
  { key: 'profile', label: 'Профіль', room: 'Dragon Chamber' },
  { key: 'members', label: 'Members', room: 'Hall of Guardians' },
  { key: 'cabinet', label: 'Мій кабінет', room: 'Entrance Hall' },
  { key: 'family', label: "Сім’я", room: 'Hall of Flame' },
  { key: 'buyers', label: 'Скупники', room: 'Trade Vault' },
  { key: 'events', label: 'Календар', room: 'Hall of Chronicles' },
  { key: 'map', label: 'Мапа', room: 'War Table' },
  { key: 'resources', label: 'Ресурси', room: 'Treasury' }
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
