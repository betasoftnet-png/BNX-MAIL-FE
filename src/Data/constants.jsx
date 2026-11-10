import React from 'react';
import {
  MdInbox,
  MdStarBorder,
  MdSend,
  MdDrafts,
  MdArchive,
  MdReport,
  MdDelete,
  MdMail,
  MdGroup,
  MdChat,
  MdAssignment,
  MdSchedule,
  MdAccessTime,
  MdNotifications,
  MdTrendingUp,
  MdAllInbox,
  MdLayers,
  MdMailOutline,
  MdNotificationsNone,
  MdBackup,
  MdLabel,
  MdLabelImportant
} from 'react-icons/md';

export const SIDEBAR_ITEMS = [
  {
    name: 'All Inbox',
    icon: <MdLayers size={20} />,
    path: '/all-inbox',
    count: 0
  },
  {
    name: 'Inbox',
    icon: <MdInbox size={20} />,
    path: '/inbox',
    count: 0
  },
  {
    name: 'Starred',
    icon: <MdStarBorder size={20} />,
    path: '/starred',
    count: 0
  },
  {
    name: 'Snoozed',
    icon: <MdAccessTime size={20} />,
    path: '/snoozed',
    count: 0
  },
  {
    name: 'Important',
    icon: <MdLabelImportant size={20} />,
    path: '/inbox?tab=IMPORTANT',
    count: 0
  },
  {
    name: 'Sent',
    icon: <MdSend size={20} />,
    path: '/sent',
    count: 0
  },
  {
    name: 'Scheduled',
    icon: <MdAccessTime size={20} />,
    path: '/scheduled',
    count: 0
  },
  {
    name: 'Draft',
    icon: <MdDrafts size={20} />,
    path: '/draft',
    count: 0
  },
  {
    name: 'Archive',
    icon: <MdArchive size={20} />,
    path: '/archive',
    count: 0
  },
  {
    name: 'Spam',
    icon: <MdReport size={20} />,
    path: '/spam',
    count: 0
  },
  {
    name: 'Trash',
    icon: <MdDelete size={20} />,
    path: '/trash',
    count: 0
  },
  {
    name: 'All Mail',
    icon: <MdMail size={20} />,
    path: '/allmail',
    count: 0
  },
  {
    name: 'Templates',
    icon: <MdAssignment size={20} />,
    path: '/templates',
    count: 0
  },
  {
    name: 'Colab',
    icon: <MdGroup size={20} />,
    path: '/colab',
    count: 0
  },
  {
    name: 'Chat',
    icon: <MdChat size={20} />,
    path: '/chat',
    count: 0
  },
  {
    name: 'Unread',
    icon: <MdMailOutline size={20} />,
    path: '/unread',
    count: 0
  },
  {
    name: 'Subscriptions',
    icon: <MdNotifications size={20} />,
    path: '/subscriptions',
    count: 0
  },
  {
    name: 'Manage Labels',
    icon: <MdLabel size={20} />,
    path: '/settings/labels',
    count: 0
  },
  {
    name: 'Analytics',
    icon: <MdTrendingUp size={20} />,
    path: '/analytics',
    count: 0
  },
  {
    name: 'Mail Backup',
    icon: <MdBackup size={20} />,
    path: '/mail-backup',
    count: 0
  }
];

export const EMAIL_CATEGORIES = {
  PRIMARY: 'primary',
  SOCIAL: 'social',
  PROMOTIONS: 'promotions',
  UPDATES: 'updates',
  JOB: 'job'
};

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    SESSIONS: '/api/auth/sessions',
    CHANGE_PASSWORD: '/api/auth/change-password',
    FORGOT_PASSWORD_OPTIONS: '/api/auth/forgot-password/options',
    SEND_OTP: '/api/auth/forgot-password/send-otp',
    VERIFY_OTP: '/api/auth/forgot-password/verify-otp',
    RESET_PASSWORD: '/api/auth/reset-password'
  },
  MAIL: {
    INBOX: '/api/mail/inbox',
    SENT: '/api/mail/sent',
    STARRED: '/api/mail/starred',
    TRASH: '/api/mail/trash',
    SPAM: '/api/mail/spam',
    SNOOZED: '/api/mail/snoozed',
    ARCHIVE: '/api/mail/archive',
    DRAFTS: '/api/mail/draft',
    MOVE_ARCHIVE: '/api/mail/archive',
    UNARCHIVE: '/api/mail/unarchive',
    SEND: '/api/mail/send',
    STAR: '/api/mail/star',
    EMAIL: '/api/mail/email',
    READ: '/api/mail/read',
    UNREAD: '/api/mail/unread',
    UNREAD_LIST: '/api/mail/unread',
    MOVE_TRASH: '/api/mail/trash',
    RESTORE: '/api/mail/restore',
    PERMANENT: '/api/mail/permanent',
    SNOOZE: '/api/mail/snooze',
    LABELS: '/api/mail/labels',
    APPLY_LABEL: '/api/mail/labels/apply',
    REMOVE_LABEL: '/api/mail/labels/remove',
    CATEGORY: '/api/mail/category',
    UNSUBSCRIBE: '/api/mail/unsubscribe',
    SUBSCRIBE: '/api/mail/subscribe',
    SUBSCRIPTIONS: '/api/mail/subscriptions',
    RECIPIENTS_AUTOCOMPLETE: '/api/mail/recipients/autocomplete'
  },
  EMAILS: {
    CREATE: '/api/emails/create',
    LIST: '/api/emails/list',
    SET_PRIMARY: '/api/emails/:emailId/set-primary'
  },
  USERS: {
    SETTINGS: '/api/users/settings',
    ACTIVITY_LOGS: '/api/users/activity-logs',
    RECOVERY: '/api/users/recovery'
  },
  SIGNATURES: {
    BASE: '/api/signatures',
  },
  BUSINESS: {
    REGISTER: '/api/business/register',
    DOMAINS: '/api/business/domains',
    VERIFY: '/api/business/domain/:id/verify'
  },
  GROUPS: {
    CREATE: '/api/groups/create',
    LIST: '/api/groups/',
    MEMBERS: '/api/groups/:id/members',
    SEND: '/api/groups/:id/send'
  },
  CHAT: {
    BASE: '/api/chat',
    DIRECT: '/api/chat/direct',
    GROUP: '/api/chat/group',
    USER_CHATS: '/api/chat/user/:email',
    MESSAGES: '/api/chat/:chatId/messages',
    SEND_MESSAGE: '/api/chat/message'
  }
};
