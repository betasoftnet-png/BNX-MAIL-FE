import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { MdMailOutline, MdRefresh, MdMoreVert, MdArrowDropDown, MdAttachFile } from "react-icons/md";
import EmailList from "../components/EmailList";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";

import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";

const BulkMail = ({ searchQuery }) => {
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { handleToggleStar, handleMoveToTrash, handleArchive, handleSnooze, handleApplyLabel, openCompose } = useMail();
  const [selectedEmailUid, setSelectedEmailUid] = useState(null);

  // Zoho-style elements state variables
  const [activeView, setActiveView] = useState("All"); // "All", "Unread", "Starred", "Has Attachments"
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const [activeAttachmentFilter, setActiveAttachmentFilter] = useState("All Files");
  const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showSmartFilter, setShowSmartFilter] = useState(true);

  const handleDoNotAskAgain = () => {
    setShowSmartFilter(false);
  };

  // Empty state requirements: no dummy emails, no fake counts
  const emails = [];
  const visibleEmails = [];
  const selectedEmail = null;

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
      onDelete={(uid) => {
        handleMoveToTrash(uid, "bulk");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "bulk")}
      onArchive={(uid) => {
        handleArchive(uid, "bulk");
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
      folder="bulk"
    />
  ) : (
    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-transparent shrink-0">
      {/* Title & Description row */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100/50 dark:border-gray-800/50">
        <div className="flex items-center gap-3">
          <span
            className="px-4 py-1.5 text-xs font-bold rounded-full shadow-sm text-white tracking-wide flex items-center gap-1.5 uppercase select-none"
            style={{ background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)` }}
          >
            <MdMailOutline size={15} /> Bulk Mail
          </span>
          <button
            onClick={() => { }}
            disabled={true}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer"
            title="Refresh mail"
          >
            <MdRefresh size={18} />
          </button>
        </div>
      </div>

      {/* Zoho-style Toolbar row */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100/50 dark:border-gray-800/50 text-sm select-none gap-2 flex-wrap">
        {/* Left Toolbar actions */}
        <div className="flex items-center gap-3">
          {/* Select Checkbox */}
          <div className="flex items-center justify-center p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 dark:border-gray-700 text-primary focus:ring-primary cursor-pointer w-4 h-4 shrink-0"
              disabled={true}
            />
          </div>

          {/* Views Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowViewsDropdown(!showViewsDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              <span>View: {activeView}</span>
              <MdArrowDropDown size={16} className="-mr-0.5 opacity-75" />
            </button>
            {showViewsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowViewsDropdown(false)} />
                <div
                  className="absolute left-0 top-full mt-1 w-44 py-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border z-50 text-xs overflow-hidden"
                  style={{ borderColor: theme.border }}
                >
                  {["All", "Unread", "Starred", "Has Attachments"].map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        setActiveView(v);
                        setShowViewsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      style={{ color: theme.text }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Attachment Options */}
          <div className="relative">
            <button
              onClick={() => setShowAttachmentDropdown(!showAttachmentDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              <MdAttachFile size={15} className="-rotate-45" />
              <span>Attachments: {activeAttachmentFilter}</span>
              <MdArrowDropDown size={16} className="-mr-0.5 opacity-75" />
            </button>
            {showAttachmentDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachmentDropdown(false)} />
                <div
                  className="absolute left-0 top-full mt-1 w-44 py-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border z-50 text-xs overflow-hidden"
                  style={{ borderColor: theme.border }}
                >
                  {["All Files", "Images", "Documents", "PDFs", "Archives"].map(af => (
                    <button
                      key={af}
                      onClick={() => {
                        setActiveAttachmentFilter(af);
                        setShowAttachmentDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      style={{ color: theme.text }}
                    >
                      {af}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Toolbar actions */}
        <div className="flex items-center gap-2">
          {/* More options */}
          <div className="relative">
            <button
              onClick={() => setShowMoreDropdown(!showMoreDropdown)}
              className="p-1.5 rounded-lg border transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center"
              style={{ borderColor: theme.border, color: theme.text }}
              title="More Actions"
            >
              <MdMoreVert size={16} />
            </button>
            {showMoreDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-48 py-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border z-50 text-xs overflow-hidden"
                  style={{ borderColor: theme.border }}
                >
                  <button
                    onClick={() => { setShowMoreDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    style={{ color: theme.text }}
                  >
                    Mark folder as read
                  </button>
                  <button
                    onClick={() => { setShowMoreDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-red-500 hover:text-red-600"
                  >
                    Clear folder (Delete all)
                  </button>
                  <hr className="border-gray-100 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => { navigate("/settings"); setShowMoreDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    style={{ color: theme.text }}
                  >
                    Manage filter settings
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Smart Filter banner */}
      {showSmartFilter && (
        <div className="px-4 py-2 bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-100/50 dark:border-gray-800/50 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span className="text-blue-500">ðŸ’¡</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Smart Filter:</span>
            <span>Mass-mail, newsletters, and promotional alerts are automatically redirected here to keep your primary inbox uncluttered.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { }}
              className="text-red-500 hover:text-red-600 hover:underline font-medium cursor-pointer"
            >
              Disable automatic Bulk Mail classification
            </button>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <button
              onClick={handleDoNotAskAgain}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:underline font-medium cursor-pointer"
            >
              Do not ask again
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <MdMailOutline size={52} className="text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
        <p
          className="text-base font-semibold mb-1"
          style={{ color: theme.text }}
        >
          No bulk mail emails yet.
        </p>
        <p className="text-sm max-w-sm" style={{ color: theme.subText }}>
          Bulk and mass-mail emails identified by BNX Mail will appear here automatically.
        </p>
      </div>
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

export default BulkMail;
