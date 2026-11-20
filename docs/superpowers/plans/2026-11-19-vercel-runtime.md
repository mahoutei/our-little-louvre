# Vercel API runtime repair

**Goal:** Make the compiled API load in native Node ESM and return the expected signed-out responses on staging.

**Evidence:** Preview logs report `ERR_MODULE_NOT_FOUND` for `/var/task/server/app` imported by `api/index.js`. Local tests use a bundler that resolves extensionless imports.

**Scope:** Keep application behavior and dependencies unchanged. Use `.js` relative import specifiers in the existing API/server/shared module graph.

- [x] Add a regression test in `tests/unit/server-runtime.test.ts` that compiles the server graph into an isolated temporary directory, imports `api/index.js` with native Node, and requests `/api/me`. Expect `401` and private, no-store caching without credentials or a live database. Verified it first failed with `ERR_MODULE_NOT_FOUND` for `server/app`.
- [x] Fix relative imports in `api/index.ts`, `server/*.ts`, and dependent `shared/*.ts`. Regression passed, full unit suite passed 86 tests, and production build exited 0. Existing bundle-size warning remains.
- [x] Review the diff, commit and push the repair. Commit `c5e0883` deployed to staging. Native signed-out checks returned `401` with `private, no-store` for `/api/me`, `/api/collection`, and `/api/studio`.

## Hosted verification

- Both configured staging roles accessed the collection and studio with real Supabase sessions generated for automated diagnostics. This does not verify inbox delivery or the browser's PKCE callback.
- Fictional photo upload, signed image loading, unsigned storage denial, hide/restore, deletion and physical storage cleanup passed. The original sample letter was restored after save/conflict testing.
- An isolated paused deployment returned `423` and the neutral cover for the partner, while the owner retained access. Preview's normal `PARTNER_PAUSED` setting was restored to `0`.
- Touch controls and the populated New Wing loaded in portrait and landscape emulation. Hosted screenshots exposed the private studio link wrapping the phone header over the room caption.

## Phone header repair

- [x] Reproduce the production navigation in `tests/e2e/mobile.spec.ts`, including the Private studio link. The original caption overlapped the header by about 30px at 320px width.
- [x] Reserve space for the two phone header rows in `src/styles.css`. The caption clears the header at 320px, 390px, and 430px widths and after rotation.
- [ ] Redeploy to the stable staging alias and verify the phone layout with the authenticated navigation.

Auth delivery, authenticated storage operations and physical iPhone checks remain separate release requirements. Keep production promotion pending.
