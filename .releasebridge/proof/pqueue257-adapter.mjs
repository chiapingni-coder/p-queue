// Source-review candidate only. This file is not registered or installed.
// The checker below is domain logic, not authentication or an acceptance issuer.
import { CUSTOMER, PROBES, exactCustomerBinding } from './pqueue257-source-contract.mjs';
import { ProofRuntimeError } from './kernel/proof/proof-runtime-v0.1.mjs';

// Assess typed observations supplied by a separately admitted, independently
// controlled executor. The consumer must authenticate the executor and transcript
// outside this function; an arbitrary JSON transcript cannot establish acceptance.
// This returns a rule assessment, NOT a K5 evidence record or qualification.
export function assessObservations(input, observations) {
  if (!exactCustomerBinding(input?.binding)) return {complete: false, reason: 'BINDING_MISMATCH'};
  if (!Array.isArray(observations) || observations.length !== PROBES.length) {
    return {complete: false, reason: 'INCOMPLETE_OBSERVATIONS'};
  }
  const byId = new Map(observations.map(observation => [observation?.id, observation]));
  if (byId.size !== PROBES.length) return {complete: false, reason: 'DUPLICATE_OBSERVATION'};
  for (const expected of PROBES) {
    const actual = byId.get(expected.id);
    if (!actual || actual.revision !== expected.revision || actual.environment !== expected.environment ||
        actual.outcome !== expected.outcome) return {complete: false, reason: 'PROBE_MISMATCH', probe: expected.id};
    const blob = expected.revision === CUSTOMER.base ? CUSTOMER.original_blob : CUSTOMER.blob;
    if (actual.source_path !== CUSTOMER.path || actual.source_blob !== blob) {
      return {complete: false, reason: 'SOURCE_IDENTITY_MISMATCH', probe: expected.id};
    }
  }
  return {complete: true, claim: CUSTOMER.claim, positive_probes: PROBES.filter(p => p.role === 'positive').map(p => p.id),
    negative_and_baseline_controls: PROBES.filter(p => p.role === 'control').map(p => p.id),
    qualification: 'NOT_EVALUATED', ownership: 'NOT_AUTHENTICATED', admission: 'WITHHELD'};
}

// No owner='REPO_OWNED' registry entry is created from the source decision.
// No flag, environment variable, caller transcript or CI result enables execution.
// A later independently admitted source revision must connect the existing native
// executor and original executeProofRecipe(); this proposal cannot mint receipts.
export function execute() {
  throw new ProofRuntimeError('SOURCE_REVIEW_ONLY_EXECUTION_NOT_ADMITTED');
}
