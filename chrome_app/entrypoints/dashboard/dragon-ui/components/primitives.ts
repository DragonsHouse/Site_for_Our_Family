import {
  cloneElement,
  createElement as h,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ElementType,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function describedBy(...ids: Array<string | false | null | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined;
}

export type DragonButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'ghost';

type DragonButtonSharedProps = {
  children: ReactNode;
  className?: string;
  variant?: DragonButtonVariant;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

type DragonButtonAsButtonProps = DragonButtonSharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type DragonButtonAsLinkProps = DragonButtonSharedProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    disabled?: boolean;
    type?: never;
  };

export type DragonButtonProps = DragonButtonAsButtonProps | DragonButtonAsLinkProps;

export function DragonButton({
  children,
  className,
  variant = 'primary',
  loading = false,
  leadingIcon,
  trailingIcon,
  ...props
}: DragonButtonProps) {
  const variantClass = variant === 'ghost' ? 'quiet' : variant;
  const content = [
    loading
      ? h('span', {
          key: 'spinner',
          className: 'dh-dragon-button-spinner',
          'aria-hidden': 'true'
        })
      : null,
    leadingIcon
      ? h(
          'span',
          {
            key: 'leading',
            className: 'dh-dragon-button-icon',
            'aria-hidden': 'true'
          },
          leadingIcon
        )
      : null,
    h('span', { key: 'label', className: 'dh-dragon-button-label' }, children),
    trailingIcon
      ? h(
          'span',
          {
            key: 'trailing',
            className: 'dh-dragon-button-icon',
            'aria-hidden': 'true'
          },
          trailingIcon
        )
      : null
  ];

  const classNames = cx(
    'dh-dragon-button',
    `dh-dragon-button-${variantClass}`,
    variant !== variantClass && `dh-dragon-button-${variant}`,
    loading && 'is-loading',
    className
  );

  if ('href' in props && props.href) {
    const { disabled, onClick, ...anchorProps } = props;
    const unavailable = disabled || loading;

    return h(
      'a',
      {
        ...anchorProps,
        href: props.href,
        className: classNames,
        'aria-busy': loading || undefined,
        'aria-disabled': unavailable || undefined,
        tabIndex: unavailable ? -1 : props.tabIndex,
        onClick: (event) => {
          if (unavailable) {
            event.preventDefault();
            return;
          }
          onClick?.(event as MouseEvent<HTMLAnchorElement>);
        }
      },
      content
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return h(
    'button',
    {
      ...buttonProps,
      type: buttonProps.type ?? 'button',
      className: classNames,
      disabled: buttonProps.disabled || loading,
      'aria-busy': loading || undefined
    },
    content
  );
}

export type DragonInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-describedby'> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  success?: ReactNode;
  leadingVisual?: ReactNode;
  trailingVisual?: ReactNode;
  inputClassName?: string;
};

export function DragonInput({
  id,
  className,
  inputClassName,
  label,
  description,
  error,
  success,
  leadingVisual,
  trailingVisual,
  required,
  disabled,
  ...props
}: DragonInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const successId = success && !error ? `${inputId}-success` : undefined;
  const input = h('input', {
    ...props,
    key: 'input',
    id: inputId,
    required,
    disabled,
    className: cx('dh-dragon-input', Boolean(leadingVisual || trailingVisual) && 'dh-dragon-input-with-visuals', inputClassName),
    'aria-invalid': error ? true : props['aria-invalid'],
    'aria-describedby': describedBy(descriptionId, errorId, successId)
  });

  if (!label && !description && !error && !success && !leadingVisual && !trailingVisual) return input;

  return h(
    'label',
    {
      className: cx(
        'dh-dragon-field',
        disabled && 'is-disabled',
        Boolean(error) && 'has-error',
        Boolean(success && !error) && 'has-success',
        className
      ),
      htmlFor: inputId
    },
    [
      label
        ? h('span', { key: 'label', className: 'dh-dragon-field-label' }, [
            h('span', { key: 'text' }, label),
            required ? h('span', { key: 'required', 'aria-hidden': 'true' }, '*') : null
          ])
        : null,
      description ? h('span', { key: 'description', id: descriptionId, className: 'dh-dragon-field-description' }, description) : null,
      h('span', { key: 'control', className: 'dh-dragon-input-shell' }, [
        leadingVisual ? h('span', { key: 'leading', className: 'dh-dragon-input-visual', 'aria-hidden': 'true' }, leadingVisual) : null,
        input,
        trailingVisual ? h('span', { key: 'trailing', className: 'dh-dragon-input-visual', 'aria-hidden': 'true' }, trailingVisual) : null
      ]),
      error ? h('span', { key: 'error', id: errorId, className: 'dh-dragon-field-error' }, error) : null,
      success && !error ? h('span', { key: 'success', id: successId, className: 'dh-dragon-field-success' }, success) : null
    ]
  );
}

export type DragonCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
};

export function DragonCheckbox({
  id,
  className,
  label,
  description,
  error,
  indeterminate = false,
  disabled,
  onCheckedChange,
  ...props
}: DragonCheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return h(
    'label',
    {
      className: cx('dh-dragon-check', disabled && 'is-disabled', Boolean(error) && 'has-error', className)
    },
    [
      h('input', {
        ...props,
        key: 'input',
        ref: inputRef,
        id: inputId,
        type: 'checkbox',
        disabled,
        'aria-invalid': error ? true : props['aria-invalid'],
        'aria-describedby': describedBy(descriptionId, errorId),
        onChange: (event) => onCheckedChange?.(event.currentTarget.checked, event)
      }),
      h('span', { key: 'box', className: 'dh-dragon-check-box', 'aria-hidden': 'true' }),
      h('span', { key: 'copy', className: 'dh-dragon-check-copy' }, [
        h('span', { key: 'label', className: 'dh-dragon-check-label' }, label),
        description ? h('span', { key: 'description', id: descriptionId, className: 'dh-dragon-check-description' }, description) : null,
        error ? h('span', { key: 'error', id: errorId, className: 'dh-dragon-field-error' }, error) : null
      ])
    ]
  );
}

export type DragonToggleProps = Omit<DragonCheckboxProps, 'error' | 'indeterminate'>;

export function DragonToggle({ className, ...props }: DragonToggleProps) {
  return h(DragonCheckbox, {
    ...props,
    className: cx('dh-dragon-toggle', className),
    role: 'switch'
  });
}

export type DragonBadgeTone =
  | 'neutral'
  | 'active'
  | 'warning'
  | 'danger'
  | 'ceremonial'
  | 'permission'
  | 'ember'
  | 'gold'
  | 'success'
  | 'muted';

export function DragonBadge({
  children,
  className,
  tone = 'neutral',
  compact = false
}: {
  children: ReactNode;
  className?: string;
  tone?: DragonBadgeTone;
  compact?: boolean;
}) {
  const toneClass =
    tone === 'ember'
      ? 'active'
      : tone === 'gold'
        ? 'ceremonial'
        : tone === 'success'
          ? 'permission'
          : tone === 'muted'
            ? 'neutral'
            : tone;

  return h(
    'span',
    {
      className: cx(
        'dh-dragon-badge',
        `dh-dragon-badge-${toneClass}`,
        tone !== toneClass && `dh-dragon-badge-${tone}`,
        compact && 'dh-dragon-badge-compact',
        className
      )
    },
    children
  );
}

export type DragonPanelVariant = 'mounted' | 'raised' | 'sealed' | 'critical' | 'default' | 'elevated' | 'ceremonial';

export type DragonPanelProps<T extends ElementType = 'section'> = {
  as?: T;
  children: ReactNode;
  className?: string;
  variant?: DragonPanelVariant;
  title?: ReactNode;
  description?: ReactNode;
  headingLevel?: 2 | 3 | 4;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'title'>;

export function DragonPanel<T extends ElementType = 'section'>({
  as,
  children,
  className,
  variant = 'mounted',
  title,
  description,
  headingLevel = 2,
  ...props
}: DragonPanelProps<T>) {
  const Component = as ?? 'section';
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const panelProps = props as Record<string, unknown>;
  const variantClass =
    variant === 'default' ? 'mounted' : variant === 'elevated' ? 'raised' : variant === 'ceremonial' ? 'sealed' : variant;
  const heading = title
    ? h(`h${headingLevel}`, { key: 'title', id: titleId, className: 'dh-dragon-panel-title' }, title)
    : null;

  return h(
    Component,
    {
      ...props,
      className: cx('dh-dragon-panel', `dh-dragon-panel-${variantClass}`, variant !== variantClass && `dh-dragon-panel-${variant}`, className),
      'aria-labelledby': title ? titleId : panelProps['aria-labelledby'],
      'aria-describedby': descriptionId ?? panelProps['aria-describedby']
    },
    title || description
      ? [
          h('header', { key: 'header', className: 'dh-dragon-panel-header' }, [
            heading,
            description ? h('p', { key: 'description', id: descriptionId, className: 'dh-dragon-panel-description' }, description) : null
          ]),
          h('div', { key: 'body', className: 'dh-dragon-panel-body' }, children)
        ]
      : children
  );
}

export function DragonTooltip({
  label,
  children,
  className,
  placement = 'top',
  disabled = false
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
  disabled?: boolean;
}) {
  const tooltipId = useId();
  const trigger = isValidElement(children) ? children : h('span', { className: 'dh-dragon-tooltip-trigger', tabIndex: 0 }, children);

  return h(
    'span',
    {
      className: cx('dh-dragon-tooltip', `dh-dragon-tooltip-${placement}`, disabled && 'is-disabled', className)
    },
    [
      isValidElement(trigger)
        ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
            key: 'trigger',
            'aria-describedby': disabled ? undefined : tooltipId
          })
        : trigger,
      disabled ? null : h('span', { key: 'tooltip', id: tooltipId, role: 'tooltip' }, label)
    ]
  );
}

export type DragonStatusTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

export function DragonStatusMessage({
  tone = 'info',
  title,
  children,
  action,
  className
}: {
  tone?: DragonStatusTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const role = tone === 'error' ? 'alert' : 'status';
  const live = tone === 'error' || tone === 'warning' ? 'assertive' : 'polite';

  return h(
    'div',
    {
      className: cx('dh-dragon-status', `dh-dragon-status-${tone}`, className),
      role,
      'aria-live': live,
      'aria-busy': tone === 'loading' || undefined
    },
    [
      tone === 'loading' ? h('span', { key: 'spinner', className: 'dh-dragon-status-spinner', 'aria-hidden': 'true' }) : null,
      h('span', { key: 'copy', className: 'dh-dragon-status-copy' }, [
        title ? h('strong', { key: 'title' }, title) : null,
        h('span', { key: 'body' }, children)
      ]),
      action ? h('span', { key: 'action', className: 'dh-dragon-status-action' }, action) : null
    ]
  );
}
