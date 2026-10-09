import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdReport, MdDelete } from "react-icons/md";
import toast from "react-hot-toast";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import { filterDuplicateSpamEmails } from "../utils/spamFilter";
import { mailAPI } from "../services/api";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Spam = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleArchive, handleSnooze, handleApplyLabel, handleMarkRead, openCompose } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Frontend-only duplicate filtering: display only one copy based on existing unique ID
  const uniqueEmails = useMemo(() => filterDuplicateSpamEmails(emails), [emails]);
  const selectedEmail = useMemo(
    () => uniqueEmails.find((e) => String(e.uid) === String(selectedEmailUid)),
    [uniqueEmails, selectedEmailUid]
  );

  // Mark only the opened spam email as Read immediately when viewed
  useEffect(() => {
    if (selectedEmail && !selectedEmail.isRead && handleMarkRead) {
      handleMarkRead(selectedEmail.uid);
    }
  }, [selectedEmail?.uid, selectedEmail?.isRead, handleMarkRead]);

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

  const handleDeleteAllSpam = async () => {
    if (uniqueEmails.length === 0) return;
    try {
      setIsDeletingAll(true);
      toast.loading("Deleting all spam messages...", { id: "delete-all-spam" });

      let clearedViaApi = false;
      try {
        if (mailAPI && mailAPI.clearSpam) {
          await mailAPI.clearSpam();
          clearedViaApi = true;
        }
      } catch (clearErr) {
        console.warn("Direct clearSpam failed, falling back to sequential delete:", clearErr);
      }

      if (!clearedViaApi) {
        for (const e of uniqueEmails) {
          try {
            await handleMoveToTrash(e.uid, e.folderName || 'spam', true);
          } catch (itemErr) {
            console.warn(`Failed to move spam message ${e.uid} to trash:`, itemErr);
          }
        }
      }

      setSelectedIds(new Set());
      setSelectedEmailUid(null);
      toast.success("All spam messages moved to trash", { id: "delete-all-spam" });
      await fetchEmails('spam', false, 1);
    } catch (err) {
      console.error("Failed to delete all spam:", err);
      toast.error("Failed to delete all spam messages", { id: "delete-all-spam" });
      await fetchEmails('spam', false, 1);
    } finally {
      setIsDeletingAll(false);
    }
  };



  useEffect(() => {
    fetchEmails('spam');
  }, [fetchEmails]);

  const visibleEmails = useMemo(() => {
    if (!searchQuery) return uniqueEmails;
    const q = searchQuery.toLowerCase();
    return uniqueEmails.filter(
      (e) =>
        e.subject?.toLowerCase().includes(q) ||
        e.from?.toLowerCase().includes(q) ||
        e.senderEmail?.toLowerCase().includes(q) ||
        e.to?.toLowerCase().includes(q) ||
        e.recipientEmail?.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q) ||
        e.textPlain?.toLowerCase().includes(q)
    );
  }, [uniqueEmails, searchQuery]);

  const handleSelectEmail = (email) => {
    setSelectedEmailUid(email.uid);
    if (!email.isRead && handleMarkRead) {
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
        setSelectedEmailUid(email.uid);
        if (!email.isRead && handleMarkRead) {
          handleMarkRead(email.uid);
        }
      }}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "spam");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "spam")}
      onArchive={(uid) => {
        handleArchive(uid, "spam");
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
      folder="spam"
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
        <MdReport size={20} className="text-red-500" /> Spam
        <span
          className="ml-2 text-xs font-normal"
          style={{ color: theme.subText }}
        >
          ({uniqueEmails.length})
        </span>
      </h2>
      {uniqueEmails.length > 0 && (
        <button
          onClick={handleDeleteAllSpam}
          disabled={isDeletingAll}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Delete all spam emails"
        >
          <MdDelete size={16} />
          Delete All
        </button>
      )}
    </div>

  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {uniqueEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <MdReport size={52} className="text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
          <p
            className="text-base font-semibold mb-1"
            style={{ color: theme.text }}
          >
            No spam emails
          </p>
          <p className="text-sm" style={{ color: theme.subText }}>
            Spam emails will automatically appear here
          </p>
        </div>
      ) : (
        <EmailList
          emails={visibleEmails}
          selectedEmailId={selectedEmail?.uid}
          onSelectEmail={handleSelectEmail}
          onDelete={(uid) => handleMoveToTrash(uid, "spam")}
          onStar={(uid) => handleToggleStar(uid, "spam")}
          onArchive={(uid) => handleArchive(uid, "spam")}
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

export default Spam;
