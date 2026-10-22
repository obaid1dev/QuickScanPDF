import { Platform } from 'react-native';
import { InteractionManager } from 'react-native';
import {
  INTERSTITIAL_QUIET_MS,
  RATE_US_COOLDOWN_MS,
  RATE_US_EXPORT_THRESHOLD,
  REWARDED_QUIET_MS,
  STORAGE_KEYS,
} from '@/constants/config';
import {
  msSinceLastInterstitialClosed,
  msSinceLastRewardedClosed,
} from '@/lib/adTiming';
import { getItem, setItem } from '@/lib/storage';

/**
 * Google Play's in-app review API, surfaced after the user has exported a few
 * PDFs: the moment they've gotten real value out of the app, not a random
 * nag. Requested at most once every 90 days, and any failure here is fully
 * absorbed — export, navigation and ads are never affected.
 */

interface RateUsState {
  requestedAt: number;
}

export async function shouldRequestRateUs(): Promise<boolean> {
  try {
    const [count, state] = await Promise.all([
      getItem<number>(STORAGE_KEYS.exportCount),
      getItem<RateUsState>(STORAGE_KEYS.rateUsLastRequest),
    ]);
    if ((count ?? 0) < RATE_US_EXPORT_THRESHOLD) {
      return false;
    }
    const last = state?.requestedAt ?? 0;
    if (last && Date.now() - last < RATE_US_COOLDOWN_MS) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function markRateUsRequested(): Promise<void> {
  try {
    await setItem<RateUsState>(STORAGE_KEYS.rateUsLastRequest, {
      requestedAt: Date.now(),
    });
  } catch {
    // Losing this entry only risks a (still rare) repeat prompt.
  }
}

/**
 * Fires the native in-app review flow if available. Returns `true` only when
 * the actual OS dialog was presented; callers use that to decide whether the
 * 90-day timer should start.
 */
export async function requestStoreReview(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      return false;
    }
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) {
      return false;
    }
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

/**
 * All-in-one trigger, called when the Dashboard regains focus. Silently
 * does nothing unless every gate opens:
 *   - the export counter has reached the threshold,
 *   - the 90-day cooldown has elapsed,
 *   - no interstitial or rewarded ad just finished (Google's policy asks for
 *     the review flow not to coincide with a monetization interruption).
 *
 * The request itself is deferred past the current interactions and a short
 * settle beat, so it never lands at the same instant as the Dashboard banner
 * refreshing. Every failure path is swallowed.
 */
export function maybeRequestRateUs(): void {
  void (async () => {
    try {
      if (!(await shouldRequestRateUs())) {
        return;
      }
      if (msSinceLastInterstitialClosed() < INTERSTITIAL_QUIET_MS) {
        return;
      }
      if (msSinceLastRewardedClosed() < REWARDED_QUIET_MS) {
        return;
      }
      InteractionManager.runAfterInteractions(() => {
        // A beat of quiet after the screen settles — a "natural pause point".
        setTimeout(() => {
          void (async () => {
            try {
              if (!(await shouldRequestRateUs())) {
                return;
              }
              const shown = await requestStoreReview();
              if (shown) {
                await markRateUsRequested();
              }
            } catch {
              // Reviews must never become an error the user sees.
            }
          })();
        }, 1500);
      });
    } catch {
      // Same posture as above.
    }
  })();
}
