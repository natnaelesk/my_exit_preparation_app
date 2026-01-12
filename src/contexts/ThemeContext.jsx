import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { VS_CODE_THEMES, getThemeById, getDefaultThemeForMode } from '../utils/vscodeThemes';
import { getThemePreferences, saveThemePreferences } from '../services/themeService';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Check if current time is night (Ethiopia time: morning is after 6 AM, night is after 6 PM)
// Dark mode: 6 PM (18:00) to 6 AM (06:00)
// Light mode: 6 AM (06:00) to 6 PM (18:00)
const shouldUseDarkMode = () => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6; // Dark mode from 6 PM to 6 AM
};

// Get initial mode based on time or saved preference
const getInitialMode = () => {
  const savedAutoMode = localStorage.getItem('themeAutoMode');
  if (savedAutoMode === 'true') {
    return shouldUseDarkMode() ? 'dark' : 'light';
  }
  const savedMode = localStorage.getItem('themeMode');
  return savedMode || (shouldUseDarkMode() ? 'dark' : 'light');
};

// Get initial theme ID
const getInitialThemeId = (mode) => {
  const savedThemeId = localStorage.getItem('themeId');
  if (savedThemeId && VS_CODE_THEMES[savedThemeId]) {
    const savedTheme = VS_CODE_THEMES[savedThemeId];
    // If saved theme matches current mode, use it
    if (savedTheme.mode === mode) {
      return savedThemeId;
    }
  }
  // Otherwise use default for current mode
  return getDefaultThemeForMode(mode);
};

