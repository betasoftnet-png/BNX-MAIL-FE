/**
 * Utility for deduplicating emails in the BNXmail All Mail page.
 */

/**
 * Normalizes a message ID by trimming, lowercasing, and stripping surrounding angle brackets.
 */
export const normalizeMessageId = (mid) => {
  if (!mid || typeof mid !== 'string') return '';
  return mid.trim().toLowerCase().replace(/^<|>$/g, '');
};

/**
 * Deduplicates a list of emails for the All Mail view.
 * 
 * Requirements satisfied:
 * 1. Identifies duplicates using unique email Message-ID (RFC 5322) and unique UID / ID.
 * 2. Displays only one entry for each unique email.
 * 3. Strictly preserves different emails from the same sender (never treats them as duplicates).
 * 4. Strictly preserves different messages with the same subject or message content.
 * 5. Preserves complete email record details (sender, recipient, subject, preview, dates,
 *    read/unread status, star status, attachments, body).
 */
export const deduplicateAllMailEmails = (emailsList) => {
  if (!Array.isArray(emailsList) || emailsList.length === 0) return [];

  const seenMessageIds = new Map(); // mid -> index in result
  const seenFolderUids = new Map(); // `${normFolder}_${uid}` -> index in result
  const seenUids = new Map();       // uid -> index in result (for cross-folder matches like inbox & snoozed)
  const seenIdentities = new Map(); // exact signature -> index in result
  const result = [];

  for (const email of emailsList) {
    if (!email) continue;

    // Filter out trash and spam if present
    const folder = (email.folderName || '').toLowerCase();
    if (folder === 'trash' || folder === 'deleted' || email.isTrash || email.deleted || email.isDeleted) continue;
    if (folder === 'spam' || email.isSpam || email.spam) continue;

    const rawMid = email.messageId || email.msgId;
    const mid = normalizeMessageId(rawMid);

    const rawUid = email.uid ?? email.id;
    const uidStr = (rawUid !== undefined && rawUid !== null && String(rawUid).trim() !== '')
      ? String(rawUid).trim()
      : '';

    const origUid = (email.originalUid !== undefined && email.originalUid !== null && String(email.originalUid).trim() !== '')
      ? String(email.originalUid).trim()
      : '';

    const normFolder = folder.replace(/[^a-z0-9]/g, '');

    let isDuplicate = false;
    let matchedIndex = -1;

    // 1. Primary check: Normalized Message-ID (canonical RFC 5322 identifier)
    if (mid) {
      if (seenMessageIds.has(mid)) {
        isDuplicate = true;
        matchedIndex = seenMessageIds.get(mid);
      }
    }

    // 2. Secondary check: UID within the same folder
    if (!isDuplicate && uidStr && normFolder) {
      const folderUidKey = `${normFolder}_${uidStr}`;
      if (seenFolderUids.has(folderUidKey)) {
        isDuplicate = true;
        matchedIndex = seenFolderUids.get(folderUidKey);
      }
    }

    // 3. Cross-folder check: Snoozed / Original UID matching
    // (A snoozed email originates from Inbox or Archive and carries originalUid or the same UID)
    if (!isDuplicate) {
      const targetUid = origUid || uidStr;
      if (targetUid) {
        if (folder === 'snoozed' && seenUids.has(targetUid)) {
          isDuplicate = true;
          matchedIndex = seenUids.get(targetUid);
        } else if (seenUids.has(targetUid)) {
          const existing = result[seenUids.get(targetUid)];
          const existingFolder = (existing?.folderName || '').toLowerCase();
          if (existingFolder === 'snoozed' || folder === 'snoozed') {
            isDuplicate = true;
            matchedIndex = seenUids.get(targetUid);
          }
        }
      }
    }

    // 4. Fallback check: When neither Message-ID nor UID matched, check EXACT email identity:
    // MUST have identical sender, recipient, subject, exact timestamp, and snippet.
    // This strictly prevents different messages from the same sender or with the same subject from being merged.
    if (!isDuplicate && !mid && !uidStr) {
      const sender = (email.from || email.senderEmail || '').trim().toLowerCase();
      const recipient = (email.to || email.recipientEmail || '').trim().toLowerCase();
      const subject = (email.subject || '').trim().toLowerCase();
      const rawDate = email.receivedDate || email.sentDate || email.date || email.createdAt || email.timestamp;
      const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
      const snippet = (email.body || email.htmlBody || email.snippet || '').slice(0, 50).trim().toLowerCase();

      if (timestamp && (subject || snippet)) {
        const identityKey = `${sender}__${recipient}__${subject}__${timestamp}__${snippet}`;
        if (seenIdentities.has(identityKey)) {
          isDuplicate = true;
          matchedIndex = seenIdentities.get(identityKey);
        } else {
          seenIdentities.set(identityKey, result.length);
        }
      }
    }

    if (isDuplicate && matchedIndex >= 0 && matchedIndex < result.length) {
      const existing = result[matchedIndex];

      // Merge records preserving richer data and accurate flags
      const isRead = Boolean(existing.isRead || existing.read || email.isRead || email.read);
      const isStarred = Boolean(existing.starred || existing.isStarred || email.starred || email.isStarred);
      const hasAttachments = Boolean(existing.hasAttachments || email.hasAttachments || (existing.attachments?.length > 0) || (email.attachments?.length > 0));

      result[matchedIndex] = {
        ...existing,
        ...email,
        body: email.body || existing.body,
        htmlBody: email.htmlBody || existing.htmlBody,
        attachments: (email.attachments && email.attachments.length > 0) ? email.attachments : existing.attachments,
        labels: (email.labels && email.labels.length > 0) ? email.labels : existing.labels,
        hasAttachments,
        isRead,
        read: isRead,
        starred: isStarred,
        isStarred: isStarred,
        isSnoozed: Boolean(existing.isSnoozed || email.isSnoozed),
        wakeUpAt: existing.wakeUpAt || email.wakeUpAt,
        snoozedUntil: existing.snoozedUntil || email.snoozedUntil,
      };

      if (mid) seenMessageIds.set(mid, matchedIndex);
      if (uidStr) {
        if (normFolder) seenFolderUids.set(`${normFolder}_${uidStr}`, matchedIndex);
        seenUids.set(uidStr, matchedIndex);
      }
      if (origUid) seenUids.set(origUid, matchedIndex);
    } else {
      const nextIndex = result.length;
      if (mid) seenMessageIds.set(mid, nextIndex);
      if (uidStr) {
        if (normFolder) seenFolderUids.set(`${normFolder}_${uidStr}`, nextIndex);
        seenUids.set(uidStr, nextIndex);
      }
      if (origUid) seenUids.set(origUid, nextIndex);

      result.push(email);
    }
  }

  return result;
};
