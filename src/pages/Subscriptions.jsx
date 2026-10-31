import { useTranslation } from "../context/LanguageContext";
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { mailAPI, blockedContactsAPI } from "../services/api";
import {
  MdSearch,
  MdNotificationsActive,
  MdNotificationsOff,
  MdRefresh,
  MdMarkEmailRead,
  MdBlock,
  MdErrorOutline
} from "react-icons/md";
import toast from "react-hot-toast";

const Subscriptions = ({ searchQuery: propSearchQuery = "" }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [senders, setSenders] = useState([]);
  const [blockedSenders, setBlockedSenders] = useState([]);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all', 'subscribed', 'unsubscribed'
  const [actionLoading, setActionLoading] = useState({});

  const parseSender = (senderString) => {
    if (!senderString) return { name: "Unknown", email: "" };
    if (typeof senderString === "object") {
      const email = senderString.email || senderString.senderEmail || senderString.address || "";
      const name = senderString.name || senderString.sender || (email ? email.split("@")[0] : "Unknown");
      return { name, email };
    }
    const str = String(senderString).trim();
    if (str.includes("<") && str.includes(">")) {
      const name = str.substring(0, str.indexOf("<")).replace(/["']/g, "").trim();
      const email = str.substring(str.indexOf("<") + 1, str.indexOf(">")).trim();
      return { name: name || (email ? email.split("@")[0] : "Unknown"), email };
    }
    return { name: str.split("@")[0] || str, email: str };
  };

  const getEmailString = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item.trim().toLowerCase();
    return (item.email || item.senderEmail || item.blockedEmail || item.address || "").trim().toLowerCase();
  };

  const isFulfilledAndSuccessful = (res) => {
    if (res.status !== "fulfilled") return false;
    const val = res.value;
    if (!val) return true;
    if (typeof val.status === "number") {
      if (val.status >= 200 && val.status < 300) {
        if (val.data && typeof val.data === "object" && val.data.success === false) {
          return false;
        }
        return true;
      }
      return false;
    }
    if (val.success === false || val.error) return false;
    return true;
  };

  const fetchSubscriptionsData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      // Fetch data from available sources concurrently
      const [subscriptionsResult, inboxResult, blockedResult] = await Promise.allSettled([
        mailAPI.getSubscriptions ? mailAPI.getSubscriptions() : Promise.reject("Not implemented"),
        mailAPI.getInbox(1, 150),
        blockedContactsAPI.getBlockedContacts()
      ]);

      // 1. Process Blocked / Unsubscribed Contacts
      const blockedSet = new Set();
      let rawBlocked = [];
      if (blockedResult.status === "fulfilled" && blockedResult.value) {
        const val = blockedResult.value;
        if (Array.isArray(val)) {
          rawBlocked = val;
        } else if (Array.isArray(val.data)) {
          rawBlocked = val.data;
        } else if (Array.isArray(val.data?.data)) {
          rawBlocked = val.data.data;
        } else if (Array.isArray(val.blockedContacts)) {
          rawBlocked = val.blockedContacts;
        } else if (Array.isArray(val.contacts)) {
          rawBlocked = val.contacts;
        }
      }

      rawBlocked.forEach((item) => {
        const email = getEmailString(item);
        if (email) {
          blockedSet.add(email);
        }
      });

      const sendersMap = new Map();

      // 2. Process Dedicated Subscriptions API (if backend provides it)
      let subList = [];
      if (subscriptionsResult.status === "fulfilled" && subscriptionsResult.value) {
        const val = subscriptionsResult.value.data !== undefined ? subscriptionsResult.value.data : subscriptionsResult.value;
        if (Array.isArray(val)) {
          subList = val;
        } else if (Array.isArray(val?.data)) {
          subList = val.data;
        } else if (Array.isArray(val?.subscriptions)) {
          subList = val.subscriptions;
        } else if (Array.isArray(val?.senders)) {
          subList = val.senders;
        }
      }

      if (Array.isArray(subList)) {
        subList.forEach((sub) => {
          const parsed = parseSender(sub.from || sub.email || sub.senderEmail || sub.address || sub);
          if (!parsed.email) return;
          const lowerEmail = parsed.email.toLowerCase();

          const isExplicitlyUnsubscribed =
            sub.unsubscribed === true ||
            sub.isUnsubscribed === true ||
            sub.subscribed === false ||
            sub.isSubscribed === false ||
            sub.isBlocked === true ||
            sub.blocked === true ||
            ["unsubscribed", "inactive", "cancelled", "blocked"].includes(String(sub.status || "").toLowerCase());

          const isExplicitlySubscribed =
            sub.unsubscribed === false ||
            sub.isUnsubscribed === false ||
            sub.subscribed === true ||
            sub.isSubscribed === true ||
            ["subscribed", "active"].includes(String(sub.status || "").toLowerCase());

          if (isExplicitlyUnsubscribed) {
            blockedSet.add(lowerEmail);
          } else if (isExplicitlySubscribed) {
            blockedSet.delete(lowerEmail);
          }

          const count = typeof sub.count === "number" ? sub.count : (typeof sub.emailCount === "number" ? sub.emailCount : (typeof sub.totalEmails === "number" ? sub.totalEmails : 0));

          sendersMap.set(lowerEmail, {
            name: parsed.name || (parsed.email ? parsed.email.split("@")[0] : "Unknown"),
            email: parsed.email,
            count: count
          });
        });
      }

      // 3. Process Inbox Emails to extract all sender contacts
      if (inboxResult.status === "fulfilled" && inboxResult.value?.data) {
        const rawInbox = inboxResult.value.data.data !== undefined ? inboxResult.value.data.data : inboxResult.value.data;
        const emailsList = Array.isArray(rawInbox) ? rawInbox : (rawInbox?.emails || rawInbox?.messages || []);
        emailsList.forEach((email) => {
          const senderInfo = email.from || email.senderEmail || email.sender;
          if (!senderInfo) return;
          const parsed = parseSender(senderInfo);
          if (!parsed.email) return;

          const lowerEmail = parsed.email.toLowerCase();
          if (!sendersMap.has(lowerEmail)) {
            sendersMap.set(lowerEmail, {
              name: parsed.name || (parsed.email ? parsed.email.split("@")[0] : "Unknown"),
              email: parsed.email,
              count: 1
            });
          } else {
            const existing = sendersMap.get(lowerEmail);
            existing.count = (existing.count || 0) + 1;
            if (parsed.name && (!existing.name || existing.name === existing.email.split("@")[0])) {
              existing.name = parsed.name;
            }
          }
        });
      }

      // 4. Ensure all blocked/unsubscribed senders are represented in the list
      blockedSet.forEach((blockedEmail) => {
        const lowerEmail = blockedEmail.toLowerCase();
        if (!sendersMap.has(lowerEmail)) {
          sendersMap.set(lowerEmail, {
            name: blockedEmail.split("@")[0] || "Unknown",
            email: blockedEmail,
            count: 0
          });
        }
      });

      setBlockedSenders(Array.from(blockedSet));
      setSenders(Array.from(sendersMap.values()));
    } catch (err) {
      console.error("Error loading subscriptions:", err);
      if (!isSilent) {
        setError("Failed to load subscription data");
        toast.error("Failed to load subscription data");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionsData(false);
  }, [fetchSubscriptionsData]);

  const handleToggleBlock = async (senderEmail, isBlocked) => {
    const raw = typeof senderEmail === "string" ? senderEmail : (senderEmail?.email || senderEmail?.senderEmail || "");
    const cleanEmail = String(raw || "").trim();
    if (!cleanEmail) return;
    const lowerEmail = cleanEmail.toLowerCase();
    setActionLoading(prev => ({ ...prev, [lowerEmail]: true }));

    const toastMessage = isBlocked
      ? t("subscriptions.resubscribed", "Subscribed successfully")
      : t("subscriptions.unsubscribed", "Unsubscribed successfully");

    try {
      let results = [];
      if (isBlocked) {
        // Subscribe / Unblock sender
        const promises = [];
        if (mailAPI.subscribe) {
          promises.push(mailAPI.subscribe(cleanEmail));
        }
        if (blockedContactsAPI?.unblockSender) {
          promises.push(blockedContactsAPI.unblockSender(cleanEmail));
        }
        results = await Promise.allSettled(promises);
      } else {
        // Unsubscribe / Block sender
        const promises = [];
        if (mailAPI.unsubscribe) {
          promises.push(mailAPI.unsubscribe(cleanEmail));
        }
        if (blockedContactsAPI?.blockSender) {
          promises.push(blockedContactsAPI.blockSender(cleanEmail));
        }
        results = await Promise.allSettled(promises);
      }

      const hasSuccess = results.some(r => isFulfilledAndSuccessful(r));
      if (!hasSuccess) {
        const errorReason = results.find(r => r.status === "rejected")?.reason;
        throw errorReason || new Error("Failed to update subscription status");
      }

      // Update state only after successful confirmation
      if (isBlocked) {
        setBlockedSenders(prev => prev.filter(e => getEmailString(e) !== lowerEmail));
      } else {
        setBlockedSenders(prev => {
          const exists = prev.some(e => getEmailString(e) === lowerEmail);
          return exists ? prev : [...prev, cleanEmail];
        });
      }

      toast.success(toastMessage);

      // Refresh subscription list without requiring page reload
      await fetchSubscriptionsData(true);
    } catch (error) {
      console.error("Error toggling subscription:", error);
      toast.error(t("subscriptions.update_failed", "Failed to update status"));
    } finally {
      setActionLoading(prev => ({ ...prev, [lowerEmail]: false }));
    }
  };

  const effectiveSearch = (localSearchQuery || propSearchQuery || "").trim().toLowerCase();

  const isSenderBlocked = (email) => {
    if (!email) return false;
    const lower = email.trim().toLowerCase();
    return blockedSenders.some(b => getEmailString(b) === lower);
  };

  const filteredSenders = senders.filter((sender) => {
    if (!sender || !sender.email) return false;
    const senderEmailLower = sender.email.trim().toLowerCase();
    const isBlocked = isSenderBlocked(senderEmailLower);

    // Tab filter
    if (activeFilter === "subscribed" && isBlocked) return false;
    if (activeFilter === "unsubscribed" && !isBlocked) return false;

    // Search query filter
    if (effectiveSearch) {
      const nameMatch = (sender.name || "").toLowerCase().includes(effectiveSearch);
      const emailMatch = senderEmailLower.includes(effectiveSearch);
      if (!nameMatch && !emailMatch) return false;
    }

    return true;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* HEADER SECTION */}
      <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 bg-transparent shrink-0">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100/50 dark:border-gray-800/50">
          <div className="flex items-center gap-3">
            <span
              className="px-4 py-1.5 text-xs font-bold rounded-full shadow-sm text-white tracking-wide flex items-center gap-1.5 uppercase select-none"
              style={{ background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)` }}
            >
              <MdNotificationsActive size={15} /> {t("sidebar.subscriptions", "Subscriptions")} ({filteredSenders.length})
            </span>

            <button
              onClick={() => fetchSubscriptionsData(false)}
              disabled={loading}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer"
              title={t("common.refresh", "Refresh subscriptions")}
            >
              <MdRefresh size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* SEARCH BAR & CATEGORIES */}
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-transparent">
          {/* Tabs */}
          <div className="flex gap-2 text-sm font-medium border-b border-transparent">
            <button
              onClick={() => setActiveFilter("all")}
              className={`py-2 px-4 rounded-lg transition-all cursor-pointer ${activeFilter === "all"
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {t("subscriptions.all_senders", "All Senders")}
            </button>
            <button
              onClick={() => setActiveFilter("subscribed")}
              className={`py-2 px-4 rounded-lg transition-all cursor-pointer ${activeFilter === "subscribed"
                  ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-semibold"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {t("subscriptions.subscribed", "Subscribed")}
            </button>
            <button
              onClick={() => setActiveFilter("unsubscribed")}
              className={`py-2 px-4 rounded-lg transition-all cursor-pointer ${activeFilter === "unsubscribed"
                  ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {t("subscriptions.unsubscribed", "Unsubscribed")}
            </button>
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <MdSearch size={20} />
            </span>
            <input
              type="text"
              placeholder={t("subscriptions.search_placeholder", "Search senders...")}
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              style={{ outlineColor: theme.accent }}
            />
          </div>
        </div>
      </div>

      {/* SENDERS LIST SECTION */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" style={{ borderColor: theme.accent }}></div>
            <span className="mt-3 text-xs">{t("subscriptions.loading", "Loading subscriptions...")}</span>
          </div>
        ) : error && senders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
            <MdErrorOutline size={48} className="opacity-40 text-red-500 mb-3" />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{error}</p>
            <button
              onClick={() => fetchSubscriptionsData(false)}
              className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: theme.accent || "#135bec" }}
            >
              {t("common.try_again", "Try Again")}
            </button>
          </div>
        ) : filteredSenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
            <MdNotificationsOff size={48} className="opacity-20 mb-3" />
            <p className="text-sm font-medium">
              {effectiveSearch
                ? t("subscriptions.no_matching_senders", "No senders match your search")
                : activeFilter === "subscribed"
                  ? t("subscriptions.no_subscribed", "No active subscriptions found")
                  : activeFilter === "unsubscribed"
                    ? t("subscriptions.no_unsubscribed", "No unsubscribed senders found")
                    : t("subscriptions.no_senders", "No senders found")}
            </p>
            <p className="text-xs opacity-60 mt-1">
              {effectiveSearch
                ? t("subscriptions.try_different_search", "Try refining your search keyword")
                : activeFilter !== "all"
                  ? t("subscriptions.try_other_tabs", "Check other tabs or refresh to view senders")
                  : t("subscriptions.empty_subtitle", "Emails received in your inbox will appear here")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl mx-auto">
            {filteredSenders.map((sender) => {
              const senderEmailLower = (sender.email || "").trim().toLowerCase();
              const isBlocked = isSenderBlocked(senderEmailLower);
              const isItemLoading = Boolean(actionLoading[senderEmailLower]);
              const displayName = sender.name || (sender.email ? sender.email.split("@")[0] : "Unknown");
              const initialLetter = (displayName || "U").charAt(0).toUpperCase();

              return (
                <div
                  key={sender.email}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800/80 shadow-sm hover:shadow-md transition-all hover:scale-[1.005] duration-200"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold select-none text-white shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)`,
                        opacity: isBlocked ? 0.6 : 1
                      }}
                    >
                      {initialLetter}
                    </div>

                    <div className="min-w-0">
                      <h4 className={`text-sm font-semibold truncate ${isBlocked ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-800 dark:text-gray-200"}`}>
                        {displayName}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {sender.email}
                      </p>
                      {sender.count > 0 && (
                        <span className="inline-block mt-1 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                          {sender.count} {sender.count === 1 ? t("subscriptions.email_single", "email in inbox") : t("subscriptions.email_plural", "emails in inbox")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span
                      className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isBlocked
                          ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30"
                          : "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30"
                        }`}
                    >
                      {isBlocked ? <MdBlock size={13} /> : <MdMarkEmailRead size={13} />}
                      {isBlocked ? t("subscriptions.unsubscribed", "Unsubscribed") : t("subscriptions.subscribed", "Subscribed")}
                    </span>

                    {/* Action Button */}
                    <button
                      onClick={() => handleToggleBlock(sender.email, isBlocked)}
                      disabled={isItemLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${isBlocked
                          ? "bg-white hover:bg-green-50/50 text-green-600 border-green-200 hover:border-green-300 dark:bg-transparent dark:hover:bg-green-950/10 dark:text-green-400 dark:border-green-900/40"
                          : "bg-white hover:bg-red-50/50 text-red-600 border-red-200 hover:border-red-300 dark:bg-transparent dark:hover:bg-red-950/10 dark:text-red-400 dark:border-red-900/40"
                        }`}
                    >
                      {isItemLoading && <span className="animate-spin text-xs">●</span>}
                      {isBlocked ? t("subscriptions.subscribe", "Subscribe") : t("subscriptions.unsubscribe", "Unsubscribe")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Subscriptions;
