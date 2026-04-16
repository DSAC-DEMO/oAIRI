import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import RadarChart from '../components/RadarChart';

// ── Update these URLs when SP confirms the programme links ──────────────────
const LINKS = {
  aiap:       'https://www.sp.edu.sg',   // AI Apprenticeship Programme (AIAP®)
  fieldGuide: 'https://www.sp.edu.sg',   // AIAP Field Guide
  pastYears:  'https://www.sp.edu.sg',   // AIAP Technical Assessment Past Years Series
  aiip:       'https://www.sp.edu.sg',   // AI Internship Programme (AIIP)
};

const LEVEL_STYLES = {
  emerald: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'text-emerald-600' },
  green:   { badge: 'bg-green-100 text-green-800 border-green-300',       icon: 'text-green-600'   },
  yellow:  { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',    icon: 'text-yellow-600'  },
  orange:  { badge: 'bg-orange-100 text-orange-800 border-orange-300',    icon: 'text-orange-600'  },
  red:     { badge: 'bg-red-100 text-red-800 border-red-300',             icon: 'text-red-600'     },
};

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline font-medium"
    >
      {children}
    </a>
  );
}

function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { readinessData } = location.state || {};

  useEffect(() => {
    if (!readinessData) navigate('/');
  }, [readinessData, navigate]);

  if (!readinessData) return null;

  const { label, description, color, pillarScores, overallMean } = readinessData;
  const styles = LEVEL_STYLES[color] || LEVEL_STYLES.yellow;

  const radarPillars = pillarScores
    ? Object.entries(pillarScores).map(([name, { pct }]) => ({ name, pct }))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Result badge ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Assessment Result</p>
          <div className={`inline-block px-6 py-3 rounded-full border-2 text-2xl font-bold mb-3 ${styles.badge}`}>
            {label}
          </div>
          {overallMean !== undefined && (
            <p className={`text-4xl font-bold mb-2 ${styles.icon}`}>
              {overallMean.toFixed(2)} <span className="text-lg font-normal text-gray-400">/ 5.00</span>
            </p>
          )}
          <p className="text-gray-600 text-base max-w-xl mx-auto">{description}</p>
        </div>

        {/* ── Radar chart ──────────────────────────────────────────── */}
        {radarPillars.length >= 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Competency Profile</p>
            <RadarChart pillars={radarPillars} size={280} />
          </div>
        )}

        {/* ── Main recommendation card ──────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Your Path to Becoming a Professional AI Engineer 🏆
          </h1>
          <p className="text-gray-700 leading-relaxed">
            Your profile indicates you have the foundational skills and drive to excel in a deep-tech career.
            The <ExternalLink href={LINKS.aiap}>AI Apprenticeship Programme (AIAP®)</ExternalLink> by Singapore
            Poly (SP) is designed for individuals like you — talented, ambitious, and ready to take on real-world
            challenges. This is your direct path to becoming a certified AI Engineer.
          </p>
        </div>

        {/* ── AIAP Programme ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            The <ExternalLink href={LINKS.aiap}>AIAP®</ExternalLink>: A Rigorous, Hands-On Programme
          </h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            This is a highly competitive, full-time programme for Singapore Citizens. The programme is structured
            into two main phases, with both a 6-month and a 9-month track available.
          </p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="font-semibold text-gray-900">Phase 1: Deep-Skilling (3 Months)</p>
                <p className="text-gray-600 text-sm leading-relaxed mt-0.5">
                  An intensive training period covering key areas such as AI, software engineering, and MLOps.
                  The curriculum is delivered through a project-based, self-directed learning approach with
                  mentor-facilitated discussions.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="font-semibold text-gray-900">Phase 2: Project Phase (3 or 6 Months)</p>
                <p className="text-gray-600 text-sm leading-relaxed mt-0.5">
                  You will work on a real-world AI project for an industry partner, applying the end-to-end
                  machine learning lifecycle. This is where you will go beyond a Jupyter Notebook and learn
                  to deploy real-world AI systems.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Proficiency Test ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            The AIAP® Proficiency Test: Are You Ready?
          </h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            Admission is rigorous and highly selective, with only a small percentage of total applicants passing
            the technical assessment to proceed to the interview. The two-stage selection process assesses your
            technical skills and readiness for the programme.
          </p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="font-semibold text-gray-900">Stage 1: Technical Assessment</p>
                <p className="text-gray-600 text-sm leading-relaxed mt-0.5">
                  A 6-day take-home assignment where you will perform exploratory data analysis (EDA) and
                  build an end-to-end machine learning pipeline on a provided problem statement and dataset.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="font-semibold text-gray-900">Stage 2: Physical Interview</p>
                <p className="text-gray-600 text-sm leading-relaxed mt-0.5">
                  If you are shortlisted, this stage involves a technical interview where you present your
                  submission and a collaborative group case study.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Next Steps ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your Next Step: Prepare and Apply</h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            To give yourself the best chance, you can use the following resources to prepare for the programme:
          </p>

          <ul className="space-y-3">
            <li className="flex gap-3 items-start">
              <span className="text-blue-600 mt-0.5">→</span>
              <div>
                <ExternalLink href={LINKS.fieldGuide}>AIAP Field Guide</ExternalLink>
                <p className="text-gray-600 text-sm mt-0.5">
                  This guide provides a self-directed learning roadmap and curated online resources to help
                  you gain the necessary foundational knowledge.
                </p>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-blue-600 mt-0.5">→</span>
              <div>
                <ExternalLink href={LINKS.pastYears}>AIAP Technical Assessment Past Years Series</ExternalLink>
                <p className="text-gray-600 text-sm mt-0.5">
                  A public repository that contains past assessments, allowing you to practise and hone your skills.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* ── AIIP ─────────────────────────────────────────────────── */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            <ExternalLink href={LINKS.aiip}>AI Internship Programme (AIIP)</ExternalLink>
          </h2>
          <p className="text-gray-700 leading-relaxed">
            For undergraduates looking to gain practical experience, the{' '}
            <ExternalLink href={LINKS.aiip}>AI Internship Programme (AIIP)</ExternalLink> is an excellent entry
            point. This is a 3- to 6-month on-site programme designed to groom the next generation of AI talent
            in Singapore. Interns undergo a deep-skilling phase before working on a real-world AI project for
            a collaborating company.
          </p>
        </div>

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
