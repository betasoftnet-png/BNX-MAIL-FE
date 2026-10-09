import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { 
  MdArchive, 
  MdUnarchive, 
  MdDelete, 
  MdStar, 
  MdAccessTime, 
  MdLabel, 
  MdReply, 
  MdForward,
  MdStarBorder,
  MdFileDownload,
  MdRemoveRedEye,
  MdClose,
  MdWbSunny, 
  MdNightsStay, 
  MdToday, 
  MdEvent, 
  MdUpdate, 
  MdDateRange,
  MdChevronLeft,
  MdChevronRight,
  MdOpenInFull,
  MdCloseFullscreen,
  MdPrint,
  MdMarkEmailUnread,
  MdBlock,
  MdAdd,
  MdReport,
  MdArrowDropDown,
  MdFormatSize,
  MdAutoAwesome,
  MdAttachFile,
  MdLink,
  MdSentimentSatisfiedAlt,
  MdCloudQueue,
  MdImage,
  MdLock,
  MdEditDocument,
  MdCheck
} from "react-icons/md";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/LanguageContext";
import { mailAPI, reportAPI, blockedContactsAPI } from "../services/api";
import toast from "react-hot-toast";
import logo from "../assets/bnx-remove.png";
import html2pdf from "html2pdf.js";

const getMimeType = (fileName) => {
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

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf':
      return { icon: '📄', color: '#ea4335', name: 'PDF' };
    case 'doc':
    case 'docx':
      return { icon: '📝', color: '#1a73e8', name: 'Word' };
    case 'xls':
    case 'xlsx':
      return { icon: '📊', color: '#1e8e3e', name: 'Excel' };
    case 'ppt':
    case 'pptx':
      return { icon: '📈', color: '#f86734', name: 'PowerPoint' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return { icon: '🖼️', color: '#12a4b4', name: 'Image' };
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return { icon: '📦', color: '#e37400', name: 'Archive' };
    case 'mp3':
    case 'wav':
    case 'ogg':
      return { icon: '🎵', color: '#aa00ff', name: 'Audio' };
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
      return { icon: '🎥', color: '#d500f9', name: 'Video' };
    default:
      return { icon: '📎', color: '#5f6368', name: 'File' };
  }
};

