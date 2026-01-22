/**
 * Email Service
 *
 * Handles email sending operations with SendGrid integration.
 * Manages email status updates and tracking.
 */

import { prisma } from '../lib/prisma';
import { sendEmail, isSendGridConfigured, getFromEmail, SendEmailResult } from '../lib/sendgrid';
import { EmailStatus } from '@prisma/client';

export interface SendEmailOptions {
  emailId: string;
  userId: string;
}

export interface SendEmailResponse {
  success: boolean;
  email?: {
    id: string;
    status: EmailStatus;
    sentAt: Date | null;
    sendgridMessageId: string | null;
  };
  error?: string;
  mockMode?: boolean;
}

/**
 * Check if email sending service is ready
 */
export function isEmailServiceReady(): boolean {
  return isSendGridConfigured();
}

/**
 * Get email service status
 */
export function getEmailServiceStatus(): { ready: boolean; fromEmail: { email: string; name: string } } {
  return {
    ready: isSendGridConfigured(),
    fromEmail: getFromEmail(),
  };
}

/**
 * Send a saved email to its contact
 */
export async function sendSavedEmail(options: SendEmailOptions): Promise<SendEmailResponse> {
  const { emailId, userId } = options;

  try {
    // Fetch the email with contact info
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: userId,
      },
      include: {
        contact: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!email) {
      return {
        success: false,
        error: 'Email not found or access denied',
      };
    }

    // Check if already sent
    if (email.status === 'sent' || email.status === 'delivered') {
      return {
        success: false,
        error: 'Email has already been sent',
      };
    }

    // Check if email is in a sendable state
    if (email.status !== 'draft' && email.status !== 'queued' && email.status !== 'failed') {
      return {
        success: false,
        error: `Cannot send email with status: ${email.status}`,
      };
    }

    // Validate recipient email
    if (!email.contact.email) {
      return {
        success: false,
        error: 'Contact does not have an email address',
      };
    }

    // Build recipient name
    const recipientName = [email.contact.firstName, email.contact.lastName]
      .filter(Boolean)
      .join(' ') || undefined;

    // Update status to queued before sending
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'queued' },
    });

    // Send the email
    const sendResult: SendEmailResult = await sendEmail({
      to: email.contact.email,
      toName: recipientName,
      subject: email.subject,
      text: email.bodyText,
      html: email.bodyHtml || undefined,
    });

    if (sendResult.success) {
      // Update email as sent
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sendgridMessageId: sendResult.messageId || null,
        },
      });

      return {
        success: true,
        email: {
          id: updatedEmail.id,
          status: updatedEmail.status,
          sentAt: updatedEmail.sentAt,
          sendgridMessageId: updatedEmail.sendgridMessageId,
        },
        mockMode: sendResult.mockMode,
      };
    } else {
      // Update email as failed
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'failed' },
      });

      return {
        success: false,
        error: sendResult.error || 'Failed to send email',
      };
    }
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);

    // Try to update status to failed
    try {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'failed' },
      });
    } catch {
      // Ignore update errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email',
    };
  }
}

/**
 * Send multiple emails (batch operation)
 */
export async function sendBatchEmails(
  emailIds: string[],
  userId: string
): Promise<{
  success: number;
  failed: number;
  results: Array<{ emailId: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ emailId: string; success: boolean; error?: string }> = [];
  let success = 0;
  let failed = 0;

  for (const emailId of emailIds) {
    const result = await sendSavedEmail({ emailId, userId });
    results.push({
      emailId,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, results };
}

/**
 * Update email tracking status (for webhooks)
 */
export async function updateEmailTracking(
  sendgridMessageId: string,
  event: 'delivered' | 'opened' | 'clicked' | 'bounced'
): Promise<boolean> {
  try {
    const email = await prisma.email.findFirst({
      where: { sendgridMessageId },
    });

    if (!email) {
      console.warn(`[EmailService] No email found for SendGrid message ID: ${sendgridMessageId}`);
      return false;
    }

    const updateData: Record<string, unknown> = {};
    const now = new Date();

    switch (event) {
      case 'delivered':
        updateData.status = 'delivered';
        break;
      case 'opened':
        updateData.status = 'opened';
        updateData.openedAt = now;
        break;
      case 'clicked':
        updateData.status = 'clicked';
        updateData.clickedAt = now;
        break;
      case 'bounced':
        updateData.status = 'bounced';
        updateData.bouncedAt = now;
        break;
    }

    await prisma.email.update({
      where: { id: email.id },
      data: updateData,
    });

    return true;
  } catch (error) {
    console.error('[EmailService] Error updating email tracking:', error);
    return false;
  }
}

/**
 * Get email statistics for a user
 */
export async function getEmailStats(userId: string): Promise<{
  total: number;
  draft: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}> {
  const emails = await prisma.email.groupBy({
    by: ['status'],
    where: { userId },
    _count: { status: true },
  });

  const stats = {
    total: 0,
    draft: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
    queued: 0,
  };

  for (const group of emails) {
    const count = group._count.status;
    stats.total += count;
    if (group.status in stats) {
      stats[group.status as keyof typeof stats] = count;
    }
  }

  // Remove queued from returned stats (internal state)
  const { queued, ...returnStats } = stats;
  return returnStats;
}
