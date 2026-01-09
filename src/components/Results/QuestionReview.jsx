import { CheckCircleIcon } from '@heroicons/react/24/outline';

const QuestionReview = ({ questions, title, type }) => {
  if (!questions || questions.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-text-secondary">
          {type === 'wrong' 
            ? 'Great! You answered all questions correctly!' 
            : 'No correct answers to display.'}
        </p>
      </div>
    );
  }

  const getChoiceLabel = (choice, choices) => {
    const index = choices.indexOf(choice);
    return index >= 0 ? String.fromCharCode(65 + index) : '?';
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
      <p className="text-text-secondary text-sm mb-6">
        {type === 'wrong' 
          ? 'Review the questions you answered incorrectly. Study the explanations to understand why your answer was wrong.'
          : 'Review the questions you answered correctly. Read the explanations to reinforce your understanding.'}
      </p>

      <div className="space-y-4">
        {questions.map((question, index) => {
          const selectedLabel = getChoiceLabel(question.selectedAnswer, question.choices);
          const correctLabel = getChoiceLabel(question.correctAnswer, question.choices);
          const isWrong = type === 'wrong';

          return (
            <div key={question.questionId || index} className="card">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border flex-wrap">
                <span className={`font-semibold ${isWrong ? 'text-red-500' : 'text-green-500'}`}>
                  Question {index + 1}
                </span>
                <span className="text-xs text-text-secondary bg-surface px-2 py-1 rounded">
                  {question.subject}
                </span>
                {question.topic && (
                  <span className="text-xs text-text-secondary italic">{question.topic}</span>
                )}
              </div>

              <div className="text-base text-text mb-4 leading-relaxed">
                {question.question}
              </div>

              {isWrong ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg border-2 border-red-500 bg-red-500/10">
                    <div className="text-xs font-semibold text-red-500 mb-1 uppercase">Your Answer (Wrong)</div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-500 text-lg">{selectedLabel}</span>
                      <span className="text-text text-sm">{question.selectedAnswer}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border-2 border-green-500 bg-green-500/10">
                    <div className="text-xs font-semibold text-green-500 mb-1 uppercase">Correct Answer</div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-500 text-lg">{correctLabel}</span>
                      <span className="text-text text-sm">{question.correctAnswer}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border-2 border-green-500 bg-green-500/10 mb-4">
                  <div className="text-xs font-semibold text-green-500 mb-1 uppercase">Your Answer (Correct)</div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-500 text-lg">{selectedLabel}</span>
                    <span className="text-text text-sm">{question.selectedAnswer}</span>
                  </div>
                </div>
              )}

              {question.explanation && (
                <div className={`p-3 bg-surface rounded-lg border-l-4 ${isWrong ? 'border-red-500' : 'border-green-500'}`}>
                  <div className={`text-xs font-semibold mb-1 uppercase ${isWrong ? 'text-red-500' : 'text-green-500'}`}>
                    Explanation
                  </div>
                  <div className="text-sm text-text-secondary leading-relaxed">{question.explanation}</div>
                </div>
              )}

              {question.timeSpent > 0 && (
                <div className="text-xs text-text-secondary italic mt-2">
                  Time spent: {Math.floor(question.timeSpent / 60)}m {question.timeSpent % 60}s
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionReview;

