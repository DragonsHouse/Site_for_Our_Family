import type { DragonBackgroundVariant } from './dragon-theme';

export function DragonBackground({
  variant = 'dashboard',
  dragon = true
}: {
  variant?: DragonBackgroundVariant;
  dragon?: boolean;
}) {
  return (
    <div className={`dh-dragon-bg dh-dragon-bg-${variant}`} aria-hidden="true">
      <div className="dh-dragon-bg-fortress" />
      {dragon ? (
        <div className="dh-dragon-bg-guardian">
          <span className="dh-dragon-bg-eye left" />
          <span className="dh-dragon-bg-eye right" />
        </div>
      ) : null}
      <div className="dh-dragon-bg-smoke" />
      <div className="dh-dragon-bg-embers" />
      <div className="dh-dragon-bg-vignette" />
    </div>
  );
}
