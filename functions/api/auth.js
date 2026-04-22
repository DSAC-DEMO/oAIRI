import { generateToken, checkRateLimit, logSecurityEvent, corsHeaders } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, true);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // Rate limit by IP before doing any work
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    logSecurityEvent('AUTH_RATE_LIMITED', { ip });
    return new Response(
      JSON.stringify({ success: false, error: 'Too many attempts. Please try again later.' }),
      {
        status: 429,
        headers: {
          ...cors,
          'Retry-After': String(rate.retryAfter),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  try {
    const { password } = await request.json();
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      logSecurityEvent('AUTH_MISCONFIGURED', { ip, reason: 'ADMIN_PASSWORD env var not set' });
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfiguration', envKeys: Object.keys(env) }),
        { status: 500, headers: cors }
      );
    }

    if (password === ADMIN_PASSWORD) {
      const token = await generateToken(ADMIN_PASSWORD);
      logSecurityEvent('AUTH_SUCCESS', { ip });
      return new Response(
        JSON.stringify({ success: true, token }),
        {
          status: 200,
          headers: { ...cors, 'X-RateLimit-Remaining': String(rate.remaining) }
        }
      );
    } else {
      logSecurityEvent('AUTH_FAILURE', { ip });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid password' }),
        {
          status: 401,
          headers: { ...cors, 'X-RateLimit-Remaining': String(rate.remaining) }
        }
      );
    }
  } catch (error) {
    logSecurityEvent('AUTH_ERROR', { ip, error: error.message });
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication failed' }),
      { status: 500, headers: cors }
    );
  }
}
