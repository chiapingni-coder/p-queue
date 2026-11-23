// Host-side structural and rejection tests ONLY. No Docker, customer import,
// K5 recipe or K4 decision is executed by this test file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {CUSTOMER, PROBES, stable, sha256, validateSources, validateImage} from './identity.mjs';
import {readSourceObjects} from './source-reader.mjs';
import {containerArguments, validateContainer, parseObservation, collectAdmittedObservations} from './docker-controller.mjs';
import {consumeAuthenticatedExecution, PROOF_RULES} from './k5-consumption.mjs';
import {readImplementationIdentity} from './manifest.mjs';

const image = `registry.invalid/review-only@sha256:${'a'.repeat(64)}`;
test('mutable tags, shell metacharacters and missing image identities are rejected', () => {
  for (const value of [undefined, 'node:latest', 'x@sha256:abc', `${image};id`, `${image}\n`]) assert.throws(() => validateImage(value));
  assert.equal(validateImage(image), image);
});
test('sandbox command is fixed, credential-free, offline and bounded', () => {
  const args = containerArguments(image);
  for (const flag of ['--pull=never', '--network=none', '--read-only', '--user=65532:65532', '--cap-drop=ALL', '--pids-limit=64', '--memory=512m', '--cpus=1']) assert.ok(args.includes(flag));
  assert.ok(!args.some(x => /--privileged|--volume|--mount|--env-file|docker.sock/.test(x)));
});
function configuration() {
  return {Image: 'sha256:' + 'b'.repeat(64), Mounts: [],
    Config: {User: '65532:65532', Env: ['PATH=/usr/local/bin:/usr/bin', 'NODE_OPTIONS=', 'NODE_ENV=production'],
      Healthcheck: {Test: ['NONE']}, WorkingDir: '/opt/proof/executor',
      Entrypoint: ['/usr/local/bin/node'], Cmd: ['--no-warnings', '/opt/proof/executor/probe.mjs']},
    HostConfig: {NetworkMode: 'none', IpcMode: 'private', CgroupnsMode: 'private', ReadonlyRootfs: true, Privileged: false, CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'], PidsLimit: 64, Memory: 536870912, MemorySwap: 536870912,
      NanoCpus: 1000000000, Init: true, RestartPolicy: {Name: 'no'}, Tmpfs: {'/tmp': 'rw,noexec,nosuid,nodev,size=64m,mode=1777'}}};
}
const alterations = {
  'network access': c => {c.HostConfig.NetworkMode = 'bridge';},
  'host bind': c => {c.HostConfig.Binds = ['/secret:/secret'];},
  'host mount': c => {c.Mounts = [{Type: 'bind'}];},
  'privileged': c => {c.HostConfig.Privileged = true;},
  'root user': c => {c.Config.User = '0';},
  'secret environment': c => {c.Config.Env.push('GITHUB_TOKEN=fixture-never-a-token');},
  'image drift': c => {c.Image = 'other';},
  'entrypoint drift': c => {c.Config.Entrypoint = ['sh'];},
  'writable filesystem': c => {c.HostConfig.ReadonlyRootfs = false;},
  'unbounded memory': c => {c.HostConfig.Memory = 0;},
  'extra capability': c => {c.HostConfig.CapAdd = ['SYS_ADMIN'];},
  'host PID': c => {c.HostConfig.PidMode = 'host';},
  'disabled seccomp': c => {c.HostConfig.SecurityOpt.push('seccomp=unconfined');},
  'duplicate runtime environment': c => {c.Config.Env.push('NODE_OPTIONS=--import=/tmp/untrusted.mjs');},
  'image healthcheck execution': c => {c.Config.Healthcheck.Test = ['CMD', '/tmp/untrusted'];},
  'extra writable mount': c => {c.HostConfig.Tmpfs['/opt/proof'] = 'rw';},
  'working directory drift': c => {c.Config.WorkingDir = '/tmp';},
  'shared container IPC': c => {c.HostConfig.IpcMode = 'container:other';},
  'host cgroup namespace': c => {c.HostConfig.CgroupnsMode = 'host';},
};
for (const [name, mutate] of Object.entries(alterations)) test(`inspection rejects ${name}`, () => {
  const c = configuration(); const expected = c.Image; mutate(c); assert.throws(() => validateContainer(c, expected));
});
test('inspection accepts only the structurally expected configuration (not admission)', () => {
  const c = configuration(); validateContainer(c, c.Image);
});
test('workload output cannot change probe identity or append forged records', () => {
  const p = PROBES[0], challenge = 'c'.repeat(64);
  const o = {...p, source_path: CUSTOMER.path, source_blob: CUSTOMER.original_blob, challenge}; delete o.role;
  assert.equal(parseObservation(JSON.stringify(o), p, challenge).id, p.id);
  for (const forged of [{...o, revision: CUSTOMER.candidate}, {...o, source_blob: CUSTOMER.blob}, {...o, challenge: 'd'.repeat(64)}, {...o, accepted: true}]) {
    assert.throws(() => parseObservation(JSON.stringify(forged), p, challenge));
  }
  assert.throws(() => parseObservation(JSON.stringify(o) + '\n' + JSON.stringify(o), p, challenge));
});
test('missing native admission fails before any executor operation', async () => {
  await assert.rejects(collectAdmittedObservations({}), /ORIGINAL_NATIVE_EXECUTION_ADMISSION_REQUIRED/);
});
test('unsigned transcript never invokes original K5', async () => {
  await assert.rejects(consumeAuthenticatedExecution({}, null), /ORIGINAL_NATIVE_CUSTODY_CONSUMER_REQUIRED/);
});
test('reviewed Git source objects match pins without importing candidate code', () => {
  const repository = fileURLToPath(new URL('../../../../../.pqueue-257-repair/', import.meta.url));
  const result = readSourceObjects(repository);
  assert.deepEqual(result.commits, [CUSTOMER.candidate]);
  assert.equal(stable(result.binding), stable(CUSTOMER));
  const changed = structuredClone(result.sources[CUSTOMER.candidate]); changed['index.ts'] += '\n';
  assert.throws(() => validateSources(CUSTOMER.candidate, changed), /SOURCE_BLOB_CHANGED/);
  const extra = {...result.sources[CUSTOMER.base], 'unexpected.ts': ''};
  assert.throws(() => validateSources(CUSTOMER.base, extra), /SOURCE_SET_CHANGED/);
});
test('source manifest verifies the exact controller, rule and original kernel bytes', () => {
  assert.match(readImplementationIdentity().manifestDigest, /^[a-f0-9]{64}$/);
});
test('native refusal and string flags cannot claim an attempt or reach Docker', async () => {
  const repository = fileURLToPath(new URL('../../../../../.pqueue-257-repair/', import.meta.url));
  const source = readSourceObjects(repository), manifestDigest = readImplementationIdentity().manifestDigest;
  for (const denied of [null, false, true, 'APPROVED', []]) {
    let laterCalls = 0;
    const later = async () => { laterCalls++; throw Error('MUST_NOT_REACH'); };
    await assert.rejects(collectAdmittedObservations({source, manifestDigest,
      execution: {image, endpoint: 'unix:///run/user/1000/docker.sock'},
      native: {authorizeExecution: async () => denied, assertCurrent: later, claimAttempt: later, finishAttempt: later, recordFailure: later}}), /EXECUTION_NOT_ADMITTED/);
    assert.equal(laterCalls, 0);
  }
});
test('rule identities cannot be mutated through the exported object', () => {
  assert.throws(() => {PROOF_RULES.positive.adapter_version = 'forged';}, TypeError);
  assert.throws(() => {PROOF_RULES.negative_controls[0].recipe_id = 'forged';}, TypeError);
});
test('asynchronous native authentication sees an owned immutable transcript', async () => {
  const transcript = {request: {manifestDigest: readImplementationIdentity().manifestDigest, binding: {...CUSTOMER}}, artifacts: []};
  const bundle = {transcript, digest: sha256(stable(transcript))};
  let release;
  const pending = new Promise(resolve => {release = resolve;});
  let observed;
  const run = consumeAuthenticatedExecution(bundle, {
    authenticateExecution: async snapshot => {observed = snapshot; await pending; return null;},
    assertCurrent: async () => {throw Error('MUST_NOT_REACH_K5');},
  });
  // Mutation of caller-owned data while authentication is pending cannot change
  // the object checked by the native consumer. No successful grant is fabricated.
  transcript.request.binding.candidate = 'f'.repeat(40);
  assert.equal(observed.transcript.request.binding.candidate, CUSTOMER.candidate);
  assert.throws(() => {observed.transcript.request.binding.candidate = 'f'.repeat(40);}, TypeError);
  release();
  await assert.rejects(run, /NATIVE_EXECUTION_NOT_AUTHENTICATED/);
});
