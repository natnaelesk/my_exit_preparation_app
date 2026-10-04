import { post } from './apiClient';
import { createExam } from './examService';
import { normalizeSubject } from '../utils/subjectNormalization';

/**
 * Validate question structure
 */
const validateQuestion = (q, subjects) => {
  if (!q.question || typeof q.question !== 'string') {
    throw new Error('Question must have a question text');
  }
  if (!q.choices || !Array.isArray(q.choices) || q.choices.length < 2) {
    throw new Error('Question must have at least 2 choices');
  }
  if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
    throw new Error('Question must have a correctAnswer');
  }
  
  // Normalize subject
  const normalizedSubject = normalizeSubject(q.subject, subjects);
  if (!normalizedSubject) {
    throw new Error(`Subject "${q.subject}" is not one of your curriculum's courses: ${subjects.join(', ')}`);
  }
  
  return normalizedSubject;
};

/**
 * Upload exam from JSON file
 */
export const uploadExamFromJSON = async (questionsJson, examTitle = 'Uploaded Exam', subjects = []) => {
  try {
    // Backward-compatible argument handling:
    // - (questionsArray, examTitle)
    // - (examTitle, questionsArray)
    // - ({ title, questions })
    if (typeof questionsJson === 'string' && Array.isArray(examTitle)) {
      const swappedTitle = questionsJson;
      questionsJson = examTitle;
      examTitle = swappedTitle;
    } else if (!Array.isArray(questionsJson) && questionsJson?.questions && Array.isArray(questionsJson.questions)) {
      examTitle = questionsJson.title || examTitle;
      questionsJson = questionsJson.questions;
    }

    if (!Array.isArray(questionsJson) || questionsJson.length === 0) {
      throw new Error('Questions must be a non-empty array');
    }

    const questionIds = [];
    const errors = [];
    const questionsToUpload = [];

    // Validate and prepare all questions
    for (let i = 0; i < questionsJson.length; i++) {
      const q = questionsJson[i];
      
      try {
        // Validate question and get normalized subject
        const normalizedSubject = validateQuestion(q, subjects);

        // Prepare question data - trim all strings
        const trimmedChoices = q.choices.map(c => String(c).trim());
        let trimmedCorrectAnswer = String(q.correctAnswer).trim();
        
        // Handle both formats:
        // 1. Letter-based format (model.json): "A", "B", "C", "D", "E" → convert to actual choice text
        // 2. Text-based format (firstQeastion.json): actual choice text → use as-is
        const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
        const letter = trimmedCorrectAnswer.toUpperCase();
        
        // If it's a single letter (A-E), convert to the corresponding choice text
        if (letter.length === 1 && letterMap.hasOwnProperty(letter) && trimmedChoices[letterMap[letter]]) {
          trimmedCorrectAnswer = trimmedChoices[letterMap[letter]];
        }
        
        // Final verification: correctAnswer must match one of the choices exactly
        if (!trimmedChoices.includes(trimmedCorrectAnswer)) {
          throw new Error(`correctAnswer "${trimmedCorrectAnswer}" not found in choices. Available: ${trimmedChoices.join(', ')}`);
        }

        const questionData = {
          questionId: q.questionId || null, // Will be generated if not provided
          question: String(q.question).trim(),
          choices: trimmedChoices,
          correctAnswer: trimmedCorrectAnswer,
          explanation: String(q.explanation || '').trim(),
          subject: normalizedSubject,
          topic: (q.topic ? String(q.topic).trim() : 'General')
        };

        questionsToUpload.push(questionData);
      } catch (error) {
        errors.push({
          index: i + 1,
          error: error.message,
          question: (q.question ? String(q.question).substring(0, 100) : 'Unknown'),
          subject: q.subject || 'Unknown'
        });
      }
    }

    if (questionsToUpload.length === 0) {
      const errorDetails = errors.length > 0 
        ? `\n\nFirst few errors:\n${errors.slice(0, 10).map(e => `  Question ${e.index} (${e.subject}): ${e.error}`).join('\n')}`
        : '';
      throw new Error(`No valid questions were uploaded. All ${questionsJson.length} question(s) failed validation.${errorDetails}\n\nPlease check:\n- correctAnswer must exactly match one of the choices\n- subject must be one of the courses in your active curriculum (close spellings are matched automatically)\n- All required fields (question, choices, correctAnswer, explanation, subject) must be present`);
    }

    // Bulk upload questions to API
    try {
      const uploadResult = await post('/questions/bulk/', { questions: questionsToUpload });
      const uploadedQuestions = uploadResult.questions || [];
      questionIds.push(...uploadedQuestions.map(q => q.questionId));
      
      // Add any errors from the API
      if (uploadResult.errors) {
        errors.push(...uploadResult.errors);
      }
    } catch (error) {
      throw new Error(`Failed to upload questions to server: ${error.message}`);
    }

    if (questionIds.length === 0) {
      throw new Error('No questions were successfully uploaded');
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
