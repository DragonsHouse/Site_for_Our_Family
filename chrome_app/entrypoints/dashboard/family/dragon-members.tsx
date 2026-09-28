import type { FamilyUser } from '../../../lib/family-types';
import {
  DragonAvatar,
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonDivider,
  DragonEmptyState,
  DragonHero,
  DragonInput,
  DragonLoader,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection,
  DragonSelect,
  DragonTabs
} from '../dragon-ui/dragon-ui';
import {
  DRAGON_MEMBER_ROLE_META,
  DRAGON_MEMBER_STATUS_META,
  type DragonMember,
  type DragonMemberRole,
  type DragonMembersSort,
  type DragonMembersView,
  type DragonMemberStatus
} from './members-models';
import {
  formatDragonMemberBirthday,
  formatDragonMemberDate,
  formatDragonMemberDiscordSyncState,
  getDragonMemberDiscordSyncState,
  type DragonMembersRepository
} from './members-service';
import { useDragonMembersState } from './members-state';

const VIEW_TABS: Array<{ key: DragonMembersView; label: string; room: string }> = [
  { key: 'grid', label: 'Сітка', room: 'Стіна варти' },
  { key: 'list', label: 'Список', room: 'Реєстр імен' }
];

const SORT_OPTIONS: Array<{ value: DragonMembersSort; label: string }> = [
  { value: 'role', label: 'Роль' },
  { value: 'rank', label: 'Ранг' },
  { value: 'nickname', label: 'Нікнейм' },
  { value: 'joinedAt', label: 'Дата вступу' },
  { value: 'status', label: 'Статус' }
];

const MONTH_LABELS: Record<string, string> = {
  '01': 'Січень',
  '02': 'Лютий',
  '03': 'Березень',
  '04': 'Квітень',
  '05': 'Травень',
  '06': 'Червень',
  '07': 'Липень',
  '08': 'Серпень',
  '09': 'Вересень',
  '10': 'Жовтень',
  '11': 'Листопад',
  '12': 'Грудень'
};

