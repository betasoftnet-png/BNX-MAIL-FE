import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

const getStoredSessions = () => {
    try {
        const stored = localStorage.getItem('bnx_sessions');
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Compatibility check: import single-account credentials if already logged in
        const token = localStorage.getItem('accessToken');
        const profileStr = localStorage.getItem('userProfile');
        const refresh = localStorage.getItem('refreshToken');

        let sessions = getStoredSessions();
        let activeEmail = localStorage.getItem('bnx_active_email');

        if (token && profileStr) {
            try {
                const profile = JSON.parse(profileStr);
                const email = profile.email || 'user@bnxmail.com';

                if (!activeEmail) {
                    activeEmail = email;
                    localStorage.setItem('bnx_active_email', email);
                }

                if (!sessions[email]) {
                    sessions[email] = {
                        accessToken: token,
                        refreshToken: refresh,
                        userProfile: profile
                    };
                    localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
                }
            } catch (e) {
                console.error("Failed to parse user profile on start", e);
            }
        }

        if (activeEmail && sessions[activeEmail]) {
            setIsAuthenticated(true);
            setUser(sessions[activeEmail].userProfile);
        } else if (token && profileStr) {
            try {
                setIsAuthenticated(true);
                setUser(JSON.parse(profileStr));
            } catch (e) { }
        }
        setLoading(false);
    }, []);

    const login = (data) => {
        const { accessToken, refreshToken, mailboxes, ...profile } = data;

        const primaryMailbox = mailboxes?.find(m => m.isPrimary) || mailboxes?.[0];
        const userEmail = primaryMailbox?.email || '';

        const fullProfile = {
            ...profile,
            email: userEmail,
            mailboxes
        };

        // Save session in sessions store
        const sessions = getStoredSessions();
        sessions[userEmail] = {
            accessToken,
            refreshToken,
            userProfile: fullProfile
        };

        localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
        localStorage.setItem('bnx_active_email', userEmail);

        // Write active credentials to standard keys
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('userProfile', JSON.stringify(fullProfile));

        setIsAuthenticated(true);
        setUser(fullProfile);
    };

    const switchAccount = (email) => {
        const sessions = getStoredSessions();
        const targetSession = sessions[email];
        if (!targetSession) return;

        localStorage.setItem('bnx_active_email', email);
        localStorage.setItem('accessToken', targetSession.accessToken);
        localStorage.setItem('refreshToken', targetSession.refreshToken || '');
        localStorage.setItem('userProfile', JSON.stringify(targetSession.userProfile));

        setIsAuthenticated(true);
        setUser(targetSession.userProfile);

        // Reload the app to update all state/websocket connections
        window.location.href = "/inbox";
    };

    const logout = async () => {
        const activeEmail = localStorage.getItem('bnx_active_email');
        const sessions = getStoredSessions();

        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                await authAPI.logout(refreshToken);
            }
        } catch (error) {
            console.error('Backend logout failed:', error);
        } finally {
            // Remove active email from sessions list
            if (activeEmail && sessions[activeEmail]) {
                delete sessions[activeEmail];
                localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
            }

            // Find another active account
            const remainingEmails = Object.keys(sessions);
            if (remainingEmails.length > 0) {
                const nextEmail = remainingEmails[0];
                const nextSession = sessions[nextEmail];

                localStorage.setItem('bnx_active_email', nextEmail);
                localStorage.setItem('accessToken', nextSession.accessToken);
                localStorage.setItem('refreshToken', nextSession.refreshToken || '');
                localStorage.setItem('userProfile', JSON.stringify(nextSession.userProfile));

                setIsAuthenticated(true);
                setUser(nextSession.userProfile);
                window.location.href = "/inbox";
            } else {
                // No sessions left: clean up everything
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('userProfile');
                localStorage.removeItem('tempToken');
                localStorage.removeItem('bnx_active_email');
                localStorage.removeItem('bnx_sessions');

                setIsAuthenticated(false);
                setUser(null);
            }
        }
    };

    const logoutAll = async () => {
        const sessions = getStoredSessions();

        // Try to call backend logout for all active refresh tokens in parallel
        await Promise.allSettled(
            Object.values(sessions).map(async (sess) => {
                if (sess.refreshToken) {
                    try {
                        await authAPI.logout(sess.refreshToken);
                    } catch (e) { }
                }
            })
        );

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('tempToken');
        localStorage.removeItem('bnx_active_email');
        localStorage.removeItem('bnx_sessions');

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
