import { get, getAll, post } from './apiClient';

/**
 * Save an attempt (answer to a question)
 * 
 * Outside an exam session this always creates a new attempt, so analysis data is preserved
 * even when exams are restarted. With a `sessionId`, the server keeps one attempt per
 * session and question (pause and finish both submit the answers given so far).
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
    return await getAll('/attempts/');
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
    return await getAll('/attempts/', { subject });
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
    return await getAll('/attempts/', { subject, topic });
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
    return await getAll('/attempts/', { questionId });
  } catch (error) {
    console.error('Error fetching attempts by question ID:', error);
    throw error;
  }
};
