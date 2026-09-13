export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function defaultScanTitle(date: Date = new Date()): string {
  return (
    `Scan_${date.getFullYear()}_${pad2(date.getMonth() + 1)}_` +
    `${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Formats a timestamp as a compact relative date, e.g. "2h ago",
 * "Yesterday", or a full date when older than a couple of days.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const todayStart = startOfDay(now);
  const tsStart = startOfDay(timestamp);

  if (tsStart === todayStart) {
    return `${diffHours}h ago`;
  }
  if (tsStart === todayStart - 86400000) {
    return 'Yesterday';
  }

  const d = new Date(timestamp);
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  if (d.getFullYear() === new Date(now).getFullYear()) {
    return `${day}/${month}`;
  }
  return `${day}/${month}/${year}`;
}