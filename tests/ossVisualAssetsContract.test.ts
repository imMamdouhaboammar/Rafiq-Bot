import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative));
const text = (relative: string) => read(relative).toString('utf8');
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const mark = text('docs/assets/brand/rafiq-mark.svg');
assert(mark.includes('<title id="rafiq-title">'), 'Rafiq mark must include an accessible title');
assert(mark.includes('<desc id="rafiq-desc">'), 'Rafiq mark must include an accessible description');
assert(mark.includes('viewBox="0 0 64 64"'), 'Rafiq mark must keep the canonical 64x64 viewBox');
assert(!mark.includes('<text'), 'Rafiq mark must not depend on embedded text or fonts');

const pngSize = (relative: string): [number, number] => {
  const buffer = read(relative);
  assert(buffer.subarray(1, 4).toString('ascii') === 'PNG', `${relative} must be a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

const expected: Record<string, [number, number]> = {
  'docs/assets/screenshots/desktop-conversation.png': [1440, 900],
  'docs/assets/screenshots/desktop-persona-evolution.png': [1440, 900],
  'docs/assets/screenshots/mobile-conversation.png': [390, 844],
  'docs/assets/brand/rafiq-social-preview.png': [1280, 640],
};

for (const [relative, size] of Object.entries(expected)) {
  const actual = pngSize(relative);
  assert(actual[0] === size[0] && actual[1] === size[1], `${relative} must be ${size[0]}x${size[1]}, got ${actual[0]}x${actual[1]}`);
}

const readme = text('README.md');
for (const relative of Object.keys(expected).filter(file => file.includes('/screenshots/'))) {
  assert(readme.includes(relative), `README must reference ${relative}`);
}
assert(readme.includes('docs/assets/brand/rafiq-mark.svg'), 'README must reference the Rafiq mark');

console.log('OSS visual asset contract passed.');
