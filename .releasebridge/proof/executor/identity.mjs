// Review source only. These identities do not grant execution authority.
import {createHash} from 'node:crypto';
import {CUSTOMER, PROBES} from '../pqueue257-source-contract.mjs';
export {CUSTOMER, PROBES};
export const VERSION = 'pqueue257-executor/1';
export const NODE_VERSION = 'v24.14.0';
export const JSDOM_VERSION = '27.4.0';
export const SOURCE_BLOBS = Object.freeze({
  'index.ts': CUSTOMER.original_blob,
  'lower-bound.ts': '5f0c927f88685a665d1acc1106f991827683f654',
  'options.ts': '80ae86b43146ba022df9e6ca0956326a63fb69b2',
  'priority-queue.ts': 'c0c864209e2506dff67e1864f771ec6dc0d11e00',
  'queue.ts': 'b1c256aec307673d3ec7c59a795c84002259e8e6',
});
export const TEST_BLOB = 'cc8119dc27acee4d3bab66c76ef641769c041f05';
export const stable = x => Array.isArray(x) ? `[${x.map(stable).join(',')}]` : x && typeof x === 'object' ? `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}` : JSON.stringify(x);
export const sha256 = x => createHash('sha256').update(x).digest('hex');
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function requireCondition(value, reason) { if (!value) throw Error(reason); }
export function validateSources(revision, files) {
  requireCondition([CUSTOMER.base, CUSTOMER.candidate].includes(revision), 'REVISION_NOT_ADMITTED');
  requireCondition(files && stable(Object.keys(files).sort()) === stable(Object.keys(SOURCE_BLOBS).sort()), 'SOURCE_SET_CHANGED');
  for (const [name, original] of Object.entries(SOURCE_BLOBS)) {
    requireCondition(typeof files[name] === 'string' && files[name].length < 150000, 'SOURCE_SIZE_OR_TYPE');
    const expected = name === 'index.ts' && revision === CUSTOMER.candidate ? CUSTOMER.blob : original;
    requireCondition(gitBlob(Buffer.from(files[name], 'utf8')) === expected, `SOURCE_BLOB_CHANGED:${name}`);
  }
}
export function validateImage(image) {
  requireCondition(typeof image === 'string' && /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(image), 'IMMUTABLE_IMAGE_REQUIRED');
  return image;
}
