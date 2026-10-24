import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import { usePathname } from 'expo-router';
import type { AppOpenAd as RNGAppOpenAd } from 'react-native-google-mobile-ads';
import {
  AD_UNIT_IDS,
  APP_OPEN_MIN_INTERVAL_MS,
  INTERSTITIAL_QUIET_MS,
  REWARDED_QUIET_MS,
} from '@/constants/config';
import { describeAdError, getAdsConsentPersonalized, initializeAds, loadAdsModule } from '@/lib/ads';
import {
  msSinceLastInterstitialClosed,
  msSinceLastRewardedClosed,
} from '@/lib/adTiming';

const RETRY_BACKOFF_MS = [5000, 12000, 30000];

/**
 * Screens where an app-open ad must never burst in. The ad only ever shows on
 * a background -> active transition, so the question is simply: what screen is
 * the user coming back to? Camera (scanning), Editor (the work surface) and
 * Share (PDF generation in progress) are all off-limits.
 */
const SUPPRESSED_ROUTES = ['/camera', '/editor', '/share'];

/**
 * App-open ads, shown strictly on app resume (background -> active):
 *   - never on cold launch,
 *   - at most once per 4 minutes,
 *   - never on the Camera, Editor or Share screens,
 *   - never within 30 s of an interstitial or a rewarded ad finishing,
 *   - never when the SDK is disabled, consent state says so, or nothing is
 *     loaded - a missing ad never blocks or delays the app.
 *
 * Everything else (initialization, listeners, cooldown math) lives here so no
 * screen has to know this ad exists.
 */
export function useAppOpenAd() {
  const pathname = usePathname();
  const adRef = useRef<RNGAppOpenAd | null>(null);
  const removeListenersRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const shownAtRef = useRef(0);
  const showingRef = useRef(false);
  const failCountRef = useRef(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const clearTimers = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };

    (async () => {
      // The SDK must be initialized before ANY request, or the request fails
      // silently - this was the app-open ad never loading in dev. Every
      // controller awaits the same memoized setup (consent + SDK init).
      await initializeAds();
      const mod = await loadAdsModule();
      if (cancelled || !mod) {
        return;
      }
      setEnabled(true);
      const { AppOpenAd, AdEventType } = mod;
      const ad = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen, {
        requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
      });
      adRef.current = ad;
      if (__DEV__) {
        console.log(`[QuickScan] AppOpen: created, requesting ${AD_UNIT_IDS.appOpen}`);
      }

      const scheduleReload = (delayMs: number) => {
        clearTimers();
        timersRef.current.push(
          setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
              if (!cancelled) {
                try {
                  if (__DEV__) {
                    console.log('[QuickScan] AppOpen: loading');
                  }
                  ad.load();
                } catch {
                  // Load failures surface as ERROR events; never crash here.
                }
              }
            });
          }, delayMs),
        );
      };

      const unsubscribers = [
        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          if (cancelled) {
            return;
          }
          // Full SDK diagnostics: code + message, never swallowed generically.
          if (__DEV__) {
            console.log(
              `[QuickScan] AppOpen load failed: ${describeAdError(error)}`,
            );
          }
          const attempt = failCountRef.current + 1;
          failCountRef.current = attempt;
          if (attempt <= RETRY_BACKOFF_MS.length) {
            scheduleReload(RETRY_BACKOFF_MS[attempt - 1]);
          }
        }),
        // LOADED: nothing to do - showing is decided by the AppState listener.
        ad.addAdEventListener(AdEventType.LOADED, () => {
          if (__DEV__) {
            console.log('[QuickScan] AppOpen loaded - ready for the next resume');
          }
        }),
        ad.addAdEventListener(AdEventType.OPENED, () => {
          if (__DEV__) {
            console.log('[QuickScan] AppOpen shown');
          }
          showingRef.current = true;
          shownAtRef.current = Date.now();
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (__DEV__) {
            console.log('[QuickScan] AppOpen closed - preloading the next one');
          }
          showingRef.current = false;
          // Immediately start loading the next one so the next resume finds
          // an ad ready.
          scheduleReload(500);
        }),
      ];
      removeListenersRef.current = () => {
        unsubscribers.forEach((u) => u());
      };

      scheduleReload(0);
    })();

    return () => {
      cancelled = true;
      clearTimers();
      removeListenersRef.current?.();
      adRef.current?.removeAllListeners();
      adRef.current = null;
    };
  }, []);

  /** True when every gate opens. Memoized deps: kept minimal, read refs live. */
  const canShow = useCallback((): boolean => {
    if (showingRef.current) {
      return false;
    }
    if (Date.now() - shownAtRef.current < APP_OPEN_MIN_INTERVAL_MS) {
      return false;
    }
    // Coming back onto a work screen: never interrupt.
    if (SUPPRESSED_ROUTES.some((r) => pathname.startsWith(r))) {
      return false;
    }
    // Quiet window after the interstitial on export / viewer-back closed.
    if (msSinceLastInterstitialClosed() < INTERSTITIAL_QUIET_MS) {
      return false;
    }
    // Quiet window after the rewarded ad (extra OCR run) closed.
    if (msSinceLastRewardedClosed() < REWARDED_QUIET_MS) {
      return false;
    }
    return true;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      // Ignores cold launches: on first render AppState is already 'active',
      // and this listener only fires on subsequent transitions.
      const ad = adRef.current;
      if (!ad || !canShow()) {
        return;
      }
      try {
        void ad.show().catch((e) => {
          // A failed show must never block the app; ERROR/CLOSED handlers
          // preloaded the next candidate.
          if (__DEV__) {
            console.log(`[QuickScan] AppOpen show() failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        });
      } catch {
        // Native layer not ready - skip silently, the next resume retries.
      }
    });
    return () => sub.remove();
  }, [enabled, canShow]);

  return { enabled };
}

/** Mounts the app-open logic at the root; renders nothing on screen. */
export function AppOpenAdController() {
  useAppOpenAd();
  return null;
}
