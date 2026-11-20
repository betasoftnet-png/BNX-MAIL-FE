/**
 * Utility for persisting and managing Important Emails state on frontend.
 * Provides user-scoped cache and fast lookup for importance state.
 */

const STORAGE_KEY_IDS = 'bnx_important_email_ids';

export const getUserKey = (prefix, userEmail) => {
  if (!userEmail) return prefix;
  const clean = String(userEmail).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${prefix}_${clean}`;
};

export const normalizeFolderName = (folder, email = null) => {
  if (!folder) return 'inbox';
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

export const getEmailImportantKey = (uid, folder = '', email = null) => {
  const rawUid = uid ?? email?.uid ?? email?.id ?? '';
  const uidStr = String(rawUid).trim();
  if (!uidStr) return '';
  const normFolder = normalizeFolderName(folder || email?.folderName, email);
  return normFolder ? `${normFolder}:${uidStr}` : uidStr;
};

export const getStoredImportantIds = (userEmail) => {
  const ids = new Set();
  try {
    const raw = localStorage.getItem(getUserKey(STORAGE_KEY_IDS, userEmail));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => {
          if (id !== undefined && id !== null) {
            ids.add(String(id).trim());
          }
        });
      }
    }
  } catch (err) {
    console.error("Failed to load important email IDs:", err);
  }
  return ids;
};

export const saveStoredImportantIds = (idsSet, userEmail) => {
  try {
    const arr = Array.from(idsSet || []);
    localStorage.setItem(getUserKey(STORAGE_KEY_IDS, userEmail), JSON.stringify(arr));
  } catch (err) {
    console.error("Failed to save important email IDs:", err);
  }
};

export const isEmailIdImportant = (uid, folder = '', email = null, importantIdsSet = null) => {
  if (email && (email.isImportant === true || email.important === true)) {
    return true;
  }
  if (!importantIdsSet || !(importantIdsSet instanceof Set)) {
    return false;
  }
  const rawUid = uid ?? email?.uid ?? email?.id ?? '';
  const uidStr = String(rawUid).trim();
  if (!uidStr) return false;

  if (importantIdsSet.has(uidStr)) return true;

  const key = getEmailImportantKey(rawUid, folder, email);
  if (key && importantIdsSet.has(key)) return true;

  return false;
};
