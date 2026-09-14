import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const text = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const pkg = JSON.parse(text('package.json'));
assert(pkg.packageManager === 'bun@1.4.2', `packageManager must pin the verified Bun version, got ${pkg.packageManager ?? 'missing'}`);
assert(!fs.existsSync(path.join(root, 'package-lock.json')), 'package-lock.json must not compete with bun.lock');
assert(fs.existsSync(path.join(root, 'bun.lock')), 'bun.lock must remain the canonical lockfile');

const ci = text('.github/workflows/ci.yml');
assert(ci.includes('uses: oven-sh/setup-bun@v2'), 'CI must install Bun through setup-bun');
assert(!ci.includes('bun-version: latest'), 'CI must not float on Bun latest');
assert(!ci.includes('bun-version:'), 'CI should resolve Bun from package.json packageManager');
assert(ci.includes('run: bun install --frozen-lockfile'), 'CI install must be frozen');
for (const command of ['bun run typecheck', 'bun run test:p0', 'bun test', 'bun run security:scan', 'bun run build']) {
  assert(ci.includes(`run: ${command}`), `CI must run ${command}`);
}
assert(!/run:\s+npm\b/.test(ci), 'CI must not mix npm commands into the canonical Bun workflow');

const vercel = JSON.parse(text('vercel.json'));
assert(vercel.installCommand === 'bun install --frozen-lockfile', 'Vercel install must use the frozen Bun lockfile');
assert(vercel.buildCommand === 'bun run build', 'Vercel build must use the canonical Bun script');
assert(vercel.outputDirectory === 'dist', 'Vercel outputDirectory must remain dist');
assert(vercel.framework === 'vite', 'Vercel framework must remain vite');

console.log('OSS delivery contract passed.');
