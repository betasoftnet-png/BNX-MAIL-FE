import React from "react";
import { getAvatarColor, getInitials } from "../utils/recipientSuggestions";

const RecipientAutocomplete = ({
  suggestions = [],
  highlightedIndex = 0,
  onSelectSuggestion,
  onHoverIndex,
  dropdownRef,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full mt-1.5 z-[9999] bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl py-1 overflow-hidden max-h-60 overflow-y-auto"
      onMouseDown={(e) => {
        // Prevent input blur before click handler registers
        e.preventDefault();
      }}
    >
      {suggestions.map((suggestion, idx) => {
        const isHighlighted = idx === highlightedIndex;
        const avatarColor = getAvatarColor(suggestion.email);
        const displayName = suggestion.name || suggestion.email.split("@")[0];

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
              <span className="font-semibold text-sm truncate">
                {displayName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                &lt;{suggestion.email}&gt;
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecipientAutocomplete;
