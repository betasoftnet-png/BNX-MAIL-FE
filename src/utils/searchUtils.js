import { getEmailPreviewSnippet } from './htmlUtils';
import { isEmailIdStarred } from './starredStorage';

/**
 * Normalizes an email address or string for case-insensitive comparison.
 */
export const normalizeEmail = (val) => {
  if (!val) return '';
  return String(val).trim().toLowerCase();
};

/**
 * Extracts a clean person name and email address from a string (e.g., "John Doe <john@example.com>").
 */
export const parsePersonAndEmail = (str, fallbackEmail = '') => {
  const fb = String(fallbackEmail || '').trim();
  if (!str) {
    if (!fb) return { name: 'Unknown', email: '' };
    return { name: fb.split('@')[0] || 'Unknown', email: fb };
  }

  let trimmed = String(str).trim();

  // Strip MIME encapsulation if present
  try {
    if (trimmed.includes('=?') && trimmed.includes('?=')) {
      trimmed = trimmed.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (match, charset, encoding, data) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            return atob(data);
          } else if (encoding.toUpperCase() === 'Q') {
            return decodeURIComponent(data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'));
          }
        } catch (e) {
          return match;
        }
        return match;
      });
    }
  } catch (e) {}

  // Case 1: "Sender Name" <email@domain.com>
  if (trimmed.includes('<')) {
    const match = trimmed.match(/^(.*?)\s*<([^>]+)>/);
    if (match) {
      let namePart = match[1].replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const emailPart = match[2].trim();
      if (!namePart || namePart === emailPart) {
        namePart = emailPart.split('@')[0] || 'Unknown';
      }
      return {
        name: namePart,
        email: emailPart || fb
      };
    }
  }

  // Case 2: Raw email address "user@domain.com"
  if (trimmed.includes('@')) {
    return {
      name: trimmed.split('@')[0] || trimmed,
      email: trimmed
    };
  }

  // Case 3: Display Name only
  return {
    name: trimmed || (fb ? fb.split('@')[0] : 'Unknown'),
    email: fb
  };
};

/**
 * Resolves the accurate sender display name and email address for an email record.
 */
export const getSenderDetails = (email, activeFolder = 'inbox') => {
  if (!email) return { name: 'Unknown', email: '' };

  const isSent = (activeFolder || '').toLowerCase() === 'sent';

  if (isSent) {
    const recipientRaw = email.to || email.recipientEmail || email.recipient || '';
    const parsed = parsePersonAndEmail(recipientRaw, email.recipientEmail || email.to || '');
    return {
      name: parsed.name || 'Recipient',
      email: parsed.email || ''
    };
  }

  // For all other folders (Inbox, Starred, Draft, Trash, Snoozed, Archive, etc.)
  const fromRaw = email.from || email.sender || email.senderName || email.fromName || email.senderEmail || '';
  const parsed = parsePersonAndEmail(fromRaw, email.senderEmail || email.from || '');

  return {
    name: parsed.name || 'Unknown',
    email: parsed.email || ''
  };
};

/**
 * Formats a timestamp into readable date (e.g. "24 Oct", "Today 10:30 AM").
 */
export const formatSuggestionDate = (rawDate) => {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });

  if (d.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }

  return `${day} ${month} ${d.getFullYear()}`;
};

/**
 * Resolves the active folder key from current browser pathname.
 */
export const getActiveFolderFromPath = (pathname) => {
  if (!pathname || pathname === '/' || pathname === '/inbox') return 'inbox';
  if (pathname === '/all-inbox') return 'all-inbox';
  if (pathname === '/starred') return 'starred';
  if (pathname === '/snoozed') return 'snoozed';
  if (pathname === '/sent') return 'sent';
  if (pathname === '/draft') return 'draft';
  if (pathname === '/trash') return 'trash';
  if (pathname === '/archive') return 'archive';
  if (pathname === '/spam') return 'spam';
  if (pathname === '/unread') return 'unread';
  if (pathname === '/scheduled') return 'scheduled';
  if (pathname === '/outbox') return 'outbox';
  if (pathname === '/all-mail' || pathname === '/allmail') return 'allmail';
  if (pathname.startsWith('/label/')) {
    const labelId = pathname.replace('/label/', '').trim();
    return `label-${labelId}`;
  }
  if (pathname.startsWith('/casbox')) return 'casbox';
  if (pathname.startsWith('/colab') || pathname.startsWith('/chat')) return 'chat';
  return 'inbox';
};

