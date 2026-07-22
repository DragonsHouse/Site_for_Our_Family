Dragon House visual assets live here.

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

Future 3D dragon layer:
- Replace the CSS placeholder in `entrypoints/dashboard/family/family-shell.tsx`
  with a lazy visual component, Lottie/Rive/video/WebGL, or an iframe-safe renderer.
- Keep the layer `pointer-events: none` and behind content.
