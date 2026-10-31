/**
 * Recipient Autocomplete Suggestions Utility for BNXmail
 * Harvests, caches, and filters recipient suggestions based on the
 * logged-in user's sent and received email history.
 */

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-cyan-600',
];

export const getAvatarColor = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export const getInitials = (nameOrEmail) => {
  if (!nameOrEmail) return '?';
  const clean = nameOrEmail.trim();
  if (clean.includes(' ')) {
    const parts = clean.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
  }
  return clean[0].toUpperCase();
};

export const splitAddresses = (str) => {
  if (!str) return [];
  const items = [];
  let current = '';
  let inQuotes = false;
  let inAngle = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === '<') inAngle = true;
    else if (char === '>') inAngle = false;
    else if ((char === ',' || char === ';') && !inQuotes && !inAngle) {
      if (current.trim()) items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

export const parseAddress = (addr) => {
  if (!addr) return null;
  const str = String(addr).trim();
  if (!str) return null;

  // Pattern: "Display Name" <email@domain.com> or Display Name <email@domain.com>
  const angleMatch = str.match(/^(?:["']?([^"'<]+)["']?\s*)?<([^>]+)>$/);
  if (angleMatch) {
    const name = (angleMatch[1] || '').trim();
    const email = (angleMatch[2] || '').trim().toLowerCase();
    if (email && email.includes('@')) {
      return {
        name: name || email.split('@')[0],
        email
      };
    }
  }

  // Plain email or raw string
  const cleanEmail = str.replace(/["'<>]/g, '').trim().toLowerCase();
  if (cleanEmail && cleanEmail.includes('@')) {
    const name = cleanEmail.split('@')[0];
    return { name, email: cleanEmail };
  }

  return null;
};

export const extractContactsFromEmails = (emailList, currentUserEmail = '') => {
  if (!Array.isArray(emailList)) return [];
  const myEmail = (currentUserEmail || '').trim().toLowerCase();
  const contactsMap = new Map();

  emailList.forEach((email) => {
    if (!email) return;

    // Fields to inspect:
    // from / sender (received emails)
    // to / recipient (sent emails)
    // cc, bcc
    const rawFields = [
      email.from,
      email.sender,
      email.senderEmail,
      email.to,
      email.recipient,
      email.recipientEmail,
      email.cc,
      email.bcc
    ];

    rawFields.forEach((fieldVal) => {
      if (!fieldVal) return;
      const addresses = splitAddresses(fieldVal);
      addresses.forEach((addrStr) => {
        const parsed = parseAddress(addrStr);
        if (!parsed || !parsed.email) return;
        if (myEmail && parsed.email === myEmail) return;

        const key = parsed.email;
        if (!contactsMap.has(key)) {
          contactsMap.set(key, {
            email: parsed.email,
            name: parsed.name,
            count: 1,
            lastSeen: email.receivedDate || email.sentDate || email.date || email.createdAt || Date.now()
          });
        } else {
          const existing = contactsMap.get(key);
          existing.count = (existing.count || 1) + 1;
          // Prefer meaningful name over username fallback
          if (parsed.name && parsed.name !== parsed.email.split('@')[0]) {
            existing.name = parsed.name;
          }
        }
      });
    });
  });

  return Array.from(contactsMap.values());
};

const getStorageKey = (userEmail) => {
  const emailKey = (userEmail || 'default').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `bnx_recipient_history_${emailKey}`;
};

export const getStoredContacts = (userEmail) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userEmail));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveStoredContacts = (userEmail, contacts) => {
  if (typeof window === 'undefined' || !contacts) return;
  try {
    localStorage.setItem(getStorageKey(userEmail), JSON.stringify(contacts));
  } catch (e) {}
};

export const recordSentRecipient = (userEmail, recipientStr) => {
  if (!recipientStr || typeof window === 'undefined') return;
  const myEmail = (userEmail || '').trim().toLowerCase();
  const existingContacts = getStoredContacts(userEmail);
  const map = new Map(existingContacts.map(c => [c.email, c]));

  const addrs = splitAddresses(recipientStr);
  addrs.forEach(addr => {
    const parsed = parseAddress(addr);
    if (!parsed || !parsed.email) return;
    if (myEmail && parsed.email === myEmail) return;

    if (map.has(parsed.email)) {
      const existing = map.get(parsed.email);
      existing.count = (existing.count || 0) + 1;
      existing.lastSeen = Date.now();
      if (parsed.name && parsed.name !== parsed.email.split('@')[0]) {
        existing.name = parsed.name;
      }
    } else {
      map.set(parsed.email, {
        email: parsed.email,
        name: parsed.name,
        count: 1,
        lastSeen: Date.now()
      });
    }
  });

  const updated = Array.from(map.values());
  saveStoredContacts(userEmail, updated);
};

export const fetchAndSyncContacts = async (userEmail, mailAPI) => {
  if (!userEmail || !mailAPI) return getStoredContacts(userEmail);
  const myEmail = userEmail.trim().toLowerCase();
  const stored = getStoredContacts(myEmail);
  const contactsMap = new Map(stored.map(c => [c.email, c]));

  try {
    const [sentRes, inboxRes] = await Promise.allSettled([
      mailAPI.getSent(1, 50),
      mailAPI.getInbox(1, 50)
    ]);

    const allEmails = [];
    if (sentRes.status === 'fulfilled' && sentRes.value?.data) {
      const d = sentRes.value.data.data !== undefined ? sentRes.value.data.data : sentRes.value.data;
      const list = Array.isArray(d) ? d : (d?.emails || d?.messages || []);
      allEmails.push(...list);
    }
    if (inboxRes.status === 'fulfilled' && inboxRes.value?.data) {
      const d = inboxRes.value.data.data !== undefined ? inboxRes.value.data.data : inboxRes.value.data;
      const list = Array.isArray(d) ? d : (d?.emails || d?.messages || []);
      allEmails.push(...list);
    }

    const fetchedContacts = extractContactsFromEmails(allEmails, myEmail);
    fetchedContacts.forEach(fc => {
      if (!contactsMap.has(fc.email)) {
        contactsMap.set(fc.email, fc);
      } else {
        const existing = contactsMap.get(fc.email);
        existing.count = Math.max(existing.count || 1, fc.count || 1);
        if (fc.name && fc.name !== fc.email.split('@')[0]) {
          existing.name = fc.name;
        }
      }
    });

    const merged = Array.from(contactsMap.values());
    saveStoredContacts(myEmail, merged);
    return merged;
  } catch (err) {
    console.warn("Failed to sync recipient history in background:", err);
    return Array.from(contactsMap.values());
  }
};

export const getActiveRecipientQuery = (inputValue) => {
  if (!inputValue) return '';
  const tokens = inputValue.split(/[,;]/);
  return tokens[tokens.length - 1].trim();
};

export const getExistingRecipientEmails = (inputValue) => {
  if (!inputValue) return new Set();
  const tokens = inputValue.split(/[,;]/);
  tokens.pop(); // remove last active token
  const set = new Set();
  tokens.forEach(t => {
    const parsed = parseAddress(t);
    if (parsed && parsed.email) {
      set.add(parsed.email.toLowerCase());
    } else {
      const clean = t.trim().toLowerCase();
      if (clean) set.add(clean);
    }
  });
  return set;
};

export const filterRecipientSuggestions = (contacts, inputValue, limit = 8) => {
  const query = getActiveRecipientQuery(inputValue).toLowerCase();
  if (!query || query.length === 0) {
    return { query: '', suggestions: [] };
  }

  const existingEmails = getExistingRecipientEmails(inputValue);

  // Filter contacts
  const matches = (contacts || []).filter(c => {
    if (!c || !c.email) return false;
    const emailLower = c.email.toLowerCase();
    const nameLower = (c.name || '').toLowerCase();
    // Do not suggest someone already added
    if (existingEmails.has(emailLower)) return false;
    // Match query dynamically against email or name
    return emailLower.includes(query) || nameLower.includes(query);
  });

  // Sort matches by relevance:
  // 1. Email starts with query
  // 2. Name starts with query
  // 3. Email contains query
  // 4. Name contains query
  // 5. Contact count / frequency
  matches.sort((a, b) => {
    const aEmail = a.email.toLowerCase();
    const bEmail = b.email.toLowerCase();
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();

    const aEmailStarts = aEmail.startsWith(query);
    const bEmailStarts = bEmail.startsWith(query);
    if (aEmailStarts && !bEmailStarts) return -1;
    if (!aEmailStarts && bEmailStarts) return 1;

    const aNameStarts = aName.startsWith(query);
    const bNameStarts = bName.startsWith(query);
    if (aNameStarts && !bNameStarts) return -1;
    if (!aNameStarts && bNameStarts) return 1;

    const aCount = a.count || 1;
    const bCount = b.count || 1;
    if (bCount !== aCount) return bCount - aCount;

    return aEmail.localeCompare(bEmail);
  });

  return {
    query,
    suggestions: matches.slice(0, limit)
  };
};

export const applyRecipientSuggestion = (currentValue, suggestionEmail) => {
  if (!currentValue) return `${suggestionEmail}, `;
  const parts = currentValue.split(/[,;]/);
  parts.pop(); // Remove the currently typed query part
  const cleaned = parts.map(p => p.trim()).filter(Boolean);
  cleaned.push(suggestionEmail.trim());
  return cleaned.join(', ') + ', ';
};

/**
 * Extracts and normalizes an array of recipient email strings from any input format
 * (comma/semicolon-separated string, array of strings, object, etc.)
 */
export const extractRecipientAddresses = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.flatMap(item => extractRecipientAddresses(item));
  }
  if (typeof field === 'object') {
    if (field.email) return [field.email.trim()];
    if (field.address) return [field.address.trim()];
    if (field.value) return extractRecipientAddresses(field.value);
    return [];
  }
  if (typeof field !== 'string') return [];
  return splitAddresses(field).map(addrStr => {
    const parsed = parseAddress(addrStr);
    return parsed?.email || addrStr.trim();
  }).filter(Boolean);
};

