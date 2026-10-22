# Color system

Load this when creating a theme, generating a palette from user colors, or auditing an existing palette.

---

## Contrast: measure, never estimate

Every text/surface pair you introduce or change gets measured with the bundled script (path relative to this skill's folder):

```bash
node scripts/contrast.mjs "rgba(255,255,255,0.6)" "#1C1C1E"
```

Colors with alpha are composited over the background before measuring, so the ratio is the one the user actually sees.

| Element                                             | WCAG AA minimum | Target    |
| --------------------------------------------------- | --------------- | --------- |
| Body text (anything smaller than large text)        | 4.5:1           | 7:1 (AAA) |
| Large text (≥ 24 regular, or ≥ 19 bold, in RN units) | 3:1             | 4.5:1     |
| UI components and meaningful icons                  | 3:1             | 4.5:1     |
| Disabled / purely decorative                        | none            | —         |

Reference values, exactly as the script prints them (the same pairs are in its tests):

| Pair                                  | Ratio   | Good for        |
| ------------------------------------- | ------- | --------------- |
| `rgba(255,255,255,0.87)` on `#1C1C1E` | 13.02:1 | body            |
| `rgba(255,255,255,0.60)` on `#1C1C1E` | 6.83:1  | body            |
| `rgba(255,255,255,0.38)` on `#1C1C1E` | 3.54:1  | large text only |
| `#2DD4BF` on `#0C1219`                | 10.10:1 | body            |
| `#64748B` on `#0C1219`                | 3.95:1  | large text only |
| `rgba(60,60,67,0.6)` on `#FFFFFF`     | 3.43:1  | large text only |

Rules of thumb that hold on common surfaces (`#0C1219` to `#2C2C2E` dark, `#FFFFFF` / `#F2F2F7` light):

- **White text on dark**: body text needs opacity **≥ 0.50**. Large text works from 0.35.
- **Black text on light**: body text needs opacity **≥ 0.55**.
- Apple's own `secondaryLabel` (`#3C3C43` at 60%) is 3.4:1 on white. Fine for large text, not for body. For body, go to ≥ 75%.
- **Elevated surfaces lower the ratio.** Measure text against every surface it can sit on (screen, card, sheet), not only the screen background.
- **Need a third text level for small text?** Separate it by size or weight. Dropping its opacity below the minimum is not a hierarchy, it's unreadable text.

---

## Color theory fundamentals

| Scheme                  | Definition                        | Character                                | Best for                                    |
| ----------------------- | --------------------------------- | ---------------------------------------- | ------------------------------------------- |
| **Monochromatic**       | One hue, multiple tints/shades    | Elegant, cohesive, low cognitive load    | Utility apps, dashboards, minimalist brands |
| **Analogous**           | 2-3 adjacent hues on the wheel    | Harmonious, natural, warm/cool bias      | Lifestyle, wellness, organic brands         |
| **Complementary**       | Opposite hues (180°)              | High energy, vibrant tension             | CTAs, alerts, gaming, sports                |
| **Split-complementary** | Base + two adjacent to complement | Vibrant but balanced, less harsh         | Most apps — versatile and dynamic           |
| **Triadic**             | Three hues 120° apart             | Balanced energy, colorful but controlled | Multi-category apps, social, creative tools |

## Palette generation

**From an app concept (no user colors):**

1. Identify the emotional tone → pick a dominant hue family:
   - Trust/stability → Blue (210°–240°)
   - Energy/passion → Red-Orange (0°–30°)
   - Growth/health → Green (120°–160°)
   - Creativity/luxury → Purple (270°–310°)
   - Warmth/optimism → Yellow-Orange (30°–60°)
   - Calm/nature → Teal-Cyan (170°–200°)
   - Sophistication/tech → Blue-Violet (240°–270°)
2. Choose a relationship scheme (split-complementary is the safest default).
3. Generate the full system using the token structure below.

**From user-provided colors (1-3 colors):**

1. Convert them to HSL.
2. Determine their role: accent? background? brand mark?
3. Derive the missing roles:
   - **1 accent color**: build surfaces around it (dark: desaturate + darken for backgrounds; light: tint for surfaces).
   - **2 colors**: determine their relationship, fill the remaining slots.
   - **A brand palette**: respect its hierarchy, add functional colors (semantic states, surface layers).
4. Generate tints/shades of the accent at `50, 100, 200, 300, 400, 500 (base), 600, 700, 800, 900, 950`.

**Improving an existing palette:**

1. Read ALL color tokens in the project.
2. Check for these common problems:
   - Accent too close to semantic colors (can't tell "success" from "primary").
   - Surface layers too close together to see the edge of a card.
   - Text/surface pairs below the WCAG minimums — **run the script on each pair**.
   - Too many unrelated colors.
   - Borders that create an unintended halo against their background.
3. Propose specific fixes with before → after hex values and the measured ratio of each.

---

## Token architecture — mandatory roles

Names can follow the project's convention, but these roles must exist:

```
SURFACES (background layers — establish depth)
├── base         → deepest background
├── main         → primary screen background
├── elevated     → cards, modals, floating elements
├── overlay      → scrim behind modals (semi-transparent)
└── interactive  → pressed states on surfaces

ACCENT (brand color)
├── main         → primary accent (buttons, links, active states)
├── container    → filled surfaces with accent (CTAs, badges, selected states)
├── subtle       → tinted surfaces (selected card bg)
└── on-accent    → text/icon color ON the accent fill — measure it

TEXT (foreground hierarchy)
├── primary      → titles, critical content
├── secondary    → body text, descriptions
├── tertiary     → metadata, timestamps — still ≥ 4.5:1 if body-sized
├── disabled     → clearly inactive (exempt from contrast)
└── on-color     → text on colored surfaces (accent, semantic)

BORDERS
├── default      → card borders, dividers
├── subtle       → barely visible separators
├── strong       → focused inputs, active states
└── accent       → accent-colored borders

SEMANTIC (functional — MUST differ from accent)
├── success      → main + surface + text
├── warning      → main + surface + text
├── error        → main + surface + text
└── info         → main + surface + text

COMPONENT-SPECIFIC (optional)
├── button       → primary/secondary/ghost/danger states
├── input        → default/focused/error fills and strokes
├── navigation   → tab colors, active indicators
└── card         → only if cards differ from general surfaces
```

---

## Dark theme rules

| Rule            | Guidance                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Background base | Avoid pure `#000000` as a default: with nothing darker left, depth has nowhere to go. `#0A0A0A`–`#121212`, ideally tinted with the brand hue (`hsl(210, 25%, 5%)` for a teal accent). True black is a valid deliberate choice (OLED, media), not a default. |
| Surface steps   | Each layer visibly lighter than the one below — in practice 3–6 points of HSL lightness per step. Test: a card on the background must show its edge without a border. |
| Accent          | Raise saturation vs the light theme; muted accents disappear on dark. Measure it against every surface it sits on.                          |
| Borders         | `rgba(255,255,255, 0.08–0.15)` or the accent at low opacity. Below ~8% they read as no border on most screens.                              |
| Text primary    | `#F1F5F9` to `#FFFFFF`                                                                                                                       |
| Text secondary  | `rgba(255,255,255, 0.60–0.70)`                                                                                                               |
| Text tertiary   | `rgba(255,255,255, 0.50–0.55)` for body-sized text. 0.35–0.45 only for large text or disabled.                                              |
| Shadows         | Barely visible on dark. Separate layers with surface steps and borders instead.                                                             |
| Gradients       | Subtle — for depth on CTAs or hero sections, not decoration.                                                                                 |

## Light theme rules

| Rule            | Guidance                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------- |
| Background base | `#F2F2F7` (iOS) or `#F5F5F5` (Material), with `#FFFFFF` cards on top. Not flat white everywhere. |
| Accent          | Can be less saturated than on dark. Measure it as text on white before using it for links.  |
| Borders         | `rgba(0,0,0, 0.06–0.12)` for subtle dividers. Optional when shadows already separate.      |
| Text primary    | `#1C1C1E` to `#000000`                                                                      |
| Text secondary  | `rgba(0,0,0, 0.55–0.65)` or `#3C3C43` at ≥ 75%                                             |
| Shadows         | Essential for hierarchy — opacity `0.04–0.12` for cards, `0.15–0.25` for modals.           |

---

## Dual theme (light + dark)

1. **Never hardcode colors in components** — always reference semantic tokens.
2. **Map by role, not by value** — `surface.main` resolves to a different hex per theme.
3. Implementation follows the project's stack (see `styling-stacks.md`):

```typescript
// styled-components: swap the object passed to ThemeProvider
const darkTheme = { colors: { surface: { main: '#0C1219' } } };
const lightTheme = { colors: { surface: { main: '#F8FAFC' } } };

// NativeWind: dark: variants or CSS variables
// className="bg-surface-main dark:bg-surface-main-dark"

// Plain RN: useColorScheme() picks the token object
```

4. **Measure both themes** — a pair that passes on dark can fail on light.
