// Meta-tests guarding the architectural decision: oauth2-proxy is gone
// from this container, bailey-proxy handles authentication upstream.
//
// If a future commit re-introduces the sidecar pattern (binary download,
// OAUTH2_PROXY_* env vars, _login_done popup callback page) this test
// fails first — keep it loud and explicit.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.cache',
]);
const SKIP_FILES = new Set([
  // This test file itself is allowed to mention the forbidden patterns.
  'server/test/no_oauth2_proxy.test.ts',
  'server/test/auth.test.ts',
  'PLAN-bailey-protected-ingress.md',
]);

const FORBIDDEN_PATTERNS = [
  /oauth2-proxy/i,
  /oauth2_proxy/i,
  /OAUTH2_PROXY_/,
  /bitswan-aoc-oauth2/,
  /_login_done/,
  /x-auth-request-email/i,
];

function* iterFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      yield* iterFiles(full);
    } else if (st.isFile()) {
      yield full;
    }
  }
}

describe('no oauth2-proxy artifacts in the repo', () => {
  it('Dockerfile does not install oauth2-proxy', () => {
    const txt = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf-8');
    expect(txt).not.toMatch(/oauth2-proxy/i);
    expect(txt).not.toMatch(/bitswan-aoc-oauth2/);
  });

  it('entrypoint.sh does not set OAUTH2_PROXY_* env vars', () => {
    const txt = readFileSync(join(REPO_ROOT, 'entrypoint.sh'), 'utf-8');
    expect(txt).not.toMatch(/OAUTH2_PROXY_/);
    expect(txt).not.toMatch(/oauth2-proxy/);
  });

  it('no source file mentions oauth2-proxy or _login_done', () => {
    const offenders: string[] = [];
    for (const path of iterFiles(REPO_ROOT)) {
      const rel = relative(REPO_ROOT, path);
      if (SKIP_FILES.has(rel)) continue;
      // Only scan textual sources.
      if (!/\.(ts|tsx|js|jsx|json|html|css|md|sh|yml|yaml)$/.test(rel)
          && !rel.endsWith('Dockerfile')) continue;
      let text: string;
      try { text = readFileSync(path, 'utf-8'); }
      catch { continue; }
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.test(text)) {
          offenders.push(`${rel}: matches ${pat.toString()}`);
          break;
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
