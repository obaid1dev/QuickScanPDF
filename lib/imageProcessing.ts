import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';
import { Skia } from '@shopify/react-native-skia';
import type { SkColor } from '@shopify/react-native-skia';
import type { FilterType } from '@/types/document';

// Skia's ImageFormat enum is minified in the shipped package (exported as `n`).
// JPEG = 3 is a stable constant from Skia's C API.
const JPEG_FORMAT = 3;

// A4 portrait ratio (height / width) used to letterbox PDF page images.
const A4PAGE_RATIO = 841.89 / 595.28;

export type ColorMatrixLike = number[];

const IDENTITY: ColorMatrixLike = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

function grayscaleMatrix(): ColorMatrixLike {
  return [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function contrastMatrix(level: number): ColorMatrixLike {
  const bias = 128 * (1 - level);
  return [
    level, 0, 0, 0, bias,
    0, level, 0, 0, bias,
    0, 0, level, 0, bias,
    0, 0, 0, 1, 0,
  ];
}

function saturationMatrix(s: number): ColorMatrixLike {
  const sr = (1 - s) * 0.2126;
  const sg = (1 - s) * 0.7152;
  const sb = (1 - s) * 0.0722;
  return [
    sr + s, sg, sb, 0, 0,
    sr, sg + s, sb, 0, 0,
    sr, sg, sb + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function brightnessMatrix(b: number): ColorMatrixLike {
  return [
    1, 0, 0, 0, b,
    0, 1, 0, 0, b,
    0, 0, 1, 0, b,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Compose two 4x5 color matrices: result = a ∘ b (b applied to pixels first,
 * then a). Used to collapse multi-step filters into a single matrix.
 */
export function composeColorMatrices(
  a: ColorMatrixLike,
  b: ColorMatrixLike,
): ColorMatrixLike {
  const out: number[] = new Array(20).fill(0);
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[i * 5 + k] * b[k * 5 + j];
      }
      out[i * 5 + j] = sum;
    }
    let bias = 0;
    for (let k = 0; k < 4; k += 1) {
      bias += a[i * 5 + k] * b[k * 5 + 4];
    }
    out[i * 5 + 4] = bias + a[i * 5 + 4];
  }
  return out;
}

export const FILTER_MATRICES: Record<FilterType, ColorMatrixLike> = {
  original: IDENTITY,
  bw: composeColorMatrices(contrastMatrix(1.35), grayscaleMatrix()),
  magic_color: composeColorMatrices(
    contrastMatrix(1.18),
    composeColorMatrices(saturationMatrix(1.25), brightnessMatrix(15)),
  ),
};

export function filterColorMatrix(filter: FilterType): ColorMatrixLike {
  return FILTER_MATRICES[filter] ?? IDENTITY;
}

const rotationCache = new Map<string, Promise<string>>();

/**
 * Applies a rotation (absolute degrees, clockwise) to an image using
 * expo-image-manipulator's context API. Always starts from the original
 * source so repeated taps never compound distortion. Returns the new URI
 * (saved into the app cache directory). Results are cached per
 * (source, degrees) so revisiting a rotated page or re-tapping a filter never
 * re-encodes the same rotation twice.
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
 * Applies a color filter (B&W or Magic Color) using a Skia CPU surface with a
 * 4x5 color matrix. expo-image-manipulator has no native color ops, so we
 * rasterize through Skia and encode the result. Falls back to the source URI
 * if Skia is unavailable (e.g. web) so the pipeline never breaks.
 */
export async function applyColorFilter(
  sourceUri: string,
  filter: FilterType,
): Promise<string> {
  if (filter === 'original') {
    return sourceUri;
  }

  try {
    const srcFile = new File(sourceUri);
    const bytes = await srcFile.bytes();
    const data = Skia.Data.fromBytes(bytes);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      throw new Error('Skia could not decode the image.');
    }

    const width = image.width();
    const height = image.height();

    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeMatrix(filterColorMatrix(filter)),
    );

    const surface =
      Skia.Surface.Make(width, height) ??
      Skia.Surface.MakeOffscreen(width, height);
    if (!surface) {
      throw new Error('Skia could not allocate a surface.');
    }
    const canvas = surface.getCanvas();
    canvas.clear(0x00000000 as unknown as SkColor);
    canvas.drawImage(image, 0, 0, paint);

    const snapshot = surface.makeImageSnapshot();
    const outBytes = snapshot.encodeToBytes(
      JPEG_FORMAT as unknown as Parameters<typeof snapshot.encodeToBytes>[0],
      90,
    );

    const outFile = new File(
      Paths.cache,
      `filtered_${Date.now()}_${Math.floor(Math.random() * 1e6)}.jpg`,
    );
    outFile.write(outBytes);

    paint.dispose?.();
    return outFile.uri;
  } catch {
    // Filtering is best-effort; return the unmodified image instead of failing.
    return sourceUri;
  }
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
 * Produces a small JPEG thumbnail (768px longest edge) for a saved scan's
 * home-screen card.
 */
const thumbnailCache = new Map<string, Promise<string>>();
export function makeThumbnail(sourceUri: string): Promise<string> {
  const cached = thumbnailCache.get(sourceUri);
  if (cached) {
    return cached;
  }
  const promise = resizeImageToMax(sourceUri, 768, 0.8);
  thumbnailCache.set(sourceUri, promise);
  return promise;
}

/**
 * Pipeline used by the editor when edits change: rotate (absolute) then apply
 * the selected filter. Returns a cache URI ready for preview + PDF assembly.
 */
export async function processPage({
  originalUri,
  rotation,
  filter,
}: {
  originalUri: string;
  rotation: 0 | 90 | 180 | 270;
  filter: FilterType;
}): Promise<string> {
  const rotated = await applyRotation(originalUri, rotation);
  const filtered = await applyColorFilter(rotated, filter);
  return filtered;
}