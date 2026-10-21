import { useTranslation } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useMail } from "../context/MailContext";
import { casboxAPI, api, userAPI, mailAPI, contactAliasAPI, connectionAPI, blockedContactsAPI } from "../services/api";
import { MdCheck, MdDoneAll, MdStarBorder, MdStar, MdDeleteOutline, MdRefresh, MdSend, MdClose, MdRemoveRedEye, MdFileDownload, MdReply, MdForward, MdAttachFile, MdBlock, MdArrowBack, MdArchive, MdUnarchive, MdAccessTime, MdLabel, MdDelete, MdMoreVert, MdInsertEmoticon, MdChevronRight, MdChevronLeft, MdEdit, MdPersonAdd, MdSearch, MdFilterList, MdContentCopy, MdFilterAlt, MdMail, MdArrowDownward, MdArrowUpward, MdPushPin, MdRestore, MdOutlineEmojiEmotions, MdAdd, MdCheckBox } from "react-icons/md";
import { SiAdobeacrobatreader } from "react-icons/si";
import toast from "react-hot-toast";
import ReadingPaneLayout from "../components/ReadingPaneLayout";
import MessageUndoToast from "../components/MessageUndoToast";
import logo from "../assets/bnx-remove.png";

const normalizeEmail = (val) => {
  if (!val) return '';
  return String(val).trim().toLowerCase();
};

export const isCurrentUserEmail = (emailOrUsername, user) => {
  if (!emailOrUsername) return false;
  const n = normalizeEmail(emailOrUsername);
  if (!n) return false;
  const nHasAt = n.includes('@');
  const nLocal = nHasAt ? n.split('@')[0] : n;

  const userObj = typeof user === 'object' && user !== null ? user : null;
  const uEmail = normalizeEmail(userObj?.email || (typeof user === 'string' ? user : ''));
  const uEmailHasAt = uEmail.includes('@');
  const uEmailLocal = uEmailHasAt ? uEmail.split('@')[0] : uEmail;

  const uName = normalizeEmail(userObj?.username || '');
  const uNameHasAt = uName.includes('@');
  const uNameLocal = uNameHasAt ? uName.split('@')[0] : uName;

  if (uEmail) {
    if (n === uEmail) return true;
    if ((!nHasAt || !uEmailHasAt) && nLocal === uEmailLocal) return true;
  }

  if (uName) {
    if (n === uName) return true;
    if ((!nHasAt || !uNameHasAt) && nLocal === uNameLocal) return true;
  }

  return false;
};

export const isSameContact = (contactA, contactB) => {
  if (!contactA || !contactB) return false;
  const aNorm = normalizeEmail(contactA);
  const bNorm = normalizeEmail(contactB);
  if (!aNorm || !bNorm) return false;
  if (aNorm === bNorm) return true;
  const aHasAt = aNorm.includes('@');
  const bHasAt = bNorm.includes('@');
  const aLocal = aHasAt ? aNorm.split('@')[0] : aNorm;
  const bLocal = bHasAt ? bNorm.split('@')[0] : bNorm;
  if ((!aHasAt || !bHasAt) && aLocal === bLocal) return true;
  return false;
};

export const isCashboxSenderAccepted = (senderEmail, casboxAcceptedList) => {
  if (!senderEmail || !casboxAcceptedList) return false;
  const normalizedSender = normalizeEmail(senderEmail);
  if (!normalizedSender) return false;
  const senderLocal = normalizedSender.includes('@') ? normalizedSender.split('@')[0] : normalizedSender;

  if (casboxAcceptedList instanceof Set) {
    if (casboxAcceptedList.has(normalizedSender) || casboxAcceptedList.has(senderLocal)) return true;
    for (const email of casboxAcceptedList) {
      const norm = normalizeEmail(email);
      if (!norm) continue;
      if (norm === normalizedSender || norm === senderLocal || (norm.includes('@') && norm.split('@')[0] === senderLocal)) {
        return true;
      }
    }
    return false;
  }

  if (Array.isArray(casboxAcceptedList)) {
    return casboxAcceptedList.some(email => {
      const norm = normalizeEmail(email);
      if (!norm) return false;
      return norm === normalizedSender || norm === senderLocal || (norm.includes('@') && norm.split('@')[0] === senderLocal);
    });
  }

  return false;
};

export const classifyCashboxConversation = (item, currentUser, casboxAcceptedList) => {
  const isArchived = Boolean(
    item?.isArchived || 
    item?.archived || 
    item?.latestMessage?.isArchived || 
    item?.latestMessage?.archived || 
    (Array.isArray(item?.messages) && item.messages.length > 0 && item.messages.every(m => m?.isArchived || m?.archived))
  );
  if (isArchived) return 'ARCHIVE';

  const isUser = (e) => isCurrentUserEmail(e, currentUser);

  const msgs = Array.isArray(item?.messages) ? item.messages : (item ? [item] : []);

  const hasOutgoing = msgs.some(m => isUser(m?.senderEmail || m?.sender));
  const hasIncoming = msgs.some(m => isUser(m?.receiverEmail || m?.receiver));

  let contactEmail = "";
  if (item?.contactNorm || item?.contact) {
    contactEmail = normalizeEmail(item.contactNorm || item.contact);
  }
  if (!contactEmail && msgs.length > 0) {
    const incoming = msgs.find(m => isUser(m?.receiverEmail || m?.receiver));
    if (incoming) {
      contactEmail = normalizeEmail(incoming.senderEmail || incoming.sender);
    } else {
      const outgoing = msgs.find(m => isUser(m?.senderEmail || m?.sender));
      contactEmail = outgoing ? normalizeEmail(outgoing.receiverEmail || outgoing.receiver) : "";
    }
  }
  if (!contactEmail) {
    contactEmail = normalizeEmail(item?.senderEmail || item?.sender || "");
  }

  const isAcceptedLocally = isCashboxSenderAccepted(contactEmail, casboxAcceptedList);
  const dtoAccepted = item?.latestMessage?.isAccepted !== undefined 
    ? item.latestMessage.isAccepted 
    : (item?.isAccepted !== undefined ? item.isAccepted : (item?.accepted !== undefined ? item.accepted : undefined));

  let accepted = false;
  if (isAcceptedLocally) {
    accepted = true;
  } else if (dtoAccepted !== undefined) {
    accepted = Boolean(dtoAccepted);
  } else {
    accepted = isAcceptedLocally;
  }

  let result = 'MESSAGES';
  if (hasIncoming) {
    result = accepted ? 'MESSAGES' : 'REQUESTS';
  } else if (hasOutgoing) {
    result = 'MESSAGES';
  } else {
    result = accepted ? 'MESSAGES' : 'REQUESTS';
  }

  return result;
};

const getMimeType = (fileName) => {
  const ext = fileName?.split('.').pop().toLowerCase() || '';
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
  const ext = fileName?.split('.').pop().toLowerCase() || '';
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

const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "✊", "👊", "🤛", "🤜", "👏", "🙌",
  "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "👀",
  "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🖤", "🩶", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗",
  "🎉", "✨", "🔥", "💡", "🌟", "🎈", "🎁", "💬", "✉️", "📅", "💻", "📱", "⌚", "📷", "🎨", "🎵", "✈️", "🚗", "🏠", "💼"
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Helper to sanitize reactions map so each user has at most one reaction per message
const sanitizeReactionsMap = (rawMap) => {
  if (!rawMap || typeof rawMap !== 'object') return {};
  const cleaned = {};
  for (const [msgId, emojiMap] of Object.entries(rawMap)) {
    if (!emojiMap || typeof emojiMap !== 'object') continue;
    const userToEmoji = new Map();
    const cleanedEmojiMap = {};

    for (const [emoji, users] of Object.entries(emojiMap)) {
      if (!Array.isArray(users)) continue;
      users.forEach(u => {
        if (typeof u === 'string' && u.trim()) {
          userToEmoji.set(u.trim(), emoji);
        }
      });
    }

    userToEmoji.forEach((emoji, user) => {
      if (!cleanedEmojiMap[emoji]) {
        cleanedEmojiMap[emoji] = [];
      }
      cleanedEmojiMap[emoji].push(user);
    });

    if (Object.keys(cleanedEmojiMap).length > 0) {
      cleaned[msgId] = cleanedEmojiMap;
    }
  }
  return cleaned;
};

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: '😃',
    emojis: [
      { emoji: '😀', name: 'grinning' }, { emoji: '😃', name: 'smiley' }, { emoji: '😄', name: 'smile' }, { emoji: '😁', name: 'grin' },
      { emoji: '😆', name: 'laughing' }, { emoji: '😅', name: 'sweat smile' }, { emoji: '😂', name: 'joy' }, { emoji: '🤣', name: 'rofl' },
      { emoji: '😊', name: 'blush' }, { emoji: '😇', name: 'innocent' }, { emoji: '🙂', name: 'slightly smiling' }, { emoji: '🙃', name: 'upside down' },
      { emoji: '😉', name: 'wink' }, { emoji: '😌', name: 'relieved' }, { emoji: '😍', name: 'heart eyes' }, { emoji: '🥰', name: 'smiling with hearts' },
      { emoji: '😘', name: 'kissing heart' }, { emoji: '😗', name: 'kissing' }, { emoji: '😙', name: 'kissing smiling eyes' }, { emoji: '😚', name: 'kissing closed eyes' },
      { emoji: '😋', name: 'yum' }, { emoji: '😛', name: 'stuck out tongue' }, { emoji: '😝', name: 'stuck out tongue closed eyes' }, { emoji: '😜', name: 'stuck out tongue wink' },
      { emoji: '🤪', name: 'zany' }, { emoji: '🤨', name: 'raised eyebrow' }, { emoji: '🧐', name: 'monocle' }, { emoji: '🤓', name: 'nerd' },
      { emoji: '😎', name: 'sunglasses' }, { emoji: '🥸', name: 'disguise' }, { emoji: '🥳', name: 'partying' }, { emoji: '😏', name: 'smirk' },
      { emoji: '😒', name: 'unamused' }, { emoji: '😞', name: 'disappointed' }, { emoji: '😔', name: 'pensive' }, { emoji: '😟', name: 'worried' },
      { emoji: '😕', name: 'confused' }, { emoji: '🙁', name: 'slightly frowning' }, { emoji: '☹️', name: 'frowning' }, { emoji: '😣', name: 'persevere' },
      { emoji: '😖', name: 'confounded' }, { emoji: '😫', name: 'tired' }, { emoji: '😩', name: 'weary' }, { emoji: '🥺', name: 'pleading' },
      { emoji: '😢', name: 'cry' }, { emoji: '😭', name: 'sob' }, { emoji: '😮', name: 'open mouth' }, { emoji: '😱', name: 'scream' },
      { emoji: '😡', name: 'rage' }, { emoji: '😠', name: 'angry' }, { emoji: '😤', name: 'triumph' }, { emoji: '🤫', name: 'shushing' },
      { emoji: '🤗', name: 'hugs' }, { emoji: '🤔', name: 'thinking' }, { emoji: '🤐', name: 'zipper mouth' }, { emoji: '😴', name: 'sleeping' },
      { emoji: '👍', name: 'thumbs up' }, { emoji: '👎', name: 'thumbs down' }, { emoji: '👏', name: 'clap' }, { emoji: '🙌', name: 'hooray' },
      { emoji: '👐', name: 'open hands' }, { emoji: '🤲', name: 'palms up' }, { emoji: '🤝', name: 'handshake' }, { emoji: '🙏', name: 'pray thanks' },
      { emoji: '✌️', name: 'peace' }, { emoji: '🤞', name: 'crossed fingers' }, { emoji: '🤟', name: 'love you' }, { emoji: '🤘', name: 'rock' },
      { emoji: '🤙', name: 'call me' }, { emoji: '👌', name: 'ok hand' }, { emoji: '🤌', name: 'pinched fingers' }, { emoji: '👊', name: 'fist' }
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐻',
    emojis: [
      { emoji: '🐶', name: 'dog' }, { emoji: '🐱', name: 'cat' }, { emoji: '🐭', name: 'mouse' }, { emoji: '🐹', name: 'hamster' },
      { emoji: '🐰', name: 'rabbit' }, { emoji: '🦊', name: 'fox' }, { emoji: '🐻', name: 'bear' }, { emoji: '🐼', name: 'panda' },
      { emoji: '🐨', name: 'koala' }, { emoji: '🐯', name: 'tiger' }, { emoji: '🦁', name: 'lion' }, { emoji: '🐮', name: 'cow' },
      { emoji: '🐷', name: 'pig' }, { emoji: '🐸', name: 'frog' }, { emoji: '🐵', name: 'monkey' }, { emoji: '🐔', name: 'chicken' },
      { emoji: '🐧', name: 'penguin' }, { emoji: '🐦', name: 'bird' }, { emoji: '🐤', name: 'chick' }, { emoji: '🦆', name: 'duck' },
      { emoji: '🦅', name: 'eagle' }, { emoji: '🦉', name: 'owl' }, { emoji: '🦇', name: 'bat' }, { emoji: '🐺', name: 'wolf' },
      { emoji: '🐗', name: 'boar' }, { emoji: '🐴', name: 'horse' }, { emoji: '🦄', name: 'unicorn' }, { emoji: '🐝', name: 'bee' },
      { emoji: '🐛', name: 'bug' }, { emoji: '🦋', name: 'butterfly' }, { emoji: '🐌', name: 'snail' }, { emoji: '🐞', name: 'ladybug' },
      { emoji: '🌸', name: 'cherry blossom' }, { emoji: '🌹', name: 'rose' }, { emoji: '🌺', name: 'hibiscus' }, { emoji: '🌻', name: 'sunflower' },
      { emoji: '🌼', name: 'blossom' }, { emoji: '🌷', name: 'tulip' }, { emoji: '🌱', name: 'seedling' }, { emoji: '🌲', name: 'evergreen tree' },
      { emoji: '🌳', name: 'deciduous tree' }, { emoji: '🌴', name: 'palm tree' }, { emoji: '🌵', name: 'cactus' }, { emoji: '🍀', name: 'four leaf clover' }
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      { emoji: '🍏', name: 'green apple' }, { emoji: '🍎', name: 'red apple' }, { emoji: '🍐', name: 'pear' }, { emoji: '🍊', name: 'tangerine' },
      { emoji: '🍋', name: 'lemon' }, { emoji: '🍌', name: 'banana' }, { emoji: '🍉', name: 'watermelon' }, { emoji: '🍇', name: 'grapes' },
      { emoji: '🍓', name: 'strawberry' }, { emoji: '🫐', name: 'blueberries' }, { emoji: '🍈', name: 'melon' }, { emoji: '🍒', name: 'cherries' },
      { emoji: '🍑', name: 'peach' }, { emoji: '🥭', name: 'mango' }, { emoji: '🍍', name: 'pineapple' }, { emoji: '🥥', name: 'coconut' },
      { emoji: '🥝', name: 'kiwi' }, { emoji: '🍅', name: 'tomato' }, { emoji: '🥑', name: 'avocado' }, { emoji: '🥦', name: 'broccoli' },
      { emoji: '🍔', name: 'hamburger' }, { emoji: '🍟', name: 'french fries' }, { emoji: '🍕', name: 'pizza' }, { emoji: '🌭', name: 'hot dog' },
      { emoji: '🥪', name: 'sandwich' }, { emoji: '🌮', name: 'taco' }, { emoji: '🌯', name: 'burrito' }, { emoji: '🍜', name: 'ramen' },
      { emoji: '🍣', name: 'sushi' }, { emoji: '🍦', name: 'ice cream' }, { emoji: '🍩', name: 'doughnut' }, { emoji: '🍪', name: 'cookie' },
      { emoji: '🎂', name: 'birthday cake' }, { emoji: '🍰', name: 'shortcake' }, { emoji: '🍫', name: 'chocolate' }, { emoji: '☕', name: 'coffee' }
    ]
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    emojis: [
      { emoji: '⚽', name: 'soccer ball' }, { emoji: '🏀', name: 'basketball' }, { emoji: '🏈', name: 'football' }, { emoji: '⚾', name: 'baseball' },
      { emoji: '🥎', name: 'softball' }, { emoji: '🎾', name: 'tennis' }, { emoji: '🏐', name: 'volleyball' }, { emoji: '🏉', name: 'rugby' },
      { emoji: '🥏', name: 'frisbee' }, { emoji: '🎱', name: '8 ball pool' }, { emoji: '🏓', name: 'ping pong' }, { emoji: '🏸', name: 'badminton' },
      { emoji: '🏒', name: 'ice hockey' }, { emoji: '🏑', name: 'field hockey' }, { emoji: '🥊', name: 'boxing glove' }, { emoji: '🥋', name: 'martial arts' },
      { emoji: '🎯', name: 'dart' }, { emoji: '⛳', name: 'golf' }, { emoji: '🎳', name: 'bowling' }, { emoji: '🎮', name: 'video game' },
      { emoji: '🎲', name: 'game die' }, { emoji: '🧩', name: 'puzzle' }, { emoji: '🎨', name: 'art palette' }, { emoji: '🎬', name: 'clapper board' }
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: [
      { emoji: '🚗', name: 'car' }, { emoji: '🚕', name: 'taxi' }, { emoji: '🚙', name: 'suv' }, { emoji: '🚌', name: 'bus' },
      { emoji: '🚎', name: 'trolleybus' }, { emoji: '🏎️', name: 'race car' }, { emoji: '🚓', name: 'police car' }, { emoji: '🚑', name: 'ambulance' },
      { emoji: '🚒', name: 'fire engine' }, { emoji: '🚐', name: 'minibus' }, { emoji: '🛻', name: 'pickup truck' }, { emoji: '🚚', name: 'delivery truck' },
      { emoji: '🚛', name: 'semi truck' }, { emoji: '🚜', name: 'tractor' }, { emoji: '🛵', name: 'scooter' }, { emoji: '🏍️', name: 'motorcycle' },
      { emoji: '🚲', name: 'bicycle' }, { emoji: '🛴', name: 'kick scooter' }, { emoji: '✈️', name: 'airplane' }, { emoji: '🚀', name: 'rocket' },
      { emoji: '🛸', name: 'ufo' }, { emoji: '🚁', name: 'helicopter' }, { emoji: '⛵', name: 'sailboat' }, { emoji: '🚢', name: 'ship' }
    ]
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      { emoji: '💡', name: 'light bulb' }, { emoji: '🔦', name: 'flashlight' }, { emoji: '🕯️', name: 'candle' }, { emoji: '📱', name: 'mobile phone' },
      { emoji: '💻', name: 'laptop' }, { emoji: '🖥️', name: 'desktop computer' }, { emoji: '🖨️', name: 'printer' }, { emoji: '⌨️', name: 'keyboard' },
      { emoji: '🖱️', name: 'computer mouse' }, { emoji: '📷', name: 'camera' }, { emoji: '📹', name: 'video camera' }, { emoji: '🔍', name: 'magnifying glass' },
      { emoji: '🔎', name: 'magnifying glass right' }, { emoji: '🔬', name: 'microscope' }, { emoji: '🔭', name: 'telescope' }, { emoji: '📡', name: 'satellite antenna' },
      { emoji: '📺', name: 'tv' }, { emoji: '📻', name: 'radio' }, { emoji: '⏰', name: 'alarm clock' }, { emoji: '⏱️', name: 'stopwatch' },
      { emoji: '⏳', name: 'hourglass' }, { emoji: '🔑', name: 'key' }, { emoji: '🔒', name: 'lock' }, { emoji: '🔓', name: 'unlock' }
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols & Flags',
    icon: '🏳️',
    emojis: [
      { emoji: '❤️', name: 'red heart' }, { emoji: '🧡', name: 'orange heart' }, { emoji: '💛', name: 'yellow heart' }, { emoji: '💚', name: 'green heart' },
      { emoji: '💙', name: 'blue heart' }, { emoji: '💜', name: 'purple heart' }, { emoji: '🖤', name: 'black heart' }, { emoji: '🤍', name: 'white heart' },
      { emoji: '💔', name: 'broken heart' }, { emoji: '❣️', name: 'heart exclamation' }, { emoji: '💕', name: 'two hearts' }, { emoji: '💞', name: 'revolving hearts' },
      { emoji: '💓', name: 'beating heart' }, { emoji: '💗', name: 'growing heart' }, { emoji: '💖', name: 'sparkling heart' }, { emoji: '💘', name: 'heart arrow' },
      { emoji: '✨', name: 'sparkles' }, { emoji: '⭐', name: 'star' }, { emoji: '🌟', name: 'glowing star' }, { emoji: '🔥', name: 'fire' },
      { emoji: '💯', name: '100' }, { emoji: '✅', name: 'check mark' }, { emoji: '❌', name: 'cross mark' }, { emoji: '⚠️', name: 'warning' },
      { emoji: '🏳️', name: 'white flag' }, { emoji: '🚩', name: 'triangular flag' }, { emoji: '🏁', name: 'chequered flag' }, { emoji: '🎉', name: 'party popper' }
    ]
  }
];

const resolveAvatarUrl = (url, identifier) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  const clean = url.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }

  const base = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : 'https://api.bnxmail.com');
  const cleanBase = base ? (base.endsWith('/') ? base.slice(0, -1) : base) : '';

  if (clean.startsWith('/')) {
    return cleanBase ? `${cleanBase}${clean}` : clean;
  }

  // If clean is just a filename like "user_1_123.jpg"
  const userKey = identifier || clean;
  return cleanBase ? `${cleanBase}/api/users/profile-picture/${encodeURIComponent(userKey)}` : `/api/users/profile-picture/${encodeURIComponent(userKey)}`;
};

