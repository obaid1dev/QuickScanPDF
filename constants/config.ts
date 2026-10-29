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

  /** Anchored adaptive banner pinned to the bottom of the document viewer. */
  viewerBanner: __DEV__
    ? Platform.select({
        ios: 'ca-app-pub-3940256099942544/2934735716',
        android: 'ca-app-pub-3940256099942544/6300978111',
      })!
    : 'ca-app-pub-1138568424665362/6530342141',

  /** Watched to earn one extra "Extract text" run after the daily free cap. */
  rewarded: __DEV__
    ? Platform.select({
        ios: 'ca-app-pub-3940256099942544/1712485313',
        android: 'ca-app-pub-3940256099942544/5224354917',
      })!
    : 'ca-app-pub-1138568424665362/2545583845',

  /**
   * Shown when the app returns from the background (never on cold launch).
   * Gated by a cooldown plus screen/activity suppressions.
   */
  appOpen: __DEV__
    ? Platform.select({
        ios: 'ca-app-pub-3940256099942544/5137585807',
        android: 'ca-app-pub-3940256099942544/9257395921',
      })!
    : 'ca-app-pub-1138568424665362/1531561674',
} as const;

/**
 * Free on-device "Extract text" runs per calendar day. Runs past this cap ask
 * the user to watch a rewarded ad; when no ad is available they still run free
 * (the feature must never be blocked behind an unfilled ad).
 */
export const OCR_FREE_PER_DAY = 2;

export const STORAGE_KEYS = {
  documents: 'quickscan:documents',
  folders: 'quickscan:folders',
  sort: 'quickscan:sort',
  downloadsDir: 'quickscan:downloads_dir',
  exportCount: 'quickscan:exportCount',
  ocrUsage: 'quickscan:ocrUsage',
  theme: 'quickscan:theme',
  rateUsLastRequest: 'quickscan:rateUsLastRequest',
} as const;

/** Maximum length of a folder name, after trimming spaces. */
export const FOLDER_NAME_MAX_LENGTH = 40;

/** App-open ad: minimum gap between two app-open impressions. */
export const APP_OPEN_MIN_INTERVAL_MS = 4 * 60 * 1000;
/** App-open ad: hold-off window after an interstitial closes. */
export const INTERSTITIAL_QUIET_MS = 30 * 1000;
/** Rewarded ad (OCR): hold-off window after a rewarded ad closes. */
export const REWARDED_QUIET_MS = 30 * 1000;
/** Rate-us popup: first eligible after this many successful exports... */
export const RATE_US_EXPORT_THRESHOLD = 3;
/** ...and never re-requested within this window. */
export const RATE_US_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export const SCANS_FOLDER = 'scans';

export const APP_VERSION = '1.0.7';