export const colors = {
  background: '#09090B',
  surface: '#18181B',
  surfaceLighter: '#27272A',
  primary: '#2563EB',
  secondary: '#3F3F46',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  danger: '#EF4444',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

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
  secondary: {
    fontSize: 13,
    fontWeight: '400',
  },
  badge: {
    fontSize: 11,
    fontWeight: '500',
  },
} as const;
