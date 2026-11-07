/**
 * Utility for persisting and managing Starred Emails completely on the frontend using localStorage.
 * Supports folder-scoped IDs (e.g. 'inbox:456', 'sent:12') to prevent collisions between different
 * IMAP folders that share identical numeric message UIDs.
 */

const STORAGE_KEY_IDS = 'bnx_starred_email_ids';
const STORAGE_KEY_DATA = 'bnx_starred_emails_data';

export const getUserKey = (prefix, userEmail) => {
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
  if (f.includes('schedule')) return 'scheduled';
  return f;
};

/**
 * Generates an unambiguous, folder-scoped star key for an email.
 * E.g., 'inbox:5', 'sent:12'.
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
 * Excludes draft keys and ensures strictly user-scoped persistence.
 */
export const getStoredStarredIds = (userEmail) => {
  const ids = new Set();
  try {
    const parseIds = (raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => {
          if (id !== undefined && id !== null) {
            const s = String(id).trim();
            // Discard draft keys and empty values
            if (s && !s.startsWith('draft:') && !s.startsWith('drafts:')) {
              ids.add(s);
            }
          }
        });
      }
    };

    // 1. Check user-scoped key first
    if (userEmail) {
      const userRaw = localStorage.getItem(getUserKey(STORAGE_KEY_IDS, userEmail));
      if (userRaw !== null) {
        parseIds(userRaw);
        return ids;
      }
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
    const arr = (Array.isArray(idSetOrArr) ? idSetOrArr : Array.from(idSetOrArr))
      .map(id => String(id).trim())
      .filter(id => Boolean(id) && !id.startsWith('draft:') && !id.startsWith('drafts:'));
    const json = JSON.stringify(arr);
    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_IDS, userEmail), json);
    } else {
      localStorage.setItem(STORAGE_KEY_IDS, json);
    }
  } catch (err) {
    console.error("Failed to save starred email IDs to localStorage:", err);
  }
};

/**
 * Returns a Map of canonical starKey -> full email object for all starred emails saved in localStorage.
 * Automatically excludes drafts to ensure drafts never appear in Starred.
 */
export const getStoredStarredEmailsMap = (userEmail) => {
  const map = new Map();
  try {
    const readFromRaw = (raw) => {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, email]) => {
            if (email && typeof email === 'object') {
              const isDraft = email.isDraft === true || email.draft === true || email.folderName?.toLowerCase()?.includes('draft') || k.startsWith('draft:') || k.startsWith('drafts:');
              if (isDraft) return;

              const normFolder = normalizeFolderName(email.folderName, email) || 'inbox';
              const canonicalKey = getEmailStarKey(email.uid ?? email.id ?? k, normFolder, email);
              if (canonicalKey && !canonicalKey.startsWith('draft:') && !canonicalKey.startsWith('drafts:')) {
                map.set(canonicalKey, {
                  ...email,
                  folderName: email.folderName || normFolder,
                  isDraft: false,
                  draft: false,
                  starred: true,
                  isStarred: true
                });
              }
            }
          });
        }
      }
    };

    if (userEmail) {
      const userRaw = localStorage.getItem(getUserKey(STORAGE_KEY_DATA, userEmail));
      if (userRaw !== null) {
        readFromRaw(userRaw);
        return map;
      }
    }
    readFromRaw(localStorage.getItem(STORAGE_KEY_DATA));
  } catch (err) {
    console.error("Failed to read starred emails data from localStorage:", err);
  }
  return map;
};

/**
 * Saves a full email object to the starred emails map in localStorage under its canonical star key.
 * Draft emails are strictly excluded from starred storage.
 */
export const saveStoredStarredEmail = (email, userEmail, folder = '') => {
  if (!email) return;
  const isDraft = folder === 'draft' || folder === 'drafts' || email.isDraft === true || email.draft === true || email.folderName?.toLowerCase()?.includes('draft');
  if (isDraft) return; // Never save draft emails into starred emails storage

  const normFolder = normalizeFolderName(folder || email.folderName, email) || 'inbox';
  const canonicalKey = getEmailStarKey(email.uid ?? email.id, normFolder, email);
  if (!canonicalKey || canonicalKey.startsWith('draft:') || canonicalKey.startsWith('drafts:')) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.set(canonicalKey, {
      ...email,
      folderName: email.folderName || normFolder,
      isDraft: false,
      draft: false,
      starred: true,
      isStarred: true
    });
    
    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    const json = JSON.stringify(obj);

    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_DATA, userEmail), json);
    } else {
      localStorage.setItem(STORAGE_KEY_DATA, json);
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
    const normFolder = normalizeFolderName(folder || email?.folderName, email);
    const canonicalKey = getEmailStarKey(uid, normFolder, email);
    const bareUid = String(uid ?? email?.uid ?? email?.id ?? '').trim();

    const map = getStoredStarredEmailsMap(userEmail);
    if (canonicalKey) map.delete(canonicalKey);
    if (bareUid) {
      map.delete(bareUid);
      if (normFolder) map.delete(`${normFolder}:${bareUid}`);
      map.delete(`draft:${bareUid}`);
      map.delete(`drafts:${bareUid}`);
      map.delete(`inbox:${bareUid}`);
      map.delete(`sent:${bareUid}`);
    }

    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    const json = JSON.stringify(obj);

    if (userEmail) {
      localStorage.setItem(getUserKey(STORAGE_KEY_DATA, userEmail), json);
    } else {
      localStorage.setItem(STORAGE_KEY_DATA, json);
    }
  } catch (err) {
    console.error("Failed to remove starred email data from localStorage:", err);
  }
};

