import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { mailAPI, api } from '../services/api';
import { API_ENDPOINTS } from '../Data/constants';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { filterDuplicateSpamEmails } from '../utils/spamFilter';
import { matchesDateRange } from '../utils/dateFilter';
import toast from 'react-hot-toast';
import { useNotificationPreferences } from './NotificationPreferenceContext';
import UndoDeleteToast from '../components/UndoDeleteToast';
import {
    getStoredStarredIds,
    saveStoredStarredIds,
    getStoredStarredEmailsMap,
    saveStoredStarredEmail,
    removeStoredStarredEmail,
    isEmailIdStarred,
    normalizeFolderName,
    getEmailStarKey,
    getUserKey,
    matchesScheduledAndSentEmail,
    isEmailValidScheduled
} from '../utils/starredStorage';
import {
    extractEmailAddresses,
    isSelfSentEmail
} from '../utils/recipientSuggestions';
import {
    saveSnoozedEmail,
    markEmailUnsnoozed,
    markEmailReturned,
    removeSnoozedEmail,
    isEmailActivelySnoozed,
    isEmailCurrentlySnoozed,
    getActiveSnoozedCount,
    deduplicateSnoozedEmails,
    getDueSnoozedEmails,
    syncSnoozedList,
    syncInboxList
} from '../utils/snoozeStorage';
import {
    canAccessAllInbox,
    getAssociatedBusinessEmails,
    deduplicateAllInboxEmails
} from '../utils/accountUtils';
import {
    SYSTEM_LABEL_DEFINITIONS,
    getStoredSystemEmailLabels,
    saveAppliedSystemLabel,
    removeAppliedSystemLabel,
    removeCustomLabelVisibility
} from '../utils/labelPreferences';

// Clean up any legacy persisted read UIDs from previous sessions to prevent stale overrides
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('bnx_read_emails')) {
                localStorage.removeItem(k);
            }
        });
    }
} catch (e) {}

