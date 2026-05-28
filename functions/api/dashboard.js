import { corsHeaders } from '../_lib/auth.js';

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
    const raw = code.trim();
    if (!raw.toUpperCase().endsWith('DSAC')) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session code' }), { status: 401, headers: cors });
    }
    const codeHash = await hashCode(raw.slice(0, -4));
    const session = await env.DB.prepare(
      'SELECT id, name, created_at, company_uen, round_label FROM sessions WHERE code_hash = ?'
    ).bind(codeHash).first();

    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session code' }),
        { status: 401, headers: cors }
      );
    }

    const [{ results: responses }, { results: questions }] = await Promise.all([
      env.DB.prepare(
        'SELECT id, answers_json, score_pct, readiness_level, is_sp_staff, department, submitted_at FROM responses WHERE session_id = ? ORDER BY submitted_at DESC'
      ).bind(session.id).all(),
      env.DB.prepare(
        'SELECT id, category, dimension, q_id FROM questions ORDER BY order_num ASC, id ASC'
      ).all(),
    ]);

    let readinessLevels = [
      { name: 'Expert Ready',     persona: 'Disciplined' },
      { name: 'Advanced Ready',   persona: 'Crafter'     },
      { name: 'Moderately Ready', persona: 'Explorer'    },
      { name: 'Developing',       persona: 'Learner'     },
      { name: 'Novice',           persona: 'Observer'    },
    ];
    let optionLevels = ['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst'];
    try {
      const [rlRow, olRow] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'readiness_levels'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'option_levels'").first(),
      ]);
      if (rlRow?.value) readinessLevels = JSON.parse(rlRow.value);
      if (olRow?.value) optionLevels = JSON.parse(olRow.value);
    } catch {}

    // Fetch sibling sessions (same company_uen) for multi-round view
    let rounds = [];
    if (session.company_uen) {
      const { results: siblings } = await env.DB.prepare(
        'SELECT id, name, created_at, round_label FROM sessions WHERE company_uen = ? ORDER BY created_at ASC'
      ).bind(session.company_uen).all();

      if (siblings.length > 1) {
        rounds = await Promise.all(
          siblings.map(async (s, idx) => {
            const { results: sibResponses } = await env.DB.prepare(
              'SELECT id, answers_json, score_pct, readiness_level, submitted_at FROM responses WHERE session_id = ? ORDER BY submitted_at DESC'
            ).bind(s.id).all();
            return {
              roundNum: idx + 1,
              sessionId: s.id,
              label: s.round_label || null,
              createdAt: s.created_at,
              name: s.name,
              responses: sibResponses,
            };
          })
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: { id: session.id, name: session.name, created_at: session.created_at },
        responses,
        questions,
        readinessLevels,
        optionLevels,
        rounds,
      }),
      { status: 200, headers: cors }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: cors }
    );
  }
}
