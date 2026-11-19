import { handle } from '@hono/vercel';
import { app } from '../server/app.js';

export const config = { maxDuration: 30 };

export default { fetch: handle(app) };
