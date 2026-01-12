import { get, post } from './apiClient';

/**
 * Get all exams from API
 */
export const getAllExams = async () => {
  try {
    const response = await get('/exams/');
    return response.results || response; // Handle pagination if present
  } catch (error) {
    console.error('Error fetching all exams:', error);
    throw error;
  }
};

/**
 * Get a single exam by ID
 */
export const getExamById = async (examId) => {
  try {
    const exam = await get(`/exams/${examId}/`);
    return exam;
  } catch (error) {
    console.error('Error fetching exam by ID:', error);
    throw error;
  }
};

/**
 * Create a new exam with questions
 */
export const createExam = async (title, questionIds) => {
  try {
    const examData = {
      title,
      questionIds
    };
    const exam = await post('/exams/', examData);
    return exam;
  } catch (error) {
    console.error('Error creating exam:', error);
    throw error;
  }
};
