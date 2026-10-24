import { useCallback, useEffect, useState } from 'react';
import type { Document, Folder } from '@/types/document';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage';
import {
  deleteAllScansFiles,
  deleteDocumentFiles,
  getTotalScansSizeBytes,
  formatBytes,
} from '@/lib/fileManager';
import {
  isDuplicateFolderName,
  loadFolders,
  normalizeFolderName,
  normalizeFolders,
  saveFolders,
} from '@/lib/folders';
import { markDocumentOpened } from '@/lib/activity';

export type FolderResult =
  | { status: 'ok'; folder: Folder }
  | { status: 'duplicate' | 'invalid' | 'error'; folder?: undefined };

export interface UseDocumentsValue {
  documents: Document[];
  folders: Folder[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (doc: Document) => Promise<Document>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addFolder: (rawName: string) => Promise<FolderResult>;
  renameFolder: (id: string, rawName: string) => Promise<FolderResult>;
  /** Deletes the folder only; its documents move to Unfiled, PDFs untouched. */
  removeFolder: (id: string) => Promise<void>;
  /** Moves a document to a folder, or to Unfiled when folderId is null. */
  moveDocument: (docId: string, folderId: string | null) => Promise<void>;
  /** Records an open (viewer / share screen) for "Recently opened" sorting. */
  setLastOpened: (docId: string) => Promise<void>;  totalStorageBytes: number;
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);

  const load = useCallback(async () => {
    // Reads BOTH indexes in one go. Old records with no `folderId` field (or
    // null) are Unfiled by construction — `isUnfiled` treats the missing
    // field as Unfiled, so Release-1 data needs no migration whatsoever.
    const [list, folderList] = await Promise.all([
      getItem<Document[]>(STORAGE_KEYS.documents),
      loadFolders(),
    ]);
    setDocuments((list ?? []).sort((a, b) => b.createdAt - a.createdAt));
    setFolders(folderList);
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

  /**
   * Validates and creates a folder. Validation runs against the PERSISTED
   * folder list (not the in-memory copy) so two hook instances — the Home tab
   * and a Folder screen — never disagree about duplicates.
   */
  const addFolder = useCallback(async (rawName: string): Promise<FolderResult> => {
    const name = normalizeFolderName(rawName);
    if (!name) {
      return { status: 'invalid' };
    }
    try {
      const persisted = await loadFolders();
      if (isDuplicateFolderName(name, persisted)) {
        return { status: 'duplicate' };
      }
      const folder: Folder = {
        id: `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        createdAt: Date.now(),
      };
      await saveFolders([...persisted, folder]);
      await load();
      return { status: 'ok', folder };
    } catch {
      return { status: 'error' };
    }
  }, [load]);

  const renameFolder = useCallback(
    async (id: string, rawName: string): Promise<FolderResult> => {
      const name = normalizeFolderName(rawName);
      if (!name) {
        return { status: 'invalid' };
      }
      try {
        const persisted = await loadFolders();
        if (isDuplicateFolderName(name, persisted, id)) {
          return { status: 'duplicate' };
        }
        const next = persisted.map((f) => (f.id === id ? { ...f, name } : f));
        await saveFolders(next);
        await load();
        return { status: 'ok', folder: next.find((f) => f.id === id)! };
      } catch {
        return { status: 'error' };
      }
    },
    [load],
  );

  /** Removes the folder and re-files its documents to Unfiled. Never touches
   *  any PDF/thumbnail file — only the two metadata indexes change. */
  const removeFolder = useCallback(
    async (id: string): Promise<void> => {
      try {
        const [persistedFolders, persistedDocs] = await Promise.all([
          loadFolders(),
          getItem<Document[]>(STORAGE_KEYS.documents),
        ]);
        await saveFolders(persistedFolders.filter((f) => f.id !== id));
        await setItem(
          STORAGE_KEYS.documents,
          (persistedDocs ?? []).map((d) =>
            d.folderId === id ? { ...d, folderId: null } : d,
          ),
        );
        await load();
      } catch {
        setError('Could not delete the folder.');
      }
    },
    [load],
  );

  /** Persists the move against the stored index (the in-memory copy may be
   *  stale when the call comes from another screen's hook instance). */
  const moveDocument = useCallback(
    async (docId: string, folderId: string | null): Promise<void> => {
      try {
        const persisted = (await getItem<Document[]>(STORAGE_KEYS.documents)) ?? [];
        // Guard: never point a document at a folder that no longer exists.
        const target =
          folderId === null ||
          normalizeFolders(await getItem(STORAGE_KEYS.folders)).some(
            (f) => f.id === folderId,
          );
        if (!target) {
          return;
        }
        await setItem(
          STORAGE_KEYS.documents,
          persisted.map((d) => (d.id === docId ? { ...d, folderId } : d)),
        );
        await load();
      } catch {
        setError('Could not move the document.');
      }
    },
    [load],
  );

  /** Persist-only (no list-reload churn): the listing screens refresh on
   *  focus anyway, which is what keeps "Recently opened" accurate. */
  const setLastOpened = useCallback(
    async (docId: string): Promise<void> => {
      await markDocumentOpened(docId);
    },
    [],
  );

  return {
    documents,
    folders,
    loading,
    error,
    refresh,
    create,
    rename,
    remove,
    clearAll,
    addFolder,
    renameFolder,
    removeFolder,
    moveDocument,
    setLastOpened,
    totalStorageBytes,
    totalStorageLabel: formatBytes(totalStorageBytes),
  };
}