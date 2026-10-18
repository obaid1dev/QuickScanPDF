import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScanPage } from '@/types/document';

export type ScanPagePatch =
  | Partial<ScanPage>
  | ((prev: ScanPage) => Partial<ScanPage>);

export interface ScanSessionValue {
  pages: ScanPage[];
  currentPageId: string | null;
  activePage: ScanPage | null;
  isActive: boolean;
  addPage: (originalUri: string) => string;
  updatePage: (id: string, patch: ScanPagePatch) => void;
  getPage: (id: string) => ScanPage | null;
  removePage: (id: string) => boolean;
  setCurrentPage: (id: string) => void;
  clearSession: () => void;
}

const ScanSessionContext = createContext<ScanSessionValue | null>(null);

function createPageId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Provides in-memory state for the active multi-page scan flow. Lives only for
 * the duration of a scan session; cleared after PDF generation or cancellation.
 *
 * Mirrors (`pagesRef`/`currentRef`) stay in sync with React state so mutators
 * like `removePage` can read the latest snapshot synchronously — state updater
 * functions are not guaranteed to run at call time.
 */
export function ScanSessionProvider({ children }: { children: React.ReactNode }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [currentPageId, setCurrentPageIdState] = useState<string | null>(null);

  const pagesRef = useRef<ScanPage[]>([]);
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    currentRef.current = currentPageId;
  }, [currentPageId]);

  const addPage = useCallback((originalUri: string): string => {
    const id = createPageId();
    const page: ScanPage = {
      id,
      originalUri,
      processedUri: originalUri,
      rotation: 0,
    };
    pagesRef.current = [...pagesRef.current, page];
    currentRef.current = id;
    setPages(pagesRef.current);
    setCurrentPageIdState(id);
    return id;
  }, []);

  const updatePage = useCallback((id: string, patch: ScanPagePatch) => {
    pagesRef.current = pagesRef.current.map((p) => {
      if (p.id !== id) {
        return p;
      }
      const resolved =
        typeof patch === 'function' ? patch(p) : patch;
      return { ...p, ...resolved };
    });
    setPages(pagesRef.current);
  }, []);

  const getPage = useCallback(
    (id: string): ScanPage | null =>
      pagesRef.current.find((p) => p.id === id) ?? null,
    [],
  );

  const getPages = useCallback((): ScanPage[] => pagesRef.current, []);

  const removePage = useCallback((id: string): boolean => {
    const prev = pagesRef.current;
    if (!prev.some((p) => p.id === id)) {
      return false;
    }
    const idx = prev.findIndex((p) => p.id === id);
    const next = prev.filter((p) => p.id !== id);
    pagesRef.current = next;
    setPages(next);

    if (currentRef.current === id) {
      const replacement = next[idx] ?? next[next.length - 1] ?? null;
      const nextCurrent = replacement ? replacement.id : null;
      currentRef.current = nextCurrent;
      setCurrentPageIdState(nextCurrent);
    }
    return true;
  }, []);

  const setCurrentPage = useCallback((id: string) => {
    currentRef.current = id;
    setCurrentPageIdState(id);
  }, []);

  const clearSession = useCallback(() => {
    pagesRef.current = [];
    currentRef.current = null;
    setPages([]);
    setCurrentPageIdState(null);
  }, []);

  const value = useMemo<ScanSessionValue>(() => {
    const activePage = pages.find((p) => p.id === currentPageId) ?? null;
    return {
      pages,
      currentPageId,
      activePage,
      isActive: pages.length > 0,
      addPage,
      updatePage,
      getPage,
      removePage,
      setCurrentPage,
      clearSession,
    };
  }, [pages, currentPageId, addPage, updatePage, getPage, removePage, setCurrentPage, clearSession]);

  return (
    <ScanSessionContext.Provider value={value}>
      {children}
    </ScanSessionContext.Provider>
  );
}

export function useScanSession(): ScanSessionValue {
  const ctx = useContext(ScanSessionContext);
  if (!ctx) {
    throw new Error('useScanSession must be used within a ScanSessionProvider');
  }
  return ctx;
}