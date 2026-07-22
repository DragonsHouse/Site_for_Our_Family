import { useEffect, useRef, useState } from 'react';
import { FAMILY_ASSETS_UPDATED_EVENT } from '../../../lib/family-assets';
import { readFamilyAssetBlob, readFamilyAssetUrl } from '../../../lib/family-repositories';
import type { FamilyAssetSlot } from '../../../lib/family-types';

export function useFamilyAssetUrl(slot: FamilyAssetSlot) {
  const objectUrlRef = useRef<string | null>(null);
  const [url, setUrl] = useState(() => readFamilyAssetUrl(slot));

  useEffect(() => {
    let cancelled = false;

    function revokeCurrentObjectUrl() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }

    async function refresh() {
      try {
        const blob = await readFamilyAssetBlob(slot);
        if (cancelled) return;
        revokeCurrentObjectUrl();
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setUrl(objectUrl);
        } else {
          setUrl(readFamilyAssetUrl(slot));
        }
      } catch {
        if (!cancelled) {
          revokeCurrentObjectUrl();
          setUrl(readFamilyAssetUrl(slot));
        }
      }
    }

    void refresh();
    window.addEventListener(FAMILY_ASSETS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FAMILY_ASSETS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      revokeCurrentObjectUrl();
    };
  }, [slot]);

  return url;
}
