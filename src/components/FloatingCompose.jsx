import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { 
  MdSend, 
  MdAttachFile, 
  MdDeleteOutline, 
  MdClose, 
  MdAssignment, 
  MdRemove, 
  MdOpenInFull, 
  MdCloseFullscreen,
  MdEditDocument,
  MdReply,
  MdArrowDropDown,
  MdFileDownload,
  MdRemoveRedEye,
  MdArrowBack,
  MdPersonOutline,
  MdInsertDriveFile,
  MdImage
} from "react-icons/md";
import { 
  saveDraftAttachments, 
  getDraftAttachments, 
  removeDraftAttachmentFromStorage, 
  clearDraftAttachments, 
  formatFileSize, 
  isImageFile, 
  linkDraftUid, 
  storeInMemoryFile, 
  getInMemoryFile 
} from "../utils/draftAttachmentStorage";
import { mailAPI, api, userAPI, signatureAPI, casboxAPI, settingsAPI } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useNotificationPreferences } from "../context/NotificationPreferenceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { DEFAULT_TEMPLATES } from "../pages/Templates";
import toast from "react-hot-toast";
import RecipientAutocomplete from "./RecipientAutocomplete";
import {
  getStoredContacts,
  fetchAndSyncContacts,
  filterRecipientSuggestions,
  applyRecipientSuggestion,
  recordSentRecipient,
  parseRecipientChips,
  formatRecipientChips
} from "../utils/recipientSuggestions";

const CASBOX_RECIPIENT_ERROR = "This recipient is not a BNXmail user. You can send messages only to registered BNXmail accounts through Casbox.";

const EXTERNAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "zoho.com",
  "zohomail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "aim.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
]);

const isExternalEmailDomain = (email) => {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  const atIdx = clean.lastIndexOf("@");
  if (atIdx === -1 || atIdx === clean.length - 1) return false;
  const domain = clean.substring(atIdx + 1);
  if (EXTERNAL_EMAIL_DOMAINS.has(domain)) return true;
  const externalBases = [
    "gmail.", "googlemail.", "yahoo.", "ymail.", "outlook.", "hotmail.",
    "zoho.", "icloud.", "aol.", "protonmail.", "proton."
  ];
  return externalBases.some(base => domain.startsWith(base) || domain === base.slice(0, -1));
};

const extractFormattedPlainText = (content) => {
  if (!content) return "";
  let text = String(content).trim();
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      text = doc.documentElement.textContent || text;
    } catch (e) {}
  }
  return text
    .split("\n")
    .map(line => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join("\n")
    .trim();
};
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from 'quill-image-resize-module-react';
import FontSizeDropdown from "./FontSizeDropdown";
import { attachQuillAutoCorrect, handleStandardInputAutoCorrect } from "../utils/autoCorrect";
import { extractPlainTextFromHtml } from "../utils/htmlUtils";
import { attachLinkValidation } from "../utils/quillPatch";
import { validateAndNormalizeUrl } from "../utils/urlValidator";

// For quill-image-resize-module-react
window.Quill = Quill;

// Register Font & Size attributors in Quill
const Font = Quill.import('attributors/style/font');
Font.whitelist = [
  'Arial', 'arial',
  'Roboto', 'roboto',
  'Lato', 'lato',
  'Montserrat', 'montserrat',
  'Inter', 'inter',
  'Playfair Display', 'playfair-display',
  'Courier New', 'courier-new',
  'Georgia', 'georgia',
  'Times New Roman', 'times-new-roman',
  'Calibri', 'calibri',
  'Verdana', 'verdana',
  'Tahoma', 'tahoma',
  'Trebuchet MS', 'trebuchet-ms',
  'Comic Sans MS', 'comic-sans',
  'sans-serif', 'serif', 'monospace'
];
Quill.register(Font, true);

const Size = Quill.import('attributors/style/size');
Size.whitelist = [
  'small', 'normal', 'large', 'big', 'huge',
  '10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'
];
Quill.register(Size, true);

if (!Quill.imports['modules/imageResize']) {
  Quill.register('modules/imageResize', ImageResize, true);
}

const getMimeType = (fileName) => {
  if (!fileName || typeof fileName !== "string") return "application/octet-stream";
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'txt': return 'text/plain';
    case 'html': return 'text/html';
    default: return 'application/octet-stream';
  }
};

const handleQuillLink = function(value) {
  if (value) {
    const range = this.quill.getSelection(true);
    if (!range) return;
    let preview = '';
    if (range.length > 0) {
      const format = this.quill.getFormat(range);
      if (format.link) {
        preview = typeof format.link === 'string' ? format.link : '';
      } else {
        const text = this.quill.getText(range);
        if (/^\S+@\S+\.\S+$/.test(text) && !text.startsWith('mailto:')) {
          preview = 'mailto:' + text;
        } else {
          const valRes = validateAndNormalizeUrl(text);
          if (valRes.isValid) {
            preview = valRes.normalizedUrl;
          }
        }
      }
    }
    const { tooltip } = this.quill.theme;
    if (tooltip) {
      attachLinkValidation(tooltip);
      tooltip.edit('link', preview);
    }
    requestAnimationFrame(() => {
      if (tooltip && tooltip.root) {
        const container = tooltip.quill.root.parentElement;
        const containerRect = container ? container.getBoundingClientRect() : null;
        const bounds = tooltip.quill.getBounds(range);

        let top = (bounds ? bounds.bottom : 0) + 8;
        let left = 12;
        if (bounds) {
          left = Math.max(12, bounds.left);
          if (containerRect && left + tooltip.root.offsetWidth > containerRect.width - 12) {
            left = Math.max(12, containerRect.width - tooltip.root.offsetWidth - 12);
          }
          if (containerRect && top + tooltip.root.offsetHeight > containerRect.height - 8) {
            top = Math.max(8, (bounds ? bounds.top : 0) - tooltip.root.offsetHeight - 8);
          }
        }
        tooltip.root.style.left = `${left}px`;
        tooltip.root.style.top = `${top}px`;
      }
    });
  } else {
    this.quill.format('link', false);
  }
};

const quillModules = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link'],
      ['clean']
    ],
    handlers: {
      link: handleQuillLink
    }
  },
  imageResize: {
    parchment: Quill.import('parchment'),
    modules: ['Resize', 'DisplaySize', 'Toolbar']
  }
};


// Helper CSS mappers for Default Text Style
const getFontFamilyCss = (font) => {
  if (!font) return 'Arial, sans-serif';
  const trimmed = font.trim();
  switch (trimmed) {
    case 'Arial': return 'Arial, sans-serif';
    case 'Calibri': return 'Calibri, sans-serif';
    case 'Times New Roman': return "'Times New Roman', Times, serif";
    case 'Georgia': return 'Georgia, serif';
    case 'Verdana': return 'Verdana, sans-serif';
    case 'Courier New': return "'Courier New', Courier, monospace";
    case 'Tahoma': return 'Tahoma, sans-serif';
    case 'Trebuchet MS': return "'Trebuchet MS', sans-serif";
    case 'Roboto': return 'Roboto, sans-serif';
    default: return `'${trimmed}', sans-serif`;
  }
};

const getFontSizeCss = (size) => {
  if (!size) return '16px';
  const trimmed = size.trim();
  switch (trimmed) {
    case 'Small': return '14px';
    case 'Normal': return '16px';
    case 'Large': return '18px';
    case 'Extra Large':
    case 'Huge': return '24px';
    default: return '16px';
  }
};

const getTextColorCss = (color) => color || '#000000';

