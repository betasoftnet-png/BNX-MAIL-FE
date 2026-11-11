// Utility for managing label and category visibility preferences across BNXmail

const CUSTOM_LABEL_PREFS_KEY = 'bnx_custom_label_prefs';
const CATEGORY_PREFS_KEY = 'bnx_category_prefs';
const IMAP_PREFS_KEY = 'bnx_imap_prefs';

const getActiveEmail = () =>
  typeof window !== 'undefined' ? localStorage.getItem('bnx_active_email') : null;

const readUserScopedJson = (baseKey, fallback = {}) => {
  try {
    if (typeof window === 'undefined') return fallback;
    const activeEmail = getActiveEmail();
    const trimmedEmail = activeEmail ? activeEmail.trim() : '';
    const userKey = trimmedEmail ? `${baseKey}_${trimmedEmail}` : null;
    const lowerKey = trimmedEmail ? `${baseKey}_${trimmedEmail.toLowerCase()}` : null;
    const raw =
      (userKey && localStorage.getItem(userKey)) ||
      (lowerKey && localStorage.getItem(lowerKey)) ||
      localStorage.getItem(baseKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

export const writeUserScopedJson = (baseKey, value) => {
  if (typeof window === 'undefined' || !value || typeof value !== 'object') return;
  const json = JSON.stringify(value);
  localStorage.setItem(baseKey, json);
  const activeEmail = getActiveEmail();
  const trimmedEmail = activeEmail ? activeEmail.trim() : '';
  if (trimmedEmail) {
    localStorage.setItem(`${baseKey}_${trimmedEmail}`, json);
    const lower = trimmedEmail.toLowerCase();
    if (lower !== trimmedEmail) {
      localStorage.setItem(`${baseKey}_${lower}`, json);
    }
  }
};

export const readStoredCustomLabelPrefs = () => readUserScopedJson(CUSTOM_LABEL_PREFS_KEY, {});

const writeStoredCustomLabelPrefs = (newPrefsMap, detailPayload = null) => {
  if (!newPrefsMap || typeof newPrefsMap !== 'object' || typeof window === 'undefined') return;
  writeUserScopedJson(CUSTOM_LABEL_PREFS_KEY, newPrefsMap);
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
export const getStoredSidebarPreferences = () => readUserScopedJson('bnx_sidebar_prefs', null);

/**
 * Canonical system label registry matching Settings -> Manage Labels.
 * Single shared source of truth used by Manage Labels, ThemeContext normalization,
 * and all "Label as..." dropdowns across every mail folder.
 */
export const SYSTEM_LABEL_DEFINITIONS = [
  {
    id: 'Inbox',
    name: 'Inbox',
    prefKey: 'Inbox',
    backendKey: 'INBOX',
    colorHex: '#3b82f6',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Inbox', 'inbox', 'INBOX'],
  },
  {
    id: 'Starred',
    name: 'Starred',
    prefKey: 'Starred',
    backendKey: 'STARRED',
    colorHex: '#f59e0b',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Starred', 'starred', 'STARRED'],
  },
  {
    id: 'Snoozed',
    name: 'Snoozed',
    prefKey: 'Snoozed',
    backendKey: 'SNOOZED',
    colorHex: '#8b5cf6',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Snoozed', 'snoozed', 'SNOOZED'],
  },
  {
    id: 'Important',
    name: 'Important',
    prefKey: 'Important',
    backendKey: 'IMPORTANT',
    colorHex: '#eab308',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Important', 'important', 'IMPORTANT'],
  },
  {
    id: 'Sent',
    name: 'Sent',
    prefKey: 'Sent',
    backendKey: 'SENT',
    colorHex: '#10b981',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Sent', 'sent', 'SENT', 'Sent Mail', 'sent mail'],
  },
  {
    id: 'Scheduled',
    name: 'Scheduled',
    prefKey: 'Scheduled',
    backendKey: 'SCHEDULED',
    colorHex: '#06b6d4',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Scheduled', 'scheduled', 'SCHEDULED'],
  },
  {
    id: 'Drafts',
    name: 'Drafts',
    prefKey: 'Draft',
    backendKey: 'DRAFTS',
    colorHex: '#f97316',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Draft', 'Drafts', 'draft', 'drafts', 'DRAFTS', 'DRAFT'],
  },
  {
    id: 'All Mail',
    name: 'All Mail',
    prefKey: 'All Mail',
    backendKey: 'ALL_MAIL',
    colorHex: '#6366f1',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['All Mail', 'all mail', 'ALL MAIL', 'ALL_MAIL', 'allmail', 'AllMail'],
  },
  {
    id: 'Spam',
    name: 'Spam',
    prefKey: 'Spam',
    backendKey: 'SPAM',
    colorHex: '#ef4444',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Spam', 'spam', 'SPAM'],
  },
  {
    id: 'Trash',
    name: 'Trash',
    prefKey: 'Trash',
    backendKey: 'TRASH',
    colorHex: '#64748b',
    type: 'SYSTEM',
    isSystem: true,
    aliases: ['Trash', 'trash', 'TRASH', 'Deleted', 'deleted'],
  },
];

const SYSTEM_LABEL_LOOKUP = new Map();
SYSTEM_LABEL_DEFINITIONS.forEach((def) => {
  [def.id, def.name, def.prefKey, def.backendKey, ...(def.aliases || [])].forEach((token) => {
    if (token !== undefined && token !== null) {
      SYSTEM_LABEL_LOOKUP.set(String(token).trim().toLowerCase(), def);
    }
  });
});

export const findSystemLabelDefinition = (labelOrKey) => {
  if (labelOrKey === undefined || labelOrKey === null) return null;
  if (typeof labelOrKey === 'object') {
    const candidates = [
      labelOrKey.id,
      labelOrKey.prefKey,
      labelOrKey.backendKey,
      labelOrKey.labelName,
      labelOrKey.name,
      ...(Array.isArray(labelOrKey.aliases) ? labelOrKey.aliases : []),
    ];
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        const hit = SYSTEM_LABEL_LOOKUP.get(String(candidate).trim().toLowerCase());
        if (hit) return hit;
      }
    }
    return null;
  }
  return SYSTEM_LABEL_LOOKUP.get(String(labelOrKey).trim().toLowerCase()) || null;
};

export const getSystemLabelPrefKeys = (defOrKey) => {
  const def = findSystemLabelDefinition(defOrKey) || (typeof defOrKey === 'object' ? defOrKey : null);
  if (!def) return defOrKey ? [String(defOrKey)] : [];
  return Array.from(
    new Set([def.prefKey, def.id, def.name, def.backendKey, ...(def.aliases || [])].filter(Boolean))
  );
};

/**
 * Writes a system label's boolean visibility consistently across all of its
 * alias keys on the target preferences object.
 */
export const setSystemLabelPrefKeys = (targetPrefs, defOrKey, isShown) => {
  if (!targetPrefs || typeof targetPrefs !== 'object') return targetPrefs;
  const keys = getSystemLabelPrefKeys(defOrKey);
  keys.forEach((key) => {
    targetPrefs[key] = Boolean(isShown);
  });
  return targetPrefs;
};

const resolveSystemPrefInMap = (def, prefsObj) => {
  if (!def || !prefsObj || typeof prefsObj !== 'object') return undefined;
  const keys = getSystemLabelPrefKeys(def);
  const definedValues = [];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(prefsObj, key) && typeof prefsObj[key] === 'boolean') {
      definedValues.push(prefsObj[key]);
    }
  }
  if (definedValues.length === 0) return undefined;
  return definedValues.includes(false) ? false : true;
};

