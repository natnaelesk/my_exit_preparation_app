import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import QuestionCard from './QuestionCard';
import ExamProgress from './ExamProgress';
import GrokAssistant from './GrokAssistant';
import LoadingAnimation from '../Common/LoadingAnimation';

const ExamInterface = () => {
  const navigate = useNavigate();
  const {
    currentQuestion,
    currentQuestionIndex,
    questions,
    answers,
    lockedAnswers,
    currentSession,
    selectAnswer,
    lockCurrentQuestion,
    nextQuestion,
    previousQuestion,
    finishExam,
    pauseExam,
    progress,
    isLoading,
    error
  } = useExam();

  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [showConfirmPause, setShowConfirmPause] = useState(false);
  const [showGrokAssistant, setShowGrokAssistant] = useState(false);
  // Timer removed: exams are untimed (no countdown UI, no auto-advance).

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Preparing your exam" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="card text-red-500">{error}</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-text-secondary">No question available</div>
      </div>
    );
  }

  const handleAnswerSelect = (answer) => {
    selectAnswer(answer);
  };

  // Handle Grok AI button click - marks question as wrong and opens AI assistant
  const handleGrokClick = () => {
    if (!currentQuestion) return;
    if (!lockedAnswers[currentQuestion.questionId]) return;
    
    // Mark the question as wrong by selecting an incorrect answer
    // Find the first choice that is NOT the correct answer
    const incorrectAnswer = currentQuestion.choices.find(
      choice => choice !== currentQuestion.correctAnswer
    );
    
    if (incorrectAnswer) {
      // Mark as wrong by selecting incorrect answer
      selectAnswer(incorrectAnswer);
    }
    
    // Open Grok assistant
    setShowGrokAssistant(true);
  };

  const handleMarkAsWrong = () => {
    // This is called when Grok modal closes
    // The question is already marked as wrong when the button is clicked
    // This is just a callback for any additional logic if needed
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      nextQuestion();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      previousQuestion();
    }
  };

  const handleFinish = async () => {
    setShowConfirmFinish(false);
    try {
      console.log('Finishing exam...');
      const examData = await finishExam();
      console.log('Exam finished, examData:', examData);
      
      if (examData && examData.questions && examData.questions.length > 0) {
        // Store in sessionStorage
        sessionStorage.setItem('examResults', JSON.stringify(examData));
        console.log('Exam data stored in sessionStorage, navigating to results...');
        // Navigate to results page
        navigate('/results', { replace: true });
      } else {
        console.error('Invalid examData:', examData);
        alert('Error: Could not retrieve exam data. Please try again.');
      }
    } catch (err) {
      console.error('Error finishing exam:', err);
      alert('Error finishing exam: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePause = async () => {
    setShowConfirmPause(false);
    try {
      console.log('Pausing exam...');
      const examData = await pauseExam();
      console.log('Exam paused, examData:', examData);
      
      if (examData && examData.questions && examData.questions.length > 0) {
        // Store in sessionStorage
        sessionStorage.setItem('examResults', JSON.stringify(examData));
        console.log('Paused exam data stored, navigating to results...');
        // Navigate to results page to show progress so far
        navigate('/results', { replace: true });
      } else {
        console.error('Invalid examData on pause:', examData);
        // If no questions answered, just navigate to dashboard
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Error pausing exam:', err);
      alert('Error pausing exam: ' + (err.message || 'Unknown error'));
      navigate('/', { replace: true });
    }
  };

  const selectedAnswer = answers[currentQuestion.questionId] || null;
  const isLocked = !!lockedAnswers[currentQuestion.questionId];
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button 
            className="btn-secondary text-sm"
            onClick={() => setShowConfirmPause(true)}
          >
            Pause
          </button>
          <div className="text-sm text-text-secondary">
            {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>
        <ExamProgress 
          current={currentQuestionIndex + 1} 
          total={questions.length}
          progress={progress}
        />
      </div>

      {/* Question Content */}
      <div className="px-4 py-6 pb-24">
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          selectedAnswer={selectedAnswer}
          isLocked={isLocked}
          onAnswerSelect={handleAnswerSelect}
          onShowAnswer={() => lockCurrentQuestion()}
          onGrokClick={handleGrokClick}
        />
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-50">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <button
            className="btn-secondary flex-1 disabled:opacity-50"
            onClick={handlePrevious}
            disabled={isFirstQuestion}
          >
            Previous
          </button>

          {isLastQuestion ? (
            <button
              className="btn-primary flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => setShowConfirmFinish(true)}
            >
              Finish
            </button>
          ) : (
            <button
              className="btn-primary flex-1"
              onClick={handleNext}
            >
              Next
            </button>
          )}
        </div>
      </div>

      {/* Finish Modal */}
      {showConfirmFinish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmFinish(false)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text mb-2">Finish Exam?</h3>
            <p className="text-text-secondary mb-4 text-sm">
              Are you sure you want to finish this exam? You will not be able to change your answers after finishing.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowConfirmFinish(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={handleFinish}>
                Finish Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showConfirmPause && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmPause(false)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text mb-2">Pause Exam?</h3>
            <p className="text-text-secondary mb-4 text-sm">
              Your progress will be saved. You'll see results for all questions answered so far. You can resume this exam later if needed.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowConfirmPause(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={handlePause}>
                Pause Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grok AI Assistant Modal */}
      <GrokAssistant
        question={currentQuestion}
        isOpen={showGrokAssistant}
        onClose={() => setShowGrokAssistant(false)}
        onMarkAsWrong={handleMarkAsWrong}
      />
    </div>
  );
};

export default ExamInterface;
