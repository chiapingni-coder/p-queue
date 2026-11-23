// Container entrypoint, NOT run by source-review validation. No customer scripts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import {stripTypeScriptTypes} from 'node:module';
import {JSDOM} from 'jsdom';
import {CUSTOMER, PROBES, NODE_VERSION, JSDOM_VERSION, validateSources} from './identity.mjs';
import {runProbeCase} from './probe-cases.mjs';

const write = process.stdout.write.bind(process.stdout);
const input = fs.readFileSync(0);
assert.ok(input.length < 1024 * 1024, 'INPUT_TOO_LARGE');
const packet = JSON.parse(input);
assert.equal(process.version, NODE_VERSION);
assert.equal(JSON.parse(fs.readFileSync('/opt/proof/executor/node_modules/jsdom/package.json')).version, JSDOM_VERSION);
const probe = PROBES.find(p => p.id === packet.probe);
assert.ok(probe, 'UNKNOWN_PROBE');
assert.match(packet.challenge, /^[a-f0-9]{64}$/);
validateSources(probe.revision, packet.files);
fs.mkdirSync('/tmp/source');
fs.writeFileSync('/tmp/source/package.json', '{"type":"module"}');
for (const [name, source] of Object.entries(packet.files)) {
  // Fixed trusted compiler API. Candidate tsconfig/package/tests are not loaded.
  fs.writeFileSync(`/tmp/source/${name.replace(/\.ts$/, '.js')}`, stripTypeScriptTypes(source, {mode: 'strip'}));
}
let dom;
if (probe.environment.startsWith('jsdom')) {
  dom = new JSDOM('<!doctype html><html></html>');
  for (const key of ['EventTarget', 'Event', 'CustomEvent', 'AbortController', 'AbortSignal']) globalThis[key] = dom.window[key];
}
if (probe.environment === 'jsdom-without-process') globalThis.process = undefined;
const {default: PQueue} = await import('/tmp/source/index.js');
await runProbeCase(probe.id, PQueue, packet.challenge);
dom?.window.close();
// This is an UNTRUSTED workload observation, never an authenticated K5 receipt.
// The host controller must retain raw bytes and obtain native custody verification.
write(JSON.stringify({id: probe.id, revision: probe.revision, environment: probe.environment,
  outcome: probe.outcome, source_path: CUSTOMER.path,
  source_blob: probe.revision === CUSTOMER.base ? CUSTOMER.original_blob : CUSTOMER.blob,
  challenge: packet.challenge}) + '\n');
