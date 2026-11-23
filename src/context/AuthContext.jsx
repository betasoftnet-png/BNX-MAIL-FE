import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, refreshAccessToken, parseJwt } from '../services/api';
import {
    getAccessToken,
    getRefreshToken,
    getUserProfile,
    getActiveEmail,
    setAuthSession,
    clearAuthSession,
    getStoredSessions,
    saveStoredSession,
    saveAllStoredSessions,
    removeStoredSession,
    clearAllStoredSessions
} from '../utils/tokenStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check if the current browser tab already has an active session in sessionStorage
        const token = getAccessToken();
        const profile = getUserProfile();
        let activeEmail = getActiveEmail();

        if (token && profile) {
            setIsAuthenticated(true);
            setUser(profile);
            setLoading(false);
            return;
        }

        // 2. Cold-start fallback: if tab has empty sessionStorage, check stored sessions
        const sessions = getStoredSessions();
        const emails = Object.keys(sessions);

        if (emails.length > 0) {
            const targetEmail = (activeEmail && sessions[activeEmail]) ? activeEmail : emails[0];
            const targetSession = sessions[targetEmail];

            if (targetSession?.accessToken && targetSession?.userProfile) {
                setAuthSession({
                    accessToken: targetSession.accessToken,
                    refreshToken: targetSession.refreshToken || '',
                    userProfile: targetSession.userProfile,
                    activeEmail: targetEmail
                });
                setIsAuthenticated(true);
                setUser(targetSession.userProfile);
                setLoading(false);
                return;
            }
        }

        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
    }, []);

    // Automatic Proactive Background Token Renewal:
    // Periodically checks JWT access token expiration and silently refreshes before expiry
    // so active users are never logged out and never experience session interruptions.
    useEffect(() => {
        if (!isAuthenticated) return;

        const checkAndRefreshToken = async () => {
            const token = getAccessToken();
            const refreshToken = getRefreshToken();
            if (!token || !refreshToken) return;

            const payload = parseJwt(token);
            if (!payload || !payload.exp) return;

            const expiryMs = payload.exp * 1000;
            const nowMs = Date.now();
            const timeUntilExpiryMs = expiryMs - nowMs;

            // If token expires within 5 minutes (or has already expired), silently refresh in the background
            if (timeUntilExpiryMs <= 5 * 60 * 1000) {
                try {
                    await refreshAccessToken();
                } catch (err) {
                    console.warn('[Silent Refresh] Proactive token renewal delayed:', err?.message);
                }
            }
        };

        // Check on mount or authentication change
        checkAndRefreshToken();

        // Check every 60 seconds
        const timer = setInterval(checkAndRefreshToken, 60 * 1000);

        // Immediate check when user wakes laptop or switches back to tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAndRefreshToken();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', checkAndRefreshToken);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', checkAndRefreshToken);
        };
    }, [isAuthenticated]);

    const login = (data) => {
        const { accessToken, refreshToken, mailboxes, ...profile } = data;

        const primaryMailbox = mailboxes?.find(m => m.isPrimary) || mailboxes?.[0];
        const userEmail = primaryMailbox?.email || profile.email || '';

        const fullProfile = {
            ...profile,
            email: userEmail,
            mailboxes
        };

        // 1. Store tab-isolated session in sessionStorage
        setAuthSession({
            accessToken,
            refreshToken,
            userProfile: fullProfile,
            activeEmail: userEmail
        });

        // 2. Register account in multi-account directory in localStorage for the account switcher
        saveStoredSession(userEmail, {
            accessToken,
            refreshToken,
            userProfile: fullProfile
        });

        // Dispatch local event in current tab
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { accountChanged: true } }));
        }

        setIsAuthenticated(true);
        setUser(fullProfile);
    };

    const switchAccount = (email) => {
        const sessions = getStoredSessions();
        const targetSession = sessions[email];
        if (!targetSession) return;

        // Switch only THIS tab's active session
        setAuthSession({
            accessToken: targetSession.accessToken,
            refreshToken: targetSession.refreshToken || '',
            userProfile: targetSession.userProfile,
            activeEmail: email
        });

        setIsAuthenticated(true);
        setUser(targetSession.userProfile);

        // Reload the app in this tab to re-initialize mailbox state and websockets cleanly
        window.location.href = "/inbox";
    };

    const logout = async () => {
        const activeEmail = getActiveEmail();
        const refreshToken = getRefreshToken();

        try {
            if (refreshToken) {
                await authAPI.logout(refreshToken);
            }
        } catch (error) {
            console.error('Backend logout failed:', error);
        } finally {
            // Remove active email from stored sessions
            if (activeEmail) {
                removeStoredSession(activeEmail);
            }

            // Clear THIS tab's session
            clearAuthSession();

            // Find another active account if available
            const sessions = getStoredSessions();
            const remainingEmails = Object.keys(sessions);

            if (remainingEmails.length > 0) {
                const nextEmail = remainingEmails[0];
                const nextSession = sessions[nextEmail];

                setAuthSession({
                    accessToken: nextSession.accessToken,
                    refreshToken: nextSession.refreshToken || '',
                    userProfile: nextSession.userProfile,
                    activeEmail: nextEmail
                });

                setIsAuthenticated(true);
                setUser(nextSession.userProfile);
                window.location.href = "/inbox";
            } else {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('bnx-label-prefs-changed', { detail: { accountChanged: true } }));
                }
                setIsAuthenticated(false);
                setUser(null);
                window.location.href = "/login";
            }
        }
    };

    const logoutAll = async () => {
        const sessions = getStoredSessions();

        // Call backend logout for all active refresh tokens in parallel
        await Promise.allSettled(
            Object.values(sessions).map(async (sess) => {
                if (sess.refreshToken) {
                    try {
                        await authAPI.logout(sess.refreshToken);
                    } catch (e) { }
                }
            })
        );

        clearAuthSession();
        clearAllStoredSessions();

        setIsAuthenticated(false);
        setUser(null);
        window.location.href = "/login";
    };

    const getSessions = () => {
        const sessions = getStoredSessions();
        return Object.keys(sessions).map(email => sessions[email].userProfile);
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            user,
            loading,
            login,
            logout,
            logoutAll,
            switchAccount,
            getSessions
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        return {
            isAuthenticated: false,
            user: null,
            loading: false,
            login: async () => { },
            logout: () => { },
            logoutAll: () => { },
            switchAccount: () => { },
            getSessions: () => { }
        };
    }
    return context;
};
