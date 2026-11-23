# p-queue #257 executor/controller: source review candidate

This completes the isolated source implementation for the first proof workload.
It is not installed, Owner-adopted, built, executed, deployed or registered.
No native integration port is invented or enabled. No production credentials,
keys, policy, provider, issuer or K4 authority are supplied by this directory.

## Exact scope and retained source

Reuse the byte-identical parent `pqueue257-source-contract.mjs`, observation
checker and original K5 runtime. The historical contract's `consumer` Owner
identifies Seed; it does NOT authorize Product. Product admission must come
from the existing nimclea-o Product authority. Customer admission remains with
chiapingni-coder. Names, IDs and function callbacks do not grant authority.

The source reader verifies the exact original and repaired commits, ancestry,
all introduced commits, parent and complete changed-file set. It recognizes the
added regression file explicitly but never runs it. It exports only five pinned
source objects, not a checkout, package scripts, workflows or customer tests.
Any new Main requires fresh currentness/admission. This fixed golden-case source
does not automatically rebase or reuse the old candidate against a new base.

## Implemented execution path

1. `source-reader.mjs`: read exact Git data; no customer code execution.
2. `manifest.mjs`: verify the controller, reviewed rules, dependencies and K5
   bytes. The manifest is a review inventory, NOT an authority record.
3. `docker-controller.mjs`: require original authenticated execution admission
   and a durable one-use attempt before any container operation. Verify a
   dedicated rootless Docker daemon with built-in seccomp and a preloaded image
   by immutable digest. Inspect each created container before starting it.
   Reject extra security overrides, duplicate runtime environment entries, image
   healthchecks, unexpected working directories and additional writable mounts.
   IPC and cgroup namespaces must be private, including on independent readback.
   The bounded subprocess transport settles on timeout even without a close
   event, caps retained output bytes and preserves split UTF-8. Cleanup happens
   before external failure recording; aggregate errors retain the primary cause.
4. `probe.mjs`: one fresh restricted container per reviewed probe; actual jsdom,
   plain Node and process-absent cases; task result/completed-event checks;
   Infinity plus 20 idle waiters; original failure and unrelated-error controls.
   Node's pinned type-stripping API handles source as data before import; no
   candidate build configuration is consumed. Limit input/output, wall time,
   CPU, memory, processes, privileges, writable storage and networking.
5. Persist raw output, container state/configuration and source/image bindings
   through the original native attempt ledger. Workload stdout remains
   untrusted. It does not authenticate a run or become an acceptance receipt.
6. `k5-consumption.mjs`: only after original native custody authentication and
   currentness checks, use original `executeProofRecipe()` for one positive and
   separate negative-control records, then original `qualifiesPositiveProof()`.
   Return evidence to the existing Product interface with `authority: null`.
   Authentication operates on an owned deeply frozen transcript snapshot; caller
   mutation across asynchronous reads cannot replace the authenticated input.
   Independently current original K4 authority and original `decideTransition()`
   must precede any applicable authenticated acceptance. No signing occurs here.

The original adapter's intentionally disabled `execute()` remains unchanged.
The new controller calls its reviewed `assessObservations()` after native custody
authentication, then creates an invocation-scoped K5 adapter. No request flag or
environment variable registers it as trusted. The concrete native ports must be
connected only by adopted trusted Product source, not deserialized user input.

## Required original native ports; absent in this source-only environment

These method names specify integration dependencies of the reviewed controller.
They are NOT claims that deployed APIs with these names already exist. They
cannot be implemented by granting authority to caller flags or source hashes.

`authorizeExecution(request)` must independently authenticate the Customer
Owner's adoption of final rules/controller bytes and Product Owner's applicable
execution admission. Bind repository/installation/claim, base/head/source blobs,
manifest digest, image digest, build/lock custody, controller identity, expiry,
revocation, resource limits, secret-free isolation and exact permitted operation.
Return an opaque verified context; never accept self-asserted ownership JSON.

