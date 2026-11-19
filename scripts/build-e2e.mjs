import { build } from 'vite';

// Use the static collection and bypass sign-in for browser tests.
process.env.VITE_DEMO_MODE = '1';
process.env.NODE_ENV = 'production';

await build({ mode: 'demo' });
