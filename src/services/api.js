import axios from 'axios';
import { API_ENDPOINTS } from '../Data/constants';
import chatCache from './chatCache';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// console.log('🔧 API Base URL:', API_BASE_URL);

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 60000,
    withCredentials: false,
});

// Request Interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        const hasAuth = config.headers && (
            (typeof config.headers.has === 'function' && (config.headers.has('Authorization') || config.headers.has('authorization'))) ||
            config.headers.Authorization ||
            config.headers['Authorization'] ||
            config.headers['authorization']
        );

        if (token && !hasAuth) {
            if (typeof config.headers.set === 'function') {
                config.headers.set('Authorization', `Bearer ${token}`);
            } else {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor for Token Refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Silently ignore intentional request cancellations (e.g. AbortController when switching chats)
        if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
            return Promise.reject(error);
        }

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.warn(`[API Timeout] Request timed out: ${error.config?.url}`);
            return Promise.reject(error);
        }

        if (!error.response) {
            console.warn(`[Network Error] Unable to connect to server: ${error.message || 'Network Error'} (${error.config?.url})`);
            return Promise.reject(error);
        }

        console.log("=== API ERROR INTERCEPTOR ===");
        console.log("Status:", error.response?.status);
        console.log("Data:", error.response?.data);
        console.log("Error string:", error.response?.data?.error);
        console.log("=============================");

        const originalRequest = error.config;

        if (error.response?.status === 503 && error.response?.data?.error === 'maintenance_mode') {
            if (window.location.pathname !== '/maintenance') {
                window.location.href = '/maintenance';
            }
            return Promise.reject(error);
        }

        const errorData = error.response?.data || {};
        const isSuspendedError = error.response?.status === 403 && (
            errorData.error === 'Account suspended' ||
            (errorData.message && errorData.message.toLowerCase().includes('suspended')) ||
            errorData.data?.status === 'ACCOUNT_SUSPENDED'
        );

        if (isSuspendedError) {
            const activeEmail = localStorage.getItem('bnx_active_email');
            let sessionsStr = localStorage.getItem('bnx_sessions');
            let sessions = {};
            try {
                sessions = sessionsStr ? JSON.parse(sessionsStr) : {};
            } catch (e) { }

            if (activeEmail && sessions[activeEmail]) {
                delete sessions[activeEmail];
                localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
            }

            const remainingEmails = Object.keys(sessions);
            if (remainingEmails.length > 0) {
                // If they have other active sessions, just switch to one of them
                const nextEmail = remainingEmails[0];
                const nextSession = sessions[nextEmail];

                localStorage.setItem('bnx_active_email', nextEmail);
                localStorage.setItem('accessToken', nextSession.accessToken);
                localStorage.setItem('refreshToken', nextSession.refreshToken || '');
                localStorage.setItem('userProfile', JSON.stringify(nextSession.userProfile));

                window.location.href = '/inbox';
            } else {
                localStorage.clear();
                window.location.href = `/login?suspended=true&email=${encodeURIComponent(activeEmail || '')}`;
            }
            return Promise.reject(error);
        }

        if (error.response?.status === 401 || error.response?.status === 403) {
            const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/create-mailbox'].includes(window.location.pathname);

            if (!originalRequest._retry && !isAuthPage) {
                originalRequest._retry = true;
                const refreshToken = localStorage.getItem('refreshToken');

                if (refreshToken) {
                    try {
                        const res = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, { refreshToken });
                        if (res.data?.accessToken) {
                            localStorage.setItem('accessToken', res.data.accessToken);
                            localStorage.setItem('refreshToken', res.data.refreshToken);
                            api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
                            originalRequest.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
                            return api(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                    }
                }
            }

            // If refresh fails or it's a second 401, remove current session
            if (!isAuthPage) {
                const activeEmail = localStorage.getItem('bnx_active_email');
                let sessionsStr = localStorage.getItem('bnx_sessions');
                let sessions = {};
                try {
                    sessions = sessionsStr ? JSON.parse(sessionsStr) : {};
                } catch (e) { }

                if (activeEmail && sessions[activeEmail]) {
                    delete sessions[activeEmail];
                    localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
                }

                const remainingEmails = Object.keys(sessions);
                if (remainingEmails.length > 0) {
                    const nextEmail = remainingEmails[0];
                    const nextSession = sessions[nextEmail];

                    localStorage.setItem('bnx_active_email', nextEmail);
                    localStorage.setItem('accessToken', nextSession.accessToken);
                    localStorage.setItem('refreshToken', nextSession.refreshToken || '');
                    localStorage.setItem('userProfile', JSON.stringify(nextSession.userProfile));

                    window.location.href = '/inbox';
                } else {
                    localStorage.clear();
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

const getDeviceName = () => {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('Android')) return 'Android Device';
    if (ua.includes('Macintosh')) return 'MacBook / iMac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Linux')) return 'Linux PC';
    return 'Web Browser';
};

// System APIs
export const systemAPI = {
    getStatus: () => axios.get(`${API_BASE_URL}/api/auth/system-status`)
};

// Auth APIs
export const authAPI = {
    register: (data) => api.post(API_ENDPOINTS.AUTH.REGISTER, data),
    login: (data, deviceName) => {
        const name = deviceName || getDeviceName();
        console.log('🚀 Sending X-Device-Name:', name);

        return api.post(API_ENDPOINTS.AUTH.LOGIN, data, {
            headers: { 'X-Device-Name': name }
        });
    },
    login2fa: (data, deviceName) => {
        const name = deviceName || getDeviceName();
        console.log('🚀 Sending X-Device-Name (2FA):', name);

        return api.post('/api/auth/login/2fa', data, {
            headers: { 'X-Device-Name': name }
        });
    },
    send2faRecoveryOtp: (tempToken) => api.post('/api/auth/login/2fa/send-otp', { tempToken }),
    verify2faRecoveryOtp: (tempToken, otp, deviceName) => {
        const name = deviceName || getDeviceName();
        console.log('🚀 Sending X-Device-Name (2FA Recovery):', name);

        return api.post('/api/auth/login/2fa/verify-otp', { tempToken, otp }, {
            headers: { 'X-Device-Name': name }
        });
    },
    refresh: (refreshToken) => api.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken }),
    logout: (refreshToken) => api.post(API_ENDPOINTS.AUTH.LOGOUT, { refreshToken }),
    sessions: () => api.get(API_ENDPOINTS.AUTH.SESSIONS),
    revokeSession: (sessionId) => api.delete(`/api/auth/sessions/${sessionId}`),
    getExternalSessions: () => api.get('/api/auth/sessions/external'),
    revokeExternalSession: (sessionId) => api.delete(`/api/auth/sessions/external/${sessionId}`),
    setup2fa: () => api.post('/api/users/2fa/setup'),
    verify2fa: (code) => api.post('/api/users/2fa/verify', { code }),
    disable2fa: () => api.post('/api/users/2fa/disable'),
    get2faAccounts: () => api.get('/api/users/2fa/accounts'),
    add2faAccount: (data) => api.post('/api/users/2fa/accounts', data),
    delete2faAccount: (id) => api.delete(`/api/users/2fa/accounts/${id}`),
    changePassword: (data) => api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data),
    getForgotPasswordOptions: (identifier) => api.get(`${API_ENDPOINTS.AUTH.FORGOT_PASSWORD_OPTIONS}?identifier=${encodeURIComponent(identifier)}`),
    sendOTP: (data) => api.post(API_ENDPOINTS.AUTH.SEND_OTP, data),
    verifyOTP: (data) => api.post(API_ENDPOINTS.AUTH.VERIFY_OTP, data),
    resetPassword: (data) => api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data),
    submitAppeal: (email, message) => api.post('/api/auth/appeal', { email, message }),
    getUsernameSuggestions: (params) => api.get('/api/auth/username-suggestions', { params }),
    sendParentOtp: (data) => api.post('/api/auth/child/send-parent-otp', data),
    verifyParentOtp: (data) => api.post('/api/auth/child/verify-parent-otp', data),
    sendMobileOtp: (data) => api.post('/api/auth/send-mobile-otp', data),
    verifyMobileOtp: (data) => api.post('/api/auth/verify-mobile-otp', data),
    fetchGstins: (pan) => api.get('/api/auth/fetch-gstins', { params: { pan } }),
    verifyBusiness: (data) => api.post('/api/auth/verify-business', data),
};
// Mail APIs
export const mailAPI = {
    getInbox: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.INBOX}?page=${page}&limit=${limit}`),
    getSent: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.SENT}?page=${page}&limit=${limit}`),
    getDrafts: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.DRAFTS}?page=${page}&limit=${limit}`),
    getStorageQuota: () => api.get('/api/mail/storage-quota'),
    saveDraft: (data) => api.post(API_ENDPOINTS.MAIL.DRAFTS, data),
    downloadAttachment: (uid, fileName, folder = 'INBOX') => api.get(`/api/mail/${uid}/attachments/${fileName}?folder=${folder}`, { responseType: 'blob' }),
    createDbDraft: (data) => api.post('/api/mail/drafts', data),
    uploadDraftAttachment: (id, formData) => api.post(`/api/mail/drafts/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    removeDraftAttachment: (id, fileName) => api.delete(`/api/mail/drafts/${id}/attachments/${fileName}`),
    sendDbDraft: (id) => api.post(`/api/mail/drafts/${id}/send`),
    getStarred: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.STARRED}?page=${page}&limit=${limit}`),
    getUnread: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.UNREAD}?page=${page}&limit=${limit}`),
    getTrash: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.TRASH}?page=${page}&limit=${limit}`),
    getSpam: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.SPAM}?page=${page}&limit=${limit}`),
    getSnoozed: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.SNOOZED}?page=${page}&limit=${limit}`),
    send: (data) => api.post(API_ENDPOINTS.MAIL.SEND, data),
    scheduleEmail: (data, sendAt) => api.post(`/api/mail/schedule?sendAt=${sendAt}`, data),
    getScheduled: () => api.get('/api/mail/scheduled'),
    cancelScheduled: (id) => api.delete(`/api/mail/scheduled/${id}`),
    getEmail: (uid) => api.get(`${API_ENDPOINTS.MAIL.EMAIL}/${uid}`),
    toggleStar: (uid, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.STAR}/${uid}?folder=${folder}`),
    markRead: (uid) => api.post(`${API_ENDPOINTS.MAIL.READ}/${uid}`),
    markUnread: (uid) => api.post(`${API_ENDPOINTS.MAIL.UNREAD}/${uid}`),
    trash: (uid, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.MOVE_TRASH}/${uid}?folder=${folder}`),
    restore: (uid) => api.post(`${API_ENDPOINTS.MAIL.RESTORE}/${uid}`),
    permanentDelete: (uid) => api.delete(`${API_ENDPOINTS.MAIL.PERMANENT}/${uid}`),
    snooze: (uid, wakeUpAt, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.SNOOZE}/${uid}?wakeUpAt=${encodeURIComponent(wakeUpAt)}&folder=${encodeURIComponent(folder)}`),
    getArchive: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.ARCHIVE}?page=${page}&limit=${limit}`),
    archive: (uid, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.MOVE_ARCHIVE}/${uid}?folder=${folder}`),
    unarchive: (uid) => api.post(`${API_ENDPOINTS.MAIL.UNARCHIVE}/${uid}`),
    markSpam: (uid, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.SPAM}/${uid}?folder=${folder}`),
    restoreSpam: (uid) => api.post(`/api/mail/restore-spam/${uid}`),
    clearSpam: () => api.post('/api/mail/spam/clear'),

    unsubscribe: (senderEmail) => api.post(`${API_ENDPOINTS.MAIL.UNSUBSCRIBE}?senderEmail=${encodeURIComponent(senderEmail)}`),
    subscribe: (senderEmail) => api.post(`${API_ENDPOINTS.MAIL.SUBSCRIBE}?senderEmail=${encodeURIComponent(senderEmail)}`),
    getSubscriptions: () => api.get(API_ENDPOINTS.MAIL.SUBSCRIPTIONS),

    // Labels
    getLabels: () => api.get(API_ENDPOINTS.MAIL.LABELS),
    createLabel: (data) => api.post(API_ENDPOINTS.MAIL.LABELS, data),
    updateLabel: (id, data) => api.put(`${API_ENDPOINTS.MAIL.LABELS}/${id}`, data),
    deleteLabel: (id) => api.delete(`${API_ENDPOINTS.MAIL.LABELS}/${id}`),
    applyLabel: (uid, labelId, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.APPLY_LABEL}/${uid}?labelId=${encodeURIComponent(labelId)}&folder=${encodeURIComponent(folder)}`),
    removeLabel: (uid, labelId, folder = 'INBOX') => api.delete(`${API_ENDPOINTS.MAIL.REMOVE_LABEL}/${uid}?labelId=${encodeURIComponent(labelId)}&folder=${encodeURIComponent(folder)}`),
    getCategory: (category) => api.get(`${API_ENDPOINTS.MAIL.CATEGORY}/${category}`),
};

