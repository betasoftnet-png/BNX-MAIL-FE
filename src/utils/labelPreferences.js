// Utility for managing label and category visibility preferences across BNXmail

const CUSTOM_LABEL_PREFS_KEY = 'bnx_custom_label_prefs';
const CATEGORY_PREFS_KEY = 'bnx_category_prefs';
const IMAP_PREFS_KEY = 'bnx_imap_prefs';

const getActiveEmail = () =>
  typeof window !== 'undefined' ? localStorage.getItem('bnx_active_email') : null;

export const readStoredCustomLabelPrefs = () => {
  try {
    if (typeof window === 'undefined') return {};
    const activeEmail = getActiveEmail();
    const userKey = activeEmail ? `${CUSTOM_LABEL_PREFS_KEY}_${activeEmail}` : null;
    const raw = (userKey && localStorage.getItem(userKey)) || localStorage.getItem(CUSTOM_LABEL_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
};

const writeStoredCustomLabelPrefs = (newPrefsMap, detailPayload = null) => {
  if (!newPrefsMap || typeof newPrefsMap !== 'object' || typeof window === 'undefined') return;
  const json = JSON.stringify(newPrefsMap);
  localStorage.setItem(CUSTOM_LABEL_PREFS_KEY, json);
  const activeEmail = getActiveEmail();
  if (activeEmail) {
    localStorage.setItem(`${CUSTOM_LABEL_PREFS_KEY}_${activeEmail}`, json);
  }
  const detail =
    detailPayload && typeof detailPayload === 'object'
      ? { customPrefs: newPrefsMap, ...detailPayload }
      : { customPrefs: newPrefsMap };
  window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail }));
};

/**
 * Returns visibility settings for a label by ID.
 * Defaults to { showInLabelList: true, showInMessageList: true }
 */
export const getCustomLabelVisibility = (labelOrId, _fallbackName = null, customPrefsObj = null) => {
  if (labelOrId === undefined || labelOrId === null) {
    return { showInLabelList: true, showInMessageList: true };
  }
  const hasExplicitId =
    typeof labelOrId === 'object' &&
    labelOrId !== null &&
    labelOrId.id !== undefined &&
    labelOrId.id !== null;
  const lookupKey = hasExplicitId
    ? String(labelOrId.id)
    : (typeof labelOrId === 'object' && labelOrId !== null ? String(labelOrId.name ?? '') : String(labelOrId));

  if (!lookupKey) {
    return { showInLabelList: true, showInMessageList: true };
  }

  try {
    const prefs =
      customPrefsObj && typeof customPrefsObj === 'object'
        ? customPrefsObj
        : readStoredCustomLabelPrefs();
    const item = prefs[lookupKey];
    if (typeof item === 'boolean') {
      return { showInLabelList: item, showInMessageList: true };
    }
    return {
      showInLabelList: item?.showInLabelList !== false,
      showInMessageList: item?.showInMessageList !== false
    };
  } catch (e) {
    return { showInLabelList: true, showInMessageList: true };
  }
};

/**
 * Updates visibility settings for a custom label and dispatches sync event.
 */
export const setCustomLabelVisibility = (labelId, updates) => {
  if (!labelId && labelId !== 0) return;
  const strId = String(labelId);
  try {
    const prefs = { ...readStoredCustomLabelPrefs() };
    const current = prefs[strId] || { showInLabelList: true, showInMessageList: true };
    prefs[strId] = {
      ...current,
      ...updates
    };
    writeStoredCustomLabelPrefs(prefs, { labelId: strId, ...updates });
  } catch (e) {
    console.error('Failed to save custom label visibility:', e);
  }
};

/**
 * Bulk updates visibility settings for all custom labels and dispatches sync event.
 */
export const setAllCustomLabelVisibility = (newPrefsMap) => {
  if (!newPrefsMap || typeof newPrefsMap !== 'object') return;
  try {
    writeStoredCustomLabelPrefs(newPrefsMap, newPrefsMap);
  } catch (e) {
    console.error('Failed to bulk save custom label visibility:', e);
  }
};

