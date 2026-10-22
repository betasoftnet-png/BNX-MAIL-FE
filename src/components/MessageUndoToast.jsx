import React from "react";
import { MdCheck, MdClose } from "react-icons/md";

/**
 * MessageUndoToast:
 * Renders the 5-second Undo toast notification for deleted messages.
 * Matches BNXmail's clean blue-and-white theme.
 *
 * Props:
 * - pending: { opId, countdown, label }
 * - onUndo: (opId) => void
 * - onDismiss: (opId) => void
 * - positionClass: optional string (defaults to "bottom-20 left-1/2 -translate-x-1/2")
 */
const MessageUndoToast = ({ pending, onUndo, onDismiss, positionClass = "bottom-20 left-1/2 -translate-x-1/2" }) => {
  if (!pending) return null;

  const countdown = typeof pending.countdown === "number" ? pending.countdown : 5;
  const label = pending.label || "Message deleted";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`absolute ${positionClass} z-50 max-w-[92%] sm:max-w-none pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-3 duration-200`}
    >
      <div className="flex items-center gap-3 sm:gap-4 bg-white text-gray-900 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.16),0_4px_12px_-2px_rgba(0,0,0,0.08)] border border-blue-100 dark:border-gray-200">
        {/* Green Success / Check Icon */}
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
          <MdCheck size={18} className="stroke-[1.5]" />
        </div>

        {/* Message text in dark navy */}
        <span className="text-sm font-semibold text-[#0B192C] tracking-tight whitespace-nowrap">
          {label}
        </span>

        {/* Prominent Royal Blue Undo Button - only 'Undo' at 7px font size */}
        <button
          type="button"
          onClick={() => onUndo(pending.opId)}
          style={{ fontSize: "7px", lineHeight: "1" }}
          className="px-3 py-1.5 bg-[#0D47A1] hover:bg-[#1565C0] active:scale-95 text-white font-bold rounded-lg shadow-sm hover:shadow transition-all duration-150 cursor-pointer shrink-0 uppercase tracking-wider flex items-center justify-center min-h-[26px]"
          aria-label="Undo message deletion"
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
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-[#0D47A1] select-none">
            {countdown}s
          </span>
        </div>

        {/* Subtle Gray Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(pending.opId)}
          title="Dismiss toast"
          aria-label="Dismiss toast"
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ml-0.5"
        >
          <MdClose size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(MessageUndoToast);
