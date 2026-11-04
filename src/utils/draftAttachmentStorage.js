// Utility for persisting and restoring Compose draft attachments (frontend-only)

const STORAGE_KEY = 'bnx_draft_attachments_registry';
const LAST_ACTIVE_KEY = 'bnx_last_active_draft_attachments';

// In-memory cache for raw Blob/File references in current tab session
const inMemoryBlobCache = new Map();

const safeNormalize = (str) => {
  return typeof str === 'string' ? str.trim().toLowerCase().replace(/\s+/g, ' ') : '';
};

const createSignature = (to, subject) => {
  const normTo = safeNormalize(to);
  const normSub = safeNormalize(subject);
  if (!normTo && !normSub) return '';
  return `sig_${normTo}_${normSub}`;
};

export const getRegistry = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveRegistry = (registry) => {
  try {
    const serialized = JSON.stringify(registry || {});
    sessionStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    // ignore quota exceeded or security errors
  }
};

/**
 * Cache in-memory raw File/Blob so user can preview or re-download in the same session
 */
export const storeInMemoryFile = (fileName, fileBlob) => {
  if (fileName && fileBlob) {
    inMemoryBlobCache.set(fileName, fileBlob);
  }
};

export const getInMemoryFile = (fileName) => {
  return inMemoryBlobCache.get(fileName) || null;
};

/**
 * Save draft attachments metadata
 */
export const saveDraftAttachments = ({ draftId, uid, to, subject, attachments = [] }) => {
  if (!Array.isArray(attachments)) return;

  // Clean attachments for JSON storage (remove rawFile before stringify)
  const cleanAttachments = attachments.map((att) => {
    const fileName = att.fileName || att.name || (typeof att === 'string' ? att : 'attachment');
    if (att.rawFile instanceof Blob) {
      storeInMemoryFile(fileName, att.rawFile);
    }
    return {
      fileName,
      filePath: att.filePath || att.url || '',
      thumbnailPath: att.thumbnailPath || '',
      size: typeof att.size === 'number' && att.size > 0 ? att.size : (att.rawFile ? att.rawFile.size : 0),
      url: att.url || (att.filePath ? (att.filePath.startsWith('/') ? att.filePath : `/${att.filePath}`) : ''),
    };
  });

  const registry = getRegistry();
  const entry = {
    draftId: draftId ? String(draftId) : null,
    uid: uid ? String(uid) : null,
    to: to || '',
    subject: subject || '',
    attachments: cleanAttachments,
    updatedAt: Date.now(),
  };

  if (cleanAttachments.length > 0) {
    try {
      const serializedLast = JSON.stringify(entry);
      sessionStorage.setItem(LAST_ACTIVE_KEY, serializedLast);
      localStorage.setItem(LAST_ACTIVE_KEY, serializedLast);
    } catch (e) {}

    if (uid) {
      registry[`uid_${String(uid)}`] = entry;
    }
    if (draftId) {
      registry[`db_${String(draftId)}`] = entry;
    }
    const sig = createSignature(to, subject);
    if (sig) {
      registry[sig] = entry;
    }
  } else {
    // If empty attachments, remove from registry
    if (uid) delete registry[`uid_${String(uid)}`];
    if (draftId) delete registry[`db_${String(draftId)}`];
    const sig = createSignature(to, subject);
    if (sig) delete registry[sig];
  }

  saveRegistry(registry);
};

/**
 * Link an IMAP draft UID to a DB draft ID and save attachments under both
 */
export const linkDraftUid = (uid, draftId, attachments = []) => {
  if (!uid && !draftId) return;
  const registry = getRegistry();
  const strUid = uid ? String(uid) : null;
  const strDraftId = draftId ? String(draftId) : null;

  let existingEntry = (strUid && registry[`uid_${strUid}`]) || (strDraftId && registry[`db_${strDraftId}`]);

  let finalAttachments = attachments && attachments.length > 0
    ? attachments
    : (existingEntry ? existingEntry.attachments : []);

  saveDraftAttachments({
    draftId: strDraftId || (existingEntry ? existingEntry.draftId : null),
    uid: strUid || (existingEntry ? existingEntry.uid : null),
    to: existingEntry?.to || '',
    subject: existingEntry?.subject || '',
    attachments: finalAttachments,
  });
};

/**
 * Retrieve saved attachments for a draft
 */
