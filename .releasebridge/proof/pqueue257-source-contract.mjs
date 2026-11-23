// Proposed source contract, not an ownership attestation or execution admission.
// Scope comes from the named source-review decision. No runtime enable switch.
export const SOURCE_DECISION = 'RB_V1PLUS_PQUEUE257_CROSS_REPO_SOURCE_ADMISSION_V1';
export const CUSTOMER = Object.freeze({
  repository: 'chiapingni-coder/p-queue', repository_id: 1439019838, pr: 3,
  base: '7f272ab5ff2254c0dc2537b7977e88ede1cd55e8',
  candidate: 'fdfd17a9aed8f4a70e231d20295f076cb274ce1d',
  claim: 'PQUEUE257_CONSTRUCTOR_EVENTTARGET_COMPATIBILITY_V1',
  path: 'source/index.ts', blob: '8e0de41e0c7e10425597b7f3ce3aeb259643f52a',
  original_blob: '2b9b9e54c8e9228f990a909c946f3dad5cd8ca0f',
});
export const ORIGINAL_RUNTIME = Object.freeze({
  source_head: 'ee73a9362965a782540e43da0e5621a327863cc1',
  k5_blob: 'a1209cf248e535ef828a54b05c52ff3e81a60026',
  k4_blob: 'd1b681863620065bd4c8db77de2cf3f86f49d89d',
  schema: 'NIMCLEA_O_VIBE_CLIFF_EVIDENCE_RECORD_V0_1',
});

// The actual existing Owners. These identifiers locate records to authenticate;
// naming them does not assert they have approved these proposed source bytes.
export const ORIGINAL_OWNERS = Object.freeze({
  customer: Object.freeze({login: 'chiapingni-coder', id: 270411811}),
  consumer: Object.freeze({login: 'Nimclea', id: 210114408}),
});

// Expected observations are controlled here, outside the customer's repair PR.
// Negative outcomes are required controls, never positive evidence on their own.
export const PROBES = Object.freeze([
  Object.freeze({id: 'original-node', revision: CUSTOMER.base, environment: 'node', outcome: 'CONSTRUCTED', role: 'control'}),
  Object.freeze({id: 'original-jsdom', revision: CUSTOMER.base, environment: 'jsdom', outcome: 'EVENTTARGET_TYPE_ERROR', role: 'control'}),
  Object.freeze({id: 'candidate-node', revision: CUSTOMER.candidate, environment: 'node', outcome: 'CONSTRUCTED_AND_TASK_COMPLETED', role: 'positive'}),
  Object.freeze({id: 'candidate-jsdom', revision: CUSTOMER.candidate, environment: 'jsdom', outcome: 'CONSTRUCTED_AND_TASK_COMPLETED', role: 'positive'}),
  Object.freeze({id: 'candidate-browser', revision: CUSTOMER.candidate, environment: 'jsdom-without-process', outcome: 'CONSTRUCTED_AND_TASK_COMPLETED', role: 'positive'}),
  Object.freeze({id: 'native-listener-limit', revision: CUSTOMER.candidate, environment: 'node', outcome: 'INFINITY_AND_20_WAITERS_COMPLETED', role: 'positive'}),
  Object.freeze({id: 'invalid-options', revision: CUSTOMER.candidate, environment: 'node', outcome: 'ORIGINAL_VALIDATION_ERROR', role: 'control'}),
  Object.freeze({id: 'unrelated-error', revision: CUSTOMER.candidate, environment: 'node', outcome: 'SAME_ERROR_RETHROWN', role: 'control'}),
  Object.freeze({id: 'unrelated-type-error', revision: CUSTOMER.candidate, environment: 'node', outcome: 'SAME_ERROR_RETHROWN', role: 'control'}),
  Object.freeze({id: 'other-argument-error', revision: CUSTOMER.candidate, environment: 'node', outcome: 'SAME_ERROR_RETHROWN', role: 'control'}),
  Object.freeze({id: 'target-message-without-code', revision: CUSTOMER.candidate, environment: 'node', outcome: 'SAME_ERROR_RETHROWN', role: 'control'}),
]);

export function referencesCustomer(binding) {
  return binding?.repository === CUSTOMER.repository || binding?.repository_id === CUSTOMER.repository_id;
}
export function exactCustomerBinding(binding) {
  return binding != null && Object.entries(CUSTOMER).every(([key, value]) => binding[key] === value);
}

export function prepareCustomerProof(binding) {
  if (!exactCustomerBinding(binding)) throw Error('CUSTOMER_PROOF_BINDING_MISMATCH');
  return {
    source_decision: SOURCE_DECISION, status: 'SOURCE_REVIEW_ONLY', binding: {...CUSTOMER},
    original_runtime: {...ORIGINAL_RUNTIME}, expected_observations: PROBES.map(probe => ({...probe})),
    execution_admission: null, ownership_authentication: null, trusted_execution_provenance: null,
    // A run, image digest and trusted source revision must be selected and verified
    // by the existing native authority before any executable registry is built.
    executor: null, environment: null, evidence: null, proposal: null,
    effects_authorized: false, k4_transition_authorized: false,
  };
}
