/**
 * Safely parses a date value from the backend.
 *
 * Spring Boot's LocalDateTime can be serialised in two ways:
 *   1. Array  → [year, month(1-based), day, hour?, minute?, second?, nanos?]
 *      This is what actually comes through despite write-dates-as-timestamps=false
 *      in some Spring/Jackson setups.
 *   2. String → "2026-05-15T10:30:00"  (ISO 8601, no timezone)
 *
 * Both are normalised to a UTC-based JS Date.
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  // ── Array format ──────────────────────────────────────────────────────────
  // e.g. [2026, 5, 12, 17, 40, 40, 938745000]
  //       year  mon day  h   m   s   nanoseconds
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanos = 0] =
      value as number[];
    // month is 1-based in Java, 0-based in JS Date.UTC
    const ms = Math.floor((nanos || 0) / 1_000_000); // nanos → ms
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
    return isNaN(d.getTime()) ? null : d;
  }

  // ── String format ─────────────────────────────────────────────────────────
  if (typeof value !== "string" || !value) return null;

  // Normalise fractional seconds to ≤3 digits (JS Date only supports ms)
  const clean = value.replace(/(\.\d{3})\d+/, "$1");

  // If a timezone offset is already present (Z, +HH:mm, -HH:mm) parse as-is
  const hasTimezone =
    /Z$/i.test(clean) || /[+-]\d{2}:?\d{2}$/.test(clean);
  const normalized = hasTimezone ? clean : clean + "Z";

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Format as a short date: "Apr 25, 2026" */
export function formatDate(value: unknown): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format as a full date + time: "Apr 25, 2026, 2:30 PM" */
export function formatDateTime(value: unknown): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Converts a Date object to the local-time string required by
 * <input type="datetime-local"> — i.e. "YYYY-MM-DDTHH:mm" in the
 * user's LOCAL timezone (NOT UTC).
 */
export function toLocalInputValue(d: Date): string {
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

/**
 * Returns the current local time as a "YYYY-MM-DDTHH:mm" string,
 * suitable for use as the `min` attribute on a datetime-local input.
 */
export function nowLocalInputValue(): string {
  return toLocalInputValue(new Date());
}

/**
 * Converts a datetime-local input value ("YYYY-MM-DDTHH:mm" in local time)
 * to a Spring-compatible LocalDateTime string ("YYYY-MM-DDTHH:mm:ss").
 * Spring's LocalDateTime deserializer rejects ISO strings ending in 'Z'
 * or with milliseconds.
 */
export function toBackendDatetime(localInputValue: string): string {
  if (!localInputValue) return "";
  // datetime-local gives "2026-05-15T14:30" — just append seconds
  return localInputValue.length === 16
    ? localInputValue + ":00"
    : localInputValue;
}
