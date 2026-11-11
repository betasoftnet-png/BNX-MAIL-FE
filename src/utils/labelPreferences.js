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
 * Canonical system label definitions matching Settings -> Manage Labels.
 */
export const SYSTEM_LABEL_DEFINITIONS = [
  { id: "Inbox", name: "Inbox", prefKey: "Inbox", colorHex: "#3b82f6", isSystem: true, type: "SYSTEM" },
  { id: "Starred", name: "Starred", prefKey: "Starred", colorHex: "#f59e0b", isSystem: true, type: "SYSTEM" },
  { id: "Snoozed", name: "Snoozed", prefKey: "Snoozed", colorHex: "#f59e0b", isSystem: true, type: "SYSTEM" },
  { id: "Important", name: "Important", prefKey: "Important", colorHex: "#eab308", isSystem: true, type: "SYSTEM" },
  { id: "Sent", name: "Sent", prefKey: "Sent", colorHex: "#135bec", isSystem: true, type: "SYSTEM" },
  { id: "Scheduled", name: "Scheduled", prefKey: "Scheduled", colorHex: "#06b6d4", isSystem: true, type: "SYSTEM" },
  { id: "Drafts", name: "Drafts", prefKey: "Draft", colorHex: "#64748b", isSystem: true, type: "SYSTEM" },
  { id: "All Mail", name: "All Mail", prefKey: "All Mail", colorHex: "#3b82f6", isSystem: true, type: "SYSTEM" },
  { id: "Spam", name: "Spam", prefKey: "Spam", colorHex: "#ef4444", isSystem: true, type: "SYSTEM" },
  { id: "Trash", name: "Trash", prefKey: "Trash", colorHex: "#ef4444", isSystem: true, type: "SYSTEM" },
];

/**
 * Returns saved Manage Labels system visibility preferences directly from localStorage.
 */
