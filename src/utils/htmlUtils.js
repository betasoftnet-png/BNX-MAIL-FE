/**
 * Safely extracts clean, readable plain text from HTML content.
 * Prevents raw HTML tags (e.g. <p>hello</p>, <br>, <strong>) from displaying in email previews.
 * 
 * @param {string} rawHtml - HTML string or plain text
 * @returns {string} - Clean, single-line text without HTML tags or extra whitespace
 */
export const extractPlainTextFromHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  const trimmed = rawHtml.trim();
  if (!trimmed) return "";

  // If no HTML tags are present, decode common entities and normalize whitespace
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  try {
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "text/html");

      // Remove script, style, and noscript elements
      const unwanted = doc.querySelectorAll("script, style, noscript");
      unwanted.forEach((el) => el.remove());

      const text = doc.body.textContent || doc.body.innerText || "";
      return text.replace(/\s+/g, " ").trim();
    }
  } catch (e) {
    // Fall back to regex stripping below
  }

  // Regex fallback: strip style/script tags and all other HTML tags
  const noTags = trimmed
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*[\/]?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const decoded = noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return decoded.replace(/\s+/g, " ").trim();
};

/**
 * Extracts a clean preview snippet from an email object.
 * Inspects textPlain, body, htmlBody, or snippet, ensuring no raw HTML tags leak into the UI.
 * 
 * @param {object} email - Email or draft object
 * @returns {string} - Clean single-line snippet or empty string
 */
export const getEmailPreviewSnippet = (email) => {
  if (!email || typeof email !== "object") return "";

  // If textPlain exists, clean it in case it contains HTML tags (such as rich-text drafts)
  if (email.textPlain && typeof email.textPlain === "string") {
    const cleaned = extractPlainTextFromHtml(email.textPlain);
    if (cleaned) return cleaned;
  }

  // Otherwise extract from body / htmlBody / snippet
  const rawBody = email.body || email.htmlBody || email.snippet || "";
  if (!rawBody || typeof rawBody !== "string") return "";

  return extractPlainTextFromHtml(rawBody);
};

/**
 * Ensures all hyperlinks inside email HTML content open safely in a new browser tab.
 * - Adds target="_blank" and rel="noopener noreferrer" to all <a> tags with an href.
 * - Overrides any target="_self", target="_top", or target="_parent" to target="_blank".
 * - Strips any <base target="..."> tags that could override anchor targets.
 * - Preserves the exact URL, query parameters, verification tokens, and hashes.
 * 
 * @param {string} htmlContent - HTML string of the email body
 * @returns {string} - Transformed HTML string with target="_blank" and rel="noopener noreferrer"
 */
