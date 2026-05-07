import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import RadarChart from '../components/RadarChart';

const LEVEL_ENCOURAGEMENT = [
  {
    headline: 'Outstanding work — you are leading the way!',
    body: "You've demonstrated exceptional readiness across the board. You bring the kind of strategic thinking and composed decision-making that sets great leaders apart. Keep pushing the frontier — the programmes below are tailored to help you stay at the cutting edge.",
  },
  {
    headline: 'Impressive results — you are well ahead of the curve!',
    body: "You consistently show strong judgement and a proactive mindset. With a little more focused development, you'll be operating at the highest level. The resources below will help you close that final gap.",
  },
  {
    headline: 'Great progress — you are on a solid path forward!',
    body: "You've built a meaningful foundation and show real potential. With targeted learning and practice, you'll be moving up quickly. Check out the recommended programmes below to accelerate your growth.",
  },
  {
    headline: 'Good start — every expert began exactly where you are!',
    body: "You're building your skills and that takes courage. The gap between where you are and where you want to be is absolutely closeable — the right learning will get you there faster than you think. Start with the programmes below.",
  },
  {
    headline: 'Welcome to the journey — the best time to start is now!',
    body: "Everyone begins somewhere, and you've already taken the most important step by completing this assessment. The programmes below are designed to give you a strong launchpad — dive in and you'll be amazed how quickly things click.",
  },
];

const OPTION_LEVEL_COLORS = ['red', 'orange', 'yellow', 'green', 'emerald'];

function getCompetencyIndex(score) {
  if (score >= 4.375) return 4;
  if (score >= 3.125) return 3;
  if (score >= 1.875) return 2;
  if (score >= 0.625) return 1;
  return 0;
}

const LEVEL_STYLES = {
  emerald: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'text-emerald-600' },
  green:   { badge: 'bg-green-100 text-green-800 border-green-300',       icon: 'text-green-600'   },
  yellow:  { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',    icon: 'text-yellow-600'  },
  orange:  { badge: 'bg-orange-100 text-orange-800 border-orange-300',    icon: 'text-orange-600'  },
  red:     { badge: 'bg-red-100 text-red-800 border-red-300',             icon: 'text-red-600'     },
};


