export interface ScanPage {
  id: string;
  originalUri: string;
  processedUri: string;
  rotation: 0 | 90 | 180 | 270;
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
  /**
   * Folder this scan lives in. Absent or null (all Release-1 records) means
   * Unfiled — documents start Unfiled and a record never needs migrating.
   */
  folderId?: string | null;
  /** Last time the document was opened in the viewer or share screen. */
  lastOpenedAt?: number | null;
}

/** A user-created folder; stored separately from the document index. */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}
