// Only called by separately admitted native composition. No command-line launcher.
import {boundedCommand} from './process.mjs';
import {executeProbeSequence} from './sequence.mjs';
import {readImplementationIdentity} from './manifest.mjs';
import {CUSTOMER, PROBES, stable, sha256, deepFreeze, validateSources, validateImage, requireCondition} from './identity.mjs';

export function containerArguments(image) {
  validateImage(image);
  return ['create', '--interactive', '--pull=never', '--network=none', '--ipc=private', '--cgroupns=private', '--read-only',
    '--user=65532:65532', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
    '--pids-limit=64', '--memory=512m', '--memory-swap=512m', '--cpus=1',
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777', '--init', '--restart=no', '--no-healthcheck',
    '--env=NODE_OPTIONS=', '--env=NODE_ENV=production', '--workdir=/opt/proof/executor',
    '--entrypoint=/usr/local/bin/node', image, '--no-warnings', '/opt/proof/executor/probe.mjs'];
}
export function validateContainer(c, imageId) {
  const h = c.HostConfig, e = c.Config;
  requireCondition(c.Image === imageId && e.User === '65532:65532' && h.NetworkMode === 'none' &&
    h.ReadonlyRootfs === true && h.Privileged === false && !h.Binds?.length && !c.Mounts?.some(m => m.Type !== 'tmpfs') &&
    !h.Devices?.length && !h.DeviceRequests?.length && !h.CapAdd?.length && stable(h.CapDrop) === stable(['ALL']) &&
    h.SecurityOpt?.length === 1 && ['no-new-privileges:true', 'no-new-privileges'].includes(h.SecurityOpt[0]) &&
    h.PidsLimit === 64 && h.Memory === 536870912 && h.MemorySwap === 536870912 && h.NanoCpus === 1000000000 &&
    h.Init === true && h.RestartPolicy?.Name === 'no' && !h.PidMode && !h.UsernsMode && !h.UtsMode && h.IpcMode === 'private' && h.CgroupnsMode === 'private' &&
    stable(e.Healthcheck?.Test) === stable(['NONE']) && e.WorkingDir === '/opt/proof/executor' &&
    Object.keys(h.Tmpfs || {}).length === 1 &&
    h.Tmpfs?.['/tmp'] === 'rw,noexec,nosuid,nodev,size=64m,mode=1777' &&
    stable(e.Entrypoint) === stable(['/usr/local/bin/node']) &&
    stable(e.Cmd) === stable(['--no-warnings', '/opt/proof/executor/probe.mjs']), 'CONTAINER_ISOLATION_MISMATCH');
  const env = e.Env || [], names = env.map(s => s.split('=', 1)[0]);
  requireCondition(env.every(s => /^(PATH|NODE_VERSION|YARN_VERSION|NODE_ENV|NODE_OPTIONS)=/.test(s)) &&
    new Set(names).size === names.length && env.includes('NODE_OPTIONS=') && env.includes('NODE_ENV=production'), 'CONTAINER_ENVIRONMENT_NOT_ADMITTED');
}
export function parseObservation(bytes, probe, challenge) {
  requireCondition(typeof bytes === 'string' && bytes.length < 16384, 'OBSERVATION_SIZE');
  const o = JSON.parse(bytes);
  const expected = {...probe}; delete expected.role;
  Object.assign(expected, {source_path: CUSTOMER.path,
    source_blob: probe.revision === CUSTOMER.base ? CUSTOMER.original_blob : CUSTOMER.blob, challenge});
  requireCondition(stable(o) === stable(expected), 'OBSERVATION_MISMATCH');
  return o;
}

// native is the EXISTING authenticated service boundary supplied by trusted-base
// composition, never a request JSON object/module path. Missing native admission
// fails before Docker is contacted. Native implementations are NOT supplied here.
export async function collectAdmittedObservations({source, manifestDigest, execution, native}) {
  for (const method of ['authorizeExecution', 'assertCurrent', 'claimAttempt', 'finishAttempt', 'recordFailure']) {
    requireCondition(typeof native?.[method] === 'function', 'ORIGINAL_NATIVE_EXECUTION_ADMISSION_REQUIRED');
  }
  source = structuredClone(source); execution = structuredClone(execution);
  requireCondition(/^[a-f0-9]{64}$/.test(manifestDigest), 'SOURCE_MANIFEST_REQUIRED');
  requireCondition(readImplementationIdentity().manifestDigest === manifestDigest, 'IMPLEMENTATION_MANIFEST_MISMATCH');
  requireCondition(stable(source.binding) === stable(CUSTOMER), 'CUSTOMER_BINDING_MISMATCH');
  for (const revision of [CUSTOMER.base, CUSTOMER.candidate]) validateSources(revision, source.sources[revision]);
  validateImage(execution.image);
  requireCondition(/^unix:\/\/\/run\/user\/[1-9][0-9]*\/docker\.sock$/.test(execution.endpoint), 'DEDICATED_ROOTLESS_EXECUTOR_REQUIRED');
  const request = deepFreeze({binding: {...CUSTOMER}, manifestDigest, execution: {...execution}});
  // The native consumer authenticates Owner, source adoption, image build custody,
  // limits, expiry, revocation, live repository/installation and exact PR currentness.
  const admission = await native.authorizeExecution(request);
  requireCondition(admission != null && typeof admission === 'object' && !Array.isArray(admission), 'EXECUTION_NOT_ADMITTED');
  await native.assertCurrent(admission, request);
  const run = await native.claimAttempt(admission, request); // durable one-use claim before effects
  requireCondition(run && typeof run.id === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(run.id), 'DURABLE_ATTEMPT_REQUIRED');
  const invoke = (args, input, timeout) => boundedCommand(execution.endpoint, args, input, timeout);
  try {
    const result = await executeProbeSequence({source, image: execution.image, invoke,
      assertCurrent: () => native.assertCurrent(admission, request), containerArguments, validateContainer, parseObservation});
    const transcript = deepFreeze({run_id: run.id, request, ...result});
    // Custody comes from the original native run/ledger, not workload stdout.
    await native.finishAttempt(admission, run, transcript);
    return {transcript, digest: sha256(stable(transcript)), qualification: 'NOT_EVALUATED'};
  } catch (error) {
    try {await native.recordFailure(admission, run, String(error.message));}
    catch (ledgerError) {throw new AggregateError([error, ledgerError], 'EXECUTION_AND_FAILURE_RECORDING_FAILED');}
    throw error;
  }
}
