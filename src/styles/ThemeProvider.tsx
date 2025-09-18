"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { defaultTheme, getTheme } from './theme';
import type { Theme } from './theme';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: defaultTheme,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);

  const setTheme = (themeName: string) => {
    const theme = getTheme(themeName);
    setCurrentTheme(theme);

    // Apply CSS variables to document root
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVarName = `--${key}`;
      root.style.setProperty(cssVarName, value);
    });

    // Save theme preference
    localStorage.setItem('theme-preference', themeName);
  };

  useEffect(() => {
    // Load saved theme preference on initial render
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Apply default theme if no preference is saved
      setTheme(defaultTheme.name);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
