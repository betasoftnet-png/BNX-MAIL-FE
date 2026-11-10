import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { Calendar, X } from "lucide-react";
import { getDateFilterLabel } from "../utils/dateFilter";
import { mailAPI } from "../services/api";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import {
  MdRefresh,
  MdInbox,
  MdLocalOffer,
  MdPeople,
  MdInfo,
  MdLabelImportant,
  MdSend,
  MdDrafts,
  MdStar,
  MdDelete,
  MdEdit,
  MdCheck,
  MdWork,
  MdSchedule,
  MdAccessTime,
  MdMailOutline,
  MdReport,
  MdShoppingBag,
  MdForum,
  MdLabel
} from "react-icons/md";
import toast from "react-hot-toast";
import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";
import { canAccessAllInbox } from "../utils/accountUtils";
import {
  isSystemLabelVisibleInLabelList,
  isCategoryVisibleInLabelList,
  isLabelVisibleInSidebar
} from "../utils/labelPreferences";

const Inbox = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode, sidebarPreferences } = useTheme();
  const { user } = useAuth();
  const {
    emails,
    loading,
    isRefreshing,
    fetchEmails,
    refreshEmails,
    handleToggleStar,
    handleMoveToTrash,
    handleMarkRead,
    handleSnooze,
    handleApplyLabel,
    handleArchive,
    openCompose,
    matchesDateFilter,
    dateFilter,
    customDateRange,
    resetDateFilter,
    isEmailRead,
    labels = []
  } = useMail();

  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [selectedEmailOverride, setSelectedEmailOverride] = useState(null);
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    const handlePrefsChange = () => setPrefsTick((t) => t + 1);
    window.addEventListener("bnx-label-prefs-changed", handlePrefsChange);
    window.addEventListener("storage", handlePrefsChange);
    return () => {
      window.removeEventListener("bnx-label-prefs-changed", handlePrefsChange);
      window.removeEventListener("storage", handlePrefsChange);
    };
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab');
      if (t) return t.toUpperCase();
    } catch (e) {}
    return 'ALL';
  });

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get('tab');
    if (t) {
      setActiveTab(t.toUpperCase());
    }
  }, [location.search]);

  const baseSelectedEmail = emails.find((e) => String(e.uid ?? e.id) === String(selectedEmailUid)) ||
    (selectedEmailOverride && (String(selectedEmailOverride.uid ?? selectedEmailOverride.id) === String(selectedEmailUid)) ? selectedEmailOverride : null);
  const selectedEmail = baseSelectedEmail ? {
    ...baseSelectedEmail,
    isRead: isEmailRead ? (isEmailRead(baseSelectedEmail.uid ?? baseSelectedEmail.id) || baseSelectedEmail.isRead) : baseSelectedEmail.isRead
  } : null;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const handleToggleSelect = (uid) => {
    const strUid = String(uid);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(strUid)) next.delete(strUid);
      else next.add(strUid);
      return next;
    });
  };

  const availableTabs = useMemo(() => {
    const system = [
      { id: 'ALL', label: t('sidebar.inbox', 'Inbox'), icon: MdInbox, color: theme.accent || '#135bec', sysKey: 'Inbox', category: true },
      { id: 'STARRED', label: t('sidebar.starred', 'Starred'), icon: MdStar, color: '#eab308', sysKey: 'Starred', category: false },
      { id: 'SNOOZED', label: t('sidebar.snoozed', 'Snoozed'), icon: MdAccessTime, color: '#f59e0b', sysKey: 'Snoozed', category: false },
      { id: 'IMPORTANT', label: t('sidebar.important', 'Important'), icon: MdLabelImportant, color: '#eab308', sysKey: 'Important', category: true },
      { id: 'SENT', label: t('sidebar.sent', 'Sent'), icon: MdSend, color: '#8b5cf6', sysKey: 'Sent', category: false },
      { id: 'SCHEDULED', label: t('sidebar.scheduled', 'Scheduled'), icon: MdSchedule, color: '#06b6d4', sysKey: 'Scheduled', category: false },
      { id: 'DRAFT', label: t('sidebar.draft', 'Drafts'), icon: MdDrafts, color: '#64748b', sysKey: 'Draft', category: false },
      { id: 'ALL_MAIL', label: t('sidebar.all_mail', 'All Mail'), icon: MdMailOutline, color: '#3b82f6', sysKey: 'All Mail', category: false },
      { id: 'SPAM', label: t('sidebar.spam', 'Spam'), icon: MdReport, color: '#ef4444', sysKey: 'Spam', category: false },
      { id: 'TRASH', label: t('sidebar.trash', 'Trash'), icon: MdDelete, color: '#ef4444', sysKey: 'Trash', category: false },
    ];

    const categoryList = [
      { id: 'PURCHASES', label: 'Purchases', icon: MdShoppingBag, color: '#0ea5e9', catKey: 'Purchases', category: true },
      { id: 'SOCIAL', label: 'Social', icon: MdPeople, color: '#3b82f6', catKey: 'Social', category: true },
      { id: 'UPDATES', label: 'Updates', icon: MdInfo, color: '#f97316', catKey: 'Updates', category: true },
      { id: 'FORUMS', label: 'Forums', icon: MdForum, color: '#8b5cf6', catKey: 'Forums', category: true },
      { id: 'PROMOTIONS', label: 'Promotions', icon: MdLocalOffer, color: '#22c55e', catKey: 'Promotions', category: true },
    ];

    const customList = (labels || []).map((lbl) => ({
      id: `LABEL_${lbl.id}`,
      label: lbl.name,
      icon: MdLabel,
      color: lbl.colorHex || '#135bec',
      customKey: lbl.id,
      customName: lbl.name,
      isCustomLabel: true,
      category: false,
    }));

    return [...system, ...categoryList, ...customList];
  }, [theme.accent, labels, t]);

  const isLabelOptionVisible = (tab) => {
    if (tab.sysKey) {
      return isSystemLabelVisibleInLabelList(tab.sysKey, sidebarPreferences);
    }
    if (tab.catKey) {
      return isCategoryVisibleInLabelList(tab.catKey);
    }
    if (tab.customKey !== undefined) {
      return isLabelVisibleInSidebar(tab.customKey, tab.customName);
    }
    return true;
  };

  const displayedTabs = useMemo(() => {
    const visible = availableTabs.filter(isLabelOptionVisible);
    if (visible.length === 0 && availableTabs.length > 0) {
      return [availableTabs[0]];
    }
    return visible;
  }, [availableTabs, sidebarPreferences, prefsTick]);

  useEffect(() => {
    if (displayedTabs.length > 0 && !displayedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(displayedTabs[0].id);
    }
  }, [displayedTabs, activeTab]);

  const isAllInbox = location.pathname === '/all-inbox';
  const isCategoryTab = ['ALL', 'IMPORTANT', 'PROMOTIONS', 'SOCIAL', 'UPDATES', 'PURCHASES', 'FORUMS', 'JOB'].includes(activeTab);

  useEffect(() => {
    if (isAllInbox && !canAccessAllInbox(user)) {
      navigate('/inbox', { replace: true });
    }
  }, [isAllInbox, user, navigate]);

  const currentFolder = useMemo(() => {
    if (isAllInbox) return 'all-inbox';
    if (activeTab.startsWith('LABEL_')) {
      const labelId = activeTab.replace('LABEL_', '');
      return `label-${labelId}`;
    }
    const tabObj = availableTabs.find((t) => t.id === activeTab);
    if (!tabObj || tabObj.category) return 'inbox';
    switch (activeTab) {
      case 'SENT': return 'sent';
      case 'DRAFT': return 'draft';
      case 'STARRED': return 'starred';
      case 'TRASH': return 'trash';
      case 'SNOOZED': return 'snoozed';
      case 'SCHEDULED': return 'scheduled';
      case 'SPAM': return 'spam';
      case 'ALL_MAIL': return 'allmail';
      default: return 'inbox';
    }
  }, [isAllInbox, activeTab, availableTabs]);

  useEffect(() => {
    fetchEmails(currentFolder);
  }, [fetchEmails, currentFolder]);

  const getTabCategory = (e) => {
    if (user?.email && e.cc) {
      const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedEmail}\\b`, 'i');
      if (regex.test(e.cc)) {
        return 'IMPORTANT';
      }
    }
    if (e.isImportant || e.important) {
      return 'IMPORTANT';
    }
    const cat = (e.category || 'ALL').toUpperCase();
    return cat === 'PRIMARY' ? 'ALL' : cat;
  };

  const visibleEmails = emails.filter((e) => {
    let matchesTab = true;
    if (isCategoryTab) {
      matchesTab = (activeTab === 'ALL' || getTabCategory(e) === activeTab);
    } else if (activeTab.startsWith('LABEL_')) {
      const labelId = activeTab.replace('LABEL_', '');
      matchesTab = !Array.isArray(e.labels) || e.labels.some((l) => String(l.id) === String(labelId) || String(l.labelId) === String(labelId));
    }
    return matchesTab && (typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true);
  });

  useEffect(() => {
    setSelectedEmailUid(null);
    setSelectedEmailOverride(null);
    setSelectedIds(new Set());
  }, [location.pathname, activeTab]);

  useEffect(() => {
    const handleOpenEmail = (e) => {
      const email = e.detail?.email;
      const uid = e.detail?.uid;
      if (uid !== undefined && uid !== null) {
        setSelectedEmailUid(uid);
        if (email) setSelectedEmailOverride(email);
        if (email && !email.isRead && handleMarkRead) {
          handleMarkRead(uid);
        }
      }
    };
    window.addEventListener('bnx-open-email', handleOpenEmail);
    return () => window.removeEventListener('bnx-open-email', handleOpenEmail);
  }, [handleMarkRead]);

  useEffect(() => {
    const handleShortcutAction = (e) => {
      if (e.detail?.handled) return;
      const action = e.detail?.action;
      if (!action) return;

      if (action === "back") {
        if (selectedEmailUid) {
          e.detail.handled = true;
          setSelectedEmailUid(null);
        } else if (selectedIds.size > 0) {
          e.detail.handled = true;
          setSelectedIds(new Set());
        }
      } else if (action === "delete") {
        if (!selectedEmailUid && selectedIds.size > 0) {
          e.detail.handled = true;
          handleMoveToTrash(Array.from(selectedIds), currentFolder);
          setSelectedIds(new Set());
        }
      } else if (action === "archive") {
        if (!selectedEmailUid && selectedIds.size > 0) {
          e.detail.handled = true;
          selectedIds.forEach((uid) => handleArchive(uid, currentFolder));
          setSelectedIds(new Set());
        }
      }
    };

    window.addEventListener("bnx-shortcut-action", handleShortcutAction);
    return () => window.removeEventListener("bnx-shortcut-action", handleShortcutAction);
  }, [selectedEmailUid, selectedIds, currentFolder, handleMoveToTrash, handleArchive]);

  const handleSelectEmail = (email) => {
    setSelectedEmailOverride(null);
    setSelectedEmailUid(email.uid);
    if (!email.isRead && !email.read) {
      handleMarkRead(email.uid, true, email);
    }
  };

  const getUnreadCount = (tabId) => {
    if (tabId === 'ALL') return 0; // Unread count badge is shown only beside Inbox in the left sidebar
    if (tabId.startsWith('LABEL_')) {
      const lId = tabId.replace('LABEL_', '');
      return emails.filter(e => e.labels?.some(l => String(l.id) === String(lId) || String(l.labelId) === String(lId)) && !e.isRead && !e.read).length;
    }
    const tabObj = availableTabs.find(t => t.id === tabId);
    if (!tabObj?.category) return 0; // Don't show unread for folders here
    return emails.filter(e => getTabCategory(e) === tabId && !e.isRead && !e.read).length;
  };

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {loading && <div className="p-4 text-center text-xs opacity-60">Loading emails...</div>}
      <EmailList
        emails={visibleEmails}
        selectedEmailId={selectedEmailUid}
        onSelectEmail={handleSelectEmail}
        onDelete={(uid) => handleMoveToTrash(uid, currentFolder)}
        onStar={(uid, f) => handleToggleStar(uid, f || currentFolder || "inbox")}
        onArchive={(uid) => handleArchive(uid, currentFolder)}
        onSnooze={handleSnooze}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  );

  const renderTab = (tab) => {
    if (!tab) return null;
    const Icon = tab.icon;
    const unread = tab.id === 'ALL' ? 0 : getUnreadCount(tab.id);
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive ? '' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        style={isActive ? { borderColor: tab.color, color: tab.color } : {}}
      >
        <Icon size={18} />
        {tab.label}
        {tab.id !== 'ALL' && unread > 0 && <span className="text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm" style={{ backgroundColor: tab.color }}>{unread}</span>}
      </button>
    );
  };

  const headerComponent = selectedIds.size > 0 ? (
    <BulkActionsToolbar
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      visibleEmails={visibleEmails}
      folder={currentFolder}
    />
  ) : (
    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-transparent shrink-0">
      {/* TABS */}
      <div className="flex px-4 pt-1 items-center gap-2 sm:gap-3 text-sm font-medium">
        {/* Manage Labels Link */}
        <div className="relative shrink-0 border-r border-gray-200 dark:border-gray-700 pr-2">
          <button
            onClick={() => navigate('/settings/labels')}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 transition-colors cursor-pointer"
            title={t('sidebar.manage_labels', 'Manage Labels')}
          >
            <MdEdit size={18} />
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => refreshEmails(currentFolder)}
          disabled={loading || isRefreshing}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
          title={t("common.refresh", "Refresh mail")}
        >
          <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
        </button>

        {/* Dynamic Label Options Tabs */}
        <div className="flex gap-2 sm:gap-6 overflow-x-auto hidden-scrollbar flex-1">
          {displayedTabs.map(tab => renderTab(tab))}
        </div>
      </div>
    </div>
  );

  const detailsComponent = selectedEmail ? (
    <EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(email.uid);
        if (!email.isRead && !email.read) {
          handleMarkRead(email.uid, true, email);
        }
      }}
      email={selectedEmail}
      onBack={() => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onDelete={(uid) => {
        handleMoveToTrash(uid, currentFolder);
        setSelectedEmailUid(null);
      }}
      onStar={(uid, f) => handleToggleStar(uid, f || currentFolder || "inbox")}
      onArchive={(uid) => {
        handleArchive(uid, currentFolder);
        setSelectedEmailUid(null);
      }}
      onSnooze={handleSnooze}
      onApplyLabel={handleApplyLabel}
      onReply={(email) =>
        openCompose({
          replyTo: email.from,
          subject: `Re: ${email.subject}`,
          originalBody: email.body,
        })
      }
      onForward={(email) =>
        openCompose({
          forward: true,
          subject: email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`,
          originalBody: email.body,
          originalEmail: email,
        })
      }
    />
  ) : null;

  return (
    <ReadingPaneLayout
      mode={readingPaneMode || 'no_split'}
      hasSelection={!!selectedEmail}
      listComponent={listComponent}
      detailsComponent={detailsComponent}
      headerComponent={headerComponent}
    />
  );
};

export default Inbox;
