import {
  createElement as h,
  useId,
  type ElementType,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { DragonPanel, DragonStatusMessage } from './primitives.ts';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type DragonRoomRailItem<T extends string = string> = {
  key: T;
  label: string;
  room?: string;
  description?: string;
  icon?: ReactNode;
  locked?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  ariaLabel?: string;
};

export type DragonRoomShellProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  navigation?: ReactNode;
  header?: ReactNode;
  statusArea?: ReactNode;
  secondaryPanel?: ReactNode;
  compact?: boolean;
  labelledBy?: string;
  describedBy?: string;
};

export function DragonRoomShell({
  as: Component = 'section',
  navigation,
  header,
  statusArea,
  secondaryPanel,
  compact = false,
  labelledBy,
  describedBy,
  children,
  className,
  ...props
}: DragonRoomShellProps) {
  return h(
    Component,
    {
      ...props,
      className: cx('dh-dragon-room-shell', compact && 'is-compact', className),
      'aria-labelledby': labelledBy ?? props['aria-labelledby'],
      'aria-describedby': describedBy ?? props['aria-describedby']
    },
    navigation ? h('div', { className: 'dh-dragon-room-shell-navigation' }, navigation) : null,
    header ? h('div', { className: 'dh-dragon-room-shell-header' }, header) : null,
    statusArea ? h('div', { className: 'dh-dragon-room-shell-status' }, statusArea) : null,
    h(
      'div',
      { className: cx('dh-dragon-room-shell-layout', Boolean(secondaryPanel) && 'has-secondary-panel') },
      h(DragonRoomBody, null, children),
      secondaryPanel ? h(DragonRoomPanel, null, secondaryPanel) : null
    )
  );
}

export type DragonRoomHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  titleId?: string;
};

export function DragonRoomHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  metadata,
  actions,
  headingLevel = 2,
  titleId,
  className,
  ...props
}: DragonRoomHeaderProps) {
  const generatedTitleId = useId();
  const Heading = `h${headingLevel}` as ElementType;
  const headingId = titleId ?? generatedTitleId;

  return h(
    'header',
    { ...props, className: cx('dh-dragon-room-header', className) },
    h(
      'div',
      { className: 'dh-dragon-room-header-main' },
      breadcrumbs ? h('div', { className: 'dh-dragon-room-breadcrumbs' }, breadcrumbs) : null,
      eyebrow ? h('p', { className: 'dh-dragon-eyebrow' }, eyebrow) : null,
      h(Heading, { id: headingId }, title),
      description ? h('p', { className: 'dh-dragon-room-description' }, description) : null,
      metadata ? h('div', { className: 'dh-dragon-room-metadata' }, metadata) : null
    ),
    actions ? h('div', { className: 'dh-dragon-room-actions' }, actions) : null
  );
}

export function DragonRoomBody({
  as: Component = 'div',
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return h(Component, { ...props, className: cx('dh-dragon-room-body', className) });
}

export type DragonRoomRailProps<T extends string = string> = HTMLAttributes<HTMLElement> & {
  items: Array<DragonRoomRailItem<T>>;
  activeItem: T;
  onItemSelect: (item: T) => void;
  label?: string;
  compact?: boolean;
};

export function DragonRoomRail<T extends string>({
  items,
  activeItem,
  onItemSelect,
  label = 'Dragon House rooms',
  compact = false,
  className,
  ...props
}: DragonRoomRailProps<T>) {
  const visibleItems = items.filter((item) => !item.hidden);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;

    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
    if (currentIndex === -1) return;

    event.preventDefault();

    const lastIndex = buttons.length - 1;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? currentIndex === 0
              ? lastIndex
              : currentIndex - 1
            : currentIndex === lastIndex
              ? 0
              : currentIndex + 1;

    buttons[nextIndex]?.focus();
  }

  return h(
    'nav',
    {
      ...props,
      className: cx('dh-dragon-room-rail', compact && 'is-compact', className),
      'aria-label': label,
      onKeyDown: handleKeyDown
    },
    visibleItems.map((item) => {
      const unavailable = item.disabled || item.locked;
      const active = activeItem === item.key;
      return h(
        'button',
        {
          key: item.key,
          type: 'button',
          className: cx('dh-dragon-room-rail-item', active && 'is-active', item.locked && 'is-locked'),
          onClick: () => {
            if (!unavailable) onItemSelect(item.key);
          },
          disabled: item.disabled,
          'aria-current': active ? 'page' : undefined,
          'aria-disabled': item.locked ? 'true' : undefined,
          'aria-label': item.ariaLabel ?? (compact ? `${item.label}${item.room ? `, ${item.room}` : ''}` : undefined)
        },
        item.icon ? h('span', { className: 'dh-dragon-room-rail-icon', 'aria-hidden': 'true' }, item.icon) : null,
        h('span', { className: 'dh-dragon-room-rail-label' }, item.label),
        item.room ? h('small', null, item.room) : null,
        item.locked ? h('span', { className: 'dh-dragon-room-rail-lock' }, 'Locked') : null
      );
    })
  );
}

export function DragonRoomPanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return h(
    'aside',
    { ...props, className: cx('dh-dragon-room-panel', className) },
    h(DragonPanel, null, children)
  );
}

export function DragonRoomStatusArea({
  children,
  tone = 'info',
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: 'info' | 'success' | 'warning' | 'error' | 'loading' }) {
  if (!children) return null;
  return h(
    DragonStatusMessage,
    { ...props, tone, className: cx('dh-dragon-room-status-area', className), children },
    children
  );
}
