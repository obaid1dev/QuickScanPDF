import { Platform } from 'react-native';
import { ADS_ENABLED } from '@/constants/config';

/**
 * The AdMob JS module MUST NOT be eagerly imported anywhere. Its native spec
 * modules resolve `TurboModuleRegistry.getEnforcing(...)` at evaluation time,
 * which throws when the AdMob native addon is absent (Expo Go). A single
 * static import at the top of a route file therefore takes down the whole
 * bundle, and expo-router reports every route as "missing default export".
 *
 * Everything in this file, plus the banner and interstitial components, loads
 * the module via `loadAdsModule()` (dynamic import, try/catch) so the SDK only
 * ever evaluates in builds where the native module actually exists (dev/EAS
 * builds, and the published APK/AAB).
 */
let adsModule: typeof import('react-native-google-mobile-ads') | null = null;
let adsModuleFailed = false;

/**
 * Memoized, safe loader for the AdMob JS module. Resolves `null` (never
 * throws) when ads are disabled or the native addon is missing, so callers can
 * just `const mod = await loadAdsModule(); if (!mod) return;`.
 */
export async function loadAdsModule(): Promise<
  typeof import('react-native-google-mobile-ads') | null
> {
  if (adsModule) {
    return adsModule;
  }
  if (adsModuleFailed || !ADS_ENABLED) {
    return null;
  }
  try {
    adsModule = await import('react-native-google-mobile-ads');
    return adsModule;
  } catch {
    adsModuleFailed = true;
    return null;
  }
}

let consentPersonalized = false;

/** Whether the user permitted personalized ads (UMP consent + iOS ATT). */
export function getAdsConsentPersonalized(): boolean {
  return consentPersonalized;
}

export function setAdsConsentPersonalized(value: boolean): void {
  consentPersonalized = value;
}

/**
 * App-startup ad setup. Order matters:
 *   1. iOS: request App Tracking Transparency before any Personalized request.
 *   2. UMP: request consent info; present Google's consent form when required
 *      (EEA / regulated US states).
 *   3. Only then initialize the mobile ads SDK.
 * If the user denies consent/tracking, or anything fails (airplane mode, Expo
 * Go), the app keeps running and requests non-personalized ads instead — it
 * never blocks or hard-errors.
 */
export async function initializeAds(): Promise<void> {
  try {
    const mod = await loadAdsModule();
    if (!mod) {
      console.log('[QuickScan] Ads: AdMob module unavailable (Expo Go or ads off) — skipping ads.');
      return;
    }
    const { AdsConsent, AdsConsentStatus, MobileAds } = mod;
    console.log('[QuickScan] Ads: AdMob module loaded, initializing SDK…');

    if (Platform.OS === 'ios') {
      try {
        const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } =
          require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
        const status = await getTrackingPermissionsAsync();
        if (status.status === 'undetermined') {
          await requestTrackingPermissionsAsync();
        }
      } catch {
        // ATT failure is non-fatal: fall through to non-personalized ads.
      }
    }

    let personalized = false;
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();
      const needsForm =
        consentInfo.isConsentFormAvailable &&
        (consentInfo.status === AdsConsentStatus.UNKNOWN ||
          consentInfo.status === AdsConsentStatus.REQUIRED);

      if (needsForm) {
        const result = await AdsConsent.showForm();
        personalized = result.status === AdsConsentStatus.OBTAINED;
      } else if (consentInfo.status === AdsConsentStatus.REQUIRED) {
        // Consent required but no form available — stay non-personalized.
        personalized = false;
      } else {
        // NOT_REQUIRED / OBTAINED without a form: personalized ads are allowed.
        personalized = true;
      }
    } catch {
      // Consent info unreachable (offline/Expo Go) — assume non-personalized.
      personalized = false;
    }
    setAdsConsentPersonalized(personalized);
    console.log(`[QuickScan] Ads: consent personalized=${personalized}`);

    try {
      await MobileAds().initialize();
      console.log('[QuickScan] Ads: SDK initialized.');
    } catch (e) {
      console.log(
        `[QuickScan] Ads: SDK init failed — ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  } catch {
    // Any setup failure must never crash or block the app.
  }
}