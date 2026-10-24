import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { InterstitialAd as RNGInterstitialAd } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, STORAGE_KEYS } from '@/constants/config';
import { describeAdError, getAdsConsentPersonalized, initializeAds, loadAdsModule } from '@/lib/ads';
import { notifyInterstitialClosed } from '@/lib/adTiming';
import { getItem, setItem } from '@/lib/storage';

export interface InterstitialController {
  /**
   * Shows the interstitial if one is loaded. When the user closes it,
   * `onFinished` runs - use this to navigate. Returns `true` if an ad was
   * actually shown, `false` if nothing was ready (caller should proceed).
   */
  showAdIfReady: (onFinished?: () => void) => boolean;
  isLoaded: boolean;
}

// NOTE: RNGMA's public package is never statically imported at runtime here -
// its native spec modules call `TurboModuleRegistry.getEnforcing` at
// evaluation time, which crashes Expo Go at bundle start. Only the *type* of
// `InterstitialAd` is imported (erased at compile time); the live module is
// fetched on demand via `loadAdsModule()`.

/**
 * Preloads and controls the full-screen interstitial for the Share success
 * screen. Passing `active = false` (e.g. while PDF generation is processing)
 * destroys the ad so nothing is preloaded until the export has finished.
 */
export function useInterstitialAd(active = true): InterstitialController {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RNGInterstitialAd | null>(null);
  const removeListenersRef = useRef<(() => void) | null>(null);
  const onFinishedRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const reloadScheduledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const clearTimers = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
    const addTimer = (t: ReturnType<typeof setTimeout>) => {
      timersRef.current.push(t);
    };

    const teardown = () => {
      clearTimers();
      removeListenersRef.current?.();
      removeListenersRef.current = null;
      adRef.current?.removeAllListeners();
      adRef.current = null;
      setIsLoaded(false);
    };

    if (!active) {
      teardown();
      return undefined;
    }

    const loadWithDelay = (ad: RNGInterstitialAd, delayMs: number) => {
      clearTimers();
      addTimer(
        setTimeout(() => {
          // Defer the actual request until navigation/interactions settle so
          // the network/serialize work never competes with the JS thread
          // during the screen transition.
          InteractionManager.runAfterInteractions(() => {
            if (!cancelled && adRef.current === ad) {
              try {
                ad.load();
              } catch {
                // A failed request must never crash; ERROR event handles retry.
              }
            }
          });
        }, delayMs),
      );
    };

    (async () => {
      // The SDK must be initialized before the request, or it fails silently.
      await initializeAds();
      const mod = await loadAdsModule();
      if (cancelled || !mod) {
        return;
      }
      const { InterstitialAd, AdEventType } = mod;
      const ad = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
        requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
      });
      adRef.current = ad;

      const unsubscribers = [
        ad.addAdEventListener(AdEventType.LOADED, () => {
          if (!cancelled && adRef.current === ad) {
            setIsLoaded(true);
          }
        }),
        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          if (cancelled || adRef.current !== ad) {
            return;
          }
          // Full SDK diagnostics: code + message, never swallowed generically.
          if (__DEV__) {
            console.log(
              `[QuickScan] Interstitial load failed: ${describeAdError(error)}`,
            );
          }
          setIsLoaded(false);
          // Backoff retry: transient no-fills are common on fresh builds.
          loadWithDelay(ad, 5000);
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (cancelled || adRef.current !== ad) {
            return;
          }
          // Let the app-open controller know: it holds off for 30 s after an
          // interstitial so two full-screen ads never collide.
          notifyInterstitialClosed();
          const cb = onFinishedRef.current;
          onFinishedRef.current = null;
          if (cb) {
            cb();
          }
          setIsLoaded(false);
          // Reload for the next visit, but pause briefly so the ad-sheet
          // dismissal animation isn't competing with a new request.
          if (!reloadScheduledRef.current) {
            reloadScheduledRef.current = true;
            addTimer(
              setTimeout(() => {
                reloadScheduledRef.current = false;
                loadWithDelay(ad, 0);
              }, 600),
            );
          }
        }),
      ];
      removeListenersRef.current = () => {
        unsubscribers.forEach((u) => u());
      };

      // Initial preload (deferred).
      loadWithDelay(ad, 0);
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [active]);

  const showAdIfReady = useCallback(
    (onFinished?: () => void): boolean => {
      const ad = adRef.current;
      if (!ad || !isLoaded) {
        return false;
      }
      try {
        onFinishedRef.current = onFinished ?? null;
        void ad.show().catch((e) => {
          if (__DEV__) {
            console.log('[QuickScan] Interstitial show() rejected.', e);
          }
          onFinishedRef.current = null;
        });
        return true;
      } catch (e) {
        // A failed show() must never trap the user on this screen - clear the
        // pending callback and report "nothing shown" so the caller proceeds.
        if (__DEV__) {
          console.log('[QuickScan] Interstitial show() threw - leaving without an ad.', e);
        }
        onFinishedRef.current = null;
        return false;
      }
    },
    [isLoaded],
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