import { useCallback, useEffect, useRef, useState } from 'react';
import { ADS_ENABLED, OCR_FREE_PER_DAY } from '@/constants/config';
import { recognizeTextFromImage } from '@/lib/ocr';
import { getOcrUsedToday, recordOcrUse } from '@/lib/ocrQuota';
import { useRewardedAd } from '@/hooks/useRewardedAd';

export type OcrSheetStatus = 'loading' | 'result' | 'error';

export interface OcrSheetState {
  visible: boolean;
  status: OcrSheetStatus;
  /** What was scanned, e.g. "Page 2 text" or "Document text". */
  label: string;
  text: string;
  error: string;
}

export interface OcrFlow {
  /**
   * Runs OCR for one or more page images through the daily free-cap -> rewarded
   * ad gate, then opens the result sheet. Safe to call from any screen.
   */
  requestOcr: (uris: string[], label?: string) => void;
  dismissSheet: () => void;
  sheet: OcrSheetState;
  /** Reward prompt shown once today's free runs are used up. */
  promptVisible: boolean;
  watchAd: () => void;
  cancelWatchAd: () => void;
  /** Short message shown inside the reward prompt ("Ad not ready..."). */
  rewardMessage: string | null;
}

interface OcrJob {
  uris: string[];
  label: string;
}

const DEFAULT_LABEL = 'Page text';

/**
 * Orchestrates the whole "Extract text" experience:
 *   1. Runs while today's free allowance lasts (records one use per run).
 *   2. Past that, prompts for a rewarded ad - the run only happens once the
 *      reward is earned.
 *   3. If no ad is ready or showing fails, the run happens anyway for free, so
 *      an unfilled ad can never block the feature.
 *
 * Callers render `<OcrFlowView flow={ocr} />` for the sheet + prompt.
 *
 * `busyRef` only guards the free/resolve path (every writer clears it in a
 * `finally`), while the reward prompt consumes `pendingRef` on the first tap -
 * so a missing ad event can never wedge the feature shut.
 */
export function useOcrFlow(active = true): OcrFlow {
  const [sheet, setSheet] = useState<OcrSheetState>({
    visible: false,
    status: 'loading',
    label: '',
    text: '',
    error: '',
  });
  const [promptVisible, setPromptVisible] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  const busyRef = useRef(false);
  const pendingRef = useRef<OcrJob | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Preloads the rewarded ad as soon as this screen mounts so it is likely
  // ready by the time the free cap is hit.
  const rewarded = useRewardedAd(active && ADS_ENABLED);

  const run = useCallback(async (job: OcrJob) => {
    busyRef.current = true;
    setSheet({
      visible: true,
      status: 'loading',
      label: job.label,
      text: '',
      error: '',
    });
    try {
      const parts: string[] = [];
      for (const uri of job.uris) {
        const text = await recognizeTextFromImage(uri);
        if (text) {
          parts.push(text);
        }
      }
      if (!mountedRef.current) {
        return;
      }
      setSheet((prev) => ({
        ...prev,
        visible: true,
        status: 'result',
        text: parts.join('\n\n').trim(),
        error: '',
      }));
    } catch (e) {
      if (!mountedRef.current) {
        return;
      }
      setSheet((prev) => ({
        ...prev,
        visible: true,
        status: 'error',
        text: '',
        error:
          e instanceof Error
            ? e.message
            : 'Could not read the text from this scan.',
      }));
    } finally {
      busyRef.current = false;
    }
  }, []);

  const requestOcr = useCallback(
    (uris: string[], label: string = DEFAULT_LABEL) => {
      if (busyRef.current || uris.length === 0) {
        return;
      }
      const job: OcrJob = { uris, label };
      busyRef.current = true;
      void (async () => {
        try {
          // Ads off -> OCR is always free, no gate at all.
          if (!ADS_ENABLED) {
            await run(job);
            return;
          }
          const used = await getOcrUsedToday();
          if (used < OCR_FREE_PER_DAY) {
            await recordOcrUse();
            await run(job);
            return;
          }
          // Free cap reached -> offer the rewarded path.
          pendingRef.current = job;
          busyRef.current = false;
          if (mountedRef.current) {
            setPromptVisible(true);
          }
        } catch {
          // A quota failure must never block text extraction.
          await run(job);
        }
      })();
    },
    [run],
  );

  const watchAd = useCallback(() => {
    const job = pendingRef.current;
    if (!job) {
      setPromptVisible(false);
      return;
    }

    /**
     * The ad shows only after this returns true, so the prompt stays open with
     * a "not ready" message until an ad is loaded - the job is kept pending
     * for the next tap. Cancelling (the prompt's other button) always works,
     * so the user is never blocked.
     */
    const shown = rewarded.show({
      onEarned: () => {
        pendingRef.current = null;
        setPromptVisible(false);
        setRewardMessage(null);
        void (async () => {
          try {
            await recordOcrUse();
          } catch {
            // Losing the counter entry is cosmetic - still extract the text.
          }
          await run(job);
        })();
      },
      onUnavailable: () => {
        setRewardMessage('Ad not ready, try again in a moment.');
        rewarded.preload();
      },
      onClosedWithoutReward: () => {
        pendingRef.current = job;
        setRewardMessage(null);
        setPromptVisible(true);
      },
    });

    if (shown) {
      setPromptVisible(false);
      setRewardMessage(null);
    }
  }, [rewarded, run]);

  const cancelWatchAd = useCallback(() => {
    pendingRef.current = null;
    busyRef.current = false;
    setRewardMessage(null);
    setPromptVisible(false);
  }, []);

  const dismissSheet = useCallback(() => {
    setSheet((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    requestOcr,
    dismissSheet,
    sheet,
    promptVisible,
    watchAd,
    cancelWatchAd,
    rewardMessage,
  };
}
