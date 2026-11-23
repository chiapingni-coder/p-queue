// Mechanical sequence used only AFTER original native admission. This module
// confers no authority and creates no proof records. Fixture tests replace only
// its I/O, never the public controller's admission or production transport.
import {randomBytes} from 'node:crypto';
import {PROBES, sha256, requireCondition} from './identity.mjs';

export async function executeProbeSequence({source, image, invoke, assertCurrent,
  containerArguments, validateContainer, parseObservation}) {
  let activeContainer, failure, result;
  try {
    const info = await invoke(['info', '--format', '{{json .SecurityOptions}}']);
    const security = info.code === 0 ? JSON.parse(info.stdout) : [];
    requireCondition(security.some(x => x === 'name=rootless') && security.some(x => x === 'name=seccomp,profile=builtin'), 'ROOTLESS_SECCOMP_DAEMON_NOT_VERIFIED');
    const inspection = await invoke(['image', 'inspect', image]);
    requireCondition(inspection.code === 0, 'ADMITTED_IMAGE_NOT_LOCAL');
    const inspectedImage = JSON.parse(inspection.stdout)[0];
    requireCondition(inspectedImage.RepoDigests?.includes(image) && /^sha256:[a-f0-9]{64}$/.test(inspectedImage.Id), 'IMAGE_DIGEST_MISMATCH');
    const artifacts = [];
    for (const probe of PROBES) {
      await assertCurrent();
      const challenge = randomBytes(32).toString('hex');
      const created = await invoke(containerArguments(image));
      requireCondition(created.code === 0 && /^[a-f0-9]{64}\s*$/.test(created.stdout), 'CONTAINER_CREATE_FAILED_NO_REPLAY');
      activeContainer = created.stdout.trim();
      const inspect = await invoke(['inspect', activeContainer]);
      requireCondition(inspect.code === 0, 'CONTAINER_INSPECTION_FAILED');
      const config = JSON.parse(inspect.stdout)[0]; validateContainer(config, inspectedImage.Id);
      // Inspection and other asynchronous reads cannot consume expired admission.
      await assertCurrent();
      const output = await invoke(['start', '--attach', '--interactive', activeContainer], JSON.stringify({
        probe: probe.id, challenge, files: source.sources[probe.revision]}), 30000);
      const final = await invoke(['inspect', activeContainer]);
      requireCondition(final.code === 0, 'CONTAINER_FINAL_STATE_MISSING');
      const state = JSON.parse(final.stdout)[0].State;
      requireCondition(output.code === 0 && state.Status === 'exited' && state.ExitCode === 0 && !state.OOMKilled && !state.Error, 'PROBE_FAILED');
      const observation = parseObservation(output.stdout, probe, challenge);
      artifacts.push({probe: probe.id, container: activeContainer, config, state, observation,
        stdout: output.stdout, stderr: output.stderr, stdout_sha256: sha256(output.stdout), stderr_sha256: sha256(output.stderr)});
      const removed = await invoke(['rm', activeContainer]);
      requireCondition(removed.code === 0, 'DISPOSABLE_CONTAINER_CLEANUP_FAILED'); activeContainer = undefined;
    }
    await assertCurrent();
    result = {image_id: inspectedImage.Id, artifacts};
  } catch (error) {failure = error;}
  // Stop the workload before any possibly unavailable external ledger write.
  if (activeContainer) {
    try {
      const cleaned = await invoke(['rm', '--force', activeContainer]);
      requireCondition(cleaned.code === 0, 'FAILED_RUN_CLEANUP_REQUIRES_OPERATOR');
    } catch (error) {failure = failure ? new AggregateError([failure, error], 'EXECUTION_AND_CLEANUP_FAILED') : error;}
  }
  if (failure) throw failure;
  return result;
}
