import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export function IconActionButton({
  tooltip,
  showPopover = true,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  showPopover?: boolean;
}) {
  if (!showPopover) {
    return (
      <button type="button" aria-label={tooltip} title={tooltip} className={className} {...props}>
        {children}
      </button>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={tooltip} title={tooltip} className={className} {...props}>
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 shadow-xl shadow-black/40 group-hover:block group-focus-within:block">
        {tooltip}
      </span>
    </span>
  );
}
