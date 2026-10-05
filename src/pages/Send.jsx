import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdSend } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Send = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleArchive, handleSnooze, handleApplyLabel, openCompose } = useMail();
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
    fetchEmails('sent');
  }, [fetchEmails]);

  const visibleEmails = emails.filter(
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
  };

  const handleDelete = (uid) => {
    handleMoveToTrash(uid, 'Sent');
    setSelectedEmailUid(null);
  };

  const handleReply = (email) => {
    openCompose({
      replyTo: email.to || email.senderEmail || email.from, // For sent mail, reply to the recipient
      subject: `Re: ${email.subject || ""}`,
      originalBody: email.body,
    });
  };

  /* ---------------- LOADING ---------------- */
  if (loading && emails.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4"
            style={{ borderColor: theme.accent }}
          />
          <p style={{ color: theme.subText }}>Loading sent mail…</p>
        </div>
      </div>
    );
  }

  /* ---------------- MAIN UI ---------------- */
  const detailsComponent = selectedEmail ? (
    <EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => setSelectedEmailUid(email.uid)}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onClose={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "Sent");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "Sent")}
      onArchive={(uid) => {
        handleArchive(uid, "Sent");
        setSelectedEmailUid(null);
      }}
      onApplyLabel={handleApplyLabel}
      onSnooze={handleSnooze}
    />
  ) : null;

  const headerComponent = selectedIds.size > 0 ? (
    <BulkActionsToolbar
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      visibleEmails={visibleEmails}
      folder="sent"
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
        Sent
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
    <div className="flex-1 flex flex-col overflow-hidden ">
      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <MdSend className="text-5xl mb-4 text-gray-300 dark:text-gray-600 opacity-55" />
          <p className="text-base font-semibold" style={{ color: theme.text }}>No sent emails</p>
        </div>
      ) : (
        <EmailList
          emails={visibleEmails}
          selectedEmailId={selectedEmailUid}
          onSelectEmail={handleSelectEmail}
          onStar={(uid) => handleToggleStar(uid, "Sent")}
          onDelete={(uid) => handleMoveToTrash(uid, "Sent")}
          onArchive={(uid) => handleArchive(uid, "Sent")}
          onSnooze={handleSnooze}
          showTo={true}
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

export default Send;
