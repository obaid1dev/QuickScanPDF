# Visual direction and aesthetics

Load this when choosing an aesthetic direction, fonts, motion, icons, or domain-specific patterns.

---

## Aesthetic directions

Commit to ONE. "Clean and modern" is not a direction.

| Aesthetic                    | Characteristics                                                                      | When to use                                       |
| ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Cinematic / Immersive**    | Deep darks, rich imagery, dramatic typography, ambient lighting effects              | Media, entertainment, streaming, photography      |
| **Editorial / Magazine**     | Strong typographic hierarchy, asymmetric layouts, generous whitespace, bold headings | Content-heavy, news, blogs, long-form reading     |
| **Luxury / Refined**         | Restrained palette, subtle animations, premium materials feel, serif fonts           | Finance, premium services, fashion                |
| **Brutalist / Raw**          | High contrast, exposed structure, monospace type, no rounded corners                 | Developer tools, creative portfolios, avant-garde |
| **Playful / Friendly**       | Rounded shapes, saturated colors, bouncy animations, illustration-heavy              | Education, kids, social, gamified experiences     |
| **Utilitarian / Data-dense** | Compact layouts, tables/grids, monospace numbers, minimal decoration                 | Dashboards, trading, analytics, productivity      |
| **Organic / Calm**           | Muted earth tones, soft gradients, breathing animations, natural imagery             | Wellness, meditation, health, journaling          |
| **Neo-brutalist / Bold**     | Thick borders, offset shadows, bright primaries, visible grid                        | Creative tools, indie products, portfolios        |

---

## Reference apps by category

Study these apps for specific design qualities. When designing for a particular domain, reference the relevant category:

**Media & Entertainment** (Dark-first, immersive)

- **Letterboxd** — deep black surfaces, careful typographic hierarchy, film-poster imagery, muted accent colors
- **Spotify** — layered dark grays (not pure black), dominant art color extraction, generous spacing
- **Netflix** — full-bleed imagery, minimal chrome, red as the only accent, auto-playing heroes
- **Apple Music** — blurred album backgrounds, adaptive colors, clean segmented controls

**Productivity & Utility**

- **Things 3** — radical whitespace, ultra-clean typography, color used sparingly for status only
- **Notion** — generous padding, clean card system, subdued iconography, type as the hero
- **Linear** — dark purple-black surfaces, vibrant status colors, excellent keyboard shortcuts UX
- **Todoist** — clear priority system through color, satisfying completion animations

**Finance & Data**

- **Robinhood** — minimal chrome, data as the hero, strong typographic scale, green/red only for gains/loss
- **Revolut** — premium dark theme, card-as-hero design, smooth transitions between sections
- **Coinbase** — clean data visualization, restrained color, clear hierarchy in complex data

**Social & Communication**

- **Discord** — comfortable dark theme for long sessions, clear hierarchy between channels/messages/servers
- **Threads** — minimal, content-first, generous whitespace, typography-driven

**Health & Wellness**

- **Headspace** — warm illustrations, rounded shapes, calming palette, clear progress tracking
- **Strava** — activity-centric, maps as heroes, motivational use of personal data

**E-commerce**

- **GOAT/StockX** — product-as-hero, clean detail views, clear pricing hierarchy
- **Airbnb** — map + list integration, excellent photo galleries, clear booking flow


---

## Typography

- Choose fonts that have **character and purpose**, not just legibility.
- **Font pairing strategy**: 1 display font (personality) + 1 body font (legibility). Never more than 2 font families.
- Establish a clear type scale (minimum 5 steps: display, title, headline, body, caption).
- **Scale ratio**: use a consistent multiplier between steps. 1.2 (minor third) for compact UIs, 1.25 (major third) for standard, 1.333 (perfect fourth) for spacious.
- Never use uniform font sizes — hierarchy is the foundation of readable mobile UI.
- Avoid Inter, Roboto, Arial, and system-ui as **display/brand** fonts. They are readable but forgettable.

**Recommended expo-google-fonts for brand/display use:**
| Style | Fonts |
|-------|-------|
| Modern geometric | Outfit, Sora, General Sans (not on Google), Plus Jakarta Sans |
| Editorial serif | Playfair Display, DM Serif Display, Libre Baskerville |
| Technical/mono | Space Mono, JetBrains Mono, Fira Code |
| Friendly rounded | Nunito, Comfortaa, Quicksand |
| Bold/impact | Archivo Black, Anton, Bebas Neue |
| Elegant sans | Cormorant, Josefin Sans, Raleway |

