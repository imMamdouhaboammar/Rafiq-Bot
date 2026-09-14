import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { findSecretMatches } from './secret-detectors.mjs';

const MAX_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;
const knownNonProductionFixtures = new Set([
  'dummy_api_key_value_for_tests',
  'test-only-gemini-key',
  'test-only-session-secret-with-more-than-32-characters',
]);

const gitText = (args, options = {}) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    ...options,
  });

const gitBuffer = args =>
  execFileSync('git', args, {
    encoding: 'buffer',
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
  });

const splitNull = value => value.split('\0').filter(Boolean);

const findings = [];
let scannedSources = 0;

const describePath = file => {
  const containsControlCharacters = /[\u0000-\u001f\u007f]/.test(file);
  const containsDetectedSecret = findSecretMatches(
    'repository path',
    file,
    knownNonProductionFixtures,
  ).length > 0;

  if (!containsControlCharacters && !containsDetectedSecret) return file;

  const fingerprint = crypto.createHash('sha256').update(file).digest('hex').slice(0, 12);
  return `<redacted-path:${fingerprint}>`;
};

const scanPath = (kind, file) => {
  const source = `${kind} path ${describePath(file)}`;
  findings.push(...findSecretMatches(source, file, knownNonProductionFixtures));
};

const scanBuffer = (source, buffer) => {
  scannedSources += 1;
  findings.push(...findSecretMatches(
    source,
    buffer.toString('utf8'),
    knownNonProductionFixtures,
  ));
};

const scanWorktree = () => {
  const trackedPaths = splitNull(gitText(['ls-files', '-z']));
  const untrackedPaths = splitNull(gitText([
    'ls-files', '--others', '--exclude-standard', '-z',
  ]));

  for (const file of trackedPaths) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    scanPath('worktree', file);
    scanBuffer(`worktree file ${describePath(file)}`, fs.readFileSync(file));
  }

  for (const file of untrackedPaths) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    scanPath('untracked worktree', file);
    scanBuffer(`untracked worktree file ${describePath(file)}`, fs.readFileSync(file));
  }
};

const scanIndex = () => {
  const entries = splitNull(gitText(['ls-files', '--stage', '-z']));

  for (const entry of entries) {
    const match = entry.match(/^\d+ ([0-9a-f]+) (\d+)\t([\s\S]+)$/);
    if (!match) throw new Error('Unable to parse a Git index entry.');
    const [, objectId, stage, file] = match;
    scanPath(`index stage ${stage}`, file);
    scanBuffer(
      `staged blob stage ${stage} ${describePath(file)}`,
      gitBuffer(['cat-file', 'blob', objectId]),
    );
  }
};

const listReachableObjects = () => {
  const lines = gitText(['rev-list', '--objects', '--all', 'HEAD'])
    .split('\n')
    .filter(Boolean);
  const objects = [];
  const seen = new Set();

  for (const line of lines) {
    const separator = line.indexOf(' ');
    const objectId = separator === -1 ? line : line.slice(0, separator);
    if (seen.has(objectId)) continue;
    seen.add(objectId);
    objects.push({
      objectId,
      path: separator === -1 ? '' : line.slice(separator + 1),
    });
  }

  const typeOutput = gitText(
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    { input: `${objects.map(object => object.objectId).join('\n')}\n` },
  );
  const types = new Map(
    typeOutput
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(' ')),
  );

  const supportedTypes = new Set(['blob', 'commit', 'tag', 'tree']);
  for (const object of objects) {
    const type = types.get(object.objectId);
    if (!type || !supportedTypes.has(type)) {
      throw new Error('Git returned an unrecognized reachable object.');
    }
  }

  return objects.map(object => ({ ...object, type: types.get(object.objectId) }));
};

const scanReachableHistory = () => {
  for (const object of listReachableObjects()) {
    if (object.type === 'blob') {
      if (object.path) scanPath('reachable object', object.path);
      const label = object.path ? describePath(object.path) : object.objectId.slice(0, 12);
      scanBuffer(`reachable blob ${label}`, gitBuffer(['cat-file', 'blob', object.objectId]));
    } else if (object.type === 'tag') {
      scanBuffer(
        `tag metadata ${object.objectId.slice(0, 12)}`,
        gitBuffer(['cat-file', 'tag', object.objectId]),
      );
    }
  }

  const commits = gitText(['rev-list', '--all', 'HEAD'])
    .split('\n')
    .filter(Boolean);
  for (const commit of commits) {
    scanBuffer(`commit metadata ${commit.slice(0, 12)}`, gitBuffer(['cat-file', 'commit', commit]));
  }
};

try {
  const isShallow = gitText(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  if (isShallow) {
    console.error('Secret scan requires a full checkout; shallow Git history is not accepted.');
    process.exit(2);
  }

  scanWorktree();
  scanIndex();
  scanReachableHistory();
} catch (error) {
  console.error('Unable to scan repository state. No partial result will be accepted.');
  console.error(error instanceof Error ? `Failure type: ${error.name}` : 'Failure type: unknown');
  process.exit(2);
}

if (findings.length > 0) {
  console.error('Potential secrets detected. Values are intentionally not printed.');
  for (const finding of findings) {
    console.error(`- ${finding.detector} at ${finding.source}:${finding.line}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed across ${scannedSources} repository sources, including paths, the worktree, index, reachable blobs, and commit/tag metadata.`);
