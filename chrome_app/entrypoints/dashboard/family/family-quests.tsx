import { useEffect, useMemo, useRef, useState } from 'react';
import { FAMILY_ASSET_DEFINITIONS, getQuestTemplateAssetSlot } from '../../../lib/family-assets';
import {
  addFamilyNotificationOnce,
  notifyBonusCreated,
  notifyBonusPaid,
  notifyQuestReportAccepted
} from '../../../lib/family-notifications';
import { canManageDiscordIntegration, canManageFamilyQuests } from '../../../lib/family-permissions';
import {
  archiveBackendFamilyQuestTemplate,
  completeBackendFamilyQuest,
  createBackendFamilyQuest,
  createBackendFamilyQuestReport,
  createBackendFamilyQuestTemplate,
  FamilyQuestPayoutApiError,
  issueBackendQuestPayout,
  joinBackendFamilyQuest,
  transferBackendFamilyQuestReportToAccounting,
  updateBackendFamilyQuest,
  updateBackendFamilyQuestTemplate,
  withdrawBackendFamilyQuest
} from '../../../lib/family-quest-backend-client';
import {
  mapBackendQuest,
  mapBackendQuestReport,
  mapBackendQuestTemplate
} from '../../../lib/family-quest-backend-mapper';
import { loadFamilyQuestReadState, type FamilyQuestReadSource } from '../../../lib/family-quest-read-adapter';
import {
  applyQuestRewardPlan,
  calculateQuestRewardPlan,
  createFamilyQuestReport,
  getFamilyQuestPeople,
  issueFamilyQuestPayouts,
  readFamilyQuestReports,
  readFamilyQuests,
  readFamilyQuestTemplates,
  readQuestTemplateAssetUrl,
  removeQuestPerson,
  saveFamilyQuestReports,
  saveFamilyQuests,
  saveFamilyQuestTemplates,
  transferQuestReportToAccounting,
  updateFamilyQuestState,
  upsertQuestPerson
} from '../../../lib/family-repositories';
import type {
  FamilyAssetSlot,
  FamilyQuest,
  FamilyQuestCategory,
  FamilyQuestParticipant,
  FamilyQuestReport,
  FamilyQuestRewardItem,
  FamilyQuestRewardMode,
  FamilyQuestStatus,
  FamilyQuestTemplate,
  FamilyUser
} from '../../../lib/family-types';
import {
  applyBackendPayoutResultToQuest,
  resolveBackendPayoutTarget
} from './family-quest-payout-backend';
import { DiscordPublishPanel } from './discord-publish-panel';
import { useFamilyAssetUrl } from './use-family-asset-url';

type BackendPayoutFeedback = {
  status: 'issuing' | 'success' | 'error';
  message: string;
};

type OperationMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const BACKEND_WRITE_ERROR_MESSAGE = 'Не вдалося зберегти зміни квесту.';

const STATUS_LABELS: Record<FamilyQuestStatus, string> = {
  draft: 'Чернетка',
  recruiting: 'Набір відкрито',
  scheduled: 'Набір закрито',
  active: 'Активний',
  paused: 'Пауза',
  stopped: 'Зупинено',
  completed: 'Завершено',
  reported: 'Звіт створено',
  sent_to_accounting: 'Передано в бухгалтерію',
  paid: 'Виплачено',
  cooldown: 'Відкат',
  closed: 'Набір закрито',
  in_progress: 'Активний',
  submitted: 'Передано',
  approved: 'Підтверджено',
  rejected: 'Відхилено'
};

const REWARD_MODES: FamilyQuestRewardMode[] = ['equal', 'percentage', 'fixed', 'mixed', 'manual'];
const QUEST_ASSET_SLOTS = FAMILY_ASSET_DEFINITIONS.filter((definition) => definition.slot.startsWith('quest_'));
const CATEGORY_STYLES = [
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  'border-amber-500/40 bg-amber-500/10 text-amber-100',
  'border-red-500/50 bg-red-500/10 text-red-100'
];

function money(value: number | null | undefined, fallback = '-') {
  return value == null ? fallback : `${value.toLocaleString('uk-UA')} $`;
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('uk-UA') : '-';
}

function formatCooldown(until: string | null | undefined) {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function categoryStyle(category: FamilyQuestCategory, categories: FamilyQuestCategory[]) {
  return CATEGORY_STYLES[categories.indexOf(category)] ?? CATEGORY_STYLES[1];
}

function allNames(quest: FamilyQuest | null) {
  return quest ? getFamilyQuestPeople(quest).map((person) => person.userId) : [];
}

function rewardItemsText(items: FamilyQuestRewardItem[] | undefined) {
  return (items ?? []).map((item) => `${item.title} x${item.quantity}`).join(', ') || '-';
}

function buildQuestFromTemplate(template: FamilyQuestTemplate, currentUser: FamilyUser): FamilyQuest {
  const now = new Date().toISOString();
  const quest: FamilyQuest = {
    id: `quest-${template.id}-${Date.now()}`,
    templateId: template.id,
    title: template.title,
    description: template.hint ?? template.steps.join('. '),
    category: template.category,
    scheduledAt: now,
    recommendedTeamSize: template.recommendedTeamSize,
    maxTeamSize: template.recommendedTeamSize,
    rewardAmount: template.memberRewardPool,
    totalReward: template.totalReward,
    memberRewardPool: template.memberRewardPool,
    familyBankShare: template.familyReward ?? template.familyBankShare,
    familyReward: template.familyReward ?? template.familyBankShare,
    splitMode: template.rewardMode ?? template.splitMode,
    rewardMode: template.rewardMode ?? template.splitMode,
    rewardLabel: template.rewardLabel,
    steps: template.steps,
    hint: template.hint,
    route: template.route,
    items: template.items,
    requiredItems: template.requiredItems ?? template.items,
    imageUrl: readQuestTemplateAssetUrl(template),
    organizer: currentUser.id,
    participants: [
      {
        userId: currentUser.id,
        nickname: currentUser.nickname,
        type: 'participant',
        joinedAt: now,
        leftAt: null,
        joinedLate: false,
        participationNote: null,
        addedManually: false,
        addedBy: currentUser.id,
        rewardPercent: null,
        rewardAmount: 0,
        rewardItems: [],
        bonusAmount: 0,
        bonusPercent: 0,
        isBestParticipant: false,
        bestParticipantReason: null,
        payoutStatus: 'pending',
        paidAt: null,
        paidBy: null,
        payoutEventKey: `quest-payout:quest-${template.id}-${Date.now()}:${currentUser.id}`
      }
    ],
    helpers: [],
    totalAmount: template.memberRewardPool,
    payouts: [],
    status: 'recruiting',
    approvedBy: null,
    reportId: null,
    reportSentToAccountingAt: null,
    paidAt: null,
    paidBy: null,
    cooldownUntil: null,
    cooldownHours: template.cooldownHours,
    syncSource: 'family_hub',
    auditTrail: [],
    createdAt: now,
    updatedAt: now
  };
  return updateFamilyQuestState(applyQuestRewardPlan(quest), 'recruiting', currentUser.id);
}

function QuestImage({ template }: { template: FamilyQuestTemplate }) {
  const slot = template.imageSlot ?? getQuestTemplateAssetSlot(template.id);
  const slotUrl = useFamilyAssetUrl(slot ?? 'dragon_house_logo');
  const imageUrl = slot ? slotUrl : template.imageUrl;

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-red-950/70 bg-gradient-to-br from-red-950/70 via-black to-amber-950/40">
      <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-sm text-amber-100/80">
        Зображення квесту
        <br />
        {slot ?? template.imageAsset}
      </div>
      <img
        src={imageUrl}
        alt={template.title}
        className="relative z-10 h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
    </div>
  );
}