export const getStoredSidebarPreferences = () => {
  try {
    if (typeof window !== 'undefined') {
      const activeEmail = localStorage.getItem("bnx_active_email");
      const userKey = activeEmail ? `bnx_sidebar_prefs_${activeEmail}` : null;
      const lowerKey = activeEmail ? `bnx_sidebar_prefs_${activeEmail.trim().toLowerCase()}` : null;
      const raw =
        (userKey && localStorage.getItem(userKey)) ||
        (lowerKey && localStorage.getItem(lowerKey)) ||
        localStorage.getItem('bnx_sidebar_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * System/folder names reserved for system labels (used to avoid duplicates with custom labels).
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

// Alias exported for compatibility
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
 * Resolves the Manage Labels "Show in label list" preference dynamically for any system label.
 * Uses Manage Labels system preferences (`sidebarPreferences`) as the single source of truth.
 */
export const isSystemLabelShownInLabelList = (systemLabelOrKey, sidebarPreferences = null) => {
  if (!systemLabelOrKey) return false;

  const stored = getStoredSidebarPreferences() || {};
  const effectivePrefs =
    sidebarPreferences && typeof sidebarPreferences === 'object'
      ? { ...stored, ...sidebarPreferences }
      : stored;

  const rawPrefKey = typeof systemLabelOrKey === 'object' ? systemLabelOrKey.prefKey : null;
  const rawName = typeof systemLabelOrKey === 'object' ? systemLabelOrKey.name : systemLabelOrKey;
  const rawId = typeof systemLabelOrKey === 'object' ? systemLabelOrKey.id : systemLabelOrKey;

  const keysToCheck = [rawPrefKey, rawName, rawId].filter(
    (k) => k !== undefined && k !== null && String(k).trim() !== ''
  );

  const hasDraftKey = keysToCheck.some((k) => {
    const lower = String(k).trim().toLowerCase();
    return lower === 'draft' || lower === 'drafts';
  });
  if (hasDraftKey) {
    keysToCheck.push('Draft', 'Drafts', 'draft', 'drafts');
  }

  for (const key of keysToCheck) {
    const strKey = String(key);
    if (Object.prototype.hasOwnProperty.call(effectivePrefs, strKey) && effectivePrefs[strKey] !== undefined) {
      const val = effectivePrefs[strKey];
      if (val === false) return false;
      if (typeof val === 'object' && val !== null && val.showInLabelList === false) return false;
      return true;
    }
  }

  // Fallback case-insensitive lookup across preference keys
  const prefEntries = Object.entries(effectivePrefs);
  for (const key of keysToCheck) {
    const target = String(key).trim().toLowerCase();
    for (const [k, val] of prefEntries) {
      if (k.trim().toLowerCase() === target && val !== undefined) {
        if (val === false) return false;
        if (typeof val === 'object' && val !== null && val.showInLabelList === false) return false;
        return true;
      }
    }
  }

  return true;
};

/**
 * Validates that a candidate custom label is an actual, non-deleted, non-folder label record.
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

  const labelType = normalizeLabelType(lbl);
  if (
    lbl.isFolder === true ||
    lbl.isNav === true ||
    lbl.isSidebar === true ||
    lbl.isSidebarItem === true ||
    NON_LABEL_TYPES.has(labelType)
  ) {
    return false;
  }

  // Reject disabled/hidden records
  if (
    lbl.hidden === true ||
    lbl.isHidden === true ||
    lbl.visible === false ||
    lbl.isVisible === false ||
    lbl.enabled === false ||
    lbl.isEnabled === false ||
    lbl.showInLabelList === false
  ) {
    return false;
  }

  const isSystemLabel = lbl.isSystem === true || labelType === 'SYSTEM';
  if (!isSystemLabel) {
    // Reject folder-name duplicates masquerading as custom labels
    const idLower = String(lbl.id).trim().toLowerCase();
    const nameLower = lbl.name.trim().toLowerCase();
    if (Boolean(lbl.prefKey) || FOLDER_AND_NAV_NAMES.has(idLower) || FOLDER_AND_NAV_NAMES.has(nameLower)) {
      return false;
    }
  }

  return true;
};

/**
 * Checks whether a label (system or custom) is enabled in Settings -> Manage Labels ("Show in label list").
 * System labels use Manage Labels system preferences (`sidebarPreferences`) as single source of truth;
 * custom labels use `customLabelPreferences` keyed strictly by label ID.
 */
export const isLabelShownInLabelList = (lbl, sidebarPreferences = {}, customLabelPreferences = null) => {
  if (!lbl) return false;

  if (typeof lbl === 'string') {
    const matchedSystem = SYSTEM_LABEL_DEFINITIONS.find(
      (s) =>
        s.id.toLowerCase() === lbl.trim().toLowerCase() ||
        s.name.toLowerCase() === lbl.trim().toLowerCase() ||
        (s.prefKey && s.prefKey.toLowerCase() === lbl.trim().toLowerCase())
    );
    return matchedSystem ? isSystemLabelShownInLabelList(matchedSystem, sidebarPreferences) : false;
  }

  if (!isValidLabelRecord(lbl)) return false;

  const labelType = normalizeLabelType(lbl);
  if (lbl.isSystem === true || labelType === 'SYSTEM') {
    return isSystemLabelShownInLabelList(lbl, sidebarPreferences);
  }

  const effectiveCustomPrefs =
    customLabelPreferences && typeof customLabelPreferences === 'object'
      ? customLabelPreferences
      : readStoredCustomLabelPrefs();

  const idKey = String(lbl.id).trim();
  const entry = effectiveCustomPrefs[idKey];

  if (entry !== undefined) {
    if (typeof entry === 'boolean') return entry;
    if (typeof entry === 'object' && entry !== null) {
      return entry.showInLabelList !== false;
    }
  }

  return true;
};

/**
 * Alias kept for backwards compatibility.
 */
export const isSystemLabelVisibleInLabelList = (keyOrName, sidebarPreferences = {}) => {
  return isSystemLabelShownInLabelList(keyOrName, sidebarPreferences);
};

/**
 * Returns active labels for all "Label as..." dropdowns using Settings -> Manage Labels
 * as the single source of truth:
 * - Enabled custom labels (`MailContext.labels` filtered by `customLabelPreferences`)
 * - Enabled system labels (`SYSTEM_LABEL_DEFINITIONS` filtered dynamically by `sidebarPreferences`)
 */
export const getAvailableLabelAsOptions = (customLabels = [], sidebarPreferences = {}, customLabelPreferences = null) => {
  const storedSidebar = getStoredSidebarPreferences() || {};
  const effectiveSidebarPrefs =
    sidebarPreferences && typeof sidebarPreferences === 'object'
      ? { ...storedSidebar, ...sidebarPreferences }
      : storedSidebar;

  const effectiveCustomPrefs =
    customLabelPreferences && typeof customLabelPreferences === 'object'
      ? customLabelPreferences
      : readStoredCustomLabelPrefs();

  const visibleCustomLabels = (Array.isArray(customLabels) ? customLabels : [])
    .filter((lbl) => {
      if (!lbl || typeof lbl !== 'object') return false;
      // Custom DB labels with system flag off are filtered strictly by customLabelPreferences
      if (lbl.isSystem === true || normalizeLabelType(lbl) === 'SYSTEM') return false;
      return isLabelShownInLabelList(lbl, effectiveSidebarPrefs, effectiveCustomPrefs);
    })
    .map((lbl) => ({
      ...lbl,
      name: lbl.name.trim(),
      type: normalizeLabelType(lbl),
      isSystem: false
    }));

  const visibleSystemLabels = SYSTEM_LABEL_DEFINITIONS
    .filter((sl) => isSystemLabelShownInLabelList(sl, effectiveSidebarPrefs))
    .map((sl) => ({
      ...sl,
      isSystem: true,
      type: 'SYSTEM'
    }));

  const seenIds = new Set();
  const seenNameType = new Set();
  const result = [];

  for (const lbl of [...visibleCustomLabels, ...visibleSystemLabels]) {
    const idKey = String(lbl.id).trim().toLowerCase();
    const labelType = lbl.isSystem ? 'SYSTEM' : normalizeLabelType(lbl);
    const parentKey = lbl.parentId !== undefined && lbl.parentId !== null ? String(lbl.parentId).trim() : '';
    const nameTypeKey = `${labelType}:${parentKey}:${lbl.name.trim().toLowerCase()}`;

    if (seenIds.has(idKey) || seenNameType.has(nameTypeKey)) continue;

    seenIds.add(idKey);
    seenNameType.add(nameTypeKey);
    result.push(lbl);
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

export const saveAppliedSystemLabel = (uid, labelObj) => {
  if (!uid || !labelObj) return;
  try {
    const map = getStoredSystemEmailLabels();
    const strUid = String(uid);
    const existing = map[strUid] || [];
    if (!existing.some((l) => String(l.id) === String(labelObj.id) || l.name === labelObj.name)) {
      map[strUid] = [...existing, labelObj];
      localStorage.setItem(SYSTEM_EMAIL_LABELS_KEY, JSON.stringify(map));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { type: 'system-label-applied', uid: strUid } }));
      }
    }
  } catch (e) {}
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


