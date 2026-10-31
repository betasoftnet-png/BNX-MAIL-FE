/**
 * Utility for persisting and managing Starred Emails completely on the frontend using localStorage.
 * Supports folder-scoped IDs (e.g. 'draft:123', 'inbox:456') to prevent collisions between different
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
    const readFromRaw = (raw) => {
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
 */
export const saveStoredStarredEmail = (email, userEmail, folder = '') => {
  if (!email) return;
  const isDraft = folder === 'draft' || folder === 'drafts' || email.isDraft === true || email.draft === true || email.folderName?.toLowerCase()?.includes('draft');
  const normFolder = isDraft ? 'draft' : normalizeFolderName(folder || email.folderName, email);
  const canonicalKey = getEmailStarKey(email.uid ?? email.id, normFolder, email);
  if (!canonicalKey) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.set(canonicalKey, {
      ...email,
      folderName: isDraft ? 'Drafts' : (email.folderName || normFolder),
      isDraft: isDraft ? true : Boolean(email.isDraft || email.draft),
      draft: isDraft ? true : Boolean(email.isDraft || email.draft),
      starred: true,
      isStarred: true
    });
    
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
    const isDraft = folder === 'draft' || folder === 'drafts' || email?.isDraft === true || email?.draft === true || email?.folderName?.toLowerCase()?.includes('draft');
    const normFolder = isDraft ? 'draft' : normalizeFolderName(folder || email?.folderName, email);
    const canonicalKey = getEmailStarKey(uid, normFolder, email);
    const bareUid = String(uid ?? email?.uid ?? email?.id ?? '').trim();

    const map = getStoredStarredEmailsMap(userEmail);
    if (canonicalKey) map.delete(canonicalKey);
    if (bareUid) {
      map.delete(bareUid);
      map.delete(`draft:${bareUid}`);
      map.delete(`drafts:${bareUid}`);
      map.delete(`inbox:${bareUid}`);
      map.delete(`sent:${bareUid}`);
      map.delete(`scheduled:${bareUid}`);
    }
    if (normFolder === 'sent') {
      for (const [k, item] of map.entries()) {
        if (k.startsWith('scheduled:') && matchesScheduledAndSentEmail(item, email || { uid, folderName: 'sent' })) {
          map.delete(k);
          const sUid = String(item.uid ?? item.id ?? '');
          if (sUid) map.delete(`scheduled:${sUid}`);
        }
      }
    }
    if (normFolder === 'scheduled') {
      for (const [k, item] of map.entries()) {
        if (k.startsWith('sent:') && matchesScheduledAndSentEmail(email || { uid, folderName: 'scheduled' }, item)) {
          map.delete(k);
          const sUid = String(item.uid ?? item.id ?? '');
          if (sUid) map.delete(`sent:${sUid}`);
        }
      }
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

const getEmailTimestamp = (m) => {
  if (!m) return 0;
  const raw = m.sentDate || m.date || m.receivedDate || m.scheduledAt || m.createdAt || m.timestamp;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return isNaN(t) ? 0 : t;
};

export const matchesScheduledAndSentEmail = (sched, sent) => {
  if (!sched || !sent) return false;

  // 1. Subject match (must match)
  const schedSub = String(sched.subject || '').trim().toLowerCase();
  const sentSub = String(sent.subject || '').trim().toLowerCase();
  if (!schedSub || schedSub !== sentSub) return false;

  // 2. Recipient match (must match at least one recipient if available)
  const schedRecipients = extractAllCleanEmails(sched.to || sched.recipientEmail || sched.toRecipient || sched.recipient);
  const sentRecipients = extractAllCleanEmails(sent.to || sent.recipientEmail || sent.toRecipient || sent.recipient || sent.recipients);
  if (schedRecipients.length > 0 && sentRecipients.length > 0) {
    const hasRecipientMatch = schedRecipients.some(r => sentRecipients.includes(r));
    if (!hasRecipientMatch) return false;
  }

  // 3. Body snippet match if both available
  const schedText = getCleanTextSnippet(sched.body || sched.htmlBody);
  const sentText = getCleanTextSnippet(sent.body || sent.htmlBody || sent.textPlain);
  if (schedText && sentText) {
    const minLen = Math.min(25, Math.min(schedText.length, sentText.length));
    if (minLen >= 10 && !schedText.includes(sentText.slice(0, minLen)) && !sentText.includes(schedText.slice(0, minLen))) {
      return false;
    }
  }

  // 4. Timing sanity check: sent time should not be significantly before the scheduled time
  const schedTime = getEmailTimestamp(sched);
  const sentTime = getEmailTimestamp(sent);
  if (schedTime > 0 && sentTime > 0) {
    if (sentTime < schedTime - 300000) {
      return false;
    }
  }

  return true;
};

export const linkScheduledStarToSentEmail = (sentEmail, userEmail) => {
  if (!sentEmail) return false;
  const sentUid = String(sentEmail.uid ?? sentEmail.id ?? '').trim();
  if (!sentUid) return false;

  const currentSet = getStoredStarredIds(userEmail);
  const sentCanonicalKey = `sent:${sentUid}`;

  if (currentSet.has(sentCanonicalKey)) {
    return true;
  }

  const storedMap = getStoredStarredEmailsMap(userEmail);
  let matchedKey = null;
  let matchedScheduled = null;

  for (const [key, item] of storedMap.entries()) {
    const isSched = item.folderName?.toLowerCase() === 'scheduled' || key.startsWith('scheduled:');
    if (isSched) {
      const schedUid = String(item.uid ?? item.id ?? '');
      const isStarredInSet = currentSet.has(key) || currentSet.has(`scheduled:${schedUid}`) || currentSet.has(schedUid) || item.starred === true || item.isStarred === true;
      if (isStarredInSet) {
        if (matchesScheduledAndSentEmail(item, sentEmail)) {
          matchedKey = key;
          matchedScheduled = item;
          break;
        }
      }
    }
  }

  if (matchedKey && matchedScheduled) {
    const schedUid = String(matchedScheduled.uid ?? matchedScheduled.id ?? '');

    currentSet.add(sentCanonicalKey);
    currentSet.delete(matchedKey);
    currentSet.delete(`scheduled:${schedUid}`);
    currentSet.delete(schedUid);
    saveStoredStarredIds(currentSet, userEmail);

    removeStoredStarredEmail(schedUid, userEmail, 'scheduled', matchedScheduled);
    saveStoredStarredEmail({
      ...matchedScheduled,
      ...sentEmail,
      folderName: 'Sent',
      starred: true,
      isStarred: true,
      uid: sentUid,
      id: sentEmail.id ?? sentUid,
    }, userEmail, 'sent');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-starred-updated', {
        detail: { uid: sentUid, folder: 'sent', starred: true }
      }));
    }

    return true;
  }

  return false;
};

