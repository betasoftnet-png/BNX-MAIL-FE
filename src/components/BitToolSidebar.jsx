import React, { useState } from "react";
import {
  MdCalendarToday, MdCalculate, MdPeople, MdKeyboard,
  MdTranslate, MdFilterCenterFocus, MdNewspaper,
  MdAdd, MdCheck, MdClose, MdOutlineEdit, MdTune, MdApps, MdOutlineNoteAlt
} from "react-icons/md";
import { useTheme } from "../context/ThemeContext";
import AppLauncher from "./AppLauncher";
import { NotesManager } from "./StickyNotes";
import CalendarPanel from "./CalendarPanel";
import ContactPanel from "./ContactPanel";
import NotesPanel from "./NotesPanel";
import CalcPopover from "./CalcPopover";
import VirtualKeyboard from "./VirtualKeyboard";
import betalogo from '../assets/beta2.png';

// Tools Definition
const ALL_TOOLS = [
  { id: "calendar", name: "Calendar", icon: MdCalendarToday, color: "#f59e0b", ringClass: "border-[#f59e0b]", textClass: "text-[#f59e0b]", bgClass: "bg-amber-50 dark:bg-amber-950/20" },
  { id: "calculator", name: "Calculator", icon: MdCalculate, color: "#10b981", ringClass: "border-[#10b981]", textClass: "text-[#10b981]", bgClass: "bg-emerald-50 dark:bg-emerald-950/20" },
  { id: "contacts", name: "Connections", icon: MdPeople, color: "#3b82f6", ringClass: "border-[#3b82f6]", textClass: "text-[#3b82f6]", bgClass: "bg-blue-50 dark:bg-blue-950/20" },
  { id: "notes", name: "Notes", icon: MdOutlineNoteAlt, color: "#eab308", ringClass: "border-[#eab308]", textClass: "text-[#eab308]", bgClass: "bg-yellow-50 dark:bg-yellow-950/20" },
  { id: "keyboard", name: "Keyboard", icon: MdKeyboard, color: "#6366f1", ringClass: "border-[#6366f1]", textClass: "text-[#6366f1]", bgClass: "bg-indigo-50 dark:bg-indigo-950/20" }
];