/**
 * Removes stored visibility settings for a deleted label ID.
 */
export const removeCustomLabelVisibility = (labelId) => {
  if (!labelId && labelId !== 0) return;
  const strId = String(labelId);
  try {
    const prefs = { ...readStoredCustomLabelPrefs() };
    if (Object.prototype.hasOwnProperty.call(prefs, strId)) {
      delete prefs[strId];
      writeStoredCustomLabelPrefs(prefs, { deletedLabelId: strId });
    }
  } catch (e) {
    console.error('Failed to remove deleted label visibility:', e);
  }
};

/**
 * Check if a custom label is visible in the sidebar
 */
export const isLabelVisibleInSidebar = (labelOrId, fallbackName = null, customPrefsObj = null) => {
  return getCustomLabelVisibility(labelOrId, fallbackName, customPrefsObj).showInLabelList !== false;
};

/**
 * Check if a custom label is visible on email badges in the message list
 */
export const isLabelVisibleInMessageList = (labelOrId, fallbackName = null) => {
  return getCustomLabelVisibility(labelOrId, fallbackName).showInMessageList !== false;
};

/**
 * Default Category visibility preferences
 */
export const DEFAULT_CATEGORY_PREFS = {
  Purchases: { showInLabelList: true, showInMessageList: true },
  Social: { showInLabelList: true, showInMessageList: true },
  Updates: { showInLabelList: true, showInMessageList: true },
  Forums: { showInLabelList: true, showInMessageList: true },
  Promotions: { showInLabelList: true, showInMessageList: true }
};

/**
 * Get category visibility preferences
 */
export const getCategoryPreferences = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CATEGORY_PREFS_KEY) : null;
    const saved = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_CATEGORY_PREFS,
      ...saved
    };
  } catch (e) {
    return DEFAULT_CATEGORY_PREFS;
  }
};

/**
 * Update category visibility preferences
 */
export const setCategoryPreference = (categoryName, updates) => {
  if (!categoryName) return;
  try {
    const current = getCategoryPreferences();
    const updated = {
      ...current,
      [categoryName]: {
        ...(current[categoryName] || { showInLabelList: true, showInMessageList: true }),
        ...updates
      }
    };
    localStorage.setItem(CATEGORY_PREFS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { category: categoryName, ...updates } }));
    }
  } catch (e) {
    console.error('Failed to save category preference:', e);
  }
};

/**
 * Bulk updates category visibility preferences and dispatches sync event.
 */
export const setAllCategoryPreferences = (newPrefsMap) => {
  if (!newPrefsMap || typeof newPrefsMap !== 'object') return;
  try {
    localStorage.setItem(CATEGORY_PREFS_KEY, JSON.stringify(newPrefsMap));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: newPrefsMap }));
    }
  } catch (e) {
    console.error('Failed to bulk save category preferences:', e);
  }
};

/**
 * Default IMAP preferences for System labels
 */
export const DEFAULT_IMAP_PREFS = {
  Inbox: true,
  Starred: true,
  Snoozed: true,
  Important: true,
  Sent: true,
  Scheduled: true,
  Drafts: true,
  "All Mail": true,
  Spam: true,
  Trash: true
};

/**
 * Get IMAP preferences
 */
export const getImapPreferences = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(IMAP_PREFS_KEY) : null;
    const saved = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_IMAP_PREFS,
      ...saved
    };
  } catch (e) {
    return DEFAULT_IMAP_PREFS;
  }
};

/**
 * Update IMAP preference for a system label
 */
export const setImapPreference = (labelName, isEnabled) => {
  if (!labelName) return;
  try {
    const current = getImapPreferences();
    const updated = {
      ...current,
      [labelName]: Boolean(isEnabled)
    };
    localStorage.setItem(IMAP_PREFS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { imap: labelName, isEnabled } }));
    }
  } catch (e) {
    console.error('Failed to save IMAP preference:', e);
  }
};

