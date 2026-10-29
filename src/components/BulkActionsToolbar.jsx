import { useTranslation } from "../context/LanguageContext";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMail } from "../context/MailContext";
import { useTheme } from "../context/ThemeContext";
import {
  MdArchive,
  MdUnarchive,
  MdDelete,
  MdReport,
  MdMarkEmailRead,
  MdMail,
  MdMoreVert,
  MdAccessTime,
  MdLabel,
  MdReply,
  MdClose,
  MdBlock
} from "react-icons/md";
import toast from "react-hot-toast";

const BulkActionsToolbar = ({
  selectedIds,
  setSelectedIds,
  visibleEmails,
  folder,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    labels,
    handleMoveToTrash,
    handleDeletePermanently,
    handleArchive,
    handleUnarchive,
    handleMarkRead,
    handleMarkUnread,
    handleMarkSpam,
    handleRestoreSpam,
    handleRestore,
    handleUnsubscribe,
    handleSnooze,
    handleApplyLabel,
    openCompose
  } = useMail();

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSnoozeSub, setShowSnoozeSub] = useState(false);
  const [showLabelSub, setShowLabelSub] = useState(false);
  const [showCustomSnoozeForm, setShowCustomSnoozeForm] = useState(false);
  const [customSnoozeTime, setCustomSnoozeTime] = useState("");
  const menuRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
        setShowSnoozeSub(false);
        setShowLabelSub(false);
        setShowCustomSnoozeForm(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to check if an email is selected
  const isEmailSelected = useCallback((e) =>
    selectedIds.has(`${e.uid}__${e.folderName || ''}`) ||
    selectedIds.has(String(e.uid)) ||
    selectedIds.has(Number(e.uid)), [selectedIds]);

  // Find the selected email objects
  const selectedEmails = useMemo(() =>
    visibleEmails ? visibleEmails.filter(isEmailSelected) : [],
    [visibleEmails, isEmailSelected]);

  // Bulk Archive
  const handleBulkArchive = useCallback(async () => {
    if (!selectedEmails.length) return;
    try {
      toast.loading("Archiving selected emails...", { id: "bulk-archive" });
      await Promise.all(selectedEmails.map((e) => handleArchive(e.uid, e.folderName || folder, true)));
      setSelectedIds(new Set());
      toast.success("Emails archived", { id: "bulk-archive" });
    } catch (err) {
      toast.error("Failed to archive some emails", { id: "bulk-archive" });
    }
  }, [selectedEmails, handleArchive, folder, setSelectedIds]);

  // Bulk Trash or Permanent Delete
  const handleBulkDelete = useCallback(async () => {
    if (!selectedEmails.length) return;
    try {
      if (folder === "trash" && handleDeletePermanently) {
        toast.loading("Permanently deleting selected emails...", { id: "bulk-delete" });
        for (const e of selectedEmails) {
          try {
            await handleDeletePermanently(e.uid, true);
          } catch (err) {
            console.warn(`Failed to permanently delete ${e.uid}:`, err);
          }
        }
        setSelectedIds(new Set());
        toast.success("Emails permanently deleted", { id: "bulk-delete" });
      } else {
        toast.loading("Deleting selected emails...", { id: "bulk-delete" });
        for (const e of selectedEmails) {
          try {
            await handleMoveToTrash(e.uid, e.folderName || folder, true);
          } catch (err) {
            console.warn(`Failed to move ${e.uid} to trash:`, err);
          }
        }
        setSelectedIds(new Set());
        toast.success("Emails moved to trash", { id: "bulk-delete" });
      }
    } catch (err) {
      toast.error("Failed to delete some emails", { id: "bulk-delete" });
    }
  }, [selectedEmails, folder, handleDeletePermanently, handleMoveToTrash, setSelectedIds]);

  // Global Keyboard Shortcuts integration for selected emails in any folder
  useEffect(() => {
    const handleShortcutAction = (e) => {
      if (e.detail?.handled) return;
      const action = e.detail?.action;
      if (!action || !selectedIds || selectedIds.size === 0) return;

      if (action === "delete") {
        e.detail.handled = true;
        handleBulkDelete();
      } else if (action === "archive") {
        e.detail.handled = true;
        handleBulkArchive();
      } else if (action === "reply") {
        if (selectedEmails.length === 1) {
          const targetEmail = selectedEmails[0];
          if (targetEmail) {
            e.detail.handled = true;
            openCompose({
              replyTo: targetEmail.senderEmail || targetEmail.from,
              subject: `Re: ${targetEmail.subject || ""}`,
              originalBody: targetEmail.body,
            });
          }
        }
      } else if (action === "forward") {
        if (selectedEmails.length === 1) {
          const targetEmail = selectedEmails[0];
          if (targetEmail) {
            e.detail.handled = true;
            openCompose({
              forward: true,
              subject: targetEmail.subject?.startsWith("Fwd:") ? targetEmail.subject : `Fwd: ${targetEmail.subject || ""}`,
              originalBody: targetEmail.body,
              originalEmail: targetEmail,
            });
          }
        }
      } else if (action === "back") {
        e.detail.handled = true;
        setSelectedIds(new Set());
      }
    };

    window.addEventListener("bnx-shortcut-action", handleShortcutAction);
    return () => window.removeEventListener("bnx-shortcut-action", handleShortcutAction);
  }, [selectedIds, selectedEmails, handleBulkDelete, handleBulkArchive, openCompose, setSelectedIds]);

  if (selectedIds.size === 0) return null;

  // Determine if any of the selected emails are unread
  const hasUnread = selectedEmails.some((e) => !e.isRead);

  // Select all toggle handler
  const handleSelectAllToggle = () => {
    const allSelected = visibleEmails.length > 0 && visibleEmails.every(isEmailSelected);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleEmails.map((e) => `${e.uid}__${e.folderName || ''}`)));
    }
  };

  // Bulk Unarchive / Restore
  const handleBulkUnarchive = async () => {
    try {
      toast.loading("Restoring selected emails...", { id: "bulk-restore" });
      if (folder === "spam") {
        await Promise.all(selectedEmails.map((e) => handleRestoreSpam(e.uid, true)));
      } else if (folder === "trash") {
        await Promise.all(selectedEmails.map((e) => handleRestore ? handleRestore(e.uid, true) : mailAPI.restore(e.uid)));
      } else {
        await Promise.all(selectedEmails.map((e) => handleUnarchive(e.uid, true)));
      }
      setSelectedIds(new Set());
      toast.success("Emails restored", { id: "bulk-restore" });
    } catch (err) {
      toast.error("Failed to restore some emails", { id: "bulk-restore" });
    }
  };

  // Bulk Mark Read / Unread
  const handleBulkReadStatus = async () => {
    try {
      toast.loading("Updating read status...", { id: "bulk-read" });
      if (hasUnread) {
        await Promise.all(selectedEmails.map((e) => !e.isRead ? handleMarkRead(e.uid || e.id || e.messageId, true) : Promise.resolve()));
        toast.success("Emails marked as read", { id: "bulk-read" });
      } else {
        await Promise.all(selectedEmails.map((e) => e.isRead ? handleMarkUnread(e.uid || e.id || e.messageId, true) : Promise.resolve()));
        toast.success("Emails marked as unread", { id: "bulk-read" });
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error("Failed to update status", { id: "bulk-read" });
    }
  };

  // Bulk Spam
  const handleBulkSpam = async () => {
    try {
      toast.loading("Reporting spam...", { id: "bulk-spam" });
      await Promise.all(selectedEmails.map((e) => handleMarkSpam(e.uid, e.folderName || folder, true)));
      setSelectedIds(new Set());
      toast.success("Reported as spam", { id: "bulk-spam" });
    } catch (err) {
      toast.error("Failed to report spam", { id: "bulk-spam" });
    }
  };

  // Bulk Unsubscribe
  const handleBulkUnsubscribe = async () => {
    try {
      toast.loading("Unsubscribing...", { id: "bulk-unsub" });
      const uniqueSenders = [...new Set(selectedEmails.map((e) => e.senderEmail || e.from).filter(Boolean))];
      await Promise.all(uniqueSenders.map((email) => handleUnsubscribe(email, true)));
      setSelectedIds(new Set());
      toast.success("Unsubscribed successfully", { id: "bulk-unsub" });
    } catch (err) {
      toast.error("Failed to unsubscribe", { id: "bulk-unsub" });
    }
  };

  // Bulk Snooze
  const handleBulkSnooze = async (hours) => {
    try {
      toast.loading("Snoozing selected emails...", { id: "bulk-snooze" });
      const wakeUpAt = new Date();
      wakeUpAt.setHours(wakeUpAt.getHours() + hours);
      await Promise.all(selectedEmails.map((e) => handleSnooze(e.uid, wakeUpAt.toISOString(), e.folderName || folder, true)));
      setSelectedIds(new Set());
      setShowMoreMenu(false);
      toast.success("Emails snoozed", { id: "bulk-snooze" });
    } catch (err) {
      toast.error("Failed to snooze emails", { id: "bulk-snooze" });
    }
  };

  // Bulk Snooze with custom Date ISO string
  const handleBulkSnoozeWithDate = async (wakeUpAtIso) => {
    try {
      toast.loading("Snoozing selected emails...", { id: "bulk-snooze" });
      await Promise.all(selectedEmails.map((e) => handleSnooze(e.uid, wakeUpAtIso, e.folderName || folder, true)));
      setSelectedIds(new Set());
      setShowMoreMenu(false);
      setShowSnoozeSub(false);
      setShowCustomSnoozeForm(false);
      toast.success("Emails snoozed", { id: "bulk-snooze" });
    } catch (err) {
      toast.error("Failed to snooze emails", { id: "bulk-snooze" });
    }
  };

  // Bulk Apply Label
  const handleBulkApplyLabel = async (labelId) => {
    try {
      toast.loading("Applying label...", { id: "bulk-label" });
      await Promise.all(selectedEmails.map((e) => handleApplyLabel(e.uid, labelId, e.folderName || folder, true)));
      setSelectedIds(new Set());
      setShowMoreMenu(false);
      toast.success("Label applied", { id: "bulk-label" });
    } catch (err) {
      toast.error("Failed to apply label", { id: "bulk-label" });
    }
  };

  // Bulk Reply (Only for single select)
  const handleBulkReply = () => {
    if (selectedEmails.length !== 1) return;
    const email = selectedEmails[0];
    openCompose({
      replyTo: email.senderEmail || email.from,
      subject: `Re: ${email.subject || ""}`,
      originalBody: email.body,
    });
    setSelectedIds(new Set());
    setShowMoreMenu(false);
  };

  return (
    <div 
      className="flex items-center gap-3 px-4 py-2.5 rounded-t-2xl shrink-0 transition-all border-b"
      style={{ 
        backgroundColor: theme.bg || "rgba(19, 91, 236, 0.05)", 
        borderColor: theme.border,
        color: theme.text
      }}
    >
      {/* Select All Checkbox */}
      <input
        type="checkbox"
        checked={visibleEmails.length > 0 && visibleEmails.every((e) => selectedIds.has(`${e.uid}__${e.folderName || ''}`))}
        onChange={handleSelectAllToggle}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer shrink-0"
      />

      <span className="text-xs font-bold shrink-0">{selectedIds.size} {t("bulk_actions.selected", "selected")}</span>

      <button 
        onClick={() => setSelectedIds(new Set())}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer flex items-center justify-center"
        title={t("bulk_actions.clear_selection", "Clear Selection")}
      >
        <MdClose size={18} />
      </button>

      {/* Bulk Action Buttons Row */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Archive/Unarchive */}
        {folder === "archive" || folder === "spam" || folder === "trash" ? (
          <button
            onClick={handleBulkUnarchive}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("bulk_actions.restore", "Restore / Move to Inbox")}
          >
            <MdUnarchive size={19} />
          </button>
        ) : (
          <button
            onClick={handleBulkArchive}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("common.archive", "Archive")}
          >
            <MdArchive size={19} />
          </button>
        )}

        {/* Report Spam (not shown in spam/trash) */}
        {folder !== "spam" && folder !== "trash" && (
          <button
            onClick={handleBulkSpam}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("bulk_actions.report_spam", "Report Spam")}
          >
            <MdReport size={19} />
          </button>
        )}

        {/* Mark Read/Unread */}
        <button
          onClick={handleBulkReadStatus}
          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
          title={hasUnread ? t("common.mark_read", "Mark as Read") : t("common.mark_unread", "Mark as Unread")}
        >
          {hasUnread ? <MdMarkEmailRead size={19} /> : <MdMail size={19} />}
        </button>

        {/* Delete */}
        <button
          onClick={handleBulkDelete}
          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 hover:text-red-700 rounded-xl transition-all cursor-pointer flex items-center justify-center"
          title={t("common.delete", "Delete")}
        >
          <MdDelete size={19} />
        </button>

        {/* More Actions vertical dots menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("email_details.more_actions", "More Options")}
          >
            <MdMoreVert size={19} />
          </button>

          {showMoreMenu && (
            <div 
              className="absolute right-0 mt-1 w-48 rounded-xl shadow-xl dark:shadow-soft-dark border z-50 py-1 bg-white dark:bg-gray-900 text-xs text-left"
              style={{ borderColor: theme.border }}
            >
              {/* Snooze Sub-Trigger */}
              <div className="relative">
                <button
                  onMouseEnter={() => {
                    if (!showCustomSnoozeForm) {
                      setShowSnoozeSub(true);
                      setShowLabelSub(false);
                    }
                  }}
                  onClick={() => setShowSnoozeSub(!showSnoozeSub)}
                  className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <MdAccessTime size={16} className="text-gray-400" /> {t("common.snooze", "Snooze")}...
                </button>
                {showSnoozeSub && (
                  <div 
                    className="absolute right-full top-0 mr-1 w-44 rounded-xl shadow-xl border bg-white dark:bg-gray-900 py-1 z-[60]"
                    style={{ borderColor: theme.border }}
                  >
                    {showCustomSnoozeForm ? (
                      <div className="p-3 flex flex-col gap-2 bg-white dark:bg-gray-900">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t("bulk_actions.select_datetime", "Select Date & Time")}</label>
                        <input
                          type="datetime-local"
                          value={customSnoozeTime}
                          onChange={(e) => setCustomSnoozeTime(e.target.value)}
                          className="w-full p-1.5 rounded-lg border text-xs bg-gray-50 dark:bg-neutral-850 text-gray-900 dark:text-white outline-none border-gray-200 dark:border-neutral-700"
                        />
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button
                            onClick={() => setShowCustomSnoozeForm(false)}
                            className="px-2 py-1 rounded text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            {t("common.back", "Back")}
                          </button>
                          <button
                            onClick={() => {
                              if (!customSnoozeTime) {
                                alert("Please select a valid date and time.");
                                return;
                              }
                              const dateObj = new Date(customSnoozeTime);
                              if (dateObj <= new Date()) {
                                alert("Please select a future date and time.");
                                return;
                              }
                              handleBulkSnoozeWithDate(dateObj.toISOString());
                            }}
                            className="px-2 py-1 rounded text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            {t("common.save", "Save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => handleBulkSnooze(2)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">{t("bulk_actions.later_today", "Later today")}</button>
                        <button onClick={() => handleBulkSnooze(24)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">{t("bulk_actions.tomorrow", "Tomorrow")}</button>
                        <button onClick={() => handleBulkSnooze(48)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">{t("bulk_actions.this_weekend", "This weekend")}</button>
                        <button onClick={() => handleBulkSnooze(168)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">{t("bulk_actions.next_week", "Next week")}</button>
                        <div className="border-t border-gray-100 dark:border-neutral-800 my-1"></div>
                        <button
                          onClick={() => {
                            setShowCustomSnoozeForm(true);
                            const defaultCustom = new Date();
                            defaultCustom.setMinutes(defaultCustom.getMinutes() - defaultCustom.getTimezoneOffset());
                            setCustomSnoozeTime(defaultCustom.toISOString().slice(0, 16));
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-blue-500 font-semibold"
                        >
                          {t("bulk_actions.select_datetime", "Select date & time")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Label As Sub-Trigger */}
              <div className="relative">
                <button
                  onMouseEnter={() => { setShowLabelSub(true); setShowSnoozeSub(false); }}
                  onClick={() => setShowLabelSub(!showLabelSub)}
                  className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <MdLabel size={16} className="text-gray-400" /> {t("bulk_actions.label_as", "Label as...")}
                </button>
                {showLabelSub && (
                  <div 
                    className="absolute right-full top-0 mr-1 w-44 max-h-48 overflow-y-auto rounded-xl shadow-xl border bg-white dark:bg-gray-900 py-1 z-[60] hidden-scrollbar"
                    style={{ borderColor: theme.border }}
                  >
                    {labels.length === 0 ? (
                      <div className="px-4 py-2 text-gray-400">{t("bulk_actions.no_labels", "No labels found")}</div>
                    ) : (
                      labels.map((lbl) => (
                        <button 
                          key={lbl.id} 
                          onClick={() => handleBulkApplyLabel(lbl.id)} 
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lbl.colorHex || "#135bec" }} />
                          <span className="truncate">{lbl.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Unsubscribe */}
              <button
                onClick={handleBulkUnsubscribe}
                onMouseEnter={() => { setShowSnoozeSub(false); setShowLabelSub(false); }}
                className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
              >
                <MdBlock size={16} className="text-gray-400" /> {t("bulk_actions.unsubscribe", "Unsubscribe")}
              </button>

              {/* Reply (only for 1 selected) */}
              {selectedEmails.length === 1 && (
                <button
                  onClick={handleBulkReply}
                  onMouseEnter={() => { setShowSnoozeSub(false); setShowLabelSub(false); }}
                  className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300 font-bold border-t border-gray-100 dark:border-gray-850 mt-1 pt-1"
                >
                  <MdReply size={16} className="text-gray-400" /> {t("common.reply", "Reply")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkActionsToolbar;
