import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useMail } from "../context/MailContext";
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

const CACHE_STORAGE_KEY_PREFIX = "bnx_subscriptions_cache_";

let inMemorySubscriptionsCache = {
  userEmail: null,
  senders: [],
  blockedSenders: [],
  timestamp: 0
};

const getSubscriptionsCache = (userEmail) => {
  const emailKey = (userEmail || "anonymous").toLowerCase();
  if (
    inMemorySubscriptionsCache.userEmail === emailKey &&
    Array.isArray(inMemorySubscriptionsCache.senders) &&
    inMemorySubscriptionsCache.senders.length > 0
  ) {
    return inMemorySubscriptionsCache;
  }

  try {
    const raw = localStorage.getItem(`${CACHE_STORAGE_KEY_PREFIX}${emailKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.senders)) {
        inMemorySubscriptionsCache = {
          userEmail: emailKey,
          senders: parsed.senders || [],
          blockedSenders: parsed.blockedSenders || [],
          timestamp: parsed.timestamp || 0
        };
        return inMemorySubscriptionsCache;
      }
    }
  } catch (e) {
    console.warn("Failed to read subscriptions cache from localStorage", e);
  }
  return null;
};

const saveSubscriptionsCache = (userEmail, senders, blockedSenders) => {
  const emailKey = (userEmail || "anonymous").toLowerCase();
  const cacheData = {
    userEmail: emailKey,
    senders: Array.isArray(senders) ? senders : [],
    blockedSenders: Array.isArray(blockedSenders) ? blockedSenders : [],
    timestamp: Date.now()
  };
  inMemorySubscriptionsCache = cacheData;
  try {
    localStorage.setItem(`${CACHE_STORAGE_KEY_PREFIX}${emailKey}`, JSON.stringify(cacheData));
  } catch (e) {
    console.warn("Failed to save subscriptions cache to localStorage", e);
  }
};

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

const Subscriptions = ({ searchQuery: propSearchQuery = "" }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getFolderEmails } = useMail();

  const userEmail = (user?.email || "").toLowerCase();
  const cachedData = useMemo(() => getSubscriptionsCache(userEmail), [userEmail]);

  const [loading, setLoading] = useState(() => !cachedData || !cachedData.senders || cachedData.senders.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [senders, setSenders] = useState(() => cachedData?.senders || []);
  const [blockedSenders, setBlockedSenders] = useState(() => cachedData?.blockedSenders || []);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all', 'subscribed', 'unsubscribed'
  const [actionLoading, setActionLoading] = useState({});

  const sendersRef = useRef(senders);
  sendersRef.current = senders;

  const blockedSendersRef = useRef(blockedSenders);
  blockedSendersRef.current = blockedSenders;

  const activeFetchPromiseRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update state when active user email changes
  const prevUserEmailRef = useRef(userEmail);
  useEffect(() => {
    if (prevUserEmailRef.current !== userEmail) {
      prevUserEmailRef.current = userEmail;
      const freshCache = getSubscriptionsCache(userEmail);
      if (freshCache && freshCache.senders && freshCache.senders.length > 0) {
        setSenders(freshCache.senders);
        setBlockedSenders(freshCache.blockedSenders || []);
        setLoading(false);
        fetchSubscriptionsData(true);
      } else {
        setSenders([]);
        setBlockedSenders([]);
        setLoading(true);
        fetchSubscriptionsData(false);
      }
    }
  }, [userEmail]);

  const fetchSubscriptionsData = useCallback(async (isSilent = false) => {
    // If a fetch is already in flight, reuse the promise to prevent duplicate API requests
    if (activeFetchPromiseRef.current) {
      return activeFetchPromiseRef.current;
    }

    const currentSendersCount = sendersRef.current ? sendersRef.current.length : 0;
    const shouldShowFullLoading = !isSilent && currentSendersCount === 0;

    if (shouldShowFullLoading) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    const fetchPromise = (async () => {
      try {
        // Fast retrieval from local memory if already loaded in MailContext
        const localInboxEmails = typeof getFolderEmails === "function" ? getFolderEmails("inbox") : [];

        // Inbox fetch with timeout (50 emails instead of 150 for 3x-5x faster network & IMAP processing)
        const fetchInboxWithTimeout = async () => {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Inbox fetch timeout")), 8000)
            );
            const apiPromise = mailAPI.getInbox ? mailAPI.getInbox(1, 50) : Promise.resolve(null);
            return await Promise.race([apiPromise, timeoutPromise]);
          } catch (e) {
            console.warn("Subscriptions: Inbox fetch skipped or timed out, relying on available cached emails:", e?.message);
            return null;
          }
        };

        // Fetch data concurrently
        const [subscriptionsResult, inboxResult, blockedResult] = await Promise.allSettled([
          mailAPI.getSubscriptions ? mailAPI.getSubscriptions() : Promise.reject("Not implemented"),
          fetchInboxWithTimeout(),
          blockedContactsAPI?.getBlockedContacts ? blockedContactsAPI.getBlockedContacts() : Promise.reject("Not implemented")
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

        // Seed sendersMap with any previous senders in state so counts/names aren't lost if network was partial
        const sendersMap = new Map();
        if (sendersRef.current && sendersRef.current.length > 0) {
          sendersRef.current.forEach((sender) => {
            if (sender && sender.email) {
              const lower = sender.email.trim().toLowerCase();
              sendersMap.set(lower, { ...sender });
            }
          });
        }

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

            const existing = sendersMap.get(lowerEmail);
            sendersMap.set(lowerEmail, {
              name: parsed.name || (existing?.name) || (parsed.email ? parsed.email.split("@")[0] : "Unknown"),
              email: parsed.email,
              count: count || (existing?.count) || 0
            });
          });
        }

        // 3. Process Inbox Emails to extract all sender contacts
        let fetchedEmails = [];
        if (inboxResult.status === "fulfilled" && inboxResult.value?.data) {
          const rawInbox = inboxResult.value.data.data !== undefined ? inboxResult.value.data.data : inboxResult.value.data;
          if (Array.isArray(rawInbox)) {
            fetchedEmails = rawInbox;
          } else if (Array.isArray(rawInbox?.emails)) {
            fetchedEmails = rawInbox.emails;
          } else if (Array.isArray(rawInbox?.messages)) {
            fetchedEmails = rawInbox.messages;
          }
        }

        const combinedEmails = [...(localInboxEmails || []), ...fetchedEmails];
        const seenUids = new Set();
        const emailsList = [];
        for (let i = 0; i < combinedEmails.length; i++) {
          const email = combinedEmails[i];
          if (!email) continue;
          const uid = email.uid ?? email.id ?? `${email.from}_${email.subject}_${email.date}_${i}`;
          if (!seenUids.has(uid)) {
            seenUids.add(uid);
            emailsList.push(email);
          }
        }

        // If we found fresh inbox emails, recalculate counts accurately
        if (emailsList.length > 0) {
          const countsFromEmails = new Map();
          emailsList.forEach((email) => {
            const senderInfo = email.from || email.senderEmail || email.sender;
            if (!senderInfo) return;
            const parsed = parseSender(senderInfo);
            if (!parsed.email) return;

            const lowerEmail = parsed.email.toLowerCase();
            const currentCount = countsFromEmails.get(lowerEmail) || 0;
            countsFromEmails.set(lowerEmail, currentCount + 1);

            if (!sendersMap.has(lowerEmail)) {
              sendersMap.set(lowerEmail, {
                name: parsed.name || (parsed.email ? parsed.email.split("@")[0] : "Unknown"),
                email: parsed.email,
                count: 1
              });
            } else {
              const existing = sendersMap.get(lowerEmail);
              if (parsed.name && (!existing.name || existing.name === existing.email.split("@")[0])) {
                existing.name = parsed.name;
              }
            }
          });

          // Apply calculated email counts
          countsFromEmails.forEach((count, lowerEmail) => {
            const existing = sendersMap.get(lowerEmail);
            if (existing) {
              existing.count = count;
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

        const nextBlocked = Array.from(blockedSet);
        const nextSenders = Array.from(sendersMap.values());

        if (isMountedRef.current) {
          setBlockedSenders(nextBlocked);
          setSenders(nextSenders);
          setError(null);
          saveSubscriptionsCache(userEmail, nextSenders, nextBlocked);
        }
      } catch (err) {
        console.error("Error loading subscriptions:", err);
        if (isMountedRef.current) {
          if (!isSilent && sendersRef.current.length === 0) {
            setError("Failed to load subscription data");
            toast.error("Failed to load subscription data");
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
        activeFetchPromiseRef.current = null;
      }
    })();

    activeFetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [userEmail, getFolderEmails]);

  useEffect(() => {
    // If senders are already available from cache, fetch silently in the background
    const hasData = sendersRef.current && sendersRef.current.length > 0;
    fetchSubscriptionsData(hasData);
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

      // Update state and cache immediately upon confirmation
      let updatedBlocked;
      if (isBlocked) {
        updatedBlocked = blockedSendersRef.current.filter(e => getEmailString(e) !== lowerEmail);
      } else {
        const exists = blockedSendersRef.current.some(e => getEmailString(e) === lowerEmail);
        updatedBlocked = exists ? blockedSendersRef.current : [...blockedSendersRef.current, cleanEmail];
      }
      setBlockedSenders(updatedBlocked);
      saveSubscriptionsCache(userEmail, sendersRef.current, updatedBlocked);

      toast.success(toastMessage);

      // Refresh subscription list silently in background without blocking UI
      await fetchSubscriptionsData(true);
    } catch (error) {
      console.error("Error toggling subscription:", error);
      toast.error(t("subscriptions.update_failed", "Failed to update status"));
    } finally {
      if (isMountedRef.current) {
        setActionLoading(prev => ({ ...prev, [lowerEmail]: false }));
      }
    }
  };

  const effectiveSearch = (localSearchQuery || propSearchQuery || "").trim().toLowerCase();

  const blockedSendersSet = useMemo(() => {
    const set = new Set();
    blockedSenders.forEach(b => {
      const email = getEmailString(b);
      if (email) set.add(email);
    });
    return set;
  }, [blockedSenders]);

  const isSenderBlocked = useCallback((email) => {
    if (!email) return false;
    return blockedSendersSet.has(email.trim().toLowerCase());
  }, [blockedSendersSet]);

  const filteredSenders = useMemo(() => {
    return senders.filter((sender) => {
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
  }, [senders, isSenderBlocked, activeFilter, effectiveSearch]);

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
              disabled={loading || isRefreshing}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 flex items-center justify-center cursor-pointer"
              title={t("common.refresh", "Refresh subscriptions")}
            >
              <MdRefresh size={18} className={(loading || isRefreshing) ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* SEARCH BAR & CATEGORIES */}
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-transparent">
          {/* Tabs */}
          <div className="flex gap-2 text-xs sm:text-sm font-medium border-b border-transparent overflow-x-auto scroll-smooth hidden-scrollbar w-full md:w-auto py-0.5 min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setActiveFilter("all")}
              className={`py-2 px-3 sm:px-4 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeFilter === "all"
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {t("subscriptions.all_senders", "All Senders")}
            </button>
            <button
              onClick={() => setActiveFilter("subscribed")}
              className={`py-2 px-3 sm:px-4 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeFilter === "subscribed"
                ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-semibold"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {t("subscriptions.subscribed", "Subscribed")}
            </button>
            <button
              onClick={() => setActiveFilter("unsubscribed")}
              className={`py-2 px-3 sm:px-4 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeFilter === "unsubscribed"
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
        {loading && senders.length === 0 ? (
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
                      {isItemLoading && <span className="animate-spin text-xs">● </span>}
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