/**
 * Returns human-readable label for the currently active folder.
 */
export const getFolderDisplayName = (folderKey, labels = []) => {
  switch ((folderKey || '').toLowerCase()) {
    case 'inbox': return 'Inbox';
    case 'all-inbox': return 'All Inbox';
    case 'starred': return 'Starred';
    case 'snoozed': return 'Snoozed';
    case 'sent': return 'Sent';
    case 'draft':
    case 'drafts': return 'Drafts';
    case 'trash': return 'Trash';
    case 'archive': return 'Archive';
    case 'spam': return 'Spam';
    case 'unread': return 'Unread';
    case 'scheduled': return 'Scheduled';
    case 'outbox': return 'Outbox';
    case 'allmail':
    case 'all-mail': return 'All Mail';
    case 'casbox': return 'Casbox';
    case 'chat': return 'Colab Chat';
    default:
      if (folderKey && folderKey.startsWith('label-')) {
        const id = folderKey.replace('label-', '');
        const lbl = labels.find(l => String(l.id) === String(id));
        return lbl ? `Label: ${lbl.name}` : 'Labeled Mail';
      }
      return 'Inbox';
  }
};

/**
 * Validates strictly whether an email belongs to the selected folder scope.
 */
export const matchesFolderScope = (email, activeFolder, user) => {
  if (!email) return false;
  const folder = (activeFolder || 'inbox').toLowerCase();

  const isTrash = Boolean(
    email.isTrash || email.isDeleted || email.deleted ||
    email.folderName?.toLowerCase() === 'trash' || email.folderName?.toLowerCase() === 'deleted'
  );
  const isSpam = Boolean(
    email.isSpam || email.spam || email.folderName?.toLowerCase() === 'spam'
  );
  const isDraft = Boolean(
    email.isDraft || email.draft ||
    email.folderName?.toLowerCase() === 'draft' || email.folderName?.toLowerCase() === 'drafts'
  );
  const isStarred = Boolean(
    email.starred === true ||
    email.isStarred === true ||
    isEmailIdStarred(email.uid ?? email.id, user?.email)
  );
  const isSnoozed = Boolean(
    email.snoozedUntil || email.isSnoozed || email.folderName?.toLowerCase() === 'snoozed'
  );
  const isArchived = Boolean(
    email.isArchived || email.archived || email.folderName?.toLowerCase() === 'archive'
  );

  const loginEmail = user?.email ? normalizeEmail(user.email) : '';
  const isSenderMe = loginEmail && (
    normalizeEmail(email.senderEmail).includes(loginEmail) ||
    normalizeEmail(email.from).includes(loginEmail)
  );

  switch (folder) {
    case 'inbox':
    case 'all-inbox':
    case 'allinbox':
      // Inbox must not be in trash, spam, draft, snoozed, archived, or sent
      if (isTrash || isSpam || isDraft || isSnoozed || isArchived) return false;
      if (email.isSent || email.folderName?.toLowerCase() === 'sent') return false;
      return true;

    case 'starred':
      // Starred must have star flag and not be in trash
      return isStarred && !isTrash;

    case 'snoozed':
      // Snoozed must have snooze flag and not be in trash
      return isSnoozed && !isTrash;

    case 'sent':
      // Sent must be marked sent or sent by current user, not trash or draft
      if (isTrash || isDraft) return false;
      return Boolean(email.isSent || email.folderName?.toLowerCase() === 'sent' || isSenderMe);

    case 'draft':
    case 'drafts':
      // Drafts must be draft and not trash
      return isDraft && !isTrash;

    case 'trash':
      // Trash must be trash
      return isTrash;

    case 'archive':
      return isArchived && !isTrash;

    case 'spam':
      return isSpam && !isTrash;

    case 'unread':
      return (!email.isRead && !email.read) && !isTrash && !isDraft && !isSpam;

    case 'scheduled':
      return Boolean(email.sendAt || email.isScheduled || email.scheduledTime);

    case 'allmail':
    case 'all-mail':
      return !isTrash && !isSpam;

    default:
      if (folder.startsWith('label-')) {
        const labelId = folder.replace('label-', '');
        return Boolean(email.labels?.some(l => 
          (typeof l === 'object' ? String(l.id) : String(l)) === String(labelId)
        ));
      }
      return true;
  }
};

