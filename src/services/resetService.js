import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTIONS = [
  'questions',
  'exams',
  'attempts',
  'examSessions'
];

/**
 * Delete all documents from a collection
 */
const deleteCollection = async (collectionName) => {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`Collection ${collectionName} is already empty`);
      return { deleted: 0, errors: 0 };
    }

    // Use batch writes for efficiency (max 500 per batch)
    let totalDeleted = 0;
    let totalErrors = 0;
    const docs = snapshot.docs;
    
    // Process in batches of 500 (Firestore limit)
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + 500);
      
      batchDocs.forEach((docSnapshot) => {
        try {
          batch.delete(doc(db, collectionName, docSnapshot.id));
          totalDeleted++;
        } catch (error) {
          console.error(`Error adding delete to batch for ${docSnapshot.id}:`, error);
          totalErrors++;
        }
      });
      
      try {
        await batch.commit();
      } catch (error) {
        console.error(`Error committing batch:`, error);
        totalErrors += batchDocs.length;
      }
    }

    console.log(`Deleted ${totalDeleted} documents from ${collectionName}`);
    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error) {
    console.error(`Error deleting collection ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Reset all Firestore data - deletes all documents from all collections
 * WARNING: This is irreversible!
 */
export const resetAllData = async () => {
  try {
    console.log('Starting data reset...');
    const results = {};

    for (const collectionName of COLLECTIONS) {
      console.log(`Deleting ${collectionName}...`);
      results[collectionName] = await deleteCollection(collectionName);
    }

    console.log('Data reset complete!', results);
    return {
      success: true,
      results,
      message: 'All data has been deleted successfully'
    };
  } catch (error) {
    console.error('Error resetting data:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error deleting data: ' + error.message
    };
  }
};

/**
 * Get counts of documents in each collection (for verification)
 */
export const getCollectionCounts = async () => {
  try {
    const counts = {};

    for (const collectionName of COLLECTIONS) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      counts[collectionName] = snapshot.size;
    }

    return counts;
  } catch (error) {
    console.error('Error getting collection counts:', error);
    throw error;
  }
};

