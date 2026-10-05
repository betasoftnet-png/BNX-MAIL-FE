import { useTranslation } from "../context/LanguageContext";
import React, { useState } from "react";
import { MdArchive, MdUnarchive, MdDelete, MdStar, MdStarBorder, MdAccessTime, MdWbSunny, MdNightsStay, MdToday, MdEvent, MdUpdate, MdDateRange, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdAttachFile } from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";

const EmailList = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  onDelete,
  onStar,
  onArchive,
  onUnarchive,
  onSnooze,
  showTo = false,
  selectedIds = new Set(),
  onToggleSelect,
  isArchiveFolder = false,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme, emailsPerPage, backgroundImage } = useTheme();
  const { isComposeOpen, totalEmails, currentPage, handlePageChange, loading, labels, handleSnooze: contextHandleSnooze } = useMail();
  const snoozeAction = onSnooze || contextHandleSnooze;

  const [snoozeOpenUid, setSnoozeOpenUid] = useState(null);
  const [customPickerUid, setCustomPickerUid] = useState(null);
  const [customDateTime, setCustomDateTime] = useState("");
  const [snoozeCoords, setSnoozeCoords] = useState({ top: 0, right: 0 });

  // Pagination logic
  const totalPages = Math.ceil(totalEmails / emailsPerPage) || 1;
  const startIndex = (currentPage - 1) * emailsPerPage;
  const displayedEmails = emails;

  const getSnoozeOptions = () => {
    const now = new Date();

    // Later today: 6 PM today (or +3 hours if past 5 PM)
    const laterToday = new Date(now);
    if (now.getHours() >= 17) {
      laterToday.setHours(now.getHours() + 3);
    } else {
      laterToday.setHours(18, 0, 0, 0);
    }

    // Tomorrow: 8 AM tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    // Later this week: Thursday 8 AM (if today is Mon/Tue/Wed), else +2 days 8 AM
    const laterThisWeek = new Date(now);
    if (now.getDay() < 4) {
      laterThisWeek.setDate(now.getDate() + (4 - now.getDay()));
    } else {
      laterThisWeek.setDate(now.getDate() + 2);
    }
    laterThisWeek.setHours(8, 0, 0, 0);

    // This weekend: Saturday 8 AM
    const thisWeekend = new Date(now);
    const daysToSaturday = 6 - now.getDay();
    thisWeekend.setDate(now.getDate() + (daysToSaturday === 0 ? 7 : daysToSaturday));
    thisWeekend.setHours(8, 0, 0, 0);

    // Next week: Monday 8 AM
    const nextWeek = new Date(now);
    const daysToMonday = (8 - now.getDay()) % 7 || 7;
    nextWeek.setDate(now.getDate() + daysToMonday);
    nextWeek.setHours(8, 0, 0, 0);

    const formatTime = (d) => {
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { weekday: 'short' });
      return `${dateStr}, ${timeStr}`;
    };

    return [
      { label: "Later today", time: laterToday, display: formatTime(laterToday), icon: <MdToday size={18} className="text-amber-500" /> },
      { label: "Tomorrow", time: tomorrow, display: formatTime(tomorrow), icon: <MdWbSunny size={18} className="text-yellow-500" /> },
      { label: "Later this week", time: laterThisWeek, display: formatTime(laterThisWeek), icon: <MdEvent size={18} className="text-indigo-500" /> },
      { label: "This weekend", time: thisWeekend, display: formatTime(thisWeekend), icon: <MdNightsStay size={18} className="text-purple-500" /> },
      { label: "Next week", time: nextWeek, display: formatTime(nextWeek), icon: <MdUpdate size={18} className="text-emerald-500" /> },
    ];
  };

  const paginationControls = emails.length > 0 && (
    <div className="flex items-center justify-between gap-2 pl-4 pr-4 lg:px-6 py-4 border-t border-gray-100 dark:border-gray-800/60 bg-transparent shrink-0">
      <div className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 shrink-0">
        <span className="hidden sm:inline">Showing </span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{startIndex + 1}</span>
        <span className="hidden sm:inline"> to </span>
        <span className="sm:hidden">-</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{Math.min(startIndex + emailsPerPage, totalEmails)}</span>
        {' '}of <span className="font-medium text-gray-700 dark:text-gray-300">{totalEmails}</span>
        <span className="hidden sm:inline"> emails</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <MdKeyboardArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <MdKeyboardArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {snoozeOpenUid && (
        <>
          {/* Invisible backdrop to capture outside clicks like Gmail */}
          <div
            onClick={(e) => { e.stopPropagation(); setSnoozeOpenUid(null); setCustomPickerUid(null); }}
            className="fixed inset-0 z-[99998]"
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${snoozeCoords.top}px`, right: `${snoozeCoords.right}px` }}
            className="fixed w-64 rounded-xl shadow-2xl z-[99999] border bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 overflow-hidden text-sm flex flex-col py-1.5 animate-fadeIn"
          >
            <div className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <span>Snooze until...</span>
              <button
                onClick={() => { setSnoozeOpenUid(null); setCustomPickerUid(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {customPickerUid === snoozeOpenUid ? (
              <div className="p-4 flex flex-col gap-3">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Select Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button
                    onClick={() => setCustomPickerUid(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!customDateTime) {
                        alert("Please select a valid date and time.");
                        return;
                      }
                      const dateObj = new Date(customDateTime);
                      if (dateObj <= new Date()) {
                        alert("Please select a future date and time.");
                        return;
                      }
                      snoozeAction?.(snoozeOpenUid, dateObj.toISOString());
                      setSnoozeOpenUid(null);
                      setCustomPickerUid(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {getSnoozeOptions().map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      snoozeAction?.(snoozeOpenUid, opt.time.toISOString());
                      setSnoozeOpenUid(null);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {opt.icon}
                      <span className="text-gray-800 dark:text-gray-200 font-medium truncate">{opt.label}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{opt.display}</span>
                  </button>
                ))}

                <div className="border-t border-gray-100 dark:border-neutral-800 my-1"></div>

                <button
                  onClick={() => {
                    setCustomPickerUid(snoozeOpenUid);
                    const defaultCustom = new Date();
                    defaultCustom.setMinutes(defaultCustom.getMinutes() - defaultCustom.getTimezoneOffset());
                    setCustomDateTime(defaultCustom.toISOString().slice(0, 16));
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] flex items-center gap-3 cursor-pointer transition-colors text-blue-500 dark:text-blue-400 font-medium"
                >
                  <MdDateRange size={18} />
                  <span>Select date & time</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="h-0.5 w-full bg-blue-500/20 overflow-hidden relative shrink-0">
          <div className="absolute h-full bg-blue-500 w-1/3 rounded-full animate-bounce" style={{ left: '0', animation: 'indeterminate 1.5s infinite ease-in-out' }} />
          <style>{`
            @keyframes indeterminate {
              0% { left: -33%; width: 33%; }
              50% { left: 50%; width: 50%; }
              100% { left: 100%; width: 33%; }
            }
          `}</style>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto bg-transparent hidden-scrollbar transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 p-8">
            <span className="text-5xl mb-4 opacity-75">📭</span>
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">Your folder is empty</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800/60">
            {displayedEmails.map((email, i) => {
              const isSentByUser = showTo || (user?.email && email.from?.toLowerCase().includes(user.email.toLowerCase()));
              const sender = isSentByUser ? (email.to || email.recipientEmail) : email.from;
              const isUnread = !email.isRead;
              const isSelected = selectedEmailId === email.uid || selectedEmailId === String(email.uid) || selectedEmailId === `${email.uid}__${email.folderName || ''}`;
              const isActuallyArchived = isArchiveFolder || email.folderName?.toLowerCase() === "archive";
              const isChecked = selectedIds.has(`${email.uid}__${email.folderName || ''}`) || selectedIds.has(String(email.uid)) || selectedIds.has(Number(email.uid));

              return (
                <div
                  key={email.messageId ? `msg_${email.messageId}` : `${email.uid}__${email.folderName || ''}`}
                  onClick={() => onSelectEmail(email)}
                  className={`group flex items-center gap-1.5 sm:gap-3 py-2 sm:py-2.5 px-2 sm:px-4 cursor-pointer relative transition-colors duration-150 select-none ${snoozeOpenUid === email.uid ? 'z-50' : 'z-10'}
                    ${isChecked
                      ? "bg-blue-50/70 dark:bg-blue-950/30 border-l-[3px] border-blue-500"
                      : isSelected
                        ? "bg-primary/5 dark:bg-primary/10 border-l-[3px] border-primary"
                        : isUnread
                          ? "bg-black/[0.01] dark:bg-white/[0.02] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] border-l-[3px] border-transparent"
                          : "bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-l-[3px] border-transparent"
                    }`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-[#1e1e1e]"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(`${email.uid}__${email.folderName || ''}`);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Star Button */}
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStar?.(email.uid, email.folderName);
                      }}
                      className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-400 dark:text-gray-500 hover:text-yellow-500 cursor-pointer"
                      title={email.starred ? "Unstar" : "Star"}
                    >
                      {email.starred ? (
                        <MdStar size={18} className="text-yellow-500 fill-current" />
                      ) : (
                        <MdStarBorder size={18} className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  </div>

                  {/* Sender Name */}
                  <div className="w-24 sm:w-36 md:w-48 shrink-0 truncate pr-1 sm:pr-2">
                    <span
                      className={`text-xs sm:text-sm ${isUnread
                        ? "font-bold text-gray-900 dark:text-gray-100"
                        : "font-medium text-gray-600 dark:text-gray-300"
                        }`}
                    >
                      {email.folderName?.toLowerCase() === "draft" || email.folderName?.toLowerCase() === "drafts" ? (
                        <span className="text-red-500 font-bold italic tracking-wide">Draft</span>
                      ) : isSentByUser ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[9px] font-bold border border-current px-0.5 rounded-sm opacity-50">TO</span>
                          {(email.to || email.recipientEmail)?.split("@")[0]}
                        </span>
                      ) : (
                        sender?.includes("<")
                          ? sender.split("<")[0].replace(/^["']/g, "").replace(/["']$/g, "").trim()
                          : (sender?.split("@")[0] || sender)
                      )}
                    </span>
                  </div>

                  {/* Subject & Snippet */}
                  <div className="flex-1 min-w-0 flex items-baseline gap-1 sm:gap-2 truncate pr-1 sm:pr-4">
                    {email.accountEmail && (
                      <span className="shrink-0 text-[9px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 px-1.5 py-0.5 rounded-md select-none hidden md:inline" title={`Account: ${email.accountEmail}`}>
                        {email.accountEmail.split('@')[0].toUpperCase()}
                      </span>
                    )}
                    <span
                      className={`text-xs sm:text-sm truncate ${isUnread
                        ? "font-bold text-gray-900 dark:text-gray-100"
                        : "font-medium text-gray-800 dark:text-gray-200"
                        }`}
                    >
                      {email.subject || "(No Subject)"}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 truncate font-normal hidden sm:inline">
                      — {(() => {
                        if (email.textPlain && email.textPlain.trim().length > 0) {
                          return email.textPlain.replace(/\s+/g, " ");
                        }
                        if (email.body) {
                          // Strip <style> tags and all other HTML tags
                          const noStyle = email.body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
                          const noTags = noStyle.replace(/<[^>]+>/g, ' ');
                          // Decode basic HTML entities to avoid &nbsp; etc.
                          const decoded = noTags.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
                          return decoded.replace(/\s+/g, " ").trim();
                        }
                        return "";
                      })()}
                    </span>
                  </div>

                  {/* Labels */}
                  {email.labels && email.labels.length > 0 && (
                    <div className="hidden sm:flex gap-1 shrink-0 mr-2 select-none">
                      {email.labels.map((label) => {
                        const labelId = typeof label === 'string' ? label : (label.id || label.name);
                        const labelName = typeof label === 'string' ? label : (label.name || label.id);
                        const labelColor = typeof label === 'string' 
                          ? (labels.find(l => l.name === label || l.id === label)?.colorHex || '#135bec')
                          : (label.colorHex || '#135bec');
                        return (
                          <span
                            key={labelId}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tight text-white border border-black/5 dark:border-white/5"
                            style={{ backgroundColor: labelColor }}
                          >
                            {labelName}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Attachment indicator */}
                  {(email.hasAttachments || (email.attachments && email.attachments.length > 0)) && (
                    <span className="text-gray-400 dark:text-gray-500 shrink-0 mr-1.5 flex items-center select-none" title="Has attachments">
                      <MdAttachFile size={16} className="rotate-45" />
                    </span>
                  )}

                  {/* Date / Hover Actions */}
                  <div className={`w-14 sm:w-20 shrink-0 text-right relative flex justify-end items-center h-full ${snoozeOpenUid === email.uid ? 'z-50' : 'z-10'}`}>
                    <span
                      className={`text-xs whitespace-nowrap transition-opacity duration-100 group-hover:opacity-0 ${isUnread ? "font-bold text-primary" : "text-gray-400 dark:text-gray-500"
                        }`}
                    >
                      {email.receivedDate
                        ? new Date(email.receivedDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                        : ""}
                    </span>

                    {/* Quick actions that fade-in on row hover */}
                    <div
                      className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 ${backgroundImage ? 'bg-transparent' : 'bg-white/90 dark:bg-gray-900/90'} backdrop-blur-sm rounded-lg px-1 transition-opacity duration-150 ${snoozeOpenUid === email.uid ? 'opacity-100 z-50' : 'opacity-0 group-hover:opacity-100 z-10'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isActuallyArchived) {
                            if (onUnarchive) onUnarchive(email.uid, email.folderName);
                            else onArchive?.(email.uid, email.folderName);
                          } else {
                            onArchive?.(email.uid, email.folderName);
                          }
                        }}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                        title={isActuallyArchived ? "Unarchive" : "Archive"}
                      >
                        {isActuallyArchived ? <MdUnarchive size={18} /> : <MdArchive size={18} />}
                      </button>
                      <button
                        onClick={() => onDelete?.(email.uid, email.folderName)}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-red-500 cursor-pointer"
                        title="Delete"
                      >
                        <MdDelete size={18} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 280;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            let topPosition;
                            if (spaceBelow < menuHeight && rect.top > menuHeight) {
                              topPosition = rect.top - menuHeight;
                            } else {
                              topPosition = rect.bottom + 4;
                            }
                            setSnoozeCoords({ top: topPosition, right: window.innerWidth - rect.right });
                            setSnoozeOpenUid(email.uid);
                            setCustomPickerUid(null);
                          }}
                          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-blue-500 cursor-pointer"
                          title="Snooze"
                        >
                          <MdAccessTime size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {paginationControls}
    </>
  );
};

export default EmailList;