/**
 * Returns distinct recipient groups (to, cc, bcc, all) for an email object.
 */
export const getParsedRecipientGroups = (email) => {
  if (!email) return { to: [], cc: [], bcc: [], all: [] };

  const dedupe = (arr) => {
    const seen = new Set();
    const result = [];
    arr.forEach(item => {
      if (!item) return;
      const k = item.toLowerCase().trim();
      if (!seen.has(k)) {
        seen.add(k);
        result.push(item.trim());
      }
    });
    return result;
  };

  const toList = [
    ...extractRecipientAddresses(email.to),
    ...extractRecipientAddresses(email.recipientEmail),
    ...extractRecipientAddresses(email.recipient),
    ...extractRecipientAddresses(email.recipients),
  ];
  const ccList = extractRecipientAddresses(email.cc);
  const bccList = extractRecipientAddresses(email.bcc);

  const cleanTo = dedupe(toList);
  const cleanCc = dedupe(ccList);
  const cleanBcc = dedupe(bccList);

  const allSeen = new Set();
  const all = [];
  [...cleanTo, ...cleanCc, ...cleanBcc].forEach(addr => {
    const k = addr.toLowerCase();
    if (!allSeen.has(k)) {
      allSeen.add(k);
      all.push(addr);
    }
  });

  return { to: cleanTo, cc: cleanCc, bcc: cleanBcc, all };
};

