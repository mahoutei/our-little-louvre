# Museum audit fixes — 2026-11-18

**Goal:** Fix the highest-impact correctness, privacy, and accessibility issues found in the whole-repo audit without changing the museum's design.

**Architecture:** Pure helpers get unit tests. Contract changes stay in `shared/`. No new runtime dependencies, routes, or abstractions.

**Tech stack:** React 19, TypeScript, Hono, Prisma, Supabase, Vitest, Playwright.

## Tasks

### Task 1: Guard post-sign-in redirects

**Files:** `shared/validation.ts`, `src/auth/AuthGate.tsx`, `src/auth/AuthProvider.tsx`, `tests/unit/validation.test.ts`

- [x] Test: local paths are kept; `https://`, `//host`, `/\host`, and control characters fall back to `/`.
- [x] Implement `safeReturnTo(value?: string | null): string`.
- [x] Use it when storing and reading `RETURN_TO_KEY`.

### Task 2: Show the saved letter title in the museum

**Files:** `shared/types.ts`, `src/exhibits/manifest.ts`, `server/serialize.ts`, `src/exhibits/ExhibitPanel.tsx`, `src/App.tsx`, `public/content/exhibits.json`, `tests/unit/manifest.test.ts`, `tests/unit/collection.test.ts`

- [x] Test: the manifest keeps `finale.letterTitle`; a manifest without one falls back to “A Letter for You”.
- [x] Add `letterTitle` to `Manifest.finale` and every producer.
- [x] Pass it through `App` to the letter heading in `ExhibitPanel`.

### Task 3: Never delete a photograph that was already hung

**Files:** `src/studio/Studio.tsx`, `server/app.ts`

- [x] Clear the cleanup path list before `createExhibit`; a late 5xx must not delete live files.
- [x] The API removes newly uploaded files only when it rejects the exhibit before creating it.

### Task 4: Keep the wing geometry and limits consistent

**Files:** `server/env.ts`, `shared/slots.ts`, `tests/unit/slots.test.ts`

- [x] Test: gaps in existing alleys are still filled after the growth limit is lowered.
- [x] Clamp the server knobs to the geometry's 6-frame / 24-alley maximums.

### Task 5: Accessibility and deployment hardening

**Files:** `src/studio/Studio.tsx`, `src/studio/studio.css`, `vercel.json`, `scripts/setup-supabase.mjs`

- [x] Replace the label-wrapped hidden file input with a real button.
- [x] Add `nosniff`, frame-denial, and referrer headers.
- [x] Revoke residual API grants on `_prisma_migrations`.

### Task 6: Verify

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `npm run setup:supabase` remains idempotent.
