import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdStar, MdStarBorder } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Starred = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleApplyLabel, handleArchive, handleUnarchive, handleSnooze, openCompose, matchesDateFilter } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
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
    setSelectedEmailUid(null);
    setSelectedIds(new Set());
  }, [location.pathname]);

  useEffect(() => {
    fetchEmails('starred');
  }, [fetchEmails]);

  const visibleEmails = emails.filter(
    (e) =>
      (matchesDateFilter ? matchesDateFilter(e) : true) &&
      (!searchQuery ||
        e.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.textPlain?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectEmail = (email) => {
    setSelectedEmailUid(email.uid);
  };

  const handleUnstar = async (uid) => {
    await handleToggleStar(uid, 'starred');
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
        handleMoveToTrash(uid, "starred");
        setSelectedEmailUid(null);
      }}
      onStar={handleUnstar}
      onArchive={(uid) => {
        handleArchive(uid, "starred");
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
      folder="starred"
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
        <MdStar size={20} className="text-yellow-500" />
        {t("sidebar.starred", "Starred")}
        <span
          className="ml-2 text-xs font-normal"
          style={{ color: theme.subText }}
        >
          ({emails.length})
        </span>
      </h2>
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <MdStarBorder className="text-5xl mb-4 text-gray-300 dark:text-gray-600 opacity-55" />
          <p className="text-base font-semibold" style={{ color: theme.text }}>{t("starred.empty", "No starred messages")}</p>
          <p className="text-sm mt-1" style={{ color: theme.subText }}>{t("starred.empty_desc", "Stars let you give messages a special status to make them easier to find.")}</p>
        </div>
      ) : (
        <EmailList
          emails={visibleEmails}
          selectedEmailId={selectedEmailUid}
          onSelectEmail={handleSelectEmail}
          onStar={handleUnstar}
          onDelete={(uid) => handleMoveToTrash(uid, "starred")}
          onArchive={(uid) => handleArchive(uid, "starred")}
          onSnooze={handleSnooze}
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

export default Starred;
