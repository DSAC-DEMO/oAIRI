function ProgressBar({ answeredCount, totalQuestions }) {
  const percentage = (answeredCount / totalQuestions) * 100;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
        <span className="font-medium">Progress</span>
        <span>{answeredCount}/{totalQuestions}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
