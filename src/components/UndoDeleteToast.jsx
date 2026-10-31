import React from "react";
import { MdCheck, MdClose } from "react-icons/md";

/**
 * UndoDeleteToast:
 * 5-second Gmail-style Undo notification for email deletion in BNXmail.
 * Matches BNXmail's clean blue-and-white UI design with dark mode support.
 *
 * Props:
 * - pending: { opId, countdown, label, items }
 * - onUndo: () => void
 * - onDismiss: () => void
 */
const UndoDeleteToast = ({ pending, onUndo, onDismiss }) => {
  if (!pending) return null;

  const countdown = typeof pending.countdown === "number" ? pending.countdown : 5;
  const label = pending.label || "Conversation moved to Trash";

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999] max-w-[92%] sm:max-w-none pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_4px_12px_-2px_rgba(0,0,0,0.08)] border border-blue-100 dark:border-gray-700">
        {/* Green Success / Check Icon */}
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
          <MdCheck size={18} className="stroke-[1.5]" />
        </div>

        {/* Message text in dark navy / theme text */}
        <span className="text-sm font-semibold text-[#0B192C] dark:text-gray-100 tracking-tight whitespace-nowrap">
          {label}
        </span>

        {/* Clear Royal Blue Undo Button */}
        <button
          type="button"
          onClick={() => onUndo(pending.opId)}
          className="px-3.5 py-1.5 bg-[#0D47A1] hover:bg-[#1565C0] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all duration-150 cursor-pointer shrink-0 uppercase tracking-wider flex items-center justify-center min-h-[28px]"
          aria-label="Undo delete"
        >
          Undo
        </button>

        {/* Circular Blue Progress Indicator with Countdown */}
        <div
          className="relative flex items-center justify-center w-8 h-8 shrink-0"
          title={`${countdown} seconds remaining`}
        >
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            {/* Track circle */}
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="#E3F2FD"
              strokeWidth="2.5"
              className="dark:stroke-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="#0D47A1"
              strokeWidth="2.5"
              strokeDasharray={81.68}
              strokeDashoffset={81.68 * (1 - (countdown / 5))}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear dark:stroke-blue-400"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-[#0D47A1] dark:text-blue-400 select-none">
            {countdown}s
          </span>
        </div>

        {/* Subtle Close / Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(pending.opId)}
          title="Dismiss"
          aria-label="Dismiss notification"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ml-0.5"
        >
          <MdClose size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(UndoDeleteToast);
