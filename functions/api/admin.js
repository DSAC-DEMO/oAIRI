// Protected Admin API to view all responses and questions
export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No token provided' }), { status: 401, headers: corsHeaders });
    }
    try {
      if (!atob(token).startsWith('admin:')) throw new Error();
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Overall stats
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

    // Score distribution buckets (percentage-based)
    const { results: scoreBuckets } = await env.DB.prepare(`
      SELECT
        CASE
          WHEN score_pct >= 85 THEN '85-100'
          WHEN score_pct >= 70 THEN '70-84'
          WHEN score_pct >= 55 THEN '55-69'
          WHEN score_pct >= 40 THEN '40-54'
          ELSE '0-39'
        END as bucket,
        COUNT(*) as count
      FROM responses
      GROUP BY bucket
      ORDER BY bucket DESC
    `).all();

    // Submissions per day (last 30 days)
    const { results: dailyTrend } = await env.DB.prepare(`
      SELECT DATE(submitted_at) as date, COUNT(*) as count
      FROM responses
      WHERE submitted_at >= DATE('now', '-30 days')
      GROUP BY DATE(submitted_at)
      ORDER BY date ASC
    `).all();

    // All responses
    const { results: responses } = await env.DB.prepare(
      'SELECT id, readiness_level, total_score, score_pct, answers_json, submitted_at FROM responses ORDER BY submitted_at DESC'
    ).all();

    // Questions with options (for admin page question management + per-question analytics)
    const { results: questions } = await env.DB.prepare(
      'SELECT id, category, scenario, question, order_num FROM questions ORDER BY order_num ASC, id ASC'
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
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error fetching admin data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch data', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
