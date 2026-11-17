import { build } from 'vite';

// The browser tests cover the museum experience, not the private backend.
// Build with the static collection and the sign-in gate bypassed.
process.env.VITE_DEMO_MODE = '1';
process.env.NODE_ENV = 'production';

await build();
