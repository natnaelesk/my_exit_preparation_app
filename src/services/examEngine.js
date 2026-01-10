import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { getAllQuestions, getQuestionsBySubject, getQuestionsByTopic, getQuestionsByIds } from './questionService';
import { getAnsweredQuestionIds } from './attemptService';
import { getWeakTopics } from './analyticsService';
import { EXAM_MODES, WEAK_AREA_PROBABILITIES, STATUS_THRESHOLDS } from '../utils/constants';

const EXAM_SESSIONS_COLLECTION = 'examSessions';

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
 * Generate random exam questions
 * @param {string[]} excludeIds - Question IDs to exclude
 * @param {number} questionCount - Number of questions to generate
 * @param {string} examId - Optional exam ID to filter questions
 * @param {boolean} allowReattempts - Whether to allow re-attempting answered questions
 */
export const generateRandomExam = async (excludeIds = [], questionCount = 50, examId = null, allowReattempts = true) => {
  try {
    let allQuestions;
    
    // If examId is provided, use only questions from that exam
    if (examId) {
      const { getExamById } = await import('./examService');
      const exam = await getExamById(examId);
      if (!exam.questionIds || exam.questionIds.length === 0) {
        throw new Error('Exam has no questions');
      }
      
      // Limit questionCount to available questions
      const maxQuestions = exam.questionIds.length;
      if (questionCount > maxQuestions) {
        questionCount = maxQuestions;
      }
      
      allQuestions = await getQuestionsByIds(exam.questionIds);
      
      // For exam-specific restarts, allow ALL questions (including previously answered)
      // Analysis data is preserved, so re-attempting is allowed
      const excludeSet = new Set(excludeIds);
      const availableQuestions = allQuestions.filter(
        q => !excludeSet.has(q.questionId)
      );

      if (availableQuestions.length === 0) {
        throw new Error('Exam has no available questions after filtering.');
      }

      // Random selection
      const shuffled = shuffleArray(availableQuestions);
      const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));
      return selectedQuestions.map(q => q.questionId);
    } else {
      // For general random mode (no examId), prefer unanswered questions but allow answered if needed
      allQuestions = await getAllQuestions();
      
      if (allowReattempts) {
        // If allowing reattempts, just exclude excludeIds
        const excludeSet = new Set(excludeIds);
        let availableQuestions = allQuestions.filter(
          q => !excludeSet.has(q.questionId)
        );

        if (availableQuestions.length === 0) {
          throw new Error('No available questions.');
        }

        const shuffled = shuffleArray(availableQuestions);
        const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));
        return selectedQuestions.map(q => q.questionId);
      } else {
        // If not allowing reattempts, exclude answered questions
        const answeredIds = await getAnsweredQuestionIds();
        const excludeSet = new Set([...excludeIds, ...answeredIds]);

        // Filter out answered questions
        let availableQuestions = allQuestions.filter(
          q => !excludeSet.has(q.questionId)
        );

        // If all questions have been answered, allow re-attempting (for practice)
        if (availableQuestions.length === 0) {
          // Fall back to all questions (excluding only excludeIds)
          availableQuestions = allQuestions.filter(
            q => !excludeIds.includes(q.questionId)
          );
        }

        if (availableQuestions.length === 0) {
          throw new Error('No available questions.');
        }

        // Random selection
        const shuffled = shuffleArray(availableQuestions);
        const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));
        return selectedQuestions.map(q => q.questionId);
      }
    }
  } catch (error) {
    console.error('Error generating random exam:', error);
    throw error;
  }
};

/**
 * Generate exam-specific weak area exam (for a specific exam only)
 * @param {string} examId - Exam ID to get questions from
 * @param {number} questionCount - Number of questions
 */
