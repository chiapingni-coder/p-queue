// Fixtures only. Never invokes Docker, imports customer code, or creates K5/K4
// evidence. Successful simulations below prove control flow, not native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {boundedCommand} from './process.mjs';
import {executeProbeSequence} from './sequence.mjs';
import {containerArguments, validateContainer, parseObservation} from './docker-controller.mjs';
import {CUSTOMER, PROBES} from './identity.mjs';
import {validateDependencies} from './dependencies.mjs';

function transport() {
  const child = new EventEmitter(); let fire, killed = 0, options, argv;
  for (const name of ['stdin', 'stdout', 'stderr']) {child[name] = new EventEmitter(); child[name].destroy = () => {};}
  child.stdin.end = () => {}; child.kill = () => {killed++;};
  const deps = {spawnProcess: (_exe, args, settings) => {argv = args; options = settings; return child;},
    schedule: callback => {fire = callback; return 1;}, cancel: () => {}};
  return {child, deps, timeout: () => fire(), get killed() {return killed;}, get options() {return options;}, get argv() {return argv;}};
}
test('timeout settles without waiting for a close event and kills once', async () => {
  const f = transport(), promise = boundedCommand('fixture', ['info'], '', 1, f.deps);
  f.timeout(); await assert.rejects(promise, /DOCKER_COMMAND_TIMEOUT/); assert.equal(f.killed, 1);
});
test('output limit rejects before retaining an oversized chunk', async () => {
  const f = transport(), promise = boundedCommand('fixture', ['info'], '', 1, f.deps);
  f.child.stdout.emit('data', Buffer.alloc(65537)); await assert.rejects(promise, /DOCKER_OUTPUT_LIMIT/);
  f.child.stdout.emit('data', Buffer.alloc(65537)); assert.equal(f.killed, 1);
});
test('split UTF-8 output remains intact and transport does not inherit secrets', async () => {
  const f = transport(), promise = boundedCommand('fixture', ['info'], '', 1, f.deps);
  const bytes = Buffer.from('✓'); f.child.stdout.emit('data', bytes.subarray(0, 1)); f.child.stdout.emit('data', bytes.subarray(1));
  f.child.emit('close', 0, null); assert.equal((await promise).stdout, '✓');
  assert.deepEqual(Object.keys(f.options.env), ['PATH']); assert.equal(f.options.shell, false);
  assert.deepEqual(f.argv, ['--host', 'fixture', 'info']);
});
test('spawn errors retain the original error object', async () => {
  const f = transport(), failure = Error('fixture launch failure'), promise = boundedCommand('fixture', [], '', 1, f.deps);
  f.child.emit('error', failure); await assert.rejects(promise, e => e === failure);
});
test('interrupted and incomplete input cannot produce successful transport', async () => {
  for (const event of ['signal', 'input']) {
    const f = transport(), promise = boundedCommand('fixture', [], '', 1, f.deps);
    if (event === 'signal') f.child.emit('close', null, 'SIGTERM'); else f.child.stdin.emit('error', Error('EPIPE'));
    await assert.rejects(promise, /DOCKER_COMMAND_INTERRUPTED|DOCKER_INPUT_INCOMPLETE/);
  }
});
test('invalid transport limits fail without spawning', () => {
  for (const timeout of [0, -1, 30001, Infinity]) assert.throws(() => boundedCommand('fixture', [], '', timeout), /PROCESS_LIMIT_INVALID/);
  assert.throws(() => boundedCommand('fixture', [], 'x'.repeat(1024 * 1024 + 1)), /PROCESS_LIMIT_INVALID/);
});

