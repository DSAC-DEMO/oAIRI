// Protected Admin API to view all responses
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
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      const decoded = atob(token);
      if (!decoded.startsWith('admin:')) throw new Error('Invalid token');
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // All responses
    const { results } = await env.DB.prepare(`
      SELECT id, readiness_level, total_score, score_pct, submitted_at,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        q11, q12, q13, q14, q15, q16, q17, q18, q19, q20
      FROM responses ORDER BY submitted_at DESC
    `).all();

    // Overall stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_responses,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score,
        COUNT(CASE WHEN readiness_level = 'Expert Ready' THEN 1 END) as expert_count,
        COUNT(CASE WHEN readiness_level = 'Advanced Ready' THEN 1 END) as advanced_count,
        COUNT(CASE WHEN readiness_level = 'Moderately Ready' THEN 1 END) as moderate_count,
        COUNT(CASE WHEN readiness_level = 'Developing' THEN 1 END) as developing_count,
        COUNT(CASE WHEN readiness_level = 'Novice' THEN 1 END) as novice_count
      FROM responses
    `).first();

    // Per-question average scores (to identify hardest/easiest scenarios)
    const questionAvgs = await env.DB.prepare(`
      SELECT
        AVG(q1) as q1, AVG(q2) as q2, AVG(q3) as q3, AVG(q4) as q4, AVG(q5) as q5,
        AVG(q6) as q6, AVG(q7) as q7, AVG(q8) as q8, AVG(q9) as q9, AVG(q10) as q10,
        AVG(q11) as q11, AVG(q12) as q12, AVG(q13) as q13, AVG(q14) as q14, AVG(q15) as q15,
        AVG(q16) as q16, AVG(q17) as q17, AVG(q18) as q18, AVG(q19) as q19, AVG(q20) as q20
      FROM responses
    `).first();

    // Submissions per day (last 30 days)
    const { results: dailyTrend } = await env.DB.prepare(`
      SELECT
        DATE(submitted_at) as date,
        COUNT(*) as count
      FROM responses
      WHERE submitted_at >= DATE('now', '-30 days')
      GROUP BY DATE(submitted_at)
      ORDER BY date ASC
    `).all();

    // Score distribution buckets
    const { results: scoreBuckets } = await env.DB.prepare(`
      SELECT
        CASE
          WHEN total_score >= 85 THEN '85-100'
          WHEN total_score >= 70 THEN '70-84'
          WHEN total_score >= 55 THEN '55-69'
          WHEN total_score >= 40 THEN '40-54'
          ELSE '20-39'
        END as bucket,
        COUNT(*) as count
      FROM responses
      GROUP BY bucket
      ORDER BY bucket DESC
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        questionAvgs,
        dailyTrend,
        scoreBuckets,
        responses: results
      }, null, 2),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error fetching responses:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch responses', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