/**
 * Formats a specific recipient group (e.g. 'to', 'cc', 'bcc') as a comma-separated string.
 */
export const formatRecipientGroupDisplay = (email, group = 'to') => {
  if (!email) return '';
  const groups = getParsedRecipientGroups(email);
  if (groups[group] && groups[group].length > 0) {
    return groups[group].join(', ');
  }
  if (group === 'to') {
    return email.to || email.recipientEmail || email.recipient || '';
  }
  if (group === 'cc') return email.cc || '';
  if (group === 'bcc') return email.bcc || '';
  return '';
};

/**
 * Formats all recipient addresses (To, Cc, Bcc) for display in email rows and summary views.
 * If multiple recipients exist, joins them with commas.
 */
export const formatRecipientsDisplay = (email) => {
  if (!email) return '';
  const { all, to } = getParsedRecipientGroups(email);
  if (all.length > 0) {
    return all.join(', ');
  }
  return email.to || email.recipientEmail || email.recipient || '';
};

/**
 * Formats a complete tooltip with To, Cc, and Bcc breakdown for hovering.
 */
export const getRecipientFullTooltip = (email) => {
  if (!email) return '';
  const { to, cc, bcc } = getParsedRecipientGroups(email);
  const parts = [];
  if (to.length > 0) {
    parts.push(`To: ${to.join(', ')}`);
  }
  if (cc.length > 0) {
    parts.push(`Cc: ${cc.join(', ')}`);
  }
  if (bcc.length > 0) {
    parts.push(`Bcc: ${bcc.join(', ')}`);
  }
  if (parts.length > 0) {
    return parts.join(' | ');
  }
  return email.to || email.recipientEmail || email.recipient || '';
};

/**
 * Expands a single sent email into separate display rows for each recipient (To, Cc, Bcc).
 * Each row retains the original email object, but specifies:
 * - _displayRecipient: the individual recipient address (e.g. "recipient1@gmail.com")
 * - _displayRecipientType: "TO", "CC", or "BCC"
 * - _rowKey: unique string key for this recipient row
 */
export const expandEmailByRecipients = (email) => {
  if (!email) return [];
  const groups = getParsedRecipientGroups(email);
  const rows = [];
  const uid = email.uid ?? email.id ?? Math.random().toString(36).substring(2);

  // 1. Process To recipients
  if (groups.to && groups.to.length > 0) {
    groups.to.forEach((addr, idx) => {
      rows.push({
        ...email,
        _displayRecipient: addr,
        _displayRecipientType: 'TO',
        _rowKey: `${uid}__to__${addr}__${idx}`,
      });
    });
  }

  // 2. Process Cc recipients
  if (groups.cc && groups.cc.length > 0) {
    groups.cc.forEach((addr, idx) => {
      rows.push({
        ...email,
        _displayRecipient: addr,
        _displayRecipientType: 'CC',
        _rowKey: `${uid}__cc__${addr}__${idx}`,
      });
    });
  }

  // 3. Process Bcc recipients
  if (groups.bcc && groups.bcc.length > 0) {
    groups.bcc.forEach((addr, idx) => {
      rows.push({
        ...email,
        _displayRecipient: addr,
        _displayRecipientType: 'BCC',
        _rowKey: `${uid}__bcc__${addr}__${idx}`,
      });
    });
  }

  // Fallback if no recipients parsed
  if (rows.length === 0) {
    const fallbackAddr = email.to || email.recipientEmail || email.recipient || 'Unknown';
    rows.push({
      ...email,
      _displayRecipient: fallbackAddr,
      _displayRecipientType: 'TO',
      _rowKey: `${uid}__fallback__0`,
    });
  }

  return rows;
};


