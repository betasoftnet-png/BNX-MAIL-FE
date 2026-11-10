import { useTranslation } from "../context/LanguageContext";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  MdBlock,
  MdAlarmOff,
  MdCheck
} from "react-icons/md";
import toast from "react-hot-toast";
import {
  getSnoozeOptions as getStorageSnoozeOptions,
  getLocalDatetimeInputString,
  parseLocalDatetimeString,
} from "../utils/snoozeStorage";
import { getAvailableLabelAsOptions, isLabelShownInLabelList } from "../utils/labelPreferences";

const BulkActionsToolbar = ({
  selectedIds,
  setSelectedIds,
  visibleEmails,
  folder,
}) => {
  const { t } = useTranslation();
  const { theme, sidebarPreferences, customLabelPreferences, labelPrefsVersion } = useTheme();
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
    handleUnsnooze,
    handleApplyLabel,
    handleRemoveLabel,
    openCompose,
    isEmailRead
  } = useMail();

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSnoozeSub, setShowSnoozeSub] = useState(false);
  const [showLabelSub, setShowLabelSub] = useState(false);
  const [showCustomSnoozeForm, setShowCustomSnoozeForm] = useState(false);
  const [customSnoozeTime, setCustomSnoozeTime] = useState("");
  const menuRef = useRef(null);

  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => {
    const onPrefsChanged = () => setPrefsTick((t) => t + 1);
    window.addEventListener("bnx-label-prefs-changed", onPrefsChanged);
    window.addEventListener("storage", onPrefsChanged);
    return () => {
      window.removeEventListener("bnx-label-prefs-changed", onPrefsChanged);
      window.removeEventListener("storage", onPrefsChanged);
    };
  }, []);

  const availableLabels = useMemo(() => {
    return getAvailableLabelAsOptions(labels, sidebarPreferences, customLabelPreferences);
  }, [labels, sidebarPreferences, customLabelPreferences, labelPrefsVersion, prefsTick, showMoreMenu, showLabelSub]);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    right: 0,
    left: 0,
    openUpwards: false,
    openSubRight: false
  });

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const menuWidth = 192; // w-48 = 192px
    const estimatedHeight = 220;

    const top = rect.bottom + 4;

    let right = viewportWidth - rect.right;
    if (rect.right - menuWidth < 8) {
      right = Math.max(8, viewportWidth - menuWidth - 8);
    } else {
      right = Math.max(8, right);
    }

    const computedLeft = viewportWidth - right - menuWidth;
    const openSubRight = computedLeft < 185;

    let adjustedTop = top;
    let openUpwards = false;
    if (top + estimatedHeight > viewportHeight && rect.top > estimatedHeight) {
      adjustedTop = Math.max(8, rect.top - estimatedHeight - 4);
      openUpwards = true;
    } else {
      if (adjustedTop + estimatedHeight > viewportHeight) {
        adjustedTop = Math.max(8, viewportHeight - estimatedHeight - 8);
      }
    }

    setDropdownPos({
      top: adjustedTop,
      right: right,
      left: Math.max(8, computedLeft),
      openUpwards,
      openSubRight
    });
  }, []);

  const toggleMoreMenu = (e) => {
    e.stopPropagation();
    const next = !showMoreMenu;
    if (next) {
      updateDropdownPosition();
    } else {
      setShowSnoozeSub(false);
      setShowLabelSub(false);
      setShowCustomSnoozeForm(false);
    }
    setShowMoreMenu(next);
  };

  useEffect(() => {
    if (!showMoreMenu) return;

    updateDropdownPosition();

    const handleWindowEvents = () => {
      updateDropdownPosition();
    };

    window.addEventListener("resize", handleWindowEvents);
    window.addEventListener("scroll", handleWindowEvents, true);

    return () => {
      window.removeEventListener("resize", handleWindowEvents);
      window.removeEventListener("scroll", handleWindowEvents, true);
    };
  }, [showMoreMenu, updateDropdownPosition]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowMoreMenu(false);
        setShowSnoozeSub(false);
        setShowLabelSub(false);
        setShowCustomSnoozeForm(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMoreMenu]);

  // Helper to check if an email is selected
  const isEmailSelected = useCallback((e) =>
    (e._rowKey && (selectedIds.has(e._rowKey) || selectedIds.has(`${e._rowKey}__${e.folderName || ''}`))) ||
    selectedIds.has(`${e.uid}__${e.folderName || ''}`) ||
    selectedIds.has(String(e.uid)) ||
    selectedIds.has(Number(e.uid)), [selectedIds]);

  // Find the selected email objects
  const selectedEmails = useMemo(() =>
    visibleEmails ? visibleEmails.filter(isEmailSelected) : [],
    [visibleEmails, isEmailSelected]);

  // Deduplicate emails by UID for bulk operations to prevent duplicate API requests
  const uniqueSelectedEmails = useMemo(() => {
    const seen = new Set();
    return selectedEmails.filter((e) => {
      const key = String(e.uid ?? e.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedEmails]);

  // Bulk Archive
  const handleBulkArchive = useCallback(async () => {
    if (!uniqueSelectedEmails.length) return;
    try {
      toast.loading("Archiving selected emails...", { id: "bulk-archive" });
      await Promise.all(uniqueSelectedEmails.map((e) => handleArchive(e.uid, e.folderName || folder, true)));
      setSelectedIds(new Set());
      toast.success("Emails archived", { id: "bulk-archive" });
    } catch (err) {
      toast.error("Failed to archive some emails", { id: "bulk-archive" });
    }
  }, [uniqueSelectedEmails, handleArchive, folder, setSelectedIds]);

  // Bulk Trash or Permanent Delete
  const handleBulkDelete = useCallback(async () => {
    if (!uniqueSelectedEmails.length) return;
    try {
      if (folder === "trash" && handleDeletePermanently) {
        toast.loading("Permanently deleting selected emails...", { id: "bulk-delete" });
        for (const e of uniqueSelectedEmails) {
          try {
            await handleDeletePermanently(e.uid, true);
          } catch (err) {
            console.warn(`Failed to permanently delete ${e.uid}:`, err);
          }
        }
        setSelectedIds(new Set());
        toast.success("Emails permanently deleted", { id: "bulk-delete" });
      } else {
        const itemsToTrash = uniqueSelectedEmails.map(e => ({
          uid: e.uid,
          folder: e.folderName || folder
        }));
        await handleMoveToTrash(itemsToTrash, folder, true);
        setSelectedIds(new Set());
      }
    } catch (err) {
      toast.error("Failed to delete some emails", { id: "bulk-delete" });
    }
  }, [uniqueSelectedEmails, folder, handleDeletePermanently, handleMoveToTrash, setSelectedIds]);

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
        if (folder !== "scheduled") {
          e.detail.handled = true;
          handleBulkArchive();
        }
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
  const isItemUnread = (e) => {
    const uidStr = String(e.uid ?? e.id ?? '');
    if (isEmailRead && isEmailRead(uidStr)) return false;
    return !e.isRead && !e.read;
  };
  const hasUnread = selectedEmails.some(isItemUnread);

  // Select all toggle handler
  const handleSelectAllToggle = () => {
    const allSelected = visibleEmails.length > 0 && visibleEmails.every(isEmailSelected);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleEmails.map((e) => e._rowKey || `${e.uid}__${e.folderName || ''}`)));
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
        await Promise.all(selectedEmails.map((e) => isItemUnread(e) ? handleMarkRead(e.uid || e.id || e.messageId, true, e) : Promise.resolve()));
        toast.success("Emails marked as read", { id: "bulk-read" });
      } else {
        await Promise.all(selectedEmails.map((e) => !isItemUnread(e) ? handleMarkUnread(e.uid || e.id || e.messageId, true, e) : Promise.resolve()));
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
      setShowMoreMenu(false);
      setShowSnoozeSub(false);
      setShowLabelSub(false);
      setShowCustomSnoozeForm(false);
      toast.success("Unsubscribed successfully", { id: "bulk-unsub" });
    } catch (err) {
      toast.error("Failed to unsubscribe", { id: "bulk-unsub" });
    }
  };

  // Bulk Unsnooze
  const handleBulkUnsnooze = useCallback(async () => {
    if (!uniqueSelectedEmails.length) return;
    try {
      toast.loading("Unsnoozing selected emails...", { id: "bulk-unsnooze" });
      await Promise.all(uniqueSelectedEmails.map((e) => handleUnsnooze(e.uid, e, true)));
      setSelectedIds(new Set());
      setShowMoreMenu(false);
      setShowSnoozeSub(false);
      setShowCustomSnoozeForm(false);
      toast.success("Emails unsnoozed", { id: "bulk-unsnooze" });
    } catch (err) {
      toast.error("Failed to unsnooze some emails", { id: "bulk-unsnooze" });
    }
  }, [uniqueSelectedEmails, handleUnsnooze, setSelectedIds]);

  // Bulk Snooze with custom Date ISO string
  const handleBulkSnoozeWithDate = async (wakeUpAtIso) => {
    if (!uniqueSelectedEmails.length) return;
    try {
      toast.loading("Snoozing selected emails...", { id: "bulk-snooze" });
      await Promise.all(uniqueSelectedEmails.map((e) => handleSnooze(e.uid, wakeUpAtIso, e.folderName || folder || 'INBOX', e, true)));
      setSelectedIds(new Set());
      setShowMoreMenu(false);
      setShowSnoozeSub(false);
      setShowCustomSnoozeForm(false);
      toast.success("Emails snoozed", { id: "bulk-snooze" });
    } catch (err) {
      toast.error("Failed to snooze emails", { id: "bulk-snooze" });
    }
  };

  // Bulk Apply / Remove Label
  const handleBulkToggleLabel = async (labelId, isCurrentlyAssigned) => {
    try {
      if (isCurrentlyAssigned && typeof handleRemoveLabel === "function") {
        toast.loading("Removing label...", { id: "bulk-label" });
        await Promise.all(selectedEmails.map((e) => handleRemoveLabel(e.uid, labelId, e.folderName || folder, true)));
        setSelectedIds(new Set());
        setShowMoreMenu(false);
        setShowLabelSub(false);
        toast.success("Label removed", { id: "bulk-label" });
      } else {
        toast.loading("Applying label...", { id: "bulk-label" });
        await Promise.all(selectedEmails.map((e) => handleApplyLabel(e.uid, labelId, e.folderName || folder, true)));
        setSelectedIds(new Set());
        setShowMoreMenu(false);
        setShowLabelSub(false);
        toast.success("Label applied", { id: "bulk-label" });
      }
    } catch (err) {
      toast.error(isCurrentlyAssigned ? "Failed to remove label" : "Failed to apply label", { id: "bulk-label" });
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
      className="relative z-20 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-2xl shrink-0 transition-all border-b overflow-x-auto hidden-scrollbar min-w-0"
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

      <span className="text-xs font-bold shrink-0 whitespace-nowrap">{selectedIds.size} {t("bulk_actions.selected", "selected")}</span>

      <button 
        onClick={() => setSelectedIds(new Set())}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer flex items-center justify-center shrink-0"
        title={t("bulk_actions.clear_selection", "Clear Selection")}
      >
        <MdClose size={18} />
      </button>

      {/* Bulk Action Buttons Row */}
      <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
        {/* Unsnooze (for snoozed folder) */}
        {folder === "snoozed" && (
          <button
            onClick={handleBulkUnsnooze}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-blue-600 dark:text-blue-400 flex items-center justify-center"
            title={t("snooze.unsnooze", "Unsnooze / Return to Inbox")}
          >
            <MdAlarmOff size={19} />
          </button>
        )}

        {/* Archive/Unarchive */}
        {folder === "archive" || folder === "spam" || folder === "trash" ? (
          <button
            onClick={handleBulkUnarchive}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("bulk_actions.restore", "Restore / Move to Inbox")}
          >
            <MdUnarchive size={19} />
          </button>
        ) : folder !== "scheduled" && folder !== "snoozed" ? (
          <button
            onClick={handleBulkArchive}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("common.archive", "Archive")}
          >
            <MdArchive size={19} />
          </button>
        ) : null}

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
            ref={buttonRef}
            onClick={toggleMoreMenu}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer text-gray-600 dark:text-gray-300 flex items-center justify-center"
            title={t("email_details.more_actions", "More Options")}
          >
            <MdMoreVert size={19} />
          </button>

          {showMoreMenu && typeof document !== "undefined" && createPortal(
            <>
              {/* Invisible backdrop to capture outside clicks */}
              <div
                className="fixed inset-0 z-[99998]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(false);
                  setShowSnoozeSub(false);
                  setShowLabelSub(false);
                  setShowCustomSnoozeForm(false);
                }}
              />
              <div 
                ref={dropdownRef}
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  position: "fixed",
                  top: `${dropdownPos.top}px`,
                  right: `${dropdownPos.right}px`,
                  borderColor: theme.border,
                  color: theme.text
                }}
                className="w-48 rounded-xl shadow-2xl dark:shadow-soft-dark border z-[99999] py-1 bg-white dark:bg-gray-900 text-xs text-left select-none animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Unsnooze option if in snoozed folder */}
                {folder === "snoozed" && (
                  <button
                    onClick={() => {
                      handleBulkUnsnooze();
                      setShowMoreMenu(false);
                    }}
                    className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"
                  >
                    <MdAlarmOff size={16} /> {t("snooze.unsnooze", "Unsnooze / Move to Inbox")}
                  </button>
                )}

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
                    className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <MdAccessTime size={16} className="text-gray-400" /> {t("common.snooze", "Snooze")}...
                  </button>
                  {showSnoozeSub && (
                    <div 
                      className={`absolute ${dropdownPos.openSubRight ? "left-full ml-1" : "right-full mr-1"} ${dropdownPos.openUpwards ? "bottom-0" : "top-0"} w-44 rounded-xl shadow-2xl border bg-white dark:bg-gray-900 py-1 z-[100000] max-h-64 overflow-y-auto hidden-scrollbar`}
                      style={{ borderColor: theme.border }}
                    >
                      {showCustomSnoozeForm ? (
                        <div className="p-3 flex flex-col gap-2 bg-white dark:bg-gray-900">
                          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t("bulk_actions.select_datetime", "Select Date & Time")}</label>
                          <input
                            type="datetime-local"
                            value={customSnoozeTime}
                            min={getLocalDatetimeInputString(new Date())}
                            onChange={(e) => setCustomSnoozeTime(e.target.value)}
                            className="w-full p-1.5 rounded-lg border text-xs bg-gray-50 dark:bg-neutral-850 text-gray-900 dark:text-white outline-none border-gray-200 dark:border-neutral-700"
                          />
                          <div className="flex justify-end gap-1.5 mt-1">
                            <button
                              onClick={() => setShowCustomSnoozeForm(false)}
                              className="px-2 py-1 rounded text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
                            >
                              {t("common.back", "Back")}
                            </button>
                            <button
                              onClick={() => {
                                if (!customSnoozeTime) {
                                  alert("Please select a valid date and time.");
                                  return;
                                }
                                const dateObj = parseLocalDatetimeString(customSnoozeTime);
                                if (!dateObj || isNaN(dateObj.getTime())) {
                                  alert("Please select a valid date and time.");
                                  return;
                                }
                                if (dateObj.getTime() <= Date.now()) {
                                  alert("Please select a future date and time.");
                                  return;
                                }
                                handleBulkSnoozeWithDate(dateObj.toISOString());
                              }}
                              className="px-2 py-1 rounded text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
                            >
                              {t("common.save", "Save")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {getStorageSnoozeOptions().map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                const d = opt.date || opt.time;
                                if (d) handleBulkSnoozeWithDate(d.toISOString());
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between gap-1 text-[11px]"
                            >
                              <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{opt.label}</span>
                              <span className="text-[10px] text-gray-400 shrink-0">{opt.display}</span>
                            </button>
                          ))}
                          <div className="border-t border-gray-100 dark:border-neutral-800 my-1"></div>
                          <button
                            onClick={() => {
                              setShowCustomSnoozeForm(true);
                              const defaultCustom = new Date(Date.now() + 3600000);
                              setCustomSnoozeTime(getLocalDatetimeInputString(defaultCustom));
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-blue-500 font-semibold cursor-pointer"
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
                    className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <MdLabel size={16} className="text-gray-400" /> {t("bulk_actions.label_as", "Label as...")}
                  </button>
                  {showLabelSub && (
                    <div 
                      className={`absolute ${dropdownPos.openSubRight ? "left-full ml-1" : "right-full mr-1"} ${dropdownPos.openUpwards ? "bottom-0" : "top-0"} w-48 max-h-56 overflow-y-auto rounded-xl shadow-2xl border bg-white dark:bg-gray-900 py-1 z-[100000] hidden-scrollbar`}
                      style={{ borderColor: theme.border }}
                    >
                      {availableLabels.filter((lbl) => isLabelShownInLabelList(lbl, sidebarPreferences, customLabelPreferences)).length === 0 ? (
                        <div className="px-4 py-2 text-xs text-gray-400">{t("bulk_actions.no_labels", "No labels found")}</div>
                      ) : (
                        availableLabels
                          .filter((lbl) => isLabelShownInLabelList(lbl, sidebarPreferences, customLabelPreferences))
                          .map((lbl) => {
                          const isAssigned = selectedEmails.length > 0 && selectedEmails.every((e) =>
                            (e.labels || []).some(
                              (l) => String(l.id || l) === String(lbl.id) || l.name === lbl.name || (lbl.prefKey && (l.name === lbl.prefKey || String(l.id) === String(lbl.prefKey)))
                            )
                          );
                          return (
                            <button 
                              key={lbl.id} 
                              onClick={() => handleBulkToggleLabel(lbl.id, isAssigned)} 
                              className="w-full text-left px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lbl.colorHex || "#135bec" }} />
                                <span className="truncate">{lbl.name}</span>
                              </div>
                              {isAssigned && <MdCheck size={16} className="text-blue-500 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Unsubscribe */}
                <button
                  onClick={handleBulkUnsubscribe}
                  onMouseEnter={() => { setShowSnoozeSub(false); setShowLabelSub(false); }}
                  className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <MdBlock size={16} className="text-gray-400" /> {t("bulk_actions.unsubscribe", "Unsubscribe")}
                </button>

                {/* Reply (only for 1 selected) */}
                {selectedEmails.length === 1 && (
                  <button
                    onClick={handleBulkReply}
                    onMouseEnter={() => { setShowSnoozeSub(false); setShowLabelSub(false); }}
                    className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 text-gray-700 dark:text-gray-300 font-bold border-t border-gray-100 dark:border-gray-850 mt-1 pt-1 cursor-pointer"
                  >
                    <MdReply size={16} className="text-gray-400" /> {t("common.reply", "Reply")}
                  </button>
                )}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkActionsToolbar;
