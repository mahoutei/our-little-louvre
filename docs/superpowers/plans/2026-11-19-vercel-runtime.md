# Vercel API runtime repair

**Goal:** Make the compiled API load in native Node ESM and return the expected signed-out responses on staging.

**Evidence:** Preview logs report `ERR_MODULE_NOT_FOUND` for `/var/task/server/app` imported by `api/index.js`. Local tests use a bundler that resolves extensionless imports.

**Scope:** Keep application behavior and dependencies unchanged. Use `.js` relative import specifiers in the existing API/server/shared module graph.

- [x] Add a regression test in `tests/unit/server-runtime.test.ts` that compiles the server graph into an isolated temporary directory, imports `api/index.js` with native Node, and requests `/api/me`. Expect `401` and private, no-store caching without credentials or a live database. Verified it first failed with `ERR_MODULE_NOT_FOUND` for `server/app`.
- [x] Fix relative imports in `api/index.ts`, `server/*.ts`, and dependent `shared/*.ts`. Regression passed, full unit suite passed 86 tests, and production build exited 0. Existing bundle-size warning remains.
- [ ] Review the diff, commit and push the repair. Deploy that exact commit to Vercel staging and verify `/api/me`, `/api/collection`, and `/api/studio` return `401`.

Auth delivery, authenticated storage operations and physical iPhone checks remain separate release requirements. Keep production promotion pending.
