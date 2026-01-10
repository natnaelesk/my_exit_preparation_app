import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizeSubject, normalizeTopic } from '../utils/subjectNormalization';

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
    const requested = String(subject || '').trim();
    const normalizedRequested = normalizeSubject(requested) || requested;

    const questionsRef = collection(db, QUESTIONS_COLLECTION);

    // 1) Fast path: exact match on normalized subject.
    const q1 = query(questionsRef, where('subject', '==', normalizedRequested));
    const snap1 = await getDocs(q1);
    if (snap1.docs.length > 0) {
      return snap1.docs.map((d) => ({ questionId: d.id, ...d.data() }));
    }

    // 2) Backward-compat: exact match on raw subject string.
    if (normalizedRequested !== requested && requested) {
      const q2 = query(questionsRef, where('subject', '==', requested));
      const snap2 = await getDocs(q2);
      if (snap2.docs.length > 0) {
        return snap2.docs.map((d) => ({ questionId: d.id, ...d.data() }));
      }
    }

    // 3) Fallback: load all and match with normalization (handles old/bad subject strings).
    const all = await getAllQuestions();
    return all.filter((qDoc) => {
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

    const questionsRef = collection(db, QUESTIONS_COLLECTION);

    // Firestore "in" supports max 10 values. If more, fallback to in-memory filtering.
    if (normalizedTopics.length > 0 && normalizedTopics.length <= 10) {
      const q1 = query(
        questionsRef,
        where('subject', '==', normalizedRequestedSubject),
        where('topic', 'in', normalizedTopics)
      );
      const snap1 = await getDocs(q1);
      if (snap1.docs.length > 0) {
        return snap1.docs.map((d) => ({ questionId: d.id, ...d.data() }));
      }
    }

    // Fallback: load subject questions smart, then filter topics in-memory (more robust).
    const subjectQuestions = await getQuestionsBySubject(normalizedRequestedSubject);
    const topicSet = new Set(normalizedTopics.map((t) => t.toLowerCase()));
    return subjectQuestions.filter((qDoc) => {
      const t = normalizeTopic(qDoc.topic).toLowerCase();
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

