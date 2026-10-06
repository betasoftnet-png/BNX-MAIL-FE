import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  MdArrowBack,
  MdSend,
  MdMoreVert,
  MdAttachFile,
  MdInfoOutline,
  MdChat,
  MdEmail,
  MdPeople,
  MdPersonAdd,
  MdAssignment,
  MdClose,
  MdCheck,
  MdKeyboardArrowRight,
  MdKeyboardArrowLeft,
  MdImage,
  MdEdit,
  MdPictureAsPdf,
  MdDescription,
  MdInsertDriveFile,
  MdVisibility,
  MdFileDownload,
  MdArchive,
  MdAccessTime,
  MdLabel,
  MdDelete,
  MdPrint,
  MdStarBorder,
  MdStar,
  MdInsertEmoticon,
  MdRefresh
} from "react-icons/md";
import { chatAPI, mailAPI, templateAPI } from "../services/api";
import chatCache from "../services/chatCache";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";
import { DEFAULT_TEMPLATES } from "./Templates";


const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "✊", "👊", "🤛", "🤜", "👏", "🙌",
  "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "👀",
  "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🖤", "🩶", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗",
  "🎉", "✨", "🔥", "💡", "🌟", "🎈", "🎁", "💬", "✉️", "📅", "💻", "📱", "⌚", "📷", "🎨", "🎵", "✈️", "🚗", "🏠", "💼"
];