export const getDraftAttachments = (draft = {}) => {
  if (!draft) return [];

  // 1. Direct attachments array on draft object
  if (Array.isArray(draft.attachments) && draft.attachments.length > 0) {
    const hasObjects = draft.attachments.some(a => typeof a === 'object' && a !== null && (a.fileName || a.name));
    if (hasObjects) {
      return draft.attachments.map(att => {
        const fileName = att.fileName || att.name;
        const rawFile = getInMemoryFile(fileName) || att.rawFile;
        return {
          ...att,
          fileName,
          size: typeof att.size === 'number' && att.size > 0 ? att.size : (rawFile ? rawFile.size : 0),
          rawFile,
        };
      });
    }
  }

  // 2. attachmentsJson on draft object
  if (draft.attachmentsJson && typeof draft.attachmentsJson === 'string') {
    try {
      const parsed = JSON.parse(draft.attachmentsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(att => {
          const fileName = att.fileName || att.name;
          const rawFile = getInMemoryFile(fileName) || att.rawFile;
          return {
            ...att,
            fileName,
            size: typeof att.size === 'number' && att.size > 0 ? att.size : (rawFile ? rawFile.size : 0),
            rawFile,
          };
        });
      }
    } catch (e) {}
  }

  // 3. Lookup in Registry by UID, DB ID, or Signature
  const registry = getRegistry();
  const strUid = draft.uid !== undefined && draft.uid !== null ? String(draft.uid) : null;
  const strId = draft.id !== undefined && draft.id !== null ? String(draft.id) : null;
  const sig = createSignature(draft.to || draft.recipientEmail, draft.subject);

  let match = (strUid && registry[`uid_${strUid}`])
    || (strId && registry[`db_${strId}`])
    || (sig && registry[sig]);

  // 4. Fallback: match by string filenames if draft.attachments has filenames
  if (!match && Array.isArray(draft.attachments) && draft.attachments.length > 0) {
    const fileNames = draft.attachments.map(a => typeof a === 'string' ? a : a.fileName || a.name);
    for (const key of Object.keys(registry)) {
      const regEntry = registry[key];
      if (regEntry?.attachments && Array.isArray(regEntry.attachments)) {
        const regNames = regEntry.attachments.map(a => a.fileName || a.name);
        if (fileNames.some(fn => regNames.includes(fn))) {
          match = regEntry;
          break;
        }
      }
    }
  }

  // 5. Fallback: Check last active draft if opened right after cancel (e.g. within last 30 minutes)
  if (!match) {
    try {
      const lastRaw = sessionStorage.getItem(LAST_ACTIVE_KEY) || localStorage.getItem(LAST_ACTIVE_KEY);
      if (lastRaw) {
        const lastEntry = JSON.parse(lastRaw);
        if (lastEntry?.attachments && lastEntry.attachments.length > 0) {
          const timeDiff = Date.now() - (lastEntry.updatedAt || 0);
          const isRecent = timeDiff < 30 * 60 * 1000;
          const matchSub = !draft.subject || safeNormalize(draft.subject) === safeNormalize(lastEntry.subject) || draft.subject === '(No Subject)';
          if (isRecent && matchSub) {
            match = lastEntry;
          }
        }
      }
    } catch (e) {}
  }

  if (match && Array.isArray(match.attachments) && match.attachments.length > 0) {
    return match.attachments.map(att => {
      const fileName = att.fileName || att.name;
      const rawFile = getInMemoryFile(fileName) || att.rawFile;
      return {
        ...att,
        fileName,
        size: typeof att.size === 'number' && att.size > 0 ? att.size : (rawFile ? rawFile.size : 0),
        rawFile,
      };
    });
  }

  // 6. If draft.attachments has string filenames but no registry match, create fallback objects
  if (Array.isArray(draft.attachments) && draft.attachments.length > 0) {
    return draft.attachments.map(att => {
      const fileName = typeof att === 'string' ? att : (att.fileName || att.name);
      const rawFile = getInMemoryFile(fileName);
      return {
        fileName,
        size: typeof att === 'object' && att.size ? att.size : (rawFile ? rawFile.size : 0),
        filePath: typeof att === 'object' && att.filePath ? att.filePath : '',
        rawFile,
      };
    });
  }

  return [];
};

/**
 * Remove a specific attachment from storage
 */
export const removeDraftAttachmentFromStorage = ({ draftId, uid, to, subject, fileName }) => {
  const current = getDraftAttachments({ draftId, uid, to, subject });
  const updated = current.filter(a => (a.fileName || a.name) !== fileName);
  saveDraftAttachments({ draftId, uid, to, subject, attachments: updated });
};

/**
 * Clear draft attachments when email is sent or discarded
 */
export const clearDraftAttachments = ({ draftId, uid, to, subject }) => {
  const registry = getRegistry();
  if (uid) delete registry[`uid_${String(uid)}`];
  if (draftId) delete registry[`db_${String(draftId)}`];
  const sig = createSignature(to, subject);
  if (sig) delete registry[sig];
  saveRegistry(registry);
  try {
    sessionStorage.removeItem(LAST_ACTIVE_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch (e) {}
};

/**
 * Format file size for UI display (e.g. 251 KB)
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const isImageFile = (fileName = '') => {
  if (typeof fileName !== 'string') return false;
  const ext = fileName.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
};

