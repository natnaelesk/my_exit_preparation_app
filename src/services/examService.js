import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

const EXAMS_COLLECTION = 'exams';

/**
 * Get all exams from Firestore
 */
export const getAllExams = async () => {
  try {
    const examsRef = collection(db, EXAMS_COLLECTION);
    const snapshot = await getDocs(examsRef);
    return snapshot.docs.map(doc => ({
      examId: doc.id,
      ...doc.data()
    }));
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
    const examRef = doc(db, EXAMS_COLLECTION, examId);
    const examSnap = await getDoc(examRef);
    
    if (examSnap.exists()) {
      return {
        examId: examSnap.id,
        ...examSnap.data()
      };
    } else {
      throw new Error('Exam not found');
    }
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
    const examsRef = collection(db, EXAMS_COLLECTION);
    const examData = {
      title,
      questionIds,
      createdAt: Timestamp.now()
    };
    const docRef = await addDoc(examsRef, examData);
    return {
      examId: docRef.id,
      ...examData
    };
  } catch (error) {
    console.error('Error creating exam:', error);
    throw error;
  }
};

