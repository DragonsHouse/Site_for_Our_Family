import type { FamilyUser } from '../../../lib/family-types';
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
import { DRAGON_PROFILE_STATUS_META } from './profile-models';
import { formatDragonProfileDate } from './profile-service';
import { useDragonProfileState } from './profile-state';

export function DragonProfile({ user }: { user: FamilyUser }) {
  const chamber = useDragonProfileState(user);
  const { profile } = chamber;
  const identity = profile.identity;
  const statusMeta = DRAGON_PROFILE_STATUS_META[identity.currentStatus];

  return (
    <div className="dh-profile-room" data-profile-member="authenticated" data-dragon-profile="command-chamber">
      <DragonHero
        eyebrow="DRAGON COMMAND CHAMBER"
        title={identity.bannerTitle}
        description="A personal fortress chamber for identity, rank, history, achievements, permissions, inventory and future Discord presence."
        className="dh-profile-hero"
      >
        <div className="dh-profile-hero-aside" aria-label="Dragon Profile status">
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
          Command Seal
        </div>
        <div className="dh-profile-banner-identity">
          <DragonAvatar src={identity.avatarUrl} name={identity.discordNickname} size="lg" />
          <div>
            <p className="dh-dragon-eyebrow">{identity.element}</p>
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
            <dt>Static ID</dt>
            <dd>{identity.staticId}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDragonProfileDate(identity.joinDate)}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{identity.familyBranch}</dd>
          </div>
        </dl>
      </DragonPanel>

      {chamber.loading ? <DragonLoader label="Dragon Profile opens the Command Chamber" /> : null}
      {chamber.error ? <DragonRetry title="Command Chamber did not open" description={chamber.error.message} onRetry={chamber.refresh} /> : null}

      <section className="dh-profile-command-stats" aria-label="Dragon Profile command totals">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Unlocked seals</span>
          <strong>{chamber.primaryStats.achievementsUnlocked}</strong>
          <p>achievements active in this chamber</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Legendary</span>
          <strong>{chamber.primaryStats.legendaryAchievements}</strong>
          <p>legendary seals tracked for future backend</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Permissions</span>
          <strong>{chamber.primaryStats.grantedPermissions}</strong>
          <p>granted magical seals</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Activity fire</span>
          <strong>{chamber.primaryStats.activityTotal}</strong>
          <p>mock heatmap energy</p>
        </DragonCard>
      </section>

      <DragonSection eyebrow="DRAGON IDENTITY" title="Identity command seal">
        <div className="dh-profile-identity-grid">
          {[
            ['Avatar', identity.avatarUrl ? 'Custom image' : 'Dragon Avatar seal'],
            ['Dragon Name', identity.dragonName],
            ['Discord Nickname', identity.discordNickname],
            ['Dragon Title', identity.dragonTitle],
            ['Current Rank', `${identity.currentRank} (${identity.rankLevel})`],
            ['Element', identity.element],
            ['Birthday', formatDragonProfileDate(identity.birthday)],
            ['Join Date', formatDragonProfileDate(identity.joinDate)],
            ['Current Status', statusMeta.label],
            ['Static ID', identity.staticId],
            ['Family Branch', identity.familyBranch]
          ].map(([label, value]) => (
            <DragonCard key={label} className="dh-profile-identity-card">
              <span>{label}</span>
              <strong>{value}</strong>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="DRAGON STATISTICS" title="Command statistics">
        <div className="dh-profile-stat-grid">
          {profile.statistics.map((statistic) => (
            <DragonStatisticCard key={statistic.id} statistic={statistic} />
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="ACHIEVEMENTS" title="Seals and hidden honors">
        <div className="dh-profile-achievement-grid">
          {chamber.achievements.map((achievement) => (
            <DragonAchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="DRAGON TIMELINE" title="Chronicle of the chamber">
        <DragonTimeline events={chamber.timeline} />
      </DragonSection>

      <DragonSection eyebrow="DRAGON INVENTORY" title="Vault inventory">
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

      <DragonSection eyebrow="PERMISSIONS" title="Magical permission seals">
        <div className="dh-profile-permission-grid">
          {profile.permissions.map((permission) => (
            <DragonCard key={permission.id} className={`dh-profile-permission-seal ${permission.granted ? 'is-granted' : 'is-sealed'}`}>
              <div aria-hidden="true">{permission.granted ? 'Open' : 'Sealed'}</div>
              <h3>{permission.label}</h3>
              <p>{permission.description}</p>
              <DragonBadge tone={permission.granted ? 'success' : 'muted'}>{permission.backendPermissionKey}</DragonBadge>
            </DragonCard>
          ))}
        </div>
      </DragonSection>

      <DragonSection eyebrow="ACTIVITY HEATMAP" title="Chamber activity fire">
        <DragonActivityHeatmap days={profile.activity} />
      </DragonSection>

      <DragonPanel variant="ceremonial" className="dh-profile-rank-progress">
        <div>
          <p className="dh-dragon-eyebrow">DRAGON RANK PROGRESS</p>
          <h2>
            {profile.progress.currentRank} to {profile.progress.nextRank}
          </h2>
          <p>Future XP: {profile.progress.futureXp ?? 'reserved for backend'}</p>
        </div>
        <div>
          <strong>{profile.progress.progress}%</strong>
          <DragonProgress value={profile.progress.progress} label="Dragon Rank Progress" />
        </div>
        <div className="dh-profile-requirements">
          {profile.progress.requirements.map((requirement) => (
            <DragonCard key={requirement.id} className={requirement.completed ? 'is-complete' : 'is-pending'}>
              <span>{requirement.completed ? 'Complete' : 'Pending'}</span>
              <strong>{requirement.label}</strong>
              <p>
                {requirement.currentValue} / {requirement.requiredValue}
              </p>
            </DragonCard>
          ))}
        </div>
      </DragonPanel>

      <DragonSection eyebrow="FUTURE DISCORD" title="Discord integration chamber">
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
