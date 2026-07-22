export function FireProgressBar({ progress, flare }: { progress: number; flare: boolean }) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={flare ? 'dh-fire-meter dh-fire-meter-flare' : 'dh-fire-meter'}>
      <div className="dh-fire-meter-track">
        <div className="dh-fire-meter-fill" style={{ width: `${safeProgress}%` }}>
          <span className="dh-fire-core" />
          <span className="dh-fire-tongues" />
        </div>
      </div>
      <div className="dh-fire-meter-readout">{safeProgress}%</div>
    </div>
  );
}
