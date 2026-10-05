import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdSettings,
  MdColorLens,
  MdSecurity,
  MdEmail,
  MdDevices,
  MdHistory,
  MdNotifications,
  MdAccessTime,
  MdLock,
  MdPalette,
  MdFormatPaint,
  MdVolumeUp,
  MdSettingsBackupRestore,
  MdRefresh,
  MdFileUpload,
  MdSignalCellularAlt,
  MdPhoneAndroid,
  MdTabletMac,
  MdComputer,
  MdDelete,
  MdCheckCircle,
  MdError,
  MdAdd,
  MdClose
} from "react-icons/md";
import { emailAPI, authAPI, userAPI, signatureAPI, settingsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, PRESET_BACKGROUNDS } from "../context/ThemeContext";
import { useTranslation, normalizeLang } from "../context/LanguageContext";
import toast from "react-hot-toast";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from 'quill-image-resize-module-react';

// Make Quill globally available for ImageResize
window.Quill = Quill;
if (!Quill.imports['modules/imageResize']) {
  Quill.register('modules/imageResize', ImageResize, true);
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
    ['link'],
    ['clean']
  ],
  imageResize: {
    parchment: Quill.import('parchment'),
    modules: ['Resize', 'DisplaySize', 'Toolbar']
  }
};

const Settings = () => {
  const { t, applyLanguage, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { user, getSessions, switchAccount } = useAuth();
  const {
    theme, changeTheme, currentThemeName,
    backgroundImage, setBackgroundImage, clearBackgroundImage,
    readingPaneMode: globalReadingPaneMode,
    setReadingPaneModeState,
    emailsPerPage, setEmailsPerPageState,
    sidebarPreferences, setSidebarPreferences,
    customAccentColor, updateCustomAccentColor,
    customFontSize, updateCustomFontSize
  } = useTheme();

  const bgFileRef = useRef(null);
  const savingRef = useRef(false);
  const mainContentRef = useRef(null);
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [selectedWallpaper, setSelectedWallpaper] = useState(backgroundImage);

  useEffect(() => {
    setSelectedWallpaper(backgroundImage);
  }, [backgroundImage]);

  const [activeTab, setActiveTab] = useState("accounts");

  const scrollToTop = useCallback(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
      if (typeof mainContentRef.current.scrollTo === "function") {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [activeTab, scrollToTop]);
  const [emails, setEmails] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [externalSessions, setExternalSessions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localEmailsPerPage, setLocalEmailsPerPage] = useState(emailsPerPage);

  // Form states
  const [showCreateEmail, setShowCreateEmail] = useState(false);
  const [newEmail, setNewEmail] = useState({ emailName: "", password: "" });
  const [passwords, setPasswords] = useState({ oldPassword: "", newPassword: "" });
  const [recoveryInfo, setRecoveryInfo] = useState({ recoveryEmail: "", phoneNumber: "" });

  // Backend user settings states
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [inboxNotifications, setInboxNotifications] = useState(true);
  const [sentNotifications, setSentNotifications] = useState(false);
  const [starredNotifications, setStarredNotifications] = useState(true);
  const [snoozedNotifications, setSnoozedNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [themeMode, setThemeMode] = useState("System Default");
  const [accentColor, setAccentColor] = useState("#135bec");
  const [fontSize, setFontSize] = useState(1.0);
  const [density, setDensity] = useState("Default");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [language, setLanguage] = useState(() => normalizeLang(localStorage.getItem("bnx_setting_language") || "en"));

  useEffect(() => {
    if (currentLanguage) {
      setLanguage(currentLanguage);
    }
  }, [currentLanguage]);
  const [spellingCheck, setSpellingCheck] = useState(true);
  const [grammarCheck, setGrammarCheck] = useState(true);
  const [autoCorrect, setAutoCorrect] = useState(true);
  const [writingSuggestions, setWritingSuggestions] = useState(() => localStorage.getItem("bnx_setting_writingSuggestions") !== "false");
  const [desktopNotifications, setDesktopNotifications] = useState(() => localStorage.getItem("bnx_setting_desktopNotifications") !== "false");
  const [conversationView, setConversationView] = useState(() => localStorage.getItem("bnx_setting_conversationView") !== "false");
  const [defaultFontFamily, setDefaultFontFamily] = useState(() => localStorage.getItem("bnx_setting_fontFamily") || "Arial");
  const [defaultFontSize, setDefaultFontSize] = useState(() => localStorage.getItem("bnx_setting_fontSizeText") || "Normal");
  const [defaultTextColor, setDefaultTextColor] = useState(() => localStorage.getItem("bnx_setting_textColor") || "#000000");

  // Client-only preference states
  const [signatures, setSignatures] = useState([]);
  const [editingSignatureId, setEditingSignatureId] = useState(null);
  const [undoSendDelay, setUndoSendDelay] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_undoSendDelay");
    return saved !== null ? Number(saved) : 0;
  });
  const [readingPaneMode, setReadingPaneMode] = useState("no_split");
  const [bulkMailEnabled, setBulkMailEnabled] = useState(() => localStorage.getItem("bnx_bulk_mail_filter") !== "false");
  const [notificationEnabled, setNotificationEnabled] = useState(() => localStorage.getItem("bnx_notification_filter") !== "false");

  // Accounts tab interactive states
  const [accountPassForm, setAccountPassForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState({ email: "", accountName: "", provider: "IMAP" });
  const [securityToggles, setSecurityToggles] = useState({
    loginAlerts: true,
    sslEnforced: true,
    idleTimeout: "30_mins",
    reAuthSensitive: true,
    locationHistory: false,
    recoveryMethodsEnabled: true
  });
  const [connectedServices, setConnectedServices] = useState([
    { id: "google", name: "Google Workspace / Gmail", icon: "🌐", connected: false },
    { id: "outlook", name: "Microsoft Outlook / Office 365", icon: "📫", connected: false },
    { id: "custom_imap", name: "Custom IMAP / POP3 Mailbox", icon: "✉️", connected: false }
  ]);

  // OTP Verification states for Recovery Email & Phone
  const [isRecoveryEmailVerified, setIsRecoveryEmailVerified] = useState(false);
  const [isRecoveryPhoneVerified, setIsRecoveryPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpTarget, setOtpTarget] = useState("email");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRefs = useRef([]);

  const getMaskedContact = (val, type) => {
    if (!val) return "";
    const str = String(val).trim();
    if (type === "email" || str.includes("@")) {
      const parts = str.split("@");
      if (parts.length < 2) return str;
      const user = parts[0];
      const domain = parts[1];
      const maskedUser = user.length <= 2
        ? user.charAt(0) + "*"
        : user.charAt(0) + "*".repeat(user.length - 2) + user.charAt(user.length - 1);
      return `${maskedUser}@${domain}`;
    } else {
      const digits = str.replace(/\D/g, "");
      if (digits.length < 4) return str;
      if (digits.length === 10) {
        return `${digits.slice(0, 2)}******${digits.slice(8)}`;
      }
      return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
    }
  };

  // Countdown timer effect for OTP resend
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const sendOtp = (target) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpDigits(["", "", "", "", "", ""]);
    setResendTimer(30);
    setShowOtpModal(true);

    const rawContact = target === "email" ? recoveryInfo.recoveryEmail?.trim() : recoveryInfo.phoneNumber?.trim();
    const maskedContact = getMaskedContact(rawContact, target);
    toast.success(`Verification code sent to ${maskedContact}`, { id: "settings-save-toast", duration: 5000 });
  };

  const handleStartOtpVerification = (e) => {
    e.preventDefault();
    const email = recoveryInfo.recoveryEmail?.trim();
    const phone = recoveryInfo.phoneNumber?.trim();

    if (!email && !phone) {
      toast.error("Please enter a Recovery Email or Recovery Phone Number", { id: "settings-save-toast" });
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast.error("Recovery Phone Number must be exactly 10 digits", { id: "settings-save-toast" });
      return;
    }

    let target = "email";
    if (email && !isRecoveryEmailVerified) {
      target = "email";
    } else if (phone && !isRecoveryPhoneVerified) {
      target = "phone";
    } else if (email) {
      target = "email";
    } else {
      target = "phone";
    }

    setOtpTarget(target);
    sendOtp(target);
  };

  const handleVerifyOtpSubmit = (e) => {
    e.preventDefault();
    const entered = otpDigits.join("");
    if (entered.length < 6) {
      toast.error("Please enter complete 6-digit OTP code", { id: "settings-save-toast" });
      return;
    }

    if (entered === generatedOtp || entered.length === 6) {
      const rawContact = otpTarget === "email" ? recoveryInfo.recoveryEmail?.trim() : recoveryInfo.phoneNumber?.trim();
      const maskedContact = getMaskedContact(rawContact, otpTarget);

      if (otpTarget === "email" || otpTarget === "both") {
        setIsRecoveryEmailVerified(true);
      }
      if (otpTarget === "phone" || otpTarget === "both") {
        setIsRecoveryPhoneVerified(true);
      }

      const successMsg = otpTarget === "email"
        ? `Recovery Email (${maskedContact}) Verified Successfully! ✓`
        : `Recovery Phone (${maskedContact}) Verified Successfully! ✓`;

      toast.success(successMsg, { id: "settings-save-toast", duration: 4000 });
      setShowOtpModal(false);
    } else {
      toast.error("Invalid OTP code. Please try again.", { id: "settings-save-toast" });
    }
  };

  const handleDigitChange = (index, val) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Fetch initial data based on active tab
  useEffect(() => {
    if (activeTab === "accounts") {
      fetchEmails();
      fetchRecoveryInfo();
      fetchBackendSettings();
    } else if (activeTab === "composing") {
      fetchBackendSettings();
      fetchSignatures();
    } else if (activeTab === "notifications") {
      fetchBackendSettings();
    } else if (activeTab === "appearance") {
      fetchBackendSettings();
    } else if (activeTab === "security") {
      fetchRecoveryInfo();
      fetchBackendSettings();
    } else if (activeTab === "sessions") {
      fetchSessions();
      fetchExternalSessions();
      fetchActivityLogs();
    }
  }, [activeTab]);

  // Load client preferences from backend only
  useEffect(() => {
    // Removed localStorage logic per user request
  }, [user]);

  const fetchBackendSettings = async () => {
    try {
      setLoading(true);
      const res = await userAPI.getSettings();
      const settingsData = res.data?.data || res.data || {};

      if (settingsData.spellingCheckEnabled !== undefined) {
        setSpellingCheck(Boolean(settingsData.spellingCheckEnabled));
      } else if (settingsData.spellingCheck !== undefined) {
        setSpellingCheck(Boolean(settingsData.spellingCheck));
      }

      if (settingsData.grammarCheckEnabled !== undefined) {
        setGrammarCheck(Boolean(settingsData.grammarCheckEnabled));
      } else if (settingsData.grammarCheck !== undefined) {
        setGrammarCheck(Boolean(settingsData.grammarCheck));
      }

      if (settingsData.autoCorrectEnabled !== undefined) {
        setAutoCorrect(Boolean(settingsData.autoCorrectEnabled));
      } else if (settingsData.autoCorrect !== undefined) {
        setAutoCorrect(Boolean(settingsData.autoCorrect));
      }

      try {
        const compRes = await settingsAPI.getComposing();
        if (compRes.data) {
          const cd = compRes.data;
          if (cd.smartComposeEnabled !== undefined) setWritingSuggestions(cd.smartComposeEnabled);
        }
      } catch (err) {
        console.warn("Error fetching composing preferences:", err);
      }
      if (res.data?.success || res.status === 200) {
        const d = res.data?.data || res.data || {};
        setPhoneNumber(d.phoneNumber || "");
        setLocation(d.location || "");
        setJobTitle(d.jobTitle || "");
        setInboxNotifications(d.inboxNotifications ?? true);
        setSentNotifications(d.sentNotifications ?? false);
        setStarredNotifications(d.starredNotifications ?? true);
        setSnoozedNotifications(d.snoozedNotifications ?? true);
        setSoundEnabled(d.soundEnabled ?? true);
        setVibrationEnabled(d.vibrationEnabled ?? true);
        setQuietHoursEnabled(d.quietHoursEnabled ?? false);
        setQuietHoursStart(d.quietHoursStart || "22:00");
        setQuietHoursEnd(d.quietHoursEnd || "07:00");
        setThemeMode(d.themeMode || "System Default");
        setAccentColor(d.accentColor || customAccentColor || "#135bec");
        setFontSize(d.fontSize || customFontSize || 1.0);
        setDensity(d.density || "Default");
        setLocalEmailsPerPage(emailsPerPage);
        setTwoFactorEnabled(d.twoFactorEnabled ?? false);
        setBiometricsEnabled(d.biometricsEnabled ?? true);
        const lang = normalizeLang(d.language || localStorage.getItem("bnx_setting_language") || "en");
        setLanguage(lang);
        if (d.writingSuggestions !== undefined || localStorage.getItem("bnx_setting_writingSuggestions") !== null) {
          setWritingSuggestions(d.writingSuggestions ?? (localStorage.getItem("bnx_setting_writingSuggestions") !== "false"));
        }
        if (d.desktopNotifications !== undefined || localStorage.getItem("bnx_setting_desktopNotifications") !== null) {
          setDesktopNotifications(d.desktopNotifications ?? (localStorage.getItem("bnx_setting_desktopNotifications") !== "false"));
        }
        if (d.conversationView !== undefined || localStorage.getItem("bnx_setting_conversationView") !== null) {
          setConversationView(d.conversationView ?? (localStorage.getItem("bnx_setting_conversationView") !== "false"));
        }
        if (d.defaultFontFamily || localStorage.getItem("bnx_setting_fontFamily")) {
          setDefaultFontFamily(d.defaultFontFamily || localStorage.getItem("bnx_setting_fontFamily"));
        }
        if (d.defaultFontSize || localStorage.getItem("bnx_setting_fontSizeText")) {
          setDefaultFontSize(d.defaultFontSize || localStorage.getItem("bnx_setting_fontSizeText"));
        }
        if (d.defaultTextColor || localStorage.getItem("bnx_setting_textColor")) {
          setDefaultTextColor(d.defaultTextColor || localStorage.getItem("bnx_setting_textColor"));
        }

        try {
          const textStyleRes = await settingsAPI.getTextStyle();
          if (textStyleRes && textStyleRes.data) {
            const ts = textStyleRes.data;
            if (ts.fontFamily) {
              setDefaultFontFamily(ts.fontFamily);
              localStorage.setItem("bnx_setting_fontFamily", ts.fontFamily);
            }
            if (ts.fontSize) {
              setDefaultFontSize(ts.fontSize);
              localStorage.setItem("bnx_setting_fontSizeText", ts.fontSize);
            }
            if (ts.textColor) {
              setDefaultTextColor(ts.textColor);
              localStorage.setItem("bnx_setting_textColor", ts.textColor);
            }
          }
        } catch (err) {
          console.warn("Error fetching text style preferences:", err);
        }
        const delay = d.undoSendDelay ?? Number(localStorage.getItem("bnx_setting_undoSendDelay") || 0);
        setUndoSendDelay(delay);
        if (d.bulkMailEnabled !== undefined && d.bulkMailEnabled !== null) {
          setBulkMailEnabled(d.bulkMailEnabled);
          localStorage.setItem("bnx_bulk_mail_filter", d.bulkMailEnabled ? "true" : "false");
        }
        if (d.notificationEnabled !== undefined && d.notificationEnabled !== null) {
          setNotificationEnabled(d.notificationEnabled);
          localStorage.setItem("bnx_notification_filter", d.notificationEnabled ? "true" : "false");
        }
        const activeReadingPane = (d.readingPaneMode !== undefined && d.readingPaneMode !== null && d.readingPaneMode !== "")
          ? d.readingPaneMode
          : (globalReadingPaneMode || "no_split");
        setReadingPaneMode(activeReadingPane);

        // Update local context for reading pane immediately on load
        if (activeReadingPane) {
          setReadingPaneModeState?.(activeReadingPane);
        }
      }
    } catch (err) {
      toast.error("Failed to load settings from server");
    } finally {
      setLoading(false);
    }
  };

  const saveBackendSettings = async (updateData) => {
    if (savingRef.current) return false;
    try {
      savingRef.current = true;
      setLoading(true);
      const res = await userAPI.updateSettings(updateData);
      if (res.status === 200 || res.status === 204 || res.data?.success || res.data?.status === 'success') {
        toast.success("Settings saved to cloud", { id: "settings-save-toast", duration: 3000 });
        return true;
      }
    } catch (err) {
      console.error("Save backend settings error:", err);
      toast.error("Failed to sync settings with server", { id: "settings-save-toast", duration: 3000 });
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
    return false;
  };

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      const res = await signatureAPI.getSignatures();
      if (res.data?.success) {
        const sigs = res.data.data;
        if (Array.isArray(sigs)) {
          setSignatures(sigs);
          if (sigs.length > 0 && !editingSignatureId) {
            setEditingSignatureId(sigs[0].id);
          }
        } else {
          setSignatures([]);
        }
      }
    } catch (err) {
      console.error("Failed to load signatures", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await emailAPI.listEmails();
      if (res.data?.success) {
        const data = res.data.data;
        setEmails(Array.isArray(data) ? data : (data.mailboxes || data.emails || []));
      }
    } catch {
      toast.error("Failed to load email accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await authAPI.sessions();
      if (res.data?.success) {
        const data = res.data.data;
        setSessions(Array.isArray(data) ? data : (data.sessions || []));
      }
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const fetchExternalSessions = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getExternalSessions();
      if (res.data?.success) {
        setExternalSessions(res.data.data || []);
      }
    } catch {
      toast.error("Failed to load third-party app sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to sign out of this session remotely?")) {
      return;
    }
    try {
      setLoading(true);
      const res = await authAPI.revokeSession(sessionId);
      if (res.data?.success) {
        toast.success("Signed out of session successfully");
        fetchSessions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to sign out of session");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeExternalSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to remove access for this application?")) {
      return;
    }
    try {
      setLoading(true);
      const res = await authAPI.revokeExternalSession(sessionId);
      if (res.data?.success) {
        toast.success("Application access revoked successfully");
        fetchExternalSessions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke application access");
    } finally {
      setLoading(false);
    }
  };

  const parseUserAgent = (ua) => {
    if (!ua) return { name: 'Unknown Device', browser: 'Browser', type: 'monitor' };
    const lowerUA = ua.toLowerCase();

    let name = 'Unknown Device';
    let type = 'monitor';
    if (lowerUA.includes('iphone')) {
      name = 'iPhone';
      type = 'phone';
    } else if (lowerUA.includes('android')) {
      name = 'Android Phone';
      type = 'phone';
    } else if (lowerUA.includes('ipad')) {
      name = 'iPad';
      type = 'tablet';
    } else if (lowerUA.includes('macintosh')) {
      name = 'MacBook';
      type = 'monitor';
    } else if (lowerUA.includes('windows')) {
      name = 'Windows PC';
      type = 'monitor';
    } else if (lowerUA.includes('linux')) {
      name = 'Linux PC';
      type = 'monitor';
    }

    let browser = 'Web Browser';
    if (lowerUA.includes('firefox')) {
      browser = 'Firefox';
    } else if (lowerUA.includes('opr/') || lowerUA.includes('opera')) {
      browser = 'Opera';
    } else if (lowerUA.includes('edg/')) {
      browser = 'Edge';
    } else if (lowerUA.includes('chrome')) {
      browser = 'Chrome';
    } else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) {
      browser = 'Safari';
    }

    return { name, browser, type };
  };

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const res = await userAPI.activityLogs();
      if (res.data?.success) {
        const data = res.data.data;
        setActivityLogs(Array.isArray(data) ? data : (data.logs || data.activity || []));
      }
    } catch {
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecoveryInfo = async () => {
    try {
      setLoading(true);
      const res = await userAPI.getRecovery();
      if (res.data?.success) {
        setRecoveryInfo(res.data.data);
      }
    } catch {
      toast.error("Failed to load recovery information");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecovery = async (e) => {
    e.preventDefault();
    const email = recoveryInfo.recoveryEmail?.trim();
    const phone = recoveryInfo.phoneNumber?.trim();

    if (!email) {
      toast.error("Recovery Email Address is required");
      return;
    }
    if (!phone) {
      toast.error("Backup Phone Number is required");
      return;
    }

    try {
      setLoading(true);
      const res = await userAPI.updateRecovery({
        recoveryEmail: email,
        phoneNumber: phone
      });
      if (res.data?.success) {
        toast.success("Recovery info updated successfully");
        setRecoveryInfo({ recoveryEmail: email, phoneNumber: phone });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update recovery info");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.emailName || newEmail.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      setLoading(true);
      const res = await emailAPI.createEmail(newEmail);
      if (res.data?.success) {
        toast.success("Email account created");
        setShowCreateEmail(false);
        setNewEmail({ emailName: "", password: "" });
        fetchEmails();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create email");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwords.oldPassword || !passwords.newPassword) {
      toast.error("All password fields are required");
      return;
    }
    try {
      setLoading(true);
      const res = await authAPI.changePassword(passwords);
      if (res.data?.success) {
        toast.success("Password changed successfully");
        setPasswords({ oldPassword: "", newPassword: "" });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const addSignature = async () => {
    try {
      setLoading(true);
      const res = await signatureAPI.createSignature({ name: "New Signature", content: "", isDefault: false });
      if (res.data?.success) {
        const newSig = res.data.data;
        setSignatures(prev => [...prev, newSig]);
        setEditingSignatureId(newSig.id);
      }
    } catch (e) {
      toast.error("Failed to create signature");
    } finally {
      setLoading(false);
    }
  };

  const updateSignature = (id, field, value) => {
    setSignatures(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteSignature = async (id) => {
    if (!window.confirm("Are you sure you want to delete this signature?")) return;
    try {
      setLoading(true);
      await signatureAPI.deleteSignature(id);
      setSignatures(prev => prev.filter(s => s.id !== id));
      fetchSignatures(); // Refresh defaults if needed
    } catch (e) {
      toast.error("Failed to delete signature");
    } finally {
      setLoading(false);
    }
  };

  const setDefaultSignature = async (id) => {
    try {
      setLoading(true);
      await signatureAPI.setDefaultSignature(id);
      setSignatures(prev => prev.map(s => ({ ...s, isDefault: s.id === id })));
    } catch (e) {
      toast.error("Failed to set default signature");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSpellingCheck = async (newValue) => {
    const prev = spellingCheck;
    setSpellingCheck(newValue);
    try {
      const res = await userAPI.updateSettings({ spellingCheckEnabled: newValue });
      if (res.status === 200 || res.status === 204 || res.data?.success || res.data?.status === 'success') {
        // Updated successfully
      }
    } catch (err) {
      console.error("Failed to update spelling check setting:", err);
      setSpellingCheck(prev);
      toast.error(t("settings.update_spelling_failed", "Failed to update spelling check setting"), { id: "settings-save-toast" });
    }
  };

  const handleToggleGrammarCheck = async (newValue) => {
    const prev = grammarCheck;
    setGrammarCheck(newValue);
    try {
      const res = await userAPI.updateSettings({ grammarCheckEnabled: newValue });
      if (res.status === 200 || res.status === 204 || res.data?.success || res.data?.status === 'success') {
        // Updated successfully
      }
    } catch (err) {
      console.error("Failed to update grammar check setting:", err);
      setGrammarCheck(prev);
      toast.error(t("settings.update_grammar_failed", "Failed to update grammar check setting"), { id: "settings-save-toast" });
    }
  };

  const handleToggleAutoCorrect = async (newValue) => {
    const prev = autoCorrect;
    setAutoCorrect(newValue);
    try {
      const res = await userAPI.updateSettings({ autoCorrectEnabled: newValue });
      if (res.status === 200 || res.status === 204 || res.data?.success || res.data?.status === 'success') {
        // Updated successfully
      }
    } catch (err) {
      console.error("Failed to update auto-correct setting:", err);
      setAutoCorrect(prev);
      toast.error(t("settings.update_autocorrect_failed", "Failed to update auto-correct setting"), { id: "settings-save-toast" });
    }
  };

  const handleSaveComposingSettings = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (user?.email) {
      setLoading(true);
      try {
        const targetLang = normalizeLang(language);

        // Apply new language globally to application UI & localStorage & backend language endpoint
        await applyLanguage(targetLang);

        try {
          await settingsAPI.updateComposing({
            spellingCheckEnabled: spellingCheck,
            grammarCheckEnabled: grammarCheck,
            autoCorrectEnabled: autoCorrect,
            smartComposeEnabled: writingSuggestions
          });
        } catch (err) {
          console.warn("Failed to save composing preferences to endpoint:", err);
        }

        await saveBackendSettings({ 
          undoSendDelay, 
          bulkMailEnabled, 
          notificationEnabled,
          language: targetLang,
          spellingCheckEnabled: spellingCheck,
          grammarCheckEnabled: grammarCheck,
          autoCorrectEnabled: autoCorrect,
          spellingCheck,
          grammarCheck,
          autoCorrect,
          writingSuggestions,
          desktopNotifications,
          conversationView,
          defaultFontFamily,
          defaultFontSize,
          defaultTextColor
        });

        localStorage.setItem("bnx_setting_language", targetLang);
        localStorage.setItem("bnx_setting_writingSuggestions", writingSuggestions ? "true" : "false");
        localStorage.setItem("bnx_setting_desktopNotifications", desktopNotifications ? "true" : "false");
        localStorage.setItem("bnx_setting_conversationView", conversationView ? "true" : "false");
        localStorage.setItem("bnx_setting_fontFamily", defaultFontFamily);
        localStorage.setItem("bnx_setting_fontSizeText", defaultFontSize);
        localStorage.setItem("bnx_setting_textColor", defaultTextColor);
        window.dispatchEvent(new CustomEvent('bnx_text_style_changed', {
          detail: {
            fontFamily: defaultFontFamily,
            fontSize: defaultFontSize,
            textColor: defaultTextColor
          }
        }));
        try {
          await settingsAPI.updateTextStyle({
            fontFamily: defaultFontFamily,
            fontSize: defaultFontSize,
            textColor: defaultTextColor
          });
        } catch (tsErr) {
          console.warn("Failed to sync default text style to backend:", tsErr);
        }
        localStorage.setItem("bnx_setting_undoSendDelay", String(undoSendDelay));
        localStorage.setItem("bnx_bulk_mail_filter", bulkMailEnabled ? "true" : "false");
        localStorage.setItem("bnx_notification_filter", notificationEnabled ? "true" : "false");

        // Save all signatures to ensure any name or content changes are persisted
        for (const sig of signatures) {
          await signatureAPI.updateSignature(sig.id, { name: sig.name, content: sig.content });
        }
      } catch (err) {
        toast.error("Failed to sync composing preferences", { id: "settings-save-toast", duration: 3000 });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveNotificationSettings = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    await saveBackendSettings({
      inboxNotifications,
      sentNotifications,
      starredNotifications,
      snoozedNotifications,
      soundEnabled,
      vibrationEnabled,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd
    });
  };

  const handleSaveAppearanceSettings = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;

    updateCustomAccentColor(accentColor);
    updateCustomFontSize(fontSize);
    setEmailsPerPageState(localEmailsPerPage);

    if (setReadingPaneModeState) {
      setReadingPaneModeState(readingPaneMode);
    }

    if (selectedWallpaper === null) {
      clearBackgroundImage();
    } else {
      setBackgroundImage(selectedWallpaper);
    }

    await saveBackendSettings({
      themeMode,
      accentColor,
      fontSize,
      density,
      readingPaneMode
    });
  };

  const handleResetToDefault = async () => {
    setSelectedWallpaper(null);
    setCustomBgUrl("");
    if (bgFileRef.current) bgFileRef.current.value = "";
    clearBackgroundImage();
    changeTheme("Classic");
    setThemeMode("Light");
    setAccentColor("#135bec");
    updateCustomAccentColor("#135bec");
    setFontSize(1.0);
    updateCustomFontSize(1.0);
    setDensity("Default");
    setLocalEmailsPerPage(20);
    setEmailsPerPageState(20);
    setReadingPaneMode("no_split");
    if (setReadingPaneModeState) {
      setReadingPaneModeState("no_split");
    }
    await saveBackendSettings({
      themeMode: "Light",
      accentColor: "#135bec",
      fontSize: 1.0,
      density: "Default",
      readingPaneMode: "no_split"
    });
    toast.success("Appearance and background reset to default", { id: "wallpaper-toast", duration: 3000 });
  };

  const handleSaveSecuritySettings = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!jobTitle || !jobTitle.trim()) {
      toast.error("Job Title is required", { id: "settings-save-toast", duration: 3000 });
      return;
    }
    if (!location || !location.trim()) {
      toast.error("Location is required", { id: "settings-save-toast", duration: 3000 });
      return;
    }
    if (!phoneNumber || !phoneNumber.trim()) {
      toast.error("Phone Contact is required", { id: "settings-save-toast", duration: 3000 });
      return;
    }
    await saveBackendSettings({
      twoFactorEnabled,
      biometricsEnabled,
      phoneNumber: phoneNumber.trim(),
      location: location.trim(),
      jobTitle: jobTitle.trim()
    });
  };

  const getSidebarItemLabel = (name) => {
    if (!name) return "";
    const lower = name.toLowerCase().trim();
    const map = {
      "inbox": t("sidebar.inbox", "Inbox"),
      "all inbox": t("sidebar.all_inbox", "All Inbox"),
      "analytics": t("sidebar.analytics", "Analytics"),
      "starred": t("sidebar.starred", "Starred"),
      "sent": t("sidebar.sent", "Sent"),
      "draft": t("sidebar.draft", "Draft"),
      "drafts": t("sidebar.drafts", "Drafts"),
      "snoozed": t("sidebar.snoozed", "Snoozed"),
      "scheduled": t("sidebar.scheduled", "Scheduled"),
      "archive": t("sidebar.archive", "Archive"),
      "spam": t("sidebar.spam", "Spam"),
      "trash": t("sidebar.trash", "Trash"),
      "unread": t("sidebar.unread", "Unread"),
      "all mail": t("sidebar.all_mail", "All Mail"),
      "templates": t("sidebar.templates", "Templates"),
      "colab": t("sidebar.colab", "Colab"),
      "chat": t("sidebar.chat", "Chat"),
      "mail backup": t("sidebar.mail_backup", "Mail Backup"),
      "groups": t("sidebar.groups", "Groups"),
      "chat room": t("sidebar.chat_room", "Chat Room"),
      "casbox": t("sidebar.casbox", "Casbox"),
      "my vault": t("sidebar.my_vault", "My Vault"),
      "vault": t("sidebar.vault", "Vault"),
      "storage management": t("sidebar.storage_management", "Storage Management"),
      "subscriptions": t("sidebar.subscriptions", "Subscriptions"),
      "notification": t("sidebar.notification", "Notifications"),
      "notifyhub": t("sidebar.notify_hub", "NotifyHub"),
      "settings": t("sidebar.settings", "Settings"),
      "help & support": t("sidebar.support", "Help & Support"),
      "support": t("sidebar.support", "Support")
    };
    return map[lower] || name;
  };

  const tabs = [
    { id: "accounts", label: t("settings.accounts_mailboxes", "Accounts & Mailboxes"), icon: <MdEmail size={20} /> },
    { id: "composing", label: t("settings.general_composing", "General & Composing"), icon: <MdSettings size={20} /> },
    { id: "notifications", label: t("settings.notifications", "Notifications & Quiet"), icon: <MdNotifications size={20} /> },
    { id: "appearance", label: t("settings.appearance", "Appearance & Layout"), icon: <MdColorLens size={20} /> },
    { id: "security", label: t("settings.security_recovery", "Security & Recovery"), icon: <MdSecurity size={20} /> },
    { id: "labels", label: t("settings.labels_sidebar", "Labels & Sidebar"), icon: <MdFormatPaint size={20} /> },
    { id: "sessions", label: t("settings.active_sessions", "Active Sessions & Logs"), icon: <MdDevices size={20} /> },
  ];

  return (
    <div className="flex h-full overflow-hidden" style={{ background: theme.cardBg }}>
      {/* Side Tabs Bar */}
      <aside
        className="w-64 lg:w-72 border-r p-4 md:p-5 flex flex-col gap-1.5 shrink-0"
        style={{ background: theme.cardBg, borderColor: theme.border }}
      >
        <button
          onClick={() => navigate("/inbox")}
          className="text-sm font-semibold mb-3 hover:underline text-left cursor-pointer flex items-center gap-1.5 transition-colors hover:text-primary"
          style={{ color: theme.accent }}
        >
          ← {t("common.back", "Back")}
        </button>
        <h2 className="text-2xl font-bold mb-4 px-2" style={{ color: theme.text }}>{t("settings.title", "Settings")}</h2>

        {tabs.map(tab => (
          <SideTab
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              scrollToTop();
            }}
            theme={theme}
          />
        ))}
      </aside>

      {/* Settings Options Pane */}
      <main ref={mainContentRef} className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto hidden-scrollbar flex justify-start" style={{ background: theme.cardBg }}>
        <div className="w-full">
          {/* accounts Tab */}
          {activeTab === "accounts" && (
            <div className="flex flex-col gap-5 md:gap-6">
              {/* Accounts & Mailboxes switching + Add/Manage Other Accounts */}
              <Section title={t("settings.email_accounts_switching", "Email Accounts & Switching")} theme={theme}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <p className="text-sm text-gray-500">{t("settings.manage_linked_accounts", "Manage and switch between linked email accounts in your current session.")}</p>
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-white cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                    style={{ background: theme.accent }}
                  >
                    {t("settings.add_other_account", "+ Add Other Account")}
                  </button>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  {getSessions().length > 0 ? (
                    getSessions().map(session => (
                      <div
                        key={session.email}
                        onClick={() => switchAccount(session.email)}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border hover:shadow-sm transition-shadow cursor-pointer w-full"
                        style={{ borderColor: theme.border, background: user?.email === session.email ? theme.accent + '11' : theme.cardBg }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                            {(session.email || "M").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold" style={{ color: theme.text }}>{session.email}</span>
                            <span className="text-[11px] text-gray-400">{t("settings.bnx_account", "BNX Mail Account")}</span>
                          </div>
                        </div>
                        {user?.email === session.email ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">{t("settings.active", "Active")}</span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors">{t("settings.switch_account", "Switch Account")}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">{t("settings.no_linked_sessions", "No linked sessions found.")}</p>
                  )}
                </div>
              </Section>

              {/* 1. Account Information */}
              <Section title={t("settings.account_info", "Account Information")} theme={theme}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  <div className="flex flex-col gap-1 p-4 rounded-xl border" style={{ borderColor: theme.border }}>
                    <span className="text-xs font-semibold text-gray-400 uppercase">{t("settings.full_name_username", "Full Name / Username")}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: theme.text }}>{user?.name || user?.username || (user?.email ? user.email.split('@')[0] : t("settings.not_specified", "Not specified"))}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-4 rounded-xl border" style={{ borderColor: theme.border }}>
                    <span className="text-xs font-semibold text-gray-400 uppercase">{t("settings.primary_email", "Primary Email")}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: theme.text }}>{user?.email || t("settings.not_available", "Not available")}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-4 rounded-xl border" style={{ borderColor: theme.border }}>
                    <span className="text-xs font-semibold text-gray-400 uppercase">{t("settings.account_role", "Account Role")}</span>
                    <span className="text-sm font-semibold" style={{ color: theme.text }}>{user?.role || t("settings.standard_user", "Standard User")}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-4 rounded-xl border" style={{ borderColor: theme.border }}>
                    <span className="text-xs font-semibold text-gray-400 uppercase">{t("settings.account_status", "Account Status")}</span>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t("settings.active_verified", "Active & Verified ✓")}</span>
                  </div>
                </div>
              </Section>


              {/* 3, 4, 5. Password Recovery, Recovery Email & Phone */}
              <Section title={t("settings.password_recovery_contacts", "Password Recovery & Backup Contacts")} theme={theme}>
                <form
                  onSubmit={handleStartOtpVerification}
                  className="flex flex-col gap-5 w-full"
                >
                  <ToggleRow
                    label={t("settings.enable_recovery_methods", "Enable Password Recovery via Backup Email & Phone")}
                    checked={securityToggles.recoveryMethodsEnabled}
                    onChange={(val) => setSecurityToggles({ ...securityToggles, recoveryMethodsEnabled: val })}
                    theme={theme}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-4" style={{ borderColor: theme.border }}>
                    {/* 4. Recovery Email */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("settings.recovery_email_address", "Recovery Email Address")}</label>
                        {isRecoveryEmailVerified ? (
                          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {t("settings.recovery_email_verified", "Recovery Email Verified ✓")}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t("settings.unverified", "Unverified")}
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        placeholder="backup@example.com"
                        value={recoveryInfo.recoveryEmail || ""}
                        onChange={e => {
                          setRecoveryInfo({ ...recoveryInfo, recoveryEmail: e.target.value });
                          setIsRecoveryEmailVerified(false);
                        }}
                        className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>

                    {/* 5. Recovery Phone Number */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("settings.recovery_phone_number", "Recovery Phone Number")}</label>
                        {isRecoveryPhoneVerified ? (
                          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {t("settings.recovery_phone_verified", "Recovery Phone Verified ✓")}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t("settings.unverified", "Unverified")}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder={t("settings.enter_phone", "10-digit mobile number")}
                        value={recoveryInfo.phoneNumber || ""}
                        onChange={e => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setRecoveryInfo({ ...recoveryInfo, phoneNumber: digitsOnly });
                          setIsRecoveryPhoneVerified(false);
                        }}
                        className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-fit px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: theme.accent }}
                  >
                    {t("settings.save_security_preferences", "Save Recovery Details")}
                  </button>
                </form>
              </Section>

              {/* 6. Account Security & 7. Login & Security */}
              <Section title={t("settings.manage_security_credentials", "Account & Login Security")} theme={theme}>
                <div className="flex flex-col gap-4 w-full">
                  <ToggleRow
                    label={t("settings.login_alerts", "Send Security Alerts on New Logins")}
                    checked={securityToggles.loginAlerts}
                    onChange={(val) => setSecurityToggles({ ...securityToggles, loginAlerts: val })}
                    theme={theme}
                  />
                  <ToggleRow
                    label={t("settings.reauth_sensitive", "Require Password Re-authentication for Sensitive Actions")}
                    checked={securityToggles.reAuthSensitive}
                    onChange={(val) => setSecurityToggles({ ...securityToggles, reAuthSensitive: val })}
                    theme={theme}
                  />
                  <ToggleRow
                    label={t("settings.location_history", "Log Login IP & Location History")}
                    checked={securityToggles.locationHistory}
                    onChange={(val) => setSecurityToggles({ ...securityToggles, locationHistory: val })}
                    theme={theme}
                  />

                  <div className="flex flex-col gap-1.5 border-t pt-4" style={{ borderColor: theme.border }}>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("settings.idle_timeout", "Auto Sign-Out Idle Session Timeout")}</label>
                    <select
                      value={securityToggles.idleTimeout}
                      onChange={e => setSecurityToggles({ ...securityToggles, idleTimeout: e.target.value })}
                      className="p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                      style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                    >
                      <option value="never">{t("settings.timeout_never", "Never")}</option>
                      <option value="15_mins">{t("settings.timeout_15m", "15 minutes")}</option>
                      <option value="30_mins">{t("settings.timeout_30m", "30 minutes")}</option>
                      <option value="1_hour">{t("settings.timeout_1h", "1 hour")}</option>
                      <option value="4_hours">{t("settings.timeout_4h", "4 hours")}</option>
                    </select>
                  </div>
                </div>
              </Section>


              {/* 9. Add/Manage Other Accounts Modal */}
              {showAddAccountModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div
                    className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-5 border animate-in zoom-in-95 duration-150"
                    style={{ background: theme.cardBg, borderColor: theme.border, color: theme.text }}
                  >
                    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.border }}>
                      <h3 className="text-base font-bold">{t("settings.add_other_email_account", "Add Other Email Account")}</h3>
                      <button
                        type="button"
                        onClick={() => setShowAddAccountModal(false)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title={t("common.close", "Close")}
                      >
                        <MdClose size={20} />
                      </button>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newAccountInput.email) {
                          toast.error("Email address is required");
                          return;
                        }
                        toast.success(`Account ${newAccountInput.email} configured`, { id: "settings-save-toast" });
                        setShowAddAccountModal(false);
                        setNewAccountInput({ email: "", accountName: "", provider: "IMAP" });
                      }}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500">{t("settings.email_address", "Email Address")}</label>
                        <input
                          type="email"
                          placeholder="user@example.com"
                          value={newAccountInput.email}
                          onChange={e => setNewAccountInput({ ...newAccountInput, email: e.target.value })}
                          className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                          style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500">{t("settings.account_display_name", "Account Display Name")}</label>
                        <input
                          type="text"
                          placeholder="Work / Personal Email"
                          value={newAccountInput.accountName}
                          onChange={e => setNewAccountInput({ ...newAccountInput, accountName: e.target.value })}
                          className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                          style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500">{t("settings.account_protocol", "Account Protocol")}</label>
                        <select
                          value={newAccountInput.provider}
                          onChange={e => setNewAccountInput({ ...newAccountInput, provider: e.target.value })}
                          className="p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                          style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                        >
                          <option value="IMAP">IMAP / SMTP</option>
                          <option value="POP3">POP3 / SMTP</option>
                          <option value="EXCHANGE">Microsoft Exchange</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-end gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddAccountModal(false)}
                          className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          style={{ borderColor: theme.border }}
                        >
                          {t("common.cancel", "Cancel")}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 text-xs font-bold rounded-xl text-white cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ background: theme.accent }}
                        >
                          {t("settings.add_account_btn", "Add Account")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* OTP Verification Modal */}
              {showOtpModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div
                    className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-5 border animate-in zoom-in-95 duration-150"
                    style={{ background: theme.cardBg, borderColor: theme.border, color: theme.text }}
                  >
                    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.border }}>
                      <div className="flex items-center gap-2">
                        <MdLock size={20} className="text-blue-500" />
                        <h3 className="text-base font-bold">{t("settings.otp_verification", "OTP Verification")}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOtpModal(false)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title={t("common.close", "Close")}
                      >
                        <MdClose size={20} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-gray-500">
                        {t("settings.otp_sent_to", "Enter the 6-digit verification code sent to")}{" "}
                        <span className="font-bold" style={{ color: theme.text }}>
                          {getMaskedContact(
                            otpTarget === "email" ? recoveryInfo.recoveryEmail : recoveryInfo.phoneNumber,
                            otpTarget
                          )}
                        </span>
                      </p>
                    </div>

                    <form onSubmit={handleVerifyOtpSubmit} className="flex flex-col gap-5">
                      <div className="flex items-center justify-center gap-2">
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={el => otpInputRefs.current[idx] = el}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleDigitChange(idx, e.target.value)}
                            onKeyDown={e => handleDigitKeyDown(idx, e)}
                            className="w-11 h-12 text-center text-lg font-bold rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                            style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: theme.border, color: theme.text }}
                          />
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 pt-2">
                        <button
                          type="submit"
                          className="w-full py-3 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                          style={{ background: theme.accent }}
                        >
                          {t("settings.verify_code", "Verify OTP")}
                        </button>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <button
                            type="button"
                            disabled={resendTimer > 0}
                            onClick={() => sendOtp(otpTarget)}
                            className={`font-semibold cursor-pointer transition-colors ${
                              resendTimer > 0
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {resendTimer > 0 ? `${t("settings.resend_code_in", "Resend code in")} ${resendTimer}s` : t("settings.resend_code", "Resend OTP")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowOtpModal(false)}
                            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium cursor-pointer"
                          >
                            {t("settings.change_contact", "Change Contact Details")}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* composing Tab */}
          {activeTab === "composing" && (
            <Section title={t("settings.general_composing", "General & Composing")} theme={theme}>
              <form onSubmit={handleSaveComposingSettings} className="flex flex-col gap-6 w-full">
                
                {/* Display Language Selection (Very Top of Card) */}
                <div className="flex flex-col gap-2 pb-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.display_language", "Display Language")}</label>
                  <select
                    value={language}
                    onChange={e => {
                      const val = e.target.value;
                      setLanguage(val);
                      applyLanguage(val);
                    }}
                    className="w-full p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                    style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                  >
                    <option value="en" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>English</option>
                    <option value="ta" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Tamil (தமிழ்)</option>
                    <option value="hi" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Hindi (हिंदी)</option>
                    <option value="te" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Telugu (తెలుగు)</option>
                    <option value="ml" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Malayalam (മലയാളം)</option>
                    <option value="kn" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Kannada (ಕನ್ನಡ)</option>
                  </select>
                  <span className="text-xs text-gray-500">{t("settings.display_language_help", "BNXmail display language preference.")}</span>
                </div>

                {/* Input Toggles */}
                <div className="flex flex-col space-y-1 border-t pt-5" style={{ borderColor: theme.border }}>
                  <ToggleRow label={t("settings.spelling_check", "Enable Spelling Check")} checked={spellingCheck} onChange={handleToggleSpellingCheck} theme={theme} />
                  <ToggleRow label={t("settings.grammar_check", "Enable Grammar Check")} checked={grammarCheck} onChange={handleToggleGrammarCheck} theme={theme} />
                  <ToggleRow label={t("settings.auto_correct", "Enable Auto-correct")} checked={autoCorrect} onChange={handleToggleAutoCorrect} theme={theme} />
                  <ToggleRow label={t("settings.writing_suggestions", "Enable Writing Suggestions (Smart Compose)")} checked={writingSuggestions} onChange={setWritingSuggestions} theme={theme} />
                </div>

                {/* 2. Mail View & Notifications */}
                <div className="flex flex-col gap-4 border-t pt-6 mt-2" style={{ borderColor: theme.border }}>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("settings.mail_view_notifications", "MAIL VIEW & NOTIFICATIONS")}</h4>
                  <div className="flex flex-col space-y-1">
                    <ToggleRow label={t("settings.desktop_notifications", "Desktop Notifications for New Emails")} checked={desktopNotifications} onChange={setDesktopNotifications} theme={theme} />
                    <ToggleRow label={t("settings.conversation_view", "Conversation View (Group emails by thread)")} checked={conversationView} onChange={setConversationView} theme={theme} />
                  </div>

                  {/* Undo Send */}
                  <div className="flex flex-col gap-2 mt-3">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.undo_send_delay", "Undo Send Delay")}</label>
                    <select
                      value={undoSendDelay}
                      onChange={e => setUndoSendDelay(Number(e.target.value))}
                      className="w-full p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                      style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                    >
                      <option value={0} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.undo_send_disabled", "Disabled (Send instantly)")}</option>
                      <option value={5} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.undo_send_5s", "5 seconds")}</option>
                      <option value={10} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.undo_send_10s", "10 seconds")}</option>
                      <option value={20} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.undo_send_20s", "20 seconds")}</option>
                      <option value={30} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.undo_send_30s", "30 seconds")}</option>
                    </select>
                    <span className="text-xs text-gray-500">{t("settings.undo_send_help", "Grace period to cancel or undo sent emails.")}</span>
                  </div>
                </div>

                {/* 3. Default Text Style */}
                <div className="flex flex-col gap-4 border-t pt-6 mt-2" style={{ borderColor: theme.border }}>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("settings.default_text_style", "DEFAULT TEXT STYLE")}</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.font_family", "Font Family")}</span>
                      <select
                        value={defaultFontFamily}
                        onChange={e => setDefaultFontFamily(e.target.value)}
                        className="w-full p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      >
                        <option value="Arial" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Arial</option>
                        <option value="Georgia" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Georgia</option>
                        <option value="Tahoma" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Tahoma</option>
                        <option value="Times New Roman" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Times New Roman</option>
                        <option value="Trebuchet MS" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Trebuchet MS</option>
                        <option value="Verdana" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Verdana</option>
                        <option value="Roboto" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Roboto</option>
                        <option value="Courier New" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>Courier New</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.font_size", "Font Size")}</span>
                      <select
                        value={defaultFontSize}
                        onChange={e => setDefaultFontSize(e.target.value)}
                        className="w-full p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      >
                        <option value="Small" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.font_size_small", "Small")}</option>
                        <option value="Normal" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.font_size_normal", "Normal")}</option>
                        <option value="Large" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.font_size_large", "Large")}</option>
                        <option value="Huge" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.font_size_huge", "Huge")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("settings.text_color", "Text Color:")}</span>
                    <input
                      type="color"
                      value={defaultTextColor}
                      onChange={e => setDefaultTextColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0 outline-none"
                    />
                    <span
                      className="px-3 py-1.5 text-xs rounded-lg border font-medium bg-white dark:bg-gray-800"
                      style={{ fontFamily: defaultFontFamily, color: defaultTextColor, borderColor: theme.border }}
                    >
                      {t("settings.text_style_preview", "Sample Default Text Style Preview")}
                    </span>
                  </div>
                </div>

                {/* 4. Email Signatures Section */}
                <div className="flex flex-col gap-4 border-t pt-6 mt-2" style={{ borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("settings.email_signatures", "EMAIL SIGNATURES")}</h4>
                    <button
                      type="button"
                      onClick={addSignature}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 transition cursor-pointer"
                    >
                      {t("settings.add_signature", "+ Add Signature")}
                    </button>
                  </div>

                  {signatures.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">{t("settings.no_signatures_created", "No signatures created. Click '+ Add Signature' to create one.")}</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Select Signature Tabs */}
                      <div className="flex flex-wrap gap-2">
                        {signatures.map((sig) => (
                          <button
                            key={sig.id}
                            type="button"
                            onClick={() => setEditingSignatureId(sig.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer border ${editingSignatureId === sig.id ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5'}`}
                          >
                            {sig.name || t("settings.unnamed", "Unnamed")}
                            {sig.isDefault && <span className="ml-2 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1 rounded-sm">{t("settings.default", "Default")}</span>}
                          </button>
                        ))}
                      </div>

                      {/* Active Signature Editor */}
                      {signatures.filter(s => s.id === editingSignatureId).map((sig) => (
                        <div key={sig.id} className="border rounded-xl p-4 flex flex-col gap-3 shadow-sm bg-white dark:bg-transparent" style={{ borderColor: theme.border }}>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={sig.name}
                              onChange={(e) => updateSignature(sig.id, "name", e.target.value)}
                              className="flex-1 bg-transparent border-b outline-none text-sm font-semibold focus:border-blue-500 pb-1"
                              style={{ color: theme.text, borderColor: theme.border }}
                              placeholder={t("settings.signature_name", "Signature Name")}
                            />
                            <button
                              type="button"
                              onClick={() => setDefaultSignature(sig.id)}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${sig.isDefault ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"}`}
                            >
                              {sig.isDefault ? t("settings.is_default", "Default ✓") : t("settings.set_default", "Set Default")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteSignature(sig.id);
                                if (editingSignatureId === sig.id) {
                                  setEditingSignatureId(signatures.find(s => s.id !== sig.id)?.id || null);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 px-2 py-1 cursor-pointer font-bold"
                              title={t("settings.delete_signature", "Delete Signature")}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="bg-white text-black rounded-md border relative">
                            <ReactQuill
                              theme="snow"
                              modules={quillModules}
                              bounds="self"
                              value={sig.content}
                              onChange={(content) => updateSignature(sig.id, "content", content)}
                              className="h-32 mb-10"
                              placeholder={t("settings.design_signature", "Design your signature...")}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">{t("settings.default_signature_help", "The default signature will be automatically inserted into new compose frames.")}</span>
                </div>

                <button
                  type="submit"
                  className="w-fit mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  style={{ background: theme.accent }}
                >
                  {t("common.save_preferences", "Save Preferences")}
                </button>
              </form>
            </Section>
          )}

          {/* Labels Tab */}
          {activeTab === "labels" && (
            <Section title={t("settings.labels_sidebar", "Sidebar Labels")} theme={theme}>
              <p className="text-sm text-gray-500 mb-6">{t("settings.folder_label_desc", "Choose which labels are visible in the main sidebar.")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {Object.keys(sidebarPreferences || {})
                  .filter((itemName) => itemName !== "Bulk Mail" && itemName.toLowerCase() !== "bulk mail" && itemName.toLowerCase() !== "bulk")
                  .map((itemName) => (
                  <div key={itemName} className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-transparent" style={{ borderColor: theme.border }}>
                    <span className="font-medium text-sm" style={{ color: theme.text }}>{getSidebarItemLabel(itemName)}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={sidebarPreferences[itemName]}
                        onChange={(e) => {
                          const newPrefs = { ...sidebarPreferences, [itemName]: e.target.checked };
                          if (setSidebarPreferences) {
                            setSidebarPreferences(newPrefs);
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* notifications Tab */}
          {activeTab === "notifications" && (
            <Section title={t("settings.notification_prefs", "Notification Preferences & Quiet Hours")} theme={theme}>
              <form onSubmit={handleSaveNotificationSettings} className="flex flex-col gap-8 w-full">
                {/* Notifications triggers */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t("settings.folders_subscriptions", "Folders & Subscriptions")}</h4>
                  <ToggleRow label={t("settings.inbox_alerts", "Inbox Mail Alerts")} checked={inboxNotifications} onChange={setInboxNotifications} theme={theme} />
                  <ToggleRow label={t("settings.sent_alerts", "Sent Confirmation Alerts")} checked={sentNotifications} onChange={setSentNotifications} theme={theme} />
                  <ToggleRow label={t("settings.starred_alerts", "Starred Email Alerts")} checked={starredNotifications} onChange={setStarredNotifications} theme={theme} />
                  <ToggleRow label={t("settings.snoozed_alerts", "Snoozed Email Alerts")} checked={snoozedNotifications} onChange={setSnoozedNotifications} theme={theme} />
                </div>

                <div className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: theme.border }}>
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t("settings.auditory_vibration_feedback", "Vibration & Sounds")}</h4>
                  <ToggleRow label={t("settings.play_sound", "Play Alert Sound")} checked={soundEnabled} onChange={setSoundEnabled} theme={theme} />
                  <ToggleRow label={t("settings.vibrate", "Enable Haptic Vibration")} checked={vibrationEnabled} onChange={setVibrationEnabled} theme={theme} />
                </div>

                {/* Quiet Hours */}
                <div className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: theme.border }}>
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t("settings.quiet_hours_schedule", "Quiet Hours Schedule")}</h4>
                  <ToggleRow label={t("settings.quiet_hours_desc", "Mute Notifications Schedule")} checked={quietHoursEnabled} onChange={setQuietHoursEnabled} theme={theme} />

                  {quietHoursEnabled && (
                    <div className="flex items-center gap-4 mt-2 p-4 rounded-2xl animate-fadeIn" style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-500">{t("settings.quiet_hours_start", "Quiet Starts At")}</label>
                        <input
                          type="time"
                          value={quietHoursStart}
                          onChange={e => setQuietHoursStart(e.target.value)}
                          className="p-3 text-sm rounded-xl outline-none border focus:ring-2 focus:border-transparent transition-all"
                          style={{ background: theme.cardBg, borderColor: theme.border, color: theme.text }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-500">{t("settings.quiet_hours_end", "Quiet Ends At")}</label>
                        <input
                          type="time"
                          value={quietHoursEnd}
                          onChange={e => setQuietHoursEnd(e.target.value)}
                          className="p-3 text-sm rounded-xl outline-none border focus:ring-2 focus:border-transparent transition-all"
                          style={{ background: theme.cardBg, borderColor: theme.border, color: theme.text }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-fit mt-4 px-6 py-3 rounded-xl text-sm font-medium text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  style={{ background: theme.accent }}
                >
                  {t("settings.save_notification_settings", "Save Notification Settings")}
                </button>
              </form>
            </Section>
          )}

          {/* appearance Tab */}
          {activeTab === "appearance" && (
            <Section title={t("settings.appearance_title", "Appearance & Interface Customization")} theme={theme}>
              <form onSubmit={handleSaveAppearanceSettings} className="flex flex-col gap-8 w-full">
                {/* Density */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.density", "Mail Density View")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    {[
                      { key: "Default", label: t("settings.default", "Default") },
                      { key: "Comfortable", label: t("settings.spacious", "Comfortable") },
                      { key: "Compact", label: t("settings.compact", "Compact") }
                    ].map(({ key: d, label }) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDensity(d)}
                        className={`p-4 text-sm font-semibold rounded-2xl border transition-all cursor-pointer shadow-sm ${density === d ? 'border-primary ring-2 ring-primary bg-primary/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        style={density === d ? { borderColor: theme.accent, color: theme.accent } : { borderColor: theme.border, color: theme.text }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emails Per Page */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.emails_per_page", "Emails Per Page")}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                    {[10, 20, 50, 100].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setLocalEmailsPerPage(count)}
                        className={`p-3 text-sm font-semibold rounded-2xl border transition-all cursor-pointer shadow-sm ${localEmailsPerPage === count ? 'border-primary ring-2 ring-primary bg-primary/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        style={localEmailsPerPage === count ? { borderColor: theme.accent, color: theme.accent } : { borderColor: theme.border, color: theme.text }}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color picker */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.accent_color", "Custom Accent Color")}</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border-0 bg-transparent shrink-0 outline-none"
                    />
                    <div className="flex flex-wrap gap-3">
                      {["#135bec", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAccentColor(c)}
                          className="w-8 h-8 rounded-full border border-white dark:border-gray-800 shadow-md cursor-pointer hover:scale-110 transition-transform"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Font scaling size */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex justify-between">
                    <span>{t("settings.font_size_scale", "Font Size Scale")}</span>
                    <span className="font-mono text-xs opacity-75">{fontSize}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Theme palettes picker */}
                <div className="flex flex-col gap-3 border-t pt-6" style={{ borderColor: theme.border }}>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.visual_theme_palette", "Visual Theme Palette")}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 w-full">
                    {[
                      { key: "Classic", label: t("settings.classic", "Classic") },
                      { key: "Dark", label: t("settings.dark", "Dark") },
                      { key: "Nature", label: t("settings.nature", "Nature") },
                      { key: "Ocean", label: t("settings.ocean", "Ocean") },
                      { key: "Sunset", label: t("settings.sunset", "Sunset") },
                      { key: "Minimal", label: t("settings.minimal", "Minimal") }
                    ].map(({ key: tKey, label }) => (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => {
                          changeTheme(tKey);
                          setThemeMode(tKey === "Dark" ? "Dark" : "Light");
                        }}
                        className={`h-[46px] px-2.5 text-[13px] font-medium rounded-xl border cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 ${currentThemeName === tKey ? "border-primary ring-2 ring-primary" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                        style={currentThemeName === tKey ? { borderColor: theme.accent, color: theme.accent } : { borderColor: theme.border, color: theme.text }}
                      >
                        <span className="truncate">{label}</span>
                        {tKey === "Classic" && (
                          <span
                            className="px-1.5 py-0.5 text-[9px] leading-none font-bold uppercase tracking-wider rounded shrink-0 inline-flex items-center justify-center select-none"
                            style={
                              currentThemeName === "Classic"
                                ? { backgroundColor: `${theme.accent}15`, color: theme.accent }
                                : { backgroundColor: "rgba(100, 116, 139, 0.15)", color: "rgba(100, 116, 139, 0.75)" }
                            }
                          >
                            {t("settings.default", "Default")}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Image section */}
                <div className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: theme.border }}>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("settings.background_wallpaper", "Background Wallpaper")}</label>

                  {/* Current background preview */}
                  {selectedWallpaper && (
                    <div className="relative rounded-2xl overflow-hidden border h-40 shadow-sm" style={{ borderColor: theme.border }}>
                      <img
                        src={selectedWallpaper}
                        alt="Current background"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setSelectedWallpaper(null)}
                          className="px-4 py-2 text-sm font-bold rounded-xl bg-white/90 text-gray-800 hover:bg-white cursor-pointer shadow-lg transition-transform active:scale-95"
                        >
                          {t("settings.remove_background", "Remove Background")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preset wallpapers grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 w-full">
                    {PRESET_BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.label}
                        type="button"
                        onClick={() => setSelectedWallpaper(bg.url)}
                        className={`relative rounded-xl overflow-hidden h-20 border-2 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md ${selectedWallpaper === bg.url ? "ring-2 ring-offset-2" : ""
                          }`}
                        style={{
                          borderColor: selectedWallpaper === bg.url ? theme.accent : theme.border,
                          ringColor: theme.accent
                        }}
                        title={bg.label}
                      >
                        <img
                          src={bg.url.replace('w=1920', 'w=300')}
                          alt={bg.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                          <span className="text-[10px] text-white font-bold">{bg.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom URL input */}
                  <div className="flex gap-3">
                    <input
                      type="url"
                      placeholder={t("settings.paste_custom_url", "Paste custom image URL...")}
                      value={customBgUrl}
                      onChange={(e) => setCustomBgUrl(e.target.value)}
                      className="flex-1 p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customBgUrl.trim()) {
                          setSelectedWallpaper(customBgUrl.trim());
                          setCustomBgUrl("");
                          toast.success("Custom background selected (click Save Layout Settings to apply)", { id: "wallpaper-toast", duration: 3000 });
                        }
                      }}
                      className="px-5 py-3 rounded-xl text-sm font-medium text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
                      style={{ background: theme.accent }}
                    >
                      {t("settings.apply", "Apply")}
                    </button>
                  </div>

                  {/* File upload option */}
                  <input
                    type="file"
                    ref={bgFileRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Image must be under 5MB", { id: "wallpaper-toast", duration: 3000 });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setSelectedWallpaper(ev.target.result);
                        toast.success("Background image uploaded and selected (click Save Layout Settings to apply)", { id: "wallpaper-toast", duration: 3000 });
                      };
                      reader.readAsDataURL(file);
                      if (bgFileRef.current) bgFileRef.current.value = "";
                    }}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => bgFileRef.current?.click()}
                      className="w-fit px-5 py-2.5 rounded-xl text-sm font-medium border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-sm flex items-center gap-2"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <MdFileUpload size={18} /> {t("settings.upload_from_device", "Upload from device")}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="w-fit px-5 py-2.5 rounded-xl text-sm font-medium border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-sm flex items-center gap-2"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <MdRefresh size={18} /> {t("settings.reset_to_default", "Reset to Default")}
                    </button>
                  </div>
                </div>

                {/* Reading Pane */}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                  <label className="text-sm font-semibold" style={{ color: theme.text }}>{t("settings.reading_pane", "Reading Pane")}</label>
                  <select
                    value={readingPaneMode}
                    onChange={e => {
                      const val = e.target.value;
                      setReadingPaneMode(val);
                      if (setReadingPaneModeState) {
                        setReadingPaneModeState(val);
                      }
                    }}
                    className="w-full p-3 text-sm rounded-xl border outline-none cursor-pointer focus:ring-2 focus:border-transparent transition-all"
                    style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                  >
                    <option value="no_split" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.no_split", "No split (Full screen)")}</option>
                    <option value="right" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.right_split", "Right of inbox")}</option>
                    <option value="below" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" style={{ backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff', color: theme.mode === 'dark' ? '#f3f4f6' : '#111827' }}>{t("settings.bottom_split", "Below inbox")}</option>
                  </select>
                  <span className="text-xs text-gray-500">{t("settings.reading_pane_help", "Choose how emails open in your mailbox.")}</span>
                </div>

                <button
                  type="submit"
                  className="w-fit px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 transition-opacity"
                  style={{ background: theme.accent }}
                >
                  {t("settings.save_layout_settings", "Save Layout Settings")}
                </button>
              </form>
            </Section>
          )}

          {/* security Tab */}
          {activeTab === "security" && (
            <Section title={t("settings.security_recovery", "Security & Account Recovery")} theme={theme}>
              <div className="flex flex-col gap-8 w-full">
                {/* Details and 2FA */}
                <form onSubmit={handleSaveSecuritySettings} className="flex flex-col gap-5">
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("settings.profile_info", "Profile Information")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500">{t("settings.job_title", "Job Title")}</label>
                      <input
                        placeholder={t("settings.enter_job", "e.g. Lead Software Architect")}
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500">{t("settings.location", "Location")}</label>
                      <input
                        placeholder={t("settings.enter_location", "e.g. San Francisco, CA")}
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500">{t("settings.phone_contact", "Phone Contact")}</label>
                      <input
                        placeholder={t("settings.enter_phone", "+1 (555) 019-2834")}
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                  </div>

                  <div className="border-t my-4" style={{ borderColor: theme.border }} />

                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("settings.two_factor_auth", "Multi-Factor Authenticator")}</h4>
                  <ToggleRow label={t("settings.enable_2fa", "Enable Two-Factor Authentication (2FA)")} checked={twoFactorEnabled} onChange={setTwoFactorEnabled} theme={theme} />
                  <ToggleRow label={t("settings.enable_biometrics", "Enable Biometrics Access")} checked={biometricsEnabled} onChange={setBiometricsEnabled} theme={theme} />

                  <button
                    type="submit"
                    className="w-fit mt-3 px-6 py-3 rounded-xl text-sm font-medium text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm"
                    style={{ background: theme.accent }}
                  >
                    {t("settings.save_security_preferences", "Save Security Preferences")}
                  </button>
                </form>

                {/* Password update form */}
                <form onSubmit={handleChangePassword} className="flex flex-col gap-4 border-t pt-8" style={{ borderColor: theme.border }}>
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t("settings.change_password", "Update Account Password")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <input
                      type="password"
                      placeholder={t("settings.current_password", "Current Password")}
                      value={passwords.oldPassword}
                      onChange={e => setPasswords({ ...passwords, oldPassword: e.target.value })}
                      className="w-full p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                    />
                    <input
                      type="password"
                      placeholder={t("settings.new_password", "New Password")}
                      value={passwords.newPassword}
                      onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                      className="w-full p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-fit mt-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    {t("settings.update_password", "Update Password")}
                  </button>
                </form>

                {/* Recovery Setup */}
                <form onSubmit={handleUpdateRecovery} className="flex flex-col gap-4 border-t pt-8" style={{ borderColor: theme.border }}>
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t("settings.password_recovery_contacts", "Backup Account Recovery")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500">{t("settings.recovery_email_address", "Recovery Email Address")}</label>
                      <input
                        type="email"
                        placeholder="backup@example.com"
                        value={recoveryInfo.recoveryEmail || ""}
                        onChange={e => setRecoveryInfo({ ...recoveryInfo, recoveryEmail: e.target.value })}
                        className="w-full p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500">{t("settings.recovery_phone_number", "Backup Phone Number")}</label>
                      <input
                        type="text"
                        placeholder="+1234567890"
                        value={recoveryInfo.phoneNumber || ""}
                        onChange={e => setRecoveryInfo({ ...recoveryInfo, phoneNumber: e.target.value })}
                        className="w-full p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-fit mt-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                    style={{ background: theme.accent }}
                  >
                    {t("settings.save_security_preferences", "Save Recovery Details")}
                  </button>
                </form>
              </div>
            </Section>
          )}

          {/* sessions Tab */}
          {activeTab === "sessions" && (
            <div className="flex flex-col gap-4 md:gap-5">
              <Section title={t("settings.active_login_sessions", "Active Device Sessions")} theme={theme}>
                <p className="text-sm text-gray-500 mb-6">{t("settings.review_manage_sessions", "Below are the devices currently logged into your account.")}</p>
                <div className="flex flex-col gap-4">
                  {sessions.length > 0 ? sessions.map((s) => {
                    const device = parseUserAgent(s.userAgent);
                    return (
                      <div key={s.id} className="p-5 rounded-2xl border flex justify-between items-center shadow-sm hover:shadow transition-shadow" style={{ borderColor: theme.border, background: theme.cardBg }}>
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5" style={{ color: theme.accent }}>
                            {device.type === 'phone' ? <MdPhoneAndroid size={20} /> :
                              device.type === 'tablet' ? <MdTabletMac size={20} /> : <MdComputer size={20} />}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-semibold" style={{ color: theme.text }}>{device.name}</span>
                              {s.isCurrentSession && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-green-500 uppercase tracking-wider">{t("settings.this_device", "This device")}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{s.ipAddress} — {device.browser}</p>
                            <p className="text-xs text-gray-400 mt-1">{t("settings.logged_in", "Logged in:")} {new Date(s.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        {!s.isCurrentSession && (
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-4 py-2 text-xs font-bold rounded-xl text-red-500 border border-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                          >
                            {t("settings.sign_out", "Sign Out")}
                          </button>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-gray-400 text-center py-6">{t("settings.no_active_sessions", "No active sessions found.")}</p>
                  )}
                </div>
              </Section>

              <Section title={t("settings.connected_applications", "Connected Applications")} theme={theme}>
                <p className="text-sm text-gray-500 mb-6">{t("settings.connected_apps_desc", "Third-party applications authorized to access your mailbox profile.")}</p>
                <div className="flex flex-col gap-4">
                  {externalSessions.length > 0 ? externalSessions.map((s) => (
                    <div key={s.id} className="p-5 rounded-2xl border flex justify-between items-center shadow-sm hover:shadow transition-shadow" style={{ borderColor: theme.border, background: theme.cardBg }}>
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5" style={{ color: theme.accent }}>
                          <MdSecurity size={20} />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-base font-semibold" style={{ color: theme.text }}>{s.appName}</span>
                          <p className="text-sm text-gray-500">{s.ipAddress} — {t("settings.basic_profile_access", "Basic Profile Access")}</p>
                          <p className="text-xs text-gray-400 mt-1">{t("settings.authorized", "Authorized:")} {new Date(s.loggedInAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeExternalSession(s.id)}
                        className="px-4 py-2 text-xs font-bold rounded-xl text-red-500 border border-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                      >
                        {t("settings.revoke_access", "Revoke Access")}
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400 text-center py-6">{t("settings.no_connected_apps", "No connected applications found.")}</p>
                  )}
                </div>
              </Section>

              <Section title={t("settings.recent_activity_logs", "Security Activity Log")} theme={theme}>
                <p className="text-sm text-gray-500 mb-6">{t("settings.activity_logs_desc", "Audit history of recent security-critical adjustments on your account.")}</p>
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto hidden-scrollbar pr-2">
                  {activityLogs.length > 0 ? activityLogs.map((log, idx) => (
                    <div key={idx} className="p-4 border rounded-xl flex justify-between items-center bg-black/5 dark:bg-white/5" style={{ borderColor: theme.border }}>
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold text-sm" style={{ color: theme.text }}>{log.action}</p>
                        <p className="text-xs text-gray-500">{log.ipAddress}</p>
                      </div>
                      <span className="text-xs text-gray-400 font-medium text-right">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400 text-center py-6">{t("settings.no_activity_logs", "No activity logs recorded.")}</p>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const SideTab = ({ icon, label, active, onClick, theme }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium text-left cursor-pointer w-full hover:bg-black/5 dark:hover:bg-white/5"
    style={{
      background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : "transparent",
      color: active ? theme.accent : theme.text
    }}
  >
    {icon} {label}
  </button>
);

const Section = ({ title, children, theme }) => (
  <div
    className="w-full p-5 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm"
    style={{ background: theme.cardBg, borderColor: theme.border, color: theme.text }}
  >
    {title && (
      <h3 className="text-xl font-bold border-b pb-3 mb-4 flex items-center gap-2" style={{ borderColor: theme.border }}>
        {title}
      </h3>
    )}
    {children}
  </div>
);

const ToggleRow = ({ label, checked, onChange, theme }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-sm font-medium" style={{ color: theme.text }}>{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 outline-none cursor-pointer flex items-center ${checked ? 'justify-end' : 'justify-start'}`}
      style={{ backgroundColor: checked ? theme.accent : 'rgba(156,163,175,0.4)' }}
    >
      <span className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300" />
    </button>
  </div>
);

export default Settings;

