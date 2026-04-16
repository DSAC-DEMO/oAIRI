import { verifyToken, logSecurityEvent, corsHeaders } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, true);
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    logSecurityEvent('ADMIN_ACCESS_DENIED', { ip, reason: 'no token' });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: cors });
  }

  const valid = await verifyToken(token, ADMIN_PASSWORD);
  if (!valid) {
    logSecurityEvent('ADMIN_ACCESS_DENIED', { ip, reason: 'invalid or expired token' });
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired token' }), { status: 401, headers: cors });
  }

  logSecurityEvent('ADMIN_ACCESS', { ip });

  // ── Queries ───────────────────────────────────────────────────────────────
  try {
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_responses,
        AVG(score_pct) as avg_score,
        MAX(score_pct) as max_score,
        MIN(score_pct) as min_score,
        COUNT(CASE WHEN readiness_level = 'Expert Ready'     THEN 1 END) as expert_count,
        COUNT(CASE WHEN readiness_level = 'Advanced Ready'   THEN 1 END) as advanced_count,
        COUNT(CASE WHEN readiness_level = 'Moderately Ready' THEN 1 END) as moderate_count,
        COUNT(CASE WHEN readiness_level = 'Developing'       THEN 1 END) as developing_count,
        COUNT(CASE WHEN readiness_level = 'Novice'           THEN 1 END) as novice_count
      FROM responses
    `).first();

    const { results: scoreBuckets } = await env.DB.prepare(`
      SELECT
        CASE
          WHEN score_pct >= 4 THEN '4.00-5.00'
          WHEN score_pct >= 3 THEN '3.00-3.99'
          WHEN score_pct >= 2 THEN '2.00-2.99'
          WHEN score_pct >= 1 THEN '1.00-1.99'
          ELSE '0.00-0.99'
        END as bucket,
        COUNT(*) as count
      FROM responses
      GROUP BY bucket
      ORDER BY bucket DESC
    `).all();

    const { results: dailyTrend } = await env.DB.prepare(`
      SELECT DATE(submitted_at) as date, COUNT(*) as count
      FROM responses
      WHERE submitted_at >= DATE('now', '-30 days')
      GROUP BY DATE(submitted_at)
      ORDER BY date ASC
    `).all();

    const { results: responses } = await env.DB.prepare(
      'SELECT id, readiness_level, total_score, score_pct, answers_json, is_sp_staff, department, submitted_at FROM responses ORDER BY submitted_at DESC'
    ).all();

    const { results: questions } = await env.DB.prepare(
      'SELECT id, category, question, order_num FROM questions ORDER BY order_num ASC, id ASC'
    ).all();

    const { results: questionOptions } = await env.DB.prepare(
      'SELECT id, question_id, text, weight FROM question_options ORDER BY weight ASC'
    ).all();

    const optsByQuestion = {};
    for (const opt of questionOptions) {
      if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = [];
      optsByQuestion[opt.question_id].push(opt);
    }
    const questionsWithOptions = questions.map(q => ({ ...q, options: optsByQuestion[q.id] || [] }));

    return new Response(
      JSON.stringify({ success: true, stats, scoreBuckets, dailyTrend, responses, questions: questionsWithOptions }, null, 2),
      { status: 200, headers: cors }
    );

  } catch (error) {
    logSecurityEvent('ADMIN_ERROR', { ip, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch data', details: error.message }),
      { status: 500, headers: cors }
    );
  }
}
