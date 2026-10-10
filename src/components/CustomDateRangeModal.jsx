import React, { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDateDDMMYYYY } from "../utils/dateFilter";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CustomDateRangeModal = ({
  isOpen,
  onClose,
  initialRange,
  onApply,
}) => {
  if (!isOpen) return null;

  // Selected dates: Date objects or null
  const [startDate, setStartDate] = useState(() => {
    if (initialRange?.startDate) {
      const d = new Date(initialRange.startDate);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });

  const [endDate, setEndDate] = useState(() => {
    if (initialRange?.endDate) {
      const d = new Date(initialRange.endDate);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });

  // Base month for dual calendar display (left month)
  const [viewDate, setViewDate] = useState(() => {
    const base = startDate || new Date();
    // Default to the previous month or current month so both months are nicely visible
    const d = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    return d;
  });

  const leftMonth = viewDate.getMonth();
  const leftYear = viewDate.getFullYear();

  // Right month is next month
  const rightDate = useMemo(() => {
    return new Date(leftYear, leftMonth + 1, 1);
  }, [leftYear, leftMonth]);
  const rightMonth = rightDate.getMonth();
  const rightYear = rightDate.getFullYear();

  const handlePrevMonth = () => {
    setViewDate(new Date(leftYear, leftMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(leftYear, leftMonth + 1, 1));
  };

  const handleDateClick = (clickedDate) => {
    // If no start date or both dates already selected, start a fresh range
    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
      return;
    }

    // Only start date is selected:
    if (clickedDate.getTime() < startDate.getTime()) {
      // Clicked earlier than start date: make this the new start date
      setStartDate(clickedDate);
      setEndDate(null);
    } else {
      // Clicked on or after start date: set end date
      setEndDate(clickedDate);
    }
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isInRange = (d) => {
    if (!startDate || !endDate) return false;
    const t = d.getTime();
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
      const isStart = isSameDay(cellDate, startDate);
      const isEnd = isSameDay(cellDate, endDate);
      const inRange = isInRange(cellDate);

      let cellClasses = "h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none ";

      if (isStart || isEnd) {
        cellClasses += "bg-blue-600 text-white font-bold rounded-lg shadow-sm z-10";
      } else if (inRange) {
        cellClasses += "bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-none";
      } else {
        cellClasses += "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg";
      }

      cells.push(
        <button
          key={`day-${day}`}
          type="button"
          onClick={() => handleDateClick(cellDate)}
          className={cellClasses}
        >
          {day}
        </button>
      );
    }

    return cells;
  };

  const handleApply = () => {
    if (!startDate) return;
    onApply({
      startDate: startDate,
      endDate: endDate || startDate,
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

        {/* Inputs Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Start Date
            </label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50">
              <Calendar className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
              <input
                type="text"
                readOnly
                value={startDate ? formatDateDDMMYYYY(startDate) : ""}
                placeholder="DD-MM-YYYY"
                className="w-full bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 font-medium outline-none cursor-default placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              End Date
            </label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50">
              <Calendar className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
              <input
                type="text"
                readOnly
                value={endDate ? formatDateDDMMYYYY(endDate) : startDate ? formatDateDDMMYYYY(startDate) : ""}
                placeholder="DD-MM-YYYY"
                className="w-full bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 font-medium outline-none cursor-default placeholder:text-gray-400"
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
                className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                title="Next Month"
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
            disabled={!startDate}
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
