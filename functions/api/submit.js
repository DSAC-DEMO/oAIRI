function getReadinessLevel(scorePct) {
  const levels = [
    { min: 85, label: 'Expert Ready',     description: 'Demonstrates exceptional decision-making and readiness across all scenarios', color: 'emerald' },
    { min: 70, label: 'Advanced Ready',   description: 'Shows strong readiness with consistent good judgment',                        color: 'green'   },
    { min: 55, label: 'Moderately Ready', description: 'Displays adequate readiness with room for development',                       color: 'yellow'  },
    { min: 40, label: 'Developing',       description: 'Shows basic readiness but needs significant improvement',                     color: 'orange'  },
    { min: 0,  label: 'Novice',           description: 'Limited readiness; requires substantial training and support',                color: 'red'     },
  ];
  for (const level of levels) {
    if (scorePct >= level.min) return level;
  }
  return levels[levels.length - 1];
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { answers } = await request.json();

    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'answers must be an object' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch current questions + options from DB (2 queries)
    const { results: questions } = await env.DB.prepare(
      'SELECT id FROM questions ORDER BY order_num ASC, id ASC'
    ).all();

    const { results: options } = await env.DB.prepare(
      'SELECT id, question_id, weight FROM question_options'
    ).all();

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions found in database' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Build option lookup: optionId → weight
    const optionMap = {};
    const maxWeightByQuestion = {};
    for (const opt of options) {
      optionMap[opt.id] = { weight: opt.weight, questionId: opt.question_id };
      if (!maxWeightByQuestion[opt.question_id] || opt.weight > maxWeightByQuestion[opt.question_id]) {
        maxWeightByQuestion[opt.question_id] = opt.weight;
      }
    }

    // Validate all questions are answered
    const questionIds = questions.map(q => q.id);
    for (const qId of questionIds) {
      if (!answers[qId] && answers[qId] !== 0) {
        return new Response(
          JSON.stringify({ error: `Missing answer for question ${qId}` }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Calculate scores
    let totalScore = 0;
    let maxPossible = 0;
    const answersJson = {};

    for (const qId of questionIds) {
      const optionId = parseInt(answers[qId]);
      const opt = optionMap[optionId];

      if (!opt || opt.questionId !== qId) {
        return new Response(
          JSON.stringify({ error: `Invalid option ${optionId} for question ${qId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      answersJson[qId] = opt.weight;
      totalScore += opt.weight;
      maxPossible += maxWeightByQuestion[qId];
    }

    const scorePct = Math.round((totalScore / maxPossible) * 100);
    const readinessData = getReadinessLevel(scorePct);

    await env.DB.prepare(
      'INSERT INTO responses (answers_json, total_score, score_pct, readiness_level) VALUES (?, ?, ?, ?)'
    ).bind(
      JSON.stringify(answersJson),
      totalScore,
      scorePct,
      readinessData.label
    ).run();

    return new Response(
      JSON.stringify({ success: true, readinessData: { ...readinessData, score: totalScore, percentage: scorePct } }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error processing submission:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
