import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import ProgressBar from '../components/ProgressBar';
import Footer from '../components/Footer';

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

  // Registration label from settings
  const [registrationLabel, setRegistrationLabel] = useState('Company Name');

  // Company code verification
  const [codeInput, setCodeInput] = useState('');
  const [verifiedCompany, setVerifiedCompany] = useState(null); // null | { id, name }
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Pre-screen mode: 'code' | 'register'
  const [preScreenMode, setPreScreenMode] = useState('code');

  // Registration form
  const [regName, setRegName] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [registeredCode, setRegisteredCode] = useState(null); // shown after registration
  const [codeCopied, setCodeCopied] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error('Failed to load questions');
        setQuestions(data.questions);
        if (data.levels) setLevels(data.levels);
        if (data.registrationLabel) setRegistrationLabel(data.registrationLabel);
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

  // ── Company registration ──────────────────────────────────────────────────
  const registerCompany = async () => {
    const name = regName.trim();
    if (!name) return;
    setRegLoading(true);
    setRegError('');
    try {
      const res = await fetch('/api/session/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name }),
      });
      const data = await res.json();
      if (data.success) {
        setRegisteredCode({ id: data.id, name: data.name, code: data.code });
      } else {
        setRegError(data.error || 'Registration failed. Please try again.');
      }
    } catch {
      setRegError('Could not register. Please try again.');
    } finally {
      setRegLoading(false);
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
    // ── Post-registration: show code then let user proceed ──────────────────
    if (registeredCode) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-10">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-1">Registration successful</p>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{registeredCode.name}</h1>
            <p className="text-sm text-gray-500 mb-5">
              Your unique access code has been generated. Copy it and save it somewhere accessible — such as your phone's notes app or a document on your laptop. You will need this code to start the assessment and to view your company's dashboard later.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between mb-1">
              <span className="font-mono text-lg font-bold text-gray-800 tracking-widest">{registeredCode.code}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(registeredCode.code);
                  setCodeCopied(true);
                  setHasCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                className="text-xs text-green-600 font-semibold hover:text-green-700 ml-4 flex-shrink-0"
              >
                {codeCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-700">
                <span className="font-bold">Save this code before continuing.</span> Once you leave this page it cannot be recovered. Paste it in your notes app, email it to yourself, or screenshot this screen.
              </p>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {hasCopied ? 'Code copied — click Continue to proceed.' : 'Copy your code first before you can continue.'}
            </p>
            <button
              type="button"
              disabled={!hasCopied}
              onClick={() => {
                setCodeInput(registeredCode.code);
                setPreScreenMode('code');
                setRegisteredCode(null);
                setHasCopied(false);
              }}
              className={`w-full font-semibold py-3 rounded-lg transition-colors ${
                hasCopied ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue →
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-2">Before you begin</p>

          {/* Mode tabs */}
          <div className="flex border border-gray-200 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setPreScreenMode('code'); setCodeError(''); setRegError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${preScreenMode === 'code' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Enter Code
            </button>
            <button
              type="button"
              onClick={() => { setPreScreenMode('register'); setCodeError(''); setRegError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${preScreenMode === 'register' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Register Company
            </button>
          </div>

          {preScreenMode === 'code' ? (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Enter your access code</h1>
              <p className="text-sm text-gray-600 mb-5">
                Enter the access code that was provided to you to start the assessment.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {codeVerifying ? '…' : 'Verify'}
                </button>
              </div>
              {codeError && <p className="text-xs text-red-500">{codeError}</p>}
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Register your company</h1>
              <p className="text-sm text-gray-600 mb-5">
                Register your company to begin the assessment. An access code will be generated for your dashboard.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">{registrationLabel}</label>
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={regName}
                  onChange={e => { setRegName(e.target.value); setRegError(''); }}
                  onKeyDown={e => e.key === 'Enter' && registerCompany()}
                  placeholder={`Enter ${registrationLabel.toLowerCase()}`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={registerCompany}
                  disabled={!regName.trim() || regLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0 transition-all ${
                    regName.trim() && !regLoading
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {regLoading ? '…' : 'Register'}
                </button>
              </div>
              {regError && <p className="text-xs text-red-500">{regError}</p>}
            </>
          )}
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
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
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
                    done   ? 'bg-green-600 border-green-600 text-white' :
                    active ? 'bg-white border-green-600 text-green-600' :
                             'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs mt-1 max-w-16 text-center leading-tight hidden sm:block ${
                    active ? 'text-green-600 font-semibold' : done ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {pillar.name}
                  </span>
                </div>
                {idx < pillars.length - 1 && (
                  <div className={`h-0.5 w-6 sm:w-10 mt-0 sm:-mt-4 transition-all ${done ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current pillar heading */}
        <div className="mb-5 px-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-green-600 uppercase tracking-widest whitespace-nowrap">
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
          <div className="sticky bottom-11 bg-white border-t-2 border-gray-200 p-3 sm:p-4 shadow-lg rounded-t-lg">
            <ProgressBar answeredCount={answeredCount} totalQuestions={questions.length} />
            <div className="flex gap-2 sm:gap-3">
              {currentPillarIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-green-600 bg-white border-2 border-green-600 hover:bg-green-50 transition-all"
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
                      ? 'bg-green-600 hover:bg-green-700 cursor-pointer shadow-md'
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
      <Footer />
    </div>
  );
}

export default SurveyPage;
