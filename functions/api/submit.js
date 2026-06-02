const DEFAULT_OPTION_LEVELS = ['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst'];
const OPTION_LEVEL_COLORS   = ['red', 'orange', 'yellow', 'green', 'emerald'];

// Map a 0-5 avg score to the nearest option level index (0=Unaware … 4=Catalyst)
function getCompetencyIndex(score) {
  if (score >= 4.375) return 4;
  if (score >= 3.125) return 3;
  if (score >= 1.875) return 2;
  if (score >= 0.625) return 1;
  return 0;
}

const DEFAULT_READINESS_LEVELS = [
  { name: 'Expert Ready',     persona: 'Disciplined', description: 'Demonstrates exceptional AI readiness and leads others confidently.' },
  { name: 'Advanced Ready',   persona: 'Crafter',     description: 'Shows strong AI readiness with consistent good judgement.'           },
  { name: 'Moderately Ready', persona: 'Explorer',    description: 'Displays adequate AI readiness with room for development.'           },
  { name: 'Developing',       persona: 'Learner',     description: 'Shows foundational awareness but needs structured development.'      },
  { name: 'Novice',           persona: 'Observer',    description: 'Limited AI readiness; requires substantial training and support.'    },
];
const READINESS_COLORS = ['emerald', 'green', 'yellow', 'orange', 'red'];

// levels: array of {name, persona, description?} ordered highest→lowest
function getReadinessLevel(score, levels = DEFAULT_READINESS_LEVELS) {
  const i    = score >= 4 ? 0 : score >= 3 ? 1 : score >= 2 ? 2 : score >= 1 ? 3 : 4;
  const lvl  = levels[i] ?? DEFAULT_READINESS_LEVELS[i];
  const def  = DEFAULT_READINESS_LEVELS[i];
  return {
    label: lvl.name,
    persona: lvl.persona,
    description: lvl.description?.trim() || def.description,
    color: READINESS_COLORS[i],
  };
}

async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
    const { answers, staffInfo, sessionCode } = body;

    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'answers must be an object' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load level names and courses from settings
    let readinessLevelNames = DEFAULT_READINESS_LEVELS;
    let optionLevelNames = DEFAULT_OPTION_LEVELS;
    let courses = [];
    try {
      const [rlRow, olRow, cRow] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'readiness_levels'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'option_levels'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'courses'").first(),
      ]);
      if (rlRow?.value) readinessLevelNames = JSON.parse(rlRow.value);
      if (olRow?.value) optionLevelNames = JSON.parse(olRow.value);
      if (cRow?.value) courses = JSON.parse(cRow.value);
    } catch {}

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
    const optionMap  = {};
    const categoryByQ = {};

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

      const score = opt.weight;
      const cat   = categoryByQ[qId];

      answersJson[qId] = score;
      totalScore += score;

      if (!pillars[cat]) pillars[cat] = { sum: 0, count: 0 };
      pillars[cat].sum   += score;
      pillars[cat].count += 1;
    }

    const overallMean = Math.round((totalScore / questionIds.length) * 100) / 100;

    // Per-pillar scores
    const pillarScores = {};
    for (const [cat, { sum, count }] of Object.entries(pillars)) {
      const avg = Math.round((sum / count) * 100) / 100;
      const ci = getCompetencyIndex(avg);
      pillarScores[cat] = {
        avg,
        pct: Math.round((avg / 5) * 100),
        level: getReadinessLevel(avg, readinessLevelNames),
        competency: { label: optionLevelNames[ci] ?? DEFAULT_OPTION_LEVELS[ci], color: OPTION_LEVEL_COLORS[ci] },
      };
    }

    const overallCI = getCompetencyIndex(overallMean);
    const readinessData = {
      ...getReadinessLevel(overallMean, readinessLevelNames),
      competency: { label: optionLevelNames[overallCI] ?? DEFAULT_OPTION_LEVELS[overallCI], color: OPTION_LEVEL_COLORS[overallCI] },
    };

    // Determine which courses are recommended for this participant
    const levelIdx = overallMean >= 4 ? 0 : overallMean >= 3 ? 1 : overallMean >= 2 ? 2 : overallMean >= 1 ? 3 : 4;
    const recommendedCourses = [];
    for (const course of courses) {
      let matches = course.levels?.includes(levelIdx) ?? false;
      if (!matches && course.pillarConditions?.length) {
        matches = course.pillarConditions.some(pc => {
          const pScore = pillarScores[pc.pillar]?.avg;
          return pScore !== undefined && (pc.levels?.includes(getCompetencyIndex(pScore)) ?? false);
        });
      }
      if (matches) recommendedCourses.push(course.name);
    }

    const isSPStaff  = staffInfo?.isSPStaff ? 1 : 0;
    const department = staffInfo?.department?.trim() || '';

    // Resolve optional session → session_id
    let sessionId = null;
    if (body.sessionId && Number.isInteger(body.sessionId) && body.sessionId > 0) {
      try {
        const session = await env.DB.prepare(
          'SELECT id FROM sessions WHERE id = ?'
        ).bind(body.sessionId).first();
        if (session) sessionId = session.id;
      } catch {}
    } else if (sessionCode?.trim()) {
      try {
        const codeHash = await hashCode(sessionCode.trim());
        const session = await env.DB.prepare(
          'SELECT id FROM sessions WHERE code_hash = ?'
        ).bind(codeHash).first();
        if (session) sessionId = session.id;
      } catch {}
    }

    await env.DB.prepare(
      'INSERT INTO responses (answers_json, total_score, score_pct, readiness_level, recommended_courses, is_sp_staff, department, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      JSON.stringify(answersJson),
      Math.round(totalScore * 100) / 100 || 0,
      overallMean || 0,
      readinessData.label ?? 'Novice',
      JSON.stringify(recommendedCourses),
      isSPStaff,
      department,
      sessionId
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
