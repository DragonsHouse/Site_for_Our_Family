Dragon House visual assets live here.

Asset ownership:
- `icons/` - UI and room icons, preferably SVG unless raster detail is required.
- `textures/stone/` - stone wall, floor, and masonry texture sources.
- `textures/iron/` - metal, lock, gate, trim, and weapon texture sources.
- `textures/wood/` - wood panel, table, crate, and parchment-adjacent texture sources.
- `textures/fire/` - flame sheets, fire glows, and hot core raster sources.
- `textures/embers/` - ember particles, sparks, and small fire debris.
- `textures/smoke/` - smoke, haze, and atmospheric overlays.
- `audio/ambient/` - long ambience loops that can lazy-load after user interaction.
- `audio/ui/` - short UI feedback sounds.
- `illustrations/` - room, quest, character, and Dragon House scene artwork.

Expected files:
- dragon-house-logo.png
- dragon-hall-bg.png
- dragon-3d-placeholder.png
- quests/dopomoga-gromadyanam.png
- quests/subotnyk.png
- quests/myslyvskyi-sezon.png
- quests/lisovi-trofei.png
- quests/zaklyk-lisoruba.png
- quests/tovarnyi-vybukh.png
- quests/rybnyi-den.png
- quests/vartovi-svogo.png
- quests/vlada-cherez-krov.png
- quests/palyvo-progresu.png
- quests/shahtarska-sprava.png

The Family Hub shell already points to these public paths:
- /assets/dragon-house/dragon-house-logo.png
- /assets/dragon-house/dragon-hall-bg.png
- /assets/dragon-house/dragon-3d-placeholder.png
- /assets/dragon-house/quests/*.png
- /assets/dragon-house/audio/fireplace-loop.wav

Future 3D dragon layer:
- Replace the CSS placeholder in `entrypoints/dashboard/family/family-shell.tsx`
  with a lazy visual component, Lottie/Rive/video/WebGL, or an iframe-safe renderer.
- Keep the layer `pointer-events: none` and behind content.

Compatibility note:
- Existing production assets remain at their current paths to avoid breaking imports and stored asset URLs.
- `audio/fireplace-loop.wav` remains in `audio/` for Sprint 1 compatibility. New ambience should go under `audio/ambient/`.