/**
 * Normalizes a partial or persisted sidebar preferences object so all aliases
 * for each system label share a consistent value before merging defaults.
 */
export const normalizeSystemLabelPrefsMap = (prefsObj = {}) => {
  const normalized = { ...(prefsObj || {}) };
  SYSTEM_LABEL_DEFINITIONS.forEach((def) => {
    const resolved = resolveSystemPrefInMap(def, normalized);
    if (resolved !== undefined) {
      setSystemLabelPrefKeys(normalized, def, resolved);
    }
  });
  return normalized;
};

/**
 * Serializes the frontend sidebar preferences map into the backend PUT payload
 * array: [{ labelName: 'INBOX', showInLabelList: true }, ...]
 */
export const toBackendSystemLabelSettingsPayload = (prefsObj = {}) => {
  const normalized = normalizeSystemLabelPrefsMap(prefsObj);
  return SYSTEM_LABEL_DEFINITIONS.map((def) => ({
    labelName: def.backendKey,
    showInLabelList: normalized[def.prefKey] !== false && normalized[def.id] !== false,
  }));
};

/**
 * Maps a backend system label settings response (or raw settings list) into a
 * normalized frontend sidebar preferences map, preserving any extra UI keys in basePrefs.
 * Returns null if no valid settings array is present so callers never wipe saved state.
 */
