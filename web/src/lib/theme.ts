import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'auto' | 'day' | 'night';

const STORAGE_KEY = 'switchboard-theme';

const readPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'day' || value === 'night' ? value : 'auto';
  } catch {
    return 'auto';
  }
};

export const useThemePreference = (): [ThemePreference, (preference: ThemePreference) => void] => {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }
  }, [preference]);

  const update = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  }, []);

  return [preference, update];
};
