/**
 * Transient (never persisted) screen-to-screen hints. Used when the Add scans
 * screen's "Skip for now" must land the user back on the Home FOLDERS view
 * even though Home always defaults to "All files" on launch.
 */
let foldersPending = false;

export function requestFoldersView(): void {
  foldersPending = true;
}

/** Returns (and clears) the pending hint. Called by Home on focus. */
export function consumeFoldersView(): boolean {
  const pending = foldersPending;
  foldersPending = false;
  return pending;
}
