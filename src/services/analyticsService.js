import { getAllAttempts, getAttemptsBySubject, getAttemptsByTopic } from './attemptService';
import { OFFICIAL_SUBJECTS, STATUS_THRESHOLDS } from '../utils/constants';
import { format } from 'date-fns';

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
      let status = 'WEAK';
      if (accuracy >= STATUS_THRESHOLDS.STRONG) {
        status = 'STRONG';
      } else if (accuracy >= STATUS_THRESHOLDS.MEDIUM) {
        status = 'MEDIUM';
      }

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
 * Returns stats for each of the 15 official subjects
 */
export const calculateSubjectStats = async () => {
  try {
    const allAttempts = await getAllAttempts();
    const subjectStats = {};

    // Initialize stats for all 15 official subjects
    OFFICIAL_SUBJECTS.forEach(subject => {
      subjectStats[subject] = {
        subject,
        totalAttempted: 0,
        correctCount: 0,
        wrongCount: 0,
        accuracy: 0,
        status: 'N/A', // No attempts yet
        trend: [] // Performance over time
      };
    });

    // Group attempts by subject
    const attemptsBySubject = {};
    allAttempts.forEach(attempt => {
      const subject = attempt.subject;
      if (!attemptsBySubject[subject]) {
        attemptsBySubject[subject] = [];
      }
      attemptsBySubject[subject].push(attempt);
    });

    // Calculate stats for each subject
    OFFICIAL_SUBJECTS.forEach(subject => {
      const attempts = attemptsBySubject[subject] || [];
      if (attempts.length > 0) {
        const correctCount = attempts.filter(a => a.isCorrect).length;
        const wrongCount = attempts.length - correctCount;
        const accuracy = (correctCount / attempts.length) * 100;

        // Determine status
        let status = 'WEAK';
        if (accuracy >= STATUS_THRESHOLDS.STRONG) {
          status = 'STRONG';
        } else if (accuracy >= STATUS_THRESHOLDS.MEDIUM) {
          status = 'MEDIUM';
        }

        // Build trend (group by date, calculate accuracy per day)
        const trendMap = {};
        attempts.forEach(attempt => {
          const date = attempt.timestamp?.toDate?.()?.toDateString() || new Date().toDateString();
          if (!trendMap[date]) {
            trendMap[date] = { correct: 0, total: 0 };
          }
          trendMap[date].total++;
          if (attempt.isCorrect) {
            trendMap[date].correct++;
          }
        });

        const trend = Object.entries(trendMap)
          .map(([date, data]) => ({
            date,
            accuracy: (data.correct / data.total) * 100
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        subjectStats[subject] = {
          subject,
          totalAttempted: attempts.length,
          correctCount,
          wrongCount,
          accuracy: Math.round(accuracy * 100) / 100,
          status,
          trend
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
 */
export const calculateTopicStats = async (subject) => {
  try {
    const attempts = await getAttemptsBySubject(subject);
    
    if (attempts.length === 0) {
      return {};
    }

    // Group attempts by topic
    const attemptsByTopic = {};
    attempts.forEach(attempt => {
      const topic = attempt.topic || 'Unknown';
      if (!attemptsByTopic[topic]) {
        attemptsByTopic[topic] = [];
      }
      attemptsByTopic[topic].push(attempt);
    });

    // Calculate stats for each topic
    const topicStats = {};
    Object.entries(attemptsByTopic).forEach(([topic, topicAttempts]) => {
      const correctCount = topicAttempts.filter(a => a.isCorrect).length;
      const accuracy = (correctCount / topicAttempts.length) * 100;

      // Determine status
      let status = 'WEAK';
      if (accuracy >= STATUS_THRESHOLDS.STRONG) {
        status = 'STRONG';
      } else if (accuracy >= STATUS_THRESHOLDS.MEDIUM) {
        status = 'MEDIUM';
      }

      topicStats[topic] = {
        topic,
        subject,
        totalAttempted: topicAttempts.length,
        correctCount,
        wrongCount: topicAttempts.length - correctCount,
        accuracy: Math.round(accuracy * 100) / 100,
        status
      };
    });

    return topicStats;
  } catch (error) {
    console.error('Error calculating topic stats:', error);
    throw error;
  }
};

/**
 * Calculate overall accuracy trend over time (all attempts)
 * Groups attempts by date and calculates cumulative accuracy
 */
export const calculateOverallTrend = async () => {
  try {
    const allAttempts = await getAllAttempts();
    
    if (allAttempts.length === 0) {
      return [];
    }

    // Sort attempts by timestamp (oldest first)
    const sortedAttempts = [...allAttempts].sort((a, b) => {
      const dateA = a.timestamp?.toDate?.() || new Date(0);
      const dateB = b.timestamp?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate cumulative accuracy over time
    const trend = [];
    let cumulativeCorrect = 0;
    let cumulativeTotal = 0;

    // Group by date for smoother trend
    const dailyStats = {};
    sortedAttempts.forEach(attempt => {
      const date = attempt.timestamp?.toDate?.() || new Date();
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { correct: 0, total: 0 };
      }
      
      dailyStats[dateKey].total++;
      if (attempt.isCorrect) {
        dailyStats[dateKey].correct++;
      }
    });

    // Build cumulative trend
    Object.entries(dailyStats)
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date
      .forEach(([dateKey, stats]) => {
        cumulativeCorrect += stats.correct;
        cumulativeTotal += stats.total;
        
        const accuracy = cumulativeTotal > 0 
          ? (cumulativeCorrect / cumulativeTotal) * 100 
          : 0;

        // Parse date for display
        const date = new Date(dateKey);
        trend.push({
          date: dateKey,
          dateDisplay: format(date, 'MMM dd'),
          accuracy: Math.round(accuracy * 100) / 100,
          correct: cumulativeCorrect,
          total: cumulativeTotal
        });
      });

    return trend;
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
