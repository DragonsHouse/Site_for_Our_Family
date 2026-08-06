import { useState } from 'react';
import type { ReactNode } from 'react';

function DiscordMark() {
  return (
    <svg className="dh-login-discord-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.7 5.1a16 16 0 0 0-4-1.2l-.2.4-.5 1a14 14 0 0 0-6 0 8 8 0 0 0-.7-1.4 16 16 0 0 0-4 1.2C1.8 8.9 1 12.6 1.3 16.2a16 16 0 0 0 4.9 2.5l1-1.7-1.6-.8.4-.3a11.4 11.4 0 0 0 12 0l.4.3-1.6.8 1 1.7a16 16 0 0 0 4.9-2.5c.4-4.2-.7-7.9-3-11.1ZM8.5 14.1c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.7 1.8-.8 1.8-1.7 1.8Zm7 0c-.9 0-1.7-.8-1.7-1.8s.8-1.8 1.7-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"
      />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg className="dh-login-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d={
          hidden
            ? 'M3 3l18 18M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6M9.9 5.2A9.7 9.7 0 0 1 12 5c5.2 0 8.4 4.5 9.4 6.5a12 12 0 0 1-2.8 3.6M6.5 6.9A13 13 0 0 0 2.6 11.5C3.6 13.5 6.8 18 12 18c1.1 0 2.2-.2 3.1-.6'
            : 'M2.6 12C3.6 10 6.8 5.5 12 5.5S20.4 10 21.4 12c-1 2-4.2 6.5-9.4 6.5S3.6 14 2.6 12Z'
        }
      />
      {!hidden ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
        />
      ) : null}
    </svg>
  );
}

export function LoginForm({
  error,
  loading,
  loadingMethod,
  loginValue,
  password,
  portalSoundControl,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  onDiscordLogin,
}: {
  error: string | null;
  loading: boolean;
  loadingMethod: 'password' | 'discord' | null;
  loginValue: string;
  password: string;
  portalSoundControl?: ReactNode;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onDiscordLogin: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const nickname = loginValue.trim();
  const passwordValue = password.trim();
  const validationMessage =
    loginValue && !nickname
      ? 'Введи нікнейм без самих пробілів.'
      : password && !passwordValue
        ? 'Введи пароль без самих пробілів.'
        : null;
  const passwordDisabled = loading || !nickname || !passwordValue || Boolean(validationMessage);
  const discordDisabled = loading;
  const messageId = 'dragon-house-login-message';

  return (
    <section className="dh-login-card" aria-labelledby="dragon-house-login-title">
      <div className="dh-login-heading">
        <p className="dh-login-kicker">DRAGON HOUSE</p>
        <h2 id="dragon-house-login-title">Вхід до Dragon House</h2>
        <p className="dh-login-copy">Полум’я впізнає своїх. Обери спосіб входу.</p>
        {portalSoundControl ? <div className="dh-login-sound-row">{portalSoundControl}</div> : null}
      </div>

      <form
        className="dh-login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!passwordDisabled) onSubmit();
        }}
      >
        <label>
          <span>Нікнейм</span>
          <input
            value={loginValue}
            onChange={(event) => onLoginChange(event.target.value)}
            autoComplete="username"
            placeholder="Наприклад Anastasia_Dragons"
            aria-invalid={Boolean(validationMessage || error)}
            aria-describedby={messageId}
          />
        </label>

        <label>
          <span>Пароль</span>
          <span className="dh-login-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="Введи пароль"
              aria-invalid={Boolean(validationMessage || error)}
              aria-describedby={messageId}
            />
            <button
              type="button"
              className="dh-login-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
              title={showPassword ? 'Приховати пароль' : 'Показати пароль'}
              disabled={loading}
            >
              <EyeIcon hidden={showPassword} />
            </button>
          </span>
        </label>

        <div id={messageId} aria-live="polite">
          {validationMessage ? <div className="dh-login-error">{validationMessage}</div> : null}
          {error ? <div className="dh-login-error">{error}</div> : null}
        </div>

        <button type="submit" disabled={passwordDisabled} className="dh-login-submit">
          {loadingMethod === 'password' ? 'Перевіряємо доступ...' : 'Увійти'}
        </button>
      </form>

      <div className="dh-login-divider" aria-hidden="true">
        <span />
        <strong>або</strong>
        <span />
      </div>

      <button type="button" className="dh-login-discord" onClick={onDiscordLogin} disabled={discordDisabled}>
        <span className="dh-login-discord-icon" aria-hidden="true">
          <DiscordMark />
        </span>
        <span>{loadingMethod === 'discord' ? 'Відкриваємо Discord...' : 'Увійти через Discord'}</span>
      </button>

      <p className="dh-login-footer">Доступ лише для учасників Dragon House.</p>
    </section>
  );
}
