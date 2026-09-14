import { execFileSync } from 'node:child_process';
import path from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const allowedExact = new Set(['.env.example']);
const blockedBasenames = [
  /^\.env(?:\..+)?$/i,
  /^service-account(?:-.+)?\.json$/i,
  /^credentials\.json$/i,
  /^client_secret.*\.json$/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
];
const blockedExtensions = new Set(['.pem', '.p12', '.pfx', '.key', '.keystore', '.jks']);
const blockedSegments = new Set([
  'node_modules',
  'dist',
  'build',
  '.vercel',
  'tmp',
  'local_cache',
  '.agent-kernel-backups',
  '.agents',
  '.specify',
  '.mavis',
  '.unslop',
]);
const blockedArtifactExtensions = new Set([
  '.onnx', '.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.tflite', '.gguf', '.ggml',
]);

const violations = tracked.filter(file => {
  if (allowedExact.has(file)) return false;

  const normalized = file.replaceAll('\\', '/');
  const parts = normalized.split('/');
  const basename = parts.at(-1) ?? normalized;
  const extension = path.extname(basename).toLowerCase();

  return (
    parts.some(segment => blockedSegments.has(segment)) ||
    blockedBasenames.some(pattern => pattern.test(basename)) ||
    blockedExtensions.has(extension) ||
    blockedArtifactExtensions.has(extension) ||
    basename === 'Archive.zip' ||
    basename === 'skills-lock.json'
  );
});

if (violations.length > 0) {
  console.error('Tracked sensitive or local-only files detected:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Tracked-file safety check passed for ${tracked.length} files.`);
