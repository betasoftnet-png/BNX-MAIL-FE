import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdAccessTime } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Snoozed = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const { 
    emails, 
    loading, 
    fetchEmails, 
    handleToggleStar, 
    handleMoveToTrash, 
    handleApplyLabel, 
    handleArchive, 
    handleUnarchive, 
    handleSnooze,
    openCompose 
  } = useMail();
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
    fetchEmails('snoozed');
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
            handleMoveToTrash(uid, "snoozed");
            setSelectedEmailUid(null);
          }}
          onStar={(uid) => handleToggleStar(uid, "snoozed")}
          onArchive={(uid) => {
            handleArchive(uid, "snoozed");
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
              folder="snoozed"
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
                <MdAccessTime className="text-blue-500" size={20} /> Snoozed
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
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <MdAccessTime className="text-5xl mb-4 text-blue-500 opacity-50" />
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: theme.text }}
                >
                  No snoozed emails
                </p>
                <p className="text-sm" style={{ color: theme.subText }}>
                  Snooze emails to hide them from your inbox until a later time
                </p>
              </div>
            ) : (
              <EmailList
                emails={visibleEmails}
                selectedEmailId={selectedEmailUid}
                onSelectEmail={handleSelectEmail}
                onStar={(uid) => handleToggleStar(uid, "snoozed")}
                onArchive={(uid) => handleArchive(uid, "snoozed")}
                onUnarchive={handleUnarchive}
                onDelete={(uid) => handleMoveToTrash(uid, "snoozed")}
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

export default Snoozed;
