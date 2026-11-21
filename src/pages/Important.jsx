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
    matchesDateFilter,
    isEmailRead,
    isEmailPinned,
    pinnedIds
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
        if (email && !email.isRead && handleMarkRead) {
          handleMarkRead(uid);
        }
      }
    };
    window.addEventListener('bnx-open-email', handleOpenEmail);
    return () => window.removeEventListener('bnx-open-email', handleOpenEmail);
  }, [handleMarkRead]);

  useEffect(() => {
    const handleShortcutAction = (e) => {
      if (e.detail?.handled) return;
      const action = e.detail?.action;
      if (!action) return;

      if (action === "back") {
        if (selectedEmailUid) {
          e.detail.handled = true;
          setSelectedEmailUid(null);
        } else if (selectedIds.size > 0) {
          e.detail.handled = true;
          setSelectedIds(new Set());
        }
      } else if (action === "delete") {
        if (!selectedEmailUid && selectedIds.size > 0) {
          e.detail.handled = true;
          handleMoveToTrash(Array.from(selectedIds), "important");
          setSelectedIds(new Set());
        }
      } else if (action === "archive") {
        if (!selectedEmailUid && selectedIds.size > 0) {
          e.detail.handled = true;
          selectedIds.forEach((uid) => handleArchive(uid, "important"));
          setSelectedIds(new Set());
        }
      }
    };

    window.addEventListener("bnx-shortcut-action", handleShortcutAction);
    return () => window.removeEventListener("bnx-shortcut-action", handleShortcutAction);
  }, [selectedEmailUid, selectedIds, handleMoveToTrash, handleArchive]);

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

    const sorted = uniqueEmails.sort((a, b) => {
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

    const pinned = [];
    const unpinned = [];
    sorted.forEach((email) => {
      const uid = email.uid ?? email.id;
      const isPinned = typeof isEmailPinned === 'function' ? isEmailPinned(uid, email) : false;
      if (isPinned) {
        pinned.push({ ...email, isPinned: true });
      } else {
        unpinned.push({ ...email, isPinned: false });
      }
    });
    return [...pinned, ...unpinned];
  }, [visibleEmails, pinnedIds, isEmailPinned]);

  const baseSelectedEmail = sortedEmails.find((e) => String(e.uid ?? e.id) === String(selectedEmailUid)) ||
    (selectedEmailOverride && (String(selectedEmailOverride.uid ?? selectedEmailOverride.id) === String(selectedEmailUid)) ? selectedEmailOverride : null);
  const selectedEmail = baseSelectedEmail ? {
    ...baseSelectedEmail,
    isRead: typeof isEmailRead === 'function' ? isEmailRead(baseSelectedEmail.uid ?? baseSelectedEmail.id, baseSelectedEmail) : Boolean(baseSelectedEmail.isRead ?? baseSelectedEmail.read)
  } : null;

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
    setSelectedEmailOverride(null);
    setSelectedEmailUid(email.uid);
    const unread = typeof isEmailRead === 'function'
      ? !isEmailRead(email.uid ?? email.id, email)
      : (!email.isRead && !email.read);
    if (unread && handleMarkRead) {
      handleMarkRead(email.uid ?? email.id, true, email);
    }
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
      visibilityFolder="important"
      emailList={sortedEmails}
      onNavigate={(email) => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(email.uid);
        const unread = typeof isEmailRead === 'function'
          ? !isEmailRead(email.uid ?? email.id, email)
          : (!email.isRead && !email.read);
        if (unread && handleMarkRead) {
          handleMarkRead(email.uid ?? email.id, true, email);
        }
      }}
      email={selectedEmail}
      onBack={() => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onClose={() => {
        setSelectedEmailOverride(null);
        setSelectedEmailUid(null);
      }}
      onDelete={(uid) => {
        handleDelete(uid, selectedEmail?.folderName);
      }}
      onStar={(uid, f) => handleToggleStar(uid, f || "important")}
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
      visibilityFolder="important"
    />
  ) : (
    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-transparent shrink-0">
      <div className="flex px-4 pt-1 items-center gap-2 sm:gap-3 text-sm font-medium">
        {/* Select All Checkbox */}
        <div className="flex items-center shrink-0 pr-1">
          <input
            type="checkbox"
            checked={sortedEmails.length > 0 && sortedEmails.every(e => selectedIds.has(`${e.uid}__${e.folderName || 'important'}`))}
            onChange={(e) => {
              if (e.target.checked) {
                const all = new Set(sortedEmails.map(email => `${email.uid}__${email.folderName || 'important'}`));
                setSelectedIds(all);
              } else {
                setSelectedIds(new Set());
              }
            }}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-[#1e1e1e]"
            title={t("common.select_all", "Select all")}
            aria-label="Select all"
          />
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => refreshEmails("important")}
          disabled={loading || isRefreshing}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
          title={t("common.refresh", "Refresh mail")}
        >
          <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
        </button>

        {/* Important Tab / Title */}
        <div className="flex gap-2 sm:gap-6 overflow-x-auto hidden-scrollbar flex-1">
          <div
            className="py-3 px-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-default font-medium text-sm"
            style={{ borderColor: theme.accent || "#135bec", color: theme.accent || "#135bec" }}
          >
            <MdLabelImportant size={18} />
            <span>{t("sidebar.important", "Important")}</span>
            <span
              className="text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm"
              style={{ backgroundColor: theme.accent || "#135bec" }}
            >
              {sortedEmails.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {loading && <div className="p-4 text-center text-xs opacity-60">Loading emails...</div>}
      <EmailList
        emails={sortedEmails}
        selectedEmailId={selectedEmailUid}
        onSelectEmail={handleSelectEmail}
        onDelete={(uid) => handleMoveToTrash(uid, "important")}
        onStar={(uid, f) => handleToggleStar(uid, f || "important")}
        onArchive={(uid) => handleArchive(uid, "important")}
        onSnooze={handleSnooze}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
      />
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

export default Important;
