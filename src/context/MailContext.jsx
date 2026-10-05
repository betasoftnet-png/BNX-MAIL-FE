import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { mailAPI, api } from '../services/api';
import { API_ENDPOINTS } from '../Data/constants';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { filterDuplicateSpamEmails } from '../utils/spamFilter';
import toast from 'react-hot-toast';

const MailContext = createContext();

export const MailProvider = ({ children }) => {
    const { user } = useAuth();
    const { emailsPerPage: limit } = useTheme();
    const [emails, setEmails] = useState([]);
    const [currentFolder, setCurrentFolder] = useState('inbox');
    const currentFolderRef = useRef('inbox');
    const pagesCache = useRef({});
    const silentFetchInFlight = useRef(new Set());
    const invalidateCache = useCallback((folder) => {
        if (!folder) return;
        const folderKey = folder.toLowerCase();
        delete pagesCache.current[folderKey];
    }, []);
    const [loading, setLoading] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({ inbox: 0, spam: 0, trash: 0 });
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
                case 'sent': res = await mailAPI.getSent(targetPage, limit); break;
                case 'draft':
                case 'drafts': res = await mailAPI.getDrafts(targetPage, limit); break;
                case 'starred': res = await mailAPI.getStarred(targetPage, limit); break;
                case 'trash': res = await mailAPI.getTrash(targetPage, limit); break;
                case 'spam': res = await mailAPI.getSpam(targetPage, limit); break;
                case 'snoozed': res = await mailAPI.getSnoozed(targetPage, limit); break;
                case 'archive': res = await mailAPI.getArchive(targetPage, limit); break;
                case 'unread': res = await mailAPI.getUnread(targetPage, limit); break;
                default: res = await mailAPI.getInbox(targetPage, limit);
            }

            if (res && res.data?.success) {
                const data = res.data.data;
                let normalizedEmails = (data.emails || []).map(m => ({
                    ...m,
                    isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
                    starred: m.starred ?? m.isStarred ?? false
                }));
                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
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

                    if (['inbox', 'all-inbox', 'allinbox'].includes(folderKey)) {
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

                // Update caches
                if (!pagesCache.current[folderKey]) pagesCache.current[folderKey] = {};
                pagesCache.current[folderKey][targetPage] = normalizedEmails;

                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    setTotalEmails(folderKey === 'spam' ? normalizedEmails.length : (data.totalCount || 0));
                    setEmails(normalizedEmails);
                    const countKey = folderKey.replace('-', '').replace(' ', '');
                    const unread = folderKey === 'spam'
                        ? normalizedEmails.filter(e => !e.isRead).length
                        : (data.unreadCount || 0);
                    setUnreadCounts(prev => ({ ...prev, [countKey]: unread }));
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
    }, [user, limit]);

    const fetchEmails = useCallback(async (folder = currentFolderRef.current, silent = false, page = null) => {
        const folderKey = (folder || currentFolderRef.current).toLowerCase();
        const isFolderChange = currentFolderRef.current.toLowerCase() !== folderKey;
        const targetPage = isFolderChange
            ? (page !== null && page !== undefined ? page : 1)
            : (page !== null && page !== undefined ? page : currentPageRef.current);
        
        updateCurrentPage(targetPage);
        
        if (!user) return;

        // Check in-memory cache if available and silent
        if (silent && pagesCache.current[folderKey] && pagesCache.current[folderKey][targetPage]) {
            setEmails(pagesCache.current[folderKey][targetPage]);
            setCurrentFolder(folder);
            currentFolderRef.current = folder;
            fetchEmailsSilently(folder, targetPage);
            return;
        }

        if (!silent) {
            setLoading(true);
        }
        
        // Clear emails if switching folders to avoid flashing stale content
        setEmails(prev => (currentFolderRef.current.toLowerCase() === folderKey ? prev : []));
        setCurrentFolder(folder);
        currentFolderRef.current = folder;

        try {
            let res;
            switch (folder.toLowerCase()) {
                case 'inbox': res = await mailAPI.getInbox(targetPage, limit); break;
                case 'sent': res = await mailAPI.getSent(targetPage, limit); break;
                case 'draft':
                case 'drafts': res = await mailAPI.getDrafts(targetPage, limit); break;
                case 'starred': res = await mailAPI.getStarred(targetPage, limit); break;
                case 'trash': res = await mailAPI.getTrash(targetPage, limit); break;
                case 'spam': res = await mailAPI.getSpam(targetPage, limit); break;
                case 'snoozed': res = await mailAPI.getSnoozed(targetPage, limit); break;
                case 'archive': res = await mailAPI.getArchive(targetPage, limit); break;
                case 'unread': res = await mailAPI.getUnread(targetPage, limit); break;
                case 'all-inbox':
                case 'allinbox': {
                    const sessionsStr = localStorage.getItem('bnx_sessions');
                    let sessions = {};
                    try {
                        sessions = sessionsStr ? JSON.parse(sessionsStr) : {};
                    } catch (e) { }

                    const sessionKeys = Object.keys(sessions);
                    if (sessionKeys.length === 0) {
                        res = await mailAPI.getInbox(page, limit);
                        break;
                    }

                    const fetchPromises = sessionKeys.map(async (email) => {
                        const token = sessions[email].accessToken;
                        try {
                            const inboxRes = await api.get(API_ENDPOINTS.MAIL.INBOX, {
                                headers: {
                                    Authorization: `Bearer ${token}`
                                }
                            });
                            if (inboxRes.data?.success) {
                                const emailsList = inboxRes.data.data?.emails || [];
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
                    const mergedEmails = results.flat();

                    mergedEmails.sort((a, b) => {
                        const dateA = new Date(a.date || a.receivedDate || a.sentDate || 0);
                        const dateB = new Date(b.date || b.receivedDate || b.sentDate || 0);
                        return dateB - dateA;
                    });

                    const totalUnreadCount = mergedEmails.filter(e => !e.isRead).length;

                    res = {
                        data: {
                            success: true,
                            data: {
                                emails: mergedEmails,
                                unreadCount: totalUnreadCount
                            }
                        }
                    };
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
                const data = res.data.data;
                let normalizedEmails = (data.emails || []).map(m => ({
                    ...m,
                    isRead: m.isRead !== undefined ? Boolean(m.isRead) : (m.read !== undefined ? Boolean(m.read) : false),
                    starred: m.starred ?? m.isStarred ?? false
                }));
                if (folderKey !== 'trash') {
                    normalizedEmails = normalizedEmails.filter(m => {
                        const isTrash = m.folderName?.toLowerCase() === 'trash' || m.folderName?.toLowerCase() === 'deleted' || m.isTrash === true || m.isDeleted === true || m.deleted === true;
                        return !isTrash;
                    });
                }

                if (folderKey === 'spam') {
                    normalizedEmails = filterDuplicateSpamEmails(normalizedEmails);
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

                    if (['inbox', 'all-inbox', 'allinbox'].includes(lowerFolder)) {
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
                
                // Update Cache
                if (!pagesCache.current[folderKey]) pagesCache.current[folderKey] = {};
                pagesCache.current[folderKey][targetPage] = normalizedEmails;
                
                // Only update active screen if it matches the current folder
                if (currentFolderRef.current.toLowerCase() === folderKey) {
                    const totalCount = folderKey === 'spam' ? normalizedEmails.length : (data.totalCount || 0);
                    setTotalEmails(totalCount);

                    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
                    if (targetPage > totalPages) {
                        const validPage = totalPages;
                        updateCurrentPage(validPage);
                        if (validPage !== targetPage) {
                            fetchEmails(folder, silent, validPage);
                            return;
                        }
                    }

                    setEmails(normalizedEmails);
                    const countKey = folderKey.replace('-', '').replace(' ', '');
                    const unread = folderKey === 'spam'
                        ? normalizedEmails.filter(e => !e.isRead).length
                        : (data.unreadCount || 0);
                    setUnreadCounts(prev => ({ ...prev, [countKey]: unread }));
                }
            }
        } catch (error) {
            console.error(`Failed to fetch ${folder}:`, error);
            toast.error(`Failed to load ${folder}`);
        } finally {
            if (!silent && currentFolderRef.current.toLowerCase() === folderKey) setLoading(false);
        }
    }, [user, limit, updateCurrentPage, fetchEmailsSilently]);

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

    // Background auto-polling for new emails every 30 seconds
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            if (!document.hidden) {
                const isChatMode = typeof window !== 'undefined' && 
                    (window.location.pathname.startsWith('/colab') || 
                     window.location.pathname.startsWith('/chat') || 
                     window.location.pathname.startsWith('/casbox'));
                if (isChatMode) return;

                if (currentFolderRef.current.startsWith('label-')) {
                    const labelId = currentFolderRef.current.replace('label-', '');
                    fetchLabelEmails(labelId, true, currentPageRef.current);
                } else {
                    fetchEmails(currentFolderRef.current, true, currentPageRef.current);
                }
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [user, fetchEmails, fetchLabelEmails]);

    const handleToggleStar = async (uid, folder) => {
        // Optimistic update
        setEmails(prev => {
            if (currentFolder?.toLowerCase() === 'starred') {
                return prev.filter(m => String(m.uid) !== String(uid));
            }
            return prev.map(m => String(m.uid) === String(uid) ? { ...m, starred: !m.starred } : m);
        });

        try {
            const res = await mailAPI.toggleStar(uid, folder);
            if (!res.data?.success) {
                // Rollback if failed
                if (currentFolder.startsWith('label-')) {
                    const labelId = currentFolder.replace('label-', '');
                    fetchLabelEmails(labelId, false, currentPageRef.current);
                } else {
                    fetchEmails(currentFolder, false, currentPageRef.current);
                }
                toast.error('Failed to update star');
            }
        } catch (error) {
            if (currentFolder.startsWith('label-')) {
                const labelId = currentFolder.replace('label-', '');
                fetchLabelEmails(labelId, false, currentPageRef.current);
            } else {
                fetchEmails(currentFolder, false, currentPageRef.current);
            }
            toast.error('Failed to update star');
        }
    };

    const handleMarkRead = async (uid, silent = false) => {
        try {
            await mailAPI.markRead(uid);
            setEmails(prev => prev.map(m => {
                if (String(m.uid) === String(uid) && !m.isRead) {
                    // Update unread counts locally
                    setUnreadCounts(counts => ({
                        ...counts,
                        inbox: currentFolderRef.current?.toLowerCase() === 'inbox' ? Math.max(0, (counts.inbox || 0) - 1) : counts.inbox,
                        spam: currentFolderRef.current?.toLowerCase() === 'spam' ? Math.max(0, (counts.spam || 0) - 1) : counts.spam
                    }));
                    return { ...m, isRead: true };
                }
                return m;
            }));
        } catch (error) {
            console.error('Mark read failed:', error);
        }
    };

    const handleMarkUnread = async (uid, silent = false) => {
        try {
            await mailAPI.markUnread(uid);
            setEmails(prev => prev.map(m => String(m.uid) === String(uid) ? { ...m, isRead: false } : m));
            setUnreadCounts(counts => ({
                ...counts,
                inbox: currentFolderRef.current?.toLowerCase() === 'inbox' ? (counts.inbox || 0) + 1 : counts.inbox,
                spam: currentFolderRef.current?.toLowerCase() === 'spam' ? (counts.spam || 0) + 1 : counts.spam
            }));
            invalidateCache('unread');
            if (currentFolderRef.current) {
                invalidateCache(currentFolderRef.current);
            }
            if (currentFolderRef.current?.toLowerCase() === 'unread') {
                fetchEmails('unread', true, currentPageRef.current);
            }
        } catch (error) {
            console.error('Mark unread failed:', error);
        }
    };

    const handleMoveToTrash = async (uid, folder, silent = false) => {
        try {
            const targetFolder = folder || currentFolderRef.current || 'inbox';
            await mailAPI.trash(uid, targetFolder);
            setEmails(prev => {
                const item = prev.find(m => String(m.uid) === String(uid));
                if (item && !item.isRead) {
                    const fKey = (folder || currentFolderRef.current || '').toLowerCase();
                    if (fKey === 'spam') {
                        setUnreadCounts(c => ({ ...c, spam: Math.max(0, (c.spam || 0) - 1) }));
                    } else if (fKey === 'inbox') {
                        setUnreadCounts(c => ({ ...c, inbox: Math.max(0, (c.inbox || 0) - 1) }));
                    }
                }
                return prev.filter(m => String(m.uid) !== String(uid));
            });
            setTotalEmails(prev => Math.max(0, prev - 1));
            invalidateCache('trash');
            if (folder) invalidateCache(folder);
            if (currentFolderRef.current) invalidateCache(currentFolderRef.current);
            if (!silent) toast.success('Moved to trash');
        } catch (error) {
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

        // Optimistically remove the email from the active emails list
        setEmails(prev => prev.filter(m => String(m.uid) !== strUid && String(m.id) !== strUid));
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
        try {
            await mailAPI.archive(uid, folder);
            if (currentFolder === 'inbox') {
                setEmails(prev => prev.filter(m => String(m.uid) !== String(uid)));
            } else {
                setEmails(prev => prev.map(m => String(m.uid) === String(uid) ? { ...m, folderName: 'Archive' } : m));
            }
            // Invalidate cache
            if (folder) invalidateCache(folder);
            invalidateCache('archive');
            if (!silent) toast.success('Email archived');
        } catch (error) {
            console.error('Failed to archive:', error);
            if (!silent) toast.error('Failed to archive email');
        }
    };

    const handleUnarchive = async (uid, silent = false) => {
        try {
            await mailAPI.unarchive(uid);
            if (currentFolder === 'archive') {
                setEmails(prev => prev.filter(m => String(m.uid) !== String(uid)));
            } else {
                setEmails(prev => prev.map(m => String(m.uid) === String(uid) ? { ...m, folderName: 'INBOX' } : m));
            }
            // Invalidate cache
            invalidateCache('archive');
            invalidateCache('inbox');
            if (!silent) toast.success('Email restored');
        } catch (error) {
            console.error('Failed to unarchive:', error);
            if (!silent) toast.error('Failed to unarchive email');
        }
    };

    const handleMarkSpam = async (uid, folder = currentFolder, silent = false) => {
        try {
            await mailAPI.markSpam(uid, folder);
            setEmails(prev => prev.filter(m => String(m.uid) !== String(uid)));
            if (!silent) toast.success('Reported as spam');
        } catch (error) {
            if (!silent) toast.error('Failed to report spam');
        }
    };

    const handleRestoreSpam = async (uid, silent = false) => {
        try {
            await mailAPI.restoreSpam(uid);
            setEmails(prev => {
                const item = prev.find(m => String(m.uid) === String(uid));
                if (item && !item.isRead) {
                    setUnreadCounts(c => ({ ...c, spam: Math.max(0, (c.spam || 0) - 1) }));
                }
                return prev.filter(m => String(m.uid) !== String(uid));
            });
            invalidateCache('spam');
            invalidateCache('inbox');
            if (!silent) toast.success('Restored from spam');
        } catch (error) {
            if (!silent) toast.error('Failed to restore from spam');
        }
    };

    const handleUnsubscribe = async (senderEmail, silent = false) => {
        try {
            await Promise.allSettled([
                mailAPI.unsubscribe ? mailAPI.unsubscribe(senderEmail) : Promise.resolve(),
                blockedContactsAPI.blockSender(senderEmail)
            ]);
            if (!silent) toast.success('Unsubscribed from ' + senderEmail);
        } catch (error) {
            if (!silent) toast.error('Failed to unsubscribe');
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
        invalidateCache('sent');
        invalidateCache('inbox');
        invalidateCache('all-inbox');
        invalidateCache('allinbox');
        invalidateCache('all-mail');
        invalidateCache('allmail');

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
        fetchEmailsSilently('sent');
    }, [fetchEmails, fetchEmailsSilently, fetchLabelEmails, invalidateCache]);

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
            closeCompose
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
            unreadCounts: { inbox: 0, spam: 0, trash: 0 },
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
        };
    }
    return context;
};

