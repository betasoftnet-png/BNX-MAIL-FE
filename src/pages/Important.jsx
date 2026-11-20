import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdLabelImportant, MdRefresh } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";
import { getDraftAttachments } from "../utils/draftAttachmentStorage";

const isDraftEmail = (email) => {
  if (!email) return false;
  const folder = email.folderName?.toLowerCase();
  return folder === 'draft' || folder === 'drafts' || email.isDraft === true || email.draft === true;
};

const Important = ({ searchQuery }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, readingPaneMode } = useTheme();
  const {
    emails,
    loading,
    isRefreshing,
    fetchEmails,
    refreshEmails,
    handleToggleStar,
    handleToggleImportant,
    isEmailImportant,
    handleMoveToTrash,
    handleMarkRead,
    handleApplyLabel,
    handleArchive,
    handleUnarchive,
    handleSnooze,
    openCompose,
    matchesDateFilter
  } = useMail();

  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [selectedEmailOverride, setSelectedEmailOverride] = useState(null);

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
    fetchEmails('important');
  }, [fetchEmails]);

  const visibleEmails = emails.filter((e) => {
    const isItemImportant = typeof isEmailImportant === 'function'
      ? isEmailImportant(e.uid ?? e.id, e, e.folderName || 'important')
      : Boolean(e.isImportant || e.important);
    if (!isItemImportant) return false;

    return typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true;
  });

  const sortedEmails = useMemo(() => {
    // Deduplicate by UID so there are zero duplicate records
    const seenUids = new Set();
    const uniqueEmails = [];

    visibleEmails.forEach((email) => {
      const uidStr = String(email.uid ?? email.id ?? '');
      if (!uidStr || !seenUids.has(uidStr)) {
        if (uidStr) seenUids.add(uidStr);
        uniqueEmails.push(email);
      }
    });

    const getTimestamp = (item) => {
      if (!item) return 0;
      const raw = item.receivedDate || item.sentDate || item.date || item.createdAt || item.timestamp;
      if (!raw) return 0;
      const t = new Date(raw).getTime();
      return isNaN(t) ? 0 : t;
    };

    return uniqueEmails.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      if (timeA === 0 && timeB === 0) return 0;
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      if (timeB !== timeA) return timeB - timeA;
      const uidA = Number(a.uid);
      const uidB = Number(b.uid);
      if (!isNaN(uidA) && !isNaN(uidB)) return uidB - uidA;
      return 0;
    });
  }, [visibleEmails]);

  const selectedEmail = sortedEmails.find((e) => String(e.uid) === String(selectedEmailUid)) ||
    (selectedEmailOverride && (String(selectedEmailOverride.uid) === String(selectedEmailUid) || String(selectedEmailOverride.id) === String(selectedEmailUid)) ? selectedEmailOverride : null);

  const handleSelectEmail = (email) => {
    if (isDraftEmail(email)) {
      const restored = getDraftAttachments(email);
      const enrichedEmail = {
        ...email,
        attachments: (restored && restored.length > 0) ? restored : email.attachments,
        attachmentsJson: (restored && restored.length > 0) ? JSON.stringify(restored) : email.attachmentsJson,
      };
      openCompose({ draft: enrichedEmail });
      return;
    }
    setSelectedEmailUid(email.uid);
  };

  const handleDelete = (uid, folder) => {
    const email = sortedEmails.find((e) => String(e.uid) === String(uid));
    const targetFolder = folder || email?.folderName || 'important';
    handleMoveToTrash(uid, targetFolder);
    setSelectedEmailUid(null);
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
      emailList={sortedEmails}
      onNavigate={(email) => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(email.uid);
        if (!email.isRead && !email.read) {
          handleMarkRead?.(email.uid, true, email);
        }
      }}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onClose={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleDelete(uid, selectedEmail?.folderName);
      }}
      onStar={handleToggleStar}
      onArchive={(uid) => {
        handleArchive(uid, "important");
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
      visibleEmails={sortedEmails}
      folder="important"
    />
  ) : (
    <div
      className="flex items-center justify-between px-4 py-2 border-b select-none transition-colors duration-150"
      style={{
        backgroundColor: theme.mode === "dark" ? (theme.cardBg || "#1e293b") : (theme.cardBg || "#ffffff"),
        borderColor: theme.border || "#e5e7eb"
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <MdLabelImportant size={22} className="text-yellow-500" />
          <h1 className="text-base font-semibold" style={{ color: theme.text || "#1f2937" }}>
            {t("sidebar.important", "Important")}
          </h1>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          ({sortedEmails.length})
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => refreshEmails()}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={t("common.refresh", "Refresh")}
        >
          <MdRefresh size={18} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
        </button>
      </div>
    </div>
  );

  const listComponent = (
    <div className="flex-1 overflow-y-auto">
      {loading && sortedEmails.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
          {t("common.loading", "Loading important emails...")}
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 text-center px-4">
          <MdLabelImportant size={48} className="text-yellow-500/40 mb-3" />
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {t("important.empty_title", "No important messages")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
            {t("important.empty_desc", "Messages marked as important automatically or manually will appear here.")}
          </p>
        </div>
      ) : (
        <EmailList
          emails={sortedEmails}
          selectedEmailId={selectedEmailUid}
          onSelectEmail={handleSelectEmail}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onStar={handleToggleStar}
          onDelete={handleDelete}
        />
      )}
    </div>
  );

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: theme.mode === "dark" ? (theme.bg || "#0f172a") : (theme.bg || "#f8fafc"),
        color: theme.text
      }}
    >
      <ReadingPaneLayout
        layoutMode={readingPaneMode}
        isDetailsOpen={Boolean(selectedEmail)}
        headerComponent={headerComponent}
        listComponent={listComponent}
        detailsComponent={detailsComponent}
      />
    </div>
  );
};

export default Important;
