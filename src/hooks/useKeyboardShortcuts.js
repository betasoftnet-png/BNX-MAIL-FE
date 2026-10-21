import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";

/**
 * Global Keyboard Shortcuts for BNXmail.
 *
 * Supported Actions:
 * - Mail Navigation:
 *   G then I -> Go to Inbox
 *   G then S -> Go to Sent
 *   G then D -> Go to Drafts
 *   G then T -> Go to Starred
 *   G then TR (or G then X) -> Go to Trash
 *
 * - Email Actions:
 *   C -> Compose a new email
 *   R -> Reply to currently open email
 *   F -> Forward currently open email
 *   / -> Focus search input
 *   E -> Archive selected/open email
 *   Delete / # -> Delete selected/open email
 *
 * - General:
 *   Esc -> Close popup / compose / return to previous view
 *   ? -> Open Keyboard Shortcuts help in Settings
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCompose, closeCompose, isComposeOpen } = useMail();
  const chordRef = useRef(null);
  const chordTimerRef = useRef(null);

  useEffect(() => {
    const isEditingText = (event) => {
      const target = event.target;
      if (!target) return false;
      const tagName = target.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return true;
      if (
        target.isContentEditable ||
        target.closest?.(".ql-editor") ||
        target.closest?.('[contenteditable="true"]')
      ) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (event) => {
      // Don't interfere if user is pressing Ctrl or Meta (Command on Mac)
      if (event.ctrlKey || event.metaKey) return;

      const key = event.key;
      const isEditing = isEditingText(event);

      // Handle Escape
      if (key === "Escape") {
        if (isComposeOpen) {
          event.preventDefault();
          closeCompose();
          return;
        }

        // If an input is focused, blur it
        if (isEditing) {
          event.target?.blur();
          return;
        }

        // Return / back action
        window.dispatchEvent(
          new CustomEvent("bnx-shortcut-action", {
            detail: { action: "back" }
          })
        );
        return;
      }

      // If typing in any input, textarea, or rich text editor, do NOT trigger mail shortcuts
      if (isEditing) return;

      // Handle chorded navigation ('G then ...')
      if (chordRef.current === "g") {
        clearTimeout(chordTimerRef.current);
        const lowerKey = key.toLowerCase();

        if (lowerKey === "i") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/inbox");
          return;
        } else if (lowerKey === "s") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/send");
          return;
        } else if (lowerKey === "d") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/draft");
          return;
        } else if (lowerKey === "t") {
          event.preventDefault();
          // Allow follow-up 'r' for 'tr' (trash), otherwise resolve to starred
          chordRef.current = "gt";
          chordTimerRef.current = setTimeout(() => {
            chordRef.current = null;
            navigate("/starred");
          }, 350);
          return;
        } else if (lowerKey === "r" || lowerKey === "x") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/trash");
          return;
        }

        chordRef.current = null;
      } else if (chordRef.current === "gt") {
        clearTimeout(chordTimerRef.current);
        chordRef.current = null;
        if (key.toLowerCase() === "r") {
          event.preventDefault();
          navigate("/trash");
          return;
        }
      }

      // Start of 'G' chord
      if (key.toLowerCase() === "g" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        chordRef.current = "g";
        clearTimeout(chordTimerRef.current);
        chordTimerRef.current = setTimeout(() => {
          chordRef.current = null;
        }, 1200);
        return;
      }

      // Search: '/'
      if (key === "/" && !event.shiftKey && !event.altKey) {
        const searchInput = document.getElementById("mail-search-input");
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Help: '?' (or Shift + '/')
      if (key === "?" || (event.shiftKey && key === "/")) {
        event.preventDefault();
        navigate("/settings", { state: { tab: "shortcuts" } });
        return;
      }

      // Compose: 'C'
      if (key.toLowerCase() === "c" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openCompose({ mode: "mail" });
        return;
      }

      // Reply: 'R'
      if (key.toLowerCase() === "r" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("bnx-shortcut-action", {
            detail: { action: "reply" }
          })
        );
        return;
      }

      // Forward: 'F'
      if (key.toLowerCase() === "f" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("bnx-shortcut-action", {
            detail: { action: "forward" }
          })
        );
        return;
      }

      // Archive: 'E'
      if (key.toLowerCase() === "e" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("bnx-shortcut-action", {
            detail: { action: "archive" }
          })
        );
        return;
      }

      // Delete: 'Delete' or '#'
      if (key === "Delete" || key === "#" || (event.shiftKey && key === "3")) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("bnx-shortcut-action", {
            detail: { action: "delete" }
          })
        );
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(chordTimerRef.current);
    };
  }, [navigate, location, openCompose, closeCompose, isComposeOpen]);
}

export default useKeyboardShortcuts;
