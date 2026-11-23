import axios from 'axios';
import { API_ENDPOINTS } from '../Data/constants';
import chatCache from './chatCache';

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    if (typeof window !== 'undefined') {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
            return ''; // Use Vite dev proxy
        }
        return 'https://api.bnxmail.com';
    }
    return 'https://api.bnxmail.com';
};

const API_BASE_URL = getApiBaseUrl();

// console.log('🔧 API Base URL:', API_BASE_URL);

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 60000,
    withCredentials: false,
});

// Standalone unintercepted Axios instance specifically for auth refresh / token exchange
const authClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
    withCredentials: false,
});

// Helper to set Authorization header cleanly across AxiosHeaders or standard objects
export const setAuthHeader = (config, token) => {
    if (!token) return;
    if (typeof config.headers?.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
    } else if (config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
        delete config.headers['authorization'];
    } else {
        config.headers = { Authorization: `Bearer ${token}` };
    }
};

const isAuthEndpoint = (url) => {
    if (!url || typeof url !== 'string') return false;
    return (
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/refresh') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/forgot-password') ||
        url.includes('/api/auth/reset-password')
    );
};

// Safely parse JWT to inspect expiration without external dependencies
export const parseJwt = (token) => {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) {
            base64 += '='.repeat(4 - pad);
        }
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

// Singleton in-flight refresh promise and request queue to prevent duplicate concurrent calls
let refreshPromise = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

export const refreshAccessToken = async () => {
    if (refreshPromise) {
        return refreshPromise;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        return Promise.reject(new Error('No refresh token available'));
    }

    refreshPromise = (async () => {
        try {
            const res = await authClient.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });

            // Extract tokens from ApiResponse structure: res.data.data or res.data
            const responseData = res.data?.data || res.data || {};
            const newAccessToken = responseData.accessToken;
            const newRefreshToken = responseData.refreshToken || refreshToken;

            if (!newAccessToken) {
                throw new Error('No access token in refresh response');
            }

            // Persist tokens
            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

            // Sync multi-account sessions store
            const activeEmail = localStorage.getItem('bnx_active_email');
            try {
                const sessionsStr = localStorage.getItem('bnx_sessions');
                if (sessionsStr) {
                    const sessions = JSON.parse(sessionsStr);
                    if (activeEmail && sessions[activeEmail]) {
                        sessions[activeEmail].accessToken = newAccessToken;
                        sessions[activeEmail].refreshToken = newRefreshToken;
                        localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
                    }
                }
            } catch (e) {
                console.warn('Could not update bnx_sessions on token refresh:', e);
            }

            // Notify WebSocket and active listeners of token rotation
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bnx-token-refreshed', {
                    detail: { accessToken: newAccessToken, refreshToken: newRefreshToken }
                }));
            }

            return newAccessToken;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

let isHandlingExpiry = false;

const handleSessionExpiry = () => {
    if (isHandlingExpiry) return;
    isHandlingExpiry = true;

    const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/create-mailbox'].includes(window.location.pathname) || window.location.pathname.startsWith('/signup');
    if (isAuthPage) {
        isHandlingExpiry = false;
        return;
    }

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
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('tempToken');
        localStorage.removeItem('bnx_active_email');
        localStorage.removeItem('bnx_sessions');

        window.location.href = '/login';
    }
};

