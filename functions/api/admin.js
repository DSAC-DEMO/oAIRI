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
        COUNT(CASE WHEN score_pct >= 4 THEN 1 END) as expert_count,
        COUNT(CASE WHEN score_pct >= 3 AND score_pct < 4 THEN 1 END) as advanced_count,
        COUNT(CASE WHEN score_pct >= 2 AND score_pct < 3 THEN 1 END) as moderate_count,
        COUNT(CASE WHEN score_pct >= 1 AND score_pct < 2 THEN 1 END) as developing_count,
        COUNT(CASE WHEN score_pct < 1 THEN 1 END) as novice_count
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
      'SELECT id, category, question, dimension, q_id, order_num FROM questions ORDER BY order_num ASC, id ASC'
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

    const levelsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'option_levels'"
    ).first();
    const levels = levelsRow ? JSON.parse(levelsRow.value) : ['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst'];

    const rlRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'readiness_levels'"
    ).first();
    const readinessLevels = rlRow ? JSON.parse(rlRow.value) : ['Expert Ready', 'Advanced Ready', 'Moderately Ready', 'Developing', 'Novice'];

    const companiesRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'companies'"
    ).first();
    const companies = companiesRow ? JSON.parse(companiesRow.value) : [];

    const coursesRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'courses'"
    ).first();
    const courses = coursesRow ? JSON.parse(coursesRow.value) : [];

    const { results: sessions } = await env.DB.prepare(`
      SELECT s.id, s.name, s.created_at, COUNT(r.id) AS response_count
      FROM sessions s
      LEFT JOIN responses r ON r.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();

    return new Response(
      JSON.stringify({ success: true, stats, scoreBuckets, dailyTrend, responses, questions: questionsWithOptions, levels, readinessLevels, companies, sessions, courses }, null, 2),
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
