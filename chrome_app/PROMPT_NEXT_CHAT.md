# Prompt for next chat (Quant RP Helper)

Copy this text into a new chat to quickly restore context and continue coding work.

Project: browser extension `Quant RP Helper` in folder `chrome_app`.

## Stack and architecture
- Stack: `WXT + React + TypeScript + Tailwind`.
- Manifest: `MV3` (`service worker + chrome.alarms`, no persistent background page).
- Storage:
- `IndexedDB` for buyers/events/map data and state.
- `chrome.storage.sync` for settings.
- `localStorage` for dashboard/map UI state.

## Current focus (Map panel)
- Main file: `entrypoints/dashboard/dashboard-app.tsx`.
- Map supports:
- default markers + custom user points.
- layer filter modal with icons.
- zone creation/editing.
- zone overlay image (position/size/rotation/opacity/crop).
- filter persistence in `localStorage`.
- permissions in map settings:
- allow adding points.
- allow adding zones.
- allow editing zones.
- allow editing default markers.

## Zone workflow (already implemented)
- Zone requires minimum 4 points.
- Zone modal has button `Додати точку`:
- closes modal.
- enables map point-pick mode.
- click on map adds points.
- after 4th point:
- ask: add one more point?
- if no: return to modal and ask to save now.
- Draft points are visible on map and can be dragged before save (create + edit).
- Zone fill is semi-transparent so map remains visible.
- Filter has toggle for `Зони` on/off.

## Important implementation files
- `entrypoints/background.ts` - alarms/polling/notifications.
- `entrypoints/dashboard/dashboard-app.tsx` - map/dashboard state and handlers.
- `entrypoints/dashboard/dashboard-components.tsx` - dashboard UI blocks.
- `lib/db.ts` - IndexedDB persistence.
- `lib/types.ts` - shared types (includes `MapZone` image overlay fields).
- `README.md` and `TODO.md` - project notes.

## Working rules for next chat
- Act as coding agent: apply code changes, not only explanations.
- Keep existing UI style unless change is explicitly requested.
- After edits, report:
- what changed.
- changed files.
- what to test manually.
- If behavior is broken, find root cause in code before proposing workaround.

## Token/cost constraint
- Read and follow `CHAT_IMAGE_POLICY.md`.
- Do not send image files from folder `картинки` into chat context.

