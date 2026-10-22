/**
 * Timestamps of recent ad impressions, shared between hook instances so the
 * app-open controller can honor its quiet windows:
 *   - no app-open ad within 30 s of an interstitial closing
 *   - no app-open ad right after a rewarded ad (OCR gate)
 *
 * Everything lives in module state: these values are per-app-run signals,
 * not persisted data.
 */

let lastInterstitialClosedAt = 0;
let lastRewardedClosedAt = 0;

export function notifyInterstitialClosed(): void {
  lastInterstitialClosedAt = Date.now();
}

export function notifyRewardedClosed(): void {
  lastRewardedClosedAt = Date.now();
}

export function msSinceLastInterstitialClosed(): number {
  return lastInterstitialClosedAt ? Date.now() - lastInterstitialClosedAt : Infinity;
}

export function msSinceLastRewardedClosed(): number {
  return lastRewardedClosedAt ? Date.now() - lastRewardedClosedAt : Infinity;
}