const ComposeWindow = ({
  windowId,
  order = 0,
  initialData = null,
  onClose,
  onFocusWindow,
  isActive = false,
  zIndex = 2000,
  minimizedIndex = 0,
}) => {
  useEffect(() => {
    const handleTextStyleChanged = (e) => {
      if (e.detail) {
        if (e.detail.fontFamily) setDefaultFontFamily(e.detail.fontFamily);
        if (e.detail.fontSize) setDefaultFontSize(e.detail.fontSize);
        if (e.detail.textColor) setDefaultTextColor(e.detail.textColor);
      }
    };
    window.addEventListener('bnx_text_style_changed', handleTextStyleChanged);
    return () => window.removeEventListener('bnx_text_style_changed', handleTextStyleChanged);
  }, []);

  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { 
    fetchEmails,
    fetchEmailsSilently,
    invalidateCache,
    handleEmailSent,
    currentFolder,
    openCompose,
    updateDraftInState,
    updateDraftUidInState,
    isEmailStarred
  } = useMail();

  const { sentNotifications } = useNotificationPreferences();
  const composeData = initialData;
  const closeCompose = onClose;
  const isComposeOpen = true;
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const containerRef = useRef(null);
  const wasDraftStarredRef = useRef(false);
  const isReply = Boolean(composeData?.replyTo) && composeData?.mode !== 'casbox' && composeData?.mode !== 'chat';
  const fileInputRef = useRef(null);

  const [composeMode, setComposeMode] = useState("mail"); // "chat" or "mail"
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState("");

  const [showTemplates, setShowTemplates] = useState(false);
  const [allTemplates, setAllTemplates] = useState([]);

  const [formData, setFormData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  // Sync mode if opened with data or if currently on chat page
  useEffect(() => {
      if (composeData?.mode) {
          setComposeMode(composeData.mode === "casbox" || composeData.mode === "chat" ? "chat" : "mail");
      } else if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/colab') || window.location.pathname.startsWith('/chat') || window.location.pathname.startsWith('/casbox'))) {
          setComposeMode("chat");
      } else {
          setComposeMode("mail");
      }
  }, [composeData, isComposeOpen]);

  // When switching to Mail session, remove Casbox-only recipient restriction
  useEffect(() => {
    if ((composeMode === "mail" || composeMode === "email") && error && (error.includes("BNXmail") || error.includes("Casbox"))) {
      setError("");
    }
  }, [composeMode, error]);

  const handleSwitchMode = (mode) => {
    setComposeMode(mode);
    if ((mode === "mail" || mode === "email") && error && (error.includes("BNXmail") || error.includes("Casbox") || error.includes("recipient"))) {
      setError("");
    }
  };

  const [signatures, setSignatures] = useState([]);
  const [showSignaturesMenu, setShowSignaturesMenu] = useState(false);
  const [undoSendDelay, setUndoSendDelay] = useState(0);
  const [defaultFontFamily, setDefaultFontFamily] = useState(() => localStorage.getItem("bnx_setting_fontFamily") || "Arial");
  const [defaultFontSize, setDefaultFontSize] = useState(() => localStorage.getItem("bnx_setting_fontSizeText") || "Normal");
  const [defaultTextColor, setDefaultTextColor] = useState(() => localStorage.getItem("bnx_setting_textColor") || "#000000");

  const [spellingCheck, setSpellingCheck] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_spellingCheck");
    return saved !== null ? saved === "true" : true;
  });
  const [grammarCheck, setGrammarCheck] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_grammarCheck");
    return saved !== null ? saved === "true" : true;
  });
  const [autoCorrect, setAutoCorrect] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_autoCorrect");
    return saved !== null ? saved === "true" : true;
  });

  const signatureInjectedRef = useRef(false);
  const quillRef = useRef(null);
  const focusedFieldRef = useRef(null);

  // Recipient autocomplete & chips state
  const [contacts, setContacts] = useState(() => getStoredContacts(user?.email));
  const [toInputValue, setToInputValue] = useState("");
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [toHighlightedIndex, setToHighlightedIndex] = useState(0);
  const toDropdownRef = useRef(null);
  const toInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Recipient chips parsed from formData.to
  const recipientChips = useMemo(() => {
    return parseRecipientChips(formData.to || "");
  }, [formData.to]);

  useEffect(() => {
    if (user?.email) {
      fetchAndSyncContacts(user.email, mailAPI).then((synced) => {
        if (synced && synced.length > 0) {
          setContacts(synced);
        }
      });
    }
  }, [user?.email]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        toDropdownRef.current &&
        !toDropdownRef.current.contains(e.target) &&
        toInputRef.current &&
        !toInputRef.current.contains(e.target)
      ) {
        setShowToSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRemoveRecipientChip = (indexToRemove) => {
    const updated = recipientChips.filter((_, idx) => idx !== indexToRemove);
    setFormData((prev) => ({ ...prev, to: updated.join(", ") }));
    if (toInputRef.current) {
      toInputRef.current.focus();
    }
  };

  const handleAddRecipientChip = (emailToAdd) => {
    if (!emailToAdd) return;
    const clean = emailToAdd.trim();
    if (!clean) return;
    const isCasbox = composeMode === "chat" || composeMode === "casbox";
    if (isCasbox && isExternalEmailDomain(clean)) {
      setError(CASBOX_RECIPIENT_ERROR);
      toast.error(CASBOX_RECIPIENT_ERROR);
      return;
    }
    const exists = recipientChips.some(c => c.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      const updated = [...recipientChips, clean];
      setFormData((prev) => ({ ...prev, to: updated.join(", ") }));
    }
    setToInputValue("");
    setShowToSuggestions(false);
    setToSuggestions([]);
    if (toInputRef.current) {
      toInputRef.current.focus();
    }
  };

  const handleSelectToSuggestion = (suggestion) => {
    if (!suggestion || !suggestion.email) return;
    handleAddRecipientChip(suggestion.email);
  };

  const triggerSuggestionsSearch = (val) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const clean = (val || "").trim();
    if (!clean) {
      setToSuggestions([]);
      setShowToSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    const isCasbox = composeMode === "chat" || composeMode === "casbox";
    const existingSet = new Set(recipientChips.map(c => c.toLowerCase()));

    // Priority 1: Instant local matches from cached contacts
    const { suggestions: localMatches } = filterRecipientSuggestions(contacts, clean, 10, existingSet);
    const filteredLocal = isCasbox ? localMatches.filter(s => !isExternalEmailDomain(s?.email)) : localMatches;
    setToSuggestions(filteredLocal);
    setShowToSuggestions(true);
    setToHighlightedIndex(0);

    // Debounced server search (Priority 1: previous contacts, Fallback: registered BNXmail users)
    setIsLoadingSuggestions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await mailAPI.autocompleteRecipients(clean, 10);
        const serverData = res.data?.data || res.data || [];
        if (Array.isArray(serverData)) {
          const filteredServer = isCasbox ? serverData.filter(s => !isExternalEmailDomain(s?.email)) : serverData;

          const merged = [];
          const seen = new Set(existingSet);

          // Priority 1: matching previous contacts first
          const allPrevious = [
            ...filteredLocal,
            ...filteredServer.filter(s => s.isPreviousContact || s.source === "PREVIOUS_CONTACT")
          ];
          allPrevious.forEach(s => {
            const k = s.email?.toLowerCase();
            if (k && !seen.has(k)) {
              seen.add(k);
              merged.push(s);
            }
          });

          // Fallback: registered BNXmail users from database
          const allFallback = filteredServer.filter(s => !s.isPreviousContact && s.source !== "PREVIOUS_CONTACT");
          allFallback.forEach(s => {
            const k = s.email?.toLowerCase();
            if (k && !seen.has(k)) {
              seen.add(k);
              merged.push(s);
            }
          });

          setToSuggestions(merged);
        }
      } catch (err) {
        // Keep local matches if server query fails
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 250);
  };

  const handleToInputChange = (e) => {
    const val = e.target.value;
    if (val.includes(",") || val.includes(";")) {
      const parts = val.split(/[,;]/);
      const trailing = parts.pop() || "";
      const completeAddrs = parts.map(p => p.trim()).filter(Boolean);
      if (completeAddrs.length > 0) {
        const isCasbox = composeMode === "chat" || composeMode === "casbox";
        const newChips = [...recipientChips];
        completeAddrs.forEach(addr => {
          if (isCasbox && isExternalEmailDomain(addr)) {
            setError(CASBOX_RECIPIENT_ERROR);
            toast.error(CASBOX_RECIPIENT_ERROR);
            return;
          }
          if (!newChips.some(c => c.toLowerCase() === addr.toLowerCase())) {
            newChips.push(addr);
          }
        });
        setFormData((prev) => ({ ...prev, to: newChips.join(", ") }));
      }
      setToInputValue(trailing);
      triggerSuggestionsSearch(trailing);
      return;
    }

    setToInputValue(val);
    triggerSuggestionsSearch(val);
  };

  const handleToInputFocus = () => {
    focusedFieldRef.current = 'to';
    if (toInputValue.trim().length > 0) {
      triggerSuggestionsSearch(toInputValue);
    }
  };

  const handleToInputBlur = () => {
    if (focusedFieldRef.current === 'to') focusedFieldRef.current = null;
    setTimeout(() => {
      setShowToSuggestions(false);
    }, 200);
  };

  const handleToInputKeyDown = (e) => {
    e.stopPropagation();
    if (showToSuggestions && toSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setToHighlightedIndex((prev) => (prev + 1) % toSuggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setToHighlightedIndex((prev) => (prev - 1 + toSuggestions.length) % toSuggestions.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (toSuggestions[toHighlightedIndex]) {
          handleSelectToSuggestion(toSuggestions[toHighlightedIndex]);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowToSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (toInputValue.trim().length > 0) {
        handleAddRecipientChip(toInputValue.trim());
      }
      return;
    }

    if (e.key === 'Backspace' && toInputValue === '' && recipientChips.length > 0) {
      e.preventDefault();
      handleRemoveRecipientChip(recipientChips.length - 1);
      return;
    }
  };

  const dynamicQuillModules = useMemo(() => ({
    toolbar: {
      container: isReply ? `#reply-quill-toolbar-${windowId}` : `#compose-quill-toolbar-${windowId}`,
      handlers: {
        link: handleQuillLink,
        underline: function() {
          this.quill.focus();
          const range = this.quill.getSelection(true);
          if (!range) return;
          const format = this.quill.getFormat(range);
          this.quill.format('underline', !format.underline, 'user');
        },
        blockquote: function() {
          this.quill.focus();
          const range = this.quill.getSelection(true);
          if (!range) return;
          const format = this.quill.getFormat(range);
          this.quill.format('blockquote', !format.blockquote, 'user');
        }
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), [isReply, windowId]);

  const [draftId, setDraftId] = useState(null);
  const imapDraftUidRef = useRef(null);
  const initialFormDataRef = useRef(null);
  const isSavingDraftRef = useRef(false);
  const originalDraftSnapshotRef = useRef(null);
  const isEditingExistingDraftRef = useRef(false);
  const selectedDraftIdRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [customScheduleDateTime, setCustomScheduleDateTime] = useState("");

  const closePreview = () => {
    setPreviewFile((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      setPreviewFile((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    };
  }, []);

  useEffect(() => {
    if (!isComposeOpen) {
      closePreview();
    }
  }, [isComposeOpen]);

  const handlePreviewAttachment = async (fileItem) => {
    try {
      const fileName = typeof fileItem === 'string' ? fileItem : (fileItem.fileName || fileItem.name);
      toast.loading(`Loading preview...`, { id: "preview-attachment" });
      const mime = getMimeType(fileName);

      let url = "";
      let textContent = "";
      const rawBlob = (fileItem?.rawFile instanceof Blob) ? fileItem.rawFile : getInMemoryFile(fileName);

      if (rawBlob instanceof Blob) {
        url = window.URL.createObjectURL(rawBlob);
        if (mime === "text/plain") {
          textContent = await rawBlob.text();
        }
      } else {
        const filePath = fileItem?.filePath || fileItem?.url;
        const draftUid = imapDraftUidRef.current || composeData?.draft?.uid;

        if (filePath) {
          try {
            const fetchPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const res = await api.get(fetchPath, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: mime || res.headers?.['content-type'] });
            url = window.URL.createObjectURL(blob);
            if (mime === "text/plain") {
              textContent = await blob.text();
            }
          } catch (e) {
            console.warn("Could not fetch file by path, falling back:", e);
          }
        }

        if (!url && draftUid) {
          try {
            const res = await mailAPI.downloadAttachment(draftUid, fileName, "Drafts");
            const blob = new Blob([res.data], { type: mime });
            url = window.URL.createObjectURL(blob);
            if (mime === "text/plain") {
              const reader = new FileReader();
              textContent = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
                reader.readAsText(blob);
              });
            }
          } catch (e) {
            console.warn("Could not download attachment from IMAP draft:", e);
          }
        }

        if (!url && fileItem?.thumbnailPath) {
          try {
            const thumbPath = fileItem.thumbnailPath.startsWith('/') ? fileItem.thumbnailPath : `/${fileItem.thumbnailPath}`;
            const res = await api.get(thumbPath, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'image/jpeg' });
            url = window.URL.createObjectURL(blob);
          } catch (e) {}
        }

        if (!url) {
          setPreviewFile({
            fileName,
            blobUrl: "",
            mimeType: mime,
            textContent: "",
            unavailable: true
          });
          toast.dismiss("preview-attachment");
          return;
        }
      }

      setPreviewFile({
        fileName,
        blobUrl: url,
        mimeType: mime,
        textContent,
        rawFile: rawBlob
      });
      toast.success("Loaded preview", { id: "preview-attachment" });
      } catch (err) {
      console.error("Failed to preview attachment:", err);
      toast.error("Failed to preview attachment", { id: "preview-attachment" });
    }
  };

  const handleDownloadAttachment = async (fileName) => {
    try {
      if (previewFile?.rawFile instanceof Blob && previewFile.fileName === fileName) {
        const link = document.createElement("a");
        link.href = previewFile.blobUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      const draftUid = imapDraftUidRef.current || composeData?.draft?.uid;
      if (draftUid) {
        toast.loading(`Downloading ${fileName}...`, { id: "download-attachment" });
        const res = await mailAPI.downloadAttachment(draftUid, fileName, "Drafts");
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`${fileName} downloaded successfully`, { id: "download-attachment" });
      } else if (previewFile?.blobUrl) {
        const link = document.createElement("a");
        link.href = previewFile.blobUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error("Failed to download attachment:", err);
      toast.error("Failed to download attachment", { id: "download-attachment" });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getOriginalEmailContentHTML = (email) => {
    if (!email) return "<div class=\"original-unavailable\">Original message unavailable</div>";

    const fromVal = email.from || "";
    const toVal = email.to || "";
    const dateVal = email.sentDate ? formatDate(email.sentDate) : (email.receivedDate ? formatDate(email.receivedDate) : (email.date ? formatDate(email.date) : ""));
    const subjectVal = email.subject || "";

    let bodyContent = "";
    // Detect if content is HTML
    const isHtml = email.htmlBody || (email.isHtml && email.body) || (email.body && (
      email.body.trim().startsWith('<!DOCTYPE html') ||
      email.body.trim().startsWith('<html') ||
      email.body.includes('</html>') ||
      email.body.includes('</p>') ||
      email.body.includes('</div>') ||
      email.body.includes('</td>')
    ));

    if (isHtml) {
      bodyContent = email.htmlBody || email.body;
    } else {
      const rawText = email.body || email.textPlain || "";
      if (rawText) {
        bodyContent = `<div style="white-space: pre-wrap;">${rawText}</div>`;
      } else {
        bodyContent = "<div class=\"original-unavailable\">Original message unavailable</div>";
      }
    }

    const escapedFrom = fromVal.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escapedTo = toVal.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `
      <br/><br/>
      <div class="gmail_quote" contenteditable="false" style="margin-top: 15px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
        <div style="font-family: Arial, sans-serif; font-size: 12px; color: #5f6368; margin-bottom: 15px;">
          ---------- Forwarded message ----------<br/>
          <b>From:</b> ${escapedFrom}<br/>
          <b>To:</b> ${escapedTo}<br/>
          <b>Date:</b> ${dateVal}<br/>
          <b>Subject:</b> ${subjectVal}<br/>
        </div>
        <div style="font-family: inherit; font-size: inherit; color: inherit;">
          ${bodyContent}
        </div>
      </div>
    `;
  };

  const getFinalBody = (bodyVal) => {
    if (isReply && quotedMessage) {
      const cleanUserBody = bodyVal || "";
      const escapedQuote = quotedMessage
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      const originalQuoteHtml = `
        <br/><br/>
        <div class="bnx_original_quote" style="color: #555555; border-left: 3px solid #0052cc; padding-left: 12px; margin-top: 16px; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 6px; color: #777777;">--- Original Message ---</div>
          <div style="white-space: pre-wrap;">${escapedQuote}</div>
        </div>
      `;
      return `${cleanUserBody}${originalQuoteHtml}`;
    }
    return bodyVal;
  };

  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));

  const calculateDefaultSizeAndPos = useCallback(() => {
    if (typeof window === "undefined") {
      return { size: { width: 520, height: 480 }, position: { x: 100, y: 100 } };
    }
    const mobile = window.innerWidth < 768;
    const defaultW = isReply ? Math.min(580, window.innerWidth - 40) : Math.min(520, window.innerWidth - 40);
    const defaultH = isReply ? Math.min(620, window.innerHeight - 60) : Math.min(480, window.innerHeight - 60);

    if (mobile) {
      return {
        size: { width: window.innerWidth, height: window.innerHeight },
        position: { x: 0, y: 0 }
      };
    }

    // Always position on the right side of the screen
    // If multiple windows are open simultaneously, cascade slightly inward from the right
    const cascadeIndex = typeof order === "number" ? (order % 5) : 0;
    const xOffset = cascadeIndex * 24;
    const yOffset = cascadeIndex * 24;

    const baseX = window.innerWidth - defaultW - 24;
    const initX = Math.max(10, baseX - xOffset);

    const baseY = window.innerHeight - defaultH - 20;
    const initY = Math.max(10, baseY - yOffset);

    return {
      size: { width: defaultW, height: defaultH },
      position: { x: initX, y: initY }
    };
  }, [isReply, order]);

  const [size, setSize] = useState(() => calculateDefaultSizeAndPos().size);
  const [position, setPosition] = useState(() => calculateDefaultSizeAndPos().position);
  const lastNormalSizeRef = useRef({ ...calculateDefaultSizeAndPos().size });
  const lastNormalPosRef = useRef({ ...calculateDefaultSizeAndPos().position });

  const handleMinimizeToggle = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    onFocusWindow?.();
    setIsComposeMinimized((prev) => !prev);
  };

  const handleMaximizeToggle = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    onFocusWindow?.();
    if (isComposeMinimized) {
      setIsComposeMinimized(false);
      setIsComposeMaximized(true);
    } else {
      setIsComposeMaximized((prev) => !prev);
    }
  };

  // Listen for window resize to check mobile view and clamp desktop boundaries
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (!mobile) {
        setSize((prevSize) => {
          const w = Math.min(prevSize.width, window.innerWidth - 40);
          const h = Math.min(prevSize.height, window.innerHeight - 60);
          
          setPosition((prevPos) => {
            const maxTargetX = window.innerWidth - w - 20;
            const maxTargetY = window.innerHeight - h - 20;
            return {
              x: Math.max(20, Math.min(prevPos.x, maxTargetX)),
              y: Math.max(20, Math.min(prevPos.y, maxTargetY))
            };
          });
          
          return { width: w, height: h };
        });
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset/sync positioning and size on state toggle or mobile detection
  useEffect(() => {
    if (isMobile) return;

    if (isComposeMinimized) {
      // Minimized state: docked compact header bar at bottom of respective side
      const minW = Math.min(260, window.innerWidth - 40);
      const minH = 45;
      const minX = Math.max(10, window.innerWidth - minW - 20 - (minimizedIndex % 4) * (minW + 10));
      const minY = window.innerHeight - minH;
      setSize({ width: minW, height: minH });
      setPosition({ x: minX, y: minY });
    } else if (isComposeMaximized) {
      // Maximized state: full screen / viewport view
      const maxW = Math.max(350, Math.min(1200, window.innerWidth - 40));
      const maxH = Math.max(400, window.innerHeight - 60);
      setSize({ width: maxW, height: maxH });
      setPosition({
        x: Math.max(10, Math.round((window.innerWidth - maxW) / 2)),
        y: Math.max(10, Math.round((window.innerHeight - maxH) / 2)),
      });
    } else {
      // Normal state: restore user's preferred normal size & position
      const defaultState = calculateDefaultSizeAndPos();
      const savedW = lastNormalSizeRef.current?.width || defaultState.size.width;
      const savedH = lastNormalSizeRef.current?.height || defaultState.size.height;
      const savedX = lastNormalPosRef.current?.x !== undefined ? lastNormalPosRef.current.x : defaultState.position.x;
      const savedY = lastNormalPosRef.current?.y !== undefined ? lastNormalPosRef.current.y : defaultState.position.y;

      const clampedX = Math.max(10, Math.min(savedX, window.innerWidth - savedW - 10));
      const clampedY = Math.max(10, Math.min(savedY, window.innerHeight - savedH - 10));

      setSize({ width: savedW, height: savedH });
      setPosition({ x: clampedX, y: clampedY });
    }
  }, [isComposeMaximized, isComposeMinimized, isMobile, minimizedIndex, calculateDefaultSizeAndPos]);

  // Load Custom + Default templates for inline insertion
  useEffect(() => {
    if (!isComposeOpen) return;
    const saved = localStorage.getItem("bnx_mail_custom_templates");
    let custom = [];
    if (saved) {
      try {
        custom = JSON.parse(saved);
      } catch (e) {}
    }
    setAllTemplates([...DEFAULT_TEMPLATES, ...custom]);
  }, [showTemplates, isComposeOpen]);

  /* ---------------- FETCH SETTINGS FROM BACKEND ---------------- */
  useEffect(() => {
    const handleWritingSettingsChanged = (e) => {
      if (e.detail) {
        if (e.detail.spellingCheck !== undefined) setSpellingCheck(Boolean(e.detail.spellingCheck));
        if (e.detail.grammarCheck !== undefined) setGrammarCheck(Boolean(e.detail.grammarCheck));
        if (e.detail.autoCorrect !== undefined) setAutoCorrect(Boolean(e.detail.autoCorrect));
      }
    };
    window.addEventListener("bnx_writing_settings_changed", handleWritingSettingsChanged);
    return () => window.removeEventListener("bnx_writing_settings_changed", handleWritingSettingsChanged);
  }, []);

  useEffect(() => {
    if (!isComposeOpen) {
      signatureInjectedRef.current = false;
      originalDraftSnapshotRef.current = null;
      isEditingExistingDraftRef.current = false;
      selectedDraftIdRef.current = null;
      imapDraftUidRef.current = null;
      setDraftId(null);
      initialFormDataRef.current = null;
      setQuotedMessage("");
      setShowCc(false);
      setShowBcc(false);
      setFormData({
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });
      return;
    }
    const fetchSettings = async () => {
      try {
        const [settingsRes, sigsRes] = await Promise.all([
          userAPI.getSettings(),
          signatureAPI.getSignatures().catch(() => null)
        ]);

        if (settingsRes.data?.success) {
          const s = settingsRes.data.data;
          setUndoSendDelay(s.undoSendDelay || 0);
          if (s.spellingCheckEnabled !== undefined) {
            setSpellingCheck(Boolean(s.spellingCheckEnabled));
            localStorage.setItem("bnx_setting_spellingCheck", String(Boolean(s.spellingCheckEnabled)));
          }
          if (s.grammarCheckEnabled !== undefined) {
            setGrammarCheck(Boolean(s.grammarCheckEnabled));
            localStorage.setItem("bnx_setting_grammarCheck", String(Boolean(s.grammarCheckEnabled)));
          }
          if (s.autoCorrectEnabled !== undefined) {
            setAutoCorrect(Boolean(s.autoCorrectEnabled));
            localStorage.setItem("bnx_setting_autoCorrect", String(Boolean(s.autoCorrectEnabled)));
          }
        }

        if (sigsRes?.data?.success) {
          const sigs = sigsRes.data.data;
          if (Array.isArray(sigs)) {
            setSignatures(sigs);
          }
        }
      } catch (e) {
        console.error("Failed to load settings for compose", e);
      }
    };
    fetchSettings();
  }, [isComposeOpen]);

  /* ---------------- APPLY WRITING SETTINGS TO QUILL EDITOR ---------------- */
  useEffect(() => {
    if (!isComposeOpen) return;
    let cleanupAutoCorrect = null;
    const applyEditorAttributes = () => {
      try {
        let editorRoot = null;
        let editorInstance = null;
        if (quillRef.current) {
          editorInstance = typeof quillRef.current.getEditor === "function" ? quillRef.current.getEditor() : null;
          editorRoot = editorInstance?.root;
        }
        if (!editorRoot) {
          editorRoot = document.querySelector(".compose-quill .ql-editor");
        }
        if (editorRoot) {
          editorRoot.setAttribute("spellcheck", spellingCheck ? "true" : "false");
          editorRoot.setAttribute("autocorrect", autoCorrect ? "on" : "off");
          editorRoot.setAttribute("autocapitalize", autoCorrect ? "sentences" : "off");
          editorRoot.setAttribute("data-gramm", grammarCheck ? "true" : "false");
          editorRoot.setAttribute("data-enable-grammarly", grammarCheck ? "true" : "false");
        }
        if (editorInstance) {
          cleanupAutoCorrect = attachQuillAutoCorrect(editorInstance, () => autoCorrect);
        }
      } catch (err) {
        console.warn("Could not set quill editor attributes:", err);
      }
    };

    applyEditorAttributes();
    const timer = setTimeout(applyEditorAttributes, 200);
    return () => {
      clearTimeout(timer);
      if (typeof cleanupAutoCorrect === "function") cleanupAutoCorrect();
    };
  }, [spellingCheck, autoCorrect, grammarCheck, isComposeOpen, isReply]);

  /* ---------------- PREFILL ON COMPOSE DATA CHANGE ---------------- */
  useEffect(() => {
    if (isComposeOpen) {
      // Only set initial empty state once when opening fresh compose (do not clear when opening existing draft)
      const isExistingDraft = Boolean(composeData?.draft);
      if (!signatureInjectedRef.current && signatures.length === 0 && !isExistingDraft) {
        setDraftId(null);
        imapDraftUidRef.current = null;
        initialFormDataRef.current = null;
        setAttachments([]);
        setUploading(false);
      }

      if (composeData) {
        if (!signatureInjectedRef.current) {
          if (composeData.replyTo) {
            let extractedQuote = "";
            if (composeData.originalBody) {
              extractedQuote = extractFormattedPlainText(composeData.originalBody);
            } else if (composeData.originalEmail) {
              const orig = composeData.originalEmail;
              extractedQuote = extractFormattedPlainText(orig.body || orig.htmlBody || orig.textPlain || "");
            }
            setQuotedMessage(extractedQuote);

            const isCasboxMode = composeData.mode === "casbox" || composeData.mode === "chat" || composeMode === "chat" || composeMode === "casbox";
            const replySubject = isCasboxMode ? "Re:" : (composeData.subject || "");

            const replyForm = {
              to: composeData.replyTo,
              cc: composeData.cc || "",
              bcc: composeData.bcc || "",
              subject: replySubject,
              body: "",
            };
            setFormData(replyForm);
            initialFormDataRef.current = { ...replyForm };
            if (composeData.cc) setShowCc(true);
            if (composeData.bcc) setShowBcc(true);
          } else if (composeData.forward) {
            setQuotedMessage("");
            const isCasboxMode = composeData.mode === "casbox" || composeData.mode === "chat" || composeMode === "chat" || composeMode === "casbox";
            const forwardSubject = isCasboxMode ? "Fwd:" : (composeData.subject || "");
            const replyForm = {
              to: "",
              cc: "",
              bcc: "",
              subject: forwardSubject,
              body: getOriginalEmailContentHTML(composeData.originalEmail),
            };
            setFormData(replyForm);
            initialFormDataRef.current = { ...replyForm };
          } else if (composeData.draft) {
            const d = composeData.draft;
            isEditingExistingDraftRef.current = true;
            const draftUidVal = d.uid !== undefined && d.uid !== null ? String(d.uid) : null;
            const draftIdVal = d.id !== undefined && d.id !== null ? String(d.id) : null;
            selectedDraftIdRef.current = draftUidVal || draftIdVal;
            const isDraftStarred = Boolean(
              d.starred ||
              d.isStarred ||
              (typeof isEmailStarred === 'function' && (
                isEmailStarred(d.uid, 'draft', d) ||
                isEmailStarred(d.id, 'draft', d)
              ))
            );
            wasDraftStarredRef.current = isDraftStarred;
            const loadedBody = (d.htmlBody && d.htmlBody.trim()) ? d.htmlBody : (d.body || d.textPlain || "");
            originalDraftSnapshotRef.current = {
              uid: d.uid,
              id: d.id,
              to: d.to || d.recipientEmail || d.recipient || "",
              cc: d.cc || "",
              bcc: d.bcc || "",
              subject: d.subject || "",
              body: loadedBody,
              starred: isDraftStarred
            };
            imapDraftUidRef.current = draftUidVal;
            if (d.id) setDraftId(d.id);
            const draftForm = {
              to: originalDraftSnapshotRef.current.to,
              cc: originalDraftSnapshotRef.current.cc,
              bcc: originalDraftSnapshotRef.current.bcc,
              subject: originalDraftSnapshotRef.current.subject,
              body: originalDraftSnapshotRef.current.body,
            };
            setFormData(draftForm);
            initialFormDataRef.current = { ...draftForm };
            if (draftForm.cc && draftForm.cc.trim()) setShowCc(true);
            if (draftForm.bcc && draftForm.bcc.trim()) setShowBcc(true);
            const restored = getDraftAttachments(d);
            let loadedAttachments = (restored && restored.length > 0) ? restored : [];

            if (loadedAttachments.length === 0) {
              if (Array.isArray(d.attachments) && d.attachments.length > 0) {
                loadedAttachments = d.attachments.map(att => typeof att === 'string' ? { fileName: att, size: 0 } : att);
              } else if (d.attachmentsJson) {
                try {
                  loadedAttachments = JSON.parse(d.attachmentsJson);
                } catch (e) {}
              }
            }

            if (loadedAttachments.length > 0) {
              setAttachments(loadedAttachments);
            } else {
              // Asynchronously query database drafts in case attachment details exist in DB
              mailAPI.getDbDrafts().then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                  const dbDrafts = res.data.data;
                  const matched = dbDrafts.find((dbd) => {
                    if (d.id && String(dbd.id) === String(d.id)) return true;
                    const subMatch = (dbd.subject || '').trim().toLowerCase() === (d.subject || '').trim().toLowerCase();
                    const toMatch = (dbd.to || '').trim().toLowerCase() === (d.to || '').trim().toLowerCase();
                    return subMatch && toMatch;
                  });
                  if (matched?.attachmentsJson) {
                    try {
                      const parsed = JSON.parse(matched.attachmentsJson);
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        setAttachments(parsed);
                        if (!d.id && matched.id) setDraftId(matched.id);
                        saveDraftAttachments({
                          draftId: matched.id,
                          uid: d.uid,
                          to: d.to,
                          subject: d.subject,
                          attachments: parsed,
                        });
                      }
                    } catch (e) {}
                  }
                }
              }).catch(() => {});
            }
          } else {
            isEditingExistingDraftRef.current = false;
            wasDraftStarredRef.current = false;
            originalDraftSnapshotRef.current = null;
            const isCasboxMode = composeData.mode === "casbox" || composeData.mode === "chat" || composeMode === "chat" || composeMode === "casbox";
            const isCasboxReply = isCasboxMode && (composeData.replyTo || composeData.isReply || (typeof composeData.subject === "string" && composeData.subject.trim().toLowerCase().startsWith("re:")));
            const isCasboxForward = isCasboxMode && (composeData.forward || composeData.isForward || (typeof composeData.subject === "string" && composeData.subject.trim().toLowerCase().startsWith("fwd:")));
            const initialSubject = isCasboxReply ? "Re:" : isCasboxForward ? "Fwd:" : (composeData.subject || "");
            const initialForm = {
              to: composeData.to || "",
              cc: composeData.cc || "",
              bcc: composeData.bcc || "",
              subject: initialSubject,
              body: composeData.body || "",
            };
            setFormData(initialForm);
            initialFormDataRef.current = { ...initialForm };
            if (composeData.cc) setShowCc(true);
            if (composeData.bcc) setShowBcc(true);
          }
          signatureInjectedRef.current = true;
        }
      } else {
        if (!signatureInjectedRef.current) {
          setFormData({
            to: "",
            cc: "",
            bcc: "",
            subject: "",
            body: "",
          });
          signatureInjectedRef.current = true;
        }
        setShowCc(false);
        setShowBcc(false);
      }
      setError("");
      setSuccess("");
    }
  }, [composeData, isComposeOpen, signatures]);

  const handleApplyTemplate = (template) => {
    const confirmApply =
      !formData.subject.trim() && !formData.body.trim()
        ? true
        : window.confirm("Apply template? This will replace your current subject and body.");

    if (confirmApply) {
      setFormData((prev) => ({
        ...prev,
        subject: template.subject,
        body: template.body ? (template.body.includes('<') && template.body.includes('>') ? template.body : template.body.replace(/\n/g, '<br/>')) : '',
      }));
      setShowTemplates(false);
    }
  };

  const handleChange = (e) => {
    e.stopPropagation();
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleBodyChange = useCallback((content) => {
    setFormData((prev) => {
      if (prev.body === content) return prev;
      return { ...prev, body: content };
    });
  }, []);

  /* ---------------- ATTACHMENT UPLOAD HANDLER ---------------- */
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      setError("");
      
      let activeDraftId = draftId;

      // 1. If we don't have a database draftId yet, create one to attach files to
      if (!activeDraftId) {
        const payload = {
          to: formData.to,
          cc: formData.cc,
          bcc: formData.bcc,
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true
        };
        const draftRes = await mailAPI.createDbDraft(payload);
        if (draftRes.data?.success) {
          activeDraftId = draftRes.data.data.id;
          setDraftId(activeDraftId);
        } else {
          throw new Error("Failed to initialize draft session");
        }
      }

      // 2. Upload each file in sequence
      for (const file of files) {
        const fileForm = new FormData();
        fileForm.append("file", file);

        toast.loading(`Uploading ${file.name}...`, { id: "upload-attachment" });
        const uploadRes = await mailAPI.uploadDraftAttachment(activeDraftId, fileForm);
        if (uploadRes.data?.success) {
          const info = uploadRes.data.data;
          const newAtt = {
            ...info,
            fileName: info.fileName || file.name,
            size: typeof info.size === 'number' && info.size > 0 ? info.size : file.size,
            filePath: info.filePath || '',
            thumbnailPath: info.thumbnailPath || '',
            rawFile: file
          };
          storeInMemoryFile(file.name, file);
          setAttachments((prev) => {
            const next = [...prev, newAtt];
            saveDraftAttachments({
              draftId: activeDraftId,
              uid: imapDraftUidRef.current,
              to: formData.to,
              subject: formData.subject,
              attachments: next,
            });
            return next;
          });
          toast.success(`${file.name} uploaded`, { id: "upload-attachment" });
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
    } catch (err) {
      console.error("Attachment upload error:", err);
      setError(err.response?.data?.message || err.message || "Failed to upload attachments");
      toast.error("Upload failed", { id: "upload-attachment" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ---------------- ATTACHMENT REMOVAL HANDLER ---------------- */
  const handleRemoveAttachment = async (fileName) => {
    // 1. Immediately update frontend draft state
    setAttachments((prev) => {
      const next = prev.filter((a) => (a.fileName || a.name) !== fileName);
      saveDraftAttachments({
        draftId,
        uid: imapDraftUidRef.current,
        to: formData.to,
        subject: formData.subject,
        attachments: next,
      });
      return next;
    });

    removeDraftAttachmentFromStorage({
      draftId,
      uid: imapDraftUidRef.current,
      to: formData.to,
      subject: formData.subject,
      fileName,
    });

    if (draftId) {
      try {
        toast.loading(`Removing ${fileName}...`, { id: "remove-attachment" });
        const res = await mailAPI.removeDraftAttachment(draftId, fileName);
        if (res.data?.success) {
          toast.success("Attachment removed", { id: "remove-attachment" });
        }
      } catch (err) {
        console.warn("Failed to remove attachment on server:", err);
      }
    } else {
      toast.success("Attachment removed", { id: "remove-attachment" });
    }
  };

  const handleCasboxRecipientBlur = async () => {
    const raw = (formData.to || "").trim();
    if (!raw || (composeMode !== "chat" && composeMode !== "casbox")) return;
    const emailRegex = /^[A-Za-z0-9+_.-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
    if (raw.includes('@') && !emailRegex.test(raw)) {
      setError("Invalid recipient email address.");
      return;
    }
    if (isExternalEmailDomain(raw)) {
      setError(CASBOX_RECIPIENT_ERROR);
      return;
    }
    try {
      const res = await casboxAPI.validateRecipient(raw);
      if (res?.data && res.data.valid === false) {
        setError(res?.data?.message || CASBOX_RECIPIENT_ERROR);
      }
    } catch (err) {
      if (err?.response?.status === 400 || err?.response?.data?.valid === false) {
        setError(err?.response?.data?.message || CASBOX_RECIPIENT_ERROR);
      }
    }
  };

  /* ---------------- SEND EMAIL ---------------- */
  const handleSend = async (e) => {
    e.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setSuccess("");

    let currentTo = (formData.to || "").trim();
    const allToChips = parseRecipientChips(currentTo);
    if (toInputValue && toInputValue.trim()) {
      const pendingInput = toInputValue.trim();
      if (!allToChips.some(c => c.toLowerCase() === pendingInput.toLowerCase())) {
        allToChips.push(pendingInput);
      }
      setToInputValue("");
    }
    const cleanTo = allToChips.join(", ");
    if (cleanTo && cleanTo !== formData.to) {
      setFormData(prev => ({ ...prev, to: cleanTo }));
    }

    if (!cleanTo) {
      setError("Recipient email is required");
      toast.error("Recipient email is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (composeMode === "chat" || composeMode === "casbox") {
        const rawReceiver = cleanTo;
        if (!rawReceiver) {
           setError("Recipient email is required");
           sendingRef.current = false;
           setSending(false);
           return;
        }

        // Validate email format
        const emailRegex = /^[A-Za-z0-9+_.-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
        if (rawReceiver.includes('@') && !emailRegex.test(rawReceiver)) {
           const malformedMsg = "Invalid recipient email address.";
           setError(malformedMsg);
           toast.error(malformedMsg);
           sendingRef.current = false;
           setSending(false);
           return;
        }

        // Validate that recipient is not an external email domain
        if (isExternalEmailDomain(rawReceiver)) {
           setError(CASBOX_RECIPIENT_ERROR);
           toast.error(CASBOX_RECIPIENT_ERROR);
           sendingRef.current = false;
           setSending(false);
           return;
        }

        if (!formData.body && attachments.length === 0) {
           setError("Message text or attachment is required");
           sendingRef.current = false;
           setSending(false);
           return;
        }

        // Validate recipient existence against backend before sending
        let isInvalidAccount = false;
        let validationErrorMessage = CASBOX_RECIPIENT_ERROR;
        try {
           const checkRes = await casboxAPI.validateRecipient(rawReceiver);
           if (checkRes?.data && checkRes.data.valid === false) {
              isInvalidAccount = true;
              if (checkRes.data.message) {
                 validationErrorMessage = checkRes.data.message;
              }
           }
        } catch (valErr) {
           console.error("Recipient validation failed:", valErr);
           const status = valErr?.response?.status;
           if (status === 400 || valErr?.response?.data?.valid === false) {
              isInvalidAccount = true;
              if (valErr?.response?.data?.message) {
                 validationErrorMessage = valErr.response.data.message;
              }
           }
        }

        if (isInvalidAccount) {
           setError(validationErrorMessage);
           toast.error(validationErrorMessage);
           sendingRef.current = false;
           setSending(false);
           return;
        }

        try {
            // Strip HTML but preserve newlines for casbox/chat
            let rawHtml = formData.body || "";
            // Replace common block elements and breaks with newlines
            rawHtml = rawHtml.replace(/<br\s*[\/]?>/gi, '\n')
                             .replace(/<\/p>/gi, '\n')
                             .replace(/<\/div>/gi, '\n')
                             .replace(/<[^>]+>/g, '');
                             
            // Decode HTML entities
            const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
            const plainText = doc.documentElement.textContent.trim();
            const bodyToSend = plainText || (formData.body ? formData.body.replace(/<[^>]+>/g, '').trim() : "");

            const res = await casboxAPI.sendMessage({
                receiverEmail: rawReceiver,
                subject: formData.subject || "Casbox Message",
                body: bodyToSend,
                attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null
            });
            clearDraftAttachments({
                draftId,
                uid: imapDraftUidRef.current,
                to: cleanTo,
                subject: formData.subject,
            });
            setAttachments([]);
            toast.success("Chat message sent.");
            closeCompose();
            window.dispatchEvent(new CustomEvent('casbox_message_sent', { 
                detail: { receiverEmail: rawReceiver, message: res.data } 
            }));
        } catch(err) {
            const rawMsg = err.response?.data?.message || err.response?.data?.error || "";
            const isBlocked =
              rawMsg === "You cannot send messages to this user." ||
              rawMsg === "You cannot send messages to this user because you have blocked them." ||
              /cannot send messages to this user/i.test(rawMsg) ||
              /blocked/i.test(rawMsg);
            let errMsg;
            if (isBlocked) {
              errMsg = "This user is blocked.";
            } else if (/does not exist|account does not exist|invalid recipient|invalid email|not a BNXmail user|registered BNXmail/i.test(rawMsg)) {
              errMsg = CASBOX_RECIPIENT_ERROR;
            } else {
              errMsg = rawMsg || "Failed to send message";
            }
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
        return;
    }

    const cleanSubject = (formData.subject || "").trim();
    if (!cleanSubject) {
      setError("Subject is required");
      toast.error("Subject is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    // Validate email format for each recipient in To
    const emailRegex = /^[A-Za-z0-9+_.-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
    const invalidRecipient = allToChips.find(addr => {
      const cleanAddr = addr.includes('<') ? (addr.match(/<([^>]+)>/)?.[1] || addr) : addr;
      return !emailRegex.test(cleanAddr.trim());
    });
    if (invalidRecipient) {
      const errTxt = `Invalid recipient email address: "${invalidRecipient}"`;
      setError(errTxt);
      toast.error(errTxt);
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (uploading) {
      setError("Please wait for files to finish uploading");
      toast.error("Please wait for files to finish uploading");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    const delaySeconds = Number(undoSendDelay);

    const isStarredDraft = Boolean(
      wasDraftStarredRef.current ||
      composeData?.draft?.starred ||
      composeData?.draft?.isStarred ||
      (typeof isEmailStarred === 'function' && (
        isEmailStarred(imapDraftUidRef.current, 'draft') ||
        isEmailStarred(selectedDraftIdRef.current, 'draft') ||
        isEmailStarred(composeData?.draft?.uid, 'draft') ||
        isEmailStarred(composeData?.draft?.id, 'draft') ||
        isEmailStarred(draftId, 'draft')
      ))
    );

    const currentImapDraftUid = imapDraftUidRef.current;
    const currentDraftId = draftId;
    const currentDraftUid = composeData?.draft?.uid || composeData?.draft?.id || selectedDraftIdRef.current;
    const rawDraftUid = currentImapDraftUid || currentDraftUid || (currentDraftId ? String(currentDraftId) : null);
    const safeDraftUid = rawDraftUid && !String(rawDraftUid).startsWith('compose-') ? String(rawDraftUid) : null;

    let finalBody = getFinalBody(formData.body);
    if (!finalBody || !finalBody.trim() || finalBody === '<p><br></p>' || finalBody === '<p></p>') {
      finalBody = '<p>&nbsp;</p>';
    }

    const cleanCc = formData.cc ? parseRecipientChips(formData.cc).join(", ") : "";
    const cleanBcc = formData.bcc ? parseRecipientChips(formData.bcc).join(", ") : "";

    const cleanAttachments = (attachments || []).map(att => ({
      fileName: att.fileName || att.name || '',
      filePath: att.filePath || '',
      thumbnailPath: att.thumbnailPath || '',
      size: Number(att.size) || 0
    }));

    const payload = {
      to: cleanTo,
      subject: cleanSubject,
      body: finalBody,
      isHtml: true,
      draftUid: safeDraftUid,
      uid: safeDraftUid,
    };
    if (cleanCc) payload.cc = cleanCc;
    if (cleanBcc) payload.bcc = cleanBcc;
    if (cleanAttachments.length > 0) payload.attachments = cleanAttachments;
    if (isStarredDraft) {
      payload.isStarred = true;
      payload.starred = true;
    }

    const executeSend = async (tid) => {
      try {
        let response;
        if (draftId) {
          try {
            await mailAPI.createDbDraft({
              id: draftId,
              ...payload,
              isHtml: true
            });
            response = await mailAPI.sendDbDraft(draftId);
          } catch (dbDraftErr) {
            console.warn("sendDbDraft failed, falling back to direct send:", dbDraftErr);
            response = await mailAPI.send(payload);
          }
        } else {
          response = await mailAPI.send(payload);
        }

        if (response.data?.success) {
          if (delaySeconds > 0) {
            toast.dismiss(tid);
          } else {
            if (sentNotifications) {
              toast.success("Message sent.", { id: tid, duration: 4000 });
            } else if (tid) {
              toast.dismiss(tid);
            }
            closeCompose();
          }

          recordSentRecipient(user?.email, cleanTo);
          if (cleanCc) recordSentRecipient(user?.email, cleanCc);
          if (cleanBcc) recordSentRecipient(user?.email, cleanBcc);

          clearDraftAttachments({
            draftId: currentDraftId,
            uid: currentImapDraftUid || currentDraftUid,
            to: cleanTo,
            subject: cleanSubject,
          });
          setAttachments([]);
          imapDraftUidRef.current = null;
          setDraftId(null);
          selectedDraftIdRef.current = null;
          isEditingExistingDraftRef.current = false;

          if (handleEmailSent) {
            handleEmailSent({
              draftId: currentDraftId,
              draftUid: currentDraftUid,
              imapDraftUid: currentImapDraftUid,
              sentEmail: response.data?.data,
              wasStarred: isStarredDraft,
              emailData: {
                to: cleanTo,
                cc: cleanCc,
                bcc: cleanBcc,
                subject: cleanSubject,
                body: finalBody,
                attachments: cleanAttachments
              }
            });
          }
        }
      } catch (err) {
        console.error("Draft send error:", err);
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to send email";
        setError(errorMsg);
        toast.error(errorMsg, { id: tid });
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    };

    if (delaySeconds > 0) {
      let isUndone = false;
      
      // Fake instant send by closing compose immediately
      closeCompose();
      
      const toastId = sentNotifications ? toast((t) => (
        <div className="flex items-center justify-between gap-6 w-full min-w-[250px] text-sm text-black">
          <span>Message sent.</span>
          <button
            type="button"
            onClick={() => {
              isUndone = true;
              toast.dismiss(t.id);
            }}
            className="font-bold text-[#fbbc04] hover:text-yellow-300 cursor-pointer"
          >
            Undo
          </button>
        </div>
      ), { 
        duration: delaySeconds * 1000, 
        position: "bottom-left",
        style: {
          background: '#202124',
          color: '#fff',
          borderRadius: '4px',
          padding: '12px 24px',
          boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)'
        }
      }) : null;

      setTimeout(() => {
        if (isUndone) {
          toast.error("Sending cancelled", { id: toastId });
          sendingRef.current = false;
          setSending(false);
          openCompose({
            draft: true,
            id: draftId,
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            subject: payload.subject,
            body: payload.body,
          });
          return;
        }
        executeSend(toastId);
      }, delaySeconds * 1000);
    } else {
      const toastId = sentNotifications ? toast.loading("Sending email...", { position: "bottom-center" }) : null;
      executeSend(toastId);
    }
  };

  /* ---------------- SCHEDULE EMAIL ---------------- */
  const handleScheduleSend = async (sendAtIso) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setSuccess("");

    // If user typed in recipient input but didn't press enter/tab before scheduling
    let currentTo = formData.to;
    if (toInputValue.trim()) {
      const parts = toInputValue.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        const existing = parseRecipientChips(formData.to);
        const combined = Array.from(new Set([...existing, ...parts]));
        currentTo = combined.join(", ");
        setFormData(prev => ({ ...prev, to: currentTo }));
        setToInputValue("");
      }
    }

    const allToChips = parseRecipientChips(currentTo);
    const cleanTo = allToChips.join(", ");
    if (!cleanTo) {
      setError("Recipient email is required");
      toast.error("Recipient email is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    const cleanSubject = (formData.subject || "").trim();
    if (!cleanSubject) {
      setError("Subject is required");
      toast.error("Subject is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    // Validate email format for each recipient in To
    const emailRegex = /^[A-Za-z0-9+_.-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
    const invalidRecipient = allToChips.find(addr => {
      const cleanAddr = addr.includes('<') ? (addr.match(/<([^>]+)>/)?.[1] || addr) : addr;
      return !emailRegex.test(cleanAddr.trim());
    });
    if (invalidRecipient) {
      const errTxt = `Invalid recipient email address: "${invalidRecipient}"`;
      setError(errTxt);
      toast.error(errTxt);
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (uploading) {
      setError("Please wait for files to finish uploading");
      toast.error("Please wait for files to finish uploading");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    let finalBody = getFinalBody(formData.body);
    if (!finalBody || !finalBody.trim() || finalBody === '<p><br></p>' || finalBody === '<p></p>') {
      finalBody = '<p>&nbsp;</p>';
    }

    const cleanCc = formData.cc ? parseRecipientChips(formData.cc).join(", ") : "";
    const cleanBcc = formData.bcc ? parseRecipientChips(formData.bcc).join(", ") : "";

    const cleanAttachments = (attachments || []).map(att => ({
      fileName: att.fileName || att.name || '',
      filePath: att.filePath || '',
      thumbnailPath: att.thumbnailPath || '',
      size: Number(att.size) || 0
    }));

    try {
      const payload = {
        to: cleanTo,
        subject: cleanSubject,
        body: finalBody,
        isHtml: true
      };
      if (cleanCc) payload.cc = cleanCc;
      if (cleanBcc) payload.bcc = cleanBcc;
      if (cleanAttachments.length > 0) payload.attachments = cleanAttachments;

      const response = await mailAPI.scheduleEmail(payload, sendAtIso);

      if (response.data?.success) {
        setSuccess("Email scheduled successfully");
        toast.success("Email scheduled successfully");
        recordSentRecipient(user?.email, cleanTo);
        if (cleanCc) recordSentRecipient(user?.email, cleanCc);
        if (cleanBcc) recordSentRecipient(user?.email, cleanBcc);
        if (invalidateCache) invalidateCache('scheduled');
        window.dispatchEvent(new CustomEvent('bnx_scheduled_changed'));
        setTimeout(() => {
          closeCompose();
        }, 1000);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to schedule email";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      sendingRef.current = false;
      setSending(false);
      setShowScheduleMenu(false);
      setShowCustomSchedule(false);
    }
  };

  const getScheduleOptions = () => {
    const now = new Date();
    
    const laterToday = new Date(now);
    if (now.getHours() >= 17) {
      laterToday.setHours(now.getHours() + 3);
    } else {
      laterToday.setHours(18, 0, 0, 0);
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const nextWeek = new Date(now);
    const daysToMonday = (8 - now.getDay()) % 7 || 7;
    nextWeek.setDate(now.getDate() + daysToMonday);
    nextWeek.setHours(8, 0, 0, 0);

    const formatTime = (d) => {
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { weekday: 'short' });
      return `${dateStr}, ${timeStr}`;
    };

    return [
      { label: "Later today", time: laterToday, display: formatTime(laterToday) },
      { label: "Tomorrow morning", time: tomorrow, display: formatTime(tomorrow) },
      { label: "Monday morning", time: nextWeek, display: formatTime(nextWeek) },
    ];
  };

  const isFormDirty = () => {
    if (!initialFormDataRef.current) {
      return Boolean(
        formData.to?.trim() ||
        formData.subject?.trim() ||
        formData.body?.trim() ||
        formData.cc?.trim() ||
        formData.bcc?.trim()
      );
    }
    const init = initialFormDataRef.current;
    return (
      (formData.to || '').trim() !== (init.to || '').trim() ||
      (formData.cc || '').trim() !== (init.cc || '').trim() ||
      (formData.bcc || '').trim() !== (init.bcc || '').trim() ||
      (formData.subject || '').trim() !== (init.subject || '').trim() ||
      (formData.body || '').trim() !== (init.body || '').trim()
    );
  };

  const saveCurrentDraft = async (showToast = true) => {
    if (!isComposeOpen || isSavingDraftRef.current) return;
    const hasContent = Boolean(
      formData.to?.trim() ||
      formData.subject?.trim() ||
      formData.body?.trim() ||
      formData.cc?.trim() ||
      formData.bcc?.trim()
    );
    if (!hasContent) return;

    try {
      isSavingDraftRef.current = true;
      const targetDraftId = selectedDraftIdRef.current || imapDraftUidRef.current || composeData?.draft?.uid || composeData?.draft?.id;
      const targetUid = imapDraftUidRef.current ? String(imapDraftUidRef.current) : (composeData?.draft?.uid ? String(composeData.draft.uid) : null);
      const targetId = draftId || composeData?.draft?.id || null;

      if (targetDraftId && typeof updateDraftInState === 'function') {
        updateDraftInState(targetDraftId, {
          subject: formData.subject || "(No Subject)",
          to: formData.to || "",
          recipientEmail: formData.to || "",
          cc: formData.cc || "",
          bcc: formData.bcc || "",
          body: formData.body || "",
          textPlain: extractPlainTextFromHtml(formData.body || ""),
          htmlBody: formData.body || "",
        });
      }

      // Persist attachments in frontend storage
      saveDraftAttachments({
        draftId,
        uid: targetUid || targetDraftId,
        to: formData.to,
        subject: formData.subject,
        attachments,
      });

      if (isExistingDraft && targetDraftId) {
        if (typeof updateDraftInState === 'function') {
          updateDraftInState(targetDraftId, {
            subject: formData.subject || "(No Subject)",
            to: formData.to || "",
            recipientEmail: formData.to || "",
            cc: formData.cc || "",
            bcc: formData.bcc || "",
            body: formData.body || "",
            textPlain: extractPlainTextFromHtml(formData.body || ""),
            htmlBody: formData.body || "",
            attachments: attachments,
            attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
            hasAttachments: attachments.length > 0,
          });
        }
      }

      if (draftId) {
        mailAPI.createDbDraft({
          id: draftId,
          to: formData.to || "",
          cc: formData.cc || "",
          bcc: formData.bcc || "",
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true,
          attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
          attachments: attachments,
        }).catch(console.warn);
      }

      const safeUid = targetUid && /^\d+$/.test(String(targetUid).trim()) ? String(targetUid).trim() : null;
      const payload = {
        uid: safeUid,
        to: formData.to || "",
        subject: formData.subject || "(No Subject)",
        body: getFinalBody(formData.body),
        isHtml: true,
        attachments: attachments,
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      const res = await mailAPI.saveDraft(payload);
      const savedData = res.data?.data;
      if (savedData && savedData.uid) {
        imapDraftUidRef.current = savedData.uid;
        linkDraftUid(savedData.uid, draftId, attachments);
        if (targetDraftId && String(savedData.uid) !== String(targetDraftId)) {
          if (typeof updateDraftUidInState === 'function') {
            updateDraftUidInState(targetDraftId, savedData.uid);
          }
          selectedDraftIdRef.current = String(savedData.uid);
        }
        if (typeof updateDraftInState === 'function') {
          updateDraftInState(savedData.uid, {
            attachments: attachments,
            attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
            hasAttachments: attachments.length > 0,
          });
        }
      }

      initialFormDataRef.current = {
        to: formData.to,
        cc: formData.cc,
        bcc: formData.bcc,
        subject: formData.subject,
        body: formData.body,
      };

      if (showToast) {
        toast.success("Draft saved");
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
      if (showToast) {
        toast.error("Failed to save draft");
      }
    } finally {
      isSavingDraftRef.current = false;
    }
  };

  // Explicit save shortcut: Ctrl+S or Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentDraft(true);
      }
    };
    if (isComposeOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isComposeOpen, formData]);

  const handleClose = () => {
    const isExistingDraft = Boolean(isEditingExistingDraftRef.current || originalDraftSnapshotRef.current || composeData?.draft);
    if (isExistingDraft) {
      const targetDraftId = selectedDraftIdRef.current || imapDraftUidRef.current || composeData?.draft?.uid || composeData?.draft?.id;
      const init = initialFormDataRef.current || {};
      const hasChanged = Boolean(
        (formData.to || '').trim() !== (init.to || '').trim() ||
        (formData.cc || '').trim() !== (init.cc || '').trim() ||
        (formData.bcc || '').trim() !== (init.bcc || '').trim() ||
        (formData.subject || '').trim() !== (init.subject || '').trim() ||
        (formData.body || '').trim() !== (init.body || '').trim() ||
        attachments.length > 0
      );

      // Save attachments in frontend storage
      saveDraftAttachments({
        draftId,
        uid: imapDraftUidRef.current || composeData?.draft?.uid,
        to: formData.to,
        subject: formData.subject,
        attachments,
      });

      if (hasChanged && targetDraftId) {
        // 1. Immediately update only that selected draft in the Drafts list and cache using its unique ID
        if (typeof updateDraftInState === 'function') {
          updateDraftInState(targetDraftId, {
            subject: formData.subject || "(No Subject)",
            to: formData.to || "",
            recipientEmail: formData.to || "",
            cc: formData.cc || "",
            bcc: formData.bcc || "",
            body: formData.body || "",
            textPlain: extractPlainTextFromHtml(formData.body || ""),
            htmlBody: formData.body || "",
            attachments: attachments,
            attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
            hasAttachments: attachments.length > 0,
          });
        }

        // 2. Persist to DB draft
        if (draftId) {
          mailAPI.createDbDraft({
            id: draftId,
            to: formData.to || "",
            cc: formData.cc || "",
            bcc: formData.bcc || "",
            subject: formData.subject || "(No Subject)",
            body: getFinalBody(formData.body),
            isHtml: true,
            attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
            attachments: attachments,
          }).catch(console.warn);
        }

        // 3. Persist to IMAP
        const targetUid = imapDraftUidRef.current ? String(imapDraftUidRef.current) : (composeData?.draft?.uid ? String(composeData.draft.uid) : null);
        const safeUid = targetUid && /^\d+$/.test(String(targetUid).trim()) ? String(targetUid).trim() : null;
        const payload = {
          uid: safeUid,
          to: formData.to || "",
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true,
          attachments: attachments,
        };
        if (formData.cc) payload.cc = formData.cc;
        if (formData.bcc) payload.bcc = formData.bcc;

        mailAPI.saveDraft(payload).then((res) => {
          const savedData = res.data?.data;
          if (savedData?.uid) {
            linkDraftUid(savedData.uid, draftId, attachments);
            if (String(savedData.uid) !== String(targetDraftId)) {
              if (typeof updateDraftUidInState === 'function') {
                updateDraftUidInState(targetDraftId, savedData.uid);
              }
            }
          }
        }).catch((err) => {
          console.warn("Notice: Silent draft persist on close skipped/failed:", err?.response?.data?.message || err?.message);
        });
      }

      // Close the composer immediately without any alert or confirmation popup
      closeCompose();
      return;
    }

    // Normal new-compose behavior: save as draft if user typed content or attached files
    const hasContent = Boolean(
      formData.to?.trim() ||
      formData.subject?.trim() ||
      formData.body?.trim() ||
      formData.cc?.trim() ||
      formData.bcc?.trim() ||
      attachments.length > 0
    );

    if (hasContent) {
      // Save attachments in frontend storage
      saveDraftAttachments({
        draftId,
        uid: imapDraftUidRef.current,
        to: formData.to,
        subject: formData.subject,
        attachments,
      });

      if (draftId) {
        mailAPI.createDbDraft({
          id: draftId,
          to: formData.to || "",
          cc: formData.cc || "",
          bcc: formData.bcc || "",
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true,
          attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
          attachments: attachments,
        }).catch(console.warn);
      }

      if (composeMode === "mail" || composeMode === "email") {
        const payload = {
          to: formData.to,
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true,
          attachments: attachments,
        };
        if (formData.cc) payload.cc = formData.cc;
        if (formData.bcc) payload.bcc = formData.bcc;

        mailAPI.saveDraft(payload).then((res) => {
          const savedData = res.data?.data;
          if (savedData?.uid) {
            linkDraftUid(savedData.uid, draftId, attachments);
          }
          if (invalidateCache) {
            invalidateCache('draft');
            invalidateCache('drafts');
          }
          if (currentFolder?.toLowerCase() === 'draft' || currentFolder?.toLowerCase() === 'drafts') {
            fetchEmails('draft', true);
          } else if (fetchEmailsSilently) {
            fetchEmailsSilently('drafts');
          }
        }).catch(console.error);
      }
    }
    closeCompose();
  };

  const handleDiscard = async () => {
    if (window.confirm("Discard this email?")) {
      const discDraftId = draftId;
      const discImapUid = imapDraftUidRef.current;
      clearDraftAttachments({
        draftId: discDraftId,
        uid: discImapUid,
        to: formData.to,
        subject: formData.subject,
      });
      setAttachments([]);
      setDraftId(null);
      imapDraftUidRef.current = null;
      if (discDraftId) {
        try {
          await api.delete(`/api/mail/drafts/${discDraftId}`);
        } catch (e) {
          console.error("Failed to discard DB draft:", e);
        }
      }
      if (discImapUid) {
        try {
          await mailAPI.trash(discImapUid, "Drafts");
        } catch (e) {
          console.error("Failed to discard IMAP draft:", e);
        }
      }
      if (invalidateCache) {
        invalidateCache('draft');
        invalidateCache('drafts');
      }
      if (currentFolder?.toLowerCase() === 'draft' || currentFolder?.toLowerCase() === 'drafts') {
        fetchEmails('draft', true);
      } else if (fetchEmailsSilently) {
        fetchEmailsSilently('drafts');
      }
      closeCompose();
    }
  };

  const renderContent = () => {
    return (
      <>
        {isReply && (
          <style>{`
            .reply-composer-style .ql-toolbar {
              display: none !important;
            }
            .reply-composer-style .ql-container {
              border: none !important;
              display: flex !important;
              flex-direction: column !important;
              flex: 1 1 0% !important;
              min-height: 0 !important;
              height: 100% !important;
              overflow: hidden !important;
              font-family: inherit !important;
            }
            .reply-composer-style .ql-editor {
              padding: 10px 0 !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
              flex: 1 1 0% !important;
              min-height: 0 !important;
              height: 100% !important;
              overflow-y: auto !important;
              overscroll-behavior-y: contain;
            }
            .reply-composer-style .ql-editor.ql-blank::before {
              left: 0 !important;
              right: 0 !important;
              color: #9ca3af !important;
              font-style: normal !important;
              font-size: 14px !important;
            }
          `}</style>
        )}

        <style>{`
          [id^="reply-quill-toolbar"],
          [id^="compose-quill-toolbar"],
          .reply-quill-toolbar,
          .compose-quill-toolbar {
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
          }
          [id^="reply-quill-toolbar"] button,
          [id^="compose-quill-toolbar"] button,
          .reply-quill-toolbar button,
          .compose-quill-toolbar button {
            cursor: pointer !important;
            float: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            min-height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            border-radius: 6px !important;
            border: none !important;
            box-sizing: border-box !important;
            transition: background-color 0.15s ease, color 0.15s ease !important;
          }
          [id^="reply-quill-toolbar"] .font-size-btn,
          [id^="compose-quill-toolbar"] .font-size-btn,
          .reply-quill-toolbar .font-size-btn,
          .compose-quill-toolbar .font-size-btn {
            width: auto !important;
            min-width: 88px !important;
            max-width: none !important;
            height: 32px !important;
            min-height: 32px !important;
            padding: 0 10px !important;
          }
          [id^="reply-quill-toolbar"] button:hover,
          [id^="compose-quill-toolbar"] button:hover,
          .reply-quill-toolbar button:hover,
          .compose-quill-toolbar button:hover {
            background-color: rgba(0, 0, 0, 0.06) !important;
          }
          .dark [id^="reply-quill-toolbar"] button:hover,
          .dark [id^="compose-quill-toolbar"] button:hover,
          .dark .reply-quill-toolbar button:hover,
          .dark .compose-quill-toolbar button:hover {
            background-color: rgba(255, 255, 255, 0.12) !important;
          }
          [id^="reply-quill-toolbar"] button.ql-active,
          [id^="compose-quill-toolbar"] button.ql-active,
          .reply-quill-toolbar button.ql-active,
          .compose-quill-toolbar button.ql-active {
            background-color: rgba(59, 130, 246, 0.15) !important;
            color: #2563eb !important;
          }
          [id^="reply-quill-toolbar"] button svg,
          [id^="compose-quill-toolbar"] button svg,
          .reply-quill-toolbar button svg,
          .compose-quill-toolbar button svg {
            width: 18px !important;
            height: 18px !important;
            flex-shrink: 0 !important;
          }
          [id^="reply-quill-toolbar"] button.ql-bold,
          [id^="compose-quill-toolbar"] button.ql-bold,
          .reply-quill-toolbar button.ql-bold,
          .compose-quill-toolbar button.ql-bold {
            font-size: 16px !important;
            font-weight: 700 !important;
          }
          [id^="reply-quill-toolbar"] button.ql-italic,
          [id^="compose-quill-toolbar"] button.ql-italic,
          .reply-quill-toolbar button.ql-italic,
          .compose-quill-toolbar button.ql-italic {
            font-size: 16px !important;
            font-style: italic !important;
            font-family: serif !important;
          }
          [id^="reply-quill-toolbar"] button.ql-underline,
          [id^="compose-quill-toolbar"] button.ql-underline,
          .reply-quill-toolbar button.ql-underline,
          .compose-quill-toolbar button.ql-underline {
            font-size: 16px !important;
            text-decoration: underline !important;
            font-weight: 600 !important;
          }
          [id^="reply-quill-toolbar"] button.ql-strike,
          [id^="compose-quill-toolbar"] button.ql-strike,
          .reply-quill-toolbar button.ql-strike,
          .compose-quill-toolbar button.ql-strike {
            font-size: 16px !important;
            text-decoration: line-through !important;
          }
          [id^="reply-quill-toolbar"] button.ql-blockquote,
          [id^="compose-quill-toolbar"] button.ql-blockquote,
          .reply-quill-toolbar button.ql-blockquote,
          .compose-quill-toolbar button.ql-blockquote {
            font-size: 19px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
          }
          [id^="reply-quill-toolbar"] .ql-stroke,
          [id^="compose-quill-toolbar"] .ql-stroke,
          .reply-quill-toolbar .ql-stroke,
          .compose-quill-toolbar .ql-stroke {
            stroke: #4b5563 !important;
            stroke-width: 2 !important;
          }
          .dark [id^="reply-quill-toolbar"] .ql-stroke,
          .dark [id^="compose-quill-toolbar"] .ql-stroke,
          .dark .reply-quill-toolbar .ql-stroke,
          .dark .compose-quill-toolbar .ql-stroke {
            stroke: #d1d5db !important;
          }
          [id^="reply-quill-toolbar"] .ql-fill,
          [id^="compose-quill-toolbar"] .ql-fill,
          .reply-quill-toolbar .ql-fill,
          .compose-quill-toolbar .ql-fill {
            fill: #4b5563 !important;
          }
          .dark [id^="reply-quill-toolbar"] .ql-fill,
          .dark [id^="compose-quill-toolbar"] .ql-fill,
          .dark .reply-quill-toolbar .ql-fill,
          .dark .compose-quill-toolbar .ql-fill {
            fill: #d1d5db !important;
          }
          .compose-quill {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: visible !important;
          }
          .compose-quill .quill {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: visible !important;
          }
          .compose-quill .ql-toolbar.ql-snow {
            flex-shrink: 0 !important;
            border: none !important;
            border-bottom: 1px solid #e5e7eb !important;
            background-color: #ffffff;
          }
          .compose-quill .ql-container.ql-snow,
          .compose-quill .ql-container {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            position: relative !important;
            border: none !important;
          }
          .compose-quill .ql-editor {
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow-y: auto !important;
            overscroll-behavior-y: contain;
            font-family: ${getFontFamilyCss(defaultFontFamily)};
            font-size: ${getFontSizeCss(defaultFontSize)};
            color: ${getTextColorCss(defaultTextColor)};
          }
          .compose-quill .ql-snow .ql-tooltip,
          .reply-composer-style .ql-snow .ql-tooltip {
            z-index: 100 !important;
            max-width: calc(100% - 24px) !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15) !important;
            border-radius: 8px !important;
            position: absolute !important;
          }
          .compose-quill .ql-editor p,
          .compose-quill .ql-editor div,
          .compose-quill .ql-editor span:not([style*="font-family"]) {
            font-family: inherit;
          }
          .compose-quill .ql-editor p,
          .compose-quill .ql-editor div,
          .compose-quill .ql-editor span:not([style*="color"]) {
            color: inherit;
          }
        `}</style>

        {/* HEADER / DRAG HANDLE */}
        {isReply ? (
          <div
            className={`${isMobile ? "" : "compose-drag-handle"} flex items-center justify-between px-5 pt-3.5 pb-2 cursor-move shrink-0 select-none bg-white dark:bg-neutral-900`}
            onClick={() => {
              if (isComposeMinimized) {
                setIsComposeMinimized(false);
              }
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                title="Back / Close"
              >
                <MdArrowBack size={20} />
              </button>
              <span className="font-bold text-base text-gray-800 dark:text-gray-100">
                Reply
              </span>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {!isMobile && (
                <button
                  type="button"
                  onClick={handleMinimizeToggle}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                  title={isComposeMinimized ? "Expand" : "Minimize"}
                >
                  <MdRemove size={18} />
                </button>
              )}
              {!isMobile && (
                <button
                  type="button"
                  onClick={handleMaximizeToggle}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                  title={(!isComposeMinimized && isComposeMaximized) ? "Restore" : "Maximize"}
                >
                  {(!isComposeMinimized && isComposeMaximized) ? <MdCloseFullscreen size={16} /> : <MdOpenInFull size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Close"
              >
                <MdClose size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`${isMobile ? "" : "compose-drag-handle"} flex items-center justify-between px-4 py-2.5 cursor-move shrink-0 border-b select-none bg-gray-100 dark:bg-neutral-800 dark:border-gray-800`}
            onClick={() => {
              if (isComposeMinimized) {
                setIsComposeMinimized(false);
              }
            }}
          >
            {/* Mode Switch or Minimized Title */}
            {isComposeMinimized ? (
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate">
                  {formData.subject || (composeMode === "chat" ? "New Casbox Message" : "New Message")}
                </span>
              </div>
            ) : (
              <div 
                className="inline-flex items-center bg-gray-200/90 dark:bg-neutral-700/80 p-0.5 rounded-lg border border-gray-300/40 dark:border-neutral-600/40"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleSwitchMode("mail")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    composeMode === "mail" || composeMode === "email"
                      ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Mail
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("chat")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    composeMode === "chat" || composeMode === "casbox"
                      ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Casbox
                </button>
              </div>
            )}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {!isMobile && (
                <button
                  type="button"
                  onClick={handleMinimizeToggle}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                  title={isComposeMinimized ? "Expand" : "Minimize"}
                >
                  <MdRemove size={16} />
                </button>
              )}
              {!isMobile && (
                <button
                  type="button"
                  onClick={handleMaximizeToggle}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                  title={(!isComposeMinimized && isComposeMaximized) ? "Restore" : "Maximize"}
                >
                  {(!isComposeMinimized && isComposeMaximized) ? <MdCloseFullscreen size={16} /> : <MdOpenInFull size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                title="Close"
              >
                <MdClose size={16} />
              </button>
            </div>
          </div>
        )}

        {/* BODY CONTENT (HIDDEN WHEN MINIMIZED, PRESERVES ALL INPUT STATE & REFS) */}
        <form
          onSubmit={handleSend}
          className={`flex-1 flex flex-col ${isReply ? 'p-0 pt-0.5' : 'p-4'} overflow-hidden min-h-0 bg-transparent ${isComposeMinimized ? '!hidden' : ''}`}
          style={{ display: isComposeMinimized ? 'none' : 'flex' }}
        >
          {/* ALERTS */}
          {error && (
            <div className={`p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30 text-xs font-medium shrink-0 ${isReply ? 'mx-5 mb-2' : 'mb-3'}`}>
              {error}
            </div>
          )}
          {success && (
            <div className={`p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 text-xs font-medium shrink-0 ${isReply ? 'mx-5 mb-2' : 'mb-3'}`}>
              {success}
            </div>
          )}

          {/* HEADER FIELDS (RECIPIENT & SUBJECT) */}
          {isReply ? (
            <div className="shrink-0 flex flex-col gap-1.5 px-5 pt-1">
              {/* To Row */}
              <div className="flex items-center justify-between text-sm min-h-[34px]">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="text-gray-500 dark:text-gray-400 font-medium text-sm w-6 shrink-0">To</span>
                  {formData.to ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/90 dark:border-blue-800/80 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300 max-w-[calc(100%-40px)]">
                      <MdPersonOutline size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{formData.to}</span>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, to: "" }))}
                        className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 ml-0.5 cursor-pointer text-xs leading-none"
                        title="Remove recipient"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 relative flex items-center min-w-0">
                      <input
                        ref={toInputRef}
                        type="text"
                        name="to_input"
                        autoFocus
                        className="w-full outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                        placeholder="Recipient email..."
                        value={toInputValue}
                        onChange={handleToInputChange}
                        onFocus={handleToInputFocus}
                        onBlur={handleToInputBlur}
                        onKeyDown={handleToInputKeyDown}
                      />
                      {showToSuggestions && (
                        <RecipientAutocomplete
                          suggestions={toSuggestions}
                          highlightedIndex={toHighlightedIndex}
                          onSelectSuggestion={handleSelectToSuggestion}
                          onHoverIndex={setToHighlightedIndex}
                          dropdownRef={toDropdownRef}
                          isLoading={isLoadingSuggestions}
                          query={toInputValue}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setShowCc(!showCc)}
                    className={`text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ${showCc ? 'font-bold' : ''}`}
                  >
                    Cc
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBcc(!showBcc)}
                    className={`text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ${showBcc ? 'font-bold' : ''}`}
                  >
                    Bcc
                  </button>
                </div>
              </div>

              {/* CC */}
              {showCc && (
                <div className="flex items-center py-1 text-sm shrink-0 animate-fade-in border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-500 dark:text-gray-400 font-medium text-sm w-6 shrink-0">Cc</span>
                  <input
                    type="text"
                    name="cc"
                    value={formData.cc || ""}
                    onChange={handleChange}
                    onFocus={() => { focusedFieldRef.current = 'cc'; }}
                    onBlur={() => { if (focusedFieldRef.current === 'cc') focusedFieldRef.current = null; }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleStandardInputAutoCorrect(e, autoCorrect);
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                    placeholder="carboncopy@example.com"
                    spellCheck={spellingCheck ? "true" : "false"}
                    autoCorrect={autoCorrect ? "on" : "off"}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowCc(false); setFormData(p => ({ ...p, cc: "" })); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* BCC */}
              {showBcc && (
                <div className="flex items-center py-1 text-sm shrink-0 animate-fade-in border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-500 dark:text-gray-400 font-medium text-sm w-6 shrink-0">Bcc</span>
                  <input
                    type="text"
                    name="bcc"
                    value={formData.bcc || ""}
                    onChange={handleChange}
                    onFocus={() => { focusedFieldRef.current = 'bcc'; }}
                    onBlur={() => { if (focusedFieldRef.current === 'bcc') focusedFieldRef.current = null; }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleStandardInputAutoCorrect(e, autoCorrect);
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                    placeholder="blindcopy@example.com"
                    spellCheck={spellingCheck ? "true" : "false"}
                    autoCorrect={autoCorrect ? "on" : "off"}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowBcc(false); setFormData(p => ({ ...p, bcc: "" })); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* SUBJECT */}
              <div className="pt-1.5 pb-0.5">
                <input
                  type="text"
                  name="subject"
                  value={formData.subject || ""}
                  onChange={handleChange}
                  onFocus={() => { focusedFieldRef.current = 'subject'; }}
                  onBlur={() => { if (focusedFieldRef.current === 'subject') focusedFieldRef.current = null; }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    handleStandardInputAutoCorrect(e, autoCorrect);
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="w-full bg-transparent font-bold text-sm text-gray-800 dark:text-gray-100 outline-none border-none placeholder-gray-400"
                  placeholder="Subject..."
                  spellCheck={spellingCheck ? "true" : "false"}
                  autoCorrect={autoCorrect ? "on" : "off"}
                />
              </div>
            </div>
          ) : (
            <div className="shrink-0 flex flex-col gap-0.5">
              {/* Cc & Bcc toggles */}
              {(composeMode === "mail" || composeMode === "email") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0">
                  <div className="text-gray-400 dark:text-gray-500 w-10 shrink-0">{t('compose.to', 'To')}</div>
                  <div className="flex-1 relative flex items-center min-w-0 flex-wrap gap-1.5 py-0.5">
                    {recipientChips.map((recipient, idx) => (
                      <span
                        key={"recipient_chip_" + idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/90 dark:border-blue-800/80 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300 max-w-full select-none"
                      >
                        <MdPersonOutline size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate max-w-[160px] sm:max-w-[220px]" title={recipient}>
                          {recipient}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipientChip(idx);
                          }}
                          className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 ml-0.5 cursor-pointer text-xs leading-none p-0.5"
                          title="Remove recipient"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <div className="flex-1 relative flex items-center min-w-[120px]">
                      <input
                        ref={toInputRef}
                        type="text"
                        name="to_input"
                        autoFocus
                        className="w-full outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm py-0.5"
                        placeholder={recipientChips.length === 0 ? t('compose.recipients', 'Recipients') : ""}
                        value={toInputValue}
                        onChange={handleToInputChange}
                        onFocus={handleToInputFocus}
                        onBlur={handleToInputBlur}
                        onKeyDown={handleToInputKeyDown}
                      />
                      {showToSuggestions && (
                        <RecipientAutocomplete
                          suggestions={toSuggestions}
                          highlightedIndex={toHighlightedIndex}
                          onSelectSuggestion={handleSelectToSuggestion}
                          onHoverIndex={setToHighlightedIndex}
                          dropdownRef={toDropdownRef}
                          isLoading={isLoadingSuggestions}
                          query={toInputValue}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-gray-500 font-medium ml-2 shrink-0">
                    <button type="button" onClick={() => setShowCc(!showCc)} className="hover:underline">
                      Cc
                    </button>
                    <button type="button" onClick={() => setShowBcc(!showBcc)} className="hover:underline">
                      Bcc
                    </button>
                  </div>
                </div>
              )}
              {(composeMode === "chat" || composeMode === "casbox") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0">
                  <div className="text-gray-400 dark:text-gray-500 w-10 shrink-0">To</div>
                  <div className="flex-1 relative flex items-center min-w-0 flex-wrap gap-1.5 py-0.5">
                    {recipientChips.map((recipient, idx) => (
                      <span
                        key={"casbox_chip_" + idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/90 dark:border-blue-800/80 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300 max-w-full select-none"
                      >
                        <MdPersonOutline size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate max-w-[160px] sm:max-w-[220px]" title={recipient}>
                          {recipient}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipientChip(idx);
                          }}
                          className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 ml-0.5 cursor-pointer text-xs leading-none p-0.5"
                          title="Remove recipient"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <div className="flex-1 relative flex items-center min-w-[120px]">
                      <input
                        ref={toInputRef}
                        type="text"
                        name="to_input"
                        autoFocus
                        className="w-full outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm py-0.5"
                        placeholder={recipientChips.length === 0 ? "Chat / Casbox Recipient (Email or Username)" : ""}
                        value={toInputValue}
                        onChange={handleToInputChange}
                        onFocus={handleToInputFocus}
                        onBlur={(e) => {
                          handleToInputBlur();
                          handleCasboxRecipientBlur(e);
                        }}
                        onKeyDown={handleToInputKeyDown}
                      />
                      {showToSuggestions && (
                        <RecipientAutocomplete
                          suggestions={toSuggestions}
                          highlightedIndex={toHighlightedIndex}
                          onSelectSuggestion={handleSelectToSuggestion}
                          onHoverIndex={setToHighlightedIndex}
                          dropdownRef={toDropdownRef}
                          isLoading={isLoadingSuggestions}
                          query={toInputValue}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CC */}
              {showCc && (composeMode === "mail" || composeMode === "email") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0 animate-fade-in" style={{ borderColor: theme.border }}>
                  <div className="text-gray-400 dark:text-gray-500 w-10">Cc:</div>
                  <input
                    type="text"
                    name="cc"
                    value={formData.cc || ""}
                    onChange={handleChange}
                    onFocus={() => { focusedFieldRef.current = 'cc'; }}
                    onBlur={() => { if (focusedFieldRef.current === 'cc') focusedFieldRef.current = null; }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleStandardInputAutoCorrect(e, autoCorrect);
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400"
                    placeholder="carboncopy@example.com"
                    spellCheck={spellingCheck ? "true" : "false"}
                    autoCorrect={autoCorrect ? "on" : "off"}
                  />
                </div>
              )}

              {/* BCC */}
              {showBcc && (composeMode === "mail" || composeMode === "email") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0 animate-fade-in" style={{ borderColor: theme.border }}>
                  <div className="text-gray-400 dark:text-gray-500 w-10">Bcc:</div>
                  <input
                    type="text"
                    name="bcc"
                    value={formData.bcc || ""}
                    onChange={handleChange}
                    onFocus={() => { focusedFieldRef.current = 'bcc'; }}
                    onBlur={() => { if (focusedFieldRef.current === 'bcc') focusedFieldRef.current = null; }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleStandardInputAutoCorrect(e, autoCorrect);
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400"
                    placeholder="blindcopy@example.com"
                    spellCheck={spellingCheck ? "true" : "false"}
                    autoCorrect={autoCorrect ? "on" : "off"}
                  />
                </div>
              )}

              {/* SUBJECT */}
              <div className="flex items-center gap-2 border-b py-1.5 shrink-0" style={{ borderColor: theme.border }}>
                <span className="text-xs font-semibold w-10 text-gray-500">{t('compose.subject', 'Subject')}:</span>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject || ""}
                  onChange={handleChange}
                  onFocus={() => { focusedFieldRef.current = 'subject'; }}
                  onBlur={() => { if (focusedFieldRef.current === 'subject') focusedFieldRef.current = null; }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    handleStandardInputAutoCorrect(e, autoCorrect);
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="flex-1 bg-transparent text-sm outline-none border-none"
                  style={{ color: theme.text }}
                  placeholder={t('compose.subject_placeholder', 'Enter subject...')}
                  spellCheck={spellingCheck ? "true" : "false"}
                  autoCorrect={autoCorrect ? "on" : "off"}
                />
              </div>
            </div>
          )}

          {/* QUOTED ORIGINAL MESSAGE SECTION (REPLY MODE) */}
          {isReply && quotedMessage && (
            <div className="mx-5 my-2 p-3.5 bg-[#f0f6ff]/80 dark:bg-neutral-800/80 border-l-[3.5px] border-blue-500 rounded-r-xl rounded-l-xs text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-text font-normal shadow-xs shrink-0">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1.5 font-medium select-none">
                --- Original Message ---
              </div>
              {quotedMessage}
            </div>
          )}

          {/* SUBTLE DIVIDER */}
          {isReply && (
            <div className="border-b border-gray-100 dark:border-neutral-800 mx-5 my-1 shrink-0"></div>
          )}

          {/* BODY - TOOLBAR REMAINS STATIONARY AT TOP, ONLY EDITOR SCROLLS */}
          <div className={`flex-1 min-h-0 flex flex-col w-full compose-quill overflow-visible ${isReply ? 'reply-composer-style px-5' : 'mt-2 rounded-md'}`}>
            {!isReply && (
              <div
                id={`compose-quill-toolbar-${windowId}`}
                onMouseDown={(e) => e.preventDefault()}
                className="compose-quill-toolbar flex items-center flex-nowrap gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 shrink-0 relative z-30 max-w-full overflow-x-auto scrollbar-none select-none"
              >
                <FontSizeDropdown quillRef={quillRef} direction="down" />
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-bold font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Bold">B</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-italic italic hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Italic">I</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-underline underline hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Underline">U</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-strike line-through hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Strikethrough">S</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-blockquote hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Quote">”</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-list hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="bullet" title="Bulleted List"></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-list hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="ordered" title="Numbered List"></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-indent hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="-1" title="Decrease Indent"></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-indent hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="+1" title="Increase Indent"></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-link hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Insert Link"></button>
              </div>
            )}
            <ReactQuill
              ref={quillRef}
              theme="snow"
              modules={dynamicQuillModules}
              bounds="self"
              value={formData.body || ""}
              onChange={handleBodyChange}
              onFocus={() => {
                if (focusedFieldRef.current && focusedFieldRef.current !== 'body') {
                  const targetInput = containerRef.current?.querySelector(`input[name="${focusedFieldRef.current}"]`) || document.querySelector(`input[name="${focusedFieldRef.current}"]`);
                  if (targetInput && document.activeElement !== targetInput) {
                    targetInput.focus();
                    return;
                  }
                }
                focusedFieldRef.current = 'body';
              }}
              onBlur={() => {
                if (focusedFieldRef.current === 'body') {
                  focusedFieldRef.current = null;
                }
              }}
              placeholder={isReply ? "Write your reply..." : (composeData?.forward ? "Type your forwarded message here..." : "Type your message here...")}
              className="flex-1 min-h-0 flex flex-col h-full bg-white text-black"
            />
          </div>

          {/* ATTACHMENT CHIPS RENDERING - ROUNDED PILL DESIGN */}
          {attachments.length > 0 && (
            <div 
              className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-t max-h-28 overflow-y-auto" 
              style={{ borderColor: theme.border }}
            >
              {attachments.map((file, i) => {
                const fileName = file.fileName || file.name || (typeof file === 'string' ? file : `attachment_${i + 1}`);
                const fileSize = file.size || (file.rawFile ? file.rawFile.size : 0);
                const isImg = isImageFile(fileName);

                return (
                  <div 
                    key={fileName + i}
                    className="inline-flex items-center gap-2 bg-[#f3f4f6] dark:bg-[#262626] border border-gray-200 dark:border-neutral-700 px-3.5 py-1.5 rounded-full text-xs shadow-2xs select-none transition-all hover:bg-gray-200/70 dark:hover:bg-neutral-800"
                    style={{ color: theme.text }}
                  >
                    {/* File / Image Icon on the left */}
                    <span className="text-gray-500 dark:text-gray-400 shrink-0 flex items-center">
                      {isImg ? (
                        <MdImage size={16} className="text-blue-500 dark:text-blue-400" />
                      ) : (
                        <MdInsertDriveFile size={16} className="text-gray-500 dark:text-gray-400" />
                      )}
                    </span>

                    {/* Original File Name */}
                    <span 
                      onClick={() => handlePreviewAttachment(file)}
                      className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px] cursor-pointer hover:underline"
                      title={fileName}
                    >
                      {fileName}
                    </span>

                    {/* Formatted File Size (e.g. 251 KB) */}
                    {fileSize > 0 && (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px] whitespace-nowrap font-normal">
                        {formatFileSize(fileSize)}
                      </span>
                    )}

                    {/* Eye Icon for Preview */}
                    <button 
                      type="button" 
                      onClick={() => handlePreviewAttachment(file)}
                      className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-0.5 rounded cursor-pointer flex items-center justify-center ml-0.5"
                      title="Preview attachment"
                    >
                      <MdRemoveRedEye size={16} />
                    </button>

                    {/* Red × Icon to Remove */}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveAttachment(fileName)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors p-0.5 rounded cursor-pointer flex items-center justify-center font-bold"
                      title="Remove attachment"
                    >
                      <MdClose size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

            {/* FILE UPLOAD INPUT */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            {/* ACTIONS FOOTER */}
            {isReply ? (
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t shrink-0 relative bg-white dark:bg-neutral-900 border-gray-100 dark:border-neutral-800">
                <div className="flex items-center flex-wrap gap-4 sm:gap-5 flex-1 min-w-0">
                  {/* SPLIT SEND PILL BUTTON */}
                  <div className="inline-flex items-center rounded-full overflow-hidden shadow-sm hover:shadow transition-all bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <button
                      type="submit"
                      disabled={sending || uploading}
                      className="flex items-center gap-1.5 pl-4 pr-2.5 py-2 text-white text-xs sm:text-sm font-semibold disabled:opacity-60 cursor-pointer"
                    >
                      <MdSend size={14} className="shrink-0" />
                      <span>{sending ? t('compose.sending', 'Sending...') : 'Send'}</span>
                    </button>
                    {(composeMode === "mail" || composeMode === "email") && (
                      <button
                        type="button"
                        disabled={sending || uploading}
                        onClick={() => {
                          setShowScheduleMenu(!showScheduleMenu);
                          setShowCustomSchedule(false);
                        }}
                        className="pr-3 pl-1 py-2 text-white/90 hover:text-white disabled:opacity-60 cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors"
                        title="Schedule send"
                      >
                        <MdArrowDropDown size={16} />
                      </button>
                    )}
                  </div>

                  {/* Schedule Send Dropdown Menu */}
                  {showScheduleMenu && (
                    <div
                      className="absolute bottom-12 left-0 w-64 rounded-xl border shadow-2xl z-50 p-1.5 bg-white dark:bg-neutral-900 animate-in fade-in duration-200"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="flex items-center justify-between p-2 mb-1 border-b" style={{ borderColor: theme.border }}>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Schedule send</span>
                        <button
                          type="button"
                          onClick={() => { setShowScheduleMenu(false); setShowCustomSchedule(false); }}
                          className="text-xs p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"
                        >
                          ✕
                        </button>
                      </div>

                      {showCustomSchedule ? (
                        <div className="p-2 flex flex-col gap-3">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Select Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={customScheduleDateTime}
                            onChange={(e) => setCustomScheduleDateTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setShowCustomSchedule(false)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!customScheduleDateTime) {
                                  alert("Please select a valid date and time.");
                                  return;
                                }
                                const dateObj = new Date(customScheduleDateTime);
                                if (dateObj <= new Date()) {
                                  alert("Please select a future date and time.");
                                  return;
                                }
                                handleScheduleSend(dateObj.toISOString());
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                            >
                              Schedule
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 py-1">
                          {getScheduleOptions().map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleScheduleSend(opt.time.toISOString())}
                              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2 text-gray-800 dark:text-gray-200 cursor-pointer font-medium"
                            >
                              <span>{opt.label}</span>
                              <span className="text-gray-400 dark:text-gray-500 text-[11px]">{opt.display}</span>
                            </button>
                          ))}
                          <div className="border-t my-1" style={{ borderColor: theme.border }}></div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomSchedule(true);
                              const defaultCustom = new Date();
                              defaultCustom.setMinutes(defaultCustom.getMinutes() - defaultCustom.getTimezoneOffset());
                              setCustomScheduleDateTime(defaultCustom.toISOString().slice(0, 16));
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-blue-500 dark:text-blue-400 font-semibold cursor-pointer"
                          >
                            Select date & time
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CUSTOM INLINE QUILL TOOLBAR */}
                  <div
                    id={`reply-quill-toolbar-${windowId}`}
                    onMouseDown={(e) => e.preventDefault()}
                    className="reply-quill-toolbar flex items-center flex-nowrap gap-2 p-1 bg-white dark:bg-neutral-800 rounded-xl border text-gray-700 dark:text-gray-300 relative z-30 max-w-full overflow-x-auto scrollbar-none select-none"
                    style={{ borderColor: theme.border }}
                  >
                    <FontSizeDropdown quillRef={quillRef} direction="up" />

                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-bold font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Bold">B</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-italic italic hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Italic">I</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-underline underline hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Underline">U</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-strike line-through hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Strikethrough">S</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-blockquote hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Quote">”</button>

                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-list hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="bullet" title="Bulleted List"></button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-list hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="ordered" title="Numbered List"></button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-indent hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="-1" title="Decrease Indent"></button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-indent hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" value="+1" title="Increase Indent"></button>

                    <button type="button" onMouseDown={(e) => e.preventDefault()} className="ql-link hover:bg-black/5 dark:hover:bg-white/10 rounded flex items-center justify-center" title="Insert Link"></button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-gray-500 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                    title="Attach file"
                  >
                    <MdAttachFile size={19} className="transform rotate-45" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSignaturesMenu(!showSignaturesMenu)}
                      className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                      title="Insert Signature"
                    >
                      <MdEditDocument size={19} />
                    </button>

                    {showSignaturesMenu && (
                      <div
                        className="absolute bottom-10 right-0 w-56 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-50 p-1.5 glass"
                        style={{
                          backgroundColor: theme.cardBg,
                          borderColor: theme.border,
                          color: theme.text,
                        }}
                      >
                        <div className="flex items-center justify-between p-1.5 mb-1 border-b" style={{ borderColor: theme.border }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Signatures</span>
                          <button
                            type="button"
                            onClick={() => setShowSignaturesMenu(false)}
                            className="text-xs p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-550"
                          >
                            <MdClose size={12} />
                          </button>
                        </div>
                        {signatures.length === 0 ? (
                          <p className="text-[10px] text-center p-2 opacity-60">No signatures configured</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {signatures.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, body: prev.body + `<br/><br/>${s.content}` }));
                                  setShowSignaturesMenu(false);
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate text-gray-800 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                              >
                                <span className="font-semibold truncate">{s.name}</span>
                                {s.isDefault && <span className="text-[10px] text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 rounded">Default</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                    title="Discard draft"
                  >
                    <MdDeleteOutline size={19} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t pt-3 mt-2 shrink-0 relative" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-full shadow-md hover:shadow-lg transition-all">
                    <button
                      type="submit"
                      disabled={sending || uploading}
                      className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer ${(composeMode === "mail" || composeMode === "email") ? "rounded-l-full border-r border-white/20" : "rounded-full"}`}
                      style={{ background: `linear-gradient(135deg, ${theme.accent || '#135bec'} 0%, #3b82f6 100%)` }}
                    >
                      {sending
                        ? t('compose.sending', 'Sending...')
                        : (composeMode === "chat" || composeMode === "casbox")
                          ? t('compose.send', t('common.send', 'Send'))
                          : t('compose.send_email', 'Send Email')}
                      {!sending && <MdSend size={14} />}
                    </button>
                    {(composeMode === "mail" || composeMode === "email") && (
                      <button
                        type="button"
                        disabled={sending || uploading}
                        onClick={() => {
                          setShowScheduleMenu(!showScheduleMenu);
                          setShowCustomSchedule(false);
                        }}
                        className="px-2 py-2 rounded-r-full text-white text-xs font-semibold disabled:opacity-60 cursor-pointer flex items-center justify-center hover:bg-white/10"
                        style={{ background: `linear-gradient(135deg, ${theme.accent || '#135bec'} 0%, #3b82f6 100%)` }}
                        title="Schedule send"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Schedule Send Dropdown Menu */}
                  {showScheduleMenu && (
                    <div
                      className="absolute bottom-12 left-0 w-64 rounded-xl border shadow-2xl z-50 p-1.5 bg-white dark:bg-neutral-900 animate-in fade-in duration-200"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="flex items-center justify-between p-2 mb-1 border-b" style={{ borderColor: theme.border }}>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Schedule send</span>
                        <button
                          type="button"
                          onClick={() => { setShowScheduleMenu(false); setShowCustomSchedule(false); }}
                          className="text-xs p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"
                        >
                          ✕
                        </button>
                      </div>

                      {showCustomSchedule ? (
                        <div className="p-2 flex flex-col gap-3">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Select Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={customScheduleDateTime}
                            onChange={(e) => setCustomScheduleDateTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setShowCustomSchedule(false)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!customScheduleDateTime) {
                                  alert("Please select a valid date and time.");
                                  return;
                                }
                                const dateObj = new Date(customScheduleDateTime);
                                if (dateObj <= new Date()) {
                                  alert("Please select a future date and time.");
                                  return;
                                }
                                handleScheduleSend(dateObj.toISOString());
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                            >
                              Schedule
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 py-1">
                          {getScheduleOptions().map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleScheduleSend(opt.time.toISOString())}
                              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2 text-gray-800 dark:text-gray-200 cursor-pointer font-medium"
                            >
                              <span>{opt.label}</span>
                              <span className="text-gray-400 dark:text-gray-500 text-[11px]">{opt.display}</span>
                            </button>
                          ))}
                          <div className="border-t my-1" style={{ borderColor: theme.border }}></div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomSchedule(true);
                              const defaultCustom = new Date();
                              defaultCustom.setMinutes(defaultCustom.getMinutes() - defaultCustom.getTimezoneOffset());
                              setCustomScheduleDateTime(defaultCustom.toISOString().slice(0, 16));
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-blue-500 dark:text-blue-400 font-semibold cursor-pointer"
                          >
                            Select date & time
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                    title="Attach file"
                  >
                    <MdAttachFile size={18} className="transform rotate-45" />
                  </button>

                  {/* Signatures quick selector */}
                  {(composeMode === "mail" || composeMode === "email") && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSignaturesMenu(!showSignaturesMenu)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold"
                        title="Insert Signature"
                      >
                        <MdEditDocument size={16} />
                        <span className="hidden sm:inline">{t('settings.signature_label', 'Signature')}</span>
                      </button>

                      {showSignaturesMenu && (
                        <div
                          className="absolute bottom-10 right-0 md:right-auto md:left-0 w-56 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-50 p-1.5 glass"
                          style={{
                            backgroundColor: theme.cardBg,
                            borderColor: theme.border,
                            color: theme.text,
                          }}
                        >
                          <div className="flex items-center justify-between p-1.5 mb-1 border-b" style={{ borderColor: theme.border }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Signatures</span>
                            <button
                              type="button"
                              onClick={() => setShowSignaturesMenu(false)}
                              className="text-xs p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-550"
                            >
                              <MdClose size={12} />
                            </button>
                          </div>
                          {signatures.length === 0 ? (
                            <p className="text-[10px] text-center p-2 opacity-60">No signatures configured</p>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {signatures.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, body: prev.body + `<br/><br/>${s.content}` }));
                                    setShowSignaturesMenu(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate text-gray-800 dark:text-gray-200 cursor-pointer flex justify-between items-center"
                                >
                                  <span className="font-semibold truncate">{s.name}</span>
                                  {s.isDefault && <span className="text-[10px] text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 rounded">Default</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Templates quick selector */}
                  {(composeMode === "mail" || composeMode === "email") && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-550 dark:text-gray-400 text-xs font-semibold"
                        title="Insert Template"
                      >
                        <MdAssignment size={16} />
                        <span className="hidden sm:inline">{t('sidebar.templates', 'Templates')}</span>
                      </button>

                      {showTemplates && (
                        <div
                          className="absolute bottom-10 right-0 md:right-auto md:left-0 w-56 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-50 p-1.5 glass"
                          style={{
                            backgroundColor: theme.cardBg,
                            borderColor: theme.border,
                            color: theme.text,
                          }}
                        >
                          <div className="flex items-center justify-between p-1.5 mb-1 border-b" style={{ borderColor: theme.border }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Templates</span>
                            <button
                              type="button"
                              onClick={() => setShowTemplates(false)}
                              className="text-xs p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-550"
                            >
                              <MdClose size={12} />
                            </button>
                          </div>
                          {allTemplates.length === 0 ? (
                            <p className="text-[10px] text-center p-2 opacity-60">No templates found</p>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {allTemplates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleApplyTemplate(t)}
                                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate text-gray-800 dark:text-gray-200 cursor-pointer"
                                >
                                  <div className="font-semibold truncate">{t.title}</div>
                                  <div className="text-[10px] opacity-60 truncate">{t.subject}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDiscard}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <MdDeleteOutline size={18} />
                  <span className="hidden sm:inline">{t('compose.discard', 'Discard')}</span>
                </button>
              </div>
            )}
          </form>
      </>
    );
  };

  if (!isComposeOpen) return null;

  const renderPreviewModal = () => {
    if (!previewFile) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black/90 z-[3100] flex flex-col animate-fade-in">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/30 border-b border-white/5 text-white select-none">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate max-w-[60vw]">
              {previewFile.fileName}
            </span>
            <span className="text-[10px] opacity-60">
              {previewFile.mimeType}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleDownloadAttachment(previewFile.fileName)}
              className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Download file"
            >
              <MdFileDownload size={20} />
            </button>
            <button
              type="button"
              onClick={closePreview}
              className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Close preview"
            >
              <MdClose size={20} />
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          {previewFile.mimeType?.startsWith("image/") ? (
            <img
              src={previewFile.blobUrl}
              alt={previewFile.fileName}
              className="max-w-full max-h-[82vh] object-contain rounded shadow-2xl select-none"
            />
          ) : previewFile.mimeType === "application/pdf" ? (
            <object
              data={previewFile.blobUrl}
              type="application/pdf"
              className="w-[90vw] h-[80vh] rounded-lg shadow-2xl bg-white border-none"
            >
              <embed
                src={previewFile.blobUrl}
                type="application/pdf"
                className="w-full h-full border-none rounded-lg"
              />
            </object>
          ) : previewFile.mimeType === "text/plain" ? (
            <pre className="bg-zinc-950 text-zinc-100 p-6 rounded-xl shadow-2xl overflow-auto max-w-[90vw] max-h-[80vh] text-left font-mono text-xs sm:text-sm leading-relaxed border border-zinc-800 hidden-scrollbar">
              {previewFile.textContent}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center bg-zinc-900/60 text-white p-8 rounded-2xl border border-zinc-800 max-w-sm text-center shadow-xl">
              <span className="text-5xl mb-4 select-none">📎</span>
              <p className="font-semibold text-sm mb-1 truncate max-w-[280px]">{previewFile.fileName}</p>
              <p className="text-[11px] text-gray-400 mb-6">No inline preview available for this file type</p>
              {previewFile.blobUrl && (
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(previewFile.fileName)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <MdFileDownload size={15} /> Download Attachment
                </button>
              )}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  if (isMobile) {
    return (
      <>
        <div
          ref={containerRef}
          onMouseDown={() => onFocusWindow?.()}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            top: isComposeMinimized ? "auto" : 0,
            height: isComposeMinimized ? "45px" : "100%",
            zIndex: previewFile ? zIndex + 1000 : (isComposeMaximized ? zIndex + 500 : zIndex),
            display: "flex",
            flexDirection: "column",
            borderRadius: isReply ? "20px 20px 0 0" : (isComposeMinimized ? "12px 12px 0 0" : "0"),
            boxShadow: isReply ? "0 10px 35px rgba(0,0,0,0.18)" : "0 12px 30px rgba(0,0,0,0.15)",
            border: isReply ? `1px solid ${theme.border || '#e5e7eb'}` : `1px solid ${theme.border}`,
            backgroundColor: isReply ? (theme.mode === 'dark' ? '#1f2937' : '#ffffff') : theme.cardBg,
            overflow: "hidden"
          }}
        >
          {renderContent()}
        </div>
        {renderPreviewModal()}
      </>
    );
  }

  return (
    <>
      <Rnd
        size={{ 
          width: size.width, 
          height: isComposeMinimized ? 45 : size.height 
        }}
        position={position}
        onDragStart={() => onFocusWindow?.()}
        onMouseDown={() => onFocusWindow?.()}
        onDragStop={(e, d) => {
          setPosition({ x: d.x, y: d.y });
          if (!isComposeMinimized && !isComposeMaximized) {
            lastNormalPosRef.current = { x: d.x, y: d.y };
          }
        }}
        onResizeStart={() => onFocusWindow?.()}
        onResizeStop={(e, direction, ref, delta, pos) => {
          const newW = parseInt(ref.style.width, 10);
          const newH = parseInt(ref.style.height, 10);
          setSize({ width: newW, height: newH });
          setPosition(pos);
          if (!isComposeMinimized && !isComposeMaximized) {
            lastNormalSizeRef.current = { width: newW, height: newH };
            lastNormalPosRef.current = pos;
          }
        }}
        minWidth={isComposeMinimized ? 200 : 350}
        minHeight={isComposeMinimized ? 45 : 300}
        maxWidth={window.innerWidth}
        maxHeight={window.innerHeight}
        enableResizing={!isComposeMinimized && !isComposeMaximized}
        disableDragging={isComposeMaximized}
        dragHandleClassName="compose-drag-handle"
        cancel="input, textarea, button, select, option, .ql-editor, [contenteditable], .compose-quill, [id^='compose-quill-toolbar'], [id^='reply-quill-toolbar']"
        enableUserSelectHack={false}
        bounds="window"
        style={{
          zIndex: previewFile ? zIndex + 1000 : (isComposeMaximized ? zIndex + 500 : zIndex),
          display: "flex",
          flexDirection: "column",
          borderRadius: isReply ? "20px" : (isComposeMinimized ? "12px 12px 0 0" : "12px 12px 0 0"),
          boxShadow: isReply ? "0 20px 50px -10px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)" : "0 12px 30px rgba(0,0,0,0.15)",
          border: isReply ? `1px solid ${theme.border || '#e5e7eb'}` : `1px solid ${theme.border}`,
          backgroundColor: isReply ? (theme.mode === 'dark' ? '#1f2937' : '#ffffff') : theme.cardBg,
          overflow: "hidden"
        }}
      >
        <div ref={containerRef} className="flex-1 flex flex-col h-full w-full overflow-hidden">
          {renderContent()}
        </div>
      </Rnd>
      {renderPreviewModal()}
    </>
  );
};

const FloatingCompose = () => {
  const { composeWindows = [], closeComposeWindow, isComposeOpen, composeData, closeCompose } = useMail();
  const [activeWindowId, setActiveWindowId] = useState(null);
  const [zIndices, setZIndices] = useState({});
  const topZRef = useRef(2000);

  const bringToFront = useCallback((winId) => {
    setActiveWindowId(winId);
    setZIndices((prev) => {
      topZRef.current += 2;
      return { ...prev, [winId]: topZRef.current };
    });
  }, []);

  // When a new window is opened, bring it to front
  useEffect(() => {
    if (composeWindows && composeWindows.length > 0) {
      const newest = composeWindows[composeWindows.length - 1];
      bringToFront(newest.id);
    }
  }, [composeWindows?.length, bringToFront]);

  // Backward compatibility fallback if legacy isComposeOpen was triggered directly
  const windowsToRender = useMemo(() => {
    if (composeWindows && composeWindows.length > 0) {
      return composeWindows;
    }
    if (isComposeOpen) {
      return [{
        id: "legacy_compose_window",
        order: 0,
        initialData: composeData
      }];
    }
    return [];
  }, [composeWindows, isComposeOpen, composeData]);

  if (windowsToRender.length === 0) return null;

  return (
    <>
      {windowsToRender.map((win, idx) => {
        const winOrder = win.order !== undefined ? win.order : idx;
        const defaultBaseZ = 2000 + winOrder * 2;
        const winZIndex = zIndices[win.id] || defaultBaseZ;
        return (
          <ComposeWindow
            key={win.id}
            windowId={win.id}
            order={winOrder}
            initialData={win.initialData || win.data}
            onClose={() => {
              if (closeComposeWindow) {
                closeComposeWindow(win.id);
              } else {
                closeCompose(win.id);
              }
            }}
            onFocusWindow={() => bringToFront(win.id)}
            isActive={activeWindowId === win.id}
            zIndex={winZIndex}
            minimizedIndex={idx}
          />
        );
      })}
    </>
  );
};

export default FloatingCompose;
