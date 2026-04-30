import { corsHeaders } from '../../_lib/auth.js';

async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: corsHeaders(context.request, false) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, false);

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const { code } = body;
  if (!code?.trim()) {
    return new Response(JSON.stringify({ success: false, error: 'code required' }), { status: 400, headers: cors });
  }

  try {
    const codeHash = await hashCode(code.trim());
    const session = await env.DB.prepare(
      'SELECT id, name FROM sessions WHERE code_hash = ?'
    ).bind(codeHash).first();

    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session code' }), { status: 200, headers: cors });
    }

    return new Response(
      JSON.stringify({ success: true, id: session.id, name: session.name }),
      { status: 200, headers: cors }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: cors });
  }
}
