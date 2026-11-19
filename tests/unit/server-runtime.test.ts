import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { expect, it } from 'vitest';

it('loads the compiled API in native Node and rejects signed-out requests', async () => {
  const root = process.cwd();
  const output = await mkdtemp(join(root, '.server-runtime-'));
  try {
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    for (const directory of ['api', 'server', 'shared']) {
      await mkdir(join(output, directory));
      for (const file of await readdir(join(root, directory))) {
        if (!file.endsWith('.ts')) continue;
        const source = await readFile(join(root, directory, file), 'utf8');
        const compiled = transpileModule(source, {
          compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
        });
        await writeFile(join(output, directory, file.replace(/\.ts$/, '.js')), compiled.outputText);
      }
    }
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import api from './api/index.js';
      const response = await api.fetch(new Request('https://museum.example/api/me'));
      console.log(JSON.stringify({ status: response.status, cache: response.headers.get('cache-control') }));
    `], {
      cwd: output,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SECRET_KEY: 'test-only-key',
        OWNER_EMAIL: 'owner@example.com',
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ status: 401, cache: 'private, no-store' });
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
