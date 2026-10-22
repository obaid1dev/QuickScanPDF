# Screen patterns and layout

Load this when designing a specific screen or deciding how to structure a view.

---

## Screen pattern catalog

Reference designs for common screens. Each pattern includes structure, key design decisions, and what separates good from great.

### Authentication (Login / Register / Forgot Password)

**Structure**: Centered form, minimal distraction, clear primary CTA, secondary links below.

| Decision      | Guidance                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- |
| Visual weight | The input fields and CTA should dominate — minimize logos and decoration                  |
| Background    | Solid dark/light surface OR subtle gradient. Never busy imagery that competes with inputs |
| Inputs        | Generous height (48-56pt), clear focus states, inline validation                          |
| CTA           | Full-width, high contrast, immediate loading feedback                                     |
| Social login  | Secondary visual weight — below the primary form                                          |
| Keyboard      | Must not cover the active input — see `platform-constraints.md` → Keyboard                |
| Error display | Inline per-field (red text below input) + optional toast for network errors               |

**Great**: Smooth keyboard transitions, immediate field validation, subtle brand personality through font/color choice, haptic on submit.

### Home / Dashboard

**Structure**: Scrollable surface with sections — greeting/status → primary content → secondary content.

| Decision          | Guidance                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Header            | Personalized greeting OR key metric. Not generic "Welcome back"                                   |
| Content hierarchy | What does the user want MOST when they open the app? That goes first                              |
| Cards vs List     | Cards for visual/browseable content (media, products). Lists for scannable data (tasks, messages) |
| Empty first-use   | Dedicated onboarding prompt, not just "No items yet"                                              |
| Pull-to-refresh   | Expected if data is remote                                                                        |
| Floating action   | Only if there's ONE dominant creation action                                                      |

**Great**: Content-first (data visible without scrolling), progressive disclosure, personalized ordering.

### Detail View (Item/Product/Content)

**Structure**: Hero image/visual → title + metadata → body content → actions.

| Decision        | Guidance                                                                |
| --------------- | ----------------------------------------------------------------------- |
| Hero            | Full-width image or large visual. Aspect ratio 16:9 or 3:4 for media    |
| Scroll behavior | Image collapses on scroll, title becomes the header (parallax optional) |
| Metadata        | Compact row: date, category, rating — secondary text weight             |
| Actions         | Sticky bottom bar OR contextual buttons within content                  |
| Back navigation | Always visible — overlay on hero image if present                       |

**Great**: Smooth scroll-linked transitions, image loading with shimmer/blur-up, rich metadata without clutter.

### List / Collection

**Structure**: Optional filters/tabs at top → scrollable list → empty state.

| Decision    | Guidance                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------ |
| Layout      | Vertical list for text-heavy items. Grid (2-3 columns) for visual items (photos, products) |
| Item height | Consistent per type. Text list: 64-88pt. Visual grid: square or 3:4                        |
| Separator   | Subtle line (light theme) or gap (dark theme). Not both                                    |
| Filters     | Horizontal scroll pills OR top tabs for < 5 categories. Sheet/modal for complex filters    |
| Search      | Sticky at top if list is > 20 items                                                        |
| Loading     | Skeleton shimmer matching item shape — not a centered spinner                              |
| Empty       | Illustration + message + CTA. Centered vertically                                          |
| Pagination  | Infinite scroll with bottom loader for most apps. Explicit "Load more" for formal content  |

**Great**: Smooth scroll performance (FlatList + getItemLayout), item animations on appear, pull-to-refresh with custom animation.

### Profile / Settings

**Structure**: Avatar + info header → sections grouped by category → danger zone at bottom.

| Decision    | Guidance                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------- |
| Header      | Avatar (or initials fallback) + name + optional bio/subtitle                              |
| Sections    | Group related items. Use section headers to separate concerns                             |
| Navigation  | Chevron/arrow for items that navigate to a sub-screen                                     |
| Toggles     | For instant-apply boolean settings. Not for actions                                       |
| Danger zone | Log out, delete account — visually distinct (red text or separated section) at the bottom |
| Edit mode   | Separate edit screen OR inline editing with clear save/cancel                             |

**Great**: Smooth avatar upload with crop, grouped sections with clear visual separation, confirmation for destructive actions.

### Search

**Structure**: Search input (auto-focused) → recent/suggestions → results.

