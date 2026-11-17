# Our Little Louvre

A phone-first, first-person museum for two: a blue-hour courtyard, the Gallery of Us, a final exhibit with a letter, and a procedural New Wing that grows as photographs are added. The public preview includes ten fictional travel memories and a sample letter. The private museum replaces them with the collection and letter stored in Supabase.

## A museum for two

- Opening the museum requires a magic link sent to one of two addresses: `OWNER_EMAIL` and `PARTNER_EMAIL`. There are no public accounts and no strangers.
- The **Private studio** at `/studio` is where either of you can upload a photograph, edit its label, remove it, rewrite the letter, and change the name shown on your labels.
- New photographs hang in the **New Wing**. Each alley holds six frames. A removed photograph leaves a gap that is filled before the museum opens another alley, and the wing stops growing at 24 alleys (144 photographs).
- Photographs live in a private Supabase Storage bucket. The API issues short-lived signed URLs for display after it has checked your session.
- The ten original exhibits keep their baked Blender frames. Their labels can still be edited in the studio.

## Run locally

You will need Node 22 LTS or newer and a [Supabase](https://supabase.com) project.

1. Install the dependencies.

   ```powershell
   npm.cmd ci
   ```

2. Copy `.env.example` to `.env.local` and fill in the values from the Supabase dashboard.

   ```powershell
   Copy-Item .env.example .env.local
   ```

   | Value | Where to find it |
   | --- | --- |
   | `DATABASE_URL`, `DIRECT_URL` | Supabase → **Connect** → the pooled and direct Postgres connection strings. Keep the pooler parameters shown in `.env.example`. |
   | `SUPABASE_URL` | Supabase → **Project Settings** → **API** |
   | `SUPABASE_PUBLISHABLE_KEY` | The publishable (or anon) key. Safe to expose. |
   | `SUPABASE_SECRET_KEY` | The secret (or service role) key. **Server-only. Never commit or expose it.** |
   | `VITE_SUPABASE_URL` | The same project URL. |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | The same publishable key. |
   | `OWNER_EMAIL`, `PARTNER_EMAIL` | The two addresses allowed into the museum. |
   | `OWNER_NAME`, `PARTNER_NAME` | The names shown on labels and in the studio. |
   | `PARTNER_PAUSED`, `PARTNER_PAUSED_MESSAGE` | Optional. Hold the partner’s side behind a cover page while a surprise is prepared. See [Keeping the surprise](#keeping-the-surprise). |

3. Create the private storage bucket and lock down the database tables.

   ```powershell
   npm.cmd run setup:supabase
   ```

4. Create the tables and seed the original collection.

   ```powershell
   npm.cmd run db:migrate
   npm.cmd run db:seed
   ```

   `db:seed` is safe to re-run. It creates the ten originals and an active letter the first time, and never overwrites labels or letters that have since been edited in the studio. On later deploys use `npm.cmd run db:deploy` instead of `db:migrate`.

5. In Supabase, open **Authentication** → **URL Configuration** and set:

   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: `http://localhost:5173/auth/callback`

   Magic links only return to configured addresses. Add the production URL in the same place when you deploy.

6. Start the site and the API together.

   ```powershell
   npm.cmd run dev
   ```

   Vite serves the museum at the Local URL it prints (usually `http://localhost:5173`). The API listens on `http://127.0.0.1:8787`, and Vite proxies `/api` to it. Open the site, enter one of the two guest addresses, and follow the link from the email in the same browser.

If the studio address is empty, the museum’s entrance page will say the private entrance is not connected yet. Add the values, restart `npm run dev`, and reload.

### The letter

The active letter is stored in Supabase and edited in the studio. The public JSON in `public/content/exhibits.json` contains a separate, longer fictional sample letter for the demo build.

For a private starting draft, create `prisma/letter.json` before the first `db:seed`:

```json
{
  "title": "A Letter for You",
  "paragraphs": ["Dear you,", "The words that belong at the end of the gallery.", "With love"]
}
```

`prisma/letter.json` is gitignored. If it is absent, the seed uses a short sample letter. After the first seed, the database is the source of truth, so re-running the seed will not replace a letter written in the studio.

## The studio

The masthead’s **Private studio** link opens `/studio`. Both members have the same permissions.

- **Hang a memory** — choose or drop a photograph. The browser rotates, downsizes, and re-encodes it, then uploads the display copy and thumbnail directly to the private bucket through one-use signed URLs. The API verifies the upload before creating the exhibit.
- **The letter** — edit the title and up to twelve paragraphs. The saved letter replaces the final exhibit’s letter for both of you.
- **Name on the label** — set the name shown on the labels you hang.
- **The New Wing** — edit a photograph’s title, date, story, and description; hide it from the museum without deleting it; or remove it and free its frame.
- **The Gallery of Us** — edit the labels of the ten baked originals.

### Keeping the surprise

The owner can keep preparing the museum without spoiling it for the partner:

```powershell
PARTNER_PAUSED=1
PARTNER_PAUSED_MESSAGE="Dean is cooking something"
```

With the flag on, the partner’s sign-in still succeeds, but the museum and studio routes answer `423` and the browser shows a neutral cover page with the configured message. The owner is never paused. The page deliberately has no museum name, no logo, no photographs, and no canvas, so an early visit does not reveal the project; its document title is the message itself.

Set `PARTNER_PAUSED=1` in `.env.local` for local work, and in the hosting environment for production. Either way the API reads the value at startup, so restart `npm run dev` (or redeploy) after changing it. Remove the flag, or set it to `0`, to reopen the partner’s side. `PARTNER_PAUSED_MESSAGE` defaults to `Dean is cooking something`.

Nothing you add is readable without a session: the museum, the photo index, the collection API, the studio API, the database tables, and the uploaded photographs are all private. The ten baked demo photographs and the sample manifest in `public/content` are served as static preview files, so keep only fictional demo material there. The real letter and every uploaded photograph live in Supabase behind the API.

## Checks

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

`npm run test:e2e` builds a demo copy with `VITE_DEMO_MODE=1`, so the browser suite uses the static collection and bypasses sign-in. It does not write to Supabase. The suite uses Microsoft Edge on Windows; on other platforms install Chromium with `npx playwright install chromium`. The 3D walkthrough test renders with software WebGL, so it can take about a minute.

To preview the public demo build without Supabase configured, run `npm.cmd run build:e2e` followed by `npm.cmd run preview`.

## Deploying

The repository includes `vercel.json` and a serverless Hono entry point at `api/[...route].ts`. The same Hono app runs on Node locally and on Vercel in production.

1. Import the repository into Vercel. Keep the configured build command (`npm run build`) and output directory (`dist`).
2. Add every server value from `.env.local` to the Vercel project’s environment variables, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Do not add `VITE_DEMO_MODE`.
3. From your machine, apply the schema and seed the production database:

   ```powershell
   npm.cmd run db:deploy
   npm.cmd run db:seed
   ```

   Run `npm.cmd run setup:supabase` once as well if the bucket and table permissions have not been created for this project.
4. In Supabase → **Authentication** → **URL Configuration**, set the **Site URL** to your production address and add `https://your-domain/auth/callback` to the **Redirect URLs**.
5. Deploy. Visit `/studio` and sign in with one of the two guest addresses to confirm the production redirect works.

The browser only ever receives `VITE_*` values. The Prisma connection strings and `SUPABASE_SECRET_KEY` stay on the serverless functions. Display URLs are signed for six hours, so a reload always asks the API for fresh ones.

## Exhibits and models

- The ten baked originals and the demo letter come from `public/content/exhibits.json`. The same file seeds the private database. Each photograph has a frame thumbnail and a larger display copy; IDs and anchor names are unique, and ordering follows the manifest. Uploaded photographs use the procedural New Wing instead of a Blender anchor.
- Blender generates both architectural shells from `scripts/model-museum.py`. The runtime uses the same room dimensions from `src/museum/architecture.json` for collision. The gallery light map uses the models’ second UV set, and the courtyard uses a reflection panorama rendered from the same architecture. The browser-ready GLBs and maps are already in `public/models` and `public/materials`.
- The New Wing is generated at runtime by `src/museum/Wing.tsx` and `src/museum/wingLayout.ts`; there is no additional Blender export for it.
- To regenerate the baked models, use Blender 4.5 LTS and run the commands below from the repository root. Supply Blender’s executable path if it is outside `PATH`.

```powershell
node scripts/make-materials.mjs
blender --background --factory-startup --python-exit-code 1 --python scripts/model-museum.py
npm.cmd run assets:optimize
node scripts/make-surface-detail.mjs
```

ImageGen provided the opening’s lamp-lit museum desk and the fictional 35 mm French travel photographs. The 3D textures, architecture, and interface artwork are original to this build. [Instrument Serif](https://github.com/Instrument/instrument-serif) and [DM Sans](https://github.com/googlefonts/dm-fonts) use the SIL Open Font License.
