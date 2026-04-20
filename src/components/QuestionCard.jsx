function QuestionCard({ scenario, value, onChange }) {
  const { id, question, options } = scenario;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow-md mb-5 border border-gray-200">
      <h3 className="text-base font-semibold text-gray-900 mb-4 leading-snug">
        {question}
      </h3>

      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
              value === option.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name={`scenario${id}`}
              value={option.id}
              checked={value === option.id}
              onChange={(e) => onChange(id, e.target.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 mt-0.5 flex-shrink-0"
            />
            <span className="ml-2.5 text-sm text-gray-900 leading-snug">
              {option.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default QuestionCard;
