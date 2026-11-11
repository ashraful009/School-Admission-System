/**
 * Date formatting helpers for user-facing displays.
 */

/**
 * Format ISO 8601 UTC timestamp to human readable date-time string:
 * e.g. "11 Nov, 08:15 AM"
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const day = date.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return `${day} ${month}, ${time}`;
}

