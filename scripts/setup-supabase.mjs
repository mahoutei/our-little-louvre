import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { STORAGE_BUCKET } from '../shared/config.ts';

config({ path: '.env.local', override: false, quiet: true });

const url = (process.env.SUPABASE_URL ?? '').trim();
const secret = (process.env.SUPABASE_SECRET_KEY ?? '').trim();
if (!url || !secret) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error('Could not list storage buckets:', listError.message);
  process.exit(1);
}

if (buckets.some((bucket) => bucket.name === STORAGE_BUCKET)) {
  console.log(`Storage bucket "${STORAGE_BUCKET}" already exists.`);
  const { error } = await supabase.storage.updateBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
  });
  if (error) {
    console.error('Could not refresh bucket settings:', error.message);
    process.exit(1);
  }
} else {
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
  });
  if (error) {
    console.error('Could not create the storage bucket:', error.message);
    process.exit(1);
  }
  console.log(`Created private storage bucket "${STORAGE_BUCKET}".`);
}

// The museum API is the only door into these tables. Revoke the Data API roles
// so the publishable key cannot read personal photographs or the letter.
const prisma = new PrismaClient();
let hardeningFailed = false;
for (const statement of [
  'ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "Exhibit" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "DiscardedUpload" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "Letter" ENABLE ROW LEVEL SECURITY',
  'REVOKE ALL ON TABLE "Member", "Exhibit", "DiscardedUpload", "Letter", "_prisma_migrations" FROM anon, authenticated',
  'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated',
]) {
  try {
    await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    hardeningFailed = true;
    console.error(`Database hardening step failed: ${statement}`, error.message);
  }
}
await prisma.$disconnect();
if (hardeningFailed) {
  console.error('Database hardening did not finish. Fix the error above and run this script again.');
  process.exit(1);
}
console.log('Database tables are private to the service role.');
