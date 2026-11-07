/**
 * Utility for persisting and managing Snoozed Emails completely on the frontend.
 * Provides user-scoped persistence in localStorage, timezone-aware snooze scheduling,
 * expiration checks, active snooze filtering, and seamless synchronization between
 * Snoozed and Inbox views.
 */

const SNOOZE_STORAGE_KEY = 'bnx_snoozed_emails';

/**
 * Generates a clean user-scoped key for localStorage.
 */
export const getUserSnoozeKey = (userEmail) => {
  if (!userEmail) return SNOOZE_STORAGE_KEY;
  const clean = String(userEmail).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${SNOOZE_STORAGE_KEY}_${clean}`;
};

/**
 * Returns formatted local datetime string for <input type="datetime-local" />
 * Format: "YYYY-MM-DDTHH:mm" using the user's local timezone.
 */
export const getLocalDatetimeInputString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Accurately parses a "YYYY-MM-DDTHH:mm" local datetime string into a JavaScript Date
 * strictly within the user's local timezone.
 */
export const parseLocalDatetimeString = (dtStr) => {
  if (!dtStr) return null;
  if (dtStr instanceof Date) return isNaN(dtStr.getTime()) ? null : dtStr;
  const parts = String(dtStr).split('T');
  if (parts.length === 2) {
    const [datePart, timePart] = parts;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, min] = timePart.split(':').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(min)) {
      const d = new Date(year, month - 1, day, hour, min, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const fallback = new Date(dtStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Calculates standard snooze options relative to the user's current local date/time.
 * Options:
 * 1. Later Today (e.g. 6:00 PM today, or +3 hours if past 5:00 PM)
 * 2. Tomorrow (8:00 AM tomorrow)
 * 3. This Weekend (Saturday 8:00 AM)
 * 4. Next Week (Next Monday 8:00 AM)
 */
export const getSnoozeOptions = (baseDate = new Date()) => {
  const now = new Date(baseDate);

  // 1. Later today:
  const laterToday = new Date(now);
  if (now.getHours() < 17) {
    laterToday.setHours(18, 0, 0, 0);
  } else if (now.getHours() < 21) {
    laterToday.setHours(now.getHours() + 3, 0, 0, 0);
  } else {
    laterToday.setHours(now.getHours() + 2, 0, 0, 0);
  }

  // 2. Tomorrow: 8:00 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  // 3. This weekend: Saturday 8:00 AM
  // getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  const thisWeekend = new Date(now);
  const currentDay = now.getDay();
  let daysToSaturday;
  if (currentDay === 6) {
    daysToSaturday = now.getHours() < 8 ? 0 : 7;
  } else if (currentDay === 0) {
    daysToSaturday = 6;
  } else {
    daysToSaturday = 6 - currentDay;
  }
  thisWeekend.setDate(now.getDate() + daysToSaturday);
  thisWeekend.setHours(8, 0, 0, 0);

  // 4. Next week: Next Monday 8:00 AM
  const nextWeek = new Date(now);
  let daysToMonday = (1 - currentDay + 7) % 7;
  if (daysToMonday === 0) {
    daysToMonday = now.getHours() < 8 ? 0 : 7;
  }
  nextWeek.setDate(now.getDate() + daysToMonday);
  nextWeek.setHours(8, 0, 0, 0);

  const formatDisplay = (d) => {
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${weekday}, ${hours}:${minutes} ${ampm}`;
  };

  return [
    {
      id: "later_today",
      label: "Later today",
      time: laterToday,
      display: formatDisplay(laterToday),
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      time: tomorrow,
      display: formatDisplay(tomorrow),
    },
    {
      id: "this_weekend",
      label: "This weekend",
      time: thisWeekend,
      display: formatDisplay(thisWeekend),
    },
    {
      id: "next_week",
      label: "Next week",
      time: nextWeek,
      display: formatDisplay(nextWeek),
    },
  ];
};

/**
 * Formats a scheduled snooze return date and time using the user's local timezone.
 * Examples: "Today, 6:00 PM", "Tomorrow, 8:00 AM", "Nov 8, 8:00 AM"
 */
