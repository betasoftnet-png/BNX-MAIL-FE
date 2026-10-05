import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdMailOutline } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Unread = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleMarkRead, handleApplyLabel, handleArchive, handleUnarchive, handleSnooze, openCompose } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);

  const unreadEmails = emails.filter((e) => !e.isRead);
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

  useEffect(() => {
    fetchEmails('unread');
  }, [fetchEmails]);

  const visibleEmails = unreadEmails.filter(
    (e) =>
      !searchQuery ||
      e.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.textPlain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectEmail = (email) => {
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
      onNavigate={(email) => setSelectedEmailUid(email.uid)}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onClose={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "unread");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "unread")}
      onArchive={(uid) => {
        handleArchive(uid, "unread");
        setSelectedEmailUid(null);
      }}
      onUnarchive={(uid) => {
        handleUnarchive(uid);
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
          ({unreadEmails.length})
        </span>
      </h2>
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <p className="text-sm font-medium animate-pulse" style={{ color: theme.subText }}>Loading unread emails...</p>
        </div>
      ) : unreadEmails.length === 0 ? (
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
