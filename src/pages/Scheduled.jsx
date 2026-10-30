import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState, useCallback } from "react";
import { mailAPI } from "../services/api";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { MdRefresh } from "react-icons/md";
import toast from "react-hot-toast";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

// In-memory cache for instant zero-delay rendering on page revisits
let scheduledMemoryCache = null;
let isScheduledFetchInFlight = false;

export const invalidateScheduledCache = () => {
  scheduledMemoryCache = null;
};

const Scheduled = ({ searchQuery }) => {
  const { t } = useTranslation();
  const { theme, readingPaneMode } = useTheme();
  const { matchesDateFilter, unreadCounts, setUnreadCounts } = useMail();

  // Instant render: initialize from in-memory cache if available
  const [emails, setEmails] = useState(() => scheduledMemoryCache?.emails || []);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(() => !scheduledMemoryCache?.emails);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const fetchScheduled = useCallback(async (isSilent = false) => {
    // Prevent duplicate concurrent requests
    if (isScheduledFetchInFlight) return;
    isScheduledFetchInFlight = true;

    if (!isSilent && (!scheduledMemoryCache || !scheduledMemoryCache.emails)) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError("");

    try {
      const res = await mailAPI.getScheduled();
      if (res.data?.success) {
        const data = res.data.data;
        const rawList = Array.isArray(data) ? data : (data?.emails || []);
        const normalized = rawList.map((m) => ({
          ...m,
          isRead: true,
          starred: Boolean(m.starred),
          folderName: "scheduled",
        }));

        scheduledMemoryCache = {
          emails: normalized,
          timestamp: Date.now(),
        };

        setEmails(normalized);
        setError("");

        if (typeof setUnreadCounts === "function") {
          setUnreadCounts((prev) => ({
            ...prev,
            scheduled: normalized.length,
          }));
        }
      } else {
        throw new Error(res.data?.message || "Failed to retrieve scheduled emails");
      }
    } catch (err) {
      console.error("Failed to fetch scheduled emails:", err);
      // Only show full error view if there are no cached emails to show
      if (!scheduledMemoryCache || !scheduledMemoryCache.emails || scheduledMemoryCache.emails.length === 0) {
        setError(err.response?.data?.message || err.message || "Failed to load scheduled emails");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isScheduledFetchInFlight = false;
    }
  }, [setUnreadCounts]);

  useEffect(() => {
    // If we have cached emails, refresh silently in the background; otherwise fetch with loader
    const hasCache = Boolean(scheduledMemoryCache?.emails && scheduledMemoryCache.emails.length > 0);
    fetchScheduled(hasCache);

    const handleScheduledChange = () => {
      fetchScheduled(true);
    };

    window.addEventListener("bnx_scheduled_changed", handleScheduledChange);
    return () => {
      window.removeEventListener("bnx_scheduled_changed", handleScheduledChange);
    };
  }, [fetchScheduled]);

  const visibleEmails = emails.filter(
    (e) =>
      (typeof matchesDateFilter === "function" ? matchesDateFilter(e) : true) &&
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
    const targetId = uid;
    const prevEmails = emails;

    // Optimistic UI update: instantly remove from state and cache
    const nextEmails = prevEmails.filter(
      (e) => String(e.uid) !== String(targetId) && String(e.id) !== String(targetId)
    );
    setEmails(nextEmails);
    if (scheduledMemoryCache) {
      scheduledMemoryCache.emails = nextEmails;
    }
    if (selectedEmail && (String(selectedEmail.uid) === String(targetId) || String(selectedEmail.id) === String(targetId))) {
      setSelectedEmail(null);
    }
    if (typeof setUnreadCounts === "function") {
      setUnreadCounts((prev) => ({
        ...prev,
        scheduled: nextEmails.length,
      }));
    }

    try {
      toast.loading("Cancelling scheduled email...", { id: "cancel-schedule" });
      await mailAPI.cancelScheduled(targetId);
      toast.success("Scheduled email cancelled", { id: "cancel-schedule" });
      window.dispatchEvent(new CustomEvent("bnx_scheduled_changed"));
    } catch (err) {
      console.error("Failed to cancel scheduled email:", err);
      // Rollback on failure
      setEmails(prevEmails);
      if (scheduledMemoryCache) {
        scheduledMemoryCache.emails = prevEmails;
      }
      toast.error("Failed to cancel scheduled email", { id: "cancel-schedule" });
    }
  };

  const handleStar = (uid) => {
    setEmails((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, starred: !e.starred } : e))
    );
  };

  const handleArchive = (uid) => {
    setEmails((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, folder: "archive" } : e))
    );
    setSelectedEmail(null);
  };

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

  const headerComponent =
    selectedIds.size > 0 ? (
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
          {isRefreshing && (
            <span
              className="ml-2 inline-flex items-center text-[10px] text-blue-500 font-normal animate-pulse"
              title="Updating scheduled emails in background..."
            >
              • Syncing...
            </span>
          )}
        </h2>
        <button
          onClick={() => fetchScheduled(false)}
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
      {loading && emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mb-3"
            style={{ borderColor: theme.accent }}
          />
          <p className="text-sm font-medium" style={{ color: theme.subText }}>
            Loading scheduled emails...
          </p>
        </div>
      ) : error && emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <span className="text-4xl mb-3">⚠️</span>
          <p className="text-sm font-semibold text-red-500 mb-2">{error}</p>
          <button
            onClick={() => fetchScheduled(false)}
            className="px-4 py-1.5 rounded-full text-white text-xs font-medium shadow-sm hover:shadow transition-all cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            Retry
          </button>
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <span className="text-5xl mb-3">📬</span>
          <p className="text-base font-semibold" style={{ color: theme.text }}>
            No scheduled emails
          </p>
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
          showTo={true}
        />
      )}
    </div>
  );

  return (
    <ReadingPaneLayout
      mode={readingPaneMode || "no_split"}
      hasSelection={!!selectedEmail}
      listComponent={listComponent}
      detailsComponent={detailsComponent}
      headerComponent={headerComponent}
    />
  );
};

export default Scheduled;
