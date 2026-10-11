import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';
import { Skia } from '@shopify/react-native-skia';
import type { SkColor } from '@shopify/react-native-skia';

// Skia's ImageFormat enum is minified in the shipped package (exported as `n`).
// JPEG = 3 is a stable constant from Skia's C API.
const JPEG_FORMAT = 3;

// A4 portrait ratio (height / width) used to letterbox PDF page images.
const A4PAGE_RATIO = 841.89 / 595.28;

const rotationCache = new Map<string, Promise<string>>();

/**
 * Applies a rotation (absolute degrees, clockwise) to an image using
 * expo-image-manipulator's context API. Always starts from the original
 * source so repeated taps never compound distortion. Returns the new URI
 * (saved into the app cache directory). Results are cached per
 * (source, degrees) so revisiting a rotated page never re-encodes the same
 * rotation twice.
 */
export async function applyRotation(
  sourceUri: string,
  degrees: 0 | 90 | 180 | 270,
): Promise<string> {
  if (degrees === 0) {
    return sourceUri;
  }
  const key = `${sourceUri}|${degrees}`;
  const cached = rotationCache.get(key);
  if (cached) {
    return cached;
  }
  if (rotationCache.size > 128) {
    rotationCache.clear();
  }
  const promise = (async () => {
    const context = ImageManipulator.manipulate(sourceUri);
    context.rotate(degrees);
    const imageRef = await context.renderAsync();
    const result = await imageRef.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.92,
    });
    return result.uri;
  })();
  rotationCache.set(key, promise);
  return promise;
}

/**
 * True when the URI is already a JPEG. Camera captures and every processed
 * page are JPEG, but gallery imports can be HEIC/HEIF/PNG/WebP which
 * expo-print's PDF WebView cannot reliably decode (especially HEIC).
 */
export function isJpegUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg');
}

/**
 * Re-encodes a non-JPEG image (e.g. HEIC from a gallery import) into the app
 * cache as a JPEG so previews, thumbnails and PDF assembly all get a format
 * every target can decode. JPEGs pass through untouched. Falls back to the
 * original URI if the source cannot be decoded.
 */
export async function normalizeToJpeg(sourceUri: string): Promise<string> {
  if (isJpegUri(sourceUri)) {
    return sourceUri;
  }
  try {
    const context = ImageManipulator.manipulate(sourceUri);
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.92,
    });
    return result.uri;
  } catch {
    return sourceUri;
  }
}

/**
 * Crops an image to the given pixel rectangle (top-left origin) and saves the
 * result into the app cache as a JPEG. The crop rectangle is expected to be
 * relative to the source image's own pixel dimensions.
 */
export async function cropImage(
  sourceUri: string,
  rect: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  if (rect.width <= 0 || rect.height <= 0) {
    return sourceUri;
  }
  const context = ImageManipulator.manipulate(sourceUri);
  context.crop(rect);
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.92,
  });
  return result.uri;
}

/**
 * Resolves the pixel dimensions of an image via React Native's decoder.
 * Returns null when the image cannot be measured (missing/undecodable file).
 */
export function getImagePixelSize(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/**
 * Re-encodes an image to JPEG, downscaling it so the longest edge never
 * exceeds `maxLongSide` (aspect ratio preserved). Re-encoding also bakes in
 * EXIF orientation, guaranteeing the Skia preview, PDF pages and thumbnails
 * all show the same upright orientation. Falls back to the source URI on any
 * failure so callers keep working with whatever they have.
 */
export async function resizeImageToMax(
  sourceUri: string,
  maxLongSide: number,
  compress: number,
): Promise<string> {
  try {
    const size = await getImagePixelSize(sourceUri);
    const context = ImageManipulator.manipulate(sourceUri);
    if (size) {
      const long = Math.max(size.width, size.height);
      if (long > maxLongSide) {
        const scale = maxLongSide / long;
        context.resize({
          width: Math.round(size.width * scale),
          height: Math.round(size.height * scale),
        });
      }
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress,
    });
    return result.uri;
  } catch {
    return sourceUri;
  }
}

