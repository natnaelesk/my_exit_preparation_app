import { get, del } from './apiClient';

const COLLECTIONS = [
  'questions',
  'exams',
  'attempts',
  'sessions'
];

/**
 * Reset all data - deletes all documents from all collections
 * WARNING: This is irreversible!
 * Note: This requires DELETE endpoints to be implemented in the backend
 */
export const resetAllData = async () => {
  try {
    console.log('Starting data reset...');
    const results = {};

    // Note: This would require DELETE endpoints for each collection
    // For now, return a message that this needs backend implementation
    return {
      success: false,
      error: 'Reset functionality requires DELETE endpoints in the backend API',
      message: 'Data reset is not yet implemented for Django backend. Please use Django admin or implement DELETE endpoints.'
    };
  } catch (error) {
    console.error('Error resetting data:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error deleting data: ' + error.message
    };
  }
};

/**
 * Get counts of documents in each collection (for verification)
 */
export const getCollectionCounts = async () => {
  try {
    const counts = {};

    // Get counts from API endpoints
    try {
      const questions = await get('/questions/');
      counts.questions = Array.isArray(questions.results) ? questions.results.length : (Array.isArray(questions) ? questions.length : 0);
    } catch (e) {
      counts.questions = 0;
    }

    try {
      const exams = await get('/exams/');
      counts.exams = Array.isArray(exams.results) ? exams.results.length : (Array.isArray(exams) ? exams.length : 0);
    } catch (e) {
      counts.exams = 0;
    }

    try {
      const attempts = await get('/attempts/');
      counts.attempts = Array.isArray(attempts.results) ? attempts.results.length : (Array.isArray(attempts) ? attempts.length : 0);
    } catch (e) {
      counts.attempts = 0;
    }

    try {
      const sessions = await get('/sessions/');
      counts.examSessions = Array.isArray(sessions.results) ? sessions.results.length : (Array.isArray(sessions) ? sessions.length : 0);
    } catch (e) {
      counts.examSessions = 0;
    }

    return counts;
  } catch (error) {
    console.error('Error getting collection counts:', error);
    throw error;
  }
};
