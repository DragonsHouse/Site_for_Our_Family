import type { FamilyTab, FamilyUser } from '../../../lib/family-types';
import { DragonRoomRail } from '../dragon-ui/dragon-ui';
import { getDragonRoomNavigationItems } from './room-navigation';

export function FamilyTabs({
  activeTab,
  onChange,
  currentUser
}: {
  activeTab: FamilyTab;
  onChange: (tab: FamilyTab) => void;
  currentUser: FamilyUser;
}) {
  return (
    <DragonRoomRail
      items={getDragonRoomNavigationItems(currentUser)}
      activeItem={activeTab}
      onItemSelect={onChange}
      label="Dragon House navigation"
    />
  );
}