export const generateExamWeakAreaExam = async (examId, questionCount = 50) => {
  try {
    const { getExamById } = await import('./examService');
    const exam = await getExamById(examId);
    if (!exam.questionIds || exam.questionIds.length === 0) {
      throw new Error('Exam has no questions');
    }

    // Ensure questionCount doesn't exceed available questions
    const maxQuestions = exam.questionIds.length;
    const actualQuestionCount = Math.min(questionCount, maxQuestions);

    // Get attempts for this specific exam only
    const { getAttemptsByExamId } = await import('./analyticsService');
    const examAttempts = await getAttemptsByExamId(examId);

    // If no attempts exist, fallback to random from this exam
    if (examAttempts.length === 0) {
      console.log('No attempts found for weak area mode, using random selection from exam');
      return generateRandomExam([], actualQuestionCount, examId, true);
    }

    // Group attempts by topic to identify weak areas
    const attemptsByTopic = {};
    examAttempts.forEach(attempt => {
      const topicKey = `${attempt.subject}::${attempt.topic || 'Unknown'}`;
      if (!attemptsByTopic[topicKey]) {
        attemptsByTopic[topicKey] = [];
      }
      attemptsByTopic[topicKey].push(attempt);
    });

    // Calculate accuracy per topic
    const topicAccuracies = Object.entries(attemptsByTopic).map(([topicKey, attempts]) => {
      const correctCount = attempts.filter(a => a.isCorrect).length;
      const accuracy = attempts.length > 0 ? (correctCount / attempts.length) * 100 : 0;
      const [subject, topic] = topicKey.split('::');
      return { subject, topic, accuracy, attempts };
    });

    // Sort by accuracy (weakest first)
    topicAccuracies.sort((a, b) => a.accuracy - b.accuracy);

    // Get all questions from exam
    const allQuestions = await getQuestionsByIds(exam.questionIds);
    
    // Prioritize questions from weak topics
    const weakTopics = topicAccuracies.slice(0, 5).map(t => ({ subject: t.subject, topic: t.topic }));
    const weakQuestionIds = new Set();
    
    allQuestions.forEach(q => {
      weakTopics.forEach(wt => {
        if (q.subject === wt.subject && (q.topic || 'Unknown') === wt.topic) {
          weakQuestionIds.add(q.questionId);
        }
      });
    });

    // Separate questions into weak and others
    const weakQuestions = allQuestions.filter(q => weakQuestionIds.has(q.questionId));
    const otherQuestions = allQuestions.filter(q => !weakQuestionIds.has(q.questionId));

    // Select questions: prioritize weak, fill rest with others
    // Use the ACTUAL questionCount, not the full exam
    const selectedQuestions = [];
    const weakCount = Math.min(Math.floor(actualQuestionCount * 0.6), weakQuestions.length);
    const shuffledWeak = shuffleArray(weakQuestions);
    selectedQuestions.push(...shuffledWeak.slice(0, weakCount));

    // Fill remaining with other questions (limited to actualQuestionCount)
    if (selectedQuestions.length < actualQuestionCount) {
      const remaining = actualQuestionCount - selectedQuestions.length;
      const shuffledOther = shuffleArray(otherQuestions);
      selectedQuestions.push(...shuffledOther.slice(0, Math.min(remaining, shuffledOther.length)));
    }

    // If still not enough, fill with any remaining weak questions
    if (selectedQuestions.length < actualQuestionCount && weakQuestions.length > weakCount) {
      const remaining = actualQuestionCount - selectedQuestions.length;
      const remainingWeak = shuffleArray(weakQuestions.slice(weakCount));
      selectedQuestions.push(...remainingWeak.slice(0, Math.min(remaining, remainingWeak.length)));
    }

    if (selectedQuestions.length === 0) {
      throw new Error('No questions available for weak-area exam.');
    }

    // Return exactly the requested number (or as close as possible)
    return selectedQuestions.slice(0, actualQuestionCount).map(q => q.questionId);
  } catch (error) {
    console.error('Error generating exam weak-area exam:', error);
    // Fallback to random if weak area fails
    const actualQuestionCount = Math.min(questionCount, exam?.questionIds?.length || questionCount);
    return generateRandomExam([], actualQuestionCount, examId, true);
  }
};

/**
 * Generate topic-focused exam
 */
export const generateTopicFocusedExam = async (subject, topics, excludeIds = [], questionCount = 50, allowReattempts = false) => {
  try {
    const excludeSet = new Set(excludeIds);
    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      for (const id of answeredIds) excludeSet.add(id);
    }

    // Get questions for the specified subject and topics
    const questions = await getQuestionsByTopic(subject, topics);

    // Filter questions
    let availableQuestions = questions.filter(q => !excludeSet.has(q.questionId));

    // If we're not allowing reattempts but ran out, fall back to allowing repeats (practice)
    if (!allowReattempts && availableQuestions.length === 0) {
      availableQuestions = questions.filter(q => !excludeIds.includes(q.questionId));
    }

    if (availableQuestions.length === 0) {
      throw new Error(`No available questions for ${subject} - ${topics.join(', ')}. All questions have been answered.`);
    }

    // Random selection from filtered set
    const shuffled = shuffleArray(availableQuestions);
    const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    return selectedQuestions.map(q => q.questionId);
  } catch (error) {
    console.error('Error generating topic-focused exam:', error);
    throw error;
  }
};

/**
 * Generate subject-focused exam (for a specific exam)
 */
