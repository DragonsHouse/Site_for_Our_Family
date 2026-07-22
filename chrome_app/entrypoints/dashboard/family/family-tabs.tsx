import type { FamilyTab } from '../../../lib/family-types';

const TABS: Array<{ key: FamilyTab; label: string }> = [
  { key: 'cabinet', label: 'Мій кабінет' },
  { key: 'family', label: "Сім’я" },
  { key: 'buyers', label: 'Скупники' },
  { key: 'events', label: 'Івенти' },
  { key: 'map', label: 'Мапа' },
  { key: 'resources', label: 'Ресурси' }
];

export function FamilyTabs({
  activeTab,
  onChange
}: {
  activeTab: FamilyTab;
  onChange: (tab: FamilyTab) => void;
}) {
  return (
    <nav className="dh-panel flex flex-wrap gap-1.5 rounded-2xl p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            activeTab === tab.key ? 'dh-tab-active' : 'dh-tab'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
