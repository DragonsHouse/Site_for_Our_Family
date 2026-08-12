import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const emberGateSource = readFileSync(new URL('../entrypoints/dashboard/auth/DragonEmberGate.tsx', import.meta.url), 'utf8');
const emberGateStyles = readFileSync(new URL('../entrypoints/dashboard/auth/ember-gate.css', import.meta.url), 'utf8');
const familyHubSource = readFileSync(new URL('../entrypoints/dashboard/family-hub-app.tsx', import.meta.url), 'utf8');
const familyShellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const dragonBackgroundSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-background.tsx', import.meta.url), 'utf8');
const loginFormSource = readFileSync(new URL('../entrypoints/dashboard/auth/LoginForm.tsx', import.meta.url), 'utf8');
const assetSource = readFileSync(new URL('../lib/family-assets.ts', import.meta.url), 'utf8');
const authClientSource = readFileSync(new URL('../lib/family-backend-auth-client.ts', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Ember Gate entrance frame composition', () => {
  it('uses the provided PNG as a frame with a form region anchored to the arch opening', () => {
    [
      'dh-ember-gate',
      'dh-ember-gate-citadel',
      'ember-gate-heading',
      'dh-ember-gate-scene',
      'dh-ember-gate-frame',
      'dh-ember-gate-arch-backdrop',
      'dh-ember-gate-arch-video',
      'dh-ember-gate-sound-toggle',
      'dh-ember-gate-matte-layer',
      'dh-ember-gate-form-panel',
    ].forEach((className) => assert.match(emberGateSource, new RegExp(className)));

    assert.match(emberGateSource, /DRAGON_HOUSE_ASSETS\.emberGateBackground/);
    assert.match(emberGateSource, /DRAGON_HOUSE_ASSETS\.loginPortalMotion/);
    assert.match(emberGateSource, /DRAGON_HOUSE_ASSETS\.portalAmbientAudio/);
    assert.doesNotMatch(emberGateSource, /dh-ember-gate-portal/);
    assert.match(assetSource, /login-portal-background\.mp4/);
    assert.match(emberGateSource, /<video[\s\S]*?className="dh-ember-gate-arch-video"[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline/);
    assert.match(emberGateSource, /left:\s*1142/);
    assert.match(emberGateSource, /top:\s*245/);
    assert.match(emberGateSource, /width:\s*265/);
    assert.match(emberGateSource, /height:\s*547/);
    assert.match(emberGateSource, /<img className="dh-ember-gate-frame"/);
    assert.match(emberGateSource, /const content = isValidElement/);
    assert.match(emberGateSource, /portalSoundControl/);
    assert.match(assetSource, /dragon-house-login-entrance\.png/);
  });

  it('does not redraw, erase or replace the frame artwork with CSS arch layers', () => {
    [
      /dh-ember-gate-background/,
      /dh-ember-gate-backdrop/,
      /dh-ember-gate-arch-fill/,
      /dh-ember-gate-auth-niche/,
      /background-image:\s*url/,
    ].forEach((pattern) => {
      assert.doesNotMatch(emberGateSource, pattern);
      assert.doesNotMatch(emberGateStyles, pattern);
    });

    assert.match(emberGateStyles, /--ember-gate-native-width:\s*1726/);
    assert.match(emberGateStyles, /--ember-gate-native-height:\s*911/);
    assert.match(emberGateStyles, /html,\s*body,\s*#root\s*\{[\s\S]*?overflow:\s*hidden/);
    assert.match(emberGateStyles, /\.dh-ember-gate\s*\{[\s\S]*?position:\s*fixed/);
    assert.match(emberGateStyles, /\.dh-ember-gate-scene\s*\{[\s\S]*?position:\s*absolute/);
    assert.match(emberGateStyles, /\.dh-ember-gate-scene\s*\{[\s\S]*?inset:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-scene\s*\{[\s\S]*?max-width:\s*none/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*left:\s*var\(--ember-gate-rendered-left\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*top:\s*var\(--ember-gate-rendered-top\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*width:\s*var\(--ember-gate-rendered-width\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*height:\s*var\(--ember-gate-rendered-height\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*max-width:\s*none/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*max-height:\s*none/);
    assert.match(emberGateSource, /CENTER_ARCH_UNDER_ASPECT_RATIO = 1\.15/);
    assert.match(emberGateSource, /viewportWidth \/ viewportHeight < CENTER_ARCH_UNDER_ASPECT_RATIO/);
    assert.match(emberGateSource, /viewportWidth \/ 2 - archCenter/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*object-fit:\s*contain/);
    assert.doesNotMatch(emberGateStyles, /aspect-ratio:\s*var\(--ember-gate-native-width\)/);
    assert.doesNotMatch(emberGateStyles, /calc\(var\(--ember-gate-native-width\)\s*\*\s*1px\)/);
    assert.match(emberGateSource, /scale = Math\.max\(viewportWidth \/ ENTRANCE_SOURCE\.width, viewportHeight \/ ENTRANCE_SOURCE\.height\)/);
    assert.match(emberGateSource, /: \(viewportWidth - renderedWidth\) \/ 2/);
    assert.match(emberGateSource, /verticalOffset = \(viewportHeight - renderedHeight\) \/ 2/);
    assert.match(emberGateStyles, /\.dh-ember-gate-form-panel\s*\{[\s\S]*?left:\s*var\(--ember-gate-form-left\)/);
    assert.match(emberGateStyles, /--ember-gate-form-left:\s*1142px/);
    assert.match(emberGateStyles, /--ember-gate-form-top:\s*245px/);
    assert.match(emberGateStyles, /--ember-gate-form-width:\s*265px/);
    assert.match(emberGateStyles, /--ember-gate-form-height:\s*547px/);
    assert.match(emberGateStyles, /\.dh-ember-gate-scene\s*\{[^}]*z-index:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?position:\s*absolute/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?left:\s*var\(--ember-gate-form-left\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?top:\s*var\(--ember-gate-form-top\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?width:\s*var\(--ember-gate-form-width\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?height:\s*var\(--ember-gate-form-height\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?z-index:\s*1/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?z-index:\s*2/);
    assert.match(emberGateStyles, /\.dh-ember-gate-frame\s*\{[\s\S]*?z-index:\s*2/);
    assert.match(emberGateStyles, /\.dh-ember-gate-form-panel\s*\{[\s\S]*?z-index:\s*3/);
    assert.match(emberGateStyles, /--ember-gate-arch-shape:\s*polygon\(/);
    assert.match(emberGateStyles, /0 22\.85%/);
    assert.match(emberGateStyles, /49\.81% 4\.2%/);
    assert.match(emberGateStyles, /99\.62% 23\.58%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?clip-path:\s*var\(--ember-gate-arch-shape\)/);
    assert.match(emberGateStyles, /dragon-house-login-arch-mask\.png/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?-webkit-mask-image:\s*url\('\/assets\/dragon-house\/illustrations\/dragon-house-login-arch-mask\.png'\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?mask-image:\s*url\('\/assets\/dragon-house\/illustrations\/dragon-house-login-arch-mask\.png'\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?mask-size:\s*100% 100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?mask-repeat:\s*no-repeat/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?mask-mode:\s*alpha/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[\s\S]*?contain:\s*paint/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?z-index:\s*1/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?inset:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?width:\s*100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?height:\s*100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?mask-image:\s*url\('\/assets\/dragon-house\/illustrations\/dragon-house-login-arch-mask\.png'\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?mask-size:\s*100% 100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?mask-mode:\s*alpha/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?clip-path:\s*var\(--ember-gate-arch-shape\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?object-fit:\s*cover/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[\s\S]*?opacity:\s*0\.92/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-arch-video\s*\{[^}]*filter:/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-scene::before/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop::before\s*\{[\s\S]*?content:\s*none/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-arch-backdrop::after/);
    assert.doesNotMatch(emberGateSource, /dh-ember-gate-arch-matte/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-arch-matte/);
    assert.match(emberGateSource, /<video[\s\S]*?className="dh-ember-gate-arch-video"[\s\S]*?\/>\s*<div className="dh-ember-gate-matte-layer" \/>/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?z-index:\s*1/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?position:\s*absolute/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?inset:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?padding:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?overflow:\s*hidden/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?mask-image:\s*url\('\/assets\/dragon-house\/illustrations\/dragon-house-login-arch-mask\.png'\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?mask-size:\s*100% 100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?mask-mode:\s*alpha/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer\s*\{[\s\S]*?clip-path:\s*var\(--ember-gate-arch-shape\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?inset:\s*0/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?clip-path:\s*var\(--ember-gate-arch-shape\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?width:\s*100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?height:\s*100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?backdrop-filter:\s*blur\(10px\) saturate\(1\.12\) brightness\(1\.06\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?mask-image:\s*url\('\/assets\/dragon-house\/illustrations\/dragon-house-login-arch-mask\.png'\)/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?mask-size:\s*100% 100%/);
    assert.match(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?mask-mode:\s*alpha/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?mask-composite:/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-matte-layer::before\s*\{[\s\S]*?border:\s*3px solid/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-form-panel::before/);
    assert.match(emberGateStyles, /\.dh-ember-gate \.dh-login-card\s*\{[\s\S]*?z-index:\s*1/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate \.dh-login-card::before/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[^}]*padding:/);
    assert.match(emberGateStyles, /\.dh-ember-gate-arch-backdrop\s*\{[^}]*pointer-events:\s*none/);
    assert.match(emberGateStyles, /\.dh-ember-gate-form-panel\s*\{[\s\S]*?box-sizing:\s*border-box/);
    assert.match(emberGateStyles, /\.dh-ember-gate-form-panel\s*\{[\s\S]*?padding:\s*clamp/);
    assert.match(emberGateStyles, /\.dh-ember-gate-form-panel\s*\{[\s\S]*?pointer-events:\s*none/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-portal/);
    assert.doesNotMatch(emberGateStyles, /dh-portal-/);
    assert.equal((emberGateStyles.match(/backdrop-filter:\s*blur\(/g) ?? []).length, 1);
    assert.doesNotMatch(emberGateSource, /dh-ember-gate-portal-matte/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-portal-matte/);
    assert.match(emberGateStyles, /\.dh-ember-gate \.dh-login-card\s*\{[\s\S]*?background:\s*transparent/);
    assert.match(emberGateStyles, /\.dh-ember-gate \.dh-login-card\s*\{[\s\S]*?backdrop-filter:\s*none/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate \.dh-login-card\s*\{[^}]*(?:radial-gradient|linear-gradient|repeating-linear-gradient)/);
    assert.match(emberGateStyles, /\.dh-ember-gate \.dh-oauth-gate-card\s*\{[\s\S]*?backdrop-filter:\s*none/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate \.dh-oauth-gate-card\s*\{[^}]*(?:radial-gradient|linear-gradient|repeating-linear-gradient|backdrop-filter:\s*blur)/);
    assert.doesNotMatch(emberGateStyles, /transform:\s*scale/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*backdrop-filter/);
    assert.doesNotMatch(emberGateStyles, /\.dh-ember-gate-frame\s*\{[^}]*(?:^|[{\s;])filter\s*:/);
  });

  it('keeps opt-in ambient sound without a second visual portal layer', () => {
    [/useLoadingSequence/, /image_generate/i, /parallax/i, /gate movement/i].forEach((pattern) => {
      assert.doesNotMatch(emberGateSource, pattern);
      assert.doesNotMatch(emberGateStyles, pattern);
    });

    assert.match(emberGateSource, /portalSoundEnabled/);
    assert.match(emberGateSource, /audioRef/);
    assert.match(emberGateSource, /PORTAL_AMBIENCE_VOLUME = 0\.16/);
    assert.match(emberGateSource, /audio\.play\(\)/);
    assert.match(emberGateSource, /audio\.pause\(\)/);
    assert.match(emberGateSource, /audio\.volume = 0/);
    assert.match(emberGateSource, /preload="none"/);
    assert.match(assetSource, /dragon_house_portal_fire_dragon_mix\.mp3/);
    assert.doesNotMatch(emberGateStyles, /@keyframes dh-portal-/);
  });

  it('uses centralized tokens, assets and imports the frame stylesheet', () => {
    assert.match(emberGateStyles, /var\(--dragon-/);
    assert.match(emberGateStyles, /color-mix/);
    assert.doesNotMatch(emberGateStyles, /#[0-9a-fA-F]{3,8}/);
    assert.match(styleSource, /@import '\.\/auth\/ember-gate\.css';/);
    assert.match(assetSource, /login_portal_background/);
    assert.match(assetSource, /post_login_background/);
    assert.match(assetSource, /portalAmbientAudio/);
    assert.match(familyShellSource, /useFamilyAssetUrl\('post_login_background'\)/);
    assert.match(familyShellSource, /assetUrl=\{postLoginBackgroundUrl\}/);
    assert.match(dragonBackgroundSource, /dh-dragon-bg-custom-asset/);
  });

  it('adopts the frame around password and Discord login methods', () => {
    assert.match(familyHubSource, /import \{ DragonEmberGate \} from '\.\/auth\/DragonEmberGate';/);
    assert.match(familyHubSource, /<DragonEmberGate>\s*<LoginScreen[\s\S]*<\/DragonEmberGate>/);
    assert.match(familyHubSource, /portalSoundControl=\{portalSoundControl\}/);
    assert.match(familyHubSource, /loginWithPassword\(nickname,\s*loginPassword,\s*true\)/);
    assert.match(familyHubSource, /loginWithDiscord\(\)/);
    assert.match(familyHubSource, /error=\{error\}/);
    assert.match(familyHubSource, /loading=\{loading\}/);
    assert.match(familyHubSource, /loadingMethod=\{loginLoadingMethod\}/);
    assert.match(familyHubSource, /loginValue=\{nickname\}/);
    assert.match(familyHubSource, /password=\{password\}/);
    assert.match(familyHubSource, /onLoginChange=\{onNicknameChange\}/);
    assert.match(familyHubSource, /onPasswordChange=\{onPasswordChange\}/);
    assert.match(familyHubSource, /onSubmit=\{onSubmit\}/);
    assert.match(familyHubSource, /onDiscordLogin=\{onDiscordLogin\}/);
    assert.match(loginFormSource, /function DiscordMark/);
    assert.match(loginFormSource, /dh-login-discord-mark/);
    assert.doesNotMatch(loginFormSource, /dh-login-discord-icon" aria-hidden="true">D</);
    assert.match(loginFormSource, /type=\{showPassword \? 'text' : 'password'\}/);
    assert.match(loginFormSource, /function EyeIcon/);
    assert.match(loginFormSource, /dh-login-sound-row/);

    assert.match(loginFormSource, /dh-login-eye-icon/);
    assert.match(loginFormSource, /Увійти через Discord/);
    assert.match(loginFormSource, /Показати пароль/);
    assert.doesNotMatch(loginFormSource, /RememberMeCheckbox/);
    assert.doesNotMatch(loginFormSource, /DragonHouseCrest/);
    assert.doesNotMatch(loginFormSource, /dh-login-crest-row/);
  });

  it('keeps authentication logic outside Ember Gate and sends nickname/password to the backend', () => {
    [/loginWithNickname/, /loginWithDiscord/, /clearAuthSession/, /loadCurrentBackendFamilyUser/, /authState/, /setAuthState/].forEach((pattern) =>
      assert.doesNotMatch(emberGateSource, pattern),
    );

    assert.match(authClientSource, /export async function login\(loginOrStaticId: string, password: string/);
    assert.match(authClientSource, /\/api\/auth\/login/);
    assert.match(authClientSource, /export async function loginWithDiscord/);
    assert.match(authClientSource, /\/api\/auth\/discord\/start/);
    assert.match(authClientSource, /\/api\/auth\/discord\/complete/);
    assert.match(authClientSource, /await setSessionToken\(result\.token, rememberMe \? 'persistent' : 'session'\)/);
    assert.match(familyHubSource, /async function restoreStoredSession/);
    assert.match(familyHubSource, /async function handleLogin/);
  });

  it('preserves LoginForm behavior and accessible heading hierarchy', () => {
    assert.match(loginFormSource, /export function LoginForm\(\{/);
    assert.match(loginFormSource, /event\.preventDefault\(\);/);
    assert.match(loginFormSource, /if \(!passwordDisabled\) onSubmit\(\);/);
    assert.match(loginFormSource, /disabled=\{passwordDisabled\}/);
    assert.match(loginFormSource, /disabled=\{discordDisabled\}/);
    assert.match(loginFormSource, /aria-live="polite"/);
    assert.match(loginFormSource, /dh-login-heading/);
    assert.match(loginFormSource, /Вхід до Dragon House/);
    assert.match(loginFormSource, /Полум’я впізнає своїх/);
    assert.match(loginFormSource, /Нікнейм/);
    assert.match(loginFormSource, /Показати пароль/);
    assert.match(loginFormSource, /Перевіряємо доступ/);
    assert.match(loginFormSource, /Увійти/);
    assert.doesNotMatch(loginFormSource, /<h1>/);
  });

  it('includes Ember Gate in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-ember-gate\.test\.ts/);
  });
});

