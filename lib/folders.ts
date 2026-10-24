import { FOLDER_NAME_MAX_LENGTH, STORAGE_KEYS } from '@/constants/config';
import { getItem, setItem } from '@/lib/storage';
import type { Folder } from '@/types/document';

/**
 * Pure folder helpers plus AsyncStorage load/save. Folder records live under
 * their own storage key - separate from the document index - so Release-1
 * installs need no migration at all.
 */

/**
 * Trims the edges, collapses internal whitespace runs to single spaces and
 * caps the length at FOLDER_NAME_MAX_LENGTH. Returns '' when nothing usable
 * remains.
 */
export function normalizeFolderName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX_LENGTH);
}

/** Duplicate check is case-insensitive; `ignoreId` excludes the folder being renamed. */
export function isDuplicateFolderName(
  name: string,
  folders: Folder[],
  ignoreId?: string,
): boolean {
  const needle = name.toLowerCase();
  return folders.some(
    (f) => f.id !== ignoreId && f.name.toLowerCase() === needle,
  );
}

/**
 * Runtime guard for persisted folder data: tolerates corruption, partial
 * writes or extra/missing fields by keeping only well-formed records.
 */
export function normalizeFolders(raw: unknown): Folder[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (f): f is Folder =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as Folder).id === 'string' &&
      typeof (f as Folder).name === 'string' &&
      typeof (f as Folder).createdAt === 'number',
  );
}

export async function loadFolders(): Promise<Folder[]> {
  return normalizeFolders(await getItem<Folder[]>(STORAGE_KEYS.folders));
}

export async function saveFolders(folders: Folder[]): Promise<boolean> {
  return setItem(STORAGE_KEYS.folders, folders);
}
