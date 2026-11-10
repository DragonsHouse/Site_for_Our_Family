import { useEffect, useRef, useState } from 'react';
import { FAMILY_ASSET_DEFINITIONS, FAMILY_ASSETS_UPDATED_EVENT } from '../../../lib/family-assets';
import { readFamilyAssetBlob, readFamilyAssetUrl } from '../../../lib/family-repositories';
import type { FamilyAssetSlot } from '../../../lib/family-types';
import { getSharedAssetBlob, getSharedPilotAsset, SHARED_ASSET_PILOT_SLOT, SHARED_ASSET_UPDATED_EVENT } from '../../../lib/family-shared-assets-backend-client';

export function useFamilyAssetUrl(slot: FamilyAssetSlot) {
  const objectUrlRef = useRef<string | null>(null);
  const fallback = () => slot === SHARED_ASSET_PILOT_SLOT ? FAMILY_ASSET_DEFINITIONS.find((item) => item.slot === slot)!.defaultUrl : readFamilyAssetUrl(slot);
  const [url, setUrl] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;

    function revokeCurrentObjectUrl() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }

    async function refresh() {
      const request = ++generation;
      try {
        if (slot === SHARED_ASSET_PILOT_SLOT) {
          const shared = await getSharedPilotAsset();
          if (cancelled || request !== generation) return;
          revokeCurrentObjectUrl();
          if (shared) {
            const blob = await getSharedAssetBlob(shared);
            if (cancelled || request !== generation) return;
            const objectUrl = URL.createObjectURL(blob);
            objectUrlRef.current = objectUrl;
            setUrl(objectUrl);
          } else setUrl(fallback());
          return;
        }
        const blob = await readFamilyAssetBlob(slot);
        if (cancelled || request !== generation) return;
        revokeCurrentObjectUrl();
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setUrl(objectUrl);
        } else {
          setUrl(fallback());
        }
      } catch {
        if (!cancelled && request === generation) {
          revokeCurrentObjectUrl();
          setUrl(fallback());
        }
      }
    }

    void refresh();
    window.addEventListener(FAMILY_ASSETS_UPDATED_EVENT, refresh);
    window.addEventListener(SHARED_ASSET_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FAMILY_ASSETS_UPDATED_EVENT, refresh);
      window.removeEventListener(SHARED_ASSET_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      revokeCurrentObjectUrl();
    };
  }, [slot]);

  return url;
}