export const getStoredSelfSentEmails = (userEmail) => {
    if (!userEmail || typeof window === 'undefined') return [];
    try {
        const cleanUser = userEmail.trim().toLowerCase();
        const raw = localStorage.getItem(`bnx_self_sent_${cleanUser}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const saveStoredSelfSentEmail = (emailObj, userEmail) => {
    if (!emailObj || !userEmail || typeof window === 'undefined') return;
    try {
        const cleanUser = userEmail.trim().toLowerCase();
        const list = getStoredSelfSentEmails(cleanUser);
        const uid = String(emailObj.uid ?? emailObj.id ?? emailObj.messageId ?? '');
        const messageId = emailObj.messageId ? String(emailObj.messageId) : null;

        const existingIdx = list.findIndex(m => {
            const mUid = String(m.uid ?? m.id ?? m.messageId ?? '');
            if (uid && mUid && mUid === uid) return true;
            if (messageId && m.messageId && String(m.messageId) === messageId) return true;
            if (m.subject && emailObj.subject && m.subject.trim() === emailObj.subject.trim()) {
                const dateA = new Date(m.date || m.sentDate || m.receivedDate || 0).getTime();
                const dateB = new Date(emailObj.date || emailObj.sentDate || emailObj.receivedDate || 0).getTime();
                if (dateA && dateB && Math.abs(dateA - dateB) < 300000) return true;
            }
            return false;
        });

        const entryToSave = {
            ...emailObj,
            uid: emailObj.uid ?? emailObj.id ?? (existingIdx >= 0 ? list[existingIdx].uid : String(Date.now())),
            id: emailObj.id ?? emailObj.uid ?? (existingIdx >= 0 ? list[existingIdx].id : String(Date.now())),
            messageId: emailObj.messageId || (existingIdx >= 0 ? list[existingIdx].messageId : null)
        };

        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...entryToSave };
        } else {
            list.unshift(entryToSave);
        }

        const trimmed = list.slice(0, 100);
        localStorage.setItem(`bnx_self_sent_${cleanUser}`, JSON.stringify(trimmed));
    } catch (e) {
        console.warn('Failed to save self-sent email:', e);
    }
};

export const syncSelfSentEmails = (folder, emailsList, userEmail, isEmailStarredFn, readUids, unreadUids) => {
    if (!userEmail || !Array.isArray(emailsList)) return emailsList;
    const fKey = (folder || '').toLowerCase();
    const selfSentList = getStoredSelfSentEmails(userEmail);
    if (!Array.isArray(selfSentList) || selfSentList.length === 0) return emailsList;

    let result = [...emailsList];

    if (fKey === 'sent') {
        selfSentList.forEach(sMail => {
            const uidStr = String(sMail.uid ?? sMail.id ?? '');
            const msgId = sMail.messageId ? String(sMail.messageId) : null;

            const existingIdx = result.findIndex(m => {
                const mUid = String(m.uid ?? m.id ?? '');
                if (uidStr && mUid && mUid === uidStr) return true;
                if (msgId && m.messageId && String(m.messageId) === msgId) return true;
                if (isSelfSentEmail(m, userEmail) && m.subject && sMail.subject && m.subject.trim() === sMail.subject.trim()) {
                    const dateA = new Date(m.date || m.sentDate || m.receivedDate || 0).getTime();
                    const dateB = new Date(sMail.date || sMail.sentDate || sMail.receivedDate || 0).getTime();
                    if (dateA && dateB && Math.abs(dateA - dateB) < 300000) return true;
                }
                return false;
            });

            if (existingIdx >= 0) {
                // Harmonize UID so both Sent and Inbox share the exact same UID/message ID
                result[existingIdx].uid = sMail.uid;
                result[existingIdx].id = sMail.uid;
            } else {
                result.push({
                    ...sMail,
                    folderName: 'Sent',
                    isDraft: false,
                    draft: false,
                    isRead: true,
                    read: true,
                    sentDate: sMail.sentDate || sMail.date || sMail.receivedDate,
                    date: sMail.sentDate || sMail.date || sMail.receivedDate
                });
            }
        });

        // Deduplicate Sent by canonical UID
        const seenSentUids = new Set();
        result = result.filter(m => {
            const u = String(m.uid ?? m.id ?? '');
            if (!u) return true;
            if (seenSentUids.has(u)) return false;
            seenSentUids.add(u);
            return true;
        });

        sortEmailsByDateDesc(result);
        return result;
    }

    if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(fKey)) {
        selfSentList.forEach(sMail => {
            if (sMail.deletedFromInbox) return;
            const uidStr = String(sMail.uid ?? sMail.id ?? '');
            const msgId = sMail.messageId ? String(sMail.messageId) : null;

            const existingIdx = result.findIndex(m => {
                const mUid = String(m.uid ?? m.id ?? '');
                if (uidStr && mUid && mUid === uidStr) return true;
                if (msgId && m.messageId && String(m.messageId) === msgId) return true;
                if (isSelfSentEmail(m, userEmail) && m.subject && sMail.subject && m.subject.trim() === sMail.subject.trim()) {
                    const dateA = new Date(m.date || m.receivedDate || m.sentDate || 0).getTime();
                    const dateB = new Date(sMail.date || sMail.receivedDate || sMail.sentDate || 0).getTime();
                    if (dateA && dateB && Math.abs(dateA - dateB) < 300000) return true;
                }
                return false;
            });

            if (existingIdx >= 0) {
                // Harmonize UID so both Sent and Inbox share the exact same UID/message ID
                result[existingIdx].uid = sMail.uid;
                result[existingIdx].id = sMail.uid;
            } else {
                const isMarkedRead = readUids ? readUids.has(uidStr) : false;
                const isMarkedUnread = unreadUids ? unreadUids.has(uidStr) : false;
                const isRead = !isMarkedUnread && (isMarkedRead || (sMail.isRead !== undefined ? Boolean(sMail.isRead) : false));
                const isStarred = typeof isEmailStarredFn === 'function' ? isEmailStarredFn(uidStr, 'inbox', sMail) : Boolean(sMail.starred);

                if (fKey === 'unread' && isRead) return;

                result.push({
                    ...sMail,
                    folderName: 'INBOX',
                    isDraft: false,
                    draft: false,
                    isRead,
                    read: isRead,
                    starred: isStarred,
                    isStarred: isStarred,
                    receivedDate: sMail.receivedDate || sMail.sentDate || sMail.date,
                    date: sMail.receivedDate || sMail.sentDate || sMail.date
                });
            }
        });

        // Filter out any items marked deleted from Inbox
        const deletedInboxUids = new Set(selfSentList.filter(s => s.deletedFromInbox).map(s => String(s.uid ?? s.id ?? '')));
        if (deletedInboxUids.size > 0) {
            result = result.filter(m => !deletedInboxUids.has(String(m.uid ?? m.id ?? '')));
        }

        // Deduplicate Inbox by canonical UID
        const seenInboxUids = new Set();
        result = result.filter(m => {
            const u = String(m.uid ?? m.id ?? '');
            if (!u) return true;
            if (seenInboxUids.has(u)) return false;
            seenInboxUids.add(u);
            return true;
        });

        sortEmailsByDateDesc(result);
        return result;
    }

    return result;
};

export const markSelfSentDeletedFromInbox = (uid, userEmail) => {
    if (!uid || !userEmail || typeof window === 'undefined') return;
    try {
        const cleanUser = userEmail.trim().toLowerCase();
        const list = getStoredSelfSentEmails(cleanUser);
        const strUid = String(uid);
        const item = list.find(m => String(m.uid ?? m.id ?? m.messageId ?? '') === strUid);
        if (item) {
            item.deletedFromInbox = true;
            localStorage.setItem(`bnx_self_sent_${cleanUser}`, JSON.stringify(list));
        }
    } catch {}
};

export const unmarkSelfSentDeletedFromInbox = (uid, userEmail) => {
    if (!uid || !userEmail || typeof window === 'undefined') return;
    try {
        const cleanUser = userEmail.trim().toLowerCase();
        const list = getStoredSelfSentEmails(cleanUser);
        const strUid = String(uid);
        const item = list.find(m => String(m.uid ?? m.id ?? m.messageId ?? '') === strUid);
        if (item) {
            delete item.deletedFromInbox;
            localStorage.setItem(`bnx_self_sent_${cleanUser}`, JSON.stringify(list));
        }
    } catch {}
};

// Helper functions for session-scoped read UIDs to preserve read status across in-session refreshes
const getStoredReadUids = (email) => {
    if (!email || typeof window === 'undefined') return new Set();
    try {
        const raw = sessionStorage.getItem(`bnx_read_uids_${email}`);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
};

const saveStoredReadUids = (email, set) => {
    if (!email || typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(`bnx_read_uids_${email}`, JSON.stringify(Array.from(set)));
    } catch {}
};

const sortEmailsByDateDesc = (list) => {
    if (!Array.isArray(list)) return list;
    return list.sort((a, b) => {
        const getTimestamp = (m) => {
            if (!m) return 0;
            const d = m.receivedDate || m.sentDate || m.date || m.createdAt || m.timestamp;
            if (!d) return 0;
            const t = new Date(d).getTime();
            return isNaN(t) ? 0 : t;
        };
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
        if (timeA === 0 && timeB === 0) return 0;
        if (timeA === 0) return 1;
        if (timeB === 0) return -1;
        if (timeB !== timeA) return timeB - timeA;
        const uidA = Number(a.uid);
        const uidB = Number(b.uid);
        if (!isNaN(uidA) && !isNaN(uidB)) return uidB - uidA;
        return 0;
    });
};

const MailContext = createContext();

export const MailProvider = ({ children }) => {
    const { user } = useAuth();
    const { emailsPerPage: limit } = useTheme();
    const notifPrefs = useNotificationPreferences();
    const notifPrefsRef = useRef(notifPrefs);
    useEffect(() => {
        notifPrefsRef.current = notifPrefs;
    }, [notifPrefs]);
    const [emails, setEmails] = useState([]);
    const emailsRef = useRef(emails);
    useEffect(() => {
        emailsRef.current = emails;
    }, [emails]);

    const readUidsRef = useRef(getStoredReadUids(user?.email));
    const unreadUidsRef = useRef(new Set());

    useEffect(() => {
        const stored = getStoredReadUids(user?.email);
        readUidsRef.current = stored;
        unreadUidsRef.current = new Set();
    }, [user?.email]);

    const isEmailRead = useCallback((uid) => {
        if (uid === undefined || uid === null) return false;
        const strUid = String(uid);
        if (unreadUidsRef.current.has(strUid)) return false;
        if (readUidsRef.current.has(strUid)) return true;
        const item = emailsRef.current.find(m => String(m.uid ?? m.id) === strUid);
        return item ? Boolean(item.isRead || item.read) : false;
    }, []);
    const [dateFilter, setDateFilter] = useState("ALL");
    const [customDateRange, setCustomDateRange] = useState(null);

    const resetDateFilter = useCallback(() => {
        setDateFilter("ALL");
        setCustomDateRange(null);
    }, []);

    const matchesDateFilter = useCallback((email) => {
        return matchesDateRange(email, dateFilter, customDateRange);
    }, [dateFilter, customDateRange]);

    const [currentFolder, setCurrentFolder] = useState('inbox');
    const currentFolderRef = useRef('inbox');
    const pagesCache = useRef({});
    const silentFetchInFlight = useRef(new Set());
    const invalidateCache = useCallback((folder) => {
        if (!folder) return;
        const folderKey = folder.toLowerCase();
        delete pagesCache.current[folderKey];
        delete pagesCache.current[`${folderKey}_total`];
    }, []);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isRefreshingRef = useRef(false);
    const [unreadCounts, setUnreadCounts] = useState(() => ({
        inbox: 0,
        unread: 0,
        spam: 0,
        trash: 0,
        snoozed: getActiveSnoozedCount(user?.email)
    }));

    useEffect(() => {
        setUnreadCounts(prev => ({
            ...prev,
            snoozed: getActiveSnoozedCount(user?.email)
        }));
    }, [user?.email]);

    // Reset folder page caches and All Inbox status when switching accounts or user profiles
    useEffect(() => {
        pagesCache.current = {};
        silentFetchInFlight.current.clear();
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('inbox');
        if (!canAccessAllInbox(user)) {
            setUnreadCounts(prev => ({ ...prev, allinbox: 0 }));
        }
    }, [user?.email, user, invalidateCache]);
    const [labels, setLabels] = useState([]);
    const [totalEmails, setTotalEmails] = useState(0);
    const [pendingUndoDelete, setPendingUndoDelete] = useState(null);
    const pendingUndoDeleteRef = useRef(null);
    const undoCountdownTimerRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const currentPageRef = useRef(1);

    const updateCurrentPage = useCallback((page) => {
        currentPageRef.current = page;
        setCurrentPage(page);
    }, []);

    const [starredIds, setStarredIds] = useState(() => getStoredStarredIds(user?.email));
    const starredIdsRef = useRef(starredIds);

    const getInitialSentDraftUids = () => {
        try {
            const stored = sessionStorage.getItem('bnx_sent_draft_uids');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (e) {
            return new Set();
        }
    };
    const sentDraftUidsRef = useRef(getInitialSentDraftUids());

    const getInitialSentEmailLabels = () => {
        try {
            const stored = sessionStorage.getItem('bnx_sent_email_labels');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    };
    const sentEmailLabelsRef = useRef(getInitialSentEmailLabels());

    const updateSentEmailLabels = useCallback((uid, labelsList) => {
        if (!uid) return;
        sentEmailLabelsRef.current[String(uid)] = Array.isArray(labelsList) ? labelsList : [];
        try {
            sessionStorage.setItem('bnx_sent_email_labels', JSON.stringify(sentEmailLabelsRef.current));
        } catch (e) {}
    }, []);

    const attachStoredSystemLabels = useCallback((emailList) => {
        if (!Array.isArray(emailList)) return emailList;
        const sysLabelsMap = getStoredSystemEmailLabels();
        return emailList.map((m) => {
            const uidStr = String(m.uid ?? m.id ?? '');
            const extraSys = sysLabelsMap[uidStr];
            if (extraSys && extraSys.length > 0) {
                const existing = Array.isArray(m.labels) ? m.labels : [];
                const combined = [...existing];
                extraSys.forEach((s) => {
                    if (!combined.some((c) => String(c.id) === String(s.id) || c.name === s.name)) {
                        combined.push(s);
                    }
                });
                return { ...m, labels: combined };
            }
            return m;
        });
    }, []);

    useEffect(() => {
        starredIdsRef.current = starredIds;
    }, [starredIds]);

    useEffect(() => {
        const loaded = getStoredStarredIds(user?.email);
        setStarredIds(loaded);
        starredIdsRef.current = loaded;
    }, [user?.email]);

    useEffect(() => {
        const handleSync = (e) => {
            const loaded = getStoredStarredIds(user?.email);
            setStarredIds(loaded);
            starredIdsRef.current = loaded;

            if (e?.detail) {
                const { uid, starred } = e.detail;
                const uidStr = String(uid);
                setEmails(prev => {
                    if (currentFolderRef.current?.toLowerCase() === 'starred' && !starred) {
                        return prev.filter(m => String(m.uid ?? m.id ?? '') !== uidStr);
                    }
                    return prev.map(m => {
                        const mUid = String(m.uid ?? m.id ?? '');
                        if (mUid === uidStr) {
                            return { ...m, starred: Boolean(starred), isStarred: Boolean(starred) };
                        }
                        return m;
                    });
                });
            }
        };
        window.addEventListener('storage', handleSync);
        window.addEventListener('bnx-starred-updated', handleSync);
        return () => {
            window.removeEventListener('storage', handleSync);
            window.removeEventListener('bnx-starred-updated', handleSync);
        };
    }, [user?.email]);

    const isEmailStarred = useCallback((uid, folder = '', email = null) => {
        if (!uid && uid !== 0 && !email) return false;
        const u = uid ?? email?.uid ?? email?.id;
        const isDraft = folder === 'draft' || folder === 'drafts' ||
            email?.isDraft === true || email?.draft === true ||
            email?.folderName?.toLowerCase()?.includes('draft') ||
            currentFolderRef.current?.toLowerCase() === 'draft' ||
            currentFolderRef.current?.toLowerCase() === 'drafts';
        const f = isDraft ? 'draft' : (folder || email?.folderName || '');
        return isEmailIdStarred(u, user?.email, f, email);
    }, [user?.email]);

    useEffect(() => {
        currentFolderRef.current = currentFolder;
    }, [currentFolder]);

    const fetchLabelEmails = useCallback(async (labelId, silent = false, page = null, force = false) => {
        const isFolderChange = currentFolderRef.current !== `label-${labelId}`;
        const targetPage = isFolderChange
            ? (page !== null && page !== undefined ? page : 1)
            : (page !== null && page !== undefined ? page : currentPageRef.current);

        updateCurrentPage(targetPage);
        if (!user) return;
        if (!silent || force) setLoading(true);
        if (force) {
            setIsRefreshing(true);
            isRefreshingRef.current = true;
        }
        // Only clear if the folder actually changed to avoid flashing on auto-polling/refresh
        setEmails(prev => (currentFolderRef.current === `label-${labelId}` ? prev : []));
        setCurrentFolder(`label-${labelId}`);
        currentFolderRef.current = `label-${labelId}`;
        try {
            // Fetching all emails for a specific label
            // Assuming the endpoint follows the pattern /api/mail/labels/{id}
            const res = await api.get(`${API_ENDPOINTS.MAIL.LABELS}/${labelId}?page=${targetPage}&limit=${limit}`);
            if (res.data?.success) {
                const data = res.data.data;
                const totalCount = data.totalCount || 0;
                setTotalEmails(totalCount);

                const totalPages = Math.max(1, Math.ceil(totalCount / limit));
                if (targetPage > totalPages) {
                    const validPage = totalPages;
                    updateCurrentPage(validPage);
                    if (validPage !== targetPage) {
                        fetchLabelEmails(labelId, silent, validPage, force);
                        return;
                    }
                }

                const normalizedEmails = (data.emails || data || []).map(m => {
                    const uidStr = String(m.uid ?? m.id ?? '');
                    const f = m.folderName || `label-${labelId}`;
                    const isStarred = isEmailStarred(uidStr, f, m);
                    const isMarkedRead = readUidsRef.current ? readUidsRef.current.has(uidStr) : false;
                    const isMarkedUnread = unreadUidsRef.current ? unreadUidsRef.current.has(uidStr) : false;
                    const isRead = !isMarkedUnread && (isMarkedRead || (m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false)));
                    return {
                        ...m,
                        isRead,
                        read: isRead,
                        starred: isStarred,
                        isStarred: isStarred
                    };
                }).filter(m => {
                    const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                    return !isTrash;
                });

                normalizedEmails.sort((a, b) => {
                    const dateA = new Date(a.date || a.receivedDate || a.sentDate || 0);
                    const dateB = new Date(b.date || b.receivedDate || b.sentDate || 0);
                    return dateB - dateA;
                });

                setEmails(normalizedEmails);
            }
        } catch (error) {
            console.error('Failed to fetch label emails:', error);
            toast.error(error?.response?.data?.message || 'Failed to load labeled emails');
        } finally {
            if (force) {
                setIsRefreshing(false);
                isRefreshingRef.current = false;
            }
            if (!silent || force) setLoading(false);
        }
    }, [user, limit, updateCurrentPage]);

    const getStarredWithDrafts = useCallback(async (targetPage = 1, pageLimit = limit, force = false) => {
        let apiEmails = [];
        let apiTotalCount = 0;
        let apiSuccess = false;

        try {
            const apiRes = await mailAPI.getStarred(targetPage, pageLimit);
            if (apiRes?.data?.success && apiRes.data.data) {
                const dataObj = apiRes.data.data;
                apiEmails = Array.isArray(dataObj) ? dataObj : (dataObj.emails || []);
                apiTotalCount = typeof dataObj.totalCount === 'number' ? dataObj.totalCount : apiEmails.length;
                apiSuccess = true;
            }
        } catch (err) {
            console.warn('[Starred] Backend mailAPI.getStarred failed:', err?.message || err);
            if (force) {
                throw err;
            }
        }

        const allKnownMap = new Map();
        const storedMap = getStoredStarredEmailsMap(user?.email);
        const currentStarredIds = getStoredStarredIds(user?.email);
        const nextStarredIds = new Set(currentStarredIds);

        // 1. Populate from locally stored starred emails first (manually starred emails)
        storedMap.forEach((email, key) => {
            const isDraft = email.isDraft === true || email.draft === true || email.folderName?.toLowerCase()?.includes('draft');
            if (isDraft) return; // Strictly exclude drafts
            const isTrash = email.folderName?.toLowerCase() === 'trash' || email.isTrash === true || email.deleted === true;
            if (isTrash) return;

            const uidStr = String(email.uid ?? email.id ?? '');
            const normFolder = normalizeFolderName(email.folderName, email) || 'inbox';
            const starKey = getEmailStarKey(uidStr, normFolder, email);

            if (isEmailIdStarred(uidStr, user?.email, normFolder, email)) {
                allKnownMap.set(starKey, {
                    ...email,
                    folderName: email.folderName || normFolder,
                    isDraft: false,
                    draft: false,
                    starred: true,
                    isStarred: true
                });
            }
        });

        // 2. If API succeeded, merge in server starred emails (strictly excluding drafts and trash)
        if (apiSuccess && Array.isArray(apiEmails)) {
            apiEmails.forEach(item => {
                const isDraft = item.isDraft === true || item.draft === true || item.folderName?.toLowerCase()?.includes('draft');
                if (isDraft) return; // Strictly exclude drafts
                const isTrash = item.folderName?.toLowerCase() === 'trash' || item.isTrash === true || item.deleted === true;
                if (isTrash) return;

                const uidStr = String(item.uid ?? item.id ?? '');
                const normFolder = normalizeFolderName(item.folderName || 'inbox', item);
                const starKey = getEmailStarKey(uidStr, normFolder, item);
                if (starKey) {
                    nextStarredIds.add(starKey);
                }

                const formattedEmail = {
                    ...item,
                    folderName: item.folderName || normFolder,
                    isDraft: false,
                    draft: false,
                    starred: true,
                    isStarred: true
                };

                if (starKey && !allKnownMap.has(starKey)) {
                    allKnownMap.set(starKey, formattedEmail);
                }
            });
        }

        saveStoredStarredIds(nextStarredIds, user?.email);
        setStarredIds(nextStarredIds);
        starredIdsRef.current = nextStarredIds;

        // 3. Filter and deduplicate: strictly no drafts, no trash
        const deduplicatedEmails = [];
        const seenStarKeys = new Set();
        for (const e of allKnownMap.values()) {
            const isDraft = e.isDraft === true || e.draft === true || e.folderName?.toLowerCase()?.includes('draft');
            if (isDraft) continue;
            const isTrash = e.folderName?.toLowerCase() === 'trash' || e.isTrash === true || e.deleted === true;
            if (isTrash) continue;

            const uidStr = String(e.uid ?? e.id ?? '');
            const folderNorm = normalizeFolderName(e.folderName, e);
            const dedupeKey = `${folderNorm}:${uidStr}`;
            if (!seenStarKeys.has(dedupeKey)) {
                seenStarKeys.add(dedupeKey);
                deduplicatedEmails.push({
                    ...e,
                    isDraft: false,
                    draft: false,
                    starred: true,
                    isStarred: true
                });
            }
        }

        sortEmailsByDateDesc(deduplicatedEmails);
        const unreadCount = deduplicatedEmails.filter(e => !e.isRead && !e.read).length;

        return {
            data: {
                success: true,
                data: {
                    emails: deduplicatedEmails,
                    totalCount: Math.max(apiTotalCount, deduplicatedEmails.length),
                    unreadCount: unreadCount
                }
            }
        };
    }, [user?.email, limit]);

    const fetchAllInboxEmails = useCallback(async (targetPage = 1, pageLimit = limit) => {
        // Personal accounts or unauthorized users must never access or fetch All Inbox
        if (!canAccessAllInbox(user)) {
            return {
                data: {
                    success: true,
                    data: {
                        emails: [],
                        totalCount: 0,
                        unreadCount: 0
                    }
                }
            };
        }

        const sessionsStr = typeof window !== 'undefined' ? localStorage.getItem('bnx_sessions') : null;
        let sessions = {};
        try {
            sessions = sessionsStr ? JSON.parse(sessionsStr) : {};
        } catch (e) { }

        const currentEmail = (user?.email || '').trim().toLowerCase();
        const authorizedBusinessEmails = getAssociatedBusinessEmails(user, sessions);
        const authorizedEmailSet = new Set(authorizedBusinessEmails.map(e => e.trim().toLowerCase()));

        // Filter sessions so we ONLY query authorized accounts belonging to the current business
        const sessionKeys = Object.keys(sessions).filter(k => authorizedEmailSet.has(k.trim().toLowerCase()));
        let allEmails = [];

        const fetchPromises = sessionKeys.map(async (email) => {
            const sessionObj = sessions[email];
            const token = sessionObj?.accessToken;
            if (!token) return [];
            try {
                const inboxRes = await api.get(API_ENDPOINTS.MAIL.INBOX, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (inboxRes.data?.success) {
                    const dataObj = inboxRes.data.data;
                    const emailsList = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                    return emailsList.map(e => ({
                        ...e,
                        accountEmail: email
                    }));
                }
            } catch (err) {
                console.error(`Failed to fetch all-inbox for ${email}:`, err);
            }
            return [];
        });

        // Ensure the active logged-in business account's inbox is included if not fetched via sessions
        const isCurrentFetched = sessionKeys.some(k => k.trim().toLowerCase() === currentEmail);
        if (!isCurrentFetched && currentEmail) {
            fetchPromises.push((async () => {
                try {
                    const fallbackRes = await mailAPI.getInbox(targetPage, pageLimit);
                    if (fallbackRes?.data?.success) {
                        const dataObj = fallbackRes.data.data;
                        const emailsList = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                        return emailsList.map(e => ({
                            ...e,
                            accountEmail: currentEmail
                        }));
                    }
                } catch (err) {
                    console.error("Failed to fetch fallback inbox for all-inbox:", err);
                }
                return [];
            })());
        }

        const results = await Promise.all(fetchPromises);
        allEmails = results.flat();

        if (allEmails.length === 0 && isCurrentFetched) {
            try {
                const fallbackRes = await mailAPI.getInbox(targetPage, pageLimit);
                if (fallbackRes?.data?.success) {
                    const dataObj = fallbackRes.data.data;
                    const emailsList = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                    allEmails = emailsList.map(e => ({
                        ...e,
                        accountEmail: currentEmail
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch fallback inbox for all-inbox:", err);
            }
        }

        // Strictly keep emails belonging to authorized business accounts/mailboxes only
        const filteredEmails = allEmails.filter(item => {
            if (!item) return false;
            const acc = (item.accountEmail || currentEmail).trim().toLowerCase();
            return authorizedEmailSet.has(acc);
        });

        // Deduplicate emails across accounts/mailboxes
        const uniqueEmails = deduplicateAllInboxEmails(filteredEmails);

        uniqueEmails.sort((a, b) => {
            const dateA = new Date(a.date || a.receivedDate || a.sentDate || 0);
            const dateB = new Date(b.date || b.receivedDate || b.sentDate || 0);
            return dateB - dateA;
        });

        const totalUnreadCount = uniqueEmails.filter(e => !e.isRead && !e.read).length;

        return {
            data: {
                success: true,
                data: {
                    emails: uniqueEmails,
                    totalCount: uniqueEmails.length,
                    unreadCount: totalUnreadCount
                }
            }
        };
    }, [user, limit]);

    const fetchAllMailEmails = useCallback(async (targetPage = 1, pageLimit = limit) => {
        const [inboxRes, sentRes, draftRes, archiveRes, snoozedRes] = await Promise.all([
            mailAPI.getInbox(1, 100).catch(() => ({ data: { success: false } })),
            mailAPI.getSent(1, 100).catch(() => ({ data: { success: false } })),
            mailAPI.getDrafts(1, 100).catch(() => ({ data: { success: false } })),
            mailAPI.getArchive(1, 100).catch(() => ({ data: { success: false } })),
            mailAPI.getSnoozed(1, 100).catch(() => ({ data: { success: false } }))
        ]);

        let mergedEmails = [];

        // 1. Inbox
        if (inboxRes.data?.success) {
            const raw = inboxRes.data.data?.emails || (Array.isArray(inboxRes.data.data) ? inboxRes.data.data : []);
            mergedEmails.push(...raw.map(e => ({
                ...e,
                folderName: e.folderName || 'INBOX'
            })));
        }

        // 2. Sent
        if (sentRes.data?.success) {
            const raw = sentRes.data.data?.emails || (Array.isArray(sentRes.data.data) ? sentRes.data.data : []);
            mergedEmails.push(...raw.map(e => ({
                ...e,
                folderName: e.folderName || 'Sent',
                isSent: true
            })));
        }

        // 3. Drafts
        let starOverrides = {};
        try {
            const stored = localStorage.getItem('bnx_draft_star_overrides');
            if (stored) starOverrides = JSON.parse(stored);
        } catch (e) {}

        const rawDrafts = draftRes.data?.success
            ? (draftRes.data.data?.emails || (Array.isArray(draftRes.data.data) ? draftRes.data.data : []))
            : [];
        
        const allDraftsMap = new Map();
        const registerDraft = (d) => {
            if (!d) return;
            const uidStr = String(d.uid ?? d.id ?? '');
            if (!uidStr || (sentDraftUidsRef.current && sentDraftUidsRef.current.has(uidStr))) return;
            allDraftsMap.set(uidStr, {
                ...d,
                folderName: d.folderName || 'Drafts',
                isDraft: true,
                draft: true,
                starred: starOverrides[uidStr] !== undefined ? starOverrides[uidStr] : (d.starred ?? d.isStarred ?? false)
            });
        };
        rawDrafts.forEach(registerDraft);
        ['draft', 'drafts'].forEach(f => {
            if (pagesCache.current[f]) {
                Object.values(pagesCache.current[f]).forEach(pageList => {
                    if (Array.isArray(pageList)) pageList.forEach(registerDraft);
                });
            }
        });
        allDraftsMap.forEach(d => mergedEmails.push(d));

        // 4. Archive
        if (archiveRes.data?.success) {
            const raw = archiveRes.data.data?.emails || (Array.isArray(archiveRes.data.data) ? archiveRes.data.data : []);
            mergedEmails.push(...raw.map(e => ({
                ...e,
                folderName: e.folderName || 'Archive'
            })));
        }

        // 5. Snoozed
        if (snoozedRes.data?.success) {
            const raw = snoozedRes.data.data?.emails || (Array.isArray(snoozedRes.data.data) ? snoozedRes.data.data : []);
            const syncedSnoozed = syncSnoozedList(raw, user?.email);
            mergedEmails.push(...syncedSnoozed.map(e => ({
                ...e,
                folderName: e.folderName || 'Snoozed'
            })));
        }

        // 6. Filter out trash and spam from All Mail
        mergedEmails = mergedEmails.filter(e => {
            const isTrash = e.folderName?.toLowerCase() === 'trash' || e.folderName?.toLowerCase() === 'deleted' || e.isTrash === true || e.isDeleted === true || e.deleted === true;
            const isSpam = e.folderName?.toLowerCase() === 'spam' || e.isSpam === true || e.spam === true;
            return !isTrash && !isSpam;
        });

        // 7. Deduplicate:
        // Prioritize deduplication by messageId for identical messages (e.g. self-sends in Inbox & Sent)
        // For items without messageId (e.g. drafts or folder-specific items), deduplicate by folderName + uid/id
        const seenMessageIds = new Set();
        const seenFolderUids = new Set();
        const uniqueEmails = [];

        for (const email of mergedEmails) {
            const mid = (email.messageId || email.msgId || '').trim().toLowerCase();
            const uidStr = String(email.uid ?? email.id ?? '');
            const folder = (email.folderName || '').toLowerCase();

            if (mid) {
                if (seenMessageIds.has(mid)) continue;
                seenMessageIds.add(mid);
            } else if (uidStr) {
                const key = `${folder}_${uidStr}`;
                if (seenFolderUids.has(key)) continue;
                seenFolderUids.add(key);
            }
            const isStarred = isEmailStarred(uidStr, folder, email);
            uniqueEmails.push({
                ...email,
                starred: isStarred,
                isStarred: isStarred
            });
        }

        // 8. Sort descending by date
        uniqueEmails.sort((a, b) => {
            const dateA = new Date(a.date || a.sentDate || a.receivedDate || a.createdAt || a.updatedAt || 0);
            const dateB = new Date(b.date || b.sentDate || b.receivedDate || b.createdAt || b.updatedAt || 0);
            return dateB - dateA;
        });

        const unreadCount = uniqueEmails.filter(e => !e.isRead && !e.read && !e.isDraft).length;

        return {
            data: {
                success: true,
                data: {
                    emails: uniqueEmails,
                    totalCount: uniqueEmails.length,
                    unreadCount: unreadCount
                }
            }
        };
    }, [limit]);

    const fetchEmailsSilently = useCallback(async (folder, page = null) => {
        if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
        const folderKey = folder.toLowerCase();
        const targetPage = (page !== null && page !== undefined) ? page : (currentFolderRef.current.toLowerCase() === folderKey ? currentPageRef.current : 1);
        const reqKey = `${folderKey}_${targetPage}`;

        // Avoid duplicate concurrent silent refreshes for same folder & page
        if (silentFetchInFlight.current.has(reqKey)) {
            return;
        }
        silentFetchInFlight.current.add(reqKey);

        try {
            let res;
            switch (folderKey) {
                case 'inbox': res = await mailAPI.getInbox(targetPage, limit); break;
                case 'all-inbox':
                case 'allinbox': res = await fetchAllInboxEmails(targetPage, limit); break;
                case 'all-mail':
                case 'allmail': res = await fetchAllMailEmails(targetPage, limit); break;
                case 'sent': res = await mailAPI.getSent(targetPage, limit); break;
                case 'draft':
                case 'drafts': res = await mailAPI.getDrafts(targetPage, limit); break;
                case 'starred': res = await getStarredWithDrafts(targetPage, limit, false); break;
                case 'trash': res = await mailAPI.getTrash(targetPage, limit); break;
                case 'spam': res = await mailAPI.getSpam(targetPage, limit); break;
                case 'snoozed': res = await mailAPI.getSnoozed(targetPage, limit); break;
                case 'archive': res = await mailAPI.getArchive(targetPage, limit); break;
                case 'scheduled': res = await mailAPI.getScheduled(); break;
                case 'unread': {
                    try {
                        res = await mailAPI.getUnread(targetPage, limit);
                    } catch (err) {
                        res = await mailAPI.getInbox(targetPage, limit);
                    }
                    if (res?.data?.success && res.data.data) {
                        const rawList = res.data.data.emails || (Array.isArray(res.data.data) ? res.data.data : []);
                        const unreadItems = rawList.filter(m => {
                            const uStr = String(m.uid ?? m.id ?? '');
                            if (unreadUidsRef.current?.has(uStr)) return true;
                            if (readUidsRef.current?.has(uStr)) return false;
                            return !m.isRead && !m.read;
                        });
                        res.data.data = {
                            ...(Array.isArray(res.data.data) ? {} : res.data.data),
                            emails: unreadItems,
                            totalCount: unreadItems.length,
                            unreadCount: unreadItems.length
                        };
                    }
                    break;
                }
                default: res = await mailAPI.getInbox(targetPage, limit);
            }

            if (res && res.data?.success) {
                const data = res.data.data || {};
                const rawEmails = Array.isArray(data) ? data : (data.emails || []);
                const isDraftFolder = folderKey === 'draft' || folderKey === 'drafts';
                let normalizedEmails = rawEmails.map(m => {
                    const uidStr = String(m.uid ?? m.id ?? '');
                    const isDraftItem = isDraftFolder || Boolean(m.isDraft || m.draft || m.folderName?.toLowerCase()?.includes('draft'));
                    const f = isDraftItem ? 'draft' : (m.folderName || folderKey);
                    const isStarred = folderKey === 'starred' ? true : isEmailStarred(uidStr, f, m);
                    const isMarkedRead = readUidsRef.current ? readUidsRef.current.has(uidStr) : false;
                    const isMarkedUnread = unreadUidsRef.current ? unreadUidsRef.current.has(uidStr) : false;
                    const isRead = !isMarkedUnread && (isMarkedRead || (m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false)));
                    return {
                        ...m,
                        folderName: isDraftItem ? 'Drafts' : (m.folderName || folderKey),
                        isDraft: isDraftItem,
                        draft: isDraftItem,
                        isRead,
                        read: isRead,
                        starred: isStarred,
                        isStarred: isStarred
                    };
                });

                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (isDraftFolder) {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        return !sentDraftUidsRef.current.has(uidStr);
                    });
                }

                if (folderKey === 'sent') {
                    const seenSentUids = new Set();
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (!uidStr) return true;
                        if (seenSentUids.has(uidStr)) return false;
                        seenSentUids.add(uidStr);
                        return true;
                    }).map(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (sentEmailLabelsRef.current && sentEmailLabelsRef.current[uidStr] !== undefined) {
                            return {
                                ...m,
                                labels: sentEmailLabelsRef.current[uidStr]
                            };
                        }
                        return m;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
                }

                normalizedEmails = attachStoredSystemLabels(normalizedEmails);

                if (folderKey === 'scheduled') {
                    normalizedEmails = normalizedEmails.filter(isEmailValidScheduled);
                }

                if (folderKey === 'snoozed') {
                    normalizedEmails = syncSnoozedList(normalizedEmails, user?.email);
                } else if (['inbox', 'all-inbox', 'allinbox'].includes(folderKey)) {
                    normalizedEmails = syncInboxList(normalizedEmails, user?.email);
                }

                // Always sort emails chronologically descending by original date (newest first), unless snoozed (sorted by scheduled return time)
                if (folderKey !== 'snoozed') {
                    sortEmailsByDateDesc(normalizedEmails);
                }

                if (user?.email) {
                    const loginEmail = user.email.trim().toLowerCase();
                    const isEmailMatch = (emailField, currentEmail) => {
                        if (!emailField || !currentEmail) return false;
                        const addrs = extractEmailAddresses(emailField);
                        return addrs.includes(currentEmail);
                    };

                    if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(folderKey)) {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const targetEmail = (['all-inbox', 'allinbox'].includes(folderKey) && m.accountEmail)
                                ? m.accountEmail.trim().toLowerCase()
                                : loginEmail;
                            const isSenderMe = isEmailMatch(m.senderEmail, targetEmail) || isEmailMatch(m.from, targetEmail);
                            const isRecipientMe = isEmailMatch(m.recipientEmail, targetEmail) || isEmailMatch(m.to, targetEmail) || isEmailMatch(m.cc, targetEmail) || isEmailMatch(m.bcc, targetEmail);
                            return !isSenderMe || isRecipientMe;
                        });
                    } else if (folderKey === 'sent') {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const isSenderMe = isEmailMatch(m.senderEmail, loginEmail) || isEmailMatch(m.from, loginEmail);
                            return isSenderMe;
                        });
                    }
                }

                if (folderKey === 'sent' && user?.email) {
                    normalizedEmails.forEach(sMail => {
                        if (isSelfSentEmail(sMail, user.email)) {
                            saveStoredSelfSentEmail(sMail, user.email);
                        }
                    });
                }

                normalizedEmails = syncSelfSentEmails(
                    folderKey,
                    normalizedEmails,
                    user?.email,
                    isEmailStarred,
                    readUidsRef.current,
                    unreadUidsRef.current
                );

                if (folderKey === 'unread') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uStr = String(m.uid ?? m.id ?? '');
                        if (unreadUidsRef.current?.has(uStr)) return true;
                        if (readUidsRef.current?.has(uStr)) return false;
                        return !m.isRead && !m.read;
                    });
                }

                // Calculate dynamic total count reflecting actual filtered unique emails
                let calculatedTotal = normalizedEmails.length;
                if (['all-inbox', 'allinbox', 'spam', 'all-mail', 'allmail', 'snoozed'].includes(folderKey)) {
                    calculatedTotal = normalizedEmails.length;
                } else if (data.totalCount !== undefined && data.totalCount !== null) {
                    const rawCount = rawEmails.length;
                    const filteredDiff = Math.max(0, rawCount - normalizedEmails.length);
                    calculatedTotal = Math.max(normalizedEmails.length, data.totalCount - filteredDiff);
                }

                // Update caches
                if (!pagesCache.current[folderKey]) pagesCache.current[folderKey] = {};
                pagesCache.current[folderKey][targetPage] = normalizedEmails;
                pagesCache.current[`${folderKey}_total`] = calculatedTotal;

                // Sync unread counts in real-time across all tabs and folders
                const countKey = folderKey.replace('-', '').replace(' ', '');
                if (countKey === 'snoozed') {
                    setUnreadCounts(prev => ({
                        ...prev,
                        snoozed: normalizedEmails.length
                    }));
                } else if (countKey === 'inbox' || countKey === 'unread') {
                    const unread = (targetPage === 1 && normalizedEmails.length === 0)
                        ? 0
                        : (data.unreadCount !== undefined ? data.unreadCount : normalizedEmails.filter(e => !e.isRead).length);
                    setUnreadCounts(prev => ({
                        ...prev,
                        inbox: unread,
                        unread: unread
                    }));
                } else if (countKey === 'spam') {
                    const unread = normalizedEmails.filter(e => !e.isRead).length;
                    setUnreadCounts(prev => ({
                        ...prev,
                        spam: unread
                    }));
                } else if (countKey === 'allinbox') {
                    const unread = canAccessAllInbox(user) ? normalizedEmails.filter(e => !e.isRead).length : 0;
                    setUnreadCounts(prev => ({
                        ...prev,
                        allinbox: unread
                    }));
                } else if (countKey === 'allmail') {
                    const unread = normalizedEmails.filter(e => !e.isRead && !e.isDraft).length;
                    setUnreadCounts(prev => ({
                        ...prev,
                        allmail: unread
                    }));
                }

                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    setTotalEmails(calculatedTotal);
                    const pendingUids = new Set((pendingUndoDeleteRef.current?.items || []).map(it => String(it.uid)));
                    const filteredScreen = pendingUids.size > 0
                        ? normalizedEmails.filter(e => !pendingUids.has(String(e.uid)) && !pendingUids.has(String(e.id)))
                        : normalizedEmails;
                    setEmails(filteredScreen);
                }
            }
        } catch (e) {
            if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
                // Timeout on silent refresh, will retry on next cycle
            } else if (e?.message === 'Network Error' || e?.code === 'ERR_NETWORK') {
                // Transient network glitch or connection reset; background sync will retry on next interval
            } else if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
                console.warn(`[Silent Refresh] Background sync skipped for ${folder}:`, e?.message || e);
            }
        } finally {
            silentFetchInFlight.current.delete(reqKey);
        }
    }, [user, limit, getStarredWithDrafts, fetchAllInboxEmails, fetchAllMailEmails]);

    const fetchEmails = useCallback(async (folder = currentFolderRef.current, silent = false, page = null, force = false) => {
        const folderKey = (folder || currentFolderRef.current).toLowerCase();

        if (folderKey.startsWith('label-')) {
            const labelId = folder.replace(/^label-/i, '');
            return await fetchLabelEmails(labelId, silent, page, force);
        }

        const isFolderChange = currentFolderRef.current.toLowerCase() !== folderKey;
        const targetPage = isFolderChange
            ? (page !== null && page !== undefined ? page : 1)
            : (page !== null && page !== undefined ? page : currentPageRef.current);
        
        updateCurrentPage(targetPage);
        
        if (!user) return;

        if (force) {
            invalidateCache(folderKey);
            setIsRefreshing(true);
            isRefreshingRef.current = true;
        } else if (pagesCache.current[folderKey] && pagesCache.current[folderKey][targetPage]) {
            // Instant render: if in-memory cache has data for this folder & page, display it immediately!
            const cachedList = pagesCache.current[folderKey][targetPage];
            const cachedTotal = pagesCache.current[`${folderKey}_total`] ?? cachedList.length;
            setEmails(cachedList);
            setTotalEmails(cachedTotal);
            setCurrentFolder(folder);
            currentFolderRef.current = folder;
            setLoading(false);
            fetchEmailsSilently(folder, targetPage);
            return;
        }

        if (!silent || force) {
            setLoading(true);
        }
        
        // Clear emails & reset total count if switching folders to avoid flashing stale content
        if (isFolderChange) {
            setEmails([]);
            setTotalEmails(0);
        }
        setCurrentFolder(folder);
        currentFolderRef.current = folder;

        try {
            let res;
            switch (folder.toLowerCase()) {
                case 'inbox': res = await mailAPI.getInbox(targetPage, limit); break;
                case 'sent': res = await mailAPI.getSent(targetPage, limit); break;
                case 'draft':
                case 'drafts': res = await mailAPI.getDrafts(targetPage, limit); break;
                case 'starred': res = await getStarredWithDrafts(targetPage, limit, force); break;
                case 'trash': res = await mailAPI.getTrash(targetPage, limit); break;
                case 'spam': res = await mailAPI.getSpam(targetPage, limit); break;
                case 'snoozed': res = await mailAPI.getSnoozed(targetPage, limit); break;
                case 'archive': res = await mailAPI.getArchive(targetPage, limit); break;
                case 'scheduled': res = await mailAPI.getScheduled(); break;
                case 'unread': {
                    try {
                        res = await mailAPI.getUnread(targetPage, limit);
                    } catch (err) {
                        res = await mailAPI.getInbox(targetPage, limit);
                    }
                    if (res?.data?.success && res.data.data) {
                        const rawList = res.data.data.emails || (Array.isArray(res.data.data) ? res.data.data : []);
                        const unreadItems = rawList.filter(m => {
                            const uStr = String(m.uid ?? m.id ?? '');
                            if (unreadUidsRef.current?.has(uStr)) return true;
                            if (readUidsRef.current?.has(uStr)) return false;
                            return !m.isRead && !m.read;
                        });
                        res.data.data = {
                            ...(Array.isArray(res.data.data) ? {} : res.data.data),
                            emails: unreadItems,
                            totalCount: unreadItems.length,
                            unreadCount: unreadItems.length
                        };
                    }
                    break;
                }
                case 'all-inbox':
                case 'allinbox': {
                    res = await fetchAllInboxEmails(targetPage, limit);
                    break;
                }
                case 'all-mail':
                case 'allmail': {
                    res = await fetchAllMailEmails(targetPage, limit);
                    break;
                }
                default: res = await mailAPI.getInbox(targetPage, limit);
            }

            if (res.data?.success) {
                const data = res.data.data || {};
                const rawEmails = Array.isArray(data) ? data : (data.emails || []);
                const isDraftFolder = folderKey === 'draft' || folderKey === 'drafts';
                let normalizedEmails = rawEmails.map(m => {
                    const uidStr = String(m.uid ?? m.id ?? '');
                    const isDraftItem = isDraftFolder || Boolean(m.isDraft || m.draft || m.folderName?.toLowerCase()?.includes('draft'));
                    const f = isDraftItem ? 'draft' : (m.folderName || folderKey);
                    const isStarred = folderKey === 'starred' ? true : isEmailStarred(uidStr, f, m);
                    const isMarkedRead = readUidsRef.current ? readUidsRef.current.has(uidStr) : false;
                    const isMarkedUnread = unreadUidsRef.current ? unreadUidsRef.current.has(uidStr) : false;
                    const isRead = !isMarkedUnread && (isMarkedRead || (m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false)));
                    return {
                        ...m,
                        folderName: isDraftItem ? 'Drafts' : (m.folderName || folderKey),
                        isDraft: isDraftItem,
                        draft: isDraftItem,
                        isRead,
                        read: isRead,
                        starred: isStarred,
                        isStarred: isStarred
                    };
                });

                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (isDraftFolder) {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        return !sentDraftUidsRef.current.has(uidStr);
                    });
                }

                if (folderKey === 'sent') {
                    const seenSentUids = new Set();
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (!uidStr) return true;
                        if (seenSentUids.has(uidStr)) return false;
                        seenSentUids.add(uidStr);
                        return true;
                    }).map(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (sentEmailLabelsRef.current && sentEmailLabelsRef.current[uidStr] !== undefined) {
                            return {
                                ...m,
                                labels: sentEmailLabelsRef.current[uidStr]
                            };
                        }
                        return m;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
                }

                normalizedEmails = attachStoredSystemLabels(normalizedEmails);

                if (folderKey === 'scheduled') {
                    normalizedEmails = normalizedEmails.filter(isEmailValidScheduled);
                }

                if (folderKey === 'snoozed') {
                    normalizedEmails = syncSnoozedList(normalizedEmails, user?.email);
                } else if (['inbox', 'all-inbox', 'allinbox'].includes(folderKey)) {
                    normalizedEmails = syncInboxList(normalizedEmails, user?.email);
                }

                // Always sort emails chronologically descending by original date (newest first), unless snoozed (sorted by scheduled return time)
                if (folderKey !== 'snoozed') {
                    sortEmailsByDateDesc(normalizedEmails);
                }

                // Filter logic for Inbox and Sent folders based on currently logged-in user's email ID
                const lowerFolder = folder.toLowerCase();
                if (user?.email) {
                    const loginEmail = user.email.trim().toLowerCase();
                    const isEmailMatch = (emailField, currentEmail) => {
                        if (!emailField || !currentEmail) return false;
                        const addrs = extractEmailAddresses(emailField);
                        return addrs.includes(currentEmail);
                    };

                    if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(lowerFolder)) {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const targetEmail = (['all-inbox', 'allinbox'].includes(lowerFolder) && m.accountEmail)
                                ? m.accountEmail.trim().toLowerCase()
                                : loginEmail;
                            const isSenderMe = isEmailMatch(m.senderEmail, targetEmail) || isEmailMatch(m.from, targetEmail);
                            const isRecipientMe = isEmailMatch(m.recipientEmail, targetEmail) || isEmailMatch(m.to, targetEmail) || isEmailMatch(m.cc, targetEmail) || isEmailMatch(m.bcc, targetEmail);
                            
                            // Keep if I am NOT the sender, OR if I am both the sender and the recipient (self-send)
                            return !isSenderMe || isRecipientMe;
                        });
                    } else if (lowerFolder === 'sent') {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const isSenderMe = isEmailMatch(m.senderEmail, loginEmail) || isEmailMatch(m.from, loginEmail);
                            return isSenderMe;
                        });
                    }
                }

                if (lowerFolder === 'sent' && user?.email) {
                    normalizedEmails.forEach(sMail => {
                        if (isSelfSentEmail(sMail, user.email)) {
                            saveStoredSelfSentEmail(sMail, user.email);
                        }
                    });
                }

                normalizedEmails = syncSelfSentEmails(
                    lowerFolder,
                    normalizedEmails,
                    user?.email,
                    isEmailStarred,
                    readUidsRef.current,
                    unreadUidsRef.current
                );

                if (lowerFolder === 'unread') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const uStr = String(m.uid ?? m.id ?? '');
                        if (unreadUidsRef.current?.has(uStr)) return true;
                        if (readUidsRef.current?.has(uStr)) return false;
                        return !m.isRead && !m.read;
                    });
                }
                
                // Calculate dynamic total count reflecting actual filtered unique emails
                let calculatedTotal = normalizedEmails.length;
                if (['all-inbox', 'allinbox', 'spam', 'all-mail', 'allmail', 'scheduled', 'snoozed'].includes(folderKey)) {
                    calculatedTotal = normalizedEmails.length;
                } else if (data.totalCount !== undefined && data.totalCount !== null) {
                    const rawCount = rawEmails.length;
                    const filteredDiff = Math.max(0, rawCount - normalizedEmails.length);
                    calculatedTotal = Math.max(normalizedEmails.length, data.totalCount - filteredDiff);
                }

                // Update Cache
                if (!pagesCache.current[folderKey]) pagesCache.current[folderKey] = {};
                pagesCache.current[folderKey][targetPage] = normalizedEmails;
                pagesCache.current[`${folderKey}_total`] = calculatedTotal;
                
                // Sync unread counts in real-time across all tabs and folders
                const countKey = folderKey.replace('-', '').replace(' ', '');
                if (countKey === 'snoozed') {
                    setUnreadCounts(prev => ({
                        ...prev,
                        snoozed: normalizedEmails.length
                    }));
                } else {
                    const unread = folderKey === 'spam'
                        ? normalizedEmails.filter(e => !e.isRead).length
                        : (folderKey === 'scheduled' ? normalizedEmails.length : (data.unreadCount !== undefined ? data.unreadCount : normalizedEmails.filter(e => !e.isRead).length));

                    setUnreadCounts(prev => {
                        const next = { ...prev, [countKey]: unread };
                        if (countKey === 'inbox') {
                            next.unread = unread;
                        } else if (countKey === 'unread') {
                            next.inbox = unread;
                        } else if (countKey === 'allinbox') {
                            next.allinbox = canAccessAllInbox(user) ? unread : 0;
                        } else if (countKey === 'allmail') {
                            next.allmail = unread;
                        }
                        return next;
                    });
                }

                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    setTotalEmails(calculatedTotal);

                    const totalPages = Math.max(1, Math.ceil(calculatedTotal / limit));
                    if (targetPage > totalPages) {
                        const validPage = totalPages;
                        updateCurrentPage(validPage);
                        if (validPage !== targetPage) {
                            fetchEmails(folder, silent, validPage, force);
                            return;
                        }
                    }

                    const pendingUids = new Set((pendingUndoDeleteRef.current?.items || []).map(it => String(it.uid)));
                    const filteredScreen = pendingUids.size > 0
                        ? normalizedEmails.filter(e => !pendingUids.has(String(e.uid)) && !pendingUids.has(String(e.id)))
                        : normalizedEmails;
                    setEmails(filteredScreen);
                }
            }
        } catch (error) {
            if (!silent) {
                console.error(`Failed to fetch ${folder}:`, error);
                toast.error(error?.response?.data?.message || (force ? `Failed to refresh ${folder}` : `Failed to load ${folder}`));
            }
        } finally {
            if (force) {
                setIsRefreshing(false);
                isRefreshingRef.current = false;
            }
            if ((!silent || force) && currentFolderRef.current.toLowerCase() === folderKey) setLoading(false);
        }
    }, [user, limit, updateCurrentPage, fetchEmailsSilently, getStarredWithDrafts, fetchAllInboxEmails, fetchAllMailEmails, invalidateCache, fetchLabelEmails]);

    const refreshEmails = useCallback(async (folder) => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setLoading(true);

        const targetFolder = folder || currentFolderRef.current || 'inbox';
        const targetPage = currentPageRef.current || 1;

        try {
            if (targetFolder.toLowerCase().startsWith('label-')) {
                const labelId = targetFolder.replace(/^label-/i, '');
                await fetchLabelEmails(labelId, false, targetPage, true);
            } else {
                await fetchEmails(targetFolder, false, targetPage, true);
            }
        } catch (err) {
            console.error(`Failed to refresh ${targetFolder}:`, err);
            toast.error(err?.response?.data?.message || `Failed to refresh ${targetFolder}`);
        } finally {
            setIsRefreshing(false);
            setLoading(false);
            isRefreshingRef.current = false;
        }
    }, [fetchEmails, fetchLabelEmails]);

    const fetchLabels = useCallback(async () => {
        if (!user) {
            setLabels([]);
            return;
        }
        try {
            const res = await mailAPI.getLabels();
            if (res.data?.success) {
                setLabels(res.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch labels:', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            setLabels([]);
            fetchLabels();
        } else {
            setLabels([]);
        }
    }, [user, fetchLabels]);

    useEffect(() => {
        if (user?.email) {
            fetchEmailsSilently('sent');
        }
    }, [user?.email, fetchEmailsSilently]);

    const handlePageChange = useCallback((newPage) => {
        if (currentFolderRef.current.startsWith('label-')) {
            const labelId = currentFolderRef.current.replace('label-', '');
            fetchLabelEmails(labelId, false, newPage);
        } else {
            fetchEmails(currentFolderRef.current, false, newPage);
        }
    }, [fetchLabelEmails, fetchEmails]);

    // Background auto-polling for new emails and unread counts every 15 seconds
    useEffect(() => {
        if (!user) return;

        const syncAllMailStatus = () => {
            if (document.hidden || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
            const isChatMode = typeof window !== 'undefined' && 
                (window.location.pathname.startsWith('/colab') || 
                 window.location.pathname.startsWith('/chat') || 
                 window.location.pathname.startsWith('/casbox'));
            if (isChatMode) return;

            const cur = currentFolderRef.current.toLowerCase();
            if (cur.startsWith('label-')) {
                const labelId = cur.replace('label-', '');
                fetchLabelEmails(labelId, true, currentPageRef.current);
            } else {
                fetchEmails(cur, true, currentPageRef.current);
            }

            // Always keep unread and inbox counts synced in the background
            if (cur !== 'inbox') {
                fetchEmailsSilently('inbox');
            }
            if (cur !== 'unread') {
                fetchEmailsSilently('unread');
            }
            if (cur !== 'sent') {
                fetchEmailsSilently('sent');
            }

            // If there are starred scheduled emails that have reached delivery time, fetch sent emails to migrate stars
            const map = getStoredStarredEmailsMap(user?.email);
            let hasPastDueScheduled = false;
            const now = Date.now();
            for (const [k, item] of map.entries()) {
                if (k.startsWith('scheduled:') || item?.folderName?.toLowerCase() === 'scheduled') {
                    const sTime = new Date(item.scheduledAt || item.date || item.createdAt || 0).getTime();
                    if (sTime <= now) {
                        hasPastDueScheduled = true;
                        break;
                    }
                }
            }
            if (hasPastDueScheduled && cur !== 'sent') {
                fetchEmailsSilently('sent');
            }

            // Check if any snoozed emails have reached wake-up time
            const dueSnoozed = getDueSnoozedEmails(user?.email);
            if (dueSnoozed.length > 0) {
                dueSnoozed.forEach(item => {
                    markEmailReturned(user?.email, item.uid || item.messageId);
                    if (notifPrefsRef.current?.snoozedNotifications) {
                        toast(`Snoozed email "${item.subject || 'Reminder'}" is now back in Inbox`, {
                            icon: '⏰',
                            id: `snooze-wake-${item.uid || item.messageId}`
                        });
                    }
                });
                invalidateCache('inbox');
                invalidateCache('all-inbox');
                invalidateCache('allinbox');
                invalidateCache('all-mail');
                invalidateCache('allmail');
                invalidateCache('snoozed');
                invalidateCache('unread');

                // Synchronize sidebar Snoozed count
                setUnreadCounts(prev => ({
                    ...prev,
                    snoozed: getActiveSnoozedCount(user?.email)
                }));

                if (currentFolderRef.current?.toLowerCase() === 'snoozed') {
                    const dueIds = new Set(dueSnoozed.map(d => String(d.uid)));
                    setEmails(prev => prev.filter(m => !dueIds.has(String(m.uid))));
                    setTotalEmails(prev => Math.max(0, prev - dueSnoozed.length));
                } else if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(currentFolderRef.current?.toLowerCase())) {
                    fetchEmailsSilently(currentFolderRef.current);
                }
            }
        };

        const interval = setInterval(syncAllMailStatus, 15000);

        return () => clearInterval(interval);
    }, [user, fetchEmails, fetchEmailsSilently, fetchLabelEmails, invalidateCache]);

    useEffect(() => {
        if (!user) return;
        const checkSnoozeReturns = () => {
            const dueSnoozed = getDueSnoozedEmails(user?.email);
            if (dueSnoozed.length > 0) {
                dueSnoozed.forEach(item => {
                    markEmailReturned(user?.email, item.uid || item.messageId);
                    if (notifPrefsRef.current?.snoozedNotifications) {
                        toast(`Snoozed email "${item.subject || 'Reminder'}" is now back in Inbox`, {
                            icon: '⏰',
                            id: `snooze-wake-${item.uid || item.messageId}`
                        });
                    }
                });
                invalidateCache('snoozed');
                invalidateCache('inbox');
                invalidateCache('all-inbox');
                invalidateCache('allinbox');
                invalidateCache('all-mail');
                invalidateCache('allmail');
                invalidateCache('unread');

                // Synchronize sidebar Snoozed count
                setUnreadCounts(prev => ({
                    ...prev,
                    snoozed: getActiveSnoozedCount(user?.email)
                }));

                if (currentFolderRef.current?.toLowerCase() === 'snoozed') {
                    const dueIds = new Set(dueSnoozed.map(d => String(d.uid)));
                    setEmails(prev => prev.filter(m => !dueIds.has(String(m.uid))));
                    setTotalEmails(prev => Math.max(0, prev - dueSnoozed.length));
                } else if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(currentFolderRef.current?.toLowerCase())) {
                    fetchEmailsSilently(currentFolderRef.current);
                }
            } else {
                // Keep sidebar Snoozed count synchronized with active snoozed list
                const currentCount = getActiveSnoozedCount(user?.email);
                setUnreadCounts(prev => {
                    if (prev.snoozed !== currentCount) {
                        return { ...prev, snoozed: currentCount };
                    }
                    return prev;
                });
            }
        };

        const timer = setInterval(checkSnoozeReturns, 5000);
        return () => clearInterval(timer);
    }, [user, fetchEmailsSilently, invalidateCache]);

    const handleToggleStar = useCallback(async (uid, folder, emailObj = null) => {
        if (!uid && uid !== 0) return;
        const strUid = String(uid);
        const isCurrentDraftFolder = currentFolderRef.current?.toLowerCase() === 'draft' || currentFolderRef.current?.toLowerCase() === 'drafts';
        const isTargetDraft = folder === 'draft' || folder === 'drafts' || isCurrentDraftFolder;
        const targetFolder = isTargetDraft ? 'draft' : normalizeFolderName(folder || currentFolderRef.current || 'inbox');

        // 1. Determine target email object matching UID and folder
        let targetEmail = emailObj || emails.find(m => 
            String(m.uid ?? m.id) === strUid && 
            (!targetFolder || (isTargetDraft ? (m.isDraft || m.draft || m.folderName?.toLowerCase()?.includes('draft') || isCurrentDraftFolder) : normalizeFolderName(m.folderName, m) === targetFolder))
        );
        if (!targetEmail) {
            targetEmail = emails.find(m => String(m.uid ?? m.id) === strUid);
        }
        if (!targetEmail && targetFolder === 'scheduled' && typeof window !== 'undefined' && window.__bnx_scheduled_cache) {
            const list = window.__bnx_scheduled_cache.emails || [];
            targetEmail = list.find(m => String(m.uid ?? m.id) === strUid);
        }
        if (!targetEmail && pagesCache.current) {
            const folderCachesToCheck = isTargetDraft ? ['draft', 'drafts'] : (targetFolder ? [targetFolder] : []);
            for (const f of folderCachesToCheck) {
                if (pagesCache.current[f]) {
                    for (const p of Object.values(pagesCache.current[f])) {
                        if (Array.isArray(p)) {
                            const found = p.find(m => String(m.uid ?? m.id) === strUid);
                            if (found) { targetEmail = found; break; }
                        }
                    }
                }
                if (targetEmail) break;
            }
        }
        if (!targetEmail) {
            const storedMap = getStoredStarredEmailsMap(user?.email);
            const starKey = getEmailStarKey(strUid, targetFolder);
            if (storedMap.has(starKey)) {
                targetEmail = storedMap.get(starKey);
            } else if (storedMap.has(`draft:${strUid}`)) {
                targetEmail = storedMap.get(`draft:${strUid}`);
            } else if (storedMap.has(strUid)) {
                targetEmail = storedMap.get(strUid);
            }
        }
        if (!targetEmail && pagesCache.current) {
            for (const f of ['inbox', 'all-inbox', 'starred', 'sent', 'draft', 'drafts', 'archive', 'all-mail', 'allmail']) {
                if (pagesCache.current[f]) {
                    for (const p of Object.values(pagesCache.current[f])) {
                        if (Array.isArray(p)) {
                            const found = p.find(m => String(m.uid ?? m.id) === strUid && (!targetFolder || normalizeFolderName(m.folderName, m) === targetFolder));
                            if (found) { targetEmail = found; break; }
                        }
                    }
                }
                if (targetEmail) break;
            }
        }

        // 2. Toggle star status in frontend localStorage
        const emailFolder = isTargetDraft ? 'draft' : normalizeFolderName(targetEmail?.folderName || targetFolder, targetEmail);
        const starKey = getEmailStarKey(strUid, emailFolder, targetEmail);
        const isCurrentlyStarred = isEmailStarred(strUid, emailFolder, targetEmail);
        const nextStarred = !isCurrentlyStarred;

        const currentSet = getStoredStarredIds(user?.email);
        const nextSet = new Set(currentSet);
        if (nextStarred) {
            nextSet.add(starKey);
            if (emailFolder === 'draft') {
                nextSet.add(`draft:${strUid}`);
            }
            const emailToSave = targetEmail ? {
                ...targetEmail,
                folderName: emailFolder === 'draft' ? 'Drafts' : (targetEmail.folderName || emailFolder),
                isDraft: emailFolder === 'draft' ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                draft: emailFolder === 'draft' ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                starred: true,
                isStarred: true
            } : {
                uid: strUid,
                id: strUid,
                folderName: emailFolder === 'draft' ? 'Drafts' : emailFolder,
                isDraft: emailFolder === 'draft',
                draft: emailFolder === 'draft',
                starred: true,
                isStarred: true
            };
            saveStoredStarredEmail(emailToSave, user?.email, emailFolder);
        } else {
            nextSet.delete(starKey);
            if (emailFolder === 'draft') {
                nextSet.delete(`draft:${strUid}`);
                nextSet.delete(`drafts:${strUid}`);
            }
            if (emailFolder === 'sent') {
                nextSet.delete(`sent:${strUid}`);
                const map = getStoredStarredEmailsMap(user?.email);
                for (const [k, item] of map.entries()) {
                    if (k.startsWith('scheduled:') && matchesScheduledAndSentEmail(item, targetEmail || { uid: strUid, folderName: 'sent' })) {
                        nextSet.delete(k);
                        const sUid = String(item.uid ?? item.id ?? '');
                        if (sUid) {
                            nextSet.delete(`scheduled:${sUid}`);
                            nextSet.delete(sUid);
                        }
                    }
                }
            }
            if (emailFolder === 'scheduled') {
                nextSet.delete(`scheduled:${strUid}`);
                const map = getStoredStarredEmailsMap(user?.email);
                for (const [k, item] of map.entries()) {
                    if (k.startsWith('sent:') && matchesScheduledAndSentEmail(targetEmail || { uid: strUid, folderName: 'scheduled' }, item)) {
                        nextSet.delete(k);
                        const sUid = String(item.uid ?? item.id ?? '');
                        if (sUid) {
                            nextSet.delete(`sent:${sUid}`);
                            nextSet.delete(sUid);
                        }
                        removeStoredStarredEmail(sUid, user?.email, 'sent', item);
                    }
                }
            }
            nextSet.delete(strUid);
            removeStoredStarredEmail(strUid, user?.email, emailFolder, targetEmail);
        }

        saveStoredStarredIds(nextSet, user?.email);
        setStarredIds(nextSet);
        starredIdsRef.current = nextSet;

        // Also update draft star overrides if it's a draft
        const isDraft = emailFolder === 'draft' || targetEmail?.isDraft === true || targetEmail?.draft === true;
        if (isDraft) {
            try {
                const saveOverride = (key) => {
                    const stored = localStorage.getItem(key);
                    const overrides = stored ? JSON.parse(stored) : {};
                    overrides[strUid] = nextStarred;
                    overrides[`draft:${strUid}`] = nextStarred;
                    localStorage.setItem(key, JSON.stringify(overrides));
                };
                saveOverride('bnx_draft_star_overrides');
                if (user?.email) {
                    saveOverride(getUserKey('bnx_draft_star_overrides', user.email));
                }
            } catch (e) {}
        }

        const isTargetMatch = (m) => {
            const mUid = String(m.uid ?? m.id ?? '');
            if (mUid !== strUid) return false;
            const isMDraft = isDraft || m.isDraft === true || m.draft === true || m.folderName?.toLowerCase()?.includes('draft') || isCurrentDraftFolder;
            const mFolder = isMDraft ? 'draft' : normalizeFolderName(m.folderName, m);
            if (emailFolder && mFolder && mFolder !== emailFolder) return false;
            return true;
        };

        // 3. Update active screen emails immediately
        setEmails(prev => {
            if (currentFolderRef.current?.toLowerCase() === 'starred') {
                if (!nextStarred) {
                    return prev.filter(m => !isTargetMatch(m));
                }
                const exists = prev.some(m => isTargetMatch(m));
                if (!exists && targetEmail) {
                    return [{
                        ...targetEmail,
                        folderName: isDraft ? 'Drafts' : (targetEmail.folderName || 'starred'),
                        isDraft: isDraft ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                        draft: isDraft ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                        starred: true,
                        isStarred: true
                    }, ...prev];
                }
                return prev;
            }
            return prev.map(m => isTargetMatch(m) ? {
                ...m,
                folderName: isDraft ? 'Drafts' : (m.folderName || emailFolder),
                isDraft: isDraft ? true : Boolean(m.isDraft || m.draft),
                draft: isDraft ? true : Boolean(m.isDraft || m.draft),
                starred: nextStarred,
                isStarred: nextStarred
            } : m);
        });

        if (currentFolderRef.current?.toLowerCase() === 'starred') {
            if (!nextStarred) {
                setTotalEmails(prev => Math.max(0, prev - 1));
            } else {
                setTotalEmails(prev => prev + 1);
            }
        }

        // 4. Update memory caches across folders - ONLY update the matching folder!
        if (pagesCache.current) {
            // Update starred cache
            if (!pagesCache.current['starred']) {
                pagesCache.current['starred'] = { 1: [] };
            }
            if (pagesCache.current['starred']) {
                if (nextStarred) {
                    const p1 = pagesCache.current['starred'][1] || [];
                    const exists = p1.some(m => isTargetMatch(m));
                    if (!exists && targetEmail) {
                        pagesCache.current['starred'][1] = [
                            {
                                ...targetEmail,
                                folderName: isDraft ? 'Drafts' : (targetEmail.folderName || 'starred'),
                                isDraft: isDraft ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                                draft: isDraft ? true : Boolean(targetEmail.isDraft || targetEmail.draft),
                                starred: true,
                                isStarred: true
                            },
                            ...p1
                        ];
                    }
                } else {
                    Object.keys(pagesCache.current['starred']).forEach(p => {
                        if (Array.isArray(pagesCache.current['starred'][p])) {
                            pagesCache.current['starred'][p] = pagesCache.current['starred'][p].filter(m =>
                                !isTargetMatch(m)
                            );
                        }
                    });
                }
            }

            // Update only the specific folder cache matching emailFolder (and All Mail if applicable)
            const targetFolderCaches = emailFolder === 'draft' ? ['draft', 'drafts'] : [emailFolder];
            targetFolderCaches.forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                isTargetMatch(m) ? {
                                    ...m,
                                    folderName: isDraft ? 'Drafts' : (m.folderName || emailFolder),
                                    isDraft: isDraft ? true : Boolean(m.isDraft || m.draft),
                                    draft: isDraft ? true : Boolean(m.isDraft || m.draft),
                                    starred: nextStarred,
                                    isStarred: nextStarred
                                } : m
                            );
                        }
                    });
                }
            });

            // In All Mail, update only the item matching UID and folder
            ['all-mail', 'allmail'].forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                isTargetMatch(m) ? { ...m, starred: nextStarred, isStarred: nextStarred } : m
                            );
                        }
                    });
                }
            });
        }

        // 5. Notify UI across components
        window.dispatchEvent(new CustomEvent('bnx-starred-updated', {
            detail: { uid: strUid, folder: emailFolder, starred: nextStarred }
        }));

        if (nextStarred && notifPrefsRef.current?.starredNotifications) {
            const subjectSnippet = targetEmail?.subject ? ` "${targetEmail.subject.slice(0, 25)}${targetEmail.subject.length > 25 ? '...' : ''}"` : '';
            toast.success(`Email${subjectSnippet} added to Starred`, { id: `starred-${strUid}`, icon: '⭐' });
        }

        // 6. Persist star status in backend database via existing API (skip frontend-only scheduled folder)
        if (targetFolder !== 'scheduled' && emailFolder !== 'scheduled') {
            const backendFolder = targetFolder === 'draft' ? 'Drafts' : (targetEmail?.folderName || targetFolder || 'INBOX');
            mailAPI.toggleStar(strUid, backendFolder).catch(err => {
                console.warn('[Star] Failed to sync star status to backend:', err?.message || err);
            });
        }
    }, [emails, user, isEmailStarred]);

    const handleMarkRead = useCallback(async (uid, silent = false, emailObj = null) => {
        if (uid === undefined || uid === null) return;
        const strUid = String(uid);

        // If already marked as read in this session, avoid duplicate decrements
        if (readUidsRef.current.has(strUid)) {
            return;
        }

        // Determine if the email was already read
        let foundEmail = emailObj || emailsRef.current.find(m => String(m.uid ?? m.id) === strUid);
        if (!foundEmail && pagesCache.current) {
            for (const f of Object.keys(pagesCache.current)) {
                if (!pagesCache.current[f]) continue;
                for (const p of Object.keys(pagesCache.current[f])) {
                    const list = pagesCache.current[f][p];
                    if (Array.isArray(list)) {
                        foundEmail = list.find(m => String(m.uid ?? m.id) === strUid);
                        if (foundEmail) break;
                    }
                }
                if (foundEmail) break;
            }
        }

        const wasUnread = foundEmail ? !(foundEmail.isRead || foundEmail.read) : true;

        // Mark in session set
        readUidsRef.current.add(strUid);
        unreadUidsRef.current.delete(strUid);
        saveStoredReadUids(user?.email, readUidsRef.current);

        // 1. Immediately update active emails state
        const currentFolderLower = currentFolderRef.current?.toLowerCase() || '';
        if (currentFolderLower === 'unread') {
            setEmails(prev => prev.filter(m => String(m.uid ?? m.id) !== strUid));
            setTotalEmails(total => Math.max(0, total - 1));
        } else {
            setEmails(prev => prev.map(m =>
                (String(m.uid ?? m.id) === strUid) ? { ...m, isRead: true, read: true } : m
            ));
        }

        // 2. Immediately update in-memory pagesCache across all folders so returning to inbox stays read
        if (pagesCache.current) {
            Object.keys(pagesCache.current).forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            if (f === 'unread') {
                                pagesCache.current[f][p] = pagesCache.current[f][p].filter(m =>
                                    String(m.uid ?? m.id) !== strUid
                                );
                            } else {
                                pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                    (String(m.uid ?? m.id) === strUid) ? { ...m, isRead: true, read: true } : m
                                );
                            }
                        }
                    });
                }
            });
            if (pagesCache.current['unread_total'] !== undefined) {
                pagesCache.current['unread_total'] = Math.max(0, pagesCache.current['unread_total'] - 1);
            }
        }

        // 3. Immediately decrement unread counts if this email was previously unread
        if (wasUnread) {
            const isSpamFolder = currentFolderLower === 'spam';
            setUnreadCounts(counts => ({
                ...counts,
                inbox: !isSpamFolder ? Math.max(0, (counts.inbox || 0) - 1) : counts.inbox,
                unread: !isSpamFolder ? Math.max(0, (counts.unread || 0) - 1) : counts.unread,
                allinbox: !isSpamFolder ? Math.max(0, (counts.allinbox || 0) - 1) : counts.allinbox,
                allmail: !isSpamFolder ? Math.max(0, (counts.allmail || 0) - 1) : counts.allmail,
                spam: isSpamFolder ? Math.max(0, (counts.spam || 0) - 1) : counts.spam,
                notification: Math.max(0, (counts.notification || 0) - 1)
            }));
        }

        invalidateCache('unread');

        // 4. Call backend API
        try {
            await mailAPI.markRead(uid);
        } catch (apiErr) {
            console.warn('Backend markRead API call failed:', apiErr);
        }
    }, [user?.email, invalidateCache]);

    const handleMarkUnread = useCallback(async (uid, silent = false, emailObj = null) => {
        if (uid === undefined || uid === null) return;
        const strUid = String(uid);

        let foundEmail = emailObj || emailsRef.current.find(m => String(m.uid ?? m.id) === strUid);
        if (!foundEmail && pagesCache.current) {
            for (const f of Object.keys(pagesCache.current)) {
                if (!pagesCache.current[f]) continue;
                for (const p of Object.keys(pagesCache.current[f])) {
                    const list = pagesCache.current[f][p];
                    if (Array.isArray(list)) {
                        foundEmail = list.find(m => String(m.uid ?? m.id) === strUid);
                        if (foundEmail) break;
                    }
                }
                if (foundEmail) break;
            }
        }

        const wasRead = foundEmail
            ? Boolean(foundEmail.isRead || foundEmail.read || readUidsRef.current.has(strUid))
            : readUidsRef.current.has(strUid);

        readUidsRef.current.delete(strUid);
        unreadUidsRef.current.add(strUid);
        saveStoredReadUids(user?.email, readUidsRef.current);

        const currentFolderLower = currentFolderRef.current?.toLowerCase() || '';
        if (currentFolderLower === 'unread') {
            if (foundEmail) {
                const unreadItem = { ...foundEmail, isRead: false, read: false };
                setEmails(prev => {
                    const exists = prev.some(m => String(m.uid ?? m.id) === strUid);
                    return exists
                        ? prev.map(m => String(m.uid ?? m.id) === strUid ? unreadItem : m)
                        : [unreadItem, ...prev];
                });
                setTotalEmails(total => total + 1);
            }
        } else {
            setEmails(prev => prev.map(m =>
                (String(m.uid ?? m.id) === strUid) ? { ...m, isRead: false, read: false } : m
            ));
        }

        if (pagesCache.current) {
            Object.keys(pagesCache.current).forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                (String(m.uid ?? m.id) === strUid) ? { ...m, isRead: false, read: false } : m
                            );
                        }
                    });
                }
            });
            if (pagesCache.current['unread'] && foundEmail) {
                const unreadItem = { ...foundEmail, isRead: false, read: false };
                const p1 = pagesCache.current['unread']['1'] || pagesCache.current['unread'][1];
                if (Array.isArray(p1)) {
                    const exists = p1.some(m => String(m.uid ?? m.id) === strUid);
                    if (!exists) {
                        p1.unshift(unreadItem);
                    }
                }
            }
            if (pagesCache.current['unread_total'] !== undefined) {
                pagesCache.current['unread_total'] = pagesCache.current['unread_total'] + 1;
            }
        }

        if (wasRead) {
            const isSpamFolder = currentFolderLower === 'spam';
            setUnreadCounts(counts => ({
                ...counts,
                inbox: !isSpamFolder ? (counts.inbox || 0) + 1 : counts.inbox,
                unread: !isSpamFolder ? (counts.unread || 0) + 1 : counts.unread,
                allinbox: !isSpamFolder ? (counts.allinbox || 0) + 1 : counts.allinbox,
                allmail: !isSpamFolder ? (counts.allmail || 0) + 1 : counts.allmail,
                spam: isSpamFolder ? (counts.spam || 0) + 1 : counts.spam,
                notification: (counts.notification || 0) + 1
            }));
        }

        invalidateCache('unread');

        try {
            await mailAPI.markUnread(uid);
        } catch (apiErr) {
            console.warn('Backend markUnread API call failed:', apiErr);
        }
    }, [user?.email, invalidateCache]);

    const commitPendingDelete = useCallback(async () => {
        const pending = pendingUndoDeleteRef.current;
        if (!pending) return;

        if (pending.timerId) clearTimeout(pending.timerId);
        if (undoCountdownTimerRef.current) clearInterval(undoCountdownTimerRef.current);
        pendingUndoDeleteRef.current = null;
        setPendingUndoDelete(null);

        const items = pending.items || [];
        for (const item of items) {
            try {
                await mailAPI.trash(item.uid, item.folder);
            } catch (err) {
                console.warn(`Failed to commit move-to-trash for email ${item.uid}:`, err);
            }
            if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes((item.folder || '').toLowerCase())) {
                markSelfSentDeletedFromInbox(item.uid, user?.email);
            }
        }

        invalidateCache('trash');
        invalidateCache('unread');
        invalidateCache('inbox');
        if (pending.folder) invalidateCache(pending.folder);
        if (currentFolderRef.current) invalidateCache(currentFolderRef.current);
    }, [invalidateCache, user?.email]);

    const handleUndoDelete = useCallback(() => {
        const pending = pendingUndoDeleteRef.current;
        if (!pending) return;

        if (pending.timerId) clearTimeout(pending.timerId);
        if (undoCountdownTimerRef.current) clearInterval(undoCountdownTimerRef.current);
        pendingUndoDeleteRef.current = null;
        setPendingUndoDelete(null);

        const itemsToRestore = pending.items || [];
        if (!itemsToRestore.length) return;

        itemsToRestore.forEach(item => {
            unmarkSelfSentDeletedFromInbox(item.uid, user?.email);
        });

        // Sort items by original index ascending so restoring them in order preserves exact positions
        const sortedItems = [...itemsToRestore].sort((a, b) => a.index - b.index);

        setEmails(prev => {
            const next = [...prev];
            sortedItems.forEach(item => {
                const sUid = String(item.email.uid ?? item.email.id);
                const exists = next.some(m => String(m.uid ?? m.id) === sUid);
                if (!exists) {
                    const insertAt = Math.min(Math.max(0, item.index), next.length);
                    next.splice(insertAt, 0, item.email);
                }
            });
            return next;
        });

        // Restore unread counts and total count
        let unreadRestored = 0;
        let spamUnreadRestored = 0;
        sortedItems.forEach(item => {
            if (item.wasUnread) {
                if (item.fKey === 'spam') {
                    spamUnreadRestored++;
                } else {
                    unreadRestored++;
                }
            }
        });

        if (unreadRestored > 0) {
            setUnreadCounts(c => ({
                ...c,
                inbox: (c.inbox || 0) + unreadRestored,
                unread: (c.unread || 0) + unreadRestored
            }));
        }
        if (spamUnreadRestored > 0) {
            setUnreadCounts(c => ({
                ...c,
                spam: (c.spam || 0) + spamUnreadRestored
            }));
        }

        setTotalEmails(prev => prev + sortedItems.length);
    }, []);

    const handleDismissUndo = useCallback(() => {
        commitPendingDelete();
    }, [commitPendingDelete]);

    const handleMoveToTrash = useCallback(async (target, folder, silent = false) => {
        const now = Date.now();
        const existing = pendingUndoDeleteRef.current;
        const isRapidBatch = existing && (now - existing.createdAt < 150);

        if (existing && !isRapidBatch) {
            commitPendingDelete();
        }

        // Normalize target into array of { uid, folder }
        let targetList = [];
        if (Array.isArray(target)) {
            targetList = target.map(t => {
                if (typeof t === 'object' && t !== null) {
                    return { uid: t.uid ?? t.id, folder: t.folder || folder };
                }
                return { uid: t, folder };
            });
        } else if (typeof target === 'object' && target !== null && (target.uid !== undefined || target.id !== undefined)) {
            targetList = [{ uid: target.uid ?? target.id, folder: target.folder || folder }];
        } else {
            targetList = [{ uid: target, folder }];
        }

        const targetFolder = folder || currentFolderRef.current || 'inbox';
        const fKey = targetFolder.toLowerCase();

        // Extract and remove emails optimistically, recording original index
        const itemsToTrash = [];

        setEmails(prev => {
            const next = [...prev];
            targetList.forEach(tItem => {
                const sUid = String(tItem.uid);
                const idx = next.findIndex(m => String(m.uid) === sUid || String(m.id) === sUid);
                if (idx !== -1) {
                    const removed = next[idx];
                    itemsToTrash.push({
                        email: removed,
                        uid: tItem.uid,
                        folder: tItem.folder || targetFolder,
                        fKey: (tItem.folder || targetFolder).toLowerCase(),
                        index: idx,
                        wasUnread: removed && !removed.isRead
                    });
                    next.splice(idx, 1);
                } else {
                    itemsToTrash.push({
                        email: { uid: tItem.uid },
                        uid: tItem.uid,
                        folder: tItem.folder || targetFolder,
                        fKey: (tItem.folder || targetFolder).toLowerCase(),
                        index: prev.length,
                        wasUnread: false
                    });
                }
            });
            return next;
        });

        if (!itemsToTrash.length) return;

        // Decrement unread counts and total count
        let unreadRemoved = 0;
        let spamUnreadRemoved = 0;
        itemsToTrash.forEach(item => {
            if (item.wasUnread) {
                if (item.fKey === 'spam') spamUnreadRemoved++;
                else unreadRemoved++;
            }
        });

        if (unreadRemoved > 0) {
            setUnreadCounts(c => ({
                ...c,
                inbox: Math.max(0, (c.inbox || 0) - unreadRemoved),
                unread: Math.max(0, (c.unread || 0) - unreadRemoved)
            }));
        }
        if (spamUnreadRemoved > 0) {
            setUnreadCounts(c => ({
                ...c,
                spam: Math.max(0, (c.spam || 0) - spamUnreadRemoved)
            }));
        }

        setTotalEmails(prev => Math.max(0, prev - itemsToTrash.length));
        targetList.forEach(tItem => {
            removeSnoozedEmail(user?.email, tItem.uid);
        });
        setUnreadCounts(c => ({
            ...c,
            snoozed: getActiveSnoozedCount(user?.email)
        }));

        // If part of rapid batch (< 150ms), append items to existing pending undo
        if (isRapidBatch && pendingUndoDeleteRef.current) {
            pendingUndoDeleteRef.current.items.push(...itemsToTrash);
            return;
        }

        // Create new pending undo operation
        const opId = `undo_delete_${now}_${Math.random().toString(36).substring(2, 7)}`;
        let countdown = 5;

        const timerId = setTimeout(() => {
            commitPendingDelete();
        }, 5000);

        const newPending = {
            opId,
            items: itemsToTrash,
            folder: targetFolder,
            timerId,
            countdown: 5,
            createdAt: now,
            label: "Conversation moved to Trash"
        };

        pendingUndoDeleteRef.current = newPending;
        setPendingUndoDelete({ ...newPending });

        if (undoCountdownTimerRef.current) clearInterval(undoCountdownTimerRef.current);
        undoCountdownTimerRef.current = setInterval(() => {
            countdown -= 1;
            if (countdown <= 0) {
                if (undoCountdownTimerRef.current) clearInterval(undoCountdownTimerRef.current);
            } else {
                setPendingUndoDelete(prev => {
                    if (!prev || prev.opId !== opId) return prev;
                    return { ...prev, countdown };
                });
            }
        }, 1000);
    }, [commitPendingDelete]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (pendingUndoDeleteRef.current) {
                commitPendingDelete();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (pendingUndoDeleteRef.current) {
                commitPendingDelete();
            }
        };
    }, [commitPendingDelete]);

    const handleDeletePermanently = async (uid, silent = false) => {
        try {
            removeSnoozedEmail(user?.email, uid);
            setUnreadCounts(c => ({
                ...c,
                snoozed: getActiveSnoozedCount(user?.email)
            }));
            await mailAPI.permanentDelete(uid);
            setEmails(prev => prev.filter(m => String(m.uid) !== String(uid)));
            invalidateCache('trash');
            if (currentFolder) invalidateCache(currentFolder);
            if (!silent) toast.success('Permanently deleted');
        } catch (error) {
            if (!silent) toast.error('Failed to delete permanently');
        }
    };

    const handleSnooze = async (uid, wakeUpAt, folderOrEmail = 'INBOX', emailObjOrSilent = null, silent = false) => {
        let targetFolder = 'INBOX';
        let passedEmailObj = null;
        let isSilent = false;

        if (typeof folderOrEmail === 'object' && folderOrEmail !== null) {
            passedEmailObj = folderOrEmail;
            targetFolder = folderOrEmail.folderName || currentFolderRef.current || 'INBOX';
            if (typeof emailObjOrSilent === 'boolean') {
                isSilent = emailObjOrSilent;
            }
        } else if (typeof folderOrEmail === 'string' && folderOrEmail.trim()) {
            targetFolder = folderOrEmail.trim();
            if (typeof emailObjOrSilent === 'object' && emailObjOrSilent !== null) {
                passedEmailObj = emailObjOrSilent;
                if (typeof silent === 'boolean') isSilent = silent;
            } else if (typeof emailObjOrSilent === 'boolean') {
                isSilent = emailObjOrSilent;
            }
        } else {
            targetFolder = currentFolderRef.current || 'INBOX';
        }

        if (typeof targetFolder !== 'string') {
            targetFolder = 'INBOX';
        }
        if (targetFolder.toLowerCase() === 'snoozed') {
            targetFolder = passedEmailObj?.originalFolderName || 'INBOX';
        }

        const strUid = String(uid);

        if (!wakeUpAt) {
            if (!isSilent) toast.error('Please select a valid date and time.');
            return false;
        }
        const wakeDate = new Date(wakeUpAt);
        if (isNaN(wakeDate.getTime()) || wakeDate.getTime() <= Date.now()) {
            if (!isSilent) toast.error('Please select a future date and time.');
            return false;
        }

        // Synchronously locate the email object BEFORE queued state update
        let snoozedItem = passedEmailObj || emails.find(m => String(m.uid ?? m.id) === strUid);
        if (!snoozedItem) {
            for (const fKey of Object.keys(pagesCache.current)) {
                if (pagesCache.current[fKey]) {
                    for (const pKey of Object.keys(pagesCache.current[fKey])) {
                        const match = pagesCache.current[fKey][pKey]?.find?.(m => String(m.uid ?? m.id) === strUid);
                        if (match) {
                            snoozedItem = match;
                            break;
                        }
                    }
                }
                if (snoozedItem) break;
            }
        }

        // 1. Optimistically remove from active list immediately
        setEmails(prev => prev.filter(m => String(m.uid ?? m.id) !== strUid));

        // 2. Persist in snoozeStorage
        const snoozeRecord = saveSnoozedEmail(user?.email, {
            email: snoozedItem || { uid: strUid },
            wakeUpAt: wakeDate.toISOString(),
            originalFolderName: targetFolder
        });

        // 3. Update unread & snoozed counts
        const updatedSnoozedCount = getActiveSnoozedCount(user?.email);
        if (snoozedItem && !snoozedItem.isRead && !snoozedItem.read) {
            setUnreadCounts(c => ({
                ...c,
                inbox: Math.max(0, (c.inbox || 0) - 1),
                unread: Math.max(0, (c.unread || 0) - 1),
                snoozed: updatedSnoozedCount
            }));
        } else {
            setUnreadCounts(c => ({
                ...c,
                snoozed: updatedSnoozedCount
            }));
        }
        setTotalEmails(prev => Math.max(0, prev - 1));

        // 4. Purge from in-memory pages cache (except snoozed)
        Object.keys(pagesCache.current).forEach(fKey => {
            if (fKey !== 'snoozed' && pagesCache.current[fKey]) {
                Object.keys(pagesCache.current[fKey]).forEach(pKey => {
                    if (Array.isArray(pagesCache.current[fKey][pKey])) {
                        pagesCache.current[fKey][pKey] = pagesCache.current[fKey][pKey].filter(
                            m => String(m.uid ?? m.id) !== strUid
                        );
                    }
                });
            }
        });

        // 5. Optimistically update pagesCache['snoozed']
        if (snoozeRecord) {
            if (!pagesCache.current['snoozed']) pagesCache.current['snoozed'] = {};
            const existingSnoozed = pagesCache.current['snoozed'][1] || [];
            const updatedSnoozed = [
                snoozeRecord.emailData,
                ...existingSnoozed.filter(m => String(m.uid ?? m.id) !== strUid && (!snoozeRecord.messageId || m.messageId !== snoozeRecord.messageId))
            ];
            pagesCache.current['snoozed'][1] = updatedSnoozed;
            pagesCache.current['snoozed_total'] = updatedSnoozed.length;
        }

        // 6. Invalidate affected folder caches
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');
        invalidateCache('unread');
        invalidateCache('starred');
        if (currentFolderRef.current && currentFolderRef.current !== 'snoozed') {
            invalidateCache(currentFolderRef.current);
        }

        try {
            await mailAPI.snooze(uid, wakeDate.toISOString(), targetFolder);
            if (!isSilent && notifPrefsRef.current?.snoozedNotifications) toast.success('Email snoozed');
            return true;
        } catch (error) {
            console.warn('Backend mailAPI.snooze responded with error:', error?.message || error);
            // Revert only on 401 Unauthorized
            if (error?.response?.status === 401) {
                if (snoozeRecord) removeSnoozedEmail(user?.email, strUid);
                const restoredSnoozedCount = getActiveSnoozedCount(user?.email);
                if (snoozedItem && !snoozedItem.isRead && !snoozedItem.read) {
                    setUnreadCounts(c => ({
                        ...c,
                        inbox: (c.inbox || 0) + 1,
                        unread: (c.unread || 0) + 1,
                        snoozed: restoredSnoozedCount
                    }));
                } else {
                    setUnreadCounts(c => ({
                        ...c,
                        snoozed: restoredSnoozedCount
                    }));
                }
                if (currentFolderRef.current?.startsWith('label-')) {
                    const labelId = currentFolderRef.current.replace('label-', '');
                    fetchLabelEmails(labelId, true, currentPageRef.current);
                } else {
                    fetchEmails(currentFolderRef.current, true, currentPageRef.current);
                }
                if (!isSilent) toast.error('Session expired. Please log in again.');
                throw error;
            }
            // Keep optimistic local snooze so email remains snoozed on frontend
            if (!isSilent && notifPrefsRef.current?.snoozedNotifications) {
                toast.success('Email snoozed');
            }
            return true;
        }
    };

    const handleUnsnooze = async (uid, emailObj = null, silent = false) => {
        const strUid = String(uid);
        const targetEmail = emailObj || emails.find(m => String(m.uid ?? m.id) === strUid);

        // 1. Mark as unsnoozed in storage
        const unsnoozeRecord = markEmailUnsnoozed(user?.email, strUid);

        // 2. If viewing snoozed folder, immediately remove from active list
        if (currentFolderRef.current?.toLowerCase() === 'snoozed') {
            setEmails(prev => prev.filter(m => String(m.uid ?? m.id) !== strUid));
            setTotalEmails(prev => Math.max(0, prev - 1));
        }

        setUnreadCounts(prev => ({
            ...prev,
            snoozed: getActiveSnoozedCount(user?.email)
        }));

        // 3. Invalidate affected caches
        invalidateCache('snoozed');
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');
        invalidateCache('unread');

        // 4. If viewing inbox, immediately add to emails list
        const itemData = targetEmail || unsnoozeRecord?.emailData;
        const originalRead = unsnoozeRecord?.isRead !== undefined ? unsnoozeRecord.isRead : Boolean(itemData?.isRead ?? itemData?.read);

        if (['inbox', 'all-inbox', 'allinbox'].includes(currentFolderRef.current?.toLowerCase()) && itemData) {
            setEmails(prev => {
                const exists = prev.some(m => String(m.uid ?? m.id) === strUid || (itemData.messageId && m.messageId === itemData.messageId));
                if (exists) return prev;
                return [{
                    ...itemData,
                    folderName: 'INBOX',
                    isSnoozed: false,
                    snoozedUntil: null,
                    wakeUpAt: null,
                    snoozeUntil: null,
                    isRead: originalRead,
                    read: originalRead
                }, ...prev];
            });
            setTotalEmails(prev => prev + 1);
        }

        // 5. Restore unread counts if originally unread
        if (!originalRead) {
            setUnreadCounts(c => ({
                ...c,
                inbox: (c.inbox || 0) + 1,
                unread: (c.unread || 0) + 1
            }));
        }

        // 6. Signal backend scheduler to return email to Inbox
        try {
            const pastIso = new Date(Date.now() - 60000).toISOString();
            await mailAPI.snooze(uid, pastIso, 'INBOX').catch(() => {});
        } catch (e) {}

        if (!silent) toast.success('Email unsnoozed and returned to Inbox');
        return true;
    };

    const handleCreateLabel = async (name, colorHex, parentId = null) => {
        try {
            const res = await mailAPI.createLabel({ name, colorHex, parentId });
            if (res.data?.success) {
                toast.success('Label created');
                fetchLabels();
                return res.data.data;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create label');
        }
    };

    const handleUpdateLabel = async (id, name, colorHex, parentId = null) => {
        try {
            const res = await mailAPI.updateLabel(id, { name, colorHex, parentId });
            if (res.data.success) {
                toast.success('Label updated');
                fetchLabels();
                return true;
            }
        } catch (error) {
            console.error('Update label error:', error);
        }
        return false;
    };

    const handleDeleteLabel = async (labelId) => {
        try {
            const res = await mailAPI.deleteLabel(labelId);
            if (res.data?.success) {
                const deletedStrId = String(labelId);
                setLabels(prev => (prev || []).filter(l => String(l.id) !== deletedStrId && String(l.parentId ?? '') !== deletedStrId));
                removeCustomLabelVisibility(labelId);
                toast.success('Label deleted');
                fetchLabels();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete label');
        }
    };

    const handleApplyLabel = async (uid, labelId, folder = currentFolderRef.current || 'INBOX', silent = false) => {
        const targetFolder = folder || currentFolderRef.current || 'INBOX';
        const strUid = String(uid);
        const strLabelId = String(labelId);
        const targetLabel = labels.find(l => String(l.id) === strLabelId);
        const systemDef = SYSTEM_LABEL_DEFINITIONS.find(
            s => s.id === strLabelId || s.name.toLowerCase() === strLabelId.toLowerCase() || (s.prefKey && s.prefKey.toLowerCase() === strLabelId.toLowerCase())
        );
        const labelToAdd = targetLabel || (systemDef ? { id: systemDef.id, name: systemDef.name, colorHex: systemDef.colorHex } : null);
        if (!labelToAdd) {
            if (!silent) toast.error('Label not found');
            return false;
        }

        let wasAlreadyApplied = false;

        // Optimistically apply label in active emails list
        setEmails(prev => prev.map(m => {
            if (String(m.uid) === strUid || String(m.id) === strUid) {
                const currentLabels = Array.isArray(m.labels) ? m.labels : [];
                const alreadyHas = currentLabels.some(l => {
                    if (l && typeof l === 'object' && l.id !== undefined && l.id !== null) {
                        if (String(l.id) === strLabelId || String(l.id) === String(labelToAdd.id)) return true;
                        if (systemDef) {
                            return l.name === systemDef.name || (systemDef.prefKey && (l.name === systemDef.prefKey || String(l.id) === String(systemDef.prefKey)));
                        }
                        return false;
                    }
                    return typeof l === 'string' && labelToAdd.name && l.trim().toLowerCase() === labelToAdd.name.trim().toLowerCase();
                });
                if (alreadyHas) {
                    wasAlreadyApplied = true;
                    return m;
                }
                return {
                    ...m,
                    labels: [...currentLabels, labelToAdd]
                };
            }
            return m;
        }));

        if (wasAlreadyApplied) {
            return true;
        }

        // Update in-memory pagesCache
        Object.keys(pagesCache.current).forEach(fKey => {
            if (pagesCache.current[fKey]) {
                Object.keys(pagesCache.current[fKey]).forEach(pKey => {
                    if (Array.isArray(pagesCache.current[fKey][pKey])) {
                        pagesCache.current[fKey][pKey] = pagesCache.current[fKey][pKey].map(m => {
                            if (String(m.uid) === strUid || String(m.id) === strUid) {
                                const currentLabels = Array.isArray(m.labels) ? m.labels : [];
                                const alreadyHas = currentLabels.some(l => {
                                    if (l && typeof l === 'object' && l.id !== undefined && l.id !== null) {
                                        if (String(l.id) === strLabelId || String(l.id) === String(labelToAdd.id)) return true;
                                        if (systemDef) {
                                            return l.name === systemDef.name || (systemDef.prefKey && (l.name === systemDef.prefKey || String(l.id) === String(systemDef.prefKey)));
                                        }
                                        return false;
                                    }
                                    return typeof l === 'string' && labelToAdd.name && l.trim().toLowerCase() === labelToAdd.name.trim().toLowerCase();
                                });
                                if (alreadyHas) return m;
                                return {
                                    ...m,
                                    labels: [...currentLabels, labelToAdd]
                                };
                            }
                            return m;
                        });
                    }
                });
            }
        });

        if (targetFolder && targetFolder.toLowerCase() === 'sent') {
            const currentSentLabels = sentEmailLabelsRef.current[strUid] || [];
            updateSentEmailLabels(strUid, [...currentSentLabels, labelToAdd]);
        }

        invalidateCache(`label-${labelId}`);
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }

        const isNumeric = /^\d+$/.test(strLabelId) || typeof labelId === 'number';

        if (isNumeric) {
            try {
                await mailAPI.applyLabel(uid, labelId, targetFolder);
                if (!silent) toast.success('Label applied');
                return true;
            } catch (error) {
                console.error('Failed to apply label:', error);
                // Revert optimistic update
                setEmails(prev => prev.map(m => {
                    if (String(m.uid) === strUid || String(m.id) === strUid) {
                        return {
                            ...m,
                            labels: (m.labels || []).filter(l => String(l.id) !== strLabelId)
                        };
                    }
                    return m;
                }));
                if (!silent) toast.error(error.response?.data?.message || 'Failed to apply label');
                throw error;
            }
        } else {
            saveAppliedSystemLabel(strUid, labelToAdd);
            if (!silent) toast.success('Label applied');
            return true;
        }
    };

    const handleRemoveLabel = async (uid, labelId, folder = currentFolderRef.current || 'INBOX', silent = false) => {
        const targetFolder = folder || currentFolderRef.current || 'INBOX';
        const strUid = String(uid);
        const strLabelId = String(labelId);
        let removedLabel = null;

        // Optimistically remove label from active list
        setEmails(prev => {
            if (currentFolderRef.current === `label-${labelId}`) {
                return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
            }
            return prev.map(m => {
                if (String(m.uid) === strUid || String(m.id) === strUid) {
                    removedLabel = (m.labels || []).find(l => String(l.id) === strLabelId || l.name === labelId);
                    return {
                        ...m,
                        labels: (m.labels || []).filter(l => String(l.id) !== strLabelId && l.name !== labelId)
                    };
                }
                return m;
            });
        });

        if (currentFolderRef.current === `label-${labelId}`) {
            setTotalEmails(prev => Math.max(0, prev - 1));
        }

        // Update in-memory pagesCache
        Object.keys(pagesCache.current).forEach(fKey => {
            if (pagesCache.current[fKey]) {
                Object.keys(pagesCache.current[fKey]).forEach(pKey => {
                    if (Array.isArray(pagesCache.current[fKey][pKey])) {
                        if (fKey === `label-${labelId}`) {
                            pagesCache.current[fKey][pKey] = pagesCache.current[fKey][pKey].filter(
                                m => String(m.uid) !== strUid && String(m.id) !== strUid
                            );
                        } else {
                            pagesCache.current[fKey][pKey] = pagesCache.current[fKey][pKey].map(m => {
                                if (String(m.uid) === strUid || String(m.id) === strUid) {
                                    return {
                                        ...m,
                                        labels: (m.labels || []).filter(l => String(l.id) !== strLabelId && l.name !== labelId)
                                    };
                                }
                                return m;
                            });
                        }
                    }
                });
            }
        });

        if (targetFolder && targetFolder.toLowerCase() === 'sent') {
            const currentSentLabels = sentEmailLabelsRef.current[strUid] || [];
            updateSentEmailLabels(strUid, currentSentLabels.filter(l => String(l.id || l) !== strLabelId && l.name !== labelId));
        }

        invalidateCache(`label-${labelId}`);
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }

        const isNumeric = /^\d+$/.test(strLabelId) || typeof labelId === 'number';

        if (isNumeric) {
            try {
                await mailAPI.removeLabel(uid, labelId, targetFolder);
                if (!silent) toast.success('Label removed');
                return true;
            } catch (error) {
                console.error('Failed to remove label:', error);
                // Revert on error
                if (removedLabel) {
                    setEmails(prev => prev.map(m => {
                        if (String(m.uid) === strUid || String(m.id) === strUid) {
                            return {
                                ...m,
                                labels: [...(m.labels || []), removedLabel]
                            };
                        }
                        return m;
                    }));
                }
                if (!silent) toast.error(error.response?.data?.message || 'Failed to remove label');
                throw error;
            }
        } else {
            removeAppliedSystemLabel(strUid, strLabelId);
            if (!silent) toast.success('Label removed');
            return true;
        }
    };

    const handleArchive = async (uid, folder, silent = false) => {
        const strUid = String(uid);
        const targetFolder = (folder || currentFolderRef.current || 'inbox').toLowerCase();
        let archivedItem = null;
        try {
            setEmails(prev => {
                archivedItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                if (['inbox', 'unread', 'all-inbox', 'allinbox'].includes(currentFolderRef.current?.toLowerCase())) {
                    return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
                }
                return prev.map(m => (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, folderName: 'Archive' } : m);
            });
            if (archivedItem && !archivedItem.isRead && targetFolder !== 'archive') {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1)
                }));
            }
            if (folder) invalidateCache(folder);
            invalidateCache('archive');
            invalidateCache('inbox');
            invalidateCache('unread');
            invalidateCache('snoozed');
            removeSnoozedEmail(user?.email, strUid);
            setUnreadCounts(c => ({
                ...c,
                snoozed: getActiveSnoozedCount(user?.email)
            }));
            await mailAPI.archive(uid, folder);
            if (!silent) toast.success('Email archived');
        } catch (error) {
            console.error('Failed to archive:', error);
            if (archivedItem && !archivedItem.isRead && targetFolder !== 'archive') {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1
                }));
            }
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            if (!silent) toast.error('Failed to archive email');
        }
    };

    const handleUnarchive = async (uid, silent = false) => {
        const strUid = String(uid);
        let unarchivedItem = null;
        try {
            setEmails(prev => {
                unarchivedItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                if (currentFolderRef.current?.toLowerCase() === 'archive') {
                    return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
                }
                return prev.map(m => (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, folderName: 'INBOX' } : m);
            });
            if (unarchivedItem && !unarchivedItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1
                }));
            }
            invalidateCache('archive');
            invalidateCache('inbox');
            invalidateCache('unread');
            await mailAPI.unarchive(uid);
            if (!silent) toast.success('Email restored');
        } catch (error) {
            console.error('Failed to unarchive:', error);
            if (unarchivedItem && !unarchivedItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1)
                }));
            }
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            if (!silent) toast.error('Failed to unarchive email');
        }
    };

    const handleMarkSpam = async (uid, folder = currentFolder, silent = false) => {
        const strUid = String(uid);
        let spamItem = null;
        try {
            setEmails(prev => {
                spamItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
            });
            if (spamItem && !spamItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1),
                    spam: (c.spam || 0) + 1
                }));
            }
            invalidateCache('spam');
            invalidateCache('inbox');
            invalidateCache('unread');
            invalidateCache('snoozed');
            removeSnoozedEmail(user?.email, strUid);
            setUnreadCounts(c => ({
                ...c,
                snoozed: getActiveSnoozedCount(user?.email)
            }));
            if (folder) invalidateCache(folder);
            await mailAPI.markSpam(uid, folder);
            if (!silent) toast.success('Reported as spam');
        } catch (error) {
            console.error('Failed to report spam:', error);
            if (spamItem && !spamItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1,
                    spam: Math.max(0, (c.spam || 0) - 1)
                }));
            }
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            if (!silent) toast.error('Failed to report spam');
        }
    };

    const handleRestoreSpam = async (uid, silent = false) => {
        const strUid = String(uid);
        let restoredItem = null;
        try {
            setEmails(prev => {
                restoredItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
            });
            if (restoredItem && !restoredItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    spam: Math.max(0, (c.spam || 0) - 1),
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1
                }));
            }
            invalidateCache('spam');
            invalidateCache('inbox');
            invalidateCache('unread');
            await mailAPI.restoreSpam(uid);
            if (!silent) toast.success('Restored from spam');
        } catch (error) {
            console.error('Failed to restore from spam:', error);
            if (restoredItem && !restoredItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    spam: (c.spam || 0) + 1,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1)
                }));
            }
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            if (!silent) toast.error('Failed to restore from spam');
        }
    };

    const handleRestore = async (uid, silent = false) => {
        const strUid = String(uid);
        let restoredItem = null;
        try {
            setEmails(prev => {
                restoredItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
            });
            if (restoredItem && !restoredItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    trash: Math.max(0, (c.trash || 0) - 1),
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1
                }));
            }
            invalidateCache('trash');
            invalidateCache('inbox');
            invalidateCache('all-inbox');
            invalidateCache('allinbox');
            invalidateCache('unread');
            invalidateCache('all-mail');
            invalidateCache('allmail');
            await mailAPI.restore(uid);
            if (!silent) toast.success('Email restored');
            fetchEmailsSilently('inbox');
        } catch (error) {
            console.error('Failed to restore from trash:', error);
            if (restoredItem && !restoredItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    trash: (c.trash || 0) + 1,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1)
                }));
            }
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            if (!silent) toast.error('Failed to restore email');
        }
    };

    const handleUnsubscribe = async (senderEmail, silent = false) => {
        try {
            const promises = [];
            if (mailAPI.unsubscribe) promises.push(mailAPI.unsubscribe(senderEmail));
            if (blockedContactsAPI?.blockSender) promises.push(blockedContactsAPI.blockSender(senderEmail));

            const results = await Promise.allSettled(promises);
            const hasSuccess = results.some(r => r.status === 'fulfilled' && (
                (typeof r.value?.status === 'number' && r.value.status >= 200 && r.value.status < 300 && r.value?.data?.success !== false) ||
                (r.value?.success !== false && !r.value?.error)
            ));

            if (!hasSuccess) {
                const err = results.find(r => r.status === 'rejected')?.reason;
                throw err || new Error('Failed to unsubscribe');
            }

            if (!silent) toast.success('Unsubscribed from ' + senderEmail);
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            if (!silent) toast.error('Failed to unsubscribe');
            return false;
        }
    };

    const nextComposeOrderRef = useRef(0);
    const [composeWindows, setComposeWindows] = useState([]);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isComposeMinimized, setIsComposeMinimized] = useState(false);
    const [isComposeMaximized, setIsComposeMaximized] = useState(false);
    const [composeData, setComposeData] = useState(null);

    const openCompose = useCallback((data = null) => {
        let cleanData = data ? { ...data } : {};
        if (cleanData.replyTo) {
            const match = cleanData.replyTo.match(/<([^>]+)>/);
            if (match) {
                cleanData.replyTo = match[1];
            }
        }
        // Initialize Label selection as empty; never carry over previous label
        if (!cleanData.draft || !Array.isArray(cleanData.draft.labels)) {
            delete cleanData.labels;
            delete cleanData.selectedLabels;
        }
        setComposeWindows((prev) => {
            const currentOrder = prev.length === 0 ? 0 : nextComposeOrderRef.current;
            nextComposeOrderRef.current = currentOrder + 1;
            const newWindow = {
                id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
                data: cleanData,
                order: currentOrder,
                createdAt: Date.now()
            };
            return [...prev, newWindow];
        });
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
        setIsComposeMaximized(false);
        setComposeData(cleanData);
    }, []);

    const closeComposeWindow = useCallback((windowId) => {
        setComposeWindows((prev) => {
            const next = prev.filter((w) => w.id !== windowId);
            if (next.length === 0) {
                setIsComposeOpen(false);
                setComposeData(null);
                nextComposeOrderRef.current = 0;
            } else {
                setComposeData(next[next.length - 1].data);
            }
            return next;
        });
    }, []);

    const closeCompose = useCallback((windowId) => {
        if (windowId && typeof windowId === 'string') {
            closeComposeWindow(windowId);
        } else {
            setComposeWindows((prev) => {
                if (prev.length === 0) {
                    nextComposeOrderRef.current = 0;
                    return prev;
                }
                const next = prev.slice(0, prev.length - 1);
                if (next.length === 0) {
                    setIsComposeOpen(false);
                    setComposeData(null);
                    nextComposeOrderRef.current = 0;
                } else {
                    setComposeData(next[next.length - 1].data);
                }
                return next;
            });
        }
    }, [closeComposeWindow]);

    const handleEmailSent = useCallback(async ({ draftId, draftUid, imapDraftUid, sentEmail, wasStarred, emailData } = {}) => {
        const targetDraftUids = [draftId, draftUid, imapDraftUid].filter(Boolean).map(String);

        // Record all target draft UIDs into sentDraftUidsRef and persist to sessionStorage
        if (targetDraftUids.length > 0) {
            targetDraftUids.forEach(uid => sentDraftUidsRef.current.add(String(uid)));
            try {
                sessionStorage.setItem('bnx_sent_draft_uids', JSON.stringify(Array.from(sentDraftUidsRef.current)));
            } catch (e) {}
        }

        const sentUid = sentEmail?.uid !== undefined && sentEmail?.uid !== null 
            ? String(sentEmail.uid) 
            : (sentEmail?.id !== undefined && sentEmail?.id !== null ? String(sentEmail.id) : null);

        let sentEmailObj = null;
        let inboxEmailObj = null;
        const explicitLabels = Array.isArray(emailData?.labels) ? emailData.labels : [];
        if (sentEmail || emailData) {
            const rawSentDate = sentEmail?.sentAt ? new Date(sentEmail.sentAt).toISOString() : new Date().toISOString();
            const userEmail = user?.email?.trim().toLowerCase();
            const fromEmail = sentEmail?.from || sentEmail?.senderEmail || emailData?.from || emailData?.senderEmail || userEmail;
            const senderName = user?.name || emailData?.senderName || fromEmail?.split('@')[0] || '';
            const toEmail = emailData?.to || sentEmail?.to || '';
            const commonUid = sentUid || (sentEmail?.id ? String(sentEmail.id) : null) || String(Date.now());

            sentEmailObj = {
                ...(emailData || {}),
                ...(sentEmail || {}),
                uid: commonUid,
                id: commonUid,
                from: fromEmail,
                senderEmail: fromEmail,
                senderName: senderName,
                sender: senderName ? `${senderName} <${fromEmail}>` : fromEmail,
                to: toEmail,
                recipientEmail: toEmail,
                cc: emailData?.cc || sentEmail?.cc || '',
                bcc: emailData?.bcc || sentEmail?.bcc || '',
                subject: emailData?.subject || sentEmail?.subject || '',
                body: emailData?.body || sentEmail?.body || '',
                htmlBody: emailData?.htmlBody || emailData?.body || sentEmail?.body || '',
                folderName: 'Sent',
                starred: false,
                isStarred: false,
                isRead: true,
                read: true,
                sentDate: rawSentDate,
                date: rawSentDate,
                attachments: emailData?.attachments || sentEmail?.attachments || [],
                labels: explicitLabels
            };

            if (isSelfSentEmail(sentEmailObj, userEmail)) {
                saveStoredSelfSentEmail(sentEmailObj, userEmail);
                inboxEmailObj = {
                    ...sentEmailObj,
                    folderName: 'INBOX',
                    isDraft: false,
                    draft: false,
                    isRead: false,
                    read: false,
                    starred: false,
                    isStarred: false,
                    receivedDate: rawSentDate,
                    date: rawSentDate
                };
            }
        }

        if (sentUid) {
            updateSentEmailLabels(sentUid, explicitLabels);
        }

        // 1. Immediately update active emails state
        setEmails(prev => {
            let next = prev.filter(m => {
                const mUid = String(m.uid || m.id || '');
                return !targetDraftUids.includes(mUid);
            });
            const cur = (currentFolderRef.current || '').toLowerCase();
            if (cur === 'sent' && sentEmailObj) {
                next = [sentEmailObj, ...next.filter(m => String(m.uid || m.id || '') !== String(sentEmailObj.uid))];
            } else if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(cur) && inboxEmailObj) {
                next = [inboxEmailObj, ...next.filter(m => String(m.uid || m.id || '') !== String(inboxEmailObj.uid))];
            }
            return next;
        });

        // 2. Clean up any draft keys
        const currentSet = getStoredStarredIds(user?.email);
        const nextSet = new Set(currentSet);
        if (targetDraftUids.length > 0) {
            targetDraftUids.forEach(uid => {
                const uStr = String(uid);
                nextSet.delete(`draft:${uStr}`);
                nextSet.delete(`drafts:${uStr}`);
                nextSet.delete(uStr);
                removeStoredStarredEmail(uStr, user?.email, 'draft');
            });
        }
        saveStoredStarredIds(nextSet, user?.email);
        setStarredIds(nextSet);
        starredIdsRef.current = nextSet;

        // Also purge any matching draft from star overrides
        if (targetDraftUids.length > 0) {
            try {
                const stored = localStorage.getItem('bnx_draft_star_overrides');
                if (stored) {
                    const overrides = JSON.parse(stored);
                    targetDraftUids.forEach(uid => { delete overrides[String(uid)]; });
                    localStorage.setItem('bnx_draft_star_overrides', JSON.stringify(overrides));
                }
            } catch (e) {}
        }

        // 3. Invalidate caches for all affected folders
        invalidateCache('draft');
        invalidateCache('drafts');
        invalidateCache('starred');
        invalidateCache('sent');
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');

        // Also purge any matching draft from all cached pages, and update starred/sent caches
        if (targetDraftUids.length > 0 || sentEmailObj) {
            Object.keys(pagesCache.current).forEach(folderKey => {
                const folderCache = pagesCache.current[folderKey];
                if (folderCache) {
                    Object.keys(folderCache).forEach(pageKey => {
                        if (Array.isArray(folderCache[pageKey])) {
                            folderCache[pageKey] = folderCache[pageKey].filter(m => {
                                const mUid = String(m.uid || m.id || '');
                                return !targetDraftUids.includes(mUid);
                            });
                        }
                    });
                }
            });

            if (isDraftStarred && sentEmailObj) {
                if (!pagesCache.current['starred']) {
                    pagesCache.current['starred'] = {};
                }
                const p1 = pagesCache.current['starred'][1] || [];
                pagesCache.current['starred'][1] = [
                    sentEmailObj,
                    ...p1.filter(m => String(m.uid || m.id || '') !== String(sentEmailObj.uid))
                ];
            }
            if (sentEmailObj) {
                if (!pagesCache.current['sent']) {
                    pagesCache.current['sent'] = {};
                }
                const p1 = pagesCache.current['sent'][1] || [];
                pagesCache.current['sent'][1] = [
                    sentEmailObj,
                    ...p1.filter(m => String(m.uid || m.id || '') !== String(sentEmailObj.uid))
                ];
                pagesCache.current['sent_total'] = Math.max(pagesCache.current['sent_total'] || 0, pagesCache.current['sent'][1].length);
            }
            if (inboxEmailObj) {
                ['inbox', 'all-inbox', 'allinbox', 'unread'].forEach(fKey => {
                    if (!pagesCache.current[fKey]) {
                        pagesCache.current[fKey] = {};
                    }
                    const p1 = pagesCache.current[fKey][1] || [];
                    pagesCache.current[fKey][1] = [
                        inboxEmailObj,
                        ...p1.filter(m => String(m.uid || m.id || '') !== String(inboxEmailObj.uid))
                    ];
                    pagesCache.current[`${fKey}_total`] = Math.max(pagesCache.current[`${fKey}_total`] || 0, pagesCache.current[fKey][1].length);
                });

                setUnreadCounts(prev => ({
                    ...prev,
                    inbox: (prev.inbox || 0) + 1,
                    unread: (prev.unread || 0) + 1,
                    allinbox: (prev.allinbox || 0) + 1
                }));
            }
        }

        // 4. Clean up backend draft using existing APIs
        const cleanupPromises = [];
        if (imapDraftUid) {
            cleanupPromises.push(mailAPI.trash(imapDraftUid, "Drafts").catch(() => {}));
        }
        if (draftUid && String(draftUid) !== String(imapDraftUid)) {
            cleanupPromises.push(mailAPI.trash(draftUid, "Drafts").catch(() => {}));
        }
        if (draftId) {
            cleanupPromises.push(api.delete(`/api/mail/drafts/${draftId}`).catch(() => {}));
        }
        if (cleanupPromises.length > 0) {
            await Promise.allSettled(cleanupPromises);
        }

        // 5. Refresh the CURRENT active folder
        const curFolder = (currentFolderRef.current || '').toLowerCase();
        if (curFolder.startsWith('label-')) {
            const labelId = currentFolderRef.current.replace(/^label-/i, '');
            fetchLabelEmails(labelId, true, currentPageRef.current);
        } else if (curFolder === 'draft' || curFolder === 'drafts') {
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
        } else if (curFolder === 'sent') {
            fetchEmailsSilently('sent');
        } else {
            fetchEmails(currentFolderRef.current, true, currentPageRef.current);
        }

        // 6. Silently update drafts and sent caches in the background
        fetchEmailsSilently('drafts');
        fetchEmailsSilently('sent');
        if (inboxEmailObj) fetchEmailsSilently('inbox');
    }, [fetchEmails, fetchEmailsSilently, fetchLabelEmails, invalidateCache, isEmailStarred, user?.email, updateSentEmailLabels]);

    const updateDraftInState = useCallback((targetId, updatedFields) => {
        if (!targetId) return;
        const strTargetId = String(targetId);

        // 1. Immutably update the active emails array for matching draft ID only
        setEmails(prevEmails => {
            if (!Array.isArray(prevEmails)) return prevEmails;
            return prevEmails.map(email => {
                const emailUid = email.uid !== undefined && email.uid !== null ? String(email.uid) : null;
                const emailId = email.id !== undefined && email.id !== null ? String(email.id) : null;
                if (emailUid === strTargetId || emailId === strTargetId) {
                    const isStarred = Boolean(email.starred || email.isStarred);
                    const updatedEmail = {
                        ...email,
                        ...updatedFields,
                        uid: email.uid,
                        id: email.id,
                        folderName: 'Drafts',
                        isDraft: true,
                        draft: true,
                        starred: isStarred,
                        isStarred: isStarred,
                        labels: email.labels,
                    };
                    return updatedEmail;
                }
                return email;
            });
        });

        // 2. Immutably update cached pages across draft folders
        ['draft', 'drafts'].forEach(folderKey => {
            const folderCache = pagesCache.current[folderKey];
            if (folderCache) {
                Object.keys(folderCache).forEach(pageKey => {
                    if (Array.isArray(folderCache[pageKey])) {
                        folderCache[pageKey] = folderCache[pageKey].map(email => {
                            const emailUid = email.uid !== undefined && email.uid !== null ? String(email.uid) : null;
                            const emailId = email.id !== undefined && email.id !== null ? String(email.id) : null;
                            if (emailUid === strTargetId || emailId === strTargetId) {
                                const isStarred = Boolean(email.starred || email.isStarred);
                                return {
                                    ...email,
                                    ...updatedFields,
                                    uid: email.uid,
                                    id: email.id,
                                    folderName: 'Drafts',
                                    isDraft: true,
                                    draft: true,
                                    starred: isStarred,
                                    isStarred: isStarred,
                                    labels: email.labels,
                                };
                            }
                            return email;
                        });
                    }
                });
            }
        });
    }, [user?.email]);

    const updateDraftUidInState = useCallback((oldTargetId, newUid) => {
        if (!oldTargetId || !newUid) return;
        const strOld = String(oldTargetId);
        const strNew = String(newUid);

        // Check if old draft was starred
        const currentSet = getStoredStarredIds(user?.email);
        const wasStarred = isEmailStarred(strOld, 'draft') ||
            currentSet.has(`draft:${strOld}`) ||
            currentSet.has(`drafts:${strOld}`) ||
            currentSet.has(strOld);

        setEmails(prev => prev.map(m => {
            const mUid = m.uid !== undefined && m.uid !== null ? String(m.uid) : null;
            const mId = m.id !== undefined && m.id !== null ? String(m.id) : null;
            if (mUid === strOld || mId === strOld) {
                return {
                    ...m,
                    uid: newUid,
                    folderName: 'Drafts',
                    isDraft: true,
                    draft: true,
                    starred: wasStarred ? true : m.starred,
                    isStarred: wasStarred ? true : m.isStarred
                };
            }
            return m;
        }));

        try {
            const migrateOverride = (key) => {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const overrides = JSON.parse(stored);
                    if (overrides[strOld] !== undefined || overrides[`draft:${strOld}`] !== undefined) {
                        const val = overrides[strOld] ?? overrides[`draft:${strOld}`];
                        overrides[strNew] = val;
                        overrides[`draft:${strNew}`] = val;
                        delete overrides[strOld];
                        delete overrides[`draft:${strOld}`];
                        localStorage.setItem(key, JSON.stringify(overrides));
                    }
                }
            };
            migrateOverride('bnx_draft_star_overrides');
            if (user?.email) {
                migrateOverride(getUserKey('bnx_draft_star_overrides', user.email));
            }
        } catch (e) {}

        // Migrate starred IDs and stored full email data if the draft was starred
        if (wasStarred) {
            const nextSet = new Set(currentSet);
            nextSet.delete(strOld);
            nextSet.delete(`draft:${strOld}`);
            nextSet.delete(`drafts:${strOld}`);
            nextSet.add(`draft:${strNew}`);
            saveStoredStarredIds(nextSet, user?.email);
            setStarredIds(nextSet);
            starredIdsRef.current = nextSet;

            removeStoredStarredEmail(strOld, user?.email, 'draft');

            mailAPI.toggleStar(strNew, 'Drafts').catch(err => {
                console.warn('[Star] Failed to sync updated draft UID to backend:', err?.message || err);
            });
        }

        ['draft', 'drafts'].forEach(folderKey => {
            const folderCache = pagesCache.current[folderKey];
            if (folderCache) {
                Object.keys(folderCache).forEach(pageKey => {
                    if (Array.isArray(folderCache[pageKey])) {
                        folderCache[pageKey] = folderCache[pageKey].map(m => {
                            const mUid = m.uid !== undefined && m.uid !== null ? String(m.uid) : null;
                            const mId = m.id !== undefined && m.id !== null ? String(m.id) : null;
                            if (mUid === strOld || mId === strOld) {
                                return {
                                    ...m,
                                    uid: newUid,
                                    folderName: 'Drafts',
                                    isDraft: true,
                                    draft: true,
                                    starred: wasStarred ? true : m.starred,
                                    isStarred: wasStarred ? true : m.isStarred
                                };
                            }
                            return m;
                        });
                    }
                });
            }
        });
    }, [user?.email, isEmailStarred]);

    const getFolderEmails = useCallback((folder) => {
        let folderKey = (folder || currentFolderRef.current || 'inbox').toLowerCase();
        if (folderKey === 'drafts') folderKey = 'draft';
        if (folderKey === 'allmail') folderKey = 'all-mail';
        const list = [];
        const seenUids = new Set();

        const currentNormalized = (currentFolderRef.current || '').toLowerCase();
        const isCurrent = currentNormalized === folderKey ||
            (folderKey === 'draft' && currentNormalized === 'drafts') ||
            (folderKey === 'all-mail' && currentNormalized === 'allmail');

        if (isCurrent && Array.isArray(emails)) {
            emails.forEach(e => {
                const uidStr = String(e.uid ?? e.id ?? '');
                if (uidStr && !seenUids.has(uidStr)) {
                    seenUids.add(uidStr);
                    list.push(e);
                }
            });
        }

        const keysToCheck = [folderKey];
        if (folderKey === 'draft') keysToCheck.push('drafts');
        if (folderKey === 'all-mail') keysToCheck.push('allmail');

        keysToCheck.forEach(k => {
            if (pagesCache.current[k]) {
                Object.values(pagesCache.current[k]).forEach(pageList => {
                    if (Array.isArray(pageList)) {
                        pageList.forEach(e => {
                            const uidStr = String(e.uid ?? e.id ?? '');
                            if (uidStr && !seenUids.has(uidStr)) {
                                seenUids.add(uidStr);
                                list.push(e);
                            }
                        });
                    }
                });
            }
        });

        return list;
    }, [emails]);

    return (
        <MailContext.Provider value={{
            emails,
            getFolderEmails,
            loading,
            isRefreshing,
            currentFolder,
            setCurrentFolder,
            unreadCounts,
            labels,
            fetchEmails,
            fetchEmailsSilently,
            refreshEmails,
            invalidateCache,
            fetchLabels,
            fetchLabelEmails,
            handleToggleStar,
            isEmailStarred,
            starredIds,
            handleMarkRead,
            handleMarkUnread,
            isEmailRead,
            totalEmails,
            setTotalEmails,
            currentPage,
            handlePageChange,
            handleMoveToTrash,
            handleDeletePermanently,
            handleSnooze,
            handleUnsnooze,
            handleCreateLabel,
            handleUpdateLabel,
            handleApplyLabel,
            handleRemoveLabel,
            handleArchive,
            handleUnarchive,
            handleMarkSpam,
            handleRestoreSpam,
            handleRestore,
            handleUnsubscribe,
            handleDeleteLabel,
            handleEmailSent,
            composeWindows,
            closeComposeWindow,
            isComposeOpen: composeWindows.length > 0 || isComposeOpen,
            setIsComposeOpen,
            isComposeMinimized,
            setIsComposeMinimized,
            isComposeMaximized,
            setIsComposeMaximized,
            composeData: composeWindows.length > 0 ? composeWindows[composeWindows.length - 1].data : composeData,
            setComposeData,
            openCompose,
            closeCompose,
            dateFilter,
            setDateFilter,
            customDateRange,
            setCustomDateRange,
            resetDateFilter,
            matchesDateFilter,
            updateDraftInState,
            updateDraftUidInState,
            pendingUndoDelete,
            handleUndoDelete,
            handleDismissUndo,
            commitPendingDelete
        }}>
            {children}
            <UndoDeleteToast
                pending={pendingUndoDelete}
                onUndo={handleUndoDelete}
                onDismiss={handleDismissUndo}
            />
        </MailContext.Provider>
    );
};

export default MailProvider;
export const useMail = () => {
    const context = useContext(MailContext);
    if (!context) {
        return {
            emails: [],
            getFolderEmails: () => [],
            loading: false,
            isRefreshing: false,
            labels: [],
            unreadCounts: { inbox: 0, unread: 0, spam: 0, trash: 0 },
            totalEmails: 0,
            currentPage: 1,
            fetchEmails: async () => {},
            fetchEmailsSilently: async () => {},
            refreshEmails: async () => {},
            fetchLabelEmails: async () => {},
            handleToggleStar: async () => {},
            isEmailStarred: () => false,
            starredIds: new Set(),
            handleMoveToTrash: async () => {},
            handleDeletePermanently: async () => {},
            handleArchive: async () => {},
            handleUnarchive: async () => {},
            handleSnooze: async () => {},
            handleUnsnooze: async () => {},
            handleApplyLabel: async () => {},
            handleRemoveLabel: async () => {},
            handleCreateLabel: async () => {},
            handleUpdateLabel: async () => {},
            handleDeleteLabel: async () => {},
            handleMarkRead: async () => {},
            handleMarkUnread: async () => {},
            isEmailRead: () => false,
            handleMarkSpam: async () => {},
            handleRestoreSpam: async () => {},
            handleRestore: async () => {},
            handleUnsubscribe: async () => {},
            composeWindows: [],
            closeComposeWindow: () => {},
            openCompose: () => {},
            closeCompose: () => {},
            isComposeOpen: false,
            composeData: null,
            handleEmailSent: () => {},
            invalidateCache: () => {},
            handlePageChange: () => {},
            dateFilter: "ALL",
            setDateFilter: () => {},
            customDateRange: null,
            setCustomDateRange: () => {},
            resetDateFilter: () => {},
            matchesDateFilter: () => true,
            updateDraftInState: () => {},
            updateDraftUidInState: () => {},
        };
    }
    return context;
};

