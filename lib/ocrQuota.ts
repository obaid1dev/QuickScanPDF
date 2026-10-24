import { OCR_FREE_PER_DAY, STORAGE_KEYS } from '@/constants/config';
import { pad2 } from '@/lib/format';
import { getItem, setItem } from '@/lib/storage';

interface OcrUsage {
  /** Local calendar day the counter belongs to; anything older reads as 0. */
  day: string;
  count: number;
}

function todayKey(now: Date = new Date()): string {
  return (
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  );
}

/**
 * Text-recognition runs already consumed today. Resets automatically on every
 * calendar-day rollover, so the counter never needs clearing.
 */
export async function getOcrUsedToday(): Promise<number> {
  const stored = await getItem<OcrUsage>(STORAGE_KEYS.ocrUsage);
  if (!stored || stored.day !== todayKey()) {
    return 0;
  }
  return Math.max(0, stored.count);
}

/**
 * Consumes one "Extract text" run. Returns the new daily count.
 * Storage failures are swallowed - a quota that cannot be written must never
 * stop the user from extracting text.
 */
export async function recordOcrUse(): Promise<number> {
  const count = (await getOcrUsedToday()) + 1;
  await setItem<OcrUsage>(STORAGE_KEYS.ocrUsage, { day: todayKey(), count });
  return count;
}

/** Whether a run still fits in the free allowance for today. */
export function hasFreeOcrLeft(usedToday: number): boolean {
  return usedToday < OCR_FREE_PER_DAY;
}