| Decision          | Guidance                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| Input             | Auto-focus on mount. Full-width. Clear button on right                      |
| State: empty      | Recent searches + trending/suggested (if applicable)                        |
| State: typing     | Real-time suggestions (debounced 300ms minimum)                             |
| State: results    | Same layout as the collection it searches                                   |
| State: no results | Friendly message + suggestions. Not just "No results"                       |
| Cancel            | Platform-correct: iOS shows "Cancel" text button. Android uses back gesture |

**Great**: Instant results feeling (optimistic UI), search highlighting in results, filter integration.

### Onboarding / Walkthrough

**Structure**: 2-4 pages maximum → skip option → final CTA.

| Decision   | Guidance                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- |
| Pages      | Maximum 4. Each communicates ONE benefit. Not features — benefits                        |
| Navigation | Swipeable pages with dot indicator. "Next" and "Skip" always visible                     |
| Visuals    | Each page has ONE dominant visual (illustration, screenshot, or icon). Not walls of text |
| Final      | Clear CTA that enters the app. "Get Started" not "Done"                                  |
| Skip       | Always available. Some users don't want onboarding                                       |
| Re-entry   | Settings should have "Show onboarding" option                                            |

**Great**: Subtle page transition animations, micro-interactions on illustrations, progress feels fast (never sluggish).

### Modal / Bottom Sheet

**Structure**: Handle (for sheets) → title → content → actions.

| Decision       | Guidance                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| Type           | Bottom sheet for contextual options. Center modal for confirmations/alerts |
| Handle         | Gray pill indicator (4×36pt) at top of bottom sheets                       |
| Dismiss        | Swipe down + backdrop tap. Never trap the user                             |
| Content height | Auto-height to content (max 85% screen). Scroll internally if needed       |
| Actions        | Primary right/bottom. Destructive in red. Cancel on left                   |
| Backdrop       | `rgba(0,0,0, 0.4–0.6)` with blur if available                              |

### Tab / Navigation Structure

| Pattern           | When to use                                                     |
| ----------------- | --------------------------------------------------------------- |
| Bottom tabs (3-5) | Primary navigation for most apps                                |
| Top tabs          | Sub-categories within a section (e.g., "All / Movies / Series") |
| Drawer            | Many sections (> 5), settings-heavy apps, enterprise            |
| Stack-only        | Linear flows (onboarding, checkout), single-purpose apps        |
| Tab + Stack       | Most common: tabs for sections, stack for detail/sub-flows      |


---

## Layout decision framework

When deciding HOW to structure a view, follow this decision tree:

### Content Type → Layout Choice

```
Is the content a list of similar items?
├── YES → Are items visual (images/thumbnails)?
│   ├── YES → Grid (2-3 cols) OR horizontal scroll carousel
│   └── NO  → Vertical list (FlatList)
└── NO  → Is it a form?
    ├── YES → Vertical scroll, single column, generous spacing
    └── NO  → Is it mixed content (hero + details + actions)?
        ├── YES → ScrollView with sections
        └── NO  → Is it a dashboard with multiple data types?
            ├── YES → Sections with different component types
            └── NO  → Centered content (auth, empty states, confirmation)
```

### Spacing Rules

| Context           | Horizontal padding       | Vertical spacing between sections | Internal card padding |
| ----------------- | ------------------------ | --------------------------------- | --------------------- |
| Standard screen   | 16-20pt                  | 24-32pt                           | 12-16pt               |
| Data-dense screen | 12-16pt                  | 16-20pt                           | 8-12pt                |
| Immersive/media   | 0pt (full-bleed) to 16pt | 16-24pt                           | 12-16pt               |
| Form              | 16-24pt                  | 16-24pt                           | —                     |

### Component Size Reference

| Element                 | Minimum height              | Recommended      |
| ----------------------- | --------------------------- | ---------------- |
| Touch target            | 44pt (iOS) / 48dp (Android) | 48pt             |
| Button                  | 44pt                        | 48-56pt          |
| Input field             | 44pt                        | 48-56pt          |
| List item (text only)   | 44pt                        | 56-72pt          |
| List item (with avatar) | 56pt                        | 64-80pt          |
| Tab bar                 | 49pt (iOS) / 56dp (Android) | Platform default |
| Navigation header       | 44pt (iOS) / 56dp (Android) | Platform default |
| Card (compact)          | —                           | 120-160pt        |
| Card (featured)         | —                           | 200-280pt        |

