import { get, post, patch, del } from './apiClient';
import { getAllQuestions, getQuestionsBySubject, getQuestionsByTopic, getQuestionsByIds } from './questionService';
import { getAnsweredQuestionIds } from './attemptService';
import { getWeakTopics } from './analyticsService';
import { EXAM_MODES, WEAK_AREA_PROBABILITIES, STATUS_THRESHOLDS } from '../utils/constants';

/**
 * Shuffle array using Fisher-Yates algorithm
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Generate subject-only random exam
 */
export const generateSubjectExam = async (subject, excludeIds = [], questionCount = 50, allowReattempts = true) => {
  try {
    const questions = await getQuestionsBySubject(subject);
    if (!questions || questions.length === 0) {
      throw new Error(`No questions found for subject: ${subject}`);
    }

    const excludeSet = new Set(excludeIds);
    let available = questions.filter((q) => !excludeSet.has(q.questionId));

    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      const answeredSet = new Set(answeredIds);
      available = available.filter((q) => !answeredSet.has(q.questionId));

      if (available.length === 0) {
        available = questions.filter((q) => !excludeSet.has(q.questionId));
      }
    }

    if (available.length === 0) {
      throw new Error('No available questions for this subject.');
    }

    const shuffled = shuffleArray(available);
    return shuffled.slice(0, Math.min(questionCount, shuffled.length)).map((q) => q.questionId);
  } catch (error) {
    console.error('Error generating subject exam:', error);
    throw error;
  }
};

/**
 * Generate random exam questions
 */
export const generateRandomExam = async (excludeIds = [], questionCount = 50, examId = null, allowReattempts = true) => {
  try {
    let allQuestions;
    
    if (examId) {
      const { getExamById } = await import('./examService');
      const exam = await getExamById(examId);
      if (!exam.questionIds || exam.questionIds.length === 0) {
        throw new Error('Exam has no questions');
      }
      
      const maxQuestions = exam.questionIds.length;
      if (questionCount > maxQuestions) {
        questionCount = maxQuestions;
      }
      
      allQuestions = await getQuestionsByIds(exam.questionIds);
    } else {
      allQuestions = await getAllQuestions();
    }

    const excludeSet = new Set(excludeIds);
    let available = allQuestions.filter((q) => !excludeSet.has(q.questionId));

    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      const answeredSet = new Set(answeredIds);
      available = available.filter((q) => !answeredSet.has(q.questionId));

      if (available.length === 0) {
        available = allQuestions.filter((q) => !excludeSet.has(q.questionId));
      }
    }

    if (available.length === 0) {
          throw new Error('No available questions.');
        }

    const shuffled = shuffleArray(available);
    return shuffled.slice(0, Math.min(questionCount, shuffled.length)).map((q) => q.questionId);
  } catch (error) {
    console.error('Error generating random exam:', error);
    throw error;
  }
};

/**
 * Generate weak-area exam
 */
export const generateWeakAreaExam = async (excludeIds = [], questionCount = 50, subject = null, topics = null, allowReattempts = true) => {
  try {
    const weakTopics = await getWeakTopics();
    if (!weakTopics || weakTopics.length === 0) {
      return await generateRandomExam(excludeIds, questionCount, null, allowReattempts);
    }

    const excludeSet = new Set(excludeIds);
    const selectedQuestions = [];
    const usedQuestionIds = new Set();

    for (const weakTopic of weakTopics) {
      if (selectedQuestions.length >= questionCount) break;
      
      const topicQuestions = await getQuestionsByTopic(weakTopic.subject, [weakTopic.topic]);
      const available = topicQuestions.filter(
        (q) => !excludeSet.has(q.questionId) && !usedQuestionIds.has(q.questionId)
      );

      if (available.length > 0) {
        const shuffled = shuffleArray(available);
        const toAdd = Math.min(
          Math.ceil(questionCount * WEAK_AREA_PROBABILITIES.WEAK),
          shuffled.length,
          questionCount - selectedQuestions.length
        );
        selectedQuestions.push(...shuffled.slice(0, toAdd));
        selectedQuestions.forEach((q) => usedQuestionIds.add(q.questionId));
      }
    }

    if (selectedQuestions.length < questionCount) {
      const remaining = questionCount - selectedQuestions.length;
      const allQuestions = subject 
        ? await getQuestionsBySubject(subject)
        : await getAllQuestions();
      
      const available = allQuestions.filter(
        (q) => !excludeSet.has(q.questionId) && !usedQuestionIds.has(q.questionId)
      );
      
      if (available.length > 0) {
        const shuffled = shuffleArray(available);
        selectedQuestions.push(...shuffled.slice(0, Math.min(remaining, shuffled.length)));
      }
    }

    return selectedQuestions.slice(0, questionCount).map((q) => q.questionId);
  } catch (error) {
    console.error('Error generating weak-area exam:', error);
    throw error;
  }
};

