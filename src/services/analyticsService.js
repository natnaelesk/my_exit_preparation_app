import { get } from './apiClient';
import { getAllAttempts, getAttemptsBySubject, getAttemptsByTopic } from './attemptService';
import { OFFICIAL_SUBJECTS } from '../utils/constants';
import { calculateStatus } from '../utils/statusHelpers';
import { format } from 'date-fns';
import { timestampToEthiopianDateKey } from '../utils/ethiopianTime';

/**
 * Get attempts for a specific exam
 */
export const getAttemptsByExamId = async (examId) => {
  try {
    const allAttempts = await getAllAttempts();
    return allAttempts.filter(attempt => attempt.examId === examId);
  } catch (error) {
    console.error('Error fetching attempts by exam ID:', error);
    return [];
  }
};

/**
 * Calculate subject statistics for a specific exam only
 */
export const calculateExamSubjectStats = async (examId) => {
  try {
    const examAttempts = await getAttemptsByExamId(examId);
    if (examAttempts.length === 0) {
      return {};
    }

    // Group attempts by subject
    const attemptsBySubject = {};
    examAttempts.forEach(attempt => {
      const subject = attempt.subject;
      if (!attemptsBySubject[subject]) {
        attemptsBySubject[subject] = [];
      }
      attemptsBySubject[subject].push(attempt);
    });

    // Calculate stats for each subject in this exam
    const subjectStats = {};
    Object.entries(attemptsBySubject).forEach(([subject, attempts]) => {
      const correctCount = attempts.filter(a => a.isCorrect).length;
      const wrongCount = attempts.length - correctCount;
      const accuracy = attempts.length > 0 ? (correctCount / attempts.length) * 100 : 0;

      // Determine status
      const status = calculateStatus(accuracy);

      subjectStats[subject] = {
        subject,
        totalAttempted: attempts.length,
        correctCount,
        wrongCount,
        accuracy: Math.round(accuracy * 100) / 100,
        status
      };
    });

    return subjectStats;
  } catch (error) {
    console.error('Error calculating exam subject stats:', error);
    return {};
  }
};

/**
 * Calculate statistics for all subjects
 * Uses API endpoint for efficiency
 */
export const calculateSubjectStats = async () => {
  try {
    // Use API endpoint for subject stats
    const subjectStats = await get('/analytics/subjects/');
    
    // API returns object with subject keys, but we need to add trend data
    // For now, trend will be empty - can be enhanced later
    const allAttempts = await getAllAttempts();
    
    // Build trend for each subject
    OFFICIAL_SUBJECTS.forEach(subject => {
      if (subjectStats[subject] && subjectStats[subject].totalAttempted > 0) {
        const subjectAttempts = allAttempts.filter(a => a.subject === subject);
        
        // Build trend (group by date, calculate accuracy per day)
        const trendMap = {};
        subjectAttempts.forEach(attempt => {
          // Handle both legacy Firestore Timestamp objects and ISO strings from Django API
          // Use Ethiopian timezone with 6 AM day boundary
          let date;
          if (attempt.timestamp?.toDate) {
            date = attempt.timestamp.toDate();
          } else if (attempt.timestamp) {
            date = new Date(attempt.timestamp);
          } else {
            date = new Date();
          }
          const dateKey = timestampToEthiopianDateKey(date);
          if (!trendMap[dateKey]) {
            trendMap[dateKey] = { correct: 0, total: 0 };
          }
          trendMap[dateKey].total++;
          if (attempt.isCorrect) {
            trendMap[dateKey].correct++;
          }
        });

        const trend = Object.entries(trendMap)
          .map(([date, data]) => ({
            date,
            accuracy: (data.correct / data.total) * 100
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        subjectStats[subject].trend = trend;
      } else if (!subjectStats[subject]) {
        // Initialize if not present
        subjectStats[subject] = {
          subject,
          totalAttempted: 0,
          correctCount: 0,
          wrongCount: 0,
          accuracy: 0,
          status: 'N/A',
          trend: []
        };
      }
    });

    return subjectStats;
  } catch (error) {
    console.error('Error calculating subject stats:', error);
    throw error;
  }
};

/**
 * Calculate topic-level statistics within a subject
 * Uses API endpoint
 */
export const calculateTopicStats = async (subject) => {
  try {
    const response = await get('/analytics/topics/', { subject });
    const topics = Array.isArray(response.results) ? response.results : response;
    
    // Convert array to object keyed by topic
    const topicStats = {};
    topics.forEach(topic => {
      topicStats[topic.topic] = topic;
    });
    
    return topicStats;
  } catch (error) {
    console.error('Error calculating topic stats:', error);
    throw error;
  }
};

/**
 * Calculate overall accuracy trend over time (all attempts)
 * Uses API endpoint
 */
export const calculateOverallTrend = async () => {
  try {
    const trend = await get('/analytics/trend/');
    return Array.isArray(trend.results) ? trend.results : trend;
  } catch (error) {
    console.error('Error calculating overall trend:', error);
    return [];
  }
};

/**
 * Identify weak topics across all subjects
 * Returns topics sorted by weakness (lowest accuracy first)
 */
export const getWeakTopics = async (subject = null, limit = 10) => {
  try {
    let attempts;
    if (subject) {
      attempts = await getAttemptsBySubject(subject);
    } else {
      attempts = await getAllAttempts();
    }

    if (attempts.length === 0) {
      return [];
    }

    // Group by topic
    const attemptsByTopic = {};
    attempts.forEach(attempt => {
      const topicKey = `${attempt.subject}::${attempt.topic || 'Unknown'}`;
      if (!attemptsByTopic[topicKey]) {
        attemptsByTopic[topicKey] = [];
      }
      attemptsByTopic[topicKey].push(attempt);
    });

    // Calculate accuracy for each topic
    const topicAccuracies = Object.entries(attemptsByTopic).map(([topicKey, topicAttempts]) => {
      const correctCount = topicAttempts.filter(a => a.isCorrect).length;
      const accuracy = (correctCount / topicAttempts.length) * 100;
      const [subject, topic] = topicKey.split('::');

      return {
        subject,
        topic,
        accuracy,
        totalAttempted: topicAttempts.length,
        correctCount,
        wrongCount: topicAttempts.length - correctCount
      };
    });

    // Sort by accuracy (weakest first) and return top N
    return topicAccuracies
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
  } catch (error) {
    console.error('Error identifying weak topics:', error);
    return [];
  }
};
