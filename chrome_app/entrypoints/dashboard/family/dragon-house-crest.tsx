import type { FamilyAssetSlot } from '../../../lib/family-types';
import { useFamilyAssetUrl } from './use-family-asset-url';

function DragonMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-10 w-10 text-amber-300">
      <path
        fill="currentColor"
        d="M49.7 8.2c-7.8 2.1-13.5 5.9-17.2 11.5-6.1-.6-12.1 1.8-16.1 6.5 5.1-.9 9.5-.2 13.2 2.1-2.4 2.8-4 6.4-4.8 10.7-3.7-.5-7.1.1-10.3 1.9 4.3 1.1 7.8 3.1 10.5 6.1 3.5 3.9 8.1 6 13.7 6.3-2.3-1.8-3.9-3.9-4.8-6.5 7.6-1.2 13.4-5.5 17.5-12.9-4.1 1.7-8 2.2-11.8 1.6 2.3-3.1 4.2-6.9 5.8-11.4 2.9-1.2 5.9-3.3 9-6.4-2.8.2-5.3-.1-7.5-.9 1.2-2.5 2.1-5.4 2.8-8.6Z"
      />
    </svg>
  );
}

export function DragonHouseCrest({
  size = 'lg',
  slot = 'dragon_house_logo'
}: {
  size?: 'sm' | 'lg';
  slot?: FamilyAssetSlot;
}) {
  const imageUrl = useFamilyAssetUrl(slot);
  const sizeClass = size === 'sm' ? 'h-12 w-12 rounded-xl' : 'h-16 w-16 rounded-2xl';
  return (
    <div className={`dh-crest relative flex ${sizeClass} items-center justify-center overflow-hidden border border-amber-400/40`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <DragonMark />
      </div>
      <img
        src={imageUrl}
        alt="Dragon House"
        className="relative z-10 h-full w-full object-cover"
        onLoad={(event) => {
          event.currentTarget.style.display = '';
        }}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/45" />
    </div>
  );
}
