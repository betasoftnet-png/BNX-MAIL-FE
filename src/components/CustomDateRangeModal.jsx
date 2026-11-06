import React, { useState, useMemo, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateDDMMYYYY } from "../utils/dateFilter";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Safely parses manual input strings such as DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD
 */
const parseManualDate = (str) => {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
      return null;
    }
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
      return null;
    }
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  return null;
};

const CustomDateRangeModal = ({
  isOpen,
  onClose,
  initialRange,
  onApply,
}) => {
  if (!isOpen) return null;

  // Dynamically compute today's date at 00:00:00 (Never hardcoded)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  const isFuture = (d) => {
    if (!d) return false;
    const test = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return test.getTime() > today.getTime();
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Selected dates: Date objects or null
  const [startDate, setStartDate] = useState(() => {
    if (initialRange?.startDate) {
      const d = new Date(initialRange.startDate);
      if (!isNaN(d.getTime())) {
        const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (!isFuture(norm)) return norm;
      }
    }
    return null;
  });

  const [endDate, setEndDate] = useState(() => {
    if (initialRange?.endDate) {
      const d = new Date(initialRange.endDate);
      if (!isNaN(d.getTime())) {
        const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (!isFuture(norm)) return norm;
      }
    }
    return null;
  });

  // Manual input strings
  const [startInputText, setStartInputText] = useState(() =>
    startDate ? formatDateDDMMYYYY(startDate) : ""
  );
  const [endInputText, setEndInputText] = useState(() =>
    endDate ? formatDateDDMMYYYY(endDate) : startDate ? formatDateDDMMYYYY(startDate) : ""
  );
  const [error, setError] = useState("");

  // Base month for dual calendar display (left month)
  // Right month defaults to the current month so future months are never rendered
  const [viewDate, setViewDate] = useState(() => {
    const base = startDate || today;
    const baseYear = base.getFullYear();
    const baseMonth = base.getMonth();
    if (baseYear === todayYear && baseMonth === todayMonth) {
      return new Date(todayYear, todayMonth - 1, 1);
    }
    return new Date(baseYear, baseMonth, 1);
  });

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setError("");
      let initStart = null;
      let initEnd = null;
      if (initialRange?.startDate) {
        const d = new Date(initialRange.startDate);
        if (!isNaN(d.getTime())) {
          const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (!isFuture(norm)) initStart = norm;
        }
      }
      if (initialRange?.endDate) {
        const d = new Date(initialRange.endDate);
        if (!isNaN(d.getTime())) {
          const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (!isFuture(norm)) initEnd = norm;
        }
      }
      setStartDate(initStart);
      setEndDate(initEnd);
      setStartInputText(initStart ? formatDateDDMMYYYY(initStart) : "");
      setEndInputText(initEnd ? formatDateDDMMYYYY(initEnd) : initStart ? formatDateDDMMYYYY(initStart) : "");

      const base = initStart || today;
      const baseYear = base.getFullYear();
      const baseMonth = base.getMonth();
      if (baseYear === todayYear && baseMonth === todayMonth) {
        setViewDate(new Date(todayYear, todayMonth - 1, 1));
      } else {
        setViewDate(new Date(baseYear, baseMonth, 1));
      }
    }
  }, [isOpen, initialRange, today, todayYear, todayMonth]);

  const leftMonth = viewDate.getMonth();
  const leftYear = viewDate.getFullYear();

  // Right month is next month
  const rightDate = useMemo(() => {
    return new Date(leftYear, leftMonth + 1, 1);
  }, [leftYear, leftMonth]);
  const rightMonth = rightDate.getMonth();
  const rightYear = rightDate.getFullYear();

  // Disable advancing past the current month
  const isNextMonthDisabled = useMemo(() => {
    return rightYear > todayYear || (rightYear === todayYear && rightMonth >= todayMonth);
  }, [rightYear, rightMonth, todayYear, todayMonth]);

  const handlePrevMonth = () => {
    setViewDate(new Date(leftYear, leftMonth - 1, 1));
  };

  const handleNextMonth = () => {
    if (isNextMonthDisabled) return;
    setViewDate(new Date(leftYear, leftMonth + 1, 1));
  };

  const handleDateClick = (clickedDate) => {
    setError("");

    if (isFuture(clickedDate)) {
      setError("Cannot select future dates.");
      toast.error("Future dates are not allowed.");
      return;
    }

    // If no start date or both dates already selected, start a fresh range
    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
      setStartInputText(formatDateDDMMYYYY(clickedDate));
      setEndInputText("");
      return;
    }

    // Only start date is selected:
    if (clickedDate.getTime() < startDate.getTime()) {
      // Clicked earlier than start date: make this the new start date
      setStartDate(clickedDate);
      setEndDate(null);
      setStartInputText(formatDateDDMMYYYY(clickedDate));
      setEndInputText("");
    } else {
      // Clicked on or after start date: set end date
      setEndDate(clickedDate);
      setEndInputText(formatDateDDMMYYYY(clickedDate));
    }
  };

  const handleStartInputChange = (e) => {
    const val = e.target.value;
    setStartInputText(val);
    setError("");

    if (!val.trim()) {
      setStartDate(null);
      return;
    }

    const parsed = parseManualDate(val);
    if (parsed) {
      if (isFuture(parsed)) {
        setError("Start Date cannot be in the future.");
        return;
      }
      setStartDate(parsed);
      setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  const handleStartInputBlur = () => {
    const trimmed = startInputText.trim();
    if (!trimmed) {
      setStartDate(null);
      return;
    }
    const parsed = parseManualDate(trimmed);
    if (!parsed) {
      setError("Please enter a valid Start Date in DD-MM-YYYY format.");
      return;
    }
    if (isFuture(parsed)) {
      setError("Start Date cannot be in the future.");
      toast.error("Future dates are not allowed.");
      setStartInputText(startDate ? formatDateDDMMYYYY(startDate) : "");
      return;
    }
    setStartDate(parsed);
    setStartInputText(formatDateDDMMYYYY(parsed));
  };

  const handleEndInputChange = (e) => {
    const val = e.target.value;
    setEndInputText(val);
    setError("");

    if (!val.trim()) {
      setEndDate(null);
      return;
    }

    const parsed = parseManualDate(val);
    if (parsed) {
      if (isFuture(parsed)) {
        setError("End Date cannot be in the future.");
        return;
      }
      if (startDate && parsed.getTime() < startDate.getTime()) {
        setError("End Date cannot be earlier than Start Date.");
        return;
      }
      setEndDate(parsed);
    }
  };

  const handleEndInputBlur = () => {
    const trimmed = endInputText.trim();
    if (!trimmed) {
      setEndDate(null);
      return;
    }
    const parsed = parseManualDate(trimmed);
    if (!parsed) {
      setError("Please enter a valid End Date in DD-MM-YYYY format.");
      return;
    }
    if (isFuture(parsed)) {
      setError("End Date cannot be in the future.");
      toast.error("Future dates are not allowed.");
      setEndInputText(endDate ? formatDateDDMMYYYY(endDate) : "");
      return;
    }
    if (startDate && parsed.getTime() < startDate.getTime()) {
      setError("End Date cannot be earlier than Start Date.");
      toast.error("End Date cannot be earlier than Start Date.");
      setEndInputText(endDate ? formatDateDDMMYYYY(endDate) : "");
      return;
    }
    setEndDate(parsed);
    setEndInputText(formatDateDDMMYYYY(parsed));
  };

  const isInRange = (d) => {
    if (!startDate || !endDate) return false;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    return t > s && t < e;
  };

  const renderMonthDays = (year, month) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells = [];

    // Blank cells before month starts
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`blank-${i}`} className="h-8 w-8 sm:h-9 sm:w-9" />);
    }

    // Day cells
    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(year, month, day);
      cellDate.setHours(0, 0, 0, 0);
      const isFutureDate = cellDate.getTime() > today.getTime();
      const isStart = isSameDay(cellDate, startDate);
      const isEnd = isSameDay(cellDate, endDate);
      const inRange = isInRange(cellDate);
      const isCurrentDay = isSameDay(cellDate, today);

      let cellClasses = "h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-xs sm:text-sm font-medium transition-colors select-none ";

      if (isFutureDate) {
        cellClasses += "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-35 hover:bg-transparent pointer-events-none";
      } else if (isStart || isEnd) {
        cellClasses += "bg-blue-600 text-white font-bold rounded-lg shadow-sm z-10 cursor-pointer";
      } else if (inRange) {
        cellClasses += "bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-none cursor-pointer";
      } else {
        cellClasses += "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer";
        if (isCurrentDay) {
          cellClasses += " font-bold ring-1 ring-blue-500/50";
        }
      }

      cells.push(
        <button
          key={`day-${year}-${month}-${day}`}
          type="button"
          disabled={isFutureDate}
          onClick={() => !isFutureDate && handleDateClick(cellDate)}
          className={cellClasses}
          title={isFutureDate ? "Future dates are disabled" : isCurrentDay ? "Today" : undefined}
          aria-disabled={isFutureDate}
        >
          {day}
        </button>
      );
    }

    return cells;
  };

  const handleApply = () => {
    setError("");

    let resolvedStart = startDate;
    if (startInputText.trim()) {
      const parsed = parseManualDate(startInputText);
      if (!parsed) {
        const msg = "Please enter a valid Start Date (DD-MM-YYYY).";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (isFuture(parsed)) {
        const msg = "Start Date cannot be in the future.";
        setError(msg);
        toast.error(msg);
        return;
      }
      resolvedStart = parsed;
    }

    if (!resolvedStart) {
      const msg = "Please select or enter a Start Date.";
      setError(msg);
      toast.error(msg);
      return;
    }

    let resolvedEnd = endDate;
    if (endInputText.trim()) {
      const parsed = parseManualDate(endInputText);
      if (!parsed) {
        const msg = "Please enter a valid End Date (DD-MM-YYYY).";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (isFuture(parsed)) {
        const msg = "End Date cannot be in the future.";
        setError(msg);
        toast.error(msg);
        return;
      }
      resolvedEnd = parsed;
    } else {
      resolvedEnd = resolvedStart;
    }

    if (isFuture(resolvedStart)) {
      const msg = "Start Date cannot be in the future.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (isFuture(resolvedEnd)) {
      const msg = "End Date cannot be in the future.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (resolvedStart.getTime() > resolvedEnd.getTime()) {
      const msg = "Start Date cannot be after End Date.";
      setError(msg);
      toast.error(msg);
      return;
    }

    onApply({
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-black/25 backdrop-blur-[2px] animate-fade-in">
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 p-5 sm:p-6 w-full max-w-[620px] max-h-[92vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
              Custom Date Range
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Validation Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 mt-3 mb-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-800 animate-fade-in">
            <AlertCircle size={15} className="shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Inputs Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Start Date
            </label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white dark:focus-within:bg-gray-800 transition-all">
              <Calendar className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={startInputText}
                onChange={handleStartInputChange}
                onBlur={handleStartInputBlur}
                placeholder="DD-MM-YYYY"
                maxLength={10}
                className="w-full bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 font-medium outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              End Date
            </label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white dark:focus-within:bg-gray-800 transition-all">
              <Calendar className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={endInputText}
                onChange={handleEndInputChange}
                onBlur={handleEndInputBlur}
                placeholder="DD-MM-YYYY"
                maxLength={10}
                className="w-full bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 font-medium outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Calendars Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-4 p-3 bg-gray-50/40 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800">
          {/* Left Month Calendar */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {MONTH_NAMES[leftMonth]} {leftYear}
              </span>
              <div className="w-5" />
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {WEEK_DAYS.map((d) => (
                <div key={`left-day-${d}`} className="text-[11px] font-semibold text-gray-400 select-none">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderMonthDays(leftYear, leftMonth)}
            </div>
          </div>

          {/* Right Month Calendar */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="w-5" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {MONTH_NAMES[rightMonth]} {rightYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={isNextMonthDisabled}
                className={`p-1 rounded-lg transition-colors ${
                  isNextMonthDisabled
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40"
                    : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                }`}
                title={isNextMonthDisabled ? "Future months are not available" : "Next Month"}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {WEEK_DAYS.map((d) => (
                <div key={`right-day-${d}`} className="text-[11px] font-semibold text-gray-400 select-none">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderMonthDays(rightYear, rightMonth)}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!startDate && !startInputText.trim()}
            className="px-7 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm shadow-md transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDateRangeModal;