export const mergeBackendSystemLabelSettings = (apiPayloadOrList, basePrefs = {}) => {
  const settingsList = Array.isArray(apiPayloadOrList)
    ? apiPayloadOrList
    : (Array.isArray(apiPayloadOrList?.data?.settings)
        ? apiPayloadOrList.data.settings
        : (Array.isArray(apiPayloadOrList?.settings) ? apiPayloadOrList.settings : null));

  if (!settingsList) return null;

  const merged = { ...(basePrefs || {}) };
  settingsList.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const def = findSystemLabelDefinition(item.labelName || item.name || item.id);
    if (!def) return;
    const isShown = item.showInLabelList !== false;
    setSystemLabelPrefKeys(merged, def, isShown);
  });
  return normalizeSystemLabelPrefsMap(merged);
};

/**
 * Folder / sidebar navigation names used to prevent bogus folder records from
 * entering custom label lists when not explicitly backed by SYSTEM_LABEL_DEFINITIONS.
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
 * Validates that a candidate label record is an actual, existing, non-deleted, non-folder label.
 */
export const isValidLabelRecord = (lbl) => {
  if (!lbl || typeof lbl !== 'object' || Array.isArray(lbl)) return false;

  if (lbl.id === undefined || lbl.id === null || String(lbl.id).trim() === '') {
    return false;
  }
  if (typeof lbl.name !== 'string' || lbl.name.trim() === '') {
    return false;
  }

  // Exclude deleted, inactive, or explicitly hidden/disabled label records
  if (
    lbl.deleted === true ||
    lbl.isDeleted === true ||
    lbl.is_deleted === true ||
    lbl.active === false ||
    lbl.isActive === false ||
    lbl.hidden === true ||
    lbl.isHidden === true ||
    lbl.visible === false ||
    lbl.isVisible === false ||
    lbl.enabled === false ||
    lbl.isEnabled === false ||
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

  const isSystemRecord = lbl.isSystem === true || labelType === 'SYSTEM';
  if (isSystemRecord) {
    return Boolean(findSystemLabelDefinition(lbl));
  }

  // Custom records must not masquerade as raw folder/nav substitutes
  const idLower = String(lbl.id).trim().toLowerCase();
  const nameLower = lbl.name.trim().toLowerCase();
  if (FOLDER_AND_NAV_NAMES.has(idLower) || FOLDER_AND_NAV_NAMES.has(nameLower) || Boolean(lbl.prefKey)) {
    return false;
  }

  return true;
};

/**
 * Checks whether a system label is enabled in Settings -> Manage Labels ("Show in label list").
 * Checks live sidebarPreferences first (including aliases) before falling back to localStorage.
 */
export const isSystemLabelShownInLabelList = (systemLabelOrKey, sidebarPreferences = null) => {
  const def = findSystemLabelDefinition(systemLabelOrKey);
  if (!def) return false;

  const explicitVal = resolveSystemPrefInMap(def, sidebarPreferences);
  if (explicitVal !== undefined) return explicitVal;

  const stored = getStoredSidebarPreferences();
  const storedVal = resolveSystemPrefInMap(def, stored);
  if (storedVal !== undefined) return storedVal;

  return true;
};

export const isSystemLabelVisibleInLabelList = isSystemLabelShownInLabelList;

const isCustomPrefsMap = (obj) =>
  Boolean(
    obj &&
      typeof obj === 'object' &&
      !Array.isArray(obj) &&
      Object.values(obj).some((v) => v && typeof v === 'object' && 'showInLabelList' in v)
  );

const resolveEffectiveCustomPrefs = (sidebarPreferences, customLabelPreferences) => {
  if (customLabelPreferences && typeof customLabelPreferences === 'object') {
    return customLabelPreferences;
  }
  if (isCustomPrefsMap(sidebarPreferences)) {
    return sidebarPreferences;
  }
  return readStoredCustomLabelPrefs();
};

/**
 * Checks whether a system or custom label is enabled in Settings -> Manage Labels ("Show in label list").
 */
export const isLabelShownInLabelList = (lbl, sidebarPreferences = null, customLabelPreferences = null) => {
  if (typeof lbl === 'string') {
    return isSystemLabelShownInLabelList(lbl, sidebarPreferences);
  }
  if (!isValidLabelRecord(lbl)) return false;

  if (lbl.showInLabelList === false) {
    return false;
  }

  const isSystemRecord = lbl.isSystem === true || normalizeLabelType(lbl) === 'SYSTEM';
  if (isSystemRecord) {
    return isSystemLabelShownInLabelList(lbl, sidebarPreferences);
  }

  const effectiveCustomPrefs = resolveEffectiveCustomPrefs(sidebarPreferences, customLabelPreferences);

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
 * Returns valid, enabled, deduplicated custom + system labels for all "Label as..." dropdowns.
 * Respects Manage Labels "Show in label list" settings dynamically without affecting folders or messages.
 */
export const getAvailableLabelAsOptions = (
  customLabels = [],
  sidebarPreferences = {},
  customLabelPreferences = null
) => {
  const effectiveCustomPrefs = resolveEffectiveCustomPrefs(sidebarPreferences, customLabelPreferences);
  const effectiveSidebarPrefs =
    customLabelPreferences == null && isCustomPrefsMap(sidebarPreferences)
      ? null
      : sidebarPreferences;

  const seenIds = new Set();
  const seenNameType = new Set();
  const result = [];

  if (Array.isArray(customLabels)) {
    for (const lbl of customLabels) {
      if (!lbl || typeof lbl !== 'object') {
        continue;
      }

      const labelType = normalizeLabelType(lbl);
      const isSystemRecord =
        lbl.isSystem === true ||
        labelType === 'SYSTEM' ||
        Boolean(findSystemLabelDefinition(lbl));
      if (isSystemRecord) {
        continue;
      }

      if (!isLabelShownInLabelList(lbl, effectiveSidebarPrefs, effectiveCustomPrefs)) {
        continue;
      }

      const idKey = String(lbl.id).trim();
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
        isSystem: false
      });
    }
  }

  for (const sysDef of SYSTEM_LABEL_DEFINITIONS) {
    if (!isSystemLabelShownInLabelList(sysDef, effectiveSidebarPrefs)) continue;

    const idKey = String(sysDef.id).trim();
    const nameTypeKey = `SYSTEM::${sysDef.name.trim().toLowerCase()}`;
    if (seenIds.has(idKey) || seenNameType.has(nameTypeKey)) continue;

    seenIds.add(idKey);
    seenNameType.add(nameTypeKey);
    result.push({ ...sysDef });
  }

  return result;
};

