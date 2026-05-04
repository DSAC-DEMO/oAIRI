// Public endpoint — returns all questions with options ordered by weight ASC
export async function onRequestGet(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { results: questions } = await env.DB.prepare(
      'SELECT id, category, question, dimension, q_id, order_num FROM questions ORDER BY order_num ASC, id ASC'
    ).all();

    const { results: options } = await env.DB.prepare(
      'SELECT id, question_id, text, weight FROM question_options ORDER BY weight ASC'
    ).all();

    let levels = ['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst'];
    let readinessLevels = [
      { name: 'Expert Ready',     persona: 'Disciplined' },
      { name: 'Advanced Ready',   persona: 'Crafter'     },
      { name: 'Moderately Ready', persona: 'Explorer'    },
      { name: 'Developing',       persona: 'Learner'     },
      { name: 'Novice',           persona: 'Observer'    },
    ];
    let companies = [];
    let courses = [];
    try {
      const [levelsRow, rlRow, { results: sessionRows }, coursesRow] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'option_levels'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'readiness_levels'").first(),
        env.DB.prepare('SELECT id, name FROM sessions ORDER BY name ASC').all(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'courses'").first(),
      ]);
      if (levelsRow?.value) levels = JSON.parse(levelsRow.value);
      if (rlRow?.value) readinessLevels = JSON.parse(rlRow.value);
      companies = sessionRows;
      if (coursesRow?.value) courses = JSON.parse(coursesRow.value);
    } catch {}

    const optsByQuestion = {};
    for (const opt of options) {
      if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = [];
      optsByQuestion[opt.question_id].push(opt);
    }

    const result = questions.map(q => ({ ...q, options: optsByQuestion[q.id] || [] }));

    return new Response(
      JSON.stringify({ success: true, questions: result, levels, readinessLevels, companies, courses }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
