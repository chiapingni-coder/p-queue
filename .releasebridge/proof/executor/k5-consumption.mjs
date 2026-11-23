// Authenticated proof BEFORE K4 and acceptance. No V2 producer, key or signing.
import {executeProofRecipe, qualifiesPositiveProof} from '../kernel/proof/proof-runtime-v0.1.mjs';
import {assessObservations} from '../pqueue257-adapter.mjs';
import {CUSTOMER, PROBES, VERSION, stable, sha256, deepFreeze, requireCondition} from './identity.mjs';
import {parseObservation} from './docker-controller.mjs';
import {readImplementationIdentity} from './manifest.mjs';

export const PROOF_RULES = deepFreeze({
  positive: {recipe_id: 'PQUEUE257_BEHAVIOR_V1', adapter_id: 'PQUEUE257_OWNER_REVIEWED_EXECUTOR', adapter_version: VERSION},
  negative_controls: PROBES.filter(p => p.role === 'control').map(p => ({recipe_id: `PQUEUE257_CONTROL_${p.id}`, adapter_id: 'PQUEUE257_OWNER_REVIEWED_EXECUTOR', adapter_version: VERSION})),
});
export async function consumeAuthenticatedExecution(bundle, native) {
  requireCondition(typeof native?.authenticateExecution === 'function' && typeof native?.assertCurrent === 'function', 'ORIGINAL_NATIVE_CUSTODY_CONSUMER_REQUIRED');
  // Own the exact bytes throughout asynchronous authentication/currentness reads.
  // Neither the caller nor an accidental callback mutation may rewrite the
  // transcript that will subsequently become original K5 input.
  bundle = deepFreeze(structuredClone(bundle));
  requireCondition(bundle?.digest === sha256(stable(bundle.transcript)), 'TRANSCRIPT_DIGEST_MISMATCH');
  requireCondition(bundle.transcript.request.manifestDigest === readImplementationIdentity().manifestDigest, 'IMPLEMENTATION_MANIFEST_MISMATCH');
  // Must authenticate stored original attempt, adopted rule/controller manifests,
  // exact image and environment, isolated execution, Owner admission and custody.
  // An unsigned transcript or boolean from a request cannot satisfy this port.
  const verified = deepFreeze(structuredClone(await native.authenticateExecution(bundle)));
  requireCondition(verified && verified.digest === bundle.digest && typeof verified.provenance_ref === 'string' && verified.provenance_ref &&
    typeof verified.executor_id === 'string' && verified.executor_id && typeof verified.environment === 'string' && verified.environment &&
    Number.isSafeInteger(verified.installation_id) && verified.installation_id > 0, 'NATIVE_EXECUTION_NOT_AUTHENTICATED');
  const t = bundle.transcript;
  requireCondition(stable(t.request.binding) === stable(CUSTOMER) && t.artifacts.length === PROBES.length, 'TRANSCRIPT_BINDING_MISMATCH');
  const observations = t.artifacts.map((artifact, i) => {
    requireCondition(artifact.probe === PROBES[i].id && artifact.stdout_sha256 === sha256(artifact.stdout) && artifact.stderr_sha256 === sha256(artifact.stderr), 'PROBE_ARTIFACT_MISMATCH');
    return parseObservation(artifact.stdout, PROBES[i], artifact.observation.challenge);
  });
  requireCondition(assessObservations({binding: CUSTOMER}, observations).complete, 'REVIEWED_RULES_NOT_SATISFIED');
  await native.assertCurrent(verified, t.request);
  const binding = {repository: CUSTOMER.repository, repository_id: CUSTOMER.repository_id, installation_id: verified.installation_id,
    pr: CUSTOMER.pr, branch: 'main', base: CUSTOMER.base, candidate: CUSTOMER.candidate, claim_id: CUSTOMER.claim, path: CUSTOMER.path, blob: CUSTOMER.blob};
  const identity = {identity_id: sha256(JSON.stringify([CUSTOMER.repository_id, CUSTOMER.pr, CUSTOMER.candidate])),
    revision: CUSTOMER.candidate, scene: 'github-pr-freeze-proposal', current: true};
  const rulesDigest = sha256(stable(PROOF_RULES));
  const scope = {...binding, affected: [CUSTOMER.claim], unaffected: [], unknown: [], executor_id: verified.executor_id,
    provenance_ref: verified.provenance_ref, proof_rules_digest: rulesDigest};
  const context = {identity, scope, environment: verified.environment};
  function execute(rule, type, records) {
    // REPO_OWNED registration exists only inside the successfully authenticated
    // invocation; the literal is never used as authentication of its own owner.
    const registry = {[rule.adapter_id]: {owner: 'REPO_OWNED', version: rule.adapter_version,
      execute: () => ({result: 'PASS', failure_class: '', positive_source: type !== 'NEGATIVE_CONTROL', non_interference: true,
        output: {proven_claims: type === 'NEGATIVE_CONTROL' ? [] : [CUSTOMER.claim], observations: records, transcript_digest: bundle.digest}})}};
    return executeProofRecipe({id: rule.recipe_id, type, adapter_id: rule.adapter_id,
      input: {claims: [CUSTOMER.claim], binding, transcript_digest: bundle.digest}}, context, registry);
  }
  const evidence = execute(PROOF_RULES.positive, 'NARROW_DELTA_PROOF', observations.filter((_, i) => PROBES[i].role === 'positive'));
  const controls = observations.filter((_, i) => PROBES[i].role === 'control');
  const negative_controls = PROOF_RULES.negative_controls.map((rule, i) => execute(rule, 'NEGATIVE_CONTROL', [controls[i]]));
  requireCondition(qualifiesPositiveProof(evidence, {identity, scope, claim_id: CUSTOMER.claim}), 'ORIGINAL_K5_REJECTED');
  await native.assertCurrent(verified, t.request);
  return {binding, identity, scope, evidence, negative_controls, proof_rules: PROOF_RULES,
    execution: {executor_id: verified.executor_id, environment: verified.environment, provenance_ref: verified.provenance_ref, proof_rules_digest: rulesDigest},
    authority: null, proposal: null, protection_activated: false};
  // Existing Product consumption must independently attach current K4 authority
  // and call original decideTransition(). This module cannot issue acceptance.
}
