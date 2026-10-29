import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMail } from "../context/MailContext";
import { 
  MdNotificationsNone, 
  MdRefresh, 
  MdMoreVert, 
  MdExpandMore, 
  MdChevronRight, 
  MdOutlineDrafts, 
  MdMailOutline, 
  MdDeleteOutline, 
  MdDoneAll, 
  MdLaunch 
} from "react-icons/md";
import EmailDetails from "../components/EmailDetails";
import { useTheme } from "../context/ThemeContext";
import BulkActionsToolbar from "../components/BulkActionsToolbar";
import ReadingPaneLayout from "../components/ReadingPaneLayout";
import toast from "react-hot-toast";
import { getEmailPreviewSnippet } from "../utils/htmlUtils";

const getSourceGroup = (email) => {
  const { t } = useTranslation();
  const fromStr = email.from || email.senderEmail || "";
  let name = "";
  let emailAddr = "";
  
  const match = fromStr.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    name = match[1].replace(/["']/g, "").trim();
    emailAddr = match[2].trim();
  } else {
    emailAddr = fromStr.trim();
    name = emailAddr.split("@")[0];
  }
  
  const emailLower = emailAddr.toLowerCase();
  const nameLower = name.toLowerCase();
  
  if (emailLower.includes("amazon") || nameLower.includes("amazon")) return "Amazon";
  if (emailLower.includes("flipkart") || nameLower.includes("flipkart")) return "Flipkart";
  if (emailLower.includes("linkedin") || nameLower.includes("linkedin")) return "LinkedIn";
  if (emailLower.includes("github") || nameLower.includes("github")) return "GitHub";
  if (emailLower.includes("google") || nameLower.includes("google")) return "Google";
  if (emailLower.includes("slack") || nameLower.includes("slack")) return "Slack";
  if (emailLower.includes("zoom") || nameLower.includes("zoom")) return "Zoom";
  
  const domainParts = emailLower.split("@");
  if (domainParts.length > 1) {
    const domain = domainParts[1];
    const parts = domain.split(".");
    if (parts.length > 1) {
      const mainPart = parts[parts.length - 2];
      const genericDomains = ["gmail", "yahoo", "hotmail", "outlook", "live", "mail"];
      if (!genericDomains.includes(mainPart)) {
        return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
      }
    }
  }
  
  if (name && name.length > 1 && !name.includes("@")) {
    return name;
  }
  
  return "System Alerts";
};

const getSourceDomain = (email, source) => {
  const fromStr = (email.from || email.senderEmail || "").toLowerCase();
  
  if (source === "Amazon") return "amazon.com";
  if (source === "Flipkart") return "flipkart.com";
  if (source === "LinkedIn") return "linkedin.com";
  if (source === "GitHub") return "github.com";
  if (source === "Google") return "google.com";
  if (source === "Slack") return "slack.com";
  if (source === "Zoom") return "zoom.us";
  
  const match = fromStr.match(/@([a-zA-Z0-9.-]+)/);
  if (match) {
    return match[1];
  }
  return "placeholder.com";
};

const isNotificationEmail = (email) => {
  const fromStr = (email.from || email.senderEmail || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();
  const category = (email.category || "").toLowerCase();
  
  if (["updates", "social", "promotions"].includes(category)) {
    return true;
  }
  
  const notificationKeywords = [
    "no-reply", "noreply", "notification", "alert", "news", "info", "update", 
    "newsletter", "billing", "order", "delivery", "transaction", "support",
    "amazon", "flipkart", "linkedin", "github", "google", "slack", "zoom"
  ];
  
  if (notificationKeywords.some(keyword => fromStr.includes(keyword) || subject.includes(keyword))) {
    return true;
  }
  
  return false;
};

const formatNotificationTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();
                  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() &&
                      date.getMonth() === yesterday.getMonth() &&
                      date.getFullYear() === yesterday.getFullYear();
                      
  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (isYesterday) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const Notification = ({ searchQuery }) => {
  const navigate = useNavigate();
  const { theme, readingPaneMode } = useTheme();
  const { 
    emails, 
    loading, 
    fetchEmails, 
    handleToggleStar, 
    handleMoveToTrash, 
    handleArchive, 
    handleMarkRead, 
    handleMarkUnread, 
    isEmailRead,
    handleSnooze,
    handleApplyLabel,
    openCompose 
  } = useMail();

  const [selectedEmailUid, setSelectedEmailUid] = useState(null);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showSmartFilter, setShowSmartFilter] = useState(true);

  useEffect(() => {
    fetchEmails('inbox');
  }, [fetchEmails]);

  // Synchronize prop search query
  useEffect(() => {
    if (searchQuery) {
      setLocalSearchQuery(searchQuery);
    }
  }, [searchQuery]);

  const handleRefresh = () => {
    fetchEmails('inbox', false);
  };

  const handleDoNotAskAgain = () => {
    setShowSmartFilter(false);
  };

  // Filter & Group Notifications
  const rawNotifications = emails.filter(isNotificationEmail);

  const filteredNotifications = rawNotifications.filter(e => {
    const sourceName = getSourceGroup(e);
    const search = localSearchQuery.toLowerCase();
    if (!search) return true;
    return (
      sourceName.toLowerCase().includes(search) ||
      (e.subject || "").toLowerCase().includes(search) ||
      (e.body || "").toLowerCase().includes(search) ||
      (e.textPlain || "").toLowerCase().includes(search)
    );
  });

  const groupsMap = {};
  filteredNotifications.forEach(email => {
    const source = getSourceGroup(email);
    if (!groupsMap[source]) {
      groupsMap[source] = {
        name: source,
        domain: getSourceDomain(email, source),
        emails: [],
        unreadCount: 0,
        latestDate: new Date(0)
      };
    }
    groupsMap[source].emails.push(email);
    if (!email.isRead) {
      groupsMap[source].unreadCount += 1;
    }
    const emailDate = new Date(email.date || email.receivedDate || email.sentDate || 0);
    if (emailDate > groupsMap[source].latestDate) {
      groupsMap[source].latestDate = emailDate;
    }
  });

  Object.keys(groupsMap).forEach(key => {
    groupsMap[key].emails.sort((a, b) => {
      const dateA = new Date(a.date || a.receivedDate || a.sentDate || 0);
      const dateB = new Date(b.date || b.receivedDate || b.sentDate || 0);
      return dateB - dateA;
    });
  });

  const sortedGroups = Object.values(groupsMap).sort((a, b) => {
    return b.latestDate - a.latestDate;
  });

  // Auto-expand new groups
  useEffect(() => {
    setExpandedGroups(prev => {
      const next = { ...prev };
      sortedGroups.forEach(g => {
        if (next[g.name] === undefined) {
          next[g.name] = true;
        }
      });
      return next;
    });
  }, [sortedGroups.length]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleMarkGroupRead = async (e, group) => {
    e.stopPropagation();
    for (const email of group.emails) {
      if (!email.isRead) {
        await handleMarkRead(email.uid);
      }
    }
    toast.success(`Marked all in ${group.name} as read`);
  };

  const handleMarkAllRead = async () => {
    const unreadEmails = rawNotifications.filter(e => !e.isRead);
    if (unreadEmails.length === 0) return;
    
    for (const email of unreadEmails) {
      await handleMarkRead(email.uid);
    }
    toast.success("All notifications marked as read");
  };

  const handleSelectEmail = (email) => {
    setSelectedEmailUid(email.uid);
    if (!email.isRead && !email.read) {
      handleMarkRead(email.uid, true, email);
    }
  };

  const selectedEmail = emails.find((e) => String(e.uid) === String(selectedEmailUid));

  const handleForward = (email) => {
    openCompose({
      forward: true,
      subject: email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject || ""}`,
      originalBody: email.body,
      originalEmail: email,
    });
  };

  const handleReply = (email) => {
    openCompose({
      replyTo: email.senderEmail || email.from,
      subject: `Re: ${email.subject || ""}`,
      originalBody: email.body,
    });
  };

  const unreadCountTotal = rawNotifications.filter(e => !(e.isRead || e.read || isEmailRead?.(e.uid ?? e.id))).length;

  const detailsComponent = selectedEmail ? (
    <EmailDetails
      emailList={filteredNotifications}
      onNavigate={(email) => {
        setSelectedEmailUid(email.uid);
        if (!email.isRead && !email.read) {
          handleMarkRead(email.uid, true, email);
        }
      }}
      email={selectedEmail}
      onBack={() => setSelectedEmailUid(null)}
      onClose={() => setSelectedEmailUid(null)}
      onDelete={(uid) => {
        handleMoveToTrash(uid, "notification");
        setSelectedEmailUid(null);
      }}
      onStar={(uid) => handleToggleStar(uid, "notification")}
      onArchive={(uid) => {
        handleArchive(uid, "notification");
        setSelectedEmailUid(null);
      }}
      onReply={handleReply}
      onForward={handleForward}
      onApplyLabel={handleApplyLabel}
      onSnooze={handleSnooze}
    />
  ) : null;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const headerComponent = selectedIds.size > 0 ? (
    <BulkActionsToolbar
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      visibleEmails={filteredNotifications}
      folder="notification"
    />
  ) : null;

  const listComponent = (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header bar */}
      <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between shrink-0 select-none gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">NotifyHub</h2>
          {unreadCountTotal > 0 && (
            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-2.5 py-0.5 rounded-full">
              {unreadCountTotal} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rawNotifications.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-700 dark:text-gray-300 font-medium"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-500"
            title="Refresh"
          >
            <MdRefresh size={16} />
          </button>
        </div>
      </div>

      {/* Search box row */}
      {rawNotifications.length > 0 && (
        <div className="px-4 py-2 border-b dark:border-gray-800 shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search notifications..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all"
              style={{
                backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderColor: theme.border,
                color: theme.text
              }}
            />
            <span className="absolute left-3 text-gray-400">ðŸ”</span>
          </div>
        </div>
      )}

      {/* Smart Filter banner */}
      {showSmartFilter && rawNotifications.length > 0 && (
        <div className="px-4 py-2 bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-100/50 dark:border-gray-800/50 flex flex-wrap items-center justify-between text-[11px] gap-3 shrink-0">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span className="text-blue-500">ðŸ’¡</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Smart Filter:</span>
            <span>Smart filter classifies notification emails and alerts automatically to this NotifyHub folder.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDoNotAskAgain}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:underline font-medium cursor-pointer"
            >
              Do not ask again
            </button>
          </div>
        </div>
      )}

      {/* Expandable Groups list */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar p-3 space-y-2.5">
        {loading && rawNotifications.length === 0 ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <MdNotificationsNone size={52} className="text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
            <p className="text-base font-semibold mb-1" style={{ color: theme.text }}>
              {localSearchQuery ? "No search matches" : "No updates yet"}
            </p>
            <p className="text-sm max-w-sm" style={{ color: theme.subText }}>
              {localSearchQuery 
                ? "Try searching for a different keyword or service." 
                : "Your notifications and updates from different services will appear here."}
            </p>
          </div>
        ) : (
          sortedGroups.map(group => {
            const isExpanded = !!expandedGroups[group.name];
            return (
              <div 
                key={group.name} 
                className="border dark:border-gray-800 rounded-2xl overflow-hidden transition-all duration-200 bg-white/[0.01] dark:bg-white/[0.005]"
                style={{ borderColor: theme.border }}
              >
                {/* Group Header */}
                <div 
                  onClick={() => toggleGroup(group.name)}
                  className="flex items-center justify-between p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-gray-400 dark:text-gray-500">
                      {isExpanded ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />}
                    </span>
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${group.domain}&sz=64`} 
                      alt={group.name} 
                      className="w-5 h-5 rounded-md object-contain bg-white shrink-0 border border-gray-100 dark:border-gray-800"
                      onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='%23ccc' d='M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z'/%3E%3C/svg%3E";
                      }}
                    />
                    <span className="font-semibold text-sm truncate" style={{ color: theme.text }}>
                      {group.name}
                    </span>
                    {group.unreadCount > 0 && (
                      <span className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {group.unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded-md">
                      {group.emails.length}
                    </span>
                    {group.unreadCount > 0 && (
                      <button
                        onClick={(e) => handleMarkGroupRead(e, group)}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-500 hover:text-green-600"
                        title="Mark group as read"
                      >
                        <MdDoneAll size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Body */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 divide-y dark:divide-gray-850">
                    {group.emails.map(email => {
                      const isUnread = !email.isRead;
                      const isSelected = String(email.uid) === String(selectedEmailUid);
                      const snippet = getEmailPreviewSnippet(email);
                      
                      return (
                        <div
                          key={email.uid}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectEmail(email);
                          }}
                          className={`flex items-start justify-between p-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all cursor-pointer group/item
                            ${isSelected ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-primary" : ""}
                          `}
                        >
                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            <span className="mt-1 shrink-0">
                              {isUnread ? (
                                <span className="block w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                              ) : (
                                <span className="block w-2 h-2 rounded-full bg-transparent" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className={`text-sm truncate ${isUnread ? "font-bold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"}`}>
                                  {email.subject || "(No Subject)"}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                                  {formatNotificationTime(email.date || email.receivedDate)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 pr-2">
                                {snippet || "No preview available"}
                              </p>
                            </div>
                          </div>
                          
                          {/* Item Hover Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity pl-2 shrink-0 self-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isUnread) handleMarkRead(email.uid);
                                else handleMarkUnread(email.uid);
                              }}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500"
                              title={isUnread ? "Mark as read" : "Mark as unread"}
                            >
                              {isUnread ? <MdOutlineDrafts size={15} /> : <MdMailOutline size={15} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveToTrash(email.uid, "notification");
                                if (isSelected) setSelectedEmailUid(null);
                              }}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                              title="Delete notification"
                            >
                              <MdDeleteOutline size={15} />
                            </button>
                            <a
                              href={`https://${group.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 flex items-center justify-center"
                              title="Open original website"
                            >
                              <MdLaunch size={14} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <ReadingPaneLayout
      mode={readingPaneMode || 'no_split'}
      hasSelection={!!selectedEmail}
      listComponent={listComponent}
      detailsComponent={detailsComponent}
      headerComponent={headerComponent}
    />
  );
};

export default Notification;
