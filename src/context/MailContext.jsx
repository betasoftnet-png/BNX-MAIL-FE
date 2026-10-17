import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { mailAPI, api } from '../services/api';
import { API_ENDPOINTS } from '../Data/constants';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { filterDuplicateSpamEmails } from '../utils/spamFilter';
import { matchesDateRange } from '../utils/dateFilter';
import toast from 'react-hot-toast';

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
    const [emails, setEmails] = useState([]);
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
    const [unreadCounts, setUnreadCounts] = useState({ inbox: 0, unread: 0, spam: 0, trash: 0 });
    const [labels, setLabels] = useState([]);
    const [totalEmails, setTotalEmails] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const currentPageRef = useRef(1);

    const updateCurrentPage = useCallback((page) => {
        currentPageRef.current = page;
        setCurrentPage(page);
    }, []);

    useEffect(() => {
        currentFolderRef.current = currentFolder;
    }, [currentFolder]);

    const fetchLabelEmails = useCallback(async (labelId, silent = false, page = null) => {
        const isFolderChange = currentFolderRef.current !== `label-${labelId}`;
        const targetPage = isFolderChange
            ? (page !== null && page !== undefined ? page : 1)
            : (page !== null && page !== undefined ? page : currentPageRef.current);

        updateCurrentPage(targetPage);
        if (!user) return;
        if (!silent) setLoading(true);
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
                        fetchLabelEmails(labelId, silent, validPage);
                        return;
                    }
                }

                const normalizedEmails = (data.emails || data || []).map(m => ({
                    ...m,
                    isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
                    starred: m.starred ?? m.isStarred ?? false
                })).filter(m => {
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
            toast.error('Failed to load labeled emails');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user, limit, updateCurrentPage]);

    const getStarredWithDrafts = useCallback(async (targetPage = 1, pageLimit = limit) => {
        const [starredRes, draftsRes] = await Promise.all([
            mailAPI.getStarred(targetPage, pageLimit).catch(err => {
                console.warn('[Starred] Failed to fetch starred emails:', err);
                return { data: { success: false, data: { emails: [] } } };
            }),
            mailAPI.getDrafts(1, 100).catch(err => {
                console.warn('[Starred] Failed to fetch drafts for starred:', err);
                return { data: { success: false, data: { emails: [] } } };
            })
        ]);

        const rawStarred = starredRes?.data?.data?.emails || 
            (Array.isArray(starredRes?.data?.data) ? starredRes.data.data : (starredRes?.data?.data?.unreadEmails || []));

        let starredEmails = rawStarred.map(m => ({
            ...m,
            isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
            starred: true
        }));

        const rawDrafts = draftsRes?.data?.data?.emails || 
            (Array.isArray(draftsRes?.data?.data) ? draftsRes.data.data : []);

        // Also prime pagesCache['draft'][1] if empty
        if (rawDrafts.length > 0) {
            if (!pagesCache.current['draft']) pagesCache.current['draft'] = {};
            if (!pagesCache.current['draft'][1]) {
                pagesCache.current['draft'][1] = rawDrafts.map(d => ({
                    ...d,
                    folderName: d.folderName || 'Drafts',
                    isDraft: true,
                    starred: d.starred ?? d.isStarred ?? false
                }));
            }
        }

        // Collect all drafts from API and memory cache
        const allDraftsMap = new Map();
        const registerDraft = (d) => {
            if (!d) return;
            const uidStr = String(d.uid ?? d.id ?? '');
            if (!uidStr) return;
            if (!allDraftsMap.has(uidStr)) {
                allDraftsMap.set(uidStr, d);
            } else {
                allDraftsMap.set(uidStr, { ...allDraftsMap.get(uidStr), ...d });
            }
        };

        rawDrafts.forEach(registerDraft);

        ['draft', 'drafts'].forEach(f => {
            if (pagesCache.current[f]) {
                Object.values(pagesCache.current[f]).forEach(pageList => {
                    if (Array.isArray(pageList)) {
                        pageList.forEach(registerDraft);
                    }
                });
            }
        });

        // Read local star overrides
        let starOverrides = {};
        try {
            const stored = localStorage.getItem('bnx_draft_star_overrides');
            if (stored) starOverrides = JSON.parse(stored);
        } catch (e) {}

        // Filter only drafts that are starred
        const starredDrafts = [];
        allDraftsMap.forEach((draft, uidStr) => {
            const override = starOverrides[uidStr];
            const isStarred = override !== undefined ? override : (draft.starred === true || draft.isStarred === true);
            if (isStarred) {
                starredDrafts.push({
                    ...draft,
                    folderName: draft.folderName || 'Drafts',
                    isDraft: true,
                    starred: true
                });
            }
        });

        // Avoid duplicate drafts if already returned by starred API
        const seenDraftUids = new Set();
        starredEmails.forEach(e => {
            const isDraft = e.folderName?.toLowerCase() === 'draft' || e.folderName?.toLowerCase() === 'drafts' || e.isDraft || e.draft;
            if (isDraft) {
                seenDraftUids.add(String(e.uid ?? e.id));
            }
        });

        starredDrafts.forEach(draft => {
            const uidStr = String(draft.uid ?? draft.id);
            if (!seenDraftUids.has(uidStr)) {
                starredEmails.push(draft);
                seenDraftUids.add(uidStr);
            }
        });

        sortEmailsByDateDesc(starredEmails);

        return {
            data: {
                success: true,
                data: {
                    emails: starredEmails,
                    totalCount: (starredRes?.data?.data?.totalCount || 0) + starredDrafts.filter(d => !seenDraftUids.has(String(d.uid ?? d.id))).length
                }
            }
        };
    }, [limit]);

    const fetchAllInboxEmails = useCallback(async (targetPage = 1, pageLimit = limit) => {
        const sessionsStr = localStorage.getItem('bnx_sessions');
        let sessions = {};
        try {
            sessions = sessionsStr ? JSON.parse(sessionsStr) : {};
        } catch (e) { }

        const sessionKeys = Object.keys(sessions);
        let allEmails = [];

        if (sessionKeys.length > 0) {
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

            const results = await Promise.all(fetchPromises);
            allEmails = results.flat();
        }

        if (allEmails.length === 0) {
            try {
                const fallbackRes = await mailAPI.getInbox(targetPage, pageLimit);
                if (fallbackRes?.data?.success) {
                    const dataObj = fallbackRes.data.data;
                    const emailsList = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                    allEmails = emailsList.map(e => ({
                        ...e,
                        accountEmail: user?.email || ''
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch fallback inbox for all-inbox:", err);
            }
        }

        const seen = new Set();
        const uniqueEmails = [];
        for (const item of allEmails) {
            const uidStr = String(item.uid ?? item.id ?? item.messageId ?? '');
            const acc = item.accountEmail ? item.accountEmail.toLowerCase() : '';
            const key = uidStr ? `${acc}_${uidStr}` : null;
            if (!key || !seen.has(key)) {
                if (key) seen.add(key);
                uniqueEmails.push(item);
            }
        }

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

    const fetchEmailsSilently = useCallback(async (folder, page = null) => {
        if (!user) return;
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
                case 'sent': res = await mailAPI.getSent(targetPage, limit); break;
                case 'draft':
                case 'drafts': res = await mailAPI.getDrafts(targetPage, limit); break;
                case 'starred': res = await getStarredWithDrafts(targetPage, limit); break;
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
                        if (res?.data?.success) {
                            const dataObj = res.data.data;
                            const list = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                            const unreadItems = list.filter(m => !m.isRead && !m.read);
                            res = {
                                data: {
                                    success: true,
                                    data: {
                                        emails: unreadItems,
                                        totalCount: unreadItems.length,
                                        unreadCount: unreadItems.length
                                    }
                                }
                            };
                        }
                    }
                    if (res?.data?.success && res.data.data) {
                        if (Array.isArray(res.data.data)) {
                            const unreadItems = res.data.data.filter(m => !m.isRead && !m.read);
                            res.data.data = {
                                emails: unreadItems,
                                totalCount: unreadItems.length,
                                unreadCount: unreadItems.length
                            };
                        } else if (!res.data.data.emails && Array.isArray(res.data.data.unreadEmails)) {
                            res.data.data.emails = res.data.data.unreadEmails;
                        }
                    }
                    break;
                }
                default: res = await mailAPI.getInbox(targetPage, limit);
            }

            if (res && res.data?.success) {
                const data = res.data.data || {};
                const rawEmails = data.emails || (Array.isArray(data) ? data : (data.unreadEmails || []));
                let normalizedEmails = rawEmails.map(m => ({
                    ...m,
                    isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
                    starred: m.starred ?? m.isStarred ?? false
                }));

                if (folderKey === 'draft' || folderKey === 'drafts') {
                    let starOverrides = {};
                    try {
                        const stored = localStorage.getItem('bnx_draft_star_overrides');
                        if (stored) starOverrides = JSON.parse(stored);
                    } catch (e) {}
                    normalizedEmails = normalizedEmails.map(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (uidStr && starOverrides[uidStr] !== undefined) {
                            return { ...m, starred: starOverrides[uidStr] };
                        }
                        return m;
                    });
                }

                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
                }

                if (folderKey === 'starred') {
                    sortEmailsByDateDesc(normalizedEmails);
                }

                if (user?.email) {
                    const loginEmail = user.email.trim().toLowerCase();
                    const isEmailMatch = (emailField, currentEmail) => {
                        if (!emailField) return false;
                        const cleanEmail = emailField.trim().toLowerCase();
                        const match = cleanEmail.match(/<([^>]+)>/);
                        const actualEmail = match ? match[1].trim().toLowerCase() : cleanEmail;
                        return actualEmail === currentEmail;
                    };

                    if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(folderKey)) {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const isSenderMe = isEmailMatch(m.senderEmail, loginEmail) || isEmailMatch(m.from, loginEmail);
                            const isRecipientMe = isEmailMatch(m.recipientEmail, loginEmail) || isEmailMatch(m.to, loginEmail) || isEmailMatch(m.cc, loginEmail) || isEmailMatch(m.bcc, loginEmail);
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

                // Calculate dynamic total count reflecting actual filtered unique emails
                let calculatedTotal = normalizedEmails.length;
                if (['all-inbox', 'allinbox', 'spam', 'all-mail', 'allmail'].includes(folderKey)) {
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
                if (countKey === 'inbox' || countKey === 'unread') {
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
                    const unread = normalizedEmails.filter(e => !e.isRead).length;
                    setUnreadCounts(prev => ({
                        ...prev,
                        allinbox: unread
                    }));
                }

                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    setTotalEmails(calculatedTotal);
                    setEmails(normalizedEmails);
                }
            }
        } catch (e) {
            if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
                console.warn(`[Silent Refresh] Timed out while refreshing ${folder}. Will retry on next cycle.`);
            } else if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
                console.warn(`[Silent Refresh] Background sync skipped for ${folder}:`, e?.message || e);
            }
        } finally {
            silentFetchInFlight.current.delete(reqKey);
        }
    }, [user, limit, getStarredWithDrafts, fetchAllInboxEmails]);

    const fetchEmails = useCallback(async (folder = currentFolderRef.current, silent = false, page = null) => {
        const folderKey = (folder || currentFolderRef.current).toLowerCase();
        const isFolderChange = currentFolderRef.current.toLowerCase() !== folderKey;
        const targetPage = isFolderChange
            ? (page !== null && page !== undefined ? page : 1)
            : (page !== null && page !== undefined ? page : currentPageRef.current);
        
        updateCurrentPage(targetPage);
        
        if (!user) return;

        // Instant render: if in-memory cache has data for this folder & page, display it immediately!
        if (pagesCache.current[folderKey] && pagesCache.current[folderKey][targetPage]) {
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

        if (!silent) {
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
                case 'starred': res = await getStarredWithDrafts(targetPage, limit); break;
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
                        if (res?.data?.success) {
                            const dataObj = res.data.data;
                            const list = dataObj?.emails || (Array.isArray(dataObj) ? dataObj : []);
                            const unreadItems = list.filter(m => !m.isRead && !m.read);
                            res = {
                                data: {
                                    success: true,
                                    data: {
                                        emails: unreadItems,
                                        totalCount: unreadItems.length,
                                        unreadCount: unreadItems.length
                                    }
                                }
                            };
                        }
                    }
                    if (res?.data?.success && res.data.data) {
                        if (Array.isArray(res.data.data)) {
                            const unreadItems = res.data.data.filter(m => !m.isRead && !m.read);
                            res.data.data = {
                                emails: unreadItems,
                                totalCount: unreadItems.length,
                                unreadCount: unreadItems.length
                            };
                        } else if (!res.data.data.emails && Array.isArray(res.data.data.unreadEmails)) {
                            res.data.data.emails = res.data.data.unreadEmails;
                        }
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
                    const [inboxRes, sentRes, draftRes, archiveRes] = await Promise.all([
                        mailAPI.getInbox().catch(() => ({ data: { success: false } })),
                        mailAPI.getSent().catch(() => ({ data: { success: false } })),
                        mailAPI.getDrafts().catch(() => ({ data: { success: false } })),
                        mailAPI.getArchive().catch(() => ({ data: { success: false } }))
                    ]);

                    let mergedEmails = [];
                    if (inboxRes.data?.success && inboxRes.data.data?.emails) {
                        mergedEmails = [...mergedEmails, ...inboxRes.data.data.emails];
                    }
                    if (sentRes.data?.success && sentRes.data.data?.emails) {
                        mergedEmails = [...mergedEmails, ...sentRes.data.data.emails];
                    }
                    if (draftRes.data?.success && draftRes.data.data?.emails) {
                        mergedEmails = [...mergedEmails, ...draftRes.data.data.emails];
                    }
                    if (archiveRes.data?.success && archiveRes.data.data?.emails) {
                        mergedEmails = [...mergedEmails, ...archiveRes.data.data.emails];
                    }

                    console.log('📬 [All Mail] Inbox count:', inboxRes.data?.data?.emails?.length);
                    console.log('📬 [All Mail] Sent count:', sentRes.data?.data?.emails?.length);
                    console.log('📬 [All Mail] Draft count:', draftRes.data?.data?.emails?.length);
                    console.log('📬 [All Mail] Archive count:', archiveRes.data?.data?.emails?.length);
                    console.log('📬 [All Mail] Merged count:', mergedEmails.length);

                    // Sort descending by date
                    mergedEmails.sort((a, b) => {
                        const dateA = new Date(a.date || a.sentDate || a.receivedDate || 0);
                        const dateB = new Date(b.date || b.sentDate || b.receivedDate || 0);
                        return dateB - dateA;
                    });

                    // Deduplicate identical messages (e.g. from self-sends in Inbox and Sent)
                    const seenUids = new Set();
                    mergedEmails = mergedEmails.filter(e => {
                        const uidStr = String(e.uid || e.id || '');
                        if (!uidStr) return true;
                        if (seenUids.has(uidStr)) {
                            return false;
                        }
                        seenUids.add(uidStr);
                        return true;
                    });

                    res = {
                        data: {
                            success: true,
                            data: {
                                emails: mergedEmails,
                                unreadCount: (inboxRes.data?.success && inboxRes.data.data?.unreadCount) ? inboxRes.data.data.unreadCount : 0
                            }
                        }
                    };
                    break;
                }
                default: res = await mailAPI.getInbox(page, limit);
            }

            if (res.data?.success) {
                const data = res.data.data || {};
                const rawEmails = data.emails || (Array.isArray(data) ? data : (data.unreadEmails || []));
                let normalizedEmails = rawEmails.map(m => ({
                    ...m,
                    isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
                    starred: m.starred ?? m.isStarred ?? false
                }));

                if (folderKey === 'draft' || folderKey === 'drafts') {
                    let starOverrides = {};
                    try {
                        const stored = localStorage.getItem('bnx_draft_star_overrides');
                        if (stored) starOverrides = JSON.parse(stored);
                    } catch (e) {}
                    normalizedEmails = normalizedEmails.map(m => {
                        const uidStr = String(m.uid ?? m.id ?? '');
                        if (uidStr && starOverrides[uidStr] !== undefined) {
                            return { ...m, starred: starOverrides[uidStr] };
                        }
                        return m;
                    });
                }

                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
                }

                if (folderKey === 'starred') {
                    sortEmailsByDateDesc(normalizedEmails);
                }

                // Filter logic for Inbox and Sent folders based on currently logged-in user's email ID
                const lowerFolder = folder.toLowerCase();
                if (user?.email) {
                    const loginEmail = user.email.trim().toLowerCase();
                    const isEmailMatch = (emailField, currentEmail) => {
                        if (!emailField) return false;
                        const cleanEmail = emailField.trim().toLowerCase();
                        const match = cleanEmail.match(/<([^>]+)>/);
                        const actualEmail = match ? match[1].trim().toLowerCase() : cleanEmail;
                        return actualEmail === currentEmail;
                    };

                    if (['inbox', 'all-inbox', 'allinbox', 'unread'].includes(lowerFolder)) {
                        normalizedEmails = normalizedEmails.filter(m => {
                            const isDraft = m.folderName?.toLowerCase() === 'draft' || m.folderName?.toLowerCase() === 'drafts' || m.isDraft === true || m.draft === true;
                            if (isDraft) return false;
                            const isSenderMe = isEmailMatch(m.senderEmail, loginEmail) || isEmailMatch(m.from, loginEmail);
                            const isRecipientMe = isEmailMatch(m.recipientEmail, loginEmail) || isEmailMatch(m.to, loginEmail) || isEmailMatch(m.cc, loginEmail) || isEmailMatch(m.bcc, loginEmail);
                            
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
                
                // Calculate dynamic total count reflecting actual filtered unique emails
                let calculatedTotal = normalizedEmails.length;
                if (['all-inbox', 'allinbox', 'spam', 'all-mail', 'allmail'].includes(folderKey)) {
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
                        next.allinbox = unread;
                    }
                    return next;
                });

                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    setTotalEmails(calculatedTotal);

                    const totalPages = Math.max(1, Math.ceil(calculatedTotal / limit));
                    if (targetPage > totalPages) {
                        const validPage = totalPages;
                        updateCurrentPage(validPage);
                        if (validPage !== targetPage) {
                            fetchEmails(folder, silent, validPage);
                            return;
                        }
                    }

                    setEmails(normalizedEmails);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch ${folder}:`, error);
            toast.error(`Failed to load ${folder}`);
        } finally {
            if (!silent && currentFolderRef.current.toLowerCase() === folderKey) setLoading(false);
        }
    }, [user, limit, updateCurrentPage, fetchEmailsSilently, getStarredWithDrafts, fetchAllInboxEmails]);

    const fetchLabels = useCallback(async () => {
        if (!user) return;
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
            fetchLabels();
        }
    }, [user, fetchLabels]);

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
            if (document.hidden) return;
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
        };

        const interval = setInterval(syncAllMailStatus, 15000);

        return () => clearInterval(interval);
    }, [user, fetchEmails, fetchEmailsSilently, fetchLabelEmails]);

    const handleToggleStar = async (uid, folder) => {
        const strUid = String(uid);
        const folderLower = (folder || currentFolderRef.current || '').toLowerCase();

        // 1. Determine if this email is a draft
        let targetEmail = emails.find(m => String(m.uid) === strUid || String(m.id) === strUid);
        if (!targetEmail && pagesCache.current) {
            for (const f of ['draft', 'drafts', 'starred', 'inbox', 'sent']) {
                if (pagesCache.current[f]) {
                    for (const p of Object.values(pagesCache.current[f])) {
                        if (Array.isArray(p)) {
                            const found = p.find(m => String(m.uid) === strUid || String(m.id) === strUid);
                            if (found) { targetEmail = found; break; }
                        }
                    }
                }
                if (targetEmail) break;
            }
        }

        const isDraft = folderLower === 'draft' || folderLower === 'drafts' || 
                        targetEmail?.folderName?.toLowerCase() === 'draft' || 
                        targetEmail?.folderName?.toLowerCase() === 'drafts' || 
                        targetEmail?.isDraft === true || 
                        targetEmail?.draft === true;

        const isCurrentlyStarred = currentFolderRef.current?.toLowerCase() === 'starred'
            ? true
            : (targetEmail ? (targetEmail.starred ?? targetEmail.isStarred ?? false) : false);

        const nextStarred = !isCurrentlyStarred;

        // 2. Persist local override if it's a draft
        if (isDraft) {
            try {
                const stored = localStorage.getItem('bnx_draft_star_overrides');
                const overrides = stored ? JSON.parse(stored) : {};
                overrides[strUid] = nextStarred;
                localStorage.setItem('bnx_draft_star_overrides', JSON.stringify(overrides));
            } catch (e) {
                console.warn('Failed to update bnx_draft_star_overrides in localStorage:', e);
            }
        }

        // 3. Optimistic update of active emails state
        setEmails(prev => {
            if (currentFolderRef.current?.toLowerCase() === 'starred') {
                if (!nextStarred) {
                    return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
                }
                return prev;
            }
            return prev.map(m => (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, starred: nextStarred } : m);
        });

        if (currentFolderRef.current?.toLowerCase() === 'starred' && !nextStarred) {
            setTotalEmails(prev => Math.max(0, prev - 1));
        }

        // 4. Update memory caches across folders
        if (pagesCache.current) {
            // Update draft caches: KEEP the draft in drafts list, only toggle starred flag
            ['draft', 'drafts'].forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, starred: nextStarred } : m
                            );
                        }
                    });
                }
            });

            // Update starred cache
            if (pagesCache.current['starred']) {
                if (nextStarred) {
                    // Add to starred cache page 1 if not present
                    const p1 = pagesCache.current['starred'][1];
                    if (Array.isArray(p1)) {
                        const exists = p1.some(m => String(m.uid) === strUid || String(m.id) === strUid);
                        if (!exists && targetEmail) {
                            pagesCache.current['starred'][1] = [
                                {
                                    ...targetEmail,
                                    uid: targetEmail.uid ?? uid,
                                    folderName: targetEmail.folderName || (isDraft ? 'Drafts' : 'INBOX'),
                                    isDraft: isDraft ? true : targetEmail.isDraft,
                                    starred: true
                                },
                                ...p1
                            ];
                        }
                    }
                } else {
                    // Remove from starred cache
                    Object.keys(pagesCache.current['starred']).forEach(p => {
                        if (Array.isArray(pagesCache.current['starred'][p])) {
                            pagesCache.current['starred'][p] = pagesCache.current['starred'][p].filter(m =>
                                String(m.uid) !== strUid && String(m.id) !== strUid
                            );
                        }
                    });
                }
            }

            // Also update any other folder caches (inbox, sent, etc.)
            ['inbox', 'sent', 'archive', 'all-mail', 'allmail'].forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, starred: nextStarred } : m
                            );
                        }
                    });
                }
            });
        }

        // 5. Backend API call
        const apiFolder = isDraft ? 'draft' : (folder || (currentFolderRef.current === 'starred' ? 'INBOX' : currentFolderRef.current));
        try {
            const res = await mailAPI.toggleStar(uid, apiFolder);
            if (!res.data?.success) {
                // Rollback if failed
                if (currentFolderRef.current.startsWith('label-')) {
                    const labelId = currentFolderRef.current.replace('label-', '');
                    fetchLabelEmails(labelId, false, currentPageRef.current);
                } else {
                    fetchEmails(currentFolderRef.current, false, currentPageRef.current);
                }
                toast.error('Failed to update star');
            }
        } catch (error) {
            if (currentFolderRef.current.startsWith('label-')) {
                const labelId = currentFolderRef.current.replace('label-', '');
                fetchLabelEmails(labelId, false, currentPageRef.current);
            } else {
                fetchEmails(currentFolderRef.current, false, currentPageRef.current);
            }
            toast.error('Failed to update star');
        }
    };

    const handleMarkRead = async (uid, silent = false) => {
        const strUid = String(uid);
        let wasUnread = false;
        const currentFolderLower = currentFolderRef.current?.toLowerCase() || '';
        const isSpamFolder = currentFolderLower === 'spam';

        setEmails(prev => prev.map(m => {
            if ((String(m.uid) === strUid || String(m.id) === strUid) && !m.isRead) {
                wasUnread = true;
                return { ...m, isRead: true };
            }
            return m;
        }));

        if (wasUnread) {
            setUnreadCounts(counts => ({
                ...counts,
                inbox: !isSpamFolder ? Math.max(0, (counts.inbox || 0) - 1) : counts.inbox,
                unread: !isSpamFolder ? Math.max(0, (counts.unread || 0) - 1) : counts.unread,
                spam: isSpamFolder ? Math.max(0, (counts.spam || 0) - 1) : counts.spam
            }));
        }

        invalidateCache('unread');
        invalidateCache('inbox');
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }
        if (pagesCache.current) {
            Object.keys(pagesCache.current).forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, isRead: true } : m
                            );
                        }
                    });
                }
            });
        }

        try {
            await mailAPI.markRead(uid);
        } catch (apiErr) {
            console.warn('Backend markRead API call failed:', apiErr);
            if (wasUnread) {
                setEmails(prev => prev.map(m =>
                    (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, isRead: false } : m
                ));
                setUnreadCounts(counts => ({
                    ...counts,
                    inbox: !isSpamFolder ? (counts.inbox || 0) + 1 : counts.inbox,
                    unread: !isSpamFolder ? (counts.unread || 0) + 1 : counts.unread,
                    spam: isSpamFolder ? (counts.spam || 0) + 1 : counts.spam
                }));
            }
        }
    };

    const handleMarkUnread = async (uid, silent = false) => {
        const strUid = String(uid);
        let wasRead = false;
        const currentFolderLower = currentFolderRef.current?.toLowerCase() || '';
        const isSpamFolder = currentFolderLower === 'spam';

        setEmails(prev => prev.map(m => {
            if ((String(m.uid) === strUid || String(m.id) === strUid) && m.isRead) {
                wasRead = true;
                return { ...m, isRead: false };
            }
            return m;
        }));

        if (wasRead) {
            setUnreadCounts(counts => ({
                ...counts,
                inbox: !isSpamFolder ? (counts.inbox || 0) + 1 : counts.inbox,
                unread: !isSpamFolder ? (counts.unread || 0) + 1 : counts.unread,
                spam: isSpamFolder ? (counts.spam || 0) + 1 : counts.spam
            }));
        }

        invalidateCache('unread');
        invalidateCache('inbox');
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }
        if (pagesCache.current) {
            Object.keys(pagesCache.current).forEach(f => {
                if (pagesCache.current[f]) {
                    Object.keys(pagesCache.current[f]).forEach(p => {
                        if (Array.isArray(pagesCache.current[f][p])) {
                            pagesCache.current[f][p] = pagesCache.current[f][p].map(m =>
                                (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, isRead: false } : m
                            );
                        }
                    });
                }
            });
        }
        if (currentFolderRef.current?.toLowerCase() === 'unread') {
            fetchEmails('unread', true, currentPageRef.current);
        }

        try {
            await mailAPI.markUnread(uid);
        } catch (apiErr) {
            console.warn('Backend markUnread API call failed:', apiErr);
            if (wasRead) {
                setEmails(prev => prev.map(m =>
                    (String(m.uid) === strUid || String(m.id) === strUid) ? { ...m, isRead: true } : m
                ));
                setUnreadCounts(counts => ({
                    ...counts,
                    inbox: !isSpamFolder ? Math.max(0, (counts.inbox || 0) - 1) : counts.inbox,
                    unread: !isSpamFolder ? Math.max(0, (counts.unread || 0) - 1) : counts.unread,
                    spam: isSpamFolder ? Math.max(0, (counts.spam || 0) - 1) : counts.spam
                }));
            }
        }
    };

    const handleMoveToTrash = async (uid, folder, silent = false) => {
        const strUid = String(uid);
        const targetFolder = folder || currentFolderRef.current || 'inbox';
        const fKey = targetFolder.toLowerCase();

        let removedEmail = null;
        setEmails(prev => {
            removedEmail = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
            return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
        });

        if (removedEmail && !removedEmail.isRead) {
            if (fKey === 'spam') {
                setUnreadCounts(c => ({ ...c, spam: Math.max(0, (c.spam || 0) - 1) }));
            } else {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: Math.max(0, (c.inbox || 0) - 1),
                    unread: Math.max(0, (c.unread || 0) - 1)
                }));
            }
        }
        setTotalEmails(prev => Math.max(0, prev - 1));
        invalidateCache('trash');
        invalidateCache('unread');
        invalidateCache('inbox');
        if (folder) invalidateCache(folder);
        if (currentFolderRef.current) invalidateCache(currentFolderRef.current);

        try {
            await mailAPI.trash(uid, targetFolder);
            if (!silent) toast.success('Moved to trash');
        } catch (error) {
            if (removedEmail) {
                setEmails(prev => [removedEmail, ...prev]);
                if (!removedEmail.isRead) {
                    if (fKey === 'spam') {
                        setUnreadCounts(c => ({ ...c, spam: (c.spam || 0) + 1 }));
                    } else {
                        setUnreadCounts(c => ({
                            ...c,
                            inbox: (c.inbox || 0) + 1,
                            unread: (c.unread || 0) + 1
                        }));
                    }
                }
                setTotalEmails(prev => prev + 1);
            }
            if (!silent) toast.error('Failed to move to trash');
            throw error;
        }
    };

    const handleDeletePermanently = async (uid, silent = false) => {
        try {
            await mailAPI.permanentDelete(uid);
            setEmails(prev => prev.filter(m => String(m.uid) !== String(uid)));
            invalidateCache('trash');
            if (currentFolder) invalidateCache(currentFolder);
            if (!silent) toast.success('Permanently deleted');
        } catch (error) {
            if (!silent) toast.error('Failed to delete permanently');
        }
    };

    const handleSnooze = async (uid, wakeUpAt, folder = 'INBOX', silent = false) => {
        const targetFolder = folder || currentFolderRef.current || 'INBOX';
        const strUid = String(uid);

        let snoozedItem = null;
        // Optimistically remove the email from the active emails list
        setEmails(prev => {
            snoozedItem = prev.find(m => String(m.uid) === strUid || String(m.id) === strUid);
            return prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid);
        });
        if (snoozedItem && !snoozedItem.isRead) {
            setUnreadCounts(c => ({
                ...c,
                inbox: Math.max(0, (c.inbox || 0) - 1),
                unread: Math.max(0, (c.unread || 0) - 1)
            }));
        }
        setTotalEmails(prev => Math.max(0, prev - 1));

        // Purge from in-memory pages cache
        Object.keys(pagesCache.current).forEach(fKey => {
            if (pagesCache.current[fKey]) {
                Object.keys(pagesCache.current[fKey]).forEach(pKey => {
                    if (Array.isArray(pagesCache.current[fKey][pKey])) {
                        pagesCache.current[fKey][pKey] = pagesCache.current[fKey][pKey].filter(
                            m => String(m.uid) !== strUid && String(m.id) !== strUid
                        );
                    }
                });
            }
        });

        // Invalidate affected folder caches
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');
        invalidateCache('snoozed');
        invalidateCache('unread');
        invalidateCache('starred');
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }

        try {
            await mailAPI.snooze(uid, wakeUpAt, targetFolder);
            if (!silent) toast.success('Snoozed email');
            return true;
        } catch (error) {
            console.error('Failed to snooze email:', error);
            if (snoozedItem && !snoozedItem.isRead) {
                setUnreadCounts(c => ({
                    ...c,
                    inbox: (c.inbox || 0) + 1,
                    unread: (c.unread || 0) + 1
                }));
            }
            if (!silent) toast.error(error.response?.data?.message || 'Failed to snooze');
            // Refresh current folder to restore state on error
            if (currentFolderRef.current?.startsWith('label-')) {
                const labelId = currentFolderRef.current.replace('label-', '');
                fetchLabelEmails(labelId, true, currentPageRef.current);
            } else {
                fetchEmails(currentFolderRef.current, true, currentPageRef.current);
            }
            throw error;
        }
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
        const targetLabel = labels.find(l => String(l.id) === strLabelId || l.name?.toLowerCase() === strLabelId.toLowerCase());
        const labelToAdd = targetLabel || { id: labelId, name: labelId, colorHex: '#135bec' };

        let wasAlreadyApplied = false;

        // Optimistically apply label in active emails list
        setEmails(prev => prev.map(m => {
            if (String(m.uid) === strUid || String(m.id) === strUid) {
                const currentLabels = Array.isArray(m.labels) ? m.labels : [];
                const alreadyHas = currentLabels.some(l => 
                    String(l.id) === strLabelId || 
                    (targetLabel && (String(l.id) === String(targetLabel.id) || l.name === targetLabel.name))
                );
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
                                const alreadyHas = currentLabels.some(l => 
                                    String(l.id) === strLabelId || 
                                    (targetLabel && (String(l.id) === String(targetLabel.id) || l.name === targetLabel.name))
                                );
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

        invalidateCache(`label-${labelId}`);
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }

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
                        labels: (m.labels || []).filter(l => String(l.id) !== strLabelId && l.name !== labelToAdd.name)
                    };
                }
                return m;
            }));
            if (!silent) toast.error(error.response?.data?.message || 'Failed to apply label');
            throw error;
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

        invalidateCache(`label-${labelId}`);
        if (currentFolderRef.current) {
            invalidateCache(currentFolderRef.current);
        }

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

    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isComposeMinimized, setIsComposeMinimized] = useState(false);
    const [isComposeMaximized, setIsComposeMaximized] = useState(false);
    const [composeData, setComposeData] = useState(null);

    const openCompose = useCallback((data = null) => {
        if (data && data.replyTo) {
            const match = data.replyTo.match(/<([^>]+)>/);
            if (match) {
                data.replyTo = match[1];
            }
        }
        setComposeData(data);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
        setIsComposeMaximized(false);
    }, []);

    const closeCompose = useCallback(() => {
        setIsComposeOpen(false);
        setComposeData(null);
    }, []);

    const handleEmailSent = useCallback(async ({ draftId, draftUid, imapDraftUid, sentEmail } = {}) => {
        const targetDraftUids = [draftId, draftUid, imapDraftUid].filter(Boolean).map(String);

        // 1. Immediately remove draft from current active emails state if present
        if (targetDraftUids.length > 0) {
            setEmails(prev => prev.filter(m => {
                const mUid = String(m.uid || m.id || '');
                return !targetDraftUids.includes(mUid);
            }));
        }

        // 2. Invalidate caches for all affected folders
        invalidateCache('draft');
        invalidateCache('drafts');
        invalidateCache('starred');
        invalidateCache('sent');
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');

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

        // Also purge any matching draft from all cached pages
        if (targetDraftUids.length > 0) {
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
        }

        // 3. Clean up backend draft if IMAP or DB draft
        if (imapDraftUid) {
            mailAPI.trash(imapDraftUid, "Drafts").catch(console.error);
        }
        if (draftUid && draftUid !== imapDraftUid) {
            mailAPI.trash(draftUid, "Drafts").catch(() => {});
        }
        if (draftId) {
            api.delete(`/api/mail/drafts/${draftId}`).catch(() => {});
        }

        // 4. Refresh the CURRENT active folder (stay in current folder, e.g. inbox, sent, etc.)
        const curFolder = currentFolderRef.current;
        if (curFolder.startsWith('label-')) {
            const labelId = curFolder.replace('label-', '');
            fetchLabelEmails(labelId, true, currentPageRef.current);
        } else {
            fetchEmails(curFolder, true, currentPageRef.current);
        }

        // 5. Silently update drafts and sent caches in the background
        fetchEmailsSilently('drafts');
        fetchEmailsSilently('starred');
        fetchEmailsSilently('sent');
    }, [fetchEmails, fetchEmailsSilently, fetchLabelEmails, invalidateCache]);

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
                    return {
                        ...email,
                        ...updatedFields,
                        uid: email.uid,
                        id: email.id,
                        starred: email.starred,
                        labels: email.labels,
                        folderName: email.folderName,
                    };
                }
                return email;
            });
        });

        // 2. Immutably update cached pages across draft and starred folders
        ['draft', 'drafts', 'starred'].forEach(folderKey => {
            const folderCache = pagesCache.current[folderKey];
            if (folderCache) {
                Object.keys(folderCache).forEach(pageKey => {
                    if (Array.isArray(folderCache[pageKey])) {
                        folderCache[pageKey] = folderCache[pageKey].map(email => {
                            const emailUid = email.uid !== undefined && email.uid !== null ? String(email.uid) : null;
                            const emailId = email.id !== undefined && email.id !== null ? String(email.id) : null;
                            if (emailUid === strTargetId || emailId === strTargetId) {
                                return {
                                    ...email,
                                    ...updatedFields,
                                    uid: email.uid,
                                    id: email.id,
                                    starred: email.starred,
                                    labels: email.labels,
                                    folderName: email.folderName,
                                };
                            }
                            return email;
                        });
                    }
                });
            }
        });
    }, []);

    const updateDraftUidInState = useCallback((oldTargetId, newUid) => {
        if (!oldTargetId || !newUid) return;
        const strOld = String(oldTargetId);
        setEmails(prev => prev.map(m => {
            const mUid = m.uid !== undefined && m.uid !== null ? String(m.uid) : null;
            const mId = m.id !== undefined && m.id !== null ? String(m.id) : null;
            if (mUid === strOld || mId === strOld) {
                return { ...m, uid: newUid };
            }
            return m;
        }));

        try {
            const stored = localStorage.getItem('bnx_draft_star_overrides');
            if (stored) {
                const overrides = JSON.parse(stored);
                if (overrides[strOld] !== undefined) {
                    overrides[String(newUid)] = overrides[strOld];
                    delete overrides[strOld];
                    localStorage.setItem('bnx_draft_star_overrides', JSON.stringify(overrides));
                }
            }
        } catch (e) {}

        ['draft', 'drafts', 'starred'].forEach(folderKey => {
            const folderCache = pagesCache.current[folderKey];
            if (folderCache) {
                Object.keys(folderCache).forEach(pageKey => {
                    if (Array.isArray(folderCache[pageKey])) {
                        folderCache[pageKey] = folderCache[pageKey].map(m => {
                            const mUid = m.uid !== undefined && m.uid !== null ? String(m.uid) : null;
                            const mId = m.id !== undefined && m.id !== null ? String(m.id) : null;
                            if (mUid === strOld || mId === strOld) {
                                return { ...m, uid: newUid };
                            }
                            return m;
                        });
                    }
                });
            }
        });
    }, []);

    return (
        <MailContext.Provider value={{
            emails,
            loading,
            currentFolder,
            setCurrentFolder,
            unreadCounts,
            labels,
            fetchEmails,
            fetchEmailsSilently,
            invalidateCache,
            fetchLabels,
            fetchLabelEmails,
            handleToggleStar,
            handleMarkRead,
            handleMarkUnread,
            totalEmails,
            currentPage,
            handlePageChange,
            handleMoveToTrash,
            handleDeletePermanently,
            handleSnooze,
            handleCreateLabel,
            handleUpdateLabel,
            handleApplyLabel,
            handleRemoveLabel,
            handleArchive,
            handleUnarchive,
            handleMarkSpam,
            handleRestoreSpam,
            handleUnsubscribe,
            handleDeleteLabel,
            handleEmailSent,
            isComposeOpen,
            setIsComposeOpen,
            isComposeMinimized,
            setIsComposeMinimized,
            isComposeMaximized,
            setIsComposeMaximized,
            composeData,
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
            updateDraftUidInState
        }}>
            {children}
        </MailContext.Provider>
    );
};

export default MailProvider;
export const useMail = () => {
    const context = useContext(MailContext);
    if (!context) {
        return {
            emails: [],
            loading: false,
            labels: [],
            unreadCounts: { inbox: 0, unread: 0, spam: 0, trash: 0 },
            totalEmails: 0,
            currentPage: 1,
            fetchEmails: async () => {},
            fetchEmailsSilently: async () => {},
            fetchLabelEmails: async () => {},
            handleToggleStar: async () => {},
            handleMoveToTrash: async () => {},
            handleDeletePermanently: async () => {},
            handleArchive: async () => {},
            handleUnarchive: async () => {},
            handleSnooze: async () => {},
            handleApplyLabel: async () => {},
            handleRemoveLabel: async () => {},
            handleCreateLabel: async () => {},
            handleUpdateLabel: async () => {},
            handleDeleteLabel: async () => {},
            handleMarkRead: async () => {},
            handleMarkUnread: async () => {},
            handleMarkSpam: async () => {},
            handleRestoreSpam: async () => {},
            handleUnsubscribe: async () => {},
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

