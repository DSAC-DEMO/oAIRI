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
    // Check for authorization token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify token (basic check - in production use proper JWT verification)
    try {
      const decoded = atob(token);
      if (!decoded.startsWith('admin:')) {
        throw new Error('Invalid token');
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get all responses
    const { results } = await env.DB.prepare(`
      SELECT
        id,
        readiness_level,
        total_score,
        score_pct,
        submitted_at,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        q11, q12, q13, q14, q15, q16, q17, q18, q19, q20
      FROM responses
      ORDER BY submitted_at DESC
    `).all();

    // Get statistics
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

    return new Response(
      JSON.stringify({
        success: true,
        stats,
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