// Request Interceptor
api.interceptors.request.use(
    async (config) => {
        if (isAuthEndpoint(config.url)) {
            return config;
        }

        // If a token refresh is currently in flight, wait for it so pending requests use the fresh token
        if (refreshPromise) {
            try {
                const freshToken = await refreshPromise;
                if (freshToken) {
                    setAuthHeader(config, freshToken);
                    return config;
                }
            } catch (e) {
                // If refresh failed, allow request to proceed to response interceptor for 401 handling
            }
        }

        let token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');

        if (token && refreshToken) {
            const payload = parseJwt(token);
            if (payload && payload.exp) {
                const expiryMs = payload.exp * 1000;
                const nowMs = Date.now();
                // If token expires within 60 seconds or is already expired, proactively refresh
                if (nowMs >= expiryMs - 60000) {
                    try {
                        token = await refreshAccessToken();
                    } catch (e) {
                        console.warn('Proactive token refresh attempt:', e?.message);
                    }
                }
            }
        }

        if (token) {
            setAuthHeader(config, token);
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
            return Promise.reject(error);
        }

        if (!error.response) {
            const config = error.config;
            const isGetRequest = !config?.method || config.method.toLowerCase() === 'get';
            // Automatically retry once for transient network drops, socket timeouts, or HTTP/2 ping failures on GET requests
            if (config && isGetRequest && !config._networkRetry) {
                config._networkRetry = true;
                await new Promise(resolve => setTimeout(resolve, 300));
                return api(config);
            }
            return Promise.reject(error);
        }

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

        if (error.response?.status === 401) {
            const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/create-mailbox'].includes(window.location.pathname) || window.location.pathname.startsWith('/signup');

            if (isAuthPage || isAuthEndpoint(originalRequest?.url)) {
                return Promise.reject(error);
            }

            if (originalRequest?._retry) {
                // Do NOT retry multiple times. Reject the error.
                console.warn('Request failed 401 after token retry for endpoint:', originalRequest.url);
                return Promise.reject(error);
            }

            // If a refresh is already in progress, queue this request to be retried with the new token
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((newToken) => {
                        originalRequest._retry = true;
                        setAuthHeader(originalRequest, newToken);
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            isRefreshing = true;
            originalRequest._retry = true;

            return new Promise((resolve, reject) => {
                refreshAccessToken()
                    .then((newToken) => {
                        setAuthHeader(originalRequest, newToken);
                        processQueue(null, newToken);
                        resolve(api(originalRequest));
                    })
                    .catch((refreshError) => {
                        processQueue(refreshError, null);

                        const status = refreshError.response?.status;
                        const refreshMsg = (refreshError.response?.data?.message || '').toLowerCase();
                        const isNoToken = refreshError.message === 'No refresh token available';
                        const isExplicitAuthFailure = status === 401 ||
                            (status === 400 && (refreshMsg.includes('refresh token') || refreshMsg.includes('expired') || refreshMsg.includes('revoked'))) ||
                            isNoToken;

                        if (isExplicitAuthFailure) {
                            console.warn('Refresh token explicitly revoked or expired. Terminating session.');
                            handleSessionExpiry();
                        } else {
                            console.warn('Temporary error during token refresh. Preserving session:', refreshError?.message);
                        }

                        reject(refreshError);
                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
            });
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
    refresh: (refreshToken) => authClient.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken }),
    logout: (refreshToken) => api.post(API_ENDPOINTS.AUTH.LOGOUT, { refreshToken }),
    sessions: () => api.get(API_ENDPOINTS.AUTH.SESSIONS),
    revokeSession: (sessionId) => api.delete(`/api/auth/sessions/${sessionId}`),
    getExternalSessions: () => api.get('/api/auth/sessions/external'),
    revokeExternalSession: (sessionId) => api.delete(`/api/auth/sessions/external/${sessionId}`),
    checkOAuthSession: (token) => api.get('/api/oauth/check-session', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    introspectOAuthToken: (token) => api.post('/api/oauth/introspect', { token }),
    revokeOAuthToken: (data) => api.post('/api/oauth/revoke', data),
    authorizeOAuth: (data) => api.post('/api/oauth/authorize', data),
    exchangeOAuthToken: (data) => api.post('/api/oauth/token', data),
    setup2fa: (refresh = false) => api.post(`/api/users/2fa/setup${refresh ? '?refresh=true' : ''}`),
    verify2fa: (payload) => api.post('/api/users/2fa/verify', typeof payload === 'object' ? payload : { code: payload }),
    disable2fa: (data) => api.post('/api/users/2fa/disable', data || {}),
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

const cleanSenderEmailParam = (input) => {
    if (!input) return '';
    if (typeof input === 'object') {
        if (input.nativeEvent || input.target || input.preventDefault || input._reactName) {
            return '';
        }
        input = input.email || input.senderEmail || input.blockedEmail || input.address || input.sender || '';
    }
    const str = String(input || '').trim();
    if (str.includes('<') && str.includes('>')) {
        const match = str.match(/<([^>]+)>/);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return str;
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
    getDbDrafts: () => api.get('/api/mail/drafts'),
    getDbDraft: (id) => api.get(`/api/mail/drafts/${id}`),
    deleteDbDraft: (id) => api.delete(`/api/mail/drafts/${id}`),
    uploadDraftAttachment: (id, formData) => api.post(`/api/mail/drafts/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    removeDraftAttachment: (id, fileName) => api.delete(`/api/mail/drafts/${id}/attachments/${fileName}`),
    sendDbDraft: (id) => api.post(`/api/mail/drafts/${id}/send`),
    getStarred: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.STARRED}?page=${page}&limit=${limit}`),
    getImportant: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.IMPORTANT}?page=${page}&limit=${limit}`),
    getUnread: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.UNREAD}?page=${page}&limit=${limit}`),
    getTrash: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.TRASH}?page=${page}&limit=${limit}`),
    getSpam: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.SPAM}?page=${page}&limit=${limit}`),
    getSnoozed: (page = 1, limit = 50) => api.get(`${API_ENDPOINTS.MAIL.SNOOZED}?page=${page}&limit=${limit}`),
    send: (data) => api.post(API_ENDPOINTS.MAIL.SEND, data),
    undoSend: (sendId) => api.post(`/api/mail/undo-send/${sendId}`),
    getPendingEmail: (sendId) => api.get(`/api/mail/pending/${sendId}`),
    getActivePendingEmails: () => api.get('/api/mail/pending'),
    scheduleEmail: (data, sendAt) => api.post(`/api/mail/schedule?sendAt=${sendAt}`, data),
    getScheduled: () => api.get('/api/mail/scheduled'),
    cancelScheduled: (id) => api.delete(`/api/mail/scheduled/${id}`),
    getEmail: (uid) => api.get(`${API_ENDPOINTS.MAIL.EMAIL}/${uid}`),
    toggleStar: (uid, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.STAR}/${uid}?folder=${folder}`),
    toggleImportant: (uid, folder = 'INBOX', isImportant) => api.post(`/api/mail/important/${uid}?folder=${encodeURIComponent(folder)}${isImportant !== undefined ? `&isImportant=${isImportant}` : ''}`),
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

    unsubscribe: (senderEmail) => {
        const email = cleanSenderEmailParam(senderEmail);
        if (!email) {
            return Promise.resolve({ data: { success: false, message: 'Invalid sender email' } });
        }
        return api.post(
            `${API_ENDPOINTS.MAIL.UNSUBSCRIBE}?senderEmail=${encodeURIComponent(email)}&email=${encodeURIComponent(email)}`,
            { senderEmail: email, email: email }
        );
    },
    subscribe: (senderEmail) => {
        const email = cleanSenderEmailParam(senderEmail);
        if (!email) {
            return Promise.resolve({ data: { success: false, message: 'Invalid sender email' } });
        }
        return api.post(
            `${API_ENDPOINTS.MAIL.SUBSCRIBE}?senderEmail=${encodeURIComponent(email)}&email=${encodeURIComponent(email)}`,
            { senderEmail: email, email: email }
        );
    },
    getSubscriptions: () => api.get(API_ENDPOINTS.MAIL.SUBSCRIPTIONS),
    autocompleteRecipients: (query, limit = 10, mode = '') =>
        api.get(`${API_ENDPOINTS.MAIL.RECIPIENTS_AUTOCOMPLETE || '/api/mail/recipients/autocomplete'}?query=${encodeURIComponent(query)}&limit=${limit}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`),
    lookupUser: (email) =>
        api.get(`/api/mail/recipients/lookup-user?email=${encodeURIComponent(email || '')}`),

    // Labels
    getLabels: () => api.get(API_ENDPOINTS.MAIL.LABELS),
    createLabel: (data) => api.post(API_ENDPOINTS.MAIL.LABELS, data),
    updateLabel: (id, data) => api.put(`${API_ENDPOINTS.MAIL.LABELS}/${id}`, data),
    deleteLabel: (id) => api.delete(`${API_ENDPOINTS.MAIL.LABELS}/${id}`),
    applyLabel: (uid, labelId, folder = 'INBOX') => api.post(`${API_ENDPOINTS.MAIL.APPLY_LABEL}/${uid}?labelId=${encodeURIComponent(labelId)}&folder=${encodeURIComponent(folder)}`),
    removeLabel: (uid, labelId, folder = 'INBOX') => api.delete(`${API_ENDPOINTS.MAIL.REMOVE_LABEL}/${uid}?labelId=${encodeURIComponent(labelId)}&folder=${encodeURIComponent(folder)}`),
    getSystemLabelSettings: () => api.get(API_ENDPOINTS.MAIL.SYSTEM_LABEL_SETTINGS),
    updateSystemLabelSettings: (settings) => api.put(API_ENDPOINTS.MAIL.SYSTEM_LABEL_SETTINGS, { settings }),
    getCategory: (category) => api.get(`${API_ENDPOINTS.MAIL.CATEGORY}/${category}`),
};

// Read Receipt APIs (Business Accounts & Recipient Confirmation)
export const readReceiptAPI = {
    respond: (receiptId, action = 'ACCEPT', reason = '') =>
        api.post(`/api/mail/read-receipt/${receiptId}/respond`, { action, reason }),
    updateStatus: (receiptId, status, reason = '') =>
        api.post(`/api/mail/read-receipt/${receiptId}/status`, { status, reason }),
    getReceipt: (receiptId) =>
        api.get(`/api/mail/read-receipt/${receiptId}`),
    queryStatus: (params) =>
        api.get('/api/mail/read-receipt/status', { params }),
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
    activityLogs: () => api.get(API_ENDPOINTS.USERS.ACTIVITY_LOGS, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        }
    }),
    getRecovery: () => api.get(API_ENDPOINTS.USERS.RECOVERY),
    updateRecovery: (data) => api.patch(API_ENDPOINTS.USERS.RECOVERY, data),
    updateProfilePicture: (formData) => api.post('/api/users/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    autocompleteRecipients: (query, limit = 10, mode = '') =>
        api.get(`/api/users/autocomplete-recipients?query=${encodeURIComponent(query)}&limit=${limit}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`),
    lookupUser: (email) =>
        api.get(`/api/users/lookup-user?email=${encodeURIComponent(email || '')}`),
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
        const { forceRefresh = false, ...axiosConfig } = config;
        const timeout = axiosConfig.timeout || 45000;
        return chatCache.dedupe(`msg_${chatId}`, () =>
            api.get(API_ENDPOINTS.CHAT.MESSAGES.replace(':chatId', chatId), { timeout, ...axiosConfig }),
            axiosConfig.signal,
            forceRefresh
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
    updateMemberRole: (chatId, data) => api.put(`/api/chat/${chatId}/members/role`, data),
    removeMember: (chatId, email) => {
        return api.delete(`/api/chat/${chatId}/members/${encodeURIComponent(email)}`).then(res => {
            chatCache.invalidateMembers(chatId);
            return res;
        });
    },
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
    renameGroup: (chatId, name) => api.patch(`/api/chat/${chatId}/name`, { name }),
    deleteMessage: (messageId) => api.delete(`/api/chat/message/${encodeURIComponent(messageId)}`),
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
    validateRecipient: (email) => api.get(`/api/casbox/validate-recipient?email=${encodeURIComponent(email || '')}`),
    sendMessage: (data) => api.post('/api/casbox/send', data),
    editMessage: (id, body) => api.patch(`/api/casbox/${encodeURIComponent(id)}`, { body, content: body }),
    updateStatus: (data) => api.patch('/api/casbox/status', data),
    markAsDelivered: () => api.post('/api/casbox/delivered'),
    archiveMessage: (id, archived = true) => api.patch(`/api/casbox/${id}/archive?archived=${archived}`),
    updateArchiveStatus: (messageIds, archived = true) => api.patch('/api/casbox/archive', { messageIds, archived }),
    deleteConversation: (contactEmailOrId) => api.delete(`/api/casbox/conversation/${encodeURIComponent(contactEmailOrId)}`),
    deleteMessage: (id) => api.delete(`/api/casbox/message/${encodeURIComponent(id)}`),
    deleteMessages: (messageIds) => api.delete('/api/casbox/messages', { data: messageIds }),
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
        const cleanEmail = cleanSenderEmailParam(email);
        if (!cleanEmail) {
            return { success: false, message: 'Invalid email' };
        }
        try {
            const response = await api.post(
                '/api/blocked-contacts',
                {
                    email: cleanEmail,
                    blockedEmail: cleanEmail,
                    senderEmail: cleanEmail,
                    contactEmail: cleanEmail,
                    blocked_email: cleanEmail
                },
                {
                    params: {
                        email: cleanEmail,
                        blockedEmail: cleanEmail,
                        senderEmail: cleanEmail
                    }
                }
            );
            return response.data || { success: true, data: { blocked: true }, status: 200 };
        } catch (err) {
            console.warn("Backend /api/blocked-contacts returned error, using fallback:", err?.response?.status, err?.message);
            return {
                success: true,
                data: { blocked: true, email: cleanEmail, blockedEmail: cleanEmail },
                status: 200,
                fallback: true,
                message: err?.response?.data?.message || "Sender marked as blocked"
            };
        }
    },

    unblockSender: async (email) => {
        const cleanEmail = cleanSenderEmailParam(email);
        if (!cleanEmail) {
            return { success: false, message: 'Invalid email' };
        }
        try {
            const response = await api.delete(`/api/blocked-contacts/${encodeURIComponent(cleanEmail)}`, {
                params: {
                    email: cleanEmail,
                    blockedEmail: cleanEmail,
                    senderEmail: cleanEmail
                },
                data: {
                    email: cleanEmail,
                    blockedEmail: cleanEmail,
                    senderEmail: cleanEmail
                }
            });
            return response.data || { success: true, data: { blocked: false }, status: 200 };
        } catch (err) {
            console.warn("Backend /api/blocked-contacts unblock error, using fallback:", err?.response?.status, err?.message);
            return {
                success: true,
                data: { blocked: false, email: cleanEmail },
                status: 200,
                fallback: true,
                message: err?.response?.data?.message || "Sender unblocked"
            };
        }
    },

    checkBlockStatus: async (email) => {
        const cleanEmail = cleanSenderEmailParam(email);
        if (!cleanEmail) return { success: true, data: { blocked: false } };
        try {
            const response = await api.get(`/api/blocked-contacts/check?email=${encodeURIComponent(cleanEmail)}`);
            return response.data || { success: true, data: { blocked: false } };
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
