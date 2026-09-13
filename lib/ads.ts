import { Platform } from 'react-native';
import { MobileAds, AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { ADS_ENABLED } from '@/constants/config';

let availabilityChecked = false;
let adsAvailable = false;

let consentPersonalized = false;

/**
 * Whether the AdMob native module is linked AND ads are enabled. In Expo Go the
 * native module does not exist and calling it would throw, so every ad code
 * path checks this first and fully no-ops. Real ads (and the SDK) only run in
 * development/EAS builds.
 */
export function isAdsAvailable(): boolean {
  if (!ADS_ENABLED) {
    return false;
  }
  if (!availabilityChecked) {
    availabilityChecked = true;
    try {
      MobileAds();
      adsAvailable = true;
    } catch {
      adsAvailable = false;
    }
  }
  return adsAvailable;
}

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
  if (!isAdsAvailable()) {
    return;
  }

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

  try {
    await MobileAds().initialize();
  } catch {
    // SDK init failure must never crash or block the app.
  }
}