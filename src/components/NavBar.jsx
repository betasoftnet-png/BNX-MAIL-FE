import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { MdSettings, MdEmail, MdLogout, MdLightMode, MdDarkMode, MdNotifications, MdCheckCircle, MdManageAccounts, MdPersonAdd, MdPhotoCamera, MdMenu, MdAdd, MdApps, MdOutlineNoteAlt } from "react-icons/md";
import { userAPI, casboxAPI, chatAPI } from "../services/api";
import toast from "react-hot-toast";
import { SlidersHorizontal, Calendar, Check, ChevronRight } from "lucide-react";
// import logo from "../assets/bnx.jpeg";

import logo from "../assets/bnx-remove.png";
import bitToolLogo from "../assets/BIT-TOOL-2.png";
import AppLauncher from "./AppLauncher";
import CustomDateRangeModal from "./CustomDateRangeModal";

const NavBar = ({ searchQuery, setSearchQuery, onOpenMenu, onToggleDesktopSidebar, onToggleBitToolSidebar, onOpenNotes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, logoutAll, switchAccount, getSessions } = useAuth();
  const { theme, currentThemeName, changeTheme, backgroundImage } = useTheme();
  const { openCompose, emails, dateFilter, setDateFilter, customDateRange, setCustomDateRange, matchesDateFilter } = useMail();
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
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setShowDateFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryVal = searchQuery.trim().toLowerCase();

  const matchingEmails = queryVal
    ? (emails || []).filter(e => (typeof matchesDateFilter === 'function' ? matchesDateFilter(e) : true)).filter(e => 
        e.subject?.toLowerCase().includes(queryVal) ||
        e.from?.toLowerCase().includes(queryVal) ||
        e.senderEmail?.toLowerCase().includes(queryVal) ||
        e.to?.toLowerCase().includes(queryVal) ||
        e.recipientEmail?.toLowerCase().includes(queryVal) ||
        e.body?.toLowerCase().includes(queryVal) ||
        e.textPlain?.toLowerCase().includes(queryVal)
      ).slice(0, 5)
    : [];

  const matchingCasbox = queryVal
    ? allCasboxMessages.filter(m => 
        m.body?.toLowerCase().includes(queryVal) ||
        m.senderEmail?.toLowerCase().includes(queryVal) ||
        m.receiverEmail?.toLowerCase().includes(queryVal) ||
        m.subject?.toLowerCase().includes(queryVal)
      ).slice(0, 5)
    : [];

  const matchingChats = queryVal
    ? allChatRooms.filter(c => {
        const chatPartner = c.memberEmails?.find(e => e !== user?.email) || "";
        const chatName = c.type === 'DIRECT' ? chatPartner?.split('@')[0] : (c.name || `Chat #${c.id}`);
        return (
          chatName.toLowerCase().includes(queryVal) ||
          c.memberEmails?.some(email => email.toLowerCase().includes(queryVal))
        );
      }).slice(0, 5)
    : [];
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
    console.log("Searching:", searchQuery);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className="sticky top-0 z-50 px-2 sm:px-5 py-2.5 transition-colors duration-300 shrink-0 shadow-md w-full relative"
      style={{ backgroundColor: backgroundImage ? "transparent" : "#195bac" }}
    >
      <div className="flex items-center justify-between w-full relative gap-2 sm:gap-4">
        {/* LEFT */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 shrink-0 min-w-0">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={onOpenMenu}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 md:hidden cursor-pointer shrink-0"
            title="Open Menu"
          >
            <MdMenu size={24} />
          </button>

          <div className="flex items-center gap-2 pl-1 sm:pl-2 shrink-0">
            <img
              src={logo}
              alt="BNX Mail"
              className="h-8 sm:h-10 cursor-pointer drop-shadow-sm transition-transform hover:scale-105 bg-white rounded-lg shrink-0"
              onClick={() => onToggleDesktopSidebar()}
            />
            <span
              onClick={() => onToggleDesktopSidebar()}
              className="text-lg sm:text-xl font-bold tracking-tight cursor-pointer hover:opacity-90 transition-opacity text-white hidden sm:block select-none"
            >
              BNX<span className="font-normal text-white/90">mail</span>
            </span>
          </div>

          {/* COMPOSE (Hidden on mobile/tablet, shown as floating button instead) */}
          <button
            onClick={() => openCompose(currentTab === 'chat' ? { mode: 'chat' } : { mode: 'mail' })}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 md:px-4 py-1.5 rounded-full font-semibold shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-white dark:bg-[#303134] border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 ml-1.5 sm:ml-3 md:ml-6 lg:ml-10 xl:ml-16 shrink-0 cursor-pointer"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: theme.accent || "#135bec" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-[13px]">{t('navbar.compose', t('common.compose', 'Compose'))}</span>
          </button>
        </div>

        {/* CENTER: SEGMENTED CONTROL */}
        <div className="flex items-center bg-white/10 backdrop-blur-sm shadow-sm rounded-full p-1 border border-white/10 shrink-0 mx-auto translate-x-2 sm:translate-x-6 md:translate-x-10 lg:translate-x-14">
          <button
            onClick={() => navigate('/inbox')}
            className={`px-3 sm:px-5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${currentTab === 'mail' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            {t('navbar.mail', 'Mail')}
          </button>
          <button
            onClick={() => navigate('/casbox')}
            className={`px-3 sm:px-5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${currentTab === 'chat' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            {t('navbar.casbox', 'Casbox')}
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 min-w-0">

          {/* SEARCH */}
          <form onSubmit={handleSearch} className="flex shrink items-center min-w-[80px] w-20 sm:w-28 md:w-32 lg:w-40 focus-within:w-28 sm:focus-within:w-36 md:focus-within:w-40 lg:focus-within:w-48 transition-all duration-200" ref={searchContainerRef}>
            <div className="relative group w-full">
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchResults(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                placeholder={t('navbar.search_placeholder', 'Search mail...')}
                className="w-full px-2 py-1 pl-6 sm:pl-7.5 rounded-full text-xs placeholder:text-white/60 focus:placeholder:text-white/60 bg-white/10 hover:bg-white/20 focus:bg-white/20 active:bg-white/20 focus-visible:bg-white/20 text-white focus:text-white focus:shadow-sm border border-transparent focus:border-white/30 outline-none transition-all duration-200 truncate placeholder:truncate"
              />
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors text-white/60 group-focus-within:text-white/90 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              {showSearchResults && searchQuery.trim().length > 0 && (
                <div 
                  className="absolute right-0 mt-2 bg-white dark:bg-gray-800 border shadow-2xl rounded-2xl p-3 max-h-96 overflow-y-auto z-[999] w-[280px] sm:w-[320px] max-w-[90vw]"
                  style={{ borderColor: theme.border || '#e2e8f0' }}
                >
                  {/* Matching Emails */}
                  {matchingEmails.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2 select-none">
                        {t('navbar.emails_category', t('storage.emails', 'Emails'))}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {matchingEmails.map(e => (
                          <div
                            key={e.uid}
                            onClick={() => {
                              setSearchQuery(e.subject);
                              setShowSearchResults(false);
                              navigate("/all-mail");
                            }}
                            className="flex flex-col p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left transition-colors"
                          >
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{e.subject}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{e.from}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Casbox Messages */}
                  {matchingCasbox.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2 select-none">
                        {t('navbar.casbox_chat', 'Casbox Chat')}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {matchingCasbox.map(m => {
                          const contactEmail = m.senderEmail === user?.email ? m.receiverEmail : m.senderEmail;
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                navigate("/casbox", { state: { preselectContact: contactEmail } });
                              }}
                              className="flex flex-col p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left transition-colors"
                            >
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{contactEmail.split('@')[0]}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-450 truncate italic">"{m.body}"</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Colab Chats */}
                  {matchingChats.length > 0 && (
                    <div className="mb-1">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2 select-none">
                        {t('navbar.colab_rooms', 'Colab Rooms')}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {matchingChats.map(c => {
                          const chatPartner = c.memberEmails?.find(e => e !== user?.email) || "";
                          const chatName = c.type === 'DIRECT' ? chatPartner?.split('@')[0] : (c.name || `Chat #${c.id}`);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setShowSearchResults(false);
                                navigate(`/chat/${c.id}`, { state: { chat: c } });
                              }}
                              className="flex flex-col p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left transition-colors"
                            >
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{chatName}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold">{c.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {matchingEmails.length === 0 && matchingCasbox.length === 0 && matchingChats.length === 0 && (
                    <div className="text-xs text-gray-400 dark:text-gray-600 text-center py-4 select-none">
                      {t('navbar.no_matching_results', 'No matching results found')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>

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
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 pr-3 rounded-full bg-white/10 hover:bg-white/10 transition-all border border-transparent hover:border-white/20"
            >
              {user?.profilePictureUrl ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || "https://api.bnxmail.com"}${user.profilePictureUrl}`}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover shadow-sm border border-white/20 shrink-0"
                />
              ) : (
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold shadow-sm shrink-0 text-sm bg-[#135bec]"
                >
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="hidden md:flex items-center gap-1.5">
                <span
                  className="text-[13px] font-medium truncate max-w-[100px] text-white"
                >
                  {user?.email?.split('@')[0] || "User"}
                </span>
                {isPrimary && (
                  <MdCheckCircle className="text-white shrink-0" size={13} title={t('navbar.primary_account', 'Primary Account')} />
                )}
              </div>
              <svg
                className="h-3.5 w-3.5 hidden md:block opacity-80 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div
                className="absolute -right-12 sm:right-0 mt-3 w-[300px] sm:w-[310px] max-w-[95vw] rounded-2xl shadow-xl dark:shadow-soft-dark border z-50 overflow-hidden animate-fade-in bg-white dark:bg-gray-900"
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

                  {/* <button
                    onClick={() => { setShowDropdown(false); navigate("/settings"); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-3 font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <MdSettings size={18} className="text-gray-400" /> Settings
                  </button> */}

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


          <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-700 ml-1 mr-[-10px] hidden sm:block" />
          <button
            onClick={onToggleBitToolSidebar}
            className="relative left-2 h-9 p-1 px-2 rounded-full bg-white dark:hover:bg-white/10 transition-colors flex items-center justify-center shrink-0 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            title={t('navbar.bit_tools', 'Toggle BIT Tools')}
          >
            <img
              src={bitToolLogo}
              alt="BIT Tool"
              className="h-5 object-contain opacity-80 group-hover:opacity-100"
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