export const generateExamSubjectFocusedExam = async (examId, subject, questionCount = 50) => {
  try {
    const { getExamById } = await import('./examService');
    const exam = await getExamById(examId);
    if (!exam.questionIds || exam.questionIds.length === 0) {
      throw new Error('Exam has no questions');
    }

    // Get all questions from exam
    const allQuestions = await getQuestionsByIds(exam.questionIds);
    
    // Filter by subject
    const subjectQuestions = allQuestions.filter(q => q.subject === subject);

    if (subjectQuestions.length === 0) {
      throw new Error(`No questions found for subject: ${subject}`);
    }

    // Limit to requested count (not all questions)
    const actualQuestionCount = Math.min(questionCount, subjectQuestions.length);
    const shuffled = shuffleArray(subjectQuestions);
    const selectedQuestions = shuffled.slice(0, actualQuestionCount);

    // Return exactly the requested number (or as close as possible)
    return selectedQuestions.map(q => q.questionId);
  } catch (error) {
    console.error('Error generating exam subject-focused exam:', error);
    throw error;
  }
};

/**
 * Generate weak-area exam (MOST IMPORTANT)
 * Prioritizes weak topics, falls back to medium, avoids strong unless needed
 */
export const generateWeakAreaExam = async (excludeIds = [], questionCount = 50, subjectFilter = null, topicFilter = null, allowReattempts = false) => {
  try {
    // Get questions - filter by subject/topic if specified
    let allQuestions;
    if (subjectFilter) {
      if (topicFilter && topicFilter.length > 0) {
        allQuestions = await getQuestionsByTopic(subjectFilter, topicFilter);
      } else {
        allQuestions = await getQuestionsBySubject(subjectFilter);
      }
    } else {
      allQuestions = await getAllQuestions();
    }

    // Get weak topics
    const weakTopics = await getWeakTopics(subjectFilter, 20);
    
    // Build exclusion set
    const excludeSet = new Set(excludeIds);
    if (!allowReattempts) {
      const answeredIds = await getAnsweredQuestionIds();
      for (const id of answeredIds) excludeSet.add(id);
    }

    // Categorize questions by topic strength
    const weakQuestionIds = new Set();
    weakTopics.forEach(wt => {
      allQuestions.forEach(q => {
        if (q.subject === wt.subject && (q.topic || 'Unknown') === wt.topic) {
          weakQuestionIds.add(q.questionId);
        }
      });
    });

    const weakQuestions = allQuestions.filter(q => 
      weakQuestionIds.has(q.questionId) && !excludeSet.has(q.questionId)
    );

    // Calculate medium/strong from remaining questions
    const remainingQuestions = allQuestions.filter(q => 
      !weakQuestionIds.has(q.questionId) && !excludeSet.has(q.questionId)
    );

    // Try to get topic stats for remaining to categorize
    const mediumQuestions = remainingQuestions; // Simplified - can enhance later
    const strongQuestions = [];

    // Select questions based on weak area probabilities
    const selectedQuestions = [];
    
    const weakCount = Math.floor(questionCount * WEAK_AREA_PROBABILITIES.WEAK);
    const mediumCount = Math.floor(questionCount * WEAK_AREA_PROBABILITIES.MEDIUM);
    
    const shuffledWeak = shuffleArray(weakQuestions);
    selectedQuestions.push(...shuffledWeak.slice(0, Math.min(weakCount, shuffledWeak.length)));

    const shuffledMedium = shuffleArray(mediumQuestions);
    selectedQuestions.push(...shuffledMedium.slice(0, Math.min(mediumCount, shuffledMedium.length)));

    // Fill remaining with strong questions only if needed
    const remaining = questionCount - selectedQuestions.length;
    if (remaining > 0 && selectedQuestions.length < questionCount) {
      const shuffledStrong = shuffleArray(strongQuestions);
      selectedQuestions.push(...shuffledStrong.slice(0, Math.min(remaining, shuffledStrong.length)));
    }

    // If still not enough, fill with any available questions
    if (selectedQuestions.length < questionCount) {
      const allAvailable = [...weakQuestions, ...mediumQuestions, ...strongQuestions]
        .filter(q => !selectedQuestions.find(sq => sq.questionId === q.questionId));
      const shuffledAll = shuffleArray(allAvailable);
      selectedQuestions.push(...shuffledAll.slice(0, questionCount - selectedQuestions.length));
    }

    // If we STILL don't have enough (usually because most questions are already answered),
    // fall back to allowing reattempts so the user can keep practicing.
    if (!allowReattempts && selectedQuestions.length < questionCount) {
      const alreadySelected = new Set(selectedQuestions.map(q => q.questionId));
      const backfillPool = allQuestions.filter(
        q => !excludeIds.includes(q.questionId) && !alreadySelected.has(q.questionId)
      );
      const shuffledBackfill = shuffleArray(backfillPool);
      selectedQuestions.push(...shuffledBackfill.slice(0, questionCount - selectedQuestions.length));
    }

    if (selectedQuestions.length === 0) {
      throw new Error('No available questions for weak-area exam.');
    }

    return selectedQuestions.slice(0, questionCount).map(q => q.questionId);
  } catch (error) {
    console.error('Error generating weak-area exam:', error);
    throw error;
  }
};

