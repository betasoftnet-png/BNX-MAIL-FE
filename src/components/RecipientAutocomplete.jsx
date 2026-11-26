import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MdPersonAdd } from "react-icons/md";
import { getAvatarColor, getInitials } from "../utils/recipientSuggestions";

const RecipientAutocomplete = ({
  suggestions = [],
  highlightedIndex = 0,
  onSelectSuggestion,
  onHoverIndex,
  dropdownRef,
  isLoading = false,
  query = "",
  anchorRef = null,
}) => {
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;
  const [imageErrorMap, setImageErrorMap] = useState({});
  const [dropdownCoords, setDropdownCoords] = useState(null);
  const internalDropdownRef = useRef(null);

  // Sync ref with parent dropdownRef
  const setCombinedRef = (node) => {
    internalDropdownRef.current = node;
    if (typeof dropdownRef === "function") {
      dropdownRef(node);
    } else if (dropdownRef) {
      dropdownRef.current = node;
    }
  };

  const handleImageError = (email) => {
    setImageErrorMap((prev) => ({ ...prev, [email]: true }));
  };

  // Compute position relative to viewport using anchorRef
  useLayoutEffect(() => {
    if (!hasSuggestions) return;

    const updatePosition = () => {
      const anchorEl = anchorRef?.current;
      if (!anchorEl) return;

      const rect = anchorEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      // Desired width: matches anchor width, with min 280px / 340px and max available viewport
      const desiredWidth = Math.max(rect.width, Math.min(viewportWidth - 32, 340));
      const width = Math.min(desiredWidth, viewportWidth - 24);

      // Horizontal alignment: align to anchor left, but prevent clipping on right
      let left = rect.left;
      if (left + width > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - 12 - width);
      }
      if (left < 12) left = 12;

      // Vertical alignment: check space below vs above
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const dropdownMaxHeight = Math.min(280, Math.max(160, Math.max(spaceBelow, spaceAbove) - 10));

      let top;
      let placeAbove = false;
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        // Place above anchor
        placeAbove = true;
        top = Math.max(12, rect.top - dropdownMaxHeight - 6);
      } else {
        // Place below anchor
        placeAbove = false;
        top = rect.bottom + 6;
      }

      setDropdownCoords({
        top,
        left,
        width,
        maxHeight: dropdownMaxHeight,
        placeAbove,
      });
    };

    updatePosition();

    // Listen for resize and scroll events
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, { capture: true });
    };
  }, [hasSuggestions, anchorRef, suggestions.length]);

  // Only display dropdown when actual matching suggestions exist
  if (!hasSuggestions) return null;

  const content = (
    <div
      ref={setCombinedRef}
      style={
        dropdownCoords
          ? {
              position: "fixed",
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              width: `${dropdownCoords.width}px`,
              maxHeight: `${dropdownCoords.maxHeight}px`,
              zIndex: 999999,
            }
          : {
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              marginTop: "6px",
              zIndex: 999999,
              maxHeight: "280px",
            }
      }
      className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl py-1.5 overflow-hidden overflow-y-auto transition-all select-none"
      onMouseDown={(e) => {
        // Prevent input blur before click handler registers
        e.preventDefault();
      }}
    >
      {suggestions.map((suggestion, idx) => {
        const isHighlighted = idx === highlightedIndex;
        const isNew = suggestion.isNewRecipient || suggestion.source === "NEW_RECIPIENT";
        const category = (suggestion.category || suggestion.source || "INBOX").toUpperCase();
        const avatarColor = getAvatarColor(suggestion.email);
        const displayName = isNew ? "Add Recipient" : (suggestion.name || suggestion.email.split("@")[0]);
        const hasValidImage = Boolean(suggestion.avatarUrl && !imageErrorMap[suggestion.email]);

        return (
          <div
            key={`${suggestion.email}_${idx}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectSuggestion(suggestion);
            }}
            onMouseEnter={() => onHoverIndex?.(idx)}
            className={`flex items-center gap-3 px-3.5 py-2 cursor-pointer transition-colors ${
              isHighlighted
                ? "bg-blue-50/90 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100"
                : "hover:bg-gray-50/90 dark:hover:bg-neutral-800/60 text-gray-800 dark:text-gray-200"
            }`}
          >
            {/* Circular Avatar on the left */}
            {isNew ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-blue-600 text-white shadow-xs shrink-0">
                <MdPersonAdd size={16} />
              </div>
            ) : hasValidImage ? (
              <img
                src={suggestion.avatarUrl}
                alt={displayName}
                onError={() => handleImageError(suggestion.email)}
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs border border-gray-100 dark:border-neutral-700"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase text-white shadow-xs shrink-0 ${avatarColor}`}
              >
                {getInitials(displayName)}
              </div>
            )}

            {/* Gmail-Style Two-Line Text (Display Name on Line 1, Email Address on Line 2) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span
                className={`text-[13px] break-words font-semibold leading-tight ${
                  isNew ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {isNew ? `Add "${suggestion.email}"` : displayName}
              </span>
              <span className="text-[11.5px] text-gray-500 dark:text-gray-400 break-all leading-tight font-normal mt-0.5">
                {suggestion.email}
              </span>
            </div>

            {/* Priority Category Badge */}
            <div className="shrink-0 flex items-center ml-1">
              {isNew ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  New
                </span>
              ) : category === "INBOX" ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                  Inbox
                </span>
              ) : category === "SENT" ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                  Sent
                </span>
              ) : category === "BNXMAIL_USER" || category === "DATABASE_USER" ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                  User
                </span>
              ) : category === "STARRED" ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                  Starred
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80">
                  Contact
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // If running in browser, render via Portal into document.body to break free of any parent clipping / stacking context
  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }

  return content;
};

export default RecipientAutocomplete;
