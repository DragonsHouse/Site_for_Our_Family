import { useState } from 'react';
import { DragonHouseCrest } from '../family/dragon-house-crest';
import { RememberMeCheckbox } from './RememberMeCheckbox';

export function LoginForm({
  error,
  loading,
  loginValue,
  password,
  rememberMe,
  onLoginChange,
  onPasswordChange,
  onRememberMeChange,
  onDiscordLogin,
  onSubmit,
}: {
  error: string | null;
  loading: boolean;
  loginValue: string;
  password: string;
  rememberMe: boolean;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onDiscordLogin: () => void;
  onSubmit: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="dh-login-card w-full max-w-lg">
      <div className="dh-login-crest-row">
        <DragonHouseCrest slot="dragon_house_logo" size="lg" />
        <div>
          <p className="dh-login-kicker">Dragon House</p>
          <h1>Ласкаво просимо до Dragon House</h1>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-lg font-semibold text-amber-100">Твоє місце у сім’ї вже чекає.</p>
        <p className="text-sm leading-6 text-slate-300">
          Увійди через Discord, щоб відкрити свій профіль, роль і доступ до Family Hub.
          Доступ доступний тільки чинним учасникам Dragon House.
        </p>
      </div>

      <button type="button" disabled={loading} className="dh-login-submit mt-6" onClick={onDiscordLogin}>
        {loading ? 'Відкриваємо Discord...' : 'Увійти через Discord'}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        <span>резервний вхід</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form
        className="dh-login-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          <span>Login або Static ID</span>
          <input
            value={loginValue}
            onChange={(event) => onLoginChange(event.target.value)}
            autoComplete="username"
            placeholder="Anastasia_Dragons або 41384"
          />
        </label>

        <label>
          <span>Пароль / static ID</span>
          <div className="dh-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="Static ID для першого входу"
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Показати або сховати пароль">
              {showPassword ? 'Сховати' : 'Показати'}
            </button>
          </div>
        </label>

        <RememberMeCheckbox checked={rememberMe} onChange={onRememberMeChange} />

        {error ? <div className="dh-login-error">{error}</div> : null}

        <button
          type="submit"
          disabled={loading || !loginValue.trim() || !password.trim()}
          className="dh-login-submit"
        >
          {loading ? 'Перевіряємо печатки...' : 'Увійти до штабу'}
        </button>
      </form>

      <p className="dh-login-footer">Discord підтверджує особу. Family Hub відкриває тільки вже створений профіль.</p>
    </section>
  );
}
