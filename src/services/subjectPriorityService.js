import { get, patch, post } from './apiClient';

/**
 * Get all subject priorities
 */
export const getSubjectPriorities = async () => {
  try {
    const priorities = await get('/subject-priorities/');
    return Array.isArray(priorities) ? priorities : [];
  } catch (error) {
    console.error('Error fetching subject priorities:', error);
    throw error;
  }
};

/**
 * Reorder subjects by priority
 * @param {string[]} order - Array of subject names in desired order
 */
export const reorderSubjects = async (order) => {
  try {
    const result = await patch('/subject-priorities/reorder/', { order });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error reordering subjects:', error);
    throw error;
  }
};

/**
 * Toggle completion status for a subject
 * @param {string} subject - Subject name
 */
export const toggleSubjectCompletion = async (subject) => {
  try {
    const result = await patch(`/subject-priorities/${encodeURIComponent(subject)}/toggle/`, {});
    return result;
  } catch (error) {
    console.error('Error toggling subject completion:', error);
    throw error;
  }
};

/**
 * Reset all subjects for round two (uncheck all, increment round)
 */
export const startRoundTwo = async () => {
  try {
    const result = await post('/subject-priorities/round-two/', {});
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error starting round two:', error);
    throw error;
  }
};

