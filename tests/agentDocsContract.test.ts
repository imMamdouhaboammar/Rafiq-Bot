import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['AGENTS.md', 'CLAUDE.md'];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /\/Users\//, `${file} must not contain a personal macOS path`);
  assert.doesNotMatch(text, /~\/\.agent-kernel\/source/, `${file} must not expose the global Agent Kernel source path`);
  assert.doesNotMatch(text, /Next\.js\s*\+\s*Supabase|Supabase projects/i, `${file} must not carry unrelated project policy`);
  assert.doesNotMatch(text, /Egyptian Arabic dialect for casual conversations/i, `${file} must not encode a maintainer's personal response preference`);
}
assert.match(fs.readFileSync('CLAUDE.md', 'utf8'), /AGENTS\.md/, 'CLAUDE.md must point to the canonical AGENTS.md contract');

const kernelProject = fs.readFileSync('.agent-kernel/project.toml', 'utf8');
assert.match(kernelProject, /expected_git_remote = "github\.com\/imMamdouhaboammar\/Rafiq-Bot"/, 'Agent Kernel project identity must target the public OSS repository');
assert.doesNotMatch(kernelProject, /\/Users\//, 'Agent Kernel project metadata must not contain a personal path');
assert.doesNotMatch(kernelProject, /\.agent-kernel\/vault|password\s*=|token\s*=/i, 'Agent Kernel project metadata must not contain vault paths or credential values');
console.log('Agent documentation contract passed.');
