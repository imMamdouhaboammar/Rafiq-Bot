import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const requiredFiles = [
  'README.md', 'PRODUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'ROADMAP.md', 'CODE_OF_CONDUCT.md',
  'docs/README.md', 'docs/providers/README.md', 'docs/providers/adding-a-provider.md',
  'docs/localization/README.md', 'docs/deployment/deployment.md',
  '.github/ISSUE_TEMPLATE/bug.yml', '.github/ISSUE_TEMPLATE/feature.yml',
  '.github/ISSUE_TEMPLATE/config.yml', '.github/pull_request_template.md',
];
for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), `Missing public OSS file: ${file}`);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
for (const match of readme.matchAll(/(?:npm|bun) run ([\w:-]+)/g)) {
  assert.ok(packageJson.scripts?.[match[1]], `README references missing package script: ${match[1]}`);
}
for (const [file, text] of [['README.md', readme], ['CONTRIBUTING.md', fs.readFileSync('CONTRIBUTING.md', 'utf8')], ['SECURITY.md', fs.readFileSync('SECURITY.md', 'utf8')]] as const) {
  assert.doesNotMatch(text, /\b\d+[- ](?:file|test)[ -]suite\b|\b\d+ test files?\b/i, `${file} must not hardcode drifting test counts`);
  assert.doesNotMatch(text, /<your-|your\.email|replace this|use this section to tell|TBD|COMING SOON/i, `${file} contains placeholder copy`);
}
assert.doesNotMatch(readme, /production-grade/i, 'README must not claim production grade without a release certification');

const trackedMarkdown = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).filter(f => !f.startsWith('docs/plans/') && fs.existsSync(f));
for (const file of trackedMarkdown) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:)/i.test(raw)) continue;
    const target = decodeURIComponent(raw.split('#')[0].split('?')[0]);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    assert.ok(fs.existsSync(resolved), `Broken relative link in ${file}: ${raw}`);
  }
}

const providerDocs = fs.existsSync('docs/providers/README.md') ? fs.readFileSync('docs/providers/README.md', 'utf8') : '';
for (const runtimePath of ['services/googleClient.server.ts', 'services/agentRouter.server.ts', 'services/koboldInferenceProvider.ts']) {
  assert.match(providerDocs, new RegExp(runtimePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Provider docs must map claims to ${runtimePath}`);
}
assert.doesNotMatch(providerDocs, /direct (?:OpenAI|Anthropic|OpenRouter|xAI) (?:OAuth|integration).*supported/i, 'Provider docs must not invent direct provider integrations');

console.log(`OSS documentation contract passed across ${trackedMarkdown.length} tracked Markdown files.`);
