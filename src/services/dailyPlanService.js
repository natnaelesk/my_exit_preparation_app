import { get, post, patch } from './apiClient';
import { getQuestionsBySubject } from './questionService';
import { getAllAttempts } from './attemptService';
import { calculateSubjectStats } from './analyticsService';
import { getRandomQuote } from '../utils/motivationalQuotes';

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
    // Try to get existing plan first
    try {
      const plan = await get(`/plans/${dateKey}/`);
      return {
        planId: plan.dateKey,
        ...plan
      };
    } catch (error) {
      // Plan doesn't exist, will create it below
    }

    // Create a new plan
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

    // Create plan - API will return existing if dateKey already exists
    const plan = await post(`/plans/`, planData);

    return {
      planId: plan.dateKey,
      ...plan
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
    const plan = await get(`/plans/${dateKey}/`);
    return {
      planId: plan.dateKey,
      ...plan
    };
  } catch (error) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    console.error('Error getting daily plan:', error);
    throw error;
  }
};

/**
 * List recent daily plans (last N days)
 */
export const listRecentDailyPlans = async (days = 7) => {
  try {
    const response = await get('/plans/recent/', { days });
    return response.results || response;
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
    const result = await post(`/plans/${dateKey}/recompute/`, {});
    return {
      planId: dateKey,
      answeredCount: result.answeredCount,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      accuracy: result.accuracy,
      isComplete: result.isComplete
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
    await patch(`/plans/${dateKey}/complete/`, {});
  } catch (error) {
    console.error('Error marking daily plan complete:', error);
    throw error;
  }
};
