import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { STORAGE_KEYS } from '@/constants/config';
import {
  darkTheme,
  lightTheme,
  resolveThemeName,
  type Theme,
  type ThemeSetting,
} from '@/constants/theme';
import { getItem, setItem } from '@/lib/storage';

export interface ThemeValue {
  /** The fully resolved theme (tokens the current look is built from). */
  theme: Theme;
  colors: Theme['colors'];
  spacing: Theme['spacing'];
  radii: Theme['radii'];
  typography: Theme['typography'];
  /** What the user picked: system / light / dark. */
  setting: ThemeSetting;
  /** 'light' | 'dark' after resolving `setting` against the OS scheme. */
  resolved: 'light' | 'dark';
  setSetting: (next: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Provides the app-wide theme. The choice is persisted in local storage and
 * defaults to System: `useColorScheme()` is subscribed directly, so switching
 * the OS theme (or the device's schedule) re-renders every screen that reads
 * this hook.
 *
 * Falls back to the dark theme while storage is loading, then flips once -
 * no flash of a second choice on boot.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>('system');
  const [loaded, setLoaded] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getItem<ThemeSetting>(STORAGE_KEYS.theme);
      if (cancelled) {
        return;
      }
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setSettingState(stored);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = resolveThemeName(setting, systemScheme);

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next);
    void setItem<ThemeSetting>(STORAGE_KEYS.theme, next);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const theme = resolved === 'light' ? lightTheme : darkTheme;
    return {
      theme,
      colors: theme.colors,
      spacing: theme.spacing,
      radii: theme.radii,
      typography: theme.typography,
      setting: loaded ? setting : 'system',
      resolved,
      setSetting,
    };
  }, [resolved, setting, loaded, setSetting]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Reads the current theme tokens. Every screen and component that paints
 * anything gathers its colors from here rather than a static import, so the
 * light/dark switch is instant and complete.
 */
export function useAppTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}
