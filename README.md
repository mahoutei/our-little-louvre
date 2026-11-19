# Our Little Louvre

A phone-first, first-person museum for two. Enter through the blue-hour courtyard, explore the Gallery of Us and the New Wing, and find a letter at the final exhibit. The ten original photos are fictional travel memories bundled with the site. Your uploads and the private letter live in Supabase.

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

3. Create the tables, then set up private storage and lock down access to the tables.

   ```powershell
   npm.cmd run db:migrate
   if ($LASTEXITCODE -ne 0) { throw 'Museum migration failed.' }
   npm.cmd run setup:supabase
   ```

   Run the commands in order. The setup script exits with an error if it cannot refresh the bucket or lock down a table. Seed the collection after both commands succeed.

4. Seed the original collection.

   ```powershell
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

If the browser's Supabase settings are missing, the entrance shows a setup message. Add the values, restart `npm run dev`, and reload.

### The letter

The active letter is stored in Supabase and edited in the studio. The public JSON in `public/content/exhibits.json` contains a separate, longer fictional sample letter for the demo build.

For a private starting draft, create `prisma/letter.json` before the first `db:seed`:

```json
{
  "title": "A Letter for You",
  "paragraphs": ["Dear you,", "The words that belong at the end of the gallery.", "With love"]
}
```

`prisma/letter.json` is gitignored. If it is absent, the seed uses a short sample letter. Any other error reading the file stops the seed instead of silently replacing your draft. After the first seed, the database is the source of truth, so re-running the seed will not replace a letter written in the studio.

Saves are versioned. If the other person saved the letter after you opened it, your save is refused, the latest letter is loaded, and the studio asks you to make your changes again. The first save is never overwritten.

## The studio

The masthead’s **Private studio** link opens `/studio`. Both members have the same permissions.

- **Hang a memory** — choose or drop a photograph. The browser rotates, downsizes, and re-encodes it, then uploads the display copy and thumbnail directly to the private bucket through one-use signed URLs. The API verifies the upload before creating the exhibit.
- **The letter** — edit the title and up to twelve paragraphs. The saved letter replaces the final exhibit’s letter for both of you.
- **Name on the label** — set the name shown on the labels you hang.
- **The New Wing** — edit a photograph’s title, date, story, and description; hide it from the museum without deleting it; or remove it and free its frame. A hidden photograph keeps its frame, but its label and image are not sent to the museum.
- **The Gallery of Us** — edit the labels of the ten baked originals.

### Keeping the surprise

The owner can keep preparing the museum without spoiling it for the partner:

```powershell
PARTNER_PAUSED=1
PARTNER_PAUSED_MESSAGE="Dean is cooking something"
```

With the flag on, the partner’s sign-in still succeeds, but the museum and studio routes answer `423` and the browser shows a neutral cover page with the configured message. The owner is never paused. The page deliberately has no museum name, no logo, no photographs, and no canvas, so an early visit does not reveal the project; its document title is the message itself.

Set `PARTNER_PAUSED=1` in `.env.local` for local work, and in the hosting environment for production. Either way the API reads the value at startup, so restart `npm run dev` (or redeploy) after changing it. Remove the flag, or set it to `0`, to reopen the partner’s side. `PARTNER_PAUSED_MESSAGE` defaults to `Dean is cooking something`.

A signed-in partner’s browser checks `/api/me` once a minute while the tab is active. The next successful check applies the pause setting.

The API checks the session before returning the collection, the studio, or new signed photo URLs. Anyone holding a signed photo URL can use it until it expires, up to six hours from issuance. That expiry still applies after sign-out, a pause, or hiding the photo from the gallery. Treat signed URLs as private. Keep `public/content` limited to fictional demo material because Vercel serves those files directly. [Supabase signed URL documentation](https://supabase.com/docs/guides/storage/security/signing-keys)

## Checks

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

`npm run test:e2e` builds a demo copy in `dist-demo/`. The browser suite uses the static collection and bypasses sign-in. The production build goes to `dist/`. The suite uses Microsoft Edge on Windows. On other platforms, install Chromium with `npx playwright install chromium`. The 3D walkthrough test renders with software WebGL and can take about a minute.

To preview the demo locally, run `npm.cmd run build:e2e` followed by `npm.cmd run preview -- --mode demo`.

## Deploying

The repository includes `vercel.json` and a serverless Hono entry point at `api/index.ts`. The same Hono app runs on Node locally and on Vercel in production.

1. Set the project to Node 22 or newer in Vercel, with `npm run build` as the build command and `dist` as the output directory. Configure Preview with placeholder content in a separate Supabase project. For each environment, set the server values `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OWNER_EMAIL` and `PARTNER_EMAIL`, plus any display names or pause settings you use. Set the browser's `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for that same Supabase project. Keep `DIRECT_URL` in the environment you use for migrations. [Vercel environments](https://vercel.com/docs/deployments/environments)
2. Prepare each Supabase project from your machine using that project's environment values. Use a fresh checkout for the first deployment so the seed uses the built-in sample letter.

   ```powershell
   npm.cmd run db:deploy
   if ($LASTEXITCODE -ne 0) { throw 'Museum migration failed.' }
   npm.cmd run setup:supabase
   if ($LASTEXITCODE -ne 0) { throw 'Supabase setup failed.' }
   npm.cmd run db:seed
   ```

3. Configure custom SMTP for production magic links. Supabase's default sender is limited to project team addresses. In each Supabase project's **Authentication → URL Configuration**, set **Site URL** to the appropriate origin and add the exact `/auth/callback` URL for the host you will test. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
4. Verify a Vercel Preview of the release branch with placeholder content before merging into the production branch or promoting the deployment.

   - Open `/` and `/studio` in a signed-out window. Confirm they show sign-in, that `/api/me`, `/api/collection`, and `/api/studio` return `401`, and that an unsigned storage object URL denies access.
   - With the two staging accounts, check the magic-link callback, the second guest's sign-in, and the pause cover. Confirm paused collection and studio requests return `423` while the owner retains access.
   - In the studio, upload a placeholder photo, open it from the New Wing and photo index, hide it, then delete it. Save a placeholder letter and open it from both routes. On the intended iPhone, complete a walkthrough in portrait and landscape and check responsiveness with the New Wing populated.

5. Promote after the preview checks pass. Recheck the production domain, callback, and signed-out access before adding personal material. After both guests have signed in once, turn off **Allow new users to sign up** in Supabase. Keep the previous verified production deployment available for rollback when there is one. [Vercel promotion and rollback](https://vercel.com/docs/deployments/promote-preview-to-production)

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
