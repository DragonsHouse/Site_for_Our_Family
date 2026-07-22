export function SoundToggle({
  enabled,
  state,
  onToggle,
}: {
  enabled: boolean;
  state: 'idle' | 'playing' | 'muted' | 'blocked' | 'unavailable';
  onToggle: () => void;
}) {
  const label = !enabled || state === 'muted' ? 'Звук вимкнено' : state === 'blocked' ? 'Звук заблоковано браузером' : 'Тихий вогонь';
  return (
    <button type="button" className="dh-sound-toggle" onClick={onToggle} aria-pressed={enabled}>
      <span aria-hidden="true">{enabled && state !== 'blocked' ? '♪' : '×'}</span>
      {label}
    </button>
  );
}
