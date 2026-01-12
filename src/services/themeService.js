import { get, put } from './apiClient';

/**
 * Get theme preferences from API
 */
export const getThemePreferences = async () => {
  try {
    const preferences = await get('/settings/theme/');
    return preferences;
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
 * Save theme preferences to API
 */
export const saveThemePreferences = async (preferences) => {
  try {
    await put('/settings/theme/', preferences);
  } catch (error) {
    console.error('Error saving theme preferences:', error);
    throw error;
  }
};
