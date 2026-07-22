import { useEffect, useRef, useState } from 'react';
import { FAMILY_ASSET_DEFINITIONS } from '../../../lib/family-assets';
import {
  readFamilyCustomAssets,
  resetFamilyCustomAsset,
  saveFamilyCustomAsset
} from '../../../lib/family-repositories';
import type { FamilyAssetDefinition, FamilyUser } from '../../../lib/family-types';
import { useFamilyAssetUrl } from './use-family-asset-url';

const MAX_FAMILY_ASSET_BYTES = 50 * 1024 * 1024;

function AssetSlotCard({
  definition,
  currentUser,
  onChanged
}: {
  definition: FamilyAssetDefinition;
  currentUser: FamilyUser;
  onChanged: () => void;
}) {
  const currentUrl = useFamilyAssetUrl(definition.slot);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const [customAsset, setCustomAsset] = useState(() => readFamilyCustomAssets()[definition.slot]);
  const canSave = Boolean(preview && selectedFile && fileName && mimeType);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function refreshCustomAsset() {
    setCustomAsset(readFamilyCustomAssets()[definition.slot]);
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus(null);
    if (!file.type.startsWith('image/')) {
      setError('Оберіть файл зображення.');
      setStatus('error');
      return;
    }
    if (file.size > MAX_FAMILY_ASSET_BYTES) {
      setError('Файл завеликий. Максимум 50 MB.');
      setStatus('error');
      return;
    }

    try {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setSelectedFile(file);
      setFileName(file.name);
      setMimeType(file.type);
    } catch {
      setError('Не вдалося прочитати файл.');
      setStatus('error');
    }
  }

  async function save() {
    if (!selectedFile || !fileName || !mimeType) return;
    setError(null);
    setStatus(null);
    try {
      const updatedAt = new Date().toISOString();
      await saveFamilyCustomAsset(
        {
          slot: definition.slot,
          blobKey: `family-asset:${definition.slot}`,
          title: definition.title,
          fileName,
          mimeType,
          size: selectedFile.size,
          updatedBy: currentUser.nickname,
          updatedAt
        },
        selectedFile
      );
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setSelectedFile(null);
      setFileName(null);
      setMimeType(null);
      setStatus('saved');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refreshCustomAsset();
      onChanged();
    } catch {
      setStatus('error');
      setError('Помилка збереження.');
    }
  }

  async function reset() {
    setError(null);
    setStatus(null);
    try {
      await resetFamilyCustomAsset(definition.slot);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setSelectedFile(null);
      setFileName(null);
      setMimeType(null);
      setStatus('saved');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refreshCustomAsset();
      onChanged();
    } catch {
      setStatus('error');
      setError('Помилка збереження.');
    }
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-black/30 p-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="aspect-video overflow-hidden rounded-2xl border border-red-950/70 bg-slate-950">
            <img
              src={preview ?? currentUrl}
              alt={definition.title}
              className="h-full w-full object-cover"
              onLoad={(event) => {
                event.currentTarget.style.display = '';
              }}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
          {preview ? (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
              Перед збереженням
            </div>
          ) : customAsset ? (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
              Власне зображення: {customAsset.fileName}
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-400">
              Стандартне зображення
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">{definition.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{definition.usedIn}</p>
              <div className="mt-2 text-xs text-slate-500">{definition.slot}</div>
            </div>
            {customAsset ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                {new Date(customAsset.updatedAt).toLocaleString('uk-UA')}
                <div className="text-slate-500">{customAsset.updatedBy}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-amber-500/50 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10">
              Змінити
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Зберегти
            </button>
            <button
              type="button"
              onClick={() => void reset()}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
            >
              Повернути default
            </button>
          </div>

          {fileName ? <div className="mt-2 text-xs text-slate-400">Обрано: {fileName}</div> : null}
          {status === 'saved' ? (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Збережено
            </div>
          ) : null}
          {status === 'error' && !error ? (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
              Помилка збереження.
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FamilyAssetManager({ currentUser }: { currentUser: FamilyUser }) {
  const [, setVersion] = useState(0);

  function refresh() {
    setVersion((value) => value + 1);
  }

  return (
    <section className="dh-panel rounded-3xl p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Dragon House</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Керування картинками</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Глобальні картинки Hub зберігаються на цьому пристрої. Якщо власного зображення немає, використовується стандартне.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Доступ для власниці та довірених модераторів
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {FAMILY_ASSET_DEFINITIONS.map((definition) => (
          <AssetSlotCard
            key={definition.slot}
            definition={definition}
            currentUser={currentUser}
            onChanged={refresh}
          />
        ))}
      </div>
    </section>
  );
}
