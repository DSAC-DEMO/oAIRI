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
    let companies = [];
    try {
      const [levelsRow, companiesRow] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'option_levels'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'companies'").first(),
      ]);
      if (levelsRow?.value) levels = JSON.parse(levelsRow.value);
      if (companiesRow?.value) companies = JSON.parse(companiesRow.value);
    } catch {}

    const optsByQuestion = {};
    for (const opt of options) {
      if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = [];
      optsByQuestion[opt.question_id].push(opt);
    }

    const result = questions.map(q => ({ ...q, options: optsByQuestion[q.id] || [] }));

    return new Response(
      JSON.stringify({ success: true, questions: result, levels, companies }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
