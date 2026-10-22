# React Native platform constraints

Hard rules, not preferences: breaking them produces UI that renders wrong or not at all. Verified against React Native 0.82+ (New Architecture only) and Expo SDK 54+. If the project is older, check the version notes inline.

---

## Layout engine

- All layout is **Flexbox**. No CSS Grid, no `display: block`, no `float`. `display` accepts only `flex`, `none` and `contents`.
- `flexDirection` defaults to `column` (the web defaults to `row`).
- `alignItems` defaults to `stretch`. `alignContent` defaults to `flex-start`.
- `flexShrink` defaults to `0` (web default is `1`).
- Dimensions are **unitless density-independent pixels** — never `px`, `em`, `rem`, `vw/vh`.
- Use `useWindowDimensions()` for screen-relative sizing (it updates on rotation; `Dimensions.get` does not).
- Percentages work (`width: '50%'`) but need a parent with defined dimensions.
- `position: 'static'` is available (New Architecture only — so any RN 0.82+ project).

## Edge-to-edge and safe areas (Android 16 / Expo SDK 54+)

- Apps targeting Android 16 always draw **edge-to-edge**, and it cannot be turned off. Content goes behind the status bar and the navigation bar unless you pad it.
- Take insets from `react-native-safe-area-context` (`SafeAreaView` from that package, or `useSafeAreaInsets()`). **The core `SafeAreaView` from `react-native` is deprecated since 0.81** and never handled Android.
- Apply insets where the content meets the edge: headers get `top`, bottom bars and the last scroll item get `bottom`. Don't wrap the whole app in one padded view — full-bleed backgrounds and hero images should still reach the edges.
- For navigation-bar contrast, Expo has `androidNavigationBar.enforceContrast` in app config.

## Shadows

- **`boxShadow`** (CSS syntax, works on both platforms) needs the New Architecture, so it's the default on RN 0.82+. Outset shadows need Android 9+; inset shadows need Android 10+.
- On older projects: iOS uses `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`; Android uses `elevation` (integer).
- `elevation` on Android also changes stacking: a sibling with higher elevation draws on top regardless of `zIndex`.
- `overflow: 'hidden'` on Android clips the shadow of the same view. Put the shadow on an outer wrapper and the clipping on an inner one.

## Filters

- `filter` needs the New Architecture. Only `brightness` and `opacity` work on iOS. `blur` and `dropShadow` are Android 12+ only.
- `filter` implies `overflow: hidden` — children get clipped.

## Gradients

- **CSS `background: linear-gradient(...)` does not work.** Use `expo-linear-gradient` or `react-native-linear-gradient`.
- Colors go in an array: `colors={['#000', '#333']}`. Direction via `start` and `end`.

## Images

- Local images: `<Image source={require('./img/photo.png')} />` — dimensions are inferred.
- **Network images need explicit `width` and `height`** (or a parent that sizes them), otherwise they render at 0×0.
- Provide `@2x` and `@3x` variants for static images.
- `<ImageBackground>` for background images; `background-image` doesn't exist.
- `expo-image` adds caching, placeholders (blurhash) and transitions — prefer it for remote images in Expo projects.
- If rounded corners don't render on an image, wrap it in a container with `borderRadius` + `overflow: 'hidden'`.

## Color

- Supports hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()` and named colors.
- **Named colors must be lowercase.** `'Red'` is not supported.
- `PlatformColor` references system colors; `DynamicColorIOS` gives explicit light/dark pairs on iOS.
- `useColorScheme()` returns `'light' | 'dark' | null` — the entry point for manual theming.

## Touch and interaction

- `<Pressable>` is the default touchable — it exposes `pressed` via render prop.
- On Android, `android_ripple` on `<Pressable>` gives the native Material ripple — use it.
- A child pushed outside its parent's bounds (negative margins, absolute positioning) **doesn't receive touches on Android**. Use overlaps for visuals, not for tappable elements.
- `hitSlop` enlarges the tap area, but only within the parent's bounds.
- Minimum tap target: **44×44 pt** (Apple HIG) / **48×48 dp** (Material).

## Keyboard

- iOS: `<KeyboardAvoidingView behavior="padding">` around a `ScrollView`.
- Android: the right behavior depends on edge-to-edge and the app's keyboard layout mode. Don't guess — check on a real device that the focused input stays visible.
- Long forms, or when inputs still end up hidden: Expo's guide points to `react-native-keyboard-controller` (needs a development build and Reanimated).

## Blur and glass

- `expo-blur`'s `<BlurView>`: on Android it **doesn't blur by default** — `blurMethod` defaults to `'none'`, which renders a semi-transparent view. Real blur needs `blurMethod` plus a `BlurTargetView`. Use `'dimezisBlurViewSdk31Plus'` to blur on Android 12+ and fall back cleanly below that.
- Always give blurred surfaces a background color that works on its own, because that is what part of your Android users will see.
- iOS 26 Liquid Glass: `expo-glass-effect` (`GlassView`, `GlassContainer`). It falls back to a plain `View` elsewhere — check `isLiquidGlassAvailable()` and design the fallback.

## Lists

- `<FlatList>` (or `FlashList`) for anything that can exceed the screen; `<ScrollView>` only for short, bounded content.
- Always set `keyExtractor`; never use the index as key for dynamic data.
- `getItemLayout` when items have a fixed height — faster scrolling and jump-to-index.
- **`ListEmptyComponent` has no parent height** — `flex: 1` inside it does nothing. To center the empty state vertically, give the list `contentContainerStyle={{ flexGrow: 1 }}` and the empty component `flex: 1, justifyContent: 'center'`.

## Typography

- Custom fonts load with `expo-font` or `@expo-google-fonts/*`.
- Platform defaults: SF Pro on iOS, Roboto on Android — fine for body text.
- `lineHeight` is absolute (`24` means 24pt), not a multiplier.
- With custom fonts, set the exact weight file (`fontFamily: 'Inter_700Bold'`) instead of `fontWeight: 'bold'` — with a custom font, the result differs by platform (faked bold or ignored).
- Respect font scaling: don't set `allowFontScaling={false}` globally; test at the largest system text size.