const getFileMeta = (fileName = "", fileType = "") => {
  const ext = (fileName || "").split('.').pop().toLowerCase();
  const isImage = (fileType && fileType.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
  
  if (isImage) {
    return {
      isImage: true,
      extLabel: ext.toUpperCase() || 'IMG',
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30'
    };
  }
  if (ext === 'pdf' || fileType === 'application/pdf') {
    return {
      isImage: false,
      icon: MdPictureAsPdf,
      extLabel: 'PDF',
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30'
    };
  }
  if (['doc', 'docx'].includes(ext) || (fileType && (fileType.includes('word') || fileType.includes('officedocument.wordprocessingml')))) {
    return {
      isImage: false,
      icon: MdDescription,
      extLabel: ext.toUpperCase() || 'DOC',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30'
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || (fileType && (fileType.includes('excel') || fileType.includes('spreadsheetml') || fileType.includes('csv')))) {
    return {
      isImage: false,
      icon: MdDescription,
      extLabel: ext.toUpperCase() || 'XLS',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30'
    };
  }
  if (['ppt', 'pptx'].includes(ext) || (fileType && (fileType.includes('presentation') || fileType.includes('powerpoint')))) {
    return {
      isImage: false,
      icon: MdDescription,
      extLabel: ext.toUpperCase() || 'PPT',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30'
    };
  }
  if (['txt', 'rtf', 'md'].includes(ext) || (fileType && fileType.startsWith('text/'))) {
    return {
      isImage: false,
      icon: MdDescription,
      extLabel: ext.toUpperCase() || 'TXT',
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-800'
    };
  }
  return {
    isImage: false,
    icon: MdInsertDriveFile,
    extLabel: ext ? ext.toUpperCase() : 'FILE',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30'
  };
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const readFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

const compressImageFile = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
  return new Promise((resolve) => {
    if (file.size <= 250 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch (canvasErr) {
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

// Module-level cache for fast attachment parsing
const attachmentCache = new Map(); // cacheKey -> parsedAttachments

const getNormalizedAttachments = (msg) => {
  if (!msg) return [];
  if (msg.parsedAttachments && Array.isArray(msg.parsedAttachments)) {
    return msg.parsedAttachments;
  }

  const cacheKey = msg.id 
    ? `msg_${msg.id}` 
    : (typeof msg.attachmentsJson === 'string' && msg.attachmentsJson ? `json_${msg.attachmentsJson}` : null);

  if (cacheKey && attachmentCache.has(cacheKey)) {
    return attachmentCache.get(cacheKey);
  }
  
  let rawList = [];
  
  if (msg.attachmentsJson) {
    if (typeof msg.attachmentsJson === 'string' && msg.attachmentsJson.trim()) {
      try {
        const parsed = JSON.parse(msg.attachmentsJson);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else if (parsed && typeof parsed === 'object') {
          rawList = [parsed];
        }
      } catch (e) {
        rawList = [];
      }
    } else if (Array.isArray(msg.attachmentsJson)) {
      rawList = msg.attachmentsJson;
    }
  } else if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    rawList = msg.attachments;
  } else if (msg.attachments && typeof msg.attachments === 'string') {
    try {
      const parsed = JSON.parse(msg.attachments);
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawList = [parsed];
      }
    } catch (e) {
      // not JSON string
    }
  } else if (msg.attachment) {
    if (Array.isArray(msg.attachment)) rawList = msg.attachment;
    else if (typeof msg.attachment === 'string') {
      try {
        const parsed = JSON.parse(msg.attachment);
        rawList = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        rawList = [{ url: msg.attachment, fileUrl: msg.attachment }];
      }
    } else if (typeof msg.attachment === 'object') {
      rawList = [msg.attachment];
    }
  } else if (msg.fileUrl || msg.file_url) {
    rawList = [{
      fileUrl: msg.fileUrl || msg.file_url,
      fileName: msg.fileName || msg.file_name || 'attachment',
      fileType: msg.fileType || msg.file_type || '',
      fileSize: msg.fileSize || msg.file_size || 0
    }];
  }

  const result = rawList.map(att => {
    if (!att) return null;
    if (typeof att === 'string') {
      const fileName = att.split('/').pop()?.split('?')[0] || 'attachment';
      return {
        fileName,
        name: fileName,
        fileUrl: att,
        url: att,
        content: att,
        fileType: '',
        type: '',
        fileSize: 0,
        size: 0
      };
    }
    
    const fileName = att.fileName || att.name || att.filename || att.originalName || att.title || 'Attachment';
    const fileUrl = att.fileUrl || att.url || att.content || att.downloadUrl || att.path || '';
    const fileType = att.fileType || att.type || att.contentType || att.mimeType || '';
    const fileSize = att.fileSize || att.size || 0;

    return {
      fileName,
      name: fileName,
      fileUrl,
      url: fileUrl,
      content: fileUrl,
      fileType,
      type: fileType,
      fileSize,
      size: fileSize
    };
  }).filter(Boolean);

  if (cacheKey) {
    attachmentCache.set(cacheKey, result);
  }

  return result;
};

const CommentAttachmentItem = React.memo(({ att, isMe, onOpenImage, handleDownload, handleView }) => {
  const [imageError, setImageError] = useState(false);
  
  const fileName = att.name || att.fileName || 'Attachment';
  const fileUrl = att.url || att.fileUrl || att.content || '';
  const fileType = att.type || att.fileType || '';
  const fileSize = att.size || att.fileSize || 0;
  
  const meta = getFileMeta(fileName, fileType);

  // If URL is missing, or image failed to load, show safe fallback
  if (!fileUrl || (meta.isImage && imageError)) {
    return (
      <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-black/10 dark:border-white/10 shadow-sm max-w-xs transition-all ${
        isMe ? 'bg-white/15 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200'
      }`}>
        <div className="p-2 rounded-lg bg-black/10 dark:bg-white/10 text-inherit shrink-0">
          <MdAttachFile size={20} className="rotate-45" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold truncate" title={fileName}>
            {fileName}
          </span>
          <span className="text-[10px] opacity-70">
            Attachment unavailable
          </span>
        </div>
      </div>
    );
  }

  if (meta.isImage) {
    return (
      <div className="flex flex-col rounded-xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm bg-black/5 dark:bg-white/5 max-w-xs sm:max-w-sm">
        <div 
          className="cursor-pointer overflow-hidden bg-black/5 dark:bg-black/20 max-h-60 flex items-center justify-center group"
          onClick={() => onOpenImage && onOpenImage({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })}
        >
          <img 
            src={fileUrl} 
            alt={fileName} 
            onError={() => setImageError(true)}
            className="max-h-60 w-auto max-w-full object-contain group-hover:scale-[1.02] transition-transform duration-200" 
          />
        </div>
        <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-black/10 dark:bg-black/30 text-inherit text-xs">
          <span className="truncate font-medium text-[11px]" title={fileName}>{fileName}</span>
          <div className="flex items-center gap-1 shrink-0 printable-conversation-no-print">
            <button 
              type="button" 
              onClick={() => handleView && handleView({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })}
              title="View full image" 
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <MdVisibility size={14} />
            </button>
            <button 
              type="button" 
              onClick={() => handleDownload && handleDownload({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })}
              title="Download image" 
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <MdFileDownload size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const IconComp = meta.icon;
  return (
    <div 
      className={`flex items-center gap-3 p-2.5 rounded-xl border border-black/10 dark:border-white/10 shadow-sm transition-all max-w-xs sm:max-w-sm ${
        isMe ? 'bg-white/15 hover:bg-white/20 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200'
      }`}
    >
      <div className={`p-2 rounded-lg shrink-0 ${meta.bg} ${meta.color} print:bg-gray-100`}>
        <IconComp size={22} />
      </div>
      <div 
        className="flex flex-col min-w-0 flex-1 cursor-pointer" 
        onClick={() => handleView && handleView({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })}
      >
        <span className="text-xs font-semibold truncate hover:underline" title={fileName}>
          {fileName}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] opacity-70 mt-0.5">
          <span className="font-bold uppercase tracking-wider">{meta.extLabel}</span>
          {fileSize > 0 && (
            <>
              <span>•</span>
              <span>{formatFileSize(fileSize)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 printable-conversation-no-print">
        <button 
          type="button"
          onClick={() => handleView && handleView({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })} 
          title={`View ${fileName}`} 
          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <MdVisibility size={16} />
        </button>
        <button 
          type="button"
          onClick={() => handleDownload && handleDownload({ ...att, fileName, name: fileName, fileUrl, content: fileUrl })} 
          title={`Download ${fileName}`} 
          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <MdFileDownload size={16} />
        </button>
      </div>
    </div>
  );
});

const parseMessageDate = (timestamp) => {
  if (!timestamp) return null;

  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime()) ? null : timestamp;
  }

  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }

  if (Array.isArray(timestamp)) {
    // Jackson array format: [year, month, day, hour, minute, second, nano]
    const [year, month, day, hour = 0, minute = 0, second = 0] = timestamp;
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof timestamp === 'string') {
    let str = timestamp.trim();
    if (!str) return null;

    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }

    // Backend stores and sends UTC timestamps formatted with ISO_LOCAL_DATE_TIME (without 'Z').
    // In JavaScript ECMAScript, ISO strings without timezone are treated as local time.
    // If no timezone offset (Z or +/-HH:mm) is present, treat as UTC by appending 'Z'.
    const hasTimezone = /Z$|[+-]\d{2}(:?\d{2})?$/i.test(str);
    if (!hasTimezone) {
      str = `${str}Z`;
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? null : d;
};

const formatMessageTime = (timestamp) => {
  const date = parseMessageDate(timestamp);
  if (!date) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const rawHours = date.getHours();
  const hours12 = rawHours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = rawHours >= 12 ? 'PM' : 'AM';

  return `${month} ${day}, ${hours12}:${minutes} ${period}`;
};

export const formatBroadcastTimestamp = (timestamp, userTimeZone) => {
  const date = parseMessageDate(timestamp);
  if (!date || isNaN(date.getTime())) return '';

  const timeZone = userTimeZone || 'Asia/Kolkata';

  return date.toLocaleString('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(/[\u202f\u00a0]/g, ' ');
};

const isMessageFromMe = (msg, currentUser) => {
  if (!msg || !currentUser) return false;
  const userEmail = (currentUser.email || "").toLowerCase().trim();
  const userUsername = (currentUser.username || "").toLowerCase().trim();
  const senderEmail = (msg.senderEmail || msg.sender_email || "").toLowerCase().trim();
  const rawSender = (msg.sender || msg.from || "").toLowerCase().trim();
  const senderUsername = (msg.senderUsername || msg.sender_username || msg.username || msg.userName || "").toLowerCase().trim();

  if (userEmail) {
    if (senderEmail && senderEmail === userEmail) return true;
    if (rawSender && (rawSender === userEmail || (rawSender.includes('@') && rawSender.split('@')[0] === userEmail.split('@')[0]))) return true;
  }
  if (userUsername) {
    if (senderUsername && senderUsername === userUsername) return true;
    if (rawSender && (rawSender === userUsername || (rawSender.includes('@') && rawSender.split('@')[0] === userUsername))) return true;
    if (senderEmail && (senderEmail === userUsername || (senderEmail.includes('@') && senderEmail.split('@')[0] === userUsername))) return true;
  }
  return false;
};

const getCommentSenderName = (msg, isMe, currentUser) => {
  if (!msg) return "";

  // 1. Explicit display name or sender name from message fields
  const explicitDisplayName =
    msg.senderName ||
    msg.senderDisplayName ||
    msg.displayName ||
    msg.sender_name ||
    msg.fullName ||
    msg.name ||
    msg.user?.displayName ||
    msg.user?.name ||
    msg.user?.fullName ||
    msg.senderInfo?.displayName ||
    msg.senderInfo?.name;

  if (explicitDisplayName && typeof explicitDisplayName === "string" && explicitDisplayName.trim()) {
    return explicitDisplayName.trim();
  }

  // 2. If it's the current logged in user, prefer current user's profile display name
  if (isMe && currentUser) {
    const currentFullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ").trim();
    const currentUserName =
      currentUser.displayName ||
      currentUser.name ||
      currentUser.fullName ||
      currentFullName ||
      currentUser.username;

    if (currentUserName && typeof currentUserName === "string" && currentUserName.trim()) {
      return currentUserName.trim();
    }
  }

  // 3. Explicit username field from message
  const explicitUsername =
    msg.senderUsername ||
    msg.sender_username ||
    msg.username ||
    msg.userName ||
    msg.user?.username ||
    msg.user?.userName ||
    msg.senderInfo?.username;

  if (explicitUsername && typeof explicitUsername === "string" && explicitUsername.trim()) {
    const trimmed = explicitUsername.trim();
    if (!trimmed.includes(" ") && !/[A-Z]/.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
  }

  // 4. Sender / senderEmail / from field
  const rawSender = msg.sender || msg.senderEmail || msg.sender_email || msg.from || "";
  if (rawSender && typeof rawSender === "string" && rawSender.trim()) {
    const trimmed = rawSender.trim();
    if (trimmed.includes("@")) {
      const local = trimmed.split("@")[0];
      if (local) {
        // If local part has dots/underscores (e.g. "dilli.prasath" -> "Dilli Prasath")
        if (/[._]/.test(local)) {
          return local
            .split(/[._]/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }
        // Capitalize first letter if all lowercase (e.g. "rahul" -> "Rahul", "arun" -> "Arun")
        if (!/[A-Z]/.test(local)) {
          return local.charAt(0).toUpperCase() + local.slice(1);
        }
        return local;
      }
      return trimmed;
    }
    // If not email (e.g. "Rahul" or "rahul"), capitalize first letter if all lowercase
    if (!trimmed.includes(" ") && !/[A-Z]/.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
  }

  // 5. Fallback to sender email if available
  if (msg.senderEmail && typeof msg.senderEmail === "string" && msg.senderEmail.trim()) {
    return msg.senderEmail.trim();
  }

  return isMe ? "You" : "Unknown";
};

const CommentMessageItem = React.memo(({
  msg,
  isMe,
  senderName,
  theme,
  onOpenImage,
  handleDownload,
  handleView,
  formatTime
}) => {
  const atts = msg.parsedAttachments || getNormalizedAttachments(msg);
  const msgContent = msg.content !== undefined && msg.content !== null
    ? msg.content
    : (msg.message !== undefined && msg.message !== null ? msg.message : (msg.text || msg.body || ""));
  const hasText = Boolean(msgContent && (typeof msgContent === 'string' ? msgContent.trim() : String(msgContent)));
  if (!hasText && atts.length === 0) return null;

  return (
    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 comment-card printable-item print:mb-3">
      <div className="max-w-[85%] sm:max-w-[75%] print:max-w-full flex flex-col items-start">
        <span className="text-[10px] font-bold mb-1 ml-2 opacity-60 print:opacity-100 print:text-gray-700 print:text-[11px]" style={{ color: theme.subText }}>
          {senderName}
        </span>
        <div className="flex flex-col w-fit print:w-full">
          <div 
            className={`px-4 py-2.5 rounded-2xl shadow-sm relative print:rounded-xl print:border print:border-gray-300 print:bg-white print:text-black print:shadow-none ${
              isMe 
                ? 'bg-primary text-white rounded-tr-sm' 
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-sm'
            }`}
          >
            {hasText ? (
              <p className={`text-[14px] leading-relaxed whitespace-pre-wrap print:text-black ${atts.length > 0 ? 'mb-2.5' : ''}`}>
                {msgContent}
              </p>
            ) : null}
            
            {/* Attachments Rendering */}
            {atts.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                {atts.map((att, i) => (
                  <CommentAttachmentItem
                    key={i}
                    att={att}
                    isMe={isMe}
                    onOpenImage={onOpenImage}
                    handleDownload={handleDownload}
                    handleView={handleView}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Timestamp outside and below the bubble */}
          <div 
            className="text-[9px] mt-1 opacity-60 font-medium select-none text-gray-500 dark:text-gray-400 self-end mr-2 text-right print:opacity-100 print:text-gray-500"
          >
            {formatTime(msg.timestamp)}
            {msg.isOptimistic && " • sending..."}
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.content === next.msg.content &&
    prev.msg.message === next.msg.message &&
    prev.msg.isOptimistic === next.msg.isOptimistic &&
    prev.msg.timestamp === next.msg.timestamp &&
    prev.msg.attachmentsJson === next.msg.attachmentsJson &&
    prev.isMe === next.isMe &&
    prev.senderName === next.senderName &&
    prev.theme?.accent === next.theme?.accent &&
    prev.theme?.text === next.theme?.text &&
    prev.theme?.mode === next.theme?.mode
  );
});

const ChatRoom = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isConnected, subscribeToChat, sendMessage } = useSocket();

  const processedMessageIdsRef = useRef(new Set());

  const [chat, setChat] = useState(() => {
    return location.state?.chat || chatCache.getChat(chatId) || null;
  });
  const [messages, setMessages] = useState(() => {
    const cached = chatCache.getMessages(chatId);
    if (cached && Array.isArray(cached)) {
      cached.forEach(m => {
        if (m && m.id) processedMessageIdsRef.current.add(String(m.id));
      });
      return cached;
    }
    return [];
  });
  const [newMessage, setNewMessage] = useState("");
  const [loadingComments, setLoadingComments] = useState(() => {
    return !chatCache.hasMessages(chatId);
  });
  const [commentsError, setCommentsError] = useState(null);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isChatStarred, setIsChatStarred] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

  useEffect(() => {
    processedMessageIdsRef.current.clear();
  }, [chatId]);

  useEffect(() => {
    if (chat) {
      setIsChatStarred(Boolean(chat.starred || chat.isStarred));
    } else {
      setIsChatStarred(false);
    }
  }, [chat]);

  const handleArchiveChat = async () => {
    const targetId = chatId || chat?.uid || chat?.id;
    if (!targetId) return;

    try {
      if (mailAPI.archive) {
        await mailAPI.archive(targetId, 'chat');
      }
      toast.success("Chat archived");
      if (chat?.type === 'DIRECT') {
        navigate("/chat");
      } else {
        navigate("/colab");
      }
    } catch (err) {
      console.error("Failed to archive chat", err);
      toast.error("Failed to archive chat");
    }
  };

  const handleSnoozeChat = async (wakeUpDate) => {
    const targetId = chatId || chat?.uid || chat?.id;
    if (!targetId) return;
    const wakeUpAt = wakeUpDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      if (mailAPI.snooze) {
        await mailAPI.snooze(targetId, wakeUpAt, 'chat');
      }
      toast.success("Chat snoozed");
      if (chat?.type === 'DIRECT') {
        navigate("/chat");
      } else {
        navigate("/colab");
      }
    } catch (err) {
      console.error("Failed to snooze chat", err);
      toast.error("Failed to snooze chat");
    }
  };

  const handleDeleteChat = async () => {
    const targetId = chatId || chat?.uid || chat?.id;
    if (!targetId) return;

    try {
      if (mailAPI.trash) {
        await mailAPI.trash(targetId, 'chat');
      }
      toast.success("Chat deleted");
      if (chat?.type === 'DIRECT') {
        navigate("/chat");
      } else {
        navigate("/colab");
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
      toast.error("Failed to delete chat");
    }
  };

  const handleToggleStarChat = async () => {
    const targetId = chatId || chat?.uid || chat?.id;
    if (!targetId) return;
    const newStarred = !isChatStarred;

    try {
      if (mailAPI.toggleStar) {
        await mailAPI.toggleStar(targetId, 'chat');
      }
      setIsChatStarred(newStarred);
      setChat(prev => prev ? { ...prev, starred: newStarred, isStarred: newStarred } : null);
    } catch (err) {
      console.error("Failed to toggle star chat", err);
      toast.error("Failed to update star");
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMoreMenu]);

  // Layout States (Info Modal, Compose Modal, Collapsed Chat)
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [isChatPaneOpen, setIsChatPaneOpen] = useState(true);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const fileInputRef = useRef(null);

  // Group Members State
  const [membersList, setMembersList] = useState(() => {
    return chatCache.getMembers(chatId) || location.state?.chat?.memberEmails || [];
  });
  const [emailsInput, setEmailsInput] = useState("");
  const [addingMembers, setAddingMembers] = useState(false);

  // Broadcasts List State
  const [broadcasts, setBroadcasts] = useState(() => {
    return chatCache.getBroadcasts(chatId) || [];
  });
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(() => {
    return !chatCache.hasBroadcasts(chatId);
  });

  // Broadcast Email Form State
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const emailBodyRef = useRef(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [broadcastAttachments, setBroadcastAttachments] = useState([]);

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setBroadcastAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            content: event.target.result
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDownloadAttachment = useCallback((att) => {
    try {
      if (!att) return;
      const content = att.url || att.fileUrl || att.content;
      const name = att.name || att.fileName || "download";
      const type = att.type || att.fileType || 'application/octet-stream';
      if (!content) {
        toast.error("Attachment URL not available");
        return;
      }
      if (content.startsWith('data:')) {
        const base64Data = content.split(',')[1] || content;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        const link = document.createElement("a");
        link.href = content;
        link.download = name;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Error downloading attachment:", e);
      toast.error("Failed to download attachment");
    }
  }, []);

  const handleViewAttachment = useCallback((att) => {
    try {
      if (!att) return;
      const content = att.url || att.fileUrl || att.content;
      const type = att.type || att.fileType || 'application/octet-stream';
      if (!content) {
        toast.error("Attachment URL not available");
        return;
      }
      if (content.startsWith('data:')) {
        const base64Data = content.split(',')[1] || content;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else {
        window.open(content, "_blank");
      }
    } catch (e) {
      console.error("Error viewing attachment:", e);
      if (att.fileUrl || att.url || att.content) {
        window.open(att.fileUrl || att.url || att.content, "_blank");
      }
    }
  }, []);

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this Colab?")) return;
    try {
      await chatAPI.leaveGroup(chatId);
      toast.success("You left the Colab");
      navigate("/colab");
    } catch (error) {
      toast.error("Failed to leave the group");
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this Colab? This action cannot be undone.")) return;
    try {
      await chatAPI.deleteGroup(chatId);
      toast.success("Colab deleted successfully");
      navigate("/colab");
    } catch (error) {
      toast.error("Failed to delete the Colab");
    }
  };

  const [templates, setTemplates] = useState(() => 
    DEFAULT_TEMPLATES.map(t => ({
      ...t,
      name: t.title || t.name,
      isDefault: true
    }))
  );
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const handleRenameGroup = async () => {
    if (!editingName.trim()) return;
    try {
      const res = await chatAPI.renameGroup(chatId, editingName);
      setChat(res.data);
      setIsEditingName(false);
      toast.success("Colab renamed successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rename Colab");
    }
  };

  const isUserNearBottom = () => {
    const container = messagesContainerRef.current || messagesEndRef.current?.parentElement;
    if (!container) return true;
    const threshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  };

  const scrollToBottom = (force = false) => {
    if (force || isUserNearBottom()) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else if (messagesEndRef.current?.parentElement) {
        messagesEndRef.current.parentElement.scrollTop = messagesEndRef.current.parentElement.scrollHeight;
      }
      setHasNewMessagesBelow(false);
    }
  };

  const handleMessagesScroll = () => {
    if (isUserNearBottom()) {
      setHasNewMessagesBelow(false);
    }
  };


  const handleIncomingMessage = useCallback((response, fromRestTempId = null) => {
    if (!response || !response.id) return;
    const msgId = String(response.id);

    // If this message ID was already processed, ignore to prevent duplicate processing
    if (processedMessageIdsRef.current.has(msgId)) {
      if (fromRestTempId) {
        setMessages(prev => prev.filter(m => m.id !== fromRestTempId));
      }
      return;
    }

    // Mark message ID as processed immediately
    processedMessageIdsRef.current.add(msgId);

    const msgSender = response.sender || response.senderEmail || user?.email || "";
    const msgContent = response.content !== undefined && response.content !== null 
      ? response.content 
      : (response.message !== undefined && response.message !== null ? response.message : "");
    const isMe = isMessageFromMe(response, user);
    const nearBottom = isUserNearBottom();

    setMessages(prev => {
      // Check if message is already in list
      if (prev.some(m => String(m.id) === msgId)) {
        if (fromRestTempId) {
          return prev.filter(m => m.id !== fromRestTempId);
        }
        return prev;
      }

      const completeMsg = {
        ...response,
        id: response.id,
        sender: msgSender,
        content: msgContent,
        message: msgContent,
        attachmentsJson: response.attachmentsJson !== undefined && response.attachmentsJson !== null 
          ? response.attachmentsJson 
          : null,
        parsedAttachments: getNormalizedAttachments(response),
        timestamp: response.timestamp || new Date().toISOString(),
        isOptimistic: false
      };

      // Find optimistic message to replace:
      // 1. By exact tempId if passed from REST
      // 2. Or by optimistic flag and sender/content match from WebSocket
      let replaceIdx = -1;
      if (fromRestTempId) {
        replaceIdx = prev.findIndex(m => m.id === fromRestTempId);
      }
      if (replaceIdx === -1) {
        replaceIdx = prev.findIndex(m => 
          m.isOptimistic && 
          (m.sender === msgSender || m.sender === user?.email || isMessageFromMe(m, user)) &&
          ((m.content || "") === (msgContent || "") || (!m.content && !msgContent))
        );
      }

      if (replaceIdx !== -1) {
        const newMsgs = [...prev];
        // Preserve optimistic attachment details if server response had empty parsedAttachments
        if (!completeMsg.parsedAttachments?.length && newMsgs[replaceIdx].parsedAttachments?.length) {
          completeMsg.parsedAttachments = newMsgs[replaceIdx].parsedAttachments;
        }
        if (!completeMsg.attachmentsJson && newMsgs[replaceIdx].attachmentsJson) {
          completeMsg.attachmentsJson = newMsgs[replaceIdx].attachmentsJson;
        }
        newMsgs[replaceIdx] = completeMsg;
        return newMsgs;
      }

      return [...prev, completeMsg];
    });

    if (isMe || nearBottom) {
      setTimeout(() => scrollToBottom(true), 50);
    } else {
      setHasNewMessagesBelow(true);
    }
  }, [user?.email]);

  const removeAttachment = (index) => {
    setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB limit per file
    const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'msi', 'vbs', 'scr', 'dll', 'com', 'app', 'bin', 'jar', 'apk', 'dmg', 'iso'];
    const SUPPORTED_EXTENSIONS = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
      'pdf',
      'doc', 'docx', 'txt', 'rtf', 'odt',
      'xls', 'xlsx', 'csv', 'ods',
      'ppt', 'pptx', 'odp'
    ];

    for (const file of files) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        toast.error(`"${file.name}" is not a supported file format.`);
        continue;
      }

      const isAllowed = (file.type && file.type.startsWith('image/')) || SUPPORTED_EXTENSIONS.includes(ext);
      if (!isAllowed) {
        toast.error(`"${file.name}" is not a supported file format. Please attach images, PDFs, or documents.`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" is too large. Maximum allowed size is 10MB.`);
        continue;
      }

      // Check if file is already attached
      let alreadyExists = false;
      setSelectedAttachments(prev => {
        if (prev.some(a => (a.name || a.fileName) === file.name && (a.size || a.fileSize) === file.size)) {
          alreadyExists = true;
        }
        return prev;
      });

      if (alreadyExists) {
        toast.error(`"${file.name}" is already attached.`);
        continue;
      }

      try {
        // If file already has a usable URL/path, use it directly without Base64 conversion
        let fileUrl = file.url || file.fileUrl || file.path;

        if (!fileUrl) {
          // If it's an image, optimize dimensions/quality to avoid massive payloads
          if (file.type && file.type.startsWith('image/') && !file.type.includes('svg')) {
            fileUrl = await compressImageFile(file);
          } else {
            fileUrl = await readFileAsDataUrl(file);
          }
        }

        if (fileUrl) {
          const attachment = {
            name: file.name,
            url: fileUrl,
            type: file.type || 'application/octet-stream',
            size: file.size
          };

          setSelectedAttachments(current => {
            if (current.some(a => (a.name || a.fileName) === file.name && (a.size || a.fileSize) === file.size)) {
              return current;
            }
            return [...current, attachment];
          });
        }
      } catch (err) {
        console.error("Failed to process attachment file:", err);
        toast.error(`Failed to process "${file.name}".`);
      }
    }
  };

  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Abort pending requests from previous chat room when switching
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    isFetchingHistoryRef.current = false;

    // Clear stale messages and comments error when changing chat
    const cached = chatCache.getMessages(chatId);
    if (cached && Array.isArray(cached)) {
      setMessages(cached);
      setLoadingComments(false);
      cached.forEach(m => {
        if (m && m.id) processedMessageIdsRef.current.add(String(m.id));
      });
    } else {
      setMessages([]);
      setLoadingComments(true);
    }
    setCommentsError(null);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [chatId]);

  const fetchChatDetails = async (signal) => {
    if (chat) return;
    const cachedChat = chatCache.getChat(chatId);
    if (cachedChat) {
      setChat(cachedChat);
      return;
    }
    if (user?.email) {
      const userChats = chatCache.getUserChats(user.email);
      if (Array.isArray(userChats) && userChats.length > 0) {
        const found = userChats.find(c => String(c.id) === String(chatId));
        if (found) {
          setChat(found);
          chatCache.setChat(chatId, found);
          return;
        }
      }
    }
    if (!user?.email) return;
    try {
      const res = await chatAPI.getUserChats(user.email, { signal });
      if (res.data) {
        const chatList = Array.isArray(res.data) ? res.data : (res.data.data || []);
        const currentChat = chatList.find(c => String(c.id) === String(chatId));
        if (currentChat) {
          setChat(currentChat);
          chatCache.setChat(chatId, currentChat);
        }
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error("Failed to fetch chat details:", err);
    }
  };

  const isFetchingHistoryRef = useRef(false);

  const fetchHistory = useCallback(async (customSignal = null) => {
    if (!chatId) {
      setLoadingComments(false);
      return;
    }
    if (isFetchingHistoryRef.current) return;
    isFetchingHistoryRef.current = true;

    let signal = customSignal;
    if (!signal) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      signal = abortControllerRef.current.signal;
    }

    const hasCached = chatCache.hasMessages(chatId);
    if (!hasCached) {
      setLoadingComments(true);
    }
    setCommentsError(null);

    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      if (isFetchingHistoryRef.current && abortControllerRef.current && !signal?.aborted) {
        isTimeout = true;
        abortControllerRef.current.abort();
      }
    }, 25000);

    try {
      const res = await chatAPI.getMessageHistory(chatId, { signal, timeout: 25000 });
      let history = [];
      if (res && res.data) {
        if (Array.isArray(res.data)) {
          history = res.data;
        } else if (Array.isArray(res.data.data)) {
          history = res.data.data;
        } else if (Array.isArray(res.data.comments)) {
          history = res.data.comments;
        } else if (Array.isArray(res.data.messages)) {
          history = res.data.messages;
        } else if (Array.isArray(res.data.content)) {
          history = res.data.content;
        }
      }

      const normalizedHistory = history.map(msg => {
        if (!msg) return null;
        const content = msg.content !== undefined && msg.content !== null
          ? msg.content
          : (msg.message !== undefined && msg.message !== null ? msg.message : (msg.text || msg.body || ""));
        const sender = msg.sender || msg.senderEmail || msg.sender_email || msg.from || "";
        const timestamp = msg.timestamp || msg.createdAt || msg.created_at || msg.time || msg.sentDate || "";
        
        return {
          ...msg,
          id: msg.id || msg._id,
          content,
          message: content,
          sender,
          timestamp,
          parsedAttachments: msg.parsedAttachments || getNormalizedAttachments(msg)
        };
      }).filter(Boolean);

      normalizedHistory.forEach(msg => {
        if (msg && msg.id) {
          processedMessageIdsRef.current.add(String(msg.id));
        }
      });

      // Render messages immediately without blocking
      setMessages(normalizedHistory);
      setCommentsError(null);
      chatCache.setMessages(chatId, normalizedHistory);
    } catch (err) {
      const isCanceled = (
        err?.name === 'CanceledError' || 
        err?.code === 'ERR_CANCELED' || 
        err?.message === 'canceled' ||
        signal?.aborted
      );

      if (!isCanceled) {
        const fallback = chatCache.getMessages(chatId);
        if (fallback && fallback.length > 0) {
          setMessages(fallback);
          setCommentsError(null);
        } else if (isTimeout) {
          console.warn("Comments request timed out");
          setCommentsError("Unable to load comments. Please check your connection.");
        } else {
          console.warn("Could not fetch comments history:", err?.message || err);
          setCommentsError(null);
        }
      }
    } finally {
      clearTimeout(timeoutId);
      isFetchingHistoryRef.current = false;
      setLoadingComments(false);
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [chatId]);

  const fetchChatMembers = async (signal) => {
    if (!chatId) return;
    try {
      const res = await chatAPI.getMembers(chatId, { signal });
      if (res && res.data) {
        setMembersList(res.data);
        chatCache.setMembers(chatId, res.data);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.warn("Error fetching chat members:", err);
      const fallback = chatCache.getMembers(chatId);
      if (fallback) setMembersList(fallback);
    }
  };

  const fetchBroadcasts = async (signal) => {
    if (!chatId) return;
    const hasCached = chatCache.hasBroadcasts(chatId);
    if (!hasCached) {
      setLoadingBroadcasts(true);
    }
    try {
      const res = await chatAPI.getBroadcasts(chatId, { signal });
      if (res && res.data) {
        const list = res.data || [];
        setBroadcasts(list);
        chatCache.setBroadcasts(chatId, list);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.warn("Failed to load broadcasts:", err);
      const fallback = chatCache.getBroadcasts(chatId);
      if (fallback) setBroadcasts(fallback);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchTemplates = async () => {
    const defaultMapped = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      name: t.title || t.name,
      isDefault: true
    }));

    let customMapped = [];
    if (user?.email) {
      try {
        const res = await templateAPI.getTemplates(user.email);
        const dataList = res.data?.data || res.data || [];
        customMapped = dataList.map(t => ({
          ...t,
          name: t.title || t.name,
          isDefault: false
        }));
      } catch (err) {
        console.error("Error loading templates from backend:", err);
        // Fallback to local storage
        const saved = localStorage.getItem("bnx_mail_custom_templates");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            customMapped = parsed.map(t => ({
              ...t,
              name: t.title || t.name,
              isDefault: false
            }));
          } catch (e) {
            console.error("Error parsing templates from local storage:", e);
          }
        }
      }
    } else {
      const saved = localStorage.getItem("bnx_mail_custom_templates");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          customMapped = parsed.map(t => ({
            ...t,
            name: t.title || t.name,
            isDefault: false
          }));
        } catch (e) {
          console.error("Error parsing templates from local storage:", e);
        }
      }
    }

    setTemplates([...defaultMapped, ...customMapped]);
  };


  // 1. Comments Loading: Independent & immediate (Priority 1)
  useEffect(() => {
    if (!chatId) return;

    // Immediately start Comments API request with signal
    fetchHistory(abortControllerRef.current?.signal);
  }, [chatId, fetchHistory]);

  // 2. Auxiliary Data (Chat details, Broadcasts, Members): Deferred to give Comments API immediate priority
  useEffect(() => {
    if (!chatId) return;

    const cachedChat = chatCache.getChat(chatId);
    if (cachedChat && !chat) {
      setChat(cachedChat);
    }
    const cachedBcasts = chatCache.getBroadcasts(chatId);
    if (cachedBcasts) {
      setBroadcasts(cachedBcasts);
      setLoadingBroadcasts(false);
    }
    const cachedMbrs = chatCache.getMembers(chatId);
    if (cachedMbrs?.length) {
      setMembersList(cachedMbrs);
    }

    // Defer auxiliary requests slightly so Comments request hits the network first
    const timer = setTimeout(() => {
      const signal = abortControllerRef.current?.signal;
      fetchChatDetails(signal);
      fetchChatMembers(signal);
      fetchBroadcasts(signal);
    }, 100);

    return () => clearTimeout(timer);
  }, [chatId]);

  // Subscribe to live messages over WebSocket
  useEffect(() => {
    let subscription = null;
    if (chatId && isConnected) {
      subscription = subscribeToChat(chatId, (response) => {
        handleIncomingMessage(response);
      });
    }

    return () => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (e) {}
    };
  }, [chatId, isConnected, handleIncomingMessage]);

  // Lazy load templates ONLY when user actually opens the Compose Broadcast modal
  useEffect(() => {
    if (showComposeModal) {
      fetchTemplates();
    }
  }, [showComposeModal]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (isSendingComment) return;
    if (!newMessage.trim() && selectedAttachments.length === 0) return;

    // Save current input to restore in case sending fails
    const savedText = newMessage;
    const savedAttachments = [...selectedAttachments];

    // Create attachment objects with structure: { name, url, type, size }
    const attachments = selectedAttachments.map(a => ({
      name: a.name || a.fileName || "attachment",
      url: a.url || a.fileUrl || a.content || "",
      type: a.type || a.fileType || "application/octet-stream",
      size: a.size || a.fileSize || 0
    }));

    // Convert the attachment array to JSON
    const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;

    const contentText = newMessage.trim();
    const senderEmail = user?.email || user?.username || "";
    const senderDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.displayName || user?.name || user?.username || "";

    // Optimistic update with unique temp ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tempMsg = {
      id: tempId,
      chatId: parseInt(chatId),
      sender: senderEmail,
      senderEmail: user?.email || "",
      senderUsername: user?.username || "",
      senderName: senderDisplayName,
      content: contentText,
      message: contentText,
      attachmentsJson: attachmentsJson,
      parsedAttachments: attachments,
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage("");
    setSelectedAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsSendingComment(true);
    setTimeout(() => scrollToBottom(true), 50);

    const payload = {
      chatId: parseInt(chatId),
      sender: senderEmail,
      message: contentText,
      attachmentsJson: attachmentsJson
    };

    const sendTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Send request timed out")), 10000)
    );

    try {
      if (attachmentsJson) {
        // Messages with attachments are sent via HTTP REST (POST /api/chat/message)
        const res = await Promise.race([
          chatAPI.sendMessage(payload),
          sendTimeout
        ]);
        const response = res.data?.data || res.data;
        if (response && response.id) {
          handleIncomingMessage(response, tempId);
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isOptimistic: false } : m));
        }
      } else {
        let isSentViaWs = false;
        if (isConnected) {
          try {
            isSentViaWs = sendMessage(chatId, contentText, null) !== false;
          } catch (wsErr) {
            isSentViaWs = false;
          }
        }
        if (!isSentViaWs) {
          const res = await Promise.race([
            chatAPI.sendMessage(payload),
            sendTimeout
          ]);
          const response = res.data?.data || res.data;
          if (response && response.id) {
            handleIncomingMessage(response, tempId);
          } else {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isOptimistic: false } : m));
          }
        }
      }
    } catch (err) {
      console.error("Failed to send comment:", err);
      toast.error("Failed to send comment. Please try again.");
      // Restore previous input and remove temporary message
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(savedText);
      setSelectedAttachments(savedAttachments);
    } finally {
      setIsSendingComment(false);
    }
  };

  // Add Member Action
  const handleAddMembers = async (e) => {
    e.preventDefault();
    if (!emailsInput.trim()) return;

    const emailsList = emailsInput.split(/[\s,]+/).filter(e => e.includes('@'));
    if (emailsList.length === 0) {
      toast.error("Please enter valid email addresses");
      return;
    }

    try {
      setAddingMembers(true);
      const res = await chatAPI.addMembers(chatId, { emails: emailsList });
      if (res.data) {
        toast.success("Invitations sent!");
        setEmailsInput("");
        fetchChatMembers();
      }
    } catch (err) {
      toast.error("Failed to add members");
    } finally {
      setAddingMembers(false);
    }
  };

  // Broadcast Email Action
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    const bodyContent = emailBodyRef.current ? emailBodyRef.current.innerHTML : emailBody;
    const cleanContent = bodyContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    if (!emailSubject.trim() || !cleanContent) {
      toast.error("Subject and body are required");
      return;
    }

    try {
      setSendingEmail(true);
      toast.loading("Sending broadcast...", { id: "send-broadcast" });
      
      await chatAPI.sendBroadcast(chatId, {
        subject: emailSubject,
        body: bodyContent,
        attachmentsJson: broadcastAttachments.length > 0 ? JSON.stringify(broadcastAttachments) : null
      });
      
      toast.success("Broadcast sent successfully", { id: "send-broadcast" });
      setEmailSubject("");
      setEmailBody("");
      if (emailBodyRef.current) emailBodyRef.current.innerHTML = "";
      setSelectedTemplate("");
      setBroadcastAttachments([]);
      setShowComposeModal(false);
      fetchBroadcasts();
    } catch (err) {
      toast.error("Failed to send broadcast", { id: "send-broadcast" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    if (!templateId) {
      setEmailSubject("");
      setEmailBody("");
      if (emailBodyRef.current) emailBodyRef.current.innerHTML = "";
      return;
    }
    const selected = templates.find(t => String(t.id) === String(templateId));
    if (selected) {
      setEmailSubject(selected.subject || selected.title || selected.name || "");
      const bodyContent = selected.body || "";
      setEmailBody(bodyContent);
      if (emailBodyRef.current) {
        emailBodyRef.current.innerHTML = bodyContent;
      }
    }
  };

  const chatPartner = chat?.memberEmails?.find(e => e !== user.email);
  const chatName = chat?.type === 'DIRECT' ? chatPartner?.split('@')[0] : (chat?.name || `Chat #${chatId}`);

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden chat-room-root">
      {/* Action Toolbar */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-2 border-b shrink-0 relative z-20 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md printable-conversation-no-print"
        style={{ borderColor: theme.border || 'rgba(229,231,235,0.5)' }}
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              if (chat?.type === 'DIRECT') {
                navigate("/chat");
              } else {
                navigate("/colab");
              }
            }}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
            title="Back"
          >
            <MdArrowBack size={20} />
          </button>
          <div className="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={handleArchiveChat}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer"
            title="Archive"
          >
            <MdArchive size={20} />
          </button>
          <button
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 hover:text-indigo-500 cursor-pointer"
            title="Labels"
          >
            <MdLabel size={20} />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => window.print()}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Print"
          >
            <MdPrint size={20} />
          </button>
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(prev => !prev)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="More"
            >
              <MdMoreVert size={20} />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <button
                  onClick={() => {
                    handleToggleStarChat();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
                >
                  {isChatStarred ? "Unstar Conversation" : "Star Conversation"}
                </button>
                <button
                  onClick={() => {
                    setIsChatPaneOpen(prev => !prev);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
                >
                  {isChatPaneOpen ? "Hide Comments Pane" : "Show Comments Pane"}
                </button>
                {chat?.type === 'GROUP' && (
                  <button
                    onClick={() => {
                      setShowInfoModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
                  >
                    View Group Info
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HEADER */}
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between bg-white/40 dark:bg-gray-900/40 backdrop-blur-md shrink-0 relative z-10 printable-conversation-no-print">
        <div className="flex items-center gap-3">
          {/* Clickable Group Name to open Colab Info Modal */}
          <div 
            onClick={() => {
              if (chat?.type === 'GROUP') {
                setShowInfoModal(true);
              }
            }}
            className={`flex items-center gap-3 ${chat?.type === 'GROUP' ? 'cursor-pointer hover:opacity-80 transition-all' : ''}`}
            title={chat?.type === 'GROUP' ? "View group details & members" : ""}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${chat?.type === 'GROUP' ? 'bg-gradient-to-br from-primary to-purple-600' : 'bg-gradient-to-br from-teal-500 to-blue-600'}`}>
              {chatName?.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h2 className="font-bold leading-tight text-sm sm:text-base" style={{ color: theme.text }}>{chatName}</h2>
                {chat?.type === 'GROUP' && <MdInfoOutline size={14} className="opacity-60 text-gray-500 dark:text-gray-400" />}
              </div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-primary opacity-80">
                {chat?.type || 'CONVERSATION'} • {isConnected ? 'Online' : 'Reconnecting...'}
              </p>
            </div>
          </div>
        </div>

        {chat?.type === 'GROUP' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowComposeModal(true)}
              className="md:hidden p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
              style={{ color: theme.subText }}
              title="Compose Broadcast"
            >
              <MdEmail size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Main Split Container */}
      <div className={`flex-1 flex flex-col md:flex-row overflow-hidden relative p-4 transition-all duration-300 colab-print-container printable-conversation ${isChatPaneOpen ? 'gap-4' : 'gap-0'}`}>
        
        {/* Print-Only Top Header */}
        <div className="hidden print:block w-full border-b border-gray-300 pb-3 mb-6 text-center shrink-0">
          <h1 className="text-2xl font-bold tracking-wider text-black">BNXmail</h1>
          {chatName && <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mt-1">{chatName}</p>}
          {chatPartner && chat?.type === 'DIRECT' && <p className="text-xs text-gray-500 mt-0.5">{chatPartner}</p>}
        </div>

        {/* Left Side: Professional Broadcast list (60% width) */}
        {chat?.type === 'GROUP' && (
          <div className={`flex flex-col h-full rounded-2xl border border-gray-200/50 dark:border-gray-800/50 bg-white/60 dark:bg-gray-900/60 shadow-sm overflow-hidden shrink-0 transition-all duration-300 ease-in-out printable-section ${isChatPaneOpen ? 'w-full h-1/2 md:h-full md:w-[60%]' : 'w-full h-full'}`}>
            
            {/* Header: Professional Broadcast Title */}
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] shrink-0 print:border-none print:bg-transparent print:p-0 print:mb-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5 print:text-sm print:font-bold print:uppercase print:tracking-wider print:text-black" style={{ color: theme.text }}>
                <MdEmail size={18} className="text-primary print:hidden" style={{ color: theme.accent }} /> 
                <span className="print:hidden">Professional Broadcasts ({broadcasts.length})</span>
                <span className="hidden print:inline font-bold">PROFESSIONAL BROADCASTS</span>
              </h3>
              {!isChatPaneOpen && (
                <button 
                  onClick={() => setIsChatPaneOpen(true)}
                  className="p-1 px-2.5 rounded-xl border border-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1 text-xs font-bold printable-conversation-no-print"
                  title="Open Comments"
                  style={{ color: theme.accent, borderColor: theme.accent + "33", backgroundColor: theme.accent + "0d" }}
                >
                  <MdKeyboardArrowLeft size={18} /> Open Comments
                </button>
              )}
            </div>

            {/* Broadcasts List View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 hidden-scrollbar bg-black/[0.01] dark:bg-white/[0.01] print:overflow-visible print:h-auto print:p-0 print:space-y-3 print:bg-transparent">
              {loadingBroadcasts && broadcasts.length === 0 ? (
                <div className="flex justify-center p-10 printable-conversation-no-print">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : broadcasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-40 text-center p-6 mt-10 print:opacity-70 print:p-4 print:mt-2">
                  <MdEmail size={48} className="mb-3 text-gray-400 print:hidden" />
                  <p className="text-sm font-semibold print:text-gray-600">No Broadcasts Sent</p>
                  <p className="text-xs max-w-xs mt-1 print:hidden">
                    Send professional email updates to all group members. Click the button below to compose.
                  </p>
                </div>
              ) : (
                broadcasts.map((b, idx) => {
                  const cleanSub = b.subject ? b.subject.replace(/^\[Colab#\d+\]\s*/i, "") : "(No Subject)";
                  return (
                    <div 
                      key={b.id || idx}
                      className="p-4 rounded-2xl border border-gray-200/40 dark:border-gray-800/40 bg-white/50 dark:bg-gray-900/50 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all shadow-sm flex flex-col gap-1.5 broadcast-card printable-item print:border print:border-gray-300 print:bg-white print:text-black print:shadow-none"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5 text-[10px] opacity-75 text-gray-500 font-semibold tracking-wider print:text-xs print:opacity-100 print:text-gray-700">
                          <span>From: {b.from?.split("<")[0]?.trim() || b.from}</span>
                        </div>

                        <span className="text-[10px] opacity-60 shrink-0 font-medium ml-2 print:text-xs print:opacity-100 print:text-gray-500">
                          {formatBroadcastTimestamp(b.sentDate || b.date || b.createdAt || b.timestamp, user?.timeZone || user?.timezone)}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight print:text-black print:text-sm">
                        {cleanSub}
                      </h4>
                      <div className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300 break-words whitespace-pre-line border-t border-gray-100 dark:border-gray-800/60 pt-2 print:border-gray-200 print:text-gray-900">
                        {b.body || b.textPlain || "(Empty Content)"}
                      </div>
                      
                      {/* Attachments Section */}
                      {(() => {
                        let atts = [];
                        try {
                          if (b.attachmentsJson) {
                            atts = JSON.parse(b.attachmentsJson);
                          }
                        } catch (e) {
                          console.error(e);
                        }
                        if (!atts || atts.length === 0) return null;
                        return (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-wrap gap-2">
                            {atts.map((att, index) => (
                              <button
                                key={index}
                                onClick={() => handleDownloadAttachment(att)}
                                className="flex items-center justify-center w-7 h-7 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] border border-gray-200/50 dark:border-gray-800/50 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all cursor-pointer shrink-0 print:border-gray-300"
                                title={`${att.name} (${(att.size / 1024).toFixed(1)} KB)`}
                              >
                                <MdAttachFile size={14} className="text-gray-400 dark:text-gray-500" />
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Button Bar */}
            <div className="p-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50 shrink-0 printable-conversation-no-print">
              <button
                onClick={() => setShowComposeModal(true)}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: theme.accent || "#135bec" }}
              >
                <MdEmail size={18} /> Compose New Broadcast
              </button>
            </div>
          </div>
        )}

        {/* Right Side: Chat Room / Comments (40% width for GROUP, full width for DIRECT) */}
        <div 
          className={`flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out bg-white/60 dark:bg-gray-900/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 printable-section shrink-0 ${
            chat?.type === 'GROUP' 
              ? (isChatPaneOpen ? 'w-full h-1/2 md:h-full md:w-[40%]' : 'w-0 h-0 md:w-0 md:h-full overflow-hidden') 
              : 'w-full h-full'
          }`}
          style={{ 
            opacity: chat?.type === 'GROUP' ? (isChatPaneOpen ? 1 : 0) : 1,
            pointerEvents: chat?.type === 'GROUP' ? (isChatPaneOpen ? 'auto' : 'none') : 'auto',
            borderWidth: chat?.type === 'GROUP' && !isChatPaneOpen ? '0px' : '1px'
          }}
        >
          {/* Header: Instant Chat Messages Title (Only when split) */}
          {chat?.type === 'GROUP' && (
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] shrink-0 print:border-none print:bg-transparent print:p-0 print:mb-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5 print:text-sm print:font-bold print:uppercase print:tracking-wider print:text-black" style={{ color: theme.text }}>
                <MdChat size={18} className="text-primary print:hidden" style={{ color: theme.accent }} /> 
                <span className="print:hidden">Comments</span>
                <span className="hidden print:inline font-bold">COMMENTS</span>
              </h3>
              <button 
                onClick={() => setIsChatPaneOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer flex items-center justify-center printable-conversation-no-print"
                title="Hide Comments"
              >
                <MdKeyboardArrowRight size={22} />
              </button>
            </div>
          )}

          {/* MESSAGES AREA */}
          <div className="relative flex-1 min-h-0 print:overflow-visible print:h-auto">
            <div 
              ref={messagesContainerRef} 
              onScroll={handleMessagesScroll}
              className="h-full overflow-y-auto p-6 space-y-4 hidden-scrollbar bg-white/10 dark:bg-black/10 print:overflow-visible print:h-auto print:p-0 print:space-y-3 print:bg-transparent"
            >
              {loadingComments && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-10 printable-conversation-no-print">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading comments...</p>
                </div>
              ) : commentsError && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center printable-conversation-no-print">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-3">
                    <MdInfoOutline size={24} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                    {commentsError}
                  </p>
                  <button
                    onClick={() => fetchHistory()}
                    className="mt-3 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    style={{ background: theme.accent || "#135bec" }}
                  >
                    <MdRefresh size={16} /> Retry
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 text-center print:opacity-70 print:p-4">
                  <MdChat size={64} className="mb-4 print:hidden" />
                  <p className="text-lg font-medium print:text-base print:text-gray-600">No comments yet</p>
                  <p className="text-sm print:hidden">Be the first to say hello!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = isMessageFromMe(msg, user);
                  const senderName = getCommentSenderName(msg, isMe, user);
                  return (
                    <CommentMessageItem
                      key={msg.id || idx}
                      msg={msg}
                      isMe={isMe}
                      senderName={senderName}
                      theme={theme}
                      onOpenImage={setPreviewMedia}
                      handleDownload={handleDownloadAttachment}
                      handleView={handleViewAttachment}
                      formatTime={formatMessageTime}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {hasNewMessagesBelow && (
              <button
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-4 right-6 z-30 px-3.5 py-1.5 rounded-full text-white text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-white/20 printable-conversation-no-print"
                style={{ backgroundColor: theme?.accent || "#135bec" }}
              >
                <MdKeyboardArrowRight className="rotate-90" size={16} /> New Messages
              </button>
            )}
          </div>

          {/* INPUT AREA */}
          <div className="p-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50 shrink-0 printable-conversation-no-print">
            {/* Attachments Preview Area */}
            {selectedAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mb-3 max-w-5xl mx-auto px-2 sm:px-4">
                {selectedAttachments.map((att, idx) => {
                  const meta = getFileMeta(att.name, att.type);
                  if (meta.isImage) {
                    return (
                      <div 
                        key={idx} 
                        className="relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden w-28 sm:w-32 shrink-0 group transition-all"
                      >
                        <div className="w-full h-20 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                          <img 
                            src={att.url || att.content} 
                            alt={att.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5 gap-1 bg-white/95 dark:bg-gray-800/95 border-t border-gray-100 dark:border-gray-700">
                          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate" title={att.name}>
                            {att.name}
                          </span>
                          <button 
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                            title="Remove attachment"
                            aria-label="Remove attachment"
                          >
                            <MdClose size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const IconComp = meta.icon;
                  return (
                    <div 
                      key={idx} 
                      className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm max-w-[240px] sm:max-w-[280px] shrink-0 transition-all"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${meta.bg} ${meta.color}`}>
                        <IconComp size={22} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" title={att.name}>
                          {att.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                          <span className="font-semibold uppercase tracking-wider">{meta.extLabel}</span>
                          <span>•</span>
                          <span>{formatFileSize(att.size)}</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                        title="Remove attachment"
                        aria-label="Remove attachment"
                      >
                        <MdClose size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <form onSubmit={handleSend} className="flex items-center gap-3 max-w-5xl mx-auto">
              <input 
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all focus:outline-none"
                title="Attach file"
              >
                <MdAttachFile size={22} className="rotate-45" />
              </button>
              <div className="relative shrink-0 flex items-center" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2.5 rounded-xl text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all focus:outline-none"
                  title="Insert Emoji"
                >
                  <MdInsertEmoticon size={22} />
                </button>
                {showEmojiPicker && (
                  <div
                    className="absolute bottom-14 left-0 z-50 bg-white dark:bg-gray-800 border shadow-2xl rounded-2xl p-3 w-72 max-w-sm"
                    style={{ borderColor: theme?.border || 'rgba(0,0,0,0.1)' }}
                  >
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1 select-none">
                      Popular Emojis
                    </div>
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto hidden-scrollbar">
                      {POPULAR_EMOJIS.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          className="w-7 h-7 flex items-center justify-center text-lg rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none border-0 bg-transparent"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 relative">
                <input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isSendingComment ? "Sending..." : "Type a message..."}
                  disabled={isSendingComment}
                  className="w-full pl-4 pr-12 py-3 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-800/80 outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-inner text-sm disabled:opacity-60"
                  style={{ color: theme.text }}
                  spellCheck={localStorage.getItem("bnx_setting_spellingCheck") !== "false"}
                />
                <button 
                  type="submit"
                  disabled={isSendingComment || (!newMessage.trim() && selectedAttachments.length === 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-white shadow-md disabled:opacity-30 transition-all hover:scale-105 active:scale-95 focus:outline-none flex items-center justify-center"
                  style={{ background: theme.accent }}
                  title={isSendingComment ? "Sending..." : "Send"}
                >
                  {isSendingComment ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <MdSend size={18} />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Compose Broadcast Modal Overlay */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div 
            className="w-full max-w-lg p-6 rounded-2xl border shadow-xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b mb-4" style={{ borderColor: theme.border }}>
              <h3 className="text-lg font-bold flex items-center gap-1.5">
                <MdEmail size={20} className="text-primary" style={{ color: theme.accent }} /> New Colab Broadcast
              </h3>
              <button 
                onClick={() => setShowComposeModal(false)}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <MdClose size={22} style={{ color: theme.text }} />
              </button>
            </div>

            {/* Modal Scrollable Body Form */}
            <form onSubmit={handleSendBroadcast} className="flex-1 overflow-y-auto space-y-4 pr-1 hidden-scrollbar">
              <p className="text-xs opacity-75 leading-relaxed" style={{ color: theme.subText }}>
                This broadcast will be sent directly to all {membersList.length} members of the group, and will show up in their broadcasts list.
              </p>

              {/* Template Selection Dropdown */}
              {templates.length > 0 && (
                <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-gray-200/50 dark:border-gray-800/50 rounded-xl">
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-65 flex items-center gap-1">
                    <MdAssignment size={14} /> Quick Templates
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none font-medium"
                  >
                    <option value="">-- Choose a template to load --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-65">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Email subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-3 border border-gray-200 dark:border-gray-800 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-primary/45 focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Body Textarea */}
              {/* Unified Message Body Input Container */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-65">
                  Message Body (HTML support)
                </label>
                
                <div 
                  className="flex flex-col border rounded-xl overflow-hidden transition-all bg-white dark:bg-gray-900"
                  style={{ borderColor: theme.border }}
                >
                  {/* ContentEditable Div for HTML support without raw tags */}
                  <div
                    ref={emailBodyRef}
                    contentEditable
                    onInput={(e) => setEmailBody(e.currentTarget.innerHTML)}
                    placeholder="Write email content here..."
                    className="w-full p-3 bg-transparent text-gray-900 dark:text-white outline-none text-sm overflow-y-auto min-h-[160px] max-h-[240px] custom-broadcast-editable"
                    style={{ whiteSpace: "pre-wrap" }}
                  />

                  {/* Selected Attachments Chips */}
                  {broadcastAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 border-t bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: theme.border }}>
                      {broadcastAttachments.map((att, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-1.5 px-2 py-1 bg-black/[0.03] dark:bg-white/[0.03] border rounded-lg text-[11px] font-medium"
                          style={{ borderColor: theme.border }}
                        >
                          <span className="truncate max-w-[150px]">{att.name}</span>
                          <span className="text-[9px] opacity-60">({(att.size / 1024).toFixed(0)} KB)</span>
                          <button
                            type="button"
                            onClick={() => setBroadcastAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="p-0.5 text-red-500 hover:bg-red-500/10 rounded cursor-pointer flex items-center justify-center"
                          >
                            <MdClose size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Toolbar with Attach Icon */}
                  <div className="flex items-center justify-between px-3 py-2 border-t bg-black/[0.02] dark:bg-white/[0.02]" style={{ borderColor: theme.border }}>
                    <label className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer transition-all" title="Attach file">
                      <MdAttachFile size={18} />
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                    />
                    </label>
                    <span className="text-[10px] text-gray-450 dark:text-gray-500 font-normal">HTML enabled • Max 5MB per file</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <button
                disabled={sendingEmail || membersList.length === 0}
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                style={{ background: theme.accent || "#135bec" }}
              >
                {sendingEmail ? "Sending Broadcast..." : "Send Broadcast"}
                <MdSend size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Colab Info Overlay Modal (Displays group metadata, members, and adding controls) */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div 
            className="w-full max-w-md p-6 rounded-2xl border shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b mb-4" style={{ borderColor: theme.border }}>
              <h3 className="text-lg font-bold flex items-center gap-1.5">
                <MdPeople size={20} className="text-primary" style={{ color: theme.accent }} /> Colab Channel Info
              </h3>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <MdClose size={22} style={{ color: theme.text }} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 hidden-scrollbar">
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-grow p-1.5 border rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary/45"
                      autoFocus
                    />
                    <button onClick={handleRenameGroup} className="p-1.5 bg-primary text-white rounded-lg hover:scale-105 transition-all">
                      <MdCheck size={16} />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                      <MdClose size={16} />
                    </button>
                  </div>
                ) : (
                  <h4 className="font-bold text-base flex items-center gap-2">
                    {chat?.name || "Colab Group"}
                    {chat?.creatorEmail === user.email && (
                      <button 
                        onClick={() => {
                          setEditingName(chat?.name || "");
                          setIsEditingName(true);
                        }}
                        className="text-gray-400 hover:text-primary transition-colors p-1"
                        title="Rename Colab"
                      >
                        <MdEdit size={14} />
                      </button>
                    )}
                  </h4>
                )}
                <p className="text-xs opacity-75 mt-1 leading-relaxed" style={{ color: theme.subText }}>
                  {chat?.description || "A collaboration channel for team messaging and email broadcasting."}
                </p>
                {chat?.createdAt && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] uppercase font-bold tracking-wider opacity-60">
                    <span className="bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-full">
                      Created: {new Date(chat.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Add Members Form */}
              <form onSubmit={handleAddMembers} className="p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-gray-200/50 dark:border-gray-800/50 rounded-2xl">
                <h5 className="text-xs font-bold uppercase tracking-wider mb-1 opacity-75 flex items-center gap-1">
                  <MdPersonAdd size={16} /> Add New Members
                </h5>
                <p className="text-[10px] opacity-60 mb-3">
                  Enter email addresses separated by commas or spaces.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="alice@bnxmail.com, bob@bnxmail.com"
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    className="flex-grow p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={addingMembers || !emailsInput.trim()}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm transition-all"
                    style={{ background: theme.accent }}
                  >
                    {addingMembers ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>

              {/* Members List */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider opacity-65 flex items-center gap-1.5">
                  <MdPeople size={16} /> Group Members ({membersList.length})
                </h5>
                <div className="border border-gray-100 dark:border-gray-800 rounded-2xl divide-y divide-gray-50 dark:divide-gray-800 bg-white/40 dark:bg-gray-900/10 overflow-hidden shadow-inner max-h-48 overflow-y-auto">
                  {membersList.map((email, idx) => {
                    const isMe = email.toLowerCase() === user.email.toLowerCase();
                    return (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs transition-colors hover:bg-black/[0.01]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-700 dark:text-gray-300 truncate">
                            {email}
                          </span>
                        </div>
                        {isMe && (
                          <span className="text-[9px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm mr-2">
                            Me
                          </span>
                        )}
                        {email === chat?.creatorEmail && (
                          <span className="text-[9px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
                            Creator
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone */}
              {chat?.type === 'GROUP' && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
                  {/* <h5 className="text-xs font-bold uppercase tracking-wider text-red-500 opacity-80 mb-2">
                    Danger Zone {chat?.creatorEmail ? `(Creator: ${chat.creatorEmail})` : '(No Creator)'}
                  </h5> */}
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800/50"
                  >
                    Leave Colab
                  </button>
                  {chat?.creatorEmail?.toLowerCase() === user?.email?.toLowerCase() && (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      Delete Colab
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <span className="text-sm font-semibold truncate text-gray-800 dark:text-gray-200">
                {previewMedia.fileName || previewMedia.name}
              </span>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => handleDownloadAttachment(previewMedia)} 
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Download"
                >
                  <MdFileDownload size={18} />
                </button>
                <button 
                  type="button"
                  onClick={() => setPreviewMedia(null)} 
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Close"
                >
                  <MdClose size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-2 bg-black/5 dark:bg-black/40 overflow-hidden">
              <img 
                src={previewMedia.fileUrl || previewMedia.url || previewMedia.content} 
                alt={previewMedia.fileName || previewMedia.name} 
                className="max-h-[75vh] max-w-full object-contain rounded-lg" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;
