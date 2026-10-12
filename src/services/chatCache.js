// High-performance Stale-While-Revalidate Chat & Colab Cache Service
// Provides instant (< 50ms) synchronous loads from L1 (Memory) and L2 (SessionStorage),
// request deduplication, and prefetching on card hover.

const memoryCache = {
  userChats: new Map(),      // email -> { data, timestamp }
  chatsById: new Map(),      // chatId (string/num) -> chat
  messages: new Map(),       // chatId -> { data, timestamp }
  broadcasts: new Map(),     // chatId -> { data, timestamp }
  members: new Map(),        // chatId -> { data, timestamp }
  inFlight: new Map(),       // key -> Promise
};

const SS_PREFIX = 'bnx_colab_';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes stale time for background revalidation

// Safe sessionStorage reader
const readSS = (key) => {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Safe sessionStorage writer with quota protection
const writeSS = (key, data) => {
  try {
    // Sanitize large base64 attachments from storage to keep sessionStorage tiny (< 50KB) and prevent QuotaExceededError
    const serialized = JSON.stringify(data, (k, v) => {
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 1000) {
        return '[data-url-omitted-from-storage]';
      }
      return v;
    });
    sessionStorage.setItem(SS_PREFIX + key, serialized);
  } catch (e) {
    try {
      // If quota exceeded, clean up stale colab keys and retry once
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith(SS_PREFIX) && k !== SS_PREFIX + key) {
          sessionStorage.removeItem(k);
        }
      });
      sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(data));
    } catch (e2) {
      // Gracefully ignore storage quota limits
    }
  }
};

// Initialize memory cache from sessionStorage for instant rehydration on reload
const rehydrateFromStorage = () => {
  try {
    const cachedChats = readSS('chats_list');
    if (Array.isArray(cachedChats)) {
      cachedChats.forEach(c => {
        if (c && c.id) {
          memoryCache.chatsById.set(String(c.id), c);
          memoryCache.chatsById.set(Number(c.id), c);
        }
      });
    }
  } catch (e) {
    // Ignore
  }
};

rehydrateFromStorage();

