import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { createExam } from './examService';
import { OFFICIAL_SUBJECTS } from '../utils/constants';

const QUESTIONS_COLLECTION = 'questions';

/**
 * Subject name mapping - maps common variations to official subject names
 */
const SUBJECT_MAPPING = {
  'fundamental of database systems': 'Database Systems',
  'fundamentals of database systems': 'Database Systems',
  'database systems': 'Database Systems',
  'advance database systems': 'Database Systems',
  'advanced database systems': 'Database Systems',
  'computer organization and architecture': 'Computer Organization and Architecture',
  'computer organization & architecture': 'Computer Organization and Architecture',
  'data structure and algorithms': 'Data Structures and Algorithms',
  'data structures and algorithm': 'Data Structures and Algorithms',
  'data structures and algorithms': 'Data Structures and Algorithms',
  'object oriented programming': 'Object Oriented Programming',
  'oop': 'Object Oriented Programming',
  'design and analysis of algorithms': 'Design and Analysis of Algorithms',
  'web programming': 'Web Programming',
  'software engineering': 'Software Engineering',
  'operating system': 'Operating System',
  'operating systems': 'Operating System',
  'data communication and computer networking': 'Data Communication and Computer Networking',
  'computer networking': 'Data Communication and Computer Networking',
  'computer security': 'Computer Security',
  'network and system administration': 'Network and System Administration',
  'introduction to artificial intelligence': 'Introduction to Artificial Intelligence',
  'artificial intelligence': 'Introduction to Artificial Intelligence',
  'ai': 'Introduction to Artificial Intelligence',
  'automata and complexity theory': 'Automata and Complexity Theory',
  'compiler design': 'Compiler Design',
  'computer programming': 'Computer Programming',
};

/**
 * Normalize subject name - maps variations to official subject name
 */
const normalizeSubject = (subject) => {
  if (!subject || typeof subject !== 'string') {
    return null;
  }
  
  const normalized = subject.trim();
  const lowerNormalized = normalized.toLowerCase();
  
  // Check exact match first
  if (OFFICIAL_SUBJECTS.includes(normalized)) {
    return normalized;
  }
  
  // Check mapping
  if (SUBJECT_MAPPING[lowerNormalized]) {
    return SUBJECT_MAPPING[lowerNormalized];
  }
  
  // Try case-insensitive match
  const caseInsensitiveMatch = OFFICIAL_SUBJECTS.find(
    official => official.toLowerCase() === lowerNormalized
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }
  
  return null;
};

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
  
  // Check if it's a letter-based answer (will be converted later) or actual choice text
  const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
  const letter = q.correctAnswer.trim().toUpperCase();
  const isLetterAnswer = letterMap.hasOwnProperty(letter);
  const isActualChoice = q.choices.some(c => String(c).trim() === q.correctAnswer.trim());
  
  if (!isLetterAnswer && !isActualChoice) {
    throw new Error(`correctAnswer "${q.correctAnswer}" must be one of the choices or a letter (A, B, C, D, E)`);
  }
  if (!q.subject || typeof q.subject !== 'string') {
    throw new Error('Question must have a subject');
  }
  
  const normalizedSubject = normalizeSubject(q.subject);
  if (!normalizedSubject) {
    const suggestions = OFFICIAL_SUBJECTS.filter(s => 
      s.toLowerCase().includes(q.subject.toLowerCase()) || 
      q.subject.toLowerCase().includes(s.toLowerCase())
    );
    const suggestionText = suggestions.length > 0 
      ? ` Did you mean: ${suggestions.join(', ')}?`
      : '';
    throw new Error(`Subject "${q.subject}" is not recognized.${suggestionText} Available subjects: ${OFFICIAL_SUBJECTS.join(', ')}`);
  }
  
  if (!q.explanation || typeof q.explanation !== 'string') {
    throw new Error('Question must have an explanation');
  }
  return normalizedSubject;
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
        // Validate question and get normalized subject
        const normalizedSubject = validateQuestion(q);

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
        // Otherwise, assume it's already the actual choice text (like firstQeastion.json format)
        
        // Final verification: correctAnswer must match one of the choices exactly
        if (!trimmedChoices.includes(trimmedCorrectAnswer)) {
          throw new Error(`correctAnswer "${trimmedCorrectAnswer}" not found in choices. Available: ${trimmedChoices.join(', ')}`);
        }

        const questionData = {
          question: String(q.question).trim(),
          choices: trimmedChoices,
          correctAnswer: trimmedCorrectAnswer,
          explanation: String(q.explanation).trim(),
          subject: normalizedSubject, // Use normalized subject
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
          question: (q.question ? String(q.question).substring(0, 100) : 'Unknown'),
          subject: q.subject || 'Unknown'
        });
      }
    }

    if (questionIds.length === 0) {
      const errorDetails = errors.length > 0 
        ? `\n\nFirst few errors:\n${errors.slice(0, 10).map(e => `  Question ${e.index} (${e.subject}): ${e.error}`).join('\n')}`
        : '';
      throw new Error(`No valid questions were uploaded. All ${questionsJson.length} question(s) failed validation.${errorDetails}\n\nPlease check:\n- correctAnswer must exactly match one of the choices\n- subject must be one of the 15 official subjects (common variations are automatically mapped)\n- All required fields (question, choices, correctAnswer, explanation, subject) must be present`);
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

