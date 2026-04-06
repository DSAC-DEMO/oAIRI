import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import ProgressBar from '../components/ProgressBar';

function SurveyPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error('Failed to load questions');
        setQuestions(data.questions);
      })
      .catch(err => setQuestionsError(err.message))
      .finally(() => setQuestionsLoading(false));
  }, []);

  const questionsPerPage = 10;
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const currentPageQuestions = questions.slice(startIndex, startIndex + questionsPerPage);

  const handleAnswerChange = (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: parseInt(optionId) }));
  };

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === questions.length && questions.length > 0;
  const currentPageAnswered = currentPageQuestions.every(q => answers[q.id] !== undefined);

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
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
        body: JSON.stringify({ answers })
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
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 sm:py-10 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">
            Readiness Assessment
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Read each scenario carefully and select the action that best represents how you would respond.
          </p>
          <div className="mt-3 text-xs sm:text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {currentPageQuestions.map((scenario) => (
            <QuestionCard
              key={scenario.id}
              scenario={scenario}
              value={answers[scenario.id]}
              onChange={handleAnswerChange}
            />
          ))}

          {submitError && (
            <div className="bg-red-50 border-l-4 border-red-600 text-red-700 px-6 py-4 rounded-lg mb-6">
              <p className="font-semibold">Error</p>
              <p>{submitError}</p>
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-3 sm:p-4 shadow-lg rounded-t-lg">
            <ProgressBar answeredCount={answeredCount} totalQuestions={questions.length} />
            <div className="flex gap-2 sm:gap-3">
              {currentPage > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-blue-600 bg-white border-2 border-blue-600 hover:bg-blue-50 transition-all"
                >
                  ← Previous
                </button>
              )}

              {currentPage < totalPages ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!currentPageAnswered}
                  className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base text-white transition-all ${
                    currentPageAnswered
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-md'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next →
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
              {currentPage < totalPages && !currentPageAnswered && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Please answer all questions on this page to continue
                </p>
              )}
              {currentPage === totalPages && !isComplete && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Please answer all {questions.length} scenarios to submit
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
