import type { CSSProperties } from 'react';
import type { DragonBackgroundVariant } from './dragon-theme';

export function DragonBackground({
  variant = 'dashboard',
  dragon = true,
  assetUrl
}: {
  variant?: DragonBackgroundVariant;
  dragon?: boolean;
  assetUrl?: string | null;
}) {
  return (
    <div
      className={`dh-dragon-bg dh-dragon-bg-${variant}${assetUrl ? ' has-custom-asset' : ''}`}
      style={assetUrl ? ({ '--dh-dragon-custom-background': `url('${assetUrl}')` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {assetUrl ? <div className="dh-dragon-bg-custom-asset" /> : null}
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
