import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/config';
import { getAdsConsentPersonalized, isAdsAvailable } from '@/lib/ads';

// Backoff between banner (re)load attempts. A single failure must never kill
// the banner for the session — fresh ad units and slow-filling builds commonly
// miss the first few requests, then fill fine moments later.
const RETRY_BACKOFF_MS = [3000, 6000, 12000, 30000];

/**
 * Anchored adaptive banner for the Dashboard. Fully opt-in via ADS_ENABLED and
 * disabled when the AdMob native module is absent (Expo Go).
 *
 * Robust to a flaky network / slow first fill: on a load failure it waits,
 * then remounts a fresh BannerAd (new request). The retry budget resets
 * whenever the dashboard regains focus, so a banner that missed while the user
 * was away gets another chance on every visit home.
 */
export default function AdBanner() {
  const [nonce, setNonce] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const failCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleFailed = useCallback(() => {
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

  if (!ADS_ENABLED || giveUp || !isAdsAvailable()) {
    return null;
  }

  // RNGMA's BannerAd does not forward standard View props; an adaptive banner
  // explicitly sized to the device width measures the slot correctly (the
  // library otherwise defaults to full device width anyway).
  const bannerWidth = Math.floor(Dimensions.get('window').width);

  return (
    <View key={nonce} style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        width={bannerWidth}
        requestOptions={{
          requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
        }}
        onAdLoaded={() => {
          // A successful load clears the failure streak so future hiccups get
          // the full retry budget again.
          failCountRef.current = 0;
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