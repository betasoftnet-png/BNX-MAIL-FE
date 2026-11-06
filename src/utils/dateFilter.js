export const DATE_FILTER_OPTIONS = [
  { id: "ALL", label: "All Time" },
  { id: "1_DAY", label: "Last 1 Day" },
  { id: "1_WEEK", label: "Last 1 Week" },
  { id: "1_MONTH", label: "Last 1 Month" },
  { id: "CUSTOM", label: "Custom Date" },
];

/**
 * Safely parses any date/timestamp into numeric millisecond epoch.
 * Supports:
 * - Millisecond numbers & numeric strings (e.g. 1728551520000)
 * - Second unix epoch timestamps (e.g. 1728551520)
 * - ISO-8601 strings (e.g. "2026-10-09T08:30:00.000Z")
 * - SQL datetime strings (e.g. "2026-09-28 14:20:00")
 * - RFC 2822 date strings (e.g. "Fri, 09 Oct 2026 08:30:00 +0000")
 * - Date instances
 */
export const parseEmailDate = (raw) => {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number" && !isNaN(raw)) {
    // If epoch is in seconds (< 10 billion), convert to ms
    return raw < 10000000000 ? raw * 1000 : raw;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return num < 10000000000 ? num * 1000 : num;
    }

    // Convert SQL "YYYY-MM-DD HH:MM:SS" to ISO-compatible "YYYY-MM-DDTHH:MM:SS"
    const normalized = trimmed.replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/,
      "$1T$2"
    );
    const parsed = new Date(normalized).getTime();
    if (!isNaN(parsed)) return parsed;

    const fallback = new Date(trimmed).getTime();
    if (!isNaN(fallback)) return fallback;
  }

  if (raw instanceof Date) {
    const time = raw.getTime();
    return isNaN(time) ? null : time;
  }

  return null;
};

/**
 * Safely extracts a millisecond timestamp from an email object.
 * Checks receivedDate, sentDate, date, createdAt, and timestamp.
 */
export const getEmailTimestamp = (email) => {
  if (!email) return null;
  const rawDate =
    email.receivedDate ||
    email.sentDate ||
    email.date ||
    email.createdAt ||
    email.timestamp;

  return parseEmailDate(rawDate);
};

/**
 * Checks if an email falls within the specified date filter and optional custom range.
 * - ALL: matches all emails
 * - 1_DAY / TODAY: within today / last 24 hours
 * - YESTERDAY: within yesterday
 * - 1_WEEK / LAST_7_DAYS: within last 7 days
 * - 1_MONTH / LAST_30_DAYS: within last 30 days
 * - CUSTOM: between customRange.startDate and customRange.endDate (clamped to today dynamically, future emails excluded)
 */
export const matchesDateRange = (email, filter = "ALL", customRange = null) => {
  if (!filter || filter === "ALL" || filter === "ALL_TIME") {
    return true;
  }

  const emailTime = getEmailTimestamp(email);
  if (emailTime === null) {
    return false; // Safely exclude missing/invalid timestamps when filtering
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Never match emails with timestamps in the future
  if (emailTime > now) {
    return false;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const yesterdayStartMs = todayStartMs - ONE_DAY_MS;

  if (filter === "1_DAY" || filter === "TODAY") {
    return emailTime >= Math.min(todayStartMs, now - ONE_DAY_MS) && emailTime <= now;
  }

  if (filter === "YESTERDAY") {
    return emailTime >= yesterdayStartMs && emailTime < todayStartMs;
  }

  if (filter === "1_WEEK" || filter === "LAST_7_DAYS") {
    return emailTime >= now - 7 * ONE_DAY_MS && emailTime <= now;
  }

  if (filter === "1_MONTH" || filter === "LAST_30_DAYS") {
    return emailTime >= now - 30 * ONE_DAY_MS && emailTime <= now;
  }

  if (filter === "CUSTOM" && customRange) {
    const { startDate, endDate } = customRange;
    if (!startDate) return true;

    // Start date at 00:00:00 local time
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    // Start date in the future cannot match any emails
    if (startMs > now) {
      return false;
    }

    // End date at 23:59:59.999 local time (inclusive of full day), clamped to current moment
    const end = new Date(endDate || startDate);
    end.setHours(23, 59, 59, 999);
    const endMs = Math.min(end.getTime(), now);

    return emailTime >= startMs && emailTime <= endMs;
  }

  return true;
};

export const matchesDateFilter = matchesDateRange;

/**
 * Formats a Date or date string to DD-MM-YYYY format
 */
export const formatDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Returns dynamic today's date in YYYY-MM-DD local format
 */
export const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Returns a human-friendly label for current active date filter
 */
export const getDateFilterLabel = (filter, customRange = null) => {
  if (filter === "1_DAY" || filter === "TODAY") return "Today";
  if (filter === "YESTERDAY") return "Yesterday";
  if (filter === "1_WEEK" || filter === "LAST_7_DAYS") return "Last 7 Days";
  if (filter === "1_MONTH" || filter === "LAST_30_DAYS") return "Last 30 Days";
  if (filter === "CUSTOM" && customRange?.startDate) {
    const s = formatDateDDMMYYYY(customRange.startDate);
    const e = customRange.endDate ? formatDateDDMMYYYY(customRange.endDate) : s;
    return s === e ? s : `${s} to ${e}`;
  }
  return "All Time";
};
