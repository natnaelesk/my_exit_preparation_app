import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

const ATTEMPTS_COLLECTION = 'attempts';

/**
 * Save an attempt (answer to a question)
 * 
 * IMPORTANT: This uses addDoc which ALWAYS creates a new document.
 * Attempts are NEVER updated or deleted - this ensures analysis data
 * is preserved even when exams are restarted.
 */
export const saveAttempt = async (attemptData) => {
  try {
    const attemptsRef = collection(db, ATTEMPTS_COLLECTION);
    const attempt = {
      ...attemptData,
      timestamp: Timestamp.now()
    };
    // Always creates new document - never overwrites existing attempts
    const docRef = await addDoc(attemptsRef, attempt);
    return docRef.id;
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
    const attemptsRef = collection(db, ATTEMPTS_COLLECTION);
    const snapshot = await getDocs(attemptsRef);
    return snapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    }));
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
    const attemptsRef = collection(db, ATTEMPTS_COLLECTION);
    const q = query(attemptsRef, where('subject', '==', subject));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    }));
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
    const attemptsRef = collection(db, ATTEMPTS_COLLECTION);
    const q = query(
      attemptsRef, 
      where('subject', '==', subject),
      where('topic', '==', topic)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    }));
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
    const attempts = await getAllAttempts();
    const answeredIds = new Set(attempts.map(attempt => attempt.questionId));
    return Array.from(answeredIds);
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
    const attemptsRef = collection(db, ATTEMPTS_COLLECTION);
    const q = query(attemptsRef, where('questionId', '==', questionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching attempts by question ID:', error);
    throw error;
  }
};

