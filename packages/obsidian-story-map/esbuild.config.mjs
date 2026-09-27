import esbuild from 'esbuild';
import { appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { assertNoScriptCreation, reactScriptPolicy } from './build/react-script-policy.mjs';

const production = process.argv[2] === 'production';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const common = {
  bundle: true,
  sourcemap: production ? false : 'inline',
  minify: production,
  logLevel: 'info',
};

const scriptBuild = await esbuild.build({
  ...common,
  entryPoints: ['src/main.tsx'],
  outfile: 'dist/main.js',
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
  metafile: true,
  legalComments: 'eof',
  plugins: [reactScriptPolicy()],
});

await esbuild.build({
  ...common,
  entryPoints: ['src/obsidian.css'],
  outfile: 'dist/styles.css',
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
});

await cp('../../manifest.json', 'dist/manifest.json');
await cp('../../versions.json', 'dist/versions.json');

// Include full dependency license notices with the distributed bundle.
const bundledPackages = new Map();
for (const input of Object.keys(scriptBuild.metafile.inputs)) {
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory)) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      directory = dirname(directory);
      continue;
    }
    if (!manifest.name) {
      directory = dirname(directory);
      continue;
    }
    if (!manifest.name.startsWith('@story-map/')) bundledPackages.set(manifest.name, { manifest, directory });
    break;
  }
}
const notices = ['StoryMap bundled dependency notices', await readFile('../../LICENSE', 'utf8')];
notices.push('Host-local React DOM modification: script-element creation and rendering are disabled by the Geo Story Map build policy. Upstream license notices are retained below.');
for (const [name, { manifest, directory }] of [...bundledPackages].sort(([a], [b]) => a.localeCompare(b))) {
  const files = (await readdir(directory)).filter(file => /^(licen[cs]e|copying)(\..*)?$/i.test(file));
  if (files.length === 0) throw new Error(`Missing bundled license notice for ${name}`);
  notices.push(`\n--- ${name}@${manifest.version} (${manifest.license ?? 'see notice'}) ---\n`);
  for (const file of files.sort()) notices.push(await readFile(join(directory, file), 'utf8'));
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n'));
await appendFile('dist/main.js', '\n' + notices.join('\n').split('\n').map(line => '// ' + line).join('\n') + '\n');
assertNoScriptCreation(await readFile('dist/main.js', 'utf8'));
