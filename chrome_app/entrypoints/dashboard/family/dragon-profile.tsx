import { useMemo } from 'react';
import type { FamilyUser } from '../../../lib/family-types';
import { createBackendDragonAchievementRepository } from '../../../lib/family-achievements-read-adapter';
import {
  DragonAvatar,
  DragonBadge,
  DragonCard,
  DragonHero,
  DragonLoader,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection
} from '../dragon-ui/dragon-ui';
import { DragonAchievementCard, DragonActivityHeatmap, DragonStatisticCard, DragonTimeline } from './dragon-profile-components';
import { FamilyMemberActivityPanel } from './family-member-activity-panel';
import { FamilyPersonalAccountingPanel } from './family-personal-accounting-panel';
import { formatDragonBirthday } from './birthday-service';
import { DRAGON_PROFILE_STATUS_META, type DragonProfileAchievement, type DragonProfileAchievementRarity } from './profile-models';
import type { DragonAchievement } from './achievement-models';
import { formatDragonProfileDate } from './profile-service';
import { useDragonProfileState } from './profile-state';
import { useDragonAchievementState } from './achievement-state';

export function DragonProfile({ user }: { user: FamilyUser }) {
  const chamber = useDragonProfileState(user);
  const achievementRepository = useMemo(() => createBackendDragonAchievementRepository(user.id), [user.id]);
  const profileAchievements = useDragonAchievementState(achievementRepository);
  const { profile } = chamber;
  const identity = profile.identity;
  const statusMeta = DRAGON_PROFILE_STATUS_META[identity.currentStatus] ?? DRAGON_PROFILE_STATUS_META.offline;

  return (
    <div className="dh-profile-room" data-profile-member="authenticated" data-dragon-profile="profile-room">
      <DragonHero
        eyebrow="Профіль"
        title="Профіль дракона"
        description="Особиста зала з профілем, рангом, активністю, нагородами та доступами."
        className="dh-profile-hero"
      >
        <div className="dh-profile-hero-aside" aria-label="Стан профілю">
          <DragonAvatar src={identity.avatarUrl} name={identity.discordNickname} size="lg" />
          <div>
            <DragonBadge tone={statusMeta.tone} className={statusMeta.className}>
              {statusMeta.label}
            </DragonBadge>
            <DragonBadge tone="gold">{identity.currentRank}</DragonBadge>
          </div>
        </div>
      </DragonHero>

      <DragonPanel variant="ceremonial" className="dh-profile-banner">
        <div className="dh-profile-banner-mark" aria-hidden="true">
          Профіль
        </div>
        <div className="dh-profile-banner-identity">
          <DragonAvatar src={identity.avatarUrl} name={identity.discordNickname} size="lg" />
          <div>
            <p className="dh-dragon-eyebrow">{identity.currentRank}</p>
            <h2>{identity.dragonName}</h2>
            <p>{identity.dragonTitle}</p>
          </div>
        </div>
        <dl className="dh-profile-hero-facts">
          <div>
            <dt>Discord</dt>
            <dd>{identity.discordNickname}</dd>
          </div>
          <div>
            <dt>Статичний ID</dt>
            <dd>{identity.staticId}</dd>
          </div>
          <div>
            <dt>У сім’ї з</dt>
            <dd>{formatDragonProfileDate(identity.joinDate)}</dd>
          </div>
          <div>
            <dt>Гілка</dt>
            <dd>{identity.familyBranch}</dd>
          </div>
        </dl>
      </DragonPanel>

      {chamber.loading ? <DragonLoader label="Завантаження..." /> : null}
      {chamber.error ? <DragonRetry title="Не вдалося завантажити дані" description={chamber.error.message} onRetry={chamber.refresh} /> : null}

      <section className="dh-profile-command-stats" aria-label="Dragon Profile command totals">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Відкриті відзнаки</span>
          <strong>{profileAchievements.statistics.unlocked}</strong>
          <p>Підтверджені досягнення</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Легендарні</span>
          <strong>{profileAchievements.statistics.legendaryCount}</strong>
          <p>Особливі відзнаки</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Доступи</span>
          <strong>{chamber.primaryStats.grantedPermissions}</strong>
          <p>Надані права</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Активність</span>
          <strong>{chamber.primaryStats.activityTotal}</strong>
          <p>Балів активності з backend профілю</p>
        </DragonCard>
      </section>

      <FamilyPersonalAccountingPanel memberId={user.id} />
      <FamilyMemberActivityPanel memberId={user.id} />

      <DragonSection eyebrow="Профіль" title="Особисті дані">
        <div className="dh-profile-identity-grid">
          {[
            ['Аватар', identity.avatarUrl ? 'Власне зображення' : 'Даних поки немає'],
            ['Ім’я дракона', identity.dragonName],
            ['Discord nickname', identity.discordNickname],
            ['Титул', identity.dragonTitle],
            ['Поточний ранг', `${identity.currentRank} (${identity.rankLevel})`],
            ['Ранг', identity.currentRank],
            ['Дата народження', formatDragonBirthday(identity.birthday)],
            ['У сім’ї з', formatDragonProfileDate(identity.joinDate)],
            ['Поточний стан', statusMeta.label],
            ['Статичний ID', identity.staticId],
            ['Гілка сім’ї', identity.familyBranch]
          ].map(([label, value]) => (
            <DragonCard key={label} className="dh-profile-identity-card">
              <span>{label}</span>
              <strong>{value}</strong>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Статистика" title="Показники профілю">
        <div className="dh-profile-stat-grid">
          {profile.statistics.map((statistic) => (
            <DragonStatisticCard key={statistic.id} statistic={statistic} />
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Нагороди" title="Досягнення">
        {profileAchievements.loading ? <DragonLoader label="Завантаження..." /> : null}
        {profileAchievements.error ? <DragonRetry title="Не вдалося завантажити дані" description={profileAchievements.error.message} onRetry={profileAchievements.refresh} /> : null}
        <div className="dh-profile-achievement-grid">
          {profileAchievements.achievements.map((achievement) => (
            <DragonAchievementCard key={achievement.id} achievement={toProfileAchievement(achievement)} />
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Історія" title="Хроніка профілю">
        <DragonTimeline events={chamber.timeline} />
      </DragonSection>

      <DragonSection eyebrow="Інвентар" title="Особистий інвентар">
        <div className="dh-profile-inventory-grid">
          {profile.inventory.map((category) => (
            <DragonCard key={category.id} className="dh-profile-inventory-card">
              <h3>{category.title}</h3>
              <p>{category.description}</p>
              <div>
                {category.slots.map((slot) => (
                  <span key={slot.id} className={`is-${slot.state}`}>
                    {slot.label}
                  </span>
                ))}
              </div>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Доступи" title="Права та доступи">
        <div className="dh-profile-permission-grid">
          {profile.permissions.map((permission) => (
            <DragonCard key={permission.id} className={`dh-profile-permission-seal ${permission.granted ? 'is-granted' : 'is-sealed'}`}>
              <div aria-hidden="true">{permission.granted ? 'Відкрито' : 'Закрито'}</div>
              <h3>{permission.label}</h3>
              <p>{permission.description}</p>
              <DragonBadge tone={permission.granted ? 'success' : 'muted'}>{permission.granted ? 'Надано' : 'Немає доступу'}</DragonBadge>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Активність" title="Карта активності">
        <DragonActivityHeatmap days={profile.activity} />
      </DragonSection>

      <DragonPanel variant="ceremonial" className="dh-profile-rank-progress">
        <div>
          <p className="dh-dragon-eyebrow">Прогрес рангу</p>
          <h2>
            {profile.progress.currentRank} → {profile.progress.nextRank}
          </h2>
          <p>{profile.progress.futureXp == null ? 'Даних поки немає' : `XP: ${profile.progress.futureXp}`}</p>
        </div>
        <div>
          <strong>{profile.progress.progress}%</strong>
          <DragonProgress value={profile.progress.progress} label="Прогрес рангу" />
        </div>
        <div className="dh-profile-requirements">
          {profile.progress.requirements.map((requirement) => (
            <DragonCard key={requirement.id} className={requirement.completed ? 'is-complete' : 'is-pending'}>
              <span>{requirement.completed ? 'Виконано' : 'Очікує'}</span>
              <strong>{requirement.label}</strong>
              <p>
                {requirement.currentValue} / {requirement.requiredValue}
              </p>
            </DragonCard>
          ))}
        </div>
      </DragonPanel>

      <DragonSection eyebrow="Discord" title="Discord-профіль">
        <div className="dh-profile-discord-grid">
          {profile.discord.map((item) => (
            <DragonCard key={item.id} className={`dh-profile-discord-card is-${item.state}`}>
              <span className="dh-dragon-eyebrow">{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.backendField}</p>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

    </div>
  );
}

function toProfileAchievement(achievement: DragonAchievement): DragonProfileAchievement {
  return {
    id: achievement.id,
    backendAchievementId: achievement.backendAchievementId,
    icon: achievement.icon,
    title: achievement.title,
    description: achievement.description,
    state: achievement.visibility === 'secret' ? 'secret' : achievement.completed ? 'unlocked' : 'locked',
    rarity: toProfileAchievementRarity(achievement.rarity),
    unlockedAt: achievement.completedAt ?? null,
    progress: achievement.progressMax > 0 ? Math.round((achievement.progress / achievement.progressMax) * 100) : achievement.progress
  };
}

function toProfileAchievementRarity(rarity: DragonAchievement['rarity']): DragonProfileAchievementRarity {
  if (rarity === 'legendary' || rarity === 'mythic') return 'legendary';
  if (rarity === 'rare' || rarity === 'epic') return 'rare';
  return 'common';
}
