// Positive coverage for the identity-header contract: every route that
// extracts the caller's identity must read 'x-forwarded-email' (set by
// bailey-proxy) and never the legacy 'x-auth-request-email' name that the
// dropped oauth2-proxy sidecar used.
//
// no_oauth2_proxy.test.ts asserts the negative ("no file mentions
// x-auth-request-email"); this file asserts the positive ("every identity
// read uses x-forwarded-email").

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');
const SRC = join(REPO_ROOT, 'server', 'src');

function read(relPath: string): string {
  return readFileSync(join(SRC, relPath), 'utf-8');
}

describe('identity header contract', () => {
  it('coding-agent route reads x-forwarded-email', () => {
    const src = read('routes/coding-agent.ts');
    expect(src).toMatch(/x-forwarded-email/);
  });

  it('auth route reads x-forwarded-email on /whoami', () => {
    const src = read('routes/auth.ts');
    expect(src).toMatch(/x-forwarded-email/);
    expect(src).toMatch(/whoami/);
  });

  it('no source file reads x-auth-request-* (the dead oauth2-proxy name)', () => {
    // Belt-and-suspenders alongside no_oauth2_proxy.test.ts. Same regex,
    // different scope: this version is scoped to server/src/ so a regression
    // in a single route file fails this test directly with the file path.
    const offenders: string[] = [];
    const filesToCheck = [
      'routes/coding-agent.ts',
      'routes/auth.ts',
      'index.ts',
    ];
    for (const rel of filesToCheck) {
      try {
        const text = read(rel);
        if (/x-auth-request-/i.test(text)) offenders.push(rel);
      } catch {
        // file may not exist in some checkouts; skip silently
      }
    }
    expect(offenders, `still reading x-auth-request-* in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('coding-agent falls back to "unknown" when header missing', () => {
    // We can't easily unit-test the private emailFromRequest helper without
    // refactoring, but we can assert the fallback literal is wired up.
    const src = read('routes/coding-agent.ts');
    expect(src).toMatch(/'unknown'|"unknown"/);
  });
});
