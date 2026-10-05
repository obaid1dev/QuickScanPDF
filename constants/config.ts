import { Platform } from 'react-native';

export const ADS_ENABLED = true;

export const AD_UNIT_IDS = {
  banner: __DEV__
    ? Platform.select({
        ios: 'ca-app-pub-3940256099942544/2934735716',
        android: 'ca-app-pub-3940256099942544/6300978111',
      })!
    : 'ca-app-pub-1138568424665362/8225859358',

  interstitial: __DEV__
    ? Platform.select({
        ios: 'ca-app-pub-3940256099942544/4411468910',
        android: 'ca-app-pub-3940256099942544/1033173712',
      })!
    : 'ca-app-pub-1138568424665362/5141987288',
} as const;

export const STORAGE_KEYS = {
  documents: 'quickscan:documents',
  downloadsDir: 'quickscan:downloads_dir',
  exportCount: 'quickscan:exportCount',
} as const;

export const SCANS_FOLDER = 'scans';

export const APP_VERSION = '1.0.1';