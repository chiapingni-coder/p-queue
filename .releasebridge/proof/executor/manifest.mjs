import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sha256, requireCondition} from './identity.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
export function readImplementationIdentity() {
  const bytes = fs.readFileSync(path.join(root, 'source-manifest.json'));
  const m = JSON.parse(bytes);
  requireCondition(m.status === 'SOURCE_REVIEW_ONLY' && m.files && Object.keys(m.files).length >= 10, 'SOURCE_MANIFEST_INVALID');
  for (const required of ['identity.mjs', 'source-reader.mjs', 'probe.mjs', 'probe-cases.mjs', 'docker-controller.mjs', 'process.mjs', 'sequence.mjs', 'dependencies.mjs', 'k5-consumption.mjs', 'manifest.mjs', 'Dockerfile', 'Dockerfile.dockerignore', 'package.json', 'package-lock.json']) {
    requireCondition(/^[a-f0-9]{64}$/.test(m.files[required]), 'IMPLEMENTATION_FILE_NOT_PINNED');
  }
  for (const [relative, expected] of Object.entries(m.files)) {
    requireCondition(/^[\w./-]+$/.test(relative) && !relative.startsWith('/') && !relative.includes('../..'), 'MANIFEST_PATH_INVALID');
    const target = path.resolve(root, relative);
    requireCondition(target.startsWith(path.resolve(root, '..') + path.sep), 'MANIFEST_PATH_ESCAPE');
    requireCondition(fs.lstatSync(target).isFile() && !fs.lstatSync(target).isSymbolicLink(), 'MANIFEST_FILE_TYPE');
    requireCondition(sha256(fs.readFileSync(target)) === expected, `IMPLEMENTATION_BYTES_CHANGED:${relative}`);
  }
  requireCondition(m.files['../pqueue257-source-contract.mjs'] === '7be3bb2070e01fea871cc4c81f343b8bf2af1c45f096b52829b4db74a1813f10' &&
    m.files['../pqueue257-adapter.mjs'] === '8ac7219680233b5a26bf11d29fb9e41c073e6d44245bb73ba9365e1f17c3e36a' &&
    m.files['../kernel/proof/proof-runtime-v0.1.mjs'] === 'b194e52cf706529eb4d5b2ea9be59febf183eda69f28dd739c7b1b318241a16f', 'ORIGINAL_RULES_OR_KERNEL_CHANGED');
  return {manifestDigest: sha256(bytes), files: m.files};
}
