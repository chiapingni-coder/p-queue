# Review-only build recipe. Building/pulling this image is not authorized here.
# Native admission must bind the base digest, resulting image digest, source
# manifest, lockfile and independently verified build provenance. No tag default.
ARG NODE_BASE
FROM ${NODE_BASE}
WORKDIR /opt/proof/executor
COPY executor/package.json executor/package-lock.json executor/dependencies.mjs ./
RUN node dependencies.mjs && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY pqueue257-source-contract.mjs /opt/proof/pqueue257-source-contract.mjs
COPY executor/identity.mjs executor/probe.mjs executor/probe-cases.mjs ./
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/node", "--no-warnings", "/opt/proof/executor/probe.mjs"]
