import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { getQuestionsBySubject } from './questionService';
import { getAllAttempts } from './attemptService';
import { calculateSubjectStats } from './analyticsService';
import { getRandomQuote } from '../utils/motivationalQuotes';

const DAILY_PLANS_COLLECTION = 'dailyPlans';
const MAX_PLANNED_QUESTIONS = 35;

/**
 * Deterministic shuffle using a seed (for consistent daily selection)
 */
function seededShuffle(array, seed) {
  const shuffled = [...array];
  let rng = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a numeric seed from dateKey + subject
 */
function getSeed(dateKey, subject) {
  let hash = 0;
  const str = `${dateKey}_${subject}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get or create today's daily plan (lazy initialization)
 */
export const getOrCreateDailyPlan = async (dateKey, focusSubject) => {
  try {
    const planRef = doc(db, DAILY_PLANS_COLLECTION, dateKey);
    const planSnap = await getDoc(planRef);

    // If plan exists, return it
    if (planSnap.exists()) {
      return {
        planId: planSnap.id,
        ...planSnap.data()
      };
    }

    // Otherwise, create a new plan
    if (!focusSubject) {
      throw new Error('focusSubject is required to create a new daily plan');
    }

    // Get all questions for the subject
    const allQuestions = await getQuestionsBySubject(focusSubject);
    const totalAvailable = allQuestions.length;

    // Select up to 35 questions deterministically
    const seed = getSeed(dateKey, focusSubject);
    const shuffled = seededShuffle(allQuestions, seed);
    const selectedQuestions = shuffled.slice(0, Math.min(MAX_PLANNED_QUESTIONS, totalAvailable));
    const questionIds = selectedQuestions.map(q => q.questionId);

    // Get a random motivational quote (avoiding recent quotes if possible)
    const recentPlans = await listRecentDailyPlans(14); // Get last 14 days
    const recentQuotes = recentPlans
      .map(plan => plan.motivationalQuote)
      .filter(quote => quote && quote.trim().length > 0);
    const motivationalQuote = getRandomQuote(recentQuotes);

    const planData = {
      dateKey,
      createdAt: Timestamp.now(),
      focusSubject,
      totalAvailableInSubject: totalAvailable,
      maxPlannedQuestions: MAX_PLANNED_QUESTIONS,
      questionIds,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      accuracy: 0,
      isComplete: false,
      motivationalQuote
    };

    await setDoc(planRef, planData);

    return {
      planId: dateKey,
      ...planData
    };
  } catch (error) {
    console.error('Error getting/creating daily plan:', error);
    throw error;
  }
};

/**
 * Get a daily plan by dateKey
 */
export const getDailyPlan = async (dateKey) => {
  try {
    const planRef = doc(db, DAILY_PLANS_COLLECTION, dateKey);
    const planSnap = await getDoc(planRef);
    
    if (planSnap.exists()) {
      return {
        planId: planSnap.id,
        ...planSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting daily plan:', error);
    throw error;
  }
};

/**
 * List recent daily plans (last 7 days)
 */
export const listRecentDailyPlans = async (days = 7) => {
  try {
    const plansRef = collection(db, DAILY_PLANS_COLLECTION);
    const q = query(plansRef, orderBy('dateKey', 'desc'));
    const snapshot = await getDocs(q);
    
    const plans = snapshot.docs.map(doc => ({
      planId: doc.id,
      ...doc.data()
    }));

    // Return the most recent N days
    return plans.slice(0, days);
  } catch (error) {
    console.error('Error listing recent daily plans:', error);
    return [];
  }
};

/**
 * Recompute daily plan stats from attempts
 */
export const recomputeDailyPlanStats = async (dateKey) => {
  try {
    const plan = await getDailyPlan(dateKey);
    if (!plan) {
      throw new Error(`Daily plan not found for ${dateKey}`);
    }

    // Get all attempts for this plan date
    const allAttempts = await getAllAttempts();
    const planAttempts = allAttempts.filter(a => a.planDateKey === dateKey);

    // Filter to only attempts for questions in this plan
    const planQuestionIds = new Set(plan.questionIds || []);
    const relevantAttempts = planAttempts.filter(a => planQuestionIds.has(a.questionId));

    // Calculate stats
    const answeredCount = relevantAttempts.length;
    const correctCount = relevantAttempts.filter(a => a.isCorrect).length;
    const wrongCount = answeredCount - correctCount;
    const accuracy = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;

    // Check if complete (all questions answered)
    const isComplete = answeredCount >= planQuestionIds.size;

    // Update plan
    const planRef = doc(db, DAILY_PLANS_COLLECTION, dateKey);
    await updateDoc(planRef, {
      answeredCount,
      correctCount,
      wrongCount,
      accuracy: Math.round(accuracy * 100) / 100,
      isComplete,
      lastUpdated: Timestamp.now()
    });

    return {
      planId: dateKey,
      answeredCount,
      correctCount,
      wrongCount,
      accuracy: Math.round(accuracy * 100) / 100,
      isComplete
    };
  } catch (error) {
    console.error('Error recomputing daily plan stats:', error);
    throw error;
  }
};

/**
 * Mark daily plan as complete (manual override if needed)
 */
export const markDailyPlanComplete = async (dateKey) => {
  try {
    const planRef = doc(db, DAILY_PLANS_COLLECTION, dateKey);
    await updateDoc(planRef, {
      isComplete: true,
      lastUpdated: Timestamp.now()
    });
  } catch (error) {
    console.error('Error marking daily plan complete:', error);
    throw error;
  }
};

