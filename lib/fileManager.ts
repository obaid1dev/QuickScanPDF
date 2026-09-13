import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { getItem, setItem } from '@/lib/storage';
import { SCANS_FOLDER, STORAGE_KEYS } from '@/constants/config';
import type { Document } from '@/types/document';

let scansDirectory: Directory | null = null;

function withTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/**
 * Resolves the app's document root for persistent storage.
 *
 * On Android inside Expo Go the host-level `Paths.document` maps to a location
 * the shared `FilePermissionService` does not grant (host-owned cache paths are
 * also denied). The legacy `documentDirectory` constant is resolved natively to
 * the *experience-scoped* directory, which Expo Go DOES grant. On iOS and in
 * dev/standalone builds both resolve to the app's own Documents directory, so
 * using the legacy constant is safe everywhere.
 */
function documentRootUri(): string {
  return withTrailingSlash(
    LegacyFileSystem.documentDirectory ?? Paths.document.uri,
  );
}

export function ensureScansDirectory(): Directory {
  const scansUri = `${documentRootUri()}${SCANS_FOLDER}/`;
  if (
    scansDirectory &&
    scansDirectory.uri === scansUri &&
    scansDirectory.exists
  ) {
    return scansDirectory;
  }
  const dir = new Directory(scansUri);
  try {
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }
  } catch {
    // The new API may be blocked in some runtimes; fall back to the legacy
    // directory API which has no permission model.
    void LegacyFileSystem.getInfoAsync(scansUri).then((info) => {
      if (!info.exists) {
        return LegacyFileSystem.makeDirectoryAsync(scansUri, {
          intermediates: true,
        });
      }
    });
  }
  scansDirectory = dir;
  return dir;
}

export function getScansDirectory(): Directory {
  return ensureScansDirectory();
}

