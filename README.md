# Our Little Louvre

A phone-first, first-person museum with a blue-hour courtyard, the Gallery of Us, and a final exhibit with a letter. The local preview includes ten fictional travel memories and a sample letter.

## Run locally

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the Local URL printed by Vite. Open the envelope and take the brass key to start the 3D visit, or select **Browse photos** for the same collection in HTML. Use WASD or arrow keys to walk, and click for mouse look or drag to look. Escape releases the mouse. Walk to the lit pyramid door or use **Go to pyramid door** as a shortcut, then press **E** or select **Use brass key**. Follow the main hall to the final portrait or take either side gallery through an arch and rejoin the hall through its second arch. Aim at a nearby frame and click or press **E** to inspect it. On touch screens, move with the left joystick, drag on the right to look, and tap a photograph or its title to inspect it.

## Checks

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

The end-to-end suite runs the production build and uses Microsoft Edge on Windows. On other platforms install Chromium with `npx playwright install chromium`. To test the sample build on an iPhone on the same trusted Wi-Fi, run `npm.cmd run dev -- --host 0.0.0.0` and open Vite’s Network URL in Safari.

## Exhibits and models

- The collection and letter come from `public/content/exhibits.json`. Each photograph has a frame thumbnail and a larger display copy. IDs and anchor names are unique, and exhibit ordering follows the manifest. Place only demo material in `public/content` during local development.
- Blender generates both architectural shells from `scripts/model-museum.py`. The runtime uses the same room dimensions from `src/museum/architecture.json` for collision. The gallery light map uses the models’ second UV set, and the courtyard uses a reflection panorama rendered from the same architecture. The browser-ready GLBs and maps are already in `public/models` and `public/materials`.
- To regenerate the models, use Blender 4.5 LTS and run the commands below from the repository root. Supply Blender’s executable path if it is outside `PATH`.

```powershell
node scripts/make-materials.mjs
blender --background --factory-startup --python-exit-code 1 --python scripts/model-museum.py
npm.cmd run assets:optimize
node scripts/make-surface-detail.mjs
```

ImageGen provided the opening’s lamp-lit museum desk and the fictional 35 mm French travel photographs. The 3D textures, architecture, and interface artwork are original to this build. [Instrument Serif](https://github.com/Instrument/instrument-serif) and [DM Sans](https://github.com/googlefonts/dm-fonts) use the SIL Open Font License.
