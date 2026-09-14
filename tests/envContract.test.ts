import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimeFiles = [
  path.join(root, 'server.ts'),
  ...walk(path.join(root, 'api')),
  ...walk(path.join(root, 'services')),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const runtimeKeys = new Set<string>();
for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) runtimeKeys.add(match[1]);
  for (const match of source.matchAll(/\breadNumber\(['"]([A-Z][A-Z0-9_]+)['"]/g)) runtimeKeys.add(match[1]);
  if (file.endsWith('googleClient.server.ts')) {
    for (const match of source.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) runtimeKeys.add(match[1]);
  }
}

const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const exampleKeys = new Set(
  example.split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean) as string[],
);
const envDocs = fs.readFileSync(path.join(root, 'docs/configuration/env-reference.md'), 'utf8');
const documentedKeys = new Set([...envDocs.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((match) => match[1]));

const missingFromExample = [...runtimeKeys].filter((key) => !exampleKeys.has(key)).sort();
const missingFromDocs = [...exampleKeys].filter((key) => !documentedKeys.has(key)).sort();

assert.deepEqual(missingFromExample, [], `Runtime env keys missing from .env.example: ${missingFromExample.join(', ')}`);
assert.deepEqual(missingFromDocs, [], `.env.example keys missing from env reference: ${missingFromDocs.join(', ')}`);
console.log(`Environment contract passed for ${runtimeKeys.size} runtime keys and ${exampleKeys.size} documented example keys.`);
