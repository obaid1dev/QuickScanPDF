# Styling stacks

Load this before writing styles in a project, or when creating a theme file for a specific stack.

---

## Detect the stack first

Check `package.json` dependencies:

- `nativewind` → inspect the NativeWind setup, then use `className` and the existing Tailwind tokens.
- `styled-components` → tagged template literals with `ThemeProvider`.
- `@shopify/restyle` → `Box`/`Text` primitives with theme tokens.
- None of the above → `StyleSheet.create`.

| Stack                      | Pattern                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `StyleSheet.create`        | Plain RN objects, no runtime overhead, best for performance-critical components                      |
| `NativeWind` / Tailwind    | `className` prop on RN core components, semantic utility classes, design tokens in `tailwind.config` |
| `styled-components/native` | Tagged template literals, theme via `ThemeProvider`, interpolated theme tokens                       |
| `@shopify/restyle`         | Type-safe theme system, `Box`/`Text` primitives, enforces design tokens                              |

Regardless of stack:

- Never hardcode colors — reference a theme token or a Tailwind semantic color.
- **Check tokens of visually adjacent elements** (a badge border and its container, a floating dot and the surface under it). On dark themes, two tokens a few points of lightness apart produce a visible unintended ring. Use the same token or drop the border.
- Never mix styling approaches within one component.
- Prefer composition (`<Card>`, `<Row>`, `<Stack>`) over deeply nested one-off styles.

---

## NativeWind / Tailwind

If `nativewind` or `tailwindcss` is in the project, read these before editing anything:

- `package.json` — dependencies, scripts, Expo or not
- `tailwind.config.js|cjs|ts` — content globs, presets, theme extension, plugins
- `global.css` (or the configured CSS input) — Tailwind directives, theme variables, custom layers
- `babel.config.js|cjs` — `nativewind/babel` and `jsxImportSource`
- `metro.config.js|cjs` — `withNativeWind(...)`
- `nativewind-env.d.ts` — TypeScript support, when present

NativeWind conventions, not web-Tailwind assumptions:

- `className` works on core RN components and on custom components that forward props.
- Third-party components may not accept `className`; that needs `remapProps` or `cssInterop`. Use those when needed, not by default.
- If the project has semantic tokens (in `tailwind.config` or CSS variables), stay inside them instead of adding ad-hoc utility colors.
- Dark mode: follow the project's current approach — `dark:` variants, or `useColorScheme` / `colorScheme` integration.
- Mixing `className` and inline `style`: inline only for computed values, runtime measurements, or props without a utility.

**Theme from scratch** (every text/surface pair below measured with `scripts/contrast.mjs`):

```javascript
// tailwind.config.js — complete dark theme
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#070B11',
          main: '#0C1219',
          elevated: '#141C27',
          overlay: 'rgba(0,0,0,0.6)',
        },
        accent: {
          DEFAULT: '#2DD4BF', // 10.10:1 on surface-main
          container: '#14B8A6',
          on: '#0C1219', // text on accent-container: 7.55:1 (white would be 2.48:1)
          subtle: '#0D2D28',
        },
        content: {
          primary: '#F1F5F9', // 15.64:1 on surface-elevated
          secondary: '#94A3B8', // 6.68:1 on surface-elevated
          tertiary: '#7D8CA3', // 5.02:1 on surface-elevated
          disabled: '#475569', // exempt from contrast
        },
        semantic: {
          success: '#22C55E',
          warning: '#FBBF24',
          error: '#EF4444',
          info: '#3B82F6',
        },
        border: {
          DEFAULT: '#334155',
          subtle: 'rgba(148, 163, 184, 0.08)',
          accent: 'rgba(45, 212, 191, 0.35)',
        },
      },
      fontFamily: {
        display: ['DMSerifDisplay_400Regular'],
        body: ['DMSans_400Regular'],
        'body-bold': ['DMSans_700Bold'],
      },
      borderRadius: {
        sm: '4px',
        md: '12px',
        lg: '16px',
      },
    },
  },
};
```

---

## styled-components/native

Theme structure that matches the token architecture in `color-system.md`:

```typescript
export const darkTheme = {
  colors: {
    surface: { /* base, main, elevated, overlay, interactive */ },
    accent: { /* main, container, subtle, onAccent */ },
    text: { /* primary, secondary, tertiary, disabled, onColor */ },
    border: { /* default, subtle, strong, accent */ },
    semantic: { /* success, warning, error, info */ },
  },
  typography: {
    /* full scale: fontFamily, fontSize, lineHeight per step */
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 4, md: 12, lg: 16, full: 9999 },
};

// Type the theme once so every styled component autocompletes tokens:
// declare module 'styled-components/native' { export interface DefaultTheme extends AppTheme {} }
```
