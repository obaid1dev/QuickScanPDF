import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/config';
import { getAdsConsentPersonalized, isAdsAvailable } from '@/lib/ads';

/**
 * Anchored adaptive banner for the Dashboard. Fully opt-in via ADS_ENABLED and
 * disabled when the AdMob native module is absent (Expo Go). If the banner
 * fails to load it renders `null` so a broken/blank frame never shifts the
 * layout.
 */
export default function AdBanner() {
  const [failed, setFailed] = useState(false);

  if (!ADS_ENABLED || failed || !isAdsAvailable()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: !getAdsConsentPersonalized(),
        }}
        onAdFailedToLoad={() => setFailed(true)}
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