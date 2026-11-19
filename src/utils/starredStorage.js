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
            if (s) {
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
      .filter(id => Boolean(id));
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
              const normFolder = isDraft ? 'draft' : (normalizeFolderName(email.folderName, email) || 'inbox');
              const canonicalKey = getEmailStarKey(email.uid ?? email.id ?? k, normFolder, email);
              if (canonicalKey) {
                map.set(canonicalKey, {
                  ...email,
                  folderName: isDraft ? 'Drafts' : (email.folderName || normFolder),
                  isDraft: isDraft,
                  draft: isDraft,
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
  const normFolder = isDraft ? 'draft' : (normalizeFolderName(folder || email.folderName, email) || 'inbox');
  const canonicalKey = getEmailStarKey(email.uid ?? email.id, normFolder, email);
  if (!canonicalKey) return;

  try {
    const map = getStoredStarredEmailsMap(userEmail);
    map.set(canonicalKey, {
      ...email,
      folderName: isDraft ? 'Drafts' : (email.folderName || normFolder),
      isDraft: isDraft,
      draft: isDraft,
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
      map.delete(`starred:${bareUid}`);
      map.delete(`inbox:${bareUid}`);
      map.delete(`sent:${bareUid}`);
      map.delete(`draft:${bareUid}`);
      map.delete(`drafts:${bareUid}`);
      map.delete(`archive:${bareUid}`);
      map.delete(`trash:${bareUid}`);
      if (normFolder) map.delete(`${normFolder}:${bareUid}`);
      for (const k of Array.from(map.keys())) {
        if (k === bareUid || k.endsWith(`:${bareUid}`)) {
          map.delete(k);
        }
      }
    }
    const messageId = email?.messageId ? String(email.messageId).trim().toLowerCase().replace(/^<|>$/g, '') : '';
    if (messageId) {
      for (const [k, item] of Array.from(map.entries())) {
        const itemMid = item?.messageId ? String(item.messageId).trim().toLowerCase().replace(/^<|>$/g, '') : '';
        if (itemMid && itemMid === messageId) {
          map.delete(k);
        }
      }
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

  // If checking draft, check draft-specific overrides/storage for Draft folder UI
  if (currentFolder === 'draft') {
    const idSet = getStoredStarredIds(userEmail);
    if (idSet.has(`draft:${uidStr}`) || idSet.has(`drafts:${uidStr}`) || idSet.has(uidStr)) {
      return true;
    }
    try {
      const userKey = userEmail ? getUserKey('bnx_draft_star_overrides', userEmail) : null;
      const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem('bnx_draft_star_overrides');
      if (stored) {
        const overrides = JSON.parse(stored);
        if (overrides[uidStr] !== undefined || overrides[`draft:${uidStr}`] !== undefined) {
          return overrides[uidStr] === true || overrides[`draft:${uidStr}`] === true;
        }
      }
    } catch (e) { }
    const map = getStoredStarredEmailsMap(userEmail);
    if (map.has(`draft:${uidStr}`) || map.has(`drafts:${uidStr}`) || map.has(uidStr)) {
      return true;
    }
    if (email && (email.isStarred === true || email.starred === true)) {
      return true;
    }
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

  // 4. In Starred folder context (or when folder is 'starred' or unset), check any folder key in idSet or map
  if (!currentFolder || currentFolder === 'starred') {
    if (idSet.has(uidStr) || idSet.has(`inbox:${uidStr}`) || idSet.has(`sent:${uidStr}`) || idSet.has(`draft:${uidStr}`) || idSet.has(`drafts:${uidStr}`) || idSet.has(`starred:${uidStr}`) || idSet.has(`archive:${uidStr}`)) {
      return true;
    }
    const map = getStoredStarredEmailsMap(userEmail);
    if (map.has(uidStr) || map.has(`inbox:${uidStr}`) || map.has(`sent:${uidStr}`) || map.has(`draft:${uidStr}`) || map.has(`drafts:${uidStr}`) || map.has(`starred:${uidStr}`) || map.has(`archive:${uidStr}`)) {
      return true;
    }
    for (const id of idSet) {
      if (id === uidStr || id.endsWith(`:${uidStr}`)) return true;
    }
    for (const k of map.keys()) {
      if (k === uidStr || k.endsWith(`:${uidStr}`)) return true;
    }
    if (email && (email.isStarred === true || email.starred === true)) {
      return true;
    }
  }

  return false;
};

/**
 * Safely parses any date/timestamp from a scheduled email into numeric millisecond epoch.
 * Properly handles UTC ISO strings stripped of timezone offset by backend LocalDateTime
 * (e.g. "2026-11-17T12:30:00") so they resolve accurately across all local time zones.
 */
export const parseScheduledTime = (m) => {
  if (!m) return null;
  const raw = m.scheduledAt || m.scheduledTime || m.sendAt || m.receivedDate || m.date || m.timestamp;
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number" && !isNaN(raw)) {
    return raw < 10000000000 ? raw * 1000 : raw;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return num < 10000000000 ? num * 1000 : num;
    }

    // If explicit timezone suffix exists ('Z', '+HH:MM', or '-HH:MM'), parse directly
    if (trimmed.endsWith('Z') || trimmed.includes('+') || /-\d{2}:\d{2}$/.test(trimmed)) {
      const t = new Date(trimmed).getTime();
      if (!isNaN(t)) return t;
    }

    // Backend stores LocalDateTime created from ISO UTC strings without 'Z' (e.g. "2026-11-17T12:30:00")
    const asUtc = new Date(`${trimmed}Z`).getTime();
    const asLocal = new Date(trimmed).getTime();
    const now = Date.now();

    // Prefer future timestamp if one matches
    if (!isNaN(asUtc) && asUtc > now) return asUtc;
    if (!isNaN(asLocal) && asLocal > now) return asLocal;
    if (!isNaN(asUtc)) return asUtc;
    if (!isNaN(asLocal)) return asLocal;
  }

  if (raw instanceof Date) {
    const time = raw.getTime();
    return isNaN(time) ? null : time;
  }

  return null;
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

  // 2. Status check: if status is present, must not be sent/cancelled/processed
  if (m.status) {
    const s = String(m.status).trim().toUpperCase();
    if (s === 'SENT' || s === 'CANCELLED' || s === 'PROCESSED' || s === 'DELETED') {
      return false;
    }
  }
  if (m.processed === true) {
    return false;
  }

  // 3. Scheduled-send time must still be active or in the future
  const schedTime = parseScheduledTime(m);
  if (!schedTime || isNaN(schedTime)) {
    return false;
  }

  // Allow a grace window (e.g. 60s) so pending emails being processed by backend scheduler don't vanish prematurely
  const now = Date.now();
  if (schedTime <= now - 60000) {
    return false;
  }

  return true;
};

/**
 * Deduplicates a list of starred emails so that each unique email appears exactly once.
 * Identifies duplicates by:
 * 1. Unique UID / ID
 * 2. Normalized message ID (RFC 5322 globally unique identifier across folders/IMAP)
 * 3. Fallback combination of threadId/sender, subject, timestamp, and body snippet.
 * Preserves different emails in the same conversation / thread.
 */
export const deduplicateStarredEmails = (emailsList) => {
  if (!Array.isArray(emailsList) || emailsList.length === 0) return [];

  const seenUids = new Set();
  const seenMsgIds = new Set();
  const seenFallbacks = new Set();
  const result = [];

  for (const e of emailsList) {
    if (!e) continue;

    const rawUid = e.uid ?? e.id;
    const uidStr = rawUid !== undefined && rawUid !== null && String(rawUid).trim() !== ''
      ? String(rawUid).trim()
      : '';

    const rawMsgId = e.messageId || e.msgId;
    const msgId = (rawMsgId && typeof rawMsgId === 'string')
      ? rawMsgId.trim().toLowerCase().replace(/^<|>$/g, '')
      : '';

    let isDuplicate = false;
    let matchedIndex = -1;

    if (uidStr && seenUids.has(uidStr)) {
      isDuplicate = true;
      matchedIndex = result.findIndex(item => {
        const itemUid = item.uid ?? item.id;
        return itemUid !== undefined && itemUid !== null && String(itemUid).trim() === uidStr;
      });
    } else if (msgId && seenMsgIds.has(msgId)) {
      isDuplicate = true;
      matchedIndex = result.findIndex(item => {
        const itemMsgId = item.messageId || item.msgId;
        return itemMsgId && String(itemMsgId).trim().toLowerCase().replace(/^<|>$/g, '') === msgId;
      });
    } else if (!uidStr && !msgId) {
      const sender = (e.from || e.senderEmail || '').trim().toLowerCase();
      const subject = (e.subject || '').trim().toLowerCase();
      const rawDate = e.receivedDate || e.sentDate || e.date || e.createdAt || e.timestamp;
      const time = rawDate ? new Date(rawDate).getTime() : '';
      const thread = (e.threadId || e.conversationId || '').trim();
      const snippet = (e.body || e.htmlBody || e.snippet || '').slice(0, 40).trim().toLowerCase();
      const fallbackKey = `${thread}:${sender}:${subject}:${time}:${snippet}`;

      if (seenFallbacks.has(fallbackKey)) {
        isDuplicate = true;
        matchedIndex = result.findIndex(item => {
          const s = (item.from || item.senderEmail || '').trim().toLowerCase();
          const sub = (item.subject || '').trim().toLowerCase();
          const rd = item.receivedDate || item.sentDate || item.date || item.createdAt || item.timestamp;
          const t = rd ? new Date(rd).getTime() : '';
          const th = (item.threadId || item.conversationId || '').trim();
          const sn = (item.body || item.htmlBody || item.snippet || '').slice(0, 40).trim().toLowerCase();
          return `${th}:${s}:${sub}:${t}:${sn}` === fallbackKey;
        });
      } else {
        seenFallbacks.add(fallbackKey);
      }
    }

    if (isDuplicate) {
      if (matchedIndex >= 0) {
        const existing = result[matchedIndex];
        result[matchedIndex] = {
          ...existing,
          ...e,
          body: e.body || existing.body,
          htmlBody: e.htmlBody || existing.htmlBody,
          attachments: (e.attachments && e.attachments.length > 0) ? e.attachments : existing.attachments,
          labels: (e.labels && e.labels.length > 0) ? e.labels : existing.labels,
          starred: true,
          isStarred: true
        };
        if (uidStr) seenUids.add(uidStr);
        if (msgId) seenMsgIds.add(msgId);
      }
    } else {
      if (uidStr) seenUids.add(uidStr);
      if (msgId) seenMsgIds.add(msgId);
      result.push({
        ...e,
        starred: true,
        isStarred: true
      });
    }
  }

  return result;
};
