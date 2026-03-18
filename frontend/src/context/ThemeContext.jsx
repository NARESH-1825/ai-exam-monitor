// frontend/src/context/ThemeContext.jsx
// Three themes: 'dark' | 'colored' | 'light'
// Persisted to localStorage. Applied as data-theme attribute on <html>.

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });

const THEMES = ['dark', 'colored', 'light'];

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem('ai-exam-theme');
    return THEMES.includes(stored) ? stored : 'dark';
  });

  const setTheme = (t) => {
    if (!THEMES.includes(t)) return;
    setThemeState(t);
    localStorage.setItem('ai-exam-theme', t);
  };

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
    root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