function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { readinessData } = location.state || {};
  const [optionLevels, setOptionLevels] = useState(['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst']);
  const [courses, setCourses] = useState([]);
  const [readinessLevels, setReadinessLevels] = useState([
    { name: 'Expert Ready',     persona: 'Disciplined' },
    { name: 'Advanced Ready',   persona: 'Crafter'     },
    { name: 'Moderately Ready', persona: 'Explorer'    },
    { name: 'Developing',       persona: 'Learner'     },
    { name: 'Novice',           persona: 'Observer'    },
  ]);

  useEffect(() => {
    if (!readinessData) { navigate('/'); return; }
    fetch('/api/questions')
      .then(r => r.json())
      .then(d => {
        if (d.levels?.length === 5) setOptionLevels(d.levels);
        if (Array.isArray(d.courses)) setCourses(d.courses);
        if (Array.isArray(d.readinessLevels) && d.readinessLevels.length === 5) setReadinessLevels(d.readinessLevels);
      })
      .catch(() => {});
  }, [readinessData, navigate]);

  if (!readinessData) return null;

  const { label, persona, description, color, pillarScores, overallMean } = readinessData;

  function competencyBadge(avg) {
    const i = getCompetencyIndex(avg ?? 0);
    const s = LEVEL_STYLES[OPTION_LEVEL_COLORS[i]] || LEVEL_STYLES.yellow;
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.badge} w-28 text-center flex-shrink-0`}>{optionLevels[i]}</span>;
  }
  const styles = LEVEL_STYLES[color] || LEVEL_STYLES.yellow;

  const pillarEntries = pillarScores ? Object.entries(pillarScores) : [];
  const radarPillars  = pillarEntries.map(([name, { pct }]) => ({ name, pct: pct ?? 0 }));

  // Level position: Expert=5, Advanced=4, Moderate=3, Developing=2, Novice=1
  const levelIdx      = (overallMean ?? 0) >= 4 ? 0 : (overallMean ?? 0) >= 3 ? 1 : (overallMean ?? 0) >= 2 ? 2 : (overallMean ?? 0) >= 1 ? 3 : 4;
  const levelPosition = 5 - levelIdx;


  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Overall score ─────────────────────────────────────────── */}
        <div className={`rounded-xl shadow-sm border p-8 text-center ${styles.badge}`}>
          <p className="text-xs font-bold uppercase tracking-widest mb-5 opacity-60">Overall AI Readiness</p>

          {/* Level fraction */}
          <div className="flex items-baseline justify-center gap-2 mb-3">
            <span className="text-8xl font-black leading-none tabular-nums">{levelPosition}</span>
            <span className="text-3xl font-bold opacity-40">/ 5</span>
          </div>

          <p className="text-xl font-bold">{label}</p>
          {persona && <p className="text-sm font-medium opacity-70 mt-1">{persona}</p>}
          <p className="text-xs opacity-40 mt-3 tabular-nums">Raw score: {(overallMean ?? 0).toFixed(2)} / 5.00</p>
        </div>

        {/* ── Radar chart ──────────────────────────────────────────── */}
        {radarPillars.length >= 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Competency Profile</p>
            <RadarChart pillars={radarPillars} size={280} />
          </div>
        )}

        {/* ── Pillar breakdown ─────────────────────────────────────── */}
        {pillarEntries.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Score by Pillar</p>
            <div className="space-y-3">
              {pillarEntries.map(([pillar, { avg }]) => (
                <div key={pillar} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 flex-1 font-medium">{pillar}</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums w-14 text-right">
                    {(avg ?? 0).toFixed(2)}<span className="text-xs font-normal text-gray-400"> / 5</span>
                  </span>
                  {competencyBadge(avg)}
                </div>
              ))}

              {/* Overall row */}
              <div className="border-t-2 border-gray-200 mt-2 pt-4 flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-base font-bold block">Overall</span>
                  {persona && <span className={`text-xs font-semibold ${styles.icon}`}>{persona}</span>}
                </div>
                <span className="text-2xl font-bold tabular-nums text-gray-900">
                  {(overallMean ?? 0).toFixed(2)}<span className="text-sm font-normal text-gray-400"> / 5</span>
                </span>
                {competencyBadge(overallMean)}
              </div>
            </div>
          </div>
        )}

        {/* ── Encouragement + Recommended courses ──────────────────── */}
        {(() => {
          const relevant = courses.filter(c => Array.isArray(c.levels) && c.levels.includes(levelIdx));
          const encouragement = LEVEL_ENCOURAGEMENT[levelIdx] ?? LEVEL_ENCOURAGEMENT[4];
          return (
            <div className={`rounded-xl border p-8 ${styles.badge}`}>
              <p className="text-lg font-bold mb-2">{encouragement.headline}</p>
              <p className="text-sm leading-relaxed opacity-80">{encouragement.body}</p>
            </div>
          );
        })()}

        {(() => {
          const relevant = courses.filter(c => Array.isArray(c.levels) && c.levels.includes(levelIdx));
          if (relevant.length === 0) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Recommended Programmes &amp; Training</h2>
              <p className="text-gray-500 text-sm mb-5">
                Curated for your readiness level — explore these to keep growing.
              </p>
              <ul className="space-y-4">
                {relevant.map((course, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className={`mt-0.5 font-bold flex-shrink-0 text-lg ${styles.icon}`}>→</span>
                    <div>
                      <p className="text-gray-800 font-semibold">{course.name}</p>
                      {course.description && <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">{course.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* ── Retake ───────────────────────────────────────────────── */}
        <div className="text-center pb-4">
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-10 rounded-lg transition-colors shadow-md"
          >
            Retake Assessment
          </button>
        </div>

      </div>
    </div>
  );
}

export default ResultsPage;