export function DragonMembers({ currentUser, repository }: { currentUser: FamilyUser; repository: DragonMembersRepository }) {
  const members = useDragonMembersState(repository);
  const hasFilters =
    Boolean(members.filters.search) ||
    members.filters.role !== 'all' ||
    members.filters.status !== 'all' ||
    Boolean(members.filters.joinYear) ||
    Boolean(members.filters.birthdayMonth);

  return (
    <div className="dh-members-room">
      <DragonHero
        eyebrow="ЗАЛА ВАРТОВИХ"
        title="Учасники Dragon House"
        description="Живий довідник Dragon House: ролі, ранги, Discord-статус і сімейна історія в одній залі."
      >
        <div className="dh-members-hero-seals" aria-label="Стан учасників Dragon House">
          <DragonBadge tone="gold">Довідник варти</DragonBadge>
          <DragonBadge tone="success">{currentUser.nickname}</DragonBadge>
        </div>
      </DragonHero>

      <DragonPanel variant="ceremonial" className="dh-members-command-panel">
        <div>
          <p className="dh-dragon-eyebrow">СПИСОК ВАРТИ</p>
          <h2>{members.stats.totalMembers} учасників у залі</h2>
        </div>
        <div className="dh-members-command-actions">
          <DragonTabs tabs={VIEW_TABS} activeTab={members.view} onChange={members.setView} />
          <DragonButton type="button" variant="secondary" onClick={members.refresh} disabled={members.refreshing}>
            {members.refreshing ? 'Оновлюємо...' : 'Оновити'}
          </DragonButton>
        </div>
      </DragonPanel>

      {members.loading ? <DragonLoader label="Завантаження..." /> : null}
      {members.error ? <DragonRetry title="Не вдалося завантажити дані" description={members.error.message} onRetry={members.refresh} /> : null}

      <section className="dh-members-stats" aria-label="Коротка статистика учасників">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Учасники</span>
          <strong>{members.stats.totalMembers}</strong>
          <p>учасників у поточних фільтрах</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Активні</span>
          <strong>{members.stats.statusCounts.active ?? 0}</strong>
          <p>учасники з активним доступом</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Неактивні</span>
          <strong>{members.stats.statusCounts.inactive ?? 0}</strong>
          <p>архівовані або тимчасово неактивні учасники</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Дні народження</span>
          <strong>{members.stats.birthdayMembers}</strong>
          <p>відомі дати в сімейному календарі</p>
        </DragonCard>
      </section>

      <DragonSection eyebrow="ДНІ НАРОДЖЕННЯ" title="Найближчі дні народження">
        {members.upcomingBirthdays.length ? (
          <div className="dh-members-birthday-grid">
            {members.upcomingBirthdays.slice(0, 4).map((occurrence) => {
              const date = occurrence.birthday.date;
              const fallbackDate = date ? `--${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}` : null;
              return (
                <DragonCard key={occurrence.birthday.id} className={occurrence.isToday ? 'is-birthday-today' : ''}>
                  <div className="dh-members-birthday-card">
                    <DragonAvatar src={occurrence.birthday.avatarUrl} name={occurrence.birthday.memberName} />
                    <div>
                      <DragonBadge tone={occurrence.isToday ? 'gold' : 'success'}>
                        {occurrence.isToday ? 'Сьогодні' : `${occurrence.daysUntil} дн.`}
                      </DragonBadge>
                      <strong>{occurrence.birthday.memberName}</strong>
                      <p>
                        {formatDragonMemberBirthday(date?.isoDate ?? fallbackDate ?? undefined)}
                        {occurrence.age !== null ? ` · ${occurrence.age}` : ''}
                      </p>
                    </div>
                  </div>
                </DragonCard>
              );
            })}
          </div>
        ) : (
          <DragonEmptyState title="Даних поки немає" description="Дні народження з’являться тут, коли учасники відкриють день і місяць." />
        )}
      </DragonSection>

      <div className="dh-members-workbench">
        <DragonSection
          eyebrow="ФІЛЬТРИ"
          title="Пошук учасників"
          description="Фільтри працюють з офіційним довідником учасників."
        >
          <div className="dh-members-filters">
            <label>
              <span>Пошук</span>
              <DragonInput
                value={members.filters.search}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, search: event.currentTarget.value }))}
                placeholder="Нікнейм, роль або ранг"
                aria-label="Пошук учасників"
              />
            </label>
            <label>
              <span>Роль</span>
              <DragonSelect
                value={members.filters.role}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, role: event.currentTarget.value as DragonMemberRole | 'all' }))}
                aria-label="Фільтр за роллю"
              >
                <option value="all">Усі ролі</option>
                {Object.entries(DRAGON_MEMBER_ROLE_META).map(([role, meta]) => (
                  <option key={role} value={role}>
                    {meta.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Статус</span>
              <DragonSelect
                value={members.filters.status}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, status: event.currentTarget.value as DragonMemberStatus | 'all' }))}
                aria-label="Фільтр за статусом"
              >
                <option value="all">Усі статуси</option>
                {Object.entries(DRAGON_MEMBER_STATUS_META).map(([status, meta]) => (
                  <option key={status} value={status}>
                    {meta.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Рік вступу</span>
              <DragonSelect
                value={members.filters.joinYear}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, joinYear: event.currentTarget.value }))}
                aria-label="Фільтр за роком вступу"
              >
                <option value="">Будь-який рік</option>
                {members.joinYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Місяць народження</span>
              <DragonSelect
                value={members.filters.birthdayMonth}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, birthdayMonth: event.currentTarget.value }))}
                aria-label="Фільтр за місяцем народження"
              >
                <option value="">Будь-який місяць</option>
                {members.birthdayMonths.map((month) => (
                  <option key={month} value={month}>
                    {MONTH_LABELS[month]}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Сортування</span>
              <DragonSelect
                value={members.filters.sort}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, sort: event.currentTarget.value as DragonMembersSort }))}
                aria-label="Сортування учасників"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <DragonButton
              type="button"
              variant="ghost"
              onClick={() => members.setFilters((filters) => ({ ...filters, direction: filters.direction === 'asc' ? 'desc' : 'asc' }))}
            >
              {members.filters.direction === 'asc' ? 'За зростанням' : 'За спаданням'}
            </DragonButton>
            <DragonButton type="button" variant="ghost" onClick={members.clearFilters} disabled={!hasFilters}>
              Очистити
            </DragonButton>
          </div>
        </DragonSection>

        <DragonPanel variant="elevated" className="dh-members-roster-panel">
          {members.filteredMembers.length ? (
            <div className={members.view === 'grid' ? 'dh-members-grid' : 'dh-members-list'}>
              {members.filteredMembers.map((member) => (
                <DragonMemberCard key={member.id} member={member} view={members.view} onOpen={() => members.setSelectedMember(member)} />
              ))}
            </div>
          ) : (
            <DragonEmptyState title="Даних поки немає" description="Зміни фільтри або очисти пошук." />
          )}
        </DragonPanel>
      </div>

      <DragonDivider label="Ієрархія ролей" />

      <section className="dh-members-role-strip" aria-label="Ієрархія ролей Dragon House">
        {Object.entries(DRAGON_MEMBER_ROLE_META).map(([role, meta]) => (
          <DragonBadge key={role} tone={meta.tone} className={meta.className}>
            {meta.label}: {members.stats.roleCounts[role as DragonMemberRole]}
          </DragonBadge>
        ))}
      </section>

      {members.selectedMember ? <DragonMemberDetails member={members.selectedMember} onClose={() => members.setSelectedMember(null)} /> : null}
    </div>
  );
}

