import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { userAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationPreferenceContext = createContext();

export const NotificationPreferenceProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [preferences, setPreferences] = useState({
    inboxNotifications: true,
    sentNotifications: false,
    starredNotifications: true,
    snoozedNotifications: true,
  });
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  // Fetch preferences from existing backend API (no localStorage/sessionStorage)
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated || isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const res = await userAPI.getSettings();
      const d = res.data?.data || res.data || {};
      setPreferences({
        inboxNotifications: d.inboxNotifications ?? true,
        sentNotifications: d.sentNotifications ?? false,
        starredNotifications: d.starredNotifications ?? true,
        snoozedNotifications: d.snoozedNotifications ?? true,
      });
    } catch (err) {
      console.warn("Failed to fetch notification preferences from backend:", err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated, user?.email, fetchPreferences]);

  // Listen to window events for preference changes
  useEffect(() => {
    const handleSettingsChanged = (e) => {
      const { key, value } = e.detail || {};
      if (key && value !== undefined) {
        setPreferences(prev => ({
          ...prev,
          [key]: value
        }));
      }
    };

    window.addEventListener('bnx_notification_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('bnx_notification_settings_changed', handleSettingsChanged);
  }, []);

  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const value = {
    ...preferences,
    loading,
    fetchPreferences,
    updatePreference,
  };

  return (
    <NotificationPreferenceContext.Provider value={value}>
      {children}
    </NotificationPreferenceContext.Provider>
  );
};

export const useNotificationPreferences = () => {
  const context = useContext(NotificationPreferenceContext);
  if (!context) {
    return {
      inboxNotifications: true,
      sentNotifications: false,
      starredNotifications: true,
      snoozedNotifications: true,
      loading: false,
      fetchPreferences: () => {},
      updatePreference: () => {},
    };
  }
  return context;
};

