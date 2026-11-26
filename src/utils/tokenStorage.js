/**
 * Tab-isolated Authentication & Token Storage Service.
 *
 * Architecture:
 * - Active authentication credentials (accessToken, refreshToken, userProfile, bnx_active_email)
 *   are stored strictly in `sessionStorage`.
 * - Because `sessionStorage` is unique to each browser tab, different accounts logged into different
 *   tabs on the same domain (e.g. Tab 1 = User A, Tab 2 = User B) remain completely isolated.
 * - Tab 2 logging in, refreshing tokens, or logging out will NEVER mutate or overwrite Tab 1's credentials.
 * - Cross-tab account directory `bnx_sessions` remains in `localStorage` solely to list registered
 *   accounts in the multi-account switcher dropdown.
 */

const KEYS = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_PROFILE: 'userProfile',
    ACTIVE_EMAIL: 'bnx_active_email',
    TEMP_TOKEN: 'tempToken',
    SESSIONS: 'bnx_sessions'
};

const isBrowser = typeof window !== 'undefined';

export const getAccessToken = () => {
    if (!isBrowser) return null;
    // 1. Primary: current tab's sessionStorage
    const tabToken = sessionStorage.getItem(KEYS.ACCESS_TOKEN);
    if (tabToken) return tabToken;

    // 2. Cold-start migration: if tab has empty sessionStorage, check legacy localStorage
    try {
        const localToken = localStorage.getItem(KEYS.ACCESS_TOKEN);
        if (localToken) {
            // Adopt into this tab's sessionStorage
            sessionStorage.setItem(KEYS.ACCESS_TOKEN, localToken);
            const refresh = localStorage.getItem(KEYS.REFRESH_TOKEN);
            if (refresh) sessionStorage.setItem(KEYS.REFRESH_TOKEN, refresh);
            const profile = localStorage.getItem(KEYS.USER_PROFILE);
            if (profile) sessionStorage.setItem(KEYS.USER_PROFILE, profile);
            const activeEmail = localStorage.getItem(KEYS.ACTIVE_EMAIL);
            if (activeEmail) sessionStorage.setItem(KEYS.ACTIVE_EMAIL, activeEmail);

            // Clean up legacy global keys to prevent tab leakage
            localStorage.removeItem(KEYS.ACCESS_TOKEN);
            localStorage.removeItem(KEYS.REFRESH_TOKEN);
            localStorage.removeItem(KEYS.USER_PROFILE);
            localStorage.removeItem(KEYS.ACTIVE_EMAIL);
            return localToken;
        }

        // 3. Fallback from bnx_sessions if localStorage.accessToken is already gone
        const sessionsStr = localStorage.getItem(KEYS.SESSIONS);
        if (sessionsStr) {
            const sessions = JSON.parse(sessionsStr);
            const emails = Object.keys(sessions);
            if (emails.length > 0) {
                const defaultEmail = emails[0];
                const defaultSession = sessions[defaultEmail];
                if (defaultSession?.accessToken) {
                    sessionStorage.setItem(KEYS.ACCESS_TOKEN, defaultSession.accessToken);
                    if (defaultSession.refreshToken) sessionStorage.setItem(KEYS.REFRESH_TOKEN, defaultSession.refreshToken);
                    if (defaultSession.userProfile) {
                        sessionStorage.setItem(KEYS.USER_PROFILE, typeof defaultSession.userProfile === 'string'
                            ? defaultSession.userProfile
                            : JSON.stringify(defaultSession.userProfile));
                    }
                    sessionStorage.setItem(KEYS.ACTIVE_EMAIL, defaultEmail);
                    return defaultSession.accessToken;
                }
            }
        }
    } catch (e) {
        // Safe fallback
    }

    return null;
};

export const setAccessToken = (token) => {
    if (!isBrowser || !token) return;
    sessionStorage.setItem(KEYS.ACCESS_TOKEN, token);
};

export const getRefreshToken = () => {
    if (!isBrowser) return null;
    const tabRefresh = sessionStorage.getItem(KEYS.REFRESH_TOKEN);
    if (tabRefresh) return tabRefresh;

    try {
        const localRefresh = localStorage.getItem(KEYS.REFRESH_TOKEN);
        if (localRefresh) {
            sessionStorage.setItem(KEYS.REFRESH_TOKEN, localRefresh);
            return localRefresh;
        }

        // Multi-tab / cold-start fallback from bnx_sessions
        const activeEmail = getActiveEmail();
        const sessionsStr = localStorage.getItem(KEYS.SESSIONS);
        if (sessionsStr) {
            const sessions = JSON.parse(sessionsStr);
            if (activeEmail && sessions[activeEmail]?.refreshToken) {
                const token = sessions[activeEmail].refreshToken;
                sessionStorage.setItem(KEYS.REFRESH_TOKEN, token);
                return token;
            }
            const emails = Object.keys(sessions);
            if (emails.length > 0 && sessions[emails[0]]?.refreshToken) {
                const token = sessions[emails[0]].refreshToken;
                sessionStorage.setItem(KEYS.REFRESH_TOKEN, token);
                return token;
            }
        }
    } catch (e) {}
    return null;
};

export const setRefreshToken = (token) => {
    if (!isBrowser || !token) return;
    sessionStorage.setItem(KEYS.REFRESH_TOKEN, token);
};

