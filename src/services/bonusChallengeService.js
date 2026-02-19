import { calculateSubjectStats } from './analyticsService';
import { getAllAttempts } from './attemptService';
import { getQuestionsBySubject } from './questionService';
import { getRandomBonusQuote } from '../utils/motivationalQuotes';
import { getEthiopianDateKey } from '../utils/ethiopianTime';

const MAX_BONUS_QUESTIONS = 20;
const STRONG_SUBJECT_THRESHOLD = 70; // 70% accuracy

/**
 * Get strong subjects (accuracy >= 70%)
 */
export const getStrongSubjects = async () => {
  try {
    const subjectStats = await calculateSubjectStats();
    const strongSubjects = [];
    
    Object.values(subjectStats).forEach(stat => {
      if (stat.accuracy >= STRONG_SUBJECT_THRESHOLD && stat.totalAttempted > 0) {
        strongSubjects.push({
          subject: stat.subject,
          accuracy: stat.accuracy,
          totalAttempted: stat.totalAttempted
        });
      }
    });
    
    return strongSubjects;
  } catch (error) {
    console.error('Error getting strong subjects:', error);
    return [];
  }
};

/**
 * Get last attempt timestamp for each subject
 * Returns map of subject -> last attempt timestamp (Date object or null)
 */
export const getSubjectLastAttemptTime = async () => {
  try {
    const allAttempts = await getAllAttempts();
    const lastAttemptMap = {};
    
    allAttempts.forEach(attempt => {
      const subject = attempt.subject;
      let timestamp;
      
      // Handle both legacy Firestore Timestamp objects and ISO strings from Django API
      if (attempt.timestamp?.toDate) {
        timestamp = attempt.timestamp.toDate();
      } else if (attempt.timestamp) {
        timestamp = new Date(attempt.timestamp);
      } else {
        return; // Skip if no timestamp
      }
      
      if (!lastAttemptMap[subject] || timestamp > lastAttemptMap[subject]) {
        lastAttemptMap[subject] = timestamp;
      }
    });
    
    return lastAttemptMap;
  } catch (error) {
    console.error('Error getting subject last attempt times:', error);
    return {};
  }
};

/**
 * Select bonus subject - picks the strong subject with longest time since last question
 */
export const selectBonusSubject = async () => {
  try {
    const strongSubjects = await getStrongSubjects();
    
    if (strongSubjects.length === 0) {
      return null;
    }
    
    const lastAttemptMap = await getSubjectLastAttemptTime();
    const now = new Date();
    
    // Calculate days since last attempt for each strong subject
    const subjectsWithTimeSince = strongSubjects.map(subject => {
      const lastAttempt = lastAttemptMap[subject.subject];
      const daysSince = lastAttempt 
        ? Math.floor((now - lastAttempt) / (1000 * 60 * 60 * 24))
        : Infinity; // If never attempted, prioritize it
    
      return {
        ...subject,
        daysSinceLastAttempt: daysSince,
        lastAttemptTimestamp: lastAttempt
      };
    });
    
    // Sort by days since last attempt (longest first)
    subjectsWithTimeSince.sort((a, b) => {
      if (a.daysSinceLastAttempt === Infinity && b.daysSinceLastAttempt === Infinity) {
        return 0;
      }
      if (a.daysSinceLastAttempt === Infinity) return -1;
      if (b.daysSinceLastAttempt === Infinity) return 1;
      return b.daysSinceLastAttempt - a.daysSinceLastAttempt;
    });
    
    return subjectsWithTimeSince[0].subject;
  } catch (error) {
    console.error('Error selecting bonus subject:', error);
    return null;
  }
};

/**
 * Generate bonus questions from selected subject
 */
export const generateBonusQuestions = async (subject, excludeIds = []) => {
  try {
    if (!subject) {
      throw new Error('Subject is required to generate bonus questions');
    }
    
    const allQuestions = await getQuestionsBySubject(subject);
    const excludeSet = new Set(excludeIds);
    
    // Filter out excluded questions
    const availableQuestions = allQuestions.filter(
      q => !excludeSet.has(q.questionId)
    );
    
    // Shuffle and select up to MAX_BONUS_QUESTIONS
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, Math.min(MAX_BONUS_QUESTIONS, shuffled.length));
    
    return selectedQuestions.map(q => q.questionId);
  } catch (error) {
    console.error('Error generating bonus questions:', error);
    throw error;
  }
};

/**
 * Generate complete bonus challenge
 */
export const generateBonusChallenge = async () => {
  try {
    const subject = await selectBonusSubject();
    
    if (!subject) {
      throw new Error('No strong subjects available for bonus challenge');
    }
    
    const questionIds = await generateBonusQuestions(subject);
    
    if (questionIds.length === 0) {
      throw new Error('No questions available for bonus challenge');
    }
    
    const motivationalQuote = getRandomBonusQuote();
    
    return {
      subject,
      questionIds,
      motivationalQuote,
      maxQuestions: MAX_BONUS_QUESTIONS,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating bonus challenge:', error);
    throw error;
  }
};

/**
 * Get or generate bonus challenge for today
 * Stores in localStorage with date key (persists for today only)
 */
export const getOrGenerateBonusChallenge = async () => {
  try {
    const todayKey = getEthiopianDateKey();
    const storageKey = `bonus_challenge_${todayKey}`;
    
    // Try to load from localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Verify it's for today
        if (parsed.dateKey === todayKey) {
          return parsed;
        }
      } catch (e) {
        // Invalid stored data, continue to generate new
      }
    }
    
    // Generate new bonus challenge
    const challenge = await generateBonusChallenge();
    const challengeWithDate = {
      ...challenge,
      dateKey: todayKey
    };
    
    // Store in localStorage
    localStorage.setItem(storageKey, JSON.stringify(challengeWithDate));
    
    return challengeWithDate;
  } catch (error) {
    console.error('Error getting/generating bonus challenge:', error);
    throw error;
  }
};







