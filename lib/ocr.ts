/**
 * On-device OCR (`expo-mlkit-ocr`) loader.
 *
 * The module's entry point calls `requireNativeModule('ExpoMlkitOcr')` while it
 * is being evaluated, so a top-level `import` throws inside Expo Go (native
 * module absent) and would take the whole route bundle down — exactly the way
 * the AdMob module does. Everything therefore goes through `loadOcrModule()`,
 * a memoized dynamic import that resolves `null` instead of ever throwing.
 *
 * Recognition runs entirely on-device through Google ML Kit (Android) or Apple
 * Vision (iOS): no network calls, no API keys, no extra runtime permissions.
 */

type OcrModule = typeof import('expo-mlkit-ocr');

let ocrModule: OcrModule | null = null;
let ocrModuleFailed = false;

/**
 * Memoized, safe loader for the OCR module. Resolves `null` (never throws)
 * when the native module is missing, so callers can just
 * `const mod = await loadOcrModule(); if (!mod) return;`.
 */
export async function loadOcrModule(): Promise<OcrModule | null> {
  if (ocrModule) {
    return ocrModule;
  }
  if (ocrModuleFailed) {
    return null;
  }
  try {
    ocrModule = await import('expo-mlkit-ocr');
    return ocrModule;
  } catch (e) {
    ocrModuleFailed = true;
    if (__DEV__) {
      console.log(
        `[QuickScan] OCR module unavailable (Expo Go build?): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    return null;
  }
}

/** Whether this build/device can run text recognition at all. */
export async function isOcrSupported(): Promise<boolean> {
  const mod = await loadOcrModule();
  if (!mod) {
    return false;
  }
  try {
    return mod.isSupported();
  } catch {
    return false;
  }
}

/**
 * Runs OCR on a single local image and returns its recognized text.
 *
 * @param uri A `file://` URI the app already owns (scanned page or gallery import).
 * @throws When no OCR module is available or the device reports it unsupported,
 * so callers can surface a friendly message instead of crashing.
 */
export async function recognizeTextFromImage(uri: string): Promise<string> {
  const mod = await loadOcrModule();
  if (!mod) {
    throw new Error(
      'Text recognition is not available in this build. Try a dev build or the production app.',
    );
  }
  if (!(await isOcrSupported())) {
    throw new Error('Text recognition is not supported on this device.');
  }
  const result = await mod.recognizeText(uri);
  return (result?.text ?? '').replace(/\s+$/, '');
}
