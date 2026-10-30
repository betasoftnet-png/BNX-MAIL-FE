import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdSend, MdRefresh } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Send = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, isRefreshing, fetchEmails, refreshEmails, handleToggleStar, handleMoveToTrash, handleArchive, handleSnooze, handleApplyLabel, openCompose, matchesDateFilter } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [selectedEmailOverride, setSelectedEmailOverride] = useState(null);
  const selectedEmail = emails.find((e) => String(e.uid) === String(selectedEmailUid)) ||
    (selectedEmailOverride && (String(selectedEmailOverride.uid) === String(selectedEmailUid) || String(selectedEmailOverride.id) === String(selectedEmailUid)) ? selectedEmailOverride : null);

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
    const handleOpenEmail = (e) => {
      const email = e.detail?.email;
      const uid = e.detail?.uid;
      if (uid !== undefined && uid !== null) {
        setSelectedEmailUid(uid);
        if (email) setSelectedEmailOverride(email);
      }
    };
    window.addEventListener('bnx-open-email', handleOpenEmail);
    return () => window.removeEventListener('bnx-open-email', handleOpenEmail);
  }, []);

  useEffect(() => {
    fetchEmails('sent');
  }, [fetchEmails]);

  const visibleEmails = emails.filter(
    (e) => typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true
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
          <p style={{ color: theme.subText }}>Loading sent mail...</p>
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
      onStar={(uid, f) => handleToggleStar(uid, f || "Sent")}
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
      <button
        onClick={() => refreshEmails("sent")}
        disabled={loading || isRefreshing}
        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
        title={t("common.refresh", "Refresh mail")}
      >
        <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
      </button>
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
          onStar={(uid, f) => handleToggleStar(uid, f || "Sent")}
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
