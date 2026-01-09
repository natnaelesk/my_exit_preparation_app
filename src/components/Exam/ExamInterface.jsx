import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import QuestionCard from './QuestionCard';
import ExamProgress from './ExamProgress';
import QuestionTimer from './QuestionTimer';

const ExamInterface = () => {
  const navigate = useNavigate();
  const {
    currentQuestion,
    currentQuestionIndex,
    questions,
    answers,
    currentSession,
    selectAnswer,
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
  const [timerKey, setTimerKey] = useState(0); // Key to reset timer on question change

  // Get time per question from session config
  const timePerQuestion = currentSession?.timePerQuestion || null;

  // Handle timer expiration - auto-submit current question and move to next
  const handleTimeUp = () => {
    const question = questions[currentQuestionIndex];
    if (question && !answers[question.questionId]) {
      // Auto-select first choice if no answer selected
      selectAnswer(question.choices[0]);
    }
    // Auto-advance to next question after a brief delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        nextQuestion();
        setTimerKey(prev => prev + 1); // Reset timer
      } else {
        // If last question, show finish confirmation
        setShowConfirmFinish(true);
      }
    }, 1000);
  };

  // Reset timer when question changes
  useEffect(() => {
    if (currentQuestion && timePerQuestion) {
      setTimerKey(prev => prev + 1);
    }
  }, [currentQuestionIndex, currentQuestion, timePerQuestion]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-secondary">Loading exam...</div>
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
        {timePerQuestion && (
          <div className="mt-2">
            <QuestionTimer
              key={timerKey}
              timePerQuestion={timePerQuestion}
              onTimeUp={handleTimeUp}
              isActive={!!currentQuestion}
            />
          </div>
        )}
      </div>

      {/* Question Content */}
      <div className="px-4 py-6 pb-24">
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          selectedAnswer={selectedAnswer}
          onAnswerSelect={handleAnswerSelect}
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
    </div>
  );
};

export default ExamInterface;
