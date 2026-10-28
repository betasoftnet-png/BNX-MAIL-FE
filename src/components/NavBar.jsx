import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { MdSettings, MdEmail, MdLogout, MdLightMode, MdDarkMode, MdNotifications, MdCheckCircle, MdManageAccounts, MdPersonAdd, MdPhotoCamera, MdMenu, MdAdd, MdApps, MdOutlineNoteAlt } from "react-icons/md";
import { userAPI, casboxAPI, chatAPI } from "../services/api";
import toast from "react-hot-toast";
import { SlidersHorizontal, Calendar, Check, ChevronRight, Search, X } from "lucide-react";
// import logo from "../assets/bnx.jpeg";

import logo from "../assets/bnx-remove.png";
import bitToolLogo from "../assets/BIT-TOOL-2.png";
import AppLauncher from "./AppLauncher";
import CustomDateRangeModal from "./CustomDateRangeModal";
import {
  getActiveFolderFromPath,
  getFolderDisplayName,
  matchesFolderScope,
  matchesEmailQuery,
  parsePersonAndEmail,
  formatSuggestionDate
} from "../utils/searchUtils";
import { getEmailPreviewSnippet } from "../utils/htmlUtils";

const NavBar = ({ searchQuery, setSearchQuery, onOpenMenu, onToggleDesktopSidebar, onToggleBitToolSidebar, onOpenNotes, isDesktopSidebarOpen = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, logoutAll, switchAccount, getSessions } = useAuth();
  const { theme, currentThemeName, changeTheme, backgroundImage } = useTheme();
  const { openCompose, emails, getFolderEmails, labels, dateFilter, setDateFilter, customDateRange, setCustomDateRange, matchesDateFilter } = useMail();
  const isPrimary = user?.isPrimary || user?.mailboxes?.find(m => m.email === user.email)?.isPrimary;

  const currentTab = location.pathname.startsWith('/colab') || location.pathname.startsWith('/chat') || location.pathname.startsWith('/casbox') ? 'chat'
    : location.pathname.startsWith('/vault') ? 'vault'
      : 'mail';

  const allSessions = getSessions();
  const otherSessions = allSessions.filter(sess => sess.email !== user?.email);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showDateFilterDropdown, setShowDateFilterDropdown] = useState(false);
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const dateFilterRef = useRef(null);

  const [allCasboxMessages, setAllCasboxMessages] = useState([]);
  const [allChatRooms, setAllChatRooms] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchContainerRef = useRef(null);
  const mobileInputRef = useRef(null);

  useEffect(() => {
    if (user?.email && searchQuery.trim().length > 0) {
      casboxAPI.getAllMessages()
        .then(res => {
          if (res.data) setAllCasboxMessages(res.data);
        })
        .catch(err => console.error("Search fetch casbox messages error:", err));

      chatAPI.getUserChats(user.email)
        .then(res => {
          if (res.data) setAllChatRooms(Array.isArray(res.data) ? res.data : (res.data.data || []));
        })
        .catch(err => console.error("Search fetch chat rooms error:", err));
    }
  }, [searchQuery, user?.email]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (mobileSearchContainerRef.current && !mobileSearchContainerRef.current.contains(event.target)) {
        setIsMobileSearchOpen(false);
      }
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setShowDateFilterDropdown(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFolder = getActiveFolderFromPath(location.pathname);
  const folderDisplayName = getFolderDisplayName(activeFolder, labels);
  const queryVal = searchQuery.trim().toLowerCase();

  const candidateEmails = useMemo(() => {
    const folderList = typeof getFolderEmails === 'function' ? getFolderEmails(activeFolder) : [];
    const map = new Map();
    folderList.forEach(item => {
      if (!item) return;
      const uidStr = String(item.uid ?? item.id ?? '');
      if (uidStr && !map.has(uidStr)) {
        map.set(uidStr, item);
      }
    });

    return Array.from(map.values());
  }, [getFolderEmails, activeFolder]);

  const matchingEmails = useMemo(() => {
    if (!queryVal) return [];

    return candidateEmails
      .filter(e => matchesFolderScope(e, activeFolder, user))
      .filter(e => (typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true))
      .filter(e => matchesEmailQuery(e, queryVal, activeFolder, user));
  }, [candidateEmails, queryVal, activeFolder, user, matchesDateFilter]);

  const isChatScope = activeFolder === 'casbox' || activeFolder === 'chat';

  const matchingCasbox = useMemo(() => {
    // Only search chat messages when the user is explicitly in Casbox or Chat views
    if (!isChatScope || !queryVal) return [];
    const seen = new Set();
    const results = [];
    for (const m of allCasboxMessages) {
      const body = (m.body || '').toLowerCase();
      const sender = (m.senderEmail || '').toLowerCase();
      const receiver = (m.receiverEmail || '').toLowerCase();
      const subject = (m.subject || '').toLowerCase();
      if (body.includes(queryVal) || sender.includes(queryVal) || receiver.includes(queryVal) || subject.includes(queryVal)) {
        const contactEmail = m.senderEmail === user?.email ? m.receiverEmail : m.senderEmail;
        const key = `${contactEmail}_${m.id || m.body}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ ...m, contactEmail });
        }
      }
      if (results.length >= 10) break;
    }
    return results;
  }, [isChatScope, allCasboxMessages, queryVal, user?.email]);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const totalItems = matchingEmails.length + matchingCasbox.length;

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  const handleSelectEmailSuggestion = (email) => {
    if (!email) return;
    setShowSearchResults(false);
    setIsMobileSearchOpen(false);

    const isDraft = email.isDraft || email.draft || 
      email.folderName?.toLowerCase() === 'draft' || email.folderName?.toLowerCase() === 'drafts';

    if (isDraft && typeof openCompose === 'function') {
      openCompose({ draft: { ...email } });
      return;
    }

    window.dispatchEvent(new CustomEvent('bnx-open-email', {
      detail: {
        email,
        uid: email.uid !== undefined && email.uid !== null ? email.uid : email.id
      }
    }));
  };

  const handleSelectCasboxSuggestion = (message) => {
    setShowSearchResults(false);
    setIsMobileSearchOpen(false);
    const contactEmail = message.senderEmail === user?.email ? message.receiverEmail : message.senderEmail;
    navigate("/casbox", { state: { preselectContact: contactEmail } });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowSearchResults(false);
      setIsMobileSearchOpen(false);
      return;
    }

    if (!showSearchResults && searchQuery.trim().length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setShowSearchResults(true);
        return;
      }
    }

    if (totalItems === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < matchingEmails.length) {
        handleSelectEmailSuggestion(matchingEmails[selectedIndex]);
      } else if (selectedIndex >= matchingEmails.length && selectedIndex < totalItems) {
        handleSelectCasboxSuggestion(matchingCasbox[selectedIndex - matchingEmails.length]);
      } else if (matchingEmails.length > 0) {
        handleSelectEmailSuggestion(matchingEmails[0]);
      }
    }
  };
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile picture must be under 2MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingAvatar(true);
      const res = await userAPI.updateProfilePicture(formData);
      if (res.data?.success) {
        toast.success("Profile picture updated!");

        // Update user session data in localStorage so the reload picks it up
        const newUrl = res.data.data?.profilePictureUrl;
        if (newUrl && user) {
          const updatedUser = { ...user, profilePictureUrl: newUrl };

          // Update active profile
          localStorage.setItem('userProfile', JSON.stringify(updatedUser));

          // Update in sessions list
          try {
            const sessionsStr = localStorage.getItem('bnx_sessions');
            if (sessionsStr) {
              const sessions = JSON.parse(sessionsStr);
              if (user.email && sessions[user.email]) {
                sessions[user.email].userProfile = updatedUser;
                localStorage.setItem('bnx_sessions', JSON.stringify(sessions));
              }
            }
          } catch (e) {
            console.error("Failed to update sessions storage", e);
          }
        }

        if (typeof switchAccount === "function") {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile picture");
      console.error("Profile picture upload error:", error);
      toast.error(error.response?.data?.message || "Failed to upload picture", { id: toastId });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleThemeToggle = () => {
    changeTheme(currentThemeName === "Dark" ? "Classic" : "Dark");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < matchingEmails.length) {
      handleSelectEmailSuggestion(matchingEmails[selectedIndex]);
    } else if (selectedIndex >= matchingEmails.length && selectedIndex < totalItems) {
      handleSelectCasboxSuggestion(matchingCasbox[selectedIndex - matchingEmails.length]);
    } else if (matchingEmails.length > 0) {
      handleSelectEmailSuggestion(matchingEmails[0]);
    }
  };

  const renderSearchResults = (onClose) => {
    const hasEmails = matchingEmails.length > 0;
    const hasCasbox = matchingCasbox.length > 0;

    if (!hasEmails && !hasCasbox) {
      return (
        <div className="py-6 px-4 text-center select-none animate-fade-in">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
            <Search size={18} />
          </div>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            No matching emails found
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            No results in <span className="font-semibold text-gray-600 dark:text-gray-300">{folderDisplayName}</span> for &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      );
    }

    let globalItemIdx = 0;

    return (
      <div className="flex flex-col gap-2.5 py-1 animate-fade-in">
        {/* Scope Header */}
        <div className="flex items-center justify-between px-2 pt-0.5 pb-1 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500">
          <span>Search scope: <strong className="text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wide">{folderDisplayName}</strong></span>
          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">
            {matchingEmails.length} {matchingEmails.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {/* Matching Emails */}
        {hasEmails && (
          <div>
            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 px-2 select-none flex items-center justify-between">
              <span>EMAILS</span>
            </div>
            <div className="flex flex-col gap-1">
              {matchingEmails.map((e) => {
                const currentIdx = globalItemIdx++;
                const isSelected = selectedIndex === currentIdx;
                const isSentFolder = activeFolder === 'sent';
                const { name: personName, email: personEmail } = parsePersonAndEmail(
                  isSentFolder ? (e.to || e.recipientEmail) : (e.from || e.senderEmail),
                  e.senderEmail
                );
                const rawDate = e.receivedDate || e.sentDate || e.date || e.createdAt || e.timestamp;
                const dateDisplay = formatSuggestionDate(rawDate);
                const snippet = getEmailPreviewSnippet(e);

                return (
                  <div
                    key={`${e.uid || e.id || currentIdx}`}
                    onClick={() => handleSelectEmailSuggestion(e)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? "bg-blue-50/80 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 shadow-sm"
                        : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {/* Sender Profile Image / Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {e.avatarUrl ? (
                        <img
                          src={e.avatarUrl}
                          alt={personName}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs select-none">
                          {(personName || personEmail || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Email Details Body */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Sender Name + Email + Folder Badge + Date */}
                      <div className="flex items-center justify-between gap-2 min-w-0 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                            {personName}
                          </span>
                          {personEmail && personEmail !== personName && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-normal hidden sm:inline">
                              &lt;{personEmail}&gt;
                            </span>
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ml-1 shrink-0">
                            {folderDisplayName}
                          </span>
                        </div>
                        {dateDisplay && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                            {dateDisplay}
                          </span>
                        )}
                      </div>

                      {/* Middle Row: Full Subject (No unnecessary truncation) */}
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 break-words mb-1 leading-snug">
                        {e.subject || "(No Subject)"}
                      </div>

                      {/* Bottom Row: Readable Message Preview */}
                      {snippet && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed break-words">
                          {snippet}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Matching Casbox Messages */}
        {hasCasbox && (
          <div className="mt-1 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2 select-none flex items-center justify-between">
              <span>{t('navbar.casbox_chat', 'Casbox Chat')}</span>
              <span className="text-[9px] font-semibold text-gray-400">{matchingCasbox.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {matchingCasbox.map((m) => {
                const currentIdx = globalItemIdx++;
                const isSelected = selectedIndex === currentIdx;
                const contactEmail = m.contactEmail;
                const contactName = contactEmail?.split('@')[0] || "Contact";

                return (
                  <div
                    key={m.id || currentIdx}
                    onClick={() => handleSelectCasboxSuggestion(m)}
                    className={`flex flex-col p-2.5 rounded-xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 shadow-sm"
                        : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0 mb-0.5">
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {contactName}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-purple-100/60 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 shrink-0">
                        Chat
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate italic">
                      &ldquo;{m.body}&rdquo;
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      className="sticky top-0 z-50 px-2 sm:px-4 lg:px-5 py-2 sm:py-2.5 transition-colors duration-300 shrink-0 shadow-md w-full relative"
      style={{ backgroundColor: backgroundImage ? "transparent" : "#195bac" }}
    >
      <div className="flex items-center justify-between w-full relative gap-1.5 sm:gap-3">
        {/* LEFT */}
        <div className="flex items-center shrink-0">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={onOpenMenu}
            className="p-1 sm:p-1.5 mr-1.5 sm:mr-2 rounded-lg text-white hover:bg-white/10 md:hidden cursor-pointer shrink-0"
            title="Open Menu"
          >
            <MdMenu size={22} />
          </button>

          {/* Logo & Brand Name */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 shrink-0 transition-all duration-300 ${
              isDesktopSidebarOpen
                ? "md:w-[14.1875rem] lg:w-[13.9375rem]"
                : "w-auto mr-2 sm:mr-4"
            }`}
          >
            <img
              src={logo}
              alt="BNX Mail"
              className="h-7 sm:h-9 cursor-pointer drop-shadow-sm transition-transform hover:scale-105 bg-white rounded-lg shrink-0"
              onClick={() => onToggleDesktopSidebar()}
            />
            <span
              onClick={() => onToggleDesktopSidebar()}
              className="text-base sm:text-lg lg:text-xl font-bold tracking-tight cursor-pointer hover:opacity-90 transition-opacity text-white hidden sm:block select-none"
            >
              BNX<span className="font-normal text-white/90">mail</span>
            </span>
          </div>

          {/* COMPOSE */}
          <button
            onClick={() => openCompose(currentTab === 'chat' ? { mode: 'chat' } : { mode: 'mail' })}
            className={`h-8 sm:h-9 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-full font-semibold shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-white dark:bg-[#303134] border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 shrink-0 cursor-pointer select-none ${
              !isDesktopSidebarOpen ? "ml-1 sm:ml-2" : ""
            }`}
            title={t('navbar.compose', t('common.compose', 'Compose'))}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: theme.accent || "#135bec" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-xs sm:text-[13px] font-semibold leading-none whitespace-nowrap">{t('navbar.compose', t('common.compose', 'Compose'))}</span>
          </button>
        </div>

        {/* CENTER: SEGMENTED CONTROL */}
        <div className="flex items-center justify-center shrink-0">
          <div className="flex items-center bg-white/10 backdrop-blur-sm shadow-sm rounded-full p-0.5 sm:p-1 border border-white/10 shrink-0">
            <button
              onClick={() => navigate('/inbox')}
              className={`px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none ${currentTab === 'mail' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            >
              {t('navbar.mail', 'Mail')}
            </button>
            <button
              onClick={() => navigate('/casbox')}
              className={`px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none ${currentTab === 'chat' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            >
              {t('navbar.casbox', 'Casbox')}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-2.5 shrink-0">

          {/* DESKTOP SEARCH (md+ screens) */}
          <form onSubmit={handleSearch} className="hidden md:flex shrink items-center w-36 lg:w-48 xl:w-56 focus-within:w-48 lg:focus-within:w-64 xl:focus-within:w-72 transition-all duration-200" ref={searchContainerRef}>
            <div className="relative group w-full">
              <input
                id="mail-search-input"
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchResults(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`${t('navbar.search_placeholder', 'Search')} ${folderDisplayName}...`}
                className="w-full px-2 py-1.5 pl-7 sm:pl-8 pr-7 rounded-full text-xs placeholder:text-white/60 focus:placeholder:text-white/60 bg-white/10 hover:bg-white/20 focus:bg-white/20 active:bg-white/20 focus-visible:bg-white/20 text-white focus:text-white focus:shadow-sm border border-transparent focus:border-white/30 outline-none transition-all duration-200 truncate placeholder:truncate"
              />
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors text-white/60 group-focus-within:text-white/90 pointer-events-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}

              {showSearchResults && searchQuery.trim().length > 0 && (
                <div 
                  className="absolute right-0 mt-2 bg-white dark:bg-gray-900 border shadow-2xl rounded-2xl p-2.5 sm:p-3 max-h-[500px] sm:max-h-[540px] overflow-y-auto z-[9999] w-[360px] sm:w-[460px] md:w-[520px] max-w-[95vw] animate-fade-in"
                  style={{ borderColor: theme.border || '#e2e8f0' }}
                >
                  {renderSearchResults(() => setShowSearchResults(false))}
                </div>
              )}
            </div>
          </form>

          {/* MOBILE SEARCH ICON BUTTON & DROPDOWN (< md screens) */}
          <div className="relative md:hidden shrink-0" ref={mobileSearchContainerRef}>
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(prev => !prev);
                if (!isMobileSearchOpen) {
                  setTimeout(() => mobileInputRef.current?.focus(), 50);
                }
              }}
              className={`p-1.5 sm:p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isMobileSearchOpen
                  ? "bg-white/20 text-white shadow-sm border border-white/30"
                  : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10"
              }`}
              title={t('navbar.search_mail', 'Search mail')}
              aria-label="Search"
              aria-expanded={isMobileSearchOpen}
            >
              <Search size={16} className="text-white" />
            </button>

            {isMobileSearchOpen && (
              <div 
                className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-80 max-w-[360px] bg-white dark:bg-gray-900 border shadow-2xl rounded-2xl p-2.5 z-[9999] animate-fade-in"
                style={{ borderColor: theme.border || '#e2e8f0' }}
              >
                <form onSubmit={handleSearch} className="relative flex items-center w-full">
                  <input
                    ref={mobileInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`${t('navbar.search_placeholder', 'Search')} ${folderDisplayName}...`}
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-1.5 focus:ring-blue-500 border border-transparent"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </form>

                {searchQuery.trim().length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 max-h-[420px] overflow-y-auto">
                    {renderSearchResults(() => setIsMobileSearchOpen(false))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DATE FILTER (Mail section only) */}
          {currentTab === 'mail' && (
            <div className="relative shrink-0" ref={dateFilterRef}>
              <button
                type="button"
                onClick={() => setShowDateFilterDropdown((prev) => !prev)}
                className={`p-1.5 sm:p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                  showDateFilterDropdown || (dateFilter && dateFilter !== "ALL")
                    ? "bg-white/20 text-white shadow-sm border border-white/30"
                    : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10"
                }`}
                title={t('navbar.filter_by_date', 'Filter by date')}
                aria-label="Filter by date"
                aria-expanded={showDateFilterDropdown}
              >
                <SlidersHorizontal size={17} className="text-white" />
                {dateFilter && dateFilter !== "ALL" && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#195bac]" />
                )}
              </button>

              {showDateFilterDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 sm:w-52 rounded-2xl shadow-xl border z-50 overflow-hidden animate-fade-in bg-white dark:bg-gray-900 py-1.5 px-1.5"
                  style={{ borderColor: theme.border || "#e2e8f0" }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 select-none">
                    <Calendar size={15} className="text-gray-500 dark:text-gray-400 shrink-0" />
                    <span>{t('navbar.filter_by_date', 'Filter by date')}</span>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {[
                      { id: "ALL", label: t('navbar.all_time', 'All Time') },
                      { id: "1_DAY", label: t('navbar.last_1_day', 'Last 1 Day') },
                      { id: "1_WEEK", label: t('navbar.last_1_week', 'Last 1 Week') },
                      { id: "1_MONTH", label: t('navbar.last_1_month', 'Last 1 Month') },
                      { id: "CUSTOM", label: t('navbar.custom_date', 'Custom Date'), isCustom: true },
                    ].map((opt) => {
                      const isSelected = (dateFilter || "ALL") === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (opt.isCustom) {
                              setShowDateFilterDropdown(false);
                              setShowCustomCalendar(true);
                            } else {
                              setDateFilter(opt.id);
                              if (setCustomDateRange) setCustomDateRange(null);
                              setShowDateFilterDropdown(false);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Calendar
                              size={15}
                              className={`shrink-0 ${
                                isSelected
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            />
                            <span className="truncate">{opt.label}</span>
                          </div>
                          {isSelected ? (
                            <Check size={15} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                          ) : opt.isCustom ? (
                            <ChevronRight size={15} className="text-gray-400 shrink-0 ml-2" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* USER */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 sm:pr-2.5 lg:pr-3 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-transparent hover:border-white/20 cursor-pointer"
            >
              {user?.profilePictureUrl ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || "https://api.bnxmail.com"}${user.profilePictureUrl}`}
                  alt="Profile"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shadow-sm border border-white/20 shrink-0"
                />
              ) : (
                <div
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-white font-semibold shadow-sm shrink-0 text-xs sm:text-sm bg-[#135bec]"
                >
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="hidden lg:flex items-center gap-1.5">
                <span
                  className="text-[13px] font-medium truncate max-w-[80px] xl:max-w-[110px] text-white"
                >
                  {user?.email?.split('@')[0] || "User"}
                </span>
                {isPrimary && (
                  <MdCheckCircle className="text-white shrink-0" size={13} title={t('navbar.primary_account', 'Primary Account')} />
                )}
              </div>
              <svg
                className="h-3.5 w-3.5 hidden lg:block opacity-80 text-white shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div
                className="absolute right-0 mt-3 w-[290px] sm:w-[310px] max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-xl dark:shadow-soft-dark border z-50 overflow-hidden animate-fade-in bg-white dark:bg-gray-900"
                style={{ borderColor: theme.border }}
              >
                {/* Active User Large Header */}
                <div className="flex flex-col items-center px-5 py-5 border-b text-center relative" style={{ borderColor: theme.border }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleProfilePictureUpload}
                  />

                  <div className="relative inline-block group cursor-pointer mb-2.5" onClick={() => fileInputRef.current?.click()}>
                    {user?.profilePictureUrl ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || "https://api.bnxmail.com"}${user.profilePictureUrl}`}
                        alt={user?.username}
                        className={`w-16 h-16 rounded-full object-cover border-2 border-primary/20 ${uploadingAvatar ? 'opacity-50' : 'group-hover:opacity-80 transition-opacity'}`}
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-sm ${uploadingAvatar ? 'opacity-50' : 'group-hover:opacity-90 transition-opacity'}`} style={{ backgroundColor: theme.accent || "#135bec" }}>
                        {(user?.username || user?.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MdPhotoCamera size={24} className="text-white" />
                    </div>

                    {/* Mini Camera Badge always visible */}
                    <div className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
                      <MdPhotoCamera size={14} />
                    </div>
                  </div>

                  <p className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
                    {user?.username || "User"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-full">
                    {user?.email}
                  </p>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      const token = localStorage.getItem("accessToken") || "";
                      window.open(`https://account.beta-softnet.com/security?token=${encodeURIComponent(token)}`, "_blank");
                    }}
                    className="mt-3 px-3.5 py-1.5 border rounded-full text-[11px] font-bold hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all cursor-pointer flex items-center gap-1.5"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    <MdManageAccounts size={15} /> {t('navbar.manage_accounts', 'Manage your account')}
                  </button>
                </div>

                {/* Other Accounts List */}
                {otherSessions.length > 0 && (
                  <div className="max-h-[150px] overflow-y-auto border-b" style={{ borderColor: theme.border }}>
                    {otherSessions.map((sess) => (
                      <div
                        key={sess.email}
                        onClick={() => {
                          setShowDropdown(false);
                          switchAccount(sess.email);
                        }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all border-b last:border-b-0 dark:border-gray-800/30"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {sess.profilePictureUrl ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL || "https://api.bnxmail.com"}${sess.profilePictureUrl}`}
                              alt={sess.username}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: theme.accent || "#135bec" }}>
                              {(sess.username || sess.email || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="truncate text-left">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight truncate">
                              {sess.username}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {sess.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="p-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      localStorage.removeItem("tempToken");
                      navigate("/login");
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-3 font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <MdPersonAdd size={18} className="text-gray-400" /> {t('navbar.add_account', 'Add another account')}
                  </button>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-3 font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <MdLogout size={18} className="text-gray-400" /> {t('navbar.logout', 'Sign out of this account')}
                  </button>
                </div>

                <div className="border-t p-1" style={{ borderColor: theme.border }}>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logoutAll();
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-3 font-bold"
                  >
                    <MdLogout size={18} className="text-red-400" /> {t('navbar.sign_out_all', 'Sign out of all accounts')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-[1px] bg-white/20 ml-0.5 sm:ml-1 hidden sm:block shrink-0" />
          <button
            onClick={onToggleBitToolSidebar}
            className="h-8 sm:h-9 px-1.5 sm:px-2 rounded-full bg-white dark:hover:bg-white/10 transition-colors flex items-center justify-center shrink-0 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer"
            title={t('navbar.bit_tools', 'Toggle BIT Tools')}
          >
            <img
              src={bitToolLogo}
              alt="BIT Tool"
              className="h-4 sm:h-5 object-contain opacity-80 hover:opacity-100"
            />
          </button>
        </div>
      </div>
      <CustomDateRangeModal
        isOpen={showCustomCalendar}
        onClose={() => setShowCustomCalendar(false)}
        initialRange={customDateRange}
        onApply={(range) => {
          setDateFilter("CUSTOM");
          if (setCustomDateRange) setCustomDateRange(range);
          setShowCustomCalendar(false);
          setShowDateFilterDropdown(false);
        }}
      />
    </nav>
  );
};

export default NavBar;