const getAvatarColorClass = (str) => {
  const colors = [
    'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  ];
  if (!str) return colors[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const ConnectionAvatar = React.memo(({ profilePicture, profilePictureUrl, displayName, username, email, className = "w-9 h-9" }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Extract clean initial: strip leading @ or spaces, uppercase first letter
  const cleanName = (displayName || username || (email ? email.split('@')[0] : "?"))
    .replace(/^@+/, '')
    .trim();
  const initial = (cleanName.charAt(0) || "?").toUpperCase();

  const userIdentifier = (username || (email ? email.split('@')[0] : null) || "").replace(/^@+/, '').trim();
  const rawPic = profilePicture || profilePictureUrl;

  const avatarUrl = useMemo(() => {
    return resolveAvatarUrl(rawPic, userIdentifier);
  }, [rawPic, userIdentifier]);

  // Reset error/loaded state if the avatar URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [avatarUrl]);

  // Fallback: circular avatar containing first letter of display name/username
  // Exact BNXmail design: circular avatar, blue/purple styling, same size (w-9 h-9), same spacing, same typography
  if (!avatarUrl || hasError) {
    return (
      <div
        className={`${className} rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 select-none`}
        aria-label={cleanName}
        title={cleanName}
      >
        {initial}
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full shrink-0 relative overflow-hidden`}>
      {/* Background placeholder initial while image is loading to prevent layout flash */}
      {!isLoaded && (
        <div
          className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm select-none"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}
      <img
        src={avatarUrl}
        alt={cleanName}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} rounded-full object-cover border border-gray-200 dark:border-gray-700 transition-opacity duration-150 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

const ConnectionRow = React.memo(({
  conn,
  isUpdatingConnection,
  onReconnect,
  onDisconnect,
}) => {
  const isConn = conn.status?.toUpperCase() === 'CONNECTED';
  const displayName = conn.contactDisplayName || conn.contactUsername;
  const username = conn.contactUsername || conn.contactEmail?.split('@')[0];

  return (
    <div className="p-3 sm:p-3.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2.5 sm:gap-3 w-full">
        {/* Profile Avatar on the left: fixed size, flex-shrink: 0 */}
        <ConnectionAvatar
          profilePicture={conn.contactProfilePicture}
          profilePictureUrl={conn.contactProfilePictureUrl}
          displayName={conn.contactDisplayName}
          username={conn.contactUsername}
          email={conn.contactEmail}
          className="w-9 h-9 shrink-0"
        />

        {/* User Information & Actions */}
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          {/* Top Row: Display Name & Online Status + Action Buttons on the SAME HORIZONTAL ROW */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full flex-wrap sm:flex-nowrap">
            {/* Display Name + Online indicator */}
            <div className="flex items-center gap-1.5 min-w-0 shrink">
              <span
                className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate"
                title={displayName}
              >
                {displayName}
              </span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${isConn ? 'bg-emerald-500' : 'bg-gray-400'}`}
                title={isConn ? 'Connected' : 'Disconnected'}
              />
            </div>

            {/* Actions: Connected + Disconnected on the same row directly to the right */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ml-auto">
              {/* Connected Button */}
              {isConn ? (
                <button
                  type="button"
                  disabled
                  className="px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 cursor-default shadow-xs shrink-0 whitespace-nowrap"
                >
                  <MdCheck size={14} /> Connected
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isUpdatingConnection}
                  onClick={() => onReconnect(conn)}
                  className="px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-500/30 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Connect
                </button>
              )}

              {/* Disconnected Button */}
              {isConn ? (
                <button
                  type="button"
                  disabled={isUpdatingConnection}
                  onClick={() => onDisconnect(conn)}
                  className="px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Disconnected
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 flex items-center gap-1 cursor-default shrink-0 whitespace-nowrap"
                >
                  <MdCheck size={14} /> Disconnected
                </button>
              )}
            </div>
          </div>

          {/* Username / handle strictly BELOW the display name */}
          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5 block">
            @{username}
          </span>
        </div>
      </div>
    </div>
  );
});

const parseTimestamp = (timestamp) => {
  if (!timestamp) return new Date(0);
  try {
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? new Date(0) : timestamp;
    }
    if (typeof timestamp === 'number') {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    if (Array.isArray(timestamp)) {
      // Jackson array format from UTC server: [year, month, day, hour, minute, second, nano]
      const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = timestamp;
      const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    if (typeof timestamp === 'string') {
      let str = timestamp.trim();
      if (!str) return new Date(0);

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
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch (e) {
    return new Date(0);
  }
};

const getTimestampMs = (timestamp) => {
  return parseTimestamp(timestamp).getTime() || 0;
};

const formatCashboxTime = (timestamp) => {
  const date = parseTimestamp(timestamp);
  if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).replace(/[\u202f\u00a0]/g, ' ');
};

const formatSentDetailDateTime = (timestamp) => {
  const date = parseTimestamp(timestamp);
  if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).replace(/[\u202f\u00a0]/g, ' ');
};

const getMessageDateKey = (timestamp) => {
  if (!timestamp) return '';
  const d = parseTimestamp(timestamp);
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatChatDateSeparator = (timestamp) => {
  if (!timestamp) return '';
  const d = parseTimestamp(timestamp);
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '';

  const now = new Date();
  const isCurrentDay = (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });

  // For the current day, display the weekday name, such as "Monday"
  if (isCurrentDay) {
    return weekday;
  }

  // For older messages, display the weekday name with date (e.g. "Monday, 10 Oct 2026")
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(0)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
};

const parseMessageAttachments = (attachmentsJson) => {
  if (!attachmentsJson) return [];
  if (Array.isArray(attachmentsJson)) return attachmentsJson;
  if (typeof attachmentsJson === 'string' && attachmentsJson.trim()) {
    try {
      const parsed = JSON.parse(attachmentsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

const getStatusIcon = (status) => {
  const s = typeof status === 'string' ? status.toUpperCase() : (status ? String(status).toUpperCase() : '');
  if (s === 'SEEN') {
    return <MdDoneAll size={14} className="text-blue-500 inline-block" title="Seen" />;
  }
  if (s === 'DELIVERED') {
    return <MdDoneAll size={14} className="text-gray-400 dark:text-gray-500 inline-block" title="Delivered" />;
  }
  return <MdCheck size={14} className="text-gray-400 dark:text-gray-500 inline-block" title="Sent" />;
};

const CalendarNumberIcon = ({ number, size = 16, className = "" }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
    <span className="absolute bottom-[2px] font-bold text-[8px] leading-none select-none pointer-events-none">
      {number}
    </span>
  </div>
);

const CASBOX_MESSAGE_FILTERS = [
  { id: 'all', label: 'All Messages', icon: MdMail },
  { id: 'received', label: 'Received Only', icon: MdArrowDownward },
  { id: 'sent', label: 'Sent Only', icon: MdArrowUpward },
  { id: 'divider-1', isDivider: true },
  { id: '1day', label: 'Last 1 Day', number: '1' },
  { id: '1week', label: 'Last 1 Week', number: '7' },
  { id: '1month', label: 'Last 1 Month', number: '31' },
];

const Casbox = () => {
  const { t } = useTranslation();
  const { theme, readingPaneMode } = useTheme();
  const location = useLocation();
  const { user } = useAuth();
  const { stompClient, isConnected } = useSocket();
  const { openCompose, handleArchive, handleSnooze, handleMoveToTrash, handleToggleStar, handleUnsubscribe } = useMail();

  const isCurrentUser = useCallback((e) => isCurrentUserEmail(e, user), [user?.email, user?.username]);
  const isCurrentUserRef = React.useRef(isCurrentUser);
  useEffect(() => {
    isCurrentUserRef.current = isCurrentUser;
  }, [isCurrentUser]);

  const [messages, setMessages] = useState([]);
  const messagesRef = React.useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [loading, setLoading] = useState(true);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedSentDetail, setSelectedSentDetail] = useState(null);

  const [activeTab, setActiveTab] = useState('messages');
  const activeTabRef = React.useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const isCombineTab = activeTab === 'combine' || activeTab === 'combined';

  const [messagesSearch, setMessagesSearch] = useState("");
  const [messagesFilter, setMessagesFilter] = useState("all");
  const [showMessagesFilterMenu, setShowMessagesFilterMenu] = useState(false);
  const messagesFilterMenuRef = React.useRef(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const [deletedMessageIds, setDeletedMessageIds] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_deleted_message_ids') || localStorage.getItem('bnx_casbox_deleted_message_ids') || sessionStorage.getItem('bnx_casbox_deleted_messages_ids') || localStorage.getItem('bnx_casbox_deleted_messages_ids') || sessionStorage.getItem('bnx_casbox_deleted_msg_ids');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const deletedMessageIdsRef = React.useRef(deletedMessageIds);
  useEffect(() => {
    deletedMessageIdsRef.current = deletedMessageIds;
  }, [deletedMessageIds]);

  const [readMessageIds, setReadMessageIds] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_read_message_ids') || localStorage.getItem('bnx_casbox_read_message_ids');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const readMessageIdsRef = React.useRef(readMessageIds);
  useEffect(() => {
    readMessageIdsRef.current = readMessageIds;
  }, [readMessageIds]);

  const [archivedMessageIds, setArchivedMessageIds] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_archived_message_ids') || localStorage.getItem('bnx_casbox_archived_message_ids');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const archivedMessageIdsRef = React.useRef(archivedMessageIds);
  useEffect(() => {
    archivedMessageIdsRef.current = archivedMessageIds;
  }, [archivedMessageIds]);

  const [unarchivedMessageIds, setUnarchivedMessageIds] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_unarchived_message_ids') || localStorage.getItem('bnx_casbox_unarchived_message_ids');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const unarchivedMessageIdsRef = React.useRef(unarchivedMessageIds);
  useEffect(() => {
    unarchivedMessageIdsRef.current = unarchivedMessageIds;
  }, [unarchivedMessageIds]);

  const saveArchivedMessageIds = (nextSet) => {
    try {
      const arr = Array.from(nextSet);
      sessionStorage.setItem('bnx_casbox_archived_message_ids', JSON.stringify(arr));
      localStorage.setItem('bnx_casbox_archived_message_ids', JSON.stringify(arr));
    } catch (e) {}
  };

  const saveUnarchivedMessageIds = (nextSet) => {
    try {
      const arr = Array.from(nextSet);
      sessionStorage.setItem('bnx_casbox_unarchived_message_ids', JSON.stringify(arr));
      localStorage.setItem('bnx_casbox_unarchived_message_ids', JSON.stringify(arr));
    } catch (e) {}
  };

  const isMsgArchived = useCallback((m) => {
    if (!m) return false;
    const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
    const strId = id !== undefined && id !== null ? String(id) : null;
    if (unarchivedMessageIds.has(id) || (strId && unarchivedMessageIds.has(strId))) {
      return false;
    }
    if (archivedMessageIds.has(id) || (strId && archivedMessageIds.has(strId))) {
      return true;
    }
    return Boolean(m.isArchived || m.archived);
  }, [archivedMessageIds, unarchivedMessageIds]);

  const [combineSearch, setCombineSearch] = useState("");
  const [combineFilter, setCombineFilter] = useState("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [openCombineMenuId, setOpenCombineMenuId] = useState(null);
  const filterMenuRef = React.useRef(null);
  const combineMenuRef = React.useRef(null);

  // Three-Dot Message Actions: Reply, Pin, Edit, Unsend, Forward
  const [activeMessageMenuId, setActiveMessageMenuId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardSearchTerm, setForwardSearchTerm] = useState("");
  const [selectedForwardContactEmails, setSelectedForwardContactEmails] = useState(new Set());
  const [isSendingForward, setIsSendingForward] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  const [unsendMessageTarget, setUnsendMessageTarget] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activePersonalUndoToast, setActivePersonalUndoToast] = useState(null);
  const pendingPersonalDeletionsRef = useRef({});
  const [isMessageSelectionMode, setIsMessageSelectionMode] = useState(false);
  const [selectedMessageItemIds, setSelectedMessageItemIds] = useState(new Set());
  const [pinnedMessagesMap, setPinnedMessagesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('bnx_casbox_pinned_messages');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [starredMessagesMap, setStarredMessagesMap] = useState(() => {
    try {
      const uKey = (user?.email || user?.username || 'default').toLowerCase();
      const userMap = localStorage.getItem(`bnx_casbox_starred_map_${uKey}`) || localStorage.getItem('bnx_casbox_starred_map');
      if (userMap) return JSON.parse(userMap);

      const legacySaved = localStorage.getItem(`bnx_casbox_starred_messages_${uKey}`) || localStorage.getItem('bnx_casbox_starred_messages');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) {
          const map = {};
          parsed.forEach(id => {
            map[String(id)] = { id: String(id), userId: uKey };
          });
          return map;
        } else if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  const starredMessagesSet = useMemo(() => new Set(Object.keys(starredMessagesMap)), [starredMessagesMap]);

  useEffect(() => {
    try {
      const uKey = (user?.email || user?.username || 'default').toLowerCase();
      const userMap = localStorage.getItem(`bnx_casbox_starred_map_${uKey}`) || localStorage.getItem('bnx_casbox_starred_map');
      if (userMap) {
        setStarredMessagesMap(JSON.parse(userMap));
        return;
      }
      const legacySaved = localStorage.getItem(`bnx_casbox_starred_messages_${uKey}`) || localStorage.getItem('bnx_casbox_starred_messages');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) {
          const map = {};
          parsed.forEach(id => { map[String(id)] = { id: String(id), userId: uKey }; });
          setStarredMessagesMap(map);
          return;
        } else if (typeof parsed === 'object' && parsed !== null) {
          setStarredMessagesMap(parsed);
          return;
        }
      }
      setStarredMessagesMap({});
    } catch (e) {}
  }, [user?.email, user?.username]);

  const [showStarredMessagesView, setShowStarredMessagesView] = useState(false);

  // Re-evaluate every 5 seconds to automatically hide the Edit option after 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Reset editing message when switching conversations
  useEffect(() => {
    setEditingMessage(null);
  }, [selectedMessage]);

  // Emoji Reactions State
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [emojiSearchTerm, setEmojiSearchTerm] = useState("");
  const [activeEmojiCategory, setActiveEmojiCategory] = useState("smileys");
  const [reactionsMap, setReactionsMap] = useState(() => {
    try {
      const saved = localStorage.getItem('bnx_casbox_reactions');
      return saved ? sanitizeReactionsMap(JSON.parse(saved)) : {};
    } catch (e) {
      return {};
    }
  });

  // Cross-tab/window real-time synchronization for reactions
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'bnx_casbox_reactions') {
        try {
          const updated = e.newValue ? JSON.parse(e.newValue) : {};
          setReactionsMap(sanitizeReactionsMap(updated));
        } catch {}
      }
    };
    const handleCustomEvent = (e) => {
      if (e.detail) {
        setReactionsMap(sanitizeReactionsMap(e.detail));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bnx_casbox_reactions_updated', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bnx_casbox_reactions_updated', handleCustomEvent);
    };
  }, []);

  const chatInputRef = React.useRef(null);
  const messageMenuRef = React.useRef(null);
  const reactionBarRef = React.useRef(null);

  // Reset reply, menu, reaction pickers, and forward state when switching conversation
  useEffect(() => {
    setReplyingToMessage(null);
    setActiveMessageMenuId(null);
    setActiveReactionMsgId(null);
    setShowFullEmojiPicker(false);
    setEmojiSearchTerm("");
    setShowStarredMessagesView(false);
    setForwardingMessage(null);
    setSelectedForwardContactEmails(new Set());
    setForwardSearchTerm("");
  }, [selectedMessage?.id, selectedMessage?.contact, selectedMessage?.senderEmail, selectedMessage?.receiverEmail]);

  const toggleSelectRow = useCallback((rowId) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setShowFilterMenu(false);
      }
      if (messagesFilterMenuRef.current && !messagesFilterMenuRef.current.contains(e.target)) {
        setShowMessagesFilterMenu(false);
      }
      if (combineMenuRef.current && !combineMenuRef.current.contains(e.target)) {
        setOpenCombineMenuId(null);
      }
      if (listMenuRef.current && !listMenuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
      if (messageMenuRef.current && !messageMenuRef.current.contains(e.target)) {
        setActiveMessageMenuId(null);
      }
      if (reactionBarRef.current && !reactionBarRef.current.contains(e.target)) {
        setActiveReactionMsgId(null);
        setShowFullEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const [showArchive, setShowArchive] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const [acceptedContacts, setAcceptedContacts] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_accepted');
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  });
  const [blockedContacts, setBlockedContacts] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_blocked') || localStorage.getItem('bnx_casbox_blocked');
      const raw = s ? JSON.parse(s) : [];
      if (!Array.isArray(raw)) return [];
      const map = new Map();
      raw.forEach(item => {
        const norm = normalizeEmail(item);
        if (!norm) return;
        const local = norm.includes('@') ? norm.split('@')[0] : norm;
        if (!map.has(local)) {
          map.set(local, norm);
        } else {
          const cur = map.get(local);
          if (!cur.includes('@') && norm.includes('@')) {
            map.set(local, norm);
          }
        }
      });
      return Array.from(map.values());
    } catch (e) {
      return [];
    }
  });
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [isProcessingBlockAction, setIsProcessingBlockAction] = useState(false);

  const blockedContactsRef = React.useRef(blockedContacts);
  useEffect(() => {
    blockedContactsRef.current = blockedContacts;
  }, [blockedContacts]);

  const loadBlockedContacts = useCallback(async () => {
    try {
      const res = await blockedContactsAPI.getBlockedContacts();
      const rawList = res.data?.data || res.data || [];
      const list = Array.isArray(rawList) ? rawList : [];
      const normalizedList = list
        .map(item => (typeof item === 'string' ? item : item?.email || item?.blockedEmail || item?.senderEmail || ''))
        .map(normalizeEmail)
        .filter(Boolean);

      const map = new Map();
      normalizedList.forEach(item => {
        const local = item.includes('@') ? item.split('@')[0] : item;
        if (!map.has(local)) {
          map.set(local, item);
        } else {
          const current = map.get(local);
          if (!current.includes('@') && item.includes('@')) {
            map.set(local, item);
          }
        }
      });
      const uniqueList = Array.from(map.values());
      setBlockedContacts(uniqueList);
      try {
        sessionStorage.setItem('bnx_casbox_blocked', JSON.stringify(uniqueList));
        localStorage.setItem('bnx_casbox_blocked', JSON.stringify(uniqueList));
      } catch (e) {}
    } catch (err) {
      console.warn("Failed to load blocked contacts from server", err);
    }
  }, []);

  useEffect(() => {
    if (user?.email) {
      loadBlockedContacts();
    }
  }, [user?.email, loadBlockedContacts]);

  const isBlockedContact = useCallback((targetEmail) => {
    if (!targetEmail) return false;
    const norm = normalizeEmail(targetEmail);
    const local = norm.includes('@') ? norm.split('@')[0] : norm;
    const list = (blockedContacts && blockedContacts.length > 0) ? blockedContacts : (blockedContactsRef.current || []);
    return list.some(b => {
      const bNorm = normalizeEmail(b);
      const bLocal = bNorm.includes('@') ? bNorm.split('@')[0] : bNorm;
      return bNorm === norm || bLocal === local;
    });
  }, [blockedContacts]);

  const acceptedContactsRef = React.useRef(acceptedContacts);
  useEffect(() => {
    acceptedContactsRef.current = acceptedContacts;
  }, [acceptedContacts]);

  const acceptedSetRef = React.useRef(new Set());
  const markedSeenIdsRef = React.useRef(new Set());

  // Existing Cashbox API call started immediately as the very first effect on mount
  const fetchMessages = useCallback(async (background = false) => {
    try {
      if (!background && messagesRef.current.length === 0) setLoading(true);
      const res = await casboxAPI.getAllMessages();
      const rawMsgs = res.data || [];

      const filtered = [];
      for (let i = 0; i < rawMsgs.length; i++) {
        const m = rawMsgs[i];
        const id = m.id || m.uid || `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        const strId = String(id);
        if (!deletedMessageIdsRef.current.has(id) && !deletedMessageIdsRef.current.has(strId)) {
          // If this message was already read in the session or marked read, ensure status reflects SEEN
          const statusUpper = String(m.status || '').trim().toUpperCase();
          const isLocallyRead = readMessageIdsRef.current.has(id) || readMessageIdsRef.current.has(strId);
          if (isLocallyRead && statusUpper !== 'SEEN' && statusUpper !== 'READ') {
            m.status = 'SEEN';
            m.isRead = true;
            m.read = true;
          } else if (statusUpper === 'SEEN' || statusUpper === 'READ' || m.isRead === true || m.read === true) {
            readMessageIdsRef.current.add(id);
            readMessageIdsRef.current.add(strId);
          }
          filtered.push(m);
        }

        // Seed already seen message IDs to prevent redundant status updates
        if (m.id && (String(m.status || '').toUpperCase() === 'SEEN' || String(m.status || '').toUpperCase() === 'READ')) {
          markedSeenIdsRef.current.add(m.id);
          markedSeenIdsRef.current.add(String(m.id));
        }
      }

      setMessages(filtered);

      // Collect any aliases returned in the messages DTOs in the background
      const dtoAliases = {};
      for (let i = 0; i < rawMsgs.length; i++) {
        const m = rawMsgs[i];
        if (m.customName && m.customName.trim()) {
          const val = m.customName.trim();
          if (m.contactUserId) dtoAliases[String(m.contactUserId)] = val;
          const other = isCurrentUser(m.senderEmail || m.sender) ? (m.receiverEmail || m.receiver) : (m.senderEmail || m.sender);
          if (other) {
            dtoAliases[other.toLowerCase()] = val;
            dtoAliases[other.split('@')[0].toLowerCase()] = val;
          }
          if (m.contactUsername) dtoAliases[m.contactUsername.toLowerCase()] = val;
        }
      }
      if (Object.keys(dtoAliases).length > 0) {
        setContactAliases(prev => ({ ...prev, ...dtoAliases }));
      }

      if (selectedContactRef.current) {
        const contactEmail = selectedContactRef.current;
        casboxAPI.getThread(contactEmail).then(r => {
          const threadRaw = r.data || [];
          const threadFiltered = threadRaw.filter(m => {
            const id = m.id || m.uid;
            const strId = String(id);
            return !deletedMessageIdsRef.current.has(id) && !deletedMessageIdsRef.current.has(strId);
          });
          setThreadMessages(prev => {
            if (prev.length === threadFiltered.length) {
              const hasChange = prev.some((m, idx) => {
                const target = threadFiltered[idx];
                return (
                  (m?.id !== target?.id && m?.uid !== target?.uid) ||
                  m?.status !== target?.status ||
                  m?.body !== target?.body
                );
              });
              if (!hasChange) return prev;
            }
            return threadFiltered;
          });
        }).catch(console.error);
      }
    } catch (err) {
      if (!background) toast.error("Failed to fetch messages");
    } finally {
      if (!background) setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchMessages();

    // Background auto-polling for new casbox messages every 10 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchMessages(true);
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMessages(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleCasboxMessageSent = (e) => {
      const newMsg = e?.detail?.message;
      if (newMsg) {
        setMessages(prev => [newMsg, ...prev.filter(m => m.id !== newMsg.id)]);
      }
      fetchMessages(true);
    };
    window.addEventListener('casbox_message_sent', handleCasboxMessageSent);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener('casbox_message_sent', handleCasboxMessageSent);
    };
  }, [fetchMessages]);

  // Subscribe to real-time Casbox WebSocket messages
  useEffect(() => {
    const ws = stompClient?.webSocket;
    if (!stompClient || !isConnected || !stompClient.connected || !ws || ws.readyState !== WebSocket.OPEN) return;

    let subMessages = null;
    let subStatus = null;

    try {
      subMessages = stompClient.subscribe('/user/queue/casbox/messages', (message) => {
        try {
          const newMsg = JSON.parse(message.body);
          if (newMsg && newMsg.id) {
            const sender = normalizeEmail(newMsg.senderEmail || newMsg.sender);
            const senderLocal = sender.includes('@') ? sender.split('@')[0] : sender;

            // Reject incoming messages from blocked users
            const isBlocked = blockedContactsRef.current.some(b => {
              const bNorm = normalizeEmail(b);
              const bLocal = bNorm.includes('@') ? bNorm.split('@')[0] : bNorm;
              return bNorm === sender || bLocal === senderLocal;
            });
            if (isBlocked) {
              return;
            }

            setMessages(prev => {
              const existingIdx = prev.findIndex(m => m.id === newMsg.id);
              if (existingIdx !== -1) {
                const next = [...prev];
                next[existingIdx] = { ...next[existingIdx], ...newMsg };
                return next;
              }
              return [newMsg, ...prev];
            });

            const otherEmail = normalizeEmail(
              isCurrentUserRef.current(sender)
                ? (newMsg.receiverEmail || newMsg.receiver)
                : (newMsg.senderEmail || newMsg.sender)
            );
            if (selectedContactRef.current && normalizeEmail(selectedContactRef.current) === otherEmail) {
              setThreadMessages(prev => {
                const existingIdx = prev.findIndex(m => m.id === newMsg.id);
                if (existingIdx !== -1) {
                  const next = [...prev];
                  next[existingIdx] = { ...next[existingIdx], ...newMsg };
                  return next;
                }
                return [...prev, newMsg];
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse incoming WebSocket casbox message", e);
        }
      });

      subStatus = stompClient.subscribe('/user/queue/casbox/status', (message) => {
        try {
          const statusDto = JSON.parse(message.body);
          if (statusDto && statusDto.id) {
            const isSeenOrRead = statusDto.status === 'SEEN' || statusDto.status === 'READ';
            if (isSeenOrRead) {
              readMessageIdsRef.current.add(statusDto.id);
              readMessageIdsRef.current.add(String(statusDto.id));
              setReadMessageIds(prev => {
                const next = new Set(prev);
                next.add(statusDto.id);
                next.add(String(statusDto.id));
                return next;
              });
            }
            setMessages(prev => prev.map(m => (String(m.id) === String(statusDto.id) || (m.uid && String(m.uid) === String(statusDto.id)))
              ? { ...m, status: statusDto.status, ...(isSeenOrRead ? { isRead: true, read: true } : {}) }
              : m
            ));
            setThreadMessages(prev => prev.map(m => (String(m.id) === String(statusDto.id) || (m.uid && String(m.uid) === String(statusDto.id)))
              ? { ...m, status: statusDto.status, ...(isSeenOrRead ? { isRead: true, read: true } : {}) }
              : m
            ));
            setSelectedSentDetail(prev => {
              if (!prev) return prev;
              const isMatch = String(prev.id) === String(statusDto.id) || (prev.uid && String(prev.uid) === String(statusDto.id));
              return isMatch ? { ...prev, status: statusDto.status, ...(isSeenOrRead ? { isRead: true, read: true } : {}) } : prev;
            });
          }
        } catch (e) {
          console.error("Failed to parse status update", e);
        }
      });
    } catch (err) {
      console.warn("Could not subscribe to Casbox WebSocket topics", err);
    }

    return () => {
      try {
        const currentWs = stompClient?.webSocket;
        if (stompClient && stompClient.connected && currentWs && currentWs.readyState === WebSocket.OPEN) {
          if (subMessages && typeof subMessages.unsubscribe === 'function') subMessages.unsubscribe();
          if (subStatus && typeof subStatus.unsubscribe === 'function') subStatus.unsubscribe();
        }
      } catch (e) {}
    };
  }, [stompClient, isConnected, user?.email]);


  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newChatText, setNewChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [isChatStarred, setIsChatStarred] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = React.useRef(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = React.useRef(null);

  const handleEmojiSelect = (emoji) => {
    setNewChatText(prev => prev + emoji);
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

  const [openMenuId, setOpenMenuId] = useState(null);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const listMenuRef = React.useRef(null);

  const [contactAliases, setContactAliases] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_aliases');
      return s ? JSON.parse(s) : {};
    } catch (e) {
      return {};
    }
  });
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [customNameInput, setCustomNameInput] = useState("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  const fetchAliases = async () => {
    try {
      const res = await contactAliasAPI.getAllAliases();
      if (res.data && Array.isArray(res.data)) {
        const map = {};
        res.data.forEach(item => {
          if (item.customName && item.customName.trim()) {
            const trimmed = item.customName.trim();
            if (item.contactUserId) map[String(item.contactUserId)] = trimmed;
            if (item.contactEmail) map[item.contactEmail.toLowerCase()] = trimmed;
            if (item.contactUsername) map[item.contactUsername.toLowerCase()] = trimmed;
          }
        });
        setContactAliases(prev => {
          const next = { ...prev, ...map };
          try {
            sessionStorage.setItem('bnx_casbox_aliases', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to load contact aliases", e);
    }
  };

  useEffect(() => {
    fetchAliases();
  }, []);

  const [connections, setConnections] = useState(() => {
    try {
      const s = sessionStorage.getItem('bnx_casbox_connections');
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  });
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [connectionToDisconnect, setConnectionToDisconnect] = useState(null);
  const [isUpdatingConnection, setIsUpdatingConnection] = useState(false);
  const connectionsRef = React.useRef(null);

  const fetchConnections = async () => {
    try {
      setLoadingConnections(true);
      const res = await connectionAPI.getAccepted();
      if (res.data && Array.isArray(res.data)) {
        setConnections(res.data);
        try {
          sessionStorage.setItem('bnx_casbox_connections', JSON.stringify(res.data));
        } catch (e) {}
      }
    } catch (e) {
      console.error("Failed to load connections", e);
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (connectionsRef.current && !connectionsRef.current.contains(event.target)) {
        setShowConnectionsModal(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowConnectionsModal(false);
      }
    };
    if (showConnectionsModal) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showConnectionsModal]);

  const isDisconnectedContact = (emailOrUsername) => {
    if (!emailOrUsername) return false;
    const lower = emailOrUsername.toLowerCase();
    const local = (lower.includes('@') ? lower.split('@')[0] : lower);
    return connections.some(c => {
      if (c.status?.toUpperCase() !== 'DISCONNECTED') return false;
      const cEmail = c.contactEmail?.toLowerCase();
      const cUser = c.contactUsername?.toLowerCase();
      const cId = c.contactUserId ? String(c.contactUserId) : null;
      return (cEmail && (cEmail === lower || cEmail === local)) ||
             (cUser && (cUser === lower || cUser === local)) ||
             (cId && cId === lower);
    });
  };

  const handleConfirmDisconnect = async () => {
    if (!connectionToDisconnect) return;
    try {
      setIsUpdatingConnection(true);
      const connId = connectionToDisconnect.id;
      const targetName = connectionToDisconnect.contactDisplayName || connectionToDisconnect.contactUsername || "contact";
      await connectionAPI.updateStatus(connId, "DISCONNECTED");

      // Update local state
      setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: "DISCONNECTED" } : c));

      // Close current chat if disconnected
      if (selectedMessage) {
        const other = getOtherUserEmail(selectedMessage);
        if (other) {
          const lower = other.toLowerCase();
          const local = (lower.includes('@') ? lower.split('@')[0] : lower);
          const cEmail = connectionToDisconnect.contactEmail?.toLowerCase();
          const cUser = connectionToDisconnect.contactUsername?.toLowerCase();
          if ((cEmail && (cEmail === lower || cEmail === local)) || (cUser && (cUser === lower || cUser === local))) {
            setSelectedMessage(null);
          }
        }
      }

      fetchMessages(true);
      toast.success(`Disconnected from ${targetName}`);
    } catch (e) {
      console.error("Failed to disconnect", e);
      toast.error(e.response?.data?.message || "Failed to disconnect");
    } finally {
      setIsUpdatingConnection(false);
      setConnectionToDisconnect(null);
    }
  };

  const handleReconnect = async (conn) => {
    if (!conn) return;
    try {
      setIsUpdatingConnection(true);
      const connId = conn.id;
      const targetName = conn.contactDisplayName || conn.contactUsername || "contact";
      await connectionAPI.updateStatus(connId, "CONNECTED");

      setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: "CONNECTED" } : c));
      fetchMessages(true);
      toast.success(`Connected with ${targetName}`);
    } catch (e) {
      console.error("Failed to reconnect", e);
      toast.error(e.response?.data?.message || "Failed to reconnect");
    } finally {
      setIsUpdatingConnection(false);
    }
  };

  const getOtherUserEmail = useCallback((msg) => {
    if (!msg) return "";
    const sender = normalizeEmail(msg.senderEmail || msg.sender);
    const receiver = normalizeEmail(msg.receiverEmail || msg.receiver);
    const contact = normalizeEmail(msg.contact || msg.contactRecipient || msg.contactEmail || "");

    const isSenderMe = sender ? isCurrentUser(sender) : false;
    const isReceiverMe = receiver ? isCurrentUser(receiver) : false;

    if (isSenderMe) {
      return msg.receiverEmail || msg.receiver || msg.contact || msg.contactRecipient || msg.contactEmail || "";
    }
    if (isReceiverMe) {
      return msg.senderEmail || msg.sender || msg.contact || msg.contactRecipient || msg.contactEmail || "";
    }
    if (sender && !isCurrentUser(sender)) {
      return msg.senderEmail || msg.sender;
    }
    if (receiver && !isCurrentUser(receiver)) {
      return msg.receiverEmail || msg.receiver;
    }
    return contact || msg.senderEmail || msg.receiverEmail || "";
  }, [isCurrentUser]);

  const getDisplayName = (emailOrUsername, msg) => {
    if (!emailOrUsername) return "";
    const key = emailOrUsername.toLowerCase();
    const local = (emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername).toLowerCase();
    if (contactAliases[key]) return contactAliases[key];
    if (contactAliases[local]) return contactAliases[local];
    if (msg) {
      if (msg.customName && msg.customName.trim()) return msg.customName.trim();
      if (msg.contactDisplayName && msg.contactDisplayName.trim()) return msg.contactDisplayName.trim();
    }
    return emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername;
  };

  const getOriginalName = (emailOrUsername, msg) => {
    if (!emailOrUsername) return "";
    if (msg?.contactUsername) return msg.contactUsername;
    return emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername;
  };

  const getContactInitial = (emailOrUsername, msg) => {
    const name = getDisplayName(emailOrUsername, msg);
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // Message Action Helpers (Reply, Pin, Unsend, Forward) - Declared after getDisplayName & getOtherUserEmail
  const cleanMessageBody = useCallback((body) => {
    if (typeof body !== 'string' || !body) return '';
    let text = body;

    // Safely strip reply prefix: [Replying to ...]\n
    if (text.startsWith('[Replying to ')) {
      const replyEnd = text.indexOf(']\n');
      if (replyEnd !== -1) {
        text = text.substring(replyEnd + 2);
      }
    }

    if (typeof text !== 'string') return '';

    // Safely strip forwarded prefix: [Forwarded ...]\n
    if (text.startsWith('[Forwarded')) {
      const fwdEnd = text.indexOf(']\n');
      if (fwdEnd !== -1) {
        text = text.substring(fwdEnd + 2);
      }
    }

    return typeof text === 'string' ? text : '';
  }, []);

  const getPinnedSenderLabel = useCallback((pinnedMsg) => {
    if (!pinnedMsg) return '';
    if (pinnedMsg.senderLabel) return pinnedMsg.senderLabel;
    const isMe = isCurrentUser(pinnedMsg.senderEmail || pinnedMsg.sender);
    const sEmail = pinnedMsg.senderEmail || pinnedMsg.sender || '';
    return isMe ? (user?.username || sEmail.split('@')[0]) : getDisplayName(sEmail, pinnedMsg);
  }, [isCurrentUser, user?.username, getDisplayName]);

  const isCurrentMessagePinned = useCallback((msg, contactEmail) => {
    if (!contactEmail || !msg) return false;
    const pinned = pinnedMessagesMap[contactEmail.toLowerCase()];
    if (!pinned) return false;
    const pId = pinned.id !== undefined ? pinned.id : pinned.uid;
    const mId = msg.id !== undefined ? msg.id : msg.uid;
    if (pId !== undefined && mId !== undefined && (pId === mId || String(pId) === String(mId))) return true;
    const pFallback = `${pinned.timestamp}-${pinned.senderEmail || pinned.sender}-${pinned.body}`;
    const mFallback = `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.body}`;
    return pFallback === mFallback;
  }, [pinnedMessagesMap]);

  const handleUnpinMessage = useCallback((contactEmail) => {
    if (!contactEmail) return;
    const normContact = contactEmail.toLowerCase();
    setPinnedMessagesMap(prev => {
      const next = { ...prev };
      delete next[normContact];
      try {
        localStorage.setItem('bnx_casbox_pinned_messages', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    toast.success("Message unpinned");
  }, []);

  const handleTogglePinMessage = useCallback((msg, senderLabel, contactEmail) => {
    if (!contactEmail || !msg) return;
    const normContact = contactEmail.toLowerCase();
    setActiveMessageMenuId(null);

    if (isCurrentMessagePinned(msg, contactEmail)) {
      handleUnpinMessage(contactEmail);
    } else {
      const pinPayload = {
        ...msg,
        senderLabel: senderLabel || getDisplayName(msg.senderEmail || msg.sender, msg)
      };
      setPinnedMessagesMap(prev => {
        const next = { ...prev, [normContact]: pinPayload };
        try {
          localStorage.setItem('bnx_casbox_pinned_messages', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      toast.success("Message pinned");
    }
  }, [isCurrentMessagePinned, getDisplayName, handleUnpinMessage]);

  const getMessageKey = useCallback((msg) => {
    if (!msg) return null;
    const mId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
    if (mId !== undefined && mId !== null) {
      return String(mId);
    }
    return `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.receiverEmail || msg.receiver || ''}-${msg.body}`;
  }, []);

  const isMessageStarred = useCallback((msg) => {
    if (!msg) return false;
    const key = getMessageKey(msg);
    if (!key) return false;
    const mId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
    return starredMessagesSet.has(key) || (mId !== undefined && mId !== null && (starredMessagesSet.has(mId) || starredMessagesSet.has(String(mId))));
  }, [getMessageKey, starredMessagesSet]);

  const handleToggleStarMessage = useCallback((msg) => {
    if (!msg) return;
    setActiveMessageMenuId(null);
    const key = getMessageKey(msg);
    if (!key) return;

    const mId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
    const activeContact = (selectedMessage ? getOtherUserEmail(selectedMessage) : null) || getOtherUserEmail(msg) || '';
    const uKey = (user?.email || user?.username || 'default').toLowerCase();

    setStarredMessagesMap(prev => {
      const next = { ...prev };
      const isAlreadyStarred = Boolean(
        next[key] || 
        (mId !== undefined && mId !== null && (next[mId] || next[String(mId)]))
      );

      if (isAlreadyStarred) {
        delete next[key];
        if (mId !== undefined && mId !== null) {
          delete next[mId];
          delete next[String(mId)];
        }
        toast.success("Message unstarred");
      } else {
        const entry = {
          id: key,
          messageId: mId !== undefined && mId !== null ? String(mId) : key,
          contact: activeContact,
          contactNorm: normalizeEmail(activeContact),
          userId: uKey,
          timestamp: msg.timestamp || Date.now()
        };
        next[key] = entry;
        if (mId !== undefined && mId !== null) {
          next[String(mId)] = entry;
        }
        toast.success("Message starred");
      }

      try {
        localStorage.setItem(`bnx_casbox_starred_map_${uKey}`, JSON.stringify(next));
        localStorage.setItem('bnx_casbox_starred_map', JSON.stringify(next));
        localStorage.setItem(`bnx_casbox_starred_messages_${uKey}`, JSON.stringify(Object.keys(next)));
        localStorage.setItem('bnx_casbox_starred_messages', JSON.stringify(Object.keys(next)));
      } catch (e) {}
      return next;
    });
  }, [getMessageKey, selectedMessage, getOtherUserEmail, user?.email, user?.username]);

  const handleScrollToMessage = useCallback((pinnedMsg) => {
    if (!pinnedMsg) return;
    const targetId = pinnedMsg.id !== undefined ? pinnedMsg.id : pinnedMsg.uid;
    const fallbackId = `${pinnedMsg.timestamp}-${pinnedMsg.senderEmail || pinnedMsg.sender}-${pinnedMsg.body}`;
    const uniqueKey = targetId !== undefined && targetId !== null ? targetId : fallbackId;

    const el = document.getElementById(`casbox-msg-${uniqueKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(uniqueKey);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    } else {
      toast("Message is in earlier history", { icon: "ℹ️" });
    }
  }, []);

  const parseReplyHeader = useCallback((body) => {
    if (typeof body !== 'string' || !body || !body.startsWith('[Replying to ')) return null;

    const closingIndex = body.indexOf(']\n');
    if (closingIndex === -1) return null;

    const header = body.substring(0, closingIndex + 1);
    if (!header) return null;

    const match = header.match(/^\[Replying to ([^:]+?)(?:\s+(?:id=|id:|#|\(id:)([^\s:)]+)\)?)?:\s*"([\s\S]*?)"\]$/);
    if (!match) {
      const colonIdx = header.indexOf(':');
      if (colonIdx !== -1) {
        const senderPart = header.substring(13, colonIdx).trim();
        const quotePart = header.substring(colonIdx + 1, header.length - 1).trim().replace(/^"/, '').replace(/"$/, '');
        return {
          quotedSender: senderPart || '',
          originalMsgId: null,
          quotedSnippet: quotePart || ''
        };
      }
      return null;
    }

    return {
      quotedSender: (match[1] || "").trim(),
      originalMsgId: match[2] ? match[2].trim() : null,
      quotedSnippet: match[3] || ""
    };
  }, []);

  const handleNavigateToOriginalMessage = useCallback(async (originalMsgId, quoteSnippet, quotedSender) => {
    const cleanSnippet = (quoteSnippet || "").trim();

    // Helper to smoothly scroll and temporarily highlight the target message for 2 seconds
    const highlightElement = (el, idKey) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(idKey);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    };

    // 1. Direct search by ID in DOM
    if (originalMsgId) {
      const el = document.getElementById(`casbox-msg-${originalMsgId}`);
      if (el) {
        highlightElement(el, originalMsgId);
        return;
      }
    }

    // 2. Search in threadMessages state by ID or content
    let targetMsg = null;
    if (originalMsgId) {
      targetMsg = threadMessages.find(m => {
        const mKey = getMessageKey(m);
        const mId = m.id !== undefined && m.id !== null ? String(m.id) : (m.uid ? String(m.uid) : null);
        return mKey === originalMsgId || mId === originalMsgId;
      });
    }

    if (!targetMsg && cleanSnippet) {
      targetMsg = threadMessages.find(m => {
        const mClean = cleanMessageBody(m.body || "").replace(/\n/g, ' ').trim();
        return mClean === cleanSnippet || mClean.startsWith(cleanSnippet) || cleanSnippet.startsWith(mClean);
      });
    }

    if (targetMsg) {
      const targetKey = getMessageKey(targetMsg);
      const el = document.getElementById(`casbox-msg-${targetKey}`);
      if (el) {
        highlightElement(el, targetKey);
        return;
      }
    }

    // Check if the original message was deleted
    if (
      originalMsgId &&
      (deletedMessageIdsRef.current.has(originalMsgId) ||
        deletedMessageIdsRef.current.has(Number(originalMsgId)) ||
        deletedMessageIdsRef.current.has(String(originalMsgId)))
    ) {
      toast("Original message is unavailable.", { icon: "ℹ️" });
      return;
    }

    // 3. Search in all loaded messages state (if outside current thread view)
    let foundInAllMessages = null;
    if (originalMsgId) {
      foundInAllMessages = messages.find(m => {
        const mKey = getMessageKey(m);
        const mId = m.id !== undefined && m.id !== null ? String(m.id) : (m.uid ? String(m.uid) : null);
        return mKey === originalMsgId || mId === originalMsgId;
      });
    }

    if (!foundInAllMessages && cleanSnippet) {
      foundInAllMessages = messages.find(m => {
        const mClean = cleanMessageBody(m.body || "").replace(/\n/g, ' ').trim();
        return mClean === cleanSnippet || mClean.startsWith(cleanSnippet) || cleanSnippet.startsWith(mClean);
      });
    }

    if (foundInAllMessages) {
      const targetKey = getMessageKey(foundInAllMessages);
      setThreadMessages(prev => {
        if (prev.some(m => getMessageKey(m) === targetKey)) return prev;
        return [...prev, foundInAllMessages];
      });

      setTimeout(() => {
        const el = document.getElementById(`casbox-msg-${targetKey}`);
        if (el) {
          highlightElement(el, targetKey);
        } else {
          toast("Original message is unavailable.", { icon: "ℹ️" });
        }
      }, 100);
      return;
    }

    // 4. Fetch the full conversation thread from server if not loaded yet
    const otherEmail = selectedMessage ? getOtherUserEmail(selectedMessage) : null;
    if (otherEmail) {
      try {
        const res = await casboxAPI.getThread(otherEmail);
        const data = res.data || [];
        const serverFiltered = data.filter(m => {
          const id = m.id !== undefined ? m.id : m.uid;
          const strId = id !== undefined && id !== null ? String(id) : null;
          const fallbackId = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
          return !(
            deletedMessageIdsRef.current.has(id) ||
            (strId && deletedMessageIdsRef.current.has(strId)) ||
            deletedMessageIdsRef.current.has(fallbackId)
          );
        });

        let serverMatch = null;
        if (originalMsgId) {
          serverMatch = serverFiltered.find(m => {
            const mKey = getMessageKey(m);
            const mId = m.id !== undefined && m.id !== null ? String(m.id) : (m.uid ? String(m.uid) : null);
            return mKey === originalMsgId || mId === originalMsgId;
          });
        }
        if (!serverMatch && cleanSnippet) {
          serverMatch = serverFiltered.find(m => {
            const mClean = cleanMessageBody(m.body || "").replace(/\n/g, ' ').trim();
            return mClean === cleanSnippet || mClean.startsWith(cleanSnippet) || cleanSnippet.startsWith(mClean);
          });
        }

        if (serverMatch) {
          setThreadMessages(serverFiltered);
          const targetKey = getMessageKey(serverMatch);
          setTimeout(() => {
            const el = document.getElementById(`casbox-msg-${targetKey}`);
            if (el) {
              highlightElement(el, targetKey);
            } else {
              toast("Original message is unavailable.", { icon: "ℹ️" });
            }
          }, 120);
          return;
        }
      } catch (err) {
        console.error("Failed to load thread for reply navigation", err);
      }
    }

    // 5. If the original message cannot be found or has been deleted
    toast("Original message is unavailable.", { icon: "ℹ️" });
  }, [threadMessages, messages, getMessageKey, cleanMessageBody, selectedMessage, getOtherUserEmail]);

  const handleInitiateReply = useCallback((msg, senderLabel) => {
    setActiveMessageMenuId(null);
    setReplyingToMessage({
      ...msg,
      senderLabel: senderLabel || getDisplayName(msg.senderEmail || msg.sender, msg)
    });
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  }, [getDisplayName]);

  const handleInitiateForward = useCallback((msg, senderLabel) => {
    setActiveMessageMenuId(null);
    setForwardingMessage({
      ...msg,
      senderLabel: senderLabel || getDisplayName(msg.senderEmail || msg.sender, msg)
    });
    setForwardSearchTerm("");
    setSelectedForwardContactEmails(new Set());
  }, [getDisplayName]);

  const handleCloseForwardModal = useCallback(() => {
    if (isSendingForward) return;
    setForwardingMessage(null);
    setSelectedForwardContactEmails(new Set());
    setForwardSearchTerm("");
  }, [isSendingForward]);

  const handleToggleForwardContact = useCallback((identKey) => {
    if (!identKey) return;
    const lower = normalizeEmail(identKey);
    setSelectedForwardContactEmails(prev => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  }, []);

  const handleInitiateUnsend = useCallback((msg) => {
    setActiveMessageMenuId(null);
    setUnsendMessageTarget(msg);
  }, []);

  const handleConfirmUnsendMessage = useCallback(() => {
    if (!unsendMessageTarget) return;
    const target = unsendMessageTarget;
    const targetId = target.id !== undefined ? target.id : target.uid;
    const strId = targetId !== undefined && targetId !== null ? String(targetId) : null;
    const fallbackId = `${target.timestamp}-${target.senderEmail || target.sender}-${target.receiverEmail || target.receiver}-${target.body}`;

    setDeletedMessageIds(prev => {
      const updated = new Set(prev);
      if (targetId !== undefined && targetId !== null) {
        updated.add(targetId);
        updated.add(strId);
      }
      updated.add(fallbackId);
      try {
        const json = JSON.stringify(Array.from(updated));
        sessionStorage.setItem('bnx_casbox_deleted_message_ids', json);
        localStorage.setItem('bnx_casbox_deleted_message_ids', json);
      } catch (e) {}
      return updated;
    });

    setMessages(prev => prev.filter(m => {
      const mId = m.id !== undefined ? m.id : m.uid;
      if (targetId !== undefined && targetId !== null && (mId === targetId || String(mId) === strId)) return false;
      const mFallback = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
      return mFallback !== fallbackId;
    }));

    setThreadMessages(prev => prev.filter(m => {
      const mId = m.id !== undefined ? m.id : m.uid;
      if (targetId !== undefined && targetId !== null && (mId === targetId || String(mId) === strId)) return false;
      const mFallback = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
      return mFallback !== fallbackId;
    }));

    if (selectedMessage) {
      const otherEmail = getOtherUserEmail(selectedMessage);
      if (otherEmail) {
        const currPinned = pinnedMessagesMap[otherEmail.toLowerCase()];
        if (currPinned) {
          const pId = currPinned.id !== undefined ? currPinned.id : currPinned.uid;
          const pFallback = `${currPinned.timestamp}-${currPinned.senderEmail || currPinned.sender}-${currPinned.body}`;
          if ((targetId !== undefined && (pId === targetId || String(pId) === strId)) || pFallback === fallbackId) {
            handleUnpinMessage(otherEmail);
          }
        }
      }
    }

    if (replyingToMessage) {
      const rId = replyingToMessage.id !== undefined ? replyingToMessage.id : replyingToMessage.uid;
      if (targetId !== undefined && (rId === targetId || String(rId) === strId)) {
        setReplyingToMessage(null);
      }
    }

    setStarredMessagesMap(prev => {
      const key = targetId !== undefined && targetId !== null ? strId : fallbackId;
      if (prev[key] || (targetId !== undefined && (prev[targetId] || prev[strId]))) {
        const next = { ...prev };
        delete next[key];
        if (targetId !== undefined) {
          delete next[targetId];
          delete next[strId];
        }
        try {
          const uKey = (user?.email || user?.username || 'default').toLowerCase();
          localStorage.setItem(`bnx_casbox_starred_map_${uKey}`, JSON.stringify(next));
          localStorage.setItem('bnx_casbox_starred_map', JSON.stringify(next));
          localStorage.setItem(`bnx_casbox_starred_messages_${uKey}`, JSON.stringify(Object.keys(next)));
          localStorage.setItem('bnx_casbox_starred_messages', JSON.stringify(Object.keys(next)));
        } catch (e) {}
        return next;
      }
      return prev;
    });

    setUnsendMessageTarget(null);
    setActiveMessageMenuId(null);
    toast.success("Message unsent");
  }, [unsendMessageTarget, selectedMessage, pinnedMessagesMap, handleUnpinMessage, replyingToMessage, getOtherUserEmail]);

  // 5-Second Undo Message Deletion handlers for Personal Chat
  const commitPersonalDelete = useCallback(async (opId) => {
    const op = pendingPersonalDeletionsRef.current[opId];
    if (!op || op.committed) return;
    op.committed = true;
    if (op.timerId) clearTimeout(op.timerId);
    if (op.intervalId) clearInterval(op.intervalId);

    setActivePersonalUndoToast(prev => (prev?.opId === opId ? null : prev));

    const targetId = op.targetId;
    delete pendingPersonalDeletionsRef.current[opId];

    const strId = targetId !== undefined && targetId !== null ? String(targetId) : null;
    const fallbackId = `${op.msg.timestamp}-${op.msg.senderEmail || op.msg.sender}-${op.msg.receiverEmail || op.msg.receiver || ''}-${op.msg.body}`;

    setDeletedMessageIds(prev => {
      const next = new Set(prev);
      if (targetId !== undefined && targetId !== null) {
        next.add(targetId);
        next.add(strId);
      }
      if (fallbackId) next.add(fallbackId);
      try {
        const json = JSON.stringify(Array.from(next));
        sessionStorage.setItem('bnx_casbox_deleted_message_ids', json);
        localStorage.setItem('bnx_casbox_deleted_message_ids', json);
      } catch (e) {}
      return next;
    });

    const numId = Number(targetId);
    if (!isNaN(numId) && numId > 0) {
      try {
        await casboxAPI.deleteMessage(numId);
      } catch (err) {
        console.error("Failed to delete personal chat message on backend", err);
      }
    }
  }, []);

  const handleUndoPersonalDelete = useCallback((opId) => {
    const op = pendingPersonalDeletionsRef.current[opId];
    if (!op || op.committed) return;
    if (op.timerId) clearTimeout(op.timerId);
    if (op.intervalId) clearInterval(op.intervalId);

    delete pendingPersonalDeletionsRef.current[opId];
    setActivePersonalUndoToast(prev => (prev?.opId === opId ? null : prev));

    setThreadMessages(prev => {
      const key = op.msgKey;
      if (prev.some(m => getMessageKey(m) === key)) return prev;
      const next = [...prev];
      const insertIdx = (typeof op.origThreadIdx === 'number' && op.origThreadIdx >= 0 && op.origThreadIdx <= next.length)
        ? op.origThreadIdx
        : next.length;
      next.splice(insertIdx, 0, op.msg);
      return next;
    });

    setMessages(prev => {
      const key = op.msgKey;
      if (prev.some(m => getMessageKey(m) === key)) return prev;
      const next = [...prev];
      const insertIdx = (typeof op.origMessagesIdx === 'number' && op.origMessagesIdx >= 0 && op.origMessagesIdx <= next.length)
        ? op.origMessagesIdx
        : next.length;
      next.splice(insertIdx, 0, op.msg);
      return next;
    });

    toast.success("Message restored");
  }, [getMessageKey]);

  const handleDismissPersonalToast = useCallback((opId) => {
    setActivePersonalUndoToast(prev => (prev?.opId === opId ? null : prev));
  }, []);

  const handleDeletePersonalChatMessage = useCallback((msg) => {
    if (!msg) return;
    setActiveMessageMenuId(null);

    const msgKey = getMessageKey(msg);
    if (!msgKey) return;

    const targetId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
    const opId = `del_casbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const origThreadIdx = threadMessages.findIndex(m => getMessageKey(m) === msgKey);
    const origMessagesIdx = messages.findIndex(m => getMessageKey(m) === msgKey);

    // Immediately hide only that selected message from current view
    setThreadMessages(prev => prev.filter(m => getMessageKey(m) !== msgKey));
    setMessages(prev => prev.filter(m => getMessageKey(m) !== msgKey));

    let countdown = 5;
    const intervalId = setInterval(() => {
      countdown -= 1;
      if (countdown >= 1) {
        setActivePersonalUndoToast(prev => (prev?.opId === opId ? { ...prev, countdown } : prev));
      }
    }, 1000);

    const timerId = setTimeout(() => {
      commitPersonalDelete(opId);
    }, 5000);

    pendingPersonalDeletionsRef.current[opId] = {
      opId,
      msg,
      msgKey,
      targetId,
      origThreadIdx,
      origMessagesIdx,
      timerId,
      intervalId,
      countdown: 5,
      committed: false
    };

    setActivePersonalUndoToast({
      opId,
      countdown: 5,
      label: "Message deleted"
    });
  }, [getMessageKey, threadMessages, messages, commitPersonalDelete]);

  // Clean up pending personal deletions on unmount or chat switch
  useEffect(() => {
    return () => {
      const pendingMap = pendingPersonalDeletionsRef.current;
      Object.keys(pendingMap).forEach(opId => {
        commitPersonalDelete(opId);
      });
    };
  }, [selectedMessage?.id, selectedMessage?.contact, selectedMessage?.senderEmail, selectedMessage?.receiverEmail, commitPersonalDelete]);

  // Message Selection Mode (WhatsApp-style)
  const handleEnterMessageSelectionMode = useCallback((initialMsgId) => {
    setActiveMessageMenuId(null);
    setActiveReactionMsgId(null);
    setIsMessageSelectionMode(true);
    if (initialMsgId !== undefined && initialMsgId !== null) {
      setSelectedMessageItemIds(new Set([String(initialMsgId)]));
    } else {
      setSelectedMessageItemIds(new Set());
    }
  }, []);

  const handleExitMessageSelectionMode = useCallback(() => {
    setIsMessageSelectionMode(false);
    setSelectedMessageItemIds(new Set());
  }, []);

  const handleClearMessageSelection = useCallback(() => {
    setSelectedMessageItemIds(new Set());
  }, []);

  const handleToggleSelectMessage = useCallback((msgId) => {
    if (!msgId) return;
    const strId = String(msgId);
    setSelectedMessageItemIds(prev => {
      const next = new Set(prev);
      if (next.has(strId)) {
        next.delete(strId);
      } else {
        next.add(strId);
      }
      return next;
    });
  }, []);

  // Ensure selection state is handled correctly when switching conversations
  useEffect(() => {
    setIsMessageSelectionMode(false);
    setSelectedMessageItemIds(new Set());
  }, [
    selectedMessage?.id,
    selectedMessage?.uid,
    selectedMessage?.timestamp,
    selectedMessage?.senderEmail,
    selectedMessage?.receiverEmail,
    selectedMessage?.sender,
    selectedMessage?.receiver
  ]);

  // Accurately calculates message age in seconds, accounting for server vs client timezone representation and clock skew
  const getMessageAgeSeconds = useCallback((msg, referenceTime = Date.now()) => {
    if (!msg) return Infinity;
    const rawTs = msg.timestamp || msg.createdAt || msg.time;
    if (!rawTs) return Infinity;

    if (typeof rawTs === 'number') {
      const diff = (referenceTime - rawTs) / 1000;
      return diff >= -30 ? Math.max(0, diff) : Infinity;
    }

    if (rawTs instanceof Date) {
      const diff = (referenceTime - rawTs.getTime()) / 1000;
      return diff >= -30 ? Math.max(0, diff) : Infinity;
    }

    if (Array.isArray(rawTs)) {
      const [y, m = 1, d = 1, h = 0, min = 0, s = 0] = rawTs;
      const dLocal = new Date(y, m - 1, d, h, min, s).getTime();
      const dUtc = new Date(Date.UTC(y, m - 1, d, h, min, s)).getTime();
      const diffL = (referenceTime - dLocal) / 1000;
      const diffU = (referenceTime - dUtc) / 1000;
      const candL = diffL >= -30 && diffL <= 600 ? diffL : null;
      const candU = diffU >= -30 && diffU <= 600 ? diffU : null;
      if (candL !== null && candU !== null) return Math.max(0, Math.min(candL, candU));
      if (candL !== null) return Math.max(0, candL);
      if (candU !== null) return Math.max(0, candU);
      return Math.max(0, Math.min(Math.abs(diffL), Math.abs(diffU)));
    }

    if (typeof rawTs === 'string') {
      let str = rawTs.trim();
      if (!str) return Infinity;
      if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
      }

      const hasTz = /Z$|[+-]\d{2}(:?\d{2})?$/i.test(str);
      if (hasTz) {
        const d = new Date(str);
        if (isNaN(d.getTime())) return Infinity;
        const diff = (referenceTime - d.getTime()) / 1000;
        return diff >= -30 ? Math.max(0, diff) : Infinity;
      }

      // No timezone offset specified in string (e.g. "2026-10-14T14:40:00")
      // Evaluate both local server time and UTC server time interpretations
      const dLocal = new Date(str).getTime();
      const dUtc = new Date(`${str}Z`).getTime();
      const diffL = !isNaN(dLocal) ? (referenceTime - dLocal) / 1000 : Infinity;
      const diffU = !isNaN(dUtc) ? (referenceTime - dUtc) / 1000 : Infinity;

      const validL = diffL >= -30 && diffL <= 600;
      const validU = diffU >= -30 && diffU <= 600;

      if (validL && !validU) return Math.max(0, diffL);
      if (validU && !validL) return Math.max(0, diffU);
      if (validL && validU) return Math.max(0, Math.min(diffL, diffU));

      // Handle timezone offset discrepancy (e.g. IST +05:30)
      if (diffL < -120) {
        const tzOffsetSec = (new Date().getTimezoneOffset()) * 60;
        const adjustedDiff = diffL - tzOffsetSec;
        if (adjustedDiff >= -30 && adjustedDiff <= 600) {
          return Math.max(0, adjustedDiff);
        }
      }

      if (diffL >= 0 && diffU < 0) return diffL;
      if (diffU >= 0 && diffL < 0) return diffU;
      return Math.min(Math.abs(diffL), Math.abs(diffU));
    }

    return Infinity;
  }, []);

  // Check if message was sent by current user and is within the 5-minute (300 seconds) window
  const isMessageEditable = useCallback((msg) => {
    if (!msg) return false;
    const msgSender = msg.senderEmail || msg.sender;
    if (!msgSender || !isCurrentUser(msgSender)) return false;
    const ageSeconds = getMessageAgeSeconds(msg, nowTime);
    return ageSeconds >= 0 && ageSeconds <= 300;
  }, [isCurrentUser, nowTime, getMessageAgeSeconds]);

  const handleInitiateEdit = useCallback((msg) => {
    setActiveMessageMenuId(null);
    if (!isMessageEditable(msg)) {
      toast.error("Messages can only be edited within 5 minutes of sending.");
      return;
    }
    setReplyingToMessage(null);
    setEditingMessage(msg);
    const text = cleanMessageBody(msg.body || "");
    setNewChatText(text);
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
        try {
          chatInputRef.current.setSelectionRange(text.length, text.length);
        } catch (e) {}
      }
    }, 50);
  }, [isMessageEditable, cleanMessageBody]);

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessage(null);
    setNewChatText("");
  }, []);

  const handleSaveEditMessage = useCallback(async () => {
    if (!editingMessage) return;

    const trimmedText = newChatText.trim();
    if (!trimmedText) {
      toast.error("Message content cannot be empty.");
      return;
    }

    // Server-enforced & client check: 5-minute limit calculated from original creation timestamp
    const ageSeconds = getMessageAgeSeconds(editingMessage, Date.now());
    if (ageSeconds > 300) {
      toast.error("Messages can only be edited within 5 minutes of sending.");
      setEditingMessage(null);
      setNewChatText("");
      return;
    }

    const currentCleanBody = cleanMessageBody(editingMessage.body || "");
    if (trimmedText === currentCleanBody) {
      setEditingMessage(null);
      setNewChatText("");
      return;
    }

    let finalBody = trimmedText;
    if (editingMessage && typeof editingMessage.body === 'string' && editingMessage.body.startsWith('[Replying to ')) {
      const closingIndex = editingMessage.body.indexOf(']\n');
      if (closingIndex !== -1) {
        finalBody = editingMessage.body.substring(0, closingIndex + 2) + trimmedText;
      }
    }

    const targetId = editingMessage.id !== undefined ? editingMessage.id : editingMessage.uid;

    try {
      setSavingEdit(true);
      const res = await casboxAPI.editMessage(targetId, finalBody);
      const updatedData = res?.data;
      const updatedBody = updatedData?.body || finalBody;

      // Update in threadMessages and messages preserving original ID, sender, receiver, timestamp
      setThreadMessages(prev => prev.map(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        if (mId === targetId || String(mId) === String(targetId) || (m.timestamp === editingMessage.timestamp && (m.senderEmail || m.sender) === (editingMessage.senderEmail || editingMessage.sender))) {
          return {
            ...m,
            ...(updatedData || {}),
            body: updatedBody,
            isEdited: true,
            edited: true
          };
        }
        return m;
      }));

      setMessages(prev => prev.map(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        if (mId === targetId || String(mId) === String(targetId) || (m.timestamp === editingMessage.timestamp && (m.senderEmail || m.sender) === (editingMessage.senderEmail || editingMessage.sender))) {
          return {
            ...m,
            ...(updatedData || {}),
            body: updatedBody,
            isEdited: true,
            edited: true
          };
        }
        return m;
      }));

      // Update pinned messages if this was pinned
      setPinnedMessagesMap(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(k => {
          if (next[k]?.id === targetId || String(next[k]?.id) === String(targetId)) {
            next[k] = { ...next[k], body: updatedBody, isEdited: true, edited: true };
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('bnx_casbox_pinned_messages', JSON.stringify(next));
        }
        return next;
      });

      setEditingMessage(null);
      setNewChatText("");
      toast.success("Message edited");
    } catch (err) {
      console.error("Failed to edit message", err);
      const errMsg = err?.response?.data?.message || err?.message || "Failed to edit message";
      toast.error(errMsg);
    } finally {
      setSavingEdit(false);
    }
  }, [editingMessage, newChatText, cleanMessageBody, getMessageAgeSeconds]);

  const renderReplyPreviewInBubble = useCallback((msg, isMe) => {
    if (!msg || typeof msg.body !== 'string') return null;
    const parsed = parseReplyHeader(msg.body);
    if (!parsed) return null;
    const { quotedSender, originalMsgId, quotedSnippet } = parsed;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleNavigateToOriginalMessage(originalMsgId, quotedSnippet, quotedSender);
        }}
        className={`mb-1.5 p-2 rounded-xl text-[11px] border-l-4 select-none cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all ${
          isMe
            ? 'bg-black/15 text-white border-white/70 hover:bg-black/25'
            : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-200 border-blue-500 dark:border-blue-400 hover:bg-black/10 dark:hover:bg-white/10'
        }`}
        title="Click to jump to original message"
      >
        <div className="line-clamp-2 leading-relaxed opacity-90 text-[11px] break-words">
          {quotedSnippet}
        </div>
      </div>
    );
  }, [parseReplyHeader, handleNavigateToOriginalMessage]);

  const renderForwardPreviewInBubble = useCallback((msg, isMe) => {
    if (!msg || typeof msg.body !== 'string' || !msg.body) return null;
    let body = msg.body;

    // If this is a reply containing a forwarded message, strip the reply header first
    if (body.startsWith('[Replying to ')) {
      const replyEnd = body.indexOf(']\n');
      if (replyEnd !== -1) {
        body = body.substring(replyEnd + 2);
      }
    }

    if (typeof body !== 'string' || !body.startsWith('[Forwarded')) {
      return null;
    }

    return (
      <div className={`flex items-center gap-1 text-[11px] select-none mb-1 font-medium ${
        isMe ? 'text-white/85' : 'text-gray-500 dark:text-gray-400'
      }`}>
        <MdForward size={13} className="shrink-0" />
        <span className="italic">Forwarded</span>
      </div>
    );
  }, []);

  // Emoji Reaction Toggle Handler: Enforces strictly ONE reaction per user per message
  const handleToggleReaction = useCallback((msgId, emoji) => {
    if (!msgId || !emoji) return;
    const currentUserId = (user?.email || user?.username || 'me').trim();

    setReactionsMap(prev => {
      const msgReactions = prev[msgId] || {};

      // Check if user has already reacted with the EXACT same emoji
      const existingSameEmojiReactors = Array.isArray(msgReactions[emoji]) ? msgReactions[emoji] : [];
      const hasReactedWithSameEmoji = existingSameEmojiReactors.some(u => typeof u === 'string' && u.trim() === currentUserId);

      // Create a clean copy of reactions for this message,
      // stripping current user from ALL emojis on this message
      const nextMsgReactions = {};

      Object.entries(msgReactions).forEach(([em, reactors]) => {
        const filteredReactors = (Array.isArray(reactors) ? reactors : [])
          .filter(u => typeof u === 'string' && u.trim() && u.trim() !== currentUserId);
        const uniqueReactors = Array.from(new Set(filteredReactors));
        if (uniqueReactors.length > 0) {
          nextMsgReactions[em] = uniqueReactors;
        }
      });

      if (!hasReactedWithSameEmoji) {
        // User is selecting a new or different emoji -> add user reaction
        const currentReactors = nextMsgReactions[emoji] || [];
        nextMsgReactions[emoji] = Array.from(new Set([...currentReactors, currentUserId]));
      }
      // If hasReactedWithSameEmoji was true, the user is removed completely (toggle off)

      const nextMap = { ...prev };
      if (Object.keys(nextMsgReactions).length === 0) {
        delete nextMap[msgId];
      } else {
        nextMap[msgId] = nextMsgReactions;
      }

      try {
        localStorage.setItem('bnx_casbox_reactions', JSON.stringify(nextMap));
      } catch (e) {}

      try {
        window.dispatchEvent(new CustomEvent('bnx_casbox_reactions_updated', { detail: nextMap }));
      } catch (e) {}

      return nextMap;
    });

    setActiveReactionMsgId(null);
    setShowFullEmojiPicker(false);
  }, [user?.email, user?.username]);

  const handleOpenEditNameModal = (chatOrMsg, e) => {
    if (e) e.stopPropagation();
    setOpenMenuId(null);
    setShowMoreMenu(false);

    const contactEmail = getOtherUserEmail(chatOrMsg);
    const msg = chatOrMsg.latestMessage || (chatOrMsg.body !== undefined ? chatOrMsg : null);
    const originalName = getOriginalName(contactEmail, msg);
    const currentName = getDisplayName(contactEmail, msg);
    const hasCustomAlias = contactAliases[contactEmail.toLowerCase()] || 
                           contactAliases[contactEmail.split('@')[0].toLowerCase()] || 
                           (msg?.customName && msg.customName.trim());

    setEditingContact({
      contact: contactEmail,
      contactUserId: msg?.contactUserId,
      originalName: originalName,
      currentName: currentName,
      hasCustomAlias: Boolean(hasCustomAlias),
      msg: msg
    });
    setCustomNameInput(hasCustomAlias ? (currentName || "").slice(0, 20) : "");
    setShowEditNameModal(true);
  };

  const handleSaveContactName = async (e) => {
    if (e) e.preventDefault();
    if (!editingContact) return;

    const contactTarget = editingContact.contact;
    const trimmedInput = customNameInput.trim().slice(0, 20);
    const contactIdOrIdentifier = editingContact.contactUserId || contactTarget;

    if (customNameInput.length > 20 || trimmedInput.length > 20) {
      toast.error("Contact name must be 20 characters or fewer");
      return;
    }

    try {
      setIsSavingAlias(true);

      if (!trimmedInput) {
        // Deleting / resetting custom alias to restore original username
        await contactAliasAPI.deleteAlias(contactIdOrIdentifier);

        // Update local contactAliases state
        setContactAliases(prev => {
          const updated = { ...prev };
          delete updated[contactTarget.toLowerCase()];
          delete updated[contactTarget.split('@')[0].toLowerCase()];
          if (editingContact.contactUserId) {
            delete updated[String(editingContact.contactUserId)];
          }
          return updated;
        });

        // Update messages in state
        setMessages(prev => prev.map(m => {
          const other = getOtherUserEmail(m);
          if (other && other.toLowerCase() === contactTarget.toLowerCase()) {
            return {
              ...m,
              customName: null,
              contactDisplayName: m.contactUsername || contactTarget.split('@')[0]
            };
          }
          return m;
        }));

        // Update threadMessages
        setThreadMessages(prev => prev.map(m => {
          const other = getOtherUserEmail(m);
          if (other && other.toLowerCase() === contactTarget.toLowerCase()) {
            return {
              ...m,
              customName: null,
              contactDisplayName: m.contactUsername || contactTarget.split('@')[0]
            };
          }
          return m;
        }));

        toast.success(`Contact name reset to ${editingContact.originalName}`);
      } else {
        // Setting / updating custom alias
        const res = await contactAliasAPI.setAlias(contactIdOrIdentifier, trimmedInput);
        const savedName = res.data?.customName || trimmedInput;

        // Update local contactAliases state
        setContactAliases(prev => ({
          ...prev,
          [contactTarget.toLowerCase()]: savedName,
          [contactTarget.split('@')[0].toLowerCase()]: savedName,
          ...(editingContact.contactUserId ? { [String(editingContact.contactUserId)]: savedName } : {})
        }));

        // Update messages in state
        setMessages(prev => prev.map(m => {
          const other = getOtherUserEmail(m);
          if (other && other.toLowerCase() === contactTarget.toLowerCase()) {
            return {
              ...m,
              customName: savedName,
              contactDisplayName: savedName
            };
          }
          return m;
        }));

        // Update threadMessages
        setThreadMessages(prev => prev.map(m => {
          const other = getOtherUserEmail(m);
          if (other && other.toLowerCase() === contactTarget.toLowerCase()) {
            return {
              ...m,
              customName: savedName,
              contactDisplayName: savedName
            };
          }
          return m;
        }));

        toast.success("Contact name updated");
      }

      setShowEditNameModal(false);
      setEditingContact(null);
      setCustomNameInput("");
    } catch (err) {
      console.error("Failed to save contact name", err);
      toast.error(err.response?.data?.message || "Failed to update contact name");
    } finally {
      setIsSavingAlias(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (listMenuRef.current && !listMenuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };
    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const chatEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);
  const isNearBottomRef = React.useRef(true);
  const initialScrollDoneRef = React.useRef(false);
  const prevSelectedContactRef = React.useRef(null);
  const prevThreadCountRef = React.useRef(0);
  const selectedContactRef = React.useRef(null);

  const handleChatScroll = useCallback((e) => {
    const container = e?.currentTarget || chatContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider user near bottom if within 120px from the bottom
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight <= 120;
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await userAPI.getSettings();
        const s = (res.data && res.data.data) ? res.data.data : (res.data || {});
        const accepted = s.casboxAccepted || [];
        if (Array.isArray(accepted)) {
          setAcceptedContacts(accepted);
          try {
            sessionStorage.setItem('bnx_casbox_accepted', JSON.stringify(accepted));
          } catch (e) {}
        }
      } catch (e) {
        console.error("Failed to load casbox settings", e);
      }
    };
    fetchSettings();
  }, []);

  const inFlightSeenIdsRef = React.useRef(new Set());

  const markMessagesAsSeen = useCallback((ids) => {
    if (!ids || ids.length === 0) return;

    const candidateIds = [];
    const idSetToUpdate = new Set();

    ids.forEach(rawId => {
      if (rawId === null || rawId === undefined || rawId === '') return;
      const strId = String(rawId);
      if (inFlightSeenIdsRef.current.has(strId)) return;

      const msg = messagesRef.current.find(m => String(m.id) === strId || (m.uid && String(m.uid) === strId));
      if (msg) {
        // Exclude messages sent by current user
        if (isCurrentUser(msg.senderEmail || msg.sender)) return;
        // Must be addressed to current user
        if (!isCurrentUser(msg.receiverEmail || msg.receiver)) return;
        const status = String(msg.status || '').trim().toUpperCase();
        const isRead = status === 'SEEN' || status === 'READ' || msg.isRead === true || msg.read === true;
        if (isRead && (readMessageIdsRef.current.has(rawId) || readMessageIdsRef.current.has(strId))) {
          return;
        }
      }

      candidateIds.push(rawId);
      idSetToUpdate.add(strId);
    });

    if (candidateIds.length === 0) return;

    // Track IDs in flight to avoid duplicate concurrent calls
    candidateIds.forEach(id => inFlightSeenIdsRef.current.add(String(id)));

    // Track in readMessageIds state & storage so unread counter updates immediately
    setReadMessageIds(prev => {
      const next = new Set(prev);
      candidateIds.forEach(id => {
        next.add(id);
        next.add(String(id));
      });
      try {
        sessionStorage.setItem('bnx_casbox_read_message_ids', JSON.stringify(Array.from(next)));
        localStorage.setItem('bnx_casbox_read_message_ids', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });

    // Optimistically update message status in local state (including isRead: true)
    setMessages(prev => prev.map(m => {
      const match = idSetToUpdate.has(String(m.id)) || (m.uid && idSetToUpdate.has(String(m.uid)));
      return match ? { ...m, status: 'SEEN', isRead: true, read: true } : m;
    }));
    setThreadMessages(prev => prev.map(m => {
      const match = idSetToUpdate.has(String(m.id)) || (m.uid && idSetToUpdate.has(String(m.uid)));
      return match ? { ...m, status: 'SEEN', isRead: true, read: true } : m;
    }));
    setSelectedSentDetail(prev => {
      if (!prev) return prev;
      const match = idSetToUpdate.has(String(prev.id)) || (prev.uid && idSetToUpdate.has(String(prev.uid)));
      return match ? { ...prev, status: 'SEEN', isRead: true, read: true } : prev;
    });

    // Call existing message status API with numeric IDs
    const numIds = candidateIds.map(id => Number(id)).filter(n => !isNaN(n) && n > 0);
    if (numIds.length > 0) {
      casboxAPI.updateStatus({ messageIds: numIds, status: 'SEEN' })
        .catch(err => {
          console.error("Failed to update message status to SEEN:", err);
        })
        .finally(() => {
          candidateIds.forEach(id => inFlightSeenIdsRef.current.delete(String(id)));
        });
    } else {
      candidateIds.forEach(id => inFlightSeenIdsRef.current.delete(String(id)));
    }
  }, [isCurrentUser]);

  const handleSelectMessage = (msg) => {
    setOpenMenuId(null);
    setSelectedSentDetail(null);
    setSelectedMessage(msg || null);
    const targetId = msg?.id !== undefined && msg?.id !== null ? msg.id : msg?.uid;
    if (msg && !isCurrentUser(msg.senderEmail || msg.sender) && targetId) {
      markMessagesAsSeen([targetId]);
    }
  };

  const handleOpenMessageDetail = useCallback((item) => {
    if (!item?.msg) return;
    const { msg, isSent, contact } = item;
    setOpenMenuId(null);
    setSelectedMessage(null);
    const targetId = msg?.id !== undefined && msg?.id !== null ? msg.id : msg?.uid;
    if (!isSent && targetId) {
      markMessagesAsSeen([targetId]);
    }
    setSelectedSentDetail({
      ...msg,
      isSent,
      contactRecipient: contact,
      direction: isSent ? 'SENT' : 'RECEIVED'
    });
  }, [markMessagesAsSeen]);

  const handleArchivedMessageClick = useCallback((msg, chat) => {
    if (!msg) return;
    setOpenMenuId(null);
    setSelectedMessage(null); // Ensure no full chat or conversation thread is loaded

    const isSent = Boolean(
      msg.direction === 'SENT' ||
      msg.isSent === true ||
      isCurrentUser(msg.senderEmail || msg.sender)
    );

    const contact = isSent
      ? (msg.receiverEmail || msg.receiver || chat?.contact || '')
      : (msg.senderEmail || msg.sender || chat?.contact || '');

    const targetId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
    if (!isSent && targetId) {
      markMessagesAsSeen([targetId]);
    }

    setSelectedSentDetail({
      ...msg,
      isSent,
      contactRecipient: contact,
      direction: isSent ? 'SENT' : 'RECEIVED'
    });
  }, [isCurrentUser, markMessagesAsSeen]);

  useEffect(() => {
    if (location.state?.preselectContact && messages.length > 0) {
      const contactEmail = location.state.preselectContact;
      const matchingMsg = messages.find(m => m.senderEmail === contactEmail || m.receiverEmail === contactEmail);
      if (matchingMsg) {
        handleSelectMessage(matchingMsg);
      } else {
        // Create a dummy message structure to open the thread
        handleSelectMessage({
          senderEmail: user?.email,
          receiverEmail: contactEmail,
          subject: "Casbox Message",
          body: "",
          id: -1
        });
      }
      // Clear location state after processing
      window.history.replaceState({}, document.title);
    }
  }, [location.state, messages, user?.email]);

  // Synchronous derivation of accepted contacts from settings and connections
  const acceptedSet = useMemo(() => {
    const set = new Set();

    if (acceptedContacts && Array.isArray(acceptedContacts)) {
      acceptedContacts.forEach(e => {
        const norm = normalizeEmail(e);
        if (norm) {
          set.add(norm);
          if (norm.includes('@')) set.add(norm.split('@')[0]);
        }
      });
    }

    if (connections && Array.isArray(connections)) {
      connections.forEach(conn => {
        const status = String(conn?.status || '').trim().toUpperCase();
        if (status !== 'DISCONNECTED') {
          const email = normalizeEmail(conn?.contactEmail || conn?.email);
          if (email) {
            set.add(email);
            if (email.includes('@')) set.add(email.split('@')[0]);
          }
          const username = normalizeEmail(conn?.contactUsername || conn?.username);
          if (username) {
            set.add(username);
            if (username.includes('@')) set.add(username.split('@')[0]);
          }
        }
      });
    }

    return set;
  }, [acceptedContacts, connections]);

  useEffect(() => {
    acceptedSetRef.current = acceptedSet;
  }, [acceptedSet]);

  const currentMsgIdRef = useRef(selectedMessage?.id !== undefined ? selectedMessage.id : selectedMessage?.uid);
  React.useEffect(() => {
    const nextId = selectedMessage?.id !== undefined ? selectedMessage.id : selectedMessage?.uid;
    if (nextId && currentMsgIdRef.current && String(currentMsgIdRef.current) !== String(nextId)) {
      setPreviewFile((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    }
    currentMsgIdRef.current = nextId;
  }, [selectedMessage?.id, selectedMessage?.uid]);

  React.useEffect(() => {
    return () => {
      setPreviewFile((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    };
  }, []);

  const fetchThread = async (contactEmail) => {
    try {
      setLoadingThread(true);
      const res = await casboxAPI.getThread(contactEmail);
      const data = res.data || [];
      const filtered = data.filter(m => {
        const id = m.id !== undefined ? m.id : m.uid;
        const strId = id !== undefined && id !== null ? String(id) : null;
        const fallbackId = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        return !(
          deletedMessageIdsRef.current.has(id) ||
          (strId && deletedMessageIdsRef.current.has(strId)) ||
          deletedMessageIdsRef.current.has(fallbackId)
        ) && !isMsgArchived(m);
      });
      setThreadMessages(filtered);

      // Only mark received messages as SEEN when user is actively viewing this contact's conversation
      if (selectedContactRef.current && normalizeEmail(selectedContactRef.current) === normalizeEmail(contactEmail)) {
        const unreadIncomingIds = data
          .filter(m => {
            if (!m) return false;
            if (isCurrentUser(m.senderEmail || m.sender)) return false;
            const rec = m.receiverEmail || m.receiver;
            if (rec && !isCurrentUser(rec)) return false;
            const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
            if (id !== undefined && id !== null && (readMessageIdsRef.current.has(id) || readMessageIdsRef.current.has(String(id)))) {
              return false;
            }
            if (m.isRead === true || m.read === true) return false;
            const st = String(m.status || '').trim().toUpperCase();
            return st !== 'SEEN' && st !== 'READ';
          })
          .map(m => m.id !== undefined && m.id !== null ? m.id : m.uid)
          .filter(Boolean);
        if (unreadIncomingIds.length > 0) {
          markMessagesAsSeen(unreadIncomingIds);
        }
      }
    } catch (e) {
      console.error("Failed to fetch thread", e);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (selectedMessage) {
      const otherEmail = getOtherUserEmail(selectedMessage);
      selectedContactRef.current = otherEmail;

      const contactKey = normalizeEmail(otherEmail);
      if (contactKey !== prevSelectedContactRef.current) {
        prevSelectedContactRef.current = contactKey;
        initialScrollDoneRef.current = false;
        isNearBottomRef.current = true;
        prevThreadCountRef.current = 0;
      }

      fetchThread(otherEmail);
      setIsChatStarred(Boolean(selectedMessage.starred || selectedMessage.isStarred));
    } else {
      selectedContactRef.current = null;
      prevSelectedContactRef.current = null;
      initialScrollDoneRef.current = false;
      isNearBottomRef.current = true;
      prevThreadCountRef.current = 0;
      setThreadMessages([]);
      setIsChatStarred(false);
    }
  }, [selectedMessage, user?.email]);

  const handleArchiveChat = async () => {
    if (!selectedMessage) return;
    const isCurrentlyArchived = Boolean(selectedMessage.isArchived || selectedMessage.archived);
    const otherEmail = getOtherUserEmail(selectedMessage);

    const matchingMsgIds = messages
      .filter(m => (m.senderEmail === otherEmail || m.receiverEmail === otherEmail) && (isCurrentlyArchived ? Boolean(m.isArchived || m.archived) : !Boolean(m.isArchived || m.archived)))
      .map(m => m.id);

    const targetIds = matchingMsgIds.length > 0 ? matchingMsgIds : [selectedMessage.id];
    const newArchived = !isCurrentlyArchived;

    try {
      setMessages(prev => prev.map(m => targetIds.includes(m.id) ? { ...m, isArchived: newArchived, archived: newArchived } : m));
      setSelectedMessage(null);
      await casboxAPI.updateArchiveStatus(targetIds, newArchived);
      if (newArchived) {
        toast.success("Message archived");
      } else {
        const isSent = isCurrentUser(selectedMessage?.senderEmail || selectedMessage?.sender);
        toast.success(`Message moved back to ${isSent ? "Sent" : "Received"}`);
      }
    } catch (err) {
      console.error("Failed to update archive status", err);
      toast.error("Failed to update archive status");
      fetchMessages(true);
    }
  };

  const handleArchiveMessage = async (messageOrId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setOpenMenuId(null);
    setOpenCombineMenuId(null);
    setActiveMessageMenuId(null);

    const messageId = (messageOrId && typeof messageOrId === 'object')
      ? (messageOrId.id !== undefined ? messageOrId.id : messageOrId.uid)
      : messageOrId;
    if (messageId === undefined || messageId === null) return;

    const strId = String(messageId);
    const numericId = Number(messageId);
    const apiTargetIds = !isNaN(numericId) ? [numericId] : [messageId];

    try {
      setMessages(prev => prev.map(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        return (mId === messageId || String(mId) === strId)
          ? { ...m, isArchived: true, archived: true }
          : m;
      }));

      setArchivedMessageIds(prev => {
        const next = new Set(prev);
        next.add(messageId);
        next.add(strId);
        saveArchivedMessageIds(next);
        return next;
      });

      setUnarchivedMessageIds(prev => {
        if (!prev.has(messageId) && !prev.has(strId)) return prev;
        const next = new Set(prev);
        next.delete(messageId);
        next.delete(strId);
        saveUnarchivedMessageIds(next);
        return next;
      });

      setThreadMessages(prev => prev.filter(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        return !(mId === messageId || String(mId) === strId);
      }));

      if (selectedSentDetail) {
        const sId = selectedSentDetail.id !== undefined ? selectedSentDetail.id : selectedSentDetail.uid;
        if (sId === messageId || String(sId) === strId) {
          setSelectedSentDetail(null);
        }
      }
      if (selectedMessage) {
        const sId = selectedMessage.id !== undefined ? selectedMessage.id : selectedMessage.uid;
        if (sId === messageId || String(sId) === strId) {
          // If this was the selected message reference, update it to another message if thread still has messages
          setThreadMessages(prev => {
            const remaining = prev.filter(m => {
              const mId = m.id !== undefined ? m.id : m.uid;
              return !(mId === messageId || String(mId) === strId);
            });
            if (remaining.length === 0) {
              setSelectedMessage(null);
            }
            return remaining;
          });
        }
      }

      setSelectedRowIds(prev => {
        if (!prev.has(messageId) && !prev.has(strId)) return prev;
        const next = new Set(prev);
        next.delete(messageId);
        next.delete(strId);
        return next;
      });

      await casboxAPI.updateArchiveStatus(apiTargetIds, true);
      toast.success("Message archived");
    } catch (err) {
      console.error("Failed to archive message", err);
      toast.error("Failed to archive message");
      fetchMessages(true);
    }
  };

  const handleArchiveSelectedMessages = async () => {
    if (selectedRowIds.size === 0) return;
    const targetIds = Array.from(selectedRowIds);
    const targetSet = new Set(targetIds.map(String));

    const apiTargetIds = targetIds.map(id => {
      const num = Number(id);
      return !isNaN(num) ? num : id;
    });

    try {
      setMessages(prev => prev.map(m => {
        const mId = String(m.id !== undefined ? m.id : m.uid);
        return targetSet.has(mId) ? { ...m, isArchived: true, archived: true } : m;
      }));

      setArchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.add(id);
          next.add(String(id));
        });
        saveArchivedMessageIds(next);
        return next;
      });

      setUnarchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.delete(id);
          next.delete(String(id));
        });
        saveUnarchivedMessageIds(next);
        return next;
      });

      if (selectedSentDetail) {
        const detailId = String(selectedSentDetail.id !== undefined ? selectedSentDetail.id : selectedSentDetail.uid);
        if (targetSet.has(detailId)) {
          setSelectedSentDetail(null);
        }
      }
      if (selectedMessage) {
        const msgId = String(selectedMessage.id !== undefined ? selectedMessage.id : selectedMessage.uid);
        if (targetSet.has(msgId)) {
          setSelectedMessage(null);
        }
      }

      setSelectedRowIds(new Set());
      await casboxAPI.updateArchiveStatus(apiTargetIds, true);
      toast.success(`${targetIds.length > 1 ? `${targetIds.length} messages` : 'Message'} archived`);
    } catch (err) {
      console.error("Failed to archive selected messages", err);
      toast.error("Failed to archive messages");
      fetchMessages(true);
    }
  };

  const handleUnarchiveMessage = async (chatOrMsg, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setOpenMenuId(null);

    const isSingleMsg = chatOrMsg && (chatOrMsg.id !== undefined || chatOrMsg.uid !== undefined) && !Array.isArray(chatOrMsg.messages);
    const otherEmail = getOtherUserEmail(chatOrMsg);

    let targetIds = [];
    if (isSingleMsg) {
      const singleId = chatOrMsg.id !== undefined ? chatOrMsg.id : chatOrMsg.uid;
      if (singleId !== undefined && singleId !== null) {
        targetIds = [singleId];
      }
    } else {
      const matchingMsgIds = otherEmail 
        ? messages.filter(m => (m.senderEmail === otherEmail || m.receiverEmail === otherEmail) && Boolean(m.isArchived || m.archived)).map(m => m.id)
        : [];

      targetIds = matchingMsgIds.length > 0 
        ? matchingMsgIds 
        : (chatOrMsg?.messages ? chatOrMsg.messages.map(m => m.id) : [chatOrMsg?.id || chatOrMsg?.latestMessage?.id].filter(Boolean));
    }

    if (targetIds.length === 0) return;
    const targetSet = new Set(targetIds.map(String));
    const numericTargetIds = targetIds.map(Number).filter(n => !isNaN(n));
    const apiTargetIds = numericTargetIds.length === targetIds.length ? numericTargetIds : targetIds;

    try {
      setMessages(prev => prev.map(m => {
        const mId = String(m.id !== undefined ? m.id : m.uid);
        return targetSet.has(mId) ? { ...m, isArchived: false, archived: false } : m;
      }));

      setArchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.delete(id);
          next.delete(String(id));
        });
        saveArchivedMessageIds(next);
        return next;
      });

      setUnarchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.add(id);
          next.add(String(id));
        });
        saveUnarchivedMessageIds(next);
        return next;
      });

      if (selectedMessage) {
        const sId = String(selectedMessage.id !== undefined ? selectedMessage.id : selectedMessage.uid);
        if (targetSet.has(sId) || (!isSingleMsg && otherEmail && getOtherUserEmail(selectedMessage) === otherEmail)) {
          setSelectedMessage(null);
        }
      }
      if (selectedSentDetail) {
        const sId = String(selectedSentDetail.id !== undefined ? selectedSentDetail.id : selectedSentDetail.uid);
        if (targetSet.has(sId) || (!isSingleMsg && otherEmail && selectedSentDetail.contactRecipient === otherEmail)) {
          setSelectedSentDetail(null);
        }
      }

      await casboxAPI.updateArchiveStatus(apiTargetIds, false);
      toast.success("Moved back to Messages");
    } catch (err) {
      console.error("Failed to unarchive message", err);
      toast.error("Failed to unarchive message");
      fetchMessages(true);
    }
  };

  const handleUnarchiveSelectedMessages = async () => {
    if (selectedRowIds.size === 0) return;
    const targetIds = Array.from(selectedRowIds);
    const targetSet = new Set(targetIds.map(String));
    const numericTargetIds = targetIds.map(Number).filter(n => !isNaN(n));
    const apiTargetIds = numericTargetIds.length === targetIds.length ? numericTargetIds : targetIds;

    try {
      setMessages(prev => prev.map(m => {
        const mId = String(m.id !== undefined ? m.id : m.uid);
        return targetSet.has(mId) ? { ...m, isArchived: false, archived: false } : m;
      }));

      setArchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.delete(id);
          next.delete(String(id));
        });
        saveArchivedMessageIds(next);
        return next;
      });

      setUnarchivedMessageIds(prev => {
        const next = new Set(prev);
        targetIds.forEach(id => {
          next.add(id);
          next.add(String(id));
        });
        saveUnarchivedMessageIds(next);
        return next;
      });

      if (selectedSentDetail) {
        const sId = String(selectedSentDetail.id !== undefined ? selectedSentDetail.id : selectedSentDetail.uid);
        if (targetSet.has(sId)) {
          setSelectedSentDetail(null);
        }
      }
      if (selectedMessage) {
        const sId = String(selectedMessage.id !== undefined ? selectedMessage.id : selectedMessage.uid);
        if (targetSet.has(sId)) {
          setSelectedMessage(null);
        }
      }

      setSelectedRowIds(new Set());
      await casboxAPI.updateArchiveStatus(apiTargetIds, false);
      toast.success(`${targetIds.length > 1 ? `${targetIds.length} messages` : 'Message'} moved back to Messages`);
    } catch (err) {
      console.error("Failed to unarchive selected messages", err);
      toast.error("Failed to unarchive messages");
      fetchMessages(true);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;
    const targetContact = conversationToDelete.contact;
    if (!targetContact) return;

    try {
      setIsDeletingConversation(true);
      await casboxAPI.deleteConversation(targetContact);

      // Only remove the conversation from UI after backend confirms successful deletion
      const targetNorm = normalizeEmail(targetContact);
      const targetLocal = targetNorm.includes('@') ? targetNorm.split('@')[0] : targetNorm;
      setMessages(prev => prev.filter(m => {
        const otherNorm = normalizeEmail(getOtherUserEmail(m));
        const otherLocal = otherNorm.includes('@') ? otherNorm.split('@')[0] : otherNorm;
        return otherNorm !== targetNorm && otherLocal !== targetLocal;
      }));

      // Close thread if currently viewing this conversation
      if (selectedMessage) {
        const currentOtherNorm = normalizeEmail(getOtherUserEmail(selectedMessage));
        const currentOtherLocal = currentOtherNorm.includes('@') ? currentOtherNorm.split('@')[0] : currentOtherNorm;
        if (currentOtherNorm === targetNorm || currentOtherLocal === targetLocal) {
          setSelectedMessage(null);
        }
      }

      setOpenMenuId(null);
      setOpenCombineMenuId(null);
      setConversationToDelete(null);
      toast.success("Conversation deleted");
    } catch (err) {
      console.error("Failed to delete conversation", err);
      toast.error("Unable to delete conversation. Please try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleSnoozeChat = async (wakeUpDate) => {
    if (!selectedMessage) return;
    const targetId = selectedMessage.uid || selectedMessage.id;
    const otherEmail = getOtherUserEmail(selectedMessage);

    const wakeUpAt = wakeUpDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      if (mailAPI.snooze) {
        await mailAPI.snooze(targetId, wakeUpAt, 'casbox');
      } else if (handleSnooze) {
        await handleSnooze(targetId, wakeUpAt, 'casbox', true);
      }
      toast.success("Chat snoozed");
      setMessages(prev => prev.filter(m => getOtherUserEmail(m) !== otherEmail));
      setSelectedMessage(null);
      fetchMessages(true);
    } catch (err) {
      console.error("Failed to snooze chat", err);
      toast.error("Failed to snooze chat");
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedMessage) return;
    const targetId = selectedMessage.uid || selectedMessage.id;
    const otherEmail = getOtherUserEmail(selectedMessage);

    try {
      if (mailAPI.trash) {
        await mailAPI.trash(targetId, 'casbox');
      } else if (handleMoveToTrash) {
        await handleMoveToTrash(targetId, 'casbox', true);
      }
      toast.success("Chat deleted");
      setMessages(prev => prev.filter(m => getOtherUserEmail(m) !== otherEmail));
      setSelectedMessage(null);
      fetchMessages(true);
    } catch (err) {
      console.error("Failed to delete chat", err);
      toast.error("Failed to delete chat");
    }
  };

  const handleDeleteSelectedMessages = () => {
    if (selectedRowIds.size === 0) {
      setShowDeleteConfirmModal(false);
      return;
    }

    try {
      setIsDeletingSelected(true);
      const toDeleteSet = new Set(selectedRowIds);

      // Persist deleted message IDs
      setDeletedMessageIds(prev => {
        const updated = new Set(prev);
        toDeleteSet.forEach(id => {
          updated.add(id);
          updated.add(String(id));
        });
        try {
          const json = JSON.stringify(Array.from(updated));
          sessionStorage.setItem('bnx_casbox_deleted_message_ids', json);
          localStorage.setItem('bnx_casbox_deleted_message_ids', json);
        } catch (e) {}
        return updated;
      });

      // Filter out deleted messages ONLY from messages state
      setMessages(prev => prev.filter(m => {
        const id = m.id || m.uid || `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        return !toDeleteSet.has(id) && !toDeleteSet.has(String(id));
      }));

      // Also filter threadMessages if active
      setThreadMessages(prev => prev.filter(m => {
        const id = m.id || m.uid || `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        return !toDeleteSet.has(id) && !toDeleteSet.has(String(id));
      }));

      if (selectedSentDetail) {
        const detailId = selectedSentDetail.id || selectedSentDetail.uid || `${selectedSentDetail.timestamp}-${selectedSentDetail.senderEmail || selectedSentDetail.sender}-${selectedSentDetail.receiverEmail || selectedSentDetail.receiver}-${selectedSentDetail.body}`;
        if (toDeleteSet.has(detailId) || toDeleteSet.has(String(detailId))) {
          setSelectedSentDetail(null);
        }
      }

      setSelectedRowIds(new Set());
      setShowDeleteConfirmModal(false);
      toast.success(toDeleteSet.size === 1 ? "Message deleted" : `${toDeleteSet.size} messages deleted`);
    } catch (err) {
      console.error("Failed to delete selected messages", err);
      toast.error("Failed to delete selected messages");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleConfirmDeleteMessage = () => {
    if (!messageToDelete) return;

    try {
      setIsDeletingMessage(true);
      const targetId = messageToDelete.id !== undefined ? messageToDelete.id : messageToDelete.uid;
      const strId = targetId !== undefined && targetId !== null ? String(targetId) : null;
      const fallbackId = `${messageToDelete.timestamp}-${messageToDelete.senderEmail || messageToDelete.sender}-${messageToDelete.receiverEmail || messageToDelete.receiver}-${messageToDelete.body}`;

      // Persist in deletedMessageIds
      setDeletedMessageIds(prev => {
        const updated = new Set(prev);
        if (targetId !== undefined && targetId !== null) {
          updated.add(targetId);
          updated.add(strId);
        }
        updated.add(fallbackId);
        try {
          const json = JSON.stringify(Array.from(updated));
          sessionStorage.setItem('bnx_casbox_deleted_message_ids', json);
          localStorage.setItem('bnx_casbox_deleted_message_ids', json);
        } catch (e) {}
        return updated;
      });

      // Remove ONLY from messages
      setMessages(prev => prev.filter(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        if (targetId !== undefined && targetId !== null && (mId === targetId || String(mId) === strId)) return false;
        const mFallback = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        return mFallback !== fallbackId;
      }));

      // Also filter from threadMessages if active
      setThreadMessages(prev => prev.filter(m => {
        const mId = m.id !== undefined ? m.id : m.uid;
        if (targetId !== undefined && targetId !== null && (mId === targetId || String(mId) === strId)) {
          return false;
        }
        const mFallback = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        return mFallback !== fallbackId;
      }));

      // If this message was open in selectedSentDetail, clear it
      if (selectedSentDetail) {
        const sId = selectedSentDetail.id !== undefined ? selectedSentDetail.id : selectedSentDetail.uid;
        const sFallback = `${selectedSentDetail.timestamp}-${selectedSentDetail.senderEmail || selectedSentDetail.sender}-${selectedSentDetail.receiverEmail || selectedSentDetail.receiver}-${selectedSentDetail.body}`;
        if ((targetId !== undefined && targetId !== null && (sId === targetId || String(sId) === strId)) || sFallback === fallbackId) {
          setSelectedSentDetail(null);
        }
      }

      // If this message was open in selectedMessage, clear it
      if (selectedMessage) {
        const sId = selectedMessage.id !== undefined ? selectedMessage.id : selectedMessage.uid;
        const sFallback = `${selectedMessage.timestamp}-${selectedMessage.senderEmail || selectedMessage.sender}-${selectedMessage.receiverEmail || selectedMessage.receiver}-${selectedMessage.body}`;
        if ((targetId !== undefined && targetId !== null && (sId === targetId || String(sId) === strId)) || sFallback === fallbackId) {
          setSelectedMessage(null);
        }
      }

      // Remove from selectedRowIds if checked
      setSelectedRowIds(prev => {
        if (targetId !== undefined && targetId !== null && (prev.has(targetId) || prev.has(strId))) {
          const next = new Set(prev);
          next.delete(targetId);
          next.delete(strId);
          return next;
        }
        return prev;
      });

      setMessageToDelete(null);
      setOpenMenuId(null);
      setOpenCombineMenuId(null);
      toast.success("Message deleted");
    } catch (err) {
      console.error("Failed to delete message", err);
      toast.error("Failed to delete message");
    } finally {
      setIsDeletingMessage(false);
    }
  };

  const handleToggleStarChat = async () => {
    if (!selectedMessage) return;
    const targetId = selectedMessage.uid || selectedMessage.id;
    const newStarred = !isChatStarred;

    try {
      if (mailAPI.toggleStar) {
        await mailAPI.toggleStar(targetId, 'casbox');
      } else if (handleToggleStar) {
        await handleToggleStar(targetId, 'casbox');
      }
      setIsChatStarred(newStarred);
      setSelectedMessage(prev => prev ? { ...prev, starred: newStarred, isStarred: newStarred } : null);
      setMessages(prev => prev.map(m => (m.id === targetId || m.uid === targetId) ? { ...m, starred: newStarred, isStarred: newStarred } : m));
    } catch (err) {
      console.error("Failed to toggle star chat", err);
      toast.error("Failed to update star");
    }
  };

  useEffect(() => {
    if (!selectedMessage) return;

    const container = chatContainerRef.current || chatEndRef.current?.parentElement;
    if (!container) return;

    // Case 1: First time loading messages for this conversation (open chat)
    if (!initialScrollDoneRef.current && threadMessages.length > 0) {
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
          isNearBottomRef.current = true;
          initialScrollDoneRef.current = true;
        }
      });
      prevThreadCountRef.current = threadMessages.length;
      return;
    }

    // Case 2: User is viewing older messages (scrolled up)
    // Keep current scroll position unchanged when existing messages refresh, polling occurs, or new messages arrive
    if (!isNearBottomRef.current) {
      prevThreadCountRef.current = threadMessages.length;
      return;
    }

    // Case 3: User is already near bottom
    // If a new message arrived or updates happened while near bottom, maintain view at the bottom
    requestAnimationFrame(() => {
      if (container && isNearBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    prevThreadCountRef.current = threadMessages.length;
  }, [threadMessages, selectedMessage, loadingThread]);

  const handleCombineRowClick = (item) => {
    if (!item?.msg) return;
    const { msg, isSent } = item;
    const targetId = msg?.id !== undefined && msg?.id !== null ? msg.id : msg?.uid;
    if (!isSent && targetId) {
      markMessagesAsSeen([targetId]);
    }
    handleSelectMessage(msg);
  };


  const closePreview = () => {
    setPreviewFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const handleDownloadAttachment = async (fileObj) => {
    try {
      const fileName = fileObj.fileName || fileObj.name || (typeof fileObj === 'string' ? fileObj.split('/').pop() : "Attachment");
      const urlPath = fileObj.url || fileObj.filePath || (typeof fileObj === 'string' ? fileObj : "");
      if (!urlPath) return;

      toast.loading(`Downloading ${fileName}...`, { id: "download-casbox-attachment" });
      const res = await api.get(urlPath, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${fileName} downloaded successfully`, { id: "download-casbox-attachment" });
    } catch (err) {
      console.error("Failed to download attachment:", err);
      toast.error("Failed to download attachment", { id: "download-casbox-attachment" });
    }
  };

  const handlePreviewAttachment = async (fileObj) => {
    try {
      const fileName = fileObj.fileName || fileObj.name || (typeof fileObj === 'string' ? fileObj.split('/').pop() : "Attachment");
      const urlPath = fileObj.url || fileObj.filePath || (typeof fileObj === 'string' ? fileObj : "");
      if (!urlPath) return;

      toast.loading(`Loading preview...`, { id: "preview-casbox-attachment" });
      const res = await api.get(urlPath, { responseType: 'blob' });
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
        textContent,
        rawFileObj: fileObj
      });
      toast.success("Loaded preview", { id: "preview-casbox-attachment" });
    } catch (err) {
      console.error("Failed to preview attachment:", err);
      toast.error("Failed to preview attachment", { id: "preview-casbox-attachment" });
    }
  };

  const isMessageUnread = useCallback((m) => {
    if (!m) return false;

    // Exclude messages sent by the logged-in user
    const sender = m.senderEmail || m.sender;
    if (isCurrentUser(sender)) return false;

    // Exclude messages not addressed to current user (if receiver is specified)
    const rec = m.receiverEmail || m.receiver;
    if (rec && !isCurrentUser(rec)) return false;

    // Exclude deleted messages and messages marked read locally in session/storage
    const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
    if (id !== undefined && id !== null) {
      if (deletedMessageIdsRef.current.has(id) || deletedMessageIdsRef.current.has(String(id))) {
        return false;
      }
      if (readMessageIdsRef.current.has(id) || readMessageIdsRef.current.has(String(id))) {
        return false;
      }
    }

    // Exclude messages with boolean read flags
    if (m.isRead === true || m.read === true || m.isRead === 'true' || m.read === 'true') {
      return false;
    }

    // Exclude messages marked SEEN or READ
    const status = String(m.status || '').trim().toUpperCase();
    if (status === 'SEEN' || status === 'READ') {
      return false;
    }

    return true;
  }, [isCurrentUser, readMessageIds, deletedMessageIds]);

  const { 
    conversationList, 
    messagesConversations, 
    requestsConversations, 
    archivedConversations, 
    unreadMessagesCount, 
    unreadArchivedCount, 
    unreadRequestsCount, 
    requestMessages 
  } = useMemo(() => {
    if (!messages || messages.length === 0) {
      return { 
        conversationList: [], 
        messagesConversations: [], 
        requestsConversations: [], 
        archivedConversations: [], 
        unreadMessagesCount: 0, 
        unreadArchivedCount: 0, 
        unreadRequestsCount: 0, 
        requestMessages: [] 
      };
    }

    // Disconnected contacts set
    const disconnectedSet = new Set();
    if (connections && Array.isArray(connections)) {
      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        if (String(c.status || '').trim().toUpperCase() === 'DISCONNECTED') {
          const email = normalizeEmail(c.contactEmail || c.email);
          if (email) {
            disconnectedSet.add(email);
            if (email.includes('@')) disconnectedSet.add(email.split('@')[0]);
          }
          const uname = normalizeEmail(c.contactUsername || c.username);
          if (uname) disconnectedSet.add(uname);
          if (c.contactUserId) disconnectedSet.add(String(c.contactUserId));
        }
      }
    }

    // Step 1: Group all messages by contact
    const conversationGroups = new Map();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;
      if (msgId !== undefined && msgId !== null) {
        if (deletedMessageIds.has(msgId) || deletedMessageIds.has(String(msgId))) {
          continue;
        }
      }

      const sender = normalizeEmail(msg.senderEmail || msg.sender);
      const receiver = normalizeEmail(msg.receiverEmail || msg.receiver);

      if (!sender || !receiver) continue;

      const rawContact = isCurrentUser(sender) ? (msg.receiverEmail || msg.receiver) : (msg.senderEmail || msg.sender);
      if (!rawContact) continue;
      const contactNorm = normalizeEmail(rawContact);
      const contactLocal = contactNorm.includes('@') ? contactNorm.split('@')[0] : contactNorm;

      if (disconnectedSet.has(contactNorm) || disconnectedSet.has(contactLocal)) continue;

      // Match existing group by either full normalized address or local part to prevent duplicates
      let grpKey = null;
      if (conversationGroups.has(contactNorm)) {
        grpKey = contactNorm;
      } else if (conversationGroups.has(contactLocal)) {
        grpKey = contactLocal;
      } else {
        for (const [k, g] of conversationGroups.entries()) {
          const gNorm = normalizeEmail(g.contact || k);
          const gLocal = gNorm.includes('@') ? gNorm.split('@')[0] : gNorm;
          if (gNorm === contactNorm || gLocal === contactLocal) {
            grpKey = k;
            break;
          }
        }
      }

      const ts = getTimestampMs(msg.timestamp);
      if (grpKey) {
        const grp = conversationGroups.get(grpKey);
        grp.messages.push(msg);
        if (ts > grp.latestTimestamp) {
          grp.latestTimestamp = ts;
          grp.latestMessage = msg;
        }
        if (contactNorm.includes('@') && !grp.contact.includes('@')) {
          grp.contact = rawContact;
          grp.contactNorm = contactNorm;
        }
      } else {
        const canonicalKey = contactNorm.includes('@') ? contactNorm : contactLocal;
        const newGrp = {
          contact: rawContact,
          contactNorm,
          contactLocal,
          messages: [msg],
          latestMessage: msg,
          latestTimestamp: ts,
        };
        conversationGroups.set(canonicalKey, newGrp);
      }
    }

    // Step 2: Classify conversations into Messages, Requests, Archive
    const messagesList = [];
    const requestsList = [];
    const archivedList = [];
    const requestMessagesArr = [];

    conversationGroups.forEach((grp) => {
      // Sort messages within conversation descending
      grp.messages.sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));

      const activeMsgs = grp.messages.filter(m => {
        const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
        if (id !== undefined && id !== null && (deletedMessageIds.has(id) || deletedMessageIds.has(String(id)))) {
          return false;
        }
        return !isMsgArchived(m);
      });
      const archivedMsgs = grp.messages.filter(m => {
        const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
        if (id !== undefined && id !== null && (deletedMessageIds.has(id) || deletedMessageIds.has(String(id)))) {
          return false;
        }
        return isMsgArchived(m);
      });

      if (archivedMsgs.length > 0) {
        const archGrp = {
          ...grp,
          messages: archivedMsgs,
          latestMessage: archivedMsgs[0],
          latestTimestamp: getTimestampMs(archivedMsgs[0].timestamp),
          unreadCount: archivedMsgs.filter(isMessageUnread).length,
          isArchived: true,
          archived: true,
        };
        archivedList.push(archGrp);
      }

      if (activeMsgs.length > 0) {
        const activeGrp = {
          ...grp,
          messages: activeMsgs,
          latestMessage: activeMsgs[0],
          latestTimestamp: getTimestampMs(activeMsgs[0].timestamp),
          unreadCount: activeMsgs.filter(isMessageUnread).length,
          isArchived: false,
          archived: false,
        };
        const classification = classifyCashboxConversation(activeGrp, user, acceptedSet);

        if (classification === 'REQUESTS') {
          requestsList.push(activeGrp);
          activeGrp.messages.forEach(m => requestMessagesArr.push(m));
        } else {
          messagesList.push(activeGrp);
        }
      }
    });

    messagesList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    requestsList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    archivedList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

    // Calculate unread counts ensuring unique messages (no double counting or conversation duplication)
    let mainUnread = 0;
    const countedMainMessageIds = new Set();
    messagesList.forEach(grp => {
      grp.messages.forEach(m => {
        const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
        const key = id !== undefined && id !== null ? String(id) : `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        if (!countedMainMessageIds.has(key)) {
          countedMainMessageIds.add(key);
          if (isMessageUnread(m)) {
            mainUnread++;
          }
        }
      });
    });

    let archUnread = 0;
    const countedArchMessageIds = new Set();
    archivedList.forEach(grp => {
      grp.messages.forEach(m => {
        const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
        const key = id !== undefined && id !== null ? String(id) : `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        if (!countedArchMessageIds.has(key)) {
          countedArchMessageIds.add(key);
          if (isMessageUnread(m)) {
            archUnread++;
          }
        }
      });
    });

    let reqUnread = 0;
    const countedReqMessageIds = new Set();
    requestsList.forEach(grp => {
      grp.messages.forEach(m => {
        const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
        const key = id !== undefined && id !== null ? String(id) : `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
        if (!countedReqMessageIds.has(key)) {
          countedReqMessageIds.add(key);
          if (isMessageUnread(m)) {
            reqUnread++;
          }
        }
      });
    });

    let activeList = messagesList;
    if (activeTab === 'requests') {
      activeList = requestsList;
    } else if (activeTab === 'archive') {
      activeList = archivedList;
    }

    return {
      conversationList: activeList,
      messagesConversations: messagesList,
      requestsConversations: requestsList,
      archivedConversations: archivedList,
      unreadMessagesCount: mainUnread,
      unreadArchivedCount: archUnread,
      unreadRequestsCount: reqUnread,
      requestMessages: requestMessagesArr
    };
  }, [messages, blockedContacts, acceptedContacts, connections, acceptedSet, activeTab, user, isMessageUnread, isCurrentUser, deletedMessageIds, readMessageIds, isMsgArchived]);

  // Combine tab unread count computed from messages
  const unreadCombinedCount = useMemo(() => {
    if (!messages || messages.length === 0) return 0;
    const seenIds = new Set();
    let count = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const id = m.id !== undefined && m.id !== null ? m.id : m.uid;
      const key = id !== undefined && id !== null ? String(id) : `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      if (id !== undefined && id !== null && (deletedMessageIds.has(id) || deletedMessageIds.has(String(id)))) {
        continue;
      }
      if (isMsgArchived(m)) {
        continue;
      }
      if (isMessageUnread(m)) {
        count++;
      }
    }
    return count;
  }, [messages, deletedMessageIds, isMessageUnread, readMessageIds, isMsgArchived]);

  // Contact-specific starred messages for the currently opened conversation
  const contactStarredMessages = useMemo(() => {
    if (!selectedMessage) return [];
    const activeContact = getOtherUserEmail(selectedMessage);
    if (!activeContact) return [];

    const list = [];
    const seenKeys = new Set();

    // 1. Thread messages for the active conversation
    (threadMessages || []).forEach(m => {
      if (isMessageStarred(m)) {
        const key = getMessageKey(m);
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push(m);
        }
      }
    });

    // 2. Messages from global state, strictly matching this active contact only
    (messages || []).forEach(m => {
      if (isMessageStarred(m)) {
        const mContact = getOtherUserEmail(m);
        const key = getMessageKey(m);
        const mapEntry = key ? starredMessagesMap[key] : null;

        const isMatch = (mContact && isSameContact(mContact, activeContact)) ||
                        (mapEntry && isSameContact(mapEntry.contact, activeContact));

        if (isMatch) {
          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            list.push(m);
          }
        }
      }
    });

    // Sort by timestamp descending (newest first)
    list.sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));
    return list;
  }, [threadMessages, messages, isMessageStarred, getMessageKey, starredMessagesMap, selectedMessage, getOtherUserEmail]);

  const allStarredMessages = contactStarredMessages;

  const handleOpenOriginalConversation = useCallback((starredMsg) => {
    if (!starredMsg) return;
    setShowStarredMessagesView(false);

    const otherEmail = getOtherUserEmail(starredMsg);
    const currentOther = selectedMessage ? getOtherUserEmail(selectedMessage) : null;

    if (currentOther && normalizeEmail(currentOther) === normalizeEmail(otherEmail)) {
      setTimeout(() => {
        handleScrollToMessage(starredMsg);
      }, 50);
    } else {
      const matchingConvo = messagesConversations.find(c => {
        const cEmail = normalizeEmail(c.contact);
        return cEmail === normalizeEmail(otherEmail);
      });
      if (matchingConvo && matchingConvo.latestMessage) {
        handleSelectMessage(matchingConvo.latestMessage);
      } else {
        handleSelectMessage(starredMsg);
      }
      setTimeout(() => {
        handleScrollToMessage(starredMsg);
      }, 350);
    }
  }, [selectedMessage, messagesConversations, handleSelectMessage, handleScrollToMessage, getOtherUserEmail]);

  // Individual messages list for the Messages tab (every message = one row, not grouped by person)
  const individualMessagesList = useMemo(() => {
    if (!messagesConversations || messagesConversations.length === 0) return [];
    const list = [];
    const seenIds = new Set();

    messagesConversations.forEach((grp) => {
      (grp.messages || []).forEach((msg) => {
        if (isMsgArchived(msg)) return;
        const id = msg.id || msg.uid || `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.receiverEmail || msg.receiver}-${msg.body}`;
        if (seenIds.has(id)) return;
        if (deletedMessageIds.has(id) || deletedMessageIds.has(String(id))) return;
        seenIds.add(id);

        const sender = normalizeEmail(msg.senderEmail || msg.sender);
        const isMe = isCurrentUser(sender);
        const otherEmail = isMe 
          ? (msg.receiverEmail || msg.receiver || grp.contact) 
          : (msg.senderEmail || msg.sender || grp.contact);

        list.push({
          msg,
          id,
          isSent: isMe,
          contact: otherEmail,
          timestampMs: getTimestampMs(msg.timestamp),
          chat: grp,
        });
      });
    });

    list.sort((a, b) => b.timestampMs - a.timestampMs);
    return list;
  }, [messagesConversations, isCurrentUser, deletedMessageIds, isMsgArchived]);

  const filteredIndividualMessages = useMemo(() => {
    if (!individualMessagesList || individualMessagesList.length === 0) return [];
    
    let list = individualMessagesList;

    // Apply messagesFilter
    if (messagesFilter && messagesFilter !== 'all') {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getTime();
      })();

      list = list.filter((item) => {
        if (messagesFilter === 'received') return !item.isSent;
        if (messagesFilter === 'sent') return item.isSent;
        if (messagesFilter === '1day') return item.timestampMs >= oneDayAgo;
        if (messagesFilter === '1week') return item.timestampMs >= oneWeekAgo;
        if (messagesFilter === '1month') return item.timestampMs >= oneMonthAgo;
        return true;
      });
    }

    if (!messagesSearch.trim()) return list;
    const q = messagesSearch.toLowerCase().trim();
    return list.filter((item) => {
      const msg = item.msg;
      const personEmail = item.contact;
      const personName = getDisplayName(personEmail, msg) || personEmail;
      const subject = typeof msg?.subject === 'string' ? msg.subject : '';
      const body = typeof msg?.body === 'string' ? msg.body : (typeof msg?.content === 'string' ? msg.content : '');

      return (
        personName.toLowerCase().includes(q) ||
        personEmail.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        body.toLowerCase().includes(q)
      );
    });
  }, [individualMessagesList, messagesFilter, messagesSearch, isCurrentUser, getDisplayName]);

  // Individual archived messages list for the Archive tab (every archived message = one row)
  const archivedIndividualMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    const list = [];
    const seenIds = new Set();

    messages.forEach((msg) => {
      const isArchived = isMsgArchived(msg);
      if (!isArchived) return;

      const id = msg.id || msg.uid || `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.receiverEmail || msg.receiver}-${msg.body}`;
      if (seenIds.has(id)) return;
      if (deletedMessageIds.has(id) || deletedMessageIds.has(String(id))) return;
      seenIds.add(id);

      const sender = normalizeEmail(msg.senderEmail || msg.sender);
      const isMe = Boolean(
        msg.direction === 'SENT' ||
        msg.isSent === true ||
        isCurrentUser(sender)
      );

      const otherEmail = isMe 
        ? (msg.receiverEmail || msg.receiver) 
        : (msg.senderEmail || msg.sender);

      const chat = archivedConversations?.find(c => 
        normalizeEmail(c.contact) === normalizeEmail(otherEmail)
      );

      list.push({
        msg,
        id,
        isSent: isMe,
        contact: otherEmail,
        timestampMs: getTimestampMs(msg.timestamp),
        chat,
      });
    });

    list.sort((a, b) => b.timestampMs - a.timestampMs);
    return list;
  }, [messages, archivedConversations, isCurrentUser, deletedMessageIds, isMsgArchived]);

  const filteredArchivedMessages = useMemo(() => {
    if (!archivedIndividualMessages || archivedIndividualMessages.length === 0) return [];
    
    let list = archivedIndividualMessages;

    // Apply messagesFilter
    if (messagesFilter && messagesFilter !== 'all') {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getTime();
      })();

      list = list.filter((item) => {
        if (messagesFilter === 'received') return !item.isSent;
        if (messagesFilter === 'sent') return item.isSent;
        if (messagesFilter === '1day') return item.timestampMs >= oneDayAgo;
        if (messagesFilter === '1week') return item.timestampMs >= oneWeekAgo;
        if (messagesFilter === '1month') return item.timestampMs >= oneMonthAgo;
        return true;
      });
    }

    if (!messagesSearch.trim()) return list;
    const q = messagesSearch.toLowerCase().trim();
    return list.filter((item) => {
      const msg = item.msg;
      const personEmail = item.contact || '';
      const personName = getDisplayName(personEmail, msg) || personEmail;
      const rawSubject = typeof msg?.subject === 'string' ? msg.subject : '';
      const cleanSubject = rawSubject.replace(/^\[(Combine|Combined|Messages)\]\s*/i, '');
      const body = typeof msg?.body === 'string' ? msg.body : (typeof msg?.content === 'string' ? msg.content : '');

      return (
        personName.toLowerCase().includes(q) ||
        personEmail.toLowerCase().includes(q) ||
        cleanSubject.toLowerCase().includes(q) ||
        body.toLowerCase().includes(q)
      );
    });
  }, [archivedIndividualMessages, messagesFilter, messagesSearch, getDisplayName]);

  const filteredConversationList = useMemo(() => {
    if (!conversationList || conversationList.length === 0) return [];

    let list = conversationList;

    if (messagesFilter && messagesFilter !== 'all') {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getTime();
      })();

      list = list.filter((chat) => {
        const msg = chat.latestMessage;
        const isSent = isCurrentUser(msg?.senderEmail || msg?.sender);
        const timeMs = getTimestampMs(msg?.timestamp);

        if (messagesFilter === 'received') return !isSent;
        if (messagesFilter === 'sent') return isSent;
        if (messagesFilter === '1day') return timeMs >= oneDayAgo;
        if (messagesFilter === '1week') return timeMs >= oneWeekAgo;
        if (messagesFilter === '1month') return timeMs >= oneMonthAgo;
        return true;
      });
    }

    if (!messagesSearch.trim()) return list;
    const q = messagesSearch.toLowerCase().trim();
    return list.filter((chat) => {
      const msg = chat.latestMessage;
      const isMe = isCurrentUser(msg?.senderEmail || msg?.sender);
      const personEmail = isMe 
        ? (msg?.receiverEmail || msg?.receiver || chat.contact)
        : (msg?.senderEmail || msg?.sender || chat.contact);
      const personName = getDisplayName(personEmail, msg) || personEmail;
      const subject = typeof msg?.subject === 'string' ? msg.subject : '';
      const body = typeof msg?.body === 'string' ? msg.body : (typeof msg?.content === 'string' ? msg.content : '');

      return (
        personName.toLowerCase().includes(q) ||
        personEmail.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        body.toLowerCase().includes(q)
      );
    });
  }, [conversationList, messagesFilter, messagesSearch, isCurrentUser, getDisplayName]);

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newChatText.trim()) return;

    const otherEmail = getOtherUserEmail(selectedMessage);
    if (!otherEmail) {
      toast.error("Could not determine contact to send message.");
      return;
    }

    if (
      isBlockedContact(otherEmail) ||
      (selectedMessage?.senderEmail && isBlockedContact(selectedMessage.senderEmail)) ||
      (selectedMessage?.receiverEmail && isBlockedContact(selectedMessage.receiverEmail))
    ) {
      toast.error("This user is blocked.");
      return;
    }

    if (isDisconnectedContact(otherEmail)) {
      toast.error("Cannot send message. This connection is disconnected.");
      return;
    }

    try {
      setSendingChat(true);
      let messageBody = newChatText.trim();
      if (replyingToMessage) {
        const quoteSnippet = (cleanMessageBody(replyingToMessage.body) || "").replace(/\n/g, ' ').slice(0, 100);
        const originalMsgId = getMessageKey(replyingToMessage) || (replyingToMessage.id !== undefined && replyingToMessage.id !== null ? String(replyingToMessage.id) : (replyingToMessage.uid || `${replyingToMessage.timestamp}-${replyingToMessage.senderEmail || replyingToMessage.sender}-${replyingToMessage.body}`));
        const sLabel = replyingToMessage.senderLabel || (isCurrentUser(replyingToMessage.senderEmail || replyingToMessage.sender) ? (user?.username || 'You') : getDisplayName(replyingToMessage.senderEmail || replyingToMessage.sender, replyingToMessage));
        messageBody = `[Replying to ${sLabel} id=${originalMsgId}: "${quoteSnippet}"]\n${messageBody}`;
      }

      const payload = {
        receiverEmail: otherEmail,
        subject: selectedMessage?.subject || "Casbox Message",
        body: messageBody,
        attachmentsJson: null
      };

      const res = await casboxAPI.sendMessage(payload);

      setNewChatText("");
      setReplyingToMessage(null);

      const newMsg = res.data;

      setThreadMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [newMsg, ...prev];
      });

    } catch (err) {
      console.error("Failed to send Casbox message", err);
      const rawMsg = err.response?.data?.message || err.response?.data?.error || "";
      const isBlockedError =
        isBlockedContact(otherEmail) ||
        (selectedMessage?.senderEmail && isBlockedContact(selectedMessage.senderEmail)) ||
        (selectedMessage?.receiverEmail && isBlockedContact(selectedMessage.receiverEmail)) ||
        rawMsg === "You cannot send messages to this user." ||
        rawMsg === "You cannot send messages to this user because you have blocked them." ||
        /cannot send messages to this user/i.test(rawMsg) ||
        /blocked/i.test(rawMsg);

      const errMsg = isBlockedError ? "This user is blocked." : (rawMsg || "Failed to send message.");
      toast.error(errMsg);
    } finally {
      setSendingChat(false);
    }
  };

  const displayedConnections = React.useMemo(() => {
    if (!showConnectionsModal) return [];
    const list = [...connections];

    if (messagesConversations && messagesConversations.length > 0) {
      const seen = new Set();
      list.forEach(c => {
        if (c.contactEmail) seen.add(normalizeEmail(c.contactEmail));
        if (c.contactUsername) seen.add(normalizeEmail(c.contactUsername));
      });

      messagesConversations.forEach(chat => {
        const contactEmail = chat.contact;
        if (!contactEmail || contactEmail === user?.email) return;
        const lower = normalizeEmail(contactEmail);
        const local = lower.includes('@') ? lower.split('@')[0] : lower;

        if (!seen.has(lower) && !seen.has(local)) {
          seen.add(lower);
          seen.add(local);
          const matchedConn = connections.find(c => {
            const cEmail = c.contactEmail?.toLowerCase();
            const cUser = c.contactUsername?.toLowerCase();
            return cEmail === lower || cEmail === local || cUser === lower || cUser === local;
          });

          list.push({
            id: contactEmail,
            contactEmail: contactEmail,
            contactUsername: getOriginalName(contactEmail, chat.latestMessage),
            contactDisplayName: getDisplayName(contactEmail, chat.latestMessage),
            status: 'CONNECTED',
            contactUserId: chat.latestMessage?.contactUserId,
            contactProfilePicture: matchedConn?.contactProfilePicture || chat.latestMessage?.contactProfilePicture || null,
            contactProfilePictureUrl: matchedConn?.contactProfilePictureUrl || chat.latestMessage?.contactProfilePictureUrl || null
          });
        }
      });
    }

    const blockedSet = new Set(blockedContacts.map(b => b.toLowerCase()));
    return list.filter(conn => {
      const email = conn.contactEmail?.toLowerCase();
      const uname = conn.contactUsername?.toLowerCase();
      return !(email && blockedSet.has(email)) && !(uname && blockedSet.has(uname));
    });
  }, [showConnectionsModal, connections, conversationList, blockedContacts, user?.email, contactAliases]);

  // Available contacts for Forwarding messages (deduplicated connections and conversations, excluding blocked)
  const availableForwardContacts = useMemo(() => {
    const list = [];
    const seen = new Set();
    const myEmail = normalizeEmail(user?.email);
    const myUsername = normalizeEmail(user?.username);

    // 1. From connections
    if (connections && Array.isArray(connections)) {
      connections.forEach(c => {
        const rawEmail = c.contactEmail || c.email || '';
        const rawUsername = c.contactUsername || c.username || '';
        const rawUserId = c.contactUserId ? String(c.contactUserId) : '';

        const sendIdentifier = (rawEmail && rawEmail.includes('@'))
          ? rawEmail
          : (rawUsername || rawEmail || rawUserId);

        if (!sendIdentifier) return;
        if (
          isCurrentUser(sendIdentifier) ||
          normalizeEmail(sendIdentifier) === myEmail ||
          (myUsername && normalizeEmail(sendIdentifier) === myUsername)
        ) {
          return;
        }

        const dedupeKey = normalizeEmail(sendIdentifier);
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          if (rawEmail) seen.add(normalizeEmail(rawEmail));
          if (rawUsername) seen.add(normalizeEmail(rawUsername));

          list.push({
            id: c.id || sendIdentifier,
            sendIdentifier: sendIdentifier,
            email: rawEmail || (sendIdentifier.includes('@') ? sendIdentifier : ''),
            username: rawUsername || (!sendIdentifier.includes('@') ? sendIdentifier : ''),
            displayName: c.contactDisplayName || getDisplayName(sendIdentifier, c) || rawUsername || rawEmail || sendIdentifier,
            profilePicture: c.contactProfilePicture || c.profilePicture || null,
            profilePictureUrl: c.contactProfilePictureUrl || c.profilePictureUrl || null
          });
        }
      });
    }

    // 2. From active conversations (messagesConversations or conversationList)
    const convos = (messagesConversations && messagesConversations.length > 0)
      ? messagesConversations
      : (conversationList || []);

    convos.forEach(chat => {
      const contactVal = chat.contact;
      if (!contactVal) return;
      if (
        isCurrentUser(contactVal) ||
        normalizeEmail(contactVal) === myEmail ||
        (myUsername && normalizeEmail(contactVal) === myUsername)
      ) {
        return;
      }

      const dedupeKey = normalizeEmail(contactVal);
      const contactLocal = dedupeKey.includes('@') ? dedupeKey.split('@')[0] : dedupeKey;

      if (!seen.has(dedupeKey) && !seen.has(contactLocal)) {
        seen.add(dedupeKey);
        seen.add(contactLocal);

        const matchedConn = connections?.find(c => {
          const cEmail = normalizeEmail(c.contactEmail || c.email);
          const cUser = normalizeEmail(c.contactUsername || c.username);
          return cEmail === dedupeKey || cUser === dedupeKey || cEmail === contactLocal || cUser === contactLocal;
        });

        const sendIdentifier = (matchedConn?.contactEmail && matchedConn.contactEmail.includes('@'))
          ? matchedConn.contactEmail
          : (contactVal || matchedConn?.contactUsername);

        list.push({
          id: chat.id || contactVal,
          sendIdentifier: sendIdentifier,
          email: (sendIdentifier && sendIdentifier.includes('@')) ? sendIdentifier : (contactVal.includes('@') ? contactVal : ''),
          username: getOriginalName(contactVal, chat.latestMessage) || (!sendIdentifier.includes('@') ? sendIdentifier : ''),
          displayName: getDisplayName(contactVal, chat.latestMessage) || matchedConn?.contactDisplayName || sendIdentifier,
          profilePicture: matchedConn?.contactProfilePicture || chat.latestMessage?.contactProfilePicture || null,
          profilePictureUrl: matchedConn?.contactProfilePictureUrl || chat.latestMessage?.contactProfilePictureUrl || null
        });
      }
    });

    // Filter out blocked contacts
    const blockedSet = new Set(blockedContacts.map(b => normalizeEmail(b)));
    return list.filter(c => {
      const em = normalizeEmail(c.email);
      const un = normalizeEmail(c.username);
      const si = normalizeEmail(c.sendIdentifier);
      return !blockedSet.has(em) && (!un || !blockedSet.has(un)) && (!si || !blockedSet.has(si));
    });
  }, [connections, messagesConversations, conversationList, blockedContacts, user?.email, user?.username, isCurrentUser, getDisplayName, getOriginalName]);

  const filteredForwardContacts = useMemo(() => {
    if (!forwardSearchTerm.trim()) return availableForwardContacts;
    const term = forwardSearchTerm.trim().toLowerCase();
    return availableForwardContacts.filter(c => {
      const name = (c.displayName || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const username = (c.username || '').toLowerCase();
      const ident = (c.sendIdentifier || '').toLowerCase();
      return name.includes(term) || email.includes(term) || username.includes(term) || ident.includes(term);
    });
  }, [availableForwardContacts, forwardSearchTerm]);

  const handleSendForward = useCallback(async () => {
    if (!forwardingMessage || selectedForwardContactEmails.size === 0 || isSendingForward) return;

    setIsSendingForward(true);
    const originalSender = forwardingMessage.senderLabel || getDisplayName(forwardingMessage.senderEmail || forwardingMessage.sender, forwardingMessage);
    const cleanBodyText = cleanMessageBody(forwardingMessage.body || "");
    const forwardBody = `[Forwarded from ${originalSender}]\n${cleanBodyText}`;
    const subject = forwardingMessage.subject || selectedMessage?.subject || "Casbox Message";
    const attachmentsJson = forwardingMessage.attachmentsJson || null;

    const recipientIdentifiers = Array.from(selectedForwardContactEmails);
    let successCount = 0;
    const errorDetails = [];
    const newMessagesSent = [];

    for (const recipientId of recipientIdentifiers) {
      const matchedContact = availableForwardContacts.find(c => {
        const idKey = normalizeEmail(c.sendIdentifier || c.email || c.username);
        return (
          idKey === recipientId ||
          (c.email && normalizeEmail(c.email) === recipientId) ||
          (c.username && normalizeEmail(c.username) === recipientId) ||
          (c.sendIdentifier && normalizeEmail(c.sendIdentifier) === recipientId)
        );
      });

      const receiverEmail = matchedContact?.sendIdentifier || matchedContact?.email || matchedContact?.username || recipientId;
      const recipientName = matchedContact?.displayName || matchedContact?.username || receiverEmail;

      try {
        const payload = {
          receiverEmail: receiverEmail,
          subject: subject,
          body: forwardBody,
          attachmentsJson: attachmentsJson
        };
        const res = await casboxAPI.sendMessage(payload);
        const sentMsg = res.data;
        if (sentMsg) {
          newMessagesSent.push(sentMsg);
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to forward message to ${receiverEmail}:`, err);
        const rawReason = err?.response?.data?.message || err?.response?.data?.error || err?.message || "";
        const isBlocked =
          isBlockedContact(receiverEmail) ||
          rawReason === "You cannot send messages to this user." ||
          rawReason === "You cannot send messages to this user because you have blocked them." ||
          /cannot send messages to this user/i.test(rawReason) ||
          /blocked/i.test(rawReason);
        const errReason = isBlocked ? "This user is blocked." : (rawReason || "Failed to send");
        errorDetails.push({ recipient: recipientName, reason: errReason });
      }
    }

    if (newMessagesSent.length > 0) {
      // Update local messages state so conversation lists & combine views update immediately
      setMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id || m.uid));
        const toAdd = newMessagesSent.filter(m => !prevIds.has(m.id || m.uid));
        return [...toAdd, ...prev];
      });

      // If the currently open conversation happens to be one of the recipients, also update threadMessages
      const currentChatEmail = normalizeEmail(getOtherUserEmail(selectedMessage));
      if (currentChatEmail) {
        const sentToCurrentChat = newMessagesSent.filter(m => 
          normalizeEmail(m.receiverEmail || m.receiver) === currentChatEmail ||
          normalizeEmail(m.senderEmail || m.sender) === currentChatEmail
        );
        if (sentToCurrentChat.length > 0) {
          setThreadMessages(prev => {
            const prevIds = new Set(prev.map(m => m.id || m.uid));
            const toAdd = sentToCurrentChat.filter(m => !prevIds.has(m.id || m.uid));
            return [...prev, ...toAdd];
          });
        }
      }

      if (successCount === 1) {
        toast.success("Message forwarded");
      } else {
        toast.success(`Message forwarded to ${successCount} contacts`);
      }
    }

    if (errorDetails.length > 0) {
      if (errorDetails.length === 1) {
        toast.error(`Failed to forward to ${errorDetails[0].recipient}: ${errorDetails[0].reason}`);
      } else {
        toast.error(`Failed to forward to ${errorDetails.length} contact(s)`);
      }
    }

    setIsSendingForward(false);
    setForwardingMessage(null);
    setSelectedForwardContactEmails(new Set());
    setForwardSearchTerm("");
  }, [forwardingMessage, selectedForwardContactEmails, isSendingForward, cleanMessageBody, getDisplayName, selectedMessage, getOtherUserEmail, availableForwardContacts]);

  // Unified all-messages list for Combine tab
  const unifiedCombineMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const disconnectedSet = new Set();
    if (connections && Array.isArray(connections)) {
      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        if (String(c.status || '').trim().toUpperCase() === 'DISCONNECTED') {
          const email = normalizeEmail(c.contactEmail || c.email);
          if (email) {
            disconnectedSet.add(email);
            if (email.includes('@')) disconnectedSet.add(email.split('@')[0]);
          }
          const uname = normalizeEmail(c.contactUsername || c.username);
          if (uname) disconnectedSet.add(uname);
          if (c.contactUserId) disconnectedSet.add(String(c.contactUserId));
        }
      }
    }

    const seenIds = new Set();
    const list = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const id = msg.id || msg.uid || `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.receiverEmail || msg.receiver}-${msg.body}`;
      if (seenIds.has(id)) continue;
      if (deletedMessageIds.has(id) || deletedMessageIds.has(String(id))) continue;
      if (isMsgArchived(msg)) continue;
      seenIds.add(id);

      const sender = normalizeEmail(msg.senderEmail || msg.sender);
      const receiver = normalizeEmail(msg.receiverEmail || msg.receiver);
      if (!sender || !receiver) continue;

      const isMe = isCurrentUser(sender);
      const rawContact = isMe ? (msg.receiverEmail || msg.receiver) : (msg.senderEmail || msg.sender);
      if (!rawContact) continue;

      const contactNorm = normalizeEmail(rawContact);
      const contactLocal = contactNorm.includes('@') ? contactNorm.split('@')[0] : contactNorm;
      if (disconnectedSet.has(contactNorm) || disconnectedSet.has(contactLocal)) continue;

      const ts = getTimestampMs(msg.timestamp);

      list.push({
        msg,
        id,
        isSent: isMe,
        contact: rawContact,
        contactNorm,
        timestampMs: ts,
      });
    }

    // Sort ALL messages globally using the existing message timestamp - newest at top
    list.sort((a, b) => b.timestampMs - a.timestampMs);
    return list;
  }, [messages, blockedContacts, connections, isCurrentUser, deletedMessageIds, isMsgArchived]);

  const filteredCombineMessages = useMemo(() => {
    let result = unifiedCombineMessages;

    if (combineFilter === 'sent') {
      result = result.filter(item => item.isSent);
    } else if (combineFilter === 'received') {
      result = result.filter(item => !item.isSent);
    }

    if (combineSearch.trim()) {
      const query = combineSearch.toLowerCase().trim();
      result = result.filter(item => {
        const contactName = (getDisplayName(item.contact, item.msg) || '').toLowerCase();
        const originalName = (getOriginalName(item.contact, item.msg) || '').toLowerCase();
        const username = (item.msg?.contactUsername || (item.contact ? item.contact.split('@')[0] : '')).toLowerCase();
        return contactName.includes(query) || originalName.includes(query) || username.includes(query);
      });
    }

    return result;
  }, [unifiedCombineMessages, combineFilter, combineSearch, contactAliases]);

  const headerComponent = (
    <div className="flex flex-col shrink-0">
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0 bg-transparent">
        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-lg shrink-0">
          <button
            onClick={() => { setActiveTab('messages'); setSelectedMessage(null); setSelectedSentDetail(null); fetchMessages(true); }}
            className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'messages' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('casbox.messages', 'Messages')}
            {unreadMessagesCount > 0 && (
              <span className={`font-normal hidden sm:inline ${activeTab === 'messages' ? 'opacity-80' : 'opacity-60'}`}>
                ({unreadMessagesCount})
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('combine'); setSelectedMessage(null); setSelectedSentDetail(null); setSelectedRowIds(new Set()); fetchMessages(true); }}
            className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${isCombineTab ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('casbox.combine', 'Combine')}
            {unreadCombinedCount > 0 && (
              <span className={`font-normal hidden sm:inline ${isCombineTab ? 'opacity-80' : 'opacity-60'}`}>
                ({unreadCombinedCount})
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('requests'); setSelectedMessage(null); setSelectedSentDetail(null); setSelectedRowIds(new Set()); fetchMessages(true); }}
            className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'requests' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t('casbox.requests', 'Requests')}
            {unreadRequestsCount > 0 ? (
              <span className={`font-normal hidden sm:inline ${activeTab === 'requests' ? 'opacity-80' : 'opacity-60'}`}>
                ({unreadRequestsCount})
              </span>
            ) : requestsConversations.length > 0 ? (
              <span className={`font-normal hidden sm:inline ${activeTab === 'requests' ? 'opacity-80' : 'opacity-60'}`}>
                ({requestsConversations.length})
              </span>
            ) : null}
            {requestMessages.length > 0 && <span className="flex h-2 w-2 rounded-full bg-red-500"></span>}
          </button>
          <button
            onClick={() => {
              if (showArchive && activeTab === 'archive') {
                setActiveTab('messages');
                setSelectedMessage(null);
                setSelectedSentDetail(null);
                setSelectedRowIds(new Set());
              }
              setShowArchive(prev => !prev);
            }}
            className="p-1.5 rounded-md transition-all flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60"
            title={showArchive ? t('common.collapse', 'Collapse') : t('sidebar.archive', 'Archive')}
            aria-label={showArchive ? "Collapse Archive" : "Expand Archive"}
          >
            {showArchive ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
          </button>
          {showArchive && (
            <button
              onClick={() => { setActiveTab('archive'); setSelectedMessage(null); setSelectedSentDetail(null); setSelectedRowIds(new Set()); }}
              className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 animate-in fade-in duration-150 ${activeTab === 'archive' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title={t('sidebar.archive', 'Archive')}
            >
              {t('sidebar.archive', 'Archive')}
              {unreadArchivedCount > 0 && (
                <span className={`font-normal hidden sm:inline ${activeTab === 'archive' ? 'opacity-80' : 'opacity-60'}`}>
                  ({unreadArchivedCount})
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex-1"></div>

        {/* Selected Messages Actions */}
        {(activeTab === 'messages' || activeTab === 'archive') && selectedRowIds.size > 0 && (
          <div className="flex items-center gap-1.5 mr-2">
            {activeTab === 'archive' ? (
              <button
                type="button"
                onClick={handleUnarchiveSelectedMessages}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-in fade-in duration-150"
                title={`Unarchive ${selectedRowIds.size} selected message${selectedRowIds.size > 1 ? 's' : ''}`}
                aria-label="Unarchive selected messages"
              >
                <MdUnarchive size={18} />
                <span className="hidden sm:inline">Unarchive</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleArchiveSelectedMessages}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-in fade-in duration-150"
                title={`Archive ${selectedRowIds.size} selected message${selectedRowIds.size > 1 ? 's' : ''}`}
                aria-label="Archive selected messages"
              >
                <MdArchive size={18} className="text-gray-600 dark:text-gray-300" />
                <span className="hidden sm:inline">Archive</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDeleteConfirmModal(true)}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-in fade-in duration-150"
              title={`Delete ${selectedRowIds.size} selected message${selectedRowIds.size > 1 ? 's' : ''}`}
              aria-label="Delete selected messages"
            >
              <MdDeleteOutline size={18} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        )}

        {/* Connections Button */}
        <div className="relative mr-1.5" ref={connectionsRef}>
          <button
            type="button"
            onClick={() => {
              setShowConnectionsModal(prev => !prev);
              if (!showConnectionsModal) fetchConnections();
            }}
            className="px-4 py-1.5 rounded-full text-sm font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90 active:scale-95 bg-[#195bac]"
            style={{ backgroundColor: "#195bac" }}
            title="Connections"
            aria-label="Connections"
          >
            <MdPersonAdd size={18} className="text-white shrink-0" />
            <span>Connections</span>
          </button>

          {/* Connections Popover */}
          {showConnectionsModal && (
            <div className="absolute right-0 mt-2 w-max min-w-[340px] sm:min-w-[440px] max-w-[calc(100vw-2rem)] sm:max-w-[580px] bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="p-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-black/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <MdPersonAdd size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-none">Connections</h3>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {displayedConnections.length} accepted contact{displayedConnections.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConnectionsModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <MdClose size={18} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {loadingConnections && connections.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 dark:text-gray-500">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading connections...
                  </div>
                ) : displayedConnections.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                    No accepted connections found.
                  </div>
                ) : (
                  displayedConnections.map((conn) => (
                    <ConnectionRow
                      key={conn.id || conn.contactEmail || conn.contactUsername}
                      conn={conn}
                      isUpdatingConnection={isUpdatingConnection}
                      onReconnect={handleReconnect}
                      onDisconnect={setConnectionToDisconnect}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowBlockedModal(true)}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 ml-1"
          title={t('casbox.blocked_users', 'Blocked Users')}
        >
          <MdBlock size={18} />
        </button>
        <button
          onClick={fetchMessages}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          title={t('common.refresh', 'Refresh')}
        >
          <MdRefresh size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );

  const listComponent = isCombineTab ? (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent relative">
      {/* Search Bar & Filter */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-3 bg-transparent shrink-0">
        <div className="flex-1 flex items-center gap-2.5 bg-gray-100/70 dark:bg-gray-800/60 px-4 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500/30 transition-all">
          <MdSearch size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={combineSearch}
            onChange={(e) => setCombineSearch(e.target.value)}
            placeholder="Search all messages..."
            className="bg-transparent border-none outline-none text-xs sm:text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 w-full"
          />
          {combineSearch && (
            <button
              type="button"
              onClick={() => setCombineSearch("")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-0.5"
            >
              <MdClose size={16} />
            </button>
          )}
        </div>

        {/* Filter Button */}
        <div className="relative" ref={filterMenuRef}>
          <button
            type="button"
            onClick={() => setShowFilterMenu(prev => !prev)}
            className={`p-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
              combineFilter !== 'all' || showFilterMenu
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100/70 dark:bg-gray-800/60 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Filter messages"
            aria-label="Filter messages"
          >
            <MdFilterList size={20} />
          </button>

          {showFilterMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => { setCombineFilter('all'); setShowFilterMenu(false); }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                  combineFilter === 'all' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                All Messages
                {combineFilter === 'all' && <MdCheck size={16} />}
              </button>
              <button
                type="button"
                onClick={() => { setCombineFilter('received'); setShowFilterMenu(false); }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                  combineFilter === 'received' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                Received Only
                {combineFilter === 'received' && <MdCheck size={16} />}
              </button>
              <button
                type="button"
                onClick={() => { setCombineFilter('sent'); setShowFilterMenu(false); }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                  combineFilter === 'sent' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                Sent Only
                {combineFilter === 'sent' && <MdCheck size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar relative bg-transparent">
        {loading && filteredCombineMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 opacity-80 pb-20">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Loading messages...</p>
          </div>
        ) : filteredCombineMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 opacity-80 pb-20">
            <MdSend className="text-4xl mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {combineSearch ? 'No matching messages found' : 'No messages found'}
            </p>
          </div>
        ) : (
          filteredCombineMessages.map((item) => {
            const { msg, id, isSent, contact } = item;
            const contactName = getDisplayName(contact, msg);
            const initial = getContactInitial(contact, msg);
            const avatarColorClass = getAvatarColorClass(contactName || contact);

            return (
              <div
                key={id}
                onClick={() => handleCombineRowClick(item)}
                className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors bg-white dark:bg-[#121212] cursor-pointer"
              >
                {/* Left side: Avatar, Name, Badge, Divider, Text */}
                <div className="flex items-center min-w-0 flex-1 mr-4">
                  {/* Avatar */}
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 select-none ${avatarColorClass}`}>
                    {initial}
                  </div>

                  {/* Contact Name */}
                  <span className="w-28 sm:w-44 font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate shrink-0 ml-3">
                    {contactName}
                  </span>

                  {/* Badge */}
                  {isSent ? (
                    <span className="ml-2 sm:ml-4 shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400">
                      Sent
                    </span>
                  ) : (
                    <span className="ml-2 sm:ml-4 shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      Received
                    </span>
                  )}

                  {/* Vertical Divider */}
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-3 sm:mx-4 shrink-0" />

                  {/* Message Body */}
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate font-normal flex-1 min-w-0">
                    {msg.body || msg.content || (msg.attachments?.length ? 'Attachment' : '')}
                  </span>
                </div>

                {/* Right side: Timestamp, Status Checkmark, Three dots */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                    {formatCashboxTime(msg.timestamp)}
                  </span>

                  {/* Status Indicator */}
                  {(() => {
                    const isSentMsg = Boolean(isSent || isCurrentUser(msg?.senderEmail || msg?.sender));
                    if (!isSentMsg) return null;

                    const status = typeof msg?.status === 'string' ? msg.status.trim().toUpperCase() : '';
                    const isRead = status === 'SEEN' || status === 'READ' || msg?.isRead === true || msg?.read === true;

                    if (isRead) {
                      return (
                        <span className="text-blue-500 shrink-0 flex items-center" title="Read">
                          <MdDoneAll size={16} />
                        </span>
                      );
                    }
                    return (
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center" title="Sent">
                        <MdCheck size={16} />
                      </span>
                    );
                  })()}

                  <div className="relative shrink-0" ref={openCombineMenuId === id ? combineMenuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCombineMenuId(prev => prev === id ? null : id);
                      }}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1 cursor-pointer"
                      title="More options"
                    >
                      <MdMoreVert size={18} />
                    </button>

                    {openCombineMenuId === id && (
                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (msg.body) {
                              navigator.clipboard.writeText(msg.body);
                              toast.success("Copied to clipboard");
                            }
                            setOpenCombineMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdContentCopy size={15} className="text-gray-500 dark:text-gray-400" />
                          Copy Text
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleArchiveMessage(msg, e)}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdArchive size={16} className="text-gray-500 dark:text-gray-400" />
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenCombineMenuId(null);
                            setMessageToDelete(msg);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdDeleteOutline size={15} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent relative">
      {/* Search Bar & Filter for Messages */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-3 bg-transparent shrink-0">
        <div className="flex-1 flex items-center gap-2.5 bg-gray-100/70 dark:bg-gray-800/60 px-4 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500/30 transition-all">
          <MdSearch size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={messagesSearch}
            onChange={(e) => setMessagesSearch(e.target.value)}
            placeholder="Search messages..."
            className="bg-transparent border-none outline-none text-xs sm:text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 w-full"
          />
          {messagesSearch && (
            <button
              type="button"
              onClick={() => setMessagesSearch("")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-0.5"
            >
              <MdClose size={16} />
            </button>
          )}
        </div>

        {/* Filter Button & Dropdown */}
        <div className="relative" ref={messagesFilterMenuRef}>
          <button
            type="button"
            onClick={() => setShowMessagesFilterMenu((prev) => !prev)}
            className="p-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center cursor-pointer bg-blue-100/80 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400"
            title="Filter messages"
            aria-label="Filter messages"
          >
            <MdFilterAlt size={20} />
          </button>

          {showMessagesFilterMenu && (
            <div className="absolute right-0 mt-2 w-52 sm:w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl z-30 py-2 animate-in fade-in duration-150">
              {CASBOX_MESSAGE_FILTERS.map((opt) => {
                if (opt.isDivider) {
                  return <div key={opt.id} className="border-t border-gray-100 dark:border-gray-700/60 my-1.5" />;
                }

                const isSelected = messagesFilter === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMessagesFilter(opt.id);
                      setShowMessagesFilterMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium"
                    }`}
                  >
                    {IconComponent ? (
                      <IconComponent
                        size={17}
                        className={isSelected ? "text-blue-600 dark:text-blue-400 shrink-0" : "text-gray-700 dark:text-gray-300 shrink-0"}
                      />
                    ) : opt.number ? (
                      <CalendarNumberIcon
                        number={opt.number}
                        size={17}
                        className={isSelected ? "text-blue-600 dark:text-blue-400 shrink-0" : "text-gray-700 dark:text-gray-300 shrink-0"}
                      />
                    ) : null}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && (
                      <MdCheck size={18} className="text-blue-600 dark:text-blue-400 shrink-0 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar relative bg-transparent">
        {loading && (activeTab === 'messages' ? filteredIndividualMessages.length === 0 : activeTab === 'archive' ? filteredArchivedMessages.length === 0 : filteredConversationList.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 opacity-80 pb-20">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Loading messages...</p>
          </div>
        ) : (activeTab === 'messages' ? filteredIndividualMessages.length === 0 : activeTab === 'archive' ? filteredArchivedMessages.length === 0 : filteredConversationList.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 opacity-80 pb-20">
            {activeTab === 'archive' ? (
              <>
                <MdArchive className="text-4xl mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {messagesSearch || messagesFilter !== 'all'
                    ? 'No matching archived messages found'
                    : 'No archived messages'}
                </p>
              </>
            ) : (
              <>
                <MdSend className="text-4xl mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {messagesSearch || messagesFilter !== 'all'
                    ? 'No matching messages found'
                    : (activeTab === 'requests' ? 'No message requests' : t('casbox.no_chats', 'No chats yet'))}
                </p>
              </>
            )}
          </div>
        ) : activeTab === 'messages' ? (
          filteredIndividualMessages.map((item) => {
            const { msg, id, isSent, contact, chat } = item;

            const isUnread = !isSent && isMessageUnread(msg);

            // Sender / Receiver Name
            const personEmail = contact;
            const personName = getDisplayName(personEmail, msg) || personEmail;
            const initial = getContactInitial(personEmail, msg);
            const avatarColorClass = getAvatarColorClass(personName || personEmail);

            const rowId = id;
            const isChecked = selectedRowIds.has(rowId);

            // Subject: Show if present and not empty
            const rawSubject = typeof msg?.subject === 'string' ? msg.subject.trim() : '';
            const cleanRaw = rawSubject.replace(/^\[(Combine|Combined|Messages)\]\s*/i, '').trim();
            const subject = (cleanRaw && cleanRaw.toLowerCase() !== 'null' && cleanRaw.toLowerCase() !== 'undefined') ? cleanRaw : '';

            // Body preview
            let bodyPreview = "";
            if (msg?.body || msg?.content) {
              bodyPreview = String(msg.body || msg.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            } else if (msg?.attachmentsJson || (msg?.attachments && msg.attachments.length)) {
              bodyPreview = "Attachment";
            }

            return (
              <div
                key={id}
                onClick={() => handleOpenMessageDetail(item)}
                className={`group flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors relative bg-white dark:bg-[#121212] cursor-pointer ${
                  selectedSentDetail && (selectedSentDetail.id === msg.id || selectedSentDetail === msg) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                }`}
              >

                {/* Left side: [Checkbox] [Avatar] [Person Name] [Sent/Received Badge] [Subject/Title] — [Message Preview] */}
                <div className="flex items-center min-w-0 flex-1 mr-4">
                  {/* Checkbox */}
                  <div className="flex items-center shrink-0 mr-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-[#1e1e1e]"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(rowId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none mr-3 sm:mr-3.5 ${avatarColorClass}`}>
                    {initial}
                  </div>

                  {/* Person Name */}
                  <span className={`w-32 sm:w-44 lg:w-48 text-xs sm:text-sm truncate shrink-0 select-none mr-3 sm:mr-4 ${
                    isUnread ? 'font-bold text-gray-950 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'
                  }`}>
                    {personName}
                  </span>

                  {/* Sent / Received Badge */}
                  <div className="shrink-0 mr-3 sm:mr-4">
                    {isSent ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400">
                        Sent
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        Received
                      </span>
                    )}
                  </div>

                  {/* Message Content Preview (Subject + Body) */}
                  <div className="flex items-center min-w-0 flex-1">
                    {subject && (
                      <span className={`text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate shrink-0 max-w-[130px] sm:max-w-[200px] mr-2 ${
                        isUnread ? 'font-bold' : 'font-semibold'
                      }`}>
                        {subject}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0 font-normal">
                      {subject && bodyPreview ? <span className="opacity-50 mr-1.5">—</span> : null}
                      {bodyPreview}
                    </span>
                  </div>
                </div>

                {/* Right side: [Time] [Status] [3-dot] */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isUnread ? 'font-bold text-gray-950 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {formatCashboxTime(msg?.timestamp)}
                  </span>

                  {/* Sent Message Status Ticks (Sent = ticks; Received = NO tick) */}
                  {(() => {
                    if (!isSent) return null;
                    const status = typeof msg?.status === 'string' ? msg.status.trim().toUpperCase() : '';
                    const isSeen = status === 'SEEN' || status === 'READ' || msg?.isRead === true || msg?.read === true;

                    if (isSeen) {
                      return (
                        <span className="text-blue-500 shrink-0 flex items-center ml-2" title="Seen">
                          <MdDoneAll size={16} />
                        </span>
                      );
                    }
                    return (
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center ml-2" title="Sent">
                        <MdCheck size={16} />
                      </span>
                    );
                  })()}

                  {/* 3-dot options menu */}
                  <div className="relative shrink-0 ml-1" ref={openMenuId === id ? listMenuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(prev => prev === id ? null : id);
                      }}
                      className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MdMoreVert size={18} />
                    </button>

                    {openMenuId === id && (
                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in duration-150">
                        {bodyPreview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(msg.body || msg.content || '');
                              toast.success("Copied to clipboard");
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MdContentCopy size={15} className="text-gray-500 dark:text-gray-400" />
                            Copy Text
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleArchiveMessage(msg, e)}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdArchive size={16} className="text-gray-500 dark:text-gray-400" />
                          Archive
                        </button>
                        {chat && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditNameModal(chat, e)}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MdEdit size={16} className="text-gray-500 dark:text-gray-400" />
                            {t('casbox.edit_name', 'Edit Name')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setMessageToDelete(msg || item);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdDeleteOutline size={16} className="text-red-500 dark:text-red-400" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : activeTab === 'archive' ? (
          filteredArchivedMessages.map((item) => {
            const { msg, id, isSent, contact, chat } = item;

            const isUnread = !isSent && isMessageUnread(msg);

            // Sender / Receiver Name
            const personEmail = contact;
            const personName = getDisplayName(personEmail, msg) || personEmail;
            const initial = getContactInitial(personEmail, msg);
            const avatarColorClass = getAvatarColorClass(personName || personEmail);

            const rowId = id;
            const isChecked = selectedRowIds.has(rowId);

            // Subject: Show if present and not empty, strip [Combine]/[Combined]/[Messages]
            const rawSubject = typeof msg?.subject === 'string' ? msg.subject.trim() : '';
            const cleanRaw = rawSubject.replace(/^\[(Combine|Combined|Messages)\]\s*/i, '').trim();
            const subject = (cleanRaw && cleanRaw.toLowerCase() !== 'null' && cleanRaw.toLowerCase() !== 'undefined') ? cleanRaw : '';

            // Body preview
            let bodyPreview = "";
            const rawBody = msg?.body || msg?.content || '';
            if (typeof rawBody === 'string' && rawBody.trim() && rawBody.trim().toLowerCase() !== 'null' && rawBody.trim().toLowerCase() !== 'undefined') {
              bodyPreview = rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (bodyPreview.toLowerCase() === 'null' || bodyPreview.toLowerCase() === 'undefined') {
                bodyPreview = "";
              }
            } else if (msg?.attachmentsJson || (msg?.attachments && msg.attachments.length)) {
              bodyPreview = "Attachment";
            }

            const isSelected = Boolean(
              selectedSentDetail && (
                (selectedSentDetail.id !== undefined && msg?.id !== undefined && (selectedSentDetail.id === msg.id || String(selectedSentDetail.id) === String(msg.id))) ||
                (selectedSentDetail.uid !== undefined && msg?.uid !== undefined && selectedSentDetail.uid === msg.uid) ||
                selectedSentDetail === msg
              )
            );

            return (
              <div
                key={id}
                onClick={() => handleArchivedMessageClick(msg, chat || { contact })}
                className={`group flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors relative bg-white dark:bg-[#121212] cursor-pointer ${
                  isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-blue-500"></div>
                )}

                {/* Left side: [Checkbox] [Avatar] [Person Name] [Direction | Subject — Preview] */}
                <div className="flex items-center min-w-0 flex-1 mr-4">
                  {/* Checkbox */}
                  <div className="flex items-center shrink-0 mr-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-[#1e1e1e]"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(rowId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none mr-3 sm:mr-3.5 ${avatarColorClass}`}>
                    {initial}
                  </div>

                  {/* Sender / Contact Name */}
                  <span className={`w-32 sm:w-44 lg:w-48 text-xs sm:text-sm truncate shrink-0 select-none mr-3 sm:mr-4 ${
                    isUnread ? 'font-bold text-gray-950 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'
                  }`}>
                    {personName}
                  </span>

                  {/* Direction + Subject + Content Preview */}
                  <div className="flex items-center min-w-0 flex-1">
                    {/* Direction Label */}
                    <span className={`text-xs sm:text-sm font-semibold shrink-0 ${
                      isSent ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {isSent ? 'Sent' : 'Received'}
                    </span>

                    {/* Pipe separator | if subject or bodyPreview exists */}
                    {(subject || bodyPreview) && (
                      <span className="text-gray-400 dark:text-gray-500 mx-2 shrink-0 select-none">|</span>
                    )}

                    {/* Subject */}
                    {subject && (
                      <span className={`text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate shrink-0 max-w-[130px] sm:max-w-[200px] font-semibold ${bodyPreview ? 'mr-1.5' : ''}`}>
                        {subject}
                      </span>
                    )}

                    {/* Dash separator — if both subject and bodyPreview exist */}
                    {subject && bodyPreview && (
                      <span className="text-gray-400 dark:text-gray-500 opacity-60 mr-1.5 shrink-0 select-none">—</span>
                    )}

                    {/* Content Preview */}
                    {bodyPreview && (
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0 font-normal">
                        {bodyPreview}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: [Time] [Status Ticks] [3-dot menu] */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isUnread ? 'font-bold text-gray-950 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {formatCashboxTime(msg?.timestamp)}
                  </span>

                  {/* Sent Message Status Ticks (Sent = ticks; Received = NO tick) */}
                  {(() => {
                    if (!isSent) return null;
                    const status = typeof msg?.status === 'string' ? msg.status.trim().toUpperCase() : '';
                    const isSeen = status === 'SEEN' || status === 'READ' || msg?.isRead === true || msg?.read === true;

                    if (isSeen) {
                      return (
                        <span className="text-blue-500 shrink-0 flex items-center ml-2" title="Seen">
                          <MdDoneAll size={16} />
                        </span>
                      );
                    }
                    return (
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center ml-2" title="Sent">
                        <MdCheck size={16} />
                      </span>
                    );
                  })()}

                  {/* 3-dot options menu */}
                  <div className="relative shrink-0 ml-1" ref={openMenuId === id ? listMenuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(prev => prev === id ? null : id);
                      }}
                      className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MdMoreVert size={18} />
                    </button>

                    {openMenuId === id && (
                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in duration-150">
                        {bodyPreview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(msg.body || msg.content || '');
                              toast.success("Copied to clipboard");
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MdContentCopy size={15} className="text-gray-500 dark:text-gray-400" />
                            Copy Text
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditNameModal(chat || { contact, latestMessage: msg }, e)}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdEdit size={16} className="text-gray-500 dark:text-gray-400" />
                          {t('casbox.edit_name', 'Edit Name')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleUnarchiveMessage(msg, e)}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdUnarchive size={16} className="text-blue-600 dark:text-blue-400" />
                          Unarchive
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setMessageToDelete(msg || item);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdDeleteOutline size={16} className="text-red-500 dark:text-red-400" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          filteredConversationList.map((chat) => {
            const msg = chat.latestMessage;
            const isMe = isCurrentUser(msg?.senderEmail || msg?.sender);
            const otherEmail = chat.contact;
            const isSelected = activeTab === 'archive'
              ? Boolean(selectedSentDetail && (
                  (selectedSentDetail.id && msg?.id && (selectedSentDetail.id === msg.id || String(selectedSentDetail.id) === String(msg.id))) ||
                  (selectedSentDetail.uid && msg?.uid && selectedSentDetail.uid === msg.uid) ||
                  selectedSentDetail === msg
                ))
              : Boolean(selectedMessage && (
                  normalizeEmail(getOtherUserEmail(selectedMessage)) === normalizeEmail(otherEmail)
                ));

            const unreadCount = chat.unreadCount !== undefined ? chat.unreadCount : chat.messages.filter(isMessageUnread).length;

            // Sender / Receiver Name
            const personEmail = isMe 
              ? (msg?.receiverEmail || msg?.receiver || otherEmail)
              : (msg?.senderEmail || msg?.sender || otherEmail);
            const personName = getDisplayName(personEmail, msg) || personEmail;
            const initial = getContactInitial(personEmail, msg);
            const avatarColorClass = getAvatarColorClass(personName || personEmail);

            const rowId = chat.contact || otherEmail;
            const isChecked = selectedRowIds.has(rowId);

            // Subject: Show if present and not empty
            const rawSubject = typeof msg?.subject === 'string' ? msg.subject.trim() : '';
            const cleanRaw = rawSubject.replace(/^\[(Combine|Combined|Messages)\]\s*/i, '').trim();
            const subject = (cleanRaw && cleanRaw.toLowerCase() !== 'null' && cleanRaw.toLowerCase() !== 'undefined') ? cleanRaw : '';

            // Body preview
            let bodyPreview = "";
            if (msg?.body || msg?.content) {
              bodyPreview = String(msg.body || msg.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            } else if (msg?.attachmentsJson || (msg?.attachments && msg.attachments.length)) {
              bodyPreview = "Attachment";
            }

            return (
              <div
                key={otherEmail}
                onClick={() => {
                  if (activeTab === 'archive') {
                    handleArchivedMessageClick(msg, chat);
                  } else {
                    handleSelectMessage(msg);
                  }
                }}
                className={`group flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors cursor-pointer relative bg-white dark:bg-[#121212] ${
                  isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-blue-500"></div>
                )}

                {/* Left side: [Checkbox] [Avatar] [Name] [Message Preview] */}
                <div className="flex items-center min-w-0 flex-1 mr-4">
                  {/* Checkbox */}
                  <div className="flex items-center shrink-0 mr-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-[#1e1e1e]"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(rowId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none mr-3 sm:mr-3.5 ${avatarColorClass}`}>
                    {initial}
                  </div>

                  {/* Name */}
                  <span className={`w-32 sm:w-44 lg:w-48 text-xs sm:text-sm truncate shrink-0 select-none mr-3 sm:mr-4 ${
                    unreadCount > 0 ? 'font-bold text-gray-950 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'
                  }`}>
                    {personName}
                  </span>

                  {/* Message Content Preview (Subject + Body) */}
                  <div className="flex items-center min-w-0 flex-1">
                    {subject && (
                      <span className={`text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate shrink-0 max-w-[130px] sm:max-w-[200px] mr-2 ${
                        unreadCount > 0 ? 'font-bold' : 'font-semibold'
                      }`}>
                        {subject}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0 font-normal">
                      {subject && bodyPreview ? <span className="opacity-50 mr-1.5">—</span> : null}
                      {bodyPreview}
                    </span>
                  </div>
                </div>

                {/* Right side: [Time] [Status] [More options] */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    unreadCount > 0 ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {formatCashboxTime(msg?.timestamp)}
                  </span>

                  {/* Sent Message Status Ticks (Sent = ticks; Received = no ticks) */}
                  {(() => {
                    if (!isMe) return null;
                    const status = typeof msg?.status === 'string' ? msg.status.trim().toUpperCase() : '';
                    const isSeen = status === 'SEEN' || status === 'READ' || msg?.isRead === true || msg?.read === true;

                    if (isSeen) {
                      return (
                        <span className="text-blue-500 shrink-0 flex items-center ml-2" title="Seen">
                          <MdDoneAll size={16} />
                        </span>
                      );
                    }
                    return (
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center ml-2" title="Sent">
                        <MdCheck size={16} />
                      </span>
                    );
                  })()}

                  {/* More options menu */}
                  <div className="relative shrink-0 ml-1" ref={openMenuId === chat.contact ? listMenuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(prev => prev === chat.contact ? null : chat.contact);
                      }}
                      className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MdMoreVert size={18} />
                    </button>

                    {openMenuId === chat.contact && (
                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditNameModal(chat, e)}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdEdit size={16} className="text-gray-500 dark:text-gray-400" />
                          {t('casbox.edit_name', 'Edit Name')}
                        </button>
                        {activeTab === 'archive' ? (
                          <button
                            type="button"
                            onClick={(e) => handleUnarchiveMessage(chat, e)}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MdUnarchive size={16} className="text-blue-600 dark:text-blue-400" />
                            Unarchive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleArchiveMessage(chat, e)}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MdArchive size={16} className="text-gray-500 dark:text-gray-400" />
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setConversationToDelete(chat);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MdDeleteOutline size={16} className="text-red-500 dark:text-red-400" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const handleAcceptRequest = async (senderEmail) => {
    try {
      const emailLower = normalizeEmail(senderEmail);
      const localPart = emailLower.includes('@') ? emailLower.split('@')[0] : emailLower;
      const newAccepted = Array.from(new Set([
        ...acceptedContacts.map(normalizeEmail),
        emailLower,
        localPart
      ])).filter(Boolean);
      setAcceptedContacts(newAccepted);
      try {
        sessionStorage.setItem('bnx_casbox_accepted', JSON.stringify(newAccepted));
      } catch (e) {}
      await userAPI.updateSettings({ casboxAccepted: newAccepted });
      toast.success("Request accepted");
      if (!isCombineTab) {
        setActiveTab("messages");
      }
    } catch (e) {
      toast.error("Failed to accept request");
      setAcceptedContacts(acceptedContacts);
    }
  };

  const getCanonicalBlockedContact = useCallback((rawIdentifier) => {
    if (!rawIdentifier) return null;
    const norm = normalizeEmail(rawIdentifier);
    if (!norm) return null;
    const local = norm.includes('@') ? norm.split('@')[0] : norm;

    // 1. Check connections
    const matchedConn = connections?.find(c => {
      const cEmail = normalizeEmail(c.contactEmail || c.email);
      const cUser = normalizeEmail(c.contactUsername || c.username);
      const cLocal = cEmail.includes('@') ? cEmail.split('@')[0] : cEmail;
      return (cEmail && (cEmail === norm || cLocal === local)) ||
             (cUser && (cUser === norm || cUser === local));
    });

    // 2. Check conversationList
    const matchedChat = !matchedConn ? conversationList?.find(chat => {
      const cNorm = normalizeEmail(chat.contact);
      const cLocal = cNorm.includes('@') ? cNorm.split('@')[0] : cNorm;
      return cNorm === norm || cLocal === local;
    }) : null;

    const emailCandidate = (norm.includes('@') ? norm : '') ||
      (matchedConn?.contactEmail && matchedConn.contactEmail.includes('@') ? matchedConn.contactEmail : '') ||
      (matchedConn?.email && matchedConn.email.includes('@') ? matchedConn.email : '') ||
      (matchedChat?.contact && matchedChat.contact.includes('@') ? matchedChat.contact : '');

    const usernameCandidate = matchedConn?.contactUsername || matchedConn?.username || (!norm.includes('@') ? norm : local);

    // Primary display value: prefer email address if available; otherwise show username
    const displayValue = emailCandidate || usernameCandidate || norm;
    const primaryIdentifier = emailCandidate || usernameCandidate || norm;
    const groupKey = local;

    const allRepresentations = new Set([norm, local]);
    if (emailCandidate) allRepresentations.add(normalizeEmail(emailCandidate));
    if (usernameCandidate) allRepresentations.add(normalizeEmail(usernameCandidate));
    if (matchedConn?.contactUserId) allRepresentations.add(String(matchedConn.contactUserId));

    return {
      groupKey,
      displayValue,
      primaryIdentifier,
      allRepresentations: Array.from(allRepresentations)
    };
  }, [connections, conversationList]);

  const deduplicatedBlockedContacts = useMemo(() => {
    if (!blockedContacts || blockedContacts.length === 0) return [];

    const map = new Map();
    blockedContacts.forEach(item => {
      const info = getCanonicalBlockedContact(item);
      if (!info) return;

      if (!map.has(info.groupKey)) {
        map.set(info.groupKey, info);
      } else {
        const existing = map.get(info.groupKey);
        if (!existing.displayValue.includes('@') && info.displayValue.includes('@')) {
          map.set(info.groupKey, {
            ...existing,
            displayValue: info.displayValue,
            primaryIdentifier: info.primaryIdentifier,
            allRepresentations: Array.from(new Set([...existing.allRepresentations, ...info.allRepresentations]))
          });
        } else {
          existing.allRepresentations = Array.from(new Set([...existing.allRepresentations, ...info.allRepresentations]));
        }
      }
    });

    return Array.from(map.values());
  }, [blockedContacts, getCanonicalBlockedContact]);

  const handleBlockUser = async (senderEmail) => {
    if (!senderEmail || isProcessingBlockAction) return;
    const emailLower = normalizeEmail(senderEmail);
    if (!emailLower) return;

    try {
      setIsProcessingBlockAction(true);
      const info = getCanonicalBlockedContact(emailLower);
      const primaryId = info?.primaryIdentifier || emailLower;
      const groupKey = info?.groupKey || (emailLower.includes('@') ? emailLower.split('@')[0] : emailLower);
      const reps = new Set(info ? info.allRepresentations.map(normalizeEmail) : [emailLower, groupKey]);

      const prevBlocked = (blockedContactsRef.current || []).map(normalizeEmail);
      const filtered = prevBlocked.filter(b => {
        const bNorm = normalizeEmail(b);
        const bLocal = bNorm.includes('@') ? bNorm.split('@')[0] : bNorm;
        return !reps.has(bNorm) && bLocal !== groupKey;
      });

      const newBlocked = [...filtered, primaryId];
      setBlockedContacts(newBlocked);
      try {
        sessionStorage.setItem('bnx_casbox_blocked', JSON.stringify(newBlocked));
        localStorage.setItem('bnx_casbox_blocked', JSON.stringify(newBlocked));
      } catch (e) {}

      if (blockedContactsAPI?.blockSender) {
        await blockedContactsAPI.blockSender(primaryId);
      }
      toast.success("User blocked");
      fetchMessages(true);
    } catch (e) {
      console.error("Failed to block user", e);
      const msg = e.response?.data?.message || e.message || "Failed to block user";
      toast.error(msg);
    } finally {
      setIsProcessingBlockAction(false);
    }
  };

  const handleBlockRequest = handleBlockUser;

  const handleUnblockUser = async (senderEmail) => {
    if (!senderEmail || isProcessingBlockAction) return;
    const emailLower = normalizeEmail(senderEmail);
    if (!emailLower) return;

    try {
      setIsProcessingBlockAction(true);
      const info = getCanonicalBlockedContact(emailLower);
      const groupKey = info?.groupKey || (emailLower.includes('@') ? emailLower.split('@')[0] : emailLower);
      const repsToRemove = new Set(info ? info.allRepresentations.map(normalizeEmail) : [emailLower, groupKey]);

      const newBlocked = (blockedContactsRef.current || []).filter(email => {
        const em = normalizeEmail(email);
        const emLocal = em.includes('@') ? em.split('@')[0] : em;
        return !repsToRemove.has(em) && emLocal !== groupKey;
      });

      setBlockedContacts(newBlocked);
      try {
        sessionStorage.setItem('bnx_casbox_blocked', JSON.stringify(newBlocked));
        localStorage.setItem('bnx_casbox_blocked', JSON.stringify(newBlocked));
      } catch (e) {}

      if (blockedContactsAPI?.unblockSender) {
        await blockedContactsAPI.unblockSender(emailLower);
        if (info?.primaryIdentifier && info.primaryIdentifier !== emailLower) {
          try {
            await blockedContactsAPI.unblockSender(info.primaryIdentifier);
          } catch (e) {}
        }
      }
      toast.success("User unblocked");
      fetchMessages(true);
    } catch (e) {
      console.error("Failed to unblock user", e);
      const msg = e.response?.data?.message || e.message || "Failed to unblock user";
      toast.error(msg);
    } finally {
      setIsProcessingBlockAction(false);
    }
  };

  const renderBubbleAttachments = (msg) => {
    if (!msg?.attachmentsJson) return null;
    const files = parseMessageAttachments(msg.attachmentsJson);
    if (!files || files.length === 0) return null;
    return (
      <div className="mt-2 space-y-1.5 border-t border-black/5 dark:border-white/5 pt-2">
        {files.map((fileObj, i) => {
          const fileName = fileObj.fileName || fileObj.name || (typeof fileObj === 'string' ? fileObj.split('/').pop() : "Attachment");
          const fileInfo = getFileIcon(fileName);
          return (
            <div
              key={fileObj.id || fileObj.fileName || i}
              className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[11px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{fileInfo.icon}</span>
                <span className="font-medium truncate max-w-[120px]">{fileName}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(fileObj); }}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-current cursor-pointer shrink-0"
              >
                <MdFileDownload size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const sentDetailComponent = selectedSentDetail ? (() => {
    const msg = selectedSentDetail;
    const isSent = Boolean(
      msg?.direction === 'SENT' ||
      msg?.isSent === true ||
      isCurrentUser(msg?.senderEmail || msg?.sender)
    );

    const fromEmail = isSent
      ? (user?.email || msg?.senderEmail || msg?.sender || '')
      : (msg?.senderEmail || msg?.sender || msg?.contactRecipient || msg?.contact || '');

    const toEmail = isSent
      ? (msg?.receiverEmail || msg?.receiver || msg?.recipient || msg?.contactRecipient || msg?.contact || '')
      : (user?.email || msg?.receiverEmail || msg?.receiver || '');

    const contactEmail = isSent ? toEmail : fromEmail;
    const personDisplayName = getDisplayName(contactEmail, msg) || (contactEmail.includes('@') ? contactEmail.split('@')[0] : contactEmail);
    const personEmailAddress = contactEmail;

    const initial = getContactInitial(contactEmail, msg);
    const avatarColorClass = getAvatarColorClass(personDisplayName || contactEmail);

    const rawSubject = typeof msg?.subject === 'string' ? msg.subject.trim() : '';
    const cleanRaw = rawSubject.replace(/^\[(Combine|Combined|Messages)\]\s*/i, '').trim();
    const subject = (cleanRaw && cleanRaw.toLowerCase() !== 'null' && cleanRaw.toLowerCase() !== 'undefined') ? cleanRaw : '(No subject)';
    const bodyContent = msg?.body || msg?.content || '';
    const timeStr = formatSentDetailDateTime(msg?.timestamp) || formatCashboxTime(msg?.timestamp);

    const status = typeof msg?.status === 'string' ? msg.status.trim().toUpperCase() : '';
    const isSeen = status === 'SEEN' || status === 'READ' || msg?.isRead === true || msg?.read === true;

    const attachmentFiles = msg?.attachmentsJson
      ? parseMessageAttachments(msg.attachmentsJson)
      : (Array.isArray(msg?.attachments) ? msg.attachments : []);

    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#121212] overflow-hidden">
        {/* Top Toolbar: Minimal Back (left) and Actions (right) */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-5 bg-transparent shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedSentDetail(null);
              setSelectedMessage(null);
            }}
            className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer group"
            title="Back"
          >
            <MdArrowBack size={20} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {Boolean(msg?.isArchived || msg?.archived) ? (
              <button
                type="button"
                onClick={(e) => handleUnarchiveMessage(msg, e)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                title="Unarchive"
              >
                <MdUnarchive size={22} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => handleArchiveMessage(msg, e)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Archive"
              >
                <MdArchive size={22} />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (selectedSentDetail) {
                  setMessageToDelete(selectedSentDetail);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Delete"
            >
              <MdDeleteOutline size={24} />
            </button>
          </div>
        </div>

        {/* Content Area - Full-screen off-white mail reading layout */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-2 pb-14 bg-[#f8f9fa] dark:bg-[#121212]">
          {/* Message Subject */}
          <div className="w-full mb-6 text-left">
            <h1 className="text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
              {subject}
            </h1>
          </div>

          {/* Large Rounded White Message Card */}
          <div className="w-full text-left">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xs p-6 sm:p-9 w-full">
              {/* Header: Avatar, Person Name <email>, To: receiver, Date + Time */}
              <div className="flex items-start justify-between gap-4 pb-2">
                {/* Left: Avatar + Names */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 select-none bg-[#e0e7ff] text-[#2563eb] dark:bg-blue-950/60 dark:text-blue-300">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Name <email> */}
                    <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap leading-tight">
                      <span>{personDisplayName}</span>
                      {personEmailAddress && (
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                          &lt;{personEmailAddress}&gt;
                        </span>
                      )}
                    </div>

                    {/* To: recipient (From removed as specified) */}
                    <div className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-baseline gap-1 truncate">
                      <span className="text-gray-400 dark:text-gray-500 font-normal">To:</span>
                      <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{toEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Date + Time + tick status if Sent */}
                <div className="flex items-center gap-1.5 shrink-0 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap pt-0.5">
                  <span>{timeStr}</span>
                  {isSent && (
                    isSeen ? (
                      <span className="text-blue-500 shrink-0 flex items-center ml-1" title="Seen">
                        <MdDoneAll size={16} />
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center ml-1" title="Sent">
                        <MdCheck size={16} />
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-800 my-6" />

              {/* Message Body Content */}
              <div className="text-[15px] sm:text-base leading-relaxed text-gray-900 dark:text-gray-100 min-h-[60px] py-1">
                {bodyContent.trim().startsWith('<') && bodyContent.includes('</') ? (
                  <div
                    className="prose dark:prose-invert max-w-none break-words"
                    dangerouslySetInnerHTML={{ __html: bodyContent }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words leading-relaxed font-normal">
                    {bodyContent || <span className="italic text-gray-400">No message content</span>}
                  </div>
                )}
              </div>

              {/* Attachments if any */}
              {attachmentFiles && attachmentFiles.length > 0 && (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-800 my-6" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
                      <MdAttachFile size={18} className="text-gray-700 dark:text-gray-300 -rotate-45" />
                      <span>Attachments ({attachmentFiles.length})</span>
                    </div>
                    <div className="space-y-3">
                      {attachmentFiles.map((fileObj, i) => {
                        const fileName = fileObj.fileName || fileObj.name || (typeof fileObj === 'string' ? fileObj.split('/').pop() : "Attachment");
                        const ext = fileName?.split('.').pop()?.toLowerCase();
                        const isPdf = ext === 'pdf';
                        const fileInfo = getFileIcon(fileName);
                        const fileSize = fileObj.fileSize || fileObj.size ? formatFileSize(fileObj.fileSize || fileObj.size) : null;
                        return (
                          <div
                            key={fileObj.id || fileObj.fileName || i}
                            className="flex items-center justify-between gap-4"
                          >
                            {/* Attachment Card */}
                            <div
                              onClick={() => handlePreviewAttachment(fileObj)}
                              className="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#f4f5f7] dark:bg-white/5 border border-gray-100/80 dark:border-gray-800 max-w-sm w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                              {isPdf ? (
                                <div className="w-10 h-10 rounded-lg bg-[#ea3829] text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <SiAdobeacrobatreader size={22} />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0 text-lg">
                                  {fileInfo.icon}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                  {fileName}
                                </span>
                                {fileSize && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {fileSize}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Far-right Download Icon */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(fileObj); }}
                              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                              title={`Download ${fileName}`}
                            >
                              <MdFileDownload size={26} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Actions: Reply / Forward */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const replyTo = isSent ? toEmail : fromEmail;
                  openCompose?.({
                    to: replyTo,
                    subject: subject?.startsWith('Re:') ? subject : `Re: ${subject}`,
                    mode: 'casbox'
                  });
                }}
                className="px-7 py-2.5 rounded-full font-bold text-sm transition-all duration-150 flex items-center gap-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-2xs text-gray-900 dark:text-gray-100 cursor-pointer"
              >
                <MdReply size={18} />
                <span>Reply</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  openCompose?.({
                    to: '',
                    subject: subject?.startsWith('Fwd:') ? subject : `Fwd: ${subject}`,
                    body: bodyContent,
                    mode: 'casbox'
                  });
                }}
                className="px-7 py-2.5 rounded-full font-bold text-sm transition-all duration-150 flex items-center gap-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-2xs text-gray-900 dark:text-gray-100 cursor-pointer"
              >
                <MdForward size={18} />
                <span>Forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  })() : null;

  const detailsComponent = selectedMessage ? (() => {
    const otherUserEmail = getOtherUserEmail(selectedMessage);
    const otherNorm = normalizeEmail(otherUserEmail);
    const isContactAccepted = isCashboxSenderAccepted(otherNorm, acceptedSet) || Boolean(selectedMessage?.isAccepted || selectedMessage?.accepted);
    const isContactRequest = Boolean(otherNorm && !isContactAccepted);
    const sortedThread = [...threadMessages].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));

    // Bulk action handlers for message selection mode
    const handleSelectAllMessages = () => {
      const allKeys = new Set();
      sortedThread.forEach(m => {
        const key = getMessageKey(m);
        if (key) allKeys.add(key);
      });
      setSelectedMessageItemIds(allKeys);
    };

    const handleBulkStarMessages = () => {
      if (selectedMessageItemIds.size === 0) return;
      const selectedIds = new Set(selectedMessageItemIds);
      const msgsToStar = sortedThread.filter(m => {
        const key = getMessageKey(m);
        return key && selectedIds.has(key);
      });

      if (msgsToStar.length === 0) return;

      const activeContact = (selectedMessage ? getOtherUserEmail(selectedMessage) : null) || '';
      const uKey = (user?.email || user?.username || 'default').toLowerCase();
      const allAlreadyStarred = msgsToStar.every(m => isMessageStarred(m));

      setStarredMessagesMap(prev => {
        const next = { ...prev };
        msgsToStar.forEach(msg => {
          const key = getMessageKey(msg);
          const mId = msg.id !== undefined && msg.id !== null ? msg.id : msg.uid;

          if (allAlreadyStarred) {
            if (key) delete next[key];
            if (mId !== undefined && mId !== null) {
              delete next[mId];
              delete next[String(mId)];
            }
          } else {
            const entry = {
              id: key,
              messageId: mId !== undefined && mId !== null ? String(mId) : key,
              contact: activeContact,
              contactNorm: normalizeEmail(activeContact),
              userId: uKey,
              timestamp: msg.timestamp || Date.now()
            };
            if (key) next[key] = entry;
            if (mId !== undefined && mId !== null) {
              next[String(mId)] = entry;
            }
          }
        });

        try {
          localStorage.setItem(`bnx_casbox_starred_map_${uKey}`, JSON.stringify(next));
          localStorage.setItem('bnx_casbox_starred_map', JSON.stringify(next));
          localStorage.setItem(`bnx_casbox_starred_messages_${uKey}`, JSON.stringify(Object.keys(next)));
          localStorage.setItem('bnx_casbox_starred_messages', JSON.stringify(Object.keys(next)));
        } catch (e) {}

        return next;
      });

      toast.success(allAlreadyStarred
        ? `${msgsToStar.length === 1 ? 'Message' : `${msgsToStar.length} messages`} unstarred`
        : `${msgsToStar.length === 1 ? 'Message' : `${msgsToStar.length} messages`} starred`
      );
      handleExitMessageSelectionMode();
    };

    const handleBulkDeleteMessages = () => {
      if (selectedMessageItemIds.size === 0) return;
      const selectedIds = new Set(selectedMessageItemIds);
      const msgsToDelete = sortedThread.filter(m => {
        const key = getMessageKey(m);
        return key && selectedIds.has(key);
      });

      if (msgsToDelete.length === 0) return;

      // Unpin any deleted messages if they were pinned
      setPinnedMessagesMap(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(cKey => {
          const pinned = next[cKey];
          if (pinned) {
            const pKey = getMessageKey(pinned);
            if (pKey && selectedIds.has(pKey)) {
              delete next[cKey];
              changed = true;
            }
          }
        });
        if (changed) {
          try {
            localStorage.setItem('bnx_casbox_pinned_messages', JSON.stringify(next));
          } catch (e) {}
        }
        return changed ? next : prev;
      });

      // Persist in deletedMessageIds
      setDeletedMessageIds(prev => {
        const updated = new Set(prev);
        msgsToDelete.forEach(m => {
          const targetId = m.id !== undefined ? m.id : m.uid;
          const strId = targetId !== undefined && targetId !== null ? String(targetId) : null;
          const fallbackId = `${m.timestamp}-${m.senderEmail || m.sender}-${m.receiverEmail || m.receiver}-${m.body}`;
          if (targetId !== undefined && targetId !== null) {
            updated.add(targetId);
            updated.add(strId);
          }
          if (fallbackId) updated.add(fallbackId);
        });
        try {
          const json = JSON.stringify(Array.from(updated));
          sessionStorage.setItem('bnx_casbox_deleted_message_ids', json);
          localStorage.setItem('bnx_casbox_deleted_message_ids', json);
        } catch (e) {}
        return updated;
      });

      const toDeleteKeys = new Set(msgsToDelete.map(m => getMessageKey(m)));
      setMessages(prev => prev.filter(m => !toDeleteKeys.has(getMessageKey(m))));
      setThreadMessages(prev => prev.filter(m => !toDeleteKeys.has(getMessageKey(m))));
      handleExitMessageSelectionMode();
      toast.success(msgsToDelete.length === 1 ? "Message deleted" : `${msgsToDelete.length} messages deleted`);
    };

    const handleBulkForwardMessages = () => {
      if (selectedMessageItemIds.size === 0) return;
      const selectedIds = new Set(selectedMessageItemIds);
      const msgsToForward = sortedThread
        .filter(m => {
          const key = getMessageKey(m);
          return key && selectedIds.has(key);
        })
        .sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));

      if (msgsToForward.length === 0) return;

      if (msgsToForward.length === 1) {
        const msg = msgsToForward[0];
        const isMe = isCurrentUser(msg?.senderEmail || msg?.sender);
        const sLabel = isMe ? (user?.username || 'You') : getDisplayName(msg.senderEmail || msg.sender, msg);
        handleInitiateForward(msg, sLabel);
      } else {
        const combinedBody = msgsToForward
          .map(m => {
            const body = cleanMessageBody(m.body || "");
            const isMe = isCurrentUser(m?.senderEmail || m?.sender);
            const author = isMe ? (user?.username || 'You') : getDisplayName(m.senderEmail || m.sender, m);
            return `[${author}]: ${body}`;
          })
          .filter(Boolean)
          .join("\n\n");

        setForwardingMessage({
          body: combinedBody,
          senderLabel: `${msgsToForward.length} selected messages`,
          timestamp: msgsToForward[msgsToForward.length - 1]?.timestamp || Date.now()
        });
        setForwardSearchTerm("");
        setSelectedForwardContactEmails(new Set());
      }

      handleExitMessageSelectionMode();
    };

    const handleBulkArchiveMessages = async () => {
      if (selectedMessageItemIds.size === 0) return;
      const selectedIds = new Set(selectedMessageItemIds);
      const msgsToArchive = sortedThread.filter(m => {
        const key = getMessageKey(m);
        return key && selectedIds.has(key);
      });

      if (msgsToArchive.length === 0) return;

      const targetIds = [];
      msgsToArchive.forEach(m => {
        const targetId = m.id !== undefined && m.id !== null ? m.id : m.uid;
        if (targetId !== undefined && targetId !== null) {
          targetIds.push(targetId);
        }
      });
      const targetIdSet = new Set(targetIds.map(String));

      try {
        setThreadMessages(prev => prev.filter(m => {
          const key = getMessageKey(m);
          const mId = String(m.id !== undefined ? m.id : m.uid);
          return !(key && selectedIds.has(key)) && !targetIdSet.has(mId);
        }));

        setMessages(prev => prev.map(m => {
          const mId = String(m.id !== undefined ? m.id : m.uid);
          return targetIdSet.has(mId) ? { ...m, isArchived: true, archived: true } : m;
        }));

        setArchivedMessageIds(prev => {
          const next = new Set(prev);
          targetIds.forEach(id => {
            next.add(id);
            next.add(String(id));
          });
          saveArchivedMessageIds(next);
          return next;
        });

        setUnarchivedMessageIds(prev => {
          const next = new Set(prev);
          targetIds.forEach(id => {
            next.delete(id);
            next.delete(String(id));
          });
          saveUnarchivedMessageIds(next);
          return next;
        });

        if (targetIds.length > 0) {
          const apiTargetIds = targetIds.map(id => {
            const num = Number(id);
            return !isNaN(num) ? num : id;
          });
          await casboxAPI.updateArchiveStatus(apiTargetIds, true);
        }

        toast.success(msgsToArchive.length === 1 ? "Message archived" : `${msgsToArchive.length} messages archived`);
        handleExitMessageSelectionMode();
      } catch (err) {
        console.error("Failed to archive selected messages", err);
        toast.error("Failed to archive messages");
        fetchMessages(true);
      }
    };

    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#121212] border-l border-gray-100 dark:border-gray-800 overflow-hidden relative">
        {/* WhatsApp-Style Message Selection Mode Bulk Action Toolbar */}
        {isMessageSelectionMode ? (
          <div
            className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 border-b shrink-0 relative z-20 bg-blue-50/90 dark:bg-[#1a2234] min-w-0 transition-colors select-none"
            style={{ borderColor: theme?.border || '#e2e8f0' }}
          >
            {/* Left: Close icon + selected count */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={handleExitMessageSelectionMode}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title="Close selection"
                aria-label="Close selection"
              >
                <MdClose size={20} />
              </button>
              <span className={`text-xs sm:text-sm font-bold truncate ${
                selectedMessageItemIds.size > 0 
                  ? 'text-gray-900 dark:text-gray-100' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {selectedMessageItemIds.size === 1
                  ? '1 selected'
                  : `${selectedMessageItemIds.size} selected`}
              </span>
            </div>

            {/* Right: Action Buttons (Star, Delete, Forward, Archive, Select/Deselect All) */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Star */}
              <button
                type="button"
                disabled={selectedMessageItemIds.size === 0}
                onClick={handleBulkStarMessages}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={selectedMessageItemIds.size === 0 ? "Select messages to star" : "Star selected messages"}
              >
                <MdStar size={18} className="text-yellow-500 dark:text-yellow-400 shrink-0" />
                <span className="hidden sm:inline">Star</span>
              </button>

              {/* Delete */}
              <button
                type="button"
                disabled={selectedMessageItemIds.size === 0}
                onClick={handleBulkDeleteMessages}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={selectedMessageItemIds.size === 0 ? "Select messages to delete" : "Delete selected messages"}
              >
                <MdDeleteOutline size={18} className="shrink-0" />
                <span className="hidden sm:inline">Delete</span>
              </button>

              {/* Forward */}
              <button
                type="button"
                disabled={selectedMessageItemIds.size === 0}
                onClick={handleBulkForwardMessages}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={selectedMessageItemIds.size === 0 ? "Select messages to forward" : "Forward selected messages"}
              >
                <MdForward size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden sm:inline">Forward</span>
              </button>

              {/* Archive */}
              <button
                type="button"
                disabled={selectedMessageItemIds.size === 0}
                onClick={handleBulkArchiveMessages}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={selectedMessageItemIds.size === 0 ? "Select messages to archive" : "Archive selected messages"}
              >
                <MdArchive size={18} className="text-gray-600 dark:text-gray-300 shrink-0" />
                <span className="hidden sm:inline">Archive</span>
              </button>

              <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-700 mx-0.5 sm:mx-1 shrink-0" />

              {/* Select all / Deselect all */}
              {selectedMessageItemIds.size > 0 && selectedMessageItemIds.size === sortedThread.length ? (
                <button
                  type="button"
                  onClick={handleClearMessageSelection}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Deselect all messages"
                >
                  <MdClose size={16} className="text-gray-500 shrink-0" />
                  <span className="hidden sm:inline">Deselect all</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={sortedThread.length === 0}
                  onClick={handleSelectAllMessages}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Select all messages"
                >
                  <MdCheckBox size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="hidden sm:inline">Select all</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b shrink-0 relative z-20 bg-white dark:bg-[#121212] min-w-0"
            style={{ borderColor: theme?.border || '#e2e8f0' }}
          >
            {/* Left: Back + Avatar + Name/Email */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Back button */}
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer shrink-0"
                title="Back"
              >
                <MdArrowBack size={20} />
              </button>

              {/* Divider */}
              <div className="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 shrink-0" />

              {/* Contact Avatar */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                {getContactInitial(otherUserEmail, selectedMessage)}
              </div>

              {/* Contact Name + Email */}
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate leading-tight"
                  title={getDisplayName(otherUserEmail, selectedMessage)}
                >
                  {getDisplayName(otherUserEmail, selectedMessage)}
                </span>
                <span
                  className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate leading-tight"
                  title={otherUserEmail}
                >
                  {otherUserEmail}
                </span>
              </div>
            </div>

            {/* Right: Star · Delete · More */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Starred Messages View Toggle */}
              <button
                type="button"
                onClick={() => setShowStarredMessagesView(prev => !prev)}
                className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer ${
                  showStarredMessagesView
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
                title={showStarredMessagesView ? "View chat history" : "Starred messages"}
                aria-label="Starred messages"
              >
                {showStarredMessagesView ? (
                  <MdStar size={20} className="text-blue-600 dark:text-blue-400" />
                ) : (
                  <MdStarBorder size={20} />
                )}
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  const other = getOtherUserEmail(selectedMessage);
                  setConversationToDelete({ contact: other });
                }}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                title="Delete conversation"
              >
                <MdDeleteOutline size={20} />
              </button>

              {/* More menu */}
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
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleOpenEditNameModal({ contact: otherUserEmail, latestMessage: selectedMessage });
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 cursor-pointer"
                    >
                      <MdEdit size={16} className="text-gray-500 dark:text-gray-400" />
                      {t('casbox.edit_contact_name', 'Edit Contact Name')}
                    </button>

                    {isBlockedContact(otherUserEmail) ? (
                      <button
                        type="button"
                        disabled={isProcessingBlockAction}
                        onClick={async () => {
                          setShowMoreMenu(false);
                          await handleUnblockUser(otherUserEmail);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <MdBlock size={16} />
                        Unblock User
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isProcessingBlockAction}
                        onClick={async () => {
                          setShowMoreMenu(false);
                          await handleBlockUser(otherUserEmail);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <MdBlock size={16} />
                        Block User
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setConversationToDelete({ contact: otherUserEmail });
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 cursor-pointer"
                    >
                      <MdDeleteOutline size={16} />
                      Delete Conversation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pinned message banner */}
        {(() => {
          const pinnedMsg = otherUserEmail ? pinnedMessagesMap[otherUserEmail.toLowerCase()] : null;
          if (!pinnedMsg) return null;
          return (
            <div
              onClick={() => handleScrollToMessage(pinnedMsg)}
              className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-gray-50/80 dark:bg-[#1a1a1a]/80 border-b border-gray-100 dark:border-gray-800 shrink-0 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-[#222]/80 transition-colors select-none relative z-10"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-gray-700 dark:text-gray-300">
                  <MdPushPin size={18} className="rotate-45" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 leading-tight">
                    Pinned message
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {getPinnedSenderLabel(pinnedMsg)}:
                    </span>{" "}
                    {cleanMessageBody(pinnedMsg.body) || "(Attachment)"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnpinMessage(otherUserEmail);
                }}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Unpin message"
              >
                <MdClose size={16} />
              </button>
            </div>
          );
        })()}

        {/* Message Thread Panel or Starred Messages View */}
        {showStarredMessagesView ? (
          <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
            {/* Starred Messages Header Banner */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-gray-50/70 dark:bg-[#1a1a1a]/70 border-b border-gray-100 dark:border-gray-800 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <MdStar size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Starred Messages
                </span>
                {allStarredMessages.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold">
                    {allStarredMessages.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowStarredMessagesView(false)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
              >
                Back to Chat
              </button>
            </div>

            {/* Starred Messages List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col hidden-scrollbar">
              {allStarredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                  <MdStarBorder className="text-3xl text-gray-300 dark:text-gray-600 mb-2" />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    No starred messages yet
                  </span>
                </div>
              ) : (
                allStarredMessages.map((msg, index) => {
                  const isMe = isCurrentUser(msg?.senderEmail || msg?.sender);
                  const senderEmail = msg.senderEmail || msg.sender || "";
                  const senderLabel = isMe ? (user?.username || senderEmail.split("@")[0]) : getDisplayName(senderEmail, msg);
                  const senderInitial = isMe ? (user?.username || senderEmail).charAt(0).toUpperCase() : getContactInitial(senderEmail, msg);
                  const msgTargetId = msg.id !== undefined ? msg.id : msg.uid;
                  const msgFallbackId = `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.body}`;
                  const msgUniqueId = msgTargetId !== undefined && msgTargetId !== null ? msgTargetId : msgFallbackId;

                  return (
                    <div key={`starred-item-${msgUniqueId || index}`} className="flex items-start gap-2.5 sm:gap-4 md:gap-5 w-full py-1 min-w-0">
                      {/* Left Column: Contact Card */}
                      <div className="w-16 sm:w-28 md:w-36 shrink-0 pt-0 select-none text-left">
                        <div 
                          className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl border relative shadow-sm w-full bg-gray-50/50 dark:bg-[#1e1e1e]/40 overflow-hidden"
                          style={{
                            borderColor: theme?.border || '#e2e8f0',
                            borderLeftWidth: '4px',
                            borderLeftColor: isMe ? (theme?.accent || '#135bec') : (theme?.mode === 'dark' ? '#4b5563' : '#d1d5db'),
                          }}
                        >
                          <div className="relative shrink-0">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                              isMe 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {senderInitial}
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 truncate" title={senderLabel}>
                              {senderLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Chat Message */}
                      <div className="flex-1 flex flex-col items-start min-w-0">
                        <div className="max-w-[92%] sm:max-w-[85%] flex flex-col items-start min-w-0 rounded-2xl">
                          <div className="flex items-center gap-1.5 sm:gap-2 relative group max-w-full">
                            {/* Bubble */}
                            <div
                              onClick={() => handleOpenOriginalConversation(msg)}
                              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm flex flex-col gap-1 max-w-full overflow-hidden cursor-pointer hover:opacity-95 transition-opacity ${
                                isMe ? 'rounded-tr-none text-white shadow-sm font-medium' : 'rounded-tl-none border shadow-sm font-medium'
                              }`}
                              style={{
                                backgroundColor: isMe ? (theme?.accent || '#135bec') : (theme?.mode === 'dark' ? '#1e1e1e' : '#f3f4f6'),
                                color: isMe ? '#ffffff' : (theme?.mode === 'dark' ? '#f3f4f6' : '#1f2937'),
                                borderColor: isMe ? 'transparent' : (theme?.border || '#e2e8f0')
                              }}
                              title="Click to open original conversation"
                            >
                              {renderForwardPreviewInBubble(msg, isMe)}
                              {renderReplyPreviewInBubble(msg, isMe)}
                              <p className="whitespace-pre-wrap leading-relaxed break-words">{cleanMessageBody(msg.body)}</p>
                              {renderBubbleAttachments(msg)}
                            </div>

                            {/* Blue star beside the bubble */}
                            <div className="shrink-0 flex items-center select-none" title="Starred message">
                              <MdStar size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            </div>

                            {/* Unstar action button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStarMessage(msg);
                              }}
                              className="p-1 rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              title="Unstar message"
                            >
                              <MdClose size={14} />
                            </button>
                          </div>

                          {/* Open in chat action below the bubble */}
                          <div className="flex items-center gap-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium select-none mt-0.5 ml-1 leading-none">
                            <button
                              type="button"
                              onClick={() => handleOpenOriginalConversation(msg)}
                              className="hover:underline cursor-pointer font-medium"
                            >
                              Open in chat
                            </button>
                          </div>

                          {/* Timestamp outside and below the bubble */}
                          <div className="text-[9px] mt-1 select-none font-normal text-gray-400 dark:text-gray-500 self-end mr-1 text-right">
                            {formatCashboxTime(msg?.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
        <div
          ref={chatContainerRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col hidden-scrollbar"
        >
          {loadingThread && threadMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
              Loading chat history...
            </div>
          ) : sortedThread.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
              <MdSend className="text-3xl text-gray-300 dark:text-gray-600 mb-2" />
              <span className="text-xs font-semibold">No messages in this chat yet</span>
            </div>
          ) : (
            sortedThread.map((msg, index) => {
              const isMe = isCurrentUser(msg?.senderEmail || msg?.sender);
              const senderEmail = msg.senderEmail || msg.sender || "";
              const senderLabel = isMe ? (user?.username || senderEmail.split("@")[0]) : getDisplayName(senderEmail, msg);
              const senderInitial = isMe ? (user?.username || senderEmail).charAt(0).toUpperCase() : getContactInitial(senderEmail, msg);
              const msgUniqueId = getMessageKey(msg) || String(msg.id !== undefined && msg.id !== null ? msg.id : (msg.uid || `${msg.timestamp}-${msg.senderEmail || msg.sender}-${msg.body}`));
              const currentUserId = (user?.email || user?.username || 'me').trim();

              const currentDateKey = getMessageDateKey(msg.timestamp);
              const prevDateKey = index > 0 ? getMessageDateKey(sortedThread[index - 1]?.timestamp) : null;
              const showDateSeparator = Boolean(currentDateKey && currentDateKey !== prevDateKey);

              return (
                <React.Fragment key={msgUniqueId || msg.id || index}>
                  {showDateSeparator && (
                    <div className="flex justify-center w-full select-none py-1.5">
                      <div className="px-4 py-1 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 shadow-2xs border border-gray-200/40 dark:border-gray-700/40">
                        {formatChatDateSeparator(msg.timestamp)}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 sm:gap-4 md:gap-5 w-full py-1 min-w-0">
                  {/* Left Column: Contact Card */}
                  <div className="w-16 sm:w-28 md:w-36 shrink-0 pt-0 select-none text-left">
                    <div 
                      className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl border relative shadow-sm w-full bg-gray-50/50 dark:bg-[#1e1e1e]/40 overflow-hidden"
                      style={{
                        borderColor: theme?.border || '#e2e8f0',
                        borderLeftWidth: '4px',
                        borderLeftColor: isMe ? (theme?.accent || '#135bec') : (theme?.mode === 'dark' ? '#4b5563' : '#d1d5db'),
                      }}
                    >
                      {/* Avatar Container */}
                      <div className="relative shrink-0">
                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                          isMe 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {senderInitial}
                        </div>
                        {/* Green online dot */}
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-[#121212]" />
                      </div>

                      {/* Details */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 truncate" title={senderLabel}>
                          {senderLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Chat Message */}
                  <div className="flex-1 flex flex-col items-start min-w-0">
                    <div 
                      id={`casbox-msg-${msgUniqueId}`}
                      className={`max-w-[92%] sm:max-w-[85%] flex flex-col items-start min-w-0 rounded-2xl transition-all duration-500 ${
                        highlightedMessageId === msgUniqueId ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-[#121212] bg-blue-100/60 dark:bg-blue-900/40 p-1 -m-1 shadow-md scale-[1.01]' : ''
                      }`}
                    >
                      {/* Bubble + Three Dot Action Container */}
                      <div className="flex items-center gap-1.5 sm:gap-2 relative group max-w-full">
                        {isMessageSelectionMode && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 flex items-center justify-center select-none py-1 px-0.5"
                          >
                            <input
                              type="checkbox"
                              id={`select-checkbox-${msgUniqueId}`}
                              checked={selectedMessageItemIds.has(msgUniqueId)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelectMessage(msgUniqueId);
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer accent-blue-600 transition-transform hover:scale-110"
                              title={selectedMessageItemIds.has(msgUniqueId) ? "Deselect message" : "Select message"}
                            />
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm flex flex-col gap-1 max-w-full overflow-hidden transition-all duration-150 ${
                            isMe ? 'rounded-tr-none text-white shadow-sm font-medium' : 'rounded-tl-none border shadow-sm font-medium'
                          } ${
                            selectedMessageItemIds.has(msgUniqueId)
                              ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-400 dark:border-blue-500 shadow-sm'
                              : ''
                          }`}
                          style={{
                            backgroundColor: selectedMessageItemIds.has(msgUniqueId)
                              ? (isMe ? '#2563eb' : (theme?.mode === 'dark' ? 'rgba(30, 58, 138, 0.45)' : '#eff6ff'))
                              : (isMe ? (theme?.accent || '#135bec') : (theme?.mode === 'dark' ? '#1e1e1e' : '#f3f4f6')),
                            color: selectedMessageItemIds.has(msgUniqueId) && !isMe
                              ? (theme?.mode === 'dark' ? '#bfdbfe' : '#1e3a8a')
                              : (isMe ? '#ffffff' : (theme?.mode === 'dark' ? '#f3f4f6' : '#1f2937')),
                            borderColor: selectedMessageItemIds.has(msgUniqueId)
                              ? '#3b82f6'
                              : (isMe ? 'transparent' : (theme?.border || '#e2e8f0'))
                          }}
                        >
                          {renderForwardPreviewInBubble(msg, isMe)}
                          {renderReplyPreviewInBubble(msg, isMe)}
                          <p className="whitespace-pre-wrap leading-relaxed break-words">{cleanMessageBody(msg.body)}</p>
                          {renderBubbleAttachments(msg)}
                        </div>

                        {/* Star indicator beside the message bubble */}
                        {isMessageStarred(msg) && (
                          <div className="shrink-0 flex items-center select-none" title="Starred message">
                            <MdStar size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          </div>
                        )}

                        {/* Reaction Badges Beside Bubble */}
                        {(() => {
                          const msgReactions = reactionsMap[msgUniqueId];
                          if (!msgReactions || Object.keys(msgReactions).length === 0) return null;

                          return (
                            <div className="flex items-center gap-1 shrink-0 select-none">
                              {Object.entries(msgReactions).map(([emoji, reactors]) => {
                                if (!reactors || reactors.length === 0) return null;
                                const hasReacted = reactors.some(u => typeof u === 'string' && u.trim() === currentUserId);
                                const tooltipText = reactors.map(r => (typeof r === 'string' && r.trim() === currentUserId) ? 'You' : (r.includes('@') ? r.split('@')[0] : r)).join(', ');

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleReaction(msgUniqueId, emoji);
                                    }}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs shadow-2xs cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                                      hasReacted
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 font-semibold text-blue-700 dark:text-blue-300'
                                        : 'bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                    title={`${tooltipText} reacted with ${emoji}`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[11px] font-medium leading-none">{reactors.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Action Trigger Buttons: Smiley Icon + Three-Dot Menu */}
                        {!isMessageSelectionMode && (
                          <div className="relative shrink-0 flex items-center gap-0.5">
                            {/* Smiley Icon Button for Emoji Reactions */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMessageMenuId(null);
                                setActiveReactionMsgId(prev => prev === msgUniqueId ? null : msgUniqueId);
                                setShowFullEmojiPicker(false);
                                setEmojiSearchTerm("");
                              }}
                              className={`p-1 sm:p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer ${
                                activeReactionMsgId === msgUniqueId ? 'opacity-100 text-gray-700 dark:text-gray-200' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                              }`}
                              title="Add reaction"
                            >
                              <MdOutlineEmojiEmotions size={18} />
                            </button>

                            {/* Three-Dot Menu Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactionMsgId(null);
                                setShowFullEmojiPicker(false);
                                setActiveMessageMenuId(prev => prev === msgUniqueId ? null : msgUniqueId);
                              }}
                              className={`p-1 sm:p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer ${
                                activeMessageMenuId === msgUniqueId ? 'opacity-100 text-gray-700 dark:text-gray-200' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                              }`}
                              title="Message actions"
                            >
                              <MdMoreVert size={18} />
                            </button>

                            {/* Quick Reaction Floating Bar & Full Picker */}
                            {activeReactionMsgId === msgUniqueId && (
                              <div
                                ref={reactionBarRef}
                                className={`absolute z-50 flex flex-col items-start ${
                                  index >= sortedThread.length - 2
                                    ? 'bottom-0 left-full ml-1.5'
                                    : 'top-0 left-full ml-1.5'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Quick Reactions Pill */}
                                <div className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-700 rounded-full shadow-lg px-2.5 py-1 flex items-center gap-1.5 select-none animate-in fade-in zoom-in-95 duration-150">
                                  {QUICK_REACTIONS.map((emoji) => {
                                    const isSelected = (reactionsMap[msgUniqueId]?.[emoji] || []).some(u => typeof u === 'string' && u.trim() === currentUserId);
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(msgUniqueId, emoji)}
                                        className={`w-7 h-7 flex items-center justify-center text-lg hover:scale-130 active:scale-95 transition-all cursor-pointer rounded-full ${
                                          isSelected ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-500 scale-110' : 'hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                        title={isSelected ? `${emoji} (Click to remove)` : emoji}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => setShowFullEmojiPicker(prev => !prev)}
                                    className={`w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-sm font-bold ${
                                      showFullEmojiPicker ? 'bg-black/10 dark:bg-white/20 text-gray-900 dark:text-white' : ''
                                    }`}
                                    title="More emojis"
                                  >
                                    <MdAdd size={16} />
                                  </button>
                                </div>

                                {/* Full Emoji Picker */}
                                {showFullEmojiPicker && (
                                  <div
                                    className={`mt-2 w-72 sm:w-80 bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl p-3 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 ${
                                      index >= sortedThread.length - 2 ? 'absolute bottom-full mb-2 left-0' : ''
                                    }`}
                                    style={{ borderColor: theme?.border || '#e2e8f0' }}
                                  >
                                    {/* Search bar */}
                                    <div className="relative mb-2">
                                      <input
                                        type="text"
                                        placeholder="Search emoji..."
                                        value={emojiSearchTerm}
                                        onChange={(e) => setEmojiSearchTerm(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                                      />
                                      <MdSearch className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    </div>

                                    {/* Category Tabs */}
                                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1.5 mb-2 px-1">
                                      {EMOJI_CATEGORIES.map(cat => (
                                        <button
                                          key={cat.id}
                                          type="button"
                                          onClick={() => { setActiveEmojiCategory(cat.id); setEmojiSearchTerm(''); }}
                                          className={`p-1 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer ${
                                            activeEmojiCategory === cat.id && !emojiSearchTerm ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 scale-110' : 'text-gray-500 opacity-70 hover:opacity-100'
                                          }`}
                                          title={cat.name}
                                        >
                                          {cat.icon}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Category Title */}
                                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
                                      {emojiSearchTerm ? `Search results for "${emojiSearchTerm}"` : (EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.name || 'Smileys & People')}
                                    </div>

                                    {/* Emoji Grid */}
                                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto hidden-scrollbar px-0.5">
                                      {(() => {
                                        const term = emojiSearchTerm.trim().toLowerCase();
                                        let list = [];
                                        if (term) {
                                          EMOJI_CATEGORIES.forEach(c => {
                                            c.emojis.forEach(e => {
                                              if (e.name.toLowerCase().includes(term) && !list.some(x => x.emoji === e.emoji)) {
                                                list.push(e);
                                              }
                                            });
                                          });
                                        } else {
                                          const cat = EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory) || EMOJI_CATEGORIES[0];
                                          list = cat.emojis;
                                        }

                                        if (list.length === 0) {
                                          return (
                                            <div className="col-span-8 py-6 text-center text-xs text-gray-400">
                                              No emojis found
                                            </div>
                                          );
                                        }

                                        return list.map(item => {
                                          const isSelected = (reactionsMap[msgUniqueId]?.[item.emoji] || []).some(u => typeof u === 'string' && u.trim() === currentUserId);
                                          return (
                                            <button
                                              key={item.emoji + item.name}
                                              type="button"
                                              onClick={() => handleToggleReaction(msgUniqueId, item.emoji)}
                                              className={`w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:scale-125 transition-all cursor-pointer select-none ${
                                                isSelected ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-500 scale-110' : 'hover:bg-black/5 dark:hover:bg-white/10'
                                              }`}
                                              title={isSelected ? `${item.name} (Click to remove)` : item.name}
                                            >
                                              {item.emoji}
                                            </button>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Three-Dot Dropdown Menu */}
                            {activeMessageMenuId === msgUniqueId && (
                              <div
                                ref={messageMenuRef}
                                className={`absolute left-full ml-1.5 z-50 min-w-[125px] bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-1.5 px-1 animate-in fade-in zoom-in-95 duration-150 select-none ${
                                  index >= sortedThread.length - 2 ? 'bottom-0' : 'top-0'
                                }`}
                                style={{ borderColor: theme?.border || '#e2e8f0' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleInitiateReply(msg, senderLabel)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdReply size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                  <span>Reply</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleInitiateForward(msg, senderLabel)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdForward size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                  <span>Forward</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleTogglePinMessage(msg, senderLabel, otherUserEmail)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdPushPin size={16} className={`shrink-0 ${isCurrentMessagePinned(msg, otherUserEmail) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                  <span>{isCurrentMessagePinned(msg, otherUserEmail) ? 'Unpin' : 'Pin'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStarMessage(msg)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdStar size={16} className={`shrink-0 ${isMessageStarred(msg) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                  <span>{isMessageStarred(msg) ? 'Unstar Message' : 'Star Message'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMessageMenuId(null);
                                    handleArchiveMessage(msg, e);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdArchive size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                  <span>Archive</span>
                                </button>

                                {isMe && isMessageEditable(msg) && (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateEdit(msg)}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <MdEdit size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateUnsend(msg)}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <MdRestore size={16} className="text-red-600 shrink-0" />
                                    <span>Unsend</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleEnterMessageSelectionMode(msgUniqueId)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdCheckBox size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                  <span>Select</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePersonalChatMessage(msg)}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <MdDeleteOutline size={16} className="text-red-600 shrink-0" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Edited Label */}
                      {(msg?.isEdited || msg?.edited) && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal select-none mt-0.5 ml-1 leading-none">
                          Edited
                        </div>
                      )}

                      {/* Timestamp outside and below the bubble */}
                      <div 
                        className="text-[9px] mt-1 select-none font-normal text-gray-400 dark:text-gray-500 self-end mr-1 text-right"
                      >
                        {formatCashboxTime(msg?.timestamp)}
                      </div>

                      {isMe && index === sortedThread.length - 1 && (
                        <div className="mt-1 mr-1">
                          {getStatusIcon(msg?.status)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
          )}
          <div ref={chatEndRef} />
        </div>
        )}

        {/* Footer Accept Request or Message Input */}
        <div
          className="p-4 border-t bg-white dark:bg-[#121212] shrink-0"
          style={{ borderColor: theme?.border || '#e2e8f0' }}
        >
          {isBlockedContact(otherUserEmail) ? (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/40 text-red-900 dark:text-red-200 text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <MdBlock size={16} className="text-red-500" /> You have blocked this user. Unblock to send messages.
              </span>
              <button
                type="button"
                onClick={() => handleUnblockUser(otherUserEmail)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Unblock
              </button>
            </div>
          ) : isDisconnectedContact(otherUserEmail) ? (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs">
              <span className="font-semibold">Cannot send message. This connection is disconnected.</span>
              <button
                type="button"
                disabled={isUpdatingConnection}
                onClick={() => {
                  const conn = connections.find(c => {
                    const cEmail = c.contactEmail?.toLowerCase();
                    const cUser = c.contactUsername?.toLowerCase();
                    const other = otherUserEmail.toLowerCase();
                    return cEmail === other || cUser === other || (other.includes('@') && cUser === other.split('@')[0]);
                  });
                  if (conn) handleReconnect(conn);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
              >
                Reconnect
              </button>
            </div>
          ) : isContactRequest && isCurrentUser(selectedMessage?.receiverEmail || selectedMessage?.receiver) ? (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => handleAcceptRequest(otherUserEmail)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all text-sm cursor-pointer border-0"
                style={{ background: theme?.accent || "#135bec" }}
              >
                <MdCheck size={18} /> Accept
              </button>
              <button
                onClick={() => handleBlockRequest(otherUserEmail)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold shadow-sm hover:shadow transition-all text-sm cursor-pointer text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-100 dark:border-red-950/30"
              >
                <MdClose size={18} /> Block
              </button>
            </div>
          ) : (
            <div className="flex flex-col w-full">
              {/* WhatsApp-style Compact Reply Preview */}
              {replyingToMessage && (
                <div 
                  className="mb-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1e1e1e] border-l-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
                  style={{ borderColor: theme?.accent || '#135bec' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MdReply size={18} className="shrink-0" style={{ color: theme?.accent || '#135bec' }} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span 
                        className="text-xs font-bold truncate leading-tight"
                        style={{ color: theme?.accent || '#135bec' }}
                      >
                        {replyingToMessage.senderLabel}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
                        {cleanMessageBody(replyingToMessage.body) || "(Attachment)"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Cancel reply"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              )}

              {/* Edit Message Banner */}
              {editingMessage && (
                <div 
                  className="mb-2.5 px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border-l-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
                  style={{ borderColor: theme?.accent || '#135bec' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MdEdit size={18} className="shrink-0" style={{ color: theme?.accent || '#135bec' }} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span 
                        className="text-xs font-bold truncate leading-tight"
                        style={{ color: theme?.accent || '#135bec' }}
                      >
                        Edit Message
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
                        {cleanMessageBody(editingMessage.body)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelEditMessage}
                      className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditMessage}
                      disabled={savingEdit || !newChatText.trim()}
                      className="px-3 py-1 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                      style={{ backgroundColor: theme?.accent || '#135bec' }}
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={editingMessage ? (e) => { e.preventDefault(); handleSaveEditMessage(); } : handleSendChatMessage}
                className="flex items-center gap-3 bg-transparent w-full relative"
              >
                <div className="relative shrink-0 flex items-center" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer flex items-center justify-center shrink-0"
                    title="Insert Emoji"
                  >
                    <MdInsertEmoticon size={20} />
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
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                  value={newChatText}
                  onChange={(e) => setNewChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && editingMessage) {
                      e.preventDefault();
                      handleCancelEditMessage();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                  style={{ borderColor: theme?.border || '#e2e8f0', color: theme?.text || '#000' }}
                  disabled={sendingChat || savingEdit}
                />
                <button
                  type="submit"
                  disabled={sendingChat || savingEdit || !newChatText.trim()}
                  className="p-2.5 rounded-full text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm shrink-0 border-0"
                  style={{ backgroundColor: theme?.accent || "#135bec" }}
                  title={editingMessage ? "Save edit" : "Send message"}
                >
                  {editingMessage ? <MdCheck size={18} /> : <MdSend size={18} />}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 5-Second Undo Toast Notification for Personal Chat */}
        <MessageUndoToast
          pending={activePersonalUndoToast}
          onUndo={handleUndoPersonalDelete}
          onDismiss={handleDismissPersonalToast}
          positionClass="bottom-20 left-1/2 -translate-x-1/2"
        />
      </div>
    );
  })() : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 bg-gray-50/30 dark:bg-[#1e1e1e]/30 border-l border-gray-100 dark:border-gray-800">
      <MdSend className="text-6xl mb-4 opacity-50" />
      <p className="text-base font-medium">Select a message to read</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col h-full w-full bg-white dark:bg-[#121212] relative overflow-hidden">
        <ReadingPaneLayout
          mode={readingPaneMode || 'no_split'}
          hasSelection={Boolean(selectedSentDetail || selectedMessage)}
          headerComponent={headerComponent}
          listComponent={listComponent}
          detailsComponent={selectedSentDetail ? sentDetailComponent : detailsComponent}
        />

        {previewFile && (
          <div className="fixed inset-0 bg-black/90 z-[1000] flex flex-col animate-fade-in">
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
                  onClick={() => handleDownloadAttachment(previewFile.rawFileObj)}
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
                    onClick={() => handleDownloadAttachment(previewFile.rawFileObj)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <MdFileDownload size={15} /> Download Attachment
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showBlockedModal && (
          <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <MdBlock className="text-red-500" size={20} /> Blocked Users
                </h3>
                <button
                  onClick={() => setShowBlockedModal(false)}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 transition-colors"
                >
                  <MdClose size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {deduplicatedBlockedContacts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <MdCheck className="mx-auto text-4xl mb-3 opacity-30 text-green-500" />
                    <p>No blocked users</p>
                  </div>
                ) : (
                  deduplicatedBlockedContacts.map((contact) => (
                    <div key={contact.groupKey || contact.displayValue} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors mx-2 my-1">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate pr-4">{contact.displayValue}</span>
                      <button
                        type="button"
                        disabled={isProcessingBlockAction}
                        onClick={() => handleUnblockUser(contact.primaryIdentifier || contact.displayValue)}
                        className="px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {conversationToDelete && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isDeletingConversation) {
                setConversationToDelete(null);
              }
            }}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4 mx-auto">
                <MdDeleteOutline size={26} />
              </div>

              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                Delete this conversation?
              </h3>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                This will delete all messages with <span className="font-medium text-gray-700 dark:text-gray-300">{getDisplayName(conversationToDelete.contact, conversationToDelete.latestMessage)}</span>. This action cannot be undone.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingConversation}
                  onClick={() => setConversationToDelete(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingConversation}
                  onClick={handleDeleteConversation}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingConversation && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditNameModal && editingContact && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isSavingAlias) {
                setShowEditNameModal(false);
                setEditingContact(null);
              }
            }}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 mx-auto">
                <MdEdit size={24} />
              </div>

              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-1">
                {t('casbox.edit_contact_name', 'Edit Contact Name')}
              </h3>

              <div className="text-center mb-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Current Name:{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {editingContact.currentName}
                  </span>
                </div>
                {editingContact.hasCustomAlias && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Original username:{" "}
                    <span className="font-mono text-gray-600 dark:text-gray-300">
                      {editingContact.originalName}
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveContactName}>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                    Custom Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={customNameInput}
                    onChange={(e) => setCustomNameInput(e.target.value.slice(0, 20))}
                    placeholder={editingContact.originalName || "e.g. Rahul"}
                    maxLength={20}
                    disabled={isSavingAlias}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-black/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 transition-all"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                      Only you will see this name. The contact's account name is not changed.
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-mono shrink-0 ml-2">
                      {(customNameInput || "").length} / 20
                    </span>
                  </div>
                </div>

                {editingContact.hasCustomAlias && (
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      disabled={isSavingAlias}
                      onClick={() => setCustomNameInput("")}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      Clear custom name (restore original)
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    type="button"
                    disabled={isSavingAlias}
                    onClick={() => {
                      setShowEditNameModal(false);
                      setEditingContact(null);
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAlias || (customNameInput || "").length > 20}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: theme?.accent || "#135bec" }}
                  >
                    {isSavingAlias && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {connectionToDisconnect && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isUpdatingConnection) {
                setConnectionToDisconnect(null);
              }
            }}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                Disconnect from {connectionToDisconnect.contactDisplayName || connectionToDisconnect.contactUsername}?
              </h3>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                Disconnecting will remove this chat from your Cashbox. Your existing account and connection request information will be preserved.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isUpdatingConnection}
                  onClick={() => setConnectionToDisconnect(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingConnection}
                  onClick={handleConfirmDisconnect}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingConnection && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}
        {showDeleteConfirmModal && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isDeletingSelected) setShowDeleteConfirmModal(false);
            }}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4 mx-auto">
                <MdDeleteOutline size={26} />
              </div>

              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                {selectedRowIds.size > 1 ? `Delete ${selectedRowIds.size} selected messages?` : 'Delete this message?'}
              </h3>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to delete {selectedRowIds.size === 1 ? 'this message' : `these ${selectedRowIds.size} messages`}? This action cannot be undone.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingSelected}
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingSelected}
                  onClick={handleDeleteSelectedMessages}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingSelected && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {messageToDelete && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isDeletingMessage) setMessageToDelete(null);
            }}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4 mx-auto">
                <MdDeleteOutline size={26} />
              </div>

              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                Delete this message?
              </h3>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to delete this message? This action cannot be undone.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingMessage}
                  onClick={() => setMessageToDelete(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingMessage}
                  onClick={handleConfirmDeleteMessage}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingMessage && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unsend Confirmation Modal */}
        {unsendMessageTarget && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={() => setUnsendMessageTarget(null)}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden p-6 border border-gray-100 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4 mx-auto">
                <MdRestore size={26} />
              </div>

              <h3 className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                Unsend message?
              </h3>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                Are you sure you want to unsend this message? This will remove the message for everyone in this conversation.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setUnsendMessageTarget(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnsendMessage}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Unsend
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forward Message Modal */}
        {forwardingMessage && (
          <div
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm"
            onClick={handleCloseForwardModal}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <MdForward size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight">
                      Forward Message
                    </h3>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      Select contacts to forward to
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForwardModal}
                  disabled={isSendingForward}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
                >
                  <MdClose size={18} />
                </button>
              </div>

              {/* Original Message Preview Box */}
              <div className="px-4 pt-3 pb-1">
                <div className="bg-gray-50 dark:bg-black/30 border border-gray-200/80 dark:border-gray-800 rounded-xl p-3 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      Original from: <span className="text-gray-700 dark:text-gray-200 font-bold">{forwardingMessage.senderLabel}</span>
                    </span>
                    {forwardingMessage.timestamp && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatSentDetailDateTime(forwardingMessage.timestamp) || formatCashboxTime(forwardingMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-200 line-clamp-3 leading-relaxed whitespace-pre-wrap break-words">
                    {cleanMessageBody(forwardingMessage.body) || (
                      <span className="italic text-gray-400">No text content</span>
                    )}
                  </p>
                  {forwardingMessage.attachmentsJson && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      <MdAttachFile size={13} />
                      <span>{parseMessageAttachments(forwardingMessage.attachmentsJson).length} attachment(s)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Search Input */}
              <div className="px-4 py-2">
                <div className="relative">
                  <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={forwardSearchTerm}
                    onChange={(e) => setForwardSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-white/5 border border-transparent focus:border-blue-500 dark:focus:border-blue-400 rounded-xl outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-all"
                    autoFocus
                  />
                  {forwardSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setForwardSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <MdClose size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Contacts Selection List */}
              <div className="flex-1 overflow-y-auto px-3 py-1 divide-y divide-gray-100/80 dark:divide-gray-800/60 min-h-[160px] max-h-[260px]">
                {filteredForwardContacts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500">
                    {forwardSearchTerm ? "No matching contacts found." : "No available contacts to forward to."}
                  </div>
                ) : (
                  filteredForwardContacts.map((contact) => {
                    const identKey = normalizeEmail(contact.sendIdentifier || contact.email || contact.username);
                    const isSelected = selectedForwardContactEmails.has(identKey);
                    return (
                      <div
                        key={contact.id || identKey}
                        onClick={() => handleToggleForwardContact(identKey)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors select-none ${
                          isSelected
                            ? "bg-blue-50/70 dark:bg-blue-950/30"
                            : "hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent"
                          }`}
                        >
                          {isSelected && <MdCheck size={12} className="stroke-[3]" />}
                        </div>

                        {/* Avatar */}
                        <ConnectionAvatar
                          profilePicture={contact.profilePicture}
                          profilePictureUrl={contact.profilePictureUrl}
                          displayName={contact.displayName}
                          username={contact.username}
                          email={contact.email || contact.sendIdentifier}
                          className="w-8 h-8 shrink-0"
                        />

                        {/* Contact Name & Email */}
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate leading-tight">
                            {contact.displayName || contact.username || contact.email || contact.sendIdentifier}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {contact.email || contact.username || contact.sendIdentifier}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {selectedForwardContactEmails.size} {selectedForwardContactEmails.size === 1 ? 'contact' : 'contacts'} selected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseForwardModal}
                    disabled={isSendingForward}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendForward}
                    disabled={selectedForwardContactEmails.size === 0 || isSendingForward}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-sm ${
                      selectedForwardContactEmails.size === 0 || isSendingForward
                        ? "opacity-50 cursor-not-allowed bg-blue-600"
                        : "bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer"
                    }`}
                    style={{ backgroundColor: theme?.accent || '#135bec' }}
                  >
                    {isSendingForward ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Forwarding...</span>
                      </>
                    ) : (
                      <>
                        <MdForward size={16} />
                        <span>Forward{selectedForwardContactEmails.size > 0 ? ` (${selectedForwardContactEmails.size})` : ''}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Casbox;
