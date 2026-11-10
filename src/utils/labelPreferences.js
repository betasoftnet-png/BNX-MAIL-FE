// Utility for managing label and category visibility preferences across BNXmail

const CUSTOM_LABEL_PREFS_KEY = 'bnx_custom_label_prefs';
const CATEGORY_PREFS_KEY = 'bnx_category_prefs';
const IMAP_PREFS_KEY = 'bnx_imap_prefs';

/**
 * Returns visibility settings for a custom label by ID.
 * Defaults to { showInLabelList: true, showInMessageList: true }
 */
export const getCustomLabelVisibility = (labelId) => {
  if (!labelId && labelId !== 0) return { showInLabelList: true, showInMessageList: true };
  const strId = String(labelId);
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_LABEL_PREFS_KEY) : null;
    const prefs = raw ? JSON.parse(raw) : {};
    const item = prefs[strId];
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
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_LABEL_PREFS_KEY) : null;
    const prefs = raw ? JSON.parse(raw) : {};
    const current = prefs[strId] || { showInLabelList: true, showInMessageList: true };
    prefs[strId] = {
      ...current,
      ...updates
    };
    localStorage.setItem(CUSTOM_LABEL_PREFS_KEY, JSON.stringify(prefs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { labelId: strId, ...updates } }));
    }
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
    localStorage.setItem(CUSTOM_LABEL_PREFS_KEY, JSON.stringify(newPrefsMap));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: newPrefsMap }));
    }
  } catch (e) {
    console.error('Failed to bulk save custom label visibility:', e);
  }
};

/**
 * Check if a custom label is visible in the sidebar
 */
export const isLabelVisibleInSidebar = (labelId) => {
  return getCustomLabelVisibility(labelId).showInLabelList !== false;
};

/**
 * Check if a custom label is visible on email badges in the message list
 */
export const isLabelVisibleInMessageList = (labelId) => {
  return getCustomLabelVisibility(labelId).showInMessageList !== false;
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
 * System labels available for labeling (with their default colors and preference keys)
 */
export const SYSTEM_LABEL_DEFINITIONS = [
  { id: "Starred", name: "Starred", prefKey: "Starred", colorHex: "#f59e0b" },
  { id: "Snoozed", name: "Snoozed", prefKey: "Snoozed", colorHex: "#f59e0b" },
  { id: "Important", name: "Important", prefKey: "Important", colorHex: "#eab308" },
  { id: "Sent", name: "Sent", prefKey: "Sent", colorHex: "#135bec" },
  { id: "Scheduled", name: "Scheduled", prefKey: "Scheduled", colorHex: "#06b6d4" },
  { id: "Drafts", name: "Drafts", prefKey: "Draft", colorHex: "#64748b" },
  { id: "All Mail", name: "All Mail", prefKey: "All Mail", colorHex: "#3b82f6" },
  { id: "Spam", name: "Spam", prefKey: "Spam", colorHex: "#ef4444" },
  { id: "Trash", name: "Trash", prefKey: "Trash", colorHex: "#ef4444" },
];

/**
 * Check if a system label is visible in the label list according to sidebarPreferences
 */
export const isSystemLabelVisibleInLabelList = (keyOrName, sidebarPreferences = {}) => {
  if (!keyOrName) return true;
  if (keyOrName === "Draft" || keyOrName === "Drafts") {
    return sidebarPreferences?.["Draft"] !== false && sidebarPreferences?.["Drafts"] !== false;
  }
  return sidebarPreferences?.[keyOrName] !== false;
};

/**
 * Returns all active labels for the "Label as..." menu:
 * - System labels whose "Show in label list" setting is true (default true)
 * - Custom labels whose "Show in label list" setting is true (default true)
 */
export const getAvailableLabelAsOptions = (customLabels = [], sidebarPreferences = {}) => {
  // 1. System labels filtered by user preference
  const visibleSystemLabels = SYSTEM_LABEL_DEFINITIONS.filter((sl) =>
    isSystemLabelVisibleInLabelList(sl.prefKey || sl.name, sidebarPreferences)
  ).map((sl) => ({
    ...sl,
    isSystem: true,
  }));

  // 2. Custom labels filtered by user preference
  const visibleCustomLabels = (customLabels || []).filter((lbl) =>
    isLabelVisibleInSidebar(lbl.id)
  ).map((lbl) => ({
    ...lbl,
    isSystem: false,
  }));

  return [...visibleSystemLabels, ...visibleCustomLabels];
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


