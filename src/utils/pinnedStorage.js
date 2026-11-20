/**
 * Utility for persisting and managing Pinned Emails completely on the frontend using localStorage.
 * Scoped by user to prevent crosstalk between different user accounts on the same browser.
 */

const STORAGE_KEY_PINNED = "bnx_pinned_email_ids";

export const getUserKey = (prefix, userEmail) => {
  if (!userEmail) return prefix;
  const clean = String(userEmail).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `${prefix}_${clean}`;
};

/**
 * Normalizes an email identifier to a canonical string key.
 */
export const getEmailPinKey = (uid, email = null) => {
  const rawUid = uid ?? email?.uid ?? email?.id ?? "";
  const str = String(rawUid).trim();
  if (!str) return "";
  // Strip any folder suffix like "__inbox" if present
  return str.split("__")[0];
};

/**
 * Returns a Set of pinned email UID strings for the given user.
 */
export const getStoredPinnedIds = (userEmail) => {
  const ids = new Set();
  if (typeof window === "undefined" || !window.localStorage) return ids;

  try {
    const key = getUserKey(STORAGE_KEY_PINNED, userEmail);
    const raw = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY_PINNED);
    if (!raw) return ids;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((id) => {
        if (id !== undefined && id !== null) {
          const s = String(id).trim();
          if (s) ids.add(s);
        }
      });
    }
  } catch (e) {
    console.warn("Failed to load pinned email IDs from localStorage:", e);
  }
  return ids;
};

/**
 * Saves a Set of pinned email UID strings for the given user.
 */
export const saveStoredPinnedIds = (pinnedSet, userEmail) => {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    const list = Array.from(pinnedSet || []).map(String);
    const key = getUserKey(STORAGE_KEY_PINNED, userEmail);
    localStorage.setItem(key, JSON.stringify(list));

    // Also mirror to base key if userEmail exists for fallback
    if (userEmail) {
      localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(list));
    }

    // Broadcast change for other components/tabs
    window.dispatchEvent(
      new CustomEvent("bnx-pinned-emails-changed", {
        detail: { userEmail, pinnedIds: list },
      })
    );
  } catch (e) {
    console.warn("Failed to save pinned email IDs to localStorage:", e);
  }
};

/**
 * Checks if a specific email UID is pinned.
 */
export const isEmailPinned = (uid, email = null, pinnedSet = null) => {
  if (email && email.isPinned === true) return true;
  const key = getEmailPinKey(uid, email);
  if (!key) return false;
  if (pinnedSet && pinnedSet instanceof Set) {
    return pinnedSet.has(key);
  }
  return false;
};

/**
 * Pins one or more email UIDs.
 */
export const pinMultipleEmails = (uids, userEmail) => {
  const current = getStoredPinnedIds(userEmail);
  const next = new Set(current);
  (Array.isArray(uids) ? uids : [uids]).forEach((uid) => {
    const key = getEmailPinKey(uid);
    if (key) next.add(key);
  });
  saveStoredPinnedIds(next, userEmail);
  return next;
};

/**
 * Unpins one or more email UIDs.
 */
export const unpinMultipleEmails = (uids, userEmail) => {
  const current = getStoredPinnedIds(userEmail);
  const next = new Set(current);
  (Array.isArray(uids) ? uids : [uids]).forEach((uid) => {
    const key = getEmailPinKey(uid);
    if (key) next.delete(key);
  });
  saveStoredPinnedIds(next, userEmail);
  return next;
};
