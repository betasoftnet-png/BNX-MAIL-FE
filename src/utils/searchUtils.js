import { getEmailPreviewSnippet } from './htmlUtils';

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
  if (!str) {
    const fb = fallbackEmail || '';
    return { name: fb.split('@')[0] || 'Unknown', email: fb };
  }

  const trimmed = String(str).trim();
  if (trimmed.includes('<')) {
    const match = trimmed.match(/^(.*?)\s*<([^>]+)>/);
    if (match) {
      const namePart = match[1].replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const emailPart = match[2].trim();
      return {
        name: namePart || emailPart.split('@')[0] || 'Unknown',
        email: emailPart || fallbackEmail
      };
    }
  }

  if (trimmed.includes('@')) {
    return {
      name: trimmed.split('@')[0],
      email: trimmed
    };
  }

  return {
    name: trimmed,
    email: fallbackEmail || ''
  };
};

/**
 * Formats a timestamp into a readable date for search results (e.g. "Today 10:30 AM" or "Oct 28").
 */
export const formatSuggestionDate = (rawDate) => {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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
    email.starred === true || email.isStarred === true
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
      // Inbox must not be in trash, spam, draft, snoozed, or archived
      if (isTrash || isSpam || isDraft || isSnoozed || isArchived) return false;
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
 * Searches against relevant email fields:
 * - Sender Name & Email
 * - Recipient Name & Email
 * - Subject
 * - Clean message content preview (plain text snippet, preventing raw HTML/style tag false positives)
 */
export const matchesEmailQuery = (email, query) => {
  if (!email || !query) return false;
  const q = String(query).trim().toLowerCase();
  if (!q) return false;

  // 1. Subject
  const subjectStr = (email.subject || '').toLowerCase();
  if (subjectStr.includes(q)) return true;

  // 2. Sender fields
  const fromStr = (email.from || '').toLowerCase();
  const senderEmailStr = (email.senderEmail || '').toLowerCase();
  if (fromStr.includes(q) || senderEmailStr.includes(q)) return true;

  // 3. Recipient fields
  const toStr = (email.to || '').toLowerCase();
  const recipientEmailStr = (email.recipientEmail || '').toLowerCase();
  const ccStr = (email.cc || '').toLowerCase();
  const bccStr = (email.bcc || '').toLowerCase();
  if (toStr.includes(q) || recipientEmailStr.includes(q) || ccStr.includes(q) || bccStr.includes(q)) {
    return true;
  }

  // 4. Message Content (clean plain text snippet, NOT raw HTML tags/CSS markup)
  const textPlainStr = (email.textPlain || '').toLowerCase();
  if (textPlainStr.includes(q)) return true;

  const snippetStr = getEmailPreviewSnippet(email).toLowerCase();
  if (snippetStr.includes(q)) return true;

  return false;
};
