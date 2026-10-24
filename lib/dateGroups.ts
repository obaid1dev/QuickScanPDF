import type { Document } from '@/types/document';
import { sortDocuments } from '@/lib/sorting';

/**
 * Date sectioning for the "All files" list: Recent (last 24h), Yesterday,
 * then one section per older calendar day, newest first. Pure - callers pass
 * the current time so the grouping is deterministic and testable.
 */

export interface DateSection {
  key: string;
  label: string;
  docs: Document[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Older-section header: "20 OCT, 2026" (uppercase month, day, year). */
export function formatDateHeader(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/**
 * Groups documents into Recent / Yesterday / dated sections:
 * - Recent: created OR opened within the last 24 hours (listed first).
 * - Yesterday: created during the previous calendar day (and not Recent).
 * - Older: one section per creation day, newest day first.
 * Documents are sorted newest first inside every section.
 */
export function groupDocumentsByDate(
  docs: Document[],
  now: number,
): DateSection[] {
  const last24hStart = now - DAY_MS;
  const yesterdayStart = startOfDay(now - DAY_MS);

  const recent: Document[] = [];
  const yesterday: Document[] = [];
  const olderMap = new Map<number, Document[]>();

  for (const doc of docs) {
    const openedAt = doc.lastOpenedAt ?? 0;
    if (doc.createdAt >= last24hStart || openedAt >= last24hStart) {
      recent.push(doc);
      continue;
    }
    const createdDay = startOfDay(doc.createdAt);
    if (createdDay === yesterdayStart) {
      yesterday.push(doc);
      continue;
    }
    let bucket = olderMap.get(createdDay);
    if (!bucket) {
      bucket = [];
      olderMap.set(createdDay, bucket);
    }
    bucket.push(doc);
  }

  const sections: DateSection[] = [];
  if (recent.length > 0) {
    sections.push({ key: 'recent', label: 'Recent', docs: sortDocuments(recent, 'newest') });
  }
  if (yesterday.length > 0) {
    sections.push({ key: 'yesterday', label: 'Yesterday', docs: sortDocuments(yesterday, 'newest') });
  }
  for (const day of [...olderMap.keys()].sort((a, b) => b - a)) {
    const bucket = olderMap.get(day)!;
    sections.push({
      key: `day_${day}`,
      label: formatDateHeader(day),
      docs: sortDocuments(bucket, 'newest'),
    });
  }
  return sections;
}
