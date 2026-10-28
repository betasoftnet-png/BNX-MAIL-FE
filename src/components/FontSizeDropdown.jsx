import React, { useState, useEffect, useRef } from "react";
import { MdArrowDropDown, MdCheck } from "react-icons/md";

const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "12px", sizeClass: "text-xs" },
  { label: "Normal", value: false, sizeClass: "text-sm" },
  { label: "Big", value: "20px", sizeClass: "text-base font-semibold" },
];

export const FontSizeDropdown = ({
  quillRef,
  direction = "down", // "down" or "up"
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSize, setCurrentSize] = useState("Normal");
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const savedSelectionRef = useRef(null);

  const getQuill = () => {
    if (!quillRef) return null;
    if (typeof quillRef === "function") return quillRef();
    if (quillRef.current?.getEditor) return quillRef.current.getEditor();
    return quillRef.current;
  };

  useEffect(() => {
    let cleanup = null;
    let retryTimer = null;

    const setupListener = (quill) => {
      if (!quill) return null;
      const updateActiveSize = () => {
        try {
          const format = quill.getFormat();
          const size = format?.size;
          if (
            size === "12px" ||
            size === "small" ||
            size === "10px" ||
            size === "13px"
          ) {
            setCurrentSize("Small");
          } else if (
            size === "20px" ||
            size === "22px" ||
            size === "24px" ||
            size === "32px" ||
            size === "large" ||
            size === "big" ||
            size === "huge"
          ) {
            setCurrentSize("Big");
          } else {
            setCurrentSize("Normal");
          }
        } catch (err) {
          // ignore format read errors
        }
      };

      quill.on("selection-change", updateActiveSize);
      quill.on("text-change", updateActiveSize);
      updateActiveSize();

      return () => {
        try {
          quill.off("selection-change", updateActiveSize);
          quill.off("text-change", updateActiveSize);
        } catch (e) {}
      };
    };

    const initialQuill = getQuill();
    if (initialQuill) {
      cleanup = setupListener(initialQuill);
    } else {
      let attempts = 0;
      retryTimer = setInterval(() => {
        attempts++;
        const q = getQuill();
        if (q) {
          clearInterval(retryTimer);
          retryTimer = null;
          cleanup = setupListener(q);
        } else if (attempts >= 25) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 100);
    }

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      if (cleanup) cleanup();
    };
  }, [quillRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectSize = (opt) => {
    const quill = getQuill();
    if (quill) {
      quill.focus();
      if (savedSelectionRef.current) {
        try {
          quill.setSelection(
            savedSelectionRef.current.index,
            savedSelectionRef.current.length
          );
        } catch (e) {}
      }
      if (opt.value === false) {
        quill.format("size", false);
      } else {
        quill.format("size", opt.value);
      }
    }
    setCurrentSize(opt.label);
    setIsOpen(false);
  };

  const handleToggleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const quill = getQuill();
    if (quill) {
      try {
        const sel = quill.getSelection();
        if (sel) {
          savedSelectionRef.current = sel;
        }
      } catch (err) {}
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggleOpen}
        className="inline-flex items-center gap-1 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-200 text-xs font-semibold px-2 py-1 rounded cursor-pointer transition-colors select-none shrink-0"
        title="Font size"
      >
        <span className="min-w-[42px] text-left">{currentSize}</span>
        <MdArrowDropDown
          size={16}
          className={`text-gray-400 dark:text-gray-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute ${
            direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } left-0 w-32 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-2xl z-[9999] py-1 flex flex-col`}
          style={{ minWidth: "115px" }}
        >
          {FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectSize(opt)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                currentSize === opt.label
                  ? "font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/30"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700/60"
              }`}
            >
              <span className={opt.sizeClass}>{opt.label}</span>
              {currentSize === opt.label && (
                <MdCheck size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FontSizeDropdown;

