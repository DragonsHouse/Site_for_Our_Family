import type { CSSProperties } from 'react';

const EMBERS = {
  calm: Array.from({ length: 12 }, (_, index) => index),
  intense: Array.from({ length: 18 }, (_, index) => index)
};

export function EmberParticles({ intense = false }: { intense?: boolean }) {
  const embers = intense ? EMBERS.intense : EMBERS.calm;

  return (
    <div className={intense ? 'dh-embers dh-embers-flare' : 'dh-embers'} aria-hidden="true">
      {embers.map((index) => (
        <span key={index} style={{ '--ember-index': index } as CSSProperties} />
      ))}
    </div>
  );
}
