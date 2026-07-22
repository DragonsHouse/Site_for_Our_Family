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
  onSubmit: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="dh-login-card">
      <div className="dh-login-crest-row">
        <DragonHouseCrest slot="dragon_house_logo" size="sm" />
        <div>
          <p className="dh-login-kicker">Dragon House</p>
          <h1>Dragon House Family Hub</h1>
        </div>
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

      <p className="dh-login-footer">Полум’я єднає. Честь веде. Сім’я понад усе.</p>
    </section>
  );
}
