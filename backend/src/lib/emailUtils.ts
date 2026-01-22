/**
 * Email Utility Functions
 *
 * Utilities for detecting business vs personal emails and domain extraction.
 * Used for determining which contacts need company research.
 */

// Common personal email providers
// This list covers ~95% of personal email usage
const PERSONAL_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'passport.com',

  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.com.au',
  'yahoo.co.in',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.co.jp',
  'ymail.com',
  'rocketmail.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // AOL
  'aol.com',
  'aim.com',

  // ProtonMail
  'protonmail.com',
  'proton.me',
  'pm.me',

  // Other popular providers
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'web.de',
  'inbox.com',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'tutanota.de',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'rambler.ru',

  // ISP-provided (common ones)
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'cox.net',
  'charter.net',
  'earthlink.net',
  'juno.com',
  'netzero.net',
  'btinternet.com',
  'sky.com',
  'virginmedia.com',
  'ntlworld.com',
  'talktalk.net',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  't-online.de',
  'arcor.de',

  // Education domains (generic - specific universities would be business-like)
  // Skipping .edu as those are institution-specific

  // Temporary/disposable email services
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'throwaway.email',
  'sharklasers.com',
  'trashmail.com',
]);

/**
 * Extract the domain from an email address
 * @param email - Full email address (e.g., "john@acme.com")
 * @returns Domain portion of email (e.g., "acme.com") or null if invalid
 */
export function extractDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email format validation
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) {
    return null;
  }

  const domain = trimmed.substring(atIndex + 1);

  // Basic domain validation - must have at least one dot
  if (!domain.includes('.')) {
    return null;
  }

  // Check for valid domain characters
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(domain)) {
    return null;
  }

  return domain;
}

/**
 * Check if an email address is from a business domain
 * @param email - Full email address to check
 * @returns true if business email, false if personal or invalid
 */
export function isBusinessEmail(email: string): boolean {
  const domain = extractDomain(email);

  if (!domain) {
    return false;
  }

  // Check against known personal domains
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  // Check for .edu domains (educational institutions - treat as non-business for research purposes)
  if (domain.endsWith('.edu') || domain.endsWith('.edu.au') || domain.endsWith('.ac.uk')) {
    return false;
  }

  // Check for government domains (can't sell to, treat as non-business)
  if (domain.endsWith('.gov') || domain.endsWith('.gov.uk') || domain.endsWith('.gov.au')) {
    return false;
  }

  // If not in personal list and not edu/gov, it's likely a business domain
  return true;
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // RFC 5322 simplified regex - catches most common cases
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  return emailRegex.test(trimmed);
}

/**
 * Get a normalized version of the email (lowercase, trimmed)
 * @param email - Email to normalize
 * @returns Normalized email or null if invalid
 */
export function normalizeEmail(email: string): string | null {
  if (!isValidEmail(email)) {
    return null;
  }
  return email.trim().toLowerCase();
}

// Export the personal domains set for testing/extension
export { PERSONAL_EMAIL_DOMAINS };
