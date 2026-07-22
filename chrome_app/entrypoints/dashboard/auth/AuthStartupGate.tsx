export function AuthStartupGate() {
  return (
    <section className="dh-startup-card" role="status" aria-live="polite">
      <div className="dh-startup-sigil" aria-hidden="true" />
      <div>
        <strong>Dragon House</strong>
        <span>Перевіряємо сесію Family Hub...</span>
      </div>
    </section>
  );
}
