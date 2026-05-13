/**
 * Safely parses a date string from the backend.
 * Spring's LocalDateTime serializes without a timezone offset (e.g. "2024-01-15T10:30:00").
 * Most browsers treat that as UTC but some parse it as local time, causing "Invalid Date".
 * We normalise by appending 'Z' if no offset is present so it is always treated as UTC.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Already has timezone offset (+05:00, Z, etc.) — parse as-is
  if (/[Z+]/.test(value.slice(10))) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // Append 'Z' so JS treats it as UTC, matching the backend storage timezone
  const d = new Date(value + "Z");
  return isNaN(d.getTime()) ? null : d;
}

/** Format as a short date: "Apr 25, 2026" */
export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Format as a full date + time: "Apr 25, 2026, 2:30 PM" */
export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
