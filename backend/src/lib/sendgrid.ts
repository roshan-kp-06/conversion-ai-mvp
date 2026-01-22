/**
 * SendGrid Client Setup
 *
 * Provides a configured SendGrid client for email sending.
 * Supports mock mode when API key is not configured.
 */

import sgMail from '@sendgrid/mail';

// Validate API key exists
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@conversion.ai';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Conversion AI';

if (!SENDGRID_API_KEY) {
  console.warn('[SendGrid] Warning: SENDGRID_API_KEY not set. Email sending will use mock mode.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Detect if the API key is a placeholder/example value
 */
function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  // Common placeholder patterns
  if (key.includes('your-') || key.includes('your_')) return true;
  if (key.includes('placeholder') || key.includes('example')) return true;
  if (key.startsWith('SG.test') || key.startsWith('test_')) return true;
  if (key.includes('xxx') || key.includes('XXX')) return true;
  // Too short to be a real key (SendGrid keys are ~70 chars)
  if (key.length < 50) return true;
  return false;
}

/**
 * Check if SendGrid is properly configured
 */
export function isSendGridConfigured(): boolean {
  return !!SENDGRID_API_KEY && !isPlaceholderKey(SENDGRID_API_KEY);
}

/**
 * Get the configured from email address
 */
export function getFromEmail(): { email: string; name: string } {
  return { email: FROM_EMAIL, name: FROM_NAME };
}

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mockMode?: boolean;
}

/**
 * Send an email via SendGrid
 * Returns mock response if API key not configured
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, toName, subject, text, html } = params;

  // Mock mode if not configured
  if (!isSendGridConfigured()) {
    console.log('[SendGrid Mock] Would send email:');
    console.log(`  To: ${toName ? `${toName} <${to}>` : to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${text.substring(0, 100)}...`);

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      mockMode: true,
    };
  }

  try {
    const msg = {
      to: toName ? { email: to, name: toName } : to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    };

    const response = await sgMail.send(msg);

    // Extract message ID from response headers
    const messageId = response[0]?.headers?.['x-message-id'] ||
                      `sg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error('[SendGrid] Error sending email:', error);

    // Extract error message
    let errorMessage = 'Failed to send email';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const sgError = error as { response?: { body?: { errors?: Array<{ message: string }> } } };
      if (sgError.response?.body?.errors?.[0]?.message) {
        errorMessage = sgError.response.body.errors[0].message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send a batch of emails
 * Uses SendGrid's batch sending for efficiency
 */
export async function sendBatchEmails(
  emails: SendEmailParams[]
): Promise<{ success: number; failed: number; results: SendEmailResult[] }> {
  const results: SendEmailResult[] = [];
  let success = 0;
  let failed = 0;

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    // Send batch concurrently
    const batchResults = await Promise.all(
      batch.map(email => sendEmail(email))
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { success, failed, results };
}

export { sgMail };