export function getTotalScansSizeBytes(): number {
  try {
    const dir = ensureScansDirectory();
    return dir.size ?? 0;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileExists(uri: string): boolean {
  try {
    const file = new File(uri);
    return file.exists;
  } catch {
    return false;
  }
}

export async function getFileSizeBytes(uri: string): Promise<number> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    return info.exists ? info.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Removes a destination file if it exists, trying both file-system APIs so a
 * permission denial on one never blocks the other.
 */
function deleteDestinationIfExists(destUri: string): void {
  try {
    const dest = new File(destUri);
    if (dest.exists) {
      dest.delete();
      return;
    }
  } catch {
    // fall through to the legacy API
  }
  void LegacyFileSystem.deleteAsync(destUri, { idempotent: true });
}

/**
 * Moves a source file into the Scans folder.
 *
 * The new `File` API gates file operations behind a path-permission model that
 * Expo Go's Android runtime denies for files produced by other native modules
 * (e.g. `expo-print`, which writes to `cache/Print/`), raising
 * "Missing 'READ' permission for accessing the file". The legacy API copies
 * via raw streams and has no permission model, so it is used first, with the
 * new API as a fallback. `sourceUri` is preserved in any error so failures are
 * diagnosable.
 */
export async function moveFileToScans(
  sourceUri: string,
  fileName: string,
): Promise<string> {
  const destDir = ensureScansDirectory();
  const dest = new File(destDir, fileName);
  deleteDestinationIfExists(dest.uri);
  const source = new File(sourceUri);
  try {
    await LegacyFileSystem.moveAsync({ from: sourceUri, to: dest.uri });
  } catch {
    try {
      await LegacyFileSystem.copyAsync({ from: sourceUri, to: dest.uri });
    } catch (copyErr) {
      try {
        source.moveSync(dest);
        return dest.uri;
      } catch {
        throw new Error(
          `Could not save "${fileName}". ${
            copyErr instanceof Error ? copyErr.message : 'Unknown filesystem error.'
          } (source: ${sourceUri})`,
        );
      }
    }
  }
  return dest.uri;
}

export async function copyFileToScans(
  sourceUri: string,
  fileName: string,
): Promise<string> {
  const destDir = ensureScansDirectory();
  const dest = new File(destDir, fileName);
  deleteDestinationIfExists(dest.uri);
  const source = new File(sourceUri);
  try {
    await LegacyFileSystem.copyAsync({ from: sourceUri, to: dest.uri });
  } catch (copyErr) {
    try {
      source.copySync(dest);
    } catch {
      throw new Error(
        `Could not save "${fileName}". ${
          copyErr instanceof Error ? copyErr.message : 'Unknown filesystem error.'
        } (source: ${sourceUri})`,
      );
    }
  }
  return dest.uri;
}

/**
 * Writes PDF bytes (base64) directly into the Scans folder. This avoids reading
 * the `cache/Print/` source file entirely: on Android inside Expo Go that path
 * is outside the granted experience-scoped permission set, so even the legacy
 * copy APIs reject it. The bytes are captured inside `expo-print` natively
 * (via `base64: true`) and written to the experience directory, which Expo Go
 * grants. Throws with context if the write or verification fails.
 */
export async function savePdfToScans(
  fileName: string,
  base64: string,
): Promise<string> {
  ensureScansDirectory();
  const destUri = `${documentRootUri()}${SCANS_FOLDER}/${fileName}`;
  try {
    await LegacyFileSystem.writeAsStringAsync(destUri, base64, {
      encoding: 'base64',
    });
  } catch (e) {
    throw new Error(
      `Could not write "${fileName}". ${
        e instanceof Error ? e.message : 'Unknown filesystem error.'
      } (destination: ${destUri})`,
    );
  }
  const info = await LegacyFileSystem.getInfoAsync(destUri).catch(() => null);
  if (!info?.exists || (info.size ?? 0) <= 0) {
    throw new Error(
      `The PDF file "${fileName}" was not written correctly. (destination: ${destUri})`,
    );
  }
  return destUri;
}

/**
 * Saves an existing PDF straight into the device's Downloads folder using the
 * Android Storage Access Framework.
 *
 * The first download asks once — the picker opens pre-pointed at "Downloads"
 * so the user only taps "Use this folder" — and the granted tree URI is then
 * remembered, so every later download lands in Downloads automatically with
 * no prompts. On iOS the caller should fall back to the share sheet ("Save to
 * Files") instead.
 *
 * @param fileName File name including the `.pdf` extension.
 * @param opts A URI to read the PDF bytes from, or already-loaded base64.
 * @returns 'saved' when written, 'cancelled' when the user dismissed the picker.
 * @platform Android
 */
export async function savePdfToDevice(
  fileName: string,
  opts: { uri: string; base64?: string },
): Promise<'saved' | 'cancelled'> {
  if (Platform.OS !== 'android') {
    throw new Error('savePdfToDevice is only available on Android.');
  }
  const baseName = fileName.replace(/\.pdf$/i, '');
  const readBytes = async (): Promise<string> =>
    opts.base64 ??
    (await LegacyFileSystem.readAsStringAsync(opts.uri, {
      encoding: 'base64',
    }));

  let dirUri: string | null =
    (await getItem<string>(STORAGE_KEYS.downloadsDir).catch(() => null)) ?? null;

  const writeInto = async (uri: string, retry: boolean): Promise<'saved' | 'cancelled'> => {
    const createdUri =
      await LegacyFileSystem.StorageAccessFramework.createFileAsync(
        uri,
        baseName,
        'application/pdf',
      );
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(
      createdUri,
      await readBytes(),
      { encoding: 'base64' },
    );
    return 'saved';
  };

  if (dirUri) {
    try {
      return await writeInto(dirUri, false);
    } catch {
      dirUri = null;
      setItem(STORAGE_KEYS.downloadsDir, null).catch(() => undefined);
    }
  }

  const perms =
    await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
        'Download',
      ),
    );
  if (!perms.granted) {
    return 'cancelled';
  }
  setItem(STORAGE_KEYS.downloadsDir, perms.directoryUri).catch(() => undefined);
  try {
    return await writeInto(perms.directoryUri, false);
  } catch {
    setItem(STORAGE_KEYS.downloadsDir, null).catch(() => undefined);
    throw new Error('Could not write the PDF to Downloads.');
  }
}

export function deleteFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
      return;
    }
  } catch {
    // fall through to the legacy API
  }
  void LegacyFileSystem.deleteAsync(uri, { idempotent: true });
}

export function deleteDocumentFiles(document: Document): void {
  deleteFile(document.pdfUri);
  if (document.thumbnailUri !== document.pdfUri) {
    deleteFile(document.thumbnailUri);
  }
}

export function getFileNameFromUri(uri: string): string {
  try {
    const file = new File(uri);
    return file.name;
  } catch {
    const parts = uri.split('/');
    return parts[parts.length - 1] ?? 'file';
  }
}

export function generateUniqueFileName(prefix: string, extension: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}_${stamp}_${Math.floor(Math.random() * 1e6)}.${extension}`;
}

/**
 * Persists the prepared page images (1800px JPEGs) next to the PDF so the
 * in-app viewer can render the scan without a native PDF renderer (WebView on
 * Android cannot display PDFs, and Expo Go does not bundle one). Survives app
 * restarts because they live in the same experience-scoped Scans folder as the
 * PDF. Returns the stored URIs (an empty array when nothing could be saved).
 */
export async function copyPagesToScans(
  pageUris: string[],
  docId: string,
): Promise<string[]> {
  const stored: string[] = [];
  for (let i = 0; i < pageUris.length; i += 1) {
    try {
      const fileName = `p_${docId}_${String(i + 1).padStart(2, '0')}.jpg`;
      stored.push(await copyFileToScans(pageUris[i], fileName));
    } catch {
      // Non-fatal: the viewer falls back to the PDF share sheet.
    }
  }
  return stored;
}