export const sanitizeAndTargetEmailLinks = (htmlContent) => {
  if (!htmlContent || typeof htmlContent !== "string") return "";

  try {
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");

      // Strip any <base> tags that could hijack link targets or relative URLs
      const baseElements = doc.querySelectorAll("base");
      baseElements.forEach((b) => b.remove());

      // Handle all hyperlinks safely
      const anchors = doc.querySelectorAll("a[href]");
      anchors.forEach((a) => {
        const href = (a.getAttribute("href") || "").trim();
        if (!href) return;

        // 1. Insecure/dangerous protocols
        if (/^(javascript|vbscript|data|file):/i.test(href)) {
          a.removeAttribute("href");
          a.setAttribute("role", "button");
          return;
        }

        // 2. Safe web links: enforce target="_blank" and rel="noopener noreferrer"
        if (/^(https?:)?\/\//i.test(href)) {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        } else if (/^mailto:/i.test(href)) {
          // Do NOT set target="_blank" on mailto links; opening a new tab targeting mailto triggers net::ERR_UNKNOWN_URL_SCHEME
          a.removeAttribute("target");
          a.setAttribute("rel", "noopener noreferrer");
        } else if (/^tel:/i.test(href)) {
          a.removeAttribute("target");
        } else if (href.startsWith("#")) {
          // Internal anchor - leave intact
          a.removeAttribute("target");
        } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
          // Any other unrecognized protocol (e.g. cid:, intent:, etc.)
          a.removeAttribute("href");
          a.setAttribute("role", "button");
        }
      });

      // Handle all inline images (especially cid: schemes from email MIME parts)
      const images = doc.querySelectorAll("img[src]");
      images.forEach((img) => {
        const src = (img.getAttribute("src") || "").trim();
        if (!src) return;

        if (/^cid:/i.test(src)) {
          // cid: is an email MIME Content-ID, unsupported by web browsers and throws ERR_UNKNOWN_URL_SCHEME
          const cidName = src.replace(/^cid:/i, "").replace(/^<|>$/g, "").trim();
          img.setAttribute("data-cid", cidName);
          // Set a safe 1x1 transparent placeholder so the browser doesn't attempt to fetch the unknown scheme
          img.setAttribute("src", "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E");
          img.setAttribute("loading", "lazy");
        } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src) && !/^(https?|data|blob):/i.test(src)) {
          // Any other unknown URL scheme on images
          img.setAttribute("src", "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E");
        }
      });

      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error("DOMParser error in sanitizeAndTargetEmailLinks:", err);
  }

  // Regex fallback in environments where DOMParser is unavailable or throws
  let cleaned = htmlContent.replace(/<img\b([^>]*?)src\s*=\s*(['"])cid:([^'"]*?)\2([^>]*?)>/gi, (match, before, quote, cid, after) => {
    const cleanCid = cid.replace(/^<|>$/g, "").trim();
    return `<img${before}src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E" data-cid="${cleanCid}" loading="lazy"${after}>`;
  });

  return cleaned.replace(/<a\b([^>]*?)>/gi, (match, attrs) => {
    if (!/href\s*=/i.test(attrs)) return match;

    const hrefMatch = attrs.match(/href\s*=\s*(['"])(.*?)\1/i);
    const href = hrefMatch ? hrefMatch[2].trim() : "";
    if (href.startsWith("#")) return match;

    if (/^mailto:/i.test(href)) {
      // Remove target="_blank" from mailto
      return `<a${attrs.replace(/target\s*=\s*(['"])[^'"]*\1/gi, '')}>`;
    }

    if (!/^(https?:)?\/\//i.test(href)) {
      // Non-web scheme - do not force target="_blank"
      return match;
    }

    let updated = attrs;
    if (/target\s*=\s*(['"])[^'"]*\1/i.test(updated)) {
      updated = updated.replace(/target\s*=\s*(['"])[^'"]*\1/i, 'target="_blank"');
    } else {
      updated += ' target="_blank"';
    }

    if (/rel\s*=\s*(['"])[^'"]*\1/i.test(updated)) {
      const currentRel = (updated.match(/rel\s*=\s*(['"])(.*?)\1/i) || [])[2] || "";
      const relParts = new Set(currentRel.split(/\s+/).filter(Boolean));
      relParts.add("noopener");
      relParts.add("noreferrer");
      updated = updated.replace(/rel\s*=\s*(['"])[^'"]*\1/i, `rel="${Array.from(relParts).join(" ")}"`);
    } else {
      updated += ' rel="noopener noreferrer"';
    }

    return `<a${updated}>`;
  });
};

const escapeHtml = (str) => {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Linkifies plain text containing URLs so that verification and reset links in plain text emails
 * open in a new browser tab with target="_blank" and rel="noopener noreferrer".
 * 
 * @param {string} text - Raw plain text
 * @returns {string} - HTML string with auto-linked URLs
 */
export const linkifyPlainText = (text) => {
  if (!text || typeof text !== "string") return "";

  // Match URLs starting with http://, https://, or www.
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const matchedUrl = match[0];
    const href = matchedUrl.startsWith("www.") ? `https://${matchedUrl}` : matchedUrl;
    const escapedDisplay = escapeHtml(matchedUrl);
    parts.push(`<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-medium hover:text-blue-700">${escapedDisplay}</a>`);
    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join("");
};
