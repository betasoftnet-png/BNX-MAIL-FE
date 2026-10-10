export const DATE_FILTER_OPTIONS = [
  { id: "ALL", label: "All Time" },
  { id: "1_DAY", label: "Last 1 Day" },
  { id: "1_WEEK", label: "Last 1 Week" },
  { id: "1_YEAR", label: "Last 1 Year" },
];

/**
 * Safely extracts a numeric millisecond timestamp from an email object.
 * Checks receivedDate, sentDate, date, createdAt, and timestamp fields.
 * Handles numbers, numeric strings, ISO strings, RFC strings safely.
 * Returns null if timestamp is missing or cannot be parsed.
 */
export const getEmailTimestamp = (email) => {
  if (!email) return null;
  const rawDate =
    email.receivedDate ||
    email.sentDate ||
    email.date ||
    email.createdAt ||
    email.timestamp;

  if (!rawDate) return null;

  if (typeof rawDate === "number" && !isNaN(rawDate)) {
    return rawDate;
  }

  if (typeof rawDate === "string" && /^\d+$/.test(rawDate.trim())) {
    const num = Number(rawDate.trim());
    if (!isNaN(num)) return num;
  }

  const parsed = new Date(rawDate);
  const time = parsed.getTime();
  return isNaN(time) ? null : time;
};

/**
 * Checks if an email falls within the specified date filter range.
 * - ALL: matches all emails
 * - 1_DAY: within last 24 hours
 * - 1_WEEK: within last 7 days
 * - 1_YEAR: within last 365 days
 */
export const matchesDateRange = (email, filter) => {
  if (!filter || filter === "ALL" || filter === "ALL_TIME") {
    return true;
  }

  const emailTime = getEmailTimestamp(email);
  if (emailTime === null) {
    return false;
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (filter === "1_DAY") {
    return emailTime >= now - ONE_DAY_MS;
  }
  if (filter === "1_WEEK") {
    return emailTime >= now - 7 * ONE_DAY_MS;
  }
  if (filter === "1_YEAR") {
    return emailTime >= now - 365 * ONE_DAY_MS;
  }

  return true;
};