// Email Management APIs
export const emailAPI = {
    createEmail: (data, token) => api.post(API_ENDPOINTS.EMAILS.CREATE, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    }),
    listEmails: () => api.get(API_ENDPOINTS.EMAILS.LIST),
    setPrimary: (emailId) => api.post(API_ENDPOINTS.EMAILS.SET_PRIMARY.replace(':emailId', emailId)),
};

// User APIs
export const userAPI = {
    getSettings: () => api.get(API_ENDPOINTS.USERS.SETTINGS),
    updateSettings: (data) => api.patch(API_ENDPOINTS.USERS.SETTINGS, data),
    activityLogs: () => api.get(API_ENDPOINTS.USERS.ACTIVITY_LOGS),
    getRecovery: () => api.get(API_ENDPOINTS.USERS.RECOVERY),
    updateRecovery: (data) => api.patch(API_ENDPOINTS.USERS.RECOVERY, data),
    updateProfilePicture: (formData) => api.post('/api/users/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

export const signatureAPI = {
    getSignatures: () => api.get(API_ENDPOINTS.SIGNATURES.BASE),
    createSignature: (data) => api.post(API_ENDPOINTS.SIGNATURES.BASE, data),
    updateSignature: (id, data) => api.put(`${API_ENDPOINTS.SIGNATURES.BASE}/${id}`, data),
    deleteSignature: (id) => api.delete(`${API_ENDPOINTS.SIGNATURES.BASE}/${id}`),
    setDefaultSignature: (id) => api.patch(`${API_ENDPOINTS.SIGNATURES.BASE}/${id}/default`),
};

// Business APIs
export const businessAPI = {
    register: (data) => api.post(API_ENDPOINTS.BUSINESS.REGISTER, data),
    getDomains: () => api.get(API_ENDPOINTS.BUSINESS.DOMAINS),
    verifyDomain: (domainId) => api.post(API_ENDPOINTS.BUSINESS.VERIFY.replace(':id', domainId)),
    onboard: (data) => api.post('/api/business/onboard', data),
};

// Group APIs
export const groupAPI = {
    createGroup: (data) => api.post(API_ENDPOINTS.GROUPS.CREATE, data),
    getAllGroups: () => api.get(API_ENDPOINTS.GROUPS.LIST),
    addMembers: (groupId, data) => api.post(API_ENDPOINTS.GROUPS.MEMBERS.replace(':id', groupId), data),
    getMembers: (groupId) => api.get(API_ENDPOINTS.GROUPS.MEMBERS.replace(':id', groupId)),
    sendBroadcast: (groupId, data) => api.post(API_ENDPOINTS.GROUPS.SEND.replace(':id', groupId), data),
};

// Chat APIs with request deduplication & fast cache sync
export const chatAPI = {
    createDirectChat: (data) => api.post(API_ENDPOINTS.CHAT.DIRECT, data),
    createGroupChat: (data) => api.post(API_ENDPOINTS.CHAT.GROUP, data),
    getUserChats: (email, config = {}) => {
        if (!email) return Promise.resolve({ data: [] });
        return chatCache.dedupe(`user_chats_${email}`, () => 
            api.get(API_ENDPOINTS.CHAT.USER_CHATS.replace(':email', email), { timeout: 30000, ...config })
        ).then(res => {
            if (res?.data) {
                const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
                chatCache.setUserChats(email, list);
            }
            return res;
        });
    },
    getMessageHistory: (chatId, config = {}) => {
        if (!chatId) return Promise.resolve({ data: [] });
        const timeout = config.timeout || 30000;
        return chatCache.dedupe(`msg_${chatId}`, () =>
            api.get(API_ENDPOINTS.CHAT.MESSAGES.replace(':chatId', chatId), { timeout, ...config })
        ).then(res => {
            if (res?.data) {
                const history = Array.isArray(res.data)
                    ? res.data
                    : (Array.isArray(res.data?.data)
                        ? res.data.data
                        : (Array.isArray(res.data?.comments)
                            ? res.data.comments
                            : (Array.isArray(res.data?.messages)
                                ? res.data.messages
                                : (Array.isArray(res.data?.content)
                                    ? res.data.content
                                    : []))));
                const normalized = history.map(m => {
                    if (!m) return null;
                    const content = m.content !== undefined && m.content !== null
                        ? m.content
                        : (m.message !== undefined && m.message !== null ? m.message : (m.text || m.body || ""));
                    return { ...m, content, message: content };
                }).filter(Boolean);
                chatCache.setMessages(chatId, normalized);
            }
            return res;
        });
    },
    sendMessage: (data) => api.post(API_ENDPOINTS.CHAT.SEND_MESSAGE, data),
    addMembers: (chatId, data) => api.post(`/api/chat/${chatId}/members`, data),
    getMembers: (chatId, config = {}) => {
        return chatCache.dedupe(`mbrs_${chatId}`, () =>
            api.get(`/api/chat/${chatId}/members`, { timeout: 30000, ...config })
        ).then(res => {
            if (res?.data) {
                chatCache.setMembers(chatId, res.data);
            }
            return res;
        });
    },
    getBroadcasts: (chatId, config = {}) => {
        return chatCache.dedupe(`bcast_${chatId}`, () =>
            api.get(`/api/chat/${chatId}/broadcasts`, { timeout: 30000, ...config })
        ).then(res => {
            if (res?.data) {
                chatCache.setBroadcasts(chatId, res.data);
            }
            return res;
        });
    },
    sendBroadcast: (chatId, data) => api.post(`/api/chat/${chatId}/broadcast`, data),

    getInvitations: (config = {}) => {
        return chatCache.dedupe('invitations', () =>
            api.get('/api/chat/invitations', { timeout: 30000, ...config })
        ).then(res => {
            if (res?.data) {
                chatCache.setInvitations(res.data);
            }
            return res;
        });
    },
    acceptInvitation: (id) => api.post(`/api/chat/invitations/${id}/accept`),
    rejectInvitation: (id) => api.post(`/api/chat/invitations/${id}/reject`),

    leaveGroup: (chatId) => api.post(`/api/chat/${chatId}/leave`),
    deleteGroup: (chatId) => api.delete(`/api/chat/${chatId}`),
    renameGroup: (chatId, name) => api.patch(`/api/chat/${chatId}/name`, { name })
};

// Template APIs
export const templateAPI = {
    getTemplates: (userEmail) => api.get(`/api/templates${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`),
    createTemplate: (data, userEmail) => api.post(`/api/templates${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`, data),
    updateTemplate: (id, data, userEmail) => api.put(`/api/templates/${id}${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`, data),
    deleteTemplate: (id, userEmail) => api.delete(`/api/templates/${id}${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`),
};

export const vaultAPI = {
    uploadFile: (formData) => api.post('/api/vault/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getUserFiles: () => api.get('/api/vault'),
    downloadFile: (id) => api.get(`/api/vault/${id}/download`, { responseType: 'blob' }),
    deleteFile: (id) => api.delete(`/api/vault/${id}`)
};

// Casbox APIs
export const casboxAPI = {
    getAllMessages: () => api.get('/api/casbox'),
    getThread: (contactEmail) => api.get(`/api/casbox/thread/${encodeURIComponent(contactEmail)}`),
    sendMessage: (data) => api.post('/api/casbox/send', data),
    updateStatus: (data) => api.patch('/api/casbox/status', data),
    markAsDelivered: () => api.post('/api/casbox/delivered'),
    archiveMessage: (id, archived = true) => api.patch(`/api/casbox/${id}/archive?archived=${archived}`),
    updateArchiveStatus: (messageIds, archived = true) => api.patch('/api/casbox/archive', { messageIds, archived }),
    deleteConversation: (contactEmailOrId) => api.delete(`/api/casbox/conversation/${encodeURIComponent(contactEmailOrId)}`),
    // Contact alias endpoints
    getAllAliases: () => api.get('/api/contact-aliases'),
    getAlias: (contactUserId) => api.get(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`),
    setAlias: (contactUserId, customName) => api.put(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`, { customName }),
    deleteAlias: (contactUserId) => api.delete(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`),
    // Connection endpoints
    getAcceptedConnections: () => api.get('/api/connections/accepted'),
    updateConnectionStatus: (connectionId, status) => api.patch(`/api/connections/${encodeURIComponent(connectionId)}/status`, { status }),
};

// Connection APIs
export const connectionAPI = {
    getAccepted: () => api.get('/api/connections/accepted'),
    getAll: () => api.get('/api/connections'),
    updateStatus: (connectionId, status) => api.patch(`/api/connections/${encodeURIComponent(connectionId)}/status`, { status }),
};

// Contact Alias APIs
export const contactAliasAPI = {
    getAllAliases: () => api.get('/api/contact-aliases'),
    getAlias: (contactUserId) => api.get(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`),
    setAlias: (contactUserId, customName) => api.put(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`, { customName }),
    deleteAlias: (contactUserId) => api.delete(`/api/contact-aliases/${encodeURIComponent(contactUserId)}`),
};

// Report APIs
export const reportAPI = {
    submitReport: (data) => api.post('/api/reports', data),
};

// Settings APIs
export const settingsAPI = {
    getComposing: () => api.get(API_ENDPOINTS.SETTINGS?.COMPOSING || '/api/settings/composing'),
    updateComposing: (data) => api.put(API_ENDPOINTS.SETTINGS?.COMPOSING || '/api/settings/composing', data),
    getLanguage: () => api.get(API_ENDPOINTS.SETTINGS?.LANGUAGE || '/api/settings/language'),
    updateLanguage: (language) => api.put(API_ENDPOINTS.SETTINGS?.LANGUAGE || '/api/settings/language', { language }),
    getTextStyle: () => api.get(API_ENDPOINTS.SETTINGS?.TEXT_STYLE || '/api/settings/text-style'),
    updateTextStyle: (data) => api.put(API_ENDPOINTS.SETTINGS?.TEXT_STYLE || '/api/settings/text-style', data),
    getWallpaper: () => api.get('/api/settings/wallpaper'),
    updateWallpaper: (wallpaper) => api.put('/api/settings/wallpaper', { wallpaper }),
    resetWallpaper: () => api.post('/api/settings/wallpaper/reset'),
};

// Blocked Contacts API Service
export const blockedContactsAPI = {
  blockSender: async (email) => {
    const response = await api.post('/api/blocked-contacts', { email });
    return response.data;
  },

  unblockSender: async (email) => {
    const response = await api.delete(`/api/blocked-contacts/${encodeURIComponent(email)}`);
    return response.data;
  },

  checkBlockStatus: async (email) => {
    try {
      const response = await api.get(`/api/blocked-contacts/check?email=${encodeURIComponent(email)}`);
      return response.data;
    } catch (err) {
      console.warn("Failed to check block status, returning fallback", err);
      return { success: true, data: { blocked: false } };
    }
  },

  getBlockedContacts: async () => {
    try {
      const response = await api.get('/api/blocked-contacts');
      return response.data;
    } catch (err) {
      console.warn("Failed to load blocked contacts, returning empty list fallback", err);
      return { success: true, data: [] };
    }
  }
};
