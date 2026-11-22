import process from 'node:process';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as events from 'node:events';
import PQueue from '../source/index.js';

test('constructor accepts a non-Node EventTarget', () => {
	// Isolate the global replacement and the module's superclass from other tests.
	// Like jsdom, this EventTarget does not carry Node's internal EventTarget brand.
	const code = `
		import assert from 'node:assert/strict';
		globalThis.EventTarget = class EventTarget {};
		const {default: PQueue} = await import(${JSON.stringify(new URL('../source/index.ts', import.meta.url).href)});
		assert.doesNotThrow(() => new PQueue());
		assert.throws(() => new PQueue({concurrency: 0}), TypeError);

		// The browser constructor path still works without a process global.
		const nodeProcess = globalThis.process;
		globalThis.process = undefined;
		assert.doesNotThrow(() => new PQueue());
		globalThis.process = nodeProcess;
	`;
	const {status, stderr} = spawnSync(process.execPath, ['--import=tsx/esm', '--input-type=module', '--eval', code], {encoding: 'utf8'});
	assert.equal(status, 0, stderr);
});

test('constructor retains unlimited listeners on a native Node EventTarget', async () => {
	const queue = new PQueue();
	assert.equal(events.getMaxListeners(queue), Infinity);
	assert.equal(await queue.add(() => 'completed'), 'completed');
});

for (const error of [
	new Error('Unexpected listener setup failure'),
	new TypeError('Unexpected listener setup type error'),
	Object.assign(new TypeError('The "other" argument is invalid'), {code: 'ERR_INVALID_ARG_TYPE'}),
	new TypeError('The "eventTargets" argument must be an instance of EventEmitter or EventTarget.'),
]) {
	test(`constructor rethrows: ${error.message}`, t => {
		t.mock.method(process.getBuiltinModule('node:events'), 'setMaxListeners', () => {
			throw error;
		});
		t.assert.throws(() => new PQueue(), actual => actual === error);
	});
}
