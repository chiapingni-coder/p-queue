// Trusted assertions shared by the isolated workload and authored fixture tests.
// This module never imports a customer program or qualifies evidence.
import assert from 'node:assert/strict';
import process from 'node:process';
import * as events from 'node:events';
export async function runProbeCase(id, PQueue, challenge) {
  const targetMessage = 'The "eventTargets" argument must be an instance of EventEmitter or EventTarget.';
  const errors = {
    'unrelated-error': new Error('controller unrelated error'),
    'unrelated-type-error': new TypeError('controller unrelated type error'),
    'other-argument-error': Object.assign(new TypeError('The "other" argument is invalid'), {code: 'ERR_INVALID_ARG_TYPE'}),
    'target-message-without-code': new TypeError(targetMessage),
  };
  if (id === 'original-jsdom') {
    assert.throws(() => new PQueue(), e => e instanceof TypeError && e.code === 'ERR_INVALID_ARG_TYPE' && e.message.startsWith(targetMessage) && e.stack.includes('setMaxListeners'));
  } else if (id === 'original-node') {
    assert.ok(new PQueue());
  } else if (id === 'invalid-options') {
    assert.throws(() => new PQueue({concurrency: 0}), e => e instanceof TypeError && e.message === 'Expected `concurrency` to be an integer from 1 and up or `Infinity`, got `0` (number)');
  } else if (Object.hasOwn(errors, id)) {
    const builtin = process.getBuiltinModule('node:events'), prior = builtin.setMaxListeners;
    try {
      builtin.setMaxListeners = () => {throw errors[id];};
      assert.throws(() => new PQueue(), e => e === errors[id]);
    } finally {builtin.setMaxListeners = prior;}
  } else {
    assert.ok(['candidate-node', 'candidate-jsdom', 'candidate-browser', 'native-listener-limit'].includes(id), 'UNKNOWN_PROBE_CASE');
    const queue = new PQueue();
    let completed;
    queue.addEventListener('completed', e => {completed = e.detail;}, {once: true});
    if (id === 'native-listener-limit') {
      assert.equal(events.getMaxListeners(queue), Infinity);
      let finish;
      const task = queue.add(() => new Promise(resolve => {finish = resolve;}));
      const waiters = Array.from({length: 20}, () => queue.onIdle());
      finish(challenge);
      assert.equal(await task, challenge);
      await Promise.all(waiters);
    } else {
      assert.equal(await queue.add(() => challenge), challenge);
      await queue.onIdle();
    }
    assert.equal(completed, challenge);
    assert.equal(queue.size, 0);
    assert.equal(queue.pending, 0);
  }
}
