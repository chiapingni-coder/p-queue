// Git objects only: no checkout, fetch, hooks, package scripts, or code imports.
import {execFileSync} from 'node:child_process';
import {CUSTOMER, SOURCE_BLOBS, TEST_BLOB, validateSources, requireCondition} from './identity.mjs';
export function readSourceObjects(repository) {
  const git = (...args) => execFileSync('git', ['--no-replace-objects', '--no-pager', '-C', repository, ...args], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true,
    env: {PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0'},
  });
  requireCondition(git('merge-base', CUSTOMER.base, CUSTOMER.candidate).trim() === CUSTOMER.base, 'BASE_NOT_ANCESTOR');
  const commits = git('rev-list', '--reverse', `${CUSTOMER.base}..${CUSTOMER.candidate}`).trim().split('\n');
  requireCondition(commits.length >= 1 && commits.length <= 100 && commits.every(c => /^[a-f0-9]{40}$/.test(c)), 'HISTORY_BOUND_EXCEEDED');
  // This exact reviewed golden case has one commit. No net-diff-only approval.
  requireCondition(commits.length === 1 && commits[0] === CUSTOMER.candidate, 'INTRODUCED_HISTORY_CHANGED');
  requireCondition(git('rev-list', '--parents', '-n', '1', CUSTOMER.candidate).trim() === `${CUSTOMER.candidate} ${CUSTOMER.base}`, 'MERGE_OR_PARENT_CHANGED');
  const changes = git('diff-tree', '--no-commit-id', '--no-renames', '--name-status', '-r', CUSTOMER.candidate).trim().split('\n').sort();
  requireCondition(JSON.stringify(changes) === JSON.stringify(['A\ttest/event-target.ts', 'M\tsource/index.ts']), 'CHANGE_SET_CHANGED');
  requireCondition(git('rev-parse', `${CUSTOMER.candidate}:test/event-target.ts`).trim() === TEST_BLOB, 'ANCILLARY_TEST_CHANGED');
  const sources = {};
  for (const revision of [CUSTOMER.base, CUSTOMER.candidate]) {
    const entries = git('ls-tree', '-r', revision, 'source').trim().split('\n');
    requireCondition(entries.length === Object.keys(SOURCE_BLOBS).length && entries.every(e => /^100644 blob [a-f0-9]{40}\tsource\/[\w-]+\.ts$/.test(e)), 'SOURCE_TREE_MODE_OR_SET_CHANGED');
    const files = Object.fromEntries(Object.keys(SOURCE_BLOBS).map(name => [name, git('cat-file', 'blob', `${revision}:source/${name}`)]));
    validateSources(revision, files);
    sources[revision] = files;
  }
  return {binding: {...CUSTOMER}, commits, sources};
}
