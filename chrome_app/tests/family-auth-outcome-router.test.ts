import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { AuthOutcomeError, normalizeAuthFailure } from '../lib/family-outcome.ts';
import {
  routeDiscordLoginFailure,
  routePasswordLoginFailure,
  routeRestoreFailure,
  stateForAuthenticatedUser,
} from '../lib/family-onboarding-state.ts';
import type { FamilyUser } from '../lib/family-types.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('frontend auth outcome parser', () => {
  it('prioritizes outcome.code and preserves top-level localized display message', () => {
    const failure = normalizeAuthFailure(401, {
      error: 'session_required',
      message: 'Локалізоване повідомлення',
      outcome: {
        code: 'session_expired',
        message: 'Safe fallback contract message',
        onboardingState: 'session_expired',
      },
    });

    assert.equal(failure.outcome.code, 'session_expired');
    assert.equal(failure.displayMessage, 'Локалізоване повідомлення');
    assert.equal(failure.outcome.message, 'Safe fallback contract message');
  });

  it('supports legacy top-level error/message and HTTP fallback without message-text routing', () => {
    assert.equal(normalizeAuthFailure(403, { error: 'account_disabled', message: 'Акаунт деактивований.' }).outcome.code, 'account_deactivated');
    assert.equal(normalizeAuthFailure(401, { message: 'Сесія закінчилась' }).outcome.code, 'authentication_required');
    assert.equal(normalizeAuthFailure(418, { message: 'Сесія застаріла.' }).outcome.code, 'auth_unavailable');
  });
});

describe('frontend auth state router', () => {
  it('keeps invalid credentials and rate limits inline on login', () => {
    const invalid = routePasswordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(401, { error: 'invalid_credentials', message: 'Невірний login/static ID або пароль.' })));
    const limited = routePasswordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(429, { error: 'rate_limited', message: 'Забагато спроб.' })));

    assert.deepEqual(invalid, { kind: 'inline_error', message: 'Невірний login/static ID або пароль.' });
    assert.deepEqual(limited, { kind: 'inline_error', message: 'Забагато спроб.' });
  });

  it('routes password deactivation and mustChangePassword success explicitly', () => {
    const deactivated = routePasswordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(403, { error: 'account_disabled', message: 'Акаунт деактивований.' })));
    const passwordChange = routePasswordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(403, { error: 'password_change_required', message: 'Потрібно змінити пароль.' })));
    const user = familyUser({ mustChangePassword: true });

    assert.equal(deactivated.kind, 'screen');
    if (deactivated.kind === 'screen') assert.equal(deactivated.state.status, 'account_deactivated');
    assert.equal(passwordChange.kind, 'screen');
    if (passwordChange.kind === 'screen') assert.equal(passwordChange.state.status, 'change_password_required');
    assert.equal(stateForAuthenticatedUser(user, 'login').status, 'change_password_required');
  });

  it('routes backend-derived onboarding states before Hub access', () => {
    const missingStaticId = stateForAuthenticatedUser(
      familyUser({
        staticId: '',
        discordLinkStatus: 'linked',
        onboarding: {
          complete: false,
          state: 'static_id_required',
          requirements: {
            staticId: { satisfied: false },
            discordLink: { satisfied: true },
            inGameNickname: { satisfied: true },
            birthday: { satisfied: true, required: false },
          },
        },
      }),
      'restore',
    );
    const missingDiscord = stateForAuthenticatedUser(
      familyUser({
        onboarding: {
          complete: false,
          state: 'discord_link_required',
          requirements: {
            staticId: { satisfied: true, value: '41384' },
            discordLink: { satisfied: false },
            inGameNickname: { satisfied: true },
            birthday: { satisfied: true, required: false },
          },
        },
      }),
      'restore',
    );
    const missingBirthday = stateForAuthenticatedUser(
      familyUser({
        onboarding: {
          complete: false,
          state: 'birthday_required',
          requirements: {
            staticId: { satisfied: true, value: '41384' },
            discordLink: { satisfied: true },
            inGameNickname: { satisfied: true },
            birthday: { satisfied: false, required: true },
          },
        },
      }),
      'restore',
    );
    const complete = stateForAuthenticatedUser(familyUser(), 'restore');

    assert.equal(missingStaticId.status, 'static_id_required');
    assert.equal(missingDiscord.status, 'discord_link_required');
    assert.equal(missingBirthday.status, 'birthday_required');
    assert.equal(complete.status, 'authenticated');
  });

  it('routes legacy missing birthday to a completion prompt without blocking Hub access permanently', () => {
    const state = stateForAuthenticatedUser(
      familyUser({
        profileCompletion: {
          complete: false,
          state: 'birthday_required',
          legacyAccessAllowed: true,
          requirements: {
            birthday: { satisfied: false, required: true },
          },
        },
      }),
      'restore',
    );

    assert.equal(state.status, 'birthday_required');
    if (state.status === 'birthday_required') assert.equal(state.legacyAccessAllowed, true);
  });

  it('routes restore failures and preserves tokens on network/auth unavailable', () => {
    const expired = routeRestoreFailure(new AuthOutcomeError(normalizeAuthFailure(401, { error: 'session_expired', message: 'Сесія застаріла.' })));
    const invalid = routeRestoreFailure(new AuthOutcomeError(normalizeAuthFailure(401, { error: 'session_invalid', message: 'Сесія недійсна.' })));
    const unavailable = routeRestoreFailure(new TypeError('Failed to fetch'));

    assert.equal(expired.clearAuthSession, true);
    assert.equal(expired.state.status, 'session_expired');
    assert.equal(invalid.clearAuthSession, true);
    assert.equal(invalid.state.status, 'unauthenticated');
    assert.equal(unavailable.clearAuthSession, false);
    assert.equal(unavailable.state.status, 'auth_unavailable');
  });

  it('routes Discord onboarding outcomes to dedicated states', () => {
    const noLink = routeDiscordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(403, { error: 'DISCORD_ACCOUNT_NOT_LINKED', message: 'Discord link required.' })));
    const inactive = routeDiscordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(403, { error: 'MEMBER_INACTIVE', message: 'Inactive.' })));
    const denied = routeDiscordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(403, { error: 'MEMBER_ACCESS_DENIED', message: 'Denied.' })));

    assert.equal(noLink.kind, 'screen');
    assert.equal(inactive.kind, 'screen');
    assert.equal(denied.kind, 'screen');
    if (noLink.kind === 'screen') assert.equal(noLink.state.status, 'discord_link_required');
    if (inactive.kind === 'screen') assert.equal(inactive.state.status, 'account_deactivated');
    if (denied.kind === 'screen') assert.equal(denied.state.status, 'member_access_denied');
  });
});

