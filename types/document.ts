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
}
