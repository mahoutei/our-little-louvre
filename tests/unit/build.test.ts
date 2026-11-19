import { resolveConfig } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

it('rejects demo mode in the standard build', async () => {
  vi.stubEnv('VITE_DEMO_MODE', '1');
  await expect(resolveConfig({ mode: 'production' }, 'build').then(() => undefined))
    .rejects.toThrow('VITE_DEMO_MODE');
});

it('rejects explicit demo builds on Vercel', async () => {
  vi.stubEnv('VERCEL', '1');
  await expect(resolveConfig({ mode: 'demo' }, 'build').then(() => undefined))
    .rejects.toThrow('Vercel');
});

it('builds and previews the demo in a separate directory', async () => {
  vi.stubEnv('VERCEL', undefined);
  vi.stubEnv('VITE_DEMO_MODE', '1');
  const build = await resolveConfig({ mode: 'demo' }, 'build');
  const preview = await resolveConfig({ mode: 'demo' }, 'serve', 'production', 'production', true);
  expect(build.build.outDir).toBe('dist-demo');
  expect(preview.build.outDir).toBe('dist-demo');
  expect(preview.preview.proxy).toEqual({});
});
