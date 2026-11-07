/**
 * Account and sub-account utilities for BNXmail.
 * Manages account type identification (Personal vs Business),
 * sub-account relationships, hierarchy/permissions, and All Inbox access.
 */

/**
 * Checks whether an account profile represents a Business Account.
 * Never relies on hardcoded emails or domain substring matches.
 */
export const isBusinessAccount = (user) => {
  if (!user) return false;

  // 1. Explicit accountType identification from backend DTO
  const accountType = String(user.accountType || '').trim().toUpperCase();
  if (accountType === 'BUSINESS') return true;
  if (accountType === 'PERSONAL' || accountType === 'PUBLIC' || accountType === 'CHILD') {
    return false;
  }

  // 2. Role-based check
  const role = String(user.role || '').trim().toUpperCase();
  if (role.startsWith('BUSINESS') || role === 'ORGANIZATION_ADMIN') {
    return true;
  }

  // 3. Explicit boolean flag
  if (user.isBusiness === true) {
    return true;
  }

  // 4. Organization or business profile linkage
  if (user.organizationId || (user.organization && typeof user.organization === 'object')) {
    return true;
  }
  if (user.businessName || user.businessType) {
    return true;
  }

  return false;
};

/**
 * Checks whether an account is a Personal Account.
 */
export const isPersonalAccount = (user) => {
  return !isBusinessAccount(user);
};

/**
 * Checks whether an account is a sub-account of a business account.
 */
export const isBusinessSubAccount = (user) => {
  if (!isBusinessAccount(user)) return false;

  if (user.isSubId === true) return true;
  if (user.parentUserId || user.parentId) return true;

  const role = String(user.role || '').trim().toUpperCase();
  if (role === 'BUSINESS_USER' && user.isPrimary === false) return true;

  return false;
};

/**
 * Checks whether an account is the main / primary business account.
 */
export const isBusinessMainAccount = (user) => {
  if (!isBusinessAccount(user)) return false;
  return !isBusinessSubAccount(user);
};

/**
 * Determines if the currently authenticated user is authorized to access All Inbox.
 * - Personal Account: Hidden (false)
 * - Business Main Account: Visible (true)
 * - Business Sub-account: Follows existing account permissions and hierarchy
 */
export const canAccessAllInbox = (user) => {
  if (!user) return false;

  // 1. Personal accounts NEVER have access to All Inbox
  if (!isBusinessAccount(user)) {
    return false;
  }

  // 2. Business Sub-accounts follow permissions and hierarchy
  if (isBusinessSubAccount(user)) {
    // Check explicit override if set
    if (user.canAccessAllInbox !== undefined) {
      return Boolean(user.canAccessAllInbox);
    }

    // Check role hierarchy (e.g. delegated business admin role)
    const role = String(user.role || '').trim().toUpperCase();
    if (role.includes('ADMIN') || role === 'ORGANIZATION_ADMIN') {
      return true;
    }

    // Check specific permissions array from backend
    if (Array.isArray(user.permissions)) {
      const hasPerm = user.permissions.some(p => {
        const str = String(p).toUpperCase();
        return str === 'ALL_INBOX' || str === 'ALLINBOX' || str === '1';
      });
      if (hasPerm) return true;
    }

    // If sub-account has multiple authorized mailboxes assigned
    if (Array.isArray(user.mailboxes) && user.mailboxes.length > 1) {
      return true;
    }

    // By default, standard sub-accounts only see their own assigned Inbox
    return false;
  }

  // 3. Business Main Account: Always has All Inbox visible
  return true;
};

/**
 * Resolves all authorized email addresses belonging to the current business account
 * and its associated sub-accounts/mailboxes.
 * Strictly excludes unrelated personal accounts and different business accounts.
 */
export const getAssociatedBusinessEmails = (currentUser, sessions = {}) => {
  if (!currentUser || !isBusinessAccount(currentUser)) return [];

  const mainEmail = (currentUser.email || '').toLowerCase().trim();
  const associated = new Set();
  if (mainEmail) associated.add(mainEmail);

  // 1. Include mailboxes assigned to this user profile
  if (Array.isArray(currentUser.mailboxes)) {
    currentUser.mailboxes.forEach(m => {
      const mEmail = (m?.email || '').toLowerCase().trim();
      if (mEmail) associated.add(mEmail);
    });
  }

  // 2. Match authorized sub-accounts / associated business accounts from active sessions
  Object.keys(sessions || {}).forEach(sessEmail => {
    const sEmail = (sessEmail || '').toLowerCase().trim();
    if (!sEmail || sEmail === mainEmail) return;

    const sess = sessions[sessEmail];
    const profile = sess?.userProfile;
    if (!profile) return;

    // Strictly ignore personal accounts
    if (!isBusinessAccount(profile)) return;

    // A) Is this email explicitly listed in currentUser's mailboxes?
    const isInMailboxes = Array.isArray(currentUser.mailboxes) &&
      currentUser.mailboxes.some(m => (m?.email || '').toLowerCase().trim() === sEmail);

    // B) Does it share the exact same organization?
    const currentOrgId = currentUser.organizationId || currentUser.organization?.id;
    const sessOrgId = profile.organizationId || profile.organization?.id;
    const isSameOrg = Boolean(currentOrgId && sessOrgId && String(currentOrgId) === String(sessOrgId));

    // C) Parent-child hierarchy (business main account to sub-account or vice versa)
    const currentUserId = currentUser.userId || currentUser.id;
    const sessUserId = profile.userId || profile.id;

    const isChild = Boolean(
      currentUserId && (
        String(profile.parentUserId) === String(currentUserId) ||
        String(profile.parentId) === String(currentUserId)
      )
    );
    const isParent = Boolean(
      sessUserId && (
        String(currentUser.parentUserId) === String(sessUserId) ||
        String(currentUser.parentId) === String(sessUserId)
      )
    );

    // D) Sub-account has current user's email in its mailboxes list
    const hasReverseMailbox = Array.isArray(profile.mailboxes) &&
      profile.mailboxes.some(m => (m?.email || '').toLowerCase().trim() === mainEmail);

    if (isInMailboxes || isSameOrg || isChild || isParent || hasReverseMailbox) {
      associated.add(sEmail);
    }
  });

  return Array.from(associated);
};

/**
 * Deduplicates emails in All Inbox to prevent duplicates across multiple accounts/mailboxes.
 */
export const deduplicateAllInboxEmails = (emails = []) => {
  if (!Array.isArray(emails)) return [];
  const result = [];
  const seenKeys = new Set();
  const seenMsgIds = new Set();

  for (const email of emails) {
    if (!email) continue;
    const msgId = email.messageId ? String(email.messageId).trim() : '';
    const uidStr = String(email.uid ?? email.id ?? '');
    const acc = email.accountEmail ? String(email.accountEmail).toLowerCase().trim() : '';
    const scopedKey = uidStr ? `${acc}_${uidStr}` : '';

    if (msgId && seenMsgIds.has(msgId)) {
      continue;
    }
    if (scopedKey && seenKeys.has(scopedKey)) {
      continue;
    }

    if (msgId) seenMsgIds.add(msgId);
    if (scopedKey) seenKeys.add(scopedKey);
    result.push(email);
  }

  return result;
};

