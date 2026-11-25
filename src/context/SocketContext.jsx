import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from './AuthContext';
import { useMail } from './MailContext';
import toast from 'react-hot-toast';
import { useNotificationPreferences } from './NotificationPreferenceContext';
import { refreshAccessToken, parseJwt } from '../services/api';
import { getAccessToken } from '../utils/tokenStorage';

const SocketContext = createContext();

// Dynamic URL resolver: prevents connecting to 'undefined' and handles production vs development
const getWsEndpoints = () => {
    let wsUrl = (import.meta.env.VITE_WS_URL || '').trim();
    let httpUrl = (import.meta.env.VITE_API_URL || '').trim();

    if (typeof window !== 'undefined') {
        const isSecure = window.location.protocol === 'https:';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (!wsUrl) {
            wsUrl = isLocal
                ? 'ws://localhost:8080/ws'
                : `${isSecure ? 'wss:' : 'ws:'}//api.bnxmail.com/ws`;
        }

        if (!httpUrl) {
            httpUrl = isLocal
                ? 'http://localhost:8080'
                : `${isSecure ? 'https:' : 'http:'}//api.bnxmail.com`;
        }
    } else {
        if (!wsUrl) wsUrl = 'wss://api.bnxmail.com/ws';
        if (!httpUrl) httpUrl = 'https://api.bnxmail.com';
    }

    // Ensure valid protocols on dynamically configured URLs
    if (httpUrl && !/^https?:\/\//i.test(httpUrl)) {
        if (httpUrl.startsWith('//')) {
            httpUrl = (typeof window !== 'undefined' ? window.location.protocol : 'https:') + httpUrl;
        } else if (httpUrl.startsWith('localhost') || httpUrl.startsWith('127.0.0.1')) {
            httpUrl = `http://${httpUrl}`;
        } else {
            httpUrl = `https://${httpUrl}`;
        }
    }
    if (wsUrl && !/^(wss?):\/\//i.test(wsUrl)) {
        if (wsUrl.startsWith('//')) {
            wsUrl = (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:') + wsUrl;
        } else if (wsUrl.startsWith('localhost') || wsUrl.startsWith('127.0.0.1')) {
            wsUrl = `ws://${wsUrl}`;
        } else {
            wsUrl = `wss://${wsUrl}`;
        }
    }

    const cleanHttp = httpUrl.replace(/\/+$/, '');
    const sockJsUrl = cleanHttp.endsWith('/ws') ? cleanHttp : `${cleanHttp}/ws`;
    return { wsUrl, sockJsUrl };
};

export const SocketProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const mailContext = useMail();
    const mailRef = useRef(mailContext);
    mailRef.current = mailContext;

    const [stompClient, setStompClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // Lifecycle, single-timer, and generation tracking refs
    const clientRef = useRef(null);
    const generationRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const useSockJsFallbackRef = useRef(false);
    const messageQueueRef = useRef([]);
    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;
    const notifPrefs = useNotificationPreferences();
    const notifPrefsRef = useRef(notifPrefs);
    useEffect(() => {
        notifPrefsRef.current = notifPrefs;
    }, [notifPrefs]);

    const handlePersonalNotification = (data) => {
        const { fetchEmails, fetchEmailsSilently, invalidateCache, currentFolder } = mailRef.current || {};
        const { inboxNotifications = true, sentNotifications = false, starredNotifications = true, snoozedNotifications = true } = notifPrefsRef.current || {};
        switch (data?.type) {
            case 'new_email':
                if (inboxNotifications) {
                    toast('New email received!', { icon: '📧' });
                }
                if (invalidateCache) {
                    invalidateCache('inbox');
                    invalidateCache('unread');
                    invalidateCache('all-inbox');
                    invalidateCache('allinbox');
                    invalidateCache('allmail');
                    invalidateCache('all-mail');
                }
                const activeFolder = (currentFolder || 'inbox').toLowerCase();
                if (fetchEmails) {
                    fetchEmails(activeFolder, true);
                }
                if (fetchEmailsSilently) {
                    if (activeFolder !== 'inbox') fetchEmailsSilently('inbox');
                    if (activeFolder !== 'unread') fetchEmailsSilently('unread');
                }
                break;
            case 'send_progress':
                if (data.status === 'completed') {
                    // "Message sent" toast is shown immediately after send action; suppress duplicate toast here
                    if (fetchEmails) fetchEmails(undefined, true);
                    if (fetchEmailsSilently) {
                        fetchEmailsSilently('sent');
                        fetchEmailsSilently('drafts');
                    }
                } else if (data.status === 'failed') {
                    toast.error('Failed to send email');
                }
                break;
            case 'snooze_wake':
            case 'snooze_active':
            case 'snoozed_email':
                if (snoozedNotifications) {
                    toast(data?.message || 'Snoozed email is now active in Inbox', { icon: '⏰' });
                }
                if (fetchEmails) fetchEmails('inbox', true);
                break;
            case 'starred_email':
                if (starredNotifications) {
                    toast(data?.message || 'Email added to Starred', { icon: '⭐' });
                }
                break;
            default:
                if (data?.message) {
                    const msg = String(data.message).toLowerCase();
                    if (msg.includes('sent') && !sentNotifications) {
                        // Suppressed by sent confirmation preference
                    } else if (msg.includes('new email') && !inboxNotifications) {
                        // Suppressed by inbox alert preference
                    } else if (msg.includes('star') && !starredNotifications) {
                        // Suppressed by starred alert preference
                    } else if (msg.includes('snooze') && !snoozedNotifications) {
                        // Suppressed by snoozed alert preference
                    } else {
                        toast(data.message);
                    }
                }
        }
    };

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (!isAuthenticatedRef.current) return;
        if (reconnectTimerRef.current) return; // Only ONE reconnect timer at a time!

        const attempts = reconnectAttemptsRef.current;
        // Exponential backoff: 3s, 6s, 12s, up to max 30s
        const delay = Math.min(3000 * Math.pow(2, Math.min(attempts, 4)), 30000);
        reconnectAttemptsRef.current += 1;

        // If native WebSocket fails repeatedly (e.g. proxy resets connection), switch to SockJS fallback
        if (attempts >= 1 && !useSockJsFallbackRef.current) {
            useSockJsFallbackRef.current = true;
        }

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (isAuthenticatedRef.current) {
                connectSocket();
            }
        }, delay);
    }, []);

    const connectSocket = useCallback(async () => {
        if (!isAuthenticatedRef.current) return;

        // Prevent duplicate connections: do not spawn if already active or connected
        const existingClient = clientRef.current;
        if (existingClient && (existingClient.connected || existingClient.active)) {
            return;
        }

        // Clean up previous client before creating a new one
        if (existingClient) {
            try {
                existingClient.deactivate();
            } catch (e) {}
            clientRef.current = null;
        }

        let token = getAccessToken();
        if (!token) return;

        // Ensure token is fresh before establishing STOMP session
        const payload = parseJwt(token);
        if (payload && payload.exp && Date.now() >= payload.exp * 1000 - 30000) {
            try {
                token = await refreshAccessToken();
            } catch (e) {
                console.warn('Could not refresh token prior to STOMP connect:', e?.message);
            }
        }
        if (!token) return;

        const currentGen = ++generationRef.current;
        const { wsUrl, sockJsUrl } = getWsEndpoints();
        const useSockJs = useSockJsFallbackRef.current;

        const client = new Client({
            connectHeaders: {
                Authorization: `Bearer ${token}`
            },
            connectionTimeout: 10000,
            reconnectDelay: 0, // Disabled built-in loop; controlled by exponential backoff scheduleReconnect
            heartbeatIncoming: 20000,
            heartbeatOutgoing: 20000,
            webSocketFactory: () => {
                if (useSockJs) {
                    return new SockJS(sockJsUrl);
                }
                return new WebSocket(wsUrl);
            }
        });

        client.onConnect = (frame) => {
            if (currentGen !== generationRef.current) return;
            reconnectAttemptsRef.current = 0;
            clearReconnectTimer();
            setIsConnected(true);

            // Subscribe to personal notifications
            try {
                client.subscribe('/user/topic/notifications', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        handlePersonalNotification(data);
                    } catch (e) {}
                });
            } catch (err) {}

            // Flush message queue once open
            while (messageQueueRef.current.length > 0) {
                const queued = messageQueueRef.current.shift();
                try {
                    const ws = client.webSocket;
                    if (client.connected && ws && (ws.readyState === 1 || ws.readyState === WebSocket?.OPEN)) {
                        client.publish(queued);
                    } else {
                        messageQueueRef.current.unshift(queued);
                        break;
                    }
                } catch (e) {}
            }
        };

        client.onStompError = async (frame) => {
            if (currentGen !== generationRef.current) return;
            const errorMsg = frame?.headers?.message || '';
            console.error('STOMP broker reported error:', errorMsg);

            // If session was closed or authentication failed, refresh token before reconnecting
            const isAuthOrSessionClosed = errorMsg.includes('Session closed') ||
                                          errorMsg.includes('Authentication') ||
                                          errorMsg.includes('expired') ||
                                          errorMsg.includes('Unauthorized');
            if (isAuthOrSessionClosed && isAuthenticatedRef.current) {
                try {
                    await refreshAccessToken();
                } catch (e) {
                    console.warn('Token refresh on STOMP error skipped:', e?.message);
                }
            }
        };

        client.onWebSocketError = (event) => {
            if (currentGen !== generationRef.current) return;
            setIsConnected(false);
            scheduleReconnect();
        };

        client.onWebSocketClose = () => {
            if (currentGen !== generationRef.current) return;
            setIsConnected(false);
            scheduleReconnect();
        };

        client.onDisconnect = () => {
            if (currentGen !== generationRef.current) return;
            setIsConnected(false);
        };

        // Wrap publish method to enforce readyState === 1 / WebSocket.OPEN
        const originalPublish = client.publish.bind(client);
        client.publish = function (params) {
            const ws = client.webSocket;
            if (client.connected && ws && (ws.readyState === 1 || ws.readyState === WebSocket?.OPEN)) {
                return originalPublish(params);
            }
            if (params) {
                messageQueueRef.current.push(params);
            }
        };

        // Wrap subscribe method so unsubscribe is always safe
        const originalSubscribe = client.subscribe.bind(client);
        client.subscribe = function (destination, callback, headers) {
            const ws = client.webSocket;
            if (!client.connected || !ws || (ws.readyState !== 1 && ws.readyState !== WebSocket?.OPEN)) {
                return {
                    id: null,
                    unsubscribe: () => {}
                };
            }
            const sub = originalSubscribe(destination, callback, headers);
            const originalUnsub = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function (unsubHeaders) {
                const currentWs = client.webSocket;
                if (client.connected && currentWs && (currentWs.readyState === 1 || currentWs.readyState === WebSocket?.OPEN)) {
                    try {
                        return originalUnsub(unsubHeaders);
                    } catch (err) {}
                }
            };
            return sub;
        };

        clientRef.current = client;
        setStompClient(client);

        try {
            client.activate();
        } catch (e) {
            scheduleReconnect();
        }
    }, [clearReconnectTimer, scheduleReconnect]);

    // Listen to token refresh events from api.js to keep STOMP connect headers fresh
    useEffect(() => {
        const handleTokenRefreshed = (e) => {
            const freshToken = e.detail?.accessToken;
            if (freshToken && isAuthenticatedRef.current) {
                if (clientRef.current) {
                    clientRef.current.connectHeaders = {
                        Authorization: `Bearer ${freshToken}`
                    };
                }
                // If the socket was disconnected due to expired token, immediately reconnect with the new token
                if (!isConnected && (!clientRef.current || !clientRef.current.connected)) {
                    clearReconnectTimer();
                    connectSocket();
                }
            }
        };

        window.addEventListener('bnx-token-refreshed', handleTokenRefreshed);
        return () => window.removeEventListener('bnx-token-refreshed', handleTokenRefreshed);
    }, [connectSocket, clearReconnectTimer, isConnected]);

    useEffect(() => {
        if (!isAuthenticated) {
            clearReconnectTimer();
            if (clientRef.current) {
                try {
                    clientRef.current.deactivate();
                } catch (e) {}
                clientRef.current = null;
            }
            setStompClient(null);
            setIsConnected(false);
            messageQueueRef.current = [];
            return;
        }

        connectSocket();

        return () => {
            clearReconnectTimer();
            if (clientRef.current) {
                try {
                    clientRef.current.deactivate();
                } catch (e) {}
                clientRef.current = null;
            }
        };
    }, [isAuthenticated, user?.email, connectSocket, clearReconnectTimer]);

    const subscribeToChat = useCallback((chatId, callback) => {
        const client = clientRef.current;
        const ws = client?.webSocket;
        if (!client || !isConnected || !client.connected || !ws || (ws.readyState !== 1 && ws.readyState !== WebSocket?.OPEN)) {
            return null;
        }
        try {
            const rawSub = client.subscribe(`/topic/chat/${chatId}`, (message) => {
                try {
                    const data = JSON.parse(message.body);
                    callback(data);
                } catch (err) {
                    console.error("Failed to parse socket message JSON:", err);
                }
            });

            return {
                id: rawSub?.id,
                unsubscribe: () => {
                    try {
                        const currentWs = clientRef.current?.webSocket;
                        if (
                            clientRef.current && 
                            clientRef.current.connected && 
                            currentWs && 
                            (currentWs.readyState === 1 || currentWs.readyState === WebSocket?.OPEN)
                        ) {
                            rawSub.unsubscribe();
                        }
                    } catch (e) {}
                }
            };
        } catch (e) {
            console.error("Failed to subscribe to chat:", e);
            return null;
        }
    }, [isConnected]);

    const userEmailOrUsername = user?.email || user?.username;
    const sendMessage = useCallback((chatId, messageContent, attachmentsJson = null) => {
        if (!userEmailOrUsername) return false;

        const payload = {
            chatId: parseInt(chatId),
            sender: userEmailOrUsername,
            message: messageContent,
            attachmentsJson: attachmentsJson
        };

        const payloadStr = JSON.stringify(payload);
        if (payloadStr.length > 64 * 1024) {
            return false;
        }

        const client = clientRef.current;
        const ws = client?.webSocket;
        const isSocketOpen = client && client.connected && ws && (ws.readyState === 1 || ws.readyState === WebSocket?.OPEN);

        const messageData = {
            destination: '/app/chat.send',
            body: payloadStr
        };

        if (!isSocketOpen) {
            messageQueueRef.current.push(messageData);
            return true;
        }

        try {
            client.publish(messageData);
            return true;
        } catch (e) {
            messageQueueRef.current.push(messageData);
            return false;
        }
    }, [userEmailOrUsername]);

    const value = useMemo(() => ({
        stompClient,
        isConnected,
        subscribeToChat,
        sendMessage
    }), [stompClient, isConnected, subscribeToChat, sendMessage]);

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        return {
            stompClient: null,
            isConnected: false,
            subscribeToChat: () => null,
            sendMessage: () => false
        };
    }
    return context;
};

