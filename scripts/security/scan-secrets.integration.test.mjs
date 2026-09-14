import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scannerPath = fileURLToPath(new URL('./scan-secrets.mjs', import.meta.url));
const temporaryRepositories = [];

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const createRepository = name => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rafiq-secret-scan-${name}-`));
  temporaryRepositories.push(directory);
  git(directory, 'init', '--quiet');
  git(directory, 'config', 'user.name', 'Rafiq Security Test');
  git(directory, 'config', 'user.email', 'security-test@example.invalid');
  return directory;
};

const commitAll = (directory, message) => {
  git(directory, 'add', '--all');
  git(directory, 'commit', '--quiet', '-m', message);
};

const runScanner = directory =>
  spawnSync(process.execPath, [scannerPath], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

const expectSecretFailure = (result, secretValue, expectedSource) => {
  assert.equal(result.status, 1, `${expectedSource} should fail the secret scan`);
  assert.equal(result.stderr.includes(expectedSource), true);
  assert.equal(
    `${result.stdout}${result.stderr}`.includes(secretValue),
    false,
    'scanner output must redact values',
  );
};

const suspiciousValue = ['production', 'secret', 'x'.repeat(32)].join('-');
const assignedSecret = `const clientSecret = "${suspiciousValue}";\n`;

try {
  const cleanRepository = createRepository('clean');
  fs.writeFileSync(path.join(cleanRepository, 'safe.txt'), 'safe content\n');
  commitAll(cleanRepository, 'initial safe content');
  assert.equal(runScanner(cleanRepository).status, 0);

  const stagedRepository = createRepository('staged');
  const stagedFile = path.join(stagedRepository, 'config.ts');
  fs.writeFileSync(stagedFile, 'export const configured = false;\n');
  commitAll(stagedRepository, 'initial safe config');
  fs.writeFileSync(stagedFile, assignedSecret);
  git(stagedRepository, 'add', 'config.ts');
  fs.writeFileSync(stagedFile, 'export const configured = false;\n');
  expectSecretFailure(runScanner(stagedRepository), suspiciousValue, 'staged blob');

  const conflictedRepository = createRepository('conflicted-index');
  const conflictedFile = path.join(conflictedRepository, 'config.ts');
  fs.writeFileSync(conflictedFile, 'export const mode = "base";\n');
  commitAll(conflictedRepository, 'initial base config');
  const primaryBranch = git(conflictedRepository, 'branch', '--show-current').trim();
  git(conflictedRepository, 'switch', '--quiet', '-c', 'secret-side');
  fs.writeFileSync(conflictedFile, assignedSecret);
  commitAll(conflictedRepository, 'change config on secret side');
  git(conflictedRepository, 'switch', '--quiet', primaryBranch);
  fs.writeFileSync(conflictedFile, 'export const mode = "safe-main";\n');
  commitAll(conflictedRepository, 'change config on main side');
  const mergeResult = spawnSync('git', ['merge', 'secret-side'], {
    cwd: conflictedRepository,
    encoding: 'utf8',
  });
  assert.notEqual(mergeResult.status, 0, 'fixture must create an unresolved index');
  fs.writeFileSync(conflictedFile, 'export const mode = "safe-worktree";\n');
  expectSecretFailure(
    runScanner(conflictedRepository),
    suspiciousValue,
    'staged blob stage 3 config.ts',
  );

  const untrackedRepository = createRepository('untracked');
  fs.writeFileSync(path.join(untrackedRepository, 'safe.txt'), 'safe content\n');
  commitAll(untrackedRepository, 'initial safe content');
  fs.writeFileSync(path.join(untrackedRepository, 'local-config.ts'), assignedSecret);
  expectSecretFailure(runScanner(untrackedRepository), suspiciousValue, 'untracked worktree file');

  const unsafeFilenameRepository = createRepository('unsafe-filename');
  fs.writeFileSync(path.join(unsafeFilenameRepository, 'safe.txt'), 'safe content\n');
  commitAll(unsafeFilenameRepository, 'initial safe content');
  const unsafeFilename = `clientSecret="${suspiciousValue}"`;
  fs.writeFileSync(path.join(unsafeFilenameRepository, unsafeFilename), 'safe content\n');
  const unsafeFilenameResult = runScanner(unsafeFilenameRepository);
  expectSecretFailure(unsafeFilenameResult, suspiciousValue, 'untracked worktree path <redacted-path:');

  const historyRepository = createRepository('history');
  const historyFile = path.join(historyRepository, 'config.ts');
  fs.writeFileSync(historyFile, assignedSecret);
  commitAll(historyRepository, 'initial unsafe content');
  fs.writeFileSync(historyFile, 'export const configured = false;\n');
  commitAll(historyRepository, 'remove unsafe content');
  expectSecretFailure(runScanner(historyRepository), suspiciousValue, 'reachable blob');

  const detachedRepository = createRepository('detached-head');
  const detachedFile = path.join(detachedRepository, 'config.ts');
  fs.writeFileSync(detachedFile, assignedSecret);
  commitAll(detachedRepository, 'initial detached unsafe content');
  const detachedBranch = git(detachedRepository, 'branch', '--show-current').trim();
  fs.writeFileSync(detachedFile, 'export const configured = false;\n');
  commitAll(detachedRepository, 'remove detached unsafe content');
  git(detachedRepository, 'switch', '--quiet', '--detach');
  git(detachedRepository, 'branch', '-D', detachedBranch);
  expectSecretFailure(runScanner(detachedRepository), suspiciousValue, 'reachable blob');

  const messageRepository = createRepository('message');
  fs.writeFileSync(path.join(messageRepository, 'safe.txt'), 'safe content\n');
  commitAll(messageRepository, `rotate clientSecret="${suspiciousValue}"`);
  expectSecretFailure(runScanner(messageRepository), suspiciousValue, 'commit metadata');

  const tagRepository = createRepository('annotated-tag');
  fs.writeFileSync(path.join(tagRepository, 'safe.txt'), 'safe content\n');
  commitAll(tagRepository, 'initial safe content');
  git(tagRepository, 'tag', '-a', 'unsafe-metadata', '-m', `rotate clientSecret="${suspiciousValue}"`);
  expectSecretFailure(runScanner(tagRepository), suspiciousValue, 'tag metadata');

  const shallowSourceRepository = createRepository('shallow-source');
  fs.writeFileSync(path.join(shallowSourceRepository, 'safe.txt'), 'safe content\n');
  commitAll(shallowSourceRepository, 'initial safe content');
  fs.writeFileSync(path.join(shallowSourceRepository, 'safe.txt'), 'new safe content\n');
  commitAll(shallowSourceRepository, 'second safe content');
  const shallowRepository = fs.mkdtempSync(path.join(os.tmpdir(), 'rafiq-secret-scan-shallow-clone-'));
  temporaryRepositories.push(shallowRepository);
  git(
    shallowSourceRepository,
    'clone',
    '--quiet',
    '--depth',
    '1',
    `file://${shallowSourceRepository}`,
    shallowRepository,
  );
  const shallowResult = runScanner(shallowRepository);
  assert.equal(shallowResult.status, 2);
  assert.equal(shallowResult.stderr.includes('shallow Git history is not accepted'), true);
} finally {
  for (const directory of temporaryRepositories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

console.log('Secret scanner integration tests passed.');
