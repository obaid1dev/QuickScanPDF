# AGENTS.md — QuickScan PDF

Read this file before every task. These rules apply to every prompt unless the prompt explicitly overrides a specific rule.

## Project overview

QuickScan PDF is an offline Android document scanner built with Expo SDK 57, React Native, TypeScript, and Expo Router. It is live on Google Play (package `com.obaid.dev.quickscanpdf`). Scanning is done by the native document scanner (`react-native-document-scanner-plugin`, with auto edge detection and crop). PDFs are generated on-device with `expo-print`. Ads use `react-native-google-mobile-ads`. Everything in the core flow works without internet.

## Folder structure

- `app/`: Expo Router screens (`index.tsx` Dashboard, `camera.tsx`, `editor.tsx`, `share.tsx`, `settings.tsx`, PDF viewer, `_layout.tsx`)
- `components/`: reusable UI (`AdBanner.tsx`, `DocumentCard.tsx`, `EmptyState.tsx`, `FAB.tsx`, and so on)
- `constants/`: `config.ts` (ad unit IDs, `ADS_ENABLED`, `APP_VERSION`, storage keys), `theme.ts`
- `hooks/`: `useDocuments.ts`, `useScanSession.ts`, `useInterstitialAd.ts`
- `lib/`: `ads.ts`, `storage.ts`, `fileManager.ts`, `pdfGenerator.ts`, `imageProcessing.ts`
- `types/`: `document.ts`

## Hard rules (never break these)

1. **Do not change the native scanner flow** (camera capture, auto edge detection, auto-crop) unless the task names it.
2. **Do not reintroduce custom image filters.** Filters were removed on purpose, because the native scanner provides its own. Do not add filter UI, pre-baked filter variants, or grayscale/contrast helpers.
3. **Do not add media or storage permissions.** Gallery import uses the system Photo Picker and needs no permission. Keep `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `RECORD_AUDIO` in `blockedPermissions`. Keep `microphonePermission: false` on the image picker plugin.
4. **Do not upgrade Expo, React Native, or any Google/AdMob library** unless the task explicitly asks for an SDK upgrade. If a package needs upgrading to fix something, stop and explain why first.
5. **Do not change portrait orientation** (`MainActivity` is portrait on purpose).
6. **Do not change the immersive status bar and navigation bar behavior** (status bar hidden everywhere, nav bar overlay-swipe) unless the task names it.
7. **Do not touch `app-ads.txt`** in the website project. That's a separate project.
8. **Never add a second source of truth for a value.** Ad unit IDs live in `constants/config.ts` only. Version lives in `app.json` and is mirrored in `APP_VERSION`.

## Ads rules

- Test IDs are used automatically when `__DEV__` is true. Production IDs are used otherwise. Never hard-code a production ID in a component.
- Production ad unit IDs (already created, do not replace them):
  - Banner (Dashboard): `ca-app-pub-1138568424665362/8225859358`
  - Interstitial: `ca-app-pub-1138568424665362/5141987288`
  - Viewer banner: `ca-app-pub-1138568424665362/6530342141`
  - Rewarded (OCR): `ca-app-pub-1138568424665362/2545583845`
  - App open: `ca-app-pub-1138568424665362/1531561674`
- AdMob app ID: `ca-app-pub-1138568424665362~3611826927`
- Every ad must respect `ADS_ENABLED` and the consent state.
- **Never show an ad on the camera, editor, or share-processing screens, or during PDF generation.**
- **Never auto-show a rewarded ad.** It only appears after the user taps "Watch ad".
- If an ad fails to load, the app must still work. Never block a core action behind an ad.
- Don't add new ad placements, or make existing ads more frequent, unless the task asks for it.

## Release rules

- **Never run `eas build` or `eas submit` unless the task explicitly says so.** Stop after the git push.
- The owner sets `expo.version` and `expo.android.versionCode` explicitly in each prompt. Do not compute or auto-increment them. If a prompt doesn't state the values, stop and ask.
- Keep `APP_VERSION` in `constants/config.ts` in sync with `expo.version`.
- Commit with a clear message describing the change, then `git push`.
- Keep `expo-build-properties` R8 settings (`enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`) in release builds. Don't add R8 keep rules unless a release crash log shows a specific library needs one.

## Quality gates (run before every commit)

1. `npx tsc --noEmit` must pass with zero errors.
2. Run the linter if one is configured.
3. If the task touched permissions, plugins, or native config: run `npx expo prebuild` locally, read the generated `AndroidManifest.xml`, confirm no new permissions were added, then delete the generated `android/` folder and revert any `package.json` script edits prebuild made. A leftover `android/` folder makes EAS build the local folder instead of regenerating from config.
4. Check that `package-lock.json` is committed and in sync with `package.json` (`npm install` is run after any dependency change).

## Coding standards

- TypeScript strict mode. Avoid `any` unless unavoidable, and explain why if used.
- Colors come from the theme tokens in `constants/theme.ts`. Don't hard-code hex colors in screens.
- Handle every async native call with try/catch and show a user-facing message on failure. Never fail silently.
- Persisted data may be old. Always handle missing or extra fields when reading saved documents.
- Keep components small and reuse existing ones before creating new ones.
- No `console.log` left in committed code, except behind `__DEV__`.

## Scope discipline

- Do only what the task asks. If you notice a bug or improvement outside the task, list it in your summary and don't fix it.
- If a task conflicts with a hard rule above, stop and explain the conflict instead of working around it.
- If you are blocked by something that needs the owner (account access, credentials, a decision), stop and say exactly what is needed.

## Reporting format

End every task with a summary that includes:
- Files changed, grouped by feature
- Result of `npx tsc --noEmit`
- New versionCode and version
- Commit message and confirmation of the push
- Anything not verified on a device, listed clearly
- Anything noticed but not changed


# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design skills

- For any UI, layout, styling, or motion work, read the installed `react-native-design` skill first, then use `emil-design-eng` for animation and fine polish. Use `frontend-design` only as a fallback for general styling questions.
- Build all colors and spacing from the theme tokens in `constants/theme.ts`, as the skill recommends.
- Design skills suggest styling. AGENTS.md decides scope. If a skill's advice conflicts with a hard rule (the native scanner, permissions, ads, Expo versions, portrait lock, immersive bars), follow AGENTS.md and mention the conflict in your summary.
- Don't redesign screens the task doesn't name.
- Before finishing UI work, run the design checks from the skill and report which screens you checked in both light and dark themes.
