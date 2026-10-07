import React, { useState, useEffect, useRef } from "react";
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
  MdArrowDropDown
} from "react-icons/md";
import { mailAPI, api, userAPI, signatureAPI, casboxAPI, settingsAPI } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { DEFAULT_TEMPLATES } from "../pages/Templates";
import toast from "react-hot-toast";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from 'quill-image-resize-module-react';
import { attachQuillAutoCorrect, handleStandardInputAutoCorrect } from "../utils/autoCorrect";

// For quill-image-resize-module-react
window.Quill = Quill;

// Register Font & Size attributors in Quill
const Font = Quill.import('attributors/style/font');
Font.whitelist = ['Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Tahoma', 'Trebuchet MS', 'Roboto'];
Quill.register(Font, true);

const Size = Quill.import('attributors/style/size');
Size.whitelist = ['14px', '16px', '18px', '24px'];
Quill.register(Size, true);

if (!Quill.imports['modules/imageResize']) {
  Quill.register('modules/imageResize', ImageResize, true);
}

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
        }
      }
    }
    const { tooltip } = this.quill.theme;
    tooltip.edit('link', preview);
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
    openCompose
  } = useMail();

  const isReply = !!(composeData?.replyTo || composeData?.forward);
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
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [customScheduleDateTime, setCustomScheduleDateTime] = useState("");

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    return bodyVal;
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [size, setSize] = useState({ width: 540, height: 500 });
  const [position, setPosition] = useState({ x: window.innerWidth - 570, y: window.innerHeight - 520 });

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

    if (isComposeMaximized) {
      const w = Math.min(1000, window.innerWidth * 0.85);
      const h = Math.min(700, window.innerHeight * 0.85);
      setSize({ width: w, height: h });
      setPosition({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
    } else if (isComposeMinimized) {
      const w = Math.min(500, window.innerWidth - 40);
      setSize({ width: w, height: 45 });
      setPosition({ x: window.innerWidth - w - 20, y: window.innerHeight - 45 });
    } else {
      const w = Math.min(540, window.innerWidth - 40);
      const h = Math.min(500, window.innerHeight - 60);
      setSize({ width: w, height: h });
      setPosition({ x: window.innerWidth - w - 20, y: window.innerHeight - h - 20 });
    }
  }, [isComposeMaximized, isComposeMinimized, isComposeOpen, isMobile]);

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
        setAttachments([]);
        setUploading(false);
      }

      if (composeData) {
        if (!signatureInjectedRef.current) {
          if (composeData.replyTo || composeData.forward) {
            setFormData({
              to: composeData.forward ? "" : composeData.replyTo,
              cc: "",
              bcc: "",
              subject: composeData.subject || "",
              body: composeData.forward
                ? getOriginalEmailContentHTML(composeData.originalEmail)
                : (composeData.originalBody && composeData.mode !== 'casbox' && composeData.mode !== 'chat'
                    ? `<br/><br/><div>--- Original Message ---<br/>${composeData.originalBody.replace(/\n/g, '<br/>')}</div>`
                    : ""),
            });
          } else if (composeData.draft) {
            const d = composeData.draft;
            imapDraftUidRef.current = d.uid;
            if (d.id) setDraftId(d.id);
            setFormData({
              to: d.to || d.recipientEmail || "",
              cc: d.cc || "",
              bcc: d.bcc || "",
              subject: d.subject || "",
              body: d.body || d.textPlain || d.htmlBody || "",
            });
            if (d.cc) setShowCc(true);
            if (d.bcc) setShowBcc(true);
          } else {
            setFormData({
              to: composeData.to || "",
              cc: composeData.cc || "",
              bcc: composeData.bcc || "",
              subject: composeData.subject || "",
              body: composeData.body || "",
            });
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

  if (!isComposeOpen) return null;

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
          setAttachments((prev) => [...prev, info]);
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
        if (!formData.body && attachments.length === 0) {
           setError("Message text or attachment is required");
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
                receiverEmail: formData.to.trim(),
                subject: formData.subject || "Casbox Message",
                body: bodyToSend,
                attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null
            });
            toast.success("Chat message sent.");
            closeCompose();
            window.dispatchEvent(new CustomEvent('casbox_message_sent', { 
                detail: { receiverEmail: formData.to.trim(), message: res.data } 
            }));
        } catch(err) {
            setError(err.response?.data?.message || "Failed to send chat message");
            toast.error("Failed to send message");
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

  const handleClose = () => {
    const hasContent = formData.to.trim() || formData.subject.trim() || formData.body.trim() || formData.cc.trim() || formData.bcc.trim();
    if (hasContent && (composeMode === "mail" || composeMode === "email")) {
      const payload = {
        to: formData.to,
        subject: formData.subject || "(No Subject)",
        body: getFinalBody(formData.body),
        isHtml: true,
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      // Save draft in the background silently
      mailAPI.saveDraft(payload)
        .then(() => {
          if (imapDraftUidRef.current) {
            mailAPI.trash(imapDraftUidRef.current, "Drafts").catch(console.error);
            imapDraftUidRef.current = null;
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
        })
        .catch((err) => {
          console.error("Failed to auto-save draft in the background:", err);
        });
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
            }
            .reply-composer-style .ql-editor {
              padding: 12px 0 !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
              min-height: 150px !important;
            }
          `}</style>
        )}

        <style>{`
          .compose-quill .ql-container {
            overflow: visible !important;
            position: relative !important;
          }
          .compose-quill .ql-snow .ql-tooltip,
          .reply-composer-style .ql-snow .ql-tooltip {
            z-index: 100 !important;
            max-width: calc(100% - 24px) !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15) !important;
            border-radius: 8px !important;
            position: absolute !important;
          }
          .compose-quill .ql-editor {
            font-family: ${getFontFamilyCss(defaultFontFamily)};
            font-size: ${getFontSizeCss(defaultFontSize)};
            color: ${getTextColorCss(defaultTextColor)};
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
            className={`${isMobile ? "" : "compose-drag-handle"} flex items-center justify-between px-4 py-3 cursor-move shrink-0 border-b select-none`}
            style={{ 
              backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#ffffff',
              borderColor: theme.border || "rgba(0,0,0,0.1)"
            }}
            onClick={() => {
              if (isMobile && isComposeMinimized) {
                setIsComposeMinimized(false);
              }
            }}
          >
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <MdReply size={20} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer" />
              <MdArrowDropDown size={16} className="text-gray-400 -ml-1 shrink-0 cursor-pointer" />
              <span className="font-semibold text-sm truncate max-w-[200px] sm:max-w-[300px]" style={{ color: theme.text }}>
                {formData.to || composeData?.replyTo || "Recipient"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500"
                title={isComposeMinimized ? "Expand" : "Minimize"}
              >
                <MdRemove size={16} />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500"
                title="Save & Close"
              >
                <MdClose size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`${isMobile ? "" : "compose-drag-handle"} flex items-center justify-between px-4 py-2.5 cursor-move shrink-0 border-b select-none bg-gray-100 dark:bg-neutral-800 dark:border-gray-800`}
            onClick={() => {
              if (isMobile && isComposeMinimized) {
                setIsComposeMinimized(false);
              }
            }}
          >
            {/* Mode Switch: [ Chat ] [ Mail ] */}
            <div 
              className="inline-flex items-center bg-gray-200/90 dark:bg-neutral-700/80 p-0.5 rounded-lg border border-gray-300/40 dark:border-neutral-600/40"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setComposeMode("chat")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  composeMode === "chat" || composeMode === "casbox"
                    ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Chat
              </button>
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
            </div>
            <div className="flex items-center gap-1">
              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
                  title={isComposeMinimized ? "Expand" : "Minimize"}
                >
                  <MdRemove size={16} />
                </button>
              )}
              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setIsComposeMaximized(!isComposeMaximized)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
                  title={isComposeMaximized ? "Restore" : "Maximize"}
                >
                  {isComposeMaximized ? <MdCloseFullscreen size={16} /> : <MdOpenInFull size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
                title="Save & Close"
              >
                <MdClose size={16} />
              </button>
            </div>
          </div>
        )}

        {/* BODY CONTENT (HIDDEN WHEN MINIMIZED) */}
        {!isComposeMinimized && (
          <form onSubmit={handleSend} className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 bg-transparent">
          {/* ALERTS */}
          {error && (
            <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30 text-xs font-medium shrink-0">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 text-xs font-medium shrink-0">
              {success}
            </div>
          )}

          {/* FIELDS */}
          <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto hidden-scrollbar min-h-0 pr-1">
            {/* Cc & Bcc toggles */}
            {!isReply && (composeMode === "mail" || composeMode === "email") && (
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
            {!isReply && (composeMode === "chat" || composeMode === "casbox") && (
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
                />
              </div>
            )}

            {/* CC */}
            {!isReply && showCc && (composeMode === "mail" || composeMode === "email") && (
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
            {!isReply && showBcc && (composeMode === "mail" || composeMode === "email") && (
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
              {!isReply && (
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
              )}

              {/* BODY */}
              <div className={`flex-1 mt-2 overflow-y-auto w-full compose-quill rounded-md ${isReply ? 'reply-composer-style' : ''}`} style={{ minHeight: "150px" }}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  modules={dynamicQuillModules}
                  bounds="self"
                  value={formData.body}
                  onChange={(content) => setFormData((prev) => ({ ...prev, body: content }))}
                  placeholder={composeData?.forward ? "Type your forwarded message here..." : "Type your message here..."}
                  className="h-full bg-white text-black"
                />
              </div>

              {/* ATTACHMENT CHIPS RENDERING */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 py-2 mt-2 border-t" style={{ borderColor: theme.border }}>
                  {attachments.map((file, i) => (
                    <div 
                      key={i}
                      className="flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.04] border px-2.5 py-1 rounded-xl text-xs"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <span className="truncate max-w-[150px]">{file.fileName}</span>
                      <span className="opacity-55 font-medium">({Math.round(file.size / 1024)} KB)</span>
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
            </div>

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
              <div className="flex items-center justify-between border-t pt-3 mt-2 shrink-0 relative" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* SPLIT SEND BUTTON */}
                  <div className="inline-flex items-center rounded-full overflow-hidden shadow-sm hover:shadow transition-all" style={{ backgroundColor: theme.accent || '#135bec' }}>
                    <button
                      type="submit"
                      disabled={sending || uploading}
                      className="px-5 py-2 text-white text-xs font-bold disabled:opacity-60 cursor-pointer border-r border-white/20"
                    >
                      {sending ? t('compose.sending', 'Sending...') : t('compose.send_email', 'Send')}
                    </button>
                    {(composeMode === "mail" || composeMode === "email") && (
                      <button
                        type="button"
                        disabled={sending || uploading}
                        onClick={() => {
                          setShowScheduleMenu(!showScheduleMenu);
                          setShowCustomSchedule(false);
                        }}
                        className="px-3 py-2 text-white disabled:opacity-60 cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors"
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
                  <div id="reply-quill-toolbar" className="flex flex-wrap items-center gap-1 sm:gap-2.5 text-gray-700 dark:text-gray-300">
                    <select className="ql-header bg-transparent border border-gray-200 dark:border-neutral-700 rounded px-1.5 py-1 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Normal</option>
                      <option value="1">Heading 1</option>
                      <option value="2">Heading 2</option>
                    </select>
                    
                    <button className="ql-bold font-bold hover:bg-black/5 dark:hover:bg-white/5 !w-7 !h-7 rounded flex items-center justify-center text-sm">B</button>
                    <button className="ql-italic italic hover:bg-black/5 dark:hover:bg-white/5 !w-7 !h-7 rounded flex items-center justify-center text-sm">I</button>
                    <button className="ql-underline underline hover:bg-black/5 dark:hover:bg-white/5 !w-7 !h-7 rounded flex items-center justify-center text-sm">U</button>
                    <button className="ql-strike line-through hover:bg-black/5 dark:hover:bg-white/5 !w-7 !h-7 rounded flex items-center justify-center text-sm">S</button>
                    <button className="ql-blockquote hover:bg-black/5 dark:hover:bg-white/5 !w-7 !h-7 rounded flex items-center justify-center text-[15px] font-bold">”</button>
                    
                    <button className="ql-list !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5" value="bullet" title="Bullet List"></button>
                    <button className="ql-list !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5" value="ordered" title="Numbered List"></button>
                    <button className="ql-indent !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5" value="-1" title="Decrease Indent"></button>
                    <button className="ql-indent !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5" value="+1" title="Increase Indent"></button>
                    
                    <button className="ql-link !w-7 !h-7 rounded flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5" title="Insert Link"></button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-550 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                    title="Attach file"
                  >
                    <MdAttachFile size={18} className="transform rotate-45" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSignaturesMenu(!showSignaturesMenu)}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-550 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                      title="Insert Signature"
                    >
                      <MdEditDocument size={18} />
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold transition-colors cursor-pointer"
                    title="Discard draft"
                  >
                    <MdDeleteOutline size={18} />
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
                      className="flex items-center gap-1.5 px-4 py-2 rounded-l-full text-white text-xs font-semibold disabled:opacity-60 cursor-pointer border-r border-white/20"
                      style={{ background: `linear-gradient(135deg, ${theme.accent || '#135bec'} 0%, #3b82f6 100%)` }}
                    >
                      {sending ? t('compose.sending', 'Sending...') : t('compose.send_email', 'Send')}
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
        )}
      </>
    );
  };

  if (isMobile) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          top: isComposeMinimized ? "auto" : 0,
          height: isComposeMinimized ? "45px" : "100%",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          borderRadius: isReply ? "16px 16px 0 0" : (isComposeMinimized ? "12px 12px 0 0" : "0"),
          boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
          border: `1px solid ${theme.border}`,
          backgroundColor: isReply ? (theme.name === 'dark' ? theme.cardBg : '#ffffff') : theme.cardBg,
          overflow: "hidden"
        }}
      >
        {renderContent()}
      </div>
    );
  }

  return (
    <Rnd
      size={{ 
        width: size.width, 
        height: isComposeMinimized ? 45 : size.height 
      }}
      position={position}
      onDragStop={(e, d) => {
        setPosition({ x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, pos) => {
        setSize({
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10)
        });
        setPosition(pos);
      }}
      minWidth={350}
      minHeight={isComposeMinimized ? 45 : 300}
      maxWidth={window.innerWidth}
      maxHeight={window.innerHeight}
      enableResizing={!isComposeMinimized}
      disableDragging={isComposeMaximized}
      dragHandleClassName="compose-drag-handle"
      bounds="window"
      style={{
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        borderRadius: isReply ? "16px" : "12px 12px 0 0",
        boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
        border: `1px solid ${theme.border}`,
        backgroundColor: isReply ? (theme.name === 'dark' ? theme.cardBg : '#ffffff') : theme.cardBg,
        overflow: "hidden"
      }}
    >
      {renderContent()}
    </Rnd>
  );
};

export default FloatingCompose;
