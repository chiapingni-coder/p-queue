// Pure lock validation; CLI mode reads JSON only, before an authorized image
// build's npm ci. No packages or lifecycle scripts are imported or executed.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function validateDependencies(pkg, lock) {
  const deny = reason => {throw Error(reason);};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (pkg?.dependencies?.jsdom !== '27.4.0' || Object.keys(pkg.dependencies).length !== 1 || pkg.engines?.node !== '24.14.0' || pkg.scripts || pkg.devDependencies) deny('DEPENDENCY_ROOT_CHANGED');
  if (lock?.lockfileVersion !== 3 || lock.name !== pkg.name || lock.version !== pkg.version || !same(lock.packages?.['']?.dependencies, pkg.dependencies) || !same(lock.packages[''].engines, pkg.engines)) deny('LOCK_ROOT_MISMATCH');
  const packages = lock.packages, seen = new Set();
  function resolve(from, name) {
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)) deny('DEPENDENCY_NAME_INVALID');
    let p = from;
    while (true) {
      const key = p ? `${p}/node_modules/${name}` : `node_modules/${name}`;
      if (Object.hasOwn(packages, key)) return key;
      if (!p) deny(`DEPENDENCY_CLOSURE_MISSING:${name}`);
      const at = p.lastIndexOf('/node_modules/'); p = at < 0 ? '' : p.slice(0, at);
    }
  }
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const p = packages[key];
    if (!p || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(p.version || '') || p.link || p.hasInstallScript || p.dev || p.optionalDependencies) deny(`DEPENDENCY_METADATA_NOT_ADMITTED:${key}`);
    const url = new URL(p.resolved);
    if (url.protocol !== 'https:' || url.host !== 'registry.npmjs.org' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('.tgz')) deny('DEPENDENCY_ORIGIN_NOT_ADMITTED');
    if (!/^sha512-[a-zA-Z0-9+/]{86}==$/.test(p.integrity || '') || Buffer.from(p.integrity.slice(7), 'base64').length !== 64) deny('DEPENDENCY_INTEGRITY_INVALID');
    for (const name of Object.keys(p.dependencies || {})) visit(resolve(key, name));
    for (const name of Object.keys(p.peerDependencies || {})) if (!p.peerDependenciesMeta?.[name]?.optional) visit(resolve(key, name));
  }
  visit('node_modules/jsdom');
  if (packages['node_modules/jsdom'].version !== '27.4.0') deny('JSDOM_LOCK_MISMATCH');
  if (seen.size !== Object.keys(packages).length - 1) deny('UNREACHABLE_LOCK_ENTRY');
  return {packages: seen.size, registry: 'https://registry.npmjs.org', lifecycle_scripts: false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.version !== 'v24.14.0') throw Error('BUILD_NODE_VERSION_MISMATCH');
  const result = validateDependencies(JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url))), JSON.parse(fs.readFileSync(new URL('package-lock.json', import.meta.url))));
  console.log(JSON.stringify(result));
}