describe('FamilyHubApp auth routing source contract', () => {
  it('uses the normalized routers and dedicated screens without rendering outcome.message directly', async () => {
    const source = await readSource('entrypoints/dashboard/family-hub-app.tsx');

    assert.match(source, /routeRestoreFailure/u);
    assert.match(source, /routePasswordLoginFailure/u);
    assert.match(source, /routeDiscordLoginFailure/u);
    assert.match(source, /status === 'session_expired'/u);
    assert.match(source, /status === 'discord_link_required'/u);
    assert.match(source, /status === 'static_id_required'/u);
    assert.match(source, /status === 'birthday_required'/u);
    assert.match(source, /updateCurrentStaticId/u);
    assert.match(source, /updateCurrentBirthday/u);
    assert.match(source, /ОСТАННІЙ ЕТАП ПОСВЯТИ/u);
    assert.match(source, /Полум’я чекає на останню печать/u);
    assert.match(source, /Полум’я впізнало тебе/u);
    assert.match(source, /Пропустити/u);
    assert.match(source, /Завершити посвяту/u);
    assert.match(source, /Увійти до Hub пізніше/u);
    assert.match(source, /Дата народження потрібна для сімейного календаря\. Іншим учасникам буде видно лише день і місяць\. Рік народження та вік не публікуються без окремого дозволу\./u);
    assert.match(source, /Discord підтверджено/u);
    assert.match(source, /Static ID прийнято/u);
    assert.match(source, /Дата народження — остання печать/u);
    assert.match(source, /min=\{BIRTHDAY_MIN_DATE\}/u);
    assert.match(source, /max=\{maxDate\}/u);
    assert.match(source, /Вкажи реальну дату народження не раніше 1970 року\./u);
    assert.match(source, /Дата народження не може бути в майбутньому\./u);
    assert.match(source, /Перевір дату — такого дня не існує\./u);
    assert.match(source, /Вкажи дату народження, щоб завершити посвяту\./u);
    assert.match(source, /aria-describedby="birthday-date-help birthday-date-error"/u);
    assert.match(source, /aria-invalid=\{Boolean\(visibleError\)\}/u);
    assert.match(source, /birthdaySubmitInFlightRef/u);
    assert.match(source, /Посвяту завершено/u);
    assert.match(source, /Dragon House приймає тебе до свого полум’я/u);
    assert.match(source, /sessionStorage\.setItem\(openingSessionKey, 'true'\)/u);
    assert.match(source, /prefersReducedMotion\(\)/u);
    assert.match(source, /useOnboardingAudio/u);
    assert.match(source, /status === 'account_deactivated'/u);
    assert.match(source, /status === 'member_access_denied'/u);
    assert.match(source, /status === 'auth_unavailable'/u);
    assert.doesNotMatch(source, /outcome\.message/u);
    assert.doesNotMatch(source, /message\.includes/u);
  });

  it('keeps onboarding audio optional and cleaned up by source contract', async () => {
    const screen = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const audio = await readSource('entrypoints/dashboard/hooks/use-onboarding-audio.ts');

    assert.match(screen, /Звук посвяти/u);
    assert.match(screen, /Увімкнути звук/u);
    assert.match(screen, /Вимкнути звук/u);
    assert.match(screen, /audio\.start\(\)/u);
    assert.doesNotMatch(screen, /autoPlay/u);
    assert.match(audio, /ONBOARDING_AUDIO_PREFERENCE_KEY/u);
    assert.match(audio, /new AudioContextClass\(\)/u);
    assert.match(audio, /window\.setInterval/u);
    assert.match(audio, /window\.clearInterval/u);
    assert.match(audio, /contextRef\.current\?\.close\(\)|context\?\.close\(\)/u);
    assert.match(audio, /droneRef\.current\?\.stop\(\)/u);
    assert.match(audio, /playConfirmation/u);
  });

  it('preserves auth-token-only clearing behavior in the backend auth client', async () => {
    const source = await readSource('lib/family-backend-auth-client.ts');

    assert.match(source, /throw new AuthOutcomeError\(failure\)/u);
    assert.match(source, /\/api\/family\/me\/static-id/u);
    assert.match(source, /\/api\/family\/me\/birthday/u);
    assert.match(source, /shouldClearAuthSessionForOutcome\(failure\.outcome\.code\)/u);
    assert.match(source, /error instanceof AuthOutcomeError && shouldClearAuthSessionForOutcome\(error\.failure\.outcome\.code\)/u);
    assert.doesNotMatch(source, /localStorage\.clear/u);
    assert.doesNotMatch(source, /chrome\.storage\.sync\.clear/u);
  });
});

