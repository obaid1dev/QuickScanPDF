import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage';
import {
  DEFAULT_SORT,
  isSortOption,
  type SortOption,
} from '@/lib/sorting';

/**
 * The shared sort control state for Home and Folder screens. The choice is
 * persisted and validated on read; `reload` lets a screen that stayed mounted
 * (e.g. the Home tab under a pushed Folder screen) re-read what another
 * screen changed.
 */
export function useSortPreference() {
  const [sort, setSortState] = useState<SortOption>(DEFAULT_SORT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getItem<SortOption>(STORAGE_KEYS.sort);
      if (!cancelled && isSortOption(stored)) {
        setSortState(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSort = useCallback(async (next: SortOption) => {
    setSortState(next);
    // The UI switches instantly; persistence is best-effort. A failed write
    // costs nothing next session except the default order.
    await setItem(STORAGE_KEYS.sort, next).catch(() => undefined);
  }, []);

  const reload = useCallback(async () => {
    const stored = await getItem<SortOption>(STORAGE_KEYS.sort);
    if (isSortOption(stored)) {
      setSortState(stored);
    }
  }, []);

  return { sort, setSort, reload };
}
