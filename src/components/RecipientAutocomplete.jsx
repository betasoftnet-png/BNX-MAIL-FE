import React from "react";
import { getAvatarColor, getInitials } from "../utils/recipientSuggestions";

const RecipientAutocomplete = ({
  suggestions = [],
  highlightedIndex = 0,
  onSelectSuggestion,
  onHoverIndex,
  dropdownRef,
  isLoading = false,
  query = "",
}) => {
  const hasQuery = Boolean(query && query.trim().length > 0);
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;

  // Don't show dropdown if no query and no suggestions
  if (!hasQuery && !hasSuggestions) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full mt-1.5 z-[9999] bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl py-1 overflow-hidden max-h-60 overflow-y-auto w-full"
      onMouseDown={(e) => {
        // Prevent input blur before click handler registers
        e.preventDefault();
      }}
    >
      {isLoading && !hasSuggestions ? (
        <div className="flex items-center justify-center gap-2.5 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 select-none">
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Searching contacts...</span>
        </div>
      ) : !hasSuggestions ? (
        <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center select-none italic">
          No matching contacts or registered BNXmail users found
        </div>
      ) : (
        suggestions.map((suggestion, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const avatarColor = getAvatarColor(suggestion.email);
          const displayName = suggestion.name || suggestion.email.split("@")[0];
          const isBnxUser = suggestion.source === "BNXMAIL_USER" || (!suggestion.isPreviousContact && suggestion.email?.toLowerCase().endsWith("@bnxmail.com"));
          const isPrevious = suggestion.isPreviousContact || suggestion.source === "PREVIOUS_CONTACT";

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
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100"
                  : "hover:bg-gray-50 dark:hover:bg-neutral-800/60 text-gray-800 dark:text-gray-200"
              }`}
            >
              {/* Avatar Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase text-white shadow-sm shrink-0 ${avatarColor}`}
              >
                {getInitials(displayName)}
              </div>

              {/* Recipient Details */}
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className="font-semibold text-sm truncate max-w-[150px] sm:max-w-[200px]">
                  {displayName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px] sm:max-w-none">
                  &lt;{suggestion.email}&gt;
                </span>
              </div>

              {/* Source Badge */}
              {isBnxUser && (
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  BNXmail
                </span>
              )}
              {isPrevious && !isBnxUser && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400">
                  Contact
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default RecipientAutocomplete;
