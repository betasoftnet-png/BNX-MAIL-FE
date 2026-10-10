import React, { useState, useEffect } from "react";
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
import { MdRefresh, MdInbox, MdLocalOffer, MdPeople, MdInfo, MdLabelImportant, MdSend, MdDrafts, MdStar, MdDelete, MdEdit, MdCheck, MdWork } from "react-icons/md";
import toast from "react-hot-toast";
import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Inbox = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const { user } = useAuth();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleMarkRead, handleSnooze, handleApplyLabel, handleArchive, openCompose, matchesDateFilter, dateFilter, customDateRange, resetDateFilter } = useMail();

  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const selectedEmail = emails.find((e) => String(e.uid) === String(selectedEmailUid));

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

  const isCategoryTab = ['ALL', 'IMPORTANT', 'PROMOTIONS', 'SOCIAL', 'UPDATES', 'JOB'].includes(activeTab);

  useEffect(() => {
    if (location.pathname === '/all-inbox') {
      fetchEmails('all-inbox');
    } else if (isCategoryTab) {
      fetchEmails('inbox');
    } else {
      fetchEmails(activeTab.toLowerCase());
    }
  }, [activeTab, fetchEmails, location.pathname, isCategoryTab]);

  const getTabCategory = (e) => {
    if (user?.email && e.cc) {
      const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedEmail}\\b`, 'i');
      if (regex.test(e.cc)) {
        return 'IMPORTANT';
      }
    }
    const cat = (e.category || 'ALL').toUpperCase();
    return cat === 'PRIMARY' ? 'ALL' : cat;
  };

  const visibleEmails = emails.filter(
    (e) => {
      const matchesTab = isCategoryTab
        ? (activeTab === 'ALL' || getTabCategory(e) === activeTab)
        : true;
      return matchesTab &&
        (typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true) &&
        (!searchQuery ||
          e.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.textPlain?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
  );

  useEffect(() => {
    setSelectedEmailUid(null);
    setSelectedIds(new Set());
  }, [location.pathname, activeTab]);

  const handleSelectEmail = (email) => {
    setSelectedEmailUid(email.uid);
    if (!email.isRead) {
      handleMarkRead(email.uid);
    }
  };

  const availableTabs = [
    { id: 'ALL', label: 'All', icon: MdInbox, color: theme.accent || '#135bec', category: true },
    { id: 'IMPORTANT', label: 'Important', icon: MdLabelImportant, color: '#eab308', category: true },
    { id: 'PROMOTIONS', label: 'Promotions', icon: MdLocalOffer, color: '#22c55e', category: true },
    { id: 'SOCIAL', label: 'Social', icon: MdPeople, color: '#3b82f6', category: true },
    { id: 'UPDATES', label: 'Updates', icon: MdInfo, color: '#f97316', category: true },
    { id: 'JOB', label: 'Job', icon: MdWork, color: '#0d9488', category: true },
    { id: 'SENT', label: 'Sent', icon: MdSend, color: '#8b5cf6', category: false },
    { id: 'DRAFT', label: 'Drafts', icon: MdDrafts, color: '#64748b', category: false },
    { id: 'STARRED', label: 'Starred', icon: MdStar, color: '#eab308', category: false },
    { id: 'TRASH', label: 'Trash', icon: MdDelete, color: '#ef4444', category: false }
  ];

  const [activeTabs, setActiveTabs] = useState(() => {
    const saved = localStorage.getItem('inbox_visible_tabs');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (parsed.includes('PRIMARY')) {
        parsed = parsed.map(t => t === 'PRIMARY' ? 'ALL' : t);
        localStorage.setItem('inbox_visible_tabs', JSON.stringify(parsed));
      }
      if (!parsed.includes('ALL')) parsed.unshift('ALL');
      return parsed;
    }
    return ['ALL'];
  });

  const [showTabMenu, setShowTabMenu] = useState(false);

  const toggleTab = (tabId) => {
    if (tabId === 'ALL') return;
    setActiveTabs(prev => {
      const next = prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId];
      localStorage.setItem('inbox_visible_tabs', JSON.stringify(next));
      if (activeTab === tabId && prev.includes(tabId)) {
        setActiveTab('ALL');
      }
      return next;
    });
  };

  const getUnreadCount = (tabId) => {
    if (tabId === 'ALL') return 0; // Unread count badge is shown only beside Inbox in the left sidebar
    if (!availableTabs.find(t => t.id === tabId)?.category) return 0; // Don't show unread for folders here
    return emails.filter(e => getTabCategory(e) === tabId && !e.isRead).length;
  };

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {loading && <div className="p-4 text-center text-xs opacity-60">Loading emails...</div>}
      <EmailList
        emails={visibleEmails}
        selectedEmailId={selectedEmailUid}
        onSelectEmail={handleSelectEmail}
        onDelete={(uid) => handleMoveToTrash(uid, "inbox")}
        onStar={(uid) => handleToggleStar(uid, "inbox")}
        onArchive={(uid) => handleArchive(uid, "inbox")}
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
      folder={availableTabs.find(t => t.id === activeTab)?.category ? 'inbox' : activeTab.toLowerCase()}
    />
  ) : (
    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-transparent shrink-0">
      {/* TABS */}
      <div className="flex px-4 pt-1 items-center gap-2 sm:gap-3 text-sm font-medium">
        {/* Edit Button */}
        <div className="relative shrink-0 border-r border-gray-200 dark:border-gray-700 pr-2">
          <button
            onClick={() => setShowTabMenu(!showTabMenu)}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 transition-colors cursor-pointer"
            title="Edit Tabs"
          >
            <MdEdit size={18} />
          </button>

          {showTabMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTabMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customize Tabs</div>
                {availableTabs.map(tab => {
                  const Icon = tab.icon;
                  const isVisible = activeTabs.includes(tab.id);
                  const isPrimary = tab.id === 'ALL';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => toggleTab(tab.id)}
                      disabled={isPrimary}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${isPrimary ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Icon size={16} style={{ color: tab.color }} />
                        {tab.label}
                      </div>
                      {isVisible && <MdCheck size={16} className="text-primary" style={{ color: theme.accent || "#135bec" }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => fetchEmails(availableTabs.find(t => t.id === activeTab)?.category ? "inbox" : activeTab.toLowerCase())}
          disabled={loading}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
          title={t("common.refresh", "Refresh mail")}
        >
          <MdRefresh size={18} className={loading ? "animate-spin" : ""} />
        </button>

        {/* All Tabs */}
        <div className="flex gap-2 sm:gap-6 overflow-x-auto hidden-scrollbar flex-1">
          {availableTabs.filter(t => activeTabs.includes(t.id)).map(tab => renderTab(tab))}
        </div>
      </div>
    </div>
  );

  const detailsComponent = selectedEmail ? (
    <EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => setSelectedEmailUid(email.uid)}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "inbox");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "inbox")}
      onArchive={(uid) => {
        handleArchive(uid, "inbox");
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
