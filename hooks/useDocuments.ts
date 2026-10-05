import { useCallback, useEffect, useState } from 'react';
import type { Document } from '@/types/document';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage';
import {
  deleteAllScansFiles,
  deleteDocumentFiles,
  getTotalScansSizeBytes,
  formatBytes,
} from '@/lib/fileManager';

export interface UseDocumentsValue {
  documents: Document[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (doc: Document) => Promise<Document>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  totalStorageBytes: number;
  totalStorageLabel: string;
}

function sortDesc(a: Document, b: Document): number {
  return b.createdAt - a.createdAt;
}

/**
 * CRUD over the locally persisted Document metadata index (AsyncStorage) plus
 * the on-disk PDF/thumbnail files. Full offline persistence.
 */
export function useDocuments(): UseDocumentsValue {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);

  const load = useCallback(async () => {
    const list = await getItem<Document[]>(STORAGE_KEYS.documents);
    setDocuments((list ?? []).sort(sortDesc));
    setTotalStorageBytes(getTotalScansSizeBytes());
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      setError('Could not load scan history.');
      setLoading(false);
    });
  }, [load]);

  const refresh = useCallback(async () => {
    setError(null);
    // Deliberately does NOT toggle `loading`: toggling it here would blank the
    // dashboard to a spinner and unmount the whole list on every focus/pull-to-
    // refresh, forcing all thumbnails to decode again. The initial mount shows
    // the spinner via the default `loading=true`; later refreshes update in
    // place.
    await load().catch(() => setError('Could not refresh scan history.'));
  }, [load]);

  const persist = useCallback(async (next: Document[]) => {
    await setItem(STORAGE_KEYS.documents, next.sort(sortDesc));
    setDocuments([...next].sort(sortDesc));
    setTotalStorageBytes(getTotalScansSizeBytes());
  }, []);

  const create = useCallback(
    async (doc: Document): Promise<Document> => {
      // Always merge with what is ACTUALLY persisted: the share screen runs its
      // own hook instance whose in-memory list can be empty or stale at the
      // moment `create` fires, and trusting it would silently overwrite the
      // history index and "lose" earlier scans.
      const persisted = (await getItem<Document[]>(STORAGE_KEYS.documents)) ?? [];
      const exists = persisted.some((d) => d.id === doc.id);
      const next = exists ? persisted : [...persisted, doc];
      await persist(next);
      return doc;
    },
    [persist],
  );

  const rename = useCallback(
    async (id: string, title: string): Promise<void> => {
      const next = documents.map((d) => (d.id === id ? { ...d, title } : d));
      await persist(next);
    },
    [documents, persist],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const target = documents.find((d) => d.id === id);
      if (target) {
        deleteDocumentFiles(target);
      }
      const next = documents.filter((d) => d.id !== id);
      await persist(next);
    },
    [documents, persist],
  );

  /**
   * Wipes the entire scan history in one action: every scan file is removed
   * with a single recursive folder delete, and the metadata index is cleared
   * with a single storage write. Deliberately NOT a loop of `remove(id)` —
   * that persisted (and re-rendered) once per document, which is what made the
   * button look like it was deleting documents one at a time.
   */
  const clearAll = useCallback(async (): Promise<void> => {
    deleteAllScansFiles();
    await persist([]);
  }, [persist]);

  return {
    documents,
    loading,
    error,
    refresh,
    create,
    rename,
    remove,
    clearAll,
    totalStorageBytes,
    totalStorageLabel: formatBytes(totalStorageBytes),
  };
}