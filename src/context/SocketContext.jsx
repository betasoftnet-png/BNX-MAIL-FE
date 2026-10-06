import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from './AuthContext';
import { useMail } from './MailContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

// Detect environment and set URLs
// Force WSS for api.bnxmail.com to avoid redirects
const WS_URL = import.meta.env.VITE_WS_URL;

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
    const messageQueueRef = useRef([]);
    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;

    const handlePersonalNotification = (data) => {
        const { fetchEmails, fetchEmailsSilently } = mailRef.current || {};
        switch (data?.type) {
            case 'new_email':
                toast('New email received!', { icon: '📧' });
                if (fetchEmails) fetchEmails(undefined, true);
                break;
            case 'send_progress':
                if (data.status === 'completed') {
                    toast.success('Email sent successfully');
                    if (fetchEmails) fetchEmails(undefined, true);
                    if (fetchEmailsSilently) {
                        fetchEmailsSilently('sent');
                        fetchEmailsSilently('drafts');
                    }
                } else if (data.status === 'failed') {
                    toast.error('Failed to send email');
                }
                break;
            default:
                if (data?.message) {
                    toast(data.message);
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

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (isAuthenticatedRef.current) {
                connectSocket();
            }
        }, 5000);
    }, []);

    const connectSocket = useCallback(() => {
        if (!isAuthenticatedRef.current) return;

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        // Prevent duplicate connections: check if existing socket is already OPEN or CONNECTING
        const existingClient = clientRef.current;
        const existingWs = existingClient?.webSocket;
        if (existingClient && (existingClient.connected || existingClient.active)) {
            if (existingWs && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
                return;
            }
        }

        // Clean up previous client before creating a new one
        if (existingClient) {
            try {
                existingClient.deactivate();
            } catch (e) {}
            clientRef.current = null;
        }

        const currentGen = ++generationRef.current;

        const client = new Client({
            brokerURL: WS_URL,
            connectHeaders: {
                Authorization: `Bearer ${token}`
            },
            reconnectDelay: 0, // Disabled built-in loop; controlled by single reconnect timer
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            webSocketFactory: () => {
                const socket = new WebSocket(WS_URL);
                const originalSend = socket.send.bind(socket);

                // Safe wrapper: NEVER call socket.send when CONNECTING, CLOSING, or CLOSED
                socket.send = function (data) {
                    if (this.readyState === WebSocket.OPEN) {
                        return originalSend(data);
                    }
                };

                return socket;
            }
        });

        client.onConnect = (frame) => {
            if (currentGen !== generationRef.current) return;
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
                    if (client.connected && ws && ws.readyState === WebSocket.OPEN) {
                        client.publish(queued);
                    } else {
                        messageQueueRef.current.unshift(queued);
                        break;
                    }
                } catch (e) {}
            }
        };

        client.onStompError = (frame) => {
            if (currentGen !== generationRef.current) return;
            console.error('STOMP broker reported error:', frame?.headers?.message);
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

        // Wrap publish method to enforce readyState === WebSocket.OPEN
        const originalPublish = client.publish.bind(client);
        client.publish = function (params) {
            const ws = client.webSocket;
            if (client.connected && ws && ws.readyState === WebSocket.OPEN) {
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
            if (!client.connected || !ws || ws.readyState !== WebSocket.OPEN) {
                return {
                    id: null,
                    unsubscribe: () => {}
                };
            }
            const sub = originalSubscribe(destination, callback, headers);
            const originalUnsub = sub.unsubscribe.bind(sub);
            sub.unsubscribe = function (unsubHeaders) {
                const currentWs = client.webSocket;
                if (client.connected && currentWs && currentWs.readyState === WebSocket.OPEN) {
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
    }, [isAuthenticated, connectSocket, clearReconnectTimer]);

    const subscribeToChat = useCallback((chatId, callback) => {
        const client = clientRef.current;
        const ws = client?.webSocket;
        if (!client || !isConnected || !client.connected || !ws || ws.readyState !== WebSocket.OPEN) {
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
                            currentWs.readyState === WebSocket.OPEN
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
        const isSocketOpen = client && client.connected && ws && ws.readyState === WebSocket.OPEN;

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

