import * as Print from 'expo-print';
import { File } from 'expo-file-system';

// A4 dimensions in pixels at expo-print's 72 PPI coordinate system. expo-print
// defaults to US Letter (612x792); pinning A4 here guarantees the PDF matches
// the requested A4 template regardless of platform defaults.
export const A4_PAGE_WIDTH = 595.28;
export const A4_PAGE_HEIGHT = 841.89;

function mimeTypeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    // expo-print / WKWebView cannot decode HEIC reliably; callers should
    // normalize images to JPEG/PNG before reaching this function.
    return 'image/heic';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export async function uriToBase64DataUri(uri: string): Promise<string> {
  const file = new File(uri);
  let base64: string;
  try {
    base64 = await file.base64();
  } catch (e) {
    throw new Error(
      `Could not read page image "${uri}". ${
        e instanceof Error ? e.message : 'Unknown file read error.'
      }`,
    );
  }
  return `data:${mimeTypeForUri(uri)};base64,${base64}`;
}

/**
 * Assembles a single A4 page whose geometry is expressed in FIXED Adobe
 * points (595×842 = A4 portrait) — never `100vw`/`100vh`. expo-print's
 * underlying WebView print path (Android's PrintedPdfDocument/WebView and
 * iOS WebKit) does not reliably resolve viewport units to the printed page,
 * which collapses the container and leaves images pinned small in the
 * top-left corner.
 *
 * Prepared page images are already letterboxed onto an exact-A4-ratio canvas
 * (see `letterboxToA4Page`), so they use a full-bleed layout: the image fills
 * the page and its centering is baked into the image's own pixels — no CSS
 * centering to depend on. Any other image (odd ratio, or dimensions
 * unavailable at runtime) uses the framed flex layout below: a 24pt margin,
 * `object-fit: contain`, and belt-and-suspenders centering
 * (`justify-content`/`align-items` plus `margin: auto`), so it is never
 * stretched, never overflows the A4 boundary, and is not pinned top-left.
 */
function buildPageHtml(
  src: string,
  size?: { width: number; height: number },
): string {
  if (size && size.width > 0 && size.height > 0) {
    const imgRatio = size.height / size.width;
    const pageRatio = A4_PAGE_HEIGHT / A4_PAGE_WIDTH;
    if (Math.abs(imgRatio - pageRatio) / pageRatio < 0.01) {
      return `<div class="page page-bleed"><img src="${src}" alt="page" /></div>`;
    }
  }
  return `<div class="page page-framed"><img src="${src}" alt="page" /></div>`;
}

/**
 * Assembles the A4 page-per-image HTML document. Images are inlined as base64
 * data URIs because on iOS `expo-print`'s WebView cannot load local `file://`
 * asset paths. Pages are sized in fixed Adobe points (595.28×841.89, A4
 * portrait) matching the page size passed to `printToFileAsync`, so every page
 * renders exactly one A4 output page across rendering engines.
 *
 * Layout rules (see `buildPageHtml`): A4-ratio pages render full-bleed with
 * the centering baked into the letterboxed image; everything else centers
 * inside a 24pt frame using flex + `margin: auto` + `object-fit: contain`.
 */
export function buildPdfHtml(
  imageDataUris: string[],
  imageSizes?: Array<{ width: number; height: number } | null>,
): string {
  const sizes = `
      @page { size: ${A4_PAGE_WIDTH}pt ${A4_PAGE_HEIGHT}pt; margin: 0; }
      html, body { margin: 0; padding: 0; width: ${A4_PAGE_WIDTH}pt; background-color: #ffffff; }
      .page {
        page-break-after: always;
        width: ${A4_PAGE_WIDTH}pt;
        height: ${A4_PAGE_HEIGHT}pt;
        box-sizing: border-box;
        margin: 0;
        overflow: hidden;
      }
      .page:last-child { page-break-after: auto; }
      .page img {
        display: block;
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        margin: auto;
      }
      .page-bleed { padding: 0; }
      .page-bleed img { width: ${A4_PAGE_WIDTH}pt; height: ${A4_PAGE_HEIGHT}pt; }
      .page-framed {
        padding: 24pt;
        display: flex;
        justify-content: center;
        align-items: center;
      }`;
  const pages = imageDataUris
    .map((src, i) => buildPageHtml(src, imageSizes?.[i] ?? undefined))
    .join('\n');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${sizes}
    </style>
  </head>
  <body>
${pages}
  </body>
</html>`;
}

export interface PdfResult {
  uri: string;
  numberOfPages: number;
  /**
   * The full PDF encoded as base64. Provided because on Android inside Expo Go
   * the `cache/Print/` file is outside the grantable permission set and cannot
   * be read via any file API — expo-print encodes it natively, so callers can
   * persist the bytes without reading the source file.
   */
  base64?: string | null;
}

/**
 * Renders the assembled HTML to a PDF via expo-print. The file lands in the
 * app cache directory; the caller moves it into permanent storage.
 */
export async function generatePdfFromImages(
  imageUris: string[],
  onProgress?: (stage: string) => void,
  imageSizes?: Array<{ width: number; height: number } | null>,
): Promise<PdfResult> {
  if (imageUris.length === 0) {
    throw new Error('Cannot generate a PDF with zero pages.');
  }

  onProgress?.('Preparing pages…');
  const dataUris: string[] = [];
  for (const uri of imageUris) {
    dataUris.push(await uriToBase64DataUri(uri));
  }

  onProgress?.('Rendering PDF…');
  const html = buildPdfHtml(dataUris, imageSizes);
  let result: {
    uri: string;
    numberOfPages?: number;
    base64?: string | null;
  };
  try {
    result = await Print.printToFileAsync({
      html,
      base64: true,
      width: A4_PAGE_WIDTH,
      height: A4_PAGE_HEIGHT,
    });
  } catch (e) {
    throw new Error(
      `The PDF renderer failed. ${
        e instanceof Error ? e.message : 'Unknown rendering error.'
      }`,
    );
  }

  return {
    uri: result.uri,
    numberOfPages: result.numberOfPages ?? imageUris.length,
    base64: result.base64,
  };
}