export const chatCache = {
  // Deduplicate inflight requests to prevent redundant simultaneous network calls
  dedupe(key, fetcher) {
    if (!key) return typeof fetcher === 'function' ? fetcher() : Promise.resolve(fetcher);
    if (memoryCache.inFlight.has(key)) {
      return memoryCache.inFlight.get(key);
    }
    try {
      const result = fetcher();
      const promise = Promise.resolve(result)
        .finally(() => {
          memoryCache.inFlight.delete(key);
        });
      memoryCache.inFlight.set(key, promise);
      return promise;
    } catch (err) {
      memoryCache.inFlight.delete(key);
      return Promise.reject(err);
    }
  },

  // User Chats (Colab list)
  getUserChats(email) {
    if (!email) return null;
    const mem = memoryCache.userChats.get(email);
    if (mem?.data) return mem.data;

    const stored = readSS(`user_chats_${email}`);
    if (stored && Array.isArray(stored)) {
      memoryCache.userChats.set(email, { data: stored, timestamp: Date.now() });
      stored.forEach(c => {
        if (c?.id) {
          memoryCache.chatsById.set(String(c.id), c);
          memoryCache.chatsById.set(Number(c.id), c);
        }
      });
      return stored;
    }
    return null;
  },

  setUserChats(email, chats) {
    if (!email || !Array.isArray(chats)) return;
    memoryCache.userChats.set(email, { data: chats, timestamp: Date.now() });
    chats.forEach(c => {
      if (c?.id) {
        memoryCache.chatsById.set(String(c.id), c);
        memoryCache.chatsById.set(Number(c.id), c);
      }
    });
    writeSS(`user_chats_${email}`, chats);
    writeSS('chats_list', chats);
  },

  hasUserChats(email) {
    return Boolean(this.getUserChats(email)?.length);
  },

  // Single Chat lookup
  getChat(chatId) {
    if (!chatId) return null;
    const fromMem = memoryCache.chatsById.get(String(chatId)) || memoryCache.chatsById.get(Number(chatId));
    if (fromMem) return fromMem;

    const fromSS = readSS(`chat_${chatId}`);
    if (fromSS) {
      memoryCache.chatsById.set(String(chatId), fromSS);
      return fromSS;
    }

    // Try finding in cached list
    const chatsList = readSS('chats_list');
    if (Array.isArray(chatsList)) {
      const found = chatsList.find(c => String(c.id) === String(chatId));
      if (found) {
        this.setChat(chatId, found);
        return found;
      }
    }
    return null;
  },

  setChat(chatId, chat) {
    if (!chatId || !chat) return;
    memoryCache.chatsById.set(String(chatId), chat);
    memoryCache.chatsById.set(Number(chatId), chat);
    writeSS(`chat_${chatId}`, chat);
  },

  // Messages
  getMessages(chatId) {
    if (!chatId) return null;
    const mem = memoryCache.messages.get(String(chatId));
    if (mem?.data) return mem.data;

    const stored = readSS(`messages_${chatId}`);
    if (stored && Array.isArray(stored)) {
      memoryCache.messages.set(String(chatId), { data: stored, timestamp: Date.now() });
      return stored;
    }
    return null;
  },

  setMessages(chatId, messages) {
    if (!chatId || !Array.isArray(messages)) return;
    memoryCache.messages.set(String(chatId), { data: messages, timestamp: Date.now() });
    writeSS(`messages_${chatId}`, messages);
  },

  hasMessages(chatId) {
    const list = this.getMessages(chatId);
    return Array.isArray(list);
  },

  // Broadcasts
  getBroadcasts(chatId) {
    if (!chatId) return null;
    const mem = memoryCache.broadcasts.get(String(chatId));
    if (mem?.data) return mem.data;

    const stored = readSS(`broadcasts_${chatId}`);
    if (stored && Array.isArray(stored)) {
      memoryCache.broadcasts.set(String(chatId), { data: stored, timestamp: Date.now() });
      return stored;
    }
    return null;
  },

  setBroadcasts(chatId, broadcasts) {
    if (!chatId || !Array.isArray(broadcasts)) return;
    memoryCache.broadcasts.set(String(chatId), { data: broadcasts, timestamp: Date.now() });
    writeSS(`broadcasts_${chatId}`, broadcasts);
  },

  hasBroadcasts(chatId) {
    const list = this.getBroadcasts(chatId);
    return Array.isArray(list);
  },

  invalidateBroadcasts(chatId) {
    if (!chatId) return;
    memoryCache.broadcasts.delete(String(chatId));
    try {
      sessionStorage.removeItem(SS_PREFIX + `broadcasts_${chatId}`);
    } catch (e) {}
  },

  invalidateChat(chatId) {
    if (!chatId) return;
    memoryCache.chatsById.delete(String(chatId));
    this.invalidateBroadcasts(chatId);
  },

  // Members
  getMembers(chatId) {
    if (!chatId) return null;
    const mem = memoryCache.members.get(String(chatId));
    if (mem?.data) return mem.data;

    const stored = readSS(`members_${chatId}`);
    if (stored && Array.isArray(stored)) {
      memoryCache.members.set(String(chatId), { data: stored, timestamp: Date.now() });
      return stored;
    }
    return null;
  },

  setMembers(chatId, members) {
    if (!chatId || !Array.isArray(members)) return;
    memoryCache.members.set(String(chatId), { data: members, timestamp: Date.now() });
    writeSS(`members_${chatId}`, members);
  },

  invalidateMembers(chatId) {
    if (!chatId) return;
    memoryCache.members.delete(String(chatId));
    try {
      sessionStorage.removeItem(SS_PREFIX + `members_${chatId}`);
    } catch (e) {}
  },

  // Pending Invitations
  getInvitations() {
    if (memoryCache.invitations?.data) return memoryCache.invitations.data;
    const stored = readSS('invitations');
    if (stored && Array.isArray(stored)) {
      memoryCache.invitations = { data: stored, timestamp: Date.now() };
      return stored;
    }
    return null;
  },

  setInvitations(invitations) {
    if (!Array.isArray(invitations)) return;
    memoryCache.invitations = { data: invitations, timestamp: Date.now() };
    writeSS('invitations', invitations);
  },

  // Prefetch Chat Room Data (called on hover over a Colab item)
  prefetchChat(chatId, chatAPI) {
    if (!chatId || !chatAPI) return;
    const idStr = String(chatId);

    // If already in memory and fresh, skip
    const existingMsgs = memoryCache.messages.get(idStr);
    if (!existingMsgs || Date.now() - existingMsgs.timestamp > CACHE_TTL_MS) {
      chatAPI.getMessageHistory(chatId)
        .then(res => {
          if (res?.data) {
            const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
            this.setMessages(idStr, list);
          }
        })
        .catch(() => {});
    }
  },
};

export default chatCache;
