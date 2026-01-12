import { get, post } from './apiClient';
import { normalizeSubject, normalizeTopic } from '../utils/subjectNormalization';

/**
 * Get all questions from API
 */
export const getAllQuestions = async () => {
  try {
    const response = await get('/questions/');
    return response.results || response; // Handle pagination if present
  } catch (error) {
    console.error('Error fetching all questions:', error);
    throw error;
  }
};

/**
 * Get questions filtered by subject
 */
export const getQuestionsBySubject = async (subject) => {
  try {
    const requested = String(subject || '').trim();
    const normalizedRequested = normalizeSubject(requested) || requested;

    // Try normalized subject first
    let questions = await get('/questions/', { subject: normalizedRequested });
    if (Array.isArray(questions.results)) {
      questions = questions.results;
    }
    
    if (questions.length > 0) {
      return questions;
    }

    // Try raw subject string
    if (normalizedRequested !== requested && requested) {
      questions = await get('/questions/', { subject: requested });
      if (Array.isArray(questions.results)) {
        questions = questions.results;
      }
      if (questions.length > 0) {
        return questions;
      }
    }

    // Fallback: load all and filter with normalization
    const all = await getAllQuestions();
    const allQuestions = Array.isArray(all.results) ? all.results : all;
    return allQuestions.filter((qDoc) => {
      const docSubject = normalizeSubject(qDoc.subject) || String(qDoc.subject || '').trim();
      return docSubject === normalizedRequested;
    });
  } catch (error) {
    console.error('Error fetching questions by subject:', error);
    throw error;
  }
};

/**
 * Get questions filtered by subject and topics
 */
export const getQuestionsByTopic = async (subject, topics) => {
  try {
    const requestedSubject = String(subject || '').trim();
    const normalizedRequestedSubject = normalizeSubject(requestedSubject) || requestedSubject;
    const normalizedTopics = (topics || []).map(normalizeTopic).filter(Boolean);

    // If topics <= 10, try API query (Django supports 'in' queries)
    if (normalizedTopics.length > 0 && normalizedTopics.length <= 10) {
      // Note: Django ORM 'in' query - we'll need to handle this in the view
      // For now, get by subject and filter client-side
      const subjectQuestions = await getQuestionsBySubject(normalizedRequestedSubject);
      const topicSet = new Set(normalizedTopics.map((t) => t.toLowerCase()));
      return subjectQuestions.filter((qDoc) => {
        const t = normalizeTopic(qDoc.topic || '').toLowerCase();
        return topicSet.size === 0 ? true : topicSet.has(t);
      });
    }

    // Fallback: load subject questions and filter topics in-memory
    const subjectQuestions = await getQuestionsBySubject(normalizedRequestedSubject);
    const topicSet = new Set(normalizedTopics.map((t) => t.toLowerCase()));
    return subjectQuestions.filter((qDoc) => {
      const t = normalizeTopic(qDoc.topic || '').toLowerCase();
      return topicSet.size === 0 ? true : topicSet.has(t);
    });
  } catch (error) {
    console.error('Error fetching questions by topic:', error);
    throw error;
  }
};

/**
 * Get a single question by ID
 */
export const getQuestionById = async (questionId) => {
  try {
    const question = await get(`/questions/${questionId}/`);
    return question;
  } catch (error) {
    console.error('Error fetching question by ID:', error);
    throw error;
  }
};

/**
 * Get multiple questions by IDs
 */
export const getQuestionsByIds = async (questionIds) => {
  try {
    const response = await post('/questions/bulk/', { questionIds });
    return response;
  } catch (error) {
    console.error('Error fetching questions by IDs:', error);
    throw error;
  }
};
