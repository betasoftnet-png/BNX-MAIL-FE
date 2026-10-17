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
