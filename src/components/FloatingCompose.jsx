import React, { useState, useEffect, useRef } from "react";
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
  MdPersonOutline
} from "react-icons/md";
import { mailAPI, api, userAPI, signatureAPI, casboxAPI, settingsAPI } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { DEFAULT_TEMPLATES } from "../pages/Templates";
import toast from "react-hot-toast";

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
Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'];
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

const FloatingCompose = () => {
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
    isComposeOpen, 
    closeCompose, 
    isComposeMinimized, 
    setIsComposeMinimized, 
    isComposeMaximized, 
    setIsComposeMaximized, 
    composeData,
    fetchEmails,
    fetchEmailsSilently,
    invalidateCache,
    handleEmailSent,
    currentFolder,
    openCompose,
    updateDraftInState,
    updateDraftUidInState
  } = useMail();

  const isReply = Boolean(composeData?.replyTo);
  const fileInputRef = useRef(null);

  const [composeMode, setComposeMode] = useState("mail"); // "chat" or "mail"

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

      if (fileItem?.rawFile instanceof Blob) {
        url = window.URL.createObjectURL(fileItem.rawFile);
        if (mime === "text/plain") {
          textContent = await fileItem.rawFile.text();
        }
      } else {
        const draftUid = imapDraftUidRef.current || composeData?.draft?.uid;
        if (draftUid) {
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
        } else if (fileItem?.url) {
          const res = await api.get(fileItem.url, { responseType: 'blob' });
          const blob = new Blob([res.data], { type: mime });
          url = window.URL.createObjectURL(blob);
          if (mime === "text/plain") {
            textContent = await blob.text();
          }
        } else {
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
        rawFile: fileItem?.rawFile
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [size, setSize] = useState({ width: 540, height: 500 });
  const [position, setPosition] = useState({ x: window.innerWidth - 570, y: window.innerHeight - 520 });
  const lastNormalSizeRef = useRef({ width: 540, height: 500 });
  const lastNormalPosRef = useRef(null);

  const handleMinimizeToggle = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (isComposeMinimized) {
      setIsComposeMinimized(false);
    } else {
      setIsComposeMinimized(true);
    }
  };

  const handleMaximizeToggle = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (isComposeMinimized) {
      // If currently minimized, clicking maximize un-minimizes AND maximizes into full view
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
    if (!isComposeOpen || isMobile) return;

    if (isComposeMinimized) {
      // Minimized state: docked compact header bar at bottom-right
      const w = Math.min(500, window.innerWidth - 40);
      setSize({ width: w, height: 45 });
      setPosition({ x: window.innerWidth - w - 20, y: window.innerHeight - 45 });
    } else if (isComposeMaximized) {
      // Maximized state: full screen / viewport view
      const w = Math.max(350, Math.min(1200, window.innerWidth - 40));
      const h = Math.max(400, window.innerHeight - 60);
      setSize({ width: w, height: h });
      setPosition({
        x: Math.max(10, Math.round((window.innerWidth - w) / 2)),
        y: Math.max(10, Math.round((window.innerHeight - h) / 2)),
      });
    } else {
      // Normal state: restore user's preferred normal size & position
      const defaultW = isReply ? Math.min(580, window.innerWidth - 40) : Math.min(540, window.innerWidth - 40);
      const defaultH = isReply ? Math.min(620, window.innerHeight - 60) : Math.min(500, window.innerHeight - 60);
      const savedW = lastNormalSizeRef.current?.width || defaultW;
      const savedH = lastNormalSizeRef.current?.height || defaultH;
      const w = isReply ? Math.min(580, window.innerWidth - 40) : Math.min(savedW, window.innerWidth - 40);
      const h = isReply ? Math.min(620, window.innerHeight - 60) : Math.min(savedH, window.innerHeight - 60);

      const defaultX = window.innerWidth - w - 24;
      const defaultY = window.innerHeight - h - 24;
      const savedX = lastNormalPosRef.current?.x !== undefined ? lastNormalPosRef.current.x : defaultX;
      const savedY = lastNormalPosRef.current?.y !== undefined ? lastNormalPosRef.current.y : defaultY;
      const x = isReply ? defaultX : Math.max(10, Math.min(savedX, window.innerWidth - w - 10));
      const y = isReply ? defaultY : Math.max(10, Math.min(savedY, window.innerHeight - h - 10));

      setSize({ width: w, height: h });
      setPosition({ x, y });
    }
  }, [isComposeMaximized, isComposeMinimized, isComposeOpen, isMobile, isReply]);

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
      // Only set initial empty state once when opening
      if (!signatureInjectedRef.current && signatures.length === 0) {
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

            const replyForm = {
              to: composeData.replyTo,
              cc: composeData.cc || "",
              bcc: composeData.bcc || "",
              subject: composeData.subject || "",
              body: "",
            };
            setFormData(replyForm);
            initialFormDataRef.current = { ...replyForm };
            if (composeData.cc) setShowCc(true);
            if (composeData.bcc) setShowBcc(true);
          } else if (composeData.forward) {
            setQuotedMessage("");
            const replyForm = {
              to: "",
              cc: "",
              bcc: "",
              subject: composeData.subject || "",
              body: getOriginalEmailContentHTML(composeData.originalEmail),
            };
            setFormData(replyForm);
            initialFormDataRef.current = { ...replyForm };
          } else if (composeData.draft) {
            const d = composeData.draft;
            isEditingExistingDraftRef.current = true;
            selectedDraftIdRef.current = d.uid !== undefined && d.uid !== null ? String(d.uid) : (d.id !== undefined && d.id !== null ? String(d.id) : null);
            originalDraftSnapshotRef.current = {
              uid: d.uid,
              id: d.id,
              to: d.to || d.recipientEmail || "",
              cc: d.cc || "",
              bcc: d.bcc || "",
              subject: d.subject || "",
              body: d.body || d.textPlain || d.htmlBody || "",
            };
            imapDraftUidRef.current = d.uid;
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
            if (d.cc) setShowCc(true);
            if (d.bcc) setShowBcc(true);
            let loadedAttachments = [];
            if (Array.isArray(d.attachments) && d.attachments.length > 0) {
              loadedAttachments = d.attachments.map(att => typeof att === 'string' ? { fileName: att, size: 0 } : att);
            } else if (d.attachmentsJson) {
              try {
                loadedAttachments = JSON.parse(d.attachmentsJson);
              } catch (e) {}
            }
            if (loadedAttachments.length > 0) {
              setAttachments(loadedAttachments);
            }
          } else {
            isEditingExistingDraftRef.current = false;
            originalDraftSnapshotRef.current = null;
            const initialForm = {
              to: composeData.to || "",
              cc: composeData.cc || "",
              bcc: composeData.bcc || "",
              subject: composeData.subject || "",
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
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

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
          setAttachments((prev) => [...prev, { ...info, rawFile: file }]);
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
    if (!draftId) return;
    try {
      toast.loading(`Removing ${fileName}...`, { id: "remove-attachment" });
      const res = await mailAPI.removeDraftAttachment(draftId, fileName);
      if (res.data?.success) {
        setAttachments((prev) => prev.filter((a) => a.fileName !== fileName));
        toast.success("Attachment removed", { id: "remove-attachment" });
      }
    } catch (err) {
      console.error("Failed to remove attachment:", err);
      toast.error("Failed to remove attachment", { id: "remove-attachment" });
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
    try {
      const res = await casboxAPI.validateRecipient(raw);
      if (res?.data && res.data.valid === false) {
        setError("Invalid email ID. This BNXmail account does not exist.");
      }
    } catch (err) {
      if (err?.response?.status === 400 || err?.response?.data?.valid === false) {
        setError("Invalid email ID. This BNXmail account does not exist.");
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

    if (!formData.to) {
      setError("Recipient email is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (composeMode === "chat" || composeMode === "casbox") {
        const rawReceiver = (formData.to || "").trim();
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

        if (!formData.body && attachments.length === 0) {
           setError("Message text or attachment is required");
           sendingRef.current = false;
           setSending(false);
           return;
        }

        // Validate recipient existence against backend before sending
        let isInvalidAccount = false;
        try {
           const checkRes = await casboxAPI.validateRecipient(rawReceiver);
           if (checkRes?.data && checkRes.data.valid === false) {
              isInvalidAccount = true;
           }
        } catch (valErr) {
           console.error("Recipient validation failed:", valErr);
           const status = valErr?.response?.status;
           if (status === 400 || valErr?.response?.data?.valid === false) {
              isInvalidAccount = true;
           }
        }

        if (isInvalidAccount) {
           const notFoundMsg = "Invalid email ID. This BNXmail account does not exist.";
           setError(notFoundMsg);
           toast.error(notFoundMsg);
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
            } else if (/does not exist|account does not exist|invalid recipient|invalid email/i.test(rawMsg)) {
              errMsg = "Invalid email ID. This BNXmail account does not exist.";
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

    if (!formData.subject) {
      setError("Subject is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (uploading) {
      setError("Please wait for files to finish uploading");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    const delaySeconds = Number(undoSendDelay);

    const payload = {
      to: formData.to,
      subject: formData.subject,
      body: getFinalBody(formData.body),
      isHtml: true
    };
    if (formData.cc) payload.cc = formData.cc;
    if (formData.bcc) payload.bcc = formData.bcc;

    const executeSend = async (tid) => {
      try {
        let response;
        if (draftId) {
          await mailAPI.createDbDraft({
            id: draftId,
            ...payload,
            isHtml: true
          });
          response = await mailAPI.sendDbDraft(draftId);
        } else {
          response = await mailAPI.send(payload);
        }

        if (response.data?.success) {
          if (delaySeconds > 0) {
            toast.dismiss(tid);
          } else {
            toast.success("Message sent.", { id: tid, duration: 4000 });
            closeCompose();
          }

          const currentImapDraftUid = imapDraftUidRef.current;
          const currentDraftId = draftId;
          const currentDraftUid = composeData?.draft?.uid || composeData?.draft?.id;
          imapDraftUidRef.current = null;
          setDraftId(null);

          if (handleEmailSent) {
            handleEmailSent({
              draftId: currentDraftId,
              draftUid: currentDraftUid,
              imapDraftUid: currentImapDraftUid,
              sentEmail: response.data?.data
            });
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to send email");
        toast.error("Failed to send email", { id: tid });
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    };

    if (delaySeconds > 0) {
      let isUndone = false;
      
      // Fake instant send by closing compose immediately
      closeCompose();
      
      const toastId = toast((t) => (
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
      });

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
      const toastId = toast.loading("Sending email...", { position: "bottom-center" });
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

    if (!formData.to) {
      setError("Recipient email is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (!formData.subject) {
      setError("Subject is required");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    if (uploading) {
      setError("Please wait for files to finish uploading");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    try {
      const payload = {
        to: formData.to,
        subject: formData.subject,
        body: getFinalBody(formData.body),
        attachments: attachments,
        isHtml: true
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      const response = await mailAPI.scheduleEmail(payload, sendAtIso);

      if (response.data?.success) {
        setSuccess("Email scheduled successfully");
        toast.success("Email scheduled successfully");
        if (invalidateCache) invalidateCache('scheduled');
        window.dispatchEvent(new CustomEvent('bnx_scheduled_changed'));
        setTimeout(() => {
          closeCompose();
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to schedule email");
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

      const payload = {
        uid: targetUid,
        id: targetId,
        to: formData.to,
        subject: formData.subject || "(No Subject)",
        body: getFinalBody(formData.body),
        isHtml: true,
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      const res = await mailAPI.saveDraft(payload);
      const savedData = res.data?.data;
      if (savedData && savedData.uid) {
        imapDraftUidRef.current = savedData.uid;
        if (targetDraftId && String(savedData.uid) !== String(targetDraftId)) {
          if (typeof updateDraftUidInState === 'function') {
            updateDraftUidInState(targetDraftId, savedData.uid);
          }
          selectedDraftIdRef.current = String(savedData.uid);
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
        (formData.body || '').trim() !== (init.body || '').trim()
      );

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
          });
        }

        // 2. Persist to backend without blocking or showing alerts
        const targetUid = imapDraftUidRef.current ? String(imapDraftUidRef.current) : (composeData?.draft?.uid ? String(composeData.draft.uid) : null);
        const targetId = draftId || composeData?.draft?.id || null;

        const payload = {
          uid: targetUid,
          id: targetId,
          to: formData.to,
          subject: formData.subject || "(No Subject)",
          body: getFinalBody(formData.body),
          isHtml: true,
        };
        if (formData.cc) payload.cc = formData.cc;
        if (formData.bcc) payload.bcc = formData.bcc;

        mailAPI.saveDraft(payload).then((res) => {
          const savedData = res.data?.data;
          if (savedData?.uid && String(savedData.uid) !== String(targetDraftId)) {
            if (typeof updateDraftUidInState === 'function') {
              updateDraftUidInState(targetDraftId, savedData.uid);
            }
          }
        }).catch((err) => {
          console.error("Failed to persist draft on close:", err);
        });
      }

      // Close the composer immediately without any alert or confirmation popup
      closeCompose();
      return;
    }

    // Normal new-compose behavior: save as draft if user typed content
    const hasContent = Boolean(
      formData.to?.trim() ||
      formData.subject?.trim() ||
      formData.body?.trim() ||
      formData.cc?.trim() ||
      formData.bcc?.trim()
    );
    if (hasContent && (composeMode === "mail" || composeMode === "email")) {
      const payload = {
        to: formData.to,
        subject: formData.subject || "(No Subject)",
        body: getFinalBody(formData.body),
        isHtml: true,
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      mailAPI.saveDraft(payload).then(() => {
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
    closeCompose();
  };

  const handleDiscard = async () => {
    if (window.confirm("Discard this email?")) {
      const discDraftId = draftId;
      const discImapUid = imapDraftUidRef.current;
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
    const dynamicQuillModules = {
      toolbar: {
        container: isReply ? "#reply-quill-toolbar" : [
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
            #reply-quill-toolbar button {
              cursor: pointer !important;
            }
            #reply-quill-toolbar button.ql-active {
              background-color: rgba(59, 130, 246, 0.15) !important;
              color: #2563eb !important;
            }
            #reply-quill-toolbar button.ql-list svg,
            #reply-quill-toolbar button.ql-indent svg,
            #reply-quill-toolbar button.ql-link svg {
              width: 15px !important;
              height: 15px !important;
            }
            #reply-quill-toolbar .ql-stroke {
              stroke: #4b5563 !important;
            }
            .dark #reply-quill-toolbar .ql-stroke {
              stroke: #d1d5db !important;
            }
            #reply-quill-toolbar .ql-fill {
              fill: #4b5563 !important;
            }
            .dark #reply-quill-toolbar .ql-fill {
              fill: #d1d5db !important;
            }
          `}</style>
        )}

        <style>{`
          .compose-quill {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          .compose-quill .quill {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
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
            {/* Mode Switch: [ Mail ] [ Casbox ] */}
            <div 
              className="inline-flex items-center bg-gray-200/90 dark:bg-neutral-700/80 p-0.5 rounded-lg border border-gray-300/40 dark:border-neutral-600/40"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setComposeMode("mail")}
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
                onClick={() => setComposeMode("chat")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  composeMode === "chat" || composeMode === "casbox"
                    ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Casbox
              </button>
            </div>
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
                    <input
                      type="text"
                      name="to"
                      autoFocus
                      className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                      placeholder="Recipient email..."
                      value={formData.to}
                      onChange={handleChange}
                    />
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
                    value={formData.cc}
                    onChange={handleChange}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                    placeholder="carboncopy@example.com"
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
                    value={formData.bcc}
                    onChange={handleChange}
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400 text-sm"
                    placeholder="blindcopy@example.com"
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
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full bg-transparent font-bold text-sm text-gray-800 dark:text-gray-100 outline-none border-none placeholder-gray-400"
                  placeholder="Subject..."
                />
              </div>
            </div>
          ) : (
            <div className="shrink-0 flex flex-col gap-0.5">
              {/* Cc & Bcc toggles */}
              {(composeMode === "mail" || composeMode === "email") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0">
                  <div className="text-gray-400 dark:text-gray-500 w-10">{t('compose.to', 'To')}</div>
                  <input
                    type="text"
                    name="to"
                    autoFocus
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400"
                    placeholder={t('compose.recipients', 'Recipients')}
                    value={formData.to}
                    onChange={handleChange}
                  />
                  <div className="flex gap-2 text-gray-500 font-medium">
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
                  <div className="text-gray-400 dark:text-gray-500 w-10">To</div>
                  <input
                    type="text"
                    name="to"
                    autoFocus
                    className="flex-1 outline-none bg-transparent dark:text-gray-100 placeholder-gray-400"
                    placeholder="Chat / Casbox Recipient (Email or Username)"
                    value={formData.to}
                    onChange={handleChange}
                    onBlur={handleCasboxRecipientBlur}
                  />
                </div>
              )}

              {/* CC */}
              {showCc && (composeMode === "mail" || composeMode === "email") && (
                <div className="flex px-4 py-2 border-b items-center text-sm dark:border-gray-800 shrink-0 animate-fade-in" style={{ borderColor: theme.border }}>
                  <div className="text-gray-400 dark:text-gray-500 w-10">Cc:</div>
                  <input
                    type="text"
                    name="cc"
                    value={formData.cc}
                    onChange={handleChange}
                    onKeyDown={(e) => handleStandardInputAutoCorrect(e, autoCorrect)}
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
                    value={formData.bcc}
                    onChange={handleChange}
                    onKeyDown={(e) => handleStandardInputAutoCorrect(e, autoCorrect)}
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
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onKeyDown={(e) => handleStandardInputAutoCorrect(e, autoCorrect)}
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
          <div className={`flex-1 min-h-0 flex flex-col w-full compose-quill overflow-hidden ${isReply ? 'reply-composer-style px-5' : 'mt-2 rounded-md'}`}>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              modules={dynamicQuillModules}
              bounds="self"
              value={formData.body}
              onChange={(content) => setFormData((prev) => ({ ...prev, body: content }))}
              placeholder={isReply ? "Write your reply..." : (composeData?.forward ? "Type your forwarded message here..." : "Type your message here...")}
              className="flex-1 min-h-0 flex flex-col h-full bg-white text-black"
            />
          </div>

          {/* ATTACHMENT CHIPS RENDERING - FIXED / NON-SHRINKING */}
          {attachments.length > 0 && (
            <div className="shrink-0 flex flex-wrap gap-2 py-2 mt-2 border-t max-h-24 overflow-y-auto" style={{ borderColor: theme.border }}>
              {attachments.map((file, i) => (
                <div 
                  key={file.fileName || i}
                  className="flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.04] border px-2.5 py-1 rounded-xl text-xs"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <span 
                    onClick={() => handlePreviewAttachment(file)}
                    className="truncate max-w-[150px] cursor-pointer hover:underline text-blue-600 dark:text-blue-400"
                    title="Click to preview"
                  >
                    {file.fileName}
                  </span>
                  <span className="opacity-55 font-medium">({Math.round((file.size || 0) / 1024)} KB)</span>
                  <button 
                    type="button" 
                    onClick={() => handlePreviewAttachment(file)}
                    className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded cursor-pointer"
                    title="Preview attachment"
                  >
                    <MdRemoveRedEye size={14} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveAttachment(file.fileName)}
                    className="text-red-500 hover:text-red-700 font-bold text-sm leading-none cursor-pointer"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
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
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 flex-1 min-w-0">
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
                  <div id="reply-quill-toolbar" className="flex items-center flex-wrap gap-1 sm:gap-1.5 text-gray-700 dark:text-gray-300">
                    <select className="ql-header bg-transparent border-none text-gray-700 dark:text-gray-200 text-xs font-semibold outline-none cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 px-1.5 py-1 rounded">
                      <option value="">Normal</option>
                      <option value="1">Heading 1</option>
                      <option value="2">Heading 2</option>
                    </select>

                    <button type="button" className="ql-bold font-bold hover:bg-black/5 dark:hover:bg-white/10 !w-7 !h-7 rounded flex items-center justify-center text-sm" title="Bold">B</button>
                    <button type="button" className="ql-italic italic hover:bg-black/5 dark:hover:bg-white/10 !w-7 !h-7 rounded flex items-center justify-center text-sm" title="Italic">I</button>
                    <button type="button" className="ql-underline underline hover:bg-black/5 dark:hover:bg-white/10 !w-7 !h-7 rounded flex items-center justify-center text-sm" title="Underline">U</button>
                    <button type="button" className="ql-strike line-through hover:bg-black/5 dark:hover:bg-white/10 !w-7 !h-7 rounded flex items-center justify-center text-sm" title="Strikethrough">S</button>
                    <button type="button" className="ql-blockquote hover:bg-black/5 dark:hover:bg-white/10 !w-7 !h-7 rounded flex items-center justify-center text-[15px] font-bold" title="Quote">”</button>

                    <button type="button" className="ql-list !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10" value="bullet" title="Bullet List"></button>
                    <button type="button" className="ql-list !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10" value="ordered" title="Numbered List"></button>
                    <button type="button" className="ql-indent !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10" value="-1" title="Decrease Indent"></button>
                    <button type="button" className="ql-indent !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10" value="+1" title="Increase Indent"></button>

                    <button type="button" className="ql-link !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10" title="Insert Link"></button>
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
      <div className="fixed inset-0 bg-black/90 z-[1000] flex flex-col animate-fade-in">
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
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            top: isComposeMinimized ? "auto" : 0,
            height: isComposeMinimized ? "45px" : "100%",
            zIndex: previewFile ? 1100 : 100,
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
        onDragStop={(e, d) => {
          setPosition({ x: d.x, y: d.y });
          if (!isComposeMinimized && !isComposeMaximized) {
            lastNormalPosRef.current = { x: d.x, y: d.y };
          }
        }}
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
        minWidth={350}
        minHeight={isComposeMinimized ? 45 : 300}
        maxWidth={window.innerWidth}
        maxHeight={window.innerHeight}
        enableResizing={!isComposeMinimized && !isComposeMaximized}
        disableDragging={isComposeMaximized}
        dragHandleClassName="compose-drag-handle"
        bounds="window"
        style={{
          zIndex: previewFile ? 1100 : 100,
          display: "flex",
          flexDirection: "column",
          borderRadius: isReply ? "20px" : (isComposeMinimized ? "12px 12px 0 0" : "12px 12px 0 0"),
          boxShadow: isReply ? "0 20px 50px -10px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)" : "0 12px 30px rgba(0,0,0,0.15)",
          border: isReply ? `1px solid ${theme.border || '#e5e7eb'}` : `1px solid ${theme.border}`,
          backgroundColor: isReply ? (theme.mode === 'dark' ? '#1f2937' : '#ffffff') : theme.cardBg,
          overflow: "hidden"
        }}
      >
        {renderContent()}
      </Rnd>
      {renderPreviewModal()}
    </>
  );
};

export default FloatingCompose;
