import type { Document } from '@/types/document';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage';

/**
 * Records that a document was opened (PDF viewer or share screen) so the
 * "Recently opened" sort is accurate. Persist-only on purpose — listing
 * screens re-read on focus, and churning list state from a viewer screen
 * would repaint things for no user-visible benefit.
 */
export async function markDocumentOpened(docId: string): Promise<void> {
  try {
    const persisted = (await getItem<Document[]>(STORAGE_KEYS.documents)) ?? [];
    if (!persisted.some((d) => d.id === docId)) {
      return;
    }
    await setItem(
      STORAGE_KEYS.documents,
      persisted.map((d) =>
        d.id === docId ? { ...d, lastOpenedAt: Date.now() } : d,
      ),
    );
  } catch {
    // Best-effort bookkeeping; sorting simply treats it as never opened.
  }
}
