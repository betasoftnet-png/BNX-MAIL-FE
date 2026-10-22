import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMail } from "../context/MailContext";

/**
 * Global Keyboard Shortcuts for BNXmail.
 *
 * 1. Mail Navigation (Sequential):
 *   Ctrl + G, then I -> Navigate to Inbox (/inbox)
 *   Ctrl + G, then S -> Navigate to Sent (/sent)
 *   Ctrl + G, then D -> Navigate to Drafts (/draft)
 *   Ctrl + G, then T -> Navigate to Starred (/starred)
 *   Ctrl + G, then T, then R -> Navigate to Trash (/trash)
 *
 * 2. Email Actions:
 *   Ctrl + C -> Open Compose window
 *   Ctrl + R -> Reply to currently selected/open email
 *   Ctrl + F -> Forward currently selected/open email
 *   Ctrl + / -> Focus main search input
 *   Ctrl + E -> Archive selected/open email
 *   Ctrl + Delete -> Move selected email to Trash
 *
 * 3. General:
 *   Esc -> Close popup / compose / return to previous view
 *   ? -> Open Keyboard Shortcuts help panel in Settings
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
        target.closest?.('[contenteditable="true"], .ql-editor, .public-DraftEditor-content, input, textarea, select')
      ) {
        return true;
      }
      return false;
    };

    const dispatchShortcutAction = (action) => {
      const detail = { action, handled: false };
      window.dispatchEvent(
        new CustomEvent("bnx-shortcut-action", {
          detail,
          cancelable: true
        })
      );
      return detail.handled;
    };

    const handleKeyDown = (event) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      const isEditing = isEditingText(event);
      const rawKey = event.key;
      const lowerKey = rawKey?.toLowerCase();

      // Never intercept browser DevTools (Ctrl + Shift + I) or hard refresh (Ctrl + Shift + R)
      if (isCtrlOrMeta && event.shiftKey) {
        if (chordRef.current) {
          chordRef.current = null;
          clearTimeout(chordTimerRef.current);
        }
        return;
      }

      // 1. GENERAL SHORTCUT: ESCAPE
      if (rawKey === "Escape") {
        if (chordRef.current) {
          chordRef.current = null;
          clearTimeout(chordTimerRef.current);
          return;
        }

        if (isComposeOpen) {
          event.preventDefault();
          closeCompose();
          return;
        }

        if (isEditing) {
          event.target?.blur();
          return;
        }

        if (location.pathname === "/settings") {
          event.preventDefault();
          navigate("/inbox");
          return;
        }

        // Return / back action (closes open email, clears selection, etc.)
        dispatchShortcutAction("back");
        return;
      }

      // If user is editing text in any input, textarea, search box, or message composer, do not intercept
      if (isEditing) {
        if (chordRef.current) {
          chordRef.current = null;
          clearTimeout(chordTimerRef.current);
        }
        return;
      }

      // 2. SEARCH FOCUS: Ctrl + / (and plain / when not editing)
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && (rawKey === "/" || event.code === "Slash")) ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && rawKey === "/")
      ) {
        const searchInput =
          document.getElementById("mail-search-input") ||
          document.querySelector('input[type="search"]') ||
          document.querySelector('input[placeholder*="Search"]');
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select?.();
        }
        return;
      }

      // 3. HELP: ? (or Shift + /) when not typing in an input
      if (!isCtrlOrMeta && !event.altKey && (rawKey === "?" || (event.shiftKey && rawKey === "/"))) {
        event.preventDefault();
        if (location.pathname === "/settings") {
          window.dispatchEvent(new CustomEvent("bnx-open-shortcuts-tab"));
        } else {
          navigate("/settings", { state: { tab: "shortcuts" } });
        }
        return;
      }

      // 4. SEQUENTIAL MAIL NAVIGATION: Ctrl + G, then ...
      if (chordRef.current === "ctrl_g") {
        clearTimeout(chordTimerRef.current);

        if (!event.shiftKey && !event.altKey && lowerKey === "i") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/inbox");
          return;
        } else if (!event.shiftKey && !event.altKey && lowerKey === "s") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/sent");
          return;
        } else if (!event.shiftKey && !event.altKey && lowerKey === "d") {
          event.preventDefault();
          chordRef.current = null;
          navigate("/draft");
          return;
        } else if (!event.shiftKey && !event.altKey && lowerKey === "t") {
          event.preventDefault();
          // User entered 'T'. Could be Starred OR Trash (T then R)
          chordRef.current = "ctrl_g_t";
          chordTimerRef.current = setTimeout(() => {
            chordRef.current = null;
            navigate("/starred");
          }, 700);
          return;
        } else if (!event.shiftKey && !event.altKey && (lowerKey === "r" || lowerKey === "x")) {
          event.preventDefault();
          chordRef.current = null;
          navigate("/trash");
          return;
        }

        chordRef.current = null;
      } else if (chordRef.current === "ctrl_g_t") {
        clearTimeout(chordTimerRef.current);
        chordRef.current = null;

        if (!event.shiftKey && !event.altKey && lowerKey === "r") {
          event.preventDefault();
          navigate("/trash");
          return;
        } else {
          // If another key is pressed after T, complete Starred navigation
          navigate("/starred");
        }
      }

      // Initiating sequential navigation: Ctrl + G (or G when not editing text)
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "g") ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "g")
      ) {
        event.preventDefault();
        clearTimeout(chordTimerRef.current);
        chordRef.current = "ctrl_g";
        chordTimerRef.current = setTimeout(() => {
          chordRef.current = null;
        }, 1500);
        return;
      }

      // 5. EMAIL ACTIONS
      // COMPOSE: Ctrl + C (or plain C when not editing)
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "c") ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "c")
      ) {
        // If user highlighted text on screen, allow normal copy
        if (isCtrlOrMeta) {
          const selectedText = window.getSelection()?.toString();
          if (selectedText && selectedText.trim().length > 0) {
            return;
          }
        }

        event.preventDefault();
        openCompose({ mode: "mail" });
        return;
      }

      // REPLY: Ctrl + R (or plain R when not editing)
      // Only prevent browser default when an email action is actually handled
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "r") ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "r")
      ) {
        const handled = dispatchShortcutAction("reply");
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      // FORWARD: Ctrl + F (or plain F when not editing)
      // Only prevent browser find default when an email action is actually handled
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "f") ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "f")
      ) {
        const handled = dispatchShortcutAction("forward");
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      // ARCHIVE: Ctrl + E (or plain E when not editing)
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "e") ||
        (!isCtrlOrMeta && !event.shiftKey && !event.altKey && lowerKey === "e")
      ) {
        const handled = dispatchShortcutAction("archive");
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      // DELETE: Ctrl + Delete (or plain Delete / # when not editing)
      if (
        (isCtrlOrMeta && !event.shiftKey && !event.altKey && (rawKey === "Delete" || event.code === "Delete")) ||
        (!isCtrlOrMeta && !event.altKey && (rawKey === "Delete" || rawKey === "#" || (event.shiftKey && rawKey === "3")))
      ) {
        const handled = dispatchShortcutAction("delete");
        if (handled) {
          event.preventDefault();
        }
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
