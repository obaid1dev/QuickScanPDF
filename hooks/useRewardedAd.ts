import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { RewardedAd as RNGRewardedAd } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '@/constants/config';
import { getAdsConsentPersonalized, loadAdsModule } from '@/lib/ads';
import { notifyRewardedClosed } from '@/lib/adTiming';

// Backoff between rewarded (re)load attempts. Fresh ad units and builds in app
// review commonly miss their first few requests, then fill fine moments later.
const RETRY_BACKOFF_MS = [4000, 8000, 16000, 30000];

export interface RewardedShowCallbacks {
  /** The user watched far enough to earn the reward — grant the use here. */
  onEarned: () => void;
  /**
   * Nothing was ready or `show()` failed. Callers MUST NOT block the user on
   * this: fall through to the unpaid action and log in `__DEV__`.
   */
  onUnavailable: () => void;
  /** The ad finished without a reward (user closed it early). */
  onClosedWithoutReward: () => void;
}

export interface RewardedController {
  /**
   * Shows the rewarded ad when one is loaded. Returns `true` only if an ad was
   * actually shown; otherwise `onUnavailable` has already been invoked.
   */
  show: (callbacks: RewardedShowCallbacks) => boolean;
  isLoaded: boolean;
}

// NOTE: RNGMA's public package is never statically imported at runtime here —
// its native spec modules call `TurboModuleRegistry.getEnforcing` at
// evaluation time, which crashes Expo Go at bundle start. Only the *type* of
// `RewardedAd` is imported (erased at compile time); the live module is
// fetched on demand via `loadAdsModule()`.

/**
 * Preloads and controls the rewarded video used to grant extra "Extract text"
 * runs after the daily free cap. Pass `active = false` to tear the ad down
 * (nothing is preloaded while the screen is not in use).
 *
 * The ad is only ever *loaded* here — showing it is always an explicit,
 * user-initiated call through `show()`, so a reward can never be earned
 * without a tap.
 */
export function useRewardedAd(active = true): RewardedController {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RNGRewardedAd | null>(null);
  const removeListenersRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef<RewardedShowCallbacks | null>(null);
  const earnedRef = useRef(false);
  const showingRef = useRef(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const failCountRef = useRef(0);
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
      callbacksRef.current = null;
      showingRef.current = false;
      earnedRef.current = false;
      setIsLoaded(false);
    };

    if (!active) {
      teardown();
      return undefined;
    }

    const loadWithDelay = (ad: RNGRewardedAd, delayMs: number) => {
      clearTimers();
      addTimer(
        setTimeout(() => {
          // Defer the actual request until navigation/interactions settle so
          // the network work never competes with the JS thread mid-transition.
          InteractionManager.runAfterInteractions(() => {
            if (!cancelled && adRef.current === ad) {
              try {
                ad.load();
              } catch {
                // A failed request must never crash; the ERROR event retries.
              }
            }
          });
        }, delayMs),
      );
    };

    (async () => {
      const mod = await loadAdsModule();
      if (cancelled || !mod) {
        return;
      }
      const { RewardedAd, AdEventType, RewardedAdEventType } = mod;
      const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
        requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
      });
      adRef.current = ad;

      const unsubscribers = [
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (!cancelled && adRef.current === ad) {
            failCountRef.current = 0;
            setIsLoaded(true);
          }
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          if (cancelled || adRef.current !== ad) {
            return;
          }
          setIsLoaded(false);

          // A show-time failure surfaces as ERROR rather than a rejected
          // promise on some devices. Report it once (callbacksRef is nulled
          // before invoking, so a simultaneous rejection is a no-op) instead
          // of leaving the pending reward unsettled.
          if (showingRef.current) {
            showingRef.current = false;
            earnedRef.current = false;
            const cb = callbacksRef.current;
            callbacksRef.current = null;
            cb?.onUnavailable();
          }

          const attempt = failCountRef.current + 1;
          failCountRef.current = attempt;
          if (attempt > RETRY_BACKOFF_MS.length) {
            return;
          }
          if (__DEV__) {
            console.log(
              `[QuickScan] Rewarded failed to load (attempt ${attempt}) — retrying.`,
            );
          }
          loadWithDelay(ad, RETRY_BACKOFF_MS[attempt - 1]);
        }),
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
          if (cancelled || adRef.current !== ad) {
            return;
          }
          earnedRef.current = true;
          if (__DEV__) {
            console.log(
              `[QuickScan] Rewarded earned: ${reward?.amount ?? ''} ${
                reward?.type ?? ''
              }`.trim(),
            );
          }
          const cb = callbacksRef.current;
          callbacksRef.current = null;
          cb?.onEarned();
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (cancelled || adRef.current !== ad) {
            return;
          }
          // Let the app-open controller know: it holds off briefly after any
          // rewarded ad so two full-screen ads never collide.
          notifyRewardedClosed();
          const cb = callbacksRef.current;
          const earned = earnedRef.current;
          callbacksRef.current = null;
          showingRef.current = false;
          earnedRef.current = false;
          if (cb && !earned) {
            cb.onClosedWithoutReward();
          }
          setIsLoaded(false);
          // Reload for the next attempt, but pause briefly so the ad-sheet
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

  const show = useCallback(
    (callbacks: RewardedShowCallbacks): boolean => {
      const ad = adRef.current;
      if (!ad || !isLoaded || showingRef.current) {
        if (__DEV__) {
          console.log('[QuickScan] Rewarded not ready — allowing a free run.');
        }
        callbacks.onUnavailable();
        return false;
      }
      callbacksRef.current = callbacks;
      earnedRef.current = false;
      showingRef.current = true;
      try {
        void ad.show().catch((e) => {
          if (__DEV__) {
            console.log('[QuickScan] Rewarded show() rejected — allowing a free run.', e);
          }
          const cb = callbacksRef.current;
          callbacksRef.current = null;
          showingRef.current = false;
          cb?.onUnavailable();
        });
        return true;
      } catch (e) {
        // A failed show() must never trap the user — report "nothing shown"
        // so the caller proceeds with the unpaid action.
        if (__DEV__) {
          console.log('[QuickScan] Rewarded show() threw — allowing a free run.', e);
        }
        const cb = callbacksRef.current;
        callbacksRef.current = null;
        showingRef.current = false;
        cb?.onUnavailable();
        return false;
      }
    },
    [isLoaded],
  );

  return { show, isLoaded };
}
