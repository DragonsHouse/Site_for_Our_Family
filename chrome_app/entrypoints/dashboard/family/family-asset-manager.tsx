import { useEffect, useRef, useState } from 'react';
import { FAMILY_ASSET_DEFINITIONS } from '../../../lib/family-assets';
import {
  readFamilyCustomAssets,
  resetFamilyCustomAsset,
  saveFamilyCustomAsset
} from '../../../lib/family-repositories';
import type { FamilyAssetDefinition, FamilyUser } from '../../../lib/family-types';
import { DragonBadge, DragonButton, DragonCard, DragonDialog, DragonEmptyState, DragonHero, DragonPanel } from '../dragon-ui/dragon-ui';
import { useFamilyAssetUrl } from './use-family-asset-url';

const MAX_FAMILY_ASSET_MB = 100;
const MAX_FAMILY_ASSET_BYTES = MAX_FAMILY_ASSET_MB * 1024 * 1024;

const ASSET_SLOT_LABELS: Record<FamilyAssetDefinition['slot'], string> = {
  dragon_house_logo: 'Герб Dragon House',
  header_logo: 'Герб у шапці',
  family_hub_background: 'Фон Family Hub',
  login_background: 'Фон входу',
  login_portal_background: 'Фон порталу',
  post_login_background: 'Фон після входу',
  background_dragon: 'Дракон на фоні',
  quest_help_citizens: 'Квест: допомога громадянам',
  quest_cleanup: 'Квест: суботник',
  quest_hunting: 'Квест: мисливський сезон',
  quest_forest_trophies: 'Квест: лісові трофеї',
  quest_lumberjack: 'Квест: заклик лісоруба',
  quest_goods_explosion: 'Квест: товарний вибух',
  quest_fishing: 'Квест: рибний день',
  quest_guardians: 'Квест: вартові свого',
  quest_blood_power: 'Квест: влада через кров',
  quest_fuel_progress: 'Квест: паливо прогресу',
  quest_mining: 'Квест: шахтарська справа'
};

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

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
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
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
      setError(`Файл завеликий. Максимум ${MAX_FAMILY_ASSET_MB} MB.`);
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
    <DragonCard className="dh-asset-slot-card p-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="dh-asset-preview">
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
            <DragonBadge tone="gold" className="mt-2">Перед збереженням</DragonBadge>
          ) : customAsset ? (
            <DragonBadge tone="success" className="mt-2">Власне зображення</DragonBadge>
          ) : (
            <DragonBadge tone="muted" className="mt-2">Стандартне зображення</DragonBadge>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="dh-command-kicker">{ASSET_SLOT_LABELS[definition.slot]}</p>
              <h3 className="mt-1 text-base font-semibold text-white">{definition.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-300">{definition.usedIn}</p>
            </div>
            {customAsset ? (
              <div className="dh-command-note px-3 py-2 text-xs text-stone-300">
                <div>Оновлено: {new Date(customAsset.updatedAt).toLocaleString('uk-UA')}</div>
                <div className="text-stone-500">Автор: {customAsset.updatedBy}</div>
              </div>
            ) : null}
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="dh-command-list-item px-3 py-2">
              <dt className="dh-command-label">Тип</dt>
              <dd className="text-stone-100">{customAsset?.mimeType ?? mimeType ?? 'стандартний файл'}</dd>
            </div>
            <div className="dh-command-list-item px-3 py-2">
              <dt className="dh-command-label">Розмір</dt>
              <dd className="text-stone-100">{customAsset ? formatBytes(customAsset.size) : selectedFile ? formatBytes(selectedFile.size) : 'за замовчуванням'}</dd>
            </div>
            <div className="dh-command-list-item px-3 py-2">
              <dt className="dh-command-label">Обмеження</dt>
              <dd className="text-stone-100">до {MAX_FAMILY_ASSET_MB} MB, image/*</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="dh-dragon-button dh-dragon-button-secondary cursor-pointer">
              <span className="dh-dragon-button-label">
              Змінити
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
            </label>
            <DragonButton
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
            >
              Зберегти
            </DragonButton>
            <DragonButton
              type="button"
              variant="danger"
              onClick={() => setConfirmResetOpen(true)}
              disabled={!customAsset && !preview}
            >
              Повернути стандартне
            </DragonButton>
          </div>

          {fileName ? <div className="mt-2 text-xs text-stone-400">Обрано: {fileName}</div> : null}
          {status === 'saved' ? (
            <div className="dh-command-list-item mt-3 border-emerald-500/30 px-3 py-2 text-sm text-emerald-100">
              Збережено
            </div>
          ) : null}
          {status === 'error' && !error ? (
            <div className="dh-command-error mt-3 text-sm">
              Помилка збереження.
            </div>
          ) : null}
          {error ? (
            <div className="dh-command-error mt-3 text-sm">
              {error}
            </div>
          ) : null}

          <details className="dh-technical-details">
            <summary>Технічні деталі</summary>
            <dl className="mt-2 grid gap-2 text-sm">
              <div>
                <dt>Слот</dt>
                <dd>{definition.slot}</dd>
              </div>
              <div>
                <dt>Поточний файл</dt>
                <dd>{customAsset?.fileName ?? 'стандартний файл'}</dd>
              </div>
            </dl>
          </details>
        </div>
      </div>

      {confirmResetOpen ? (
        <DragonDialog title="Повернути стандартне зображення?" onClose={() => setConfirmResetOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-stone-300">
              Власне зображення для цього слота буде прибране з локального сховища цього пристрою. Якщо цей файл уже використовується в Hub, після підтвердження він повернеться до стандартної картинки.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <DragonButton type="button" variant="secondary" onClick={() => setConfirmResetOpen(false)}>
                Скасувати
              </DragonButton>
              <DragonButton
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmResetOpen(false);
                  void reset();
                }}
              >
                Повернути стандартне
              </DragonButton>
            </div>
          </div>
        </DragonDialog>
      ) : null}
    </DragonCard>
  );
}

export function FamilyAssetManager({ currentUser }: { currentUser: FamilyUser }) {
  const [, setVersion] = useState(0);

  function refresh() {
    setVersion((value) => value + 1);
  }

  return (
    <section className="space-y-4">
      <DragonHero
        eyebrow="Арсенал зображень"
        title="Керування зображеннями"
        description="Власні зображення Hub зберігаються локально на цьому пристрої. Якщо власного зображення немає, використовується стандартний файл."
        className="dh-command-hero"
      >
        <div className="grid gap-2 text-sm">
          <div className="dh-status-pill">{FAMILY_ASSET_DEFINITIONS.length} слотів</div>
          <div className="dh-status-pill is-active">image/* до {MAX_FAMILY_ASSET_MB} MB</div>
        </div>
      </DragonHero>

      <DragonPanel variant="raised" className="p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="dh-command-kicker">Керовані зображення</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Слоти зображень</h3>
            <p className="dh-command-copy mt-2">Технічні ключі сховані в деталях; основний список показує людську назву, використання, попередній перегляд і безпечні дії.</p>
          </div>
          <DragonBadge tone="gold">Доступ для власниці та довірених модераторів</DragonBadge>
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

        {!FAMILY_ASSET_DEFINITIONS.length ? (
          <DragonEmptyState title="Слотів зображень ще немає" description="Коли в Hub зʼявляться керовані зображення, вони будуть тут." />
        ) : null}
      </DragonPanel>
    </section>
  );
}