function DragonMemberCard({ member, view, onOpen }: { member: DragonMember; view: DragonMembersView; onOpen: () => void }) {
  const roleMeta = DRAGON_MEMBER_ROLE_META[member.role];
  const statusMeta = DRAGON_MEMBER_STATUS_META[member.status];
  const discordSyncState = getDragonMemberDiscordSyncState(member);
  const rankPower = Math.min(100, Math.max(0, member.rankLevel));

  return (
    <DragonCard interactive className={`dh-members-card ${view === 'list' ? 'is-list' : ''} ${roleMeta.className}`}>
      <div className="dh-members-card-crest" aria-hidden="true">
        {roleMeta.seal}
      </div>
      <div className="dh-members-card-head">
        <DragonAvatar src={member.avatarUrl} name={member.discordNickname} size={view === 'list' ? 'md' : 'lg'} />
        <div>
          <h3>{member.discordNickname}</h3>
          <p>{member.dragonTitle}</p>
        </div>
      </div>
      <div className="dh-members-card-badges">
        <DragonBadge tone={roleMeta.tone} className={roleMeta.className}>
          {roleMeta.label}
        </DragonBadge>
        <DragonBadge tone={statusMeta.tone} className={statusMeta.className}>
          {statusMeta.label}
        </DragonBadge>
        <DragonBadge tone={discordSyncState === 'synchronized' ? 'success' : discordSyncState === 'conflict' ? 'danger' : 'muted'}>
          {formatDragonMemberDiscordSyncState(discordSyncState)}
        </DragonBadge>
      </div>
      <dl className="dh-members-card-facts">
        <div>
          <dt>Ранг</dt>
          <dd>{member.rank}</dd>
        </div>
        <div>
          <dt>У сім’ї з</dt>
          <dd>{formatDragonMemberDate(member.joinedAt)}</dd>
        </div>
        <div>
          <dt>День народження</dt>
          <dd>{formatDragonMemberBirthday(member.birthday)}</dd>
        </div>
      </dl>
      <DragonProgress value={rankPower} label={`${member.discordNickname}: сила рангу`} />
      <div className="dh-members-card-actions">
        <DragonButton type="button" onClick={onOpen}>
          Деталі
        </DragonButton>
        <DragonButton type="button" variant="secondary" onClick={onOpen}>
          Профіль
        </DragonButton>
      </div>
    </DragonCard>
  );
}

function DragonMemberDetails({ member, onClose }: { member: DragonMember; onClose: () => void }) {
  const roleMeta = DRAGON_MEMBER_ROLE_META[member.role];
  const statusMeta = DRAGON_MEMBER_STATUS_META[member.status];

  return (
    <DragonDialog title={member.discordNickname} onClose={onClose}>
      <div className="dh-members-dialog-content">
        <div className="dh-members-dialog-identity">
          <DragonAvatar src={member.avatarUrl} name={member.discordNickname} size="lg" />
          <div>
            <p className="dh-dragon-eyebrow">{roleMeta.label}</p>
            <h3>{member.dragonTitle}</h3>
            <DragonBadge tone={statusMeta.tone} className={statusMeta.className}>
              {statusMeta.label}
            </DragonBadge>
          </div>
        </div>
        <dl>
          <div>
            <dt>Статичний ID</dt>
            <dd>{member.staticId}</dd>
          </div>
          <div>
            <dt>День народження</dt>
            <dd>{formatDragonMemberBirthday(member.birthday)}</dd>
          </div>
          <div>
            <dt>У сім’ї з</dt>
            <dd>{formatDragonMemberDate(member.joinedAt)}</dd>
          </div>
          <div>
            <dt>Ранг</dt>
            <dd>{member.rank}</dd>
          </div>
          <div>
            <dt>Стан Discord</dt>
            <dd>{member.voiceChannel ?? member.lastActiveAt ?? statusMeta.label}</dd>
          </div>
        </dl>
        <DragonSection eyebrow="Опис" title="Опис">
          <p>{member.dragonTitle}</p>
        </DragonSection>
        <DragonSection eyebrow="Статистика" title="Статистика">
          <DragonProgress value={Math.min(100, Math.max(0, member.rankLevel))} label={member.rank} />
        </DragonSection>
        <DragonSection eyebrow="Досягнення" title="Досягнення">
          <p>{roleMeta.seal}</p>
        </DragonSection>
        <DragonSection eyebrow="Права" title="Права">
          <p>{formatDragonMemberDiscordSyncState(getDragonMemberDiscordSyncState(member))}</p>
        </DragonSection>
      </div>
    </DragonDialog>
  );
}
