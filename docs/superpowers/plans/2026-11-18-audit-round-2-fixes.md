# Round 2 audit fixes — implementation plan

> Inline execution in the current feature branch. Steps use checkbox syntax.

**Goal:** Fix the confirmed round-2 audit findings without changing the museum design or the ten baked exhibits.

**Scope:** Audit findings 1–11 and 13. Finding 12 (orphan-upload cron) and 14 (merge wing meshes) are deferred until measured or a retention policy exists. Finding 15 is documentation plus a Supabase dashboard step after both accounts have signed in.

**Tech:** React 19, three.js, Hono, Prisma, Supabase, Vitest, Playwright.

## Global constraints

- Keep the ten baked originals, the Blender gallery, the New Wing geometry, and the letter design unchanged.
- No new dependencies.
- No magic link to Dianne and no writes to the live database during this work.
- Every new branch or parser rule gets a test that failed first.
- Update `README.md` only where behavior or operator steps changed.

## Tasks

### Task 1: Capacity safety and the fixed six-frame geometry

**Files:** `shared/config.ts`, `src/exhibits/collection.ts`, `tests/unit/collection.test.ts`.

- [x] Add `MAX_FRAMES_PER_ALLEY = 6` and make `DEFAULT_ALLEY_CAPACITY` use it.
- [x] Test: a photo in frame 5 still parses when the reported capacity is 4.
- [x] Test: a frame number of 6 is rejected.
- [x] Test: a reported capacity above 6 is rejected.
- [x] Change the parser to use `MAX_FRAMES_PER_ALLEY` for both checks.
- [x] Run `npm test -- tests/unit/collection.test.ts`.

### Task 2: Hidden photos still count against a frame

**Files:** `shared/types.ts`, `shared/slots.ts`, `server/serialize.ts`, `src/exhibits/collection.ts`, `src/museum/Wing.tsx`, `tests/unit/slots.test.ts`, `tests/unit/collection.test.ts`.

- [x] Test `groupWingRows` with published and hidden rows in two alleys; free counts include hidden rows.
- [x] Test `parseCollection` accepts `remaining` on an alley and rejects a negative count.
- [x] Add `WingAlley.remaining`.
- [x] Add `groupWingRows(rows, capacity)` to `shared/slots.ts`; free frames count only slots below the current capacity.
- [x] `buildCollection` reads all wing rows, signs only the rows it will show, groups all rows, and returns `remaining` plus visible exhibits. Alleys with only hidden rows remain in the list with `exhibits: []`.
- [x] The wing plaque uses `lastAlley.remaining`, not `capacity - published`.
- [x] Run the slot and collection tests.

### Task 3: Letter conflicts and shared limits

**Files:** `shared/config.ts`, `shared/types.ts`, `server/app.ts`, `src/api/client.ts`, `src/studio/Studio.tsx`, `tests/unit/routes.test.ts`.

- [x] Create the route test harness with mocked `server/env`, `server/prisma`, and `server/supabase`.
- [x] Test: `/api/me` returns the pause message; `/api/collection` returns 423 for a paused partner.
- [x] Test: `/api/exhibits` rejects a path owned by another member.
- [x] Test: `PUT /api/letter` rejects 13 paragraphs.
- [x] Test: a stale `updatedAt` returns 409 and does not overwrite; a missing `updatedAt` returns 400.
- [x] Add `updatedAt` to the letter save input and use `updateMany` with `id + updatedAt`; return 409 on zero rows.
- [x] Send `updatedAt` from `LetterEditor` through `Studio.saveLetter` and `api.saveLetter`.
- [x] Replace the hardcoded letter limits in `server/app.ts` and `Studio.tsx` with `LIMITS`.
- [x] Run the route test and the suite.

### Task 4: Do not delete a photo that was hung

**Files:** `server/app.ts`, `tests/unit/routes.test.ts`.

- [x] Test: when the transaction rejects but an exhibit already references the paths, storage removal is not called.
- [x] Test: when no exhibit references the paths, storage removal is called.
- [x] In the create catch, check `prisma.exhibit.findFirst` before removing; if the check fails, keep the files. Skip the check for `WingFullError`.
- [x] Run the route test.

### Task 5: Wing sightlines and pause refresh

**Files:** `src/museum/sightline.ts`, `tests/unit/sightline.test.ts`, `src/museum/Museum.tsx`, `src/auth/AuthProvider.tsx`.

- [x] Test `hasClearSightline` with a wall between the ray and the frame, and with a clear path.
- [x] Add the helper and use it in the gallery click, gallery target loop, wing click, and wing target loop. Keep a ref to the wing architecture group.
- [x] Poll `/api/me` every 60 seconds while signed in; clear the member when a pause appears.
- [x] Run the sightline test and the suite.

### Task 6: Lean-up and loud failures

**Files:** `server/serialize.ts`, `shared/types.ts`, `src/studio/Studio.tsx`, `server/app.ts`, `server/http.ts`, `shared/config.ts`, `shared/slots.ts`, `tests/unit/slots.test.ts`, `scripts/setup-supabase.mjs`, `prisma/seed.mjs`.

- [x] Remove server-side `stats`; keep the client `statsOf` and add a shared `StudioStats` type.
- [x] Delete `/api/health`, `textField`, `ACCEPTED_IMAGE_TYPES`, `remainingInAlley`, and `alleyTotal`; update the slot test.
- [x] Make `setup-supabase.mjs` exit nonzero when a bucket update or database hardening step fails.
- [x] Make `seed.mjs` fall back to the sample letter only for `ENOENT`.
- [x] Run `node --check` on both scripts and the full suite.

### Task 7: Documentation and verification

**Files:** `README.md`, this plan.

- [x] Document the one-minute pause refresh, the letter reload-on-conflict behavior, the setup script's nonzero exit, and the post-onboarding Supabase sign-up step.
- [x] Run `npm test`, `npm run build`, and `npm run test:e2e`.
- [x] Record the outputs here and in the final report.

### Verification

- `npm test`: 9 files, 62 tests passed.
- `npm run build`: TypeScript check and Vite build passed; Vite still reports the existing chunk-size warning for the Three.js bundles.
- `npm run test:e2e`: 11 tests passed in 2.6 minutes, using the demo build.
- `node --check scripts/setup-supabase.mjs` and `node --check prisma/seed.mjs`: passed.

## Deferred

- **Finding 12:** orphan-upload cleanup needs a retention policy and a scheduled job; a destructive script is not safe to add without both.
- **Finding 14:** merging the wing meshes must be measured on a full 144-photo wing first.
- **Finding 15 code:** keep `shouldCreateUser: true` until Dianne has signed in once; the README documents the switch-off step.
