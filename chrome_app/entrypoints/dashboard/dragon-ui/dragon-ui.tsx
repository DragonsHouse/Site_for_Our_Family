import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { DragonBackgroundVariant } from './dragon-theme';
import { DragonBackground } from './dragon-background';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export { DragonBackground };
export type { DragonBackgroundVariant };

export function DragonPanel({
  children,
  className,
  variant = 'default'
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'ceremonial';
}) {
  return <section className={cx('dh-dragon-panel', `dh-dragon-panel-${variant}`, className)}>{children}</section>;
}

export function DragonCard({
  children,
  className,
  interactive = false
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return <article className={cx('dh-dragon-card', interactive && 'is-interactive', className)}>{children}</article>;
}

export function DragonSection({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <DragonPanel className={cx('dh-dragon-section', className)}>
      <div className="dh-dragon-section-head">
        {eyebrow ? <p className="dh-dragon-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="dh-dragon-section-body">{children}</div> : null}
    </DragonPanel>
  );
}

export function DragonHero({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <DragonPanel variant="ceremonial" className={cx('dh-dragon-hero', className)}>
      <div>
        {eyebrow ? <p className="dh-dragon-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="dh-dragon-hero-aside">{children}</div> : null}
    </DragonPanel>
  );
}

export function DragonButton({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button {...props} className={cx('dh-dragon-button', `dh-dragon-button-${variant}`, className)}>
      {children}
    </button>
  );
}

export function DragonBadge({
  children,
  className,
  tone = 'ember'
}: {
  children: ReactNode;
  className?: string;
  tone?: 'ember' | 'gold' | 'success' | 'muted' | 'danger';
}) {
  return <span className={cx('dh-dragon-badge', `dh-dragon-badge-${tone}`, className)}>{children}</span>;
}

export function DragonInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('dh-dragon-input', className)} />;
}

export function DragonTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('dh-dragon-input dh-dragon-textarea', className)} />;
}

export function DragonSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx('dh-dragon-input dh-dragon-select', className)}>
      {children}
    </select>
  );
}

export function DragonDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx('dh-dragon-divider', className)} role="separator">
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function DragonTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className
}: {
  tabs: Array<{ key: T; label: string; room?: string }>;
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}) {
  return (
    <nav className={cx('dh-dragon-tabs', className)} aria-label="Dragon House navigation">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cx('dh-dragon-tab', activeTab === tab.key && 'is-active')}
          aria-current={activeTab === tab.key ? 'page' : undefined}
        >
          <span>{tab.label}</span>
          {tab.room ? <small>{tab.room}</small> : null}
        </button>
      ))}
    </nav>
  );
}

export function DragonProgress({
  value,
  label,
  className
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx('dh-dragon-progress', className)}
      aria-label={label ?? 'Dragon House progress'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      role="progressbar"
    >
      <span style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function DragonLoader({ label = 'Dragon House відкриває залу' }: { label?: string }) {
  return (
    <div className="dh-dragon-loader" role="status">
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

export function DragonEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <DragonCard className="dh-dragon-empty">
      <div className="dh-dragon-empty-seal" aria-hidden="true" />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </DragonCard>
  );
}

export function DragonDialog({
  title,
  children,
  actions,
  onClose
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="dh-dragon-dialog-backdrop" role="presentation">
      <section className="dh-dragon-dialog" role="dialog" aria-modal="true" aria-labelledby="dh-dragon-dialog-title">
        <div className="dh-dragon-dialog-head">
          <h2 id="dh-dragon-dialog-title">{title}</h2>
          {onClose ? (
            <DragonButton type="button" variant="ghost" onClick={onClose} aria-label="Закрити діалог">
              Закрити
            </DragonButton>
          ) : null}
        </div>
        <div>{children}</div>
        {actions ? <footer>{actions}</footer> : null}
      </section>
    </div>
  );
}

export function DragonToast({ children, tone = 'ember' }: { children: ReactNode; tone?: 'ember' | 'success' | 'danger' }) {
  return (
    <div className={cx('dh-dragon-toast', `dh-dragon-toast-${tone}`)} role="status">
      {children}
    </div>
  );
}

export function DragonTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="dh-dragon-tooltip">
      {children}
      <span role="tooltip">{label}</span>
    </span>
  );
}

export function DragonAvatar({
  src,
  name,
  size = 'md'
}: {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span className={cx('dh-dragon-avatar', `dh-dragon-avatar-${size}`)} aria-label={name}>
      {src ? <img src={src} alt={name} /> : <strong aria-hidden="true">{initials}</strong>}
    </span>
  );
}
