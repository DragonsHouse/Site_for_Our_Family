import { useRef, useState } from 'react';
import {
  applyReplaceBackup,
  backupFilename,
  createDragonHouseBackup,
  downloadDragonHouseBackup,
  parseDragonHouseBackupFile,
  readBackupAudit,
  writeBackupAudit,
  type BackupPreview
} from '../../../lib/family-backup';
import type { FamilyUser } from '../../../lib/family-types';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function FamilyBackupPanel({ currentUser }: { currentUser: FamilyUser }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [audit, setAudit] = useState(() => readBackupAudit());

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await createDragonHouseBackup({
        familyMemberId: currentUser.id,
        nickname: currentUser.nickname
      });
      const filename = backupFilename();
      const result = await downloadDragonHouseBackup(backup, filename);
      await writeBackupAudit({
        action: 'export',
        performedByFamilyMemberId: currentUser.id,
        filename,
        schemaVersion: backup.schemaVersion,
        result: 'success',
        summary: `Exported ${formatBytes(result.size)}`
      });
      setAudit(readBackupAudit());
      setMessage(`Резервну копію створено: ${filename}`);
    } catch (error) {
      await writeBackupAudit({
        action: 'export',
        performedByFamilyMemberId: currentUser.id,
        result: 'failed',
        summary: error instanceof Error ? error.message : 'Export failed'
      });
      setAudit(readBackupAudit());
      setMessage(error instanceof Error ? error.message : 'Не вдалося створити резервну копію');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setConfirmation('');
    try {
      const nextPreview = await parseDragonHouseBackupFile(file);
      await writeBackupAudit({
        action: 'import_preview',
        performedByFamilyMemberId: currentUser.id,
        filename: file.name,
        schemaVersion: nextPreview.backup.schemaVersion,
        result: nextPreview.errors.length ? 'failed' : 'success',
        summary: nextPreview.errors[0] ?? 'Dry-run preview completed'
      });
      setPreview(nextPreview);
      setAudit(readBackupAudit());
      setMessage(nextPreview.errors.length ? 'Dry-run має помилки. Імпорт заблоковано.' : 'Dry-run готовий. Дані ще не записані.');
    } catch (error) {
      await writeBackupAudit({
        action: 'import_preview',
        performedByFamilyMemberId: currentUser.id,
        filename: file.name,
        result: 'failed',
        summary: error instanceof Error ? error.message : 'Import preview failed'
      });
      setAudit(readBackupAudit());
      setMessage(error instanceof Error ? error.message : 'Не вдалося перевірити файл');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleApplyReplace() {
    if (!preview || confirmation !== 'ВІДНОВИТИ') return;
    setBusy(true);
    setMessage(null);
    try {
      await applyReplaceBackup(preview, currentUser);
      setMessage('Резервну копію відновлено. Family Hub буде перезавантажено.');
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setAudit(readBackupAudit());
      setMessage(error instanceof Error ? error.message : 'Імпорт не виконано. Поточний стан відновлено з аварійної копії.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dh-panel rounded-3xl p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Резервне копіювання</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Резервне копіювання та відновлення</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Ця копія містить локальні дані Family Hub. Backend database та паролі потрібно резервувати окремо.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExport()}
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
        >
          Експортувати повну резервну копію
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <h4 className="font-semibold text-white">Імпорт</h4>
          <p className="mt-1 text-sm text-slate-400">Спочатку виконується dry-run preview. Нічого не записується до підтвердження.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="mt-4 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-red-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="radio" checked readOnly />
              Повністю замінити локальні дані
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Поточні локальні дані Family Hub будуть замінені. Перед заміною буде автоматично створена аварійна копія.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <input type="radio" disabled />
              Об’єднати з поточними даними
            </label>
            <p className="mt-1 text-xs text-slate-500">Безпечне об’єднання буде доступне після завершення server migration.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <h4 className="font-semibold text-white">Dry-run preview</h4>
          {preview ? (
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div>Файл: <span className="text-white">{preview.filename}</span></div>
              <div>Розмір: <span className="text-white">{formatBytes(preview.fileSize)}</span></div>
              <div>Дата: <span className="text-white">{new Date(preview.backup.exportedAt).toLocaleString('uk-UA')}</span></div>
              <div>Schema: <span className="text-white">{preview.backup.schemaVersion}</span></div>
              <div>Application: <span className="text-white">{preview.backup.applicationVersion ?? '-'}</span></div>
              <div>Автор: <span className="text-white">{preview.backup.exportedBy.nickname} / {preview.backup.exportedBy.familyMemberId}</span></div>
              <div>Checksum: <span className={preview.checksumValid ? 'text-emerald-300' : 'text-red-300'}>{preview.checksumValid ? 'valid' : 'invalid'}</span></div>
              <div>Compatibility: <span className="text-white">{preview.compatibilityStatus}</span></div>
              <div>Members: <span className="text-white">{preview.counts.members}</span></div>
              <div>Quests: <span className="text-white">{preview.counts.quests}</span></div>
              <div>Accounting entries: <span className="text-white">{preview.counts.accountingEntries}</span></div>
              <div>Notifications: <span className="text-white">{preview.counts.notifications}</span></div>
              <div>Assets: <span className="text-white">{preview.counts.assets}</span></div>
              <div>Unresolved references: <span className="text-white">{preview.counts.unresolvedReferences}</span></div>
              <div>Conflicts: <span className="text-white">{preview.counts.conflicts}</span></div>
              {preview.warnings.map((warning) => (
                <div key={warning} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">{warning}</div>
              ))}
              {preview.errors.map((error) => (
                <div key={error} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-100">{error}</div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Оберіть JSON-файл, щоб побачити preview.</p>
          )}
        </div>
      </div>

      {preview ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-sm text-red-100">
            Поточні локальні дані Family Hub будуть замінені. Перед заміною буде автоматично створена аварійна копія.
          </p>
          <label className="mt-3 block text-sm text-slate-300">
            Введи ВІДНОВИТИ для підтвердження
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={busy || preview.errors.length > 0 || confirmation !== 'ВІДНОВИТИ'}
            onClick={() => void handleApplyReplace()}
            className="mt-3 rounded-xl border border-red-500/50 bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Застосувати відновлення
          </button>
        </div>
      ) : null}

      {message ? <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200">{message}</div> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <h4 className="font-semibold text-white">Журнал операцій</h4>
        <div className="mt-3 space-y-2">
          {audit.length ? audit.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
              <span className="text-white">{entry.action}</span> · {entry.result} · {new Date(entry.performedAt).toLocaleString('uk-UA')}
              {entry.filename ? <> · {entry.filename}</> : null}
              {entry.summary ? <div className="mt-1 text-slate-500">{entry.summary}</div> : null}
            </div>
          )) : <p className="text-sm text-slate-500">Операцій ще немає.</p>}
        </div>
      </div>
    </section>
  );
}
