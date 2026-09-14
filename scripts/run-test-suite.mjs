import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const testsDirectory = path.join(root, 'tests');
const tsxBinary = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const entries = await fs.readdir(testsDirectory, { withFileTypes: true });
const tests = entries
  .filter(entry => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map(entry => path.join('tests', entry.name))
  .sort((left, right) => left.localeCompare(right));

if (tests.length === 0) {
  console.error('No TypeScript test files were found.');
  process.exit(1);
}

await fs.access(tsxBinary).catch(() => {
  console.error('tsx is not installed. Run npm ci before executing the test suite.');
  process.exit(1);
});

console.log(`Running ${tests.length} test files in deterministic order.`);
const failures = [];

for (const testFile of tests) {
  const exitCode = await new Promise(resolve => {
    const child = spawn(tsxBinary, [testFile], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      stdio: 'inherit',
    });
    child.on('error', error => {
      console.error(`Unable to start ${testFile}:`, error);
      resolve(1);
    });
    child.on('exit', code => resolve(code ?? 1));
  });

  if (exitCode !== 0) failures.push({ testFile, exitCode });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} test file(s) failed:`);
  for (const failure of failures) {
    console.error(`- ${failure.testFile} exited with ${failure.exitCode}`);
  }
  process.exit(1);
}

console.log(`All ${tests.length} test files passed.`);
