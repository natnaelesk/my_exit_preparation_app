import { SparklesIcon } from '@heroicons/react/24/outline';

const QuestionCard = ({ question, questionNumber, selectedAnswer, onAnswerSelect, onGrokClick }) => {
  if (!question) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <span className="text-primary-500 font-semibold">Question {questionNumber}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onGrokClick}
            className="p-2 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 transition-colors active:scale-95"
            title="Get AI explanation (marks question as wrong for learning)"
            aria-label="Grok AI Assistant"
          >
            <SparklesIcon className="w-5 h-5" />
          </button>
          <span className="text-xs text-text-secondary bg-surface px-2 py-1 rounded">
            {question.subject}
          </span>
        </div>
      </div>

      <div className="text-base md:text-lg text-text mb-4 leading-relaxed">
        {question.question}
      </div>

      {question.topic && (
        <div className="text-sm text-text-secondary italic mb-4">
          Topic: {question.topic}
        </div>
      )}

      <div className="space-y-3 mb-4">
        {question.choices && question.choices.map((choice, index) => {
          const choiceLabel = String.fromCharCode(65 + index);
          const isSelected = selectedAnswer === choice;

          return (
            <button
              key={index}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-surface border-border text-text hover:border-primary-500/50'
              }`}
              onClick={() => onAnswerSelect(choice)}
            >
              <div className="flex items-start gap-3">
                <span className={`font-bold ${isSelected ? 'text-white' : 'text-primary-500'}`}>
                  {choiceLabel}.
                </span>
                <span className="flex-1">{choice}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedAnswer && (
        <div className="text-sm text-text-secondary bg-surface p-3 rounded-lg">
          Answer selected: {String.fromCharCode(65 + question.choices.indexOf(selectedAnswer))}
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