/**
 * Checks if a specific UID is starred, taking folder context into account to prevent cross-folder collisions.
 */
export const isEmailIdStarred = (uid, userEmail, folder = '', email = null) => {
  if (!uid && uid !== 0 && !email) return false;
  const rawUid = uid ?? email?.uid ?? email?.id;
  const uidStr = String(rawUid).trim();
  if (!uidStr) return false;

  const isDraft = folder === 'draft' || folder === 'drafts' || email?.isDraft === true || email?.draft === true || email?.folderName?.toLowerCase()?.includes('draft');
  const currentFolder = isDraft ? 'draft' : normalizeFolderName(folder || email?.folderName, email);
  const canonicalKey = currentFolder ? `${currentFolder}:${uidStr}` : uidStr;

  // 1. Check draft-specific overrides first if folder is draft
  if (currentFolder === 'draft') {
    try {
      const userKey = userEmail ? getUserKey('bnx_draft_star_overrides', userEmail) : null;
      const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem('bnx_draft_star_overrides');
      if (stored) {
        const overrides = JSON.parse(stored);
        if (overrides[uidStr] === true || overrides[`draft:${uidStr}`] === true) {
          return true;
        }
        if (overrides[uidStr] === false || overrides[`draft:${uidStr}`] === false) {
          return false;
        }
      }
    } catch (e) {}
  }

  const idSet = getStoredStarredIds(userEmail);

  // 2. Direct canonical match (e.g. 'draft:5' in idSet)
  if (idSet.has(canonicalKey)) {
    return true;
  }

  // 3. Draft-specific aliases in idSet
  if (currentFolder === 'draft') {
    if (idSet.has(`draft:${uidStr}`) || idSet.has(`drafts:${uidStr}`)) {
      return true;
    }
    // For drafts, never fall back to bare numeric IDs or inbox matches!
    return false;
  }

  // 4. Message-ID matching if available
  const messageId = email?.messageId ? String(email.messageId).trim().toLowerCase() : '';
  if (messageId && idSet.has(`mid:${messageId}`)) {
    return true;
  }

  // 4b. Check if this is a sent email that corresponds to a previously starred scheduled email
  if (currentFolder === 'sent' && email) {
    if (linkScheduledStarToSentEmail(email, userEmail)) {
      return true;
    }
  }

  // 5. Fallback check for bare numeric IDs:
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
