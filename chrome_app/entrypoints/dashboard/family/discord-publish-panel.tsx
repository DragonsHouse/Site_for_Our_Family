import { useEffect, useState } from 'react';
import { DragonBadge, DragonButton, DragonCard, DragonRetry, DragonSkeleton } from '../dragon-ui/dragon-ui';
import type { FamilyDiscordPublishState } from '../../../lib/family-discord-orchestration-client';
import {
  getFamilyEventDiscordState,
  getQuestDiscordState,
  getTowerDefenseDiscordState,
  publishFamilyEventToDiscord,
  publishQuestToDiscord,
  publishTowerDefenseToDiscord,
  syncFamilyEventToDiscord,
  syncQuestToDiscord,
  syncTowerDefenseToDiscord
} from '../../../lib/family-discord-orchestration-client';

type DiscordPublishTarget = 'quest' | 'tower' | 'event';

export function DiscordPublishPanel({ target, sourceId }: { target: DiscordPublishTarget; sourceId: string }) {
  const [state, setState] = useState<FamilyDiscordPublishState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      setState(await getState(target, sourceId, signal));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Discord state request failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [target, sourceId]);

  async function runPublishSync() {
    if (mutating) return;
    setMutating(true);
    setError(null);
    try {
      const next = state?.published ? await syncTarget(target, sourceId) : await publishTarget(target, sourceId);
      setState(next);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Discord publish request failed.');
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return (
      <DragonCard className="space-y-2">
        <span className="dh-dragon-eyebrow">Discord</span>
        <DragonSkeleton className="h-16" />
      </DragonCard>
    );
  }

  return (
    <DragonCard className="space-y-3" data-discord-publish-panel="backend">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="dh-dragon-eyebrow">Discord</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <DragonBadge tone={badgeTone(state?.state ?? 'unpublished')}>{discordStateLabel(state?.state ?? 'unpublished')}</DragonBadge>
            {state?.channelLabel ? <span className="text-sm text-slate-400">{state.channelLabel}</span> : null}
          </div>
        </div>
        <DragonButton type="button" variant={state?.published ? 'secondary' : undefined} disabled={mutating} onClick={() => void runPublishSync()}>
          {mutating ? 'Синхронізуємо...' : state?.published ? 'Оновити в Discord' : 'Опублікувати в Discord'}
        </DragonButton>
      </div>
      {state?.lastSyncedAt ? <p className="text-sm text-slate-400">Остання синхронізація: {formatDate(state.lastSyncedAt)}</p> : <p className="text-sm text-slate-400">Повідомлення Discord ще не створювалось.</p>}
      {error ? (
        <DragonRetry
          title="Discord sync не виконано"
          description={error}
          onRetry={() => void (state?.published ? runPublishSync() : load())}
        />
      ) : null}
    </DragonCard>
  );
}

function getState(target: DiscordPublishTarget, sourceId: string, signal?: AbortSignal) {
  if (target === 'quest') return getQuestDiscordState(sourceId, signal);
  if (target === 'tower') return getTowerDefenseDiscordState(sourceId, signal);
  return getFamilyEventDiscordState(sourceId, signal);
}

function publishTarget(target: DiscordPublishTarget, sourceId: string) {
  if (target === 'quest') return publishQuestToDiscord(sourceId);
  if (target === 'tower') return publishTowerDefenseToDiscord(sourceId);
  return publishFamilyEventToDiscord(sourceId);
}

function syncTarget(target: DiscordPublishTarget, sourceId: string) {
  if (target === 'quest') return syncQuestToDiscord(sourceId);
  if (target === 'tower') return syncTowerDefenseToDiscord(sourceId);
  return syncFamilyEventToDiscord(sourceId);
}

function discordStateLabel(state: FamilyDiscordPublishState['state']): string {
  if (state === 'published') return 'Опубліковано';
  if (state === 'synced') return 'Синхронізовано';
  if (state === 'error') return 'Помилка синхронізації';
  return 'Не опубліковано';
}

function badgeTone(state: FamilyDiscordPublishState['state']) {
  if (state === 'published' || state === 'synced') return 'success';
  if (state === 'error') return 'danger';
  return 'muted';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
