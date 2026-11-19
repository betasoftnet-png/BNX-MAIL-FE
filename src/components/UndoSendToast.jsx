import React, { useState, useEffect, useRef } from "react";
import { MdCheck, MdClose, MdVisibility, MdAttachFile } from "react-icons/md";

/**
 * UndoSendItem:
 * Individual toast item for a pending email send.
 * Handles its own countdown, Undo click state, and Outgoing Message Preview modal.
 */
const UndoSendItem = React.memo(({ item, onUndo, onDismiss }) => {
  if (!item || !item.sendId) return null;

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [countdown, setCountdown] = useState(() => {
    if (item.expiresAt) {
      return Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
    }
    return item.delaySeconds || 5;
  });

  const timerRef = useRef(null);

  useEffect(() => {
    const updateCountdown = () => {
      if (!item.expiresAt) return;
      const remaining = Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        onDismiss?.(item.sendId);
      }
    };

    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [item.expiresAt, item.sendId, onDismiss]);

  const handleUndoClick = async () => {
    if (isUndoing) return; // Disable repeated clicks
    setIsUndoing(true);
    try {
      await onUndo?.(item.sendId);
    } finally {
      setIsUndoing(false);
    }
  };

  const emailData = item.emailData || {};
  const attachments = Array.isArray(emailData.attachments) ? emailData.attachments : [];

  return (
    <>
      {/* Toast Notification Bar */}
      <div
        role="alert"
        aria-live="polite"
        className="w-full pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <div className="flex items-center gap-3 sm:gap-4 bg-[#202124] text-white px-4 py-3 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-gray-700/60">
          {/* Green Check Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
            <MdCheck size={16} className="stroke-[2]" />
          </div>

          {/* Label */}
          <span className="text-sm font-medium text-gray-100 tracking-tight whitespace-nowrap">
            Message sent.
          </span>

          {/* Action Buttons: Undo Send & View Message */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Undo Send Button */}
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleUndoClick}
              className={`px-2.5 py-1 text-sm font-semibold text-[#8ab4f8] hover:text-[#aecbfa] hover:bg-white/10 active:scale-95 rounded transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                isUndoing ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Undo email delivery"
            >
              <span>{isUndoing ? "Undoing..." : "Undo Send"}</span>
              <span className="text-xs font-mono font-bold bg-[#8ab4f8]/20 text-[#8ab4f8] px-1 py-0.5 rounded">
                {countdown}s
              </span>
            </button>

            {/* View Message Button */}
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-2.5 py-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 rounded transition-all duration-150 flex items-center gap-1 cursor-pointer"
              title="View outgoing message preview"
            >
              <MdVisibility size={15} />
              <span>View Message</span>
            </button>
          </div>

          {/* Dismiss Close Icon */}
          <button
            type="button"
            onClick={() => onDismiss?.(item.sendId)}
            title="Dismiss notification"
            className="text-gray-400 hover:text-gray-200 hover:bg-white/10 p-1 rounded-md transition-colors cursor-pointer shrink-0 ml-1"
          >
            <MdClose size={16} />
          </button>
        </div>
      </div>

      {/* View Message Preview Modal */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Outgoing Message Preview
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                  Delivering in {countdown}s
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Close preview"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Recipients */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="w-16 font-semibold text-gray-500 dark:text-gray-400 shrink-0">To:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium break-all">{emailData.to || "—"}</span>
                </div>
                {emailData.cc && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-16 font-semibold text-gray-500 dark:text-gray-400 shrink-0">Cc:</span>
                    <span className="text-gray-700 dark:text-gray-300 break-all">{emailData.cc}</span>
                  </div>
                )}
                {emailData.bcc && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-16 font-semibold text-gray-500 dark:text-gray-400 shrink-0">Bcc:</span>
                    <span className="text-gray-700 dark:text-gray-300 break-all">{emailData.bcc}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="w-16 font-semibold text-gray-500 dark:text-gray-400 shrink-0">Subject:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-semibold">{emailData.subject || "(No Subject)"}</span>
                </div>
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200"
                    >
                      <MdAttachFile size={14} className="text-gray-500" />
                      <span className="truncate max-w-[200px]">{att.fileName || att.name || "Attachment"}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Email Content Body */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div
                  className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200 min-h-[140px] p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800"
                  dangerouslySetInnerHTML={{ __html: emailData.body || "" }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Closing preview will not cancel email delivery.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isUndoing}
                  onClick={async () => {
                    await handleUndoClick();
                    setIsPreviewOpen(false);
                  }}
                  className={`px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                    isUndoing ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span>{isUndoing ? "Undoing..." : "Undo Send"}</span>
                  <span className="text-xs font-mono font-bold bg-black/20 px-1 py-0.5 rounded">
                    {countdown}s
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

/**
 * UndoSendToast:
 * Gmail-style Undo Send notification container.
 * Supports single pending email or multiple pending emails stacked independently.
 *
 * Requirements:
 * 1. "Message sent" success notification.
 * 2. "Undo Send" action with visible 5-second countdown.
 * 3. "View Message" action beside it.
 * 4. Mutual exclusion, cancellation, and message restoration.
 * 5. Handle multiple pending emails independently.
 */
const UndoSendToast = ({ pending, items, onUndo, onDismiss }) => {
  const pendingList = Array.isArray(items)
    ? items
    : (Array.isArray(pending) ? pending : (pending ? [pending] : []));

  if (!pendingList || pendingList.length === 0) return null;

  return (
    <div className="fixed bottom-6 sm:bottom-8 left-6 sm:left-8 z-[9999] flex flex-col-reverse gap-2.5 max-w-[95%] sm:max-w-md pointer-events-none">
      {pendingList.map((item) => (
        <UndoSendItem
          key={item.sendId}
          item={item}
          onUndo={onUndo}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

export default React.memo(UndoSendToast);
