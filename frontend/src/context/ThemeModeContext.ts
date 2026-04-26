import { createContext, useContext } from 'react';

interface ThemeModeContextValue {
  mode: 'dark' | 'light';
  toggle: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  toggle: () => {},
});

export function useThemeModeContext() {
  return useContext(ThemeModeContext);
}
