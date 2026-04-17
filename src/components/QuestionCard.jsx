const LEVEL_COLORS = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-yellow-100 text-yellow-700',
  'bg-green-100 text-green-700',
  'bg-emerald-100 text-emerald-700',
];

function QuestionCard({ scenario, value, onChange, levels = [] }) {
  const { id, category, question, options } = scenario;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow-md mb-5 border border-gray-200">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
            {category}
          </span>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            Q{id}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-gray-900">
          {question}
        </h3>
      </div>

      <div className="space-y-2">
        {options.map((option, i) => (
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
            <div className="ml-2.5 flex-1">
              {levels[i] && (
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${LEVEL_COLORS[i]}`}>
                  {levels[i]}
                </span>
              )}
              <span className="text-sm text-gray-900 leading-snug block">
                {option.text}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default QuestionCard;