`assertCurrent(context, request)` must re-read applicable authority/revocation,
customer rights, installation scope and exact live PR/Main before effects, between
probes and before evidence release. `claimAttempt` must atomically persist a
one-use attempt in the existing durable ledger. `finishAttempt` binds raw artifact
digests to that authenticated attempt. `recordFailure` records failure without
replaying a consumed attempt. Unknown container-create outcomes require original
operator recovery; never retry automatically. Cleanup targets only created IDs.

`authenticateExecution(bundle)` is implemented by the existing trusted native
provider, not by this workload. It must verify its original completed ledger
attempt, Owner admission, independently controlled run/build provenance, exact
controller/rule/image bytes and full artifact custody. The resulting verified
context supplies the real installation, executor, environment and provenance
reference. Merely accepting this module's transcript hash is insufficient.

This exact-program harness runs the pinned reviewed source in its process; it is
not a general adversarial-JavaScript attestation system. Container output alone
cannot establish honest execution. Original Owner review must cover the pinned
program and harness, and native custody authentication remains mandatory. Do not
reuse this executor for other source blobs or general candidate-controlled code.

## Build and adoption boundary

The lockfile derives only the 45-package jsdom dependency closure from the
existing reproduction lock; no packages were installed here. Its registry SRI
values pin dependency bytes for subsequent independent build verification.
`dependencies.mjs` verifies the complete reachable lock graph, root/version
binding, registry origin and SHA-512 SRI structure; it rejects links, install
scripts and extra entries. Authorized npm ci must still verify downloaded bytes.
The Dockerfile-specific ignore file restricts the build context to the exact
workload files, excluding controller credentials, repository metadata and other
workspace content. No package install or image build has occurred in review.
`Dockerfile` has no default base. A separately authorized build uses an immutable
Node 24.14.0 base reference and this proof directory as its context. Building,
pulling and running are not authorized by the source work item. Native admission
must verify the final image digest and secret-free build provenance; none is
claimed or fabricated. Image runtime requires Node 24.14.0 / jsdom 27.4.0.

Use existing protected GitHub PR review to adopt the final customer rules and
executor source, separately from PR #3. Product PR #51 remains unchanged and is
not yet a proof-before-acceptance consumer: it requires an explicit V1+ source
revision, original review/adoption and separately verified deployment authority.
Do not weaken its V2 single-file policy to admit the two-file repair. Do not edit
protected runners/workflows or presume their maintenance admission.

First native effect blocked: creation/start of the first proof container. Needed:
authenticated original Owner decisions binding final source and immutable built
image, an admitted isolated host, durable attempt admission, and an implemented
original native custody consumer. No image ID, installation grant or key is
invented. No K5 record can be qualified from this source review alone.

## Permitted review validation and limits

`node --check` parses source. From this proof directory, run:

    node --test executor/review.test.mjs executor/mechanical.test.mjs executor/probe-cases.test.mjs

These tests cover controller rejection paths, Git-object reads, a simulated
11-container lifecycle, bounded fake subprocesses, dependency metadata and the
actual behavioral assertions against authored queue doubles. They import neither
customer program, execute no Docker command and produce no K5/K4 receipt.
It is NOT native acceptance, behavioral proof, required CI, or Q3. Probe and
container behavior remain unexecuted pending admission.

Q1: all mutations confined to this new executor directory; no runtime effects.
Q2: original rules, adapter, kernels, source workspaces, indexes and PRs preserved.
Q3: this stage has executable source and bounded fixture evidence; it has no
authenticated customer proof, native adoption or end-to-end Closure.
Audit dimensions supplied for the current work item:
- Actual authority: bounded inert source engineering and fixture tests only.
- Scope: this executor directory; original reviewed rules/adapter/kernels retained.
- Currentness: exact base/head and source identities retained; live PR revalidation
  is mandatory again before any later effect, not inferred from these tests.
- Evidence: source hashes and fixture results, not real executor-run provenance.
- Execution permission: no build, container, customer execution or signing grant.
- Next native consumer: original Owner review/adoption and admitted execution
  composition; native execution/custody integration remains absent.

References used for implementation review:
- https://docs.docker.com/engine/containers/run/
- https://nodejs.org/api/module.html#modulestriptypescripttypescode-options
- https://docs.docker.com/build/concepts/context/#dockerignore-files
- https://docs.npmjs.com/cli/v11/commands/npm-ci/
