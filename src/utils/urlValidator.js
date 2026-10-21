/**
 * URL and Hyperlink Validation and Normalization Utility for BNXmail.
 *
 * Rules:
 * 1. Rejects unsafe schemes (javascript:, data:, vbscript:, file:, blob:, etc.).
 * 2. Allows mailto: with a valid email address.
 * 3. Requires http: or https: scheme (or automatically prepends https:// if no protocol provided).
 * 4. Strictly validates domain structure:
 *    - Must have at least two labels (domain name + valid alphabetic TLD).
 *    - Rejects plain text (e.g., "ABCD", "hello", "12345").
 *    - Rejects malformed strings even if containing ".com" or ".in" outside a valid domain.
 *    - Labels must be 1-63 alphanumeric characters, may contain internal hyphens,
 *      and cannot start or end with a hyphen.
 *    - TLD must be purely alphabetic, between 2 and 24 characters (e.g., com, in, co, org, gov).
 */

const DANGEROUS_PROTOCOLS_REGEX = /^(javascript|data|vbscript|file|blob):/i;
const MAILTO_REGEX = /^mailto:([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const DOMAIN_LABEL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const TLD_REGEX = /^[a-zA-Z]{2,24}$/;

export function validateAndNormalizeUrl(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Reject URLs containing internal spaces or line breaks
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Reject dangerous protocols
  if (DANGEROUS_PROTOCOLS_REGEX.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Support mailto: with a valid email
  if (/^mailto:/i.test(trimmed)) {
    if (MAILTO_REGEX.test(trimmed)) {
      return {
        isValid: true,
        normalizedUrl: trimmed
      };
    }
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid email address.'
    };
  }

  // If user entered a plain email address like user@example.com
  if (EMAIL_REGEX.test(trimmed)) {
    return {
      isValid: true,
      normalizedUrl: `mailto:${trimmed}`
    };
  }

  // Check if string contains a protocol scheme (e.g. scheme:// or scheme:)
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  const hasScheme = Boolean(schemeMatch);

  if (hasScheme) {
    // Only http and https are allowed for web links
    if (!/^https?:\/\//i.test(trimmed)) {
      return {
        isValid: false,
        normalizedUrl: '',
        error: 'Please enter a valid URL.'
      };
    }
  }

  // Prepend https:// if no protocol was supplied
  const candidateUrl = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Protocol must be http: or https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Validate hostname
  const hostname = parsed.hostname;
  if (!hostname) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Must have at least two labels (e.g. domain and TLD)
  const labels = hostname.split('.');
  if (labels.length < 2) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Validate TLD (last label) - must be purely alphabetic, between 2 and 24 chars
  const tld = labels[labels.length - 1];
  if (!TLD_REGEX.test(tld)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid URL.'
    };
  }

  // Validate all domain labels
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label || !DOMAIN_LABEL_REGEX.test(label)) {
      return {
        isValid: false,
        normalizedUrl: '',
        error: 'Please enter a valid URL.'
      };
    }
  }

  // Auto-prepend https:// if entered without protocol
  const normalizedUrl = hasScheme ? trimmed : `https://${trimmed}`;

  return {
    isValid: true,
    normalizedUrl
  };
}

export default validateAndNormalizeUrl;
