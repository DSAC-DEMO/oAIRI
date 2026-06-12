import { corsHeaders } from '../../_lib/auth.js';

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
  return new Response(null, { headers: corsHeaders(context.request, false) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, false);

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const { companyName, sector } = body;
  if (!companyName?.trim()) {
    return new Response(JSON.stringify({ success: false, error: 'Company name is required' }), { status: 400, headers: cors });
  }

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM sessions WHERE LOWER(name) = LOWER(?) AND parent_session_id IS NULL'
    ).bind(companyName.trim()).first();
    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'This company is already registered. Please use your existing access code to proceed.' }),
        { status: 409, headers: cors }
      );
    }

    const code = await generateCode();
    const codeHash = await hashCode(code);
    await env.DB.prepare(
      'INSERT INTO sessions (name, sector, code_hash, code) VALUES (?, ?, ?, ?)'
    ).bind(companyName.trim(), (sector || '').trim(), codeHash, code).run();

    const session = await env.DB.prepare(
      'SELECT id, name FROM sessions WHERE code_hash = ?'
    ).bind(codeHash).first();

    return new Response(
      JSON.stringify({ success: true, id: session.id, name: session.name, code }),
      { status: 200, headers: cors }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: cors });
  }
}