function familyUser(overrides: Partial<FamilyUser> = {}): FamilyUser {
  return {
    id: 'member-1',
    nickname: 'Member_Dragons',
    staticId: '41384',
    passwordHash: null,
    mustChangePassword: false,
    role: 'member',
    rank: 'Rank 1',
    rankLevel: 1,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: 'Member_Dragons',
    avatarUrl: null,
    avatarDataUrl: null,
    status: 'offline',
    accountStatus: 'active',
    statusMessage: null,
    nextRank: null,
    promotionUpdatedAt: null,
    joinedAt: null,
    notes: null,
    permissions: [],
    stats: {
      tasksDone: 0,
      eventsJoined: 0,
      weeklyActivity: 0,
      contributionPoints: 0,
      questsTotal: 0,
      daysInFamily: 0,
      marks: 0,
      captureOrDefenseCount: 0,
      questsOrganized: 0,
      weeklyActivityDays: 0,
      brigadeLeadDays: 0,
      newMembersTrained: 0,
    },
    tasks: [],
    deletedAt: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordServerNickname: null,
    discordAvatarUrl: null,
    discordLinkedAt: null,
    discordSyncedAt: null,
    discordLinkStatus: 'not_linked',
    onboarding: {
      complete: true,
      state: 'complete',
      requirements: {
        staticId: { satisfied: true, value: '41384' },
        discordLink: { satisfied: true },
        inGameNickname: { satisfied: true },
        birthday: { satisfied: true, required: false },
      },
    },
    profileCompletion: {
      complete: true,
      state: 'complete',
      legacyAccessAllowed: false,
      requirements: {
        birthday: { satisfied: true, required: true },
      },
    },
    externalSource: 'family_hub',
    externalId: 'member-1',
    externalRevision: null,
    externalCreatedAt: null,
    externalUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: 'local_only',
    syncError: null,
    ...overrides,
  };
}
