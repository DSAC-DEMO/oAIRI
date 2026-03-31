// Scenario data with weights (duplicated here for Worker context) - 20 scenarios
const scenarios = [
  { id: 1, options: [{ id: 'a', weight: 3 }, { id: 'b', weight: 5 }, { id: 'c', weight: 1 }, { id: 'd', weight: 2 }, { id: 'e', weight: 4 }] },
  { id: 2, options: [{ id: 'a', weight: 2 }, { id: 'b', weight: 5 }, { id: 'c', weight: 1 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 3, options: [{ id: 'a', weight: 2 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 1 }, { id: 'e', weight: 4 }] },
  { id: 4, options: [{ id: 'a', weight: 3 }, { id: 'b', weight: 4 }, { id: 'c', weight: 5 }, { id: 'd', weight: 2 }, { id: 'e', weight: 1 }] },
  { id: 5, options: [{ id: 'a', weight: 2 }, { id: 'b', weight: 5 }, { id: 'c', weight: 1 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 6, options: [{ id: 'a', weight: 3 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 1 }, { id: 'e', weight: 4 }] },
  { id: 7, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 2 }, { id: 'e', weight: 4 }] },
  { id: 8, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 4 }, { id: 'e', weight: 3 }] },
  { id: 9, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 2 }, { id: 'e', weight: 4 }] },
  { id: 10, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 11, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 12, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 4 }, { id: 'e', weight: 2 }] },
  { id: 13, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 14, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 4 }, { id: 'e', weight: 2 }] },
  { id: 15, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 16, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 3 }, { id: 'd', weight: 2 }, { id: 'e', weight: 4 }] },
  { id: 17, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 4 }, { id: 'e', weight: 3 }] },
  { id: 18, options: [{ id: 'a', weight: 2 }, { id: 'b', weight: 5 }, { id: 'c', weight: 1 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 19, options: [{ id: 'a', weight: 1 }, { id: 'b', weight: 5 }, { id: 'c', weight: 2 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] },
  { id: 20, options: [{ id: 'a', weight: 2 }, { id: 'b', weight: 5 }, { id: 'c', weight: 1 }, { id: 'd', weight: 3 }, { id: 'e', weight: 4 }] }
];

function getReadinessLevel(totalScore) {
  const levels = [
    { min: 85, max: 100, label: 'Expert Ready', description: 'Demonstrates exceptional decision-making and readiness across all scenarios', color: 'emerald' },
    { min: 70, max: 84, label: 'Advanced Ready', description: 'Shows strong readiness with consistent good judgment', color: 'green' },
    { min: 55, max: 69, label: 'Moderately Ready', description: 'Displays adequate readiness with room for development', color: 'yellow' },
    { min: 40, max: 54, label: 'Developing', description: 'Shows basic readiness but needs significant improvement', color: 'orange' },
    { min: 20, max: 39, label: 'Novice', description: 'Limited readiness; requires substantial training and support', color: 'red' }
  ];

  for (const level of levels) {
    if (totalScore >= level.min && totalScore <= level.max) {
      return {
        label: level.label,
        description: level.description,
        color: level.color,
        score: totalScore,
        percentage: Math.round((totalScore / 100) * 100)
      };
    }
  }

  return null;
}

// Auto-initialize database table (for local development)
async function ensureTableExists(db) {
  try {
    // Create table only if it doesn't exist (preserves data)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        q1 INTEGER NOT NULL CHECK (q1 BETWEEN 1 AND 5),
        q2 INTEGER NOT NULL CHECK (q2 BETWEEN 1 AND 5),
        q3 INTEGER NOT NULL CHECK (q3 BETWEEN 1 AND 5),
        q4 INTEGER NOT NULL CHECK (q4 BETWEEN 1 AND 5),
        q5 INTEGER NOT NULL CHECK (q5 BETWEEN 1 AND 5),
        q6 INTEGER NOT NULL CHECK (q6 BETWEEN 1 AND 5),
        q7 INTEGER NOT NULL CHECK (q7 BETWEEN 1 AND 5),
        q8 INTEGER NOT NULL CHECK (q8 BETWEEN 1 AND 5),
        q9 INTEGER NOT NULL CHECK (q9 BETWEEN 1 AND 5),
        q10 INTEGER NOT NULL CHECK (q10 BETWEEN 1 AND 5),
        q11 INTEGER NOT NULL CHECK (q11 BETWEEN 1 AND 5),
        q12 INTEGER NOT NULL CHECK (q12 BETWEEN 1 AND 5),
        q13 INTEGER NOT NULL CHECK (q13 BETWEEN 1 AND 5),
        q14 INTEGER NOT NULL CHECK (q14 BETWEEN 1 AND 5),
        q15 INTEGER NOT NULL CHECK (q15 BETWEEN 1 AND 5),
        q16 INTEGER NOT NULL CHECK (q16 BETWEEN 1 AND 5),
        q17 INTEGER NOT NULL CHECK (q17 BETWEEN 1 AND 5),
        q18 INTEGER NOT NULL CHECK (q18 BETWEEN 1 AND 5),
        q19 INTEGER NOT NULL CHECK (q19 BETWEEN 1 AND 5),
        q20 INTEGER NOT NULL CHECK (q20 BETWEEN 1 AND 5),
        total_score INTEGER NOT NULL,
        score_pct REAL NOT NULL,
        readiness_level TEXT NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (error) {
    console.error('Error ensuring table exists:', error);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Enable CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ensure table exists (for local development)
    await ensureTableExists(env.DB);
    // Parse request body - expecting { answers: { 1: 'a', 2: 'b', ... } }
    const { answers } = await request.json();

    // Validation
    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Answers must be an object with scenario IDs as keys' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate we have exactly 20 answers
    const answerKeys = Object.keys(answers);
    if (answerKeys.length !== 20) {
      return new Response(
        JSON.stringify({ error: 'Must provide answers for all 20 scenarios' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Map answers to scores and validate
    const scores = [];
    for (let i = 1; i <= 20; i++) {
      const scenarioId = i;
      const optionId = answers[scenarioId];

      if (!optionId) {
        return new Response(
          JSON.stringify({ error: `Missing answer for scenario ${scenarioId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Find the scenario and option
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario) {
        return new Response(
          JSON.stringify({ error: `Invalid scenario ID: ${scenarioId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      const option = scenario.options.find(o => o.id === optionId);
      if (!option) {
        return new Response(
          JSON.stringify({ error: `Invalid option '${optionId}' for scenario ${scenarioId}` }),
          { status: 400, headers: corsHeaders }
        );
      }

      scores.push(option.weight);
    }

    // Calculate total score
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    // Get readiness level
    const readinessData = getReadinessLevel(totalScore);

    if (!readinessData) {
      return new Response(
        JSON.stringify({ error: 'Unable to calculate readiness level' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Insert into D1 database
    const stmt = env.DB.prepare(`
      INSERT INTO responses (
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
        total_score, score_pct, readiness_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      scores[0], scores[1], scores[2], scores[3], scores[4],
      scores[5], scores[6], scores[7], scores[8], scores[9],
      scores[10], scores[11], scores[12], scores[13], scores[14],
      scores[15], scores[16], scores[17], scores[18], scores[19],
      totalScore,
      readinessData.percentage,
      readinessData.label
    ).run();

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        readinessData
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error processing assessment submission:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
