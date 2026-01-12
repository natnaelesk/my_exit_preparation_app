import { get, post } from './apiClient';

/**
 * Save an attempt (answer to a question)
 * 
 * IMPORTANT: This always creates a new document.
 * Attempts are NEVER updated or deleted - this ensures analysis data
 * is preserved even when exams are restarted.
 */
export const saveAttempt = async (attemptData) => {
  try {
    const attempt = await post('/attempts/', attemptData);
    return attempt.attemptId || attempt.id;
  } catch (error) {
    console.error('Error saving attempt:', error);
    throw error;
  }
};

/**
 * Get all attempts
 */
export const getAllAttempts = async () => {
  try {
    const response = await get('/attempts/');
    return response.results || response; // Handle pagination if present
  } catch (error) {
    console.error('Error fetching all attempts:', error);
    throw error;
  }
};

/**
 * Get attempts filtered by subject
 */
export const getAttemptsBySubject = async (subject) => {
  try {
    const response = await get('/attempts/', { subject });
    return response.results || response;
  } catch (error) {
    console.error('Error fetching attempts by subject:', error);
    throw error;
  }
};

/**
 * Get attempts filtered by subject and topic
 */
export const getAttemptsByTopic = async (subject, topic) => {
  try {
    const response = await get('/attempts/', { subject, topic });
    return response.results || response;
  } catch (error) {
    console.error('Error fetching attempts by topic:', error);
    throw error;
  }
};

/**
 * Get all answered question IDs globally (across all modes/exams)
 */
export const getAnsweredQuestionIds = async () => {
  try {
    const answeredIds = await get('/attempts/answered_ids/');
    return answeredIds;
  } catch (error) {
    console.error('Error fetching answered question IDs:', error);
    throw error;
  }
};

/**
 * Get attempts for a specific question ID
 */
export const getAttemptsByQuestionId = async (questionId) => {
  try {
    const response = await get('/attempts/', { questionId });
    return response.results || response;
  } catch (error) {
    console.error('Error fetching attempts by question ID:', error);
    throw error;
  }
};