/**
 * Matches an email-assigned label record against a target label option, ID, or system alias.
 */
export const matchesLabelIdentity = (appliedLabel, targetLabelOrId) => {
  if (!appliedLabel || !targetLabelOrId) return false;
  if (typeof appliedLabel === 'string') {
    const targetDef = findSystemLabelDefinition(targetLabelOrId);
    const appliedDef = findSystemLabelDefinition(appliedLabel);
    if (targetDef && appliedDef) return targetDef.id === appliedDef.id;
    const targetObj = typeof targetLabelOrId === 'object' ? targetLabelOrId : null;
    if (targetObj) {
      return (
        String(targetObj.id) === appliedLabel ||
        (typeof targetObj.name === 'string' &&
          appliedLabel.trim().toLowerCase() === targetObj.name.trim().toLowerCase())
      );
    }
    return appliedLabel === String(targetLabelOrId);
  }

  const targetObj = typeof targetLabelOrId === 'object' ? targetLabelOrId : null;
  const hasAppliedId = appliedLabel.id !== undefined && appliedLabel.id !== null;
  const hasTargetId = targetObj ? (targetObj.id !== undefined && targetObj.id !== null) : true;
  const targetStr = targetObj ? String(targetObj.id ?? targetObj.name ?? '') : String(targetLabelOrId);

  if (hasAppliedId && String(appliedLabel.id) === targetStr) {
    return true;
  }

  const targetDef = findSystemLabelDefinition(targetLabelOrId);
  if (targetDef) {
    const appliedDef = findSystemLabelDefinition(appliedLabel);
    if (appliedDef && appliedDef.id === targetDef.id) {
      return true;
    }
  }

  // Match by name only when either record lacks an ID so distinct custom IDs (e.g. parent vs sublabel) never collide
  if ((!hasAppliedId || !hasTargetId) && targetObj && targetObj.name && appliedLabel.name) {
    return (
      appliedLabel.name.trim().toLowerCase() === targetObj.name.trim().toLowerCase() &&
      Boolean(appliedLabel.isSystem) === Boolean(targetObj.isSystem)
    );
  }

  return false;
};

