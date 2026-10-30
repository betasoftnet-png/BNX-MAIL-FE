/**
 * Utility for persisting and managing Starred Emails completely on the frontend using localStorage.
 * Supports folder-scoped IDs (e.g. 'draft:123', 'inbox:456') to prevent collisions between different
 * IMAP folders that share identical numeric message UIDs.
 */

const STORAGE_KEY_IDS = 'bnx_starred_email_ids';
const STORAGE_KEY_DATA = 'bnx_starred_emails_data';

const getUserKey = (prefix, userEmail) => {
  if (!userEmail) return prefix;
  const clean = String(userEmail).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${prefix}_${clean}`;
};

/**
 * Normalizes a folder name to a consistent canonical string.
 */
export const normalizeFolderName = (folder, email = null) => {
  if (email && (email.isDraft === true || email.draft === true)) return 'draft';
  if (!folder) return '';
  const f = String(folder).trim().toLowerCase();
  if (f.includes('draft')) return 'draft';
  if (f.includes('sent')) return 'sent';
  if (f.includes('inbox')) return 'inbox';
  if (f.includes('trash') || f.includes('deleted')) return 'trash';
  if (f.includes('spam') || f.includes('junk')) return 'spam';
  if (f.includes('archive')) return 'archive';
  if (f.includes('snooze')) return 'snoozed';
  return f;
};

/**
 * Generates an unambiguous, folder-scoped star key for an email or draft.
 * E.g., 'draft:5', 'inbox:5', 'sent:12'.
 */
export const getEmailStarKey = (uid, folder = '', email = null) => {
  const rawUid = uid ?? email?.uid ?? email?.id ?? '';
  const uidStr = String(rawUid).trim();
  if (!uidStr) return '';
  
  const normFolder = normalizeFolderName(folder || email?.folderName, email);
  return normFolder ? `${normFolder}:${uidStr}` : uidStr;
};

/**
 * Returns a Set of star keys currently active for the user.
 */
export const getStoredStarredIds = (userEmail) => {
  const ids = new Set();
  try {
    const parseIds = (raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => {
          if (id !== undefined && id !== null && String(id).trim()) {
            ids.add(String(id).trim());
          }
        });
      }
    };

    // 1. Check user-scoped key
    if (userEmail) {
      parseIds(localStorage.getItem(getUserKey(STORAGE_KEY_IDS, userEmail)));
    }
    // 2. Also check global key for compatibility
    parseIds(localStorage.getItem(STORAGE_KEY_IDS));
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
    const arr = Array.isArray(idSetOrArr)
      ? idSetOrArr.map(id => String(id).trim()).filter(Boolean)
      : Array.from(idSetOrArr).map(id => String(id).trim()).filter(Boolean);
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
 * Returns a Map of canonical starKey -> full email object for all starred emails saved in localStorage.
 * Automatically migrates bare numeric keys to folder-scoped keys when folder information is present.
 */
export const getStoredStarredEmailsMap = (userEmail) => {
  const map = new Map();
  try {
    const readFromKey = (key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, email]) => {
            if (email && typeof email === 'object') {
              const canonicalKey = getEmailStarKey(email.uid ?? email.id ?? k, email.folderName, email);
              if (canonicalKey) {
                map.set(canonicalKey, { ...email, starred: true, isStarred: true });
              }
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
 * Saves a full email object to the starred emails map in localStorage under its canonical star key.
 */
export const saveStoredStarredEmail = (email, userEmail, folder = '') => {
  if (!email) return;
  const canonicalKey = getEmailStarKey(email.uid ?? email.id, folder || email.folderName, email);
  if (!canonicalKey) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.set(canonicalKey, { ...email, starred: true, isStarred: true });
    
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
export const removeStoredStarredEmail = (uid, userEmail, folder = '', email = null) => {
  if (!uid && uid !== 0 && !email) return;

  try {
    const canonicalKey = getEmailStarKey(uid, folder, email);
    const bareUid = String(uid ?? email?.uid ?? email?.id ?? '').trim();

    const map = getStoredStarredEmailsMap(userEmail);
    if (canonicalKey) map.delete(canonicalKey);
    if (bareUid) {
      map.delete(bareUid);
      map.delete(`draft:${bareUid}`);
      map.delete(`inbox:${bareUid}`);
      map.delete(`sent:${bareUid}`);
    }

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
 * Checks if a specific UID is starred, taking folder context into account to prevent cross-folder collisions.
 */
export const isEmailIdStarred = (uid, userEmail, folder = '', email = null) => {
  if (!uid && uid !== 0 && !email) return false;
  const rawUid = uid ?? email?.uid ?? email?.id;
  const uidStr = String(rawUid).trim();
  if (!uidStr) return false;

  const currentFolder = normalizeFolderName(folder || email?.folderName, email);
  const canonicalKey = currentFolder ? `${currentFolder}:${uidStr}` : uidStr;

  const idSet = getStoredStarredIds(userEmail);

  // 1. Direct canonical match (e.g. 'draft:5' in idSet)
  if (idSet.has(canonicalKey)) {
    return true;
  }

  // 2. Draft-specific aliases
  if (currentFolder === 'draft') {
    if (idSet.has(`draft:${uidStr}`) || idSet.has(`drafts:${uidStr}`)) {
      return true;
    }
    try {
      const storedOverrides = localStorage.getItem('bnx_draft_star_overrides');
      if (storedOverrides) {
        const overrides = JSON.parse(storedOverrides);
        if (overrides[uidStr] === true || overrides[`draft:${uidStr}`] === true) {
          return true;
        }
        if (overrides[uidStr] === false || overrides[`draft:${uidStr}`] === false) {
          return false;
        }
      }
    } catch (e) {}
  }

  // 3. Message-ID matching if available
  const messageId = email?.messageId ? String(email.messageId).trim().toLowerCase() : '';
  if (messageId && idSet.has(`mid:${messageId}`)) {
    return true;
  }

  // 4. Fallback check for bare numeric IDs:
  // If idSet contains a bare numeric ID (e.g. '5'), verify against stored emails map
  // to ensure that this ID actually belongs to the requested folder, rather than another folder!
  if (idSet.has(uidStr)) {
    const map = getStoredStarredEmailsMap(userEmail);
    // Check if map has this email under canonical key
    if (map.has(canonicalKey)) return true;

    // Check if map has an item under any key matching this UID
    for (const [k, storedItem] of map.entries()) {
      const storedUid = String(storedItem.uid ?? storedItem.id ?? '');
      if (storedUid === uidStr) {
        const storedFolder = normalizeFolderName(storedItem.folderName, storedItem);
        // If the stored item's folder matches our folder, it is starred!
        if (storedFolder === currentFolder) return true;
        // If the stored item's folder is DIFFERENT (e.g. stored item is a draft, but we are checking inbox),
        // then this email in this folder is explicitly NOT starred!
        if (storedFolder && currentFolder && storedFolder !== currentFolder) {
          return false;
        }
      }
    }

    // If no folder conflict is detected and folder is unspecified, allow match
    if (!currentFolder) {
      return true;
    }
  }

  return false;
};
