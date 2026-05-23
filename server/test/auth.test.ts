// Tests for the post-bailey auth surface. Identity arrives as
// X-Forwarded-Email + X-Forwarded-Groups headers set by the upstream proxy. The dashboard trusts them within the bailey trust boundary
// (the proxy is the only thing that can route public traffic to this
// container). We test the /whoami endpoint round-trip + a few header
// edge cases.

import Fastify from 'fastify';
import { registerAuthRoutes } from '../src/routes/auth.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  app = Fastify();
  registerAuthRoutes(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('GET /whoami', () => {
  it('returns email + groups when bailey supplied them', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-forwarded-email': 'alice@example.com',
        'x-forwarded-groups': '/Sandbox/admin,/Sandbox/users,readonly',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe('alice@example.com');
    expect(body.groups).toEqual(['/Sandbox/admin', '/Sandbox/users', 'readonly']);
  });

  it('returns 401 when no identity header is set', async () => {
    const res = await app.inject({ method: 'GET', url: '/whoami' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/no identity/);
  });

  it('returns an empty groups array when X-Forwarded-Groups is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { 'x-forwarded-email': 'bob@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: 'bob@example.com', groups: [] });
  });

  it('strips empty entries and trims whitespace in groups', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        'x-forwarded-email': 'c@example.com',
        'x-forwarded-groups': ' /a , ,/b , ',
      },
    });
    expect(res.json().groups).toEqual(['/a', '/b']);
  });

  it('does not expose the legacy /_login_done popup route', async () => {
    // The popup flow was an oauth2-proxy artifact. bailey-proxy handles
    // auth at the network edge; in-page popups never happen.
    const res = await app.inject({ method: 'GET', url: '/_login_done' });
    expect(res.statusCode).toBe(404);
  });
});