/**
 * Bulk updates IMAP preferences and dispatches sync event.
 */
export const setAllImapPreferences = (newPrefsMap) => {
  if (!newPrefsMap || typeof newPrefsMap !== 'object') return;
  try {
    localStorage.setItem(IMAP_PREFS_KEY, JSON.stringify(newPrefsMap));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: newPrefsMap }));
    }
  } catch (e) {
    console.error('Failed to bulk save IMAP preferences:', e);
  }
};

/**
 * Returns saved sidebar preferences directly from localStorage
 */
export const getStoredSidebarPreferences = () => {
  try {
    if (typeof window !== 'undefined') {
      const activeEmail = localStorage.getItem("bnx_active_email");
      const userKey = activeEmail ? `bnx_sidebar_prefs_${activeEmail}` : null;
      const raw = (userKey && localStorage.getItem(userKey)) || localStorage.getItem('bnx_sidebar_prefs');
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Folder / sidebar navigation names that must never be used as substitutes
 * for actual label records in the "Label as..." dropdown.
 */
export const FOLDER_AND_NAV_NAMES = new Set([
  'inbox',
  'starred',
  'snoozed',
  'important',
  'sent',
  'scheduled',
  'draft',
  'drafts',
  'all mail',
  'allmail',
  'spam',
  'trash',
  'deleted'
]);

// Kept as alias for backwards-compatible imports if needed
export const SYSTEM_LABEL_NAMES = FOLDER_AND_NAV_NAMES;

const NON_LABEL_TYPES = new Set([
  'FOLDER',
  'MAILBOX',
  'NAV',
  'NAVIGATION',
  'SIDEBAR',
  'CATEGORY'
]);

/**
 * Normalizes a label record's type ('SYSTEM', 'CUSTOM', etc.).
 */
export const normalizeLabelType = (lbl) => {
  if (!lbl || typeof lbl !== 'object') return 'CUSTOM';
  const rawType = typeof lbl.type === 'string'
    ? lbl.type
    : (typeof lbl.labelType === 'string' ? lbl.labelType : '');
  const trimmed = rawType.trim().toUpperCase();
  if (trimmed) return trimmed;
  return lbl.isSystem === true ? 'SYSTEM' : 'CUSTOM';
};

/**
 * Validates that a candidate label is an actual, existing, non-deleted, non-folder label record.
 */
export const isValidLabelRecord = (lbl) => {
  if (!lbl || typeof lbl !== 'object' || Array.isArray(lbl)) return false;

  if (lbl.id === undefined || lbl.id === null || String(lbl.id).trim() === '') {
    return false;
  }
  if (typeof lbl.name !== 'string' || lbl.name.trim() === '') {
    return false;
  }

  // Exclude deleted or inactive label records
  if (
    lbl.deleted === true ||
    lbl.isDeleted === true ||
    lbl.is_deleted === true ||
    lbl.active === false ||
    lbl.isActive === false ||
    (typeof lbl.status === 'string' && lbl.status.trim().toUpperCase() === 'DELETED')
  ) {
    return false;
  }

  // Exclude folder / sidebar / navigation substitutes
  const labelType = normalizeLabelType(lbl);
  if (
    lbl.isFolder === true ||
    lbl.isNav === true ||
    lbl.isSidebar === true ||
    lbl.isSidebarItem === true ||
    Boolean(lbl.prefKey) ||
    NON_LABEL_TYPES.has(labelType)
  ) {
    return false;
  }

  // Reject folder/nav names masquerading as label IDs
  const idLower = String(lbl.id).trim().toLowerCase();
  if (FOLDER_AND_NAV_NAMES.has(idLower)) {
    return false;
  }

  // Reject hidden system labels and system-typed folder substitutes
  const isSystemLabel = lbl.isSystem === true || labelType === 'SYSTEM';
  if (isSystemLabel) {
    const nameLower = lbl.name.trim().toLowerCase();
    if (FOLDER_AND_NAV_NAMES.has(nameLower)) {
      return false;
    }
    if (
      lbl.hidden === true ||
      lbl.isHidden === true ||
      lbl.visible === false ||
      lbl.isVisible === false
    ) {
      return false;
    }
  }

  // Reject disabled/hidden records
  if (
    lbl.hidden === true ||
    lbl.isHidden === true ||
    lbl.visible === false ||
    lbl.isVisible === false ||
    lbl.enabled === false ||
    lbl.isEnabled === false
  ) {
    return false;
  }

  return true;
};

/**
 * Checks whether a valid label record is enabled in Settings -> Manage Labels ("Show in label list").
 * Filters strictly by label ID and record flags — never mixes sidebar navigation preferences.
 */
export const isLabelShownInLabelList = (lbl, customLabelPreferences = null, legacyCustomPrefs = null) => {
  if (!isValidLabelRecord(lbl)) return false;

  if (lbl.showInLabelList === false) {
    return false;
  }

  const effectivePrefs =
    legacyCustomPrefs !== null && typeof legacyCustomPrefs === 'object'
      ? legacyCustomPrefs
      : (customLabelPreferences && typeof customLabelPreferences === 'object'
          ? customLabelPreferences
          : readStoredCustomLabelPrefs());

  const idKey = String(lbl.id).trim();
  const entry = effectivePrefs[idKey];

  if (entry !== undefined) {
    if (typeof entry === 'boolean') return entry;
    if (typeof entry === 'object' && entry !== null) {
      return entry.showInLabelList !== false;
    }
  }

  return true;
};

/**
 * Returns valid, enabled, deduplicated labels for all "Label as..." dropdowns.
 * Reads strictly from actual label records and filters using ID, type, and Manage Labels visibility.
 */
export const getAvailableLabelAsOptions = (labels = [], customLabelPreferences = null, legacyCustomPrefs = null) => {
  if (!Array.isArray(labels) || labels.length === 0) return [];

  const effectivePrefs =
    legacyCustomPrefs !== null && typeof legacyCustomPrefs === 'object'
      ? legacyCustomPrefs
      : (customLabelPreferences && typeof customLabelPreferences === 'object'
          ? customLabelPreferences
          : readStoredCustomLabelPrefs());

  const seenIds = new Set();
  const seenNameType = new Set();
  const result = [];

  for (const lbl of labels) {
    if (!isLabelShownInLabelList(lbl, effectivePrefs)) continue;

    const idKey = String(lbl.id).trim();
    const labelType = normalizeLabelType(lbl);
    const cleanName = lbl.name.trim();
    const parentKey = lbl.parentId !== undefined && lbl.parentId !== null ? String(lbl.parentId).trim() : '';
    const nameTypeKey = `${labelType}:${parentKey}:${cleanName.toLowerCase()}`;

    if (seenIds.has(idKey) || seenNameType.has(nameTypeKey)) continue;

    seenIds.add(idKey);
    seenNameType.add(nameTypeKey);
    result.push({
      ...lbl,
      name: cleanName,
      type: labelType,
      isSystem: Boolean(lbl.isSystem === true || labelType === 'SYSTEM')
    });
  }

  return result;
};

const SYSTEM_EMAIL_LABELS_KEY = 'bnx_system_email_labels';

export const getStoredSystemEmailLabels = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SYSTEM_EMAIL_LABELS_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const removeAppliedSystemLabel = (uid, labelIdOrName) => {
  if (!uid || !labelIdOrName) return;
  try {
    const map = getStoredSystemEmailLabels();
    const strUid = String(uid);
    const existing = map[strUid] || [];
    const target = String(labelIdOrName);
    map[strUid] = existing.filter((l) => String(l.id) !== target && l.name !== target);
    localStorage.setItem(SYSTEM_EMAIL_LABELS_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { type: 'system-label-removed', uid: strUid } }));
    }
  } catch (e) {}
};