export const formatSnoozeSchedule = (target) => {
  if (!target) return "";
  const d = new Date(target);
  if (isNaN(d.getTime())) return String(target);

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow, ${timeStr}`;
  }

  const isThisYear = d.getFullYear() === now.getFullYear();
  const dateStr = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' })
  });

  return `${dateStr}, ${timeStr}`;
};

/**
 * Reads all stored snooze records from localStorage.
 */
export const getStoredSnoozedList = (userEmail) => {
  try {
    const userKey = getUserSnoozeKey(userEmail);
    const raw = localStorage.getItem(userKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read snoozed emails from localStorage:", err);
    return [];
  }
};

/**
 * Saves or updates a snoozed email entry in localStorage.
 */
export const saveSnoozedEmail = (userEmail, { email, wakeUpAt, originalFolderName = 'INBOX' }) => {
  if (!email || !wakeUpAt) return null;
  const uid = String(email.uid ?? email.id ?? '');
  const wakeUpDate = new Date(wakeUpAt);
  const wakeUpTime = wakeUpDate.getTime();
  if (isNaN(wakeUpTime)) return null;

  const userKey = getUserSnoozeKey(userEmail);
  const existing = getStoredSnoozedList(userEmail);

  const messageId = email.messageId || '';
  const isRead = Boolean(email.isRead ?? email.read);

  const record = {
    uid,
    originalUid: uid,
    messageId,
    subject: email.subject || '',
    from: email.from || email.senderEmail || '',
    to: email.to || email.recipientEmail || '',
    sentDate: email.sentDate || email.date || email.createdAt,
    receivedDate: email.receivedDate || email.createdAt,
    wakeUpAt: wakeUpDate.toISOString(),
    wakeUpTime,
    snoozedAt: new Date().toISOString(),
    originalFolderName: originalFolderName || email.folderName || 'INBOX',
    isRead,
    status: 'snoozed',
    emailData: {
      ...email,
      folderName: 'Snoozed',
      isSnoozed: true,
      wakeUpAt: wakeUpDate.toISOString(),
      snoozedUntil: wakeUpDate.toISOString(),
      snoozeUntil: wakeUpDate.toISOString(),
      originalFolderName: originalFolderName || email.folderName || 'INBOX',
      isRead,
      read: isRead,
    }
  };

  // Remove any previous record matching this email by UID or messageId
  const filtered = existing.filter(item => {
    if (uid && (String(item.uid) === uid || String(item.originalUid) === uid)) return false;
    if (messageId && item.messageId && item.messageId === messageId) return false;
    return true;
  });

  filtered.push(record);
  try {
    localStorage.setItem(userKey, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to save snoozed email to localStorage:', e);
  }

  return record;
};

/**
 * Marks a snoozed email as unsnoozed in localStorage.
 */
export const markEmailUnsnoozed = (userEmail, identifier) => {
  if (!identifier && identifier !== 0) return null;
  const strId = String(identifier).trim();
  const userKey = getUserSnoozeKey(userEmail);
  const list = getStoredSnoozedList(userEmail);

  let target = null;
  const updated = list.map(item => {
    const match = (
      String(item.uid) === strId ||
      String(item.originalUid) === strId ||
      (item.messageId && item.messageId === strId)
    );
    if (match) {
      target = { ...item, status: 'unsnoozed', unsnoozedAt: new Date().toISOString() };
      return target;
    }
    return item;
  });

  try {
    localStorage.setItem(userKey, JSON.stringify(updated));
  } catch (e) {}

  return target;
};

/**
 * Marks a snoozed email as returned to Inbox.
 */
export const markEmailReturned = (userEmail, identifier) => {
  if (!identifier && identifier !== 0) return null;
  const strId = String(identifier).trim();
  const userKey = getUserSnoozeKey(userEmail);
  const list = getStoredSnoozedList(userEmail);

  let target = null;
  const updated = list.map(item => {
    const match = (
      String(item.uid) === strId ||
      String(item.originalUid) === strId ||
      (item.messageId && item.messageId === strId)
    );
    if (match) {
      target = { ...item, status: 'returned', returnedAt: new Date().toISOString() };
      return target;
    }
    return item;
  });

  try {
    localStorage.setItem(userKey, JSON.stringify(updated));
  } catch (e) {}

  return target;
};

/**
 * Removes an email completely from snooze records (e.g. deleted or moved to trash).
 */
export const removeSnoozedEmail = (userEmail, identifier) => {
  if (!identifier && identifier !== 0) return;
  const strId = String(identifier).trim();
  const userKey = getUserSnoozeKey(userEmail);
  const list = getStoredSnoozedList(userEmail);

  const filtered = list.filter(item => {
    return !(
      String(item.uid) === strId ||
      String(item.originalUid) === strId ||
      (item.messageId && item.messageId === strId)
    );
  });

  try {
    localStorage.setItem(userKey, JSON.stringify(filtered));
  } catch (e) {}
};

/**
 * Checks if an email is actively snoozed (wakeUpTime in future, status === 'snoozed').
 */
export const isEmailActivelySnoozed = (email, userEmail) => {
  if (!email) return false;
  const list = getStoredSnoozedList(userEmail);
  const now = Date.now();
  const uid = String(email.uid ?? email.id ?? '');
  const messageId = email.messageId || '';

  const found = list.find(item => {
    if (item.status !== 'snoozed') return false;
    if (item.wakeUpTime <= now) return false; // Expired
    if (uid && (String(item.uid) === uid || String(item.originalUid) === uid)) return true;
    if (messageId && item.messageId && item.messageId === messageId) return true;
    return false;
  });

  return Boolean(found);
};

/**
 * Checks if an email has already been returned or unsnoozed.
 */
export const isEmailReturnedOrUnsnoozed = (email, userEmail) => {
  if (!email) return false;
  const list = getStoredSnoozedList(userEmail);
  const uid = String(email.uid ?? email.id ?? '');
  const messageId = email.messageId || '';

  const found = list.find(item => {
    if (uid && (String(item.uid) === uid || String(item.originalUid) === uid)) return true;
    if (messageId && item.messageId && item.messageId === messageId) return true;
    return false;
  });

  if (found) {
    if (found.status === 'returned' || found.status === 'unsnoozed') return true;
    if (found.wakeUpTime && found.wakeUpTime <= Date.now()) return true;
  }
  return false;
};

/**
 * Retrieves snooze metadata for an email (if exists in storage).
 */
export const getSnoozeMetadata = (email, userEmail) => {
  if (!email) return null;
  const list = getStoredSnoozedList(userEmail);
  const uid = String(email.uid ?? email.id ?? '');
  const messageId = email.messageId || '';

  return list.find(item => {
    if (uid && (String(item.uid) === uid || String(item.originalUid) === uid)) return true;
    if (messageId && item.messageId && item.messageId === messageId) return true;
    return false;
  }) || null;
};

/**
 * Returns all active snoozed records (wakeUpTime > now).
 */
export const getActiveSnoozedEmails = (userEmail) => {
  const list = getStoredSnoozedList(userEmail);
  const now = Date.now();
  return list.filter(item => item.status === 'snoozed' && item.wakeUpTime > now);
};

/**
 * Returns all snoozed records that have reached their wake-up time (wakeUpTime <= now).
 */
export const getDueSnoozedEmails = (userEmail) => {
  const list = getStoredSnoozedList(userEmail);
  const now = Date.now();
  return list.filter(item => item.status === 'snoozed' && item.wakeUpTime <= now);
};

/**
 * Synchronizes the Snoozed folder view:
 * 1. Attaches stored wakeUpAt & schedule metadata to API emails.
 * 2. Filters out expired, unsnoozed, or returned emails.
 * 3. Incorporates active locally-snoozed emails awaiting backend IMAP sync.
 * 4. Deduplicates strictly by messageId or UID.
 * 5. Orders by scheduled return date/time ascending.
 */
export const syncSnoozedList = (apiEmails = [], userEmail) => {
  const list = getStoredSnoozedList(userEmail);
  const now = Date.now();

  const activeRecords = list.filter(item => item.status === 'snoozed' && item.wakeUpTime > now);
  const result = [];
  const matchedStoredKeys = new Set();
  const seenDedupKeys = new Set();

  // 1. Process API emails from backend
  (apiEmails || []).forEach(apiEmail => {
    const uidStr = String(apiEmail.uid ?? apiEmail.id ?? '');
    const msgId = apiEmail.messageId || '';

    // Match with storage
    const stored = list.find(item => {
      if (uidStr && (String(item.uid) === uidStr || String(item.originalUid) === uidStr)) return true;
      if (msgId && item.messageId && item.messageId === msgId) return true;
      return false;
    });

    if (stored) {
      // If the email has expired or was unsnoozed/returned, DO NOT show in Snoozed
      if (stored.status !== 'snoozed' || stored.wakeUpTime <= now) {
        return;
      }
      matchedStoredKeys.add(stored.uid || stored.originalUid || stored.messageId);

      const merged = {
        ...apiEmail,
        ...stored.emailData,
        uid: apiEmail.uid || stored.uid,
        wakeUpAt: stored.wakeUpAt,
        snoozedUntil: stored.wakeUpAt,
        snoozeUntil: stored.wakeUpAt,
        originalFolderName: stored.originalFolderName || 'INBOX',
        isSnoozed: true,
        folderName: 'Snoozed',
      };

      const dedupKey = msgId || merged.uid;
      if (!seenDedupKeys.has(dedupKey)) {
        seenDedupKeys.add(dedupKey);
        result.push(merged);
      }
    } else {
      // Email is in Snoozed folder without local storage record
      const rawWake = apiEmail.wakeUpAt || apiEmail.snoozedUntil || apiEmail.snoozeUntil;
      if (rawWake) {
        const parsed = new Date(rawWake).getTime();
        if (parsed > 0 && parsed <= now) {
          // Expired
          return;
        }
      }
      const dedupKey = msgId || uidStr;
      if (!seenDedupKeys.has(dedupKey)) {
        seenDedupKeys.add(dedupKey);
        result.push({
          ...apiEmail,
          folderName: 'Snoozed',
          isSnoozed: true,
        });
      }
    }
  });

  // 2. Add active snoozed emails from storage not yet reflected in backend response
  activeRecords.forEach(stored => {
    const key = stored.uid || stored.originalUid || stored.messageId;
    const dedupKey = stored.messageId || stored.uid || stored.originalUid;
    if (!matchedStoredKeys.has(key) && !seenDedupKeys.has(dedupKey)) {
      seenDedupKeys.add(dedupKey);
      result.push({
        ...stored.emailData,
        uid: stored.uid || stored.originalUid,
        wakeUpAt: stored.wakeUpAt,
        snoozedUntil: stored.wakeUpAt,
        snoozeUntil: stored.wakeUpAt,
        originalFolderName: stored.originalFolderName || 'INBOX',
        folderName: 'Snoozed',
        isSnoozed: true,
      });
    }
  });

  // 3. Sort by scheduled wake-up time ascending (earliest to return first)
  result.sort((a, b) => {
    const timeA = a.wakeUpAt ? new Date(a.wakeUpAt).getTime() : 0;
    const timeB = b.wakeUpAt ? new Date(b.wakeUpAt).getTime() : 0;
    if (timeA && timeB) return timeA - timeB;
    if (timeA) return -1;
    if (timeB) return 1;
    return 0;
  });

  return result;
};

/**
 * Synchronizes the Inbox view:
 * 1. Excludes any email actively snoozed (wakeUpTime > now).
 * 2. Seamlessly restores returned/unsnoozed emails with original read/unread status.
 * 3. Eliminates any duplicates.
 */
export const syncInboxList = (apiEmails = [], userEmail) => {
  const list = getStoredSnoozedList(userEmail);
  const now = Date.now();

  const seenDedupKeys = new Set();
  const result = [];

  // 1. Process API emails, filtering out actively snoozed ones
  (apiEmails || []).forEach(apiEmail => {
    const uidStr = String(apiEmail.uid ?? apiEmail.id ?? '');
    const msgId = apiEmail.messageId || '';

    // Check if actively snoozed
    const activeSnooze = list.find(item => {
      if (item.status !== 'snoozed') return false;
      if (item.wakeUpTime <= now) return false;
      if (uidStr && (String(item.uid) === uidStr || String(item.originalUid) === uidStr)) return true;
      if (msgId && item.messageId && item.messageId === msgId) return true;
      return false;
    });

    if (activeSnooze) {
      // Actively snoozed -> Exclude from Inbox!
      return;
    }

    const dedupKey = msgId || uidStr;
    if (!seenDedupKeys.has(dedupKey)) {
      seenDedupKeys.add(dedupKey);
      result.push(apiEmail);
    }
  });

  // 2. Re-insert returned or unsnoozed emails that haven't appeared in backend IMAP Inbox yet
  const returnedOrUnsnoozed = list.filter(item => {
    if (item.status === 'snoozed' && item.wakeUpTime <= now) return true;
    if (item.status === 'returned' || item.status === 'unsnoozed') return true;
    return false;
  });

  returnedOrUnsnoozed.forEach(item => {
    const dedupKey = item.messageId || item.originalUid || item.uid;
    if (!seenDedupKeys.has(dedupKey)) {
      seenDedupKeys.add(dedupKey);
      const emailObj = item.emailData || {};
      const originalRead = item.isRead !== undefined ? item.isRead : Boolean(emailObj.isRead ?? emailObj.read);
      result.unshift({
        ...emailObj,
        uid: item.originalUid || item.uid,
        folderName: item.originalFolderName || 'INBOX',
        isRead: originalRead,
        read: originalRead,
        isSnoozed: false,
        snoozedUntil: null,
        wakeUpAt: null,
        snoozeUntil: null,
      });
    }
  });

  return result;
};

