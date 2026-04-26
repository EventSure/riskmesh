import { useState, useEffect } from 'react';

export function useThemeMode() {
  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme-mode') as 'dark' | 'light') ?? 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  return { mode, toggle };
}
