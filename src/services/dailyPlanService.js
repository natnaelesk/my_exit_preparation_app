import { get, post, patch } from './apiClient';
import { getQuestionsBySubject } from './questionService';
import { getAllAttempts } from './attemptService';
import { calculateSubjectStats } from './analyticsService';
import { getRandomQuote } from '../utils/motivationalQuotes';
import { getAnsweredQuestionIds } from './attemptService';
import { getSubjectPriorities } from './subjectPriorityService';

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
 * Select focus subject using priorities and weakness scores
 * Top priority subjects get more consideration, but not always #1
 */
export const selectFocusSubject = async () => {
  try {
    // Get subject priorities and stats
    const [priorities, stats] = await Promise.all([
      getSubjectPriorities().catch(() => []), // Fallback to empty if priorities don't exist
      calculateSubjectStats()
    ]);

    // Filter out completed subjects
    const completedSubjects = new Set(
      priorities.filter(p => p.isCompleted).map(p => p.subject)
    );

    // Get active (non-completed) subjects with data
    const activeSubjects = Object.values(stats).filter(
      s => s && s.totalAttempted > 0 && !completedSubjects.has(s.subject)
    );

    // If no active subjects with data, use any non-completed subject
    if (activeSubjects.length === 0) {
      const allPriorities = priorities.length > 0 
        ? priorities.sort((a, b) => a.priorityOrder - b.priorityOrder)
        : [];
      const firstActive = allPriorities.find(p => !p.isCompleted);
      return firstActive ? firstActive.subject : null;
    }

    // Create a map of priority order for quick lookup
    const priorityMap = {};
    priorities.forEach(p => {
      priorityMap[p.subject] = p.priorityOrder;
    });

    // Calculate weakness scores with priority weighting
    // Top priority subjects (lower priority_order) get a boost
    const subjectScores = activeSubjects.map(stat => {
      const priorityOrder = priorityMap[stat.subject] ?? 999; // High number if not in priorities
      const weaknessScore = (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted);
      
      // Priority boost: subjects with lower priority_order get a boost
      // But we still consider weakness score, so it's not always #1
      const priorityBoost = (15 - priorityOrder) * 2; // Max boost of ~30 for top priority
      const finalScore = weaknessScore + priorityBoost;
      
      return {
        subject: stat.subject,
        weaknessScore,
        priorityOrder,
        finalScore
      };
    });

    // Sort by final score (higher = weaker + higher priority)
    subjectScores.sort((a, b) => b.finalScore - a.finalScore);

    // Use weighted random selection: top 3 subjects have higher chance
    // This ensures top priority gets more consideration but not always #1
    const topCandidates = subjectScores.slice(0, Math.min(3, subjectScores.length));
    if (topCandidates.length > 0) {
      // 60% chance for #1, 30% for #2, 10% for #3
      const rand = Math.random();
      if (rand < 0.6) {
        return topCandidates[0].subject;
      } else if (rand < 0.9 && topCandidates.length > 1) {
        return topCandidates[1].subject;
      } else if (topCandidates.length > 2) {
        return topCandidates[2].subject;
      }
      return topCandidates[0].subject;
    }

    return subjectScores[0]?.subject || null;
  } catch (error) {
    console.error('Error selecting focus subject:', error);
    // Fallback to old method
    const stats = await calculateSubjectStats();
    const subjectsWithData = Object.values(stats).filter(s => s && s.totalAttempted > 0);
    if (subjectsWithData.length > 0) {
      const weaknessScores = subjectsWithData.map(stat => ({
        subject: stat.subject,
        weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
      }));
      weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
      return weaknessScores[0].subject;
    }
    return null;
  }
};

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

/**
 * Filter questions by type (all, answered, never-seen)
 * @param {string[]} questionIds - Array of question IDs to filter
 * @param {string} filterType - 'all' | 'answered' | 'never-seen'
 * @returns {Promise<string[]>} Filtered question IDs
 */
export const filterQuestionsByType = async (questionIds, filterType = 'all') => {
  try {
    if (filterType === 'all') {
      return questionIds;
    }
    
    const answeredIds = await getAnsweredQuestionIds();
    const answeredSet = new Set(answeredIds);
    
    if (filterType === 'answered') {
      // Only return questions that have been answered
      return questionIds.filter(id => answeredSet.has(id));
    } else if (filterType === 'never-seen') {
      // Only return questions that have never been answered
      return questionIds.filter(id => !answeredSet.has(id));
    }
    
    return questionIds;
  } catch (error) {
    console.error('Error filtering questions by type:', error);
    // On error, return all questions
    return questionIds;
  }
};
