import { get, post, setAuthToken } from './apiClient';

// localStorage caches that hold one user's study data; theme keys are device-level and kept.
const USER_CACHE_PREFIXES = ['exam_', 'bonus_challenge_', 'bonus_unlocked_'];

const clearUserCache = () => {
  Object.keys(localStorage)
    .filter((key) => USER_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .forEach((key) => localStorage.removeItem(key));
};

const startSession = (token) => {
  clearUserCache();
  setAuthToken(token);
};

/**
 * Flatten DRF validation errors ({ field: [messages] }) into one readable message.
 */
const toAuthError = (error) => {
  if (error.data && typeof error.data === 'object' && !error.data.error && !error.data.detail) {
    const messages = Object.values(error.data).flat().filter(Boolean);
    if (messages.length > 0) {
      const authError = new Error(messages.join(' '));
      authError.status = error.status;
      return authError;
    }
  }
  return error;
};

export const signup = async ({ username, password, email }) => {
  try {
    const { token, user } = await post('/auth/signup/', { username, password, email });
    startSession(token);
    return user;
  } catch (error) {
    throw toAuthError(error);
  }
};

export const login = async ({ username, password }) => {
  try {
    const { token, user } = await post('/auth/login/', { username, password });
    startSession(token);
    return user;
  } catch (error) {
    throw toAuthError(error);
  }
};

export const logout = async () => {
  try {
    await post('/auth/logout/');
  } catch (error) {
    console.error('Error logging out on server:', error);
  } finally {
    setAuthToken(null);
    clearUserCache();
  }
};

export const getCurrentUser = async () => get('/auth/me/');
