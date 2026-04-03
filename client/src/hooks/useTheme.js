import { useState, useEffect, useCallback } from 'react';

const DEFAULTS = {
  accent:    '#25d366',
  accentDim: '#128c7e',
  bubbleOut: '#dcf8c6',
  bg:        '#f0f2f5',
  panel:     '#ffffff',
  text:      '#111827',
};

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--accent',      theme.accent);
  root.style.setProperty('--accent-dim',  theme.accentDim);
  root.style.setProperty('--bubble-out',  theme.bubbleOut);
  root.style.setProperty('--bg',          theme.bg);
  root.style.setProperty('--panel',       theme.panel);
  root.style.setProperty('--text',        theme.text);
  // hover e surface derivam do bg
  root.style.setProperty('--hover',       theme.bg);
  root.style.setProperty('--surface',     theme.panel);
  root.style.setProperty('--input-bg',    theme.panel);
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('vibe_theme');
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((updates) => {
    setThemeState(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('vibe_theme', JSON.stringify(next));
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    localStorage.removeItem('vibe_theme');
    setThemeState({ ...DEFAULTS });
  }, []);

  return { theme, setTheme, resetTheme, defaults: DEFAULTS };
}
