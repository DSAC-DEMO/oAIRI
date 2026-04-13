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

    // Fetch questions (with category for pillar grouping) + options
    const { results: questions } = await env.DB.prepare(
      'SELECT id, category FROM questions ORDER BY order_num ASC, id ASC'
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

    // Build lookups
    const optionMap = {};          // optionId -> { weight, questionId }
    const maxWeightByQ = {};       // questionId -> max weight
    const minWeightByQ = {};       // questionId -> min weight
    const categoryByQ = {};        // questionId -> category

    for (const opt of options) {
      optionMap[opt.id] = { weight: parseFloat(opt.weight), questionId: opt.question_id };
      if (maxWeightByQ[opt.question_id] === undefined || opt.weight > maxWeightByQ[opt.question_id])
        maxWeightByQ[opt.question_id] = parseFloat(opt.weight);
      if (minWeightByQ[opt.question_id] === undefined || opt.weight < minWeightByQ[opt.question_id])
        minWeightByQ[opt.question_id] = parseFloat(opt.weight);
    }

    for (const q of questions) {
      categoryByQ[q.id] = q.category;
    }

    // Validate all questions answered
    const questionIds = questions.map(q => q.id);
    for (const qId of questionIds) {
      if (answers[qId] === undefined || answers[qId] === null) {
        return new Response(
          JSON.stringify({ error: `Missing answer for question ${qId}` }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Score calculation
    let totalScore  = 0;
    let maxPossible = 0;
    let minPossible = 0;
    const answersJson = {};

    // Pillar accumulators: category -> { sum, count, maxSum, minSum }
    const pillars = {};

    for (const qId of questionIds) {
      const optionId = parseInt(answers[qId]);
      const opt = optionMap[optionId];

      if (!opt || opt.questionId !== qId) {
        return new Response(
          JSON.stringify({ error: `Invalid option ${optionId} for question ${qId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      const score  = opt.weight;
      const maxW   = maxWeightByQ[qId];
      const minW   = minWeightByQ[qId];
      const cat    = categoryByQ[qId];

      answersJson[qId] = score;
      totalScore  += score;
      maxPossible += maxW;
      minPossible += minW;

      if (!pillars[cat]) pillars[cat] = { sum: 0, count: 0, maxSum: 0, minSum: 0 };
      pillars[cat].sum    += score;
      pillars[cat].count  += 1;
      pillars[cat].maxSum += maxW;
      pillars[cat].minSum += minW;
    }

    // Normalize overall score to 0-100 using min-max of actual weight range
    const scorePct = (maxPossible > minPossible)
      ? Math.round(((totalScore - minPossible) / (maxPossible - minPossible)) * 100)
      : 0;

    // Per-pillar average score (raw, e.g. 1.00–2.00) and normalized percentage
    const pillarScores = {};
    for (const [cat, { sum, count, maxSum, minSum }] of Object.entries(pillars)) {
      const avg = sum / count;
      const pct = (maxSum > minSum)
        ? Math.round(((sum - minSum) / (maxSum - minSum)) * 100)
        : 0;
      pillarScores[cat] = {
        avg: Math.round(avg * 100) / 100,  // e.g. 1.75
        pct                                 // 0-100
      };
    }

    const readinessData = getReadinessLevel(scorePct);

    await env.DB.prepare(
      'INSERT INTO responses (answers_json, total_score, score_pct, readiness_level) VALUES (?, ?, ?, ?)'
    ).bind(
      JSON.stringify(answersJson),
      Math.round(totalScore * 100) / 100,
      scorePct,
      readinessData.label
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        readinessData: {
          ...readinessData,
          score: Math.round(totalScore * 100) / 100,
          percentage: scorePct,
          pillarScores
        }
      }),
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
