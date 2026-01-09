import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { createExam } from './examService';
import { OFFICIAL_SUBJECTS } from '../utils/constants';

const QUESTIONS_COLLECTION = 'questions';

/**
 * Validate question structure
 */
const validateQuestion = (q) => {
  if (!q.question || typeof q.question !== 'string') {
    throw new Error('Question must have a question text');
  }
  if (!q.choices || !Array.isArray(q.choices) || q.choices.length < 2) {
    throw new Error('Question must have at least 2 choices');
  }
  if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
    throw new Error('Question must have a correctAnswer');
  }
  if (!q.choices.includes(q.correctAnswer)) {
    throw new Error('correctAnswer must be one of the choices');
  }
  if (!q.subject || typeof q.subject !== 'string') {
    throw new Error('Question must have a subject');
  }
  if (!OFFICIAL_SUBJECTS.includes(q.subject)) {
    throw new Error(`Subject "${q.subject}" is not one of the 15 official subjects`);
  }
  if (!q.explanation || typeof q.explanation !== 'string') {
    throw new Error('Question must have an explanation');
  }
  return true;
};

/**
 * Upload questions from JSON and create exam
 * @param {string} examTitle - Title of the exam
 * @param {Array} questionsJson - Array of question objects
 */
export const uploadExamFromJSON = async (examTitle, questionsJson) => {
  try {
    if (!examTitle || examTitle.trim() === '') {
      throw new Error('Exam title is required');
    }

    if (!Array.isArray(questionsJson) || questionsJson.length === 0) {
      throw new Error('Questions must be a non-empty array');
    }

    const questionsRef = collection(db, QUESTIONS_COLLECTION);
    const questionIds = [];
    const errors = [];

    // Upload each question to Firestore
    for (let i = 0; i < questionsJson.length; i++) {
      const q = questionsJson[i];
      
      try {
        // Validate question
        validateQuestion(q);

        // Prepare question data - trim all strings
        const trimmedChoices = q.choices.map(c => String(c).trim());
        const trimmedCorrectAnswer = String(q.correctAnswer).trim();
        
        // Double-check that correctAnswer is in choices (case-sensitive exact match)
        if (!trimmedChoices.includes(trimmedCorrectAnswer)) {
          throw new Error(`correctAnswer "${trimmedCorrectAnswer}" not found in choices. Available: ${trimmedChoices.join(', ')}`);
        }

        const questionData = {
          question: String(q.question).trim(),
          choices: trimmedChoices,
          correctAnswer: trimmedCorrectAnswer,
          explanation: String(q.explanation).trim(),
          subject: String(q.subject).trim(),
          topic: (q.topic ? String(q.topic).trim() : 'General'),
          createdAt: Timestamp.now()
        };

        // Add to Firestore
        const docRef = await addDoc(questionsRef, questionData);
        questionIds.push(docRef.id);
      } catch (error) {
        // Check if it's a permissions error
        const isPermissionError = error.code === 'permission-denied' || 
                                   error.message?.includes('permission') ||
                                   error.message?.includes('Missing or insufficient permissions');
        
        if (isPermissionError && i === 0) {
          // Re-throw immediately on first permission error with clear message
          throw new Error('Firestore permission denied. Your questions are valid, but Firestore security rules are blocking writes. Please configure Firestore security rules in Firebase Console. See README.md for detailed instructions.');
        }
        
        errors.push({
          index: i + 1,
          error: error.message,
          question: (q.question ? String(q.question).substring(0, 50) : 'Unknown')
        });
      }
    }

    if (questionIds.length === 0) {
      const errorDetails = errors.length > 0 
        ? `\n\nFirst few errors:\n${errors.slice(0, 5).map(e => `  Question ${e.index}: ${e.error}`).join('\n')}`
        : '';
      throw new Error(`No valid questions were uploaded. All ${questionsJson.length} question(s) failed validation.${errorDetails}\n\nPlease check:\n- correctAnswer must exactly match one of the choices\n- subject must be one of the 15 official subjects\n- All required fields (question, choices, correctAnswer, explanation, subject) must be present`);
    }

    // Create exam with uploaded question IDs
    const exam = await createExam(examTitle, questionIds);

    return {
      exam,
      uploadedCount: questionIds.length,
      totalCount: questionsJson.length,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Error uploading exam from JSON:', error);
    throw error;
  }
};