## Spacing and layout

- Use a consistent base unit (4pt or 8pt grid). All spacing, padding, and margin should be multiples of it.
- Screens should breathe — minimum horizontal padding of 16pt on most content.
- Cards benefit from 12–16pt internal padding.
- List items need at minimum 44pt height for touch comfort.
- **Vertical rhythm**: consistent spacing between sections creates scanability. Vary section gaps (larger) vs item gaps (smaller).
- Avoid crowding the edges: respect `SafeAreaInsets` and add extra bottom padding for home-indicator devices (34pt on modern iPhones).

## Motion and feedback

- **Prefer `react-native-reanimated`** for gesture-heavy UI, shared transitions, scroll-linked effects, and any animation the user will notice repeatedly.
- The built-in `Animated` API is still valid for simple opacity/transform cases, especially when `useNativeDriver` is available. Do not rewrite an existing simple `Animated` flow to `reanimated` unless there is a clear payoff.
- `LayoutAnimation` is fast to implement for simple layout transitions (list reorders, expand/collapse) but runs on the JS thread — avoid for performance-sensitive screens.
- Provide immediate visual feedback on every touch interaction — zero-delay state change on press.
- Reserve animations for transitions that help the user understand spatial relationships (not decoration).
- **Timing guidelines**: 100-200ms for micro-interactions (press, toggle), 250-400ms for page transitions, 300-500ms for modals/sheets.
- **Easing**: use `Easing.bezier(0.25, 0.1, 0.25, 1)` (ease-out) for entrances, `Easing.bezier(0.55, 0, 1, 0.45)` (ease-in) for exits.


---

## Iconography

| Guideline         | Detail                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Library           | Use `@expo/vector-icons` (includes Ionicons, MaterialIcons, Feather, FontAwesome) or `react-native-vector-icons` |
| Style consistency | Pick ONE icon family and stick with it. Mixing outlined and filled, or different weights, creates visual noise   |
| Size              | 20-24pt for inline/navigation. 32-48pt for feature/empty-state icons. 64+ for hero illustrations                 |
| Color             | Icons follow the same text hierarchy as typography (primary, secondary, tertiary)                                |
| Active/inactive   | Active: accent color or primary text. Inactive: tertiary/muted                                                   |
| Touch area        | Icon buttons need the full 44×44 tap target regardless of icon size — use padding or hitSlop                     |

### Illustrations vs icons

- **Icons**: navigation, actions, status indicators, inline labels
- **Illustrations**: empty states, onboarding, error pages, feature explanations
- **Neither**: if text alone communicates clearly, don't add visual clutter


---

## Industry-specific guidance

When the user describes their app's purpose, apply these additional guidelines:

### Streaming / Media Tracker

- Hero images dominate — show the content, not the UI
- Dark theme preferred (cinema feel)
- Status indicators (watching, completed, planned) via color dots or pills
- Rating system should be visually satisfying (stars, hearts, numbers with scale)
- Genre/category as pills or tags

### Fitness / Health

- Progress as the hero (rings, charts, streaks)
- Motivational — celebrate achievements
- High contrast for outdoor/gym use (bright screens)
- Large touch targets (sweaty fingers, gloves)
- Calming palette if wellness-focused; energetic if performance-focused

### Finance / Banking

- Numbers are the hero — strong typographic hierarchy for amounts
- Green/red ONLY for profit/loss — never as accent
- Security-implying design: dark, premium, understated
- Transaction lists: clear grouping by date, running balance
- Charts: clean, labeled, not decorative

### Social / Community

- Content-first — the UI should disappear behind user content
- Avatar-heavy — faces build connection
- Real-time indicators (online status, typing, new messages)
- Easy media sharing — camera/gallery access is primary
- Notification management built into the design

### E-commerce / Marketplace

- Product images are heroes — large, high-quality, zoomable
- Price hierarchy: current price large + bold, original price struck through
- Trust signals: ratings, reviews count, badges
- Cart/checkout must be frictionless — progress indicator, minimal fields
- Filter/sort easily accessible without leaving results

### Education / Learning

- Progress tracking is motivational — streaks, levels, XP
- Content readability above all — generous line height, contrast
- Interactive elements clearly distinguishable from content
- Gamification: badges, celebrations, social comparison (optional)

