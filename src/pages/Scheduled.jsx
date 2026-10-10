import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { mailAPI } from "../services/api";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import toast from "react-hot-toast";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Scheduled = ({ searchQuery }) => {
  const { t } = useTranslation();
  const { theme, readingPaneMode } = useTheme();
  const { matchesDateFilter } = useMail();

  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleDelete = async (uid) => {
    try {
      toast.loading("Cancelling scheduled email...", { id: "cancel-schedule" });
      await mailAPI.cancelScheduled(uid);
      setEmails((prev) => prev.filter((e) => e.uid !== uid));
      setSelectedEmail(null);
      toast.success("Scheduled email cancelled", { id: "cancel-schedule" });
    } catch (err) {
      console.error("Failed to cancel scheduled email:", err);
      toast.error("Failed to cancel scheduled email", { id: "cancel-schedule" });
    }
  };

  const handleStar = (uid) => {
    setEmails((prev) =>
      prev.map((e) =>
        e.uid === uid ? { ...e, starred: !e.starred } : e
      )
    );
  };

  const handleArchive = (uid) => {
    setEmails((prev) =>
      prev.map((e) =>
        e.uid === uid ? { ...e, folder: "archive" } : e
      )
    );
    setSelectedEmail(null);
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: theme.bg }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4"
            style={{ borderColor: theme.accent }}
          />
          <p style={{ color: theme.subText }}>Loading scheduled emails…</p>
        </div>
      </div>
    );
  }

  /* ---------------- ERROR ---------------- */
  if (error) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: theme.bg }}
      >
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button
            onClick={fetchScheduled}
            className="px-4 py-2 rounded text-white"
            style={{ background: theme.accent }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- MAIN UI ---------------- */
  
  const detailsComponent = selectedEmail ? (
<EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => setSelectedEmail(email)}
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onDelete={handleDelete}
          onStar={handleStar}
          onArchive={handleArchive}
        />
  ) : null;

  const headerComponent = selectedIds.size > 0 ? (

            <BulkActionsToolbar
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              visibleEmails={visibleEmails}
              folder="scheduled"
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
                🕒 Scheduled
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
                <span className="text-5xl mb-3">📭</span>
                <p className="text-base font-semibold" style={{ color: theme.text }}>No scheduled emails</p>
                <p className="text-sm" style={{ color: theme.subText }}>
                  Emails scheduled to be sent later will appear here
                </p>
              </div>
            ) : (
              <EmailList
                emails={visibleEmails}
                selectedEmailId={selectedEmail?.uid}
                onSelectEmail={setSelectedEmail}
                onDelete={handleDelete}
                onStar={handleStar}
                onArchive={handleArchive}
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

export default Scheduled;
