import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdStar, MdStarBorder, MdRefresh } from "react-icons/md";
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
  const { emails, loading, isRefreshing, fetchEmails, refreshEmails, handleToggleStar, handleMoveToTrash, handleMarkRead, handleApplyLabel, handleArchive, handleUnarchive, handleSnooze, openCompose, matchesDateFilter, isEmailStarred } = useMail();
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
    fetchEmails('starred');
  }, [fetchEmails]);

  const visibleEmails = emails.filter((e) => {
    const isItemStarred = typeof isEmailStarred === 'function'
      ? isEmailStarred(e.uid ?? e.id, e.folderName || (isDraftEmail(e) ? 'draft' : 'starred'), e)
      : Boolean(e.starred || e.isStarred);
    if (!isItemStarred) return false;
    return typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true;
  });

  const sortedEmails = useMemo(() => {
    const getTimestamp = (item) => {
      if (!item) return 0;
      const raw = item.receivedDate || item.sentDate || item.date || item.createdAt || item.timestamp;
      if (!raw) return 0;
      const t = new Date(raw).getTime();
      return isNaN(t) ? 0 : t;
    };

    return [...visibleEmails].sort((a, b) => {
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

  const isDraftEmail = (email) => {
    if (!email) return false;
    const folder = email.folderName?.toLowerCase();
    return folder === 'draft' || folder === 'drafts' || email.isDraft === true || email.draft === true;
  };

  const handleSelectEmail = (email) => {
    if (isDraftEmail(email)) {
      openCompose({ draft: { ...email } });
      return;
    }
    setSelectedEmailUid(email.uid);
  };

  const handleUnstar = async (uid, folder) => {
    const email = sortedEmails.find((e) => String(e.uid) === String(uid));
    const targetFolder = isDraftEmail(email) ? 'draft' : (email?.folderName || folder || 'starred');
    await handleToggleStar(uid, targetFolder);
    if (String(selectedEmailUid) === String(uid)) {
      setSelectedEmailUid(null);
      setSelectedEmailOverride(null);
    }
  };

  const handleDelete = (uid, folder) => {
    const email = sortedEmails.find((e) => String(e.uid) === String(uid));
    const targetFolder = isDraftEmail(email) ? 'draft' : (folder || 'starred');
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
      visibleEmails={sortedEmails}
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
      </h2>
      <button
        onClick={() => refreshEmails("starred")}
        disabled={loading || isRefreshing}
        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0"
        title={t("common.refresh", "Refresh mail")}
      >
        <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
      </button>
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {sortedEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <MdStarBorder className="text-5xl mb-4 text-gray-300 dark:text-gray-600 opacity-55" />
          <p className="text-base font-semibold" style={{ color: theme.text }}>{t("starred.empty", "No starred messages")}</p>
          <p className="text-sm mt-1" style={{ color: theme.subText }}>{t("starred.empty_desc", "Stars let you give messages a special status to make them easier to find.")}</p>
        </div>
      ) : (
        <EmailList
          emails={sortedEmails}
          selectedEmailId={selectedEmailUid}
          onSelectEmail={handleSelectEmail}
          onStar={handleUnstar}
          onDelete={handleDelete}
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
