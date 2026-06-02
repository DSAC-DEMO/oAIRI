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
    const rawSession = await env.DB.prepare(
      'SELECT id, name, created_at, company_uen, round_label, dept_label, parent_session_id FROM sessions WHERE code_hash = ?'
    ).bind(codeHash).first();

    if (!rawSession) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session code' }),
        { status: 401, headers: cors }
      );
    }

    // If user logged in with a dept session, find the parent round session
    let session = rawSession;
    let activeDeptLabel = null;
    if (rawSession.parent_session_id) {
      const parent = await env.DB.prepare(
        'SELECT id, name, created_at, company_uen, round_label FROM sessions WHERE id = ?'
      ).bind(rawSession.parent_session_id).first();
      if (parent) {
        session = parent;
        activeDeptLabel = rawSession.dept_label;
      }
    }

    const [{ results: responses }, { results: questions }] = await Promise.all([
      env.DB.prepare(
        'SELECT id, answers_json, score_pct, readiness_level, recommended_courses, is_sp_staff, department, submitted_at FROM responses WHERE session_id = ? ORDER BY submitted_at DESC'
      ).bind(rawSession.id).all(),
      env.DB.prepare(
        'SELECT id, category, dimension, q_id FROM questions ORDER BY order_num ASC, id ASC'
      ).all(),
    ]);

    let readinessLevels = [
      { name: 'Expert Ready',     persona: 'Disciplined', description: 'Demonstrates exceptional AI readiness and leads others confidently.' },
      { name: 'Advanced Ready',   persona: 'Crafter',     description: 'Shows strong AI readiness with consistent good judgement.'           },
      { name: 'Moderately Ready', persona: 'Explorer',    description: 'Displays adequate AI readiness with room for development.'           },
      { name: 'Developing',       persona: 'Learner',     description: 'Shows foundational awareness but needs structured development.'      },
      { name: 'Novice',           persona: 'Observer',    description: 'Limited AI readiness; requires substantial training and support.'    },
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

    // Fetch round siblings (same company_uen, no parent = top-level rounds only)
    let rounds = [];
    if (session.company_uen) {
      const { results: roundSessions } = await env.DB.prepare(
        'SELECT id, name, created_at, round_label FROM sessions WHERE company_uen = ? AND parent_session_id IS NULL ORDER BY created_at ASC'
      ).bind(session.company_uen).all();

      if (roundSessions.length > 1) {
        rounds = await Promise.all(
          roundSessions.map(async (s, idx) => {
            const [{ results: roundResponses }, { results: deptSessions }] = await Promise.all([
              env.DB.prepare(
                'SELECT id, answers_json, score_pct, readiness_level, recommended_courses, submitted_at FROM responses WHERE session_id = ? ORDER BY submitted_at DESC'
              ).bind(s.id).all(),
              env.DB.prepare(
                'SELECT id, dept_label, created_at FROM sessions WHERE parent_session_id = ? ORDER BY created_at ASC'
              ).bind(s.id).all(),
            ]);

            let departments = null;
            if (deptSessions.length > 0) {
              departments = await Promise.all(
                deptSessions.map(async (d) => {
                  const { results: deptResponses } = await env.DB.prepare(
                    'SELECT id, answers_json, score_pct, readiness_level, recommended_courses, submitted_at FROM responses WHERE session_id = ? ORDER BY submitted_at DESC'
                  ).bind(d.id).all();
                  return { label: d.dept_label, sessionId: d.id, responses: deptResponses };
                })
              );
            }

            return {
              roundNum: idx + 1,
              sessionId: s.id,
              label: s.round_label || null,
              createdAt: s.created_at,
              name: s.name,
              responses: roundResponses,
              departments,
            };
          })
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: { id: session.id, name: session.name, created_at: session.created_at, activeDeptLabel },
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
