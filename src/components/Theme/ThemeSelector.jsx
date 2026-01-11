import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { VS_CODE_THEMES, getDarkThemes, getLightThemes } from '../../utils/vscodeThemes';
import { 
  SwatchIcon, 
  MoonIcon, 
  SunIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const ThemeSelector = () => {
  const { 
    mode, 
    themeId, 
    autoMode, 
    favoriteLightTheme, 
    favoriteDarkTheme,
    setTheme, 
    toggleMode, 
    toggleAutoMode,
    setFavoriteTheme 
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const darkThemes = getDarkThemes();
  const lightThemes = getLightThemes();
  const currentTheme = VS_CODE_THEMES[themeId];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleThemeSelect = (newThemeId) => {
    // In manual mode, set theme directly
    setTheme(newThemeId);
  };

  const handleFavoriteThemeSelect = (mode, themeId) => {
    setFavoriteTheme(mode, themeId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted hover:text-text active:scale-95 flex items-center gap-1.5"
        aria-label="Theme selector"
      >
        <SwatchIcon className="w-5 h-5" />
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 md:left-full md:ml-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-[85vh]">
          {/* Header */}
          <div className="p-4 border-b border-border bg-surface/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text">Theme</h3>
              <button
                onClick={toggleAutoMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  autoMode
                    ? 'bg-primary-500/20 text-primary-500'
                    : 'bg-surface text-muted hover:text-text'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                {autoMode ? 'Auto' : 'Manual'}
              </button>
            </div>
            
            {/* Mode Toggle - Disabled in auto mode */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMode}
                disabled={autoMode}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  autoMode 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                } ${
                  mode === 'light'
                    ? 'bg-primary-500/20 text-primary-500'
                    : 'bg-surface text-muted hover:text-text'
                }`}
              >
                <SunIcon className="w-4 h-4 pointer-events-none" />
                <span className="pointer-events-none">Light</span>
              </button>
              <button
                onClick={toggleMode}
                disabled={autoMode}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  autoMode 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                } ${
                  mode === 'dark'
                    ? 'bg-primary-500/20 text-primary-500'
                    : 'bg-surface text-muted hover:text-text'
                }`}
              >
                <MoonIcon className="w-4 h-4 pointer-events-none" />
                <span className="pointer-events-none">Dark</span>
              </button>
            </div>
          </div>

          {/* Theme List */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {autoMode ? (
              /* Auto Mode - Show Favorite Theme Selection */
              <>
                {/* Favorite Light Theme */}
                <div className="p-2">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SunIcon className="w-4 h-4 text-muted" />
                      <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                        Favorite Light Theme
                      </span>
                    </div>
                    {favoriteLightTheme && (
                      <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {lightThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleFavoriteThemeSelect('light', theme.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                          favoriteLightTheme === theme.id
                            ? 'bg-primary-500/20 text-primary-500'
                            : 'hover:bg-surface text-text'
                        }`}
                      >
                        <span className="font-medium pointer-events-none">{theme.name}</span>
                        {favoriteLightTheme === theme.id && (
                          <CheckIcon className="w-4 h-4 pointer-events-none" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Favorite Dark Theme */}
                <div className="p-2 border-t border-border">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MoonIcon className="w-4 h-4 text-muted" />
                      <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                        Favorite Dark Theme
                      </span>
                    </div>
                    {favoriteDarkTheme && (
                      <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {darkThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleFavoriteThemeSelect('dark', theme.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                          favoriteDarkTheme === theme.id
                            ? 'bg-primary-500/20 text-primary-500'
                            : 'hover:bg-surface text-text'
                        }`}
                      >
                        <span className="font-medium pointer-events-none">{theme.name}</span>
                        {favoriteDarkTheme === theme.id && (
                          <CheckIcon className="w-4 h-4 pointer-events-none" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Mode Info */}
                <div className="p-3 border-t border-border bg-surface/30">
                  <p className="text-xs text-muted text-center">
                    Current: {mode === 'dark' ? 'Dark' : 'Light'} mode ({VS_CODE_THEMES[themeId]?.name})
                  </p>
                </div>
              </>
            ) : (
              /* Manual Mode - Show Regular Theme Selection */
              <>
                {/* Dark Themes */}
                {mode === 'dark' && (
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">
                      Dark Themes
                    </div>
                    <div className="space-y-1">
                      {darkThemes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeSelect(theme.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                            themeId === theme.id
                              ? 'bg-primary-500/20 text-primary-500'
                              : 'hover:bg-surface text-text'
                          }`}
                        >
                          <span className="font-medium pointer-events-none">{theme.name}</span>
                          {themeId === theme.id && (
                            <CheckIcon className="w-4 h-4 pointer-events-none" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Light Themes */}
                {mode === 'light' && (
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">
                      Light Themes
                    </div>
                    <div className="space-y-1">
                      {lightThemes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeSelect(theme.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                            themeId === theme.id
                              ? 'bg-primary-500/20 text-primary-500'
                              : 'hover:bg-surface text-text'
                          }`}
                        >
                          <span className="font-medium pointer-events-none">{theme.name}</span>
                          {themeId === theme.id && (
                            <CheckIcon className="w-4 h-4 pointer-events-none" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Info */}
          {autoMode && (
            <div className="p-3 border-t border-border bg-surface/30">
              <p className="text-xs text-muted text-center">
                Auto mode: switches to dark after 7 PM using your favorite themes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;

