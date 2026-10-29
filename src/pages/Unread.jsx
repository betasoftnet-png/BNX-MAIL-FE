import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdMailOutline, MdRefresh } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Unread = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, isRefreshing, fetchEmails, refreshEmails, handleToggleStar, handleMoveToTrash, handleMarkRead, handleApplyLabel, handleArchive, handleUnarchive, handleSnooze, openCompose, matchesDateFilter, unreadCounts } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [selectedEmailOverride, setSelectedEmailOverride] = useState(null);

  const unreadEmails = emails.filter((e) => !e.isRead || String(e.uid) === String(selectedEmailUid));
  const unreadCount = unreadCounts?.unread !== undefined ? unreadCounts.unread : emails.filter((e) => !e.isRead).length;
  const selectedEmail = selectedEmailOverride || emails.find((e) => String(e.uid) === String(selectedEmailUid));

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

  useEffect(() => {
    setSelectedEmailUid(null);
    setSelectedEmailOverride(null);
    setSelectedIds(new Set());
  }, [location.pathname]);

  useEffect(() => {
    fetchEmails('unread');
  }, [fetchEmails]);

  useEffect(() => {
    const handleBnxOpenEmail = (event) => {
      const emailToOpen = event?.detail?.email;
      if (!emailToOpen) return;
      setSelectedEmailOverride(emailToOpen);
      if (emailToOpen.uid) setSelectedEmailUid(emailToOpen.uid);
      if (!emailToOpen.isRead && emailToOpen.uid) {
        handleMarkRead(emailToOpen.uid);
      }
    };
    window.addEventListener("bnx-open-email", handleBnxOpenEmail);
    return () => window.removeEventListener("bnx-open-email", handleBnxOpenEmail);
  }, [handleMarkRead]);

  const visibleEmails = unreadEmails.filter((e) =>
    typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true
  );

  const handleSelectEmail = (email) => {
    setSelectedEmailOverride(null);
    setSelectedEmailUid(email.uid);
    if (!email.isRead) {
      handleMarkRead(email.uid);
    }
  };

  const handleForward = (email) => {
    openCompose({
      forward: true,
      subject: email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject || ""}`,
      originalBody: email.body,
      originalEmail: email,
    });
  };

  const handleReply = (email) => {
    openCompose({
      replyTo: email.senderEmail || email.from,
      subject: `Re: ${email.subject || ""}`,
      originalBody: email.body,
    });
  };

  /* ---------------- MAIN UI ---------------- */
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
      onClose={() => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "unread");
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "unread")}
      onArchive={(uid) => {
        handleArchive(uid, "unread");
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onUnarchive={(uid) => {
        handleUnarchive(uid);
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onReply={handleReply}
      onForward={handleForward}
      onApplyLabel={handleApplyLabel}
      onSnooze={handleSnooze}
    />
  ) : null;

  const headerComponent = selectedIds.size > 0 ? (
    <BulkActionsToolbar
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      visibleEmails={visibleEmails}
      folder="unread"
    />
  ) : (
    <div
      className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0 bg-transparent"
      style={{ borderColor: theme.border }}
    >
      <h2
        className="text-base font-bold flex items-center gap-2"
        style={{ color: theme.text }}
      >
        <MdMailOutline size={20} className="text-blue-500" />
        Unread
        <span
          className="ml-2 text-xs font-normal"
          style={{ color: theme.subText }}
        >
          ({unreadCount})
        </span>
      </h2>
      <button
        onClick={() => refreshEmails("unread")}
        disabled={loading || isRefreshing}
        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
        title={t("common.refresh", "Refresh mail")}
      >
        <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
      </button>
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <p className="text-sm font-medium animate-pulse" style={{ color: theme.subText }}>Loading unread emails...</p>
        </div>
      ) : visibleEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <MdMailOutline className="text-5xl mb-4 text-gray-300 dark:text-gray-600 opacity-55" />
          <p className="text-base font-semibold" style={{ color: theme.text }}>No unread messages</p>
          <p className="text-sm mt-1" style={{ color: theme.subText }}>Your unread emails will show up here.</p>
        </div>
      ) : (
        <EmailList
          emails={visibleEmails}
          selectedEmailId={selectedEmailUid}
          onSelectEmail={handleSelectEmail}
          onStar={(uid) => handleToggleStar(uid, "unread")}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      )}
    </div>
  );

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

export default Unread;
