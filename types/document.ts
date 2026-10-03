export type FilterType = 'original' | 'bw' | 'magic_color';

/**
 * Disk copies of a page's color filters (already-encoded JPEGs), keyed by the
 * rotation-only base URI they were rendered from. Pre-computing these lets the
 * editor swap filters instantly instead of re-encoding on every tap.
 */
export type PageFilterVariants = Record<string, { bw?: string; magic_color?: string }>;

export interface ScanPage {
  id: string;
  originalUri: string;
  processedUri: string;
  filter: FilterType;
  rotation: 0 | 90 | 180 | 270;
  variants?: PageFilterVariants;
}

export interface Document {
  id: string;
  title: string;
  pdfUri: string;
  thumbnailUri: string;
  pageCount: number;
  fileSizeBytes: number;
  createdAt: number;
  /** Persisted page JPEG URIs used by the in-app viewer. */
  pages?: string[];
}
