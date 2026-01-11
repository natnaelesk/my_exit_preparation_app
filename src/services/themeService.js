import { 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { db } from './firebase';

const THEME_PREFERENCES_DOC = 'themePreferences';
const THEME_PREFERENCES_COLLECTION = 'settings';

/**
 * Get theme preferences from Firestore
 */
export const getThemePreferences = async () => {
  try {
    const prefRef = doc(db, THEME_PREFERENCES_COLLECTION, THEME_PREFERENCES_DOC);
    const prefSnap = await getDoc(prefRef);
    
    if (prefSnap.exists()) {
      return prefSnap.data();
    }
    // Return defaults if no preferences exist
    return {
      favoriteLightTheme: 'light',
      favoriteDarkTheme: 'dark',
      autoMode: false
    };
  } catch (error) {
    console.error('Error fetching theme preferences:', error);
    // Return defaults on error
    return {
      favoriteLightTheme: 'light',
      favoriteDarkTheme: 'dark',
      autoMode: false
    };
  }
};

/**
 * Save theme preferences to Firestore
 */
export const saveThemePreferences = async (preferences) => {
  try {
    const prefRef = doc(db, THEME_PREFERENCES_COLLECTION, THEME_PREFERENCES_DOC);
    await setDoc(prefRef, preferences, { merge: true });
  } catch (error) {
    console.error('Error saving theme preferences:', error);
    throw error;
  }
};