/**
 * Searches against relevant email fields accurately:
 * - Sender Name & Email
 * - Recipient Name & Email (distinguishing incoming vs outgoing context)
 * - Subject (full, unclipped match)
 * - Message Content (clean plain text, stripped of HTML/CSS/scripts)
 * 
 * Crucially, when searching in incoming folders (like Inbox), if the query
 * matches the logged-in user's own identity (e.g. "dilli"), it does NOT falsely
 * match every incoming email simply because the user was the recipient.
 */
export const matchesEmailQuery = (email, query, activeFolder = 'inbox', user = null) => {
  if (!email || !query) return false;
  const q = String(query).trim().toLowerCase();
  if (!q) return false;

  const folder = (activeFolder || 'inbox').toLowerCase();
  const userEmail = user?.email ? normalizeEmail(user.email) : '';
  const userLocal = userEmail ? userEmail.split('@')[0] : '';
  const userName = user?.name ? String(user.name).trim().toLowerCase() : '';
  const userFullName = user?.fullName ? String(user.fullName).trim().toLowerCase() : '';

  // Determine if the search query matches the logged-in user's own identity
  const isQueryMyOwnIdentity = Boolean(
    (userLocal && userLocal.includes(q)) ||
    (userEmail && userEmail.includes(q)) ||
    (userName && userName.includes(q)) ||
    (userFullName && userFullName.includes(q))
  );

  // 1. Subject match (always valid in any folder)
  const subjectStr = (email.subject || '').toLowerCase();
  if (subjectStr.includes(q)) return true;

  // 2. Sender fields (from, senderEmail)
  const fromStr = (email.from || '').toLowerCase();
  const senderEmailStr = (email.senderEmail || '').toLowerCase();
  const senderMatches = fromStr.includes(q) || senderEmailStr.includes(q);

  if (folder === 'sent') {
    // In Sent folder, the user is the sender of all emails.
    // Searching user's own name in Sent folder shouldn't match all sent emails.
    if (senderMatches && !isQueryMyOwnIdentity) return true;
  } else {
    // In Inbox, Starred, Drafts, Trash, etc., matching the sender is primary
    if (senderMatches) return true;
  }

  // 3. Recipient fields (to, recipientEmail, cc, bcc)
  const toStr = (email.to || '').toLowerCase();
  const recipientEmailStr = (email.recipientEmail || '').toLowerCase();
  const ccStr = (email.cc || '').toLowerCase();
  const bccStr = (email.bcc || '').toLowerCase();
  const allRecipientsStr = `${toStr} ${recipientEmailStr} ${ccStr} ${bccStr}`;

  if (folder === 'sent' || folder === 'draft' || folder === 'drafts' || folder === 'outbox') {
    // In Sent or Drafts, recipient search is primary
    if (allRecipientsStr.includes(q)) return true;
  } else {
    // In Inbox / Starred / Trash / etc., the logged-in user is the recipient of all incoming emails.
    // If the query is the user's own name/email (e.g. "dilli"), matching the recipient field
    // would falsely match EVERY incoming email.
    if (!isQueryMyOwnIdentity && allRecipientsStr.includes(q)) {
      return true;
    }
    // If multiple recipients exist, check if another recipient (other than user) matches:
    if (isQueryMyOwnIdentity && allRecipientsStr) {
      const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let otherRecipients = allRecipientsStr;
      if (userEmail) otherRecipients = otherRecipients.replace(new RegExp(escapeRegExp(userEmail), 'gi'), '');
      if (userLocal) otherRecipients = otherRecipients.replace(new RegExp(escapeRegExp(userLocal), 'gi'), '');
      if (otherRecipients.includes(q)) return true;
    }
  }

  // 4. Message Content / Body (clean plain text snippet, NOT raw HTML tags/CSS markup)
  // In incoming folders, if the query matches the logged-in user's own identity (e.g. "Dilli"),
  // incoming emails frequently contain automated greetings like "Dear Dilli," or footers.
  // We do NOT match incoming emails merely because the user's own name appears in the body greeting.
  if (!isQueryMyOwnIdentity) {
    const textPlain = (email.textPlain || '').toLowerCase();
    const snippet = getEmailPreviewSnippet(email).toLowerCase();
    if (textPlain.includes(q) || snippet.includes(q)) {
      return true;
    }
  }

  return false;
};