/**
 * Generate topic-focused exam
 */
export const generateTopicFocusedExam = async (subject, topics, excludeIds = [], questionCount = 50, allowReattempts = false) => {
  try {
    if (!subject || !topics || topics.length === 0) {
      throw new Error('Subject and topics are required for topic-focused exam');
    }

    const questions = await getQuestionsByTopic(subject, topics);
    if (questions.length === 0) {
      throw new Error(`No questions found for subject: ${subject} and topics: ${topics.join(', ')}`);
    }

    const excludeSet = new Set(excludeIds);
    let available = questions.filter((q) => !excludeSet.has(q.questionId));

    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      const answeredSet = new Set(answeredIds);
      available = available.filter((q) => !answeredSet.has(q.questionId));

      if (available.length === 0) {
        available = questions.filter((q) => !excludeSet.has(q.questionId));
      }
    }

    if (available.length === 0) {
      throw new Error('No available questions for the selected topics.');
    }

    const shuffled = shuffleArray(available);
    return shuffled.slice(0, Math.min(questionCount, shuffled.length)).map((q) => q.questionId);
  } catch (error) {
    console.error('Error generating topic-focused exam:', error);
    throw error;
  }
};

/**
 * Generate exam-specific subject practice - filters questions from an exam by subject
 */
export const generateExamSubjectPractice = async (examId, subject, excludeIds = [], questionCount = null, allowReattempts = true) => {
  try {
    if (!examId) {
      throw new Error('Exam ID is required for exam-specific subject practice');
    }
    if (!subject) {
      throw new Error('Subject is required for exam-specific subject practice');
    }

    // Get exam and its questions
    const { getExamById } = await import('./examService');
    const exam = await getExamById(examId);
    if (!exam.questionIds || exam.questionIds.length === 0) {
      throw new Error('Exam has no questions');
    }

    // Load all exam questions
    const allExamQuestions = await getQuestionsByIds(exam.questionIds);
    
    // Filter by subject
    const subjectQuestions = allExamQuestions.filter((q) => q.subject === subject);
    
    if (subjectQuestions.length === 0) {
      throw new Error(`No questions found for subject "${subject}" in this exam.`);
    }

    const excludeSet = new Set(excludeIds);
    let available = subjectQuestions.filter((q) => !excludeSet.has(q.questionId));

    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      const answeredSet = new Set(answeredIds);
      available = available.filter((q) => !answeredSet.has(q.questionId));

      if (available.length === 0) {
        available = subjectQuestions.filter((q) => !excludeSet.has(q.questionId));
      }
    }

    if (available.length === 0) {
      throw new Error(`No available questions for subject "${subject}" in this exam.`);
    }

    // If questionCount is not specified, use all available questions
    const targetCount = questionCount || available.length;
    const shuffled = shuffleArray(available);
    return shuffled.slice(0, Math.min(targetCount, shuffled.length)).map((q) => q.questionId);
  } catch (error) {
    console.error('Error generating exam-specific subject practice:', error);
    throw error;
  }
};

/**
 * Create a new exam session
 */
