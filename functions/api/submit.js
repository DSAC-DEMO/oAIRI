const DEFAULT_READINESS_LEVELS = [
  { name: 'Expert Ready',     persona: 'Disciplined' },
  { name: 'Advanced Ready',   persona: 'Crafter'     },
  { name: 'Moderately Ready', persona: 'Explorer'    },
  { name: 'Developing',       persona: 'Learner'     },
  { name: 'Novice',           persona: 'Observer'    },
];
const READINESS_DESCRIPTIONS = [
  'Demonstrates exceptional decision-making and readiness across all scenarios',
  'Shows strong readiness with consistent good judgment',
  'Displays adequate readiness with room for development',
  'Shows basic readiness but needs significant improvement',
  'Limited readiness; requires substantial training and support',
];
const READINESS_COLORS = ['emerald', 'green', 'yellow', 'orange', 'red'];

// levels: array of {name, persona} ordered highest→lowest
function getReadinessLevel(score, levels = DEFAULT_READINESS_LEVELS) {
  const i = score >= 4 ? 0 : score >= 3 ? 1 : score >= 2 ? 2 : score >= 1 ? 3 : 4;
  return { label: levels[i].name, persona: levels[i].persona, description: READINESS_DESCRIPTIONS[i], color: READINESS_COLORS[i] };
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
    const body = await request.json();
    const { answers, staffInfo } = body;

    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'answers must be an object' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load readiness level names from settings
    const rlRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'readiness_levels'"
    ).first();
    const readinessLevelNames = rlRow ? JSON.parse(rlRow.value) : DEFAULT_READINESS_LEVELS;

    // Fetch questions + options
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
    const optionMap  = {};   // optionId -> { weight, questionId }
    const categoryByQ = {};  // questionId -> category

    for (const opt of options) {
      optionMap[opt.id] = { weight: parseFloat(opt.weight), questionId: opt.question_id };
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
    let totalScore = 0;
    const answersJson = {};
    const pillars = {}; // category -> { sum, count }

    for (const qId of questionIds) {
      const optionId = parseInt(answers[qId]);
      const opt = optionMap[optionId];

      if (!opt || opt.questionId !== qId) {
        return new Response(
          JSON.stringify({ error: `Invalid option ${optionId} for question ${qId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      const score = opt.weight;
      const cat   = categoryByQ[qId];

      answersJson[qId] = score;
      totalScore += score;

      if (!pillars[cat]) pillars[cat] = { sum: 0, count: 0 };
      pillars[cat].sum   += score;
      pillars[cat].count += 1;
    }

    // Overall mean (mean of all individual question scores, 0-5)
    const overallMean = Math.round((totalScore / questionIds.length) * 100) / 100;

    // Per-pillar scores
    const pillarScores = {};
    for (const [cat, { sum, count }] of Object.entries(pillars)) {
      const avg = Math.round((sum / count) * 100) / 100;
      pillarScores[cat] = {
        avg,                                      // 0-5 raw, e.g. 3.25
        pct: Math.round((avg / 5) * 100),         // 0-100 for radar chart
        level: getReadinessLevel(avg, readinessLevelNames),
      };
    }

    const readinessData = getReadinessLevel(overallMean, readinessLevelNames);

    const isSPStaff  = staffInfo?.isSPStaff ? 1 : 0;
    const department = (staffInfo?.isSPStaff && staffInfo?.department) ? staffInfo.department.trim() : '';

    await env.DB.prepare(
      'INSERT INTO responses (answers_json, total_score, score_pct, readiness_level, is_sp_staff, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      JSON.stringify(answersJson),
      Math.round(totalScore * 100) / 100,
      overallMean,        // stored as raw 0-5 (column repurposed from %)
      readinessData.label,
      isSPStaff,
      department
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        readinessData: {
          ...readinessData,
          overallMean,
          pillarScores,
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: corsHeaders }
    );
  }
}
