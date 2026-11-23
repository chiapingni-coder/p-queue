// Authored queue double only. NEVER imports original/repaired p-queue code.
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import {runProbeCase} from './probe-cases.mjs';
const builtin = process.getBuiltinModule('node:events');
class QueueDouble extends EventTarget {
  pending = 0; size = 0; waiting = [];
  constructor(options) {
    super(); builtin.setMaxListeners(Infinity, this);
    if (options?.concurrency === 0) throw new TypeError('Expected `concurrency` to be an integer from 1 and up or `Infinity`, got `0` (number)');
  }
  async add(fn) {
    this.pending++;
    const result = await fn();
    this.dispatchEvent(new CustomEvent('completed', {detail: result}));
    this.pending--; for (const finish of this.waiting.splice(0)) finish();
    return result;
  }
  onIdle() {return this.pending ? new Promise(resolve => this.waiting.push(resolve)) : Promise.resolve();}
}
for (const id of ['original-node', 'candidate-node', 'candidate-jsdom', 'candidate-browser', 'native-listener-limit', 'invalid-options', 'unrelated-error', 'unrelated-type-error', 'other-argument-error', 'target-message-without-code']) {
  test(`assertion case ${id} handles the authored queue double`, async () => {
    const original = builtin.setMaxListeners;
    await runProbeCase(id, QueueDouble, 'fixture-controller-value');
    assert.equal(builtin.setMaxListeners, original);
  });
}
test('original-failure assertion requires the Node target rejection, not any TypeError', async () => {
  class RejectedTarget {constructor() {builtin.setMaxListeners(Infinity, {});}}
  await runProbeCase('original-jsdom', RejectedTarget, 'fixture');
  class WrongFailure {constructor() {throw new TypeError('unrelated');}}
  await assert.rejects(runProbeCase('original-jsdom', WrongFailure, 'fixture'));
});
test('assertions reject a changed task result and a missing completed event', async () => {
  class WrongResult extends QueueDouble {async add(fn) {await super.add(fn); return 'wrong';}}
  class MissingEvent extends QueueDouble {async add(fn) {return fn();}}
  for (const Double of [WrongResult, MissingEvent]) await assert.rejects(runProbeCase('candidate-node', Double, 'expected'));
});
test('assertions reject swallowed setup errors and restore the shared builtin', async () => {
  class Swallowed extends EventTarget {constructor() {super(); try {builtin.setMaxListeners(Infinity, this);} catch {}}}
  const original = builtin.setMaxListeners;
  await assert.rejects(runProbeCase('unrelated-error', Swallowed, 'fixture'));
  assert.equal(builtin.setMaxListeners, original);
});
test('assertions reject finite native listener limits and invalid probe IDs', async () => {
  class Finite extends QueueDouble {constructor() {super(); builtin.setMaxListeners(10, this);}}
  await assert.rejects(runProbeCase('native-listener-limit', Finite, 'fixture'));
  await assert.rejects(runProbeCase('not-a-rule', QueueDouble, 'fixture'), /UNKNOWN_PROBE_CASE/);
});