const EmailDetails = ({
  email,
  onBack,
  onReply,
  onForward,
  onDelete,
  onStar,
  onArchive,
  onUnarchive,
  onSnooze,
  onApplyLabel,
  onClose,
  isArchiveFolder = false,
  isTrash = false,
  onRestore,
  emailList = [],
  onNavigate,
}) => {
  const { theme, readingPaneMode } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { labels, fetchLabels, handleRemoveLabel, handleCreateLabel, fetchEmails, currentFolder, handleMarkUnread, handleEmailSent, handleApplyLabel, handleSnooze } = useMail();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const snoozeAction = onSnooze || handleSnooze;
  const applyLabelAction = onApplyLabel || handleApplyLabel;

  const [localLabels, setLocalLabels] = useState(email?.labels || []);
  const [isSnoozing, setIsSnoozing] = useState(false);
  const [isApplyingLabel, setIsApplyingLabel] = useState(false);

  useEffect(() => {
    setLocalLabels(email?.labels || []);
  }, [email?.labels, email?.uid]);

  const snoozeRef = React.useRef(null);
  const labelsRef = React.useRef(null);

  const normalizeEmail = (addr) => {
    if (!addr) return "";
    let clean = addr;
    if (clean.includes("<")) {
      clean = clean.split("<")[1].split(">")[0];
    }
    return clean.trim().toLowerCase();
  };

  const normalizedSender = normalizeEmail(email?.from);

  const cleanSenderEmail = email?.from
    ? (email.from.includes("<")
        ? email.from.split("<")[1].split(">")[0].trim()
        : email.from.trim())
    : "";

  const isSystemEmail = cleanSenderEmail.toLowerCase().includes("mailer-daemon") || 
                        cleanSenderEmail.toLowerCase().includes("postmaster") || 
                        cleanSenderEmail.toLowerCase().includes("noreply") ||
                        cleanSenderEmail.toLowerCase().includes("no-reply");

    const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    blockedContactsAPI.getBlockedContacts()
      .then(res => {
        if (isMounted && res.data && res.data.data) {
          const list = res.data.data.map(c => typeof c === 'string' ? c : c.email);
          setBlockedContacts(list);
        }
      })
      .catch(err => {
        console.error("Failed to load blocked contacts from backend", err);
      });
    return () => { isMounted = false; };
  }, [normalizedSender]);

  const isBlocked = normalizedSender ? blockedContacts.some(c => c.toLowerCase() === normalizedSender.toLowerCase()) : false;

  const handleToggleBlock = async () => {
    if (!normalizedSender) return;
    try {
      if (isBlocked) {
        toast.loading("Unblocking sender...", { id: "block-toggle" });
        await blockedContactsAPI.unblockSender(normalizedSender);
        setBlockedContacts(prev => prev.filter(c => c.toLowerCase() !== normalizedSender.toLowerCase()));
        toast.success("Sender unblocked successfully.", { id: "block-toggle" });
      } else {
        toast.loading("Blocking sender...", { id: "block-toggle" });
        await blockedContactsAPI.blockSender(normalizedSender);
        setBlockedContacts(prev => [...prev, normalizedSender]);
        toast.success("Sender blocked successfully.", { id: "block-toggle" });
      }
      if (fetchEmails) {
        fetchEmails(currentFolder || "inbox");
      }
    } catch (err) {
      console.error("Failed to toggle block status", err);
      toast.error("Failed to update block status", { id: "block-toggle" });
    } finally {
      setShowBlockModal(false);
    }
  };

  const handleUnsubscribeClick = async (targetSender = null) => {
    const emailToUnsub = targetSender || cleanSenderEmail;
    if (!emailToUnsub) return;
    const confirmUnsubscribe = window.confirm(`Are you sure you want to unsubscribe and block future emails from ${emailToUnsub}?`);
    if (confirmUnsubscribe) {
      try {
        toast.loading("Unsubscribing...", { id: "unsubscribe" });
        await Promise.allSettled([
          mailAPI.unsubscribe ? mailAPI.unsubscribe(emailToUnsub) : Promise.resolve(),
          blockedContactsAPI.blockSender(emailToUnsub)
        ]);
        toast.success(`Unsubscribed from ${emailToUnsub}`, { id: "unsubscribe" });
        if (fetchEmails) {
          fetchEmails(currentFolder || "inbox");
        }
        if (onBack) {
          onBack();
        }
      } catch (error) {
        console.error("Failed to unsubscribe:", error);
        toast.error("Failed to unsubscribe", { id: "unsubscribe" });
      }
    }
  };
  const isActuallyArchived = isArchiveFolder || email.folderName?.toLowerCase() === "archive";
  const [showReply, setShowReply] = useState(false);
  const [replyMode, setReplyMode] = useState("reply"); // 'reply' or 'forward'
  const [replyBody, setReplyBody] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const sendingReplyRef = React.useRef(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  // File Upload states and ref
  const fileInputRef = React.useRef(null);
  const [draftId, setDraftId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      let activeDraftId = draftId;

      if (!activeDraftId) {
        const payload = {
          to: replyMode === 'forward' ? forwardTo : cleanSenderEmail,
          cc: "",
          bcc: "",
          subject: replyMode === 'forward' 
            ? (email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`)
            : (email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`),
          body: replyBody,
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
      toast.error("Upload failed", { id: "upload-attachment" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

  const [isCreatingInlineLabel, setIsCreatingInlineLabel] = useState(false);
  const [inlineLabelName, setInlineLabelName] = useState("");
  const [showMove, setShowMove] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [customSnooze, setCustomSnooze] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const [imagePreviews, setImagePreviews] = useState({});

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) {
        setShowSnooze(false);
        setCustomSnooze(false);
      }
      if (labelsRef.current && !labelsRef.current.contains(e.target)) {
        setShowLabels(false);
      }
    };
    if (showSnooze || showLabels) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSnooze, showLabels]);

  const handleSnoozeOption = async (targetUid, isoDate) => {
    if (isSnoozing) return;
    setIsSnoozing(true);
    try {
      const targetFolder = email?.folderName || getFolder();
      if (snoozeAction) {
        await snoozeAction(targetUid || email?.uid, isoDate, targetFolder);
      }
      setShowSnooze(false);
      setCustomSnooze(false);
      if (handleClose) {
        handleClose();
      }
    } catch (err) {
      console.error("Snooze error:", err);
    } finally {
      setIsSnoozing(false);
    }
  };

  const handleApplyLabelOption = async (labelId) => {
    if (isApplyingLabel) return;
    const strLabelId = String(labelId);
    const targetLabel = labels.find(
      (l) => String(l.id) === strLabelId || l.name?.toLowerCase() === strLabelId.toLowerCase()
    );
    const labelObj = targetLabel || { id: labelId, name: labelId, colorHex: "#135bec" };

    const alreadyApplied = (localLabels || []).some(
      (l) =>
        String(l.id || l) === strLabelId ||
        (targetLabel && (String(l.id) === String(targetLabel.id) || (l.name && l.name === targetLabel.name)))
    );

    if (alreadyApplied) {
      setShowLabels(false);
      return;
    }

    const prevLabels = localLabels;
    setLocalLabels((prev) => [...prev, labelObj]);
    setShowLabels(false);

    setIsApplyingLabel(true);
    try {
      const targetFolder = email?.folderName || getFolder();
      if (applyLabelAction) {
        await applyLabelAction(email.uid, labelId, targetFolder);
      }
    } catch (err) {
      console.error("Apply label error:", err);
      setLocalLabels(prevLabels);
    } finally {
      setIsApplyingLabel(false);
    }
  };

  const handleRemoveLabelOption = async (labelId) => {
    const strLabelId = String(labelId);
    const prevLabels = localLabels;
    setLocalLabels((prev) =>
      prev.filter((l) => String(l.id || l) !== strLabelId && l.name !== labelId)
    );
    try {
      const targetFolder = email?.folderName || getFolder();
      if (handleRemoveLabel) {
        await handleRemoveLabel(email.uid, labelId, targetFolder);
      }
    } catch (err) {
      console.error("Remove label error:", err);
      setLocalLabels(prevLabels);
    }
  };

  // Conversation Thread states and fetchers
  const localSentRepliesRef = React.useRef([]);
  const lastEmailUidRef = React.useRef(null);
  const [threadEmails, setThreadEmails] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState({});

  const cleanSubject = (subj) => {
    if (!subj) return "";
    return subj
      .replace(/^(re|fwd|fw|aw|reply):\s*/i, "")
      .replace(/^\[[^\]]+\]\s*/i, "")
      .trim()
      .toLowerCase();
  };

  const fetchThreadEmails = async () => {
    if (!email) return;
    setLoadingThread(true);
    try {
      const cleanSubj = cleanSubject(email.subject);
      
      const [inboxRes, sentRes] = await Promise.all([
        mailAPI.getInbox(1, 100),
        mailAPI.getSent(1, 100)
      ]);

      let allRelated = [];
      if (inboxRes.data?.success) {
        const inboxMails = inboxRes.data.data.emails || inboxRes.data.data || [];
        allRelated = [...allRelated, ...inboxMails];
      }
      if (sentRes.data?.success) {
        const sentMails = sentRes.data.data.emails || sentRes.data.data || [];
        allRelated = [...allRelated, ...sentMails];
      }

      // Merge session local sent replies matching the clean subject
      const matchingLocal = localSentRepliesRef.current.filter(m => cleanSubject(m.subject) === cleanSubj);
      allRelated = [...allRelated, ...matchingLocal];

      // Filter by clean subject match
      let filtered = allRelated.filter(m => cleanSubject(m.subject) === cleanSubj);
      
      // Deduplicate identical messages (e.g. from self-sends in Inbox and Sent)
      const seenMessages = new Set();
      filtered = filtered.filter(m => {
        const cleanBody = (m.body || m.textPlain || "")
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, '')
          .trim();
        const dateStr = m.date || m.receivedDate || m.sentDate || "";
        const dateEpoch = dateStr ? new Date(dateStr).getTime() : 0;
        const timeBucket = Math.round(dateEpoch / 10000); 
        const sender = (m.from || "").trim().toLowerCase();
        
        const signature = `${sender}|${cleanBody.substring(0, 100)}|${timeBucket}`;
        if (seenMessages.has(signature)) {
          return false;
        }
        seenMessages.add(signature);
        return true;
      });

      if (!filtered.some(f => (f.uid || f.id) === (email.uid || email.id))) {
        filtered.push(email);
      }

      // Sort chronologically
      filtered.sort((a, b) => {
        const dateA = new Date(a.date || a.receivedDate || a.sentDate || 0);
        const dateB = new Date(b.date || b.receivedDate || b.sentDate || 0);
        return dateA - dateB;
      });

      setThreadEmails(filtered);
      setExpandedMessages(prev => {
        if (Object.keys(prev).length === 0 && filtered.length > 0) {
          const lastIdx = filtered.length - 1;
          const lastUid = filtered[lastIdx].uid || filtered[lastIdx].id;
          return { [lastUid]: true };
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to fetch thread emails:", err);
      const matchingLocal = localSentRepliesRef.current.filter(m => cleanSubject(m.subject) === cleanSubject(email.subject));
      const fallbackList = [...matchingLocal, email].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      setThreadEmails(fallbackList);
      setExpandedMessages(prev => {
        if (Object.keys(prev).length === 0 && fallbackList.length > 0) {
          const lastIdx = fallbackList.length - 1;
          const lastUid = fallbackList[lastIdx].uid || fallbackList[lastIdx].id;
          return { [lastUid]: true };
        }
        return prev;
      });
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (email) {
      const currentUid = email.uid || email.id;
      if (lastEmailUidRef.current !== currentUid) {
        lastEmailUidRef.current = currentUid;
        setExpandedMessages({});
        setThreadEmails([]); // Clear old thread so it doesn't show old thread emails while loading new thread
      }
      fetchThreadEmails();
    }
  }, [email]);

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

  const getOriginalEmailContentHTML = (emailObj) => {
    if (!emailObj) return "<div class=\"original-unavailable\">Original message unavailable</div>";

    const fromVal = emailObj.from || "";
    const toVal = emailObj.to || "";
    const dateVal = emailObj.sentDate
      ? formatDate(emailObj.sentDate)
      : emailObj.receivedDate
      ? formatDate(emailObj.receivedDate)
      : emailObj.date
      ? formatDate(emailObj.date)
      : emailObj.createdAt
      ? formatDate(emailObj.createdAt)
      : "";
    const subjectVal = emailObj.subject || "";

    let bodyContent = "";
    // Detect if content is HTML
    const isHtml = emailObj.htmlBody || (emailObj.isHtml && emailObj.body) || (emailObj.body && (
      emailObj.body.trim().startsWith('<!DOCTYPE html') ||
      emailObj.body.trim().startsWith('<html') ||
      emailObj.body.includes('</html>') ||
      emailObj.body.includes('</p>') ||
      emailObj.body.includes('</div>') ||
      emailObj.body.includes('</td>')
    ));

    if (isHtml) {
      bodyContent = emailObj.htmlBody || emailObj.body;
    } else {
      const rawText = emailObj.body || emailObj.textPlain || "";
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

  const handleSendReply = async () => {
    const recipient = replyMode === 'forward' ? forwardTo.trim() : cleanSenderEmail;
    if (!recipient) {
      toast.error("Recipient email is required");
      return;
    }
    if (!replyBody.trim()) {
      toast.error("Message body cannot be empty");
      return;
    }
    if (uploading) {
      toast.error("Please wait for files to finish uploading");
      return;
    }
    if (sendingReplyRef.current) return;
    sendingReplyRef.current = true;
    setSendingReply(true);
    const toastId = toast.loading("Sending message...");
    try {
      const finalBody = replyBody;

      const payload = {
        to: recipient,
        subject: replyMode === 'forward' 
          ? (email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`)
          : (email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`),
        body: finalBody,
        isHtml: true
      };

      let res;
      if (draftId) {
        await mailAPI.createDbDraft({
          id: draftId,
          ...payload,
          isHtml: true
        });
        res = await mailAPI.sendDbDraft(draftId);
      } else {
        res = await mailAPI.send(payload);
      }

      if (res.data?.success) {
        toast.success(replyMode === 'forward' ? "Forwarded successfully" : "Reply sent successfully", { id: toastId });
        
        // Append sent reply to thread locally
        const newReplyMail = {
          uid: `sent-${Date.now()}`,
          from: user.email,
          to: recipient,
          subject: payload.subject,
          body: payload.body,
          date: new Date().toISOString(),
          sentDate: new Date().toISOString(),
          attachments: attachments.map(a => a.fileName)
        };
        localSentRepliesRef.current.push(newReplyMail);
        setThreadEmails(prev => [...prev, newReplyMail]);

        setShowReply(false);
        setReplyBody("");
        setForwardTo("");
        const sentDraftId = draftId;
        setDraftId(null);
        setAttachments([]);
        if (handleEmailSent) {
          handleEmailSent({
            draftId: sentDraftId,
            sentEmail: res.data?.data
          });
        } else if (fetchEmails) {
          fetchEmails(currentFolder || "inbox", true);
        }
      } else {
        throw new Error(res.data?.message || "Failed to send email");
      }
    } catch (err) {
      console.error("Failed to send inline reply/forward:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to send email", { id: toastId });
    } finally {
      sendingReplyRef.current = false;
      setSendingReply(false);
    }
  };

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error("Please select a reason for reporting");
      return;
    }
    
    setReportLoading(true);
    try {
      await reportAPI.submitReport({
        reportedEmail: cleanSenderEmail,
        subject: email.subject || "(No Subject)",
        reason: reportReason
      });
      toast.success("Report submitted successfully. Our team will review this.");
      setShowReportModal(false);
      setReportReason("");
    } catch (err) {
      console.error("Failed to submit report:", err);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>Print Email</title>');
    doc.write(`<base href="${window.location.origin}/" />`);
    doc.write(`
      <style>
        body { font-family: sans-serif; padding: 20px; color: #000; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-container { display: flex; align-items: center; gap: 8px; font-size: 24px; font-weight: bold; color: #135bec; }
        .logo-container img { height: 32px; }
        .logo-text-dark { color: #333; }
        .user-email { font-size: 14px; color: #555; font-weight: 500; }
        h2 { margin-bottom: 5px; font-size: 22px; }
        .meta { color: #555; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 14px; line-height: 1.5; }
        .plaintext { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.5; }
      </style>
    `);
    doc.write('</head><body>');
    
    doc.write(`
      <div class="header">
        <div class="logo-container">
          <img src="${logo}" alt="BNX Mail Logo" />
          <span>BNX<span class="logo-text-dark">mail</span></span>
        </div>
        <div class="user-email">${user?.email || ''}</div>
      </div>
    `);

    doc.write(`<h2>${email.subject || "(No Subject)"}</h2>`);
    const escapedFrom = email.from ? email.from.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
    const emailDate = email.sentDate || email.receivedDate || email.date || email.createdAt || email.timestamp || "";
    doc.write(`<div class="meta"><strong>From:</strong> ${escapedFrom}<br/><strong>Date:</strong> ${formatDate(emailDate)}</div>`);
    
    if (email.htmlBody) {
      doc.write(`<div>${email.htmlBody}</div>`);
    } else {
      const textContent = email.body || email.textPlain || "";
      doc.write(`<div class="plaintext">${textContent}</div>`);
    }
    
    doc.write('</body></html>');
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);

    setShowMoreOptions(false);
  };

  const handleDownloadMessage = () => {
    toast.loading("Generating PDF...", { id: "pdf-download" });

    const escapedFrom = email.from ? email.from.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
    
    let bodyHtml = "";
    if (email.htmlBody) {
      bodyHtml = `<div>${email.htmlBody}</div>`;
    } else {
      const textContent = email.body || email.textPlain || "";
      bodyHtml = `<div style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;">${textContent}</div>`;
    }

    const fullHtml = `
      <div style="padding:20px;font-family:sans-serif;color:#000;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ccc;padding-bottom:15px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:24px;font-weight:bold;color:#135bec;">
            <img src="${window.location.origin}${logo}" style="height:32px;" alt="BNX Mail Logo" />
            <span>BNX<span style="color:#333;">mail</span></span>
          </div>
          <div style="font-size:14px;color:#555;font-weight:500;">${user?.email || ''}</div>
        </div>
        <h2 style="margin-bottom:5px;font-size:22px;">${email.subject || "(No Subject)"}</h2>
        <div style="color:#555;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #eee;font-size:14px;line-height:1.5;">
          <strong>From:</strong> ${escapedFrom}<br/>
          <strong>Date:</strong> ${formatDate(email.sentDate || email.receivedDate || email.date || email.createdAt || email.timestamp || "")}
        </div>
        ${bodyHtml}
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `${(email.subject || 'message').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, allowTaint: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(fullHtml).save().then(() => {
      toast.success("PDF Downloaded!", { id: "pdf-download" });
    }).catch(err => {
      console.error(err);
      toast.error("Failed to generate PDF", { id: "pdf-download" });
    });

    setShowMoreOptions(false);
  };

  const getSnoozeOptions = () => {
    const now = new Date();
    
    // Later today: 6 PM today (or +3 hours if past 5 PM)
    const laterToday = new Date(now);
    if (now.getHours() >= 17) {
      laterToday.setHours(now.getHours() + 3);
    } else {
      laterToday.setHours(18, 0, 0, 0);
    }

    // Tomorrow: 8 AM tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    // Later this week: Thursday 8 AM (if today is Mon/Tue/Wed), else +2 days 8 AM
    const laterThisWeek = new Date(now);
    if (now.getDay() < 4) {
      laterThisWeek.setDate(now.getDate() + (4 - now.getDay()));
    } else {
      laterThisWeek.setDate(now.getDate() + 2);
    }
    laterThisWeek.setHours(8, 0, 0, 0);

    // This weekend: Saturday 8 AM
    const thisWeekend = new Date(now);
    const daysToSaturday = 6 - now.getDay();
    thisWeekend.setDate(now.getDate() + (daysToSaturday === 0 ? 7 : daysToSaturday));
    thisWeekend.setHours(8, 0, 0, 0);

    // Next week: Monday 8 AM
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
      { label: "Later today", time: laterToday, display: formatTime(laterToday), icon: <MdToday size={18} className="text-amber-500" /> },
      { label: "Tomorrow", time: tomorrow, display: formatTime(tomorrow), icon: <MdWbSunny size={18} className="text-yellow-500" /> },
      { label: "Later this week", time: laterThisWeek, display: formatTime(laterThisWeek), icon: <MdEvent size={18} className="text-indigo-500" /> },
      { label: "This weekend", time: thisWeekend, display: formatTime(thisWeekend), icon: <MdNightsStay size={18} className="text-purple-500" /> },
      { label: "Next week", time: nextWeek, display: formatTime(nextWeek), icon: <MdUpdate size={18} className="text-emerald-500" /> },
    ];
  };

  const getFolder = () => {
    if (isArchiveFolder) return "Archive";
    if (!email.category) return "INBOX";
    const cat = email.category.toUpperCase();
    if (cat === "SENT") return "Sent";
    if (cat === "TRASH") return "Trash";
    if (cat === "SPAM") return "Spam";
    if (cat === "DRAFTS") return "Drafts";
    return "INBOX";
  };

  React.useEffect(() => {
    if (!email || !email.attachments) {
      return () => {
        setImagePreviews((prev) => {
          Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
          return {};
        });
      };
    }

    setImagePreviews((prev) => {
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });

    email.attachments.forEach(async (file) => {
      const ext = file.split('.').pop().toLowerCase();
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
      if (isImage) {
        try {
          const res = await mailAPI.downloadAttachment(email.uid, file, getFolder());
          const blobUrl = URL.createObjectURL(new Blob([res.data]));
          setImagePreviews((prev) => ({
            ...prev,
            [file]: blobUrl
          }));
        } catch (err) {
          console.error("Failed to load image preview for", file, err);
        }
      }
    });

    return () => {
      setImagePreviews((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, [email]);

  const [previewFile, setPreviewFile] = useState(null);
  const [bounceDetails, setBounceDetails] = useState("");

  React.useEffect(() => {
    return () => {
      setPreviewFile((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    };
  }, [email]);

  React.useEffect(() => {
    if (!email || !email.attachments) {
      setBounceDetails("");
      return;
    }
    const isBounce = email.from?.toLowerCase().includes('mailer-daemon') || email.from?.toLowerCase().includes('postmaster');
    if (!isBounce) {
      setBounceDetails("");
      return;
    }

    setBounceDetails("");
    email.attachments.forEach(async (file) => {
      const ext = file.split('.').pop().toLowerCase();
      // Skip known image/binary formats, try to read everything else as text for bounce messages
      if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'zip'].includes(ext)) {
        try {
          const res = await mailAPI.downloadAttachment(email.uid, file, getFolder());
          const reader = new FileReader();
          reader.onload = () => {
            setBounceDetails(prev => prev + `\n\n--- Attachment: ${file} ---\n${reader.result}`);
          };
          reader.readAsText(new Blob([res.data]));
        } catch (e) {
          console.error("Failed to fetch bounce details", e);
        }
      }
    });
  }, [email]);

  const closePreview = () => {
    setPreviewFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const handleDownloadAttachment = async (fileName) => {
    try {
      toast.loading(`Downloading ${fileName}...`, { id: "download-attachment" });
      const res = await mailAPI.downloadAttachment(email.uid, fileName, getFolder());
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${fileName} downloaded successfully`, { id: "download-attachment" });
    } catch (err) {
      console.error("Failed to download attachment:", err);
      toast.error("Failed to download attachment", { id: "download-attachment" });
    }
  };

  const handlePreviewAttachment = async (fileName) => {
    try {
      toast.loading(`Loading preview...`, { id: "preview-attachment" });
      const res = await mailAPI.downloadAttachment(email.uid, fileName, getFolder());
      const mime = getMimeType(fileName);
      
      let textContent = "";
      if (mime === "text/plain") {
        const reader = new FileReader();
        textContent = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsText(new Blob([res.data]));
        });
      }

      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      setPreviewFile({
        fileName,
        blobUrl: url,
        mimeType: mime,
        textContent
      });
      toast.success("Loaded preview", { id: "preview-attachment" });
    } catch (err) {
      console.error("Failed to preview attachment:", err);
      toast.error("Failed to preview attachment", { id: "preview-attachment" });
    }
  };

  const handleClose = onBack || onClose;

  if (!email) {
    return null;
  }



  return (
    <div
      className={
        isFullscreen
          ? "absolute inset-0 z-[100] flex flex-col overflow-hidden animate-fade-in"
          : "flex-1 flex flex-col overflow-hidden w-full h-full animate-fade-in"
      }
      style={{ backgroundColor: theme.cardBg }}
    >
      {/* HEADER ACTION TOOLBAR */}
      <div
        className="flex items-center justify-between px-2 sm:px-6 py-2 border-b shrink-0 flex-wrap gap-1 sm:gap-2 overflow-x-auto hidden-scrollbar"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleClose()}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
            title="Back"
          >
            {((readingPaneMode !== 'no_split' && !isFullscreen) || isFullscreen) && !isTrash ? (
              <MdClose size={20} className="hidden md:block" />
            ) : null}
            <svg className={`w-5 h-5 ${(((readingPaneMode !== 'no_split' && !isFullscreen) || isFullscreen) && !isTrash) ? 'md:hidden' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {isTrash ? (
            <>
              <button
                onClick={() => onRestore ? onRestore(email.uid) : null}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-green-600 text-white hover:bg-green-700 transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Restore
              </button>
              <button
                onClick={() => {
                  onDelete?.(email.uid);
                  handleClose();
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Delete Permanently
              </button>
            </>
          ) : (
            <>
              {readingPaneMode !== 'no_split' && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden md:flex p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
                >
                  {isFullscreen ? <MdCloseFullscreen size={18} /> : <MdOpenInFull size={18} />}
                </button>
              )}
              
              <div className="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />

              <button
                onClick={() => {
                  if (isActuallyArchived) {
                    if (onUnarchive) onUnarchive(email.uid);
                    else onArchive?.(email.uid);
                  } else {
                    onArchive?.(email.uid);
                  }
                }}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer"
                title={isActuallyArchived ? "Unarchive" : "Archive"}
              >
                {isActuallyArchived ? <MdUnarchive size={20} /> : <MdArchive size={20} />}
              </button>

              <button
                onClick={() => {
                  onDelete?.(email.uid);
                  handleClose();
                }}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-500 cursor-pointer"
                title={t("common.delete", "Delete")}
              >
                <MdDelete size={20} />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isTrash && (
            <button
              onClick={() => {
                if (isActuallyArchived) {
                  if (onUnarchive) onUnarchive(email.uid);
                  else onArchive?.(email.uid);
                } else {
                  onArchive?.(email.uid);
                }
              }}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer"
              title={isActuallyArchived ? "Unarchive" : "Archive"}
            >
              {isActuallyArchived ? <MdUnarchive size={20} /> : <MdArchive size={20} />}
            </button>
          )}

          <button
            onClick={handlePrint}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title={t("common.print", "Print")}
          >
            <MdPrint size={20} />
          </button>

          <button
            onClick={() => onStar ? onStar(email.uid) : handleToggleStar?.(email.uid, "trash")}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer group"
            title={email.starred ? t("common.unstar", "Unstar") : t("common.star", "Star")}
          >
            <MdStar
              size={20}
              className={
                email.starred
                  ? "text-yellow-500 fill-current drop-shadow-sm"
                  : "text-gray-400 dark:text-gray-500 group-hover:text-yellow-500 transition-colors"
              }
            />
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 bg-transparent">
        {/* SUBJECT */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1
            className="text-xl sm:text-2xl font-bold leading-tight tracking-tight"
            style={{ color: theme.text }}
          >
            {email.subject || "(No Subject)"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {localLabels?.map((label) => {
              const labelId = typeof label === 'string' ? label : (label.id || label.name);
              const labelName = typeof label === 'string' ? label : (label.name || label.id);
              const labelColor = typeof label === 'string' 
                ? (labels.find(l => l.name === label || l.id === label)?.colorHex || '#135bec')
                : (label.colorHex || '#135bec');
              return (
                <span
                  key={labelId}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm border border-black/5 dark:border-white/5 flex items-center gap-1.5"
                  style={{ backgroundColor: labelColor }}
                >
                  {labelName}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLabelOption(labelId);
                    }}
                    className="hover:bg-black/20 rounded-full p-0.5 transition-colors flex items-center justify-center cursor-pointer"
                    title="Remove label"
                  >
                    <MdClose size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {threadEmails.length > 0 ? (
          <div className="flex flex-col gap-3 mb-6">
            {threadEmails.map((m) => {
              const isExpanded = expandedMessages[m.uid || m.id];
              if (isExpanded) {
                return (
                  <div key={m.uid || m.id} className="border rounded-2xl p-4 bg-white dark:bg-neutral-900 shadow-sm flex flex-col text-left" style={{ borderColor: theme.border }}>
                    <div 
                      onClick={() => setExpandedMessages(prev => ({ ...prev, [m.uid || m.id]: false }))}
                      className="flex items-center justify-between pb-3 border-b cursor-pointer select-none"
                      style={{ borderColor: theme.border }}
                    >
                      {/* SENDER INFO */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0"
                          style={{ backgroundColor: theme.accent || "#135bec" }}
                        >
                          {m.from?.split("@")[0]?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm flex flex-wrap items-center gap-x-2" style={{ color: theme.text }}>
                            {m.from?.includes("<") ? (
                              <>
                                <span>{m.from.split("<")[0].replace(/^["']/g, "").replace(/["']$/g, "").trim()}</span>
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">&lt;{m.from.split("<")[1].split(">")[0]}&gt;</span>
                              </>
                            ) : (
                              <span>{m.from}</span>
                            )}
                            {blockedContacts.includes(normalizeEmail(m.from)) && (
                              <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded transition-all select-none border border-red-200 dark:border-red-800/40">
                                Blocked
                              </span>
                            )}
                            {(() => {
                              const mCleanSender = m.from?.includes("<")
                                ? m.from.split("<")[1].split(">")[0].trim()
                                : (m.from || "").trim();
                              const isMsgSystem = mCleanSender.toLowerCase().includes("mailer-daemon") || 
                                                  mCleanSender.toLowerCase().includes("postmaster") || 
                                                  mCleanSender.toLowerCase().includes("noreply") ||
                                                  mCleanSender.toLowerCase().includes("no-reply");
                              return mCleanSender && !isMsgSystem ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnsubscribeClick(mCleanSender);
                                  }}
                                  className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline cursor-pointer bg-red-500/10 dark:bg-red-500/20 px-2 py-0.5 rounded transition-all select-none"
                                  title={t("bulk_actions.unsubscribe", "Unsubscribe from this sender")}
                                >
                                  {t("bulk_actions.unsubscribe", "Unsubscribe")}
                                </button>
                              ) : null;
                            })()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                            to <span className="font-medium text-gray-700 dark:text-gray-300">{m.to || "me"}</span>
                          </p>
                        </div>
                      </div>
                      
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 shrink-0">
                        {m.sentDate ? formatDate(m.sentDate) : m.receivedDate ? formatDate(m.receivedDate) : m.date ? formatDate(m.date) : m.createdAt ? formatDate(m.createdAt) : ""}
                      </span>
                    </div>

                    {/* BODY */}
                    <div className="max-w-none prose prose-slate dark:prose-invert prose-p:leading-relaxed text-[14px] sm:text-[15px] leading-relaxed pt-4 overflow-x-auto break-words [&_img]:max-w-full [&_img]:h-auto">
                      {m.htmlBody || (m.isHtml && m.body) || (m.body && (
                        m.body.trim().startsWith('<!DOCTYPE html') ||
                        m.body.trim().startsWith('<html') ||
                        m.body.includes('</html>') ||
                        m.body.includes('</p>') ||
                        m.body.includes('</div>') ||
                        m.body.includes('</td>')
                      )) ? (
                        <div dangerouslySetInnerHTML={{ __html: m.htmlBody || m.body }} style={{ color: theme.text }} />
                      ) : (
                        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200" style={{ color: theme.text }}>
                          {m.body || m.textPlain || "(No content available)"}
                        </p>
                      )}
                    </div>

                    {/* ATTACHMENTS */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                        <p className="text-xs font-bold mb-2 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                          {t("email_details.attachments", "Attachments")} ({m.attachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 border px-2 py-1 rounded-lg text-xs" style={{ borderColor: theme.border }}>
                              <span className="truncate max-w-[120px]" style={{ color: theme.text }}>{file}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePreviewAttachment(file); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                              >
                                👁️
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(file); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                              >
                                📥
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div 
                    key={m.uid || m.id}
                    onClick={() => setExpandedMessages(prev => ({ ...prev, [m.uid || m.id]: true }))}
                    className="flex items-center justify-between p-3 border hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer select-none rounded-xl mb-2 bg-white dark:bg-neutral-900"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0" style={{ backgroundColor: theme.accent || "#135bec" }}>
                        {m.from?.split("@")[0]?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate max-w-[120px] sm:max-w-[200px]">
                        {m.from?.includes("<") ? m.from.split("<")[0].replace(/^["']/g, "").replace(/["']$/g, "").trim() : m.from}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px] sm:max-w-[300px]">
                        {m.body ? m.body.replace(/<[^>]+>/g, '').substring(0, 60) + '...' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {m.sentDate ? formatDate(m.sentDate) : m.receivedDate ? formatDate(m.receivedDate) : m.date ? formatDate(m.date) : m.createdAt ? formatDate(m.createdAt) : ""}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <>
            {/* Fallback original presentation */}
            {/* SENDER INFO */}
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-base shadow-sm shrink-0"
                  style={{ backgroundColor: theme.accent || "#135bec" }}
                >
                  {email.from?.split("@")[0]?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="font-semibold text-sm sm:text-base flex flex-wrap items-center gap-x-2" style={{ color: theme.text }}>
                    {email.from?.includes("<") ? (
                      <>
                        <span>{email.from.split("<")[0].replace(/^["']/g, "").replace(/["']$/g, "").trim()}</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">&lt;{email.from.split("<")[1].split(">")[0]}&gt;</span>
                      </>
                    ) : (
                      <span>{email.from}</span>
                    )}
                    {isBlocked && (
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded transition-all select-none border border-red-200 dark:border-red-800/40">
                        Blocked
                      </span>
                    )}
                    {cleanSenderEmail && !isSystemEmail && (
                      <button
                        onClick={handleUnsubscribeClick}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline cursor-pointer bg-red-500/10 dark:bg-red-500/20 px-2 py-0.5 rounded transition-all select-none"
                        title={t("bulk_actions.unsubscribe", "Unsubscribe from this sender")}
                      >
                        {t("bulk_actions.unsubscribe", "Unsubscribe")}
                      </button>
                    )}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                      to <span className="font-medium text-gray-700 dark:text-gray-300">{email.to || "me"}</span>
                    </p>
                    {email.cc && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                        cc <span className="font-medium text-gray-700 dark:text-gray-300">{email.cc}</span>
                      </p>
                    )}
                    {email.bcc && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                        bcc <span className="font-medium text-gray-700 dark:text-gray-300">{email.bcc}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 self-start sm:self-center bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-1 rounded-full">
                {email.sentDate ? formatDate(email.sentDate) : email.receivedDate ? formatDate(email.receivedDate) : email.date ? formatDate(email.date) : email.createdAt ? formatDate(email.createdAt) : ""}
              </span>
            </div>

            {/* BODY */}
            <div className="max-w-none prose prose-slate dark:prose-invert prose-p:leading-relaxed text-[14px] sm:text-[15px] leading-relaxed overflow-x-auto break-words [&_img]:max-w-full [&_img]:h-auto">
              {email.htmlBody || (email.isHtml && email.body) || (email.body && (
                email.body.trim().startsWith('<!DOCTYPE html') ||
                email.body.trim().startsWith('<html') ||
                email.body.includes('</html>') ||
                email.body.includes('</p>') ||
                email.body.includes('</div>') ||
                email.body.includes('</td>')
              )) ? (
                <div dangerouslySetInnerHTML={{ __html: email.htmlBody || email.body }} style={{ color: theme.text }} />
              ) : (
                <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200" style={{ color: theme.text }}>
                  {email.body || email.textPlain || "(No content available)"}
                </p>
              )}
              {bounceDetails && (
                <div className="mt-8 p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800 font-mono text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-400 overflow-x-auto">
                  <h4 className="font-bold mb-2 text-gray-700 dark:text-gray-300 font-sans">Diagnostic Information & Original Message</h4>
                  {bounceDetails.trim()}
                </div>
              )}
            </div>
          </>
        )}

        {/* ATTACHMENTS */}
        {(() => {
          const isBounce = email.from?.toLowerCase().includes('mailer-daemon') || email.from?.toLowerCase().includes('postmaster');
          const visibleAttachments = email.attachments?.filter(file => {
            if (!isBounce) return true;
            return file !== 'delivery_status.txt' && file !== 'original_message.eml';
          }) || [];
          
          if (visibleAttachments.length === 0) return null;
          
          return (
            <div className="mt-8 pt-6 border-t" style={{ borderColor: theme.border }}>
              <p className="text-xs font-bold mb-4 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("email_details.attachments", "Attachments")} ({visibleAttachments.length})
              </p>
              <div className="flex flex-wrap gap-4">
                {visibleAttachments.map((file, i) => {
                  const fileInfo = getFileIcon(file);
                return (
                  <div
                    key={i}
                    className="w-[180px] h-[130px] rounded-xl border overflow-hidden flex flex-col hover:shadow-md transition-all relative shadow-sm bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    style={{ borderColor: theme.border }}
                  >
                    {/* Upper preview / icon block */}
                    <div 
                      className="h-[85px] w-full flex flex-col items-center justify-center bg-black/[0.03] dark:bg-white/[0.03] border-b relative overflow-hidden"
                      style={{ borderColor: theme.border }}
                    >
                      {imagePreviews[file] ? (
                        <img 
                          src={imagePreviews[file]} 
                          alt={file} 
                          className="w-full h-full object-cover select-none" 
                        />
                      ) : (
                        <>
                          <span className="text-3xl filter drop-shadow-sm select-none">{fileInfo.icon}</span>
                          <span 
                            className="text-[9px] font-extrabold uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-full select-none"
                            style={{ backgroundColor: `${fileInfo.color}15`, color: fileInfo.color }}
                          >
                            {fileInfo.name}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Lower details block */}
                    <div className="p-2 flex items-center justify-between gap-1 flex-1 min-w-0">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span 
                          className="text-[11px] font-semibold truncate select-all text-left" 
                          style={{ color: theme.text }}
                          title={file}
                        >
                          {file}
                        </span>
                        <span className="text-[9px] opacity-50 font-medium select-none truncate text-left">
                          {fileInfo.name} File
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handlePreviewAttachment(file)}
                          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                          title="Preview file"
                        >
                          <MdRemoveRedEye size={15} />
                        </button>
                        <button
                          onClick={() => handleDownloadAttachment(file)}
                          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                          title="Download file"
                        >
                          <MdFileDownload size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* INLINE REPLY COMPOSER */}
      {showReply && (
        <div 
          className="border rounded-2xl p-4 bg-white dark:bg-neutral-900 shadow-sm flex flex-col gap-3 mt-6 text-left"
          style={{ borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-1.5 flex-wrap">
              <MdReply size={20} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer shrink-0" />
              <MdArrowDropDown size={16} className="text-gray-400 -ml-1 shrink-0 cursor-pointer" />
              
              {replyMode === 'forward' ? (
                <input
                  type="text"
                  placeholder={t("compose.to", "Forward to recipient...")}
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                  className="flex-1 min-w-[200px] sm:min-w-[300px] bg-transparent border-none text-sm outline-none text-gray-800 dark:text-gray-200"
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cleanSenderEmail}
                </span>
              )}
              <MdArrowDropDown size={16} className="text-gray-400 cursor-pointer -ml-1 shrink-0" />
            </div>
            
            <button 
              type="button"
              onClick={() => setShowReply(false)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <MdClose size={16} />
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />

          {/* Body */}
          <div className="flex-1 mt-1 overflow-y-auto w-full inline-reply-quill" style={{ minHeight: "120px" }}>
            <style>{`
              .inline-reply-quill .ql-toolbar {
                display: none !important;
              }
              .inline-reply-quill .ql-container {
                border: none !important;
              }
              .inline-reply-quill .ql-editor {
                padding: 8px 0 !important;
                font-size: 14px !important;
                line-height: 1.6 !important;
                min-height: 120px !important;
              }
            `}</style>
            
            <ReactQuill
              theme="snow"
              modules={{ toolbar: "#inline-reply-toolbar" }}
              bounds="self"
              value={replyBody}
              onChange={setReplyBody}
              placeholder={replyMode === 'forward' ? t("compose.body_placeholder", "Type your forwarded message here...") : t("compose.body_placeholder", "Type your reply here...")}
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

          {/* Horizontal divider line above toolbar */}
          <hr className="border-gray-150 dark:border-neutral-800" style={{ borderColor: theme.border }} />

          {/* Bottom Toolbar Row */}
          <div className="flex items-center justify-between mt-1 flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendReply}
                disabled={sendingReply}
                className="px-6 py-2.5 text-white text-xs font-bold rounded-full shadow-sm hover:shadow transition-all bg-[#0b57d0] hover:bg-[#0b57d0]/90 disabled:opacity-60 cursor-pointer"
              >
                {sendingReply ? t("common.sending", "Sending…") : t("common.send", "Send")}
              </button>

              {/* Formatting bar container - always visible now next to Send button */}
              <div 
                id="inline-reply-toolbar" 
                className="flex items-center gap-1 p-1 bg-white dark:bg-neutral-800 rounded-lg border text-gray-700 dark:text-gray-300 shrink-0 select-none overflow-x-auto whitespace-nowrap max-w-full" 
                style={{ borderColor: theme.border }}
              >
                <select className="ql-header bg-transparent border border-gray-200 dark:border-neutral-700 rounded px-1.5 py-0.5 text-xs font-bold outline-none cursor-pointer mr-1">
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

            {/* Right side utility icons: Attach file, Insert signature, Discard/Trash */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-555 hover:text-gray-700 dark:hover:text-gray-300"
                title={t("compose.attach_files", "Attach files")}
              >
                <MdAttachFile size={18} className="transform rotate-45" />
              </button>

              <button
                type="button"
                onClick={() => toast.success("Insert signature")}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-555 hover:text-gray-700 dark:hover:text-gray-300"
                title="Insert signature"
              >
                <MdEditDocument size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm("Discard draft?")) {
                    setReplyBody("");
                    setShowReply(false);
                  }
                }}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                title={t("compose.discard", "Discard draft")}
              >
                <MdDelete size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* FOOTER ACTIONS */}
      <div
        className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border-t shrink-0"
        style={{ borderColor: theme.border }}
      >
        <div className="flex gap-3">
          {currentFolder !== "draft" && (
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  setShowReply(true);
                  setReplyMode('reply');
                  setReplyBody("");
                  setForwardTo("");
                }}
                className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2
                  ${theme.name === 'dark' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.5)]' 
                    : 'bg-white border hover:bg-gray-50 hover:shadow-sm text-gray-700'}`}
              >
                <MdReply size={18} /> {t("common.reply", "Reply")}
              </button>
              <button 
                onClick={() => {
                  setShowReply(true);
                  setReplyMode('forward');
                  setReplyBody(getOriginalEmailContentHTML(email));
                  setForwardTo("");
                }}
                className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2
                  ${theme.name === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-700 text-white shadow-sm' 
                    : 'bg-white border hover:bg-gray-50 hover:shadow-sm text-gray-700'}`}
              >
                <MdForward size={18} /> {t("common.forward", "Forward")}
              </button>
            </div>
          )}
        </div>

        {emailList && emailList.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">
              {emailList.findIndex(e => e.uid === email.uid) + 1} of {emailList.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const idx = emailList.findIndex(e => e.uid === email.uid);
                  if (idx > 0) onNavigate?.(emailList[idx - 1]);
                }}
                disabled={emailList.findIndex(e => e.uid === email.uid) <= 0}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <MdChevronLeft size={20} />
              </button>
              <button
                onClick={() => {
                  const idx = emailList.findIndex(e => e.uid === email.uid);
                  if (idx < emailList.length - 1 && idx !== -1) onNavigate?.(emailList[idx + 1]);
                }}
                disabled={emailList.findIndex(e => e.uid === email.uid) >= emailList.length - 1 || emailList.findIndex(e => e.uid === email.uid) === -1}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <MdChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INLINE PREVIEW OVERLAY */}
      {previewFile && createPortal(
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
                onClick={() => handleDownloadAttachment(previewFile.fileName)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Download file"
              >
                <MdFileDownload size={20} />
              </button>
              <button
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
            {previewFile.mimeType.startsWith("image/") ? (
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
                <button
                  onClick={() => handleDownloadAttachment(previewFile.fileName)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <MdFileDownload size={15} /> Download Attachment
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Report Modal */}
      {showReportModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-orange-50 dark:bg-orange-900/20">
              <h2 className="text-lg font-bold text-orange-700 dark:text-orange-500 flex items-center">
                <MdReport className="mr-2" size={24} /> Report Spam / Abuse
              </h2>
              <button 
                onClick={() => { setShowReportModal(false); setReportReason(""); }}
                className="p-2 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <MdClose size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                You are reporting the email from <strong className="text-gray-900 dark:text-gray-100">{cleanSenderEmail}</strong>. Please select the primary reason for this report:
              </p>
              
              <div className="space-y-3 mb-6">
                {["Spam", "Phishing / Scam", "Harassment", "Illegal Content", "Other"].map((reason) => (
                  <label key={reason} className="flex items-center p-3 border border-gray-200 dark:border-neutral-700 rounded-lg cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors">
                    <input 
                      type="radio" 
                      name="reportReason"
                      value={reason} 
                      checked={reportReason === reason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 dark:bg-neutral-800 dark:border-neutral-600"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-200">{reason}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <button
                  onClick={() => { setShowReportModal(false); setReportReason(""); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportSubmit}
                  disabled={reportLoading || !reportReason}
                  className="px-5 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm flex items-center cursor-pointer"
                >
                  {reportLoading ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Block / Unblock Confirmation Modal */}
      {showBlockModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col transform transition-all border border-gray-200 dark:border-neutral-800">
            <div className={`px-6 py-4 border-b flex justify-between items-center ${isBlocked ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'}`}>
              <h2 className={`text-lg font-bold flex items-center ${isBlocked ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-500'}`}>
                <MdBlock className="mr-2" size={24} /> {isBlocked ? "Unblock Sender" : "Block Sender"}
              </h2>
              <button 
                onClick={() => setShowBlockModal(false)}
                className="p-2 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <MdClose size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to {isBlocked ? "unblock" : "block"} this sender?
              </p>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleToggleBlock}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm flex items-center cursor-pointer ${
                    isBlocked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmailDetails;
