#!/usr/bin/env node
// Exports the remote (prod) D1 database and applies it to the local dev environment.
import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dump = join(root, 'prod-dump.sql');
const state = join(root, '.wrangler', 'state');

console.log('→ Exporting prod DB…');
execSync(`npx wrangler d1 export p-airi --remote --output "${dump}"`, { stdio: 'inherit', cwd: root });

console.log('→ Clearing local state…');
if (existsSync(state)) rmSync(state, { recursive: true, force: true });

console.log('→ Applying prod dump to local DB…');
execSync(`npx wrangler d1 execute p-airi --local --file "${dump}"`, { stdio: 'inherit', cwd: root });

console.log('✓ Local DB synced from prod.');
