import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const api = { '/api': { target: 'http://127.0.0.1:8787' } };

export default defineConfig(({ command, mode }) => {
  const demo = mode === 'demo';

  if (command === 'build') {
    if (demo && process.env.VERCEL === '1') {
      throw new Error('Demo builds are disabled on Vercel.');
    }
    if (!demo && loadEnv(mode, process.cwd(), 'VITE_DEMO_MODE').VITE_DEMO_MODE === '1') {
      throw new Error('Remove VITE_DEMO_MODE=1 from the standard build or use npm run build:e2e.');
    }
  }

  return {
    plugins: [react()],
    build: { outDir: demo ? 'dist-demo' : 'dist' },
    server: { proxy: api },
    preview: { proxy: demo ? {} : api },
    test: { include: ['tests/unit/**/*.test.ts'] },
  };
});
