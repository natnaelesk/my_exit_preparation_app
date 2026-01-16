import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  createExamSession, 
  resumeExamSession, 
  saveExamProgress, 
  updateCurrentIndex, 
  completeExamSession 
} from '../services/examEngine';
import { saveAttempt } from '../services/attemptService';
import { getQuestionsByIds } from '../services/questionService';

const ExamContext = createContext(null);

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within ExamProvider');
  }
  return context;
};

export const ExamProvider = ({ children }) => {
  const [currentSession, setCurrentSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [lockedAnswers, setLockedAnswers] = useState({});
  const [timeSpent, setTimeSpent] = useState({});
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load questions when session changes
  useEffect(() => {
    if (currentSession && currentSession.questionIds) {
      loadQuestions(currentSession.questionIds);
    }
  }, [currentSession]);

  // Track time per question
  useEffect(() => {
    if (currentSession && questions.length > 0) {
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion) {
        setQuestionStartTime(Date.now());
      }
    }
  }, [currentQuestionIndex, questions, currentSession]);

  const loadQuestions = async (questionIds) => {
    try {
      setIsLoading(true);
      const loadedQuestions = await getQuestionsByIds(questionIds);
      setQuestions(loadedQuestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start a new exam - creates a NEW session
   * Old sessions and analysis data are preserved
   */
  const startExam = async (mode, config = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      // Creates a NEW exam session - old sessions are never deleted
      const session = await createExamSession(mode, config);
      setCurrentSession(session);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setLockedAnswers({});
      setTimeSpent({});
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resumeExam = async (sessionId) => {
    try {
      setIsLoading(true);
      setError(null);
      const session = await resumeExamSession(sessionId);
      setCurrentSession(session);
      setCurrentQuestionIndex(session.currentIndex || 0);
      setAnswers(session.answers || {});
      setLockedAnswers({});
      setTimeSpent(session.timeSpent || {});
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const selectAnswer = async (answer) => {
    if (!currentSession || !questions[currentQuestionIndex]) return;

    const question = questions[currentQuestionIndex];
    const questionId = question.questionId;
    if (lockedAnswers[questionId]) return;
    
    // Calculate time spent
    const elapsed = questionStartTime ? Math.floor((Date.now() - questionStartTime) / 1000) : 0;
    
    // Update local state
    const newAnswers = { ...answers, [questionId]: answer };
    const newTimeSpent = { ...timeSpent, [questionId]: elapsed };
    setAnswers(newAnswers);
    setTimeSpent(newTimeSpent);

    // Auto-save to API
    try {
      await saveExamProgress(currentSession.sessionId, questionId, answer, elapsed);
    } catch (err) {
      console.error('Error auto-saving progress:', err);
    }

    // Also save to localStorage as backup
    try {
      localStorage.setItem(`exam_${currentSession.sessionId}`, JSON.stringify({
        answers: newAnswers,
        timeSpent: newTimeSpent,
        currentIndex: currentQuestionIndex
      }));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  };

  const goToQuestion = async (index) => {
    if (index >= 0 && index < questions.length) {
      // Save current question time before moving
      if (questionStartTime && questions[currentQuestionIndex]) {
        const question = questions[currentQuestionIndex];
        const questionId = question.questionId;
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        
        if (!timeSpent[questionId]) {
          const newTimeSpent = { ...timeSpent, [questionId]: elapsed };
          setTimeSpent(newTimeSpent);
          
          try {
            await saveExamProgress(
              currentSession.sessionId, 
              questionId, 
              answers[questionId] || null, 
              elapsed
            );
          } catch (err) {
            console.error('Error saving time on navigation:', err);
          }
        }
      }

      setCurrentQuestionIndex(index);
      
      // Update current index in API
      if (currentSession) {
        try {
          await updateCurrentIndex(currentSession.sessionId, index);
        } catch (err) {
          console.error('Error updating index:', err);
        }
      }
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const lockCurrentQuestion = () => {
    if (!questions[currentQuestionIndex]) return;
    const questionId = questions[currentQuestionIndex].questionId;
    setLockedAnswers(prev => ({ ...prev, [questionId]: true }));
  };

  const finishExam = async () => {
    if (!currentSession) {
      console.error('No current session to finish');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Calculate final question time and update timeSpent
      let finalTimeSpent = { ...timeSpent };
      if (questionStartTime && questions[currentQuestionIndex]) {
        const question = questions[currentQuestionIndex];
        const questionId = question.questionId;
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        
        if (!finalTimeSpent[questionId]) {
          finalTimeSpent[questionId] = elapsed;
          // Save to API
          try {
            await saveExamProgress(
              currentSession.sessionId, 
              questionId, 
              answers[questionId] || null, 
              elapsed
            );
          } catch (err) {
            console.error('Error saving final question progress:', err);
          }
        }
      }

      // Prepare exam data for results page BEFORE saving attempts
      // This ensures we have the data even if saving attempts fails
      const examData = {
        questions: [...questions], // Create a copy
        answers: { ...answers }, // Create a copy
        timeSpent: { ...finalTimeSpent }, // Use updated timeSpent
        examId: currentSession.examId || null
      };

      // Save all attempts to attempts collection (don't let errors stop the process)
      const saveAttemptsPromises = [];
      for (const question of questions) {
        const questionId = question.questionId;
        const selectedAnswer = answers[questionId];
        
        if (selectedAnswer) {
          const isCorrect = selectedAnswer === question.correctAnswer;
          const time = finalTimeSpent[questionId] || 0;

          // Don't await each one - save in parallel and continue even if some fail
          saveAttemptsPromises.push(
            saveAttempt({
              questionId,
              selectedAnswer,
              timeSpent: time,
              isCorrect,
              examId: currentSession.examId || null,
              mode: currentSession.mode,
              subject: question.subject,
              topic: question.topic || 'Unknown',
              planDateKey: currentSession.planDateKey || currentSession.config?.planDateKey || null // Tag with plan date for daily isolation
            }).catch(err => {
              console.error(`Error saving attempt for question ${questionId}:`, err);
            })
          );
        }
      }

      // Wait for all attempts to save (but don't fail if some errors occur)
      try {
        await Promise.all(saveAttemptsPromises);
      } catch (err) {
        console.error('Some attempts failed to save:', err);
        // Continue anyway - we still have the examData
      }

      // If this was a daily plan session, recompute daily plan stats and mark complete if needed
      const planDateKey = currentSession.planDateKey || currentSession.config?.planDateKey;
      if (planDateKey) {
        try {
          const { recomputeDailyPlanStats } = await import('../services/dailyPlanService');
          await recomputeDailyPlanStats(planDateKey);
        } catch (err) {
          console.error('Error recomputing daily plan stats:', err);
          // Continue anyway
        }
      }

      // Mark session as complete (non-blocking)
      try {
        await completeExamSession(currentSession.sessionId);
      } catch (err) {
        console.error('Error completing exam session:', err);
        // Continue anyway
      }

      // Clear session state
      const sessionId = currentSession.sessionId;
      setCurrentSession(null);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setLockedAnswers({});
      setTimeSpent({});
      setQuestionStartTime(null);

      // Clear localStorage backup
      try {
        localStorage.removeItem(`exam_${sessionId}`);
      } catch (err) {
        console.error('Error clearing localStorage:', err);
      }

      console.log('Exam finished successfully, returning examData:', examData);
      return examData;
    } catch (err) {
      console.error('Error in finishExam:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Pause exam - saves all attempts up to this point and shows results
   * This is like finishing but allows resume later
   */
  const pauseExam = async () => {
    if (!currentSession) return null;

    try {
      setIsLoading(true);
      setError(null);

      // Calculate final question time
      let finalTimeSpent = { ...timeSpent };
      if (questionStartTime && questions[currentQuestionIndex]) {
        const question = questions[currentQuestionIndex];
        const questionId = question.questionId;
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        
        if (!finalTimeSpent[questionId]) {
          finalTimeSpent[questionId] = elapsed;
          // Save to API
          try {
            await saveExamProgress(
              currentSession.sessionId, 
              questionId, 
              answers[questionId] || null, 
              elapsed
            );
          } catch (err) {
            console.error('Error saving final question progress:', err);
          }
        }
      }

      // Prepare exam data for results page - only questions answered so far
      const answeredQuestionIds = Object.keys(answers);
      const answeredQuestions = questions.filter(q => answeredQuestionIds.includes(q.questionId));
      
      const examData = {
        questions: answeredQuestions,
        answers: { ...answers },
        timeSpent: { ...finalTimeSpent },
        examId: currentSession.examId || null,
        isPaused: true // Mark as paused
      };

      // Save all attempts to attempts collection (up to current point)
      const saveAttemptsPromises = [];
      for (const question of answeredQuestions) {
        const questionId = question.questionId;
        const selectedAnswer = answers[questionId];
        
        if (selectedAnswer) {
          const isCorrect = selectedAnswer === question.correctAnswer;
          const time = finalTimeSpent[questionId] || 0;

          saveAttemptsPromises.push(
            saveAttempt({
              questionId,
              selectedAnswer,
              timeSpent: time,
              isCorrect,
              examId: currentSession.examId || null,
              mode: currentSession.mode,
              subject: question.subject,
              topic: question.topic || 'Unknown',
              planDateKey: currentSession.planDateKey || currentSession.config?.planDateKey || null // Tag with plan date for daily isolation
            }).catch(err => {
              console.error(`Error saving attempt for question ${questionId}:`, err);
            })
          );
        }
      }

      // Wait for all attempts to save
      try {
        await Promise.all(saveAttemptsPromises);
      } catch (err) {
        console.error('Some attempts failed to save:', err);
      }

      // Mark session as paused (not complete) - keep session state for resume
      try {
        const { pauseExamSession } = await import('../services/examEngine');
        await pauseExamSession(currentSession.sessionId);
        // Update session state to mark as paused
        setCurrentSession({ ...currentSession, isPaused: true });
      } catch (err) {
        console.error('Error pausing exam session:', err);
      }

      // Don't clear session state - keep it for resume later
      // Only clear the current question focus
      setQuestionStartTime(null);
      
      console.log('Exam paused, returning examData:', examData);
      return examData;
    } catch (err) {
      console.error('Error in pauseExam:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo(() => ({
    currentSession,
    questions,
    currentQuestionIndex,
    currentQuestion: questions[currentQuestionIndex] || null,
    answers,
    lockedAnswers,
    timeSpent,
    isLoading,
    error,
    startExam,
    resumeExam,
    selectAnswer,
    lockCurrentQuestion,
    goToQuestion,
    nextQuestion,
    previousQuestion,
    finishExam,
    pauseExam,
    isComplete: currentSession ? currentSession.isComplete : false,
    progress: questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0
  }), [
    currentSession,
    questions,
    currentQuestionIndex,
    answers,
    lockedAnswers,
    timeSpent,
    isLoading,
    error,
    startExam,
    resumeExam,
    selectAnswer,
    lockCurrentQuestion,
    goToQuestion,
    nextQuestion,
    previousQuestion,
    finishExam,
    pauseExam
  ]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
};