/**
 * Letterboxes an image onto a white canvas with the exact A4 portrait aspect
 * ratio (baked in as white padding). Downscales to at most 1800px on the
 * longest edge and re-encodes as JPEG (baking EXIF orientation).
 *
 * Rationale: Android's print pipeline ignores flexbox/table/absolute CSS
 * centering and lays images out at the top-left. When the page image itself
 * already fills the whole A4 page, it is dead-center no matter how the
 * renderer places it — the PDF layout cannot fight the image's own pixels.
 * Falls back to plain resize (un-letterboxed) on any failure so the pipeline
 * never breaks.
 */
async function letterboxToA4Page(sourceUri: string): Promise<string> {
  try {
    const size = await getImagePixelSize(sourceUri);
    if (!size || size.width <= 0 || size.height <= 0) {
      return resizeImageToMax(sourceUri, 1800, 0.85);
    }

    const maxLong = 1800;
    const scale = Math.min(
      maxLong / size.width,
      maxLong / size.height,
    );
    const contentW = Math.max(1, Math.round(size.width * scale));
    const contentH = Math.max(1, Math.round(size.height * scale));

    // Canvas with A4 portrait aspect ratio, snug around the content.
    const canvasW =
      contentW >= Math.round(contentH / A4PAGE_RATIO)
        ? contentW
        : Math.round(contentH / A4PAGE_RATIO);
    const canvasH =
      contentH >= Math.round(contentW * A4PAGE_RATIO)
        ? contentH
        : Math.round(contentW * A4PAGE_RATIO);

    const srcFile = new File(sourceUri);
    const bytes = await srcFile.bytes();
    const data = Skia.Data.fromBytes(bytes);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      throw new Error('Skia could not decode the page image.');
    }

    const surface =
      Skia.Surface.Make(canvasW, canvasH) ??
      Skia.Surface.MakeOffscreen(canvasW, canvasH);
    if (!surface) {
      throw new Error('Skia could not allocate a surface.');
    }
    const canvas = surface.getCanvas();
    canvas.clear(0xffffffff as unknown as SkColor);

    const dx = Math.round((canvasW - contentW) / 2);
    const dy = Math.round((canvasH - contentH) / 2);
    const srcRect = Skia.XYWHRect(0, 0, image.width(), image.height());
    const dstRect = Skia.XYWHRect(dx, dy, contentW, contentH);
    canvas.drawImageRect(image, srcRect, dstRect, Skia.Paint());

    const snapshot = surface.makeImageSnapshot();
    const outBytes = snapshot.encodeToBytes(
      JPEG_FORMAT as unknown as Parameters<typeof snapshot.encodeToBytes>[0],
      85,
    );

    const outFile = new File(
      Paths.cache,
      `page_a4_${Date.now()}_${Math.floor(Math.random() * 1e6)}.jpg`,
    );
    outFile.write(outBytes);
    return outFile.uri;
  } catch {
    return resizeImageToMax(sourceUri, 1800, 0.85);
  }
}

/**
 * Prepares a page image for PDF assembly: letterboxes it onto an A4-ratio
 * white canvas (so the PDF always shows it dead-center, full-page) at 1800px
 * and bakes EXIF orientation so the PDF matches the editor preview.
 */
const pdfPrepCache = new Map<string, Promise<string>>();
export function preparePageForPdf(sourceUri: string): Promise<string> {
  const cached = pdfPrepCache.get(sourceUri);
  if (cached) {
    return cached;
  }
  const promise = letterboxToA4Page(sourceUri);
  pdfPrepCache.set(sourceUri, promise);
  return promise;
}

/**
 * Produces a small JPEG thumbnail (300px longest edge) for a saved scan's
 * home-screen card. Keeping it small means the grid never decodes a
 * full-resolution page just to paint a ~64px thumbnail.
 */
const thumbnailCache = new Map<string, Promise<string>>();
export function makeThumbnail(sourceUri: string): Promise<string> {
  const cached = thumbnailCache.get(sourceUri);
  if (cached) {
    return cached;
  }
  const promise = resizeImageToMax(sourceUri, 300, 0.8);
  thumbnailCache.set(sourceUri, promise);
  return promise;
}
