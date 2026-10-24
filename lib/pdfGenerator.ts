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
 * points (595x842 = A4 portrait) - never `100vw`/`100vh`. expo-print's
 * underlying WebView print path (Android's PrintedPdfDocument/WebView and
 * iOS WebKit) does not reliably resolve viewport units to the printed page,
 * which collapses the container and leaves images pinned small in the
 * top-left corner.
 *
 * Prepared page images are already letterboxed onto an exact-A4-ratio canvas
 * (see `letterboxToA4Page`), so they use a full-bleed layout: the image fills
 * the page and its centering is baked into the image's own pixels - no CSS
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
 * asset paths. Pages are sized in fixed Adobe points (595.28x841.89, A4
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
   * be read via any file API - expo-print encodes it natively, so callers can
   * persist the bytes without reading the source file.
   */
  base64?: string | null;
}

// ---------------------------------------------------------------------------
// ID Card mode
// ---------------------------------------------------------------------------

// Slot for one side of the card, sized to a real ID-1 card ratio
// (85.6 x 53.98 mm ee 1.586), expressed in print points.
const ID_SLOT_WIDTH_PT = 400;
const ID_SLOT_HEIGHT_PT = 252;
// Vertical breathing room between the front and back slots.
const ID_SLOT_GAP_PT = 40;

/**
 * Assembles a SINGLE A4 page holding the front (and optionally the back) of an
 * ID card, stacked vertically, centered, on a white background.
 *
 * Centering deliberately avoids flexbox: Android's print pipeline is known to
 * drop flex/table/absolute centering and dump images at the top-left (the same
 * quirk that pushes `buildPdfHtml` to letterbox pages). `margin-left/right:
 * auto` on a block-sized image plus a computed `padding-top` are plain
 * block-layout rules every print engine honors, so both cards land dead-center.
 *
 * Each image's box is computed from its own pixel ratio so it fits inside the
 * card slot while preserving aspect ratio - it is never stretched. When the
 * size is unavailable, `object-fit: contain` inside the full slot does the
 * same job.
 */
export function buildIdCardHtml(
  imageDataUris: string[],
  imageSizes?: Array<{ width: number; height: number } | null>,
): string {
  const sources = imageDataUris.slice(0, 2);

  // Fit each image inside the card slot, preserving its aspect ratio.
  const fitted = sources.map((src, i) => {
    const size = imageSizes?.[i];
    let width = ID_SLOT_WIDTH_PT;
    let height = ID_SLOT_HEIGHT_PT;
    if (size && size.width > 0 && size.height > 0) {
      const ratio = size.height / size.width;
      width = ID_SLOT_WIDTH_PT;
      height = width * ratio;
      if (height > ID_SLOT_HEIGHT_PT) {
        height = ID_SLOT_HEIGHT_PT;
        width = height / ratio;
      }
    }
    return { src, width, height, hasSize: !!(size && size.width > 0 && size.height > 0) };
  });

  // Center the whole front/back group vertically on the A4 page.
  const contentHeight = fitted.reduce(
    (sum, f, i) => sum + f.height + (i > 0 ? ID_SLOT_GAP_PT : 0),
    0,
  );
  const padTop = Math.round(
    Math.max(ID_SLOT_HEIGHT_PT / 2, (A4_PAGE_HEIGHT - contentHeight) / 2),
  );

  const cards = fitted
    .map((f) => {
      const inline = f.hasSize
        ? `width: ${f.width.toFixed(2)}pt; height: ${f.height.toFixed(2)}pt;`
        : `width: ${ID_SLOT_WIDTH_PT}pt; height: ${ID_SLOT_HEIGHT_PT}pt; object-fit: contain;`;
      return `<img class="idcard" src="${f.src}" alt="ID card side" style="${inline}" />`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: ${A4_PAGE_WIDTH}pt ${A4_PAGE_HEIGHT}pt; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${A4_PAGE_WIDTH}pt;
        height: ${A4_PAGE_HEIGHT}pt;
        background-color: #ffffff;
      }
      .page {
        box-sizing: border-box;
        width: ${A4_PAGE_WIDTH}pt;
        height: ${A4_PAGE_HEIGHT}pt;
        padding-top: ${padTop}pt;
        overflow: hidden;
      }
      .idcard {
        display: block;
        margin-left: auto;
        margin-right: auto;
        object-fit: contain;
      }
      .idcard + .idcard { margin-top: ${ID_SLOT_GAP_PT}pt; }
    </style>
  </head>
  <body>
    <div class="page">
${cards}
    </div>
  </body>
</html>`;
}

/**
 * Renders the single-page ID Card PDF. Every input image becomes one slot on
 * the same A4 page (front, then back), so the export is always exactly one
 * page regardless of how many sides were supplied.
 */
export async function generateIdCardPdf(
  imageUris: string[],
  onProgress?: (stage: string) => void,
  imageSizes?: Array<{ width: number; height: number } | null>,
): Promise<PdfResult> {
  if (imageUris.length === 0) {
    throw new Error('Cannot generate an ID card PDF with zero images.');
  }

  onProgress?.('Preparing ID card...');
  const dataUris: string[] = [];
  for (const uri of imageUris.slice(0, 2)) {
    dataUris.push(await uriToBase64DataUri(uri));
  }

  onProgress?.('Rendering PDF...');
  const html = buildIdCardHtml(dataUris, imageSizes);
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
    numberOfPages: 1,
    base64: result.base64,
  };
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

  onProgress?.('Preparing pages...');
  const dataUris: string[] = [];
  for (const uri of imageUris) {
    dataUris.push(await uriToBase64DataUri(uri));
  }

  onProgress?.('Rendering PDF...');
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
