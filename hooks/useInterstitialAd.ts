import { useCallback, useEffect, useRef } from 'react';
import { useInterstitialAd as useLibInterstitialAd } from 'react-native-google-mobile-ads';
import type { RequestOptions } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '@/constants/config';
import { getAdsConsentPersonalized, isAdsAvailable } from '@/lib/ads';
import { getItem, setItem } from '@/lib/storage';
import { STORAGE_KEYS } from '@/constants/config';

export interface InterstitialController {
  /**
   * Shows the interstitial if one is loaded. When the user closes it,
   * `onFinished` runs — use this to navigate. Returns `true` if an ad was
   * actually shown, `false` if nothing was ready (caller should proceed).
   */
  showAdIfReady: (onFinished?: () => void) => boolean;
  isLoaded: boolean;
}

/**
 * Preloads and controls the full-screen interstitial for the Share success
 * screen. Passing `active = false` (e.g. while PDF generation is processing)
 * destroys the ad so nothing is preloaded until the export has finished.
 */
export function useInterstitialAd(active = true): InterstitialController {
  const available = isAdsAvailable() && active;
  const requestOptionsRef = useRef<RequestOptions>({
    requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
  });

  const { isLoaded, isClosed, error, load, show } = useLibInterstitialAd(
    available ? AD_UNIT_IDS.interstitial : null,
    requestOptionsRef.current,
  );

  const onFinishedRef = useRef<(() => void) | null>(null);
  const reloadScheduledRef = useRef(false);

  // Initial preload (no-op when the ad is null).
  useEffect(() => {
    load();
  }, [load]);

  // Reload once the shown ad closes, and again (with backoff) on load errors.
  useEffect(() => {
    if (isClosed && !reloadScheduledRef.current) {
      reloadScheduledRef.current = true;
      const t = setTimeout(() => {
        reloadScheduledRef.current = false;
        load();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isClosed, load]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => {
        load();
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [error, load]);

  // Fire the post-ad callback exactly once, when the ad finishes closing.
  useEffect(() => {
    if (isClosed && onFinishedRef.current) {
      const cb = onFinishedRef.current;
      onFinishedRef.current = null;
      cb();
    }
  }, [isClosed]);

  const showAdIfReady = useCallback(
    (onFinished?: () => void): boolean => {
      if (!available || !isLoaded) {
        return false;
      }
      onFinishedRef.current = onFinished ?? null;
      show();
      return true;
    },
    [available, isLoaded, show],
  );

  return { showAdIfReady, isLoaded };
}

/**
 * Increments the persisted count of successful PDF exports and returns the new
 * count. Used to decide when to show the interstitial (every Nth export).
 */
export async function incrementExportCount(): Promise<number> {
  const current = (await getItem<number>(STORAGE_KEYS.exportCount)) ?? 0;
  const next = current + 1;
  await setItem(STORAGE_KEYS.exportCount, next);
  return next;
}