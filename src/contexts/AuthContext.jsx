import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from '../services/apiClient';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // 'checking' while validating a stored token, then 'ready'; 'error' if the server could not be reached.
  const [status, setStatus] = useState(() => (getAuthToken() ? 'checking' : 'ready'));
  const [sessionError, setSessionError] = useState(null);

  const restoreSession = useCallback(async () => {
    if (!getAuthToken()) {
      setStatus('ready');
      return;
    }
    setStatus('checking');
    setSessionError(null);
    try {
      setUser(await authService.getCurrentUser());
      setStatus('ready');
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setStatus('ready');
      } else {
        setSessionError(error);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const loggedIn = await authService.login(credentials);
    setUser(loggedIn);
    return loggedIn;
  };

  const signup = async (details) => {
    const created = await authService.signup(details);
    setUser(created);
    return created;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const discardSession = () => {
    setAuthToken(null);
    setUser(null);
    setSessionError(null);
    setStatus('ready');
  };

  return (
    <AuthContext.Provider value={{
      user,
      status,
      sessionError,
      login,
      signup,
      logout,
      retrySession: restoreSession,
      discardSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
