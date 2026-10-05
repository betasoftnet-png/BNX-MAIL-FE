import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdDrafts } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Draft = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleApplyLabel, handleArchive, handleSnooze, openCompose } = useMail();
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
    fetchEmails('draft');
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
    openCompose({ draft: email });
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
    // Open draft in composer
    openCompose({
      draft: email
    });
    setSelectedEmailUid(null); // Close the detail view
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: theme.bg }}
      >
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2"
          style={{ borderColor: theme.accent }}
        />
      </div>
    );
  }

  
  const detailsComponent = selectedEmail ? (
<EmailDetails
      emailList={visibleEmails}
      onNavigate={(email) => setSelectedEmailUid(email.uid)}
          email={selectedEmail}
          onBack={() => setSelectedEmailUid(null)}
          onClose={() => setSelectedEmailUid(null)}
          onDelete={(uid) => {
            handleMoveToTrash(uid, "draft");
            setSelectedEmailUid(null);
          }}
          onStar={(uid) => handleToggleStar(uid, "draft")}
          onArchive={(uid) => {
            handleArchive(uid, "draft");
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
              folder="draft"
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
                <MdDrafts className="text-primary" size={20} style={{ color: theme.accent }} /> Drafts
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
                <span className="text-5xl mb-3">📝</span>
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: theme.text }}
                >
                  No drafts
                </p>
                <p className="text-sm mb-4" style={{ color: theme.subText }}>
                  Draft emails you save will appear here
                </p>
                <button
                  onClick={() => openCompose()}
                  className="px-4 py-2 rounded-full text-white text-sm cursor-pointer shadow-sm hover:shadow hover:-translate-y-0.5 transition-all"
                  style={{ backgroundColor: theme.accent }}
                >
                  Compose Email
                </button>
              </div>
            ) : (
              <EmailList
                emails={visibleEmails}
                selectedEmailId={selectedEmail?.uid}
                onSelectEmail={handleSelectEmail}
                onStar={(uid) => handleToggleStar(uid, "draft")}
                onArchive={(uid) => handleArchive(uid, "draft")}
                onDelete={(uid) => handleMoveToTrash(uid, "draft")}
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

export default Draft;
