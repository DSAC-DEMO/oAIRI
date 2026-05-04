import { verifyToken, logSecurityEvent, corsHeaders } from '../_lib/auth.js';

// Unambiguous chars — no 0/O, 1/I/L
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

async function generateCode() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: corsHeaders(context.request, true) });
}

async function requireAdmin(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !env.ADMIN_PASSWORD) return false;
  return verifyToken(token, env.ADMIN_PASSWORD);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, true);

  if (!await requireAdmin(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  try {
    const { results: sessions } = await env.DB.prepare(`
      SELECT s.id, s.name, s.code, s.created_at, COUNT(r.id) AS response_count
      FROM sessions s
      LEFT JOIN responses r ON r.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();

    return new Response(JSON.stringify({ success: true, sessions }), { status: 200, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, true);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (!await requireAdmin(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const { action } = body;

  try {
    if (action === 'create') {
      const { name } = body;
      if (!name?.trim()) {
        return new Response(JSON.stringify({ error: 'name is required' }), { status: 400, headers: cors });
      }
      const code = await generateCode();
      const codeHash = await hashCode(code);
      await env.DB.prepare('INSERT INTO sessions (name, code_hash, code) VALUES (?, ?, ?)').bind(name.trim(), codeHash, code).run();
      logSecurityEvent('SESSION_CREATED', { ip, name: name.trim() });
      // Return the plain code once — admin must save it
      return new Response(JSON.stringify({ success: true, code }), { status: 200, headers: cors });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: cors });
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
      logSecurityEvent('SESSION_DELETED', { ip, id });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  }
}
