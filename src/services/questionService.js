import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db } from './firebase';

const QUESTIONS_COLLECTION = 'questions';

/**
 * Get all questions from Firestore
 */
export const getAllQuestions = async () => {
  try {
    const questionsRef = collection(db, QUESTIONS_COLLECTION);
    const snapshot = await getDocs(questionsRef);
    return snapshot.docs.map(doc => ({
      questionId: doc.id,
      ...doc.data()
    }));
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
    const questionsRef = collection(db, QUESTIONS_COLLECTION);
    const q = query(questionsRef, where('subject', '==', subject));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      questionId: doc.id,
      ...doc.data()
    }));
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
    const questionsRef = collection(db, QUESTIONS_COLLECTION);
    const q = query(
      questionsRef, 
      where('subject', '==', subject),
      where('topic', 'in', topics)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      questionId: doc.id,
      ...doc.data()
    }));
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
    const questionRef = doc(db, QUESTIONS_COLLECTION, questionId);
    const questionSnap = await getDoc(questionRef);
    
    if (questionSnap.exists()) {
      return {
        questionId: questionSnap.id,
        ...questionSnap.data()
      };
    } else {
      throw new Error('Question not found');
    }
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
    const questions = await Promise.all(
      questionIds.map(id => getQuestionById(id))
    );
    return questions;
  } catch (error) {
    console.error('Error fetching questions by IDs:', error);
    throw error;
  }
};

