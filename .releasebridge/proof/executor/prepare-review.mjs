// DATA-ONLY maintenance utility: no candidate imports, package installation,
// Docker, K5 recipe execution or native service access. Explicitly run for review.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './identity.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[2] === 'lock') {
  const source = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const selected = new Map();
  function resolve(from, name) {
    let p = from;
    while (true) {
      const key = p ? `${p}/node_modules/${name}` : `node_modules/${name}`;
      if (source.packages[key]) return key;
      if (!p) throw Error(`DEPENDENCY_NOT_LOCKED:${from}:${name}`);
      const at = p.lastIndexOf('/node_modules/'); p = at < 0 ? '' : p.slice(0, at);
    }
  }
  function visit(key) {
    if (selected.has(key)) return;
    const value = structuredClone(source.packages[key]);
    if (!/^https:\/\/registry\.npmjs\.org\//.test(value.resolved) || !/^sha512-/.test(value.integrity) || value.link) throw Error(`UNPINNED_DEPENDENCY:${key}`);
    delete value.dev; delete value.devOptional;
    selected.set(key, value);
    for (const name of Object.keys(value.dependencies || {})) visit(resolve(key, name));
    for (const name of Object.keys(value.peerDependencies || {})) if (!value.peerDependenciesMeta?.[name]?.optional) visit(resolve(key, name));
    if (Object.keys(value.optionalDependencies || {}).length) throw Error(`OPTIONAL_DEPENDENCY_REVIEW_REQUIRED:${key}`);
  }
  visit('node_modules/jsdom');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  if (selected.get('node_modules/jsdom').version !== pkg.dependencies.jsdom) throw Error('JSDOM_LOCK_MISMATCH');
  const lock = {name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true,
    packages: {'': {name: pkg.name, version: pkg.version, dependencies: pkg.dependencies, engines: pkg.engines}, ...Object.fromEntries([...selected].sort(([a], [b]) => a.localeCompare(b)))}};
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  console.log(`LOCKED_PACKAGES=${selected.size}; NO_INSTALLATION`);
} else if (process.argv[2] === 'manifest') {
  const names = fs.readdirSync(root).filter(n => fs.statSync(path.join(root, n)).isFile() && !['source-manifest.json', 'VALIDATION.json'].includes(n));
  names.push('../pqueue257-source-contract.mjs', '../pqueue257-adapter.mjs', '../kernel/proof/proof-runtime-v0.1.mjs');
  const manifest = {version: 'pqueue257-executor/1', status: 'SOURCE_REVIEW_ONLY', admission: null,
    image_digest: null, native_run: null, files: Object.fromEntries(names.sort().map(n => [n, sha256(fs.readFileSync(path.join(root, n)))]))};
  fs.writeFileSync(path.join(root, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`MANIFEST_SHA256=${sha256(JSON.stringify(manifest, null, 2) + '\n')}`);
} else throw Error('USE_LOCK_OR_MANIFEST');
