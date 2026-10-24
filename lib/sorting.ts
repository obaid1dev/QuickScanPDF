import type { Document } from '@/types/document';

/**
 * The single sorting implementation for the Home and Folder screens.
 */

export type SortOption = 'newest' | 'oldest' | 'name' | 'size' | 'recent';

export const SORT_OPTIONS: ReadonlyArray<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'A–Z' },
  { value: 'size', label: 'Size' },
  { value: 'recent', label: 'Recent' },
];

export const DEFAULT_SORT: SortOption = 'newest';

export function isSortOption(value: unknown): value is SortOption {
  return (
    typeof value === 'string' &&
    SORT_OPTIONS.some((option) => option.value === value)
  );
}

/** Absent or null folderId (Release-1 records) means Unfiled. */
export function isUnfiled(doc: Document): boolean {
  return doc.folderId == null;
}

/** True when the document sits in the folder with the given id. */
export function isInFolder(doc: Document, folderId: string): boolean {
  return doc.folderId === folderId;
}

/**
 * Returns a NEW sorted array (input is never mutated).
 *
 * - newest / oldest: by createdAt.
 * - name: case-insensitive A–Z (ties break newest-first).
 * - size: largest first.
 * - recently opened: never-opened documents sort last (newest-first among
 *   themselves); opened ones sort by lastOpenedAt, newest first.
 */
export function sortDocuments(
  docs: Document[],
  option: SortOption,
): Document[] {
  const sorted = [...docs];
  sorted.sort((a, b) => {
    switch (option) {
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'name': {
        const byName = a.title
          .toLowerCase()
          .localeCompare(b.title.toLowerCase());
        return byName !== 0 ? byName : b.createdAt - a.createdAt;
      }
      case 'size':
        return b.fileSizeBytes - a.fileSizeBytes;
      case 'recent': {
        const aOpened = a.lastOpenedAt ?? null;
        const bOpened = b.lastOpenedAt ?? null;
        if (aOpened !== null && bOpened !== null) {
          return bOpened - aOpened;
        }
        if (aOpened !== null && bOpened === null) {
          return -1;
        }
        if (aOpened === null && bOpened !== null) {
          return 1;
        }
        return b.createdAt - a.createdAt;
      }
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  });
  return sorted;
}
