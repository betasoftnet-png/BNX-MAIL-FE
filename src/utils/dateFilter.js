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
 * - 1_DAY: within last 24 hours
 * - 1_WEEK: within last 7 days
 * - 1_MONTH: within last 30 days
 * - CUSTOM: between customRange.startDate and customRange.endDate (inclusive of full end day)
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

  if (filter === "1_DAY") {
    return emailTime >= now - ONE_DAY_MS;
  }

  if (filter === "1_WEEK") {
    return emailTime >= now - 7 * ONE_DAY_MS;
  }

  if (filter === "1_MONTH") {
    return emailTime >= now - 30 * ONE_DAY_MS;
  }

  if (filter === "CUSTOM" && customRange) {
    const { startDate, endDate } = customRange;
    if (!startDate) return true;

    // Start date at 00:00:00 local time
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    // End date at 23:59:59.999 local time (inclusive of full day)
    const end = new Date(endDate || startDate);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();

    return emailTime >= startMs && emailTime <= endMs;
  }

  return true;
};

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
 * Returns a human-friendly label for current active date filter
 */
export const getDateFilterLabel = (filter, customRange = null) => {
  if (filter === "1_DAY") return "Last 1 Day";
  if (filter === "1_WEEK") return "Last 1 Week";
  if (filter === "1_MONTH") return "Last 1 Month";
  if (filter === "CUSTOM" && customRange?.startDate) {
    const s = formatDateDDMMYYYY(customRange.startDate);
    const e = customRange.endDate ? formatDateDDMMYYYY(customRange.endDate) : s;
    return s === e ? s : `${s} to ${e}`;
  }
  return "All Time";
};
