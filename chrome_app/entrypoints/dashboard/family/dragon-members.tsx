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
import { formatDragonMemberBirthday, formatDragonMemberDate, getDragonMemberDiscordSyncState } from './members-service';
import { useDragonMembersState } from './members-state';

const VIEW_TABS: Array<{ key: DragonMembersView; label: string; room: string }> = [
  { key: 'grid', label: 'Grid', room: 'Guardian Wall' },
  { key: 'list', label: 'List', room: 'Name Ledger' }
];

const SORT_OPTIONS: Array<{ value: DragonMembersSort; label: string }> = [
  { value: 'role', label: 'Dragon role' },
  { value: 'rank', label: 'Rank power' },
  { value: 'nickname', label: 'Nickname' },
  { value: 'joinedAt', label: 'Join date' },
  { value: 'status', label: 'Status' }
];

const MONTH_LABELS: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December'
};

export function DragonMembers({ currentUser }: { currentUser: FamilyUser }) {
  const members = useDragonMembersState();
  const hasFilters =
    Boolean(members.filters.search) ||
    members.filters.role !== 'all' ||
    members.filters.status !== 'all' ||
    Boolean(members.filters.joinYear) ||
    Boolean(members.filters.birthdayMonth);

  return (
    <div className="dh-members-room">
      <DragonHero
        eyebrow="HALL OF GUARDIANS"
        title="Dragon Members"
        description="The living directory of Dragon House: roles, ranks, Discord presence and future family history gathered inside one fortress hall."
      >
        <div className="dh-members-hero-seals" aria-label="Dragon Members status">
          <DragonBadge tone="gold">Guardian Directory</DragonBadge>
          <DragonBadge tone="success">{currentUser.nickname}</DragonBadge>
        </div>
      </DragonHero>

      <DragonPanel variant="ceremonial" className="dh-members-command-panel">
        <div>
          <p className="dh-dragon-eyebrow">GUARDIAN ROSTER</p>
          <h2>{members.stats.totalMembers} members in the hall</h2>
        </div>
        <div className="dh-members-command-actions">
          <DragonTabs tabs={VIEW_TABS} activeTab={members.view} onChange={members.setView} />
          <DragonButton type="button" variant="secondary" onClick={members.refresh} disabled={members.refreshing}>
            {members.refreshing ? 'Refreshing' : 'Refresh'}
          </DragonButton>
        </div>
      </DragonPanel>

      {members.loading ? <DragonLoader label="Dragon Members opens the Hall of Guardians" /> : null}
      {members.error ? <DragonRetry title="Guardians did not answer" description={members.error.message} onRetry={members.refresh} /> : null}

      <section className="dh-members-stats" aria-label="Dragon Members quick statistics">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Members</span>
          <strong>{members.stats.totalMembers}</strong>
          <p>guardians visible in current filters</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Online</span>
          <strong>{members.stats.onlineMembers}</strong>
          <p>active flames in the fortress</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Voice</span>
          <strong>{members.stats.inVoiceMembers}</strong>
          <p>members inside Discord voice halls</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Birthdays</span>
          <strong>{members.stats.birthdayMembers}</strong>
          <p>known family calendar seals</p>
        </DragonCard>
      </section>

      <DragonSection eyebrow="BIRTHDAY CHAMBER" title="Upcoming birthday flames">
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
                        {occurrence.isToday ? 'Today' : `${occurrence.daysUntil} days`}
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
          <DragonEmptyState title="No birthday flames yet" description="Birthdays will appear here when members share visible day and month data." />
        )}
      </DragonSection>

      <div className="dh-members-workbench">
        <DragonSection
          eyebrow="GUARDIAN FILTERS"
          title="Search the hall"
          description="Filters work over the mock repository now and are ready for the future Discord-backed API repository."
        >
          <div className="dh-members-filters">
            <label>
              <span>Search</span>
              <DragonInput
                value={members.filters.search}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, search: event.currentTarget.value }))}
                placeholder="Nickname, role or family rank"
                aria-label="Search Dragon Members"
              />
            </label>
            <label>
              <span>Role</span>
              <DragonSelect
                value={members.filters.role}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, role: event.currentTarget.value as DragonMemberRole | 'all' }))}
                aria-label="Filter Dragon Members by role"
              >
                <option value="all">All roles</option>
                {Object.entries(DRAGON_MEMBER_ROLE_META).map(([role, meta]) => (
                  <option key={role} value={role}>
                    {meta.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Status</span>
              <DragonSelect
                value={members.filters.status}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, status: event.currentTarget.value as DragonMemberStatus | 'all' }))}
                aria-label="Filter Dragon Members by status"
              >
                <option value="all">All statuses</option>
                {Object.entries(DRAGON_MEMBER_STATUS_META).map(([status, meta]) => (
                  <option key={status} value={status}>
                    {meta.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Join year</span>
              <DragonSelect
                value={members.filters.joinYear}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, joinYear: event.currentTarget.value }))}
                aria-label="Filter Dragon Members by join year"
              >
                <option value="">Any year</option>
                {members.joinYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Birthday month</span>
              <DragonSelect
                value={members.filters.birthdayMonth}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, birthdayMonth: event.currentTarget.value }))}
                aria-label="Filter Dragon Members by birthday month"
              >
                <option value="">Any month</option>
                {members.birthdayMonths.map((month) => (
                  <option key={month} value={month}>
                    {MONTH_LABELS[month]}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Sort</span>
              <DragonSelect
                value={members.filters.sort}
                onChange={(event) => members.setFilters((filters) => ({ ...filters, sort: event.currentTarget.value as DragonMembersSort }))}
                aria-label="Sort Dragon Members"
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
              {members.filters.direction === 'asc' ? 'Ascending' : 'Descending'}
            </DragonButton>
            <DragonButton type="button" variant="ghost" onClick={members.clearFilters} disabled={!hasFilters}>
              Clear
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
            <DragonEmptyState title="No guardians found" description="Change filters or clear the current seals to reveal the hall again." />
          )}
        </DragonPanel>
      </div>

      <DragonDivider label="Role Hierarchy" />

      <section className="dh-members-role-strip" aria-label="Dragon role hierarchy">
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
          Discord {discordSyncState}
        </DragonBadge>
      </div>
      <dl className="dh-members-card-facts">
        <div>
          <dt>Rank</dt>
          <dd>{member.rank}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{formatDragonMemberDate(member.joinedAt)}</dd>
        </div>
        <div>
          <dt>Birthday</dt>
          <dd>{formatDragonMemberBirthday(member.birthday)}</dd>
        </div>
      </dl>
      <DragonProgress value={rankPower} label={`${member.discordNickname} rank power`} />
      <div className="dh-members-card-actions">
        <DragonButton type="button" onClick={onOpen}>
          Details
        </DragonButton>
        <DragonButton type="button" variant="secondary" onClick={onOpen}>
          Profile
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
            <dt>Static ID</dt>
            <dd>{member.staticId}</dd>
          </div>
          <div>
            <dt>Birthday</dt>
            <dd>{formatDragonMemberBirthday(member.birthday)}</dd>
          </div>
          <div>
            <dt>Join date</dt>
            <dd>{formatDragonMemberDate(member.joinedAt)}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>{member.rank}</dd>
          </div>
          <div>
            <dt>Discord presence</dt>
            <dd>{member.voiceChannel ?? member.lastActiveAt ?? statusMeta.label}</dd>
          </div>
        </dl>
        <DragonDivider label="Future Chambers" />
        <div className="dh-members-dialog-placeholders">
          <DragonCard>
            <strong>Biography</strong>
            <p>Reserved for the member story, oath and Dragon House history.</p>
          </DragonCard>
          <DragonCard>
            <strong>Statistics</strong>
            <p>Future activity, event and contribution metrics will appear here.</p>
          </DragonCard>
          <DragonCard>
            <strong>Achievements</strong>
            <p>Future badges, seals and milestones are ready for backend data.</p>
          </DragonCard>
          <DragonCard>
            <strong>Permissions</strong>
            <p>Future permission visibility stays separate from the current mock directory.</p>
          </DragonCard>
        </div>
      </div>
    </DragonDialog>
  );
}
