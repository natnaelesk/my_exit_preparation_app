import { SparklesIcon } from '@heroicons/react/24/outline';
import RichText from '../Common/RichText';

const QuestionCard = ({
  question,
  questionNumber,
  selectedAnswer,
  isLocked,
  onAnswerSelect,
  onShowAnswer,
  onGrokClick
}) => {
  if (!question) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <span className="text-primary-500 font-semibold">Question {questionNumber}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowAnswer}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:text-text hover:border-primary-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedAnswer || isLocked}
            title={!selectedAnswer ? 'Select an answer to enable' : isLocked ? 'Answer is locked' : 'Show answer and lock selection'}
          >
            {isLocked ? 'Answer Locked' : 'Show Answer'}
          </button>
          <button
            onClick={onGrokClick}
            className="p-2 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isLocked ? 'Ask AI (answer locked)' : 'Show answer first to unlock AI'}
            aria-label="Grok AI Assistant"
            disabled={!isLocked}
          >
            <SparklesIcon className="w-5 h-5" />
          </button>
          <span className="text-xs text-text-secondary bg-surface px-2 py-1 rounded">
            {question.subject}
          </span>
        </div>
      </div>

      <div className="text-base md:text-lg text-text mb-4 leading-relaxed">
        <RichText text={question.question} />
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
          const isCorrect = isLocked && choice === question.correctAnswer;

          return (
            <button
              key={index}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : isCorrect
                    ? 'bg-green-500/10 border-green-500 text-green-500'
                    : 'bg-card border-border text-text hover:border-primary-500/50 hover:bg-surface'
              }`}
              onClick={() => onAnswerSelect(choice)}
              disabled={isLocked}
            >
              <div className="flex items-start gap-3">
                <span className={`font-bold ${isSelected ? 'text-white' : isCorrect ? 'text-green-500' : 'text-primary-500'}`}>
                  {choiceLabel}.
                </span>
                <div className="flex-1">
                  <RichText text={choice} isInverted={isSelected} compact />
                </div>
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

      {isLocked && (
        <div className="mt-3 text-sm bg-green-500/10 border border-green-500/50 text-green-500 p-3 rounded-lg">
          Correct answer: {String.fromCharCode(65 + question.choices.indexOf(question.correctAnswer))}
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
