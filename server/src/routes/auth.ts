import type { FastifyInstance } from 'fastify';

/**
 * Auth lives entirely in bailey-proxy upstream of this container. Identity
 * arrives on every request as the X-Forwarded-Email / X-Forwarded-Groups
 * headers; the dashboard trusts them within the bailey trust boundary
 * (the proxy is the only thing that can route public traffic here).
 *
 * We keep the route function around as a deliberate hook so future bailey-
 * specific endpoints (e.g. /whoami) can live alongside, but the legacy
 * popup-callback page from the old setup is gone — bailey doesn't open
 * popups, the wrap iframe owns the session.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  app.get('/whoami', async (req, reply) => {
    const email = headerFirst(req.headers['x-forwarded-email']);
    const groups = headerFirst(req.headers['x-forwarded-groups']);
    if (!email) {
      reply.code(401).send({ error: 'no identity on request' });
      return;
    }
    reply.send({
      email,
      groups: groups ? groups.split(',').map((g) => g.trim()).filter(Boolean) : [],
    });
  });
}

function headerFirst(v: unknown): string | undefined {
  if (typeof v === 'string') return v || undefined;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  return undefined;
}