export const getUserProfile = () => {
    if (!isBrowser) return null;
    try {
        const raw = sessionStorage.getItem(KEYS.USER_PROFILE);
        if (raw) return JSON.parse(raw);
        const localRaw = localStorage.getItem(KEYS.USER_PROFILE);
        if (localRaw) {
            sessionStorage.setItem(KEYS.USER_PROFILE, localRaw);
            return JSON.parse(localRaw);
        }
    } catch (e) {}
    return null;
};

export const setUserProfile = (profile) => {
    if (!isBrowser || !profile) return;
    const str = typeof profile === 'string' ? profile : JSON.stringify(profile);
    sessionStorage.setItem(KEYS.USER_PROFILE, str);
};

export const getActiveEmail = () => {
    if (!isBrowser) return '';
    const tabEmail = sessionStorage.getItem(KEYS.ACTIVE_EMAIL);
    if (tabEmail && tabEmail.trim()) return tabEmail.trim();

    try {
        const profile = getUserProfile();
        if (profile?.email && String(profile.email).trim()) {
            const email = String(profile.email).trim();
            sessionStorage.setItem(KEYS.ACTIVE_EMAIL, email);
            return email;
        }
        const localEmail = localStorage.getItem(KEYS.ACTIVE_EMAIL);
        if (localEmail && localEmail.trim()) {
            sessionStorage.setItem(KEYS.ACTIVE_EMAIL, localEmail.trim());
            return localEmail.trim();
        }
    } catch (e) {}
    return '';
};

export const setActiveEmail = (email) => {
    if (!isBrowser || !email) return;
    sessionStorage.setItem(KEYS.ACTIVE_EMAIL, email.trim());
};

export const setAuthSession = ({ accessToken, refreshToken, userProfile, activeEmail }) => {
    if (!isBrowser) return;
    if (accessToken) sessionStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) sessionStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
    if (userProfile) {
        sessionStorage.setItem(KEYS.USER_PROFILE, typeof userProfile === 'string' ? userProfile : JSON.stringify(userProfile));
    }
    const email = activeEmail || (typeof userProfile === 'object' ? userProfile?.email : '');
    if (email) sessionStorage.setItem(KEYS.ACTIVE_EMAIL, email.trim());
};

export const clearAuthSession = () => {
    if (!isBrowser) return;
    sessionStorage.removeItem(KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(KEYS.REFRESH_TOKEN);
    sessionStorage.removeItem(KEYS.USER_PROFILE);
    sessionStorage.removeItem(KEYS.ACTIVE_EMAIL);
    sessionStorage.removeItem(KEYS.TEMP_TOKEN);
};

export const getStoredSessions = () => {
    if (!isBrowser) return {};
    try {
        const stored = localStorage.getItem(KEYS.SESSIONS);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

export const saveStoredSession = (email, sessionData) => {
    if (!isBrowser || !email) return;
    try {
        const cleanEmail = email.trim().toLowerCase();
        const sessions = getStoredSessions();
        const existing = sessions[cleanEmail] || sessions[email] || {};
        const profile = sessionData?.userProfile || existing.userProfile || getUserProfile() || { email: cleanEmail };
        if (profile && typeof profile === 'object') {
            if (!profile.email) profile.email = cleanEmail;
        }
        sessions[cleanEmail] = {
            ...existing,
            ...(sessionData || {}),
            userProfile: profile
        };
        // Clean up legacy cased key if different
        if (cleanEmail !== email && sessions[email]) {
            delete sessions[email];
        }
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {}
};

export const saveAllStoredSessions = (sessions) => {
    if (!isBrowser) return;
    try {
        const cleaned = {};
        if (sessions && typeof sessions === 'object') {
            for (const [key, val] of Object.entries(sessions)) {
                if (key && val && typeof val === 'object') {
                    const cleanKey = key.trim().toLowerCase();
                    const profile = val.userProfile || { email: cleanKey };
                    if (profile && typeof profile === 'object' && !profile.email) {
                        profile.email = cleanKey;
                    }
                    cleaned[cleanKey] = {
                        ...val,
                        userProfile: profile
                    };
                }
            }
        }
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(cleaned));
    } catch (e) {}
};

export const removeStoredSession = (email) => {
    if (!isBrowser || !email) return;
    try {
        const sessions = getStoredSessions();
        if (sessions[email]) {
            delete sessions[email];
            saveAllStoredSessions(sessions);
        }
    } catch (e) {}
};

export const clearAllStoredSessions = () => {
    if (!isBrowser) return;
    try {
        localStorage.removeItem(KEYS.SESSIONS);
        localStorage.removeItem(KEYS.ACCESS_TOKEN);
        localStorage.removeItem(KEYS.REFRESH_TOKEN);
        localStorage.removeItem(KEYS.USER_PROFILE);
        localStorage.removeItem(KEYS.ACTIVE_EMAIL);
        localStorage.removeItem(KEYS.TEMP_TOKEN);
    } catch (e) {}
};

// Cross-tab synchronization:
// When another tab rotates or refreshes the access token, seamlessly sync into this tab's sessionStorage
if (isBrowser) {
    window.addEventListener('storage', (event) => {
        if (event.key === KEYS.SESSIONS && event.newValue) {
            try {
                const sessions = JSON.parse(event.newValue);
                const activeEmail = getActiveEmail();
                if (activeEmail && sessions[activeEmail]) {
                    const session = sessions[activeEmail];
                    if (session.accessToken) {
                        sessionStorage.setItem(KEYS.ACCESS_TOKEN, session.accessToken);
                    }
                    if (session.refreshToken) {
                        sessionStorage.setItem(KEYS.REFRESH_TOKEN, session.refreshToken);
                    }
                }
            } catch (e) {}
        }
    });
}