export const ThemeProvider = ({ children }) => {
  const initialMode = getInitialMode();
  const initialThemeId = getInitialThemeId(initialMode);
  
  const [autoMode, setAutoMode] = useState(() => {
    const saved = localStorage.getItem('themeAutoMode');
    return saved === 'true'; // Default to manual (false)
  });

  const [mode, setMode] = useState(initialMode);
  const [themeId, setThemeId] = useState(initialThemeId);
  const [favoriteLightTheme, setFavoriteLightTheme] = useState('light');
  const [favoriteDarkTheme, setFavoriteDarkTheme] = useState('dark');
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  // Apply theme colors to CSS variables
  const applyTheme = useCallback((theme) => {
    const root = document.documentElement;
    root.style.setProperty('--color-bg', theme.colors.bg);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-card', theme.colors.card);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-muted', theme.colors.muted);
    // Apply primary color if defined, otherwise use default indigo
    if (theme.colors.primary) {
      root.style.setProperty('--color-primary-500', theme.colors.primary);
      // Generate lighter and darker shades for primary color
      const [r, g, b] = theme.colors.primary.split(' ').map(Number);
      root.style.setProperty('--color-primary-400', `${Math.min(255, r + 30)} ${Math.min(255, g + 30)} ${Math.min(255, b + 30)}`);
      root.style.setProperty('--color-primary-600', `${Math.max(0, r - 20)} ${Math.max(0, g - 20)} ${Math.max(0, b - 20)}`);
      root.style.setProperty('--color-primary-700', `${Math.max(0, r - 40)} ${Math.max(0, g - 40)} ${Math.max(0, b - 40)}`);
    } else {
      // Default indigo
      root.style.setProperty('--color-primary-500', '99 102 241');
      root.style.setProperty('--color-primary-400', '129 140 248');
      root.style.setProperty('--color-primary-600', '79 70 229');
      root.style.setProperty('--color-primary-700', '67 56 202');
    }
  }, []);

  // Load theme preferences from API on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await getThemePreferences();
        setFavoriteLightTheme(preferences.favoriteLightTheme || 'light');
        setFavoriteDarkTheme(preferences.favoriteDarkTheme || 'dark');
        
        // If auto mode is enabled in preferences, use it
        if (preferences.autoMode !== undefined) {
          setAutoMode(preferences.autoMode);
          localStorage.setItem('themeAutoMode', String(preferences.autoMode));
        }
        
        // If in auto mode, use favorite themes
        if (preferences.autoMode && preferences.autoMode !== false) {
          const currentMode = shouldUseDarkMode() ? 'dark' : 'light';
          const favoriteTheme = currentMode === 'dark' 
            ? (preferences.favoriteDarkTheme || 'dark')
            : (preferences.favoriteLightTheme || 'light');
          setMode(currentMode);
          setThemeId(favoriteTheme);
        }
      } catch (error) {
        console.error('Error loading theme preferences:', error);
      } finally {
        setLoadingPreferences(false);
      }
    };
    
    loadPreferences();
  }, []);

  // Initialize theme on mount (after preferences load)
  useEffect(() => {
    if (loadingPreferences) return;
    
    const theme = getThemeById(themeId);
    applyTheme(theme);
    
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [loadingPreferences, themeId, mode, applyTheme]);

  // Update mode based on auto mode or manual selection
  useEffect(() => {
    if (!loadingPreferences && autoMode) {
      const newMode = shouldUseDarkMode() ? 'dark' : 'light';
      setMode(newMode);
      localStorage.setItem('themeMode', newMode);
      
      // Use favorite theme for the mode
      const favoriteTheme = newMode === 'dark' ? favoriteDarkTheme : favoriteLightTheme;
      setThemeId(favoriteTheme);
      localStorage.setItem('themeId', favoriteTheme);
    }
  }, [autoMode, favoriteLightTheme, favoriteDarkTheme, loadingPreferences]);

  // Apply theme when themeId or mode changes
  useEffect(() => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
    
    // Apply dark class for Tailwind
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('themeId', themeId);
    localStorage.setItem('themeMode', mode);
  }, [themeId, mode, applyTheme]);

  // Check for time changes every minute (for auto mode)
  useEffect(() => {
    if (!autoMode || loadingPreferences) return;

    const checkTime = () => {
      const newMode = shouldUseDarkMode() ? 'dark' : 'light';
      if (newMode !== mode) {
        setMode(newMode);
        const favoriteTheme = newMode === 'dark' ? favoriteDarkTheme : favoriteLightTheme;
        setThemeId(favoriteTheme);
      }
    };

    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [autoMode, mode, favoriteLightTheme, favoriteDarkTheme, loadingPreferences]);

  const setTheme = (newThemeId) => {
    const theme = getThemeById(newThemeId);
    setThemeId(newThemeId);
    setMode(theme.mode);
    setAutoMode(false); // Disable auto mode when manually selecting theme
    localStorage.setItem('themeAutoMode', 'false');
  };

  const toggleMode = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    setAutoMode(false);
    localStorage.setItem('themeAutoMode', 'false');
    
    // Switch to default theme for new mode if current theme doesn't match
    const currentTheme = getThemeById(themeId);
    if (currentTheme.mode !== newMode) {
      const defaultThemeId = getDefaultThemeForMode(newMode);
      setThemeId(defaultThemeId);
    }
  };

  const toggleAutoMode = async () => {
    const newAutoMode = !autoMode;
    setAutoMode(newAutoMode);
    localStorage.setItem('themeAutoMode', String(newAutoMode));
    
    // Save to API
    try {
      await saveThemePreferences({
        autoMode: newAutoMode,
        favoriteLightTheme,
        favoriteDarkTheme
      });
    } catch (error) {
      console.error('Error saving auto mode preference:', error);
    }
    
    if (newAutoMode) {
      const newMode = shouldUseDarkMode() ? 'dark' : 'light';
      setMode(newMode);
      const favoriteTheme = newMode === 'dark' ? favoriteDarkTheme : favoriteLightTheme;
      setThemeId(favoriteTheme);
    }
  };

  const setFavoriteTheme = async (mode, themeId) => {
    const newFavoriteLightTheme = mode === 'light' ? themeId : favoriteLightTheme;
    const newFavoriteDarkTheme = mode === 'dark' ? themeId : favoriteDarkTheme;
    
    // Update state
    if (mode === 'light') {
      setFavoriteLightTheme(themeId);
    } else {
      setFavoriteDarkTheme(themeId);
    }
    
    // Save to API
    try {
      await saveThemePreferences({
        autoMode,
        favoriteLightTheme: newFavoriteLightTheme,
        favoriteDarkTheme: newFavoriteDarkTheme
      });
    } catch (error) {
      console.error('Error saving favorite theme:', error);
    }
    
    // If in auto mode and the mode matches, update current theme
    if (autoMode && mode === (shouldUseDarkMode() ? 'dark' : 'light')) {
      setThemeId(themeId);
    }
  };

  const currentTheme = getThemeById(themeId);

  return (
    <ThemeContext.Provider value={{ 
      mode,
      themeId,
      theme: currentTheme,
      autoMode,
      favoriteLightTheme,
      favoriteDarkTheme,
      setTheme,
      toggleMode,
      toggleAutoMode,
      setAutoMode,
      setFavoriteTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
