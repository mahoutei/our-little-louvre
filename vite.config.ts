import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const api = { '/api': { target: 'http://127.0.0.1:8787' } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