const SYSTEM_EMAIL_LABELS_KEY = 'bnx_system_email_labels';

export const getStoredSystemEmailLabels = () => readUserScopedJson(SYSTEM_EMAIL_LABELS_KEY, {});

export const saveAppliedSystemLabel = (uid, labelObj) => {
  if (!uid || !labelObj) return;
  try {
    const def = findSystemLabelDefinition(labelObj);
    const normalized = def
      ? {
          id: def.id,
          name: def.name,
          prefKey: def.prefKey,
          colorHex: labelObj.colorHex || def.colorHex,
          type: 'SYSTEM',
          isSystem: true,
        }
      : {
          id: String(labelObj.id),
          name: labelObj.name,
          prefKey: labelObj.prefKey,
          colorHex: labelObj.colorHex,
          type: 'SYSTEM',
          isSystem: true,
        };

    const map = getStoredSystemEmailLabels();
    const strUid = String(uid);
    const existing = Array.isArray(map[strUid]) ? map[strUid] : [];
    if (!existing.some((l) => matchesLabelIdentity(l, normalized))) {
      map[strUid] = [...existing, normalized];
      writeUserScopedJson(SYSTEM_EMAIL_LABELS_KEY, map);
    }
  } catch (e) {}
};

export const removeAppliedSystemLabel = (uid, labelIdOrObj) => {
  if (!uid || !labelIdOrObj) return;
  try {
    const map = getStoredSystemEmailLabels();
    const strUid = String(uid);
    const existing = Array.isArray(map[strUid]) ? map[strUid] : [];
    map[strUid] = existing.filter((l) => !matchesLabelIdentity(l, labelIdOrObj));
    writeUserScopedJson(SYSTEM_EMAIL_LABELS_KEY, map);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { type: 'system-label-removed', uid: strUid } }));
    }
  } catch (e) {}
};

export const mergeEmailWithStoredSystemLabels = (emailObj, sysMap = null) => {
  if (!emailObj) return emailObj;
  const uidKey = emailObj.uid != null ? String(emailObj.uid) : null;
  if (!uidKey) return emailObj;
  const map = sysMap || getStoredSystemEmailLabels();
  const extra = Array.isArray(map?.[uidKey]) ? map[uidKey] : [];
  if (extra.length === 0) return emailObj;
  const existing = Array.isArray(emailObj.labels) ? emailObj.labels : [];
  const merged = [...existing];
  for (const sLbl of extra) {
    if (!merged.some((l) => matchesLabelIdentity(l, sLbl))) {
      merged.push(sLbl);
    }
  }
  return merged.length === existing.length ? emailObj : { ...emailObj, labels: merged };
};



