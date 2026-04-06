// Admin CRUD for questions and their options
function verifyAuth(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return false;
  try {
    return atob(token).startsWith('admin:');
  } catch {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!verifyAuth(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { action } = body;

  try {
    // ── Create ────────────────────────────────────────────────────
    if (action === 'create') {
      const { category, scenario, question, options } = body;

      if (!category || !scenario || !question || !Array.isArray(options) || options.length < 2) {
        return new Response(
          JSON.stringify({ error: 'category, scenario, question, and at least 2 options are required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { meta } = await env.DB.prepare(
        `INSERT INTO questions (category, scenario, question, order_num)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(order_num), 0) + 1 FROM questions))`
      ).bind(category.trim(), scenario.trim(), question.trim()).run();

      const questionId = meta.last_row_id;

      for (const opt of options) {
        await env.DB.prepare(
          'INSERT INTO question_options (question_id, text, weight) VALUES (?, ?, ?)'
        ).bind(questionId, opt.text.trim(), parseInt(opt.weight)).run();
      }

      return new Response(
        JSON.stringify({ success: true, id: questionId }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Update ────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, category, scenario, question, options } = body;

      if (!id || !category || !scenario || !question || !Array.isArray(options) || options.length < 2) {
        return new Response(
          JSON.stringify({ error: 'id, category, scenario, question, and at least 2 options are required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      await env.DB.prepare(
        'UPDATE questions SET category=?, scenario=?, question=? WHERE id=?'
      ).bind(category.trim(), scenario.trim(), question.trim(), id).run();

      await env.DB.prepare(
        'DELETE FROM question_options WHERE question_id=?'
      ).bind(id).run();

      for (const opt of options) {
        await env.DB.prepare(
          'INSERT INTO question_options (question_id, text, weight) VALUES (?, ?, ?)'
        ).bind(id, opt.text.trim(), parseInt(opt.weight)).run();
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Delete ────────────────────────────────────────────────────
    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      await env.DB.prepare('DELETE FROM question_options WHERE question_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM questions WHERE id=?').bind(id).run();

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