function QuestEditor({
  template,
  categories,
  currentUser,
  onClose,
  onSave
}: {
  template: FamilyQuestTemplate | null;
  categories: FamilyQuestCategory[];
  currentUser: FamilyUser;
  onClose: () => void;
  onSave: (template: FamilyQuestTemplate) => void;
}) {
  const now = new Date().toISOString();
  const fallbackCategory = categories[0] ?? ('Бізнес' as FamilyQuestCategory);
  const [draft, setDraft] = useState<FamilyQuestTemplate>(
    template ?? {
      id: `custom-${Date.now()}`,
      title: '',
      category: fallbackCategory,
      recommendedTeamSize: 2,
      rewardAmount: 0,
      totalReward: 0,
      memberRewardPool: 0,
      familyBankShare: 0,
      familyReward: 0,
      splitMode: 'equal',
      rewardMode: 'equal',
      cooldownUntil: null,
      cooldownHours: 24,
      rewardLabel: 'Нагороду не налаштовано',
      steps: [''],
      hint: null,
      route: null,
      items: null,
      requiredItems: null,
      imageUrl: '/assets/dragon-house/quests/custom-placeholder.png',
      imageAsset: 'public/assets/dragon-house/quests/custom-placeholder.png',
      imageSlot: 'quest_help_citizens',
      isActive: true,
      createdBy: currentUser.nickname,
      updatedAt: now
    }
  );
  const [stepsText, setStepsText] = useState(draft.steps.join('\n'));
  const [editorError, setEditorError] = useState<string | null>(null);

  function save() {
    const steps = stepsText
      .split('\n')
      .map((step) => step.trim())
      .filter(Boolean);
    const familyReward = draft.familyReward ?? draft.familyBankShare;
    if (draft.memberRewardPool + familyReward > draft.totalReward) {
      setEditorError('Сума для учасників і сімейного банку не може перевищувати загальну нагороду.');
      return;
    }
    setEditorError(null);
    onSave({
      ...draft,
      title: draft.title.trim() || 'Новий сімейний квест',
      rewardAmount: draft.memberRewardPool,
      familyBankShare: familyReward,
      familyReward,
      splitMode: draft.rewardMode ?? draft.splitMode,
      rewardMode: draft.rewardMode ?? draft.splitMode,
      rewardLabel: `${money(draft.memberRewardPool)} для людей`,
      steps: steps.length ? steps : ['Опишіть кроки квесту'],
      hint: draft.hint?.trim() || null,
      route: draft.route?.trim() || null,
      items: draft.requiredItems?.trim() || null,
      requiredItems: draft.requiredItems?.trim() || null,
      cooldownHours: Math.max(1, Number(draft.cooldownHours) || 24),
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-2xl shadow-red-950/40">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Керування квестом</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{template ? 'Редагувати квест' : 'Створити квест'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
            Закрити
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Назва
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Слот зображення
            <select value={draft.imageSlot ?? ''} onChange={(event) => setDraft({ ...draft, imageSlot: (event.target.value || null) as FamilyAssetSlot | null })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100">
              <option value="">Без слота</option>
              {QUEST_ASSET_SLOTS.map((definition) => (
                <option key={definition.slot} value={definition.slot}>
                  {definition.slot}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Категорія
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as FamilyQuestCategory })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100">
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Максимальний розмір команди
            <input value={draft.recommendedTeamSize} onChange={(event) => setDraft({ ...draft, recommendedTeamSize: Number(event.target.value) || 1 })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Загальна нагорода
            <input value={draft.totalReward} onChange={(event) => setDraft({ ...draft, totalReward: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Фонд нагород для учасників
            <input value={draft.memberRewardPool} onChange={(event) => setDraft({ ...draft, memberRewardPool: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Нагорода сім’ї
            <input value={draft.familyReward ?? draft.familyBankShare} onChange={(event) => setDraft({ ...draft, familyReward: Number(event.target.value) || 0, familyBankShare: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Режим нагороди
            <select value={draft.rewardMode ?? draft.splitMode} onChange={(event) => setDraft({ ...draft, rewardMode: event.target.value as FamilyQuestRewardMode, splitMode: event.target.value as FamilyQuestRewardMode })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100">
              {REWARD_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Відкат, годин
            <input value={draft.cooldownHours} onChange={(event) => setDraft({ ...draft, cooldownHours: Number(event.target.value) || 24 })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
            Активний
          </label>
          <label className="block text-sm text-slate-300 lg:col-span-2">
            Опис / кроки, по одному в рядку
            <textarea value={stepsText} onChange={(event) => setStepsText(event.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Про квест
            <textarea value={draft.hint ?? ''} onChange={(event) => setDraft({ ...draft, hint: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300">
            Дата й час
            <input value={draft.route ?? ''} onChange={(event) => setDraft({ ...draft, route: event.target.value })} placeholder="Можна вказати дату/час або маршрут" className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
          <label className="block text-sm text-slate-300 lg:col-span-2">
            Предмети / вимоги
            <input value={draft.requiredItems ?? draft.items ?? ''} onChange={(event) => setDraft({ ...draft, requiredItems: event.target.value, items: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
          </label>
        </div>

        {editorError ? (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
            {editorError}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
            Скасувати
          </button>
          <button type="button" onClick={save} className="dh-fire-button rounded-xl px-4 py-2 text-sm font-semibold text-white">
            Зберегти
          </button>
        </div>
      </section>
    </div>
  );
}

function RewardManager({
  quest,
  users,
  currentUser,
  onClose,
  onUpdateQuest,
  onIssueOne,
  onIssueAll,
  payoutFeedback
}: {
  quest: FamilyQuest;
  users: FamilyUser[];
  currentUser: FamilyUser;
  onClose: () => void;
  onUpdateQuest: (quest: FamilyQuest) => void;
  onIssueOne: (questId: string, userId: string) => void | Promise<void>;
  onIssueAll: (questId: string) => void;
  payoutFeedback: Record<string, BackendPayoutFeedback>;
}) {
  const plan = calculateQuestRewardPlan(quest);
  const people = getFamilyQuestPeople(quest);
  const [itemText, setItemText] = useState<Record<string, string>>({});
  const activeUsers = users.filter((user) => user.accountStatus !== 'inactive');
  const hasBackendPayouts = plan.payouts.some((payout) => Boolean(resolveBackendPayoutTarget(quest, payout)));

  function updatePerson(userId: string, updates: Partial<FamilyQuestParticipant>) {
    const mapPerson = (person: FamilyQuestParticipant) => (person.userId === userId ? { ...person, ...updates } : person);
    onUpdateQuest(
      applyQuestRewardPlan({
        ...quest,
        participants: quest.participants.map(mapPerson),
        helpers: (quest.helpers ?? []).map(mapPerson),
        updatedAt: new Date().toISOString()
      })
    );
  }

  function addItem(userId: string) {
    const text = itemText[userId]?.trim();
    if (!text) return;
    const person = people.find((item) => item.userId === userId);
    const nextItems = [
      ...(person?.rewardItems ?? []),
      { id: `reward-item-${Date.now()}`, title: text, quantity: 1, status: 'prepared' as const, issuedAt: null, issuedBy: null }
    ];
    updatePerson(userId, { rewardItems: nextItems });
    setItemText({ ...itemText, [userId]: '' });
  }

  function addManualPerson(type: 'participant' | 'helper') {
    const value = window.prompt(type === 'participant' ? 'Нікнейм учасника' : 'Нікнейм помічника', activeUsers[0]?.nickname ?? '');
    if (!value?.trim()) return;
    const matchedUser = activeUsers.find((user) => user.id === value.trim() || user.nickname.toLowerCase() === value.trim().toLowerCase());
    const userId = matchedUser?.id ?? value.trim();
    onUpdateQuest(upsertQuestPerson(quest, { userId, nickname: matchedUser?.nickname ?? value.trim(), type, actor: quest.organizer, addedManually: true }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 p-4">
      <aside className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-2xl shadow-red-950/40">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Керування нагородами</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{quest.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
            Закрити
          </button>
        </div>

        {canManageDiscordIntegration(currentUser) && quest.backendQuestId ? (
          <div className="mt-4">
            <DiscordPublishPanel target="quest" sourceId={quest.backendQuestId} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="dh-card rounded-2xl p-3 text-sm"><span className="text-slate-500">Усього</span><div className="text-lg font-semibold text-white">{money(quest.totalReward)}</div></div>
          <div className="dh-card rounded-2xl p-3 text-sm"><span className="text-slate-500">Людям</span><div className="text-lg font-semibold text-amber-100">{money(quest.memberRewardPool)}</div></div>
          <div className="dh-card rounded-2xl p-3 text-sm"><span className="text-slate-500">Сім’ї</span><div className="text-lg font-semibold text-orange-100">{money(quest.familyReward ?? quest.familyBankShare)}</div></div>
          <div className="dh-card rounded-2xl p-3 text-sm"><span className="text-slate-500">Видано</span><div className="text-lg font-semibold text-emerald-100">{money(plan.paidToMembers)}</div></div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <label className="block text-sm text-slate-300">
              Режим нагороди
              <select
                value={quest.rewardMode ?? quest.splitMode}
                onChange={(event) => onUpdateQuest(applyQuestRewardPlan({ ...quest, rewardMode: event.target.value as FamilyQuestRewardMode, splitMode: event.target.value as FamilyQuestRewardMode }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100"
              >
                {REWARD_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </label>
            <div className="mt-4 space-y-1 text-sm text-slate-300">
              <div>Підготовлено: <span className="text-amber-100">{money(plan.preparedAmount)}</span></div>
              <div>Залишилось видати: <span className="text-amber-100">{money(plan.remainingMemberPool)}</span></div>
              <div>Розподілено: <span className="text-amber-100">{plan.percentDistributed.toFixed(2)}%</span></div>
              <div>Залишилось %: <span className="text-amber-100">{plan.percentRemaining.toFixed(2)}%</span></div>
            </div>
            {plan.errors.length ? <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-100">{plan.errors.join('; ')}</div> : null}
            {quest.rewardMode === 'percentage' || quest.splitMode === 'percentage' ? (
              <div className={plan.isComplete ? 'mt-3 text-sm text-emerald-100' : 'mt-3 text-sm text-amber-100'}>
                Відсотковий режим можна фіналізувати тільки при рівно 100%.
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => addManualPerson('participant')} className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100">Додати учасника</button>
              <button type="button" onClick={() => addManualPerson('helper')} className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm text-orange-100">Додати помічника</button>
              <button type="button" onClick={() => onIssueAll(quest.id)} disabled={hasBackendPayouts || !plan.isComplete || plan.errors.length > 0} className="dh-fire-button rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Видати все</button>
            </div>
          </section>

          <section className="overflow-x-auto rounded-2xl border border-white/10">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.8fr_0.7fr_1fr_0.8fr] bg-black/35 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
                <div>Людина</div><div>Тип</div><div>%</div><div>Сума</div><div>Бонус</div><div>Предмети</div><div>Статус</div>
              </div>
            {people.map((person) => {
              const payout = plan.payouts.find((item) => item.userId === person.userId);
              const backendTarget = resolveBackendPayoutTarget(quest, payout);
              const feedback = backendTarget ? payoutFeedback[backendTarget.payoutKey] : null;
              const isIssuing = feedback?.status === 'issuing';
              return (
                <div key={person.userId} className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.8fr_0.7fr_1fr_0.8fr] gap-2 border-t border-white/10 px-3 py-3 text-sm">
                  <div>
                    <div className="font-medium text-white">{person.userId}</div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={person.joinedLate ?? false} onChange={(event) => updatePerson(person.userId, { joinedLate: event.target.checked })} />
                      запізнився
                    </label>
                    <label className="mt-1 flex items-center gap-2 text-xs text-amber-100">
                      <input
                        type="checkbox"
                        checked={person.isBestParticipant ?? false}
                        onChange={(event) => updatePerson(person.userId, { isBestParticipant: event.target.checked, bestParticipantReason: event.target.checked ? person.bestParticipantReason ?? 'Найкращий учасник' : null })}
                      />
                      найкращий
                    </label>
                  </div>
                  <div>
                    <select value={person.type ?? 'participant'} onChange={(event) => onUpdateQuest(upsertQuestPerson(quest, { userId: person.userId, type: event.target.value as 'participant' | 'helper', actor: quest.organizer }))} className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100">
                <option value="participant">учасник</option>
                <option value="helper">помічник</option>
                    </select>
                    <button type="button" onClick={() => onUpdateQuest(removeQuestPerson(quest, person.userId, quest.organizer))} className="mt-2 rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-100">Прибрати</button>
                  </div>
                  <input value={person.rewardPercent ?? ''} onChange={(event) => updatePerson(person.userId, { rewardPercent: event.target.value === '' ? null : Number(event.target.value) || 0 })} className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100" />
                  <input value={person.rewardAmount ?? 0} onChange={(event) => updatePerson(person.userId, { rewardAmount: Number(event.target.value) || 0 })} className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100" />
                  <div className="space-y-2">
                    <input value={person.bonusAmount ?? 0} onChange={(event) => updatePerson(person.userId, { bonusAmount: Number(event.target.value) || 0 })} className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100" />
                    <input value={person.bonusPercent ?? 0} onChange={(event) => updatePerson(person.userId, { bonusPercent: Number(event.target.value) || 0 })} className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100" placeholder="bonus %" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-300">{rewardItemsText(person.rewardItems)}</div>
                    <div className="mt-2 flex gap-1">
                    <input value={itemText[person.userId] ?? ''} onChange={(event) => setItemText({ ...itemText, [person.userId]: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-slate-100" placeholder="предмет" />
                      <button type="button" onClick={() => addItem(person.userId)} className="rounded-lg border border-amber-500/40 px-2 py-1 text-xs text-amber-100">+</button>
                    </div>
                    <textarea value={person.participationNote ?? ''} onChange={(event) => updatePerson(person.userId, { participationNote: event.target.value })} rows={2} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-100" placeholder="коментар" />
                  </div>
                  <div>
                    <div className="text-amber-100">{money(payout?.amount ?? 0)}</div>
                    <div className="text-xs text-slate-400">{payout?.status ?? 'pending'}</div>
                    <button type="button" onClick={() => void onIssueOne(quest.id, person.userId)} disabled={isIssuing || payout?.status === 'paid' || !plan.isComplete || plan.errors.length > 0} className="mt-2 rounded-lg border border-emerald-500/40 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50">{isIssuing ? 'Обробка...' : 'Видати'}</button>
                    {feedback ? (
                      <div className={feedback.status === 'error' ? 'mt-2 text-xs text-red-200' : 'mt-2 text-xs text-emerald-100'}>
                        {feedback.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ManagerPanel({
  quest,
  report,
  users,
  onState,
  onEditQuest,
  onRewardManager,
  onCreateReport,
  onTransferReport,
  onReminder,
  onIssueAll,
  onUpdateQuest,
  onShowMessage
}: {
  quest: FamilyQuest;
  report: FamilyQuestReport | null;
  users: FamilyUser[];
  onState: (questId: string, status: FamilyQuestStatus, comment?: string | null) => void;
  onEditQuest: (quest: FamilyQuest) => void;
  onRewardManager: (quest: FamilyQuest) => void;
  onCreateReport: (questId: string) => void;
  onTransferReport: (reportId: string) => void;
  onReminder: (quest: FamilyQuest) => void;
  onIssueAll: (questId: string) => void;
  onUpdateQuest: (quest: FamilyQuest) => void;
  onShowMessage: (text: string, tone?: OperationMessage['tone']) => void;
}) {
  const people = getFamilyQuestPeople(quest);
  const plan = calculateQuestRewardPlan(quest);

  function addPerson(type: 'participant' | 'helper') {
    const fallback = users.find((user) => !people.some((person) => person.userId === user.id))?.nickname ?? '';
    const userId = window.prompt(type === 'participant' ? 'Додати основного учасника' : 'Додати помічника', fallback);
    if (!userId?.trim()) return;
    const matchedUser = users.find((user) => user.id === userId.trim() || user.nickname.toLowerCase() === userId.trim().toLowerCase());
    const joinedLate = window.confirm('Позначити, що людина долучилася пізніше?');
    const note = window.prompt('Коментар про участь', '') ?? '';
    onUpdateQuest(upsertQuestPerson(quest, { userId: matchedUser?.id ?? userId.trim(), nickname: matchedUser?.nickname ?? userId.trim(), type, actor: quest.organizer, joinedLate, participationNote: note.trim() || null, addedManually: true }));
  }

  function addRewardMoney() {
    const amount = Number(window.prompt('Скільки додати до memberRewardPool?', '0') ?? '0') || 0;
    if (amount <= 0) return;
    const next = applyQuestRewardPlan({
      ...quest,
      totalReward: quest.totalReward + amount,
      memberRewardPool: quest.memberRewardPool + amount,
      updatedAt: new Date().toISOString()
    });
    onUpdateQuest(next);
  }

  function addRewardItem() {
    const userId = window.prompt('Кому додати предмет?', people[0]?.userId ?? '');
    if (!userId) return;
    const title = window.prompt('Назва предмета', '');
    if (!title?.trim()) return;
    const updatePerson = (person: FamilyQuestParticipant) =>
      person.userId === userId
        ? {
            ...person,
            rewardItems: [
              ...(person.rewardItems ?? []),
              { id: `reward-item-${Date.now()}`, title: title.trim(), quantity: 1, status: 'prepared' as const, issuedAt: null, issuedBy: null }
            ]
          }
        : person;
    onUpdateQuest(applyQuestRewardPlan({ ...quest, participants: quest.participants.map(updatePerson), helpers: (quest.helpers ?? []).map(updatePerson) }));
  }

  function changeTime() {
    const value = window.prompt('Нова дата й час', quest.scheduledAt ?? '');
    if (value == null) return;
    onUpdateQuest({
      ...quest,
      scheduledAt: value.trim() || null,
      auditTrail: [
        {
          id: `quest-audit-${Date.now()}`,
          action: 'time_changed',
          actor: quest.organizer,
          timestamp: new Date().toISOString(),
          comment: value.trim() || null,
          previousState: quest.status,
          newState: quest.status,
          relatedUserId: null
        },
        ...(quest.auditTrail ?? [])
      ],
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Manager panel</div>
          <div className="mt-1 text-sm text-slate-300">Підготовлено: {money(plan.preparedAmount)} · видано: {money(plan.paidToMembers)}</div>
        </div>
        <button type="button" onClick={() => onRewardManager(quest)} className="dh-fire-button rounded-xl px-3 py-2 text-sm font-semibold text-white">Керування нагородами</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onState(quest.id, 'recruiting')} className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-100">Відкрити набір</button>
        <button type="button" onClick={() => onState(quest.id, 'scheduled')} className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100">Закрити набір</button>
        <button type="button" onClick={() => onState(quest.id, 'active')} className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm text-orange-100">Запустити</button>
        <button type="button" onClick={() => onState(quest.id, 'paused')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Призупинити</button>
        <button type="button" onClick={() => onState(quest.id, 'active')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Продовжити</button>
        <button type="button" onClick={() => onState(quest.id, 'stopped')} className="rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-100">Зупинити</button>
        <button type="button" onClick={() => onState(quest.id, 'stopped', window.prompt('Коментар зупинки', '') ?? null)} className="rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-100">Зупинити з коментарем</button>
        <button type="button" onClick={() => onState(quest.id, 'completed')} className="rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-100">Завершити</button>
        <button type="button" onClick={() => onEditQuest(quest)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Редагувати</button>
        <button type="button" onClick={changeTime} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Змінити дату й час</button>
        <button type="button" onClick={() => onReminder(quest)} className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100">Нагадати</button>
        <button type="button" onClick={() => onShowMessage(`Учасники:\n${quest.participants.map((item) => item.userId).join('\n') || '-'}`)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Переглянути учасників</button>
        <button type="button" onClick={() => onShowMessage(`Помічники:\n${(quest.helpers ?? []).map((item) => item.userId).join('\n') || '-'}`)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Переглянути помічників</button>
        <button type="button" onClick={() => addPerson('participant')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Додати учасника</button>
        <button type="button" onClick={() => addPerson('helper')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Додати помічника</button>
        <button type="button" onClick={addRewardMoney} className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100">Додати гроші</button>
        <button type="button" onClick={addRewardItem} className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100">Додати предмет</button>
        <button type="button" onClick={() => onCreateReport(quest.id)} disabled={!plan.isComplete || plan.errors.length > 0} className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm text-orange-100 disabled:opacity-50">Створити звіт</button>
        {report ? <button type="button" onClick={() => onTransferReport(report.id)} className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-100">Передати звіт у бухгалтерію</button> : null}
        <button type="button" onClick={() => onIssueAll(quest.id)} disabled={!plan.isComplete || plan.errors.length > 0} className="dh-fire-button rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Видати всі підготовлені</button>
      </div>
    </div>
  );
}

function QuestCard({
  template,
  quest,
  report,
  currentUser,
  users,
  categories,
  canManage,
  onJoin,
  onLeave,
  onOpenRecruiting,
  onState,
  onEditTemplate,
  onDeleteTemplate,
  onEditQuest,
  onRewardManager,
  onCreateReport,
  onTransferReport,
  onReminder,
  onIssueAll,
  onUpdateQuest,
  onShowMessage
}: {
  template: FamilyQuestTemplate;
  quest: FamilyQuest | null;
  report: FamilyQuestReport | null;
  currentUser: FamilyUser;
  users: FamilyUser[];
  categories: FamilyQuestCategory[];
  canManage: boolean;
  onJoin: (questId: string) => void;
  onLeave: (questId: string) => void;
  onOpenRecruiting: (template: FamilyQuestTemplate) => void;
  onState: (questId: string, status: FamilyQuestStatus, comment?: string | null) => void;
  onEditTemplate: (template: FamilyQuestTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onEditQuest: (quest: FamilyQuest) => void;
  onRewardManager: (quest: FamilyQuest) => void;
  onCreateReport: (questId: string) => void;
  onTransferReport: (reportId: string) => void;
  onReminder: (quest: FamilyQuest) => void;
  onIssueAll: (questId: string) => void;
  onUpdateQuest: (quest: FamilyQuest) => void;
  onShowMessage: (text: string, tone?: OperationMessage['tone']) => void;
}) {
  const names = allNames(quest);
  const joined = names.includes(currentUser.id);
  const cooldownText = formatCooldown(template.cooldownUntil);
  const plan = quest ? calculateQuestRewardPlan(quest) : null;
  const status = quest ? STATUS_LABELS[quest.status] : template.isActive ? 'Шаблон' : 'Неактивний';
  const totalPeople = quest ? getFamilyQuestPeople(quest).length : 0;

  return (
    <article className={`dh-quest-card relative overflow-hidden rounded-3xl p-4 ${template.isActive ? '' : 'opacity-65'}`}>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <QuestImage template={template} />
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${categoryStyle(template.category, categories)}`}>{template.category}</span>
              <span className="rounded-full border border-slate-700 bg-black/25 px-3 py-1 text-xs text-slate-200">Команда: {totalPeople}/{template.recommendedTeamSize}</span>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">{status}</span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-300">Режим: {quest?.rewardMode ?? template.rewardMode ?? template.splitMode}</span>
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-white">{template.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{quest?.description ?? template.hint ?? template.steps[0]}</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">Усього <span className="block text-amber-100">{money(template.totalReward)}</span></div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">Людям <span className="block text-amber-100">{money(template.memberRewardPool)}</span></div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">Сім’ї <span className="block text-orange-100">{money(template.familyReward ?? template.familyBankShare)}</span></div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">Видано <span className="block text-emerald-100">{money(plan?.paidToMembers ?? 0)}</span></div>
            </div>
            <div className="mt-2 text-sm text-slate-400">
              Автор: {quest?.organizer ?? template.createdBy} · Дата: {date(quest?.scheduledAt ?? template.updatedAt)} · Залишилось видати: {money(plan?.remainingMemberPool ?? template.memberRewardPool)}
            </div>
            {cooldownText ? <div className="mt-2 text-sm text-orange-200">Відкат: {cooldownText}</div> : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-black/30 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Основні учасники</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {quest?.participants.length ? quest.participants.map((person) => <span key={person.userId} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100">{person.userId}{person.joinedLate ? ' · запізнився' : ''}</span>) : <span className="text-sm text-slate-500">Немає.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-black/30 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Помічники</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {quest?.helpers?.length ? quest.helpers.map((person) => <span key={person.userId} className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-100">{person.userId}{person.joinedLate ? ' · запізнився' : ''}</span>) : <span className="text-sm text-slate-500">Немає.</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!quest && canManage ? <button type="button" disabled={Boolean(cooldownText) || !template.isActive} onClick={() => onOpenRecruiting(template)} className="dh-fire-button rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Відкрити набір</button> : null}
            {quest?.status === 'recruiting' ? (
              <>
                <button type="button" onClick={() => onJoin(quest.id)} disabled={joined} className={joined ? 'rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100' : 'dh-fire-button rounded-xl px-4 py-2 text-sm font-semibold text-white'}>{joined ? 'Приєднано' : 'Приєднатися'}</button>
                {joined ? <button type="button" onClick={() => onLeave(quest.id)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">Покинути</button> : null}
              </>
            ) : null}
            <button type="button" onClick={() => onShowMessage(`${template.title}\n\n${template.hint ?? template.steps.join('\n')}\n\nМаршрут: ${template.route ?? '-'}\nПредмети: ${template.requiredItems ?? template.items ?? '-'}`)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">Про квест</button>
            {canManage ? <button type="button" onClick={() => onEditTemplate(template)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Шаблон</button> : null}
            {canManage ? <button type="button" onClick={() => onDeleteTemplate(template.id)} className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-100">Видалити</button> : null}
          </div>

          {report ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-50">
              Report: people {money(report.memberRewardPool)}, family {money(report.familyReward ?? report.familyBankShare)}. {report.transferredToAccountingAt ? 'In accounting.' : 'Waiting for accounting transfer.'}
            </div>
          ) : null}

          {quest && canManage ? (
            <ManagerPanel
              quest={quest}
              report={report}
              users={users}
              onState={onState}
              onEditQuest={onEditQuest}
              onRewardManager={onRewardManager}
              onCreateReport={onCreateReport}
              onTransferReport={onTransferReport}
              onReminder={onReminder}
              onIssueAll={onIssueAll}
              onUpdateQuest={onUpdateQuest}
              onShowMessage={onShowMessage}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FamilyQuests({ currentUser, users }: { currentUser: FamilyUser; users: FamilyUser[] }) {
  const [templates, setTemplates] = useState<FamilyQuestTemplate[]>(() => readFamilyQuestTemplates());
  const [quests, setQuests] = useState<FamilyQuest[]>(() => readFamilyQuests());
  const [reports, setReports] = useState<FamilyQuestReport[]>(() => readFamilyQuestReports());
  const [category, setCategory] = useState<FamilyQuestCategory | 'all'>('all');
  const [editingTemplate, setEditingTemplate] = useState<FamilyQuestTemplate | null>(null);
  const [editingQuest, setEditingQuest] = useState<FamilyQuest | null>(null);
  const [rewardQuest, setRewardQuest] = useState<FamilyQuest | null>(null);
  const issuingBackendPayoutsRef = useRef(new Set<string>());
  const [payoutFeedback, setPayoutFeedback] = useState<Record<string, BackendPayoutFeedback>>({});
  const [operationMessage, setOperationMessage] = useState<OperationMessage | null>(null);
  const [questReadSource, setQuestReadSource] = useState<FamilyQuestReadSource>('backend_loading');
  const [questReadError, setQuestReadError] = useState<Error | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = canManageFamilyQuests(currentUser);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    void loadFamilyQuestReadState(controller.signal).then((state) => {
      if (cancelled) return;
      setTemplates(state.templates);
      setQuests(state.quests);
      setReports(state.reports);
      setQuestReadSource(state.source);
      setQuestReadError(state.error);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const categories = useMemo(() => Array.from(new Set(templates.map((template) => template.category))), [templates]);
  const visibleTemplates = useMemo(
    () => templates.filter((template) => (canManage || template.isActive) && (category === 'all' || template.category === category)),
    [canManage, category, templates]
  );

  async function reloadBackendQuests() {
    const state = await loadFamilyQuestReadState();
    setTemplates(state.templates);
    setQuests(state.quests);
    setReports(state.reports);
    setQuestReadSource(state.source);
    setQuestReadError(state.error);
  }

  function refresh() {
    if (questReadSource === 'backend') {
      void reloadBackendQuests();
      return;
    }
    setQuests(readFamilyQuests());
    setReports(readFamilyQuestReports());
  }

  function persistQuests(next: FamilyQuest[]) {
    saveFamilyQuests(next);
    setQuests(next);
  }

  function persistTemplates(next: FamilyQuestTemplate[]) {
    saveFamilyQuestTemplates(next);
    setTemplates(next);
  }

  function persistReports(next: FamilyQuestReport[]) {
    saveFamilyQuestReports(next);
    setReports(next);
  }

  function findQuest(templateId: string) {
    return quests.find((quest) => quest.templateId === templateId && !['paid', 'rejected'].includes(quest.status)) ?? null;
  }

  function findReport(quest: FamilyQuest | null) {
    if (!quest) return null;
    return reports.find((report) => report.questId === quest.id) ?? null;
  }

  function isBackendQuest(quest: FamilyQuest | null | undefined) {
    return quest?.source === 'backend';
  }

  function isBackendTemplate(template: FamilyQuestTemplate | null | undefined) {
    return template?.source === 'backend';
  }

  function showOperationMessage(text: string, tone: OperationMessage['tone'] = 'info') {
    setOperationMessage({ text, tone });
  }

  function showBackendWriteError(error: unknown) {
    showOperationMessage(error instanceof Error ? error.message : BACKEND_WRITE_ERROR_MESSAGE, 'error');
  }

  function startCreatingTemplate() {
    setCreating(true);
  }

  function startEditingTemplate(template: FamilyQuestTemplate) {
    setEditingTemplate(template);
  }

  function startEditingQuest(quest: FamilyQuest) {
    setEditingQuest(quest);
  }

  async function saveTemplate(template: FamilyQuestTemplate) {
    if (questReadSource === 'backend' || isBackendTemplate(template)) {
      const payload = {
        title: template.title,
        category: template.category,
        description: template.hint ?? null,
        steps: template.steps,
        recommendedTeamSize: template.recommendedTeamSize,
        totalReward: template.totalReward ?? template.rewardAmount,
        memberRewardPool: template.memberRewardPool ?? template.rewardAmount,
        familyReward: template.familyReward ?? template.familyBankShare ?? 0,
        rewardMode: template.rewardMode ?? template.splitMode,
        requiredItems: template.requiredItems ?? template.items ?? null,
        imageAssetId: template.imageAsset ?? null,
        isActive: template.isActive,
        cooldownHours: template.cooldownHours ?? 24,
      };
      try {
        const saved = isBackendTemplate(template)
          ? await updateBackendFamilyQuestTemplate(template.id, payload)
          : await createBackendFamilyQuestTemplate(payload);
        setTemplates((current) => {
          const mapped = mapBackendQuestTemplate(saved);
          return current.some((item) => item.id === mapped.id) ? current.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...current];
        });
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
        return;
      }
      setEditingTemplate(null);
      setCreating(false);
      return;
    }
    persistTemplates(templates.some((item) => item.id === template.id) ? templates.map((item) => (item.id === template.id ? template : item)) : [template, ...templates]);
    setEditingTemplate(null);
    setCreating(false);
  }

  async function deleteTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!window.confirm('Архівувати цей шаблон квесту?')) return;
    if (questReadSource === 'backend' || isBackendTemplate(template)) {
      try {
        await archiveBackendFamilyQuestTemplate(templateId);
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    persistTemplates(templates.filter((template) => template.id !== templateId));
    persistQuests(quests.filter((quest) => quest.templateId !== templateId));
  }

  async function openRecruiting(template: FamilyQuestTemplate) {
    if (formatCooldown(template.cooldownUntil)) return;
    if (questReadSource === 'backend' || isBackendTemplate(template)) {
      try {
        const created = await createBackendFamilyQuest({
          templateId: template.backendTemplateId ?? template.id,
          title: template.title,
          description: template.hint ?? '',
          category: template.backendCategory ?? template.category,
          status: 'recruiting',
          scheduledAt: new Date().toISOString(),
          totalReward: template.totalReward ?? template.rewardAmount,
          memberRewardPool: template.memberRewardPool ?? template.rewardAmount,
          familyReward: template.familyReward ?? template.familyBankShare ?? 0,
          rewardMode: template.rewardMode ?? template.splitMode,
          requiredItems: template.requiredItems ?? template.items ?? null,
        });
        const mapped = mapBackendQuest(created);
        setQuests((current) => [mapped, ...current.filter((quest) => quest.id !== mapped.id)]);
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    persistQuests([buildQuestFromTemplate(template, currentUser), ...quests]);
  }

  async function updateQuest(nextQuest: FamilyQuest) {
    if (questReadSource === 'backend' || isBackendQuest(nextQuest)) {
      try {
        const updated = await updateBackendFamilyQuest(nextQuest.id, {
          title: nextQuest.title,
          description: nextQuest.description ?? nextQuest.hint ?? '',
          category: nextQuest.backendCategory ?? nextQuest.category,
          status: nextQuest.status,
          scheduledAt: nextQuest.scheduledAt,
          totalReward: nextQuest.totalReward,
          memberRewardPool: nextQuest.memberRewardPool,
          familyReward: nextQuest.familyReward ?? nextQuest.familyBankShare ?? 0,
          rewardMode: nextQuest.rewardMode ?? nextQuest.splitMode,
          requiredItems: nextQuest.requiredItems ?? nextQuest.items ?? null,
        });
        persistBackendQuestUpdate(mapBackendQuest(updated));
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    const planned = applyQuestRewardPlan(nextQuest);
    persistQuests(quests.some((quest) => quest.id === planned.id) ? quests.map((quest) => (quest.id === planned.id ? planned : quest)) : [planned, ...quests]);
    if (rewardQuest?.id === planned.id) setRewardQuest(planned);
    if (editingQuest?.id === planned.id) setEditingQuest(planned);
  }

  function persistBackendQuestUpdate(nextQuest: FamilyQuest) {
    const planned = applyQuestRewardPlan(nextQuest);
    if (questReadSource === 'backend' || isBackendQuest(planned)) {
      setQuests((current) => (current.some((quest) => quest.id === planned.id) ? current.map((quest) => (quest.id === planned.id ? planned : quest)) : [planned, ...current]));
      if (rewardQuest?.id === planned.id) setRewardQuest(planned);
      if (editingQuest?.id === planned.id) setEditingQuest(planned);
      return;
    }
    const stored = readFamilyQuests();
    const next = stored.some((quest) => quest.id === planned.id) ? stored.map((quest) => (quest.id === planned.id ? planned : quest)) : [planned, ...stored];
    saveFamilyQuests(next);
    setQuests(next);
    if (rewardQuest?.id === planned.id) setRewardQuest(planned);
    if (editingQuest?.id === planned.id) setEditingQuest(planned);
  }

  async function changeState(questId: string, status: FamilyQuestStatus, comment: string | null = null) {
    const quest = quests.find((item) => item.id === questId);
    if (!quest) return;
    if (questReadSource === 'backend' || isBackendQuest(quest)) {
      try {
        const updated = status === 'completed'
          ? await completeBackendFamilyQuest(questId, comment)
          : await updateBackendFamilyQuest(questId, { status });
        persistBackendQuestUpdate(mapBackendQuest(updated));
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    const next = updateFamilyQuestState(quest, status, currentUser.id, comment);
    if (next === quest) {
      showOperationMessage(`Нелогічний перехід стану: ${quest.status} → ${status}`, 'error');
      return;
    }
    void updateQuest(next);
    if (status === 'completed' && quest.templateId) {
      const template = templates.find((item) => item.id === quest.templateId);
      const cooldownUntil = new Date(Date.now() + (template?.cooldownHours ?? 24) * 60 * 60 * 1000).toISOString();
      persistTemplates(templates.map((item) => (item.id === quest.templateId ? { ...item, cooldownUntil, updatedAt: new Date().toISOString() } : item)));
    }
  }

  async function joinQuest(questId: string) {
    const quest = quests.find((item) => item.id === questId);
    if (!quest || quest.status !== 'recruiting') return;
    if (questReadSource === 'backend' || isBackendQuest(quest)) {
      try {
        await joinBackendFamilyQuest(questId, 'participant');
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    const alreadyJoined = getFamilyQuestPeople(quest).some((person) => person.userId === currentUser.id);
    if (alreadyJoined) return;
    const next = upsertQuestPerson(quest, { userId: currentUser.id, nickname: currentUser.nickname, type: 'participant', actor: currentUser.id, addedManually: false });
    void updateQuest(next);
    void addFamilyNotificationOnce({
      eventKey: `quest-joined:${questId}:${currentUser.id}`,
      userId: currentUser.id,
      staticId: currentUser.staticId,
      type: 'quest_joined',
      title: 'Quest joined',
      message: `Ти приєднався/приєдналася до "${quest.title}"`,
      relatedEntityType: 'quest',
      relatedEntityId: questId
    });
  }

  async function leaveQuest(questId: string) {
    const quest = quests.find((item) => item.id === questId);
    if (!quest || quest.status !== 'recruiting') return;
    if (questReadSource === 'backend' || isBackendQuest(quest)) {
      try {
        await withdrawBackendFamilyQuest(questId);
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    const now = new Date().toISOString();
    const markLeft = (person: FamilyQuestParticipant) => person.userId === currentUser.id ? { ...person, leftAt: now } : person;
    void updateQuest(
      removeQuestPerson(
        { ...quest, participants: quest.participants.map(markLeft), helpers: (quest.helpers ?? []).map(markLeft) },
        currentUser.id,
        currentUser.id,
        'Left during recruiting'
      )
    );
  }

  async function createReport(questId: string) {
    const quest = quests.find((item) => item.id === questId);
    if (!quest) return;
    if (isBackendQuest(quest)) {
      try {
        await createBackendFamilyQuestReport(quest.id, 'Звіт створено в Hub.');
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    try {
      const report = createFamilyQuestReport(quest, currentUser.id, 'Dragon House quest report.');
      persistReports(reports.some((item) => item.id === report.id) ? reports.map((item) => (item.id === report.id ? report : item)) : [report, ...reports]);
      updateQuest({ ...updateFamilyQuestState(quest, 'reported', currentUser.id), reportId: report.id, approvedBy: currentUser.id });
      void notifyQuestReportAccepted(report);
    } catch (error) {
      showOperationMessage(error instanceof Error ? error.message : 'Не вдалося створити звіт', 'error');
    }
  }

  async function transferReport(reportId: string) {
    const report = reports.find((item) => item.id === reportId);
    if (!report) return;
    const quest = quests.find((item) => item.id === report.questId);
    if (!quest) return;
    if (isBackendQuest(quest)) {
      try {
        await transferBackendFamilyQuestReportToAccounting(quest.id);
        await reloadBackendQuests();
      } catch (error) {
        showBackendWriteError(error);
      }
      return;
    }
    const month = transferQuestReportToAccounting(report, currentUser.id);
    const now = new Date().toISOString();
    const updatedReport = { ...report, transferredToAccountingAt: report.transferredToAccountingAt ?? now, updatedAt: now };
    persistReports(reports.map((item) => (item.id === reportId ? updatedReport : item)));
    if (quest) updateQuest({ ...updateFamilyQuestState(quest, 'sent_to_accounting', currentUser.id), reportSentToAccountingAt: updatedReport.transferredToAccountingAt });
    const bonusPrefix = `bonus-${report.id}-`;
    void Promise.all(month.bonuses.filter((bonus) => bonus.id.startsWith(bonusPrefix)).map((bonus) => notifyBonusCreated(bonus)));
  }

  function remind(quest: FamilyQuest) {
    if (isBackendQuest(quest)) {
      showBackendWriteError(new Error('Нагадування для backend-квестів проходять через Discord-синхронізацію.'));
      return;
    }
    const recipients = getFamilyQuestPeople(quest);
    const now = new Date().toISOString().slice(0, 16);
    void Promise.all(
      recipients.map((person) =>
        addFamilyNotificationOnce({
          eventKey: `quest-reminder:${quest.id}:${person.userId}:${now}`,
          userId: person.userId,
          type: 'quest_reminder',
          title: 'Нагадування про квест',
          message: `Внутрішнє нагадування: "${quest.title}"`,
          relatedEntityType: 'quest',
          relatedEntityId: quest.id
        })
      )
    );
    updateQuest({
      ...quest,
      auditTrail: [
        {
          id: `quest-audit-${Date.now()}`,
          action: 'reminder_sent',
          actor: currentUser.id,
          timestamp: new Date().toISOString(),
          comment: 'Internal Family Hub reminder',
          previousState: quest.status,
          newState: quest.status,
          relatedUserId: null,
          metadata: { recipients: recipients.length }
        },
        ...(quest.auditTrail ?? [])
      ],
      updatedAt: new Date().toISOString()
    });
    showOperationMessage('Внутрішнє нагадування надіслано учасникам квесту', 'success');
  }

  function backendPayoutErrorMessage(error: unknown) {
    if (error instanceof FamilyQuestPayoutApiError) {
      if (error.code === 'QUEST_PAYOUT_UNAUTHORIZED') return 'Немає прав видати цю виплату.';
      if (error.code === 'QUEST_NOT_FOUND') return 'Квест не знайдено. Онови список і перевір запис.';
      if (error.code === 'QUEST_PAYOUT_NOT_FOUND') return 'Виплату не знайдено. Онови квест перед повтором.';
      if (error.code === 'QUEST_PAYOUT_MISMATCH') return 'Виплата не належить цьому квесту. Дію зупинено.';
      if (error.code === 'QUEST_PAYOUT_ALREADY_PAID') return 'Цю виплату вже проведено.';
      if (error.code === 'QUEST_PAYOUT_IDEMPOTENCY_CONFLICT') return 'Повтор цієї виплати конфліктує з іншим запитом. Дію зупинено.';
      if (error.code === 'BACKEND_UNAVAILABLE' || error.code === 'FINANCE_SERVICE_UNAVAILABLE') return 'Сервіс виплат тимчасово недоступний. Виплату не позначено виконаною.';
      if (error.code === 'MALFORMED_RESPONSE') return 'Сервіс повернув неочікувану відповідь. Виплату не позначено виконаною.';
      return error.message;
    }
    return error instanceof Error ? error.message : 'Не вдалося видати виплату';
  }

  async function issueOne(questId: string, userId: string) {
    const quest = quests.find((item) => item.id === questId);
    const planned = quest ? applyQuestRewardPlan(quest) : null;
    const payout = planned?.payouts.find((item) => item.userId === userId);
    const backendTarget = planned && payout ? resolveBackendPayoutTarget(planned, payout) : null;
    if (backendTarget) {
      if (issuingBackendPayoutsRef.current.has(backendTarget.payoutKey)) return;
      issuingBackendPayoutsRef.current.add(backendTarget.payoutKey);
      setPayoutFeedback((current) => ({
        ...current,
        [backendTarget.payoutKey]: { status: 'issuing', message: 'Видаємо виплату...' }
      }));
      try {
        const result = await issueBackendQuestPayout({
          questId: backendTarget.questId,
          payoutId: backendTarget.payoutId,
          idempotencyKey: backendTarget.idempotencyKey
        });
        const storedQuest = readFamilyQuests().find((item) => item.id === questId) ?? planned;
        if (!storedQuest) throw new Error('Квест не знайдено для оновлення виплати.');
        persistBackendQuestUpdate(applyBackendPayoutResultToQuest(storedQuest, result));
        setPayoutFeedback((current) => ({
          ...current,
          [backendTarget.payoutKey]: {
            status: 'success',
            message: result.alreadyIssued ? 'Цю виплату вже проведено.' : 'Виплату проведено.'
          }
        }));
      } catch (error) {
        setPayoutFeedback((current) => ({
          ...current,
          [backendTarget.payoutKey]: { status: 'error', message: backendPayoutErrorMessage(error) }
        }));
      } finally {
        issuingBackendPayoutsRef.current.delete(backendTarget.payoutKey);
      }
      return;
    }

    try {
      const result = issueFamilyQuestPayouts({ questId, actorId: currentUser.id, userIds: [userId] });
      refresh();
      void Promise.all(result.issuedBonuses.map((bonus) => notifyBonusPaid(bonus)));
    } catch (error) {
      showOperationMessage(error instanceof Error ? error.message : 'Не вдалося видати виплату', 'error');
    }
  }

  function issueAll(questId: string) {
    const quest = quests.find((item) => item.id === questId);
    if (isBackendQuest(quest)) {
      showOperationMessage('Ці виплати потрібно видавати по одній через офіційний сервіс.', 'info');
      return;
    }
    const plan = quest ? calculateQuestRewardPlan(quest) : null;
    if (quest && plan?.payouts.some((payout) => Boolean(resolveBackendPayoutTarget(quest, payout)))) {
      showOperationMessage('Ці виплати потрібно видавати по одній через офіційний сервіс.', 'info');
      return;
    }
    try {
      const result = issueFamilyQuestPayouts({ questId, actorId: currentUser.id });
      refresh();
      void Promise.all(result.issuedBonuses.map((bonus) => notifyBonusPaid(bonus)));
    } catch (error) {
      showOperationMessage(error instanceof Error ? error.message : 'Не вдалося видати виплати', 'error');
    }
  }

  return (
    <section className="space-y-4">
      <div className="dh-panel rounded-3xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Dragon House</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Квести Dragon House</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Квести показуються з офіційного сервісу. Локальні зміни не видаються за справжні дані.</p>
            <p className={questReadSource === 'backend' ? 'mt-2 text-xs text-emerald-100' : 'mt-2 text-xs text-amber-100'}>
              {questReadSource === 'backend'
                ? 'Квести завантажено.'
                : questReadSource === 'dev_local_fallback'
                  ? 'Офіційний сервіс квестів недоступний. Показано режим розробки.'
                  : questReadError
                    ? 'Не вдалося завантажити дані. Спробуй ще раз після відновлення сервісу.'
                    : 'Завантаження...'}
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={startCreatingTemplate}
              className="dh-fire-button rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Створити квест
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', ...categories] as Array<FamilyQuestCategory | 'all'>).map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={category === item ? 'dh-tab-active rounded-xl px-3 py-2 text-sm font-semibold' : 'dh-tab rounded-xl px-3 py-2 text-sm font-semibold'}>
              {item === 'all' ? 'Усі' : item}
            </button>
          ))}
        </div>
        {operationMessage ? (
          <div
            className={
              operationMessage.tone === 'error'
                ? 'mt-4 whitespace-pre-wrap rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100'
                : operationMessage.tone === 'success'
                  ? 'mt-4 whitespace-pre-wrap rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100'
                  : 'mt-4 whitespace-pre-wrap rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100'
            }
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <span>{operationMessage.text}</span>
              <button type="button" onClick={() => setOperationMessage(null)} className="self-start rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200">
                Закрити
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {visibleTemplates.map((template) => {
          const quest = findQuest(template.id);
          const report = findReport(quest);
          return (
            <QuestCard
              key={template.id}
              template={template}
              quest={quest}
              report={report}
              currentUser={currentUser}
              users={users}
              categories={categories}
              canManage={canManage}
              onJoin={joinQuest}
              onLeave={leaveQuest}
              onOpenRecruiting={openRecruiting}
              onState={changeState}
              onEditTemplate={startEditingTemplate}
              onDeleteTemplate={deleteTemplate}
              onEditQuest={startEditingQuest}
              onRewardManager={setRewardQuest}
              onCreateReport={createReport}
              onTransferReport={transferReport}
              onReminder={remind}
              onIssueAll={issueAll}
              onUpdateQuest={updateQuest}
              onShowMessage={showOperationMessage}
            />
          );
        })}
      </div>

      {creating ? <QuestEditor template={null} categories={categories} currentUser={currentUser} onClose={() => setCreating(false)} onSave={saveTemplate} /> : null}
      {editingTemplate ? <QuestEditor template={editingTemplate} categories={categories} currentUser={currentUser} onClose={() => setEditingTemplate(null)} onSave={saveTemplate} /> : null}
      {editingQuest ? (
        <QuestEditor
          template={{
            id: editingQuest.templateId ?? editingQuest.id,
            title: editingQuest.title,
            category: editingQuest.category,
            recommendedTeamSize: editingQuest.maxTeamSize ?? editingQuest.recommendedTeamSize,
            rewardAmount: editingQuest.memberRewardPool,
            totalReward: editingQuest.totalReward,
            memberRewardPool: editingQuest.memberRewardPool,
            familyBankShare: editingQuest.familyReward ?? editingQuest.familyBankShare,
            familyReward: editingQuest.familyReward ?? editingQuest.familyBankShare,
            splitMode: editingQuest.rewardMode ?? editingQuest.splitMode,
            rewardMode: editingQuest.rewardMode ?? editingQuest.splitMode,
            cooldownUntil: editingQuest.cooldownUntil ?? null,
            cooldownHours: editingQuest.cooldownHours ?? 24,
            rewardLabel: editingQuest.rewardLabel,
            steps: editingQuest.steps,
            hint: editingQuest.description,
            route: editingQuest.scheduledAt ?? editingQuest.route,
            items: editingQuest.items,
            requiredItems: editingQuest.requiredItems,
            imageUrl: editingQuest.imageUrl,
            imageAsset: editingQuest.imageUrl,
            imageSlot: null,
            isActive: true,
            createdBy: editingQuest.organizer,
            updatedAt: editingQuest.updatedAt
          }}
          categories={categories}
          currentUser={currentUser}
          onClose={() => setEditingQuest(null)}
          onSave={(template) => {
            updateQuest({
              ...editingQuest,
              title: template.title,
              description: template.hint ?? editingQuest.description,
              category: template.category,
              scheduledAt: template.route ?? editingQuest.scheduledAt,
              recommendedTeamSize: template.recommendedTeamSize,
              maxTeamSize: template.recommendedTeamSize,
              totalReward: template.totalReward,
              memberRewardPool: template.memberRewardPool,
              familyBankShare: template.familyReward ?? template.familyBankShare,
              familyReward: template.familyReward ?? template.familyBankShare,
              splitMode: template.rewardMode ?? template.splitMode,
              rewardMode: template.rewardMode ?? template.splitMode,
              steps: template.steps,
              hint: template.hint,
              route: template.route,
              items: template.items,
              requiredItems: template.requiredItems,
              cooldownHours: template.cooldownHours,
              updatedAt: new Date().toISOString()
            });
            setEditingQuest(null);
          }}
        />
      ) : null}
      {rewardQuest ? <RewardManager quest={rewardQuest} users={users} currentUser={currentUser} onClose={() => setRewardQuest(null)} onUpdateQuest={updateQuest} onIssueOne={issueOne} onIssueAll={issueAll} payoutFeedback={payoutFeedback} /> : null}
    </section>
  );
}
