import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useMail } from "../context/MailContext";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const Archive = ({ searchQuery }) => {
  const { t } = useTranslation();
  const { theme, readingPaneMode } = useTheme();
  const { emails, loading, fetchEmails, handleToggleStar, handleMoveToTrash, handleUnarchive, handleSnooze, handleApplyLabel } = useMail();

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



  // Filter states
  const [showTime, setShowTime] = useState(false);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [filterHasAttachment, setFilterHasAttachment] = useState(null);
  const [filterReadStatus, setFilterReadStatus] = useState("all");
  const [filterStarred, setFilterStarred] = useState(null);

  const visibleEmails = emails.filter((e) => {
    if (matchesDateFilter && !matchesDateFilter(e)) return false;
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        e.subject?.toLowerCase().includes(q) ||
        e.from?.toLowerCase().includes(q) ||
        e.senderEmail?.toLowerCase().includes(q) ||
        e.to?.toLowerCase().includes(q) ||
        e.recipientEmail?.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q) ||
        e.textPlain?.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    // 2. From filter
    if (filterFrom) {
      const q = filterFrom.toLowerCase();
      const matchFrom =
        e.from?.toLowerCase().includes(q) ||
        e.senderEmail?.toLowerCase().includes(q);
      if (!matchFrom) return false;
    }

    // 3. To filter
    if (filterTo) {
      const q = filterTo.toLowerCase();
      const matchTo =
        e.to?.toLowerCase().includes(q) ||
        e.recipientEmail?.toLowerCase().includes(q);
      if (!matchTo) return false;
    }

    // 4. Date filter
    if (filterDate && e.receivedDate) {
      const emailDate = new Date(e.receivedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filterDate === "Today") {
        const start = new Date(today);
        if (emailDate < start) return false;
      } else if (filterDate === "Yesterday") {
        const start = new Date(today);
        start.setDate(start.getDate() - 1);
        const end = new Date(today);
        if (emailDate < start || emailDate >= end) return false;
      } else if (filterDate === "Last 7 days") {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        if (emailDate < start) return false;
      } else if (filterDate === "Last 30 days") {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        if (emailDate < start) return false;
      } else if (filterDate === "This month") {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        if (emailDate < start) return false;
      } else if (filterDate === "Custom date range") {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (emailDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (emailDate > end) return false;
        }
      }
    }

    // 5. Starred filter
    if (filterStarred && !e.starred) {
      return false;
    }

    // 6. Has attachment filter
    if (filterHasAttachment) {
      const hasAtt = e.hasAttachments || (e.attachments && e.attachments.length > 0) || (e.attachmentsJson && e.attachmentsJson.length > 2);
      if (!hasAtt) return false;
    }

    // 7. Read/Unread filter
    if (filterReadStatus === "unread" && e.isRead) {
      return false;
    }
    if (filterReadStatus === "read" && !e.isRead) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    fetchEmails('archive');
  }, [fetchEmails]);

  const handleSelectEmail = (email) => {
    setSelectedEmailUid(email.uid);
  };

  /* ---------------- LOADING ---------------- */
  if (loading && emails.length === 0) {
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
          <p style={{ color: theme.subText }}>Loading archive…</p>
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
        handleMoveToTrash(uid, "archive");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "archive")}
      onArchive={(uid) => {
        handleUnarchive(uid);
        setSelectedEmailUid(null);
      }}
      isArchiveFolder={true}
      onApplyLabel={handleApplyLabel}
      onSnooze={handleSnooze}
    />
  ) : null;

  const headerComponent = selectedIds.size > 0 ? (

    <BulkActionsToolbar
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      visibleEmails={visibleEmails}
      folder="archive"
    />

  ) : (

    <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 shrink-0 bg-transparent">
      <span
        className="px-4 py-1.5 text-xs font-bold rounded-full shadow-sm text-white tracking-wide flex items-center gap-1.5 uppercase select-none"
        style={{ background: theme.accent }}
      >
        📦 Archive ({emails.length})
      </span>

      {/* UI-only filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* From filter */}
        <FilterButton
          label={filterFrom ? `From: ${filterFrom}` : "From"}
          open={showFrom}
          setOpen={(val) => {
            setShowFrom(val);
            if (val) { setShowTo(false); setShowTime(false); setShowMore(false); }
          }}
          active={!!filterFrom}
        >
          <div className="flex flex-col gap-2">
            <div className="font-semibold text-gray-700 dark:text-gray-300">Filter by sender</div>
            <input
              type="text"
              placeholder="Sender name or email..."
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {filterFrom && (
              <button
                onClick={() => setFilterFrom("")}
                className="text-xs text-red-500 hover:text-red-600 text-left mt-1 cursor-pointer font-medium border-0 bg-transparent p-0"
              >
                Clear Filter
              </button>
            )}
          </div>
        </FilterButton>

        {/* To filter */}
        <FilterButton
          label={filterTo ? `To: ${filterTo}` : "To"}
          open={showTo}
          setOpen={(val) => {
            setShowTo(val);
            if (val) { setShowFrom(false); setShowTime(false); setShowMore(false); }
          }}
          active={!!filterTo}
        >
          <div className="flex flex-col gap-2">
            <div className="font-semibold text-gray-700 dark:text-gray-300">Filter by recipient</div>
            <input
              type="text"
              placeholder="Recipient name or email..."
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {filterTo && (
              <button
                onClick={() => setFilterTo("")}
                className="text-xs text-red-500 hover:text-red-600 text-left mt-1 cursor-pointer font-medium border-0 bg-transparent p-0"
              >
                Clear Filter
              </button>
            )}
          </div>
        </FilterButton>

        {/* Date filter */}
        <FilterButton
          label={filterDate ? `Date: ${filterDate}` : "Date"}
          open={showTime}
          setOpen={(val) => {
            setShowTime(val);
            if (val) { setShowFrom(false); setShowTo(false); setShowMore(false); }
          }}
          active={!!filterDate}
          align="right"
        >
          <div className="flex flex-col gap-2.5">
            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Filter by date</div>
            <div className="flex flex-col gap-1.5">
              {["Any time", "Today", "Yesterday", "Last 7 days", "Last 30 days", "This month", "Custom date range"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-655 dark:text-gray-355 hover:text-gray-900 dark:hover:text-gray-200 py-0.5">
                  <input
                    type="radio"
                    name="dateFilterArchive"
                    checked={(opt === "Any time" && !filterDate) || filterDate === opt}
                    onChange={() => {
                      if (opt === "Any time") {
                        setFilterDate("");
                      } else {
                        setFilterDate(opt);
                      }
                    }}
                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            {filterDate === "Custom date range" && (
              <div className="flex flex-col gap-2 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2 animate-in slide-in-from-top-2 duration-150">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-450 uppercase font-semibold">Start Date</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1.5 border border-gray-250 dark:border-gray-700 rounded-lg text-xs bg-transparent dark:text-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-450 uppercase font-semibold">End Date</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1.5 border border-gray-250 dark:border-gray-700 rounded-lg text-xs bg-transparent dark:text-white"
                  />
                </div>
              </div>
            )}

            {filterDate && (
              <button
                onClick={() => {
                  setFilterDate("");
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-xs text-red-500 hover:text-red-600 text-left mt-1 cursor-pointer font-medium border-0 bg-transparent p-0"
              >
                Clear Date Filter
              </button>
            )}
          </div>
        </FilterButton>

        {/* More filters */}
        <FilterButton
          label="More Filters"
          open={showMore}
          setOpen={(val) => {
            setShowMore(val);
            if (val) { setShowFrom(false); setShowTo(false); setShowTime(false); }
          }}
          active={filterHasAttachment !== null || filterReadStatus !== "all" || filterStarred !== null}
          align="right"
        >
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-gray-700 dark:text-gray-300">More filters</div>

            {/* Starred status */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-650 dark:text-gray-350 hover:text-gray-900 dark:hover:text-gray-250">
              <input
                type="checkbox"
                checked={filterStarred === true}
                onChange={(e) => setFilterStarred(e.target.checked ? true : null)}
                className="rounded border-gray-350 dark:border-gray-750 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-transparent cursor-pointer"
              />
              <span className="whitespace-nowrap">Starred messages only</span>
            </label>

            {/* Attachments status */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-650 dark:text-gray-350 hover:text-gray-900 dark:hover:text-gray-250">
              <input
                type="checkbox"
                checked={filterHasAttachment === true}
                onChange={(e) => setFilterHasAttachment(e.target.checked ? true : null)}
                className="rounded border-gray-350 dark:border-gray-755 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-transparent cursor-pointer"
              />
              <span className="whitespace-nowrap">Has attachment</span>
            </label>

            {/* Read/Unread Status */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-450 uppercase font-semibold">Message Status</span>
              <select
                value={filterReadStatus}
                onChange={(e) => setFilterReadStatus(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-250 dark:border-gray-755 rounded-lg text-xs bg-white dark:bg-gray-850 text-gray-850 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Messages</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </select>
            </div>

            {(filterHasAttachment !== null || filterReadStatus !== "all" || filterStarred !== null) && (
              <button
                onClick={() => {
                  setFilterHasAttachment(null);
                  setFilterReadStatus("all");
                  setFilterStarred(null);
                }}
                className="text-xs text-red-500 hover:text-red-600 text-left mt-1 cursor-pointer font-medium border-0 bg-transparent p-0"
              >
                Clear More Filters
              </button>
            )}
          </div>
        </FilterButton>
      </div>
    </div>

  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <span className="text-5xl mb-3">📭</span>
          <p className="text-base font-semibold" style={{ color: theme.text }}>No archived emails</p>
          <p className="text-sm" style={{ color: theme.subText }}>
            Archive emails to keep your inbox clean
          </p>
        </div>
      ) : (
        <EmailList
          emails={visibleEmails}
          selectedEmailId={selectedEmail?.uid}
          onSelectEmail={handleSelectEmail}
          onDelete={(uid) => handleMoveToTrash(uid, "archive")}
          onStar={(uid) => handleToggleStar(uid, "archive")}
          onArchive={handleUnarchive}
          isArchiveFolder={true}
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

/* ---------------- FILTER BUTTON ---------------- */
const FilterButton = ({ label, open, setOpen, children, active = false, align = "left" }) => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1 border rounded-full text-sm font-medium transition-colors cursor-pointer select-none flex items-center gap-1
          ${active
            ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750"
          }
        `}
      >
        <span>{label}</span>
        <span className="text-[10px]">▼</span>
      </button>

      {open && (
        <div className={`absolute mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-4 z-50 text-sm border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-150 ${
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        }`}>
          {children}
        </div>
      )}
    </div>
  );
};

export default Archive;
