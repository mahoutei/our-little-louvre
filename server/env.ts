import { config } from 'dotenv';
import { DEFAULT_ALLEY_CAPACITY, DEFAULT_MAX_ALLEYS } from '../shared/config';
import { DEFAULT_PARTNER_PAUSE_MESSAGE } from '../shared/pause';

// Vercel supplies real environment variables. Locally, the secrets live in
// .env.local, which is gitignored. Never import this module in browser code.
for (const path of ['.env.local', '.env']) {
  config({ path, override: false, quiet: true });
}

const text = (name: string) => (process.env[name] ?? '').trim();
const integer = (name: string, fallback: number) => {
  const value = Number.parseInt(text(name), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const ownerEmail = text('OWNER_EMAIL').toLowerCase();
const partnerEmail = text('PARTNER_EMAIL').toLowerCase();
const flags = (name: string) => /^(1|true|yes|on)$/i.test(text(name));

export const env = {
  databaseUrl: text('DATABASE_URL'),
  directUrl: text('DIRECT_URL'),
  supabaseUrl: text('SUPABASE_URL').replace(/\/$/, ''),
  supabasePublishableKey: text('SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: text('SUPABASE_SECRET_KEY'),
  ownerEmail,
  partnerEmail,
  ownerName: text('OWNER_NAME'),
  partnerName: text('PARTNER_NAME'),
  partnerPaused: flags('PARTNER_PAUSED'),
  partnerPausedMessage: text('PARTNER_PAUSED_MESSAGE') || DEFAULT_PARTNER_PAUSE_MESSAGE,
  museumName: text('MUSEUM_NAME') || 'Our Little Louvre',
  alleyCapacity: integer('WING_ALLEY_CAPACITY', DEFAULT_ALLEY_CAPACITY),
  maxAlleys: integer('WING_MAX_ALLEYS', DEFAULT_MAX_ALLEYS),
};

export function serverReady(): boolean {
  return Boolean(env.databaseUrl && env.supabaseUrl && env.supabaseSecretKey);
}

export function guestListReady(): boolean {
  return Boolean(env.ownerEmail || env.partnerEmail);
}

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return Boolean(normalized && (normalized === env.ownerEmail || normalized === env.partnerEmail));
}

export function roleFor(email: string): 'OWNER' | 'PARTNER' {
  return email.trim().toLowerCase() === env.ownerEmail ? 'OWNER' : 'PARTNER';
}

export function nameFor(email: string): string {
  const normalized = email.trim().toLowerCase();
  const configured = normalized === env.ownerEmail ? env.ownerName : normalized === env.partnerEmail ? env.partnerName : '';
  if (configured) return configured;
  const local = normalized.split('@')[0] ?? 'Guest';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Guest';
}