const BitToolSidebar = ({
  isOpen,
  onClose,
  notes,
  openNoteIds,
  onOpenNote,
  onCreateNote,
  onDeleteNote
}) => {
  const { theme, backgroundImage } = useTheme();
  const [pinnedTools, setPinnedTools] = useState(["calendar", "calculator", "contacts", "notes", "keyboard"]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showAppLauncher, setShowAppLauncher] = useState(false);

  // Tooltip helper state
  const [hoveredTool, setHoveredTool] = useState(null);

  // Calculator State
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("");

  // Contacts Search State
  const [contactsSearch, setContactsSearch] = useState("");

  // Width-based toggle handled dynamically via window size & inline styles
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedTool(null);
      setIsEditing(false);
      setShowAppLauncher(false);
    }
  }, [isOpen]);

  const isSmallScreen = windowWidth < 1024;
  const isToolOpen = Boolean(selectedTool && selectedTool !== 'keyboard');
  const isSidebarVisible = isOpen || isToolOpen;

  // On desktop (>= 1024px), the tool panel takes 360px inline space, so total width is 360 + 60 = 420px.
  // On small screens, the tool panel renders as a modal so it doesn't crush the main mail/chat view.
  const desktopPanelWidth = isToolOpen && !isSmallScreen ? 360 : 0;
  const desktopTotalWidth = !isSidebarVisible ? 0 : (desktopPanelWidth + 60);

  // Toggle Pinned status
  const handleTogglePin = (toolId) => {
    if (pinnedTools.includes(toolId)) {
      // Don't allow unpinning if it's the last one
      if (pinnedTools.length > 1) {
        setPinnedTools(pinnedTools.filter(id => id !== toolId));
      }
    } else {
      setPinnedTools([...pinnedTools, toolId]);
    }
  };

  // Calculator Buttons Click
  const handleCalcClick = (val) => {
    if (val === "C") {
      setCalcInput("");
      setCalcResult("");
    } else if (val === "=") {
      try {
        // Safe evaluation
        const cleanExpression = calcInput.replace(/[^0-9+\-*/.]/g, "");
        const res = Function(`"use strict"; return (${cleanExpression})`)();
        setCalcResult(String(res));
      } catch (err) {
        setCalcResult("Error");
      }
    } else if (val === "Del") {
      setCalcInput(prev => prev.slice(0, -1));
    } else {
      setCalcInput(prev => prev + val);
    }
  };

  const renderMiniApp = () => {
    switch (selectedTool) {
      case "calendar":
        return <CalendarPanel />;
      case "calculator":
        return <CalcPopover />;
      case "contacts":
        return <ContactPanel />;
      case "notes":
        return <NotesPanel />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Virtual Keyboard */}
      {selectedTool === 'keyboard' && (
        <VirtualKeyboard onClose={() => setSelectedTool(null)} />
      )}

      {/* Small Screen Responsive Modal/Panel */}
      {isSmallScreen && isToolOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => setSelectedTool(null)}
          />

          {/* Panel */}
          <div
            className="relative w-full sm:w-[420px] max-w-[95vw] h-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 z-10 animate-slide-in select-text"
          >
            {/* Header with Tool Name and Close Button */}
            <div className="px-4 h-14 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-black/20 shrink-0">
              <h4 className="font-bold text-sm" style={{ color: theme.text }}>
                {selectedTool === 'apps' ? 'Beta Ecosystem' : ALL_TOOLS.find(t => t.id === selectedTool)?.name}
              </h4>
              <button
                onClick={() => setSelectedTool(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors"
                title="Close"
                aria-label="Close tool"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${selectedTool === 'calculator' ? 'p-0' : 'p-4'}`}>
              {selectedTool === 'apps' ? (
                <AppLauncher onClose={() => setSelectedTool(null)} onToggleBitToolSidebar={() => { }} onEdit={() => setIsEditing(true)} />
              ) : (
                renderMiniApp()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Right Sidebar Container (Flex Item in App Layout) */}
      <div
        className={`h-full flex shrink-0 select-none transition-all duration-300 ease-in-out ${backgroundImage ? "bg-transparent" : "bg-white dark:bg-gray-900"} animate-fade-in rounded-tl-2xl printable-conversation-no-print`}
        style={{
          width: `${desktopTotalWidth}px`,
          borderLeftWidth: isSidebarVisible ? "1px" : "0px",
          borderLeftColor: backgroundImage ? "transparent" : theme.bg,
          overflow: !isSidebarVisible ? "hidden" : "visible"
        }}
      >
        {/* Desktop Mini-App Slide Panel (Shown to the left of the 60px strip on desktop) */}
        {!isSmallScreen && (
          <div
            className={`flex flex-col select-text transition-all duration-300 ease-in-out ${backgroundImage ? "bg-transparent" : "bg-white dark:bg-gray-900"} rounded-tl-2xl h-full`}
            style={{
              width: `${desktopPanelWidth}px`,
              borderRightWidth: desktopPanelWidth > 0 ? "1px" : "0px",
              borderRightColor: theme.border,
              overflow: "hidden"
            }}
          >
            {isToolOpen && (
              selectedTool === 'apps' ? (
                <AppLauncher onClose={() => setSelectedTool(null)} onToggleBitToolSidebar={() => { }} onEdit={() => setIsEditing(true)} />
              ) : (
                <>
                  <div className="px-4 h-14 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01] shrink-0">
                    <h4 className="font-bold text-sm" style={{ color: theme.text }}>
                      {ALL_TOOLS.find(t => t.id === selectedTool)?.name}
                    </h4>
                    <button
                      onClick={() => setSelectedTool(null)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors"
                      title="Close"
                      aria-label="Close"
                    >
                      <MdClose size={18} />
                    </button>
                  </div>
                  <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${selectedTool === 'calculator' ? 'p-0' : 'p-4'}`}>
                    {renderMiniApp()}
                  </div>
                </>
              )
            )}
          </div>
        )}

        {/* Right Sidebar Strip */}
        <div
          className="right-tools-sidebar relative w-[60px] flex flex-col items-center pb-4 h-full justify-between select-none shrink-0"
        >
        <div className="flex flex-col items-center w-full">
          {/* HEADER / EDIT MODE LABEL */}
          <div
            className="flex items-center justify-center w-full h-14 shrink-0 transition-all"
          >
            {isEditing ? (
              <div className="text-[9px] font-bold text-gray-450 uppercase tracking-widest text-center leading-none">
                Edit<br />Pins
              </div>
            ) : (
              <div className="tool-item relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTool(selectedTool === 'apps' ? null : 'apps');
                    setHoveredTool(null);
                  }}
                  onMouseEnter={() => setHoveredTool('apps')}
                  onMouseLeave={() => setHoveredTool(null)}
                  aria-label="Beta Ecosystem"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer border ${selectedTool === 'apps' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
                >
                  <img src={betalogo} alt="beta-apps" className="w-6 h-6 object-contain" />
                </button>
                {hoveredTool === 'apps' && (
                  <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                    <span>Apps</span>
                    <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider Line under the B Logo */}
          <div className="w-8 h-[1px] bg-gray-200 dark:bg-gray-800 -mt-[1px]" />

          {/* ACTIVE & INACTIVE TOOLS LIST */}
          <div className="flex flex-col items-center gap-4 w-full mt-2">
            {isEditing ? (
              // EDIT MODE LAYOUT: Shows all tools, currently pinned ones have color rings, unpinned have dashed
              ALL_TOOLS.map((tool) => {
                const isPinned = pinnedTools.includes(tool.id);
                const Icon = tool.icon;
                return (
                  <div key={tool.id} className="tool-item relative">
                    <button
                      onClick={() => handleTogglePin(tool.id)}
                      onMouseEnter={() => setHoveredTool(tool.id)}
                      onMouseLeave={() => setHoveredTool(null)}
                      aria-label={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border-2 ${isPinned
                          ? `${tool.ringClass} ${tool.bgClass} ${tool.textClass}`
                          : "border-dashed border-gray-300 dark:border-gray-700 bg-transparent text-gray-400 hover:border-gray-400"
                        }`}
                    >
                      <Icon size={18} />
                    </button>

                    {/* CUSTOM POPOVER TOOLTIP */}
                    {hoveredTool === tool.id && (
                      <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                        <span>{isPinned ? `Unpin ${tool.tooltipName || tool.name}` : `Pin ${tool.tooltipName || tool.name}`}</span>
                        <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // NORMAL MODE LAYOUT: Shows only pinned tools
              ALL_TOOLS
                .filter(t => pinnedTools.includes(t.id))
                .map((tool) => {
                  const Icon = tool.icon;
                  const isSelected = selectedTool === tool.id;
                  return (
                    <div key={tool.id} className="tool-item relative">
                      <button
                        onClick={() => {
                          setSelectedTool(isSelected ? null : tool.id);
                          setHoveredTool(null);
                        }}
                        onMouseEnter={() => setHoveredTool(tool.id)}
                        onMouseLeave={() => setHoveredTool(null)}
                        aria-label={tool.name}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border-2 ${isSelected
                            ? `${tool.ringClass} ${tool.bgClass} ${tool.textClass} scale-95 shadow-inner`
                            : `border-transparent hover:scale-105 ${tool.bgClass} ${tool.textClass} shadow-sm`
                          }`}
                      >
                        <Icon size={18} />
                      </button>

                      {/* TOOLTIP */}
                      {hoveredTool === tool.id && (
                        <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                          <span>{tool.tooltipName || tool.name}</span>
                          <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
                        </div>
                      )}
                    </div>
                  );
                })
            )}

            {/* PLUS ICON / CHECKMARK ICON */}
            {isEditing ? (
              // Green Checkmark Button
              <div className="tool-item relative mt-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setHoveredTool(null);
                  }}
                  onMouseEnter={() => setHoveredTool('save-pins')}
                  onMouseLeave={() => setHoveredTool(null)}
                  aria-label="Save Pins"
                  className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <MdCheck size={18} />
                </button>
                {hoveredTool === 'save-pins' && (
                  <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                    <span>Save</span>
                    <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
                  </div>
                )}
              </div>
            ) : (
              // Plus Button (Dashed ring)
              <div className="tool-item relative">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setHoveredTool(null);
                  }}
                  onMouseEnter={() => setHoveredTool('edit-pins')}
                  onMouseLeave={() => setHoveredTool(null)}
                  aria-label="Edit Pins"
                  className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-600 flex items-center justify-center transition-all cursor-pointer"
                >
                  <MdAdd size={18} />
                </button>
                {hoveredTool === 'edit-pins' && (
                  <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                    <span>Edit</span>
                    <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM UTILITY ICON BLOCK */}
        <div className="flex flex-col items-center gap-3.5 w-full mt-auto">
          <div className="w-8 h-[1px] bg-gray-200 dark:bg-gray-800" />

          <div className="tool-item relative">
            <button
              className="w-10 h-10 rounded-xl border border-gray-200/60 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-all cursor-pointer bg-white/50 dark:bg-gray-900/50 shadow-sm"
              aria-label="Virtual Keyboard"
              onClick={() => {
                setSelectedTool(selectedTool === 'keyboard' ? null : 'keyboard');
                setHoveredTool(null);
              }}
              onMouseEnter={() => setHoveredTool('keyboard-util')}
              onMouseLeave={() => setHoveredTool(null)}
            >
              <MdOutlineEdit size={18} />
            </button>
            {hoveredTool === 'keyboard-util' && (
              <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                <span>Keyboard</span>
                <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
              </div>
            )}
          </div>

          <div className="tool-item relative">
            <button
              className="w-10 h-10 rounded-xl border border-gray-200/60 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-all cursor-pointer bg-white/50 dark:bg-gray-900/50 shadow-sm"
              aria-label="Customize Sidebar"
              onClick={() => {
                setIsEditing(true);
                setHoveredTool(null);
              }}
              onMouseEnter={() => setHoveredTool('customize-util')}
              onMouseLeave={() => setHoveredTool(null)}
            >
              <MdTune size={18} />
            </button>
            {hoveredTool === 'customize-util' && (
              <div className="tool-tooltip bg-gray-900/95 dark:bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md pointer-events-none select-none whitespace-nowrap flex items-center">
                <span>Customize</span>
                <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[4px] border-l-gray-900/95 dark:border-l-gray-800" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default BitToolSidebar;