const image = 'registry.invalid/fixture@sha256:' + 'a'.repeat(64), imageId = 'sha256:' + 'b'.repeat(64);
function fixture({failStart = false, failCleanup = false, failCreate = false, revoke = 0, oom = false, drift = false} = {}) {
  const calls = [], source = {sources: {[CUSTOMER.base]: {}, [CUSTOMER.candidate]: {}}};
  let started = false, count = 0, checks = 0;
  const config = () => ({Image: imageId, Mounts: [],
    Config: {User: '65532:65532', WorkingDir: '/opt/proof/executor', Healthcheck: {Test: ['NONE']},
      Env: ['NODE_OPTIONS=', 'NODE_ENV=production'], Entrypoint: ['/usr/local/bin/node'], Cmd: ['--no-warnings', '/opt/proof/executor/probe.mjs']},
    HostConfig: {NetworkMode: drift ? 'host' : 'none', IpcMode: 'private', CgroupnsMode: 'private', ReadonlyRootfs: true, Privileged: false, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
      PidsLimit: 64, Memory: 536870912, MemorySwap: 536870912, NanoCpus: 1000000000, Init: true, RestartPolicy: {Name: 'no'}, Tmpfs: {'/tmp': 'rw,noexec,nosuid,nodev,size=64m,mode=1777'}},
    State: {Status: started ? 'exited' : 'created', ExitCode: 0, OOMKilled: oom, Error: ''}});
  const invoke = async (args, input) => {
    calls.push(args);
    const ok = value => ({code: 0, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: ''});
    switch (args[0]) {
      case 'info': return ok(['name=rootless', 'name=seccomp,profile=builtin']);
      case 'image': return ok([{Id: imageId, RepoDigests: [image]}]);
      case 'create': if (failCreate) throw Error('FIXTURE_CREATE_TIMEOUT'); started = false; count++; return ok(count.toString(16).padStart(64, '0'));
      case 'inspect': return ok([config()]);
      case 'start': {
        if (failStart) throw Error('FIXTURE_START_FAILURE'); started = true;
        const packet = JSON.parse(input), probe = PROBES.find(p => p.id === packet.probe);
        const observation = {...probe, source_path: CUSTOMER.path, source_blob: probe.revision === CUSTOMER.base ? CUSTOMER.original_blob : CUSTOMER.blob, challenge: packet.challenge};
        delete observation.role; return ok(observation);
      }
      case 'rm': return {code: failCleanup ? 1 : 0, stdout: '', stderr: ''};
      default: throw Error('UNEXPECTED_FIXTURE_COMMAND');
    }
  };
  return {calls, source, image, invoke, containerArguments, validateContainer, parseObservation,
    assertCurrent: async () => {checks++; if (revoke === checks) throw Error('FIXTURE_AUTHORITY_REVOKED');}};
}
test('all 11 probes use fresh containers and produce only unqualified transport artifacts', async () => {
  const f = fixture(), result = await executeProbeSequence(f);
  assert.equal(result.artifacts.length, 11); assert.equal(new Set(result.artifacts.map(x => x.container)).size, 11);
  assert.equal(f.calls.filter(x => x[0] === 'start').length, 11);
  assert.equal(f.calls.filter(x => x[0] === 'rm').length, 11);
  assert.equal(result.evidence, undefined); assert.equal(result.authority, undefined);
});
test('revocation after inspection stops before workload start and cleans the created container', async () => {
  const f = fixture({revoke: 2}); await assert.rejects(executeProbeSequence(f), /FIXTURE_AUTHORITY_REVOKED/);
  assert.equal(f.calls.filter(x => x[0] === 'start').length, 0);
  assert.equal(f.calls.filter(x => x[0] === 'rm').length, 1);
});
test('failed start is not retried and preserves the original failure', async () => {
  const f = fixture({failStart: true}); await assert.rejects(executeProbeSequence(f), /FIXTURE_START_FAILURE/);
  assert.equal(f.calls.filter(x => x[0] === 'start').length, 1);
  assert.equal(f.calls.filter(x => x[0] === 'rm').length, 1);
});
test('cleanup failure retains both original and cleanup errors', async () => {
  const f = fixture({failStart: true, failCleanup: true});
  await assert.rejects(executeProbeSequence(f), e => e instanceof AggregateError && e.errors[0].message === 'FIXTURE_START_FAILURE' && e.errors[1].message === 'FAILED_RUN_CLEANUP_REQUIRES_OPERATOR');
});
test('unknown create outcome neither retries nor starts or removes an unidentified container', async () => {
  const f = fixture({failCreate: true}); await assert.rejects(executeProbeSequence(f), /FIXTURE_CREATE_TIMEOUT/);
  assert.equal(f.calls.filter(x => x[0] === 'create').length, 1);
  assert.equal(f.calls.filter(x => ['start', 'rm'].includes(x[0])).length, 0);
});
test('OOM and unsafe inspected configuration cannot reach a completed artifact set', async () => {
  for (const options of [{oom: true}, {drift: true}]) {
    const f = fixture(options); await assert.rejects(executeProbeSequence(f), /PROBE_FAILED|CONTAINER_ISOLATION_MISMATCH/);
    assert.equal(f.calls.filter(x => x[0] === 'rm').length, 1);
  }
});
const pkg = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url)));
const lock = JSON.parse(fs.readFileSync(new URL('package-lock.json', import.meta.url)));
test('actual reviewed lock is a complete 45-package SRI-pinned closure', () => {
  assert.equal(validateDependencies(pkg, lock).packages, 45);
});
const mutations = {
  'missing integrity': x => {delete x.packages['node_modules/jsdom'].integrity;},
  'install script': x => {x.packages['node_modules/jsdom'].hasInstallScript = true;},
  'foreign registry': x => {x.packages['node_modules/jsdom'].resolved = 'https://untrusted.invalid/jsdom.tgz';},
  'missing dependency': x => {delete x.packages['node_modules/ws'];},
  'extra package': x => {x.packages['node_modules/extra'] = {...x.packages['node_modules/jsdom']};},
  'symlink dependency': x => {x.packages['node_modules/jsdom'].link = true;},
  'root mismatch': x => {x.packages[''].dependencies.jsdom = '*';},
};
for (const [name, mutate] of Object.entries(mutations)) test(`dependency check rejects ${name}`, () => {
  const value = structuredClone(lock); mutate(value); assert.throws(() => validateDependencies(pkg, value));
});
