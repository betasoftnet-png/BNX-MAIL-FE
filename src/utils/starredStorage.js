/**
 * Utility for persisting and managing Starred Emails completely on the frontend using localStorage.
 */

const STORAGE_KEY_IDS = 'bnx_starred_email_ids';
const STORAGE_KEY_DATA = 'bnx_starred_emails_data';

const getUserKey = (prefix, userEmail) => {
  if (!userEmail) return prefix;
  const clean = String(userEmail).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${prefix}_${clean}`;
};

/**
 * Returns a Set of string email UIDs/IDs that are currently starred.
 */
export const getStoredStarredIds = (userEmail) => {
  const ids = new Set();
  try {
    // 1. Check user-scoped key
    if (userEmail) {
      const scopedRaw = localStorage.getItem(getUserKey(STORAGE_KEY_IDS, userEmail));
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach(id => id && ids.add(String(id)));
        }
      }
    }
    // 2. Also check global key for compatibility
    const globalRaw = localStorage.getItem(STORAGE_KEY_IDS);
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => id && ids.add(String(id)));
      }
    }
  } catch (err) {
    console.error("Failed to read starred email IDs from localStorage:", err);
  }
  return ids;
};

/**
 * Persists the Set or Array of starred IDs to localStorage.
 */
export const saveStoredStarredIds = (idSetOrArr, userEmail) => {
  try {
    const arr = Array.isArray(idSetOrArr) ? idSetOrArr.map(String) : Array.from(idSetOrArr).map(String);
    const json = JSON.stringify(arr);
    localStorage.setItem(STORAGE_KEY_IDS, json);
    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_IDS, userEmail), json);
    }
  } catch (err) {
    console.error("Failed to save starred email IDs to localStorage:", err);
  }
};

/**
 * Returns a Map of uid -> full email object for all starred emails saved in localStorage.
 */
export const getStoredStarredEmailsMap = (userEmail) => {
  const map = new Map();
  try {
    const readFromKey = (key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([uid, email]) => {
            if (uid && email && !map.has(String(uid))) {
              map.set(String(uid), email);
            }
          });
        }
      }
    };

    if (userEmail) {
      readFromKey(getUserKey(STORAGE_KEY_DATA, userEmail));
    }
    readFromKey(STORAGE_KEY_DATA);
  } catch (err) {
    console.error("Failed to read starred emails data from localStorage:", err);
  }
  return map;
};

/**
 * Saves a full email object to the starred emails map in localStorage.
 */
export const saveStoredStarredEmail = (email, userEmail) => {
  if (!email) return;
  const uidStr = String(email.uid ?? email.id ?? '');
  if (!uidStr) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.set(uidStr, { ...email, starred: true });
    
    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    const json = JSON.stringify(obj);

    localStorage.setItem(STORAGE_KEY_DATA, json);
    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_DATA, userEmail), json);
    }
  } catch (err) {
    console.error("Failed to save starred email data to localStorage:", err);
  }
};

/**
 * Removes an email from the starred emails map in localStorage.
 */
export const removeStoredStarredEmail = (uid, userEmail) => {
  const uidStr = String(uid);
  if (!uidStr) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.delete(uidStr);

    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    const json = JSON.stringify(obj);

    localStorage.setItem(STORAGE_KEY_DATA, json);
    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_DATA, userEmail), json);
    }
  } catch (err) {
    console.error("Failed to remove starred email data from localStorage:", err);
  }
};

/**
 * Checks if a specific UID is starred in localStorage.
 */
export const isEmailIdStarred = (uid, userEmail) => {
  if (!uid && uid !== 0) return false;
  const set = getStoredStarredIds(userEmail);
  return set.has(String(uid));
};
