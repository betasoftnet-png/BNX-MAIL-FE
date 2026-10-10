import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useMail } from "../context/MailContext";
import { MdDelete } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import { mailAPI } from "../services/api";
import toast from "react-hot-toast";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Trash = ({ searchQuery }) => {
  const { t } = useTranslation();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleDeletePermanently, handleSnooze, handleApplyLabel, handleToggleStar, handleArchive, matchesDateFilter } = useMail();
  const [selectedEmail, setSelectedEmail] = useState(null);

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
    fetchEmails('trash');
  }, [fetchEmails]);

  const visibleEmails = emails.filter(
    (e) =>
      (typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true) &&
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
    setSelectedEmail(email);
  };

  const handlePermanentDelete = async (uid) => {
    await handleDeletePermanently(uid);
    setSelectedEmail(null);
  };

  const handleRestore = async (uid) => {
    try {
      await mailAPI.restore(uid);
      toast.success("Email restored");
      fetchEmails('trash', true);
      setSelectedEmail(null);
    } catch (error) {
      toast.error("Failed to restore email");
    }
  };

  const handleStar = (uid) => {
    if (handleToggleStar) handleToggleStar(uid, "trash");
    setSelectedEmail(prev => prev && prev.uid === uid ? { ...prev, starred: !prev.starred } : prev);
  };

  const handleArchiveEmail = async (uid) => {
    if (handleArchive) {
      await handleArchive(uid, "trash");
    }
    setSelectedEmail(null);
  };

  /* ---------------- MAIN UI ---------------- */
  
  const currentSelectedEmail = emails.find((e) => String(e.uid) === String(selectedEmail?.uid)) || selectedEmail;

  const detailsComponent = currentSelectedEmail ? (
    <EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => setSelectedEmail(email)}
      email={currentSelectedEmail}
      onBack={() => setSelectedEmail(null)}
      onRestore={() => handleRestore(currentSelectedEmail.uid)}
      onDelete={handlePermanentDelete}
      onStar={handleStar}
      onArchive={handleArchiveEmail}
      onApplyLabel={handleApplyLabel}
      onSnooze={handleSnooze}
      isTrash={true}
    />
  ) : null;

  const headerComponent = selectedIds.size > 0 ? (

            <BulkActionsToolbar
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              visibleEmails={visibleEmails}
              folder="trash"
            />
          
  ) : (

            <div
              className="p-4 sm:p-5 border-b flex justify-between items-center shrink-0 bg-transparent"
              style={{ borderColor: theme.border }}
            >
              <h2
                className="text-base font-bold flex items-center gap-2"
                style={{ color: theme.text }}
              >
                <MdDelete size={20} className="text-gray-500" /> Trash
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
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <MdDelete size={52} className="text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: theme.text }}
                >
                  Trash is empty
                </p>
              </div>
            ) : (
              <EmailList
                emails={visibleEmails}
                selectedEmailId={selectedEmail?.uid}
                onSelectEmail={handleSelectEmail}
                onDelete={handlePermanentDelete}
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

export default Trash;
