import { useColorScheme } from 'react-native';

/**
 * Single source of truth for all visual styling in the app.
 *
 * Every color lives in one of the two palettes below (light/dark). Screens and
 * components never hard-code hex values — they read the resolved theme through
 * `useAppTheme()` (hooks/useAppTheme.tsx), so switching the theme re-styles
 * everything from these tokens alone.
 *
 * Dark values are the app's original palette, kept byte-for-byte so the current
 * look is unchanged. Light values are the warm-cream scheme from the release
 * spec. `primary`, `danger`, and everything sitting ON an accent or on an image
 * scrim are identical in both themes so buttons and photo badges read clearly
 * everywhere.
 */

export type Palette = {
  /** Screen background. */
  background: string;
  /** Cards, header bars, sticky footers. */
  surface: string;
  /** Raised elements inside cards: chips, badges, secondary buttons. */
  surfaceLighter: string;
  /** Hairline separators and card outlines. */
  border: string;
  textPrimary: string;
  textSecondary: string;
  /** Body-size danger text (icons/graphs can use `danger` directly). */
  dangerText: string;
  /** Accent blue — identical in both themes. */
  primary: string;
  /** Text/icons sitting on `primary`. */
  onPrimary: string;
  danger: string;
  onDanger: string;
  /** Dark translucent veil laid over scan thumbnails (badges, page numbers). */
  scrim: string;
  /** Text/icons sitting on `scrim` — always white. */
  onScrim: string;
  /** Faint accent tint behind icon chips. */
  primarySoft: string;
  /** Highlight behind the active tab icon — lighter in dark so the accent
   *  icon stays ≥3:1 on it (dark `primarySoft` is tuned for chips on chips). */
  accentPill: string;  /** Faint danger tint behind destructive icon chips. */
  dangerSoft: string;
  /** Deep red for small destructive badges over thumbnails. */
  dangerDeep: string;
  /** Full-screen modal backdrop (behind sheets/dialogs). */
  backdrop: string;
  /** Solid stage behind photos being manipulated (crop editor). */
  imageStage: string;
};

export const darkPalette: Palette = {
  background: '#09090B',
  surface: '#18181B',
  surfaceLighter: '#27272A',
  border: '#3F3F46',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  dangerText: '#EF4444',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  danger: '#EF4444',
  onDanger: '#FFFFFF',
  scrim: 'rgba(9, 9, 11, 0.72)',
  onScrim: '#FFFFFF',
  primarySoft: 'rgba(37, 99, 235, 0.18)',
  accentPill: 'rgba(37, 99, 235, 0.10)',
  dangerSoft: 'rgba(220, 38, 38, 0.12)',
  dangerDeep: '#B91C1C',
  backdrop: 'rgba(0, 0, 0, 0.55)',
  imageStage: '#030303',
};

export const lightPalette: Palette = {
  background: '#F7F3EC',
  surface: '#FFFFFF',
  surfaceLighter: '#F1EDE4',
  border: '#E4DED2',
  textPrimary: '#09090B',
  // Warmed gray, tuned to clear WCAG AA (4.5:1) on surface, surfaceLighter
  // and background alike (spec value #8A857B measured only 3.1–3.7).
  textSecondary: '#6E695F',
  // #EF4444 stays the button fill, but as *text* on warm light surfaces it
  // measures 3.2–3.8, so small red labels use this darker red. The dark
  // theme keeps #EF4444 (5.3:1 on its near-black surfaces).
  dangerText: '#B91C1C',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  danger: '#EF4444',
  onDanger: '#FFFFFF',
  scrim: 'rgba(9, 9, 11, 0.72)',
  onScrim: '#FFFFFF',
  primarySoft: 'rgba(37, 99, 235, 0.08)',
  accentPill: 'rgba(37, 99, 235, 0.08)',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  dangerDeep: '#B91C1C',
  backdrop: 'rgba(0, 0, 0, 0.55)',
  imageStage: '#030303',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  round: 999,
} as const;

export const typography = {
  screenTitle: {
    fontSize: 23,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  secondary: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  badge: {
    fontSize: 11,
    fontWeight: '500',
  },
} as const;

/** Elevation cards get over the background, per theme (dark relies on border). */
export const cardShadow = {
  dark: '0 1px 2px rgba(0, 0, 0, 0.35)',
  light: '0 1px 3px rgba(9, 9, 11, 0.08), 0 1px 2px rgba(9, 9, 11, 0.06)',
};

export interface Theme {
  name: 'light' | 'dark';
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

export const lightTheme: Theme = {
  name: 'light',
  colors: lightPalette,
  spacing,
  radii,
  typography,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: darkPalette,
  spacing,
  radii,
  typography,
};

/** What the user picked in Settings (persisted). */
export type ThemeSetting = 'system' | 'light' | 'dark';

export function resolveThemeName(
  setting: ThemeSetting,
  systemScheme: 'light' | 'dark' | null | undefined | 'unspecified',
): 'light' | 'dark' {
  if (setting === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }
  return setting;
}

/** Convenience for consumers that only need the scheme, outside the provider. */
export function useSystemColorScheme(): 'light' | 'dark' | null | undefined {
  const scheme = useColorScheme();
  return scheme === 'light' ? 'light' : scheme === 'dark' ? 'dark' : null;
}
