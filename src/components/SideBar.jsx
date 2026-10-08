import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SIDEBAR_ITEMS } from "../Data/constants";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import StorageWidget from './StorageWidget';
import { 
  Mail, 
  Star, 
  Clock, 
  Send, 
  FileText, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Settings, 
  HelpCircle,
  Layers,
  Calendar,
  AlertOctagon,
  Inbox as LucideInbox,
  Archive,
  BarChart2,
  Bookmark,
  Database
} from "lucide-react";
import { 
  MdLabel, 
  MdClose, 
  MdDelete, 
  MdMoreVert, 
  MdEdit, 
  MdGroup, 
  MdChat, 
  MdCloudUpload 
} from "react-icons/md";

const SideBar = ({ isDesktopOpen, isMobileOpen, onCloseMobile, onOpenNotes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, backgroundImage, sidebarPreferences } = useTheme();
  const { unreadCounts, labels, handleCreateLabel, handleUpdateLabel, handleDeleteLabel } = useMail();
  const { user, getSessions } = useAuth();

  const handleNavigation = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const isChatMode = location.pathname.startsWith("/colab") || location.pathname.startsWith("/chat") || location.pathname.startsWith("/casbox");
  const isVaultMode = location.pathname.startsWith("/vault");

  const [isCreating, setIsCreating] = useState(false);
  const [onLabelCreatedCb, setOnLabelCreatedCb] = useState(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeLabelMenu, setActiveLabelMenu] = useState(null);
  const [newLabel, setNewLabel] = useState({ name: "", color: "#135bec", parentId: "" });
  const [editingLabel, setEditingLabel] = useState(null);
  const labelMenuRef = useRef(null);

  const getItemLabel = (name) => {
    switch (name) {
      case 'All Inbox': return t('sidebar.all_inbox', 'All Inbox');
      case 'Inbox': return t('sidebar.inbox', 'Inbox');
      case 'Analytics': return t('sidebar.analytics', 'Analytics');
      case 'Starred': return t('sidebar.starred', 'Starred');
      case 'Sent': return t('sidebar.sent', 'Sent');
      case 'Draft':
      case 'Drafts': return t('sidebar.draft', t('sidebar.drafts', 'Drafts'));
      case 'Snoozed': return t('sidebar.snoozed', 'Snoozed');
      case 'Scheduled': return t('sidebar.scheduled', 'Scheduled');
      case 'Archive': return t('sidebar.archive', 'Archive');
      case 'Spam': return t('sidebar.spam', 'Spam');
      case 'Trash': return t('sidebar.trash', 'Trash');
      case 'Unread': return t('sidebar.unread', 'Unread');
      case 'All Mail': return t('sidebar.all_mail', 'All Mail');
      case 'Templates': return t('sidebar.templates', 'Templates');
      case 'Colab': return t('sidebar.colab', 'Colab');
      case 'Chat': return t('sidebar.chat', 'Chat');
      case 'Mail Backup': return t('sidebar.mail_backup', 'Mail Backup');
      case 'Groups': return t('sidebar.groups', 'Groups');
      case 'Chat Room': return t('sidebar.chat_room', 'Chat Room');
      case 'Casbox': return t('sidebar.casbox', 'Casbox');
      case 'Vault': return t('sidebar.vault', 'Vault');
      case 'Storage Management': return t('sidebar.storage_management', 'Storage Management');
      case 'Subscriptions': return t('sidebar.subscriptions', 'Subscriptions');
      case 'Notification':
      case 'NotifyHub': return t('sidebar.notification', 'Notifications');
      case 'Settings': return t('sidebar.settings', 'Settings');
      case 'Support & Help': return t('sidebar.support', 'Support & Help');
      default: return name;
    }
  };

  const getNavIcon = (name, isActive) => {
    const iconClass = `shrink-0 transition-colors ${
      isActive ? "text-[#1a56db] dark:text-blue-400" : "text-[#2d3f59] dark:text-slate-300"
    }`;
    const strokeWidth = isActive ? 2.2 : 1.8;

    switch (name) {
      case 'Inbox':
        return <Mail size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Starred':
        return <Star size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Snoozed':
        return <Clock size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Sent':
        return <Send size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Draft':
      case 'Drafts':
        return <FileText size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Trash':
        return <Trash2 size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'All Inbox':
        return <Layers size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Scheduled':
        return <Calendar size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Spam':
        return <AlertOctagon size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'All Mail':
        return <LucideInbox size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Archive':
        return <Archive size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Unread':
        return <Mail size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Templates':
        return <FileText size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Analytics':
        return <BarChart2 size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Subscriptions':
        return <Bookmark size={19} strokeWidth={strokeWidth} className={iconClass} />;
      case 'Mail Backup':
        return <Database size={19} strokeWidth={strokeWidth} className={iconClass} />;
      default:
        return <Mail size={19} strokeWidth={strokeWidth} className={iconClass} />;
    }
  };

  useEffect(() => {
    const handleOpenLabelModal = (e) => {
      setIsCreating(true);
      if (e.detail?.onSuccess) {
        setOnLabelCreatedCb(() => e.detail.onSuccess);
      }
    };
    window.addEventListener('openLabelCreateModal', handleOpenLabelModal);
    return () => window.removeEventListener('openLabelCreateModal', handleOpenLabelModal);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (labelMenuRef.current && !labelMenuRef.current.contains(event.target)) {
        setActiveLabelMenu(null);
      }
    };
    if (activeLabelMenu) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [activeLabelMenu]);

  const COLORS = ["#135bec", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

  const handleAddLabel = async () => {
    if (!newLabel.name.trim()) return;
    const parentId = newLabel.parentId ? parseInt(newLabel.parentId) : null;
    const newLbl = await handleCreateLabel(newLabel.name, newLabel.color, parentId);
    if (newLbl) {
      if (onLabelCreatedCb) {
        onLabelCreatedCb(newLbl.id);
        setOnLabelCreatedCb(null);
      }
      setIsCreating(false);
      setNewLabel({ name: "", color: "#135bec", parentId: "" });
    }
  };

  const handleEditLabelSubmit = async () => {
    if (!editingLabel.name.trim()) return;
    const parentId = editingLabel.parentId ? parseInt(editingLabel.parentId) : null;
    const success = await handleUpdateLabel(editingLabel.id, editingLabel.name, editingLabel.color, parentId);
    if (success) {
      setEditingLabel(null);
    }
  };

  const mainNavItems = ["Inbox", "Starred", "Snoozed", "Sent", "Draft", "Trash"];

  const moreNavItems = ["All Inbox", "Scheduled", "Spam", "All Mail", "Archive", "Unread", "Templates", "Analytics", "Subscriptions", "Mail Backup"]
    .filter(name => name !== "All Inbox" || (getSessions && getSessions().length > 1));

  return (
    <>
      <aside
        className={`
          h-full overflow-y-auto flex flex-col transition-all duration-300 shrink-0 border-r-0 hidden-scrollbar
          flex relative translate-x-0 sidebar-wrapper
          ${!isDesktopOpen ? "sidebar-collapsed" : "md:w-56"}
          ${isMobileOpen ? "sidebar-mobile-open" : ""}
        `}
        style={{ backgroundColor: isMobileOpen ? undefined : (backgroundImage ? "transparent" : (theme.sidebarBg || theme.bg || "#f0f5fc")) }}
      >

        {/* NAVIGATION */}
        <nav className="flex-1 flex flex-col pr-0 pt-4 pb-2 space-y-1 overflow-y-auto hidden-scrollbar">
          {/* VAULT MODE */}
          {isVaultMode ? (
            <div className="flex flex-col px-2 mt-2">
              <button
                onClick={() => handleNavigation('/vault')}
                className="w-full flex items-center px-3.5 py-2.5 rounded-2xl transition-all duration-200 group cursor-pointer btn-collapse bg-[#dce9fd] dark:bg-blue-900/30 text-[#1a56db] dark:text-blue-400 font-semibold relative"
              >
                <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#1a56db] dark:bg-blue-500 rounded-full" />
                <div className="w-5 flex items-center justify-center shrink-0">
                  <MdCloudUpload size={19} className="text-[#1a56db] dark:text-blue-400 shrink-0" />
                </div>
                <span className="ml-3.5 text-sm font-semibold hide-on-collapse">{t('sidebar.my_vault', 'My Vault')}</span>
              </button>
            </div>
          ) : !isChatMode ? (
            /* MAIN NAV: Inbox, Starred, Snoozed, Sent, Draft, Trash */
            <>
              {mainNavItems
                .map(name => SIDEBAR_ITEMS.find(item => item.name === name))
                .filter(Boolean)
                .filter(item => sidebarPreferences?.[item.name] !== false)
                .map((item) => {
                  const isActive = location.pathname === item.path || (location.pathname === "/" && item.path === "/inbox");
                  const unreadKey = item.name.toLowerCase().replace(' ', '').replace('-', '');
                  const count = unreadCounts[unreadKey] || 0;

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-[calc(100%-16px)] mx-2 my-0.5 flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-150 group cursor-pointer btn-collapse relative shrink-0 ${
                        isActive
                          ? "bg-[#dce9fd] dark:bg-blue-900/30"
                          : "hover:bg-blue-50/70 dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Active indicator bar on far-left edge */}
                      {isActive && (
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#1a56db] dark:bg-blue-500 rounded-full" />
                      )}

                      <div className="flex items-center min-w-0 flex-1">
                        {/* Icon aligned strictly in column */}
                        <div className="w-5 flex items-center justify-center shrink-0">
                          {getNavIcon(item.name, isActive)}
                        </div>
                        {/* Label */}
                        <span
                          className={`ml-3.5 text-[14px] truncate whitespace-nowrap hide-on-collapse ${
                            isActive
                              ? "text-[#1a56db] dark:text-blue-400 font-semibold"
                              : "text-[#2d3f59] dark:text-slate-200 font-medium"
                          }`}
                        >
                          {getItemLabel(item.name)}
                        </span>
                      </div>

                      {/* Unread badge on the right */}
                      {count > 0 && (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full hide-on-collapse font-sans shrink-0 ${
                            isActive
                              ? "bg-[#cfe2fe] dark:bg-blue-900/50 text-[#1a56db] dark:text-blue-300 font-bold"
                              : "bg-blue-100/80 dark:bg-gray-700 text-[#1a56db] dark:text-blue-300 font-semibold"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

              {/* MORE DROPDOWN ITEM */}
              {moreNavItems.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                    className="w-[calc(100%-16px)] mx-2 my-0.5 flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-blue-50/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer group btn-collapse shrink-0"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="w-5 flex items-center justify-center shrink-0">
                        {isMoreOpen ? (
                          <ChevronUp size={19} strokeWidth={1.8} className="text-[#2d3f59] dark:text-slate-300" />
                        ) : (
                          <ChevronDown size={19} strokeWidth={1.8} className="text-[#2d3f59] dark:text-slate-300" />
                        )}
                      </div>
                      <span className="ml-3.5 text-[14px] font-medium text-[#2d3f59] dark:text-slate-200 hide-on-collapse">
                        {isMoreOpen ? t('sidebar.less', 'Less') : t('sidebar.more', 'More')}
                      </span>
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isMoreOpen && (
                    <div className="mt-0.5 space-y-0.5 animate-fade-in origin-top">
                      {moreNavItems
                        .map(name => SIDEBAR_ITEMS.find(item => item.name === name))
                        .filter(Boolean)
                        .filter(item => sidebarPreferences?.[item.name] !== false)
                        .map((item) => {
                          const isActive = location.pathname === item.path;
                          const unreadKey = item.name === "NotifyHub" ? "notification" : item.name.toLowerCase().replace(' ', '').replace('-', '');
                          const count = unreadCounts[unreadKey] || 0;

                          return (
                            <button
                              key={item.name}
                              onClick={() => handleNavigation(item.path)}
                              className={`w-[calc(100%-16px)] mx-2 my-0.5 flex items-center justify-between px-3.5 py-2 rounded-xl transition-all duration-150 group cursor-pointer btn-collapse relative shrink-0 ${
                                isActive
                                  ? "bg-[#dce9fd] dark:bg-blue-900/30"
                                  : "hover:bg-blue-50/70 dark:hover:bg-white/[0.04]"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#1a56db] dark:bg-blue-500 rounded-full" />
                              )}
                              <div className="flex items-center min-w-0 flex-1">
                                <div className="w-5 flex items-center justify-center shrink-0">
                                  {getNavIcon(item.name, isActive)}
                                </div>
                                <span
                                  className={`ml-3.5 text-[14px] truncate whitespace-nowrap hide-on-collapse ${
                                    isActive
                                      ? "text-[#1a56db] dark:text-blue-400 font-semibold"
                                      : "text-[#2d3f59] dark:text-slate-200 font-medium"
                                  }`}
                                >
                                  {getItemLabel(item.name)}
                                </span>
                              </div>

                              {count > 0 && (
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full hide-on-collapse font-sans shrink-0 ${
                                    isActive
                                      ? "bg-[#cfe2fe] dark:bg-blue-900/50 text-[#1a56db] dark:text-blue-300 font-bold"
                                      : "bg-blue-100/80 dark:bg-gray-700 text-[#1a56db] dark:text-blue-300 font-semibold"
                                  }`}
                                >
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* CHAT MODE: Casbox & Colab */
            <div className="flex flex-col px-2 mt-1 space-y-1">
              <button
                onClick={() => handleNavigation('/casbox')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl transition-all duration-200 group cursor-pointer btn-collapse relative ${
                  location.pathname.startsWith('/casbox')
                    ? "bg-[#dce9fd] dark:bg-blue-900/30 text-[#1a56db] dark:text-blue-400 font-semibold"
                    : "hover:bg-blue-50/70 dark:hover:bg-white/[0.04] text-[#2d3f59] dark:text-slate-200 font-medium"
                }`}
              >
                {location.pathname.startsWith('/casbox') && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#1a56db] dark:bg-blue-500 rounded-full" />
                )}
                <div className="w-5 flex items-center justify-center shrink-0">
                  <MdChat size={19} className="shrink-0" />
                </div>
                <span className="ml-3.5 text-sm hide-on-collapse text-left flex-1">{t('sidebar.casbox', 'Casbox')}</span>
              </button>

              <button
                onClick={() => handleNavigation('/colab')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl transition-all duration-200 group cursor-pointer btn-collapse relative ${
                  location.pathname.startsWith('/colab') || location.pathname.startsWith('/chat')
                    ? "bg-[#dce9fd] dark:bg-blue-900/30 text-[#1a56db] dark:text-blue-400 font-semibold"
                    : "hover:bg-blue-50/70 dark:hover:bg-white/[0.04] text-[#2d3f59] dark:text-slate-200 font-medium"
                }`}
              >
                {(location.pathname.startsWith('/colab') || location.pathname.startsWith('/chat')) && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#1a56db] dark:bg-blue-500 rounded-full" />
                )}
                <div className="w-5 flex items-center justify-center shrink-0">
                  <MdGroup size={19} className="shrink-0" />
                </div>
                <span className="ml-3.5 text-sm hide-on-collapse text-left flex-1">{t('sidebar.colab', 'Colab')}</span>
              </button>
            </div>
          )}

          {/* LABELS SECTION */}
          {!isChatMode && !isVaultMode && (
            <div className="pt-2">
              {/* Subtle divider */}
              <div className="my-2.5 px-3">
                <div className="h-px bg-blue-100/70 dark:bg-gray-800" />
              </div>

              {/* Labels header */}
              <div className="px-4 flex items-center justify-between mb-1.5 hide-on-collapse">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b9cb5] dark:text-gray-400">
                  {t('sidebar.labels', 'LABELS')}
                </span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="p-1 rounded-md text-[#2d3f59] dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title={t('sidebar.new_label', 'New Label')}
                >
                  <Plus size={16} strokeWidth={2.2} />
                </button>
              </div>

              {/* Labels list */}
              {(() => {
                const renderLabelTree = (parentId, depth = 0) => {
                  const children = labels.filter(l => l.parentId === parentId || (!l.parentId && parentId === null));
                  return children.map(label => {
                    const isLabelActive = location.pathname === `/label/${label.id}`;

                    return (
                      <div key={label.id} className="group">
                        <div
                          onClick={() => handleNavigation(`/label/${label.id}`)}
                          className={`w-[calc(100%-16px)] mx-2 my-0.5 flex items-center justify-between px-3.5 py-2 rounded-xl transition-all duration-150 cursor-pointer btn-collapse ${
                            isLabelActive
                              ? "bg-[#dce9fd] dark:bg-blue-900/30"
                              : "hover:bg-blue-50/70 dark:hover:bg-white/[0.04]"
                          }`}
                          style={{ paddingLeft: `${14 + (depth * 14)}px` }}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            {/* Simple colored tag icon aligned strictly in column */}
                            <div className="w-5 flex items-center justify-center shrink-0">
                              <MdLabel style={{ color: label.colorHex || "#135bec" }} size={17} className="shrink-0" />
                            </div>
                            <span
                              className={`ml-3.5 text-[14px] truncate hide-on-collapse ${
                                isLabelActive
                                  ? "text-[#1a56db] dark:text-blue-400 font-semibold"
                                  : "text-[#2d3f59] dark:text-gray-200 font-medium"
                              }`}
                            >
                              {label.name}
                            </span>
                          </div>

                          {/* 3-dot menu */}
                          <div className="relative flex items-center h-full hide-on-collapse ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLabelMenu(activeLabelMenu === label.id ? null : label.id);
                              }}
                              className={`p-1 rounded-md transition-opacity hover:bg-black/10 dark:hover:bg-white/10 shrink-0 text-[#2d3f59] dark:text-gray-300 ${
                                activeLabelMenu === label.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <MdMoreVert size={16} />
                            </button>

                            {activeLabelMenu === label.id && (
                              <div
                                ref={activeLabelMenu === label.id ? labelMenuRef : null}
                                className="absolute right-0 top-full mt-1 w-32 py-1 rounded-xl shadow-lg border z-50 text-xs overflow-hidden bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLabelMenu(null);
                                    setEditingLabel({ id: label.id, name: label.name, color: label.colorHex || "#135bec", parentId: label.parentId || "" });
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left text-gray-700 dark:text-gray-200"
                                >
                                  <MdEdit size={14} /> {t('common.edit', 'Edit')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLabelMenu(null);
                                    if (window.confirm(t('sidebar.delete_label_confirm', 'Are you sure you want to delete this label? Sub-labels will also be deleted.'))) {
                                      handleDeleteLabel(label.id);
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left text-red-500"
                                >
                                  <MdDelete size={14} /> {t('common.delete', 'Delete')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {renderLabelTree(label.id, depth + 1)}
                      </div>
                    );
                  });
                };
                return renderLabelTree(null);
              })()}
            </div>
          )}
        </nav>

        {/* BOTTOM SECTION: STORAGE + SETTINGS + SUPPORT */}
        <div className="space-y-1 mb-4 shrink-0 pt-2 border-t border-blue-100/70 dark:border-gray-800">
          <StorageWidget isDesktopOpen={isDesktopOpen} />

          {/* Settings */}
          <button
            onClick={() => handleNavigation("/settings")}
            className="w-[calc(100%-16px)] mx-2 my-0.5 flex items-center px-3.5 py-2.5 rounded-2xl transition-all duration-150 hover:bg-blue-50/70 dark:hover:bg-white/[0.04] cursor-pointer text-[#2d3f59] dark:text-slate-200 text-sm font-medium tracking-wide btn-collapse"
          >
            <div className="w-5 flex items-center justify-center shrink-0">
              <Settings size={19} strokeWidth={1.8} className="text-[#2d3f59] dark:text-slate-300" />
            </div>
            <span className="ml-3.5 hide-on-collapse">{t('sidebar.settings', 'Settings')}</span>
          </button>

          {/* Support & Help */}
          <button
            onClick={() => handleNavigation("/support")}
            className="w-[calc(100%-16px)] mx-2 my-0.5 flex items-center px-3.5 py-2.5 rounded-2xl transition-all duration-150 hover:bg-blue-50/70 dark:hover:bg-white/[0.04] cursor-pointer text-[#2d3f59] dark:text-slate-200 text-sm font-medium tracking-wide btn-collapse"
          >
            <div className="w-5 flex items-center justify-center shrink-0">
              <HelpCircle size={19} strokeWidth={1.8} className="text-[#2d3f59] dark:text-slate-300" />
            </div>
            <span className="ml-3.5 hide-on-collapse">{t('sidebar.support', 'Support & Help')}</span>
          </button>
        </div>
      </aside>

      {/* CREATE LABEL MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>{t('sidebar.new_label', 'New Label')}</h2>
              <button onClick={() => setIsCreating(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" style={{ color: theme.subText }}>
                <MdClose size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: theme.subText }}>{t('sidebar.label_name', 'Label Name')}</label>
                <input
                  autoFocus
                  placeholder={t('sidebar.label_placeholder', 'e.g. Work, Personal, Receipts')}
                  value={newLabel.name}
                  onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent outline-none transition-all"
                  style={{ color: theme.text, borderColor: theme.border }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: theme.subText }}>{t('sidebar.nest_under', 'Nest label under')}</label>
                <select
                  value={newLabel.parentId}
                  onChange={(e) => setNewLabel({ ...newLabel, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent outline-none transition-all cursor-pointer"
                  style={{ color: theme.text, borderColor: theme.border }}
                >
                  <option value="" style={{ color: "black" }}>{t('sidebar.top_level', 'Top Level (No Parent)')}</option>
                  {labels.map(l => (
                    <option key={l.id} value={l.id} style={{ color: "black" }}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.subText }}>{t('sidebar.color', 'Color')}</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewLabel({ ...newLabel, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer flex items-center justify-center`}
                      style={{
                        backgroundColor: c,
                        border: newLabel.color === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: newLabel.color === c ? `0 0 0 2px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                style={{ color: theme.text }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAddLabel}
                disabled={!newLabel.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: theme.accent || "#135bec" }}
              >
                {t('sidebar.create_label', 'Create Label')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LABEL MODAL */}
      {editingLabel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>{t('sidebar.edit_label', 'Edit Label')}</h2>
              <button onClick={() => setEditingLabel(null)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" style={{ color: theme.subText }}>
                <MdClose size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: theme.subText }}>{t('sidebar.label_name', 'Label Name')}</label>
                <input
                  autoFocus
                  placeholder={t('sidebar.label_placeholder', 'e.g. Work, Personal, Receipts')}
                  value={editingLabel.name}
                  onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent outline-none transition-all"
                  style={{ color: theme.text, borderColor: theme.border }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: theme.subText }}>{t('sidebar.nest_under', 'Nest label under')}</label>
                <select
                  value={editingLabel.parentId}
                  onChange={(e) => setEditingLabel({ ...editingLabel, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent outline-none transition-all cursor-pointer"
                  style={{ color: theme.text, borderColor: theme.border }}
                >
                  <option value="" style={{ color: "black" }}>{t('sidebar.top_level', 'Top Level (No Parent)')}</option>
                  {labels.filter(l => l.id !== editingLabel.id).map(l => (
                    <option key={l.id} value={l.id} style={{ color: "black" }}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.subText }}>{t('sidebar.color', 'Color')}</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditingLabel({ ...editingLabel, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer flex items-center justify-center`}
                      style={{
                        backgroundColor: c,
                        border: editingLabel.color === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: editingLabel.color === c ? `0 0 0 2px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button
                onClick={() => setEditingLabel(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                style={{ color: theme.text }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleEditLabelSubmit}
                disabled={!editingLabel.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: theme.accent || "#135bec" }}
              >
                {t('sidebar.save_changes', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SideBar;