export const createExamSession = async (mode, config = {}) => {
  try {
    const questionCount = config.questionCount || 50;
    const examId = config.examId || null;
    const timePerQuestion = config.timePerQuestion || null;
    const allowReattempts = !!config.allowReattempts;
    const planDateKey = config.planDateKey || null;
    const planQuestionIds = config.planQuestionIds || null;

    let questionIds = [];

    if (planQuestionIds && Array.isArray(planQuestionIds) && planQuestionIds.length > 0) {
      questionIds = planQuestionIds;
    } else {
      switch (mode) {
        case EXAM_MODES.RANDOM:
          questionIds = await generateRandomExam([], questionCount, examId, true);
          break;
        case EXAM_MODES.SUBJECT:
          if (!config.subject) {
            throw new Error('Subject mode requires subject');
          }
          questionIds = await generateSubjectExam(config.subject, [], questionCount, allowReattempts);
          break;
        case 'exam-weak-area':
          if (!examId) {
            throw new Error('Exam-specific weak area mode requires examId');
          }
          questionIds = await generateWeakAreaExam([], questionCount, null, null, allowReattempts);
          break;
        case 'exam-subject-focused':
          if (!examId || !config.subject) {
            throw new Error('Exam subject-focused mode requires examId and subject');
          }
          questionIds = await generateSubjectExam(config.subject, [], questionCount, allowReattempts);
          break;
        case 'exam-subject-practice':
          if (!examId || !config.subject) {
            throw new Error('Exam subject practice mode requires examId and subject');
          }
          questionIds = await generateExamSubjectPractice(examId, config.subject, [], questionCount || null, allowReattempts);
          break;
        case EXAM_MODES.TOPIC_FOCUSED:
          if (!config.subject || !config.topics) {
            throw new Error('Topic-focused mode requires subject and topics');
          }
          questionIds = await generateTopicFocusedExam(
            config.subject,
            config.topics,
            [],
            questionCount,
            allowReattempts
          );
          break;
        case EXAM_MODES.WEAK_AREA:
          questionIds = await generateWeakAreaExam(
            [],
            questionCount,
            config.subject || null,
            config.topics || null,
            allowReattempts
          );
          break;
        default:
          throw new Error(`Unknown exam mode: ${mode}`);
      }
    }

    if (questionIds.length === 0) {
      throw new Error('No questions available for this exam mode');
    }

    const sessionData = {
      examId: examId || null,
      mode,
      config: {
        ...config,
        planDateKey: planDateKey || null
      },
      currentIndex: 0,
      questionIds,
      answers: {},
      timeSpent: {},
      isComplete: false,
      isPaused: false,
      timePerQuestion: timePerQuestion || null,
      planDateKey: planDateKey || null
    };

    const session = await post('/sessions/', sessionData);
    return session;
  } catch (error) {
    console.error('Error creating exam session:', error);
    throw error;
  }
};

/**
 * Save exam progress (auto-save on every interaction)
 */
export const saveExamProgress = async (sessionId, questionId, answer, timeSpent) => {
  try {
    const session = await get(`/sessions/${sessionId}/`);
    
    const updatedAnswers = {
      ...session.answers,
      [questionId]: answer
    };
    const updatedTimeSpent = {
      ...session.timeSpent,
      [questionId]: timeSpent
    };

    await patch(`/sessions/${sessionId}/progress/`, {
      answers: updatedAnswers,
      timeSpent: updatedTimeSpent
    });
  } catch (error) {
    console.error('Error saving exam progress:', error);
    throw error;
  }
};

/**
 * Update current question index
 */
export const updateCurrentIndex = async (sessionId, currentIndex) => {
  try {
    await patch(`/sessions/${sessionId}/progress/`, {
      currentIndex
    });
  } catch (error) {
    console.error('Error updating current index:', error);
    throw error;
  }
};

/**
 * Complete exam session
 */
export const completeExamSession = async (sessionId) => {
  try {
    await patch(`/sessions/${sessionId}/progress/`, {
      isComplete: true
    });
  } catch (error) {
    console.error('Error completing exam session:', error);
    throw error;
  }
};

/**
 * Mark session as paused
 */
export const pauseExamSession = async (sessionId) => {
  try {
    await patch(`/sessions/${sessionId}/progress/`, {
      isPaused: true
    });
  } catch (error) {
    console.error('Error pausing exam session:', error);
    throw error;
  }
};

/**
 * Resume exam session - restore exact state
 */
export const resumeExamSession = async (sessionId) => {
  try {
    const session = await get(`/sessions/${sessionId}/`);
    
    await patch(`/sessions/${sessionId}/progress/`, {
      isPaused: false
    });

    return { ...session, isPaused: false };
  } catch (error) {
    console.error('Error resuming exam session:', error);
    throw error;
  }
};

/**
 * Get all incomplete exam sessions
 */
export const getIncompleteSessions = async () => {
  try {
    const response = await get('/sessions/incomplete/');
    return response.results || response;
  } catch (error) {
    console.error('Error fetching incomplete sessions:', error);
    return [];
  }
};

/**
 * Get exam sessions for a specific exam ID
 */
export const getExamSessions = async (examId) => {
  try {
    const allSessions = await get('/sessions/');
    const sessions = Array.isArray(allSessions.results) ? allSessions.results : allSessions;
    const filtered = sessions.filter(s => s.examId === examId);
    return filtered.sort((a, b) => {
      const aTime = new Date(a.lastUpdated || a.startedAt).getTime();
      const bTime = new Date(b.lastUpdated || b.startedAt).getTime();
        return bTime - aTime;
      });
  } catch (error) {
    console.error('Error fetching exam sessions:', error);
    return [];
  }
};

/**
 * Delete exam session
 */
export const deleteExamSession = async (sessionId) => {
  try {
    await del(`/sessions/${sessionId}/`);
  } catch (error) {
    console.error('Error deleting exam session:', error);
    throw error;
  }
};
