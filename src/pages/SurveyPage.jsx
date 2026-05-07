import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import ProgressBar from '../components/ProgressBar';

function SurveyPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState('');
  const [currentPillarIndex, setCurrentPillarIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Company code verification
  const [codeInput, setCodeInput] = useState('');
  const [verifiedCompany, setVerifiedCompany] = useState(null); // null | { id, name }
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error('Failed to load questions');
        setQuestions(data.questions);
        if (data.levels) setLevels(data.levels);
      })
      .catch(err => setQuestionsError(err.message))
      .finally(() => setQuestionsLoading(false));
  }, []);

  // Group questions by category, preserving order of first appearance
  const pillars = useMemo(() => {
    const map = new Map();
    for (const q of questions) {
      if (!map.has(q.category)) map.set(q.category, []);
      map.get(q.category).push(q);
    }
    return Array.from(map.entries()).map(([name, qs]) => ({ name, questions: qs }));
  }, [questions]);

  const totalPillars = pillars.length;
  const currentPillar = pillars[currentPillarIndex] || { name: '', questions: [] };
  const currentPillarQuestions = currentPillar.questions;

  const handleAnswerChange = (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: parseInt(optionId) }));
  };

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === questions.length && questions.length > 0;
  const currentPillarAnswered = currentPillarQuestions.every(q => answers[q.id] !== undefined);

  const handleNext = () => {
    if (currentPillarIndex < totalPillars - 1) {
      setCurrentPillarIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentPillarIndex > 0) {
      setCurrentPillarIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isComplete) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          staffInfo: { isSPStaff: false, department: verifiedCompany?.name ?? '' },
          sessionId: verifiedCompany?.id ?? undefined,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit assessment');
      }

      const result = await response.json();
      navigate('/results', { state: { readinessData: result.readinessData } });
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit. Please try again.');
      setIsSubmitting(false);
    }
  };

  // ── Code verification pre-screen ──────────────────────────────────────────
  const verifyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeVerifying(true);
    setCodeError('');
    setVerifiedCompany(null);
    try {
      const res = await fetch('/api/session/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifiedCompany({ id: data.id, name: data.name });
      } else {
        setCodeError('Invalid code. Please check with your organisation.');
      }
    } catch {
      setCodeError('Could not verify code. Please try again.');
    } finally {
      setCodeVerifying(false);
    }
  };

  if (!verifiedCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Before you begin</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Enter your access code</h1>

          <p className="text-sm text-gray-600 mb-5">
            You need a valid access code provided by your organisation to start the assessment.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
              onKeyDown={e => e.key === 'Enter' && verifyCode()}
              placeholder="e.g. X7K2HPNB"
              autoFocus
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={!codeInput.trim() || codeVerifying}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0 transition-all ${
                codeInput.trim() && !codeVerifying
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {codeVerifying ? '…' : 'Verify'}
            </button>
          </div>
          {codeError && <p className="mt-1 text-xs text-red-500">{codeError}</p>}
        </div>
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading assessment...</p>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold mb-2">Failed to load assessment</p>
          <p className="text-gray-500">{questionsError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-lg">No questions available yet.</p>
      </div>
    );
  }

  const isLastPillar = currentPillarIndex === totalPillars - 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 sm:py-10 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Readiness Assessment
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
            Read each scenario carefully and select the action that best represents how you would respond.
          </p>
        </div>

        {/* Pillar progress steps */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 px-2 overflow-x-auto">
          {pillars.map((pillar, idx) => {
            const done = idx < currentPillarIndex;
            const active = idx === currentPillarIndex;
            return (
              <div key={pillar.name} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <div className={`flex flex-col items-center`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done   ? 'bg-blue-600 border-blue-600 text-white' :
                    active ? 'bg-white border-blue-600 text-blue-600' :
                             'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs mt-1 max-w-16 text-center leading-tight hidden sm:block ${
                    active ? 'text-blue-600 font-semibold' : done ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {pillar.name}
                  </span>
                </div>
                {idx < pillars.length - 1 && (
                  <div className={`h-0.5 w-6 sm:w-10 mt-0 sm:-mt-4 transition-all ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current pillar heading */}
        <div className="mb-5 px-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest whitespace-nowrap">
              Pillar {currentPillarIndex + 1} of {totalPillars} — {currentPillar.name}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {currentPillarQuestions.map((scenario) => (
            <QuestionCard
              key={scenario.id}
              scenario={scenario}
              value={answers[scenario.id]}
              onChange={handleAnswerChange}
              levels={levels}
            />
          ))}

          {submitError && (
            <div className="bg-red-50 border-l-4 border-red-600 text-red-700 px-6 py-4 rounded-lg mb-6">
              <p className="font-semibold">Error</p>
              <p>{submitError}</p>
            </div>
          )}

          {/* Sticky bottom bar */}
          <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-3 sm:p-4 shadow-lg rounded-t-lg">
            <ProgressBar answeredCount={answeredCount} totalQuestions={questions.length} />
            <div className="flex gap-2 sm:gap-3">
              {currentPillarIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-blue-600 bg-white border-2 border-blue-600 hover:bg-blue-50 transition-all"
                >
                  ← Previous
                </button>
              )}

              {!isLastPillar ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!currentPillarAnswered}
                  className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-white transition-all ${
                    currentPillarAnswered
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-md'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next Pillar →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!isComplete || isSubmitting}
                  className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-white transition-all ${
                    isComplete && !isSubmitting
                      ? 'bg-green-600 hover:bg-green-700 cursor-pointer shadow-md'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              )}
            </div>

            <div className="mt-2 sm:mt-3 text-center">
              {!isLastPillar && !currentPillarAnswered && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Answer all questions in this pillar to continue
                </p>
              )}
              {isLastPillar && !isComplete && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Answer all remaining questions to submit
                </p>
              )}
              {isComplete && (
                <p className="text-xs sm:text-sm text-green-600 font-semibold">
                  All questions answered! Ready to submit.
                </p>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SurveyPage;
