import React from "react";
import { MdCheck, MdClose } from "react-icons/md";

/**
 * SentMessageToast:
 * Gmail-style snackbar notification displayed after sending an email in BNXmail.
 * Displays:
 * - "Message sent successfully"
 * - "Undo Send"
 * - "View Message"
 * - Countdown progress indicator
 * - Dismiss button (✕)
 *
 * Props:
 * - pending: { opId, email, countdown, totalDuration, label, canUndo, onUndo }
 * - onUndo: (pending) => void
 * - onViewMessage: (pending) => void
 * - onDismiss: (pending) => void
 */
const SentMessageToast = ({ pending, onUndo, onViewMessage, onDismiss }) => {
  if (!pending) return null;

  const total = typeof pending.totalDuration === "number" && pending.totalDuration > 0 ? pending.totalDuration : 5;
  const countdown = typeof pending.countdown === "number" ? pending.countdown : 5;
  const label = pending.label || "Message sent successfully";

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999] max-w-[95%] sm:max-w-none pointer-events-none select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-4 bg-[#202124] text-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.38),0_4px_12px_-2px_rgba(0,0,0,0.18)] border border-gray-700/60">
        {/* Emerald Checkmark Icon */}
        <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
          <MdCheck size={18} className="stroke-[1.5]" />
        </div>

        {/* Status Label */}
        <span className="text-xs sm:text-sm font-medium text-gray-100 tracking-tight whitespace-nowrap">
          {label}
        </span>

        <div className="h-4 w-px bg-gray-700/80 mx-0.5 sm:mx-1 shrink-0" />

        {/* Undo Send Action */}
        <button
          type="button"
          onClick={() => onUndo(pending)}
          className="px-2.5 py-1 text-xs font-bold text-[#fbbc04] hover:text-yellow-300 active:scale-95 hover:bg-white/10 rounded-lg transition-all duration-150 cursor-pointer shrink-0 uppercase tracking-wider flex items-center justify-center"
          aria-label="Undo send"
        >
          Undo Send
        </button>

        {/* View Message Action */}
        <button
          type="button"
          onClick={() => onViewMessage(pending)}
          className="px-2.5 py-1 text-xs font-bold text-[#8ab4f8] hover:text-blue-300 active:scale-95 hover:bg-white/10 rounded-lg transition-all duration-150 cursor-pointer shrink-0 uppercase tracking-wider flex items-center justify-center"
          aria-label="View message"
        >
          View Message
        </button>

        {/* Circular Countdown Progress */}
        <div
          className="relative flex items-center justify-center w-7 h-7 shrink-0 ml-0.5"
          title={`${countdown} seconds remaining`}
        >
          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="#3c4043"
              strokeWidth="2.5"
            />
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="#8ab4f8"
              strokeWidth="2.5"
              strokeDasharray={81.68}
              strokeDashoffset={81.68 * (1 - (countdown / total))}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono text-[#8ab4f8] select-none">
            {countdown}s
          </span>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(pending)}
          title="Dismiss"
          aria-label="Dismiss notification"
          className="text-gray-400 hover:text-gray-100 hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ml-0.5"
        >
          <MdClose size={17} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(SentMessageToast);