/**
 * Create a new exam session
 * 
 * IMPORTANT: This always creates a NEW session with a unique sessionId.
 * Old sessions are NEVER deleted or modified - they are preserved for history.
 * Analysis data (attempts) is also NEVER deleted - it's append-only.
 */
export const createExamSession = async (mode, config = {}) => {
  try {
    let questionIds = [];
    const questionCount = config.questionCount || 50;
    const examId = config.examId || null;
    const timePerQuestion = config.timePerQuestion || null; // in seconds (null = unlimited)
    const allowReattempts = !!config.allowReattempts;

    switch (mode) {
      case EXAM_MODES.RANDOM:
        questionIds = await generateRandomExam([], questionCount, examId, true);
        break;
      case 'exam-weak-area':
        // Exam-specific weak area mode
        if (!examId) {
          throw new Error('Exam-specific weak area mode requires examId');
        }
        questionIds = await generateExamWeakAreaExam(examId, questionCount);
        break;
      case 'exam-subject-focused':
        // Exam-specific subject-focused mode
        if (!examId || !config.subject) {
          throw new Error('Exam-specific subject-focused mode requires examId and subject');
        }
        questionIds = await generateExamSubjectFocusedExam(examId, config.subject, questionCount);
        break;
      case EXAM_MODES.TOPIC_FOCUSED:
        if (!config.subject || !config.topics || config.topics.length === 0) {
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

    if (questionIds.length === 0) {
      throw new Error('No questions available for this exam mode');
    }

    // Generate unique sessionId - each restart creates a completely new session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionData = {
      sessionId,
      examId: examId || null,
      mode,
      config,
      currentIndex: 0,
      questionIds,
      answers: {},
      timeSpent: {},
      startedAt: Timestamp.now(),
      isComplete: false,
      isPaused: false,
      lastUpdated: Timestamp.now(),
      timePerQuestion: timePerQuestion || null
    };

    // Create new session document - old sessions remain untouched
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    await setDoc(sessionRef, sessionData);

    return sessionData;
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
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('Exam session not found');
    }

    const sessionData = sessionSnap.data();
    const updatedAnswers = {
      ...sessionData.answers,
      [questionId]: answer
    };
    const updatedTimeSpent = {
      ...sessionData.timeSpent,
      [questionId]: timeSpent
    };

    await updateDoc(sessionRef, {
      answers: updatedAnswers,
      timeSpent: updatedTimeSpent,
      lastUpdated: Timestamp.now()
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
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
      currentIndex,
      lastUpdated: Timestamp.now()
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
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
      isComplete: true,
      completedAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
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
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    await updateDoc(sessionRef, {
      isPaused: true,
      lastUpdated: Timestamp.now()
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
    const sessionRef = doc(db, EXAM_SESSIONS_COLLECTION, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('Exam session not found');
    }

    const data = sessionSnap.data();
    // Reset isPaused when resuming
    await updateDoc(sessionRef, {
      isPaused: false,
      lastUpdated: Timestamp.now()
    });

    return { ...data, isPaused: false };
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
    const sessionsRef = collection(db, EXAM_SESSIONS_COLLECTION);
    const q = query(sessionsRef, where('isComplete', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      sessionId: doc.id,
      ...doc.data()
    }));
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
    const sessionsRef = collection(db, EXAM_SESSIONS_COLLECTION);
    // Try with orderBy first, fallback to just where if index doesn't exist
    try {
      const q = query(
        sessionsRef, 
        where('examId', '==', examId),
        orderBy('lastUpdated', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        sessionId: doc.id,
        ...doc.data()
      }));
    } catch (orderByError) {
      // If orderBy fails (no index), just use where
      const q = query(sessionsRef, where('examId', '==', examId));
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        sessionId: doc.id,
        ...doc.data()
      }));
      // Sort manually by lastUpdated
      return sessions.sort((a, b) => {
        const aTime = a.lastUpdated?.toMillis?.() || 0;
        const bTime = b.lastUpdated?.toMillis?.() || 0;
        return bTime - aTime;
      });
    }
  } catch (error) {
    console.error('Error fetching exam sessions:', error);
    return [];
  }
};
