import { verifyToken, logSecurityEvent, corsHeaders } from '../../_lib/auth.js';

export async function onRequestOptions(context) {
  return new Response(null, { headers: corsHeaders(context.request, true) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, true);
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: cors });
  }

  const valid = await verifyToken(token, ADMIN_PASSWORD);
  if (!valid) {
    logSecurityEvent('ADMIN_SETTINGS_DENIED', { ip, reason: 'invalid or expired token' });
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired token' }), { status: 401, headers: cors });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const { action } = body;

  try {
    if (action === 'update_levels') {
      const { levels } = body;
      if (!Array.isArray(levels) || levels.length !== 5 || levels.some(l => typeof l !== 'string' || !l.trim())) {
        return new Response(
          JSON.stringify({ error: 'levels must be an array of exactly 5 non-empty strings' }),
          { status: 400, headers: cors }
        );
      }
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('option_levels', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(JSON.stringify(levels.map(l => l.trim()))).run();

      logSecurityEvent('ADMIN_LEVELS_UPDATED', { ip });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
    }

    if (action === 'update_readiness_levels') {
      const { readinessLevels } = body;
      if (
        !Array.isArray(readinessLevels) || readinessLevels.length !== 5 ||
        readinessLevels.some(l => !l?.name?.trim() || !l?.persona?.trim())
      ) {
        return new Response(
          JSON.stringify({ error: 'readinessLevels must be an array of exactly 5 objects with non-empty name and persona' }),
          { status: 400, headers: cors }
        );
      }
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('readiness_levels', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(JSON.stringify(readinessLevels.map(l => ({
        name: l.name.trim(),
        persona: l.persona.trim(),
        description: (l.description ?? '').trim(),
      })))).run();

      logSecurityEvent('ADMIN_READINESS_LEVELS_UPDATED', { ip });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
    }

    if (action === 'update_companies') {
      const { companies } = body;
      if (!Array.isArray(companies) || companies.some(c => typeof c !== 'string' || !c.trim())) {
        return new Response(
          JSON.stringify({ error: 'companies must be an array of non-empty strings' }),
          { status: 400, headers: cors }
        );
      }
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('companies', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(JSON.stringify(companies.map(c => c.trim()))).run();

      logSecurityEvent('ADMIN_COMPANIES_UPDATED', { ip });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
    }

    if (action === 'update_courses') {
      const { courses } = body;
      if (
        !Array.isArray(courses) ||
        courses.some(c => !c?.name?.trim() || !Array.isArray(c.levels) || c.levels.some(l => !Number.isInteger(l) || l < 0 || l > 4))
      ) {
        return new Response(
          JSON.stringify({ error: 'courses must be an array of {name: string, levels: number[]}' }),
          { status: 400, headers: cors }
        );
      }
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('courses', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(JSON.stringify(courses.map(c => ({ name: c.name.trim(), levels: c.levels, description: (c.description ?? '').trim() })))).run();

      logSecurityEvent('ADMIN_COURSES_UPDATED', { ip });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
  } catch (error) {
    logSecurityEvent('ADMIN_SETTINGS_ERROR', { ip, error: error.message });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  }
}