export const extractCleanEmail = (str) => {
  if (!str) return '';
  const match = String(str).match(/<([^>]+)>/);
  const raw = match ? match[1] : str;
  return raw.toLowerCase().trim().replace(/['"]/g, '');
};

export const extractAllCleanEmails = (str) => {
  if (!str) return [];
  return String(str)
    .split(/[,;]/)
    .map(extractCleanEmail)
    .filter(Boolean);
};

export const getCleanTextSnippet = (content, length = 80) => {
  if (!content) return '';
  return String(content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, length);
};

export const matchesScheduledAndSentEmail = (sched, sent) => {
  if (!sched || !sent) return false;

  const schedSub = String(sched.subject || '').trim().toLowerCase();
  const sentSub = String(sent.subject || '').trim().toLowerCase();
  if (!schedSub || schedSub !== sentSub) return false;

  const schedRecipients = extractAllCleanEmails(sched.to || sched.recipientEmail || sched.toRecipient || sched.recipient);
  const sentRecipients = extractAllCleanEmails(sent.to || sent.recipientEmail || sent.toRecipient || sent.recipient || sent.recipients);
  if (schedRecipients.length > 0 && sentRecipients.length > 0) {
    const hasRecipientMatch = schedRecipients.some(r => sentRecipients.includes(r));
    if (!hasRecipientMatch) return false;
  }

  const schedText = getCleanTextSnippet(sched.body || sched.htmlBody);
  const sentText = getCleanTextSnippet(sent.body || sent.htmlBody || sent.textPlain);
  if (schedText && sentText) {
    const minLen = Math.min(25, Math.min(schedText.length, sentText.length));
    if (minLen >= 10 && !schedText.includes(sentText.slice(0, minLen)) && !sentText.includes(schedText.slice(0, minLen))) {
      return false;
    }
  }

  return true;
};

export const linkScheduledStarToSentEmail = () => {
  // Disabled: Sent emails should never be automatically starred
  return false;
};

/**
 * Checks if a specific UID is starred, taking folder context into account to prevent cross-folder collisions.
 * Strictly requires explicit star action.
 */
export const isEmailIdStarred = (uid, userEmail, folder = '', email = null) => {
  if (!uid && uid !== 0 && !email) return false;
  const rawUid = uid ?? email?.uid ?? email?.id;
  const uidStr = String(rawUid).trim();
  if (!uidStr) return false;

  const isDraft = folder === 'draft' || folder === 'drafts' || email?.isDraft === true || email?.draft === true || email?.folderName?.toLowerCase()?.includes('draft');
  const currentFolder = isDraft ? 'draft' : normalizeFolderName(folder || email?.folderName, email);

  // If checking draft, check draft-specific overrides/storage for Draft folder UI only
  if (currentFolder === 'draft') {
    const idSet = getStoredStarredIds(userEmail);
    if (idSet.has(`draft:${uidStr}`) || idSet.has(`drafts:${uidStr}`)) {
      return true;
    }
    try {
      const userKey = userEmail ? getUserKey('bnx_draft_star_overrides', userEmail) : null;
      const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem('bnx_draft_star_overrides');
      if (stored) {
        const overrides = JSON.parse(stored);
        if (overrides[uidStr] === true || overrides[`draft:${uidStr}`] === true) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  const canonicalKey = currentFolder ? `${currentFolder}:${uidStr}` : uidStr;
  const idSet = getStoredStarredIds(userEmail);

  // 1. Direct canonical match (e.g. 'inbox:5' or 'sent:12' in idSet)
  if (idSet.has(canonicalKey)) {
    return true;
  }

  // 2. Message-ID matching if available
  const messageId = email?.messageId ? String(email.messageId).trim().toLowerCase() : '';
  if (messageId && idSet.has(`mid:${messageId}`)) {
    return true;
  }

  // 3. Check in stored map by canonical key
  if (canonicalKey) {
    const map = getStoredStarredEmailsMap(userEmail);
    if (map.has(canonicalKey)) {
      return true;
    }
  }

  return false;
};

/**
 * Validates that an email object is genuinely a scheduled email, preventing inclusion of
 * emails from Inbox, Sent, Draft, Trash, Spam, or past/processed emails.
 */
export const isEmailValidScheduled = (m) => {
  if (!m) return false;

  // 1. Prevent emails from Inbox, Sent, Draft, Trash, Spam, or other folders
  const folder = String(m.folderName || m.folder || '').trim().toLowerCase();
  if (folder && folder !== 'scheduled') {
    return false;
  }
  if (m.isDraft === true || m.draft === true || m.isTrash === true || m.deleted === true || m.isSpam === true) {
    return false;
  }

  // 2. Status check: if status is present, must be 'SCHEDULED' (or not processed/cancelled)
  if (m.status && String(m.status).trim().toUpperCase() !== 'SCHEDULED') {
    return false;
  }
  if (m.processed === true) {
    return false;
  }

  // 3. Scheduled-send time must still be in the future
  const schedTimeRaw = m.scheduledAt || m.scheduledTime || m.sendAt || m.receivedDate || m.date;
  if (!schedTimeRaw) return false;
  const schedTime = new Date(schedTimeRaw).getTime();
  if (isNaN(schedTime) || schedTime <= Date.now()) {
    return false;
  }

  return true;
};
