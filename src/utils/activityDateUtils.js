/**
 * Utility functions for parsing and formatting activity logs and session timestamps.
 * 
 * Ensures UTC timestamps received from backend (which may lack explicit 'Z' or timezone offsets)
 * are accurately parsed as UTC and converted to the user's local timezone (Asia/Kolkata for IST).
 * Avoids double conversion and prevents generating fake or current timestamps for missing data.
 */

/**
 * Returns the user's local timezone identifier, defaulting to 'Asia/Kolkata'.
 */
export const getUserTimeZone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string' && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch {
    // Fallback if Intl.DateTimeFormat is unavailable
  }
  return 'Asia/Kolkata';
};

/**
 * Safely parses any date or timestamp representation into a valid Date object.
 * Returns null if the timestamp is missing, null, or invalid.
 * 
 * Handles:
 * - ISO strings with 'Z' or timezone offsets (e.g. "2026-10-26T09:01:47Z", "2026-10-26T14:31:47+05:30")
 * - ISO / SQL strings without timezone offset sent by backend in UTC (e.g. "2026-10-26T09:01:47", "2026-10-26 09:01:47")
 * - Numeric epoch timestamps in seconds or milliseconds
 * - Date objects
 * - Jackson LocalDateTime arrays: [year, month, day, hour, minute, second]
 */
export const parseActivityTimestamp = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  if (typeof raw === 'number' && !isNaN(raw)) {
    // If epoch timestamp is in seconds (< 100 billion), convert to milliseconds
    const ms = raw < 100000000000 ? raw * 1000 : raw;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (Array.isArray(raw)) {
    // Jackson array format from UTC server: [year, month, day, hour, minute, second, nano]
    const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = raw;
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'string') {
    let str = raw.trim();
    if (!str) return null;

    // Numeric string epoch
    if (/^\d+$/.test(str)) {
      const num = Number(str);
      const ms = num < 100000000000 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // Standard ISO / SQL format beginning with YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      // Normalize space between date and time to 'T'
      if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
      }

      // Backend stores and sends UTC timestamps without trailing 'Z'.
      // In JavaScript ECMAScript, ISO strings without timezone are treated as local time.
      // If no timezone offset (Z or +/-HH:mm) is present, treat as UTC by appending 'Z'.
      const hasTimezone = /Z$|[+-]\d{2}(:?\d{2})?$/i.test(str);
      if (!hasTimezone) {
        str = `${str}Z`;
      }

      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }

    // RFC 2822 or other formats
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a timestamp into a consistent, readable localized string with AM/PM format.
 * Defaults to the user's local timezone (e.g. Asia/Kolkata for IST).
 * 
 * Example output: "10/26/2026, 2:31:47 PM"
 */
export const formatActivityTimestamp = (raw, timeZone = getUserTimeZone()) => {
  const d = parseActivityTimestamp(raw);
  if (!d) return '';

  const tz = timeZone || 'Asia/Kolkata';

  try {
    return d.toLocaleString('en-US', {
      timeZone: tz,
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).replace(/[\u202f\u00a0]/g, ' ');
  } catch {
    // If the provided timeZone string is rejected by the runtime, fallback to Asia/Kolkata
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).replace(/[\u202f\u00a0]/g, ' ');
  }
};

/**
 * Sorts activity logs in descending order (most recent first).
 */
export const sortActivityLogs = (logs) => {
  if (!Array.isArray(logs)) return [];

  return [...logs].sort((a, b) => {
    const rawA = a?.timestamp || a?.createdAt || a?.created_at || a?.time || a?.date || a?.loginTime;
    const rawB = b?.timestamp || b?.createdAt || b?.created_at || b?.time || b?.date || b?.loginTime;

    const timeA = parseActivityTimestamp(rawA)?.getTime() || 0;
    const timeB = parseActivityTimestamp(rawB)?.getTime() || 0;

    return timeB - timeA;
  });
};

