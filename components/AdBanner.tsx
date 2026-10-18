import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/config';
import { getAdsConsentPersonalized, loadAdsModule } from '@/lib/ads';

// Backoff between banner (re)load attempts. A single failure must never kill
// the banner for the session — fresh ad units and slow-filling builds commonly
// miss the first few requests, then fill fine moments later.
const RETRY_BACKOFF_MS = [3000, 6000, 12000, 30000];

/**
 * Anchored adaptive banner for the Dashboard. Fully opt-in via ADS_ENABLED and
 * never renders when the AdMob native addon is absent (Expo Go) — the SDK
 * itself is loaded lazily so this module does not blow up the route bundle.
 *
 * Robust to a flaky network / slow first fill: on a load failure it waits,
 * then remounts a fresh BannerAd (new request). The retry budget resets
 * whenever the dashboard regains focus, so a banner that missed while the user
 * was away gets another chance on every visit home.
 */
export interface AdBannerProps {
  /** Optional custom unit ID (defaults to the Dashboard banner). */
  unitId?: string;
  /** Optional custom ad size; defaults to a large anchored adaptive banner. */
  size?: import('react-native-google-mobile-ads').BannerAdSize;
}

export default function AdBanner({
  unitId,
  size,
}: AdBannerProps = {}) {
  const [adsModule, setAdsModule] = useState<
    typeof import('react-native-google-mobile-ads') | null
  >(null);
  const [unsupported, setUnsupported] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const failCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the AdMob module once, safely. In Expo Go the dynamic import fails
  // (native addon missing) and the banner permanently stays out of the way.
  useEffect(() => {
    if (!ADS_ENABLED) {
      return;
    }
    let cancelled = false;
    const boot = async () => {
      const mod = await loadAdsModule();
      if (cancelled) {
        return;
      }
      if (!mod) {
        setUnsupported(true);
        return;
      }
      setAdsModule(mod);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Diagnostics: filter with `adb logcat -s QuickScan:V`.
  useEffect(() => {
    if (!ADS_ENABLED) {
      console.log('[QuickScan] Banner: disabled via ADS_ENABLED');
    } else if (adsModule) {
      console.log(
        `[QuickScan] Banner: AdMob module ready, requesting ${
          unitId ?? AD_UNIT_IDS.banner
        }`,
      );
    }
  }, [adsModule, unitId]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  // Reset the retry budget (and force one fresh attempt) each time the
  // dashboard regains focus. The home screen stays mounted under the stack, so
  // this is the natural "banner is visible again" signal.
  useFocusEffect(
    useCallback(() => {
      failCountRef.current = 0;
      setGiveUp(false);
      setNonce((n) => n + 1);
    }, []),
  );

  const handleFailed = useCallback((error: Error) => {
    // The SDK's actual reason matters: `no-fill` / "no ad available" is normal
    // right after an account or app review window (and is not a code bug),
    // whereas "invalid request"/config errors are a real regression.
    console.log(
      `[QuickScan] Banner failed (attempt ${failCountRef.current + 1}): ${error?.message ?? error}`,
    );
    const attempt = failCountRef.current + 1;
    failCountRef.current = attempt;
    if (attempt > RETRY_BACKOFF_MS.length) {
      setGiveUp(true);
      return;
    }
    const delay = RETRY_BACKOFF_MS[attempt - 1];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // A new `nonce` remounts the BannerAd, which issues a brand-new request.
      setNonce((n) => n + 1);
    }, delay);
  }, []);

  if (!ADS_ENABLED || unsupported || giveUp || !adsModule) {
    return null;
  }

  const { BannerAd, BannerAdSize } = adsModule;

  // RNGMA's BannerAd does not forward standard View props; an adaptive banner
  // explicitly sized to the device width measures the slot correctly (the
  // library otherwise defaults to full device width anyway).
  const bannerWidth = Math.floor(Dimensions.get('window').width);
  const resolvedUnitId = unitId ?? AD_UNIT_IDS.banner;
  const resolvedSize = size ?? BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER;

  return (
    <View key={nonce} style={styles.container}>
      <BannerAd
        unitId={resolvedUnitId}
        size={resolvedSize}
        width={bannerWidth}
        requestOptions={{
          requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
        }}
        onAdLoaded={(dimensions) => {
          // A successful load clears the failure streak so future hiccups get
          // the full retry budget again.
          failCountRef.current = 0;
          console.log(
            `[QuickScan] Banner loaded: ${dimensions?.width}x${dimensions?.height}`,
          );
        }}
        onAdFailedToLoad={handleFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});