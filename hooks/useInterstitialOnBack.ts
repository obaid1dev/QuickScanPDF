import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { InterstitialController } from '@/hooks/useInterstitialAd';

/**
 * Unifies "leave this screen" into a single trigger path: the Android
 * hardware back button and whichever back arrow you attach the returned
 * `handleBack` to both show the interstitial (when one is loaded) and only
 * navigate away afterwards.
 *
 * `active` gates everything — while false (e.g. a PDF is still being
 * generated) the hardware back is left to the system so the screen can be
 * exited normally, without an ad.
 */
export function useInterstitialOnBack(
  controller: InterstitialController,
  onLeave: () => void,
  active = true,
): () => boolean {
  const busyRef = useRef(false);

  const leave = useCallback(() => {
    busyRef.current = false;
    onLeave();
  }, [onLeave]);

  const handleBack = useCallback((): boolean => {
    if (!active) {
      return false;
    }
    // Already showing an ad for this leave — swallow the extra press so we
    // never trigger a second interstitial on top of the first.
    if (busyRef.current) {
      return true;
    }
    const adShown = controller.showAdIfReady(leave);
    if (adShown) {
      busyRef.current = true;
      return true;
    }
    if (__DEV__) {
      console.log(
        '[QuickScan] Interstitial not ready — leaving this screen without an ad.',
      );
    }
    leave();
    return true;
  }, [active, controller, leave]);

  useFocusEffect(
    useCallback(() => {
      if (!active) {
        return undefined;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => sub.remove();
    }, [active, handleBack]),
  );

  return handleBack;
}